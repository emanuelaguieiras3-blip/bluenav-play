// Arm locomotion in the style of Gorilla Tag: no legs, no joystick. A hand
// that meets a surface stays there and the body moves instead; releasing a
// push keeps the averaged body velocity (x1.1, at most 6.5 m/s), so runs and
// jumps come from the arms alone. Works with Quest hands, controllers and the
// phone camera hands, because it only reads palm positions.
import * as THREE from 'three';
import { walkStep } from '../core/locomotion.js';

export const GORILLA = { gravity: 9.81, handRadius: 0.07, headRadius: 0.2, jumpMultiplier: 1.1, maxJump: 6.5, velocityLimit: 0.4, history: 5, maxArm: 1.5 };

const _c = new THREE.Vector3(), _d = new THREE.Vector3(), _ab = new THREE.Vector3();

// Surfaces: { type: 'box', box } | { type: 'capsule', a, b, radius }. The
// ground (y = floor) is always solid.
export function boxSurface(box) { return { type: 'box', box }; }
export function capsuleSurface(a, b, radius) { return { type: 'capsule', a: a.clone(), b: b.clone(), radius }; }

// Point pushed out of one surface inflated by r. Returns the exit point (or
// null when outside) and writes the outward normal.
export function pushOut(surface, point, r, normal = new THREE.Vector3()) {
  if (surface.type === 'capsule') {
    _ab.subVectors(surface.b, surface.a);
    const len2 = _ab.lengthSq(), t = len2 > 1e-9 ? THREE.MathUtils.clamp(_d.subVectors(point, surface.a).dot(_ab) / len2, 0, 1) : 0;
    _c.copy(surface.a).addScaledVector(_ab, t);
    const reach = surface.radius + r, distance = point.distanceTo(_c);
    if (distance >= reach) return null;
    if (distance > 1e-6) normal.subVectors(point, _c).divideScalar(distance); else normal.set(0, 1, 0);
    return _c.clone().addScaledVector(normal, reach);
  }
  const { min, max } = surface.box;
  if (point.x <= min.x - r || point.x >= max.x + r || point.y <= min.y - r || point.y >= max.y + r || point.z <= min.z - r || point.z >= max.z + r) return null;
  // Rounded-box test: outside the box, distance to the closest point.
  _c.copy(point).clamp(min, max);
  const distance = point.distanceTo(_c);
  if (distance > 1e-6) {
    if (distance >= r) return null;
    normal.subVectors(point, _c).divideScalar(distance);
    return _c.clone().addScaledVector(normal, r);
  }
  // Inside: leave through the nearest face.
  let best = Infinity, out = null;
  for (const axis of ['x', 'y', 'z']) for (const sign of [-1, 1]) {
    const face = sign < 0 ? min[axis] - r : max[axis] + r, depth = Math.abs(face - point[axis]);
    if (depth < best) { best = depth; out = [axis, sign, face]; }
  }
  normal.set(0, 0, 0); normal[out[0]] = out[1];
  const exit = point.clone(); exit[out[0]] = out[2]; return exit;
}

