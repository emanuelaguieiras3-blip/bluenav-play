import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HandCorrector, BONES } from '../src/hands/handCorrector.js';
import { FingerContact } from '../src/hands/fingerContact.js';
import { Input } from '../src/core/input.js';
import { UI } from '../src/ui/ui.js';
import { Perf } from '../src/core/perf.js';
import { GAMES } from '../src/games/index.js';
import { HAND_CONTROLS } from '../src/games/handControls.js';
import { HandView } from '../src/hands/handView.js';

function pose() {
  const p = [[0, -0.06, -0.45]];
  for (let f = 0; f < 5; f++) for (let j = 0; j < 4; j++)
    p.push(f === 0 ? [-0.035 - j * 0.014, -0.03 + j * 0.012, -0.45] : [(f - 2) * 0.021, [0, 0.03, 0.055, 0.075][j], -0.45]);
  return p;
}
const distance = (a, b) => Math.hypot(...a.map((v, k) => v - b[k]));

test('invalid or collapsed first frames never initialize anatomy', () => {
  const c = new HandCorrector();
  assert.equal(c.process(Array.from({ length: 21 }, () => [0, 0, 0]), 1 / 60).pontosCorrigidos, null);
  const invalid = pose(); invalid[8][0] = NaN;
  assert.equal(c.process(invalid, 1 / 60).confianca, 0);
  assert.equal(c.prev, null);
  assert.ok(c.process(pose(), 1 / 60).pontosCorrigidos);
});

test('occluded joints do not shrink calibrated finger bones', () => {
  const c = new HandCorrector(), p = pose(); c.process(p, 1 / 60);
  const k = BONES.findIndex(([a, b]) => a === 5 && b === 6), length = c.boneLen[k];
  const occluded = pose(); occluded[6] = occluded[5].slice();
  for (let i = 0; i < 180; i++) {
    const out = c.process(occluded, 1 / 60, 0.95, 1).pontosCorrigidos;
    assert.ok(Math.abs(distance(out[5], out[6]) - length) < 0.001);
    assert.ok(out.every((p) => p.every(Number.isFinite)));
  }
  assert.ok(Math.abs(c.boneLen[k] - length) < 0.001);
});

test('untrusted Gemini reference cannot damage calibration', () => {
  const c = new HandCorrector(); c.process(pose(), 1 / 60);
  const original = c.boneLen.slice();
  assert.equal(c.applyReference(pose(), NaN), false);
  assert.equal(c.applyReference(pose().map((p) => p.map((v) => v * 3)), 0.9), false);
  assert.deepEqual(c.boneLen, original);
  assert.equal(c.applyReference(pose(), 0.9), true);
});

test('occluded finger bases retain palm spacing', () => {
  const c = new HandCorrector(), p = pose(); c.process(p, 1 / 60);
  const expected = distance(p[5], p[9]);
  const occluded = pose(); occluded[9] = occluded[5].slice();
  for (let i = 0; i < 120; i++) {
    const out = c.process(occluded, 1 / 60, 0.95, 1).pontosCorrigidos;
    assert.ok(distance(out[5], out[9]) >= expected * 0.65);
  }
});

test('finger contact fires once, rearms on retreat and rejects rear entry', () => {
  const c = new FingerContact();
  assert.equal(c.update('button', -0.02), false);
  assert.equal(c.update('button', 0), true);
  for (let i = 0; i < 60; i++) assert.equal(c.update('button', 0.002), false);
  assert.equal(c.update('next-button', 0.002), false);
  assert.equal(c.update('button', -0.04), false);
  assert.equal(c.update('button', 0), true);
  c.reset(); assert.equal(c.update('button', 0.05), false);
});

function appFixture() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(camera); camera.updateMatrixWorld();
  return { scene, camera, rig: new THREE.Group(), mode: 'flat',
    renderer: { xr: { isPresenting: false }, domElement: { addEventListener() {} } },
    audio: { unlock() {}, hover() {}, click() {}, keyTap() {} }, pointerHit: null };
}

