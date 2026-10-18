import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.AURA_URL || 'http://127.0.0.1:8084/auraos-xr.html';
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
await mkdir('artifacts/auraos', { recursive: true });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const only = process.argv[2];
try {
  await page.goto(base + '?desk=1');
  await page.waitForFunction(() => window.__aura?.Engine.state === 'hub', { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/auraos/hub.png' });
  const screenOf = obj => page.evaluate(path => { const a = window.__aura, o = path.split('.').reduce((x, k) => x[k], a), v = o.getWorldPosition(new a.THREE.Vector3()).project(a.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, obj);
  const card = await screenOf('Hub.cards.0.group');
  await page.mouse.click(card.x, card.y);
  if (!await page.waitForFunction(() => window.__aura.Engine.cur?.id === 'chem', null, { timeout: 8000 }).then(() => true, () => false)) throw Error('clicking the first hub card did not open ChemHands');
  await page.waitForTimeout(1500);
  const watch = await screenOf('Watch.group');
  await page.mouse.click(watch.x, watch.y);
  if (!await page.waitForFunction(() => window.__aura.Engine.state === 'hub', null, { timeout: 8000 }).then(() => true, () => false)) throw Error('clicking the wrist watch did not return to the hub');
  console.log('hub card click -> ChemHands, watch click -> hub: ok');
  if (process.env.AURA_GEMINI) {
    await page.evaluate(() => window.__aura.Engine.load('chem'));
    await page.keyboard.press('g');
    const hint = await page.waitForFunction(() => { const h = window.__aura.HUD.st.hint; return h && !h.startsWith('A pedir') ? h : null; }, null, { timeout: 20000 }).then(h => h.jsonValue(), () => null);
    if (!hint) throw Error('Gemini hint did not arrive: ' + await page.evaluate(() => window.__aura.HUD.st.status));
    console.log('Gemini hint in ChemHands:', hint);
    await page.evaluate(() => window.__aura.Engine.toHub());
  }
  const ids = await page.evaluate(() => window.__aura.EXPERIENCES.map(e => e.id));
  if (ids.length !== 20) throw Error('expected 20 experiences, got ' + ids.length);
  for (const id of ids) {
    if (only && id !== only) continue;
    const before = errors.length;
    await page.evaluate(id => window.__aura.Engine.load(id), id);
    await page.waitForTimeout(1500);
    await page.mouse.move(640, 420); await page.mouse.down(); await page.mouse.move(700, 380, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({ id: window.__aura.Engine.cur?.id, hud: window.__aura.HUD.st.status, upd: !!window.__aura.Engine.inst?.update }));
    await page.screenshot({ path: `artifacts/auraos/${id}.png` });
    if (!st.upd) errors.push(`${id}: update loop stopped (${st.hud})`);
    console.log(id, errors.length > before ? 'ERR ' + errors.slice(before).join(' | ') : 'ok');
  }
  await page.evaluate(() => window.__aura.Engine.toHub());
  if (errors.length) throw Error(errors.join('\n'));
  console.log('AuraOS: 20 experiences load and run without errors');
} finally { await browser.close(); }
