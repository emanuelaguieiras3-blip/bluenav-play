// 🚀 DEFENSOR DE GALÁXIA — Frio e Silêncio Infinito
import { Particles, glowTexture, std } from './common.js';

export default {
  id: 'galaxy',
  create(ctx) {
    const { THREE, root, tex, audio, input, env, rig } = ctx;
    env.set({ top: '#000002', horizon: '#010104', bottom: '#000000', hemi: ['#8fa8ff', '#000', 0.35], sun: ['#fff', 2.0], sunPos: [-30, 10, 20] });

    // estrelas fixas, brancas, tamanhos diferentes
    for (const [n, size] of [[1600, 0.35], [300, 0.8]]) {
      const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(300); a.set([v.x, v.y, v.z], i * 3); }
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size, sizeAttenuation: true, map: glowTexture(), transparent: true, depthWrite: false })));
    }
    // Terra: esfera azul-branca gigante e distante
    const earth = new THREE.Mesh(new THREE.SphereGeometry(140, 48, 32), std({ map: tex.get('earth'), roughness: 0.9 }));
    earth.position.set(60, -170, -260); root.add(earth);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(146, 48, 32), new THREE.MeshBasicMaterial({ color: '#6fb6ff', transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    atmo.position.copy(earth.position); root.add(atmo);

    // naves inimigas: metal fosco com bordas azuis brilhantes
    const hullMat = std({ map: tex.get('metalPanel'), emissiveMap: tex.get('panelGlow'), emissive: '#3fb6ff', emissiveIntensity: 1.4, roughness: 0.75, metalness: 0.5 });
    const makeShip = () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0).scale(1, 0.35, 1.4), hullMat));
      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.6), hullMat); g.add(wing);
      const eng = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(90,190,255,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      eng.scale.set(0.8, 0.8, 1); eng.position.z = 1.0; g.add(eng);
      return g;
    };
    const ships = [];
    const spawnShip = () => {
      const s = makeShip();
      const a = Math.random() * Math.PI * 2, r = 45 + Math.random() * 20;
      s.position.set(Math.cos(a) * r, (Math.random() - 0.3) * 15, Math.sin(a) * r);
      root.add(s);
      ships.push({ s, a, r, h: s.position.y, speed: (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.1), approach: 2 + Math.random() * 2, fireT: 3 + Math.random() * 3, hp: 1 });
    };
    for (let i = 0; i < 5; i++) spawnShip();

    const beams = [], enemyShots = [];
    const sparks = new Particles(root, { max: 500, size: 0.6, texture: glowTexture('rgba(255,190,90,1)'), blending: THREE.AdditiveBlending });
    const smoke = new Particles(root, { max: 300, size: 1.6, texture: glowTexture('rgba(180,180,180,0.6)') });
    const explode = (p) => {
      for (let k = 0; k < 40; k++) sparks.spawn(p, new THREE.Vector3().randomDirection().multiplyScalar(4 + Math.random() * 8), { life: 0.8, color: k % 3 ? [1, 0.75, 0.3, 1] : [1, 0.3, 0.15, 1], drag: 1.5 });
      for (let k = 0; k < 14; k++) smoke.spawn(p, new THREE.Vector3().randomDirection().multiplyScalar(1 + Math.random() * 2), { life: 2.5, color: [0.7, 0.7, 0.72, 0.35], drag: 0.6 });
      audio.noise({ dur: 0.9, freq: 400, to: 60, type: 'lowpass', vol: 0.4 }); audio.tone({ freq: 80, to: 30, dur: 0.6, vol: 0.3 });
    };
    const beamMat = new THREE.MeshBasicMaterial({ color: '#8fd8ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const shotMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,90,90,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    let fireCd = 0, score = 0, shield = 100, push = new THREE.Vector3();
    const rc = new THREE.Raycaster();

    const cds = new Map(); // cadência própria de cada mão
    const fire = (p) => {
      cds.set(p.id, 0.3);
      const input = p; // cada mão mira com o próprio raio
      const from = p.source === 'hand' || p.source === 'xr' ? p.handPos.clone() : ctx.eye().add(new THREE.Vector3(0, -0.25, 0));
      rc.ray.copy(input.ray); rc.far = 200; rc.camera = ctx.camera; // necessário para acertar sprites
      const hit = rc.intersectObjects(ships.map((x) => x.s), true)[0];
      // mira assistida leve
      let target = hit ? ships.find((x) => hit.object.parent === x.s || hit.object === x.s) : null;
      if (!target) {
        let bestA = 0.06;
        for (const sh of ships) { const a = sh.s.position.clone().sub(input.ray.origin).normalize().angleTo(input.ray.direction); if (a < bestA) { bestA = a; target = sh; } }
      }
      const end = target ? target.s.position.clone() : input.ray.origin.clone().addScaledVector(input.ray.direction, 120);
      const len = from.distanceTo(end);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 6).rotateX(Math.PI / 2).translate(0, 0, -len / 2), beamMat.clone());
      beam.position.copy(from); beam.lookAt(end); beam.rotateY(Math.PI);
      root.add(beam); beams.push({ beam, t: 0 });
      audio.tone({ freq: 1400, to: 300, dur: 0.18, type: 'sawtooth', vol: 0.06 });
      if (target) { explode(target.s.position.clone()); target.s.removeFromParent(); ships.splice(ships.indexOf(target), 1); score += 100; setTimeout(spawnShip, 1200); }
    };

    return {
      update(dt) {
        fireCd -= dt;
        // as duas mãos atiram: pinça = um tiro; apontar o indicador = rajada
        for (const p of ctx.pointers()) {
          const cd = (cds.get(p.id) ?? 0) - dt; cds.set(p.id, cd);
          const want = (p.pinchDown && !p.uiBusy) || (p.source === 'hand' && p.gesture === 'apontando' && cd < -0.1);
          if (want && cd <= 0) fire(p);
        }
        // naves passam rápido, mas sempre dá tempo de reagir
        for (const sh of ships) {
          sh.a += sh.speed * dt; sh.r = Math.max(14, sh.r - sh.approach * dt * 0.3);
          const np = new THREE.Vector3(Math.cos(sh.a) * sh.r, sh.h + Math.sin(sh.a * 3) * 2, Math.sin(sh.a) * sh.r);
          sh.s.lookAt(np.clone().add(np.clone().sub(sh.s.position)));
          sh.s.position.copy(np);
          if ((sh.fireT -= dt) < 0) {
            sh.fireT = 4 + Math.random() * 3;
            const sp = new THREE.Sprite(shotMat); sp.scale.set(0.6, 0.6, 1); sp.position.copy(sh.s.position); root.add(sp);
            enemyShots.push({ sp, v: ctx.eye().sub(sh.s.position).normalize().multiplyScalar(9) });
          }
        }
        const eye = ctx.eye();
        for (let i = enemyShots.length - 1; i >= 0; i--) {
          const e = enemyShots[i]; e.sp.position.addScaledVector(e.v, dt);
          const d = e.sp.position.distanceTo(eye);
          // dá para destruir o tiro com o raio ou com a mão
          if (d < 0.6 || ctx.pointers().some((p) => e.sp.position.distanceTo(p.handPos) < 0.35)) {
            if (d < 0.6) { shield = Math.max(0, shield - 10); push.copy(e.v).setLength(0.5); audio.thud(); }
            else { audio.tone({ freq: 900, to: 400, dur: 0.1, vol: 0.08 }); score += 20; }
            e.sp.removeFromParent(); enemyShots.splice(i, 1);
          } else if (d > 120) { e.sp.removeFromParent(); enemyShots.splice(i, 1); }
        }
        // o impacto te empurra levemente pra trás, depois volta
        rig.position.addScaledVector(push, dt * 3); push.multiplyScalar(Math.exp(-4 * dt));
        rig.position.multiplyScalar(Math.exp(-0.8 * dt));
        for (let i = beams.length - 1; i >= 0; i--) { const b = beams[i]; b.t += dt; b.beam.material.opacity = Math.max(0, 0.9 - b.t * 5); if (b.t > 0.2) { b.beam.removeFromParent(); b.beam.geometry.dispose(); b.beam.material.dispose(); beams.splice(i, 1); } }
        sparks.update(dt); smoke.update(dt);
        earth.rotation.y += dt * 0.004;
        if (shield <= 0) { shield = 100; score = Math.floor(score / 2); }
        ctx.hud(`Pontos ${score} · Escudo ${shield}%`, 'Pinça/toque ou aponte para disparar · gire o corpo');
      },
    };
  },
};
