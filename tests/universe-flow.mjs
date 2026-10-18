import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.UNIVERSE_URL || 'http://127.0.0.1:8081/?auto=flat&game=universe', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__app?.gameId === 'universe' && window.__app?.game?.state?.bodies.length === 3);
  await page.evaluate(() => window.__app.menu.toggle(false));
  await page.waitForTimeout(300);
  const screenPoint = await page.evaluate(() => {
    const app = window.__app, planet = app.game.state.bodies.find(body => body.type === 'planet');
    const object = app.root.getObjectByName(`celestial-${planet.id}`);
    app.scene.updateMatrixWorld(true);
    const v = object.getWorldPosition(object.position.clone()).project(app.camera);
    return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
  });
  await page.mouse.click(screenPoint.x, screenPoint.y);
  await page.waitForFunction(() => !!window.__app?.game?.state?.selectedBodyId);
  const edited = await page.evaluate(() => {
    const game = window.__app.game, id = game.state.selectedBodyId;
    const before = game.state.bodies.find(body => body.id === id).mass;
    game.editSelected('mass-up'); game.update(0);
    const trajectory = window.__app.root.getObjectByName('universe-trajectory');
    return { type: game.state.bodies.find(body => body.id === id).type,
      before, after: game.state.bodies.find(body => body.id === id).mass,
      panel: game.state.selectedBodyId === id && !!window.__app.root.getObjectByName('universe-selection')?.visible,
      trajectory: trajectory?.visible && trajectory.geometry.drawRange.count > 2 };
  });
  if (edited.type !== 'planet' || !(edited.after > edited.before) || !edited.panel || !edited.trajectory) throw Error(JSON.stringify(edited));
  if (process.env.UNIVERSE_SCREENSHOT) await page.screenshot({ path: process.env.UNIVERSE_SCREENSHOT });
  const closePoint = await page.evaluate(() => {
    const app = window.__app;
    app.scene.updateMatrixWorld(true);
    const v = app.hud.objectiveClose.getWorldPosition(app.hud.objectiveClose.position.clone()).project(app.camera);
    return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
  });
  await page.mouse.click(closePoint.x, closePoint.y);
  await page.waitForFunction(() => window.__app?.hud?.objectiveDismissed);
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Universe: seleção 3D, edição física e fechamento rápido do objetivo no navegador OK');
} finally { await browser.close(); }
