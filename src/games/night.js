// 🔦 NOITE DE SOBREVIVÊNCIA — Escuro que Respira
import { glowTexture, std, hands2 } from './common.js';

export default {
  id: 'night',
  create(ctx) {
    const { THREE, root, tex, audio, input, env, scene } = ctx;
    env.set({ top: '#05070f', horizon: '#0b0f1a', bottom: '#020203', fog: { color: '#05070d', density: 0.045 }, hemi: ['#9faec5', '#293342', 0.65], sun: ['#b4c7ef', 0.5], sunPos: [-10, 20, -30] });
    const R = 26;
    ctx.teleport({ enabled: true, walk: true, check: (p) => Math.hypot(p.x, p.z) < R - 1 && !trunks.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 0.8) });

    root.add(new THREE.Mesh(new THREE.CircleGeometry(R + 20, 48).rotateX(-Math.PI / 2), std({ map: tex.get('forestFloor'), color: '#9a8a7a', roughness: 1 })));
    // lua fina
    const moon = new THREE.Mesh(new THREE.RingGeometry(3.2, 4, 40, 1, -0.9, 1.8), new THREE.MeshBasicMaterial({ color: '#dfe6ff', fog: false, side: THREE.DoubleSide }));
    moon.position.set(-60, 70, -120); moon.lookAt(0, 0, 0); root.add(moon);

    // árvores escuras com casca rugosa — instanciadas (3 desenhos em vez de 180)
    const trunks = [];
    const barkMat = std({ map: tex.get('bark'), color: '#5a4a40', roughness: 1 });
    const folMat = std({ color: '#0f1a12', roughness: 1, flatShading: true });
    const NT = 70;
    const trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.32, 1, 9).translate(0, 0.5, 0), barkMat, NT);
    const folIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 0), folMat, NT);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < NT; i++) {
      const a = Math.random() * 6.28, r = 2.5 + Math.random() * (R + 8);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 6 + Math.random() * 5;
      trunks.push({ x, z });
      trunkIM.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(e.set(0, 0, (Math.random() - 0.5) * 0.08)), new THREE.Vector3(1, h, 1)));
      folIM.setMatrixAt(i, m4.compose(new THREE.Vector3(x, h, z), q.identity(), new THREE.Vector3(1, 1.4, 1)));
    }
    trunkIM.computeBoundingSphere(); folIM.computeBoundingSphere();
    root.add(trunkIM, folIM);
    // galhos secos cinza-claro no chão (quebram ao pisar)
    const twigs = [];
    const NW = 40;
    const twigIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.018, 0.7, 5).rotateZ(Math.PI / 2), std({ color: '#9a958c', roughness: 1 }), NW);
    for (let i = 0; i < NW; i++) {
      const a = Math.random() * 6.28, r = Math.random() * (R - 2);
      const tw = { position: new THREE.Vector3(Math.cos(a) * r, 0.02, Math.sin(a) * r), rot: Math.random() * 3, len: 0.7 + Math.random() * 0.6, i };
      twigIM.setMatrixAt(i, m4.compose(tw.position, q.setFromEuler(e.set(0, tw.rot, 0)), new THREE.Vector3(tw.len, 1, 1)));
      twigs.push({ tw, broken: false });
    }
    twigIM.computeBoundingSphere();
    root.add(twigIM);
    const breakTwig = (t) => { twigIM.setMatrixAt(t.i, m4.compose(t.position, q.setFromEuler(e.set(0, t.rot, 0)), new THREE.Vector3(t.len * 0.5, 1, 1))); twigIM.instanceMatrix.needsUpdate = true; };

    // lanterna: luz amarela-pálida, bordas suaves, mão treme levemente
    const flash = new THREE.SpotLight('#fff2c4', 90, 24, 0.38, 0.85, 1.2);
    const flashTarget = new THREE.Object3D(); root.add(flash, flashTarget); flash.target = flashTarget;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.16, 12).rotateX(Math.PI / 2), std({ color: '#2a2d33', metalness: 0.6, roughness: 0.4 }));
    root.add(body);
    body.position.copy(ctx.eye()).add(new THREE.Vector3(0.15, -0.25, -0.3));

    // sinalizadores para encontrar
    const flares = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.6, r = 9 + Math.random() * 10;
      const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6).translate(0, 0.45, 0), std({ color: '#5a4a3a' }));
      const lampMat = std({ color: '#552', emissive: '#ffb050', emissiveIntensity: 0.05 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), lampMat); lamp.position.y = 0.95;
      const light = new THREE.PointLight('#ffa040', 0, 6, 1.6); light.position.y = 1;
      g.add(post, lamp, light); root.add(g);
      flares.push({ g, lampMat, light, lookT: 0, on: false });
    }
    // silhuetas que se movem devagar no escuro e somem sob a luz
    const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.9 });
    const shades = Array.from({ length: 5 }, (_, i) => {
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 4, 8).translate(0, 0.85, 0), shadowMat.clone());
      const a = Math.random() * 6.28; s.position.set(Math.cos(a) * 14, 0, Math.sin(a) * 14);
      s.userData = { a, r: 12 + i * 2, sp: 0.02 + Math.random() * 0.03 }; root.add(s); return s;
    });

    let soundT = 3, stepT = 0, lit = 0, timeLeft = 180, dawn = 0;
    const rc = new THREE.Raycaster();
    const crunch = (vol = 0.12) => { audio.noise({ dur: 0.07, freq: 2200 + Math.random() * 800, q: 0.8, vol }); audio.noise({ dur: 0.05, freq: 900, vol: vol * 0.6, delay: 0.03 }); };
    const eerie = () => {
      const r = Math.random();
      if (r < 0.33) audio.tone({ freq: 90 + Math.random() * 30, to: 60, dur: 1.4, type: 'sawtooth', vol: 0.015 });
      else if (r < 0.66) { for (let k = 0; k < 2; k++) audio.tone({ freq: 500 + Math.random() * 200, to: 380, dur: 0.4, vol: 0.02, delay: k * 0.5 }); }
      else audio.noise({ dur: 0.25, freq: 1800, q: 2, vol: 0.05 });
    };

    return {
      onWalk(dt) { if ((stepT -= dt) < 0) { stepT = 0.5; crunch(0.16); } },
      update(dt, t) {
        const eye = ctx.eye();
        // lanterna na mão direita (a outra fica livre para apontar e andar); com uma mão, nela
        const lp = hands2(ctx).main;
        const hand = lp && lp.source === 'hand' ? lp.hand.palm.clone() : lp && lp.source === 'xr' ? lp.handPos.clone() : eye.clone().add(new THREE.Vector3(0.15, -0.25, 0)).addScaledVector(input.ray.direction, 0.3);
        body.position.lerp(hand, Math.min(1, dt * 12));
        const dir = (lp || input).ray.direction.clone();
        dir.x += Math.sin(t * 7.3) * 0.006 + Math.sin(t * 13.1) * 0.003; dir.y += Math.cos(t * 6.1) * 0.006;
        body.lookAt(body.position.clone().add(dir));
        flash.position.copy(body.position); flashTarget.position.copy(body.position).addScaledVector(dir, 6);

        // sinalizadores: ilumine com a lanterna por 0,65s para acender
        rc.ray.origin.copy(eye); rc.ray.direction.copy(dir.normalize()); rc.far = 20;
        for (const f of flares) {
          if (f.on) { f.light.intensity = 5 + Math.sin(t * 9) * 0.6; continue; }
          const to = f.g.position.clone().setY(0.95).sub(eye);
          const lookedAt = to.normalize().angleTo(dir) < 0.12 && f.g.position.distanceTo(eye) < 14;
          f.lookT = lookedAt ? f.lookT + dt : 0;
          f.lampMat.emissiveIntensity = 0.05 + Math.min(1, f.lookT / 0.65) * 1.2;
          if (f.lookT > 0.65) { f.on = true; lit++; f.lampMat.emissiveIntensity = 2.5; audio.success(); }
        }
        // silhuetas: se a luz bate, elas somem
        for (const s of shades) {
          const u = s.userData; u.a += u.sp * dt;
          s.position.set(Math.cos(u.a) * u.r, 0, Math.sin(u.a) * u.r);
          const ang = s.position.clone().setY(1).sub(eye).normalize().angleTo(dir);
          const target = ang < 0.4 ? 0 : 0.85;
          s.material.opacity += (target - s.material.opacity) * Math.min(1, dt * (target ? 0.4 : 6));
        }
        // galhos quebram com som seco quando você pisa
        for (const tw of twigs) if (!tw.broken && Math.hypot(tw.tw.position.x - eye.x, tw.tw.position.z - eye.z) < 0.5) { tw.broken = true; breakTwig(tw.tw); crunch(0.35); }
        if ((soundT -= dt) < 0) { soundT = 4 + Math.random() * 7; eerie(); }
        // sobreviva até o amanhecer
        timeLeft = Math.max(0, timeLeft - dt);
        if (timeLeft === 0 || lit === flares.length) dawn = Math.min(1, dawn + dt * 0.08);
        if (dawn > 0) {
          const c = new THREE.Color('#05070d').lerp(new THREE.Color('#e8a878'), dawn * 0.7);
          scene.fog.color.copy(c); scene.background = c; scene.fog.density = 0.09 - dawn * 0.06;
          env.uniforms.horizon.value.copy(c); env.hemi.intensity = 0.12 + dawn * 1.2;
        }
        const m = Math.floor(timeLeft / 60), s = Math.floor(timeLeft % 60);
        ctx.hud(dawn > 0 ? 'O dia está nascendo…' : `Sinalizadores ${lit}/4 · amanhecer em ${m}:${String(s).padStart(2, '0')}`, 'Ilumine os sinalizadores · feche a esquerda para andar');
      },
    };
  },
};
