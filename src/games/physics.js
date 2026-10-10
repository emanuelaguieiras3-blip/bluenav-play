// 🧪 LABORATÓRIO DE FÍSICA — Leis que Você Toca
import { std, glowTexture, phys } from './common.js';

export default {
  id: 'physics',
  create(ctx) {
    ctx.lookDown();
    const { THREE, root, tex, audio, input, env, app } = ctx;
    env.set({ top: '#f4f6f8', horizon: '#ffffff', bottom: '#eceff2', sharp: 1, hemi: ['#ffffff', '#dfe3e8', 2.2], sun: ['#ffffff', 1.0], sunPos: [2, 6, 3] });
    app.renderer.localClippingEnabled = true;
    const FLOOR = 0.55;
    const shadowTex = glowTexture('rgba(0,0,0,0.35)');
    const shadowOf = (r) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(r * 3, r * 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); s.position.y = FLOOR + 0.001; root.add(s); return s; };
    const label = (t, x, y, z) => { const l = ctx.label(t, { w: 0.36, h: 0.06, bg: 'rgba(30,40,60,0.08)', fg: '#4a5568', size: 0.42 }); l.position.set(x, y, z); root.add(l); return l; };

    // ---- bola de borracha ----
    const R = 0.05;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), std({ map: tex.get('rubber'), roughness: 0.85 }));
    ball.position.set(-0.45, 1.3, -0.8); root.add(ball);
    const ballShadow = shadowOf(R);
    const ballS = { v: new THREE.Vector3(), held: false, maxH: 0 };
    const trail = []; const trailMat = new THREE.MeshBasicMaterial({ color: '#7a8aa6', transparent: true, opacity: 0.4 });
    const trailGeo = new THREE.SphereGeometry(0.006, 6, 4);
    const ballLbl = label('Bola: solte para cair', -0.45, 1.55, -0.8);
    ctx.addUI(ball, { sound: false, drag: {
      start: () => { ballS.held = true; },
      move: (inp) => { ball.position.lerp(inp.ray.origin.clone().addScaledVector(inp.ray.direction, 0.75), 0.6); ballS.v.set(0, 0, 0); },
      end: (inp) => { ballS.held = false; ballS.v.copy(inp.handVel).clampLength(0, 3); ballS.maxH = ball.position.y; },
    } });

    // ---- mola com peso ----
    const anchor = new THREE.Vector3(0, 1.75, -0.9);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.06), std({ color: '#9aa3ad', metalness: 0.7, roughness: 0.3 })); hook.position.copy(anchor); root.add(hook);
    const springMat = std({ color: '#d5dae0', metalness: 1, roughness: 0.18 });
    let springMesh = null;
    // montada uma vez com 1 m e esticada pela escala (antes era refeita em todo frame)
    {
      const pts = [], turns = 14;
      for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 0.03, -t, Math.sin(a) * 0.03)); }
      springMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0035, 5), springMat);
      springMesh.position.copy(anchor); root.add(springMesh);
    }
    const buildSpring = (len) => { springMesh.scale.y = len; };
    const REST = 0.25, K = 60, MASS = 0.5;
    const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 24), std({ color: '#5a6270', metalness: 0.8, roughness: 0.35 }));
    root.add(weight);
    const spr = { y: anchor.y - REST - MASS * 9.8 / K, v: 0, held: false };
    const springLbl = label('Mola: puxe o peso', 0, 1.9, -0.9);
    ctx.addUI(weight, { sound: false, drag: {
      start: () => { spr.held = true; },
      move: (inp) => {
        // resistência aumenta conforme estica: o peso fica para trás da mão
        const target = inp.ray.origin.clone().addScaledVector(inp.ray.direction, 0.9).y;
        const stretch = anchor.y - spr.y - REST;
        const give = 1 / (1 + Math.max(0, stretch) * 6);
        spr.y += (THREE.MathUtils.clamp(target, anchor.y - 0.8, anchor.y - 0.12) - spr.y) * 0.25 * give; spr.v = 0;
      },
      end: () => { spr.held = false; },
    } });

    // ---- recipiente de vidro com água ----
    const glassG = new THREE.Group(); glassG.position.set(0.45, 1.05, -0.8); root.add(glassG);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 40, 1, true), phys({ color: '#dff0ff', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
    const rimG = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.003, 6, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8fc2ef' })); rimG.position.y = 0.13;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.012, 40), phys({ color: '#cfe6ff', transparent: true, opacity: 0.45, roughness: 0.05 })); base.position.y = -0.124;
    // água: cortada por um plano sempre horizontal (encontra o nível mais baixo)
    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const waterMat = phys({ color: '#bfe3ff', transparent: true, opacity: 0.55, roughness: 0.02, clippingPlanes: [clip], side: THREE.DoubleSide, depthWrite: false });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.25, 40), waterMat);
    const surf = new THREE.Mesh(new THREE.CircleGeometry(0.087, 40).rotateX(-Math.PI / 2), phys({ color: '#d6efff', transparent: true, opacity: 0.5, roughness: 0.02, clippingPlanes: [], depthWrite: false }));
    glassG.add(glass, rimG, base, water);
    root.add(surf);
    // superfície limitada ao interior do copo
    const surfClip = []; surf.material.clippingPlanes = surfClip;
    const gs = { tilt: 0, vt: 0, held: false, slosh: 0, vs: 0 };
    const glassLbl = label('Recipiente: incline', 0.45, 1.38, -0.8);
    ctx.addUI(glass, { sound: false, drag: {
      start: (inp) => { gs.held = true; gs.x0 = inp.handPos.x; gs.t0 = gs.tilt; },
      move: (inp) => { gs.tilt = THREE.MathUtils.clamp(gs.t0 - (inp.handPos.x - gs.x0) * 4, -1.0, 1.0); },
      end: () => { gs.held = false; },
    } });
    const g0 = shadowOf(0.09); g0.position.x = 0.45; g0.position.z = -0.8;

    let bounceSnd = 0;
    return {
      update(dt) {
        // bola: queda com aceleração natural, quica cada vez mais baixo, para
        if (!ballS.held) {
          ballS.v.y -= 9.8 * dt;
          ball.position.addScaledVector(ballS.v, dt);
          if (ball.position.y < FLOOR + R) {
            ball.position.y = FLOOR + R;
            if (Math.abs(ballS.v.y) > 0.3) { audio.thud(); bounceSnd++; }
            ballS.v.y = Math.abs(ballS.v.y) > 0.3 ? -ballS.v.y * 0.72 : 0;
            ballS.v.x *= 0.92; ballS.v.z *= 0.92;
          }
          const d = ball.position.clone().setY(0).sub(new THREE.Vector3(-0.45, 0, -0.8));
          if (d.length() > 0.6) { d.setLength(0.6); ball.position.x = -0.45 + d.x; ball.position.z = -0.8 + d.z; ballS.v.x *= -0.5; ballS.v.z *= -0.5; }
          if (ballS.v.lengthSq() > 0.05 && Math.random() < 0.6) { const p = new THREE.Mesh(trailGeo, trailMat); p.position.copy(ball.position); root.add(p); trail.push(p); if (trail.length > 70) trail.shift().removeFromParent(); }
        }
        ball.rotation.x += ballS.v.z * dt / R; ball.rotation.z -= ballS.v.x * dt / R;
        ballShadow.position.set(ball.position.x, FLOOR + 0.001, ball.position.z);
        ballShadow.material.opacity = 1 - Math.min(0.8, (ball.position.y - FLOOR) * 0.8);
        const h = ball.position.y - FLOOR - R;
        ballLbl.userData.set(`Bola · altura ${(h * 100).toFixed(0)} cm · v ${ballS.v.length().toFixed(2)} m/s`);

        // mola: lei de Hooke com amortecimento, volta sozinha devagar
        if (!spr.held) {
          const x = anchor.y - spr.y - REST;
          const a = (K * x - MASS * 9.8) / MASS - spr.v * 1.2;
          spr.v += a * dt; spr.y += spr.v * dt;
        }
        const len = anchor.y - spr.y;
        buildSpring(len);
        weight.position.set(anchor.x, spr.y - 0.03, anchor.z);
        if (spr.held) weight.position.x += Math.sin(performance.now() * 0.08) * 0.0015 * Math.max(0, len - REST) * 10;
        springLbl.userData.set(`Mola · força ${(K * Math.max(0, len - REST)).toFixed(1)} N`);

        // recipiente: a água acompanha suavemente e encontra o nível
        if (!gs.held) gs.tilt *= Math.exp(-0.8 * dt);
        glassG.rotation.z = gs.tilt;
        gs.vs += ((-gs.tilt * 0) - gs.slosh) * 18 * dt + (gs.lastTilt !== undefined ? (gs.tilt - gs.lastTilt) * 2.5 : 0);
        gs.vs *= Math.exp(-2.2 * dt); gs.slosh += gs.vs * dt; gs.lastTilt = gs.tilt;
        const level = glassG.position.y - 0.02 - Math.abs(Math.sin(gs.tilt)) * 0.03;
        const n = new THREE.Vector3(Math.sin(gs.slosh * 0.5), 1, 0).normalize();
        clip.normal.copy(n).negate(); clip.constant = n.dot(new THREE.Vector3(glassG.position.x, level, glassG.position.z));
        surf.position.set(glassG.position.x, level, glassG.position.z);
        surf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        surf.scale.set(1 / Math.max(0.4, Math.cos(gs.tilt)), 1, 1); // corte inclinado do cilindro é uma elipse
        // recorta a superfície pelas paredes do copo inclinado
        const axis = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), gs.tilt);
        const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), gs.tilt);
        const c = glassG.position;
        surfClip.length = 0;
        surfClip.push(new THREE.Plane(side.clone().negate(), side.dot(c) + 0.086), new THREE.Plane(side.clone(), -side.dot(c) + 0.086), new THREE.Plane(new THREE.Vector3(0, 0, -1), c.z + 0.086), new THREE.Plane(new THREE.Vector3(0, 0, 1), -c.z + 0.086));
        void axis;
        glassLbl.userData.set(`Recipiente · inclinação ${Math.round(gs.tilt * 57.3)}°`);
        ctx.hud('Laboratório de Física', 'Sem pressa, sem nota — só observar e entender');
      },
      dispose() { app.renderer.localClippingEnabled = false; },
    };
  },
};
