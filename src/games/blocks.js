// 🟫 MUNDO DE BLOCOS — Seu Mundo, Bloco por Bloco
import { glowTexture } from './common.js';
import { rng } from '../core/util.js';

const W = 32, WATER = 4;

export default {
  id: 'blocks',
  create(ctx) {
    const { THREE, root, tex, audio, input, env, rig, app } = ctx;
    env.set({ top: '#4f8fe6', horizon: '#bcd8f5', bottom: '#6a7a8a', fog: { color: '#bcd8f5', near: 14, far: 34 }, hemi: ['#dfefff', '#5a5040', 1.4], sun: ['#fff6e0', 2.4] });

    const M = (name, o = {}) => new THREE.MeshLambertMaterial({ map: tex.get(name), ...o });
    const side = M('mcGrassSide'), dirt = M('mcDirt');
    const TYPES = {
      grama: { mats: [side, side, M('mcGrassTop'), dirt, side, side], step: 'soft', label: 'Grama' },
      terra: { mats: dirt, step: 'soft', label: 'Terra' },
      pedra: { mats: M('mcStone'), step: 'hard', label: 'Pedra' },
      tronco: { mats: (() => { const s = M('mcLogSide'), t = M('mcLogTop'); return [s, s, t, t, s, s]; })(), step: 'wood', label: 'Tronco' },
      tabua: { mats: M('mcPlanks'), step: 'wood', label: 'Tábuas' },
      folhas: { mats: M('mcLeaves', { transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), step: 'soft', label: 'Folhas', see: true },
      areia: { mats: M('mcSand'), step: 'soft', label: 'Areia' },
      agua: { mats: M('mcWater', { transparent: true, opacity: 0.72, depthWrite: false }), step: 'soft', label: 'Água', see: true, liquid: true },
    };
    const waterTex = TYPES.agua.mats.map; waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;

    // ---- geração do mundo ----
    const world = new Map();
    const K = (x, y, z) => (x + 64) | ((y + 64) << 8) | ((z + 64) << 16);
    const set = (x, y, z, t) => { if (t) world.set(K(x, y, z), { x, y, z, t }); else world.delete(K(x, y, z)); };
    const get = (x, y, z) => world.get(K(x, y, z));
    const R = rng('mundo');
    const height = (x, z) => Math.round(5 + Math.sin(x * 0.21) * 1.6 + Math.cos(z * 0.17) * 1.8 + Math.sin((x + z) * 0.09) * 1.5);
    const H = [];
    for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) {
      const h = height(x, z); H[x * W + z] = h;
      for (let y = Math.max(0, h - 3); y <= h; y++) set(x, y, z, y < h - 1 ? 'pedra' : y < h ? 'terra' : (h <= WATER ? 'areia' : 'grama'));
      for (let y = h + 1; y <= WATER; y++) set(x, y, z, 'agua');
    }
    for (let i = 0; i < 14; i++) {
      const x = 2 + Math.floor(R() * (W - 4)), z = 2 + Math.floor(R() * (W - 4)), h = H[x * W + z];
      if (h <= WATER) continue;
      for (let y = 1; y <= 4; y++) set(x, h + y, z, 'tronco');
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 3; dy <= 5; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + (dy - 3) > 3 || (!dx && !dz && dy < 5)) continue;
        if (!get(x + dx, h + dy, z + dz)) set(x + dx, h + dy, z + dz, 'folhas');
      }
    }

    // ---- desenho (instâncias por tipo, só blocos com face exposta) ----
    const box = new THREE.BoxGeometry(1, 1, 1);
    const meshes = {};
    const shadows = !ctx.lowEnd;
    const exposed = (b) => {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = get(b.x + dx, b.y + dy, b.z + dz);
        if (!n || (TYPES[n.t].see && n.t !== b.t)) return b.y + dy >= 0;
      }
      return false;
    };
    const rebuild = () => {
      const lists = {}; for (const t in TYPES) lists[t] = [];
      for (const b of world.values()) if (exposed(b)) lists[b.t].push(b);
      const m4 = new THREE.Matrix4();
      for (const t in TYPES) {
        const list = lists[t];
        let m = meshes[t];
        if (!m || m.instanceMatrix.count < list.length) {
          if (m) { root.remove(m); m.dispose(); }
          m = new THREE.InstancedMesh(box, TYPES[t].mats, Math.max(16, Math.ceil(list.length * 1.3)));
          m.castShadow = shadows && !TYPES[t].liquid; m.receiveShadow = shadows;
          m.frustumCulled = false; root.add(m); meshes[t] = m;
        }
        list.forEach((b, i) => { m4.makeTranslation(b.x + 0.5, b.y + 0.5, b.z + 0.5); m.setMatrixAt(i, m4); });
        m.count = list.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
        m.userData.cells = list;
      }
    };
    rebuild();

    // ---- céu: sol, lua, estrelas; o dia gira devagar ----
    const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,215,1)'), fog: false, depthWrite: false })); sunS.scale.set(14, 14, 1);
    const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(220,228,255,1)'), fog: false, depthWrite: false })); moonS.scale.set(8, 8, 1);
    const sg = new THREE.BufferGeometry(), sa = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y); v.multiplyScalar(150); sa.set([v.x, v.y, v.z], i * 3); }
    sg.setAttribute('position', new THREE.BufferAttribute(sa, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 0.9, map: glowTexture(), transparent: true, opacity: 0, fog: false, depthWrite: false }));
    const skyG = new THREE.Group(); skyG.add(sunS, moonS, stars); root.add(skyG);
    const sun = env.sun;
    if (shadows) {
      sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 });
      sun.shadow.bias = -0.0008;
      sun.target.position.set(W / 2, 4, W / 2);
    }

    // ---- jogador ----
    const cx = W / 2, cz = W / 2;
    const topAt = (x, z) => { for (let y = 30; y >= 0; y--) { const b = get(Math.floor(x), y, Math.floor(z)); if (b && !TYPES[b.t].liquid) return y + 1; } return WATER + 1; };
    rig.position.set(cx + 0.5, topAt(cx + 0.5, cz + 0.5), cz + 0.5);
    ctx.hudPose(-48, 0.85); // placar abaixo da barra de blocos
    ctx.teleport({ enabled: false, walk: true, check: (p) => p.x > 0 && p.z > 0 && p.x < W && p.z < W && Math.abs(topAt(p.x, p.z) - rig.position.y) <= 1.01 });

    // ---- barra de blocos e modos (acompanha o corpo) ----
    const bar = new THREE.Group(); root.add(bar);
    let current = 'grama', mode = 'quebrar';
    const typeBtns = {};
    ['grama', 'terra', 'pedra', 'tronco', 'tabua', 'areia', 'folhas'].forEach((t, i) => {
      const b = ctx.button({ w: 0.11, h: 0.06, label: TYPES[t].label, variant: 'glass', fontSize: 0.34, onClick: () => { current = t; mode = 'colocar'; refresh(); } });
      b.position.set(-0.36 + i * 0.12, 0, 0); bar.add(b); typeBtns[t] = b;
    });
    const modeBtns = ['quebrar', 'colocar', 'andar'].map((m, i) => {
      const b = ctx.button({ w: 0.15, h: 0.06, label: { quebrar: 'Quebrar', colocar: 'Colocar', andar: 'Andar' }[m], icon: { quebrar: 'pick', colocar: 'block', andar: 'walk' }[m], variant: 'glass', fontSize: 0.34, onClick: () => { mode = m; refresh(); } });
      b.position.set(-0.17 + i * 0.17, 0.075, 0); bar.add(b); return [m, b];
    });
    const refresh = () => {
      for (const [t, b] of Object.entries(typeBtns)) b.userData.setActive(t === current && mode === 'colocar');
      for (const [m, b] of modeBtns) b.userData.setActive(m === mode);
    };
    refresh();
    let barYaw = 0;

    // rachaduras que se aprofundam
    const crackMats = [1, 2, 3, 4].map((n) => new THREE.MeshBasicMaterial({ map: tex.get('mcCrack' + n), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    // contorno, rachadura e marcador de teleporte: um conjunto por mão
    const vis = [0, 1].map(() => {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(1.005, 1.005, 1.005), crackMats[0]); crack.visible = false; root.add(crack);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)), new THREE.LineBasicMaterial({ color: '#000', transparent: true, opacity: 0.5 })); outline.visible = false; root.add(outline);
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.32, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.8, depthWrite: false })); marker.visible = false; root.add(marker);
      return { crack, outline, marker };
    });
    const pstates = new Map();
    const pstate = (pp) => { if (!pstates.has(pp.id)) pstates.set(pp.id, { breakT: 0, breakKey: null, pointT: 0 }); return pstates.get(pp.id); };
    let twoHands = false;
    const drops = [];
    let dayT = 0.3, stepT = 0;
    const rc = new THREE.Raycaster();
    const step = (kind) => kind === 'hard' ? audio.noise({ dur: 0.05, freq: 2400, q: 1.2, vol: 0.12 }) : kind === 'wood' ? audio.tone({ freq: 240, to: 160, dur: 0.06, type: 'triangle', vol: 0.08 }) : audio.noise({ dur: 0.09, freq: 500, type: 'lowpass', vol: 0.12 });
    const under = () => get(Math.floor(rig.position.x), Math.round(rig.position.y) - 1, Math.floor(rig.position.z));
    app.onTeleport = () => { const b = under(); step(b ? TYPES[b.t].step : 'soft'); };

    return {
      onWalk(dt) {
        rig.position.y += (topAt(rig.position.x, rig.position.z) - rig.position.y) * Math.min(1, dt * 12);
        if ((stepT -= dt) < 0) { stepT = 0.42; const b = under(); step(b ? TYPES[b.t].step : 'soft'); }
      },
      update(dt) {
        // dia e noite
        dayT = (dayT + dt / 240) % 1;
        const a = dayT * Math.PI * 2, sunDir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.3).normalize();
        const day = THREE.MathUtils.smoothstep(sunDir.y, -0.15, 0.25);
        skyG.position.copy(ctx.eye());
        sunS.position.copy(sunDir).multiplyScalar(120); moonS.position.copy(sunDir).multiplyScalar(-120);
        stars.material.opacity = 1 - day;
        const top = new THREE.Color('#0a0f2a').lerp(new THREE.Color('#4f8fe6'), day);
        const hor = new THREE.Color('#141a35').lerp(new THREE.Color(sunDir.y < 0.25 && sunDir.y > -0.1 ? '#f0b080' : '#bcd8f5'), day);
        env.uniforms.top.value.copy(top); env.uniforms.horizon.value.copy(hor); ctx.scene.background = hor; ctx.scene.fog.color.copy(hor);
        sun.position.set(W / 2, 4, W / 2).addScaledVector(sunDir, 40); sun.intensity = 2.4 * day + 0.05;
        env.hemi.intensity = 0.35 + day * 1.1;
        waterTex.offset.x += dt * 0.02; waterTex.offset.y += dt * 0.01;

        // barra segue o corpo devagar, embaixo à direita
        const hy = app.headYaw();
        barYaw += Math.atan2(Math.sin(hy - barYaw), Math.cos(hy - barYaw)) * Math.min(1, dt * 1.5);
        const e = ctx.eye();
        bar.position.set(e.x - Math.sin(barYaw) * 0.72, e.y - 0.34, e.z - Math.cos(barYaw) * 0.72);
        bar.rotation.set(-0.45, barYaw, 0, 'YXZ');

        // mira no bloco — cada mão com o próprio raio.
        // DUAS mãos: direita coloca o bloco escolhido, esquerda quebra. UMA mão: vale o modo da barra.
        const ps = ctx.pointers().slice(0, 2);
        const two = ps.length === 2 && ps.every((q) => q.source === 'hand' || q.source === 'xr');
        twoHands = two;
        const solid = Object.values(meshes).filter((m) => m !== meshes.agua);
        for (const v of vis) { v.outline.visible = false; v.crack.visible = false; v.marker.visible = false; }
        let mainHit = null;
        ps.forEach((pp, idx) => {
          const st = pstate(pp), v = vis[idx];
          const pMode = two ? (pp.side === 'left' ? 'quebrar' : 'colocar') : mode;
          rc.ray.copy(pp.ray); rc.far = 7;
          const h = rc.intersectObjects(solid, false)[0];
          if (!h || h.instanceId === undefined || pp.uiBusy) { st.breakT = 0; st.pointT = 0; return; }
          const b = h.object.userData.cells[h.instanceId];
          const n = h.face.normal;
          v.outline.visible = true; v.outline.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
          if (pp.main) mainHit = h.point;
          const pointing = pp.source === 'hand' && pp.gesture === 'apontando';
          if (pMode === 'andar' || pointing) {
            // teleporte para o topo do bloco (apontar 0,65s ou pinçar)
            if (n.y > 0.5 && !get(b.x, b.y + 1, b.z) && !get(b.x, b.y + 2, b.z)) {
              v.marker.visible = true; v.marker.position.set(b.x + 0.5, b.y + 1.01, b.z + 0.5);
              st.pointT = pointing ? st.pointT + dt : 0;
              v.marker.scale.setScalar(0.5 + Math.min(1, st.pointT / 0.65) * 0.5);
              if (pp.pinchDown || st.pointT > 0.65) { app.teleport.go(new THREE.Vector3(b.x + 0.5, b.y + 1, b.z + 0.5)); st.pointT = -0.5; }
            }
          } else if (pMode === 'quebrar') {
            if (pp.pinch) {
              const key = K(b.x, b.y, b.z);
              if (key !== st.breakKey) { st.breakKey = key; st.breakT = 0; }
              st.breakT += dt;
              const k = Math.min(3, Math.floor(st.breakT / 0.2));
              v.crack.visible = true; v.crack.material = crackMats[k]; v.crack.position.copy(v.outline.position);
              if (Math.random() < dt * 8) step(TYPES[b.t].step);
              if (st.breakT > 0.8) {
                set(b.x, b.y, b.z, null); rebuild(); st.breakT = 0; st.breakKey = null;
                // bloco se solta e cai girando
                const d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), TYPES[b.t].mats);
                d.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5); root.add(d);
                drops.push({ d, v: new THREE.Vector3((Math.random() - 0.5), 2.5, (Math.random() - 0.5)), t: 0 });
                audio.noise({ dur: 0.18, freq: 700, vol: 0.2 });
              }
            } else { st.breakT = 0; st.breakKey = null; }
          } else if (pMode === 'colocar' && pp.pinchDown) {
            const p = [b.x + Math.round(n.x), b.y + Math.round(n.y), b.z + Math.round(n.z)];
            const ex = get(...p);
            const eye = ctx.eye();
            const inside = Math.floor(eye.x) === p[0] && Math.floor(eye.z) === p[2] && (p[1] === Math.floor(rig.position.y) || p[1] === Math.floor(rig.position.y) + 1);
            if ((!ex || TYPES[ex.t].liquid) && !inside && p[1] >= 0 && p[1] < 30) {
              set(...p, current); rebuild();
              step(TYPES[current].step); audio.tone({ freq: 300, to: 200, dur: 0.05, vol: 0.08 });
            }
          }
        });
        ctx.setPointerHit(mainHit);
        for (let i = drops.length - 1; i >= 0; i--) {
          const o = drops[i]; o.t += dt; o.v.y -= 9.8 * dt; o.d.position.addScaledVector(o.v, dt); o.d.rotation.y += dt * 3;
          const floorY = topAt(o.d.position.x, o.d.position.z) + 0.15;
          if (o.d.position.y < floorY) { o.d.position.y = floorY; o.v.set(0, 0, 0); }
          if (o.t > 1.6) { o.d.scale.multiplyScalar(0.85); }
          if (o.t > 2.2) { o.d.removeFromParent(); o.d.geometry.dispose(); drops.splice(i, 1); }
        }
        ctx.hud(twoHands ? `Direita coloca ${TYPES[current].label} · esquerda quebra` : `${{ quebrar: 'Quebrar', colocar: 'Colocar: ' + TYPES[current].label, andar: 'Andar' }[mode]}`, twoHands ? 'Aponte o indicador para um bloco para ir até ele' : mode === 'quebrar' ? 'Segure a pinça no bloco até soltar' : mode === 'colocar' ? 'Pinça/toque numa face para colocar' : 'Toque no topo de um bloco · aponte com o dedo');
      },
      dispose() { sun.castShadow = false; app.onTeleport = null; },
    };
  },
};
