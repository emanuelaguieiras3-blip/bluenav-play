import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 900, height: 600 }, permissions: ['camera'], isMobile: true, hasTouch: true });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:8084');
  await page.waitForFunction(async () => (await import('./config.js')).CONFIG.GEMINI_PROXY_URL === '/api/gemini');
  await page.locator('#camera-setup summary').click();
  await page.locator('#camera-test').click();
  await page.waitForFunction(() => Number(document.getElementById('camera-test-status').textContent.match(/(\d+) quadros/)?.[1]) > 5, null, { timeout: 30000 })
    .catch(async error => { console.error('Preview:', await page.locator('#camera-test-status').textContent(), 'Errors:', errors); throw error; });
  assert.ok(await page.locator('#camera-preview').isVisible());
  assert.match(await page.locator('#camera-test-status').textContent(), /câmera ativa/);
  await page.locator('#chk-hands').check();
  await page.locator('#btn-cardboard').click();
  await page.waitForFunction(() => window.__app?.hands?.frameCount > 5, null, { timeout: 90000 });
  const report = await page.evaluate(() => ({ running: __app.hands.running, frames: __app.hands.frameCount,
    videoWidth: __app.hands.video.videoWidth, videoHeight: __app.hands.video.videoHeight,
    mode: __app.hands.mode, status: __app.hands.status, error: __app.handError }));
  assert.equal(report.running, true);
  assert.ok(report.frames > 5 && report.videoWidth > 0 && report.videoHeight > 0);
  assert.ok(['worker', 'main'].includes(report.mode));
  assert.equal(report.error, null);
  await page.evaluate(() => window.__app.toggleHands());
  assert.equal(await page.evaluate(() => window.__app.hands), null);
  await page.evaluate(() => window.__app.toggleHands());
  await page.waitForFunction(() => window.__app?.hands?.frameCount > 3, null, { timeout: 90000 });
  assert.deepEqual(errors, []);
  console.log(`Camera and MediaPipe: ${report.mode}, ${report.frames} frames, ${report.videoWidth}x${report.videoHeight}, ${report.status}`);
} finally { await browser.close(); }
