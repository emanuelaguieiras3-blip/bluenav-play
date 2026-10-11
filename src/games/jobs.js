import { std } from './common.js';
import { RigidWorld, grabbable } from './rigidWorld.js';

export default {
  id: 'jobs',
  create(ctx) {
    ctx.lookDown();
    const { THREE, root, tex, env, audio } = ctx;
    env.set({ top: '#b5d5df', horizon: '#eff4e7', bottom: '#879a8b', hemi: ['#fff9e8', '#9fa995', 1.7], sun: ['#fff1dc', 1.1] });
    const world = new RigidWorld({ limit: 18 });
    const build = (size, position, texture, color = '#ffffff') => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), std({ map: tex.get(texture), color })); m.position.set(...position); root.add(m); world.box(position, size); return m;
    };
    build([8, 0.12, 8], [0, -0.06, 0], 'kitchenTile');
    build([2.5, 0.12, 1.2], [0, 0.76, -0.95], 'woodMedium');
    for (const x of [-1.05, 1.05]) build([0.12, 0.7, 0.9], [x, 0.35, -0.95], 'brushedMetal');
    build([7, 3.2, 0.12], [0, 1.6, -3.5], 'kitchenTile');
    const names = ['Documento', 'Pacote', 'Copo'], textures = ['fabric', 'woodLight', 'brushedMetal'], colors = ['#77b9ff', '#ffc05e', '#8be7a0'];
    const items = [];
    for (let i = 0; i < 9; i++) {
      const kind = i % 3, size = kind === 0 ? [0.18, 0.035, 0.22] : kind === 1 ? [0.15, 0.15, 0.15] : [0.09, 0.12, 0.09];
      const mesh = new THREE.Mesh(kind === 2 ? new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12) : new THREE.BoxGeometry(...size), std({ map: tex.get(textures[kind]), color: colors[kind] }));
      mesh.position.set(-0.85 + kind * 0.85, 0.88 + Math.floor(i / 3) * 0.17, -0.9); root.add(mesh);
      const body = grabbable(ctx, world, world.add(mesh, { size, mass: kind === 1 ? 1 : 0.2, bounce: 0.08 }));
      items.push({ body, kind, done: false, prepared: false, dwell: 0, stationDwell: 0, station: -1 });
    }
    const operations = ['Carimbar', 'Pesar', 'Encher'];
    const stations = operations.map((_, i) => {
      const x = -0.65 + i * 0.65, z = -0.52;
      build([0.42, 0.025, 0.25], [x, 0.835, z], 'brushedMetal', colors[i]);
      return new THREE.Vector3(x, 0.88, z);
    });
    const bins = names.map((name, i) => {
      const x = -0.65 + i * 0.65, z = -1.27;
      build([0.44, 0.03, 0.35], [x, 0.85, z], 'rubber', colors[i]);
      for (const side of [-1, 1]) build([0.025, 0.12, 0.35], [x + side * 0.22, 0.92, z], 'woodLight', colors[i]);
      const label = ctx.label(name, { w: 0.4, h: 0.07 }); label.position.set(x, 1.38, z); root.add(label);
      return new THREE.Vector3(x, 0.9, z);
    });
    let delivered = 0, prepared = 0, mistakes = 0, feedback = 'Solte o item na estação. Toque no botão.';
    const operate = (station) => {
      const item = items.find(i => !i.done && !i.prepared && !i.body.held && i.station === station && i.stationDwell >= 0.25);
      if (!item) { feedback = 'Solte um item nesta estação.'; return; }
      item.stationDwell = 0;
      if (station === item.kind) {
        item.prepared = true; prepared++; item.body.mesh.material.emissive?.set(colors[item.kind]);
        item.body.mesh.material.emissiveIntensity = 0.18;
        audio.success(); feedback = `${names[item.kind]} pronto. Entregue.`;
      } else {
        mistakes++; item.body.mesh.position.copy(item.body.origin); item.body.velocity.set(0, 0, 0); item.station = -1;
        audio.thud(); feedback = `Use ${operations[item.kind]} para ${names[item.kind].toLowerCase()}.`;
      }
    };
    stations.forEach((station, i) => {
      const button = ctx.button({ label: operations[i], w: 0.34, h: 0.075, onClick: () => operate(i) });
      button.position.set(station.x * 0.87, 1.12, station.z); root.add(button);
    });
    const reset = () => { world.reset(); delivered = prepared = mistakes = 0; for (const item of items) { item.done = item.prepared = false; item.dwell = item.stationDwell = 0; item.station = -1; item.body.mesh.material.emissive?.set('#000000'); } feedback = 'Novo turno iniciado'; };
    const b = ctx.button({ label: 'Novo turno', w: 0.28, h: 0.08, onClick: reset }); b.position.set(0, 1.62, -1.3); root.add(b);
    return { world, reset, operate, getState: () => ({ delivered, prepared, mistakes }), update(dt) {
      world.update(dt);
      for (const item of items) {
        if (item.done || item.body.held) { item.dwell = item.stationDwell = 0; item.station = -1; continue; }
        const p = item.body.mesh.position, settled = item.body.velocity.length() < 0.2;
        const station = stations.findIndex(c => Math.abs(p.x - c.x) < 0.16 && Math.abs(p.z - c.z) < 0.1 && p.y > 0.84 && p.y < 1.08);
        item.stationDwell = !item.prepared && station >= 0 && settled ? (station === item.station ? item.stationDwell + dt : dt) : 0;
        item.station = station;
        const bin = bins.findIndex(c => Math.abs(p.x - c.x) < 0.17 && Math.abs(p.z - c.z) < 0.13 && p.y > 0.84 && p.y < 1.08);
        item.dwell = bin >= 0 && settled ? item.dwell + dt : 0;
        if (item.dwell < 0.5) continue;
        item.dwell = 0;
        if (bin === item.kind && item.prepared) { item.done = true; item.body.enabled = false; item.body.mesh.visible = false; delivered++; audio.success(); feedback = `${names[item.kind]} entregue`; }
        else { mistakes++; item.body.mesh.position.copy(item.body.origin); item.body.velocity.set(0, 0, 0); audio.thud(); feedback = item.prepared ? 'Bandeja errada. Confira a etiqueta.' : `Primeiro: ${operations[item.kind].toLowerCase()} o item.`; }
      }
      ctx.hud(`Prontos ${prepared}/9 · feitos ${delivered}/9`, delivered === 9 ? 'Turno concluído. Novo turno?' : feedback);
    } };
  },
};
