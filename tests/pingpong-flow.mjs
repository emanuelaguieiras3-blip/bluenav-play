import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8080';
await mkdir('artifacts', { recursive: true });
try {
  await page.goto(base); await page.locator('#btn-pingpong').waitFor();
  await page.screenshot({ path: 'artifacts/play-club-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'artifacts/play-club-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`${base}/?auto=flat&game=pingpong`);
  await page.waitForFunction(() => window.__app?.gameId === 'pingpong' && window.__app.game && !window.__app.loading);
  await page.waitForFunction(() => window.__app.teleport.fade < .01);
  const report = await page.evaluate(async () => {
    const app = window.__app, THREE = await import('three'); app.renderer.setAnimationLoop(null);
    const game = app.game;
    const pointer = { id: 'test-xr', side: 'right', source: 'xr', handPos: new THREE.Vector3(.2, .95, -.4),
      quaternion: new THREE.Quaternion(), stale: false, uiBusy: false };
    app.input.pointers = [pointer]; game.update(1 / 60, 0);
    const tracked = game.getState().tracking, paddle = game.playerPaddle.position.toArray();
    const points = Array.from({ length: 21 }, () => new THREE.Vector3(.3, .95, -.4));
    points[5].set(.34, 1.0, -.4); points[17].set(.26, 1.0, -.4);
    pointer.source = 'hand'; pointer.hand = { points, palm: new THREE.Vector3(.3, .95, -.4), dir: new THREE.Vector3(0, 1, 0) };
    game.update(1 / 60, .01);
    const handTracked = game.getState().tracking, handPosition = game.playerPaddle.position.toArray();
    pointer.hand.dir.set(1, 0, 0); game.update(1 / 60, .015);
    const wristRoll = new THREE.Vector3(0, 1, 0).applyQuaternion(game.playerPaddle.quaternion).x;
    pointer.source = 'xr'; pointer.hand = null;
    pointer.stale = true; game.update(1 / 60, .02); const lost = game.getState().tracking;
    pointer.stale = false; game.update(1 / 60, .04); game.serve();
    for (let i = 0; i < 300; i++) game.update(1 / 120, i / 120);
    const match = game.getState();
    game.match.reset(); game.serve(); let longest = 0;
    for (let i = 0; i < 120; i++) game.update(1 / 120, i / 120);
    // A reproducible legal swing, then let the actual opponent logic return it.
    const m = game.match; m.position.set(0, 1, -.55); m.velocity.set(0, -1, 4);
    m.step(.03, [{ side: 0, active: true, radius: .1, previous: new THREE.Vector3(0, 1, -.45),
      position: new THREE.Vector3(0, 1, -.45), normal: new THREE.Vector3(0, .35, -.93675).normalize(), velocity: new THREE.Vector3(0, 0, -.7) }]);
    pointer.stale = true;
    const timeline = [];
    for (let i = 0; i < 300; i++) {
      game.update(1 / 120, i / 120); longest = Math.max(longest, game.getState().rally);
      if (i % 30 === 0) timeline.push({ ...m.getState(), position: m.position.toArray() });
    }
    app.hud.update(1); app.hud.guide.visible = false;
    app.menu.toggle(true); app.menu.update(1); app.scene.updateMatrixWorld(true); app.renderer.render(app.scene, app.camera);
    return { tracked, handTracked, handPosition, wristRoll, lost, paddle, match, longest, timeline, menu: !!app.menu.libraryTiles.find(tile => tile.parent === app.menu.own), geometry: app.graphics.summary };
  });
  assert.ok(report.tracked); assert.equal(report.lost, false); assert.deepEqual(report.paddle, [.2, 1.08, -.4]);
  assert.ok(report.handTracked); assert.deepEqual(report.handPosition, [.3, 1.08, -.4]);
  assert.ok(report.wristRoll > .99, 'paddle orientation follows wrist roll');
  assert.ok(report.match.score[0] + report.match.score[1] >= 1); assert.equal(errors.length, 0, errors.join('\n'));
  assert.ok(report.longest >= 2, JSON.stringify(report.timeline));
  assert.ok(report.timeline.some(s => s.rally >= 2 && s.bounces === 1 && s.expected === 0), 'opponent return lands legally');
  await page.screenshot({ path: 'artifacts/play-club-vr-menu.png' });
  await page.evaluate(() => { const app = window.__app; app.menu.toggle(false); app.menu.update(1); app.renderer.render(app.scene, app.camera); });
  await page.screenshot({ path: 'artifacts/pingpong-club.png' });
  console.log(JSON.stringify({ errors, report }));
} finally { await browser.close(); }
