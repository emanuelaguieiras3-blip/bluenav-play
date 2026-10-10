import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const real = process.argv.includes('--real');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  const relative = route.request().url().split('/three@0.160.0/')[1];
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', relative)), contentType: 'text/javascript' });
});
await context.addInitScript(() => {
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const original = prototype.getExtension;
    prototype.getExtension = function(name) { return name === 'KHR_parallel_shader_compile' ? null : original.call(this, name); };
  }
});
if (!real) {
  await context.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Embedded player test</body></html>' }));
  await context.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType: 'text/javascript', body: `
    window.YT = { Player: class {
      constructor(frame, options) { this.frame = frame; this.options = options; this.state = 0; this.time = 0;
        setTimeout(() => options.events.onReady({ target: this }), 5); }
      setVolume(value) { this.volume = value; } mute() { this.muted = true; } unMute() { this.muted = false; }
      playVideo() { this.state = 1; this.options.events.onStateChange({ data: 1 }); } pauseVideo() { this.state = 2; }
      getPlayerState() { return this.state; } getCurrentTime() { return this.time; } seekTo(time) { this.time = time; }
      destroy() { this.frame.remove(); }
    }}; window.onYouTubeIframeAPIReady();` }));
}
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:8080/?auto=flat');
  try { await page.waitForFunction(() => window.__app?.game && !window.__app.loading); }
  catch (error) { console.log('Startup diagnostics:', errors, await page.evaluate(() => ({ status: document.querySelector('#status').textContent, app: !!window.__app, game: window.__app?.gameId, loading: window.__app?.loading }))); throw error; }
  await page.evaluate(() => { window.__app.playVideo({ id: 'M7lc1UVf-VE', title: 'YouTube IFrame API demo', thumb: '' }); });
  await page.waitForFunction(() => !document.querySelector('#video-layer').hidden && document.querySelector('#video-slots iframe'));
  assert.match(await page.locator('#video-slots iframe').getAttribute('src'), /youtube\.com\/embed\/M7lc1UVf-VE/);
  assert.equal(new URL(page.url()).hostname, '127.0.0.1');
  if (real) {
    await page.waitForFunction(() => window.__app.video.players[0]?.getPlayerState?.() === 1 || document.querySelector('#video-status').textContent.includes('não'), null, { timeout: 20000 }).catch(() => {});
    await page.getByRole('button', { name: 'Reproduzir / ativar som' }).click();
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Real YouTube:', await page.evaluate(() => ({ state: window.__app.video.players[0]?.getPlayerState?.(), time: window.__app.video.players[0]?.getCurrentTime?.(), status: document.querySelector('#video-status').textContent })));
  } else {
    await page.waitForFunction(() => window.__app.video.players[0]?.getPlayerState() === 1);
    await page.getByRole('button', { name: 'Voltar ao VR', exact: true }).click();
    assert.equal(await page.locator('#video-slots iframe').count(), 0);
    await page.evaluate(() => { window.__app.mode = 'cardboard'; window.__app.playVideo({ id: 'M7lc1UVf-VE', title: 'Stereo', thumb: '' }); });
    await page.waitForFunction(() => window.__app.video.players.length === 2 && window.__app.video.players.every(p => p.state === 1));
    assert.equal(await page.locator('#video-slots iframe').count(), 2);
    assert.equal(await page.evaluate(() => window.__app.video.players[1].muted), true);
    await page.getByRole('button', { name: 'Reproduzir / ativar som' }).click();
    assert.equal(await page.evaluate(() => window.__app.video.players[0].muted), false);
    // Closing while SDK loading must not recreate a player afterwards.
    await page.evaluate(() => { window.__app.video.play({ id: 'M7lc1UVf-VE', title: 'Race' }); window.__app.video.close(); });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#video-slots iframe').count(), 0);
    assert.equal(await page.evaluate(() => window.__app.video.players.length), 0);
    assert.deepEqual(errors, []); console.log('YouTube integration passed: embedded playback, stereo, audio activation, close and cancellation.');
  }
  await mkdir('artifacts/youtube', { recursive: true }); await page.screenshot({ path: `artifacts/youtube/${real ? 'real' : 'mock'}.png` });
} finally { await browser.close(); }
