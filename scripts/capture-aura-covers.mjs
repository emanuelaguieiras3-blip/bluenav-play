// Renders a clean cover for every AuraOS XR module into assets/covers/aura-<id>.jpg.
// Usage: start `npm run dev`, then `node scripts/capture-aura-covers.mjs [url]`.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:8084/auraos-xr.html';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
const page = await context.newPage();
try {
  await page.goto(base + '?desk=1');
  await page.waitForFunction(() => window.__aura?.Engine.state === 'hub', { timeout: 30000 });
  await page.evaluate(() => {
    const a = window.__aura; a.settings.tutorial = false; document.getElementById('help').hidden = true;
    a.HandVis.update = () => Object.values(a.HandVis.sides).forEach(v => { v.inst.visible = v.cursor.visible = v.ray.visible = v.dot.visible = false; v.ghost.setOpacity(0); });
  });
  await page.mouse.move(5, 5);
  const only = process.argv.slice(3);
  for (const id of await page.evaluate(() => window.__aura.EXPERIENCES.map(e => e.id))) {
    if (only.length && !only.includes(id)) continue;
    await page.evaluate(id => { const a = window.__aura; a.Engine.load(id); const look = { void: 0.12, spell: 0.1 }[id]; if (look != null) a.mouse.pitch = look; a.camera.fov = { void: 30, spell: 34 }[id] ?? 70; a.camera.updateProjectionMatrix(); a.HUD.group.visible = false; a.Watch.group.visible = false; a.Watch.update = () => {}; }, id);
    await page.waitForTimeout({ pulse: 5500, void: 9000, spell: 4500 }[id] ?? 2500);
    await page.evaluate(() => { window.__aura.HUD.group.visible = false; });
    await page.screenshot({ path: `assets/covers/aura-${id}.jpg`, type: 'jpeg', quality: 82 });
    console.log('cover', id);
  }
} finally { await browser.close(); }
