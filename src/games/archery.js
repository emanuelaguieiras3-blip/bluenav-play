// 🎯 ARQUEIRO MESTRE — Madeira e Penas
import { Particles, std, hands2 } from './common.js';

export default {
  id: 'archery',
  create(ctx) {
    const { THREE, root, tex, audio, input, env } = ctx;
    env.set({ top: '#3f7fd0', horizon: '#d6e8f5', bottom: '#5b7a3a', fog: { color: '#d6e8f5', near: 30, far: 140 }, hemi: ['#f0f7ff', '#4c6a32', 1.6], sun: ['#fff6e2', 2.2], sunPos: [10, 30, 8] });

    root.add(new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), std({ map: tex.get('grass', { repeat: [60, 60] }), roughness: 1 })));
    // colina azulada distante
    for (const [x, z, r] of [[-60, -110, 45], [30, -130, 60], [90, -100, 38]]) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#6f8fae', roughness: 1 }));
      hill.scale.y = 0.45; hill.position.set(x, 0, z); root.add(hill);
    }

    // alvos: madeira clara com anéis
    const targets = [];
    const targetMat = std({ map: tex.get('target'), roughness: 0.9 });
    const standMat = std({ map: tex.get('woodLight') });
    [[0, -10], [-4, -20], [5, -30]].forEach(([x, z]) => {
      const g = new THREE.Group();
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), targetMat); face.position.z = 0.06;
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 48).rotateX(Math.PI / 2), standMat);
      const legs = [-0.35, 0.35].map((lx) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), standMat); l.position.set(lx, -0.6, -0.1); l.rotation.z = lx * 0.3; return l; });
      g.add(face, back, ...legs); g.position.set(x, 1.4, z);
      root.add(g); targets.push({ g, face });
    });

    // arco: madeira polida em curva
    const bowGroup = new THREE.Group(); root.add(bowGroup);
    const bowCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.62, 0), new THREE.Vector3(0, 0, -0.32), new THREE.Vector3(0, 0.62, 0));
    const bow = new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 32, 0.016, 8), std({ map: tex.get('bowWood'), roughness: 0.35 }));
    const gripM = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 10), std({ map: tex.get('leather'), color: '#5a3a20' }));
    gripM.position.z = -0.16;
    bowGroup.add(bow, gripM);
    const strGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.6, -0.012), new THREE.Vector3(0, 0, -0.012), new THREE.Vector3(0, 0.6, -0.012)]);
    const string = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: '#f2efe6' }));
    bowGroup.add(string);

    // flecha
    const shaftMat = std({ color: '#c9a25e', roughness: 0.6 });
    const headMat = std({ color: '#3a3d42', metalness: 0.7, roughness: 0.5 });
    const featherMat = std({ map: tex.get('feather'), alphaTest: 0.3, side: THREE.DoubleSide });
    const makeArrow = () => {
      const a = new THREE.Group();
      a.add(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.75, 6).rotateX(Math.PI / 2), shaftMat));
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 8).rotateX(-Math.PI / 2), headMat); h.position.z = -0.4; a.add(h);
      for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.12), featherMat); f.rotation.set(Math.PI / 2, 0, (k * Math.PI * 2) / 3); f.position.z = 0.3; f.rotateY(Math.PI / 2); a.add(f); }
      return a;
    };
    const nocked = makeArrow(); bowGroup.add(nocked);
    // Prévia balística leve: mostra a queda real da flecha enquanto puxa.
    const trajectory = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 6, 4), new THREE.MeshBasicMaterial({ color: '#8fd8ff', transparent: true, opacity: 0.7 }), 18);
    trajectory.frustumCulled = false; trajectory.visible = false; root.add(trajectory);
    const trajectoryMatrix = new THREE.Matrix4(), trajectoryPoint = new THREE.Vector3();
    const flying = [];
    const leaves = new Particles(root, { max: 80, size: 0.08, texture: tex.get('leaf') });

    let stringHeld = false;
    const aimDir = new THREE.Vector3(0, 0, -1), aimPos = new THREE.Vector3();
    let draw = 0, drawing = false, score = 0, shots = 0, last = '';
    const twang = () => { audio.tone({ freq: 180, to: 120, dur: 0.25, type: 'triangle', vol: 0.14 }); audio.noise({ dur: 0.06, freq: 2500, vol: 0.1 }); };
    const vib = { t: 0 };

    return {
      update(dt, t) {
        const eye = ctx.eye();
        const { main: stringP, off: bowP } = hands2(ctx);
        const two = !!(bowP && stringP && stringP.source === 'hand');
        let dir, bowPos, wantDraw;
        if (two) {
          // DUAS MÃOS: a esquerda segura o arco; a direita pinça a corda perto do arco e puxa para trás.
          // A flecha sai na linha da mão da corda até a mão do arco.
          bowPos = bowP.hand.palm.clone();
          if (stringP.pinchDown && !stringP.uiBusy && stringP.handPos.distanceTo(bowPos) < 0.3) stringHeld = true;
          if (!stringP.pinch) stringHeld = false;
          dir = stringHeld ? bowPos.clone().sub(stringP.handPos).normalize() : bowPos.clone().sub(eye).normalize();
          wantDraw = stringHeld;
          if (stringHeld) draw = THREE.MathUtils.clamp((stringP.handPos.distanceTo(bowPos) - 0.12) / 0.45, 0, 1);
        } else {
          // UMA MÃO (ou toque/clique): o arco fica à frente, mira para onde o raio aponta
          dir = input.ray.direction.clone();
          bowPos = eye.clone().addScaledVector(dir, 0.55).add(new THREE.Vector3(0, -0.1, 0)).add(new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(-0.14));
          wantDraw = input.pinch && !ctx.uiBusy();
          if (wantDraw) {
            let pull = draw + dt * (1 - draw) * 1.4;
            if (input.source === 'hand') {
              const back = eye.clone().sub(input.handPos).dot(dir); // mão vindo para trás
              pull = Math.max(pull * 0.6, THREE.MathUtils.clamp((0.45 - back) / 0.35, 0, 1));
            }
            draw = Math.min(1, pull);
          }
        }
        bowGroup.position.copy(bowPos);
        bowGroup.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, new THREE.Vector3(0, 1, 0)));
        trajectory.visible = wantDraw && draw > 0.15;
        if (trajectory.visible) {
          for (let i = 0; i < 18; i++) {
            const time = (i + 1) * 0.045;
            trajectoryPoint.copy(bowPos).addScaledVector(dir, (18 + draw * 40) * time);
            trajectoryPoint.y -= 0.5 * 4.9 * time * time;
            trajectory.setMatrixAt(i, trajectoryMatrix.makeTranslation(trajectoryPoint.x, trajectoryPoint.y, trajectoryPoint.z));
          }
          trajectory.instanceMatrix.needsUpdate = true;
          trajectory.material.color.set(draw > 0.75 ? '#66ffb3' : '#8fd8ff');
        }

        // quanto mais puxa, mais resiste (mão treme)
        if (wantDraw) {
          drawing = true; aimDir.copy(dir); aimPos.copy(bowPos); // a direção do momento em que solta
        } else if (drawing) {
          drawing = false;
          if (draw > 0.15) {
            const a = makeArrow(); root.add(a);
            a.position.copy(aimPos); a.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), aimDir, new THREE.Vector3(0, 1, 0)));
            flying.push({ a, v: aimDir.clone().multiplyScalar(18 + draw * 40), done: false });
            twang(); vib.t = 0.5; shots++;
          }
          draw = 0;
        }
        const shakeAmt = draw > 0.6 ? (draw - 0.6) * 0.012 : 0;
        bowGroup.position.x += Math.sin(t * 60) * shakeAmt; bowGroup.position.y += Math.cos(t * 47) * shakeAmt;
        // corda: puxada no meio, vibra ao soltar
        const p = strGeo.attributes.position;
        const vibr = vib.t > 0 ? Math.sin(t * 120) * 0.01 * vib.t : 0;
        vib.t = Math.max(0, vib.t - dt);
        p.setXYZ(1, vibr, 0, -0.012 + draw * 0.32);
        p.needsUpdate = true;
        nocked.position.z = -0.012 + draw * 0.32 - 0.375; // a ponta traseira encaixa na corda
        nocked.visible = !vib.t || vib.t < 0.3;

        // flechas voando com leve curvatura
        for (const f of flying) {
          if (f.done) continue;
          f.v.y -= 9.8 * dt * 0.5;
          const prev = f.a.position.clone();
          f.a.position.addScaledVector(f.v, dt);
          f.a.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), f.v, new THREE.Vector3(0, 1, 0)));
          for (const tg of targets) {
            const c = tg.g.position, plane = c.z + 0.06;
            if (prev.z > plane && f.a.position.z <= plane) {
              const k = (prev.z - plane) / (prev.z - f.a.position.z);
              const hit = prev.clone().lerp(f.a.position, k);
              const r = Math.hypot(hit.x - c.x, hit.y - c.y);
              if (r < 0.6) {
                f.done = true; f.a.position.copy(hit);
                const ring = Math.floor((r / 0.6) * 5), pts = [10, 8, 6, 4, 2][ring] ?? 1;
                score += pts; last = ring === 0 ? 'Na mosca! +10' : `+${pts}`;
                audio.thud(); audio.noise({ dur: 0.05, freq: 1500, vol: 0.12 });
                if (ring === 0) audio.success();
              }
            }
          }
          if (f.a.position.y < 0.02) { f.done = true; f.a.position.y = 0.02; audio.noise({ dur: 0.05, freq: 600, vol: 0.06 }); }
        }
        while (flying.length > 15) { const o = flying.shift(); o.a.removeFromParent(); }
        // vento suave mexendo folhas no chão
        if (Math.random() < dt * 4) leaves.spawn(new THREE.Vector3(eye.x - 6 + Math.random() * 3, 0.05, eye.z - 3 - Math.random() * 15), new THREE.Vector3(1.2, 0.15, 0), { life: 5, color: [0.85, 0.7, 0.4, 1], drag: 0.2 });
        leaves.update(dt);
        ctx.hud(`Pontos ${score} · Flechas ${shots}`, last || (two ? 'Pince a corda com a mão direita e puxe para trás' : 'Segure a pinça (ou toque) para puxar, solte para atirar'));
      },
    };
  },
};
