// 🏎️ PILOTO — corrida de 3 voltas contra 3 carros, com física de pneus
// (aderência, derrapagem, batidas) e cones que voam quando atingidos.
import { Particles, glowTexture, lod, std, phys } from './common.js';
import { buildCar } from './carModel.js';
import { RigidWorld } from './rigidWorld.js';

export const RACE_LAPS = 3;
export const CAR = { length: 4.3, width: 1.9, wheelBase: 2.7, maxSteer: 0.42, grip: { asphalt: 1.05, dirt: 0.62, grass: 0.45 } };

// Bicycle model on the track frame: s along the centre line, lat across it,
// heading relative to the tangent. Grip caps the lateral acceleration; past
// the limit the car slides (drift) and loses speed.
export function stepCar(car, input, dt, { curvature = 0, grip = 1, vmax = 40, half = 5.5 } = {}) {
  const g = 9.81, throttle = input.throttle ?? 1, brake = input.brake ? 1 : 0;
  const accel = brake ? -17 : throttle * (car.v < vmax ? 8 * (1 - car.v / (vmax + 10)) + 1.2 : -4) - 0.015 * car.v;
  car.v = Math.max(0, car.v + accel * dt);
  const wanted = car.v * Math.tan(input.steer * CAR.maxSteer) / CAR.wheelBase, limit = grip * g / Math.max(2, car.v);
  const yawRate = Math.max(-limit, Math.min(limit, wanted));
  car.slip = Math.abs(wanted - yawRate) * car.v;
  if (car.slip > 2) car.v = Math.max(0, car.v - car.slip * 0.35 * dt);
  // The road turns under the car; with no steering it drifts to the outside.
  car.heading += (yawRate - curvature * car.v) * dt;
  car.heading = Math.max(-1.1, Math.min(1.1, car.heading)) * Math.exp(-0.4 * dt);
  car.s += car.v * Math.cos(car.heading) * dt;
  car.lat += car.v * Math.sin(car.heading) * dt;
  car.hitWall = false;
  const wall = half + 2.6;
  if (Math.abs(car.lat) > wall) {
    // Scrape along the tyre wall: speed loss grows with the impact angle.
    const side = Math.sign(car.lat), impact = Math.max(0, Math.sin(car.heading) * side) * car.v;
    car.hitWall = impact > 2; car.lat = side * wall;
    car.v *= 1 - Math.min(0.45, impact * 0.04) - 0.004;
    car.heading = -side * Math.min(0.08, Math.abs(car.heading) * 0.3 + 0.02);
  }
  return car;
}

// Two cars overlapping (in track coordinates) are pushed apart; the one behind
// loses speed, the one ahead gets a shove.
export function collideCars(a, b, trackLength) {
  let ds = b.s - a.s; ds -= Math.round(ds / trackLength) * trackLength;
  const dl = b.lat - a.lat, ox = CAR.length - Math.abs(ds), oy = CAR.width - Math.abs(dl);
  if (ox <= 0 || oy <= 0) return false;
  if (oy < ox) { const push = oy / 2 * Math.sign(dl || 1); a.lat -= push; b.lat += push; a.heading -= 0.08 * Math.sign(dl || 1); b.heading += 0.08 * Math.sign(dl || 1); }
  else {
    const push = ox / 2 * Math.sign(ds || 1); a.s -= push; b.s += push;
    const [rear, front] = ds > 0 ? [a, b] : [b, a], dv = rear.v - front.v;
    if (dv > 0) { rear.v -= dv * 0.6; front.v += dv * 0.45; }
  }
  return true;
}

