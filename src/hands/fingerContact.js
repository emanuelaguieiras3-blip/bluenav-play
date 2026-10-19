// AI can calibrate contact tolerance here. Clicks from Gemini go only through the
// near-miss path in ui.js (ButtonAssist.judge), never through this contact test.
export const DEFAULT_TOUCH_PROFILE = Object.freeze({ marginMm: 4, releaseMm: 30 });
export function touchProfile(value, confidence) {
  if (!value || !Number.isFinite(confidence) || confidence < 0.8 || confidence > 1 ||
      !Number.isFinite(value.marginMm) || !Number.isFinite(value.releaseMm) ||
      value.marginMm < 2 || value.marginMm > 8 || value.releaseMm < 25 || value.releaseMm > 45) return null;
  return { marginMm: value.marginMm, releaseMm: value.releaseMm };
}

// One press per physical contact. Only retreat rearms the same hand.
export class FingerContact {
  constructor() { this.profile = DEFAULT_TOUCH_PROFILE; this.reset(); }
  reset() { this.key = null; this.depth = null; this.armed = true; }
  suspend() { this.depth = null; this.armed = false; }
  calibrate(value, confidence) {
    const profile = touchProfile(value, confidence);
    // An arriving network response must not change a contact already underway.
    if (!profile || (this.depth !== null && this.depth >= -this.profile.releaseMm / 1000)) return false;
    this.profile = profile; return true;
  }
  update(key, depth, previousDepth = null) {
    if (key == null) { this.reset(); return false; }
    if (!Number.isFinite(depth)) return false;
    const margin = this.profile.marginMm / 1000;
    if (depth < -this.profile.releaseMm / 1000) this.armed = true;
    const same = key === this.key;
    // A newly detected hand behind a panel must not press it.
    const crossed = (same && this.depth !== null && this.depth < -margin && depth >= -margin)
      || (Number.isFinite(previousDepth) && previousDepth < -margin && depth >= -margin);
    const touching = depth >= -margin && depth <= 0.012;
    const fire = this.armed && (crossed || touching);
    if (fire || (!same && depth > 0.012)) this.armed = false;
    this.key = key; this.depth = depth;
    return fire;
  }
}
