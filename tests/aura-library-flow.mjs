import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// The BlueNav library lists the 20 AuraOS XR modules; picking one opens auraos-xr.html on that module.
const base = process.env.BLUENAV_URL || 'http://127.0.0.1:8084/';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 750 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
await mkdir('artifacts/aura-library', { recursive: true });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(base + '?auto=flat');
  await page.waitForFunction(() => window.__app?.menu && !window.__app.loading, { timeout: 30000 });
  const info = await page.evaluate(() => { const m = window.__app.menu; m.toggle(true); m.showLibrary('own'); m.showPage(3); return { pages: m.libraryPageCount, tiles: m.libraryTiles.length, aura: m.libraryTiles.filter(t => t.userData.cover.includes('aura-')).length }; });
  if (info.aura !== 20) throw Error('expected 20 AuraOS tiles in the library: ' + JSON.stringify(info));
  await page.screenshot({ path: 'artifacts/aura-library/page4.png' });
  // In flat mode BlueNav selects by gaze dwell, so the centred AuraOS tile opens through the real UI path.
  await page.waitForURL(/auraos-xr\.html\?exp=[a-z]+&from=bluenav/, { timeout: 20000 });
  const exp = new URL(page.url()).searchParams.get('exp');
  await page.waitForFunction(() => window.__aura?.EXPERIENCES, null, { timeout: 30000 });
  const boot = await page.evaluate(id => ({ title: document.querySelector('#boot h1').textContent, want: window.__aura.EXPERIENCES.find(e => e.id === id).title }), exp);
  if (!boot.title.includes(boot.want)) throw Error('AuraOS boot does not show the chosen game: ' + JSON.stringify(boot));
  await page.click('#b-desk');
  await page.waitForFunction(id => window.__aura?.Engine.cur?.id === id, exp, { timeout: 15000 });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(`library: ${info.tiles} tiles, ${info.pages} pages, ${info.aura} AuraOS · gaze on tile opened ${boot.want} in AuraOS: OK`);
} finally { await browser.close(); }
