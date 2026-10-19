import { kindOf } from './universePhysics.js';

// Free flight for the open Universe map. Plain {x,y,z} math so it runs in node tests.
export const FLIGHT = Object.freeze({ minSpeed: 0.8, maxSpeed: 12, boost: 2.5, accelTime: 0.45, stopTime: 0.1,
  bound: 90, edge: 12, margin: 0.35 });
const DEG = Math.PI / 180;

export function nearestSurface(eye, bodies) {
  let gap = Infinity;
  for (const body of bodies) {
    const d = Math.hypot(body.position.x - eye.x, body.position.y - eye.y, body.position.z - eye.z) - body.radius;
    if (d < gap) gap = d;
  }
  return gap;
}

export function cruiseSpeed(eye, bodies) {
  const gap = nearestSurface(eye, bodies);
  if (!Number.isFinite(gap)) return FLIGHT.maxSpeed;
  return Math.max(FLIGHT.minSpeed, Math.min(FLIGHT.maxSpeed, FLIGHT.minSpeed + Math.max(0, gap) * 0.55));
}

const shell = body => (kindOf(body) === 'blackhole' ? body.radius * 2.2 : body.radius) + FLIGHT.margin;

// Keeps the eye outside every body; a black hole's horizon pushes out further.
export function pushOutOfBodies(pos, bodies) {
  let hit = null;
  for (const body of bodies) {
    const dx = pos.x - body.position.x, dy = pos.y - body.position.y, dz = pos.z - body.position.z;
    const distance = Math.hypot(dx, dy, dz), limit = shell(body);
    if (distance >= limit) continue;
    const k = distance > 1e-6 ? limit / distance : 0;
    pos.x = body.position.x + (k ? dx * k : 0); pos.y = body.position.y + (k ? dy * k : limit); pos.z = body.position.z + (k ? dz * k : 0);
    hit = body;
  }
  return hit;
}

export function createFlight() { return { velocity: { x: 0, y: 0, z: 0 }, warning: false, hit: null }; }

// direction: unit vector of the wanted motion; throttle 0..1. Returns the eye displacement for this frame.
export function stepFlight(flight, { eye, direction, throttle = 0, bodies = [], dt, boost = 1 }) {
  const v = flight.velocity, target = throttle > 0 ? cruiseSpeed(eye, bodies) * Math.min(1, throttle) * boost : 0;
  const k = 1 - Math.exp(-dt / (target > 0 ? FLIGHT.accelTime : FLIGHT.stopTime));
  v.x += ((direction?.x || 0) * target - v.x) * k;
  v.y += ((direction?.y || 0) * target - v.y) * k;
  v.z += ((direction?.z || 0) * target - v.z) * k;
  if (Math.hypot(v.x, v.y, v.z) < 0.05 && !target) v.x = v.y = v.z = 0;
  const next = { x: eye.x + v.x * dt, y: eye.y + v.y * dt, z: eye.z + v.z * dt };
  const r = Math.hypot(next.x, next.y, next.z), edgeStart = FLIGHT.bound - FLIGHT.edge;
  flight.warning = r > edgeStart;
  if (flight.warning) {
    const n = { x: next.x / r, y: next.y / r, z: next.z / r }, outward = v.x * n.x + v.y * n.y + v.z * n.z;
    if (outward > 0) {
      const keep = Math.max(0, Math.min(1, (FLIGHT.bound - r) / FLIGHT.edge)), cut = outward * (1 - keep);
      v.x -= n.x * cut; v.y -= n.y * cut; v.z -= n.z * cut;
    }
    if (r > FLIGHT.bound) { v.x -= n.x * (r - FLIGHT.bound); v.y -= n.y * (r - FLIGHT.bound); v.z -= n.z * (r - FLIGHT.bound); }
  }
  const pos = { x: eye.x + v.x * dt, y: eye.y + v.y * dt, z: eye.z + v.z * dt };
  flight.hit = pushOutOfBodies(pos, bodies);
  if (flight.hit) {
    // Slide along the surface: drop the velocity component that points into the body.
    const b = flight.hit.position, nx = pos.x - b.x, ny = pos.y - b.y, nz = pos.z - b.z, nl = Math.hypot(nx, ny, nz) || 1;
    const into = (v.x * nx + v.y * ny + v.z * nz) / nl;
    if (into < 0) { v.x -= nx / nl * into; v.y -= ny / nl * into; v.z -= nz / nl * into; }
  }
  return { x: pos.x - eye.x, y: pos.y - eye.y, z: pos.z - eye.z };
}

export function speedOf(flight) { return Math.hypot(flight.velocity.x, flight.velocity.y, flight.velocity.z); }

// Seated players turn by holding the head to one side; looking back to the centre stops the turn.
export class AssistTurn {
  constructor({ enter = 35, exit = 15, delay = 0.4, rate = 60 } = {}) {
    this.enter = enter * DEG; this.exit = exit * DEG; this.delay = delay; this.rate = rate * DEG;
    this.enabled = true; this.reset();
  }
  reset() { this.held = 0; this.turning = 0; }
  update(dt, headYaw) {
    if (!this.enabled || !Number.isFinite(headYaw)) { this.reset(); return 0; }
    const size = Math.abs(headYaw), side = Math.sign(headYaw);
    if (this.turning) {
      if (size < this.exit || side !== this.turning) { this.reset(); return 0; }
      return this.turning * this.rate * dt;
    }
    if (size <= this.enter) { this.held = 0; return 0; }
    this.held += dt;
    if (this.held < this.delay) return 0;
    this.turning = side;
    return side * this.rate * dt;
  }
}

// Rotating the rig by `angle` around the eye: returns where the rig origin must go so the eye stays put.
export function rotateAbout(px, pz, ex, ez, angle) {
  const dx = px - ex, dz = pz - ez, c = Math.cos(angle), s = Math.sin(angle);
  return { x: ex + dx * c + dz * s, z: ez - dx * s + dz * c };
}

// Dot between the palm normal and the direction to the eye (1 = palm looking straight at the face).
export function palmFacing(points, side, eye) {
  if (!points || points.length < 18) return -1;
  const w = points[0], i = points[5], p = points[17];
  const a = { x: i.x - w.x, y: i.y - w.y, z: i.z - w.z }, b = { x: p.x - w.x, y: p.y - w.y, z: p.z - w.z };
  let n = { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
  if (side === 'left') n = { x: -n.x, y: -n.y, z: -n.z };
  const e = { x: eye.x - w.x, y: eye.y - w.y, z: eye.z - w.z };
  const nl = Math.hypot(n.x, n.y, n.z), el = Math.hypot(e.x, e.y, e.z);
  if (nl < 1e-9 || el < 1e-9) return -1;
  return (n.x * e.x + n.y * e.y + n.z * e.z) / (nl * el);
}

export class PalmMenu {
  constructor({ open = 0.6, close = 0.25, hold = 0.25 } = {}) { this.openAt = open; this.closeAt = close; this.hold = hold; this.facing = false; this.time = 0; }
  update(dt, value) {
    const want = this.facing ? value > this.closeAt : value > this.openAt;
    this.time = want === this.facing ? 0 : this.time + dt;
    if (this.time >= this.hold) { this.facing = want; this.time = 0; }
    return this.facing;
  }
}
