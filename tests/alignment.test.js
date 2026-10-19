import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { HandTracker } from '../src/hands/handTracker.js';
import { Passthrough } from '../src/core/passthrough.js';
import { StereoRenderer } from '../src/core/stereo.js';
import { Input } from '../src/core/input.js';
import { CONFIG } from '../config.js';

function fixture(aspect = 0.75, mirror = false) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, aspect, 0.01, 100);
  scene.add(camera); camera.position.set(1, 1.6, -2); camera.rotation.set(0.15, 0.35, 0);
  camera.updateMatrixWorld(true);
  const app = { scene, camera, mode: 'cardboard', rig: new THREE.Group(), renderer: {
    xr: { isPresenting: false }, domElement: { addEventListener() {} },
  }, audio: { unlock() {} } };
  const pass = new Passthrough(app);
  pass.video = { videoWidth: 960, videoHeight: 540 };
  pass.mesh = new THREE.Mesh(new THREE.PlaneGeometry());
  pass.mesh.position.z = -8; camera.add(pass.mesh); pass.mirror = mirror; pass._fit();
  const tracker = new HandTracker(); tracker.video = pass.video; tracker.mirror = mirror;
  tracker.hfovProvider = () => pass.displayHFOV; tracker.running = true;
  tracker.gemini.enabled = false;
  app.hands = tracker;
  return { app, pass, tracker };
}

function result(dx = 0) {
  const world = [{ x: 0, y: -0.06, z: 0 }];
  for (let f = 0; f < 5; f++) for (let j = 0; j < 4; j++) world.push({
    x: f === 0 ? -0.035 - j * 0.014 : (f - 2) * 0.021,
    y: f === 0 ? -0.03 + j * 0.012 : [0, 0.03, 0.055, 0.075][j], z: -j * 0.002,
  });
  const landmarks = world.map(p => ({ x: 0.5 + p.x * 2 + dx, y: 0.5 - p.y * 3, z: p.z }));
  return { landmarks: [landmarks], worldLandmarks: [world], handednesses: [[{ categoryName: 'Left', score: 0.99 }]] };
}

test('all 21 joints match camera pixels in BOTH eyes across fill, mirror, aspect and resize', () => {
  const oldWindow = globalThis.window, fill = CONFIG.PASSTHROUGH_FILL;
  globalThis.window = { addEventListener() {} };
  try {
    for (const fillMode of [true, false]) for (const mirror of [false, true]) {
      CONFIG.PASSTHROUGH_FILL = fillMode;
      const { app, pass, tracker } = fixture(0.75, mirror);
      const input = new Input(app), res = result();
      tracker._process(res, 1 / 30, 100);
      assert.equal(tracker.hands.length, 1);
      for (const aspect of [0.75, 1.4, 0.5]) {
        app.camera.aspect = aspect; app.camera.updateProjectionMatrix(); pass._fit();
        input.update(1 / 60); app.scene.updateMatrixWorld(true);
        const stereo = new StereoRenderer({ getSize: v => v.set(900, 600), clear() {}, setScissorTest() {},
          setScissor() {}, setViewport() {}, render(_scene, camera) { camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); }, autoClear: false });
        stereo.render(app.scene, app.camera, true);
        for (const eye of [stereo.stereo.cameraL, stereo.stereo.cameraR]) {
          for (let i = 0; i < 21; i++) {
            const p = res.landmarks[0][i];
            const cameraPixel = new THREE.Vector3(p.x - 0.5, 0.5 - p.y, 0).applyMatrix4(pass.mesh.matrixWorld).project(eye);
            const joint = input.hands[0].points[i].clone().project(eye);
            assert.ok(Math.hypot(cameraPixel.x - joint.x, cameraPixel.y - joint.y) < 1e-10,
              `joint ${i}, aspect ${aspect}, mirror ${mirror}, fill ${fillMode}`);
          }
        }
        stereo.render(app.scene, app.camera, false);
        assert.equal(stereo.stereo.eyeSep, 0.064);
      }
      tracker.stop();
    }
  } finally { globalThis.window = oldWindow; CONFIG.PASSTHROUGH_FILL = fill; }
});

