import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GAMES } from '../src/games/index.js';
import { OFFICIAL_GAMES } from '../src/media/officialGames.js';
import { AURA_GAMES } from '../src/media/auraGames.js';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 700 }, isMobile: true, hasTouch: true });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
await context.addInitScript(() => {
  for (const p of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const original = p.getExtension;
    p.getExtension = function(name) { return name === 'KHR_parallel_shader_compile' ? null : original.call(this, name); };
  }
});
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:8080'}/?auto=flat&game=lobby&fakehand=one`);
  await page.waitForFunction(() => window.__app?.game && !window.__app.loading);
  const report = await page.evaluate(async () => {
    const THREE = await import('three'), app = window.__app;
    app.renderer.setAnimationLoop(null); app.mode = 'cardboard'; app.resize();
    app.handView.group.visible = false; app.handView.sys.visible = false;
    app.menu.toggle(true); app.menu.update(1); app.gameplayBlocked = true;
    const contains = mesh => { for (let parent = mesh; parent; parent = parent.parent) if (parent === app.menu.group) return true; return false; };
    const menus = app.ui.targets.filter(contains), original = new Map(), counts = new Map();
    for (const mesh of menus) {
      original.set(mesh, mesh.userData.ui.onClick); counts.set(mesh, 0);
      mesh.userData.ui.onClick = () => counts.set(mesh, counts.get(mesh) + 1);
    }
    const checks = [];
    function touch(mesh, id) {
      app.scene.updateMatrixWorld(true);
      const center = mesh.getWorldPosition(new THREE.Vector3());
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
      const pointer = { id: 'touch-' + id, source: 'hand', main: true, stale: false, system: false, fingerAim: false,
        ray: new THREE.Ray(center.clone().addScaledVector(normal, 0.11), normal.clone().negate()),
        origin: center.clone(), pokeTip: center.clone().addScaledVector(normal, 0.11), pinch: false, pinchStrength: 0 };
      const input = { pointers: [pointer], _ptrs: new Map([[pointer.id, pointer]]) };
      const step = () => { pointer.ray.origin.copy(pointer.pokeTip); pointer.origin.copy(pointer.pokeTip);
        app.scene.updateMatrixWorld(true); app.ui.update(1 / 60, input); };
      step(); pointer.pokeTip.copy(center).addScaledVector(normal, -0.025); step();
      for (let i = 0; i < 12; i++) step();
      const held = counts.get(mesh);
      pointer.pokeTip.copy(center).addScaledVector(normal, 0.065); step();
      pointer.pokeTip.copy(center); step();
      for (let i = 0; i < 18; i++) step();
      checks.push({ id, held, afterRetouch: counts.get(mesh), distance: center.distanceTo(app.camera.getWorldPosition(new THREE.Vector3())) });
    }
    for (let page = 0; page < app.menu.libraryPageCount; page++) {
      app.menu.showPanel('library'); app.menu.showPage(page); app.scene.updateMatrixWorld(true);
      const visible = menus.filter(mesh => app.ui._visible(mesh));
      for (let i = 0; i < visible.length; i++) {
        counts.set(visible[i], 0); touch(visible[i], `library-${page}-${i}`);
      }
    }
    app.menu.showLibrary('official'); app.scene.updateMatrixWorld(true);
    const officialVisible = menus.filter(mesh => app.ui._visible(mesh));
    for (let i = 0; i < officialVisible.length; i++) {
      counts.set(officialVisible[i], 0); touch(officialVisible[i], `official-${i}`);
    }
    app.menu.showLibrary('own');
    app.menu.showPanel('quick'); app.scene.updateMatrixWorld(true);
    const quickVisible = menus.filter(mesh => app.ui._visible(mesh));
    for (let i = 0; i < quickVisible.length; i++) {
      counts.set(quickVisible[i], 0); touch(quickVisible[i], `quick-${i}`);
    }
    for (const mesh of menus) mesh.userData.ui.onClick = original.get(mesh);
    // Use the actual callback: a fingertip touch opens the quick settings panel.
    app.menu.showPanel('library'); app.menu.showPage(0); app.scene.updateMatrixWorld(true);
    const gear = app.menu.dockButtons.find(button => button.panel === 'quick').button.userData.body;
    const center = gear.getWorldPosition(new THREE.Vector3()), normal = new THREE.Vector3(0, 0, 1).transformDirection(gear.matrixWorld);
    const p = { id: 'real-settings', source: 'hand', main: true, stale: false, system: false, fingerAim: false,
      ray: new THREE.Ray(center.clone(), normal.clone().negate()), origin: center.clone(), pokeTip: center.clone().addScaledVector(normal, 0.05), pinch: false };
    app.ui.update(1 / 60, { pointers: [p] }); p.pokeTip.copy(center); app.ui.update(1 / 60, { pointers: [p] });
    const actualPanelOpened = app.menu.quick.visible && !app.menu.lib.visible;
    app.menu.showPage(1);
    const pagingWorks = app.menu.libraryPage === 1 && app.menu.libraryTiles.filter(tile => tile.visible).length === 9;
    app.menu.showPage(0);
    app.menu.showPanel('library'); app.scene.updateMatrixWorld(true); app.stereo.render(app.scene, app.camera);
    window.__menuContactReport = { checks, actualPanelOpened, pagingWorks }; return window.__menuContactReport;
  });
  const library = GAMES.length + AURA_GAMES.length, pages = Math.ceil(library / 9);
  // Each library page includes tabs, navigation, dock and the Véspera shortcut.
  assert.equal(report.checks.length, library + pages * 12 + 12 + OFFICIAL_GAMES.length + 11);
  for (const check of report.checks) {
    assert.equal(check.held, 1, JSON.stringify(check)); assert.equal(check.afterRetouch, 2, JSON.stringify(check));
    assert.ok(check.distance < 0.9, JSON.stringify(check));
  }
  assert.equal(report.actualPanelOpened, true); assert.deepEqual(errors, []);
  assert.equal(report.pagingWorks, true);
  await mkdir('artifacts/menu', { recursive: true });
  await page.screenshot({ path: 'artifacts/menu/library.png' });
  await page.evaluate(() => { const a = window.__app; a.menu.showPanel('quick'); a.menu.update(1); a.scene.updateMatrixWorld(true); a.stereo.render(a.scene, a.camera); });
  await page.screenshot({ path: 'artifacts/menu/quick.png' });
  const camera = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
    const stream = canvas.captureStream(30);
    // Exercise opening a native video feed without asking for physical camera access.
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      setTimeout(() => { const ctx = canvas.getContext('2d'); ctx.fillStyle = '#182027'; ctx.fillRect(0, 0, canvas.width, canvas.height); stream.getVideoTracks()[0].requestFrame?.(); }, 50);
      return stream;
    }, configurable: true });
    const app = window.__app; app.hands = null;
    await Promise.race([app.menu.toggleCamera(), new Promise((_, reject) => setTimeout(() => reject(new Error('synthetic camera timed out')), 8000))]);
    const opened = app.passthrough.available && app.passthrough.on;
    await app.menu.toggleCamera(); const turnedOff = !app.passthrough.on;
    app.hands = { gemini: { enabled: true, status: 'erro: HTTP 401' } }; app.menu.update(1);
    const unavailableStatus = app.menu.aiStatus.userData.last;
    stream.getTracks().forEach(track => track.stop());
    return { opened, turnedOff, unavailableStatus };
  });
  assert.equal(camera.opened, true); assert.equal(camera.turnedOff, true);
  assert.match(camera.unavailableStatus, /indisponível/); assert.match(camera.unavailableStatus, /toque ativo/);
  await writeFile('artifacts/menu/contact-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ testedButtons: report.checks.length, actualPanelOpened: report.actualPanelOpened, camera, errors }));
} finally { await browser.close(); }
