import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext();
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
const pages = [await context.newPage(), await context.newPage()];
const game = process.argv[2] || 'ski';
const errors = [];
for (const page of pages) page.on('pageerror', error => errors.push(error.message));
try {
  for (const page of pages) {
    await page.goto(`http://127.0.0.1:8080/?auto=flat&game=${game}`);
    await page.waitForFunction(id => window.__app?.gameId === id && !window.__app.loading, game);
  }
  const created = await pages[0].evaluate(async () => {
    const ok = await window.__app.network.connect('ws://127.0.0.1:8799/room', 'create');
    return { ok, room: window.__app.network.room, status: window.__app.network.ui.status.textContent };
  });
  if (!created.ok) throw Error('create failed: ' + JSON.stringify(created));
  const joined = await pages[1].evaluate(async room => window.__app.network.connect('ws://127.0.0.1:8799/room', 'join', room), created.room);
  if (!joined) throw Error('join failed');
  await pages[0].waitForFunction(() => window.__app.network.peers.size === 1);
  if (game === 'universe') {
    await pages[1].waitForFunction(() => window.__app.game.state.bodies.length === 3);
    await pages[1].evaluate(() => window.__app.game.preset('impact'));
    await pages[0].waitForFunction(() => window.__app.game.state.impactSeen, null, { timeout: 12000 });
    await pages[1].waitForFunction(() => window.__app.game.state.impactSeen, null, { timeout: 12000 });
    const target = await pages[0].evaluate(() => window.__app.game.state.lastImpactType);
    if (target !== 'planet') throw Error(`Impacto atingiu ${target} em vez da Terra`);
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log(`two browser clients joined ${game} room ${created.room}${game === 'universe' ? ' and shared a meteor impact' : ''}`);
} finally { await browser.close(); }