test('fast hand movement immediately reaches observed pose instead of trailing filtered anatomy', () => {
  const oldWindow = globalThis.window; globalThis.window = { addEventListener() {} };
  try {
    const { app, tracker } = fixture(), input = new Input(app);
    tracker._process(result(), 1 / 30, 100); input.update(1 / 60);
    const before = input.hands[0].tip.clone();
    tracker._process(result(0.1), 1 / 30, 133); input.update(1 / 60);
    const observed = new THREE.Vector3(...tracker.hands[0].pontos[8]).applyMatrix4(app.camera.matrixWorld);
    assert.ok(input.hands[0].tip.distanceTo(observed) < 1e-10);
    assert.ok(input.hands[0].tip.distanceTo(before) > 0.03);
    assert.ok(input.pointers[0].ray.origin.distanceTo(observed) < 1e-10);
    tracker.stop();
  } finally { globalThis.window = oldWindow; }
});

test('worker transfers the same detected bitmap back without closing it first', async () => {
  const bitmap = { closed: false, close() { this.closed = true; } }, messages = [];
  const context = vm.createContext({ performance, self: { postMessage: (...args) => messages.push(args) } });
  vm.runInContext(readFileSync(new URL('../src/hands/handWorker.js', import.meta.url), 'utf8'), context);
  context.frame = bitmap;
  vm.runInContext('landmarker = { detectForVideo: (frame) => ({ landmarks: [], worldLandmarks: [], handednesses: [] }) }', context);
  await context.self.onmessage({ data: { type: 'frame', bitmap, t: 100 } });
  assert.equal(messages[0][0].bitmap, bitmap);
  assert.equal(messages[0][1][0], bitmap); assert.equal(bitmap.closed, false);
});

test('accepted frames are displayed after their pose; rejected and stopped frames are closed', () => {
  const tracker = new HandTracker(); tracker.running = true;
  const events = []; tracker._process = () => events.push('pose');
  tracker.onFrame = frame => events.push(frame ? 'image' : 'live');
  const bitmap = { close() { events.push('close'); } };
  tracker._onResult({ t: performance.now(), ms: 10, res: {}, bitmap });
  assert.deepEqual(events, ['pose', 'image', 'close']); events.length = 0;
  tracker._onResult({ t: performance.now() - 300, ms: 300, res: {}, bitmap });
  assert.deepEqual(events, ['pose', 'image', 'close']); events.length = 0;
  tracker._onResult({ t: performance.now() - 900, ms: 900, res: {}, bitmap });
  assert.deepEqual(events, ['close']); events.length = 0;
  tracker.stop(); tracker._onResult({ t: performance.now(), ms: 10, res: {}, bitmap });
  assert.deepEqual(events, ['live', 'close']);
});

test('main-thread fallback detects and displays one snapshot instead of live video', () => {
  const oldDocument = globalThis.document, events = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: video => events.push(['capture', video]) }) };
  globalThis.document = { createElement: () => canvas };
  try {
    const tracker = new HandTracker(); tracker.running = true; tracker.mode = 'main';
    tracker.video = { videoWidth: 960, videoHeight: 540, currentTime: 1, readyState: 2 };
    tracker.landmarker = { detectForVideo: source => { events.push(['detect', source]); return {}; }, close() {} };
    tracker._process = () => events.push(['pose']);
    tracker.onFrame = frame => events.push(['display', frame]);
    tracker.update(100);
    assert.deepEqual(events, [['capture', tracker.video], ['detect', canvas], ['pose'], ['display', canvas]]);
    assert.equal(canvas.width, 960); assert.equal(canvas.height, 540); tracker.stop();
  } finally { globalThis.document = oldDocument; }
});

test('estimated physical hand depth stays constant when passthrough magnification changes', () => {
  const original = CONFIG.PASSTHROUGH_FILL;
  try {
    const depths = [];
    for (const fill of [false, true]) {
      CONFIG.PASSTHROUGH_FILL = fill;
      const { tracker } = fixture(); tracker._process(result(), 1 / 30, 100);
      depths.push(tracker.hands[0].pontos[0][2]); tracker.stop();
    }
    assert.ok(Math.abs(depths[0] - depths[1]) < 1e-10);
  } finally { CONFIG.PASSTHROUGH_FILL = original; }
});
