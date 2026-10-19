import * as THREE from 'three';

// Bounded, fixed-step AABB solver. Collision shapes stay axis aligned (cubes and
// spheres look right while tumbling); no fake ragdoll claims.
const _c = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

// Closest axis-aligned orientation: a resting cube settles flat on a face.
export function nearestAxisQuaternion(q, out = new THREE.Quaternion()) {
  _m.makeRotationFromQuaternion(q);
  const x = new THREE.Vector3().setFromMatrixColumn(_m, 0), y = new THREE.Vector3().setFromMatrixColumn(_m, 1);
  const snap = (v, skip = -1) => {
    let best = 0, bestDot = -1;
    for (let i = 0; i < 3; i++) if (i !== skip && Math.abs(v.getComponent(i)) > bestDot) { bestDot = Math.abs(v.getComponent(i)); best = i; }
    return { axis: best, v: AXES[best].clone().multiplyScalar(Math.sign(v.getComponent(best)) || 1) };
  };
  const sx = snap(x), sy = snap(y, sx.axis), sz = new THREE.Vector3().crossVectors(sx.v, sy.v);
  return out.setFromRotationMatrix(_m.makeBasis(sx.v, sy.v, sz));
}

// Orientation of a tracked hand or controller: x across the knuckles, y along
// the fingers. Gaze and mouse pointers have none.
export function pointerFrame(p, out = new THREE.Quaternion()) {
  if (p?.source === 'xr' && p.quaternion) return out.copy(p.quaternion);
  const P = p?.hand?.points; if (!P || P.length < 18) return null;
  const x = P[5].clone().sub(P[17]), y = P[9].clone().sub(P[0]);
  if (x.lengthSq() < 1e-8 || y.lengthSq() < 1e-8) return null;
  x.normalize(); const z = new THREE.Vector3().crossVectors(x, y).normalize(); y.crossVectors(z, x);
  if (![x, y, z].every(v => v.toArray().every(Number.isFinite))) return null;
  return out.setFromRotationMatrix(_m.makeBasis(x, y, z));
}

