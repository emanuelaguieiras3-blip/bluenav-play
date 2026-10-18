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
  console.log(`bundle OK: BlueNav (${tiles} jogos na Biblioteca), AuraOS em VR Box e MediaPipe das mãos carregam sem CDN`);
} finally { await browser.close(); }
