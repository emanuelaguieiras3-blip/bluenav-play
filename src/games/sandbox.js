// Physics sandbox inspired by hands-on VR sandboxes: physical hands, weight,
// two-hand carrying, tumbling and breakable objects. Original BlueNav content.
import { std, Particles } from './common.js';
import { RigidWorld, grabbable, trackHands } from './rigidWorld.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createTrainingDummy } from './trainingDummy.js';
import { GrabMover } from './common.js';

export const SANDBOX_ITEMS = {
  box: { label: 'Caixa', size: [0.28, 0.28, 0.28], mass: 0.6, bounce: 0.15, texture: 'woodMedium', rotates: true },
  ball: { label: 'Bola', size: [0.24, 0.24, 0.24], mass: 0.45, bounce: 0.7, color: '#ff8a3d', rotates: true, shape: 'sphere' },
  metal: { label: 'Metal', size: [0.22, 0.22, 0.22], mass: 3, bounce: 0.1, texture: 'brushedMetal', rotates: true },
  crate: { label: 'Caixote', size: [0.5, 0.5, 0.5], mass: 9, bounce: 0.05, texture: 'woodLight', rotates: true },
  melon: { label: 'Melancia', size: [0.26, 0.26, 0.26], mass: 1.2, bounce: 0.2, color: '#3f8f3a', rotates: true, shape: 'sphere', breakSpeed: 5.5 },
  plank: { label: 'Tábua', size: [0.9, 0.05, 0.2], mass: 1.1, bounce: 0.1, texture: 'woodMedium' },
  club: { label: 'Bastão', size: [0.08, 0.65, 0.08], mass: 0.8, bounce: 0.05, texture: 'rubber', rotates: true },
};