export class RigidWorld {
  constructor({ gravity = -9.81, floor = 0, limit = 64 } = {}) {
    this.gravity = gravity; this.floor = floor; this.limit = limit;
    this.bodies = []; this.statics = []; this.accumulator = 0;
    this.hands = []; this.onImpact = null;
    this.joints = [];
  }
  add(mesh, { size = [0.2, 0.2, 0.2], mass = 1, bounce = 0.25, friction = 0.65, rotates = false, shape = 'box', breakSpeed = Infinity } = {}) {
    if (this.bodies.length >= this.limit) return null;
    const body = { mesh, half: new THREE.Vector3(...size).multiplyScalar(0.5), velocity: new THREE.Vector3(), angular: new THREE.Vector3(),
      mass: Math.max(0.01, mass), bounce, friction, rotates, shape, breakSpeed, held: null, holders: new Map(), grounded: false,
      origin: mesh.position.clone(), originQuaternion: mesh.quaternion.clone(), enabled: true, bounds: new THREE.Box3() };
    this.bodies.push(body); return body;
  }
  remove(body) {
    const i = this.bodies.indexOf(body); if (i < 0) return;
    this.bodies.splice(i, 1); body.holders.clear(); body.held = null; body.enabled = false;
    this.joints = this.joints.filter(j => j.a !== body && j.b !== body);
  }
  connect(a, b, distance = a.mesh.position.distanceTo(b.mesh.position)) {
    if (!a || !b || !Number.isFinite(distance) || distance <= 0) return null;
    const joint = { a, b, distance }; this.joints.push(joint); return joint;
  }
  solveJoints() {
    for (const { a, b, distance } of this.joints) {
      if (!a.enabled || !b.enabled) continue;
      const ia = a.held ? 0 : 1 / a.mass, ib = b.held ? 0 : 1 / b.mass, sum = ia + ib;
      if (!sum) continue;
      _v.subVectors(b.mesh.position, a.mesh.position); const length = _v.length();
      if (length < 1e-6) continue;
      _n.copy(_v).divideScalar(length);
      const correction = (length - distance) * 0.8;
      a.mesh.position.addScaledVector(_n, correction * ia / sum); b.mesh.position.addScaledVector(_n, -correction * ib / sum);
      const speed = b.velocity.clone().sub(a.velocity).dot(_n);
      a.velocity.addScaledVector(_n, speed * ia / sum * 0.6); b.velocity.addScaledVector(_n, -speed * ib / sum * 0.6);
      for (const body of [a, b]) if (!body.held) {
        body.mesh.position.y = Math.max(this.floor + body.half.y, body.mesh.position.y);
        for (const box of this.statics) this.resolve(body, box);
      }
    }
  }
  box(center, size) {
    const half = new THREE.Vector3(...size).multiplyScalar(0.5), p = new THREE.Vector3(...center);
    const box = new THREE.Box3(p.clone().sub(half), p.clone().add(half)); this.statics.push(box); return box;
  }
  reset() {
    for (const b of this.bodies) {
      b.mesh.position.copy(b.origin); b.mesh.quaternion.copy(b.originQuaternion); b.velocity.set(0, 0, 0); b.angular.set(0, 0, 0);
      b.held = null; b.holders.clear(); b.enabled = true; b.mesh.visible = true;
    }
    this.accumulator = 0;
  }
  release(body, velocity = new THREE.Vector3(), angular = null) {
    body.held = null; body.holders.clear(); body.velocity.copy(velocity);
    if (!body.velocity.toArray().every(Number.isFinite)) body.velocity.set(0, 0, 0);
    body.velocity.clampLength(0, 8);
    if (angular && body.rotates) body.angular.copy(angular).clampLength(0, 25);
    if (!body.angular.toArray().every(Number.isFinite)) body.angular.set(0, 0, 0);
  }
  bounds(b) { b.bounds.min.copy(b.mesh.position).sub(b.half); b.bounds.max.copy(b.mesh.position).add(b.half); return b.bounds; }
  // Kinematic hand spheres: { id, position, velocity, radius }. Hands push and
  // knock objects but are never pushed back.
  setHands(hands) { this.hands = hands || []; }
  update(dt) {
    dt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
    for (const b of this.bodies) if (b.enabled && b.holders.size) this.follow(b, dt);
    this.accumulator += dt;
    const step = 1 / 120;
    while (this.accumulator + 1e-10 >= step) { this.step(step); this.accumulator = Math.max(0, this.accumulator - step); }
  }
  // Held bodies chase the hand with a stiffness that drops with mass: light
  // objects snap into the hand, heavy ones lag and sag unless both hands help.
  follow(b, dt) {
    if (!(dt > 0)) return;
    const target = new THREE.Vector3(); let count = 0, rotation = null;
    for (const h of b.holders.values()) if (h.target) { target.add(h.target); count++; if (!rotation && h.rotation) rotation = h.rotation; }
    if (!count) return;
    target.divideScalar(count);
    const load = b.mass / b.holders.size;
    target.y -= THREE.MathUtils.clamp((load - 1.2) * 0.05, 0, 0.3);
    const k = 1 - Math.exp(-dt * 38 / Math.max(0.35, load));
    const before = b.mesh.position.clone();
    const delta = target.sub(b.mesh.position).multiplyScalar(k).clampLength(0, 0.12);
    const count2 = Math.max(1, Math.ceil(delta.length() / 0.015));
    const holders = b.holders; b.holders = new Map(); const owner = b.held; b.held = null; b.following = true;
    for (let i = 0; i < count2; i++) {
      b.mesh.position.addScaledVector(delta, 1 / count2);
      b.mesh.position.y = Math.max(this.floor + b.half.y, b.mesh.position.y);
      for (const box of this.statics) this.resolve(b, box);
    }
    b.holders = holders; b.held = owner; b.following = false;
    // Measured motion, not hand motion, becomes the throw: heavy objects fly less.
    _v.copy(b.mesh.position).sub(before).divideScalar(dt);
    b.velocity.lerp(_v, 0.5);
    if (b.rotates && rotation) {
      const previous = b.mesh.quaternion.clone();
      b.mesh.quaternion.slerp(rotation, k);
      _q.copy(b.mesh.quaternion).multiply(previous.invert());
      if (_q.w < 0) { _q.x = -_q.x; _q.y = -_q.y; _q.z = -_q.z; _q.w = -_q.w; }
      const angle = 2 * Math.acos(Math.min(1, _q.w)), s = Math.sqrt(Math.max(0, 1 - _q.w * _q.w));
      _v.set(_q.x, _q.y, _q.z); if (s > 1e-6) _v.divideScalar(s); else _v.set(0, 0, 0);
      b.angular.lerp(_v.multiplyScalar(angle / dt), 0.5);
    }
  }
  step(dt) {
    // Four small spatial steps bound tunneling at the supported 8 m/s throw speed.
    for (let sub = 0; sub < 4; sub++) {
      const h = dt / 4;
      for (const b of this.bodies) {
        if (!b.enabled || b.held) continue;
        b.grounded = false;
        b.velocity.y += this.gravity * h;
        b.mesh.position.addScaledVector(b.velocity, h);
        if (b.mesh.position.y - b.half.y < this.floor) {
          this.impact(b, -b.velocity.y);
          b.mesh.position.y = this.floor + b.half.y;
          b.velocity.y = b.velocity.y < -0.4 ? -b.velocity.y * b.bounce : 0;
          const drag = Math.exp(-b.friction * 12 * h); b.velocity.x *= drag; b.velocity.z *= drag;
          b.grounded = true;
        }
        for (const box of this.statics) this.resolve(b, box);
        for (const hand of this.hands) this.push(b, hand);
        if (b.mesh.position.y < this.floor - 20 || b.mesh.position.length() > 500) {
          b.mesh.position.copy(b.origin); b.velocity.set(0, 0, 0); b.angular.set(0, 0, 0);
        }
      }
      for (let iteration = 0; iteration < 3; iteration++) for (let i = 0; i < this.bodies.length; i++) {
        const a = this.bodies[i]; if (!a.enabled) continue;
        for (let j = i + 1; j < this.bodies.length; j++) {
          const b = this.bodies[j]; if (b.enabled && (!a.held || !b.held) && !(a.collisionGroup && a.collisionGroup === b.collisionGroup)) this.resolve(a, this.bounds(b), b);
        }
      }
      for (let i = 0; i < 4; i++) this.solveJoints();
      for (const b of this.bodies) if (b.enabled && !b.held && b.rotates) this.spin(b, h);
    }
  }
  spin(b, h) {
    if (b.grounded) {
      if (b.shape === 'sphere') {
        // Rolling without slipping on the ground.
        const r = Math.max(0.01, b.half.y);
        b.angular.set(b.velocity.z / r, b.angular.y * Math.exp(-4 * h), -b.velocity.x / r);
      } else {
        b.angular.multiplyScalar(Math.exp(-14 * h));
        if (b.velocity.lengthSq() < 0.25) b.mesh.quaternion.slerp(nearestAxisQuaternion(b.mesh.quaternion, _q), 1 - Math.exp(-10 * h));
      }
    }
    const w = b.angular.length();
    if (w > 1e-5) b.mesh.quaternion.premultiply(_q.setFromAxisAngle(_n.copy(b.angular).divideScalar(w), w * h)).normalize();
  }
  impact(b, speed) { if (speed > 1.2 && !b.following) this.onImpact?.(b, speed); }
  push(b, hand) {
    if (b.holders.has(hand.id)) return;
    const box = this.bounds(b), closest = box.clampPoint(hand.position, _v);
    const distance = closest.distanceTo(hand.position);
    if (distance >= hand.radius) return;
    if (distance > 1e-6) _n.copy(closest).sub(hand.position).divideScalar(distance);
    else { _n.copy(b.mesh.position).sub(hand.position); if (_n.lengthSq() < 1e-10) _n.set(0, 1, 0); _n.normalize(); }
    b.mesh.position.addScaledVector(_n, hand.radius - distance);
    const relative = b.velocity.dot(_n) - hand.velocity.dot(_n);
    if (relative < 0) {
      b.velocity.addScaledVector(_n, -relative * 1.15);
      // An off-center slap spins the object.
      if (b.rotates) b.angular.add(_v.subVectors(closest, b.mesh.position).cross(_n).multiplyScalar(-relative * 6 / Math.max(0.05, b.half.length())));
      b.velocity.clampLength(0, 8); b.angular.clampLength(0, 25);
    }
  }
  // Round bodies touch boxes at the closest point, so a ball rolls off an
  // edge or bounces from a corner instead of sliding along a flat face.
  resolveSphere(a, box, b = null) {
    const r = Math.min(a.half.x, a.half.y, a.half.z), c = a.mesh.position;
    const closest = box.clampPoint(c, _c), d = closest.distanceTo(c);
    if (d >= r) return true;
    if (d < 1e-6) return false; // centre inside the box: fall back to the axis solver
    _n.subVectors(c, closest).divideScalar(d);
    const ia = a.held ? 0 : 1 / a.mass, ib = b && !b.held ? 1 / b.mass : 0, sum = ia + ib;
    if (!sum) return true;
    const depth = r - d + 1e-5;
    c.addScaledVector(_n, depth * ia / sum);
    if (b) b.mesh.position.addScaledVector(_n, -depth * ib / sum);
    const relative = a.velocity.dot(_n) - (b ? b.velocity.dot(_n) : 0);
    if (relative < 0) {
      if (!a.held) this.impact(a, -relative);
      if (b && !b.held) this.impact(b, -relative);
      const impulse = -(1 + Math.min(a.bounce, b?.bounce ?? a.bounce)) * relative / sum;
      a.velocity.addScaledVector(_n, impulse * ia);
      if (b) b.velocity.addScaledVector(_n, -impulse * ib);
    }
    if (_n.y > 0.6) { a.grounded = true; a.velocity.x *= 0.995; a.velocity.z *= 0.995; }
    else if (_n.y < -0.6 && b) b.grounded = true;
    return true;
  }
  resolve(a, box, b = null) {
    const bounds = this.bounds(a); if (!bounds.intersectsBox(box)) return;
    if (a.shape === 'sphere' && this.resolveSphere(a, box, b)) return;
    let axis = 'x', depth = Infinity, sign = 1;
    for (const key of ['x', 'y', 'z']) {
      const low = bounds.max[key] - box.min[key], high = box.max[key] - bounds.min[key];
      const amount = Math.min(low, high);
      if (amount < depth) { depth = amount; axis = key; sign = low < high ? -1 : 1; }
    }
    if (depth <= 0) return;
    const ia = a.held ? 0 : 1 / a.mass, ib = b && !b.held ? 1 / b.mass : 0, sum = ia + ib;
    if (!sum) return;
    a.mesh.position[axis] += sign * (depth + 1e-5) * ia / sum;
    if (b) b.mesh.position[axis] -= sign * (depth + 1e-5) * ib / sum;
    const relative = (a.velocity[axis] - (b?.velocity[axis] || 0)) * sign;
    if (relative < 0) {
      if (!a.held) this.impact(a, -relative);
      if (b && !b.held) this.impact(b, -relative);
      const impulse = -(1 + Math.min(a.bounce, b?.bounce ?? a.bounce)) * relative / sum;
      a.velocity[axis] += sign * impulse * ia;
      if (b) b.velocity[axis] -= sign * impulse * ib;
    }
    if (axis === 'y') {
      for (const k of ['x', 'z']) a.velocity[k] *= 0.98;
      if (sign > 0) a.grounded = true; else if (b) b.grounded = true;
    }
  }
}

