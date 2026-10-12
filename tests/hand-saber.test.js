import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { saberPose, VectorFilter, HandSaberTracker } from '../src/games/handSaber.js';

// Right fist held forward, palm facing left: knuckles point forward (-z),
// index knuckle above the pinky knuckle, like gripping a controller.
const fist = (offset = new THREE.Vector3()) => {
  const P = Array.from({ length: 21 }, () => new THREE.Vector3());
  P[0].set(0, 1.2, -0.3);
  P[5].set(0, 1.235, -0.39); P[9].set(0, 1.215, -0.395); P[13].set(0, 1.195, -0.39); P[17].set(0, 1.175, -0.38);
  for (let i = 1; i < 21; i++) if (![5, 9, 13, 17].includes(i)) P[i].copy(P[Math.min(17, Math.floor((i - 1) / 4) * 4 + 5)]);
  P.forEach(p => p.add(offset));
  const palm = P[0].clone().add(P[5]).add(P[17]).multiplyScalar(1 / 3);
  return { points: P, palm, id: 'native-right' };
};

test('fist grip points the blade up and forward from the thumb side', () => {
  const { points, palm } = fist();
  const { base, dir } = saberPose(points, palm, 'fist');
  assert.ok(dir.y > 0.6 && dir.z < -0.3, `dir ${dir.toArray()}`);
  assert.ok(Math.abs(dir.length() - 1) < 1e-6);
  assert.ok(base.distanceTo(palm) < 0.08);
});

test('finger grip keeps the blade along the hand as before', () => {
  const { points, palm } = fist();
  const { dir } = saberPose(points, palm, 'fingers');
  assert.ok(dir.z < -0.95);
});

test('filter removes jitter at rest but follows fast swings closely', () => {
  const still = new VectorFilter(1.5, 4), target = new THREE.Vector3(0, 1, 0);
  let maxError = 0;
  for (let i = 0; i < 120; i++) {
    const noisy = target.clone().add(new THREE.Vector3((i % 2 ? 1 : -1) * 0.006, 0, 0));
    if (i > 30) maxError = Math.max(maxError, still.filter(noisy, 1 / 60).distanceTo(target)); else still.filter(noisy, 1 / 60);
  }
  assert.ok(maxError < 0.003, `jitter ${maxError}`);
  const swing = new VectorFilter(1.5, 4), p = new THREE.Vector3();
  for (let i = 0; i < 20; i++) { p.x = i * 0.06; swing.filter(p, 1 / 60); } // 3.6 m/s
  assert.ok(swing.value.distanceTo(p) < 0.06, `lag ${swing.value.distanceTo(p)}`);
});

test('tracker holds the pose briefly after tracking loss, then resets', () => {
  const tracker = new HandSaberTracker(true);
  tracker.update(fist(), 'fist', 1 / 60);
  assert.equal(tracker.lost(0.1), true);
  assert.equal(tracker.lost(0.15), false);
  // After a long loss the filter restarts at the new hand position (no slow glide).
  const moved = tracker.update(fist(new THREE.Vector3(0.5, 0, 0)), 'fist', 1 / 60);
  assert.ok(moved.base.x > 0.45);
});
