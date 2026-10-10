// 🏎️ PILOTO DE CORRIDA — Sinta o Asfalto
import { Particles, glowTexture, lod, std, phys } from './common.js';

export default {
  id: 'racing',
  create(ctx) {
    const { THREE, root, tex, audio, input, env, rig, camera } = ctx;
    env.set({ top: '#1f5fc4', horizon: '#cfe3f7', bottom: '#4d6b3a', sharp: 0.5, fog: { color: '#cfe3f7', near: 60, far: 260 }, hemi: ['#eaf4ff', '#4a5a3a', 1.5], sun: ['#fff4e0', 2.2], sunPos: [40, 80, 20] });

    // ---- pista ----
    const ctrl = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = 120 + Math.sin(i * 2.3) * 28 + Math.cos(i * 1.7) * 14;
      ctrl.push(new THREE.Vector3(Math.cos(a) * r * 1.3, 0, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
    const N = 700, L = curve.getLength(), HALF = 5.5;
    const P = [], T = [], Nrm = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1);
      P.push(p); T.push(t); Nrm.push(new THREE.Vector3(-t.z, 0, t.x).normalize());
    }
    const DIRT0 = 0.52, DIRT1 = 0.72; // trecho de terra
    function ribbon(i0, i1, mat) {
      const pos = [], uv = [], idx = [];
      for (let i = i0; i <= i1; i++) {
        const l = P[i].clone().addScaledVector(Nrm[i], -HALF), r = P[i].clone().addScaledVector(Nrm[i], HALF);
        pos.push(l.x, 0.02, l.z, r.x, 0.02, r.z);
        const v = (i / N) * L / 11; uv.push(0, v, 1, v);
        if (i < i1) { const k = (i - i0) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; root.add(m); return m;
    }
    const roadTex = tex.get('road', { repeat: [1, 1] }), dirtTex = tex.get('dirt', { repeat: [1, 1] });
    const asphaltMat = std({ map: roadTex, roughness: 0.92, side: THREE.DoubleSide });
    ribbon(0, Math.floor(N * DIRT0), asphaltMat);
    ribbon(Math.floor(N * DIRT0), Math.floor(N * DIRT1), std({ map: dirtTex, roughness: 1, side: THREE.DoubleSide }));
    ribbon(Math.floor(N * DIRT1), N, asphaltMat);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), std({ map: tex.get('grass', { repeat: [120, 120] }), roughness: 1 }));
    root.add(ground);

    // ---- árvores (instanciadas) ----
    const nearRoad = (x, z) => { for (let i = 0; i < N; i += 7) if ((P[i].x - x) ** 2 + (P[i].z - z) ** 2 < 100) return true; return false; };
    const trees = [];
    for (let k = 0; trees.length < 180 && k < 2000; k++) {
      const i = Math.floor(Math.random() * N), side = Math.random() < 0.5 ? -1 : 1, off = 11 + Math.random() * 40;
      const p = P[i].clone().addScaledVector(Nrm[i], side * off);
      if (!nearRoad(p.x, p.z)) trees.push([p.x, p.z, 0.8 + Math.random() * 0.6]);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 3, 7).translate(0, 1.5, 0), std({ map: tex.get('bark') }), trees.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 1).translate(0, 4.4, 0), std({ color: '#3f7f2e', flatShading: true }), trees.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    trees.forEach(([x, z, k], i) => {
      m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 9), s.set(k, k, k));
      trunk.setMatrixAt(i, m4); crown.setMatrixAt(i, m4);
      crown.setColorAt(i, new THREE.Color().setHSL(0.27 + Math.random() * 0.06, 0.5, 0.25 + Math.random() * 0.1));
    });
    root.add(trunk, crown);

    // ---- postes de luz (nível de detalhe) ----
    const metal = std({ color: '#8d939b', metalness: 0.8, roughness: 0.35 });
    const poleNear = () => {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 7, 10).translate(0, 3.5, 0), metal);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8).rotateZ(Math.PI / 2).translate(-0.9, 6.9, 0), metal);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.25).translate(-1.7, 6.85, 0), std({ color: '#eef', emissive: '#fff8e0', emissiveIntensity: 0.6 }));
      g.add(post, arm, lamp); return g;
    };
    const poleFar = () => new THREE.Mesh(new THREE.BoxGeometry(0.15, 7, 0.15).translate(0, 3.5, 0), metal);
    for (let i = 0; i < N; i += 25) {
      const l = lod(poleNear(), poleFar(), 40);
      l.position.copy(P[i]).addScaledVector(Nrm[i], HALF + 1.2);
      l.lookAt(P[i].x, 0, P[i].z); l.rotateY(-Math.PI / 2);
      root.add(l);
    }

    // ---- nuvens fofas ----
    const clouds = [];
    const cloudMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,0.95)'), transparent: true, depthWrite: false, fog: false });
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Sprite(cloudMat); const sc = 40 + Math.random() * 60;
      c.scale.set(sc, sc * 0.45, 1); c.position.set((Math.random() - 0.5) * 700, 70 + Math.random() * 50, (Math.random() - 0.5) * 700);
      root.add(c); clouds.push(c);
    }

    // ---- cockpit ----
    const car = new THREE.Group(); root.add(car);
    const E = 1.6; // altura dos olhos no rig
    const leather = std({ map: tex.get('leather'), roughness: 0.6 });
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 12, 40), leather));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 16).rotateX(Math.PI / 2), std({ color: '#222', roughness: 0.4 }));
    wheel.add(hub);
    for (const a of [0, 2.2, -2.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.025, 0.015), std({ color: '#1c1c1c' })); sp.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0); sp.rotation.z = a; wheel.add(sp); }
    wheel.position.set(0, E - 0.36, -0.42); wheel.rotation.x = -0.35;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.45), std({ map: tex.get('fabric'), color: '#555' }));
    dash.position.set(0, E - 0.38, -0.78);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.5), std({ color: '#8f1f1f', metalness: 0.6, roughness: 0.3 }));
    hood.position.set(0, E - 0.5, -1.7);
    const seatMat = std({ map: tex.get('fabric') });
    const seatL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.6), seatMat); seatL.position.set(-0.32, E - 0.55, 0.05);
    const seatR = seatL.clone(); seatR.position.x = 0.32;
    const tireMat = std({ map: tex.get('tire'), roughness: 1 });
    const tires = [-0.86, 0.86].map((x) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20).rotateZ(Math.PI / 2), tireMat); t.position.set(x, E - 1.25, -1.75); return t; });
    const pillarMat = std({ color: '#222' });
    const pillars = [-0.74, 0.74].map((x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), pillarMat); p.position.set(x, E - 0.0, -0.72); p.rotation.x = -0.55; return p; });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.9), pillarMat); roof.position.set(0, E + 0.27, -0.2);

    // para-brisa esverdeado com gotas de chuva que escorrem
    const rc = document.createElement('canvas'); rc.width = rc.height = 256;
    const rx = rc.getContext('2d');
    const rainTex = new THREE.CanvasTexture(rc);
    const drops = Array.from({ length: 40 }, () => ({ x: Math.random() * 256, y: Math.random() * 256, v: 4 + Math.random() * 12, r: 1.5 + Math.random() * 2.5 }));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 0.62), phys({ color: '#cfe8d8', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, map: rainTex, depthWrite: false }));
    glass.position.set(0, E - 0.0, -0.74); glass.rotation.x = -0.55;
    car.add(wheel, dash, hood, seatL, seatR, ...tires, ...pillars, roof, glass);

    // ---- estado ----
    let s0 = 0, lat = 0, v = 0, pitch = 0, lap = 1, lastU = 0, steerVis = 0, rainT = 0, best = null, lapT = 0;
    const dust = new Particles(root, { max: 260, size: 0.5, texture: glowTexture('rgba(150,100,60,0.9)') });
    const engine = audio.oscLoop({ freq: 60, type: 'sawtooth', vol: 0.06, lp: 700 });
    const engine2 = audio.oscLoop({ freq: 30, type: 'square', vol: 0.03, lp: 300 });
    const gravel = audio.noiseLoop({ freq: 500, q: 0.6, vol: 0 });
    rig.position.y = -0.45; // sentado
    ctx.hudPose(16, 0.6); // placar no alto do para-brisa

    const sample = (u) => {
      const f = ((u % 1) + 1) % 1 * N, i = Math.floor(f), k = f - i;
      return { p: P[i].clone().lerp(P[i + 1], k), t: T[i].clone().lerp(T[i + 1], k).normalize(), n: Nrm[i].clone().lerp(Nrm[i + 1], k).normalize() };
    };
    const camLocal = new THREE.Vector3();
    let twoHands = false;

    return {
      update(dt, t) {
        const u = ((s0 / L) % 1 + 1) % 1;
        const onDirt = u > DIRT0 && u < DIRT1;
        const offRoad = Math.abs(lat) > HALF - 0.6;
        const ps = ctx.pointers();
        const braking = ps.some((p) => p.pinch && !p.uiBusy); // pinça em qualquer mão = freio
        const vmax = offRoad ? 12 : onDirt ? 27 : 40;
        const accel = braking ? -16 : v < vmax ? 7.5 * (1 - v / (vmax + 8)) + 1.5 : -5;
        v = Math.max(0, v + accel * dt);
        // direção: mão/mouse para os lados, ou olhar (cabeça) no papelão
        let steer;
        const handPs = ps.filter((p) => p.source === 'hand' || p.source === 'xr');
        if (handPs.length >= 2) {
          // duas mãos: gire o volante como um volante de verdade (ângulo entre as mãos)
          const a = handPs[0].handPos.clone(), b = handPs[1].handPos.clone();
          camera.worldToLocal(a); camera.worldToLocal(b);
          const [L, Rh] = a.x < b.x ? [a, b] : [b, a];
          steer = THREE.MathUtils.clamp(-Math.atan2(Rh.y - L.y, Rh.x - L.x) / 0.9, -1, 1);
          twoHands = true;
        } else if (input.source === 'hand' || input.source === 'mouse' || input.source === 'xr') {
          twoHands = false;
          camLocal.copy(input.handPos); camera.worldToLocal(camLocal);
          steer = THREE.MathUtils.clamp(camLocal.x / Math.max(0.25, -camLocal.z) * 1.6, -1, 1);
        } else steer = THREE.MathUtils.clamp(-ctx.app.headYaw() / 0.5, -1, 1);
        if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) steer = -1;
        if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) steer = 1;
        steerVis += (steer - steerVis) * Math.min(1, dt * 6);
        lat = THREE.MathUtils.clamp(lat + steerVis * dt * 7 * Math.min(1, v / 15), -HALF - 3, HALF + 3);
        s0 += v * dt;
        const nu = ((s0 / L) % 1 + 1) % 1;
        if (nu < lastU - 0.5) { lap++; if (!best || lapT < best) best = lapT; lapT = 0; audio.success(); }
        lastU = nu; lapT += dt;
        // peso: freando a frente abaixa; acelerando puxa pra trás
        const pt = braking && v > 1 ? -0.045 : accel > 2 ? 0.025 : 0;
        pitch += (pt - pitch) * Math.min(1, dt * 4);

        const sm = sample(nu);
        const pos = sm.p.clone().addScaledVector(sm.n, lat);
        const yaw = Math.atan2(-sm.t.x, -sm.t.z) - steerVis * 0.12;
        const bump = offRoad || onDirt ? Math.sin(t * 40) * 0.006 * Math.min(1, v / 10) : 0;
        rig.position.set(pos.x, -0.45 + bump, pos.z);
        rig.rotation.set(pitch, yaw, 0, 'YXZ');
        car.position.copy(rig.position); car.quaternion.copy(rig.quaternion);
        wheel.rotation.z = -steerVis * 1.6;
        tires.forEach((ti) => { ti.rotation.y = -steerVis * 0.35; });

        // poeira fina e marrom atrás dos pneus na terra
        if ((onDirt || offRoad) && v > 4) {
          for (let k = 0; k < 2; k++) {
            const back = pos.clone().addScaledVector(sm.t, -2.2).addScaledVector(sm.n, (Math.random() - 0.5) * 2);
            back.y = 0.3;
            dust.spawn(back, new THREE.Vector3((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2), { life: 1.6, color: [0.62, 0.42, 0.26, 0.5], drag: 1.2 });
          }
        }
        dust.update(dt);
        clouds.forEach((c, i) => { c.position.x += dt * (1.5 + (i % 3)); if (c.position.x > 350) c.position.x = -350; });

        // som do motor muda conforme a marcha
        const gear = Math.min(5, Math.floor(v / 9) + 1), rpm = (v - (gear - 1) * 9) / 9;
        if (engine) { engine.osc.frequency.setTargetAtTime(55 + rpm * 95 + gear * 10, audio.t, 0.05); engine.gain.gain.setTargetAtTime(0.04 + (braking ? 0.01 : 0.05), audio.t, 0.1); engine2.osc.frequency.setTargetAtTime(28 + rpm * 48 + gear * 5, audio.t, 0.05); }
        if (gravel) gravel.gain.gain.setTargetAtTime((onDirt || offRoad) ? Math.min(0.12, v / 200) : 0, audio.t, 0.1);

        // gotas escorrendo no para-brisa
        if ((rainT += dt) > 0.05) {
          rainT = 0;
          rx.clearRect(0, 0, 256, 256);
          for (const d of drops) {
            d.y += d.v * 0.05 * (1 + v / 40); d.x += (v / 40) * 0.6 * (d.x < 128 ? -1 : 1) * 0.05;
            if (d.y > 260 || d.x < -5 || d.x > 261) { d.y = -5; d.x = Math.random() * 256; }
            rx.strokeStyle = 'rgba(255,255,255,0.35)'; rx.lineWidth = d.r * 0.4;
            rx.beginPath(); rx.moveTo(d.x, d.y - d.v * 1.5); rx.lineTo(d.x, d.y); rx.stroke();
            rx.fillStyle = 'rgba(255,255,255,0.75)'; rx.beginPath(); rx.arc(d.x, d.y, d.r, 0, 6.28); rx.fill();
          }
          rainTex.needsUpdate = true;
        }
        ctx.hud(`Volta ${lap} · ${Math.round(v * 3.6)} km/h · ${gear}ª`, `${onDirt ? 'Terra' : 'Asfalto'} · ${twoHands ? 'girando o volante' : 'duas mãos giram o volante'} · pinça = frear${best ? ' · melhor ' + best.toFixed(1) + 's' : ''}`);
      },
    };
  },
};
