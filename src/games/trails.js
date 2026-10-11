import { std } from './common.js';

const LENGTH = 150;
const GATES = 12;

export function stepTrail(state, controls, dt, mode) {
  const brake = controls.brake ? 1 : 0;
  const steer = Math.max(-1, Math.min(1, controls.steer || 0));
  if (mode === 'ski') {
    state.speed = Math.max(0, Math.min(21, state.speed + (3.1 - 0.012 * state.speed * state.speed - brake * 8) * dt));
    state.lateral += (steer * Math.min(7, state.speed * 0.45) - state.lateral) * Math.min(1, dt * 2.5);
  } else {
    const throttle = controls.throttle ? 1 : 0;
    state.speed = Math.max(0, Math.min(25, state.speed + (throttle * 7 - 0.025 * state.speed * state.speed - brake * 13) * dt));
    state.lateral += (steer * Math.min(5.5, state.speed * 0.38) - state.lateral) * Math.min(1, dt * 3.5);
  }
  state.s += state.speed * dt;
  state.x += state.lateral * dt;
  if (Math.abs(state.x) > 6.7) {
    state.x = Math.sign(state.x) * 6.7;
    state.speed *= Math.max(0.2, 1 - 1.4 * dt);
    state.lateral *= -0.15;
    state.edgeHits += 1;
  }
  return state;
}

export function gateResult(x, center, width = 1.75) { return Math.abs(x - center) <= width; }

function height(s, mode) { return mode === 'ski' ? -s * 0.045 : 0; }

