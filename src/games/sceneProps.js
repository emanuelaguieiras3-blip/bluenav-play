// Physics in every game: themed loose props that fall, roll, tumble, break,
// get knocked by the hands and are picked up with a near pinch. They collide
// with the game's own furniture, read from the scene as boxes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { std, Particles } from './common.js';
import { RigidWorld, grabbable, trackHands } from './rigidWorld.js';

const lathe = (profile, segments = 18) => new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments);
// Barrel: bulging staves, a real lathe profile instead of a box.
export const barrelGeometry = (r, h) => lathe([[0, -h / 2], [r * 0.86, -h / 2], [r * 0.93, -h / 4], [r, 0], [r * 0.93, h / 4], [r * 0.86, h / 2], [0, h / 2]]);
export const potGeometry = (r, h) => lathe([[0, -h / 2], [r * 0.55, -h / 2], [r * 0.95, -h / 6], [r, 0], [r * 0.7, h / 3], [r * 0.42, h * 0.42], [r * 0.5, h / 2], [r * 0.44, h / 2]]);
export function rockGeometry(r, seed = 0) {
  const g = new THREE.DodecahedronGeometry(r, 1), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.82 + 0.22 * Math.abs(Math.sin(v.x * 37 + v.y * 23 + v.z * 11 + seed)); p.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k); }
  g.computeVertexNormals(); return g;
}

export const PROP_KINDS = {
  ball: { size: 0.22, mass: 0.4, bounce: 0.72, shape: 'sphere', color: '#e8673c', geometry: s => new THREE.SphereGeometry(s[0] / 2, 20, 14) },
  coconut: { size: 0.17, mass: 0.9, bounce: 0.3, shape: 'sphere', texture: 'bark', color: '#8a5a33', geometry: s => new THREE.SphereGeometry(s[0] / 2, 16, 12).scale(1, 0.92, 1) },
  orange: { size: 0.09, mass: 0.2, bounce: 0.35, shape: 'sphere', color: '#f39a1e', geometry: s => new THREE.SphereGeometry(s[0] / 2, 14, 10) },
  apple: { size: 0.085, mass: 0.18, bounce: 0.3, shape: 'sphere', color: '#c8232c', geometry: s => new THREE.SphereGeometry(s[0] / 2, 14, 10).scale(1, 0.9, 1) },
  rock: { size: 0.26, mass: 3, bounce: 0.08, shape: 'sphere', texture: 'roughStone', color: '#9a958c', geometry: (s, i) => rockGeometry(s[0] / 2, i) },
  barrel: { size: [0.42, 0.6, 0.42], mass: 6, bounce: 0.1, texture: 'woodMedium', color: '#c9915a', geometry: s => barrelGeometry(s[0] / 2, s[1]) },
  pot: { size: [0.3, 0.36, 0.3], mass: 1.4, bounce: 0.05, color: '#b8643c', breakSpeed: 4.2, geometry: s => potGeometry(s[0] / 2, s[1]) },
  can: { size: [0.08, 0.14, 0.08], mass: 0.15, bounce: 0.3, texture: 'brushedMetal', color: '#d8dde2', metal: true, geometry: s => new THREE.CylinderGeometry(s[0] / 2, s[0] / 2, s[1], 18) },
  crate: { size: [0.36, 0.36, 0.36], mass: 2.2, bounce: 0.08, texture: 'woodLight', geometry: s => new RoundedBoxGeometry(...s, 3, 0.03) },
  log: { size: [0.75, 0.18, 0.18], mass: 3.5, bounce: 0.05, texture: 'bark', color: '#9b7a58', geometry: s => new THREE.CylinderGeometry(s[1] / 2, s[1] / 2 * 1.08, s[0], 14).rotateZ(Math.PI / 2) },
  die: { size: [0.08, 0.08, 0.08], mass: 0.05, bounce: 0.35, color: '#f4f1ea', geometry: s => new RoundedBoxGeometry(...s, 3, 0.014) },
};

// Which props each game gets. Games with their own physics engine, or whose
// player is not on the ground (climbing, flying, diving, driving), are absent.
export const SCENE_PROPS = {
  tactical: ['barrel', 'barrel', 'can', 'can', 'can', 'can', 'crate', 'crate'],
  jungle: ['coconut', 'coconut', 'coconut', 'rock', 'rock', 'log', 'ball'],
  arena: ['barrel', 'barrel', 'pot', 'pot', 'pot', 'crate'],
  archery: ['can', 'can', 'can', 'can', 'can', 'crate', 'ball'],
  dungeon: ['pot', 'pot', 'pot', 'pot', 'barrel', 'crate'],
  night: ['log', 'log', 'can', 'can', 'rock', 'rock'],
  cook: ['orange', 'orange', 'apple', 'apple', 'can'],
  tablegames: ['die', 'die', 'ball'],
  puzzle: ['ball', 'ball', 'crate'],
  shiftworld: ['rock', 'rock', 'log', 'ball', 'crate'],
};

