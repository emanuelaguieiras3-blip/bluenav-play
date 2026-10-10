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
try {
  await page.goto('http://127.0.0.1:8080/');
  await page.locator('#chk-hands').uncheck(); await page.locator('#chk-gemini').uncheck();
  await page.locator('#btn-rhythm').click();
  await page.waitForFunction(() => window.__app?.gameId === 'rhythm' && window.__app.musicPickerOpen);
  const sampleRate = 8000, samples = sampleRate * 6, wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * .2) * 16000), 44 + i * 2);
  await page.locator('[data-bpm]').fill('120');
  await page.locator('[data-file]').setInputFiles({ name: 'teste-local.wav', mimeType: 'audio/wav', buffer: wav });
  await page.waitForFunction(() => window.__app.game.getState().track === 'teste-local.wav' && !window.__app.musicPickerOpen);
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
  await page.route('https://aiplatform.googleapis.com/**', route => route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Teste: ative autenticação em duas etapas.' }] } }] } }));
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
  assert.deepEqual(errors, []); console.log('VR Box flow passed: WAV, pause/resume, external apps, security, blocks, fist walking and immediate stop.');
} finally { await browser.close(); }
