// 🦍 PEGA-PEGA VR — locomoção só com os braços, no estilo Gorilla Tag.
// Mapa original BlueNav: floresta com casa na árvore, troncos, pedras e galhos.
import { Particles, std } from './common.js';
import { GorillaMotion, boxSurface, capsuleSurface } from './gorillaMotion.js';
import { createTagRound } from './tagRound.js';
import { rockGeometry } from './sceneProps.js';

export const JUNGLE_RADIUS = 24;

export default {
  id: 'jungle',
  create(ctx) {
    const { THREE, root, tex, audio, env, rig } = ctx;
    env.set({ top: '#6fa8d8', horizon: '#d8ead2', bottom: '#2a3a1f', fog: { color: '#cfe3c8', density: 0.03 }, hemi: ['#f4ffe0', '#2c3a1a', 1.3], sun: ['#ffe9b0', 2.4], sunPos: [6, 20, 4] });
    const surfaces = [], blockers = [];
    // Bots and walking avoid trunks, rocks and stumps (circles on the ground).
    const allowed = (x, z) => Math.hypot(x, z) < JUNGLE_RADIUS && !blockers.some(b => Math.hypot(x - b.x, z - b.z) < b.radius + 0.2);
    ctx.teleport({ enabled: true, walk: true, floorY: 0, check: p => allowed(p.x, p.z) });

    // Subdivided: huge single triangles get clipped badly on some GPUs.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 64, 64).rotateX(-Math.PI / 2), std({ map: tex.get('forestFloor', { repeat: [14, 14] }), roughness: 1 }));
    root.add(floor);
    const barkMat = std({ map: tex.get('barkMoss'), roughness: 0.95 });
    const branchMat = std({ map: tex.get('bark'), roughness: 0.95 });
    const woodMat = std({ map: tex.get('woodMedium'), roughness: 0.85 });
    const rockMat = std({ map: tex.get('roughStone'), color: '#a19c92', roughness: 1, flatShading: true });
    const leafMat = std({ map: tex.get('leaf'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
    leafMat.emissive = new THREE.Color('#1c3a10'); leafMat.emissiveIntensity = 0.25;
    const leafCount = ctx.mobile ? 700 : 1500;
    const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.4, 0.4), leafMat, leafCount);
    let li = 0;
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    const addLeaves = (c, r, n) => {
      for (let k = 0; k < n && li < leafCount; k++, li++) {
        const p = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(r * Math.cbrt(Math.random())).add(c);
        qq.setFromEuler(e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6));
        const s = 0.7 + Math.random() * 0.8; leaves.setMatrixAt(li, m4.compose(p, qq, sc.set(s, s, s)));
      }
    };
    // Tapered limb between two points: real cylinder geometry, capsule collision.
    const limb = (a, b, r0, r1, material) => {
      const length = a.distanceTo(b), mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, length, 12, 1), material);
      mesh.position.copy(a).lerp(b, 0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      root.add(mesh); surfaces.push(capsuleSurface(a, b, (r0 + r1) / 2)); return mesh;
    };
    const tree = (x, z, height, radius, branches, seed) => {
      const base = new THREE.Vector3(x, 0, z), top = new THREE.Vector3(x, height, z);
      limb(base, top, radius, radius * 0.6, barkMat);
      // Root flare so the trunk meets the ground like a real tree.
      const flare = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.6, 0.6, 14), barkMat); flare.position.set(x, 0.3, z); root.add(flare);
      blockers.push({ x, z, radius: radius * 1.3 });
      addLeaves(top, 3.4, Math.round(110 * leafCount / 1500));
      for (let i = 0; i < branches; i++) {
        const y = 1.3 + i * (height - 3) / branches + ((seed * 7 + i * 3) % 5) * 0.08, angle = i * 2.1 + seed, length = 1.8 + ((seed + i) % 4) * 0.35;
        const from = new THREE.Vector3(x + Math.cos(angle) * radius * 0.7, y, z + Math.sin(angle) * radius * 0.7);
        const to = new THREE.Vector3(x + Math.cos(angle) * (radius + length), y + 0.35, z + Math.sin(angle) * (radius + length));
        limb(from, to, 0.13, 0.06, branchMat);
        addLeaves(to, 0.9, Math.round(24 * leafCount / 1500));
      }
    };
    // Central tree with a two-floor tree house, the main play area.
    const hub = new THREE.Vector3(0, 0, -7);
    tree(hub.x, hub.z, 15, 0.95, 6, 1);
    const deck = (y, size) => {
      const box = new THREE.Box3(new THREE.Vector3(hub.x - size / 2, y - 0.12, hub.z - size / 2), new THREE.Vector3(hub.x + size / 2, y + 0.12, hub.z + size / 2));
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, 0.24, size), woodMat); box.getCenter(mesh.position); root.add(mesh);
      surfaces.push(boxSurface(box));
      // Rails are round poles: grab them to swing up.
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const a = new THREE.Vector3(hub.x + sx * size / 2, y, hub.z + sz * size / 2), b = a.clone(); b.y += 0.9;
        limb(a, b, 0.06, 0.06, woodMat);
      }
      for (let k = 0; k < 4; k++) {
        const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]], a = c[k], b = c[(k + 1) % 4];
        if (k === 2) continue; // open side to climb in
        limb(new THREE.Vector3(hub.x + a[0] * size / 2, y + 0.85, hub.z + a[1] * size / 2), new THREE.Vector3(hub.x + b[0] * size / 2, y + 0.85, hub.z + b[1] * size / 2), 0.045, 0.045, woodMat);
      }
      // Roof as a real cone (thatched hut), only on the top floor.
      return mesh;
    };
    deck(3.2, 4.4); deck(7.2, 3.2);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 10), std({ map: tex.get('woodLight'), color: '#8c6a43', roughness: 1 }));
    roof.position.set(hub.x, 9.3, hub.z); root.add(roof); surfaces.push(capsuleSurface(new THREE.Vector3(hub.x, 8.9, hub.z), new THREE.Vector3(hub.x, 9.6, hub.z), 1.6));
    // Ladder-like steps of logs leaning on the first deck.
    for (let i = 0; i < 4; i++) limb(new THREE.Vector3(hub.x - 2.8 + i * 0.05, 0.4 + i * 0.75, hub.z + 2.6 - i * 0.1), new THREE.Vector3(hub.x - 1.4, 0.4 + i * 0.75, hub.z + 2.9 - i * 0.1), 0.09, 0.09, branchMat);
    [[6, -2, 12, 0.5, 5, 2], [-6.5, -1, 11, 0.55, 5, 3], [4.5, -12, 13, 0.6, 5, 4], [-5, -13, 12, 0.5, 4, 5], [9, -8, 10, 0.45, 4, 6], [-10, -7, 11, 0.5, 4, 7], [2, 5, 10, 0.45, 3, 8], [-3.5, 6, 12, 0.5, 4, 9], [12, 2, 11, 0.5, 3, 10], [-12, 3, 10, 0.45, 3, 11]]
      .forEach(([x, z, h, r, n, s]) => tree(x, z, h, r, n, s));
    // Rocks, stumps and fallen logs: low things to push off and run across.
    [[3, -4, 0.8], [-3.2, -3.5, 0.6], [7.5, -5, 1.1], [-8, -10, 0.9], [1, 2.5, 0.5], [10, -12, 1.3]].forEach(([x, z, r], i) => {
      const rock = new THREE.Mesh(rockGeometry(r, i * 3), rockMat); rock.position.set(x, r * 0.55, z); root.add(rock);
      surfaces.push(capsuleSurface(rock.position, rock.position, r * 0.85)); blockers.push({ x, z, radius: r * 0.85 });
    });
    [[-2, -1.5], [5, 1.5], [-7, -4.5]].forEach(([x, z]) => {
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.7, 14), barkMat); stump.position.set(x, 0.35, z); root.add(stump);
      surfaces.push(boxSurface(new THREE.Box3(new THREE.Vector3(x - 0.42, 0, z - 0.42), new THREE.Vector3(x + 0.42, 0.7, z + 0.42)))); blockers.push({ x, z, radius: 0.45 });
    });
    [[[-4, 0.3, -9], [-1.5, 0.3, -11.5]], [[3, 0.3, -9.5], [6, 0.35, -10.5]], [[-1, 0.3, 3.5], [2.5, 0.3, 4]]].forEach(([a, b]) => limb(new THREE.Vector3(...a), new THREE.Vector3(...b), 0.3, 0.27, branchMat));
    // Boundary: a ring of tall rocks marks the edge of the map.
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, r = JUNGLE_RADIUS + 1.2, rock = new THREE.Mesh(rockGeometry(1.5 + (i % 3) * 0.4, i), rockMat);
      rock.position.set(Math.cos(a) * r, 1, Math.sin(a) * r); rock.scale.y = 1.6; root.add(rock);
    }
    leaves.count = li; root.add(leaves);

    // Gorilla hands: dark fur palms that stay where they touch.
    const motion = new GorillaMotion(ctx, surfaces, allowed, { crouch: 0.55 });
    const furMat = std({ color: '#3b2f2a', map: tex.get('fabric'), roughness: 1 });
    const lavaMat = std({ color: '#ff5a1f', emissive: '#ff3a00', emissiveIntensity: 0.8, roughness: 0.6 });
    const handMeshes = [0, 1].map(() => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10).scale(1, 0.6, 1.1), furMat));
      for (let f = 0; f < 4; f++) { const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.05, 3, 8).rotateX(Math.PI / 2), furMat); finger.position.set(-0.036 + f * 0.024, -0.005, -0.07); g.add(finger); }
      g.visible = false; root.add(g); return g;
    });
    const round = createTagRound(ctx, allowed);
    ctx.app.onTeleport = () => motion.reset();
    rig.position.y = -0.55;

    const shaftMat = new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 16, 12, 1, true), shaftMat);
      sh.position.set((Math.random() - 0.5) * 16, 7, (Math.random() - 0.5) * 16 - 3); sh.rotation.z = 0.35; sh.rotation.x = 0.15; root.add(sh);
    }
    const falling = new Particles(root, { max: 100, size: 0.12, texture: tex.get('leaf') });
    const wind = audio.noiseLoop({ freq: 700, q: 0.5, vol: 0.03 });
    let birdT = 2;
    const up = new THREE.Vector3(0, 1, 0);
    return {
      round, motion, surfaces,
      getState: () => ({ ...round.getState(), height: rig.position.y + motion.crouch, speed: motion.velocity.length(), touching: motion.touching, jumps: motion.jumps }),
      update(dt) {
        motion.update(dt);
        // Hands drawn at the gorilla hand position (stuck on contact).
        const states = [...motion.hands.values()], it = round.getState().role === 'catch' && round.getState().state === 'playing';
        handMeshes.forEach((g, i) => {
          const s = states[i]; g.visible = !!s; if (!s) return;
          g.position.copy(s.last); g.children.forEach(c => c.material = it ? lavaMat : furMat);
          if (s.touching) g.quaternion.setFromUnitVectors(up, s.normal); else g.quaternion.identity();
        });
        const h = rig.position.y + motion.crouch;
        if (wind) wind.gain.gain.setTargetAtTime(0.03 + Math.max(0, h) * 0.012 + motion.velocity.length() * 0.01, audio.t, 0.3);
        if (Math.random() < dt * 5) {
          const eye = ctx.eye();
          falling.spawn(new THREE.Vector3(eye.x + (Math.random() - 0.5) * 3, eye.y + 2.5, eye.z + (Math.random() - 0.5) * 3), new THREE.Vector3(Math.random() - 0.5, -0.6, Math.random() - 0.5), { life: 5, color: [1, 1, 1, 1], drag: 0.5 });
        }
        falling.update(dt);
        if ((birdT -= dt) < 0) {
          birdT = 2 + Math.random() * 5;
          const f = 1800 + Math.random() * 1500;
          for (let k = 0; k < 3; k++) audio.tone({ freq: f, to: f * 1.3, dur: 0.08, vol: 0.03, delay: k * 0.12 });
        }
        const status = round.update(dt);
        ctx.hud(`Pega-pega VR · ${motion.velocity.length().toFixed(1)} m/s · altura ${Math.max(0, h).toFixed(1)} m`, status);
      },
      dispose() { motion.reset(); },
    };
  },
};
