import { BODY_TYPES, circularVelocity } from './universePhysics.js';

const limits = { mass: [0.02, 2000], radius: [0.05, 2.5] };
const clamp = (value, [min, max]) => Math.max(min, Math.min(max, value));

// The host applies these discrete edits; guests only send an action and body id.
export function editCelestialBody(bodies, id, action) {
  const body = bodies.find(item => item.id === id);
  if (!body || !BODY_TYPES[body.type]) return false;
  if (action === 'mass-up' || action === 'mass-down') {
    body.mass = clamp(body.mass * (action === 'mass-up' ? 1.25 : 0.8), limits.mass);
  } else if (action === 'size-up' || action === 'size-down') {
    body.radius = clamp(body.radius * (action === 'size-up' ? 1.2 : 1 / 1.2), limits.radius);
  } else if (action === 'speed-up' || action === 'speed-down') {
    const factor = action === 'speed-up' ? 1.25 : 0.8;
    body.velocity = Object.fromEntries(Object.entries(body.velocity).map(([axis, value]) => [axis, clamp(value * factor, [-20, 20])]));
  } else if (action === 'stop') {
    body.velocity = { x: 0, y: 0, z: 0 };
  } else if (action === 'orbit') {
    const centralType = body.type === 'moon' ? 'planet' : body.type === 'planet' ? 'star' : null;
    const central = bodies.filter(item => item.id !== id && item.type === centralType)
      .sort((a, b) => distanceSquared(a.position, body.position) - distanceSquared(b.position, body.position))[0];
    if (!central || distanceSquared(central.position, body.position) < (central.radius * 1.5) ** 2) return false;
    body.velocity = circularVelocity(central, body.position);
  } else return false;
  return true;
}

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}
