// 🧗 ESCALADOR DE MONTANHA — Rocha e Altura
import { GrabMover, glowTexture, std } from './common.js';

export default {
  id: 'climb',
  create(ctx) {
    const { THREE, root, tex, audio, input, env, rig } = ctx;
    env.set({ top: '#1d5ac0', horizon: '#c6dcf0', bottom: '#7a8a6a', sharp: 0.45, fog: { color: '#c6dcf0', near: 40, far: 260 }, hemi: ['#eef6ff', '#6a6a5a', 1.5], sun: ['#fff6e6', 2.4], sunPos: [10, 30, 20] });
    const TOPY = 24, WALLZ = -0.7;

    // parede de rocha com camadas horizontais e saliências
    const wallGeo = new THREE.PlaneGeometry(14, TOPY + 2, 56, 104);
    const wp = wallGeo.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      const x = wp.getX(i), y = wp.getY(i);
      wp.setZ(i, Math.sin(x * 1.3 + y * 0.4) * 0.12 + Math.sin(y * 3.1) * 0.05 + Math.cos(x * 0.5) * 0.08 + (Math.random() - 0.5) * 0.03);
    }
    wallGeo.computeVertexNormals();
    const wall = new THREE.Mesh(wallGeo, std({ map: tex.get('rockStrata'), roughness: 0.95 }));
    wall.position.set(0, (TOPY + 2) / 2 - 1, WALLZ - 0.55); root.add(wall);
    // topo: grama verde curta e terra solta
    const top = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 10), [std({ color: '#6b5a40' }), std({ color: '#6b5a40' }), std({ map: tex.get('grass', { repeat: [8, 6] }) }), std({ color: '#6b5a40' }), std({ color: '#6b5a40' }), std({ color: '#6b5a40' })]);
    top.position.set(0, TOPY - 0.2, WALLZ - 5.4); root.add(top);

    // vale lá embaixo, suavemente desfocado pela névoa
    const valley = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), std({ map: tex.get('valley', { repeat: [20, 20] }), roughness: 1 }));
    valley.position.y = -0.02; root.add(valley);
    const treeMat = std({ color: '#3d6a32', flatShading: true });
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1.2, 4, 6).translate(0, 2, 0), treeMat, 220);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 220; i++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 120; m4.makeTranslation(Math.cos(a) * r, 0, Math.sin(a) * r + 20); trees.setMatrixAt(i, m4); }
    root.add(trees);

    // pontos de apoio: mais claros e desgastados
    // todas as pedras num único objeto instanciado: 1 desenho em vez de ~120
    const holdPos = [];
    for (let y = 0.9; y < TOPY - 0.3; y += 0.38) for (let k = 0; k < 2; k++) holdPos.push([(k ? 0.35 : -0.35) + (Math.random() - 0.5) * 0.4, y + Math.random() * 0.15, WALLZ - 0.22]);
    const holdGeo = new THREE.DodecahedronGeometry(0.075, 0).scale(1.5, 0.8, 0.9);
    const holdsMesh = new THREE.InstancedMesh(holdGeo, std({ color: '#ffffff', roughness: 1 }), holdPos.length);
    const BASE = new THREE.Color('#b9b2a4'), HOVER = new THREE.Color('#d9e8ff');
    const hq = new THREE.Quaternion(), he = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    holdPos.forEach((p, i) => {
      holdsMesh.setMatrixAt(i, m4.compose(new THREE.Vector3(...p), hq.setFromEuler(he.set(Math.random(), Math.random(), Math.random())), one));
      holdsMesh.setColorAt(i, BASE);
    });
    holdsMesh.computeBoundingSphere();
    root.add(holdsMesh);
    const mover = new GrabMover(ctx);
    let holding = null;
    const drag = {
      start: (p) => { holding = true; mover.start(p); audio.noise({ dur: 0.06, freq: 1200, vol: 0.1 }); audio.tone({ freq: 140, dur: 0.06, vol: 0.06 }); },
      move: () => {},
      end: (p) => { mover.stop(p); holding = mover.active || null; },
    };
    ctx.addUI(holdsMesh, {
      sound: false,
      resolve: (hit) => ({ key: 'hold' + hit.instanceId, id: hit.instanceId, drag }),
      onHover: (on, sub) => { if (sub?.id == null) return; holdsMesh.setColorAt(sub.id, on ? HOVER : BASE); holdsMesh.instanceColor.needsUpdate = true; },
    });
    // nuvens branco-gelo passando devagar
    const cloudMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(245,250,255,0.9)'), transparent: true, depthWrite: false });
    const clouds = Array.from({ length: 24 }, () => { const c = new THREE.Sprite(cloudMat); const s = 8 + Math.random() * 14; c.scale.set(s, s * 0.5, 1); c.position.set((Math.random() - 0.5) * 80, 6 + Math.random() * 24, -6 - Math.random() * 6 + (Math.random() < 0.5 ? 18 : 0)); root.add(c); return c; });

    const wind = audio.noiseLoop({ freq: 500, q: 0.4, vol: 0.02 });
    let summit = false, maxH = 0;

    return {
      update(dt) {
        if (mover.active) {
          mover.update(null, dt, 1.0);
          // fica sempre perto da parede, sem atravessar
          rig.position.z = THREE.MathUtils.clamp(rig.position.z, -0.25, 0.6);
          rig.position.x = THREE.MathUtils.clamp(rig.position.x, -3, 3);
        }
        // sem enjoo: soltar não faz cair — a câmera fica estável
        rig.position.y = THREE.MathUtils.clamp(rig.position.y, 0, TOPY + 0.2);
        const h = rig.position.y;
        maxH = Math.max(maxH, h);
        if (!summit && h > TOPY - 1.4) {
          summit = true; audio.success();
          rig.position.set(0, TOPY, WALLZ - 2.5);
          ctx.teleport({ enabled: true, walk: true, floorY: TOPY, check: (p) => Math.abs(p.x) < 6.5 && p.z < WALLZ - 0.6 && p.z > WALLZ - 10 });
        }
        if (wind) wind.gain.gain.setTargetAtTime(0.02 + h * 0.006, audio.t, 0.4);
        clouds.forEach((c, i) => { c.position.x += dt * (0.4 + (i % 3) * 0.3); if (c.position.x > 45) c.position.x = -45; });
        ctx.hud(summit ? 'No topo!' : `Altura ${h.toFixed(1)} m / ${TOPY} m`, summit ? 'Olhe ao redor: espaço aberto imenso' : 'Pinça numa pedra clara e puxe para baixo');
      },
      dispose() { mover.stop(); },
    };
  },
};
