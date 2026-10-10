// 🦍 SELVA LIVRE — Entre Folhas e Galhos
import { Particles, GrabMover, glowTexture, std } from './common.js';

export default {
  id: 'jungle',
  create(ctx) {
    const { THREE, root, tex, audio, input, env, rig } = ctx;
    env.set({ top: '#6fa8d8', horizon: '#d8ead2', bottom: '#2a3a1f', fog: { color: '#cfe3c8', density: 0.035 }, hemi: ['#f4ffe0', '#2c3a1a', 1.3], sun: ['#ffe9b0', 2.4], sunPos: [6, 20, 4] });
    ctx.teleport({ enabled: true, walk: true, floorY: 0, check: (p) => Math.hypot(p.x, p.z) < 28 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), std({ map: tex.get('forestFloor'), roughness: 1 }));
    root.add(floor);
    const barkMat = std({ map: tex.get('barkMoss'), roughness: 0.95 });
    const branchMat = std({ map: tex.get('bark'), roughness: 0.95 });
    const leafMat = std({ map: tex.get('leaf'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
    leafMat.emissive = new THREE.Color('#1c3a10'); leafMat.emissiveIntensity = 0.25; // translúcida contra o sol

    const branches = [];
    const leafGeo = new THREE.PlaneGeometry(0.35, 0.35);
    const leafCount = ctx.mobile ? 650 : 1400; // folhas com recorte são caras no celular
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    let li = 0;
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler();
    const addLeaves = (c, r, n) => {
      for (let k = 0; k < n && li < leafCount; k++, li++) {
        const p = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.3), (Math.random() - 0.5) * 2).normalize().multiplyScalar(r * Math.cbrt(Math.random())).add(c);
        qq.setFromEuler(e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6));
        const s = 0.7 + Math.random() * 0.8;
        leaves.setMatrixAt(li, m4.compose(p, qq, new THREE.Vector3(s, s, s)));
      }
    };
    // árvores com galhos em espiral subindo
    const treePos = [[0, -3.2], [3.5, -6], [-4, -5.5], [6, -1], [-6.5, 0.5], [1.5, 5], [-3, 6.5], [8, -7], [-9, -8]];
    treePos.forEach(([x, z], ti) => {
      const h = 11 + Math.random() * 4, r = 0.45 + Math.random() * 0.2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 14).translate(0, h / 2, 0), barkMat);
      trunk.position.set(x, 0, z); root.add(trunk);
      addLeaves(new THREE.Vector3(x, h, z), 3.2, Math.round(90 * leafCount / 1400));
      const nb = ti < 3 ? 9 : 4;
      for (let b = 0; b < nb; b++) {
        const y = 1.4 + b * 1.15 + Math.random() * 0.3, a = b * 2.1 + ti, len = 2.2 + Math.random() * 1.2;
        const pivot = new THREE.Group(); pivot.position.set(x, y, z); pivot.rotation.y = a; root.add(pivot);
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, len, 8).rotateZ(Math.PI / 2).translate(len / 2 + r * 0.8, 0, 0), branchMat);
        br.rotation.z = 0.12;
        pivot.add(br);
        const tip = new THREE.Vector3(len + r, 0, 0); pivot.updateMatrixWorld(); br.updateMatrixWorld();
        addLeaves(br.localToWorld(tip.clone()), 0.9, Math.round(22 * leafCount / 1400));
        const state = { mesh: br, bend: 0, vel: 0, rest: 0.12, y };
        branches.push(state);
        ctx.addUI(br, {
          sound: false,
          onHover: (on) => { br.material = on ? hoverMat : branchMat; },
          drag: {
            start: (p) => { grabs.set(p.id, state); mover.start(p); audio.noise({ dur: 0.08, freq: 900, vol: 0.12 }); },
            move: () => {},
            end: (p) => { if (p) grabs.delete(p.id); else grabs.clear(); mover.stop(p); },
          },
        });
      }
    });
    const hoverMat = std({ map: tex.get('bark'), emissive: '#3a5a1a', emissiveIntensity: 0.6 });
    leaves.count = li; root.add(leaves);
    const grabs = new Map(); // mão -> galho que ela segura (uma ou duas mãos)
    const mover = new GrabMover(ctx);

    // feixes dourados de luz atravessando as copas
    const shaftMat = new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 16, 12, 1, true), shaftMat);
      sh.position.set((Math.random() - 0.5) * 16, 7, (Math.random() - 0.5) * 16 - 3); sh.rotation.z = 0.35; sh.rotation.x = 0.15;
      root.add(sh);
    }
    // folhas soltas caindo / passando pelo rosto
    const falling = new Particles(root, { max: 120, size: 0.12, texture: tex.get('leaf') });
    const wind = audio.noiseLoop({ freq: 700, q: 0.5, vol: 0.03 });
    let birdT = 2, vy = 0;

    return {
      update(dt, t) {
        const held = new Set(grabs.values());
        if (held.size) {
          mover.update(null, dt, 1.0);
          // galho curva sob o peso (dividido entre as mãos que seguram)
          for (const g of held) g.vel += (0.12 - 0.25 / held.size - g.bend) * 30 * dt;
          vy = 0;
        }
        // elasticidade: volta devagar ao soltar
        for (const b of branches) {
          if (!held.has(b)) b.vel += (b.rest - b.bend) * 22 * dt;
          b.vel *= Math.exp(-3.5 * dt); b.bend += b.vel * dt; b.mesh.rotation.z = b.bend;
        }
        // sem segurar: desce suavemente até um galho ou o chão
        if (!held.size && rig.position.y > 0) {
          const below = branches.filter((b) => b.y - 0.05 <= rig.position.y + 0.05).map((b) => b.y);
          const floorY = below.length && rig.position.y > 0.6 ? Math.max(...below) - 1.0 : 0;
          if (rig.position.y > floorY + 0.01) { vy = Math.min(vy + 2.5 * dt, 2.5); rig.position.y = Math.max(floorY, rig.position.y - vy * dt); }
          else vy = 0;
        }
        rig.position.y = Math.max(0, Math.min(14, rig.position.y));
        const h = rig.position.y;
        if (wind) wind.gain.gain.setTargetAtTime(0.03 + h * 0.012, audio.t, 0.3);
        if (Math.random() < dt * 6) {
          const eye = ctx.eye();
          falling.spawn(new THREE.Vector3(eye.x + (Math.random() - 0.5) * 3, eye.y + 2.5, eye.z + (Math.random() - 0.5) * 3), new THREE.Vector3(Math.random() - 0.5, -0.6, Math.random() - 0.5), { life: 5, color: [1, 1, 1, 1], drag: 0.5 });
        }
        falling.update(dt);
        // pássaros distantes
        if ((birdT -= dt) < 0) {
          birdT = 2 + Math.random() * 5;
          const f = 1800 + Math.random() * 1500;
          for (let k = 0; k < 3; k++) audio.tone({ freq: f, to: f * 1.3, dur: 0.08, vol: 0.03, delay: k * 0.12 });
        }
        ctx.hud(`Altura ${h.toFixed(1)} m`, 'Pinça num galho e puxe para baixo para subir');
      },
      dispose() { mover.stop(); },
    };
  },
};
