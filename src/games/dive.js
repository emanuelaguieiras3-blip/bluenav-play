// 🌊 MERGULHO PROFUNDO — Água que Abraça
import { Particles, GrabMover, glowTexture, std } from './common.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export default {
  id: 'dive',
  create(ctx) {
    const { THREE, root, tex, audio, input, env, rig, scene } = ctx;
    env.set({ top: '#3fc2d8', horizon: '#1a7fa6', bottom: '#06263f', sharp: 0.8, fog: { color: '#1a7fa6', density: 0.06 }, hemi: ['#bff3ff', '#0b3550', 1.4], sun: ['#e8fbff', 1.6], sunPos: [2, 20, 1] });
    rig.position.set(0, 4, 0);
    const SEABED = -6;

    const bed = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 60, 60).rotateX(-Math.PI / 2), std({ map: tex.get('sand'), roughness: 1 }));
    const bp = bed.geometry.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setY(i, Math.sin(bp.getX(i) * 0.2) * 0.4 + Math.cos(bp.getZ(i) * 0.15) * 0.5);
    bed.geometry.computeVertexNormals(); bed.position.y = SEABED; root.add(bed);

    // corais: calcário poroso branco, rosa-pálido e roxo-suave — mesclados por cor (4 desenhos)
    const coralTex = tex.get('coral');
    const coralCols = ['#f4efe9', '#f2c4cc', '#c9b2e0', '#f6d6c0'];
    const byColor = coralCols.map(() => []);
    const tmpObj = new THREE.Object3D();
    const place = (geo, pos, rot, scale) => { tmpObj.position.copy(pos); tmpObj.rotation.copy(rot); tmpObj.scale.copy(scale); tmpObj.updateMatrix(); return geo.applyMatrix4(tmpObj.matrix); };
    for (let i = 0; i < 46; i++) {
      const g = new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.5, 2);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(p, k); v.multiplyScalar(1 + Math.sin(v.x * 9) * 0.15 + Math.cos(v.y * 11) * 0.12); p.setXYZ(k, v.x, v.y, v.z); }
      const a = Math.random() * 6.28, r = 2 + Math.random() * 16;
      const pos = new THREE.Vector3(Math.cos(a) * r, SEABED + 0.3, Math.sin(a) * r);
      byColor[i % 4].push(place(g, pos, new THREE.Euler(), new THREE.Vector3(1, 0.6 + Math.random() * 1.2, 1)));
      if (i % 3 === 0) for (let b = 0; b < 4; b++) {
        const bg = new THREE.CylinderGeometry(0.03, 0.07, 0.8, 6).toNonIndexed();
        bg.deleteAttribute('uv'); bg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(bg.attributes.position.count * 2), 2));
        byColor[i % 4].push(place(bg, pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.6)), new THREE.Euler(Math.random() - 0.5, 0, Math.random() - 0.5), new THREE.Vector3(1, 1, 1)));
      }
    }
    byColor.forEach((list, ci) => {
      const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(geos); merged.computeVertexNormals();
      geos.forEach((g) => g.dispose());
      root.add(new THREE.Mesh(merged, std({ map: coralTex, color: coralCols[ci], roughness: 1 })));
    });

    // raios de sol inclinados vindos de cima
    const rayMat = new THREE.MeshBasicMaterial({ color: '#d8fbff', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const rays = [];
    for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.8 + Math.random(), 18), rayMat); r.position.set((Math.random() - 0.5) * 20, 3, (Math.random() - 0.5) * 20); r.rotation.set(0, Math.random() * 3, 0.3); root.add(r); rays.push(r); }

    // peixes: escamas prateadas, azul-claro, amarelo-pálido
    const fishGeo = (() => {
      const body = new THREE.SphereGeometry(0.1, 10, 8).scale(0.45, 0.6, 1.4);
      const tail = new THREE.ConeGeometry(0.07, 0.12, 4).rotateX(-Math.PI / 2).scale(0.3, 1, 1).translate(0, 0, 0.17);
      const pos = [...body.toNonIndexed().attributes.position.array, ...tail.toNonIndexed().attributes.position.array];
      const uv = [...body.toNonIndexed().attributes.uv.array, ...tail.toNonIndexed().attributes.uv.array];
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
    })();
    const fishCols = ['#d7dde6', '#a9d6f5', '#f3e7a6'];
    const schools = fishCols.map((col, si) => {
      const n = 22;
      const mesh = new THREE.InstancedMesh(fishGeo, std({ map: tex.get('fishScale'), color: col, roughness: 0.45, metalness: 0.2 }), n);
      root.add(mesh);
      const fish = Array.from({ length: n }, () => ({ p: new THREE.Vector3((Math.random() - 0.5) * 3, -1 - si * 1.5 + Math.random(), (Math.random() - 0.5) * 3), ph: Math.random() * 6 }));
      return { mesh, fish, center: new THREE.Vector3(0, -1.5 - si, -4), a: si * 2, r: 4 + si * 2, speed: 0.12 + si * 0.04 };
    });
    // tartaruga
    const turtle = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1.25), std({ map: tex.get('turtleShell'), roughness: 0.85 }));
    const belly = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20).rotateX(Math.PI / 2).scale(1, 1, 1.25), std({ color: '#c8b98a' }));
    const tskin = std({ color: '#7d8a5a', roughness: 0.9 });
    const thead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8).scale(1, 0.8, 1.3), tskin); thead.position.set(0, 0.02, -0.62);
    const flips = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.14), tskin); f.position.set(sx * 0.42, 0, sz * 0.3); f.userData.s = sx; return f; });
    turtle.add(shell, belly, thead, ...flips); root.add(turtle);

    // plâncton brilhando suavemente
    const pg = new THREE.BufferGeometry(), pn = 700, pa = new Float32Array(pn * 3);
    for (let i = 0; i < pn; i++) pa.set([(Math.random() - 0.5) * 24, SEABED + Math.random() * 12, (Math.random() - 0.5) * 24], i * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(pa, 3));
    const plankton = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.025, transparent: true, opacity: 0.7, map: glowTexture(), depthWrite: false }));
    root.add(plankton);
    const bubbles = new Particles(root, { max: 120, size: 0.05, texture: glowTexture('rgba(220,250,255,0.9)', 'rgba(220,250,255,0)') });

    const mover = new GrabMover(ctx);
    const drift = new THREE.Vector3();
    const water = audio.noiseLoop({ freq: 220, q: 0.5, type: 'lowpass', vol: 0.08 });
    let beatT = 1, lastRig = null;
    const surface = new THREE.Color('#1a7fa6'), deep = new THREE.Color('#05213a');

    return {
      update(dt, t) {
        // nadar: segure (pinça/toque) e puxe a água; o corpo desliza leve, sem cair
        // Stroke speed is the hand relative to the body: the glide itself is not a stroke.
        const rigVelocity = lastRig && dt > 0 ? rig.position.clone().sub(lastRig).divideScalar(dt) : new THREE.Vector3();
        for (const p of ctx.pointers()) {
          if (p.source === 'hand') {
            // mão fechada (pinça) agarra a água e puxa; mão aberta dando braçada empurra
            if (p.pinch && !p.uiBusy) { if (!mover.holding(p)) mover.start(p); }
            else if (mover.holding(p)) mover.stop(p);
            const v = p.vel.clone().sub(rigVelocity);
            if (!p.pinch && v.length() > 0.45) drift.addScaledVector(v, -1.6 * dt); // braçada: corpo vai para o lado oposto
          } else if (p.pinch && !p.uiBusy) drift.addScaledVector(p.ray.direction, dt * 0.9); // toque/clique: nada para onde olha
        }
        if (mover.active) { const d = mover.update(null, dt, 1.4); drift.addScaledVector(d, 0.6); }
        rig.position.addScaledVector(drift, dt);
        drift.multiplyScalar(Math.exp(-1.1 * dt));
        rig.position.y = THREE.MathUtils.clamp(rig.position.y, SEABED - 1.2, 3.5);
        rig.position.x = THREE.MathUtils.clamp(rig.position.x, -40, 40); rig.position.z = THREE.MathUtils.clamp(rig.position.z, -40, 40);
        lastRig = (lastRig || new THREE.Vector3()).copy(rig.position);

        // mais fundo: mais escuro e mais silencioso
        const depth = THREE.MathUtils.clamp((3.5 - rig.position.y) / 9, 0, 1);
        const c = surface.clone().lerp(deep, depth);
        scene.fog.color.copy(c); scene.background = c; env.uniforms.horizon.value.copy(c);
        env.hemi.intensity = 1.4 - depth * 0.9;
        rayMat.opacity = 0.07 * (1 - depth * 0.8);
        if (water) { water.gain.gain.setTargetAtTime(0.08 * (1 - depth * 0.7), audio.t, 0.3); water.filter.frequency.setTargetAtTime(260 - depth * 140, audio.t, 0.3); }
        // só o som do seu próprio coração
        if ((beatT -= dt) < 0) { beatT = 1.05; const v = 0.05 + depth * 0.2; audio.tone({ freq: 55, to: 40, dur: 0.12, vol: v }); audio.tone({ freq: 50, to: 38, dur: 0.12, vol: v * 0.7, delay: 0.22 }); }

        rays.forEach((r, i) => { r.rotation.z = 0.3 + Math.sin(t * 0.3 + i) * 0.04; });
        plankton.rotation.y = t * 0.01; plankton.position.y = Math.sin(t * 0.2) * 0.2;
        // cardumes
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
        for (const sc of schools) {
          sc.a += sc.speed * dt;
          const cen = new THREE.Vector3(Math.cos(sc.a) * sc.r, sc.center.y + Math.sin(sc.a * 2) * 0.5, Math.sin(sc.a) * sc.r - 3);
          const dir = new THREE.Vector3(-Math.sin(sc.a), 0, Math.cos(sc.a));
          sc.fish.forEach((f, i) => {
            const target = cen.clone().add(new THREE.Vector3(Math.sin(i * 1.7 + t * 0.4), Math.sin(i * 2.3 + t * 0.6) * 0.4, Math.cos(i * 1.3 + t * 0.5)).multiplyScalar(0.9));
            f.p.lerp(target, Math.min(1, dt * 0.8));
            q.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, new THREE.Vector3(0, 1, 0)));
            q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 8 + f.ph) * 0.15));
            sc.mesh.setMatrixAt(i, m4.compose(f.p, q, s1));
          });
          sc.mesh.instanceMatrix.needsUpdate = true;
        }
        // tartaruga planando
        const ta = t * 0.05;
        turtle.position.set(Math.cos(ta) * 7, -3 + Math.sin(t * 0.3) * 0.4, Math.sin(ta) * 7 - 2);
        turtle.rotation.y = -ta + Math.PI;
        flips.forEach((f, i) => { f.rotation.z = Math.sin(t * 1.6 + (i < 2 ? 0 : 1)) * 0.4 * f.userData.s; });
        // bolhas sobem devagar perto do rosto
        if (Math.random() < dt * 3) { const e = ctx.eye(); bubbles.spawn(e.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.3, -0.3 + (Math.random() - 0.5) * 0.3)), new THREE.Vector3((Math.random() - 0.5) * 0.05, 0.35, 0), { life: 4, color: [1, 1, 1, 0.8] }); }
        bubbles.update(dt);
        ctx.hud(`Profundidade ${Math.max(0, (3.5 - rig.position.y)).toFixed(1)} m`, 'Braçadas com as mãos abertas, ou pince e puxe a água');
      },
      dispose() { mover.stop(); },
    };
  },
};
