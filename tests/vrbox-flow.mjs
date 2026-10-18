import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 900, height: 600 }, isMobile: true, hasTouch: true });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  const relative = route.request().url().split('/three@0.160.0/')[1];
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', relative)), contentType: 'text/javascript' });
});
await context.addInitScript(() => {
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const original = prototype.getExtension;
    prototype.getExtension = function(name) { return name === 'KHR_parallel_shader_compile' ? null : original.call(this, name); };
  }
});
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:8080/');
  await page.locator('#chk-hands').uncheck(); await page.locator('#chk-gemini').uncheck();
  await page.locator('#btn-rhythm').click();
  try { await page.waitForFunction(() => window.__app?.gameId === 'rhythm' && window.__app?.game?.getState && window.__app.musicPickerOpen); }
  catch (error) {
    console.error('Ritmo não carregou:', await page.evaluate(() => ({ gameId: window.__app?.gameId, loading: window.__app?.loading, pickerOpen: window.__app?.musicPickerOpen, gameReady: !!window.__app?.game })), errors.map(value => value.slice(0, 160)));
    throw error;
  }
  const sampleRate = 8000, samples = sampleRate * 6, wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * .2) * 16000), 44 + i * 2);
  await page.locator('[data-difficulty]').selectOption('expert');
  await page.locator('[data-offset]').evaluate(el => { el.value = '80'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  const map = { _notes: [
    { _time: 1, _lineIndex: 0, _lineLayer: 0, _type: 0, _cutDirection: 0 },
    { _time: 2, _lineIndex: 3, _lineLayer: 1, _type: 1, _cutDirection: 8 },
  ], _obstacles: [{ _time: 3, _lineIndex: 1, _width: 2, _type: 1, _duration: 2 }] };
  await page.locator('[data-map]').setInputFiles({ name: 'Expert.dat', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(map)) });
  await page.getByRole('status').filter({ hasText: 'Mapa Expert.dat pronto' }).waitFor();
  await page.locator('[data-bpm]').fill('120');
  await page.locator('[data-file]').setInputFiles({ name: 'teste-local.wav', mimeType: 'audio/wav', buffer: wav });
  try { await page.waitForFunction(() => window.__app?.game?.getState?.().track === 'teste-local.wav' && !window.__app.musicPickerOpen); }
  catch (error) {
    console.error('Áudio local não carregou:', await page.evaluate(() => ({ status: document.querySelector('[data-status]')?.textContent, gameId: window.__app?.gameId, loading: window.__app?.loading, pickerOpen: window.__app?.musicPickerOpen, track: window.__app?.game?.getState?.().track })), errors.map(value => value.slice(0, 160)));
    throw error;
  }
  assert.equal((await page.evaluate(() => window.__app.game.getState())).notes, 2);
  assert.equal((await page.evaluate(() => window.__app.game.getState())).offsetMs, 80);
  await mkdir('artifacts/vrbox', { recursive: true });
  await page.screenshot({ path: 'artifacts/vrbox/rhythm-map.png' });
  await page.evaluate(() => window.__app.game.start());
  await page.waitForFunction(() => window.__app.game.getState().state === 'playing');
  await page.waitForFunction(() => window.__app.game.getState().time > 2.1);
  const wallShape = await page.evaluate(() => {
    let shape = null;
    window.__app.root.traverse(o => { if (o.isMesh && o.visible && o.material?.wireframe && o.scale.z > 10) shape = { heightScale: o.scale.y, centerY: o.position.y }; });
    return shape;
  });
  assert.ok(wallShape && Math.abs(wallShape.heightScale - 0.6) < 0.01 && Math.abs(wallShape.centerY - 1.54) < 0.01,
    'crouch wall keeps imported height and duration');
  assert.equal((await page.evaluate(() => window.__app.game.getState())).energy, 84,
    'gaze-only VR Box does not take unavoidable wall damage');
  assert.equal(await page.evaluate(() => window.__app.hud.guide.visible), false, 'tutorial clears the note lane after countdown');
  await page.screenshot({ path: 'artifacts/vrbox/rhythm-wall.png' });
  const handWallDamage = await page.evaluate(() => {
    const app = window.__app, Vector3 = app.ctx.THREE.Vector3, original = app.ctx.pointers;
    const palm = new Vector3(0, 1.3, -0.4), points = Array.from({ length: 21 }, () => palm.clone());
    points[9].y = 1.4;
    app.ctx.pointers = () => [{ id: 'wall-hand', source: 'hand', side: 'right',
      hand: { palm, points, dir: new Vector3(0, 1, 0) } }];
    const before = app.game.getState().energy;
    try { app.game.update(1 / 60); } finally { app.ctx.pointers = original; }
    return before - app.game.getState().energy;
  });
  assert.equal(handWallDamage, 15, 'tracked hand still collides with the wall');
  await page.evaluate(() => window.__app.game.chooseMusic());
  await page.locator('[data-bpm]').fill('');
  const v3Map = { colorNotes: [
    { b: 1, x: 0, y: 0, c: 0, d: 0 }, { b: 3, x: 3, y: 1, c: 1, d: 1 },
  ], bpmEvents: [{ b: 0, m: 120 }, { b: 2, m: 60 }] };
  await page.locator('[data-map]').setInputFiles({ name: 'Normal-v3.dat', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v3Map)) });
  await page.getByRole('status').filter({ hasText: 'Mapa Normal-v3.dat pronto' }).waitFor();
  await page.locator('[data-file]').setInputFiles({ name: 'teste-v3.wav', mimeType: 'audio/wav', buffer: wav });
  await page.waitForFunction(() => window.__app?.game?.getState?.().track === 'teste-v3.wav' && !window.__app.musicPickerOpen);
  assert.equal((await page.evaluate(() => window.__app.game.getState())).notes, 2);
  await page.evaluate(() => window.__app.game.start());
  await page.waitForFunction(() => window.__app.game.getState().state === 'playing');
  await page.evaluate(() => window.__app.game.chooseMusic());
  await page.locator('[data-bpm]').fill('120');
  const v4Map = { version: '4.0.0', colorNotes: [{ b: 1, i: 0 }, { b: 2, i: 1 }],
    colorNotesData: [{ x: 0, y: 0, c: 0, d: 0 }, { x: 3, y: 1, c: 1, d: 1 }],
    bombNotes: [{ b: 2.5, i: 0 }], bombNotesData: [{ x: 1, y: 1 }],
    obstacles: [{ b: 3, i: 0 }], obstaclesData: [{ x: 1, y: 2, w: 2, h: 3, d: 1 }] };
  await page.locator('[data-map]').setInputFiles({ name: 'Normal-v4.dat', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v4Map)) });
  await page.getByRole('status').filter({ hasText: 'Mapa Normal-v4.dat pronto' }).waitFor();
  await page.locator('[data-file]').setInputFiles({ name: 'teste-v4.wav', mimeType: 'audio/wav', buffer: wav });
  await page.waitForFunction(() => window.__app?.game?.getState?.().track === 'teste-v4.wav' && !window.__app.musicPickerOpen);
  assert.equal((await page.evaluate(() => window.__app.game.getState())).notes, 2);
  await page.evaluate(() => window.__app.game.start());
  await page.waitForFunction(() => window.__app.game.getState().state === 'playing');
  await page.evaluate(() => window.__app.openExternalApps());
  await page.waitForFunction(() => window.__app.game.getState().suspended);
  for (const name of ['Roblox', 'Rec Room', 'VRChat', 'Minecraft VR']) assert.ok(await page.getByRole('dialog').innerText().then(text => text.includes(name)));
  assert.equal(await page.locator('dialog[open] a[target="_blank"]:not([rel="noopener noreferrer"])').count(), 0);
  await page.getByRole('button', { name: 'Voltar ao BlueNav', exact: true }).click();
  await page.waitForFunction(() => !window.__app.game.getState().suspended);
  await page.evaluate(() => window.__app.openSecurity());
  assert.match(await page.getByRole('dialog').innerText(), /Câmera: inativa/);
  await page.route(/^https:\/\/(aiplatform|generativelanguage)\.googleapis\.com\//, route => route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Teste: ative autenticação em duas etapas.' }] } }] } }));
  await page.getByLabel('Pergunta de segurança').fill('Como proteger minha conta?'); await page.getByRole('button', { name: 'Perguntar', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.security-answer').textContent.includes('duas etapas'));
  await mkdir('artifacts/vrbox', { recursive: true }); await page.screenshot({ path: 'artifacts/vrbox/security.png' });
  await page.getByRole('button', { name: 'Voltar ao BlueNav', exact: true }).click();
  await page.evaluate(() => window.__app.openExternalApps());
  await page.getByRole('button', { name: 'Jogar Mundo de Blocos no VR Box' }).click();
  await page.waitForFunction(() => window.__app.gameId === 'blocks' && !window.__app.loading);
  const walking = await page.evaluate(() => {
    const app = window.__app, THREE = app.ctx.THREE; app.renderer.setAnimationLoop(null); app.walkIntent.reset();
    const points = Array.from({ length: 21 }, () => new THREE.Vector3(0, .06, 0));
    points[0].set(0,0,0); points[9].y = .09;
    for (const tip of [8,12,16,20]) { points[tip].y = .045; points[tip - 2].y = .07; }
    const pointer = { id: 'walk-test', source: 'hand', side: 'left', hand: { points, confianca: .9 } };
    app.input.pointers = [pointer]; const before = app.rig.position.clone();
    for (let frame = 0; frame < 40; frame++) { app.camera.updateMatrixWorld(true); app._walk(1/60); }
    const moved = app.rig.position.distanceTo(before);
    points[8].y = .17; const stop = app.rig.position.clone();
    for (let frame = 0; frame < 20; frame++) app._walk(1/60);
    return { moved, stopped: app.rig.position.distanceTo(stop) === 0 };
  });
  assert.ok(walking.moved > .1); assert.equal(walking.stopped, true);
  await page.screenshot({ path: 'artifacts/vrbox/blocks.png' });
  assert.deepEqual(errors, []); console.log('VR Box flow passed: v2/v3/v4 maps, WAV, walls, pause/resume, security and walking.');
} finally { await browser.close(); }
