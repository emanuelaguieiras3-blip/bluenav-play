// Scaled Newtonian sandbox. Units are intentionally small enough to make
// orbits and impacts observable in a room-sized VR scene. 9 units ≈ 1 AU.
export const GRAVITY = 0.045;
export const AU = 9;
const SOFTENING = 0.3;
export const BODY_TYPES = Object.freeze({
  reddwarf: { kind: 'star', mass: 80, radius: 0.42, temperature: 3200, label: 'Anã vermelha' },
  star: { kind: 'star', mass: 260, radius: 0.78, temperature: 5800, label: 'Estrela tipo Sol' },
  bluegiant: { kind: 'star', mass: 1100, radius: 1.3, temperature: 22000, label: 'Gigante azul' },
  redgiant: { kind: 'star', mass: 340, radius: 1.8, temperature: 3500, label: 'Gigante vermelha' },
  whitedwarf: { kind: 'star', compact: true, mass: 200, radius: 0.16, temperature: 25000, label: 'Anã branca' },
  neutron: { kind: 'star', compact: true, mass: 320, radius: 0.1, temperature: 600000, label: 'Estrela de nêutrons' },
  rocky: { kind: 'planet', mass: 4, radius: 0.3, label: 'Planeta rochoso' },
  planet: { kind: 'planet', mass: 9, radius: 0.4, greenhouse: 33, label: 'Planeta terrestre' },
  icy: { kind: 'planet', mass: 6, radius: 0.36, label: 'Planeta gelado' },
  gasgiant: { kind: 'planet', mass: 60, radius: 0.75, label: 'Gigante gasoso' },
  ringed: { kind: 'planet', mass: 50, radius: 0.7, label: 'Gigante com anéis' },
  moon: { kind: 'moon', mass: 0.12, radius: 0.17, label: 'Lua' },
  asteroid: { kind: 'small', mass: 0.03, radius: 0.09, label: 'Asteroide' },
  comet: { kind: 'small', mass: 0.02, radius: 0.08, label: 'Cometa' },
  meteor: { kind: 'small', mass: 0.065, radius: 0.1, label: 'Meteoro' },
  blackhole: { kind: 'blackhole', mass: 720, radius: 0.46, label: 'Buraco negro' },
  smbh: { kind: 'blackhole', mass: 4000, radius: 1.1, label: 'Buraco negro supermassivo' },
  whitehole: { kind: 'whitehole', mass: 500, radius: 0.4, label: 'Buraco branco' },
});

const len = v => Math.hypot(v.x, v.y, v.z);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (v, k) => ({ x: v.x * k, y: v.y * k, z: v.z * k });
export const kindOf = body => BODY_TYPES[body?.type]?.kind || null;
const isCompact = body => !!BODY_TYPES[body?.type]?.compact;
const isLiveStar = body => kindOf(body) === 'star' && !isCompact(body);

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

// The body whose gravity dominates at a position: what a new body should orbit.
export function dominantBody(bodies, position, mass = 0, exceptId = null) {
  let best = null, pull = 0;
  for (const body of bodies) {
    if (body.id === exceptId || body.mass < mass * 3 || kindOf(body) === 'whitehole') continue;
    const d = sub(body.position, position), r2 = d.x * d.x + d.y * d.y + d.z * d.z;
    const value = body.mass / Math.max(r2, 1e-6);
    if (value > pull) { pull = value; best = body; }
  }
  return best;
}

export function tidalRadius(hole, star) {
  return Math.max(hole.radius + star.radius, star.radius * Math.cbrt(2 * hole.mass / Math.max(star.mass, 0.1)) * 2.5);
}

export function rocheLimit(primary, satellite) {
  const density = body => body.mass / Math.max(body.radius ** 3, 1e-6);
  return primary.radius * 0.9 * Math.cbrt(density(primary) / Math.max(density(satellite), 1e-6));
}

// Radius that keeps the type's density when mass changes.
function scaledRadius(body) {
  const spec = BODY_TYPES[body.type];
  return spec.radius * Math.cbrt(Math.max(body.mass, 1e-6) / spec.mass);
}

function merge(target, source) {
  const mass = target.mass + source.mass;
  target.velocity = mul(add(mul(target.velocity, target.mass), mul(source.velocity, source.mass)), 1 / mass);
  target.position = mul(add(mul(target.position, target.mass), mul(source.position, source.mass)), 1 / mass);
  target.radius = Math.cbrt(target.radius ** 3 + source.radius ** 3);
  target.mass = mass;
  if (kindOf(target) === 'blackhole') target.radius = Math.min(3, scaledRadius(target));
}

