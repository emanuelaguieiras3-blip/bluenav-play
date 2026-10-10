// 🎧 RITMO DE LUZ — Luz e Som no Espaço
import { glowTexture, std } from './common.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export default {
  id: 'rhythm',
  create(ctx) {
    const { THREE, root, audio, input, env } = ctx;
    env.set({ top: '#0d0e14', horizon: '#16171f', bottom: '#0b0c10', hemi: ['#8888aa', '#111', 0.4], sun: ['#fff', 0] });

    // estrelas muito fracas que piscam devagar
    const sg = new THREE.BufferGeometry(), n = 900, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 40); sp.set([v.x, v.y, v.z], i * 3); }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const starsA = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#cfd8ff', size: 0.25, transparent: true, opacity: 0.35, map: glowTexture(), depthWrite: false }));
    const starsB = starsA.clone(); starsB.material = starsA.material.clone(); starsB.rotation.y = 1.3;
    root.add(starsA, starsB);

    const COLORS = ['#4aa3ff', '#ff5fa8', '#ffcf4a'];
    const lanesX = [-0.35, 0, 0.35], lanesY = [1.15, 1.45];
    // trilhas de luz
    const trackMat = new THREE.MeshBasicMaterial({ color: '#6fa8ff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const x of lanesX) for (const y of lanesY) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 30).translate(0, 0, -15), trackMat); l.position.set(x, y - 0.12, -0.5); root.add(l);
    }
    const cubeGeo = new RoundedBoxGeometry(0.2, 0.2, 0.2, 3, 0.05);
    const glowTex = glowTexture();
    const cubes = [], rings = [];
    // mão = esfera de energia que passa pela luz
    // uma esfera de energia por mão: esquerda azul, direita rosa (uma mão só = esfera branca que acerta tudo)
    const fistGeo = new THREE.SphereGeometry(0.035, 16, 12);
    const fists = ['left', 'right'].map((side) => { const m = new THREE.Mesh(fistGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })); m.userData.side = side; m.visible = false; root.add(m); return m; });

    // música sintetizada: 110 BPM, as notas aparecem no ritmo
    const BPM = 110, beat = 60 / BPM, SPEED = 6, HITZ = -0.55, SPAWNZ = -20;
    const travel = (HITZ - SPAWNZ) / SPEED;
    let nextBeat = audio.t + 1.0, beatN = 0, score = 0, combo = 0, best = 0, misses = 0;
    const scale = [220, 247, 277, 330, 370, 440];
    const pending = [];

    const spawnCube = (lane) => {
      const col = new THREE.Color(COLORS[lane % 3]);
      const m = new THREE.Mesh(cubeGeo, std({ color: col, emissive: col, emissiveIntensity: 1.4, roughness: 0.6 }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(0.7, 0.7, 1); m.add(halo);
      m.position.set(lanesX[lane % 3], lanesY[Math.floor(lane / 3) % 2], SPAWNZ);
      root.add(m); cubes.push({ m, col, alive: true, lane });
    };
    const ring = (p, col) => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.12, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      r.position.copy(p); root.add(r); rings.push({ r, t: 0 });
    };

    return {
      update(dt) {
        // agenda batidas e notas
        const live = audio.ctx && audio.ctx.state === 'running';
        if (live && nextBeat < audio.t - 1) nextBeat = audio.t + 0.2;
        while (live && nextBeat < audio.t + 0.1) {
          const d = nextBeat - audio.t;
          audio.tone({ freq: 110, to: 45, dur: 0.18, vol: 0.32, delay: Math.max(0, d) });
          if (beatN % 2) audio.noise({ dur: 0.04, freq: 8000, type: 'highpass', vol: 0.05, delay: Math.max(0, d) });
          if (beatN % 4 === 0) audio.tone({ freq: scale[(beatN / 4) % scale.length], dur: beat * 3, type: 'triangle', vol: 0.05, delay: Math.max(0, d) });
          // a nota nasce agora para chegar exatamente na batida futura
          if (beatN > 2 && Math.random() < 0.7) pending.push({ at: nextBeat - travel + beat * 4, lane: Math.floor(Math.random() * 6) });
          nextBeat += beat; beatN++;
        }
        for (let i = pending.length - 1; i >= 0; i--) if (audio.t >= pending[i].at) { spawnCube(pending[i].lane); pending.splice(i, 1); }
        if (!live && Math.random() < dt * 1.5) spawnCube(Math.floor(Math.random() * 6)); // sem áudio liberado ainda

        const ps = ctx.pointers();
        const two = ps.length >= 2;
        fists.forEach((f) => { f.visible = false; });
        for (const p of ps.slice(0, 2)) {
          const f = two ? fists.find((x) => x.userData.side === p.side) || fists[0] : fists[1];
          f.visible = true;
          f.position.copy(p.source === 'hand' ? p.hand.palm.clone().lerp(p.hand.points[9], 0.6) : p.source === 'xr' ? p.handPos : ctx.eye().addScaledVector(p.ray.direction, 0.6));
          f.material.color.set(two ? (f.userData.side === 'left' ? COLORS[0] : COLORS[1]) : '#ffffff');
        }
        // a mão local não deve ficar atrás da zona de acerto
        for (const c of cubes) {
          if (!c.alive) continue;
          c.m.position.z += SPEED * dt;
          c.m.rotation.x += dt * 0.6; c.m.rotation.y += dt * 0.4;
          const hitter = fists.find((f) => f.visible && c.m.position.distanceTo(f.position) < 0.2);
          if (hitter) {
            // com duas mãos: cubo da cor da mão vale o dobro
            const match = two && ((hitter.userData.side === 'left' && c.lane % 3 === 0) || (hitter.userData.side === 'right' && c.lane % 3 === 1));
            if (match) score += 10;
            c.alive = false; score += 10 + combo; combo++; best = Math.max(best, combo);
            ring(c.m.position, c.col);
            const f = 440 * Math.pow(2, (Math.floor(Math.random() * 5) * 2) / 12);
            audio.tone({ freq: f, dur: 0.25, type: 'sine', vol: 0.12 });
            c.m.removeFromParent(); c.m.material.dispose(); c.m.children[0].material.dispose();
          } else if (c.m.position.z > 0.6) {
            c.alive = false; combo = 0; misses++;
            c.m.removeFromParent(); c.m.material.dispose(); c.m.children[0].material.dispose();
          }
        }
        for (let i = cubes.length - 1; i >= 0; i--) if (!cubes[i].alive) cubes.splice(i, 1);
        // onda circular de luz que se expande e some
        for (let i = rings.length - 1; i >= 0; i--) {
          const r = rings[i]; r.t += dt; r.r.scale.setScalar(1 + r.t * 9); r.r.material.opacity = Math.max(0, 0.9 - r.t * 1.6);
          if (r.t > 0.6) { r.r.removeFromParent(); r.r.geometry.dispose(); r.r.material.dispose(); rings.splice(i, 1); }
        }
        const tw = Math.sin(performance.now() * 0.0007) * 0.5 + 0.5;
        starsA.material.opacity = 0.2 + tw * 0.2; starsB.material.opacity = 0.4 - tw * 0.2;
        void HITZ;
        ctx.hud(`Pontos ${score} · Combo ${combo}`, `Melhor combo ${best} · perdidos ${misses} · ${two ? "azul = esquerda, rosa = direita (bônus)" : "passe a mão pelos cubos"}`);
      },
    };
  },
};
