// 🗝️ MASMORRA ESCURA — Pedra Úmida e Segredo
import { Particles, glowTexture, std, hands2 } from './common.js';

// mapa: # parede, . chão, R runa na parede vizinha, S início
const MAP = [
  '###########',
  '#S..#....R#',
  '#.#.#.##..#',
  '#.#...#R..#',
  '#.###.#.###',
  '#R....#...#',
  '###.###.#.#',
  '#...#...#R#',
  '#.#...#...#',
  '#R#########',
];

export default {
  id: 'dungeon',
  create(ctx) {
    const { THREE, root, tex, audio, input, env } = ctx;
    env.set({ sky: false, top: '#000', horizon: '#050506', bottom: '#000', fog: { color: '#050506', density: 0.32 }, hemi: ['#3a3a48', '#0a0a0a', 0.08], sun: ['#000', 0] });
    audio.setEcho(0.5);
    const C = 2; // tamanho da célula
    const H = 2.8;
    const wallMat = std({ map: tex.get('dungeonWall'), roughness: 0.55, metalness: 0.05 });
    const floorMat = std({ map: tex.get('dungeonFloor'), roughnessMap: tex.get('dungeonFloorRough'), roughness: 1, metalness: 0.15 });
    const free = (x, z) => MAP[z] && MAP[z][x] && MAP[z][x] !== '#';
    let start = [1, 1];
    const runes = [];
    const runeTex = tex.get('runes');
    const wallGeo = new THREE.BoxGeometry(C, H, C);
    let wallCount = 0; MAP.forEach((r) => { for (const ch of r) if (ch === '#') wallCount++; });
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallCount);
    let wi = 0;
    const m4 = new THREE.Matrix4();
    MAP.forEach((row, z) => [...row].forEach((ch, x) => {
      const wx = x * C, wz = z * C;
      if (ch === '#') { walls.setMatrixAt(wi++, m4.makeTranslation(wx, H / 2, wz)); return; }
      if (ch === 'S') start = [wx, wz];
      if (ch === 'R') {
        // runa gravada na parede vizinha
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => !free(x + dx, z + dz));
        const [dx, dz] = dirs[0];
        const mat = std({ map: runeTex, transparent: true, color: '#6b5a3a', emissive: '#ffbf4a', emissiveMap: runeTex, emissiveIntensity: 0.05, depthWrite: false });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), mat);
        plane.position.set(wx + dx * (C / 2 - 0.01), 1.5, wz + dz * (C / 2 - 0.01));
        plane.lookAt(wx, 1.5, wz);
        root.add(plane); runes.push({ plane, mat, lit: 0, done: false });
      }
    }));
    walls.instanceMatrix.needsUpdate = true;
    root.add(walls);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP[0].length * C, MAP.length * C).rotateX(-Math.PI / 2), floorMat);
    floor.position.set((MAP[0].length - 1) * C / 2, 0, (MAP.length - 1) * C / 2); root.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(MAP[0].length * C, MAP.length * C).rotateX(Math.PI / 2), std({ map: tex.get('roughStone'), roughness: 1 }));
    ceil.position.copy(floor.position).setY(H); root.add(ceil);

    ctx.rig.position.set(start[0], 0, start[1]);
    ctx.rig.rotation.y = -Math.PI / 2; // Face the open east corridor, not the north wall.
    ctx.teleport({ enabled: true, walk: true, check: (p) => free(Math.round(p.x / C), Math.round(p.z / C)) });

    // tocha: cabo de madeira, chamas tremidas, fumaça fina
    const torch = new THREE.Group(); root.add(torch);
    torch.position.copy(ctx.eye()).add(new THREE.Vector3(0.12, -0.2, 0));
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.38, 8).translate(0, -0.19, 0), std({ map: tex.get('woodMedium'), color: '#3a2618' }));
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.07, 8), std({ color: '#2a2018', roughness: 1 }));
    torch.add(handle, wrap);
    const flameMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,190,80,1)'), color: '#ffb347', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const flame = new THREE.Sprite(flameMat); flame.scale.set(0.16, 0.24, 1); flame.position.y = 0.12; torch.add(flame);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,200,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); core.scale.set(0.07, 0.11, 1); core.position.y = 0.08; torch.add(core);
    const light = new THREE.PointLight('#ff9a40', 6, 4.2, 1.6); light.position.y = 0.15; torch.add(light);
    const smoke = new Particles(root, { max: 120, size: 0.16, texture: glowTexture('rgba(150,150,150,0.5)') });
    const embers = new Particles(root, { max: 60, size: 0.015, texture: glowTexture('rgba(255,170,60,1)'), blending: THREE.AdditiveBlending });
    const crackle = audio.noiseLoop({ freq: 2500, q: 0.4, type: 'highpass', vol: 0.006 });
    let popT = 0, found = 0, lastHead = new THREE.Quaternion(), stepT = 0;
    const tp = new THREE.Vector3();

    return {
      onWalk(dt) { if ((stepT -= dt) < 0) { stepT = 0.45; audio.noise({ dur: 0.08, freq: 260, vol: 0.14, echo: true }); } },
      update(dt, t) {
        // a tocha fica onde você aponta
        const eye = ctx.eye();
        // duas mãos: tocha na esquerda, a direita fica livre para apontar/andar. Uma mão: tocha nela.
        const { main: mp, off: op } = hands2(ctx);
        const th = op || mp;
        const p = th && th.source === 'hand' ? th.hand.palm.clone().lerp(th.hand.points[9], 0.5) : th && th.source === 'xr' ? th.handPos.clone() : eye.clone().addScaledVector(input.ray.direction, 0.5).add(new THREE.Vector3(0.12, -0.2, 0));
        torch.position.lerp(p, Math.min(1, dt * 14));
        // fogo treme mais quando você se move rápido
        const q = ctx.camera.getWorldQuaternion(new THREE.Quaternion());
        const agit = Math.min(1, lastHead.angleTo(q) / Math.max(dt, 1e-3) / 3 + input.handVel.length() * 0.3);
        lastHead.copy(q);
        const fl = 0.85 + Math.sin(t * 23) * 0.06 + Math.sin(t * 37) * 0.05 + Math.random() * 0.06 * (1 + agit * 3);
        light.intensity = 6 * fl; flame.scale.set(0.15 * fl, 0.24 * fl * (1 + agit * 0.3), 1);
        flame.position.x = Math.sin(t * 13) * 0.008 * (1 + agit * 4);
        if (Math.random() < dt * 14) {
          torch.getWorldPosition(tp); tp.y += 0.22;
          smoke.spawn(tp, new THREE.Vector3((Math.random() - 0.5) * 0.05, 0.35, (Math.random() - 0.5) * 0.05), { life: 2.2, color: [0.6, 0.6, 0.6, 0.25], drag: 0.3 });
        }
        if (Math.random() < dt * 3) { torch.getWorldPosition(tp); tp.y += 0.15; embers.spawn(tp, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.6, (Math.random() - 0.5) * 0.3), { life: 0.9, color: [1, 0.6, 0.2, 1] }); }
        smoke.update(dt); embers.update(dt);
        if ((popT -= dt) < 0) { popT = 0.1 + Math.random() * 0.5; audio.noise({ dur: 0.02, freq: 3000 + Math.random() * 2000, vol: 0.04 }); }
        void crackle;
        // inscrições brilham dourado quando a tocha aproxima
        torch.getWorldPosition(tp);
        for (const r of runes) {
          const d = r.plane.position.distanceTo(tp);
          const glow = Math.max(0, 1 - (d - 0.4) / 1.6);
          r.mat.emissiveIntensity += ((r.done ? 1.6 : glow * 1.2) - r.mat.emissiveIntensity) * Math.min(1, dt * 5);
          if (!r.done && d < 0.9) { r.lit += dt; if (r.lit > 0.65) { r.done = true; found++; audio.success(); } } else if (!r.done) r.lit = 0;
        }
        ctx.hud(`Runas acesas ${found}/${runes.length}`, found === runes.length ? 'Você revelou todos os segredos da masmorra!' : 'Aproxime a tocha das inscrições · aponte para o chão para andar');
      },
    };
  },
};
