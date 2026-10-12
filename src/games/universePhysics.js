// Scaled Newtonian sandbox. Units are intentionally small enough to make
// orbits and impacts observable in a room-sized VR scene.
export const GRAVITY = 0.045;
const SOFTENING = 0.3;
export const BODY_TYPES = Object.freeze({
  star: { mass: 260, radius: 0.78 },
  planet: { mass: 9, radius: 0.4 },
  moon: { mass: 0.12, radius: 0.17 },
  blackhole: { mass: 720, radius: 0.46 },
  meteor: { mass: 0.065, radius: 0.1 },
});

const len = v => Math.hypot(v.x, v.y, v.z);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (v, k) => ({ x: v.x * k, y: v.y * k, z: v.z * k });

export function makeBody(type, id, position, velocity = { x: 0, y: 0, z: 0 }) {
  const spec = BODY_TYPES[type];
  if (!spec) throw new Error(`Corpo desconhecido: ${type}`);
  return { id, type, mass: spec.mass, radius: spec.radius, position: { ...position }, velocity: { ...velocity } };
}

export function circularVelocity(central, position) {
  const offset = sub(position, central.position), r = Math.hypot(offset.x, offset.z);
  if (r < central.radius * 1.5) return { ...central.velocity };
  const speed = Math.sqrt(GRAVITY * central.mass * r * r / (r * r + SOFTENING * SOFTENING) ** 1.5);
  return { x: central.velocity.x - offset.z / r * speed,
    y: central.velocity.y, z: central.velocity.z + offset.x / r * speed };
}

export function tidalRadius(hole, star) {
  return Math.max(hole.radius + star.radius, star.radius * Math.cbrt(2 * hole.mass / Math.max(star.mass, 0.1)) * 2.5);
}

function merge(target, source) {
  const mass = target.mass + source.mass;
  target.velocity = mul(add(mul(target.velocity, target.mass), mul(source.velocity, source.mass)), 1 / mass);
  target.position = mul(add(mul(target.position, target.mass), mul(source.position, source.mass)), 1 / mass);
  target.radius = Math.cbrt(target.radius ** 3 + source.radius ** 3);
  target.mass = mass;
}

function oneStep(state, dt, events) {
  const bodies = state.bodies;
  const acceleration = new Map(bodies.map(body => [body.id, { x: 0, y: 0, z: 0 }]));
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j], d = sub(b.position, a.position);
    const softened = d.x * d.x + d.y * d.y + d.z * d.z + SOFTENING ** 2;
    const factor = GRAVITY / (softened * Math.sqrt(softened));
    const aa = acceleration.get(a.id), ab = acceleration.get(b.id);
    aa.x += d.x * factor * b.mass; aa.y += d.y * factor * b.mass; aa.z += d.z * factor * b.mass;
    ab.x -= d.x * factor * a.mass; ab.y -= d.y * factor * a.mass; ab.z -= d.z * factor * a.mass;
  }
  for (const body of bodies) {
    const a = acceleration.get(body.id), magnitude = len(a);
    if (magnitude > 24) Object.assign(a, mul(a, 24 / magnitude));
    body.velocity = add(body.velocity, mul(a, dt));
    body.position = add(body.position, mul(body.velocity, dt));
  }
  const removed = new Set();
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j]; if (removed.has(a.id) || removed.has(b.id)) continue;
    const d = sub(b.position, a.position), distance = len(d);
    const hole = a.type === 'blackhole' ? a : b.type === 'blackhole' ? b : null;
    const star = a.type === 'star' ? a : b.type === 'star' ? b : null;
    if (hole && star && distance < tidalRadius(hole, star) && distance > hole.radius + star.radius * 0.4) {
      const proximity = 1 - distance / tidalRadius(hole, star);
      const transfer = Math.min(star.mass - 0.05, (0.7 + proximity * 8) * dt);
      if (transfer > 0) {
        hole.velocity = mul(add(mul(hole.velocity, hole.mass), mul(star.velocity, transfer)), 1 / (hole.mass + transfer));
        hole.mass += transfer; star.mass -= transfer;
        star.radius = BODY_TYPES.star.radius * Math.cbrt(star.mass / BODY_TYPES.star.mass);
        events.push({ type: 'tidal', holeId: hole.id, starId: star.id, transfer });
      }
    }
    if (distance >= a.radius + b.radius) continue;
    if (hole) {
      const source = hole === a ? b : a; merge(hole, source); removed.add(source.id);
      events.push({ type: 'consume', targetId: hole.id, sourceId: source.id });
      continue;
    }
    const meteor = a.type === 'meteor' ? a : b.type === 'meteor' ? b : null;
    const target = meteor === a ? b : a;
    if (meteor) {
      const speed = len(sub(meteor.velocity, target.velocity));
      const direction = mul(sub(meteor.position, target.position), 1 / Math.max(distance, 1e-6));
      const point = add(target.position, mul(direction, target.radius));
      merge(target, meteor); removed.add(meteor.id);
      events.push({ type: 'impact', targetId: target.id, sourceId: meteor.id, point, direction, speed });
      continue;
    }
    const larger = a.mass >= b.mass ? a : b, smaller = larger === a ? b : a;
    merge(larger, smaller); removed.add(smaller.id);
    events.push({ type: 'merge', targetId: larger.id, sourceId: smaller.id });
  }
  if (removed.size) state.bodies = bodies.filter(body => !removed.has(body.id));
}

export function stepUniverse(state, dt) {
  const events = [];
  dt = Math.max(0, Math.min(0.1, dt));
  const steps = Math.max(1, Math.ceil(dt / 0.02));
  for (let i = 0; i < steps; i++) oneStep(state, dt / steps, events);
  state.time = (state.time || 0) + dt;
  return events;
}
