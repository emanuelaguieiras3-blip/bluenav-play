import test from 'node:test';
import assert from 'node:assert/strict';
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Node.js' } });
globalThis.screen = { width: 1200, height: 800 };
globalThis.matchMedia = () => ({ matches: false });
const { stepTrail, gateResult } = await import('../src/games/trails.js');
const { canRestore } = await import('../src/games/shiftworld.js');

test('ski moves downhill, brakes, and stays within course bounds', () => {
  const state = { s: 0, x: 0, speed: 0, lateral: 0, edgeHits: 0 };
  for (let i = 0; i < 300; i++) stepTrail(state, { steer: 0, brake: false }, 1 / 60, 'ski');
  assert.ok(state.s > 20 && state.speed > 5);
  const before = state.speed;
  for (let i = 0; i < 60; i++) stepTrail(state, { steer: 1, brake: true }, 1 / 60, 'ski');
  assert.ok(state.speed < before);
  assert.ok(state.x <= 6.7);
});

test('motorbike needs throttle, brakes, and can pass centered gates', () => {
  const state = { s: 0, x: 0, speed: 0, lateral: 0, edgeHits: 0 };
  for (let i = 0; i < 60; i++) stepTrail(state, { throttle: false, steer: 0 }, 1 / 60, 'motorbike');
  assert.equal(state.s, 0);
  for (let i = 0; i < 180; i++) stepTrail(state, { throttle: true, steer: 0 }, 1 / 60, 'motorbike');
  assert.ok(state.s > 20);
  assert.equal(gateResult(1.5, 0), true);
  assert.equal(gateResult(2, 0), false);
});

test('world anchors require physical proximity', () => {
  assert.equal(canRestore({ x: 1, z: -4 }, { x: 0, z: -5 }), true);
  assert.equal(canRestore({ x: 7, z: 0 }, { x: 0, z: -5 }), false);
});
