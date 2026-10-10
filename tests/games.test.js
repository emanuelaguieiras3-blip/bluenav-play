import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GAMES, loadGameModule } from '../src/games/index.js';

// Smoke test de lógica/geometria. Canvas e áudio são dublês; não mede WebGL/FPS.
globalThis.window = { requestIdleCallback() {}, addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false });
globalThis.screen = { width: 1920, height: 1080 };
globalThis.Path2D = class {};
globalThis.document = { createElement: () => {
  const canvas = { width: 0, height: 0 };
  const context = new Proxy({ canvas, measureText: (t) => ({ width: String(t).length * 8 }),
    createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }) },
  { get: (o, k) => k in o ? o[k] : () => {} });
  canvas.getContext = () => context; return canvas;
} };
const { UI } = await import('../src/ui/ui.js');
const { makeButton, makeLabel } = await import('../src/ui/widgets.js');
const { disposeTree } = await import('../src/core/util.js');
const { createGameGraphics, GRAPHICS_THEMES } = await import('../src/games/graphics.js');

function fixture(count) {
  const scene = new THREE.Scene(), root = new THREE.Group(), rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(); camera.position.y = 1.6;
  rig.add(camera); scene.add(root, rig);
  const audio = { t: 0, ctx: null, noiseLoop: () => null, oscLoop: () => null,
    noise() {}, tone() {}, thud() {}, metal() {}, success() {}, hover() {}, click() {}, keyTap() {}, setEcho() {} };
  const input = { keys: new Set(), pointers: [], source: 'hand', handVel: new THREE.Vector3(),
    handPos: new THREE.Vector3(), ray: new THREE.Ray(), pinch: false, pinchDown: false, pinchUp: false };
  for (let i = 0; i < count; i++) {
    const points = Array.from({ length: 21 }, (_, j) => new THREE.Vector3((i ? -0.15 : 0.15) + (j % 4) * 0.006, 1.35 + j * 0.005, -0.4));
    input.pointers.push({ id: 'test' + i, side: i ? 'left' : 'right', source: 'hand',
      hand: { points, palm: points[0].clone(), dir: new THREE.Vector3(0, 1, 0), tip: points[8] },
      handPos: points[8].clone(), handVel: new THREE.Vector3(), vel: new THREE.Vector3(),
      ray: new THREE.Ray(points[8].clone(), new THREE.Vector3(0, 0, -1)), origin: points[8].clone(),
      gesture: 'aberta', pinch: false, pinchDown: false, pinchUp: false, keys: input.keys });
  }
  const app = { scene, root, rig, camera, input, audio, pointerHit: null, mode: 'flat', headYaw: () => 0,
    renderer: { xr: { isPresenting: false }, domElement: { addEventListener() {} } },
    teleport: { go() {}, configure() {} } };
  app.ui = new UI(app);
  const disposers = [], texture = new THREE.Texture(); texture.userData.shared = true;
  const ctx = { THREE, app, scene, root, rig, camera, input, audio,
    tex: { get: () => texture }, env: { sun: new THREE.DirectionalLight(), hemi: new THREE.HemisphereLight(),
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } }, set(opts) {
      scene.fog = opts.fog ? new THREE.Fog(opts.fog.color, opts.fog.near, opts.fog.far) : null;
    } }, lowEnd: true, mobile: true,
    button: (opts) => makeButton(app, opts), label: makeLabel,
    addUI: (mesh, opts) => app.ui.add(mesh, opts), pointers: () => input.pointers.filter((p) => !p.stale && !p.uiBusy),
    eye: () => camera.getWorldPosition(new THREE.Vector3()), forward: () => new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorld),
    hud() {}, hudPose() {}, lookDown() {}, teleport() {}, setPointerHit: (p) => { app.pointerHit = p; },
    uiBusy: (p) => p ? !!p.uiBusy : app.ui.hovering, onDispose: (fn) => disposers.push(fn) };
  return { ctx, input, app, disposers, texture };
}

for (const game of GAMES) for (const count of [1, 2]) {
  test(`${game.id}: lógica com ${count} mão(s), 180 frames e pinça`, async () => {
    const f = fixture(count), module = await loadGameModule(game.id);
    const instance = module.default.create(f.ctx);
    const graphics = createGameGraphics(f.ctx, game.id);
    try {
      for (let frame = 0; frame < 180; frame++) {
        f.app.scene.updateMatrixWorld(true);
        for (const p of f.input.pointers) {
          const pinch = frame % 60 >= 20 && frame % 60 < 40;
          p.pinchDown = pinch && !p.pinch; p.pinchUp = !pinch && p.pinch; p.pinch = pinch;
          p.gesture = pinch ? 'pinça' : 'aberta';
          p.handVel.set(Math.cos(frame * 0.05) * 0.1, Math.sin(frame * 0.05) * 0.1, 0);
          p.handPos.addScaledVector(p.handVel, 1 / 60);
        }
        Object.assign(f.input, Object.fromEntries(['handPos', 'handVel', 'ray', 'pinch', 'pinchDown', 'pinchUp', 'gesture'].map((k) => [k, f.input.pointers[0][k]])));
        instance.update?.(1 / 60, frame / 60, f.input);
        graphics.update(1 / 60);
      }
      f.app.scene.traverse((o) => {
        assert.ok([...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()].every(Number.isFinite), `${game.id}: transformação inválida`);
      });
      assert.ok(GRAPHICS_THEMES[game.id].features.length >= 3);
      assert.ok(graphics.summary.calls > 0 && graphics.summary.calls <= 24, `${game.id}: bounded decoration draw calls`);
      assert.equal(graphics.group.userData.decorative, true);
    } finally {
      instance.dispose?.(); f.disposers.forEach((fn) => fn()); disposeTree(f.app.root); f.texture.dispose();
    }
  });
}

test('placares reutilizam textura e canvas entre atualizações', () => {
  const label = makeLabel('Primeiro');
  const texture = label.material.map, canvas = texture.image;
  label.userData.set('Segundo'); label.userData.set('Terceiro');
  assert.equal(label.material.map, texture); assert.equal(texture.image, canvas);
  disposeTree(label);
});

test('saber game pauses its music clock and keeps block resources bounded', async () => {
  const f = fixture(2), module = await loadGameModule('rhythm');
  f.ctx.audio.ctx = { state: 'running' };
  const game = module.default.create(f.ctx);
  try {
    game.choosePreset('drive', 'easy'); await game.start();
    for (let i = 0; i < 600; i++) { f.ctx.audio.t += 1 / 60; game.update(1 / 60); }
    const before = game.getState();
    assert.equal(before.state, 'playing'); assert.ok(before.activeBlocks <= 36); assert.ok(before.misses > 0);
    game.setPaused(true);
    const frozen = game.getState(); f.ctx.audio.t += 20; game.update(1 / 60);
    assert.equal(game.getState().time, frozen.time); assert.equal(game.getState().misses, frozen.misses);
    game.setPaused(false); game.update(1 / 60);
    assert.ok(Math.abs(game.getState().time - frozen.time) < 0.001);
    game.choosePreset('aurora'); assert.equal(game.getState().state, 'ready');
    await game.start(); assert.equal(game.getState().score, 0); assert.equal(game.getState().misses, 0);
  } finally { f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});
