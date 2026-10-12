import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GAMES } from '../src/games/index.js';

const folder = path.resolve('artifacts/graphics', process.argv[2] || 'after');
const mobile = process.argv[3] === 'mobile';
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 },
  ...(mobile ? { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36' } : {}) });
// Test the pinned local Three.js, without CDN/network variability.
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async (route) => {
  const relative = route.request().url().split('/three@0.160.0/')[1];
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', relative)), contentType: 'text/javascript' });
});
await context.addInitScript(({ mobile }) => {
  let seed = 73417;
  Math.random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  // SwiftShader does not reliably complete KHR parallel shader compilation.
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const getExtension = prototype.getExtension;
    prototype.getExtension = function(name) { return name === 'KHR_parallel_shader_compile' ? null : getExtension.call(this, name); };
  }
  if (mobile) {
    Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 3 });
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 4 });
  }
}, { mobile });
const page = await context.newPage(), errors = [];
page.setDefaultTimeout(20000);
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const reports = [];
try {
  console.log('Starting headless render audit');
  await page.goto('http://127.0.0.1:8080/?auto=flat&game=archery&fakehand=two', { waitUntil: 'networkidle' });
  console.log('Page loaded');
  try {
    await page.waitForFunction(() => window.__app?.game && !window.__app.loading, null, { timeout: 60000 });
  } catch (error) {
    console.error('Startup diagnostics:', JSON.stringify({ errors, state: await page.evaluate(() => ({ app: !!window.__app, loading: window.__app?.loading, game: window.__app?.gameId, body: document.body.innerText.slice(0, 1000) })) }));
    throw error;
  }
  for (const game of GAMES.filter(game => !process.argv[4] || game.id === process.argv[4])) {
    console.log(`Loading ${game.id}`);
    await page.evaluate(async (id) => {
      const app = window.__app;
      if (app.gameId !== id) await app.loadGame(id);
      app.menu.toggle(false); app.hud.group.visible = false; app.handView.visible = false;
      app.handView.group.visible = false; app.handView.sys.visible = false;
      app.teleport.fade = 0; app.teleport.fadeDir = 0; app.teleport.shade.visible = false;
      // Freeze gameplay while shaders and the two rendered frames are checked.
      app.renderer.setAnimationLoop(null);
      app._look(1 / 60); app.camera.updateMatrixWorld(true); app.input.update(1 / 60);
      app.game.update?.(1 / 60, 0, app.input);
      app.graphics?.update(1 / 60);
      app.camera.updateMatrixWorld(true); app.scene.updateMatrixWorld(true);
      app.env.update();
      app.renderer.render(app.scene, app.camera);
    }, game.id);
    const pauseCheck = await page.evaluate(() => {
      const app = window.__app, before = app.gameTime;
      app.menu.toggle(true); app.perf.capFps = 0; app.loop(performance.now());
      const paused = app.gameTime === before && app.gameplayBlocked;
      app.menu.toggle(false); app.loop(performance.now() + 17);
      return { paused, resumed: app.gameTime > before };
    });
    if (!pauseCheck.paused || !pauseCheck.resumed) throw new Error(`${game.id}: menu pause/resume failed`);
    const report = await page.evaluate(() => {
      const app = window.__app;
      app.menu.toggle(false); app.menu.update(1);
      app.renderer.render(app.scene, app.camera);
      const programs = app.renderer.info.programs || [];
      return { id: app.gameId, calls: app.renderer.info.render.calls, triangles: app.renderer.info.render.triangles,
        geometries: app.renderer.info.memory.geometries, textures: app.renderer.info.memory.textures,
        shaderErrors: programs.filter((p) => p.diagnostics?.runnable === false).map((p) => p.diagnostics.programLog),
        graphics: app.graphics?.summary || null,
        desktopRelief: [...app.tex.cache.values()].filter((t) => t.image?.width === 512).length,
        shadows: app.renderer.shadowMap.enabled,
        toneMapping: app.renderer.toneMapping };
    });
    await page.screenshot({ path: path.join(folder, `${game.id}.png`) });
    if (process.env.AUDIT_DIAG && game.id === 'arena') {
      const diagnostics = await page.evaluate(() => {
        const a = window.__app;
        return JSON.stringify({ camera: a.camera.getWorldPosition(a.camera.position.clone()).toArray(), textures: [...a.tex.cache].map(([k, t]) => [k, t.image?.width]), children: a.scene.children.map((o) => [o.type, o.name, o.visible]), meshes: a.root.children.map((o, i) => [i, o.type, o.geometry?.type, o.material?.color?.getHexString()]) });
      });
      await writeFile(path.join(folder, 'diagnostics.json'), diagnostics);
      const floorTexture = await page.evaluate(() => window.__app.root.children[0].material.map.image.toDataURL());
      await writeFile(path.join(folder, 'arena-floor-texture.png'), Buffer.from(floorTexture.split(',')[1], 'base64'));
      await page.evaluate(() => { const a = window.__app; a.root.traverse(o => { if (o.material?.bumpMap) o.material.bumpScale *= 0.1; }); a.renderer.render(a.scene, a.camera); });
      await page.screenshot({ path: path.join(folder, 'arena-low-bump.png') });
      await page.evaluate(async () => { const a = window.__app, THREE = await import('three'); const floor = a.root.children[0]; floor.geometry = new THREE.PlaneGeometry(16,16).rotateX(-Math.PI/2); a.renderer.render(a.scene,a.camera); });
      await page.screenshot({ path: path.join(folder, 'arena-plane.png') });
      await page.evaluate(() => { const a = window.__app; a.root.traverse(o => { if (o.material?.bumpMap) { o.material.bumpMap = null; o.material.needsUpdate = true; } }); a.renderer.render(a.scene, a.camera); });
      await page.screenshot({ path: path.join(folder, 'arena-no-bump.png') });
      await page.evaluate(() => { const a = window.__app; a.scene.children.forEach(o => { if (o !== a.root && o !== a.rig && !o.isLight && o !== a.env.sun.target) o.visible = false; }); a.rig.children.forEach(o => { if(o !== a.camera) o.visible = false; }); a.camera.children.forEach(o => o.visible = false); a.renderer.render(a.scene, a.camera); });
      await page.screenshot({ path: path.join(folder, 'arena-root-only.png') });
      break;
    }
    report.pauseCheck = pauseCheck; reports.push(report);
    console.log(`${game.id}: ${report.calls} calls, ${report.triangles} triangles, ${report.shaderErrors.length} shader failures`);
  }
  await writeFile(path.join(folder, 'report.json'), JSON.stringify({ renderer: 'headless Chromium / SwiftShader (not device FPS)', reports, errors }, null, 2));
  if (errors.length || reports.some((r) => r.shaderErrors.length)) throw new Error(`Render audit failed: ${errors.join('; ')}`);
} finally { await browser.close(); }
