import test from 'node:test';
import assert from 'node:assert/strict';
import { pinchMovement, stickMovement } from '../vespera-rpg2/vr-gesture.js';

test('Véspera VR: pinça parada não causa deslocamento', () => {
  assert.deepEqual(pinchMovement({ x: 0, z: 0 }, { x: .02, z: -.02 }), { x: 0, y: 0 });
  assert.deepEqual(pinchMovement(null, { x: 1, z: 1 }), { x: 0, y: 0 });
});

test('Véspera VR: mão esquerda controla direção e limita velocidade', () => {
  const forward = pinchMovement({ x: 0, z: 0 }, { x: 0, z: -.2 });
  assert.deepEqual(forward, { x: 0, y: 1 });
  const diagonal = pinchMovement({ x: 0, z: 0 }, { x: .3, z: -.3 });
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
  assert.ok(diagonal.x > 0 && diagonal.y > 0);
});

test('Véspera VR: analógico segue a orientação do headset e tem zona neutra', () => {
  assert.deepEqual(stickMovement([0, 0, 0, -.05]), { x: 0, y: 0 });
  assert.deepEqual(stickMovement([0, 0, 0, -1]), { x: 0, y: 1 });
  const turned = stickMovement([0, 0, 0, -1], Math.PI / 2);
  assert.ok(Math.abs(turned.x + 1) < 1e-10 && Math.abs(turned.y) < 1e-10);
  assert.deepEqual(stickMovement([1, 0]), { x: 1, y: 0 });
});
