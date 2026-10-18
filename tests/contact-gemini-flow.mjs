import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// A fingertip collision with a button: the button sinks with the finger, Gemini decides the click,
// the local contact decides only when Gemini cannot answer, and a tracked hand draws no ray line.
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1000, height: 600 }, isMobile: true, hasTouch: true });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:8084'}/?auto=flat&game=lobby&fakehand=one`);
  await page.waitForFunction(() => window.__app?.game && !window.__app.loading);
  const result = await page.evaluate(async () => {
    const THREE = await import('three'), app = window.__app;
    app.renderer.setAnimationLoop(null); app.menu.toggle(true); app.menu.update(1); app.gameplayBlocked = true;
    const tile = app.menu.libraryTiles[1].children[0].children[0], ui = tile.userData.ui, pressObj = ui.press;
    let clicks = 0; ui.onClick = () => { clicks++; };
    const run = async (mode) => {
      clicks = 0; const asked = [];
      const verdict = { yes: { pressionar: true, confianca: 0.9 }, no: { pressionar: false, confianca: 0.9 }, fail: null }[mode];
      app.hands = mode === 'off' ? null : { gemini: { buttons: { active: true, lookup: () => null, judge: async (label, samples, evento) => { asked.push({ label, evento, n: samples.length }); await new Promise(r => setTimeout(r, 250)); return verdict; } } } };
      app.scene.updateMatrixWorld(true);
      const center = tile.getWorldPosition(new THREE.Vector3()), normal = new THREE.Vector3(0, 0, 1).transformDirection(tile.matrixWorld), rest = pressObj.position.z;
      const pointer = { id: 'tap', source: 'hand', main: true, stale: false, system: false, fingerAim: false,
        ray: new THREE.Ray(center.clone().addScaledVector(normal, 0.11), normal.clone().negate()), origin: center.clone(), pokeTip: center.clone().addScaledVector(normal, 0.08), pinch: false };
      const input = { pointers: [pointer], _ptrs: new Map([[pointer.id, pointer]]) };
      const step = async () => { pointer.ray.origin.copy(pointer.pokeTip); pointer.origin.copy(pointer.pokeTip); app.scene.updateMatrixWorld(true); app.ui.update(1 / 30, input); await new Promise(r => setTimeout(r, 0)); };
      for (let i = 0; i <= 6; i++) { pointer.pokeTip.copy(center).addScaledVector(normal, 0.06 - i * 0.012); await step(); }
      const sunk = rest - pressObj.position.z, clicksAtContact = clicks;
      const line = [...app.ui.states.values()].some(s => s.line.visible);
      for (let i = 0; i < 6; i++) await step();
      await new Promise(r => setTimeout(r, 400)); await step();
      pointer.pokeTip.copy(center).addScaledVector(normal, 0.08); for (let i = 0; i < 10; i++) await step();
      app.ui.update(1 / 30, { pointers: [], _ptrs: new Map() });
      return { clicks, clicksAtContact, asked: asked.length, evento: asked[0]?.evento, sunkMm: Math.round(sunk * 1000), restored: Math.abs(pressObj.position.z - rest) < 1e-6, line };
    };
    return { yes: await run('yes'), no: await run('no'), fail: await run('fail'), off: await run('off') };
  });
  const r = result;
  assert.equal(r.yes.asked, 1, JSON.stringify(r)); assert.equal(r.yes.evento, 'colisao'); assert.equal(r.yes.clicksAtContact, 0, 'click must wait for Gemini'); assert.equal(r.yes.clicks, 1);
  assert.equal(r.no.clicks, 0, JSON.stringify(r.no));
  assert.equal(r.fail.clicks, 1, 'local contact must click when Gemini cannot answer');
  assert.equal(r.off.asked, 0); assert.equal(r.off.clicks, 1);
  for (const k of ['yes', 'no', 'fail', 'off']) { assert.ok(r[k].sunkMm >= 8, k + ' button did not sink: ' + JSON.stringify(r[k])); assert.ok(r[k].restored, k + ' button did not return'); assert.equal(r[k].line, false, 'hand ray line visible'); }
  assert.deepEqual(errors, []);
  console.log('contact: button sinks and returns, Gemini decides the click, local fallback works, no hand ray line: OK', JSON.stringify(r.yes));
} finally { await browser.close(); }