function accelerations(bodies) {
  const acceleration = new Map(bodies.map(body => [body.id, { x: 0, y: 0, z: 0 }]));
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j], d = sub(b.position, a.position);
    const softened = d.x * d.x + d.y * d.y + d.z * d.z + SOFTENING ** 2;
    const factor = GRAVITY / (softened * Math.sqrt(softened));
    const aWhite = kindOf(a) === 'whitehole', bWhite = kindOf(b) === 'whitehole';
    const aa = acceleration.get(a.id), ab = acceleration.get(b.id);
    // A white hole pushes everything away and is never pushed itself.
    if (!aWhite) { const k = factor * b.mass * (bWhite ? -1 : 1); aa.x += d.x * k; aa.y += d.y * k; aa.z += d.z * k; }
    if (!bWhite) { const k = factor * a.mass * (aWhite ? -1 : 1); ab.x -= d.x * k; ab.y -= d.y * k; ab.z -= d.z * k; }
  }
  for (const a of acceleration.values()) {
    const magnitude = len(a);
    if (magnitude > 24) Object.assign(a, mul(a, 24 / magnitude));
  }
  return acceleration;
}

export function lifetimeOf(body) {
  if (!isLiveStar(body)) return null;
  if (body.type === 'redgiant' && body.mass < 800) return 140;
  return body.mass >= 800 ? 75 * (1100 / body.mass) ** 1.5 : null;
}

// Ends a star's life: massive stars explode, small giants shed a nebula.
export function detonate(state, id, events = []) {
  const star = state.bodies.find(body => body.id === id);
  if (!isLiveStar(star)) return false;
  const position = { ...star.position }, energy = star.mass, previous = star.type;
  star.age = 0;
  if (star.mass < 800) {
    star.type = 'whitedwarf'; star.mass = Math.max(40, star.mass * 0.6); star.radius = BODY_TYPES.whitedwarf.radius;
    events.push({ type: 'nebula', id, position, previous });
    return true;
  }
  const remnantType = star.mass >= 1000 ? 'blackhole' : 'neutron';
  star.type = remnantType;
  star.mass = remnantType === 'blackhole' ? star.mass * 0.3 : Math.min(star.mass * 0.25, 340);
  star.radius = remnantType === 'blackhole' ? scaledRadius(star) : BODY_TYPES.neutron.radius;
  const reach = 14, vaporized = new Set();
  for (const body of state.bodies) {
    if (body === star || kindOf(body) === 'whitehole') continue;
    const d = sub(body.position, position), distance = Math.max(len(d), 1e-3);
    if (distance > reach) continue;
    const kind = kindOf(body);
    if (distance < BODY_TYPES[previous].radius * 3 && ['planet', 'moon', 'small'].includes(kind)) { vaporized.add(body.id); continue; }
    const kick = Math.min(6, 40 * energy / 1100 / (distance * distance + 2) / Math.max(1, Math.cbrt(body.mass / 10)));
    body.velocity = add(body.velocity, mul(d, kick / distance));
  }
  if (vaporized.size) state.bodies = state.bodies.filter(body => !vaporized.has(body.id));
  events.push({ type: 'supernova', id, position, previous, remnantType, energy, reach, vaporized: [...vaporized] });
  return true;
}

function collide(state, a, b, distance, removed, events) {
  const ka = kindOf(a), kb = kindOf(b);
  if (ka === 'whitehole' || kb === 'whitehole') {
    const white = ka === 'whitehole' ? a : b, other = white === a ? b : a;
    if (kindOf(other) === 'whitehole') return;
    const normal = mul(sub(other.position, white.position), 1 / Math.max(distance, 1e-6));
    other.position = add(white.position, mul(normal, white.radius + other.radius + 1e-3));
    const inward = normal.x * other.velocity.x + normal.y * other.velocity.y + normal.z * other.velocity.z;
    if (inward < 0) other.velocity = sub(other.velocity, mul(normal, inward * 1.8));
    return;
  }
  const hole = ka === 'blackhole' ? a : kb === 'blackhole' ? b : null;
  if (hole) {
    const source = hole === a ? b : a;
    if (kindOf(source) === 'blackhole' && source.mass > hole.mass) { collide(state, source, hole, distance, removed, events); return; }
    const position = { ...source.position };
    merge(hole, source); removed.add(source.id);
    events.push({ type: 'consume', targetId: hole.id, sourceId: source.id, sourceType: source.type, mass: source.mass, position });
    return;
  }
  const small = kb === 'small' ? b : ka === 'small' ? a : null;
  if (small && kindOf(small === a ? b : a) !== 'small') {
    const target = small === a ? b : a;
    const speed = len(sub(small.velocity, target.velocity));
    const direction = mul(sub(small.position, target.position), 1 / Math.max(distance, 1e-6));
    const point = add(target.position, mul(direction, target.radius));
    merge(target, small); removed.add(small.id);
    events.push({ type: 'impact', targetId: target.id, sourceId: small.id, point, direction, speed });
    return;
  }
  const larger = a.mass >= b.mass ? a : b, smaller = larger === a ? b : a;
  const speed = len(sub(smaller.velocity, larger.velocity));
  const direction = mul(sub(smaller.position, larger.position), 1 / Math.max(distance, 1e-6));
  const point = add(larger.position, mul(direction, larger.radius));
  const kinds = [kindOf(larger), kindOf(smaller)];
  merge(larger, smaller); removed.add(smaller.id);
  if (kinds.every(kind => kind === 'star')) events.push({ type: 'stellar-merge', targetId: larger.id, sourceId: smaller.id, position: { ...larger.position } });
  else if (kinds.every(kind => kind === 'planet' || kind === 'moon')) {
    events.push({ type: 'collision', targetId: larger.id, sourceId: smaller.id, point, direction, speed, mass: smaller.mass });
  } else events.push({ type: 'merge', targetId: larger.id, sourceId: smaller.id });
}

