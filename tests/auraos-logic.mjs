import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.AURA_URL || 'http://127.0.0.1:8084/auraos-xr.html';
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 640, height: 400 } });
await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
  await route.fulfill({ body: await readFile(path.resolve('node_modules/three', route.request().url().split('/three@0.160.0/')[1])), contentType: 'text/javascript' });
});
const page = await context.newPage(), errors = [], fails = [];
page.on('pageerror', e => errors.push(e.message));
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const load = async id => { await page.evaluate(id => window.__aura.Engine.load(id), id); await page.waitForTimeout(300); };
// Advance the current module by fixed time steps, independent of the machine's frame rate.
const advance = seconds => page.evaluate(seconds => { const e = window.__aura.Engine; for (let t = 0; t < seconds && e.inst?.update; t += 1 / 30) { e.ctx.t += 1 / 30; e.inst.update(1 / 30, e.ctx.t); } }, seconds);
const waitFor = (fn, ms) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
try {
  await page.goto(base + '?desk=1');
  await page.waitForFunction(() => window.__aura?.Engine.state === 'hub', { timeout: 30000 });
  await page.evaluate(() => { window.__aura.settings.tutorial = false; });

  // Kinetix: a triangulated truss carries the load; a bare deck does not.
  const bridge = async truss => {
    await load('kinetix');
    await page.evaluate(truss => {
      const { api } = window.__aura.Engine.inst, [L1, L2, R1, R2] = api.anchors, top = [L1], bot = [L2];
      for (const x of [-0.15, 0, 0.15]) top.push(api.addNode(x, 1.1)); top.push(R1);
      for (let i = 0; i < top.length - 1; i++) api.addBeam(top[i], top[i + 1]);
      if (truss) { for (const x of [-0.225, -0.075, 0.075, 0.225]) bot.push(api.addNode(x, 1.0)); bot.push(R2);
        for (let i = 0; i < bot.length - 1; i++) api.addBeam(bot[i], bot[i + 1]);
        for (let i = 1; i < bot.length - 1; i++) { api.addBeam(bot[i], top[i - 1]); api.addBeam(bot[i], top[i]); } }
      api.startTest();
    }, truss);
    await waitFor(() => { const e = window.__aura.Engine; return e.ctx.done || !e.inst.api.load; }, 60000);
    return page.evaluate(() => ({ done: window.__aura.Engine.ctx.done, ok: window.__aura.HUD.st.result?.ok ?? false, collapsed: window.__aura.Engine.inst.api.collapsed, broken: window.__aura.Engine.inst.api.beams.filter(b => b.broken).length, maxRatio: Math.max(0, ...window.__aura.Engine.inst.api.beams.map(b => b.ratio || 0)).toFixed(2) }));
  };
  const strong = await bridge(true); check(strong.done && strong.ok, `kinetix truss carries load ${JSON.stringify(strong)}`);
  const weak = await bridge(false); check(!weak.ok && weak.collapsed, `kinetix bare deck collapses ${JSON.stringify(weak)}`);

  // SpellWeaver gesture classifier on synthetic strokes drawn in the view plane.
  await load('spell');
  const shapes = await page.evaluate(() => {
    const { classify } = window.__aura.Engine.inst.api, V = window.__aura.hands.right.pinchPos.constructor, z = -0.5, y0 = 1.4;
    const circle = Array.from({ length: 48 }, (_, i) => new V(Math.cos(i / 47 * Math.PI * 2) * 0.1, y0 + Math.sin(i / 47 * Math.PI * 2) * 0.1, z));
    const tri = [], P = [[0, 0.12], [0.1, -0.06], [-0.1, -0.06], [0, 0.12]]; for (let s = 0; s < 3; s++) for (let i = 0; i < 16; i++) { const a = P[s], b = P[s + 1], t = i / 16; tri.push(new V(a[0] + (b[0] - a[0]) * t, y0 + a[1] + (b[1] - a[1]) * t, z)); } tri.push(new V(0, y0 + 0.12, z));
    const zz = [], Z = [[-0.12, 0.08], [0.0, 0.03], [-0.04, -0.02], [0.12, -0.08]]; for (let s = 0; s < 3; s++) for (let i = 0; i < 16; i++) { const a = Z[s], b = Z[s + 1], t = i / 16; zz.push(new V(a[0] + (b[0] - a[0]) * t, y0 + a[1] + (b[1] - a[1]) * t, z)); } zz.push(new V(0.12, y0 - 0.08, z));
    return { circle: classify(circle), tri: classify(tri), zig: classify(zz) };
  });
  check(shapes.circle === 'fire' && shapes.tri === 'ice' && shapes.zig === 'bolt', `spell classifier ${JSON.stringify(shapes)}`);

  // AeroDynamics: each flight regime advances when held for 2.5 s.
  await load('aero');
  for (const [a, m, stage] of [[0.02, 0.04, 1], [0.08, 0.06, 2], [0.127, 0, 3]]) {
    await page.evaluate(([a, m]) => window.__aura.Engine.inst.api.set(a, m), [a, m]);
    const st = await page.evaluate(() => window.__aura.Engine.inst.api.state);
    await advance(3);
    const ok = await page.waitForFunction(s => window.__aura.Engine.ctx.done || window.__aura.HUD.st.extra?.startsWith(['', 'Descolagem', 'Planador', ''][s]), stage, { timeout: 20000 }).then(() => true, () => false);
    check(ok, `aero regime ${stage} (CL ${st.CL.toFixed(2)}, L/D ${st.LD.toFixed(0)})`);
  }
  check(await page.evaluate(() => window.__aura.Engine.ctx.done && window.__aura.HUD.st.result?.ok), 'aero completes after 3 regimes');
  await page.evaluate(() => window.__aura.Engine.inst.api.set(0.08, 0.06)); check((await page.evaluate(() => window.__aura.Engine.inst.api.state.LD)) < 54, 'aero takeoff setting does not satisfy glider regime');

  // ShadowWire: aligning the coupled rings unlocks the core.
  await load('shadow');
  const unlocked = await page.evaluate(async () => {
    const api = window.__aura.Engine.inst.api, r = api.rings, w = a => Math.atan2(Math.sin(a), Math.cos(a));
    api.turn(2, -w(r[2].ang)); api.turn(1, -w(r[1].ang)); api.turn(0, -w(r[0].ang));
    await new Promise(res => setTimeout(res, 400)); return api.unlocked;
  });
  check(unlocked, 'shadowwire rings align and unlock core');

  // NeuralNet: default route crosses the infected neuron; cutting it reroutes pulses.
  await load('neural');
  const net = await page.evaluate(() => {
    const api = window.__aura.Engine.inst.api, before = api.path().map(n => n.i);
    api.edges.filter(e => e.a.i === 5 || e.b.i === 5).forEach(e => api.cut(e));
    return { before, after: api.path()?.map(n => n.i) };
  });
  check(net.before.includes(5) && net.after && !net.after.includes(5), `neuralnet reroute ${JSON.stringify(net)}`);
  await advance(6.5); const iso = await page.evaluate(() => !window.__aura.Engine.inst.api.N[5].inf);
  check(iso, 'neuralnet isolated virus is cleared');

  if (errors.length) fails.push(...errors);
  if (fails.length) throw Error(fails.join('\n'));
  console.log('AuraOS logic checks: OK');
} finally { await browser.close(); }
