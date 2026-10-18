import { BODY_TYPES } from './universePhysics.js';

const SLOT_KEY = slot => `bluenav.universe.slot${slot}`;
const vector = v => v && ['x', 'y', 'z'].every(axis => Number.isFinite(v[axis]) && Math.abs(v[axis]) < 50000);

export function snapshot(state) {
  return { bodies: structuredClone(state.bodies), nextId: state.nextId, time: state.time };
}

export function sanitizeBodies(list, max = 64) {
  if (!Array.isArray(list) || list.length > max) return null;
  const ids = new Set(), bodies = [];
  for (const item of list) {
    if (!item || typeof item.id !== 'string' || !/^u\d{1,5}$/.test(item.id) || ids.has(item.id) || !BODY_TYPES[item.type]) return null;
    if (!(item.mass > 0 && item.mass < 50000 && item.radius > 0 && item.radius < 10) || !vector(item.position) || !vector(item.velocity)) return null;
    ids.add(item.id);
    const body = { id: item.id, type: item.type, mass: item.mass, radius: item.radius,
      position: { ...item.position }, velocity: { ...item.velocity } };
    if (typeof item.name === 'string' && item.name.length <= 24) body.name = item.name;
    if (Number.isFinite(item.ring) && item.ring > 0) body.ring = item.ring;
    if (Number.isFinite(item.age) && item.age >= 0) body.age = item.age;
    bodies.push(body);
  }
  return bodies;
}

export class UniverseHistory {
  constructor(limit = 40) { this.limit = limit; this.past = []; this.future = []; }
  record(state) {
    this.past.push(snapshot(state));
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }
  undo(state) {
    if (!this.past.length) return null;
    this.future.push(snapshot(state));
    return this.past.pop();
  }
  redo(state) {
    if (!this.future.length) return null;
    this.past.push(snapshot(state));
    return this.future.pop();
  }
}

// Storage can be missing or throw (private windows, previews); callers just get false/null.
export function saveSlot(storage, slot, state) {
  try {
    storage.setItem(SLOT_KEY(slot), JSON.stringify({ v: 1, savedAt: Date.now(), ...snapshot(state) }));
    return true;
  } catch { return false; }
}

export function loadSlot(storage, slot) {
  try {
    const data = JSON.parse(storage.getItem(SLOT_KEY(slot)) || 'null');
    const bodies = data?.v === 1 ? sanitizeBodies(data.bodies) : null;
    if (!bodies) return null;
    return { bodies, nextId: Number.isInteger(data.nextId) ? data.nextId : bodies.length + 1, time: Number.isFinite(data.time) ? data.time : 0, savedAt: data.savedAt };
  } catch { return null; }
}

export function slotInfo(storage, slot) {
  try {
    const data = JSON.parse(storage.getItem(SLOT_KEY(slot)) || 'null');
    return data?.v === 1 ? { count: data.bodies?.length || 0, savedAt: data.savedAt } : null;
  } catch { return null; }
}
