import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
await mkdir('artifacts/layout', { recursive: true });
try {
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:8083');
  await page.waitForFunction(() => document.getElementById('gemini-status').textContent.length > 0);
  assert.equal(await page.locator('.game-card, .home-app, #btn-flat').count(), 0);
  assert.ok(await page.locator('#btn-cardboard').isVisible());
  assert.equal(await page.locator('#chk-gemini').isDisabled(), false);
  await page.screenshot({ path: 'artifacts/layout/vr-entry-desktop.png' });
  await page.locator('#chk-gemini').check();
  assert.equal(await page.locator('#gemini-setup').getAttribute('open'), '');
  assert.equal(await page.locator('#chk-hands').isChecked(), true);
  await page.locator('#btn-cardboard').click();
  assert.equal(await page.evaluate(() => !!window.__app), false);
  assert.match(await page.locator('#status').textContent(), /Gemini/);
  await page.locator('#gemini-key').fill('session-test-key');
  await page.locator('#gemini-save').click();
  assert.equal(await page.locator('#gemini-key').inputValue(), '');
  const calibration = await page.evaluate(async () => {
    const { GeminiAssist } = await import('./src/hands/geminiAssist.js');
    const { CONFIG } = await import('./config.js');
    const keyConfigured = CONFIG.GEMINI_API_KEY === 'session-test-key';
    let applied = 0, requested = false;
    const original = window.fetch;
    window.fetch = async (url, options) => {
      requested = url.startsWith('https://generativelanguage.googleapis.com/') && options.headers['x-goog-api-key'] === 'session-test-key';
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ pontosCorrigidos: Array.from({ length: 21 }, () => [0, 0, 0]), gesto: 'aberta', confianca: .8 }) }] } }] }) };
    };
    const ai = new GeminiAssist(); ai.enabled = true;
    ai.maybeSend(performance.now(), Array.from({ length: 4 }, (_, i) => ({ t: i * 60, pontos: Array.from({ length: 21 }, () => [0, 0, 0]) })), 'aberta', () => applied++);
    await new Promise(resolve => setTimeout(resolve, 0)); window.fetch = original;
    return { keyConfigured, applied, requested, stored: Object.values(localStorage).includes('session-test-key') };
  });
  assert.deepEqual(calibration, { keyConfigured: true, applied: 1, requested: true, stored: false });
  await page.locator('#chk-hands').uncheck();
  assert.equal(await page.locator('#chk-gemini').isChecked(), false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#gemini-setup').evaluate(el => el.open = false);
  assert.equal(await page.evaluate(() => document.getElementById('start').scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'artifacts/layout/vr-entry-mobile.png' });
  await page.locator('#btn-pingpong').click();
  await page.waitForFunction(() => window.__app?.gameId === 'pingpong' && !window.__app.loading);
  assert.equal(await page.evaluate(() => window.__app.mode), 'cardboard');
  assert.deepEqual(errors, []);
  console.log('Compact VR entry, session Gemini setup, mocked calibration and VR ping-pong launch pass.');
} catch (error) { console.error('Browser errors:', errors); throw error; }
finally { await browser.close(); }
