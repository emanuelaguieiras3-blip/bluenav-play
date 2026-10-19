import { chromium } from '@playwright/test';

// PC mode: HTML controls over the 3D view, keyboard flight and the black-hole spectacle.
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.UNIVERSE_URL || 'http://127.0.0.1:8081/?auto=flat&game=universe', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__app?.gameId === 'universe' && window.__app?.game?.state?.bodies.length === 3);
  await page.evaluate(() => window.__app.menu.toggle(false));
  await page.locator('[data-universe-ui="pc"]').waitFor();
  await page.getByRole('button', { name: 'Exóticos' }).click();
  await page.locator('[data-type="blackhole"]').click();
  const picked = await page.evaluate(() => ({ selected: window.__app.game.state.selected, tool: window.__app.game.state.tool }));
  if (picked.selected !== 'blackhole' || picked.tool !== 'create') throw Error(JSON.stringify(picked));
  await page.mouse.click(640, 250);
  await page.waitForFunction(() => window.__app.game.state.bodies.some(body => body.type === 'blackhole'));

  const before = await page.evaluate(() => window.__app.rig.position.z);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__app.rig.position.z);
  if (!(after < before - 0.5)) throw Error(`W não voou: ${before} → ${after}`);

  await page.getByRole('button', { name: 'Sistemas' }).click();
  await page.getByRole('button', { name: 'Estrela vs buraco negro' }).click();
  await page.waitForFunction(() => {
    const disk = window.__app.root.getObjectByName('universe-accretion');
    if (!disk) return false;
    const alpha = disk.geometry.attributes.color.array;
    let visible = 0;
    for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 0.2) visible++;
    return visible > 40;
  }, null, { timeout: 15000 });

  const star = await page.evaluate(() => {
    const app = window.__app, body = app.game.state.bodies.find(item => item.type === 'star');
    app.scene.updateMatrixWorld(true);
    const object = app.root.getObjectByName(`celestial-${body.id}`), v = object.getWorldPosition(object.position.clone()).project(app.camera);
    return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
  });
  await page.getByRole('button', { name: 'Ferram.' }).click();
  await page.getByRole('button', { name: 'Selecionar' }).click();
  await page.mouse.click(star.x, star.y);
  await page.locator('.uvs-inspector:not([hidden])').waitFor();
  const rigBefore = await page.evaluate(() => window.__app.rig.position.toArray());
  await page.getByLabel('Nome do astro').fill('Vesper wasd');
  await page.getByLabel('Nome do astro').press('Enter');
  const named = await page.evaluate(() => window.__app.game.state.bodies.find(body => body.id === window.__app.game.state.selectedBodyId)?.name);
  const rigAfter = await page.evaluate(() => window.__app.rig.position.toArray());
  if (named !== 'Vesper wasd') throw Error(`nome: ${named}`);
  if (rigAfter.some((value, i) => Math.abs(value - rigBefore[i]) > 0.05)) throw Error('digitar o nome moveu o jogador');
  if (process.env.UNIVERSE_SCREENSHOT) await page.screenshot({ path: process.env.UNIVERSE_SCREENSHOT });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Universe PC: interface HTML, voo por teclado, disco de acreção e renomear OK');
} finally { await browser.close(); }