test('tracking dropout holds pinch without emitting press/release; ray starts at finger', () => {
  globalThis.window = { addEventListener() {} };
  const app = appFixture();
  const hand = { id: 0, label: 'Right', pontos: pose(), gesto: 'pinça', confianca: 0.95, palmFacing: -1, pinchStrength: 1 };
  app.hands = { running: true, hands: [hand] };
  const input = new Input(app); app.input = input;
  input.update(1 / 60); assert.equal(input.pinchDown, true);
  hand.stale = true; hand.gesto = 'aberta'; input.update(1 / 60);
  assert.equal(input.pinch, true); assert.equal(input.pinchUp, false); assert.equal(input.pinchDown, false);
  assert.equal(input.pointers[0].pokeTip, null);
  hand.stale = false; hand.gesto = 'apontando'; input.update(1 / 60);
  assert.equal(input.pinchUp, true);
  assert.ok(input.pointers[0].ray.origin.distanceTo(input.pointers[0].hand.tip) < 1e-8);
});

function uiFixture() {
  const app = appFixture(), ui = new UI(app); let clicks = 0;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial());
  mesh.position.z = -0.4; app.scene.add(mesh); app.scene.updateMatrixWorld(true);
  ui.add(mesh, { onClick: () => { clicks++; } });
  const p = { id: 'hand', source: 'hand', ray: new THREE.Ray(new THREE.Vector3(0, 0, -0.35), new THREE.Vector3(0, 0, -1)), origin: new THREE.Vector3(0, 0, -0.35), pokeTip: new THREE.Vector3(0, 0, -0.35), main: true };
  const input = { pointers: [p], _ptrs: new Map([[p.id, p]]) };
  return { app, ui, p, input, clicks: () => clicks };
}

test('pinching after pointing preserves aim instead of switching to shoulder', () => {
  globalThis.window = { addEventListener() {} };
  const app = appFixture();
  const hand = { id: 0, label: 'Right', pontos: pose(), gesto: 'apontando', confianca: 0.95, palmFacing: -1, pinchStrength: 0 };
  app.hands = { running: true, hands: [hand] };
  const input = new Input(app); input.update(1 / 60);
  const direction = input.ray.direction.clone(), origin = input.ray.origin.clone();
  hand.gesto = 'pinça'; hand.pinchStrength = 1; input.update(1 / 60);
  assert.equal(input.pinchDown, true);
  assert.ok(direction.angleTo(input.ray.direction) < 0.001);
  assert.ok(origin.distanceTo(input.ray.origin) < 0.001);
});

test('fast fingertip crosses thin button once, held contact never repeats', () => {
  const f = uiFixture(); f.ui.update(1 / 60, f.input);
  f.p.pokeTip.z = -0.46; f.ui.update(1 / 60, f.input);
  assert.equal(f.clicks(), 1);
  for (let i = 0; i < 30; i++) f.ui.update(1 / 60, f.input);
  assert.equal(f.clicks(), 1);
  f.p.pokeTip.z = -0.35; f.ui.update(1 / 60, f.input);
  f.p.pokeTip.z = -0.4; f.ui.update(1 / 60, f.input);
  assert.equal(f.clicks(), 2);
});

test('stale hand cannot press a button', () => {
  const f = uiFixture(); f.p.pokeTip.z = -0.4; f.p.stale = true;
  f.ui.update(1 / 60, f.input); assert.equal(f.clicks(), 0);
});

test('fast touch from outside proximity range fires once even before the button had contact', () => {
  const f = uiFixture();
  f.p.pokeTip.z = -0.29; f.ui.update(1 / 60, f.input);
  assert.equal(f.clicks(), 0);
  f.p.pokeTip.z = -0.43; f.ui.update(1 / 60, f.input);
  assert.equal(f.clicks(), 1);
  for (let i = 0; i < 20; i++) f.ui.update(1 / 60, f.input);
  assert.equal(f.clicks(), 1);
});