// Pinch (or trigger) grabs. Hands keep the grab point and turn the object with
// the wrist; a far grab pulls the object into the hand. Two hands can share
// one object, splitting its weight.
export function grabbable(ctx, world, body, { twoHands = true, onGrab = null, register = true } = {}) {
  const frame = new THREE.Quaternion();
  const anchorOf = p => p.source === 'hand' || p.source === 'xr' ? p.handPos : null;
  const attach = (p, holder) => {
    const anchor = anchorOf(p), q = pointerFrame(p, frame);
    if (!anchor) return;
    holder.offset = body.mesh.position.clone().sub(anchor);
    // A far grab pulls the object into the palm instead of keeping the gap.
    if (holder.offset.length() > body.half.length() + 0.12) holder.offset.set(0, 0, 0);
    if (q) { const inverse = q.clone().invert(); holder.offset.applyQuaternion(inverse); holder.relative = inverse.multiply(body.mesh.quaternion); }
    else holder.relative = null;
  };
  const drag = {
    start(p, hit) {
      if (!body.enabled || body.holders.has(p.id) || body.holders.size >= (twoHands ? 2 : 1)) return;
      onGrab?.(p);
      const holder = { distance: Math.min(1.8, Math.max(0.15, hit?.distance || 0.65)), target: null, rotation: null };
      attach(p, holder);
      if (!body.holders.size) { body.velocity.set(0, 0, 0); body.angular.set(0, 0, 0); }
      body.holders.set(p.id, holder); body.held = body.held || p.id;
      drag.move(p);
    },
    move(p) {
      const holder = body.holders.get(p.id); if (!holder) return;
      const anchor = anchorOf(p);
      if (!anchor) { holder.target = p.ray.at(holder.distance, holder.target || new THREE.Vector3()); return; }
      const q = holder.relative ? pointerFrame(p, frame) : null;
      holder.target = (holder.target || new THREE.Vector3()).copy(holder.offset);
      if (q) { holder.target.applyQuaternion(q); holder.rotation = (holder.rotation || new THREE.Quaternion()).copy(q).multiply(holder.relative); }
      holder.target.add(anchor);
    },
    end(p) {
      if (p && !body.holders.has(p.id)) return;
      if (p && body.holders.size > 1) {
        body.holders.delete(p.id); body.held = body.holders.keys().next().value;
        // The remaining hand re-grips where the object is now: no jump.
        const [id, holder] = body.holders.entries().next().value, other = ctx.input?.pointers?.find(q => q.id === id);
        if (other) attach(other, holder);
        return;
      }
      world.release(body, !p || p.stale ? new THREE.Vector3() : body.velocity, !p || p.stale ? null : body.angular);
    },
  };
  body.grab = drag;
  if (register) ctx.addUI(body.mesh, { sound: false, drag });
  return body;
}

// Kinematic sphere for each tracked palm, for objects to collide with.
export function trackHands(ctx, world, radius = 0.055) {
  const previous = new Map();
  return dt => {
    const hands = [];
    for (const p of ctx.input?.pointers || []) {
      if (p.system || p.stale || (p.source !== 'hand' && p.source !== 'xr')) continue;
      const position = (p.hand?.palm || p.handPos).clone(), old = previous.get(p.id);
      const velocity = old && dt > 0 ? position.clone().sub(old).divideScalar(dt).clampLength(0, 8) : new THREE.Vector3();
      previous.set(p.id, position);
      // A hand reaching in slowly to pinch must not shove the object away.
      if (!p.pinch && velocity.length() > 0.35) hands.push({ id: p.id, position, velocity, radius });
    }
    const seen = new Set((ctx.input?.pointers || []).map(p => p.id));
    for (const id of previous.keys()) if (!seen.has(id)) previous.delete(id);
    world.setHands(hands);
    return hands;
  };
}
