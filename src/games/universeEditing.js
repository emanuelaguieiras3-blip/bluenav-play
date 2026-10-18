import { BODY_TYPES, circularVelocity, dominantBody } from './universePhysics.js';

const massLimit = body => [0.01, Math.max(2000, BODY_TYPES[body.type].mass * 4)];
const limits = { radius: [0.05, 3], speed: [0, 20] };
const clamp = (value, [min, max]) => Math.max(min, Math.min(max, value));
export const EDIT_ACTIONS = ['mass-up', 'mass-down', 'size-up', 'size-down', 'speed-up', 'speed-down', 'stop', 'orbit'];

// The host applies these discrete edits; guests only send an action and body id.
export function editCelestialBody(bodies, id, action) {
  const body = bodies.find(item => item.id === id);
  if (!body || !BODY_TYPES[body.type]) return false;
  if (action === 'mass-up' || action === 'mass-down') {
    body.mass = clamp(body.mass * (action === 'mass-up' ? 1.25 : 0.8), massLimit(body));
  } else if (action === 'size-up' || action === 'size-down') {
    body.radius = clamp(body.radius * (action === 'size-up' ? 1.2 : 1 / 1.2), limits.radius);
  } else if (action === 'speed-up' || action === 'speed-down') {
    const factor = action === 'speed-up' ? 1.25 : 0.8;
    body.velocity = Object.fromEntries(Object.entries(body.velocity).map(([axis, value]) => [axis, clamp(value * factor, [-20, 20])]));
  } else if (action === 'stop') {
    body.velocity = { x: 0, y: 0, z: 0 };
  } else if (action === 'orbit') {
    const central = dominantBody(bodies, body.position, body.mass, id);
    if (!central || distanceSquared(central.position, body.position) < (central.radius * 1.5) ** 2) return false;
    body.velocity = circularVelocity(central, body.position);
  } else return false;
  return true;
}

// Continuous values from the inspector sliders.
export function setCelestialValue(bodies, id, key, value) {
  const body = bodies.find(item => item.id === id);
  if (!body || !BODY_TYPES[body.type] || !Number.isFinite(value)) return false;
  if (key === 'mass') body.mass = clamp(value, massLimit(body));
  else if (key === 'radius') body.radius = clamp(value, limits.radius);
  else if (key === 'speed') {
    const speed = Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z), target = clamp(value, limits.speed);
    if (speed < 1e-6) {
      const central = dominantBody(bodies, body.position, body.mass, id);
      const tangent = central ? circularVelocity(central, body.position) : { x: 1, y: 0, z: 0 };
      const size = Math.hypot(tangent.x, tangent.y, tangent.z) || 1;
      body.velocity = { x: tangent.x / size * target, y: tangent.y / size * target, z: tangent.z / size * target };
    } else body.velocity = { x: body.velocity.x / speed * target, y: body.velocity.y / speed * target, z: body.velocity.z / speed * target };
  } else return false;
  return true;
}

export function valueRange(body, key) {
  if (key === 'mass') return massLimit(body);
  return limits[key] || null;
}

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}