export function createTrail(ctx, mode) {
  const { THREE, root, rig, camera, input, env, tex, audio } = ctx;
  const ski = mode === 'ski';
  env.set(ski
    ? { top: '#70a8d5', horizon: '#e4f3ff', bottom: '#f2f7fb', fog: { color: '#d9edfa', near: 35, far: 150 }, hemi: ['#f4f9ff', '#536b82', 1.7], sun: ['#fff5df', 2.1], sunPos: [20, 45, -40] }
    : { top: '#5792d0', horizon: '#cfddc8', bottom: '#69804a', fog: { color: '#c8d5b9', near: 45, far: 170 }, hemi: ['#eff7ed', '#4d5340', 1.5], sun: ['#ffe7c5', 2], sunPos: [-30, 45, -25] });
  const snow = std({ map: tex.get('snow'), color: '#f4f8fb', roughness: 0.94 });
  const groundMat = ski ? snow : std({ map: tex.get('grass'), color: '#91a36c', roughness: 1 });
  const roadMat = std({ map: tex.get(ski ? 'ice' : 'asphalt'), color: ski ? '#eaf4fb' : '#4a4d4b', roughness: ski ? 0.75 : 0.9 });
  const treeMat = std({ color: ski ? '#2e554d' : '#416743', roughness: 1 });
  const trunkMat = std({ map: tex.get('bark'), color: '#725943', roughness: 1 });
  const rockMat = std({ map: tex.get('roughStone'), color: ski ? '#8e9eaa' : '#857f69', roughness: 1 });
  const red = std({ color: '#db4447', roughness: 0.65 }), blue = std({ color: '#3488c6', roughness: 0.65 });
  const terrain = new THREE.PlaneGeometry(50, LENGTH + 30, 20, 75);
  terrain.rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i), x = pos.getX(i), s = -(z - LENGTH / 2 + 5);
    pos.setY(i, height(s, mode) + (Math.abs(x) > 8 ? 0.18 * Math.sin(x * 0.8 + z * 0.15) + 0.08 * Math.sin(x * 2.1) : 0));
  }
  terrain.computeVertexNormals();
  const floor = new THREE.Mesh(terrain, groundMat); floor.position.z = -LENGTH / 2 + 5; floor.receiveShadow = true; root.add(floor);
  // Ribbon follows the slope. Edges stay distinct enough to read at speed.
  const road = new THREE.BufferGeometry(), verts = [], uvs = [], idx = [];
  for (let i = 0; i <= 75; i++) {
    const s = i * 2, z = -s;
    for (const x of [-7, 7]) { verts.push(x, height(s, mode) + 0.025, z); uvs.push(x < 0 ? 0 : 1, i * 0.5); }
    if (i < 75) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  road.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); road.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); road.setIndex(idx); road.computeVertexNormals();
  root.add(new THREE.Mesh(road, roadMat));
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.16, 1.5, 8), crownGeo = new THREE.ConeGeometry(0.8, 2.5, 8), rockGeo = new THREE.IcosahedronGeometry(0.5, 1);
  const rng = (n) => { const v = Math.sin(n * 93.17) * 43758.545; return v - Math.floor(v); };
  for (let i = 0; i < (ctx.lowEnd ? 70 : 130); i++) {
    const s = 4 + rng(i + 11) * (LENGTH + 7), x = (8.4 + rng(i + 107) * 16) * (i % 2 ? -1 : 1);
    const y = height(s, mode), scale = 0.7 + rng(i + 39) * 0.9;
    if (i % 6 === 0) { const rock = new THREE.Mesh(rockGeo, rockMat); rock.scale.set(scale * 1.3, scale * 0.8, scale); rock.position.set(x, y + 0.2, -s); root.add(rock); }
    else { const tree = new THREE.Group(); const trunk = new THREE.Mesh(trunkGeo, trunkMat), crown = new THREE.Mesh(crownGeo, treeMat); trunk.position.y = 0.75; crown.position.y = 2.1; tree.add(trunk, crown); tree.position.set(x, y, -s); tree.scale.setScalar(scale); root.add(tree); }
  }
  const gates = [];
  const poleGeo = new THREE.CylinderGeometry(0.045, 0.05, 1.5, 10);
  for (let i = 0; i < GATES; i++) {
    const s = 15 + i * 10.5, x = Math.sin(i * 1.9) * 2.3, y = height(s, mode);
    const group = new THREE.Group();
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(poleGeo, side < 0 ? red : blue);
      pole.position.set(x + side * 1.75, y + 0.75, -s); group.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), side < 0 ? red : blue);
      flag.position.set(x + side * 1.53, y + 1.28, -s); group.add(flag);
    }
    root.add(group); gates.push({ s, x, passed: false, hit: null });
  }
  const banner = ctx.label(ski ? 'DESCIDA ALPINA' : 'MOTO DE TRILHA', { w: 2.2, h: 0.23, size: 0.35, bg: 'rgba(12,22,36,.9)' });
  banner.position.set(0, 2.7, -2); root.add(banner);
  const finish = ctx.label('CHEGADA', { w: 2.0, h: 0.25, size: 0.55, bg: 'rgba(12,22,36,.9)' });
  finish.position.set(0, height(LENGTH, mode) + 2.5, -LENGTH); root.add(finish);
  const ride = new THREE.Group(), black = std({ color: '#22252b', roughness: 0.75 }), metal = std({ map: tex.get('brushedMetal'), color: '#c9d1d4', metalness: 0.65, roughness: 0.4 });
  if (ski) {
    for (const x of [-0.19, 0.19]) {
      const plank = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.25, 4, 10).rotateX(Math.PI / 2), x < 0 ? red : blue);
      plank.position.set(x, 0.08, -0.25); ride.add(plank);
      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.18, 4, 10), black); boot.position.set(x, 0.2, 0.1); ride.add(boot);
    }
  } else {
    for (const z of [-0.55, 0.56]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.1, 10, 18), black); wheel.rotation.y = Math.PI / 2; wheel.position.set(0, 0.45, z); ride.add(wheel);
    }
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.56, 5, 12).rotateX(Math.PI / 2), red);
    tank.position.set(0, 0.9, 0); ride.add(tank);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 10).rotateZ(Math.PI / 2), metal);
    bar.position.set(0, 1.23, -0.45); ride.add(bar);
    const engine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), metal); engine.position.set(0, 0.55, 0); ride.add(engine);
  }
  root.add(ride);
  const state = { s: 0, x: 0, speed: 0, lateral: 0, edgeHits: 0, passed: 0, missed: 0, time: 0, status: 'ready', crashCooldown: 0 };
  const handSteer = () => {
    const hands = ctx.pointers().filter(p => (p.source === 'hand' || p.source === 'xr') && p.handPos);
    if (hands.length >= 2) {
      const a = camera.worldToLocal(hands[0].handPos.clone()), b = camera.worldToLocal(hands[1].handPos.clone());
      const [left, right] = a.x < b.x ? [a, b] : [b, a];
      return THREE.MathUtils.clamp((left.y - right.y) * 2.1, -1, 1);
    }
    if (hands.length) return THREE.MathUtils.clamp(camera.worldToLocal(hands[0].handPos.clone()).x * 2.2, -1, 1);
    return 0;
  };
  const restart = () => {
    Object.assign(state, { s: 0, x: 0, speed: 0, lateral: 0, edgeHits: 0, passed: 0, missed: 0, time: 0, status: 'ready', crashCooldown: 0 });
    gates.forEach(g => { g.passed = false; g.hit = null; }); rig.position.set(0, 0, 0);
  };
  const retry = ctx.button({ label: 'Recomeçar', w: 0.28, h: 0.08, onClick: restart }); retry.position.set(0.75, 1.35, -1.1); root.add(retry);
  ctx.teleport({ enabled: false, walk: false });
  return {
    state, gates, restart,
    update(dt) {
      dt = Math.max(0, Math.min(0.05, dt)); if (!dt) return;
      if (state.status === 'ready') state.status = 'running';
      if (state.status === 'running') {
        state.time += dt;
        const keys = input.keys;
        const keySteer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
        const pointers = ctx.pointers();
        const controls = { steer: keySteer || handSteer(), brake: keys.has('KeyS') || keys.has('ArrowDown') || pointers.some(p => p.pinch && !p.uiBusy), throttle: ski || keys.has('KeyW') || keys.has('ArrowUp') || pointers.length > 0 };
        const before = state.s;
        stepTrail(state, controls, dt, mode);
        for (const gate of gates) if (!gate.passed && before < gate.s && state.s >= gate.s) {
          gate.passed = true; gate.hit = gateResult(state.x, gate.x);
          if (gate.hit) { state.passed++; audio.click?.(); }
          else { state.missed++; state.speed *= ski ? 0.78 : 0.7; audio.thud?.(); }
        }
        if (state.s >= LENGTH) {
          state.s = LENGTH; state.speed = 0;
          state.status = state.passed >= 9 ? 'won' : 'lost';
          if (state.status === 'won') audio.success?.(); else audio.thud?.();
        }
      }
      rig.position.set(state.x, height(state.s, mode), -state.s);
      ride.position.set(state.x, height(state.s, mode), -state.s - (ski ? 0.25 : 0.4));
      ride.rotation.set(0, -state.lateral * 0.025, -state.lateral * 0.03);
      const end = state.status === 'won' ? 'Concluído! Reinicie para melhorar o tempo.' : state.status === 'lost' ? 'Menos de 9 portões. Reinicie para tentar de novo.' : ski ? 'Incline as mãos para virar. Pinça ou S freia.' : 'W acelera, A/D vira, pinça ou S freia.';
      ctx.hud(`${ski ? 'Esqui' : 'Moto'} · ${state.passed}/${GATES} portões · ${Math.round(state.speed * 3.6)} km/h`, end);
    },
  };
}
