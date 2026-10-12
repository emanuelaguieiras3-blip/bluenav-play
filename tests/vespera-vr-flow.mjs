import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'xr', { configurable: true, value: {
    isSessionSupported: async () => true,
    requestSession: async () => { throw Error('Mock does not start a headset session'); },
  } });
});
try {
  await page.goto(process.env.VESPERA_URL || 'http://127.0.0.1:8081/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.VesperaVR);
  const state = await page.evaluate(() => ({
    vrButton: document.getElementById('vr-toggle')?.textContent,
    controls: window.VesperaVR?.controls.length,
    monsters: ['duneWraith', 'glacierHound'].map(id => !!window.Vespera?.monsterTypes?.[id]),
  }));
  if (errors.length || state.vrButton !== 'Entrar em VR' || state.controls !== 8 || state.monsters.some(v => !v)) {
    throw Error(JSON.stringify({ errors, state }));
  }
  await page.waitForFunction(() => !!window.GameSession);
  await page.evaluate(() => document.getElementById('new-game').click());
  const creation = await page.evaluate(() => ({ name: !!document.getElementById('player-name'),
    overlay: document.getElementById('overlay')?.className, modal: document.getElementById('modal-body')?.textContent?.slice(0, 100) }));
  if (!creation.name) throw Error(`Criação não abriu: ${JSON.stringify(creation)}`);
  await page.locator('#player-name').fill('TesteVR');
  await page.evaluate(() => document.getElementById('start-solo').click());
  await page.waitForTimeout(750);
  const started = await page.evaluate(() => ({ playing: window.GameSession?.playing,
    player: !!window.GameSession?.player, error: document.getElementById('creation-error')?.textContent,
    home: document.getElementById('home')?.className }));
  if (!started.playing || !started.player) throw Error(`Partida não iniciou: ${JSON.stringify(started)}`);
  const spatial = await page.evaluate(() => {
    window.VesperaVR.spatialWorld.update(1 / 60);
    const root = window.VesperaVR.spatialWorld.root;
    return { visible: root.visible, meshes: root.children.filter(child => child.isMesh).length,
      player: !!window.GameSession.player, position: root.position.toArray() };
  });
  if (errors.length || !spatial.visible || spatial.meshes < 5 || !spatial.player || spatial.position.some(x => !Number.isFinite(x))) {
    throw Error(JSON.stringify({ errors, spatial }));
  }
  console.log('Véspera: VR loads; 3D world follows a live game; 8 hand targets and 2 monsters registered');
} finally { await browser.close(); }
