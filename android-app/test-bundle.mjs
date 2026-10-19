// Runs the bundled www/ the way the APK does (Capacitor flag, localhost origin) with every CDN blocked.
// Usage: serve android-app/www on localhost (e.g. `python -m http.server 8092`), then `node android-app/test-bundle.mjs`.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.BUNDLE_URL || 'http://localhost:8092';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 860, height: 412 }, isMobile: true, hasTouch: true, permissions: ['camera'] });
const external = [];
await context.route(/^https:\/\/(cdn\.jsdelivr\.net|storage\.googleapis\.com|unpkg\.com)\//, route => { external.push(route.request().url()); route.abort(); });
await context.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(base + '/?auto=cardboard');
  await page.waitForFunction(() => window.__app?.game && !window.__app.loading, null, { timeout: 40000 });
  const tiles = await page.evaluate(() => window.__app.menu.libraryTiles.length);
  // The real hand pipeline (camera -> worker -> MediaPipe), as in the APK: it must run in the worker, not the slow fallback.
  const tracker = await page.evaluate(async () => {
    const app = window.__app, t0 = performance.now(); await app.enableHands({ facing: 'environment', gemini: false });
    const h = app.hands; return { mode: h?.mode, running: !!h?.running, status: h?.status, error: app.handError || null, readyMs: Math.round(performance.now() - t0) };
  });
  assert.equal(tracker.mode, 'worker', 'hand tracking fell back to the main thread: ' + JSON.stringify(tracker));
  assert.equal(tracker.running, true, JSON.stringify(tracker));
  const frames = await page.waitForFunction(() => window.__app.hands.detectMs > 0, null, { timeout: 15000 }).then(() => page.evaluate(() => Math.round(window.__app.hands.detectMs)), () => null);
  assert.ok(frames != null, 'the worker never returned a detection result');
  await page.goto(base + '/auraos-xr.html?exp=chem&mode=cardboard');
  await page.waitForFunction(() => window.__aura?.Engine.cur?.id === 'chem' && window.__aura.CARD.on, null, { timeout: 30000 });
  const hands = await page.evaluate(async () => {
    const vision = await import('/vendor/mediapipe/tasks-vision/vision_bundle.mjs');
    const fileset = await vision.FilesetResolver.forVisionTasks(location.origin + '/vendor/mediapipe/tasks-vision/wasm');
    const lm = await vision.HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: '/vendor/mediapipe/hand_landmarker.task', delegate: 'CPU' }, runningMode: 'IMAGE', numHands: 2 });
    const ok = typeof lm.detect === 'function'; lm.close(); return ok;
  });
  assert.equal(tiles, 46); assert.equal(hands, true);
  assert.deepEqual(external, [], 'bundle must not fetch from a CDN');
  assert.deepEqual(errors, []);
  console.log(`bundle OK: BlueNav (${tiles} jogos), mãos no worker em ${tracker.readyMs} ms (${frames} ms por quadro), AuraOS em VR Box, tudo sem CDN`);
} finally { await browser.close(); }
