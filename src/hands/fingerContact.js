// One press per physical contact. Retreat 3 cm before another press.
export class FingerContact {
  constructor() { this.reset(); }
  reset() { this.key = null; this.depth = null; this.armed = true; }
  update(key, depth) {
    if (key == null) { this.reset(); return false; }
    if (!Number.isFinite(depth)) return false;
    if (depth < -0.03) this.armed = true;
    const same = key === this.key;
    // A newly detected hand behind a panel must not press it.
    const crossed = same && this.depth < -0.004 && depth >= -0.004;
    const touching = depth >= -0.004 && depth <= 0.012;
    const fire = this.armed && (crossed || touching);
    if (fire || (!same && depth > 0.012)) this.armed = false;
    this.key = key; this.depth = depth;
    return fire;
  }
}
