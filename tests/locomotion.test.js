import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WalkIntent, isClosedHand, walkStep } from '../src/core/locomotion.js';
import { quadTransform } from '../src/media/windowProjection.js';
import { disposeTree } from '../src/core/util.js';

function pointer(closed = true, side = 'left') {
  const points = Array.from({ length: 21 }, () => new THREE.Vector3(0, .06, 0));
  points[0].set(0, 0, 0); points[9].y = .09;
  for (const tip of [8, 12, 16, 20]) { points[tip].y = closed ? .045 : .17; points[tip - 2].y = .07; }
  return { id: side, side, source: 'hand', hand: { points, confianca: .9 } };
}
test('walking requires a stable fist, excludes pinches and stops on opening or stale tracking', () => {
  const intent = new WalkIntent(), fist = pointer();
  assert.equal(isClosedHand(fist), true); assert.equal(isClosedHand(pointer(false)), false);
  for (let i = 0; i < 5; i++) assert.equal(intent.update(.05, [fist], true), 0);
  assert.equal(intent.update(.05, [fist], true), 1);
  assert.equal(intent.update(.05, [pointer(false)], true), 0);
  assert.equal(isClosedHand({ ...fist, pinch: true }), false); assert.equal(isClosedHand({ ...fist, stale: true }), false);
  assert.equal(isClosedHand({ ...fist, hand: { ...fist.hand, confianca: .2 } }), false);
});
test('left fist controls two-hand play, single right hand works, and reopening is required after pause', () => {
  const intent = new WalkIntent(), right = pointer(true, 'right'), left = pointer(false);
  for (let i = 0; i < 10; i++) assert.equal(intent.update(.05, [left, right], true), 0);
  for (let i = 0; i < 6; i++) intent.update(.05, [right], true);
  assert.equal(intent.active, true); intent.update(.05, [right], false);
  for (let i = 0; i < 20; i++) assert.equal(intent.update(.05, [right], true), 0);
  intent.update(.05, [pointer(false, 'right')], true);
  for (let i = 0; i < 6; i++) intent.update(.05, [right], true);
  assert.equal(intent.active, true);
});
test('movement sweep cannot tunnel through a thin wall and slides along obstacles', () => {
  assert.ok(walkStep(0, 0, 2, 0, x => x < .6 || x > 1.1).x < .6);
  const next = walkStep(0, 0, 1, 1, x => x < .5); assert.ok(next.x < .5); assert.ok(next.z > .9);
});
test('CSS homography maps all four iframe corners to the window including perspective', () => {
  const points = [[20, 40], [500, 70], [450, 350], [50, 300]], matrix = quadTransform(960, 540, points);
  for (const [i, [x, y]] of [[0, 0], [960, 0], [960, 540], [0, 540]].entries()) {
    const w = matrix[3] * x + matrix[7] * y + matrix[15];
    assert.ok(Math.abs((matrix[0] * x + matrix[4] * y + matrix[12]) / w - points[i][0]) < 1e-6);
    assert.ok(Math.abs((matrix[1] * x + matrix[5] * y + matrix[13]) / w - points[i][1]) < 1e-6);
  }
  assert.equal(quadTransform(1, 1, [[0, 0], [0, 0], [0, 0], [0, 0]]), null);
});
test('shared mesh resources are disposed once while preserved textures stay usable', () => {
  const group = new THREE.Group(), geometry = new THREE.BoxGeometry(), texture = new THREE.Texture(), material = new THREE.MeshBasicMaterial({ map: texture });
  group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  const calls = { geometry: 0, material: 0, texture: 0 };
  for (const [name, resource] of Object.entries({ geometry, material, texture })) resource.addEventListener('dispose', () => calls[name]++);
  disposeTree(group); assert.deepEqual(calls, { geometry: 1, material: 1, texture: 1 });
});