function oneStep(state, dt, events) {
  const bodies = state.bodies;
  // Velocity Verlet keeps orbital energy much steadier than a single Euler kick.
  const before = accelerations(bodies);
  for (const body of bodies) {
    body.position = add(body.position, add(mul(body.velocity, dt), mul(before.get(body.id), dt * dt * 0.5)));
  }
  const after = accelerations(bodies);
  for (const body of bodies) {
    body.velocity = add(body.velocity, mul(add(before.get(body.id), after.get(body.id)), dt * 0.5));
    if (body.accretion) body.accretion = body.accretion > 0.01 ? body.accretion * Math.exp(-dt / 6) : 0;
  }
  const removed = new Set(), tidalStars = new Set(), rocheMoons = new Set();
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j]; if (removed.has(a.id) || removed.has(b.id)) continue;
    const d = sub(b.position, a.position), distance = len(d);
    const hole = kindOf(a) === 'blackhole' ? a : kindOf(b) === 'blackhole' ? b : null;
    const star = isLiveStar(a) ? a : isLiveStar(b) ? b : null;
    if (hole && star && distance < tidalRadius(hole, star) && distance > hole.radius + star.radius * 0.4) {
      const proximity = 1 - distance / tidalRadius(hole, star);
      const transfer = Math.min(star.mass - 0.05, (0.7 + proximity * 8 + star.mass * proximity * 0.12) * dt);
      if (transfer > 0) {
        hole.velocity = mul(add(mul(hole.velocity, hole.mass), mul(star.velocity, transfer)), 1 / (hole.mass + transfer));
        hole.mass += transfer; star.mass -= transfer;
        hole.accretion = (hole.accretion || 0) + transfer;
        star.radius = scaledRadius(star); tidalStars.add(star.id);
        events.push({ type: 'tidal', holeId: hole.id, starId: star.id, transfer, proximity });
      }
      if (star.mass < Math.max(1.5, BODY_TYPES[star.type].mass * 0.04)) {
        const position = { ...star.position };
        merge(hole, star); removed.add(star.id); hole.accretion = (hole.accretion || 0) + star.mass;
        events.push({ type: 'disrupt', holeId: hole.id, starId: star.id, position });
        continue;
      }
    }
    const primary = kindOf(a) === 'planet' && kindOf(b) === 'moon' ? a : kindOf(b) === 'planet' && kindOf(a) === 'moon' ? b : null;
    if (primary && distance >= a.radius + b.radius) {
      const moon = primary === a ? b : a;
      if (distance < rocheLimit(primary, moon)) {
        rocheMoons.add(moon.id); moon.rocheTime = (moon.rocheTime || 0) + dt;
        if (moon.rocheTime > 1.5) {
          const radius = primary.radius;
          merge(primary, moon); primary.radius = radius; removed.add(moon.id);
          primary.ring = (primary.ring || 0) + moon.mass;
          events.push({ type: 'roche', planetId: primary.id, moonId: moon.id, mass: moon.mass, ring: primary.ring });
          continue;
        }
      }
    }
    // A black hole swallows a body only once it crosses the horizon, not when its surface touches.
    const contact = hole ? hole.radius + (hole === a ? b : a).radius * 0.35 : a.radius + b.radius;
    if (distance >= contact) continue;
    collide(state, a, b, distance, removed, events);
  }
  for (const body of bodies) {
    if (body.rocheTime && !rocheMoons.has(body.id)) body.rocheTime = 0;
    if (state.evolution === false || removed.has(body.id) || tidalStars.has(body.id)) continue;
    const lifetime = lifetimeOf(body);
    if (!lifetime) continue;
    body.age = (body.age || 0) + dt;
    if (body.age > lifetime) detonate(state, body.id, events);
  }
  if (removed.size) state.bodies = state.bodies.filter(body => !removed.has(body.id));
}

