// A closed hand acts as a dead-man control. Opening/lost tracking stops immediately.
export function isClosedHand(pointer) {
  if (pointer.source !== 'hand' || pointer.stale || pointer.system || pointer.uiBusy || pointer.pinch || !Number.isFinite(pointer.hand?.confianca) || pointer.hand.confianca < 0.6) return false;
  const points = pointer.hand?.points; if (!points || points.length !== 21) return false;
  const wrist = points[0], size = wrist.distanceTo(points[9]);
  if (size < 0.025 || !Number.isFinite(size)) return false;
  return [8, 12, 16, 20].every(tip => points[tip].distanceTo(wrist) < size * 1.25 && points[tip].distanceTo(wrist) < points[tip - 2].distanceTo(wrist) * 1.05);
}

export class WalkIntent {
  constructor() { this.reset(); }
  reset(requireRelease = false) { this.id = null; this.held = 0; this.active = false; this.requireRelease = requireRelease; }
  update(dt, pointers, allowed) {
    if (!allowed) { this.reset(true); return 0; }
    const hands = pointers.filter(p => p.source === 'hand' && !p.stale && !p.system);
    const hand = hands.length === 1 ? hands[0] : hands.find(p => p.side === 'left');
    if (!hand) { this.reset(true); return 0; }
    if (!isClosedHand(hand)) { this.reset(); return 0; }
    if (this.requireRelease) return 0;
    if (this.id !== null && hand.id !== this.id) { this.reset(true); return 0; }
    this.id = hand.id;
    this.held += Math.max(0, Math.min(dt, 0.05)); this.active = this.held >= 0.3;
    return this.active ? 1 : 0;
  }
}

// Sweep small steps and allow sliding; don't tunnel through narrow walls.
export function walkStep(x, z, dx, dz, allowed) {
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  for (let i = 0; i < count; i++) {
    const sx = dx / count, sz = dz / count;
    if (allowed(x + sx, z + sz)) { x += sx; z += sz; }
    else { if (allowed(x + sx, z)) x += sx; if (allowed(x, z + sz)) z += sz; }
  }
  return { x, z };
}
