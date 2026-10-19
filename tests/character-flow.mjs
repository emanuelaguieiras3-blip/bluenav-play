import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 850 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
await mkdir('artifacts/characters', { recursive: true });
try {
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:8083'}/?auto=flat&game=tactical`);
  await page.waitForFunction(() => window.__app?.gameId === 'tactical' && !window.__app.loading);
  const report = await page.evaluate(() => {
    const a = window.__app; a.renderer.setAnimationLoop(null); a.game.update(1 / 60, .4);
    a.hud.group.visible = false; a.menu.group.visible = false; a.handView.group.visible = false; a.handView.sys.visible = false; a.teleport.shade.visible = false;
    a.camera.position.set(0, 1.36, -5); a.camera.lookAt(-1, 1.1, -7.7); a.camera.updateMatrixWorld(true);
    a.scene.updateMatrixWorld(true); a.env.update(); a.renderer.render(a.scene, a.camera);
    const bot = a.game.bots[1];
    return { count: a.game.bots.length, body: bot.body.geometry.type, hip: bot.legs[0].position.y,
      finiteBounds: [...bot.box.min.toArray(), ...bot.box.max.toArray()].every(Number.isFinite), calls: a.renderer.info.render.calls };
  });
  assert.equal(report.count, 4); assert.equal(report.body, 'LatheGeometry'); assert.equal(report.hip, .76); assert.ok(report.finiteBounds);
  assert.deepEqual(errors, []); await page.screenshot({ path: 'artifacts/characters/tactical.png' });
  console.log(JSON.stringify({ errors, report }));
} finally { await browser.close(); }