export default {
  id: 'sandbox',
  create(ctx) {
    const { THREE, root, tex, env, audio } = ctx;
    env.set({ top: '#7dabc6', horizon: '#cedae2', bottom: '#34424e', hemi: ['#fff2dc', '#344656', 1.5], sun: ['#fff3de', 1.8] });
    const world = new RigidWorld({ limit: 48 });
    const solids = [];
    const box = (size, position, texture, color = '#ffffff', solid = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), std({ map: tex.get(texture), color }));
      mesh.position.set(...position); root.add(mesh);
      if (solid) { world.box(position, size); solids.push({ position, size }); }
      return mesh;
    };
    box([16, 0.15, 16], [0, -0.075, 0], 'stoneTiles');
    for (const x of [-8, 8]) box([0.25, 4, 16], [x, 2, 0], 'metalPanel');
    for (const z of [-8, 8]) box([16, 4, 0.25], [0, 2, z], 'metalPanel');
    box([2.4, 0.2, 1.2], [-2.6, 0.9, -2.4], 'woodMedium');
    for (const x of [-3.5, -1.7]) box([0.15, 0.8, 0.8], [x, 0.4, -2.4], 'brushedMetal');
    box([1.4, 0.6, 1.4], [3, 0.3, -3], 'roughStone');
    box([1.4, 1.2, 1.4], [4.4, 0.6, -3], 'roughStone');
    // Tower platform: knock blocks off it.
    const platform = box([1, 0.5, 1], [0, 0.25, -4], 'roughStone', '#c9d3dc');
    void platform;
    ctx.teleport({ enabled: true, walk: true, check: p => Math.abs(p.x) < 7.7 && Math.abs(p.z) < 7.7 && !solids.slice(5).some(s => Math.abs(p.x - s.position[0]) < s.size[0] / 2 + 0.2 && Math.abs(p.z - s.position[2]) < s.size[2] / 2 + 0.2) });

    const materials = {}, geometries = {};
    const material = kind => materials[kind] ||= std({ ...(SANDBOX_ITEMS[kind].texture ? { map: tex.get(SANDBOX_ITEMS[kind].texture) } : {}), color: SANDBOX_ITEMS[kind].color || '#ffffff', roughness: kind === 'metal' ? 0.3 : 0.85 });
    const geometry = kind => geometries[kind] ||= SANDBOX_ITEMS[kind].shape === 'sphere'
      ? new THREE.SphereGeometry(SANDBOX_ITEMS[kind].size[0] / 2, 16, 12) : kind === 'club'
        ? new THREE.CapsuleGeometry(0.04, 0.57, 4, 12) : new RoundedBoxGeometry(...SANDBOX_ITEMS[kind].size, 2, Math.min(...SANDBOX_ITEMS[kind].size) * 0.08);
    const stripes = new THREE.MeshBasicMaterial({ color: '#c7f0a0', wireframe: true, transparent: true, opacity: 0.25 });
    const spawned = new Set();
    let spawnCount = 0, smashed = 0, knocked = 0, feedback = '', feedbackLife = 0;
    const say = (text, life = 2) => { feedback = text; feedbackLife = life; };
    const spawnPoint = () => {
      const hand = (ctx.input?.pointers || []).find(p => p.main && (p.source === 'hand' || p.source === 'xr'));
      const at = hand ? hand.handPos.clone().addScaledVector(ctx.forward().setY(0).normalize(), 0.35) : ctx.eye().addScaledVector(ctx.forward(), 1.1);
      at.y = Math.max(at.y, 0.4); return at;
    };
    const spawn = (kind = 'box', at = null, initial = false) => {
      const item = SANDBOX_ITEMS[kind];
      if (world.bodies.length >= world.limit) { say('Limite de objetos. Toque Limpar.'); return null; }
      const mesh = new THREE.Mesh(geometry(kind), material(kind));
      if (kind === 'melon') mesh.add(new THREE.Mesh(geometry(kind), stripes));
      mesh.position.copy(at || spawnPoint()); root.add(mesh);
      const body = world.add(mesh, { size: item.size, mass: item.mass, bounce: item.bounce, rotates: !!item.rotates, shape: item.shape || 'box', breakSpeed: item.breakSpeed ?? Infinity });
      body.kind = kind; body.initial = initial;
      grabbable(ctx, world, body);
      if (!initial) { spawned.add(body); spawnCount++; }
      return body;
    };
    const destroy = body => { world.remove(body); ctx.app?.ui?.remove?.(body.mesh); body.mesh.removeFromParent(); spawned.delete(body); };

    for (let i = 0; i < 12; i++) {
      const kind = ['box', 'ball', 'metal'][i % 3];
      spawn(kind, new THREE.Vector3(-1 + (i % 6) * 0.36, SANDBOX_ITEMS[kind].size[1] / 2, -1.75 - Math.floor(i / 6) * 0.38), true);
    }
    const tower = [];
    for (let level = 0; level < 4; level++) for (const x of [-0.15, 0.15]) tower.push(spawn('box', new THREE.Vector3(x, 0.65 + level * 0.29, -4), true));
    spawn('melon', new THREE.Vector3(-2.2, 1.15, -2.4), true);
    spawn('melon', new THREE.Vector3(-2.9, 1.15, -2.4), true);
    spawn('crate', new THREE.Vector3(1.2, 0.26, -1.9), true);
    spawn('plank', new THREE.Vector3(-2.6, 1.05, -2.1), true);
    spawn('club', new THREE.Vector3(-1.9, 1.38, -2.4), true);
    const dummy = createTrainingDummy(ctx, world);
    // Grip rails offer physical climbing to an upper landing.
    const mover = new GrabMover(ctx);
    box([1.6, 0.16, 2], [-6.5, 2.4, -5.5], 'metalPanel');
    const railMat = std({ map: tex.get('brushedMetal'), color: '#ffca76' });
    for (let i = 0; i < 7; i++) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 10).rotateZ(Math.PI / 2), railMat);
      rail.position.set(-6.5, 0.45 + i * 0.35, -4.25); root.add(rail);
      ctx.addUI(rail, { sound: false, drag: {
        start(p) { if ((p.source === 'hand' || p.source === 'xr') && p.handPos.distanceTo(rail.position) < 0.55) mover.start(p); },
        move() {}, end(p) { mover.stop(p); },
      } });
    }

    const particles = new Particles(root, { max: 160, size: 0.05 });
    let lastThud = 0; const broken = [];
    world.onImpact = (body, speed) => {
      if (speed >= body.breakSpeed && body.enabled) {
        body.enabled = false; body.mesh.visible = false; body.holders.clear(); body.held = null;
        for (let i = 0; i < 40; i++) particles.spawn(body.mesh.position, new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3),
          { life: 0.9, color: i % 4 ? [0.92, 0.2, 0.25, 1] : [0.25, 0.6, 0.2, 1], gravity: 9.81, drag: 1 });
        smashed++; audio.noise?.({ dur: 0.12, freq: 900, vol: 0.12 }); say('Melancia esmagada!', 1.2);
        if (!body.initial) broken.push(body);
        return;
      }
      const now = performance.now();
      if (speed > 2.2 && now - lastThud > 90) { lastThud = now; audio.thud?.(); }
    };
    const handsUpdate = trackHands(ctx, world);

    const controls = [...Object.keys(SANDBOX_ITEMS).map(kind => [SANDBOX_ITEMS[kind].label, () => spawn(kind)]),
      ['Limpar', () => { [...spawned].forEach(destroy); say('Objetos criados removidos'); }],
      ['Restaurar', () => { [...spawned].forEach(destroy); world.reset(); dummy.reset(); knocked = 0; say('Laboratório restaurado'); }]];
    controls.forEach(([label, onClick], i) => {
      const b = ctx.button({ label, w: 0.24, h: 0.075, onClick });
      b.position.set(-0.42 + (i % 4) * 0.28, 1.24 - Math.floor(i / 4) * 0.095, -1.1); root.add(b);
    });
    return {
      world, spawn, tower, dummy,
      getState: () => ({ bodies: world.bodies.length, spawnCount, smashed, knocked, dummy: dummy.getState(), climbing: mover.active, held: world.bodies.filter(b => b.holders.size).length }),
      update(dt) {
        if (mover.active) { mover.update(null, dt); ctx.rig.position.y = Math.max(0, Math.min(2.5, ctx.rig.position.y)); }
        else if (ctx.rig.position.y > 0) {
          const landing = ctx.rig.position.x > -7.3 && ctx.rig.position.x < -5.7 && ctx.rig.position.z < -4.5 && ctx.rig.position.z > -6.5 && ctx.rig.position.y >= 2.4 ? 2.48 : 0;
          ctx.rig.position.y = Math.max(landing, ctx.rig.position.y - 2.5 * dt);
        }
        dummy.update(dt);
        handsUpdate(dt);
        world.update(dt);
        broken.splice(0).forEach(destroy);
        particles.update(dt);
        knocked = tower.filter(b => b.enabled && b.mesh.position.y < 0.55).length;
        feedbackLife = Math.max(0, feedbackLife - dt);
        const heavy = world.bodies.find(b => b.holders.size === 1 && b.mass / b.holders.size > 4);
        const status = feedbackLife > 0 ? feedback : heavy ? 'Muito pesado: segure com as duas mãos' :
          knocked === tower.length ? 'Torre derrubada! Toque Restaurar' : 'Pince para pegar · gire o pulso · bata para empurrar';
        ctx.hud(`Laboratório · ${world.bodies.length}/${world.limit} · torre ${knocked}/${tower.length}`, status);
      },
      dispose() { mover.stop(); world.setHands([]); for (const b of world.bodies) world.release(b); },
    };
  },
};
