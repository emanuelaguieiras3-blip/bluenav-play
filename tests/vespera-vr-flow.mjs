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
  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.VesperaVR);
  const state = await page.evaluate(() => ({
    vrButton: document.getElementById('vr-toggle')?.textContent,
    controls: window.VesperaVR?.controls.length,
    monsters: ['duneWraith', 'glacierHound'].map(id => !!window.Vespera?.monsterTypes?.[id]),
  }));
  if (errors.length || state.vrButton !== 'Entrar em VR' || state.controls !== 8 || state.monsters.some(v => !v)) {
    throw Error(JSON.stringify({ errors, state }));
  }
  console.log('Véspera: VR loads; 8 hand targets and 2 monsters registered');
} finally { await browser.close(); }
