import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GAMES } from '../src/games/index.js';

const folder = path.resolve('assets/covers'); await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
await context.addInitScript(() => {
  for (const p of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const get = p.getExtension; p.getExtension = function(name) { return name === 'KHR_parallel_shader_compile' ? null : get.call(this, name); };
  }
});
const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:8083'}/?auto=flat&game=archery`);
  await page.waitForFunction(() => window.__app?.game && !window.__app.loading);
  for (const game of GAMES.filter(game => !process.argv[2] || game.id === process.argv[2])) {
    await page.evaluate(async id => {
      const app = window.__app; app.renderer.setAnimationLoop(null);
      if (app.gameId !== id) await app.loadGame(id);
      app.menu.toggle(false); app.menu.group.visible = false; app.hud.group.visible = false;
      app.handView.visible = false; app.handView.group.visible = false; app.handView.sys.visible = false;
      app.teleport.fade = 0; app.teleport.shade.visible = false;
      app._look(1 / 60); app.camera.updateMatrixWorld(true); app.input.update(1 / 60);
      app.game.update?.(1 / 60, 0); app.graphics?.update(1 / 60); app.env.update();
      if (app.game.playerPaddle) app.game.playerPaddle.visible = false;
      app.rig.traverse(object => { if (object.isLine) object.visible = false; });
      app.scene.updateMatrixWorld(true); app.renderer.render(app.scene, app.camera);
      document.querySelectorAll('.network-toggle,#debug').forEach(element => element.hidden = true);
    }, game.id);
    await page.screenshot({ path: path.join(folder, `${game.id}.jpg`), type: 'jpeg', quality: 86 });
    console.log(game.id);
  }
  if (errors.length) throw Error(errors.join('\n'));
  await writeFile(path.join(folder, 'sources.json'), JSON.stringify({ source: 'Captures of the local BlueNav games, rendered in Chromium. No external game artwork.', games: GAMES.map(g => g.id) }, null, 2));
} finally { await browser.close(); }
