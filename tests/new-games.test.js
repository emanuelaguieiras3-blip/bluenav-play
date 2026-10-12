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

test('slalom pole knocked by the rider swings back upright', async () => {
  const { stepPole, hitPole } = await import('../src/games/trails.js');
  const pole = { angle: 0, velocity: 0 };
  hitPole(pole, 1, 15);
  let peak = 0; for (let i = 0; i < 20; i++) { stepPole(pole, 1 / 60); peak = Math.max(peak, pole.angle); }
  assert.ok(peak > 0.3, `tips over ${peak}`);
  for (let i = 0; i < 240; i++) stepPole(pole, 1 / 60);
  assert.ok(Math.abs(pole.angle) < 0.02 && Math.abs(pole.velocity) < 0.1, 'back upright');
  assert.equal(pole.hits, 1);
});

test('shiftworld keeps trees off the path and away from the spawn point', async () => {
  const THREE = await import('three');
  globalThis.document ??= { createElement: () => { const c = { width: 0, height: 0 }; const x = new Proxy({ canvas: c, measureText: t => ({ width: String(t).length * 8 }), createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => k in o ? o[k] : () => {} }); c.getContext = () => x; return c; } };
  const { default: game } = await import('../src/games/shiftworld.js');
  const root = new THREE.Group(), texture = new THREE.Texture();
  const label = () => { const m = new THREE.Object3D(); m.userData.set = () => {}; return m; };
  const ctx = { THREE, root, rig: new THREE.Group(), input: { keys: new Set() }, audio: {}, tex: { get: () => texture }, env: { set() {} },
    label, button: label, teleport() {}, pointers: () => [], eye: () => new THREE.Vector3(0, 1.6, 0), hud() {}, app: {} };
  const g = game.create(ctx);
  for (const zone of g.zones) for (const crown of zone.trees) assert.ok(Math.abs(crown.parent.position.x) >= 3.4, `tree at x ${crown.parent.position.x}`);
});