export function stepUniverse(state, dt) {
  const events = [];
  dt = Math.max(0, Math.min(0.1, dt));
  const steps = Math.max(1, Math.ceil(dt / 0.02));
  for (let i = 0; i < steps; i++) oneStep(state, dt / steps, events);
  state.time = (state.time || 0) + dt;
  return events;
}

export function universeEnergy(bodies) {
  let energy = 0;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    energy += a.mass * (a.velocity.x ** 2 + a.velocity.y ** 2 + a.velocity.z ** 2) * 0.5;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j], delta = sub(a.position, b.position);
      energy -= GRAVITY * a.mass * b.mass / Math.sqrt(delta.x ** 2 + delta.y ** 2 + delta.z ** 2 + SOFTENING ** 2);
    }
  }
  return energy;
}

export function predictTrajectory(state, id, steps = 96, interval = 0.1) {
  if (!state.bodies.some(body => body.id === id)) return [];
  const copy = { time: state.time, evolution: false, bodies: state.bodies.map(body => ({ ...body,
    position: { ...body.position }, velocity: { ...body.velocity } })) };
  const points = [];
  for (let i = 0; i < Math.min(128, steps); i++) {
    stepUniverse(copy, Math.min(0.1, interval));
    const body = copy.bodies.find(item => item.id === id);
    if (!body) break;
    points.push({ ...body.position });
  }
  return points;
}

export function orbitalElements(primary, body) {
  const r = sub(body.position, primary.position), v = sub(body.velocity, primary.velocity);
  const distance = len(r), speed2 = v.x ** 2 + v.y ** 2 + v.z ** 2;
  const mu = GRAVITY * (primary.mass + body.mass);
  if (distance <= 0 || mu <= 0) return null;
  const h = { x: r.y * v.z - r.z * v.y, y: r.z * v.x - r.x * v.z, z: r.x * v.y - r.y * v.x };
  const vxh = { x: v.y * h.z - v.z * h.y, y: v.z * h.x - v.x * h.z, z: v.x * h.y - v.y * h.x };
  const e = { x: vxh.x / mu - r.x / distance, y: vxh.y / mu - r.y / distance, z: vxh.z / mu - r.z / distance };
  const eccentricity = len(e), specificEnergy = speed2 * 0.5 - mu / distance;
  const semiMajor = Math.abs(specificEnergy) < 1e-9 ? Infinity : -mu / (2 * specificEnergy);
  const period = semiMajor > 0 ? 2 * Math.PI * Math.sqrt(semiMajor ** 3 / mu) : null;
  return { eccentricity, semiMajor, period, periapsis: semiMajor > 0 ? semiMajor * (1 - eccentricity) : null,
    apoapsis: semiMajor > 0 ? semiMajor * (1 + eccentricity) : null };
}

// Compressed luminosity so habitable zones stay inside the explorable map.
export function luminosity(body) {
  if (kindOf(body) !== 'star') return 0;
  if (body.type === 'whitedwarf') return 0.02;
  if (body.type === 'neutron') return 0.005;
  return (body.mass / BODY_TYPES.star.mass) ** 1.6 * (body.type === 'redgiant' ? 1.4 : 1);
}

export function habitableZone(star) {
  const scale = Math.sqrt(luminosity(star)) * AU;
  return { inner: scale * 0.95, outer: scale * 1.4 };
}

export function temperatureOf(body, bodies) {
  const spec = BODY_TYPES[body.type];
  if (!spec) return 0;
  if (spec.kind === 'star') return spec.temperature;
  if (spec.kind === 'blackhole' || spec.kind === 'whitehole') return 0;
  let flux = 0;
  for (const other of bodies) {
    if (other === body) continue;
    const light = luminosity(other) + (kindOf(other) === 'blackhole' ? Math.min(4, (other.accretion || 0) * 0.02) : 0);
    if (!light) continue;
    const r = len(sub(other.position, body.position)) / AU;
    flux += light / Math.max(r * r, 0.01);
  }
  return 255 * flux ** 0.25 + (spec.greenhouse || 0) * Math.min(1, flux);
}

export function climateOf(body, bodies) {
  if (kindOf(body) !== 'planet' && kindOf(body) !== 'moon') return null;
  const t = temperatureOf(body, bodies);
  return t > 900 ? 'molten' : t > 380 ? 'hot' : t < 200 ? 'frozen' : 'temperate';
}