export default {
  id: 'racing',
  create(ctx) {
    const { THREE, root, tex, audio, input, env, rig, camera } = ctx;
    env.set({ top: '#1f5fc4', horizon: '#cfe3f7', bottom: '#4d6b3a', sharp: 0.5, fog: { color: '#cfe3f7', near: 60, far: 260 }, hemi: ['#eaf4ff', '#4a5a3a', 1.5], sun: ['#fff4e0', 2.2], sunPos: [40, 80, 20] });

    // ---- track ----
    const ctrl = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = 120 + Math.sin(i * 2.3) * 28 + Math.cos(i * 1.7) * 14;
      ctrl.push(new THREE.Vector3(Math.cos(a) * r * 1.3, 0, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
    const N = 700, L = curve.getLength(), HALF = 5.5;
    const P = [], T = [], Nrm = [], K = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1);
      P.push(p); T.push(t); Nrm.push(new THREE.Vector3(-t.z, 0, t.x).normalize());
    }
    // Signed curvature (1/m) from the turn of the tangent between samples.
    const ds = L / N;
    for (let i = 0; i <= N; i++) { const a = T[i], b = T[(i + 1) % N]; K.push(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z) / ds); }
    const DIRT0 = 0.52, DIRT1 = 0.72;
    function ribbon(i0, i1, mat, width = HALF, y = 0.02) {
      const pos = [], uv = [], idx = [];
      for (let i = i0; i <= i1; i++) {
        const l = P[i].clone().addScaledVector(Nrm[i], -width), r = P[i].clone().addScaledVector(Nrm[i], width);
        pos.push(l.x, y, l.z, r.x, y, r.z);
        const v = (i / N) * L / 11; uv.push(0, v, 1, v);
        if (i < i1) { const k = (i - i0) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; root.add(m); return m;
    }
    const asphaltMat = std({ map: tex.get('road', { repeat: [1, 1] }), roughness: 0.92, side: THREE.DoubleSide });
    ribbon(0, Math.floor(N * DIRT0), asphaltMat);
    ribbon(Math.floor(N * DIRT0), Math.floor(N * DIRT1), std({ map: tex.get('dirt', { repeat: [1, 1] }), roughness: 1, side: THREE.DoubleSide }));
    ribbon(Math.floor(N * DIRT1), N, asphaltMat);
    // Red/white kerbs along both edges (curbs are where racing lines meet).
    const kerbPos = [], kerbCol = [];
    for (let i = 0; i < N; i++) for (const side of [-1, 1]) {
      const a = P[i].clone().addScaledVector(Nrm[i], side * HALF), b = P[i + 1].clone().addScaledVector(Nrm[i + 1], side * HALF);
      const a2 = a.clone().addScaledVector(Nrm[i], side * 0.6), b2 = b.clone().addScaledVector(Nrm[i + 1], side * 0.6);
      kerbPos.push(a.x, 0.04, a.z, b.x, 0.04, b.z, a2.x, 0.05, a2.z, b.x, 0.04, b.z, b2.x, 0.05, b2.z, a2.x, 0.05, a2.z);
      const c = Math.floor(i / 3) % 2 ? [0.85, 0.1, 0.1] : [0.95, 0.95, 0.95]; for (let k = 0; k < 6; k++) kerbCol.push(...c);
    }
    const kerbGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(kerbPos, 3)).setAttribute('color', new THREE.Float32BufferAttribute(kerbCol, 3));
    kerbGeo.computeVertexNormals(); root.add(new THREE.Mesh(kerbGeo, std({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 })));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 60, 60).rotateX(-Math.PI / 2), std({ map: tex.get('grass', { repeat: [120, 120] }), roughness: 1 }));
    root.add(ground);
    // Tyre walls: stacked rounded tyres beyond the run-off on both sides.
    const tyreGeo = new THREE.TorusGeometry(0.32, 0.14, 5, 10).rotateX(Math.PI / 2);
    const wallCount = Math.floor(N / 2) * 2, tyres = new THREE.InstancedMesh(tyreGeo, std({ color: '#222', roughness: 1 }), wallCount * 2);
    let ti = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < N; i += 8) for (const side of [-1, 1]) for (const level of [0, 1]) {
      if (ti >= wallCount * 2) break;
      const p = P[i].clone().addScaledVector(Nrm[i], side * (HALF + 3.3)); p.y = 0.14 + level * 0.28;
      tyres.setMatrixAt(ti++, m4.compose(p, q, s1));
    }
    tyres.count = ti; root.add(tyres);

    // ---- trees ----
    const nearRoad = (x, z) => { for (let i = 0; i < N; i += 7) if ((P[i].x - x) ** 2 + (P[i].z - z) ** 2 < 130) return true; return false; };
    const trees = [];
    for (let k = 0; trees.length < 180 && k < 2000; k++) {
      const i = Math.floor(Math.random() * N), side = Math.random() < 0.5 ? -1 : 1, off = 13 + Math.random() * 40;
      const p = P[i].clone().addScaledVector(Nrm[i], side * off);
      if (!nearRoad(p.x, p.z)) trees.push([p.x, p.z, 0.8 + Math.random() * 0.6]);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 3, 7).translate(0, 1.5, 0), std({ map: tex.get('bark') }), trees.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 1).translate(0, 4.4, 0), std({ color: '#3f7f2e', flatShading: true }), trees.length);
    const sv = new THREE.Vector3();
    trees.forEach(([x, z, k], i) => {
      m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 9), sv.set(k, k, k));
      trunk.setMatrixAt(i, m4); crown.setMatrixAt(i, m4);
      crown.setColorAt(i, new THREE.Color().setHSL(0.27 + Math.random() * 0.06, 0.5, 0.25 + Math.random() * 0.1));
    });
    root.add(trunk, crown);
    // ---- light poles ----
    const metal = std({ color: '#8d939b', metalness: 0.8, roughness: 0.35 });
    const poleNear = () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 7, 10).translate(0, 3.5, 0), metal));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8).rotateZ(Math.PI / 2).translate(-0.9, 6.9, 0), metal));
      g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 10).rotateZ(Math.PI / 2).translate(-1.7, 6.85, 0), std({ color: '#eef', emissive: '#fff8e0', emissiveIntensity: 0.6 })));
      return g;
    };
    const poleFar = () => new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 7, 5).translate(0, 3.5, 0), metal);
    for (let i = 0; i < N; i += 25) {
      const l = lod(poleNear(), poleFar(), 40);
      l.position.copy(P[i]).addScaledVector(Nrm[i], HALF + 4.2); l.lookAt(P[i].x, 0, P[i].z); l.rotateY(-Math.PI / 2); root.add(l);
    }
    // Start/finish gantry with lights.
    const gantry = new THREE.Group(); gantry.position.copy(P[0]); gantry.lookAt(P[0].clone().add(T[0])); root.add(gantry);
    for (const x of [-HALF - 1, HALF + 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 6, 12), metal); post.position.set(x, 3, 0); gantry.add(post); }
    const beam = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, HALF * 2 + 1.6, 4, 12).rotateZ(Math.PI / 2), std({ color: '#20242c', roughness: 0.6 })); beam.position.y = 6; gantry.add(beam);
    const startLights = [-1.2, -0.4, 0.4, 1.2].map(x => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshBasicMaterial({ color: '#330000', toneMapped: false })); m.position.set(x, 5.6, 0.3); gantry.add(m); return m; });
    const checker = ribbon(0, 2, std({ color: '#ffffff', map: tex.get('cardBack'), side: THREE.DoubleSide }), HALF, 0.03); void checker;

    // ---- clouds ----
    const clouds = [], cloudMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,0.95)'), transparent: true, depthWrite: false, fog: false });
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Sprite(cloudMat), sc = 40 + Math.random() * 60;
      c.scale.set(sc, sc * 0.45, 1); c.position.set((Math.random() - 0.5) * 700, 70 + Math.random() * 50, (Math.random() - 0.5) * 700); root.add(c); clouds.push(c);
    }

    // ---- player car (cockpit) ----
    const car = new THREE.Group(); root.add(car);
    const E = 1.6;
    const shell = buildCar('#c21f2a', { cockpit: true, tex }); shell.position.y = 0.17; shell.position.z = 0.55; car.add(shell); // hood below the dash
    const leather = std({ map: tex.get('leather'), roughness: 0.6 });
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 12, 40), leather));
    wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 16).rotateX(Math.PI / 2), std({ color: '#222', roughness: 0.4 })));
    for (const a of [0, 2.2, -2.2]) { const sp = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.15, 3, 8).rotateZ(Math.PI / 2), std({ color: '#1c1c1c' })); sp.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0); sp.rotation.z = a; wheel.add(sp); }
    wheel.position.set(0, E - 0.36, -0.42); wheel.rotation.x = -0.35;
    const dash = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 1.3, 4, 16).rotateZ(Math.PI / 2).scale(1, 1, 2.2), std({ map: tex.get('fabric'), color: '#7a7f88' }));
    dash.position.set(0, E - 0.45, -0.8);
    const pillarMat = std({ color: '#222' });
    const pillars = [-0.74, 0.74].map(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.66, 8), pillarMat); p.position.set(x, E - 0.0, -0.72); p.rotation.x = -0.55; return p; });
    const rc = document.createElement('canvas'); rc.width = rc.height = 256; const rx = rc.getContext('2d');
    const rainTex = new THREE.CanvasTexture(rc);
    const drops = Array.from({ length: 30 }, () => ({ x: Math.random() * 256, y: Math.random() * 256, v: 4 + Math.random() * 12, r: 1.5 + Math.random() * 2.5 }));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 0.62), phys({ color: '#cfe8d8', transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0, map: rainTex, depthWrite: false }));
    glass.position.set(0, E - 0.0, -0.74); glass.rotation.x = -0.55;
    car.add(wheel, dash, ...pillars, glass);

    // ---- opponents ----
    const sample = u => {
      const f = ((u % 1) + 1) % 1 * N, i = Math.floor(f), k = f - i;
      return { p: P[i].clone().lerp(P[i + 1], k), t: T[i].clone().lerp(T[i + 1], k).normalize(), n: Nrm[i].clone().lerp(Nrm[i + 1], k).normalize(), k: K[i] * (1 - k) + K[(i + 1) % N] * k };
    };
    const surfaceAt = (s, lat) => { const u = ((s / L) % 1 + 1) % 1; return Math.abs(lat) > HALF + 0.6 ? 'grass' : u > DIRT0 && u < DIRT1 ? 'dirt' : 'asphalt'; };
    const player = { s: 0, lat: 0, v: 0, heading: 0, slip: 0, lap: 0, finished: false, name: 'Você' };
    const rivals = [['#2a64d8', 'Azul', 0.93], ['#f2b01e', 'Amarelo', 0.97], ['#1f9a52', 'Verde', 1.0]].map(([color, name, skill], i) => {
      const mesh = buildCar(color, { tex }); root.add(mesh);
      return { mesh, name, skill, s: -6 - i * 6, lat: i % 2 ? 2 : -2, v: 0, heading: 0, slip: 0, lap: 0, finished: false, line: (i - 1) * 1.5 };
    });
    const cars = [player, ...rivals];

    // ---- cones (rigid bodies) ----
    const cones = new RigidWorld({ floor: 0, limit: 24 });
    const coneMat = std({ color: '#ff6a1a', roughness: 0.7 }), coneGeo = new THREE.LatheGeometry([[0, 0], [0.22, 0], [0.22, 0.03], [0.14, 0.04], [0.04, 0.52], [0, 0.53]].map(([x, y]) => new THREE.Vector2(x, y - 0.26)), 16);
    for (const u of [0.2, 0.42, 0.85]) for (let k = 0; k < 8; k++) {
      const smp = sample(u + k * 0.0016), mesh = new THREE.Mesh(coneGeo, coneMat);
      mesh.position.copy(smp.p).addScaledVector(smp.n, (k % 2 ? 1 : -1) * (HALF - 0.4)); mesh.position.y = 0.27; root.add(mesh);
      cones.add(mesh, { size: [0.44, 0.53, 0.44], mass: 3, bounce: 0.3, rotates: true });
    }
    let coneHits = 0; cones.onImpact = (_b, speed) => { if (speed > 3) coneHits++; };

    // ---- state ----
    let state = 'grid', countdown = 4, raceTime = 0, pitch = 0, roll = 0, steerVis = 0, rainT = 0, shakeT = 0, best = null, lapStart = 0, place = 4, finishPlace = 0, twoHands = false;
    const dust = new Particles(root, { max: 260, size: 0.5, texture: glowTexture('rgba(150,100,60,0.9)') });
    const smoke = new Particles(root, { max: 160, size: 0.7, texture: glowTexture('rgba(220,220,220,0.8)') });
    const engine = audio.oscLoop({ freq: 60, type: 'sawtooth', vol: 0.06, lp: 700 });
    const engine2 = audio.oscLoop({ freq: 30, type: 'square', vol: 0.03, lp: 300 });
    const gravel = audio.noiseLoop({ freq: 500, q: 0.6, vol: 0 });
    const screech = audio.noiseLoop({ freq: 2600, q: 3, vol: 0 });
    rig.position.y = -0.45;
    ctx.hudPose(16, 0.6);
    const restart = () => {
      state = 'grid'; countdown = 4; raceTime = 0; best = null; lapStart = 0; finishPlace = 0;
      Object.assign(player, { s: 0, lat: -1.6, v: 0, heading: 0, lap: 0, finished: false });
      rivals.forEach((r, i) => Object.assign(r, { s: -6 - i * 6 + (i === 0 ? 6 : 0), lat: [1.6, -1.6, 1.6][i], v: 0, heading: 0, lap: 0, finished: false }));
      rivals[0].s = 0; rivals[1].s = -6; rivals[2].s = -6;
      cones.reset();
    };
    restart();
    const button = ctx.button({ label: 'Reiniciar corrida', w: 0.34, h: 0.07, onClick: restart }); button.position.set(0.5, E - 0.5, -0.5); button.rotation.x = -0.7; car.add(button);
    const camLocal = new THREE.Vector3(), carVel = new THREE.Vector3(), lastCarPos = new THREE.Vector3();
    const progress = c => c.lap * L + c.s;
    const placeCar = (c, mesh, y = 0) => {
      const smp = sample(c.s / L), pos = smp.p.clone().addScaledVector(smp.n, c.lat);
      mesh.position.set(pos.x, y, pos.z); mesh.rotation.set(0, Math.atan2(-smp.t.x, -smp.t.z) - c.heading, 0); return smp;
    };
    const steerFromHands = () => {
      const ps = ctx.pointers(), handPs = ps.filter(p => p.source === 'hand' || p.source === 'xr');
      if (handPs.length >= 2) {
        const a = handPs[0].handPos.clone(), b = handPs[1].handPos.clone(); camera.worldToLocal(a); camera.worldToLocal(b);
        const [l, r] = a.x < b.x ? [a, b] : [b, a]; twoHands = true;
        return THREE.MathUtils.clamp(-Math.atan2(r.y - l.y, r.x - l.x) / 0.9, -1, 1);
      }
      twoHands = false;
      if (input.source === 'hand' || input.source === 'mouse' || input.source === 'xr') { camLocal.copy(input.handPos); camera.worldToLocal(camLocal); return THREE.MathUtils.clamp(camLocal.x / Math.max(0.25, -camLocal.z) * 1.6, -1, 1); }
      return THREE.MathUtils.clamp(-ctx.app.headYaw() / 0.5, -1, 1);
    };

    return {
      cars, player, rivals, cones, restart,
      getState: () => ({ state, lap: Math.min(RACE_LAPS, player.lap + 1), place, speed: player.v, coneHits, finishPlace, slip: player.slip, time: raceTime }),
      update(dt, t) {
        dt = Math.min(dt, 0.05);
        const ps = ctx.pointers(), braking = ps.some(p => p.pinch && !p.uiBusy) || input.keys.has('KeyS') || input.keys.has('ArrowDown');
        let steer = steerFromHands();
        if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) steer = -1;
        if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) steer = 1;
        steerVis += (steer - steerVis) * Math.min(1, dt * 8);
        // Countdown with start lights.
        if (state === 'grid') {
          countdown -= dt;
          const lit = Math.max(0, Math.min(4, Math.floor(4 - countdown)));
          startLights.forEach((m, i) => m.material.color.set(i < lit ? '#ff1a1a' : '#330000'));
          if (countdown <= 0) { state = 'racing'; startLights.forEach(m => m.material.color.set('#20ff40')); audio.success(); }
        } else raceTime += dt;
        const racing = state === 'racing';
        for (const c of cars) {
          const smp = sample(c.s / L), surface = surfaceAt(c.s, c.lat), grip = CAR.grip[surface];
          const vmax = surface === 'grass' ? 14 : surface === 'dirt' ? 29 : 42;
          const oldS = c.s;
          if (c === player) stepCar(c, { steer: steerVis, brake: braking || !racing || c.finished, throttle: racing && !c.finished ? 1 : 0 }, dt, { curvature: smp.k, grip, vmax, half: HALF });
          else {
            // AI: follow its line with a little inside bias on curves; brake for
            // corners using the grip limit v = sqrt(mu g / k) a few seconds ahead.
            const ahead = sample((c.s + Math.max(20, c.v * 1.8)) / L), curveSpeed = Math.sqrt(grip * 9.81 / Math.max(0.002, Math.abs(ahead.k))) * c.skill;
            const target = c.line + Math.sign(ahead.k) * 1.6, aiSteer = THREE.MathUtils.clamp((target - c.lat) * 0.25 - c.heading * 2.2 + smp.k * CAR.wheelBase / Math.tan(CAR.maxSteer) * 1.0, -1, 1);
            stepCar(c, { steer: aiSteer, brake: !racing || c.v > curveSpeed + 1.5 || c.finished, throttle: racing && !c.finished ? 1 : 0 }, dt, { curvature: smp.k, grip, vmax: vmax * c.skill, half: HALF });
          }
          // Laps: crossing s = 0 forwards.
          if (c.s >= L) { c.s -= L; c.lap++; if (c === player && racing) { const lapTime = raceTime - lapStart; if (!best || lapTime < best) best = lapTime; lapStart = raceTime; audio.success(); } }
          if (c.s < -L * 0.5) c.s += L;
          if (c.lap >= RACE_LAPS && !c.finished && racing) { c.finished = true; if (c === player) { finishPlace = place; state = 'finished'; } }
          void oldS;
        }
        let crash = 0;
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) if (collideCars(cars[i], cars[j], L) && (i === 0 || j === 0)) crash = Math.max(crash, Math.abs(cars[i].v - cars[j].v) + 2);
        if (player.hitWall) crash = Math.max(crash, player.v * 0.3 + 3);
        if (crash > 0 && shakeT <= 0) { shakeT = 0.25; audio.thud?.(); audio.noise({ dur: 0.12, freq: 600, vol: Math.min(0.25, crash * 0.03) }); }
        shakeT = Math.max(0, shakeT - dt);
        place = 1 + rivals.filter(r => progress(r) > progress(player)).length;

        // Player rig follows the car; weight transfer tilts the cabin.
        const smp = sample(player.s / L), pos = smp.p.clone().addScaledVector(smp.n, player.lat);
        const yaw = Math.atan2(-smp.t.x, -smp.t.z) - player.heading;
        const surface = surfaceAt(player.s, player.lat), rough = surface !== 'asphalt';
        const pt = braking && player.v > 1 ? -0.045 : racing && player.v < 30 ? 0.02 : 0;
        pitch += (pt - pitch) * Math.min(1, dt * 4);
        roll += (THREE.MathUtils.clamp(-steerVis * player.v * 0.0012, -0.05, 0.05) - roll) * Math.min(1, dt * 5);
        const bump = (rough ? Math.sin(t * 40) * 0.008 * Math.min(1, player.v / 10) : 0) + (shakeT > 0 ? (Math.random() - 0.5) * 0.05 : 0);
        rig.position.set(pos.x, -0.45 + bump, pos.z);
        rig.rotation.set(pitch, yaw, roll, 'YXZ');
        car.position.copy(rig.position); car.quaternion.copy(rig.quaternion);
        wheel.rotation.z = -steerVis * 1.6;
        shell.userData.drive(player.v * dt, steerVis);
        for (const r of rivals) { placeCar(r, r.mesh); r.mesh.userData.drive(r.v * dt, r.heading * 2); }
        // The car body knocks cones away.
        carVel.copy(pos).sub(lastCarPos).divideScalar(Math.max(dt, 1e-3)); if (carVel.length() > 60) carVel.set(0, 0, 0); lastCarPos.copy(pos);
        const pushers = [{ id: 'player', position: new THREE.Vector3(pos.x, 0.4, pos.z), velocity: carVel.clone().clampLength(0, 25), radius: 1.1 }];
        for (const r of rivals) pushers.push({ id: r.name, position: new THREE.Vector3(r.mesh.position.x, 0.4, r.mesh.position.z), velocity: new THREE.Vector3(0, 0, -r.v).applyQuaternion(r.mesh.quaternion), radius: 1.1 });
        cones.setHands(pushers); cones.update(dt);

        // Dust on dirt/grass, tyre smoke when sliding.
        if (rough && player.v > 4) for (let k = 0; k < 2; k++) {
          const back = pos.clone().addScaledVector(smp.t, -2.2).addScaledVector(smp.n, (Math.random() - 0.5) * 2); back.y = 0.3;
          dust.spawn(back, new THREE.Vector3((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2), { life: 1.6, color: [0.62, 0.42, 0.26, 0.5], drag: 1.2 });
        }
        if (player.slip > 2.5 && !rough) {
          const back = pos.clone().addScaledVector(smp.t, -1.8).addScaledVector(smp.n, (Math.random() - 0.5) * 1.6); back.y = 0.25;
          smoke.spawn(back, new THREE.Vector3((Math.random() - 0.5), 0.6 + Math.random() * 0.5, (Math.random() - 0.5)), { life: 1.2, color: [0.9, 0.9, 0.9, 0.35], drag: 1.5 });
        }
        dust.update(dt); smoke.update(dt);
        clouds.forEach((c, i) => { c.position.x += dt * (1.5 + (i % 3)); if (c.position.x > 350) c.position.x = -350; });

        const gear = Math.min(6, Math.floor(player.v / 8) + 1), rpm = (player.v - (gear - 1) * 8) / 8;
        if (engine) { engine.osc.frequency.setTargetAtTime(55 + rpm * 95 + gear * 10, audio.t, 0.05); engine.gain.gain.setTargetAtTime(0.04 + (braking ? 0.01 : 0.05), audio.t, 0.1); engine2.osc.frequency.setTargetAtTime(28 + rpm * 48 + gear * 5, audio.t, 0.05); }
        if (gravel) gravel.gain.gain.setTargetAtTime(rough ? Math.min(0.12, player.v / 200) : 0, audio.t, 0.1);
        if (screech) screech.gain.gain.setTargetAtTime(!rough && player.slip > 2.5 ? Math.min(0.08, player.slip * 0.01) : 0, audio.t, 0.05);

        if ((rainT += dt) > 0.06) {
          rainT = 0; rx.clearRect(0, 0, 256, 256);
          for (const d of drops) {
            d.y += d.v * 0.05 * (1 + player.v / 40); d.x += (player.v / 40) * 0.6 * (d.x < 128 ? -1 : 1) * 0.05;
            if (d.y > 260 || d.x < -5 || d.x > 261) { d.y = -5; d.x = Math.random() * 256; }
            rx.fillStyle = 'rgba(255,255,255,0.7)'; rx.beginPath(); rx.arc(d.x, d.y, d.r, 0, 6.28); rx.fill();
          }
          rainTex.needsUpdate = true;
        }
        const lapShown = Math.min(RACE_LAPS, player.lap + 1);
        const title = state === 'grid' ? `Largada em ${Math.max(1, Math.ceil(countdown - 0.01))}` : state === 'finished' ? `Chegada: ${finishPlace}º lugar` : `${place}º · volta ${lapShown}/${RACE_LAPS} · ${Math.round(player.v * 3.6)} km/h`;
        const sub = state === 'finished' ? `Tempo ${raceTime.toFixed(1)} s${best ? ' · melhor volta ' + best.toFixed(1) + ' s' : ''} · toque Reiniciar` :
          `${surface === 'asphalt' ? (player.slip > 2.5 ? 'Derrapando!' : 'Asfalto') : surface === 'dirt' ? 'Terra' : 'Grama: volte para a pista'} · ${twoHands ? 'volante com as duas mãos' : 'duas mãos giram o volante'} · pinça = frear`;
        ctx.hud(title, sub);
      },
    };
  },
};
