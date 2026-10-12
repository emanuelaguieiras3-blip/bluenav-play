import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GAMES, loadGameModule } from '../src/games/index.js';
import { RHYTHM_TRACKS, presetChart } from '../src/games/rhythmChart.js';

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
const { createPhysicsKit } = await import('../src/games/physicsKit.js');

function fixture(count, source = 'hand') {
  const scene = new THREE.Scene(), root = new THREE.Group(), rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(); camera.position.y = 1.6;
  rig.add(camera); scene.add(root, rig);
  const audio = { t: 0, ctx: null, noiseLoop: () => null, oscLoop: () => null,
    noise() {}, tone() {}, thud() {}, metal() {}, success() {}, hover() {}, click() {}, keyTap() {}, setEcho() {} };
  const input = { keys: new Set(), pointers: [], source, handVel: new THREE.Vector3(),
    handPos: new THREE.Vector3(), ray: new THREE.Ray(), pinch: false, pinchDown: false, pinchUp: false };
  for (let i = 0; i < count; i++) {
    const points = Array.from({ length: 21 }, (_, j) => new THREE.Vector3((i ? -0.15 : 0.15) + (j % 4) * 0.006, 1.35 + j * 0.005, -0.4));
    input.pointers.push({ id: 'test' + i, side: i ? 'left' : 'right', source,
      hand: source === 'hand' ? { points, palm: points[0].clone(), dir: new THREE.Vector3(0, 1, 0), tip: points[8] } : null,
      quaternion: new THREE.Quaternion(),
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

for (const game of GAMES) for (const count of [1, 2]) for (const source of ['hand', 'xr']) {
  test(`${game.id}: lógica ${source} com ${count} ponteiro(s), 180 frames e pinça`, async () => {
    const f = fixture(count, source), module = await loadGameModule(game.id);
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

test('rotating the saber through a block cuts with contact speed even when its tip barely moves', async () => {
  const f = fixture(1), game = (await loadGameModule('rhythm')).default.create(f.ctx);
  const note = presetChart(RHYTHM_TRACKS[0], 'easy')[0], p = f.input.pointers[0];
  f.ctx.audio.ctx = { state: 'running' };
  try {
    game.setGrip('fingers'); game.choosePreset('neon', 'easy'); await game.start();
    p.hand.palm.set(note.x - 0.03, note.y, -0.48);
    p.hand.points[9].copy(p.hand.palm); p.hand.dir.set(0, 1, 0);
    f.ctx.audio.t = 3.48; game.update(0.02);
    p.hand.palm.x = note.x + 0.03; p.hand.points[9].copy(p.hand.palm);
    p.hand.dir.set(-0.06, Math.sqrt(0.85 ** 2 - 0.06 ** 2), 0).normalize();
    f.ctx.audio.t = 3.5; game.update(0.02);
    assert.equal(game.getState().hits, 1);
  } finally { f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('sandbox smashes a hard-thrown melon, counts the tower and clears spawned objects', async () => {
  const f = fixture(1), game = (await loadGameModule('sandbox')).default.create(f.ctx);
  try {
    assert.equal(game.tower.length, 8); assert.equal(game.getState().knocked, 0);
    const melon = game.spawn('melon', new THREE.Vector3(2, 2, 2));
    melon.velocity.set(0, -7, 0);
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    assert.equal(game.getState().smashed, 1); assert.equal(game.world.bodies.includes(melon), false);
    const gentle = game.spawn('melon', new THREE.Vector3(2, 0.6, 2));
    for (let i = 0; i < 60; i++) game.update(1 / 60);
    assert.equal(game.getState().smashed, 1); assert.ok(gentle.enabled);
    game.tower.forEach((b, i) => b.mesh.position.set(-1.6 + i * 0.4, 0.2, -3));
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    assert.equal(game.getState().knocked, 8);
    const count = game.world.bodies.length; game.spawn('crate'); assert.equal(game.world.bodies.length, count + 1);
  } finally { f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('sandbox mannequin falls with bounded joints and can be grabbed and restored', async () => {
  const f = fixture(1), game = (await loadGameModule('sandbox')).default.create(f.ctx);
  try {
    assert.equal(game.dummy.getState().standing, true);
    const body = game.dummy.bodies[0], ui = body.mesh.userData.ui;
    ui.drag.start(f.input.pointers[0]);
    assert.equal(game.dummy.getState().standing, false);
    assert.equal(body.holders.size, 1);
    ui.drag.end(f.input.pointers[0]);
    for (let i = 0; i < 240; i++) game.update(1 / 120);
    for (const joint of game.world.joints) {
      assert.ok(Math.abs(joint.a.mesh.position.distanceTo(joint.b.mesh.position) - joint.distance) < 0.08);
      assert.ok(joint.a.mesh.position.toArray().every(Number.isFinite));
    }
    assert.ok(game.dummy.bodies.some(b => b.mesh.position.y < b.origin.y - 0.3));
    game.dummy.reset(); assert.equal(game.dummy.getState().standing, true);
  } finally { game.dispose(); f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('tag round captures by actual hand contact, stops at three bots and restarts', async () => {
  const f = fixture(1), game = (await loadGameModule('jungle')).default.create(f.ctx), round = game.round;
  try {
    round.start('catch');
    for (let i = 0; i < 130; i++) round.update(1 / 60);
    assert.equal(round.getState().captures, 0);
    for (const bot of round.bots) {
      f.input.pointers[0].hand.palm.copy(bot.mesh.position).add(new THREE.Vector3(0, 0.85, 0));
      round.update(1 / 60); round.update(1 / 60);
    }
    assert.equal(round.getState().captures, 3); assert.equal(round.getState().state, 'finished');
    const time = round.getState().time; round.update(1); assert.equal(round.getState().time, time);
    round.start('run'); assert.equal(round.getState().captures, 0); assert.equal(round.getState().remaining, 3);
    for (let i = 0; i < 100; i++) round.update(1 / 60);
    assert.ok(round.bots.every(b => Math.hypot(b.mesh.position.x, b.mesh.position.z) < 28));
  } finally { game.dispose(); f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('elastic saber preserves blade length, bends on a swing and resets without phantom motion', async () => {
  const { FlexibleBlade } = await import('../src/games/flexibleBlade.js');
  const blade = new FlexibleBlade(), base = new THREE.Vector3(), q = new THREE.Quaternion();
  try {
    blade.update(base, q, 1, 1 / 60, true);
    base.x = 0.1; blade.update(base, q, 1, 1 / 60);
    for (let i = 0; i < 9; i++) { base.x += 0.03; blade.update(base, q, 1, 1 / 60); }
    assert.ok(Math.abs(blade.local.at(-1).x) > 0.01);
    let length = 0; for (let i = 1; i < blade.local.length; i++) length += blade.local[i].distanceTo(blade.local[i - 1]);
    assert.ok(Math.abs(length - 0.85) < 1e-6);
    assert.ok(blade.bend.length() <= 0.16);
    for (let i = 0; i < 120; i++) blade.update(base, q, 1, 1 / 60);
    assert.ok(blade.bend.length() < 0.001);
    base.x += 10; blade.update(base, q, 1, 1 / 60, true);
    assert.ok(blade.world.every((point, i) => point.distanceTo(blade.previous[i]) === 0));
  } finally { blade.geometry.dispose(); }
});

test('jobs requires preparation before delivery, completes orders and resets', async () => {
  const f = fixture(1), game = (await loadGameModule('jobs')).default.create(f.ctx);
  try {
    const first = game.world.bodies[0];
    first.mesh.position.set(-0.65, 0.94, -1.27); first.velocity.set(0, 0, 0);
    for (let j = 0; j < 100; j++) game.update(1 / 120);
    assert.equal(game.getState().delivered, 0);
    assert.equal(game.getState().mistakes, 1);
    game.operate(0); assert.equal(game.getState().prepared, 0);
    first.mesh.position.set(0, 0.94, -0.52); first.velocity.set(0, 0, 0);
    for (let j = 0; j < 100; j++) game.update(1 / 120);
    game.operate(1); assert.equal(game.getState().mistakes, 2);
    for (let i = 0; i < 9; i++) {
      const body = game.world.bodies[i], kind = i % 3;
      body.mesh.position.set(-0.65 + kind * 0.65, 0.94, -0.52); body.velocity.set(0, 0, 0);
      for (let j = 0; j < 100; j++) game.update(1 / 120);
      assert.equal(game.getState().prepared, i);
      game.operate(kind);
      assert.equal(game.getState().prepared, i + 1);
      body.mesh.position.set(-0.65 + kind * 0.65, 0.94, -1.27); body.velocity.set(0, 0, 0);
      for (let j = 0; j < 100; j++) game.update(1 / 120);
    }
    assert.equal(game.getState().delivered, 9); assert.equal(game.getState().mistakes, 2);
    game.reset(); assert.equal(game.getState().delivered, 0); assert.equal(game.getState().prepared, 0);
    assert.ok(game.world.bodies.every(b => b.enabled && b.mesh.visible));
  } finally { f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('tactical consumes ammunition, supports timed reload and bounds projectiles', async () => {
  const f = fixture(1), game = (await loadGameModule('tactical')).default.create(f.ctx);
  f.ctx.camera.position.x = 100;
  try {
    for (let i = 0; i < 13; i++) { f.input.pointers[0].pinchDown = true; game.update(0.2, i * 0.2); }
    assert.equal(game.getState().ammo, 0); assert.ok(game.getState().bullets <= 24);
    f.input.pointers[0].pinchDown = false; f.input.keys.add('KeyR'); game.update(0.05, 3);
    f.input.keys.clear(); assert.equal(game.getState().reloading, true);
    for (let i = 0; i < 31; i++) game.update(0.05, 3 + i * 0.05);
    assert.equal(game.getState().ammo, 12); assert.equal(game.getState().reloading, false);
  } finally { f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('arena does not damage player beyond actual sword reach', async () => {
  const f = fixture(1), game = (await loadGameModule('arena')).default.create(f.ctx);
  f.ctx.camera.position.set(0, 1.6, 30);
  try { for (let i = 0; i < 900; i++) game.update(1 / 60, i / 60); assert.equal(game.getState().health, 10); }
  finally { f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('arena does not grant controller damage without blade contact', async () => {
  const f = fixture(1, 'xr'), game = (await loadGameModule('arena')).default.create(f.ctx);
  f.ctx.camera.position.set(0, 1.6, -1.5);
  f.input.pointers[0].handPos.set(5, 1.2, -5);
  f.input.pointers[0].pinchDown = true;
  try { for (let i = 0; i < 20; i++) game.update(1 / 60, i / 60); assert.equal(game.getState().enemyHealth, 10); }
  finally { f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('physics kit works in every game and can be hidden without held objects', async () => {
  for (const entry of GAMES) {
    const f = fixture(1), game = (await loadGameModule(entry.id)).default.create(f.ctx), kit = createPhysicsKit(f.ctx);
    try {
      for (let i = 0; i < 60; i++) kit.update(1 / 60);
      assert.equal(kit.world.bodies.length, 3); assert.ok(kit.world.bodies.every(b => b.mesh.position.toArray().every(Number.isFinite)));
      kit.world.bodies[0].held = 'test'; kit.toggle(); assert.equal(kit.group.visible, false); assert.equal(kit.world.bodies[0].held, null);
      kit.toggle(); assert.equal(kit.group.visible, true);
    } finally { game.dispose?.(); f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
  }
});

test('card table never runs out of cards and a shuffle cancels a pending result', async () => {
  const f = fixture(1), game = (await loadGameModule('tablegames')).default.create(f.ctx);
  try {
    for (let i = 0; i < 60; i++) { game.play(); for (let j = 0; j < 80; j++) game.update(1 / 60); }
    const s = game.getState(); assert.ok(s.deck > 0); assert.ok(s.wins + s.losses > 0);
    game.play(); game.shuffle(); const before = game.getState();
    for (let j = 0; j < 90; j++) game.update(1 / 60);
    assert.equal(game.getState().wins + game.getState().losses, before.wins + before.losses);
  } finally { f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('pinching a grabbable that touches the fingertip starts a grab instead of a poke', () => {
  const f = fixture(1), p = f.input.pointers[0];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial());
  mesh.position.set(0, 1.4, -0.55); f.app.root.add(mesh); f.app.scene.updateMatrixWorld(true);
  let started = 0;
  f.ctx.addUI(mesh, { drag: { start() { started++; }, move() {}, end() {} } });
  p.pokeTip = new THREE.Vector3(0, 1.4, -0.43); p.ray.set(p.pokeTip.clone(), new THREE.Vector3(0, 0, -1));
  p.pinch = p.pinchDown = true;
  f.app.ui.update(1 / 60, f.input);
  assert.equal(started, 1);
  disposeTree(f.app.root); f.texture.dispose();
});

test('race starts after the lights, rivals drive the lap and the player car knocks cones', async () => {
  const f = fixture(1, 'xr'), game = (await loadGameModule('racing')).default.create(f.ctx);
  try {
    for (let i = 0; i < 60 * 3; i++) game.update(1 / 60, i / 60);
    assert.equal(game.getState().state, 'grid'); assert.equal(game.player.v, 0);
    let wide = 0;
    for (let i = 0; i < 60 * 40; i++) { game.update(1 / 60, i / 60); for (const r of game.rivals) if (Math.abs(r.lat) > 6.1) wide++; }
    assert.equal(game.getState().state, 'racing');
    for (const r of game.rivals) assert.ok(r.lap * 1000 + r.s > 500, `${r.name} progress ${r.s} lap ${r.lap}`);
    assert.ok(wide < 60 * 40 * 3 * 0.1, `rivals off track ${wide}`);
    if (process.env.RACE_DEBUG) console.log(game.rivals.map(r => [r.name, r.lap, r.s.toFixed(0), r.v.toFixed(1), r.lat.toFixed(2)]), wide);
    // Drive the player straight into the first cone row.
    const cone = game.cones.bodies[0], start = cone.mesh.position.clone();
    game.cones.setHands([{ id: 'car', position: start.clone().add(new THREE.Vector3(0, 0.1, 0.5)), velocity: new THREE.Vector3(0, 0, -20), radius: 1.1 }]);
    game.cones.update(1 / 60); game.cones.setHands([]);
    for (let i = 0; i < 30; i++) game.cones.update(1 / 60);
    assert.ok(cone.mesh.position.distanceTo(start) > 0.5);
  } finally { f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('complex: grab pistol, fire until empty, insert a hip magazine, rack the slide, knock an enemy down', async () => {
  const f = fixture(2), mod = await loadGameModule('complex'), game = mod.default.create(f.ctx);
  const [right, left] = f.input.pointers;
  const press = (p, on) => { p.pinchDown = on && !p.pinch; p.pinchUp = !on && p.pinch; p.pinch = on; p.gesture = on ? 'pinça' : 'indefinida'; };
  const frame = (n = 1) => { for (let i = 0; i < n; i++) { f.app.scene.updateMatrixWorld(true); right.uiBusy = left.uiBusy = false; game.update(1 / 60); press(right, right.pinch); press(left, left.pinch); } };
  const moveHand = (p, at) => { const d = at.clone().sub(p.hand.palm); p.hand.points.forEach(v => v.add(d)); p.hand.palm.add(d); p.handPos.add(d); };
  try {
    for (const p of [right, left]) moveHand(p, new THREE.Vector3(p === right ? 2 : -2, 1.2, -1.5));
    frame(30);
    // Pinch at the pistol: it stays in the hand after the pinch ends.
    moveHand(right, game.gun.body.mesh.position.clone()); press(right, true); frame(); press(right, false); frame(3);
    assert.equal(game.getState().holding, true);
    let fired = 0;
    for (let i = 0; i < 14; i++) { press(right, true); frame(); press(right, false); frame(); fired++; }
    assert.equal(game.getState().ammo, 0); assert.equal(game.getState().chambered, false);
    frame(30); assert.equal(game.getState().magIn, false, 'empty magazine dropped');
    // Hip pouch: pinch beside the hip, bring the magazine to the grip.
    const eye = f.ctx.eye(); moveHand(left, eye.clone().add(new THREE.Vector3(-0.2, -0.62, 0.05))); press(left, true); frame();
    for (let i = 0; i < 40 && !game.getState().magIn; i++) { game.gun.body.mesh.updateMatrixWorld(true); const well = new THREE.Vector3(0, -0.12, 0.06).applyMatrix4(game.gun.body.mesh.matrixWorld); moveHand(left, well.lerp(left.hand.palm, 0.5)); frame(); }
    assert.equal(game.getState().magIn, true, 'magazine inserted');
    press(left, false); frame();
    // Rack: pinch the rear of the slide with the free hand and pull back.
    game.gun.body.mesh.updateMatrixWorld(true);
    const rear = new THREE.Vector3(0, 0.036, 0.08).applyMatrix4(game.gun.body.mesh.matrixWorld), back = new THREE.Vector3(0, 0, 1).transformDirection(game.gun.body.mesh.matrixWorld);
    moveHand(left, rear); press(left, true); frame();
    for (let i = 0; i < 6; i++) { moveHand(left, left.hand.palm.clone().addScaledVector(back, 0.012)); frame(); }
    assert.equal(game.getState().chambered, true, 'slide racked');
    press(left, false); frame();
    // Enemy: damage turns the puppet into a ragdoll that falls.
    const e = game.enemies[0], torso = e.parts[0], y0 = torso.mesh.position.y;
    game.damage(e, 40, torso, new THREE.Vector3(0, 0, -4)); assert.equal(e.state, 'ragdoll');
    frame(90); assert.ok(torso.mesh.position.y < y0 - 0.2, 'ragdoll falls');
    for (const j of game.world.joints) assert.ok(Math.abs(j.a.mesh.position.distanceTo(j.b.mesh.position) - j.distance) < 0.1);
    game.damage(e, 200, torso, new THREE.Vector3()); assert.equal(e.state, 'dead');
    assert.ok(fired > 0);
  } finally { game.dispose(); f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('complex: sandbox opens the level, creates bounded objects, and restores campaign', async () => {
  const f = fixture(1), game = (await loadGameModule('complex')).default.create(f.ctx);
  try {
    game.setSandbox(true);
    assert.equal(game.getState().sandboxMode, true);
    assert.deepEqual(game.getState().doors, [true, true]);
    for (let i = 0; i < 16; i++) game.spawnSandbox(i % 2 ? 'esfera' : 'barril');
    assert.equal(game.getState().sandboxObjects, 12);
    game.setSandbox(false);
    assert.equal(game.getState().sandboxMode, false);
    assert.equal(game.getState().sandboxObjects, 0);
    assert.deepEqual(game.getState().doors, [false, false]);
  } finally { game.dispose(); f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('complex: 8 kg on the plate opens the upper door and the player steps onto crates', async () => {
  const f = fixture(1), game = (await loadGameModule('complex')).default.create(f.ctx);
  const { supportHeight } = await import('../src/games/complex.js');
  try {
    const crates = game.items.filter(b => b.kind === 'crate' && b.mass < 5).slice(0, 2);
    crates.forEach((c, i) => { c.mesh.position.set(-0.4 + i * 0.8, 0.3, -14.8); c.velocity.set(0, 0, 0); });
    for (let i = 0; i < 60; i++) game.update(1 / 60);
    assert.ok(game.getState().plateMass >= 8, `plate ${game.getState().plateMass}`);
    assert.equal(game.getState().doors[1], true);
    const crate = new THREE.Box3(new THREE.Vector3(-0.25, 0, -0.25), new THREE.Vector3(0.25, 0.5, 0.25));
    assert.equal(supportHeight(0, 0, 0, [crate]), 0.5, 'step onto one crate');
    const tall = new THREE.Box3(new THREE.Vector3(-0.25, 0, -0.25), new THREE.Vector3(0.25, 1.3, 0.25));
    assert.equal(supportHeight(0, 0, 0, [tall]), 0, 'the ledge is too high to step');
    assert.equal(supportHeight(0, 0, 1.0, [tall]), 1.3);
  } finally { game.dispose(); f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('every game with loose props gets physical objects that settle, collide with furniture, are grabbed and knocked', async () => {
  const { createSceneProps, SCENE_PROPS } = await import('../src/games/sceneProps.js');
  for (const id of Object.keys(SCENE_PROPS)) {
    const f = fixture(1), game = (await loadGameModule(id)).default.create(f.ctx);
    try {
      f.app.scene.updateMatrixWorld(true);
      const props = createSceneProps(f.ctx, id);
      assert.ok(props.bodies.length >= 3, `${id}: ${props.bodies.length} props`);
      for (let i = 0; i < 120; i++) props.update(1 / 60);
      for (const b of props.bodies) {
        assert.ok(b.mesh.position.toArray().every(Number.isFinite), `${id}: finite`);
        assert.ok(b.mesh.position.y >= b.half.y * 0.5 - 0.02, `${id}: ${b.kind} above floor`);
        assert.ok(!props.world.statics.some(s => s.containsPoint(b.mesh.position)), `${id}: ${b.kind} not inside furniture`);
      }
      // Near pinch picks a prop up; letting go drops it.
      const p = f.input.pointers[0], target = [...props.bodies].sort((a, b) => a.mass - b.mass)[0], d = target.mesh.position.clone().sub(p.handPos);
      p.hand.points.forEach(v => v.add(d)); p.hand.palm.add(d); p.handPos.add(d);
      p.pinch = true; p.pinchDown = true; props.update(1 / 60); p.pinchDown = false;
      assert.equal(props.getState().held, 1, `${id}: grabbed`);
      for (const v of [...p.hand.points, p.hand.palm, p.handPos]) v.y += 0.3;
      for (let i = 0; i < 20; i++) props.update(1 / 60);
      assert.ok(target.mesh.position.y > target.origin.y + 0.15, `${id}: lifted`);
      p.pinch = false; props.update(1 / 60); assert.equal(props.getState().held, 0);
      // A projectile through a prop pushes it.
      const other = props.bodies[props.bodies.length - 1], before = other.velocity.length();
      const hit = props.impact(other.mesh.position.clone().add(new THREE.Vector3(0, 0, 2)), other.mesh.position.clone().add(new THREE.Vector3(0, 0, -2)), new THREE.Vector3(0, 0, -30));
      assert.ok(hit && other.velocity.length() > before, `${id}: impact`);
      props.dispose();
    } finally { game.dispose?.(); f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
  }
});

test('boxes are rounded with the same size and voxel games keep cubes', async () => {
  const { roundBoxes, roundedFromBox, CUBIC_GAMES } = await import('../src/games/roundGeometry.js');
  const group = new THREE.Group(), box = new THREE.BoxGeometry(2, 0.5, 1).translate(1, 2, 3);
  const mesh = new THREE.Mesh(box), turned = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).rotateY(0.5)); group.add(mesh, turned);
  assert.equal(roundBoxes(group), 1);
  mesh.geometry.computeBoundingBox(); const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3()), center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
  assert.ok(size.distanceTo(new THREE.Vector3(2, 0.5, 1)) < 1e-4 && center.distanceTo(new THREE.Vector3(1, 2, 3)) < 1e-4);
  assert.ok(mesh.geometry.attributes.position.count > 24, 'more vertices on the bevels');
  assert.equal(turned.geometry.type, 'BoxGeometry'); assert.equal(roundedFromBox(mesh.geometry), null, 'never rounded twice');
  assert.ok(CUBIC_GAMES.has('blocks'));
});

test('plaza: dorm wardrobe, then a race, paintball, parkour and hangout map all run and pay tokens', async () => {
  const store = new Map(); globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const { generateMap, MAP_COUNT } = await import('../src/games/plaza/maps.js');
  const f = fixture(2), game = (await loadGameModule('plaza')).default.create(f.ctx);
  const run = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { f.app.scene.updateMatrixWorld(true); game.update(dt, i * dt); } };
  const first = mode => { for (let i = 0; i < MAP_COUNT; i++) if (generateMap(i).mode.id === mode) return i; };
  const finite = () => f.app.scene.traverse(o => assert.ok([...o.position.toArray(), ...o.quaternion.toArray()].every(Number.isFinite), `${o.name || o.type} finite`));
  try {
    assert.equal(game.getState().kind, 'dorm'); run(30); finite();
    assert.equal(game.wardrobe.choose('paint', 2).ok, true);
    // Race: lights, then everyone drives; bots make real progress.
    game.enterMap(first('corrida')); run(30 * 25);
    const race = game.scene.state; assert.equal(race.phase, 'race');
    assert.ok(game.scene.bots.some(b => b.car.ring > 2), `bots ${game.scene.bots.map(b => b.car.ring)}`); finite();
    // Paintball: bots shoot each other; the score moves.
    game.enterMap(first('paintball')); for (let k = 0; k < 12 && game.scene.state.score[0] + game.scene.state.score[1] === 0; k++) run(30 * 10);
    const pb = game.scene.state; if (process.env.PB_DEBUG) console.log('PB', JSON.stringify(game.scene.entities.map(e => [e.name, e.state, e.alive, e.ammo, e.reloading, e.seen, e.mesh && e.mesh.position.toArray().map(v => +v.toFixed(1)), e.goal && e.goal.toArray().map(v => +v.toFixed(1))]))); assert.ok(pb.score[0] + pb.score[1] > 0, `score ${pb.score}`); finite();
    // Parkour: falling respawns at the checkpoint; reaching the flag pays.
    const pk = first('parkour'); game.enterMap(pk); f.ctx.rig.position.y = -20; run(2);
    assert.equal(game.scene.state.falls, 1);
    const tokens = game.wardrobe.tokens, [fx, fy, fz] = generateMap(pk).finish;
    f.ctx.rig.position.set(fx, fy, fz); run(2);
    assert.equal(game.scene.state.finished, true); assert.ok(game.wardrobe.tokens > tokens);
    // Hangout: enter the car and drive.
    game.enterMap(first('encontro')); run(10);
    game.scene.toggleDrive(); assert.equal(game.scene.state.driving, true);
    f.input.keys.add('KeyW'); const start = game.scene.car.z; run(60); f.input.keys.clear();
    assert.ok(Math.hypot(game.scene.car.x - generateMap(first('encontro')).car[0], game.scene.car.z - start) > 3, 'car moved');
    game.scene.toggleDrive(); assert.equal(game.scene.state.driving, false); finite();
    game.enterDorm(); assert.equal(game.getState().kind, 'dorm');
  } finally { game.dispose(); f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('plaza: a wide sample of the 500 maps loads and runs without invalid transforms', async () => {
  const f = fixture(1), game = (await loadGameModule('plaza')).default.create(f.ctx);
  try {
    for (let index = 0; index < 500; index += 7) {
      game.enterMap(index);
      for (let i = 0; i < 20; i++) { f.app.scene.updateMatrixWorld(true); game.update(1 / 30, i / 30); }
      assert.ok(f.ctx.rig.position.toArray().every(Number.isFinite), `map ${index}`);
      f.app.root.traverse(o => { if (o.isInstancedMesh) assert.ok(o.count > 0 && Number.isFinite(o.boundingSphere?.radius), `map ${index} instancing`); });
    }
  } finally { game.dispose(); f.disposers.forEach(fn => fn()); disposeTree(f.app.root); f.texture.dispose(); }
});

test('shared cached geometries survive a scene teardown', () => {
  const g = new THREE.BoxGeometry(); g.userData.shared = true; let disposed = false; g.addEventListener('dispose', () => { disposed = true; });
  const group = new THREE.Group(); group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial()));
  disposeTree(group); assert.equal(disposed, false);
});