export class GorillaMotion {
  constructor(ctx, surfaces, allowed = () => true, options = {}) {
    this.ctx = ctx; this.surfaces = surfaces; this.allowed = allowed; this.o = { ...GORILLA, ...options };
    this.floor = options.floor ?? 0; this.crouch = options.crouch ?? 0;
    this.velocity = new THREE.Vector3(); this.history = []; this.hands = new Map();
    this.touching = false; this.lastRig = new THREE.Vector3(); this.hasLast = false; this.normal = new THREE.Vector3();
    this.jumps = 0; this.contacts = 0;
  }
  reset() { this.velocity.set(0, 0, 0); this.history.length = 0; this.hands.clear(); this.touching = false; this.hasLast = false; }
  // First contact of a hand point with any surface (ground included).
  collide(point, r) {
    if (point.y < this.floor + r) { this.normal.set(0, 1, 0); return new THREE.Vector3(point.x, this.floor + r, point.z); }
    for (const s of this.surfaces) { const exit = pushOut(s, point, r, this.normal); if (exit) return exit; }
    return null;
  }
  // Sweeps from the last hand position to the target in short steps so a fast
  // push cannot pass through a branch.
  sweep(from, to, r) {
    const steps = Math.max(1, Math.ceil(from.distanceTo(to) / (r * 0.7)));
    for (let i = 1; i <= steps; i++) {
      const p = from.clone().lerp(to, i / steps), exit = this.collide(p, r);
      if (exit) return exit;
    }
    return null;
  }
  update(dt, enabled = true) {
    const { ctx, o } = this, rig = ctx.rig;
    dt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05)); if (!dt) return;
    const pointers = (ctx.pointers?.() || []).filter(p => (p.source === 'hand' || p.source === 'xr') && !p.stale);
    if (!this.hasLast) { this.lastRig.copy(rig.position); this.hasLast = true; }
    // 1. Ballistic flight while no hand holds a surface.
    if (!enabled) { this.reset(); return; }
    if (!pointers.length) { this.velocity.x = 0; this.velocity.z = 0; } // tracking loss never launches the player
    if (!this.touching) this.velocity.y -= o.gravity * dt;
    const flight = this.velocity.clone().multiplyScalar(dt);
    // 2. Hands: a hand that meets a surface stays put; the body moves instead.
    const movement = new THREE.Vector3(); let colliding = 0;
    const eye = ctx.eye(), seen = new Set();
    for (const p of pointers) {
      seen.add(p.id);
      const palm = (p.hand?.palm || p.handPos).clone().add(flight);
      // Arms have a length: the hand cannot be further than maxArm from the head.
      if (palm.distanceTo(eye) > o.maxArm) palm.sub(eye).setLength(o.maxArm).add(eye);
      let state = this.hands.get(p.id);
      if (!state) { state = { last: palm.clone(), touching: false, normal: new THREE.Vector3() }; this.hands.set(p.id, state); }
      // A small downward bias makes a resting hand register the ground.
      const target = palm.clone(); target.y -= 2 * o.gravity * dt * dt;
      // Holding: stay in contact while the hand still presses into the
      // surface. Free: sweep from the last position so fast pushes register.
      const hit = state.touching ? this.collide(target, o.handRadius) : this.sweep(state.last, target, o.handRadius);
      if (hit) {
        // The hand sticks where it touched (no sliding); only its motion
        // after contact moves the body, never the tracking penetration.
        const anchor = state.touching ? state.last : palm;
        movement.add(anchor.clone().sub(palm)); colliding++;
        if (!state.touching) { this.contacts++; ctx.audio?.thud?.(); }
        state.touching = true; state.last.copy(anchor); state.normal.copy(this.normal);
      } else { state.touching = false; state.last.copy(palm); }
    }
    for (const id of this.hands.keys()) if (!seen.has(id)) this.hands.delete(id);
    if (colliding) movement.divideScalar(colliding).clampLength(0, 0.5);
    const delta = flight.clone().add(movement);
    // 3. Move the body: horizontal through the map limits, vertical with landing.
    const before = rig.position.clone();
    const step = walkStep(eye.x, eye.z, delta.x, delta.z, this.allowed);
    rig.position.x += step.x - eye.x; rig.position.z += step.z - eye.z;
    rig.position.y = Math.min(30, rig.position.y + delta.y);
    // Head collider: the head cannot enter trunks, branches or platforms.
    const head = ctx.eye();
    for (const s of this.surfaces) {
      const exit = pushOut(s, head, o.headRadius, this.normal);
      if (exit) { rig.position.add(exit.sub(head)); if (this.normal.y < -0.5 && this.velocity.y > 0) this.velocity.y = 0; }
    }
    // Feet: stand on the ground or on a platform directly below the head.
    // The gorilla body is short: the rig sits `crouch` below the surface, so
    // the hands reach the ground without kneeling.
    let floor = this.floor - this.crouch; const feet = ctx.eye();
    for (const s of this.surfaces) if (s.type === 'box' && s.box.max.y - this.crouch <= before.y + 0.1 && feet.x >= s.box.min.x && feet.x <= s.box.max.x && feet.z >= s.box.min.z && feet.z <= s.box.max.z) floor = Math.max(floor, s.box.max.y - this.crouch);
    let grounded = false;
    if (rig.position.y <= floor) { rig.position.y = floor; if (this.velocity.y < 0) this.velocity.y = 0; grounded = true; }
    // 4. Velocity history; on contact the averaged velocity becomes the jump.
    const v = rig.position.clone().sub(this.lastRig).divideScalar(dt); this.lastRig.copy(rig.position);
    this.history.push(v); if (this.history.length > o.history) this.history.shift();
    const average = this.history.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(this.history.length);
    if (colliding) {
      if (average.length() > o.velocityLimit) {
        this.velocity.copy(average).multiplyScalar(o.jumpMultiplier);
        if (this.velocity.length() > o.maxJump) this.velocity.setLength(o.maxJump);
      } else this.velocity.set(0, 0, 0);
    } else if (grounded) {
      // Ground friction when standing without hands down.
      const k = Math.exp(-6 * dt); this.velocity.x *= k; this.velocity.z *= k;
    } else { const k = Math.exp(-0.15 * dt); this.velocity.x *= k; this.velocity.z *= k; }
    if (this.touching && !colliding && this.velocity.length() > 1.5) this.jumps++;
    this.touching = colliding > 0;
    this.grounded = grounded;
  }
}