test('tracking recovery behind a button cannot create a click; retreat rearms contact', () => {
  const f = uiFixture(); f.ui.update(1 / 60, f.input);
  f.p.stale = true; f.ui.update(1 / 60, f.input);
  f.p.stale = false; f.p.pokeTip.z = -0.41; f.ui.update(1 / 60, f.input);
  assert.equal(f.clicks(), 0);
  f.p.pokeTip.z = -0.35; f.ui.update(1 / 60, f.input);
  f.p.pokeTip.z = -0.4; f.ui.update(1 / 60, f.input);
  assert.equal(f.clicks(), 1);
});

test('displayed line stays collinear with cast ray even with old game hit', () => {
  const f = uiFixture(); f.ui.targets = []; f.p.pokeTip = null;
  f.app.pointerHit = new THREE.Vector3(1, 1, -2);
  f.ui.update(1 / 60, f.input);
  const a = f.ui.states.get('hand').line.geometry.attributes.position;
  const start = new THREE.Vector3().fromBufferAttribute(a, 0), end = new THREE.Vector3().fromBufferAttribute(a, 1);
  assert.ok(start.distanceTo(f.p.ray.origin) < 1e-6);
  assert.ok(end.sub(start).cross(f.p.ray.direction).length() < 1e-6);
});

for (const hz of [60, 90, 120]) test(`60 FPS limiter preserves rate on ${hz} Hz screen`, () => {
  const perf = Object.create(Perf.prototype);
  Object.assign(perf, { capFps: 60, app: { renderer: { xr: { isPresenting: false } } }, _lastFrame: 0 });
  let frames = 0;
  for (let i = 0; i < hz * 3; i++) if (perf.shouldRender(i * 1000 / hz)) frames++;
  assert.ok(Math.abs(frames - 180) <= 2, `${frames} frames in 3 seconds`);
});

test('all 16 games have one-hand and two-hand instructions', () => {
  assert.equal(GAMES.length, 16);
  for (const game of GAMES) assert.ok(HAND_CONTROLS[game.id]?.every((text) => text.length > 10));
});

test('ray begins at index tip in open, pointing and pinching poses', () => {
  globalThis.window = { addEventListener() {} };
  const app = appFixture(), hand = { id: 0, label: 'Right', pontos: pose(), confianca: 0.95, palmFacing: -1 };
  app.hands = { running: true, hands: [hand] };
  const input = new Input(app); app.input = input;
  for (const gesture of ['aberta', 'pinça', 'apontando', 'pinça', 'aberta']) {
    hand.gesto = gesture; input.update(1 / 60);
    const pointer = input.pointers[0];
    assert.ok(pointer.ray.origin.distanceTo(pointer.hand.tip) < 1e-8, gesture);
    assert.ok(pointer.origin.distanceTo(pointer.hand.tip) < 1e-8, gesture);
    if (gesture === 'apontando') {
      const finger = pointer.hand.tip.clone().sub(pointer.hand.points[5]).normalize();
      assert.ok(pointer.ray.direction.distanceTo(finger) < 1e-8, gesture);
    } else if (gesture === 'aberta' || !pointer.fingerAim) {
      assert.ok(pointer.ray.direction.distanceTo(pointer.hand.tip.clone().normalize()) < 1e-8, gesture);
    }
  }
});

test('matte hand envelope keeps 87 percent transparency across gestures and passthrough', () => {
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) };
  try {
    const scene = new THREE.Scene(), view = new HandView(scene);
    const hand = { points: pose().map((p) => new THREE.Vector3(...p)), pinchStrength: 0 };
    const input = { hands: [hand], systemHand: null, app: { passthrough: { covering: false } } };
    for (const pinch of [0, 1]) for (const covering of [false, true]) {
      hand.pinchStrength = pinch; input.app.passthrough.covering = covering; view.update(input);
      const skin = view.views[0];
      assert.equal(skin.mat.opacity, 0.13);
      assert.equal(skin.mat.isMeshBasicMaterial, true);
      assert.equal(skin.mat.toneMapped, false);
      assert.equal(skin.g.children.length, 3); // palm + finger envelope + joints, no glowing tips
      assert.equal(skin.palm.geometry.attributes.position.count, 12);
      assert.ok([...skin.palm.geometry.attributes.position.array].every(Number.isFinite));
    }
  } finally { globalThis.document = oldDocument; }
});
