import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GorillaMotion, pushOut, boxSurface, capsuleSurface } from '../src/games/gorillaMotion.js';

function rigFixture(surfaces = []) {
  const rig = new THREE.Group(), camera = new THREE.Object3D(); camera.position.set(0, 1.05, 0); rig.add(camera);
  const hands = [];
  const ctx = { rig, pointers: () => hands, eye: () => camera.getWorldPosition(new THREE.Vector3()), audio: { thud() {} } };
  const motion = new GorillaMotion(ctx, surfaces, () => true);
  // Hands are tracked relative to the head, so they move with the rig.
  const hand = (id, local) => { const p = { id, source: 'hand', local: local.clone(), handPos: new THREE.Vector3(), hand: { palm: new THREE.Vector3() }, pinch: false }; hands.push(p); return p; };
  const sync = () => { rig.updateMatrixWorld(true); for (const p of hands) { p.hand.palm.copy(p.local).add(rig.position); p.handPos.copy(p.hand.palm); } };
  return { rig, motion, hands, hand, sync, ctx };
}

test('pushing a hand down on the ground lifts the body and a fast push becomes a jump', () => {
  const f = rigFixture(), p = f.hand('r', new THREE.Vector3(0.2, 0.07, -0.3));
  for (let i = 0; i < 3; i++) { f.sync(); f.motion.update(1 / 60); }
  assert.ok(f.motion.touching, 'hand on the ground touches');
  // Shove down fast: the hand stays on the ground, the body rises.
  for (let i = 0; i < 8; i++) { p.local.y -= 0.05; f.sync(); f.motion.update(1 / 60); }
  assert.ok(f.rig.position.y > 0.3, `body rose ${f.rig.position.y}`);
  // Lift the hand away: averaged velocity launches the body upwards.
  p.local.y += 1; f.sync(); f.motion.update(1 / 60);
  assert.ok(f.motion.velocity.y > 2, `launch ${f.motion.velocity.y}`);
  assert.ok(f.motion.velocity.length() <= 6.5 + 1e-6);
});

test('dragging a planted hand backwards moves the body forward without sliding', () => {
  const f = rigFixture(), p = f.hand('r', new THREE.Vector3(0.2, 0.06, -0.4));
  f.sync(); f.motion.update(1 / 60);
  const anchor = [...f.motion.hands.values()][0].last.clone();
  for (let i = 0; i < 10; i++) { p.local.z += 0.03; f.sync(); f.motion.update(1 / 60); }
  assert.ok(f.rig.position.z < -0.2, `moved forward ${f.rig.position.z}`);
  assert.ok([...f.motion.hands.values()][0].last.distanceTo(anchor) < 0.02, 'hand stays where it touched');
});

test('losing hand tracking never launches the player sideways', () => {
  const f = rigFixture(); f.rig.position.y = 2; f.motion.velocity.set(5, 0, 5);
  f.motion.update(1 / 60);
  assert.equal(f.motion.velocity.x, 0); assert.equal(f.motion.velocity.z, 0);
  assert.ok(f.rig.position.y < 2);
});

test('the head cannot pass through a branch and the hands collide with capsules and boxes', () => {
  const branch = capsuleSurface(new THREE.Vector3(-1, 1, -0.1), new THREE.Vector3(1, 1, -0.1), 0.1);
  const n = new THREE.Vector3();
  assert.ok(pushOut(branch, new THREE.Vector3(0, 1.05, -0.1), 0.07, n)); assert.ok(n.y > 0.5);
  assert.equal(pushOut(branch, new THREE.Vector3(0, 1.5, -0.1), 0.07), null);
  const deck = boxSurface(new THREE.Box3(new THREE.Vector3(-1, 0.9, -1), new THREE.Vector3(1, 1.1, 1)));
  const exit = pushOut(deck, new THREE.Vector3(0, 1.08, 0), 0.07, n); assert.ok(exit.y > 1.1 && n.y === 1);
  const f = rigFixture([branch]); f.motion.update(1 / 60);
  assert.ok(f.ctx.eye().distanceTo(new THREE.Vector3(0, 1, -0.1)) >= 0.29, 'head pushed out of the branch');
});
