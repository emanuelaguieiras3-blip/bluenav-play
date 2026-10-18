import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
await page.emulateMedia({ reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  window.xrRequests = 0;
  Object.defineProperty(navigator, 'xr', { configurable: true, value: {
    isSessionSupported: async () => true,
    requestSession: async () => { window.xrRequests++; throw new DOMException('Permission denied by test', 'NotAllowedError'); },
  } });
});
try {
  await page.goto(process.env.VESPERA_URL || 'http://127.0.0.1:8081/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.VesperaVR);
  if (await page.locator('#vespera-vr-canvas').isVisible()) throw Error('VR canvas covers setup before session starts');
  const state = await page.evaluate(() => ({
    vrButton: document.getElementById('vr-toggle')?.textContent,
    controls: window.VesperaVR?.controls.length,
    monsters: ['duneWraith', 'glacierHound'].map(id => !!window.Vespera?.monsterTypes?.[id]),
  }));
  if (errors.length || state.vrButton !== 'Entrar em VR' || state.controls !== 8 || state.monsters.some(v => !v)) {
    throw Error(JSON.stringify({ errors, state }));
  }
  await page.waitForFunction(() => !!window.GameSession);
  await page.locator('#vr-toggle').click();
  const unprepared = await page.evaluate(() => ({ requests: window.xrRequests, status: document.getElementById('vr-status').textContent }));
  if (unprepared.requests || !unprepared.status.includes('aventura antes')) throw Error(JSON.stringify({ unprepared }));
  await page.locator('#new-game').click();
  const creation = await page.evaluate(() => ({ name: !!document.getElementById('player-name'),
    overlay: document.getElementById('overlay')?.className, modal: document.getElementById('modal-body')?.textContent?.slice(0, 100) }));
  if (!creation.name) throw Error(`Criação não abriu: ${JSON.stringify(creation)}`);
  await page.locator('#player-name').fill('TesteVR');
  await page.locator('#start-solo').click();
  await page.waitForTimeout(750);
  const started = await page.evaluate(() => ({ playing: window.GameSession?.playing,
    player: !!window.GameSession?.player, error: document.getElementById('creation-error')?.textContent,
    home: document.getElementById('home')?.className }));
  if (!started.playing || !started.player) throw Error(`Partida não iniciou: ${JSON.stringify(started)}`);
  await page.locator('#vr-toggle').click();
  await page.waitForFunction(() => document.getElementById('vr-status').textContent.includes('Permissão recusada'));
  const denied = await page.evaluate(() => ({ requests: window.xrRequests, active: window.VesperaVR.active,
    retry: document.getElementById('vr-toggle').textContent, canvas: document.getElementById('vespera-vr-canvas').style.display }));
  if (denied.requests !== 1 || denied.active || denied.retry !== 'Entrar em VR' || denied.canvas === 'block') throw Error(JSON.stringify({ denied }));
  const spatial = await page.evaluate(() => {
    window.VesperaVR.spatialWorld.update(1 / 60);
    const root = window.VesperaVR.spatialWorld.root;
    return { visible: root.visible, meshes: root.children.filter(child => child.isMesh).length,
      player: !!window.GameSession.player, position: root.position.toArray() };
  });
  if (errors.length || !spatial.visible || spatial.meshes < 5 || !spatial.player || spatial.position.some(x => !Number.isFinite(x))) {
    throw Error(JSON.stringify({ errors, spatial }));
  }
  await page.evaluate(() => Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined }));
  await page.locator('#vr-phone-toggle').click();
  await page.waitForFunction(() => window.VesperaVR.phone.active);
  const phone = await page.evaluate(() => {
    const active = window.VesperaVR.active;
    window.VesperaVR.exitVR();
    return { active, stopped: !window.VesperaVR.active, hidden: document.getElementById('vespera-vr-canvas').style.display === 'none' };
  });
  if (!phone.active || !phone.stopped || !phone.hidden || errors.length) throw Error(JSON.stringify({ phone, errors }));
  console.log('Véspera: spatial world loads; VR Box enters and exits without WebXR; state stays in the RPG');
} finally { await browser.close(); }