const _box = new THREE.Box3(), _size = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3();

// Solid scene meshes near the player become collision boxes. Planes, sky,
// particles, decoration and instanced foliage are skipped.
export function sceneColliders(root, center, { radius = 9, limit = 70 } = {}) {
  const found = [];
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible || o.userData.noCollide || o.userData.propBody) return;
    for (let a = o; a; a = a.parent) if (a.userData?.decorative || a.userData?.ui || a.name === 'scene-props' || a.visible === false) return;
    const g = o.geometry; if (!g || ['PlaneGeometry', 'ShapeGeometry', 'RingGeometry', 'CircleGeometry'].includes(g.type)) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    if (materials.some(m => !m || m.transparent || m.wireframe || m.side === THREE.BackSide)) return;
    _box.setFromObject(o); if (_box.isEmpty()) return;
    _box.getSize(_size);
    if (_size.x * _size.y * _size.z > 80 || Math.min(_size.x, _size.y, _size.z) < 0.01) return;
    const distance = _box.distanceToPoint(center); if (distance > radius) return;
    found.push({ mesh: o, box: _box.clone(), distance });
  });
  return found.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

export function createSceneProps(ctx, id, { kinds = SCENE_PROPS[id] } = {}) {
  if (!kinds?.length) return null;
  const { root, tex } = ctx;
  const group = new THREE.Group(); group.name = 'scene-props';
  const eye = ctx.eye(), forward = ctx.forward().setY(0); if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1); forward.normalize();
  const spawn = new THREE.Vector3(eye.x, 0, eye.z);
  const colliders = sceneColliders(root, spawn);
  root.add(group);
  const world = new RigidWorld({ floor: 0, limit: 16 });
  for (const c of colliders) world.statics.push(c.box);
  const materials = new Map();
  const material = kind => {
    if (materials.has(kind)) return materials.get(kind);
    const k = PROP_KINDS[kind];
    const m = std({ color: k.color || '#ffffff', ...(k.texture ? { map: tex.get(k.texture) } : {}), roughness: k.metal ? 0.3 : 0.75, metalness: k.metal ? 0.8 : 0 });
    materials.set(kind, m); return m;
  };
  const free = (at, half) => {
    // Margin around the sides only: the floor itself may be a box under the prop.
    _box.min.copy(at).sub(half).addScalar(-0.06); _box.max.copy(at).add(half).addScalar(0.06); _box.min.y = at.y - half.y + 0.01;
    return !world.statics.some(s => s.intersectsBox(_box)) && !world.bodies.some(b => world.bounds(b).intersectsBox(_box));
  };
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const bodies = [];
  kinds.forEach((kind, i) => {
    const k = PROP_KINDS[kind]; if (!k) return;
    const size = Array.isArray(k.size) ? k.size : [k.size, k.size, k.size], half = new THREE.Vector3(...size).multiplyScalar(0.5);
    // Props sit beside the player (both sides, a bit ahead), never in the
    // middle of the play lane.
    let at = null;
    for (let attempt = 0; attempt < 40 && !at; attempt++) {
      const side = (i + attempt) % 2 ? 1 : -1, ring = 1.25 + ((i * 7 + attempt * 3) % 9) * 0.17, ahead = -0.4 + ((i * 5 + attempt) % 7) * 0.22;
      _p.copy(spawn).addScaledVector(right, side * ring).addScaledVector(forward, ahead); _p.y = half.y + 0.005;
      if (free(_p, half)) at = _p.clone();
    }
    if (!at) return;
    const mesh = new THREE.Mesh(k.geometry(size, i), material(kind));
    mesh.position.copy(at); mesh.rotation.y = i * 1.7; mesh.userData.propBody = true; group.add(mesh);
    const body = world.add(mesh, { size, mass: k.mass, bounce: k.bounce, rotates: true, shape: k.shape || 'box', breakSpeed: k.breakSpeed ?? Infinity });
    if (!body) return;
    body.kind = kind; body.originQuaternion.copy(mesh.quaternion);
    grabbable(ctx, world, body, { register: false });
    bodies.push(body);
  });
  const particles = new Particles(group, { max: 90, size: 0.04 });
  const broken = [];
  let lastThud = 0, breaks = 0, knocks = 0;
  world.onImpact = (body, speed) => {
    if (speed >= body.breakSpeed && body.enabled) {
      body.enabled = false; body.mesh.visible = false; body.holders.clear(); body.held = null; breaks++;
      for (let i = 0; i < 26; i++) particles.spawn(body.mesh.position, new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 2, (Math.random() - 0.5) * 2.4), { life: 0.8, color: [0.72, 0.4, 0.24, 1], gravity: 9.81, drag: 0.8 });
      ctx.audio.noise?.({ dur: 0.1, freq: 1400, vol: 0.1 });
      broken.push({ body, at: 6 });
      return;
    }
    const now = performance.now();
    if (speed > 1.6 && now - lastThud > 80) { lastThud = now; knocks++; if (PROP_KINDS[body.kind]?.metal) ctx.audio.metal?.(); else ctx.audio.thud?.(); }
  };
  const handsUpdate = trackHands(ctx, world, 0.06);
  const holding = new Map();
  let refresh = 0;
  const near = (p, body) => {
    const bounds = world.bounds(body), hand = p.hand?.palm || p.handPos;
    return bounds.distanceToPoint(hand) < 0.09 || bounds.distanceToPoint(p.handPos) < 0.06;
  };
  return {
    world, group, bodies, colliders: colliders.length,
    getState: () => ({ bodies: bodies.length, held: holding.size, breaks, knocks, statics: world.statics.length }),
    // Projectiles (bullets, arrows) push props along their path.
    impact(from, to, velocity, strength = 0.08) {
      const length = from.distanceTo(to); if (!(length > 1e-6)) return null;
      const ray = new THREE.Ray(from.clone(), _d.copy(to).sub(from).normalize());
      let hit = null, best = Infinity;
      for (const b of bodies) {
        if (!b.enabled || !b.mesh.visible) continue;
        const point = ray.intersectBox(world.bounds(b), new THREE.Vector3());
        if (point && point.distanceTo(from) <= length && point.distanceTo(from) < best) { best = point.distanceTo(from); hit = { body: b, point }; }
      }
      if (!hit) return null;
      const b = hit.body;
      b.velocity.addScaledVector(velocity, strength / b.mass).clampLength(0, 8);
      b.angular.add(hit.point.clone().sub(b.mesh.position).cross(velocity).multiplyScalar(strength * 4 / b.mass)).clampLength(0, 25);
      if (b.breakSpeed < Infinity && velocity.length() > 15) world.onImpact?.(b, b.breakSpeed);
      return hit;
    },
    update(dt) {
      if (!(dt > 0)) return;
      const pointers = ctx.input?.pointers || [];
      // Near pinch grabs a prop; the grabbing hand is busy for the game.
      for (const p of pointers) {
        if (p.system || (p.source !== 'hand' && p.source !== 'xr')) continue;
        const held = holding.get(p.id);
        if (held) {
          if (p.pinch && !p.stale) { held.grab.move(p); p.uiBusy = true; }
          else if (!p.pinch) { held.grab.end(p); holding.delete(p.id); }
          continue;
        }
        if (!p.pinchDown || p.uiBusy || p.stale) continue;
        const target = bodies.filter(b => b.enabled && b.mesh.visible && near(p, b)).sort((a, b) => a.mesh.position.distanceTo(p.handPos) - b.mesh.position.distanceTo(p.handPos))[0];
        if (target) { target.grab.start(p, { distance: 0.1 }); holding.set(p.id, target); p.uiBusy = true; ctx.audio.click?.(); }
      }
      for (const [id, body] of holding) if (!pointers.some(p => p.id === id)) { body.grab.end(null); holding.delete(id); }
      // Moving enemies and doors: refresh collider boxes a few times a second.
      if ((refresh -= dt) <= 0) { refresh = 0.25; for (const c of colliders) if (c.mesh.visible && c.mesh.parent) c.box.setFromObject(c.mesh); else c.box.makeEmpty(); }
      handsUpdate(dt);
      world.update(dt);
      particles.update(dt);
      for (let i = broken.length - 1; i >= 0; i--) {
        const entry = broken[i]; entry.at -= dt;
        if (entry.at > 0) continue;
        const b = entry.body; broken.splice(i, 1);
        b.mesh.position.copy(b.origin); b.mesh.quaternion.copy(b.originQuaternion); b.velocity.set(0, 0, 0); b.angular.set(0, 0, 0); b.enabled = true; b.mesh.visible = true;
      }
    },
    dispose() { for (const body of holding.values()) body.grab.end(null); holding.clear(); world.setHands([]); },
  };
}
