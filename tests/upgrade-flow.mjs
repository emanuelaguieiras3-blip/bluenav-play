import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const folder = 'artifacts/vr-upgrade'; await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 750 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36' });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
await context.addInitScript(() => {
  for (const p of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const original = p.getExtension; p.getExtension = function(name) { return name === 'KHR_parallel_shader_compile' ? null : original.call(this, name); };
  }
  window.testPad = { connected: false, axes: [0, 0, 0], buttons: [{ pressed: false }] };
  Object.defineProperty(navigator, 'getGamepads', { value: () => [window.testPad], configurable: true });
});
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
  await page.goto('http://127.0.0.1:8080/?auto=flat&game=sandbox');
  await page.waitForFunction(() => window.__app?.game && !window.__app.loading);
  const report = await page.evaluate(async () => {
    const app = window.__app, THREE = await import('three');
    app.renderer.setAnimationLoop(null); app.hands = null; app.menu.toggle(false); app.menu.update(1);
    app.input.update(1 / 60); const before = app.rig.position.x;
    window.testPad.connected = true; window.testPad.axes[0] = 1; app.input.update(1 / 60); app._walk(0.05);
    const joystickMoved = app.rig.position.x > before;
    window.testPad.connected = false; app.input.update(1 / 60); const stopped = app.rig.position.x; app._walk(0.05);
    const disconnectedStopped = app.rig.position.x === stopped;
    app.mode = 'cardboard'; app.input.keys.add('ArrowUp'); const z = app.rig.position.z; app._walk(0.05);
    const keyboardRemoteMoved = app.rig.position.z < z; app.input.keys.clear(); app.mode = 'flat';
    app.togglePhysics(); const kit = app.physicsKit, body = kit.world.bodies[0];
    body.mesh.position.y += 0.4; const height = body.mesh.position.y; kit.update(0.05);
    const gravityWorks = body.mesh.position.y < height;
    app.togglePhysics(); const hidden = !kit.group.visible; app.togglePhysics(); const shown = kit.group.visible;
    const sizes = [...app.tex.cache.values()].map(t => t.image?.width || 0);
    await app.loadGame('jobs'); app.menu.update(1);
    const kitCleared = app.physicsKit === null;
    return { joystickMoved, disconnectedStopped, keyboardRemoteMoved, gravityWorks, hidden, shown, kitCleared, maxMaterialTexture: Math.max(...sizes), mobile: app.perf.mobile };
  });
  for (const key of ['joystickMoved', 'disconnectedStopped', 'keyboardRemoteMoved', 'gravityWorks', 'hidden', 'shown', 'kitCleared', 'mobile']) assert.equal(report[key], true, key);
  assert.ok(report.maxMaterialTexture <= 128);
  for (const id of ['plaza', 'ski', 'motorbike', 'shiftworld', 'complex', 'racing', 'sandbox', 'jobs', 'tactical', 'rhythm', 'arena', 'tablegames', 'physics', 'jungle', 'dungeon']) {
    await page.evaluate(async id => { const a = window.__app; await a.loadGame(id); a.menu.toggle(false); a.menu.update(1); a.hud.group.visible = false; a.teleport.fade = 0; a.teleport.fadeDir = 0; a.teleport.shade.visible = false; a._look(1 / 60); a.input.update(1 / 60); a.game.update(1 / 60, 0); a.scene.updateMatrixWorld(true); a.renderer.render(a.scene, a.camera); }, id);
    await page.screenshot({ path: `${folder}/${id}.png` });
  }
  assert.deepEqual(errors, []); await writeFile(`${folder}/flow-report.json`, JSON.stringify({ ...report, errors }, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
