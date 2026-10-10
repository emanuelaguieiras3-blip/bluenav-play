import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 700 }, isMobile: true, hasTouch: true });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
await context.addInitScript(() => {
  for (const p of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const original = p.getExtension;
    p.getExtension = function(name) { return name === 'KHR_parallel_shader_compile' ? null : original.call(this, name); };
  }
});
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:8080/?auto=flat&game=lobby&fakehand=one');
  await page.waitForFunction(() => window.__app?.game && !window.__app.loading);
  const report = await page.evaluate(async () => {
    const THREE = await import('three');
    const { HandTracker } = await import('/src/hands/handTracker.js');
    const { Input } = await import('/src/core/input.js');
    const app = window.__app;
    app.renderer.setAnimationLoop(null); app.mode = 'cardboard'; app.resize();
    app.menu.open = false; app.keyboard.group.visible = false;
    const video = document.createElement('video');
    Object.defineProperties(video, { videoWidth: { value: 960 }, videoHeight: { value: 540 } });
    app.passthrough.attach(video); app.passthrough.on = true;
    const tracker = new HandTracker(); tracker.running = true; tracker.video = video; tracker.gemini.enabled = false;
    tracker.hfovProvider = () => app.passthrough.displayHFOV;
    tracker.onFrame = frame => app.passthrough.presentFrame(frame); app.hands = tracker;
    app.input = new Input(app);
    const world = [{ x: 0, y: -0.06, z: 0 }];
    for (let f = 0; f < 5; f++) for (let j = 0; j < 4; j++) world.push({
      x: f === 0 ? -0.035 - j * 0.014 : (f - 2) * 0.021,
      y: f === 0 ? -0.03 + j * 0.012 : [0, 0.03, 0.055, 0.075][j], z: -j * 0.002,
    });
    const reports = [];
    for (const shift of [0, 0.09, -0.09]) {
      await new Promise(resolve => setTimeout(resolve, 34)); // realistic 30 Hz capture timestamps
      const landmarks = world.map(p => ({ x: 0.5 + p.x * 2 + shift, y: 0.5 - p.y * 3, z: p.z }));
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#182027'; ctx.fillRect(0, 0, 960, 540);
      ctx.strokeStyle = '#5ba2ba'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      for (let f = 0; f < 5; f++) {
        ctx.beginPath(); ctx.moveTo(landmarks[0].x * 960, landmarks[0].y * 540);
        for (let j = 0; j < 4; j++) { const p = landmarks[1 + f * 4 + j]; ctx.lineTo(p.x * 960, p.y * 540); }
        ctx.stroke();
      }
      for (const p of landmarks) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x * 960, p.y * 540, 2, 0, Math.PI * 2); ctx.fill(); }
      const bitmap = await createImageBitmap(canvas);
      const res = { landmarks: [landmarks], worldLandmarks: [world], handednesses: [[{ categoryName: 'Left', score: 0.99 }]] };
      if (!reports.length) for (let i = 0; i < 12; i++) tracker._process(res, 1 / 30, performance.now() - (12 - i) * 33);
      tracker._onResult({ t: performance.now(), ms: 20, bitmap, res });
      // Isolate ray geometry from the classifier's gesture debounce.
      tracker.hands[0].gesto = 'apontando';
      app.input.update(1 / 60); app.handView.update(app.input); app.ui.update(1 / 60, app.input);
      app.passthrough.update(1); app.stereo.render(app.scene, app.camera, app.passthrough.k > 0.001);
      let maxPixelError = 0;
      for (const eye of [app.stereo.stereo.cameraL, app.stereo.stereo.cameraR]) for (let i = 0; i < 21; i++) {
        const p = landmarks[i];
        const pixel = new THREE.Vector3(p.x - 0.5, 0.5 - p.y, 0).applyMatrix4(app.passthrough.mesh.matrixWorld).project(eye);
        const joint = app.input.hands[0].points[i].clone().project(eye);
        maxPixelError = Math.max(maxPixelError, Math.hypot((pixel.x - joint.x) * 300, (pixel.y - joint.y) * 350));
      }
      const state = app.ui.states.get(app.input.pointers[0].id), a = state.line.geometry.attributes.position;
      const ray = app.input.pointers[0].ray;
      const start = new THREE.Vector3().fromBufferAttribute(a, 0), end = new THREE.Vector3().fromBufferAttribute(a, 1);
      reports.push({ shift, maxPixelError, rayOriginError: start.distanceTo(app.input.hands[0].tip),
        rayCollinearityError: end.sub(start).cross(ray.direction).length(), eyeSep: app.stereo.stereo.eyeSep,
        synchronizedTexture: app.passthrough.mesh.material.map === app.passthrough.frameTexture, lineVisible: state.line.visible });
    }
    return reports;
  });
  for (const frame of report) {
    assert.ok(frame.maxPixelError < 0.01, JSON.stringify(frame));
    assert.ok(frame.rayOriginError < 1e-6, JSON.stringify(frame)); assert.ok(frame.rayCollinearityError < 1e-6, JSON.stringify(frame));
    assert.equal(frame.eyeSep, 0); assert.equal(frame.synchronizedTexture, true);
    assert.equal(frame.lineVisible, true);
  }
  assert.deepEqual(errors, []);
  await mkdir('artifacts/alignment', { recursive: true });
  await page.screenshot({ path: 'artifacts/alignment/stereo.png' });
  await writeFile('artifacts/alignment/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ frames: report, errors }));
} finally { await browser.close(); }
