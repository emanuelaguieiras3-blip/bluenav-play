import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// A fingertip that stops ~15 mm in front of a button (no contact) is handed to Gemini.
// A confident "press" clicks once; a refusal, low confidence or a risky button does not.
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
    const tile = app.menu.libraryTiles[0].children[0].children[0], ui = tile.userData.ui;
    let clicks = 0; ui.onClick = () => { clicks++; };
    const run = async (verdict, risky = false) => {
      clicks = 0; const asked = [];
      app.hands = { gemini: { buttons: { active: true, lookup: () => risky ? { dica: 'Sai do jogo', confirmar: true } : null, judge: async (label, samples) => { asked.push({ label, n: samples.length }); return verdict; } } } };
      app.scene.updateMatrixWorld(true);
      const center = tile.getWorldPosition(new THREE.Vector3()), normal = new THREE.Vector3(0, 0, 1).transformDirection(tile.matrixWorld);
      const pointer = { id: 'near', source: 'hand', main: true, stale: false, system: false, fingerAim: false,
        ray: new THREE.Ray(center.clone().addScaledVector(normal, 0.11), normal.clone().negate()), origin: center.clone(), pokeTip: center.clone().addScaledVector(normal, 0.08), pinch: false };
      const input = { pointers: [pointer], _ptrs: new Map([[pointer.id, pointer]]) };
      const step = async () => { pointer.ray.origin.copy(pointer.pokeTip); pointer.origin.copy(pointer.pokeTip); app.scene.updateMatrixWorld(true); app.ui.update(1 / 30, input); await new Promise(r => setTimeout(r, 0)); };
      for (let i = 0; i < 4; i++) { pointer.pokeTip.copy(center).addScaledVector(normal, 0.08 - i * 0.016); await step(); }
      pointer.pokeTip.copy(center).addScaledVector(normal, 0.015);
      for (let i = 0; i < 40; i++) await step();
      app.ui.update(1 / 30, { pointers: [], _ptrs: new Map() });
      return { clicks, asked };
    };
    return { yes: await run({ pressionar: true, confianca: 0.9 }), no: await run({ pressionar: false, confianca: 0.9 }), unsure: await run({ pressionar: true, confianca: 0.5 }), risky: await run({ pressionar: true, confianca: 0.95 }, true) };
  });
  assert.equal(result.yes.asked.length, 1, JSON.stringify(result)); assert.equal(result.yes.clicks, 1, JSON.stringify(result));
  assert.equal(result.no.clicks, 0); assert.equal(result.unsure.clicks, 0);
  assert.equal(result.risky.asked.length, 0); assert.equal(result.risky.clicks, 0);
  assert.deepEqual(errors, []);
  console.log('near miss: Gemini press clicks once; refusal, low confidence and risky buttons do not click: OK', JSON.stringify(result.yes));
} finally { await browser.close(); }
