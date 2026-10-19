import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 750 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
await mkdir('artifacts/new-games', { recursive: true });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  for (const id of ['ski', 'motorbike', 'shiftworld']) {
    await page.goto(`http://127.0.0.1:8080/?auto=flat&game=${id}`);
    await page.waitForFunction(() => window.__app?.game && !window.__app.loading, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `artifacts/new-games/${id}.png` });
    if (id === 'ski' || id === 'motorbike') {
      const status = await page.evaluate(() => {
        const game = window.__app.game;
        for (const gate of game.gates) {
          game.state.s = gate.s - 0.01; game.state.x = gate.x; game.state.speed = 9;
          game.update(1 / 60);
        }
        game.state.s = 149.95; game.state.speed = 9; game.update(1 / 60);
        return { status: game.state.status, passed: game.state.passed };
      });
      if (status.status !== 'won' || status.passed !== 12) throw Error(`${id} finish failed: ${JSON.stringify(status)}`);
    }
    if (id === 'shiftworld') {
      const state = await page.evaluate(() => {
        const game = window.__app.game;
        game.restore(0); game.restore(1); game.restore(2);
        window.__app.rig.position.set(0, 0, -27);
        game.update(1 / 60);
        return game.getState();
      });
      if (!state.complete) throw Error('shiftworld completion failed');
    }
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log('new games render and all three completion paths: OK');
} finally { await browser.close(); }
