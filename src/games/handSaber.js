// Hand-tracked saber pose, in the style of Quest hand tracking: a closed fist
// holds a virtual hilt and the blade leaves the thumb side of the fist.
import * as THREE from 'three';

export const SABER_GRIPS = ['fist', 'fingers'];

const across = new THREE.Vector3(), forward = new THREE.Vector3(), knuckles = new THREE.Vector3();

// points: 21 hand joints (wrist, thumb 1-4, index 5-8, middle 9-12, ring 13-16, pinky 17-20).
export function saberPose(points, palm, grip = 'fist', base = new THREE.Vector3(), dir = new THREE.Vector3()) {
  const P = points;
  forward.copy(P[9]).sub(P[0]).normalize();
  if (grip === 'fingers') {
    base.copy(palm).lerp(P[9], 0.5);
    dir.copy(forward);
    return { base, dir };
  }
  // The hilt crosses the palm from pinky to index knuckle; a relaxed grip tilts
  // the blade about 60 degrees forward from the forearm.
  across.copy(P[5]).sub(P[17]).normalize();
  knuckles.copy(P[5]).add(P[9]).add(P[13]).add(P[17]).multiplyScalar(0.25);
  base.copy(palm).lerp(knuckles, 0.6);
  dir.copy(across).addScaledVector(forward, 0.55);
  if (dir.lengthSq() < 1e-6) dir.copy(forward);
  dir.normalize();
  return { base, dir };
}

// One Euro filter: strong smoothing when the hand is still, almost none during
// fast swings, so jitter disappears without adding lag to cuts.
const alpha = (cutoff, dt) => { const r = 2 * Math.PI * cutoff * dt; return r / (r + 1); };
export class VectorFilter {
  constructor(minCutoff = 1.5, beta = 4, dCutoff = 1) { this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff; this.value = null; this.speed = new THREE.Vector3(); this._d = new THREE.Vector3(); }
  reset() { this.value = null; this.speed.set(0, 0, 0); }
  filter(v, dt) {
    if (!this.value || !(dt > 0)) { this.value = v.clone(); this.speed.set(0, 0, 0); return this.value; }
    this._d.copy(v).sub(this.value).divideScalar(dt);
    this.speed.lerp(this._d, alpha(this.dCutoff, dt));
    const a = alpha(this.minCutoff + this.beta * this.speed.length(), dt);
    return this.value.lerp(v, a);
  }
}

// Filters base and direction per hand and keeps the last pose briefly when
// tracking drops (fast swings), instead of the blade blinking out.
export class HandSaberTracker {
  constructor(native = false) {
    this.base = new VectorFilter(native ? 4 : 1.5, native ? 6 : 4);
    this.dir = new VectorFilter(native ? 5 : 2, native ? 2 : 1.2);
    this.lostFor = Infinity; this.pose = { base: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0) };
  }
  update(hand, grip, dt) {
    const raw = saberPose(hand.points, hand.palm, grip);
    if (this.lostFor > HandSaberTracker.HOLD) { this.base.reset(); this.dir.reset(); }
    this.pose.base.copy(this.base.filter(raw.base, dt));
    this.pose.dir.copy(this.dir.filter(raw.dir, dt)).normalize();
    this.lostFor = 0;
    return this.pose;
  }
  lost(dt) { this.lostFor += dt; return this.lostFor <= HandSaberTracker.HOLD; }
}
HandSaberTracker.HOLD = 0.2;
