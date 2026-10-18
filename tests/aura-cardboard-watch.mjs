import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

// VR Box: tapping the wrist watch (or any button) in either eye presses it, and gazing at the floating watch selects it.
import { readFile } from 'node:fs/promises'; import path from 'node:path';
const base = process.env.AURA_URL || 'http://127.0.0.1:8084/auraos-xr.html';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const c = await b.newContext({ viewport: { width: 900, height: 420 }, isMobile: true, hasTouch: true });
await c.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async r => r.fulfill({ body: await readFile(path.resolve('node_modules/three', r.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' }));
const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(base + '?exp=aether&from=bluenav&mode=cardboard'); await p.waitForFunction(() => window.__aura?.Engine.cur, null, { timeout: 20000 });
await p.evaluate(() => { window.__aura.mouse.pitch = -0.35; }); await p.waitForTimeout(2500);
const eye = (obj, side) => p.evaluate(([obj, side]) => { const a = window.__aura, o = obj.split('.').reduce((x, k) => x[k], a), v = o.getWorldPosition(new a.THREE.Vector3()).project(a.camera), half = innerWidth / 2; return { x: (v.x + 1) / 2 * half + (side ? half : 0), y: (1 - v.y) / 2 * innerHeight, onScreen: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 }; }, [obj, side]);
const firstTap = await eye('Watch.group', 0); await p.touchscreen.tap(5, 5); await p.waitForTimeout(500); // first tap: fullscreen gesture
const w = await eye('Watch.group', 0);
await p.touchscreen.tap(w.x, w.y); await p.waitForTimeout(1200);
const r1 = await p.evaluate(() => window.__aura.Engine.state);
await p.evaluate(() => { window.__aura.mouse.pitch = -0.12; window.__aura.mouse.yaw = 0; }); await p.waitForTimeout(800);
const card = await eye('Hub.cards.6.group', 1); await p.touchscreen.tap(card.x, card.y); await p.waitForTimeout(1500);
const r2 = await p.evaluate(() => window.__aura.Engine.cur?.id);
// gaze-only: look at the watch and hold
await p.evaluate(() => { const a = window.__aura; a.mouse.pitch = -0.6; a.mouse.yaw = 0.35; }); await p.waitForTimeout(600);
const aimed = await p.evaluate(() => window.__aura.Hub.cards[6].e.id);
let r3 = 'timeout';
for (let i = 0; i < 200 && r3 !== 'hub'; i++) {
  // Keep the reticle on the watch; headless frames are slow, so the 0.9 s dwell takes a while.
  r3 = await p.evaluate(() => { const a = window.__aura, wp = a.Watch.group.getWorldPosition(new a.THREE.Vector3()), cp = a.camera.getWorldPosition(new a.THREE.Vector3()), d = wp.sub(cp); a.mouse.yaw = Math.atan2(-d.x, -d.z); a.mouse.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); return a.Engine.state; });
  await p.waitForTimeout(100);
}
await p.waitForFunction(() => window.__aura.UI.items.find(i => i.obj === window.__aura.Watch.group).cool <= 0, null, { timeout: 10000 });
const w2 = await eye('Watch.group', 1); await p.touchscreen.tap(w2.x, w2.y);
const home = await p.waitForURL(/index\.html\?auto=cardboard&hands=1/, { timeout: 15000 }).then(() => p.waitForFunction(() => window.__app?.mode === 'cardboard', null, { timeout: 30000 })).then(() => 'bluenav', () => p.url());
const result = { watchOnScreen: w.onScreen, tapWatch: r1, tapCardRightEye: r2, gazeWatch: r3, hubWatch: home };
assert.deepEqual(result, { watchOnScreen: true, tapWatch: 'hub', tapCardRightEye: aimed, gazeWatch: 'hub', hubWatch: 'bluenav' }); assert.deepEqual(errs, []);
console.log('VR Box watch: tap, tap in right eye, gaze, and hub watch -> BlueNav in VR Box: OK');
await b.close();
