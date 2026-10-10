// 🍳 COZINHEIRO MESTRE — Fogo e Tato
import { Particles, glowTexture, std, hands2 } from './common.js';

export default {
  id: 'cook',
  create(ctx) {
    ctx.lookDown();
    const { THREE, root, tex, audio, input, env } = ctx;
    env.set({ sky: false, top: '#000', horizon: '#2a1e16', bottom: '#000', hemi: ['#ffe2b8', '#3a2a1e', 0.7], sun: ['#ffd9a0', 0.9], sunPos: [-3, 4, -6] });
    const H = 0.92; // altura da bancada

    // cozinha: paredes quentes e janela distante
    const room = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 8).translate(0, 1.6, -1), std({ color: '#6a4a36', side: THREE.BackSide, roughness: 1 }));
    root.add(room);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
    win.position.set(-1.5, 1.7, -4.98); root.add(win);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.75), std({ map: tex.get('marble'), roughness: 0.25 }));
    counter.position.set(0, H, -0.62); root.add(counter);
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.4, H - 0.03, 0.72), std({ map: tex.get('woodMedium'), roughness: 0.8 }));
    cabinet.position.set(0, (H - 0.03) / 2, -0.62); root.add(cabinet);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.3), std({ map: tex.get('woodLight') }));
    board.position.set(-0.25, H + 0.045, -0.55); root.add(board);

    // fogão + panela de metal escovado
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24), std({ color: '#1a1a1a', metalness: 0.6, roughness: 0.4 }));
    burner.position.set(0.45, H + 0.04, -0.6); root.add(burner);
    const potMat = std({ map: tex.get('brushedMetal'), metalness: 0.85, roughness: 0.32 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.18, 32, 1, true), potMat);
    pot.material.side = THREE.DoubleSide;
    pot.position.set(0.45, H + 0.16, -0.6); root.add(pot);
    const potBottom = new THREE.Mesh(new THREE.CircleGeometry(0.14, 32).rotateX(-Math.PI / 2), potMat); potBottom.position.set(0.45, H + 0.075, -0.6); root.add(potBottom);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.03), std({ color: '#111', roughness: 0.5 })); h.position.set(0.45 + s * 0.2, H + 0.22, -0.6); root.add(h); }
    const soupMat = std({ color: '#c9a77a', roughness: 0.3 });
    const soup = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32).rotateX(-Math.PI / 2), soupMat); soup.position.set(0.45, H + 0.2, -0.6); root.add(soup);

    // fogo: laranja-amarelo na base, azul suave no centro
    const flames = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const outer = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,150,40,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const inner = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(90,140,255,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const p = new THREE.Vector3(0.45 + Math.cos(a) * 0.1, H + 0.065, -0.6 + Math.sin(a) * 0.1);
      outer.position.copy(p); inner.position.copy(p).setY(H + 0.055);
      root.add(outer, inner); flames.push({ outer, inner, ph: Math.random() * 6 });
    }
    const fireLight = new THREE.PointLight('#ff9a4a', 2.5, 3, 1.6); fireLight.position.set(0.45, H + 0.15, -0.5); root.add(fireLight);
    const steam = new Particles(root, { max: 160, size: 0.12, texture: glowTexture('rgba(230,230,230,0.5)') });

    // legumes com texturas próprias
    const veg = [];
    const mkVeg = (name, geo, mat, x) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, H + 0.075, -0.35); root.add(m); const v = { name, m, cuts: 0, state: 'inteiro', pieces: [] }; veg.push(v); return v; };
    mkVeg('tomate', new THREE.SphereGeometry(0.045, 20, 14).scale(1, 0.85, 1), std({ color: '#d42a1e', roughness: 0.18 }), -0.75);
    mkVeg('cebola', new THREE.SphereGeometry(0.045, 20, 14).scale(1, 1.1, 1), std({ map: tex.get('onionSkin'), roughness: 0.75 }), -0.6);
    mkVeg('cenoura', new THREE.ConeGeometry(0.022, 0.18, 14).rotateZ(Math.PI / 2), std({ map: tex.get('carrot'), roughness: 0.6 }), -0.45);

    // faca e colher
    const knife = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.035, 0.17).translate(0, 0, -0.1), std({ map: tex.get('steel'), metalness: 0.9, roughness: 0.25 }));
    const kh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.1).translate(0, 0, 0.03), std({ color: '#222' }));
    knife.add(blade, kh); root.add(knife);
    const spoon = new THREE.Group();
    spoon.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8).translate(0, 0.15, 0), std({ map: tex.get('woodLight') })));
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), std({ map: tex.get('woodLight') })); spoon.add(bowl);
    spoon.position.set(0.72, H + 0.05, -0.45); spoon.rotation.z = Math.PI / 2; root.add(spoon);

    const holds = new Map(); // mão -> pedaço que ela carrega
    let step = 'cortar', stir = 0, stirAng = null, chopT = 0, bubbleT = 0;
    const tip = new THREE.Vector3(), prevTip = new THREE.Vector3();
    const boil = audio.noiseLoop({ freq: 900, q: 1.5, vol: 0.015 });
    void boil;

    const potCenter = new THREE.Vector3(0.45, H + 0.2, -0.6);
    return {
      update(dt, t) {
        const eye = ctx.eye();
        // posição da "mão" de cada ponteiro; mouse/olhar deslizam sobre a bancada
        const hpOf = (ip) => ip.source === 'hand' || ip.source === 'xr' ? ip.handPos.clone() : (() => {
          const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(H + 0.12)); const p = new THREE.Vector3();
          return ip.ray.intersectPlane(pl, p) ? p.add(new THREE.Vector3(0, ip.pinch ? -0.08 : 0, 0)) : eye.clone().addScaledVector(ip.ray.direction, 0.6);
        })();
        // DUAS mãos: faca na direita, colher na esquerda, e as duas carregam pedaços. UMA mão faz tudo.
        const ptrs = ctx.pointers();
        const { main: kp, off: op } = hands2(ctx);
        const hp = hpOf(kp || input);
        // fogo tremido vivo
        flames.forEach((f, i) => { const k = 0.8 + Math.sin(t * 14 + f.ph) * 0.15 + Math.random() * 0.08; f.outer.scale.set(0.05 * k, 0.09 * k, 1); f.inner.scale.set(0.025, 0.035 * k, 1); void i; });
        fireLight.intensity = 2.3 + Math.sin(t * 17) * 0.3 + Math.random() * 0.2;
        // vapor em espiral que some longe do calor
        if (Math.random() < dt * 12) { const a = t * 2 + Math.random(); steam.spawn(potCenter.clone().add(new THREE.Vector3(Math.cos(a) * 0.06, 0.02, Math.sin(a) * 0.06)), new THREE.Vector3(Math.cos(a + 1.5) * 0.04, 0.18, Math.sin(a + 1.5) * 0.04), { life: 2.2, color: [1, 1, 1, 0.28], drag: 0.4 }); }
        steam.update(dt);
        if ((bubbleT -= dt) < 0) { bubbleT = 0.15 + Math.random() * 0.4; audio.noise({ dur: 0.03, freq: 400 + Math.random() * 500, q: 4, vol: 0.05 }); }

        prevTip.copy(tip);
        if (step === 'cortar') {
          // faca segue a mão; descer através do legume = corte (resistência que cede)
          knife.position.copy(hp); knife.rotation.set(0, 0, 0);
          tip.copy(knife.position);
          const onBoard = veg.find((v) => v.state === 'tabua');
          if (!onBoard) {
            const next = veg.find((v) => v.state === 'inteiro');
            if (next && (input.pinchDown || next.m.position.distanceTo(hp) < 0.08)) { next.state = 'tabua'; next.m.position.set(-0.25, H + 0.1, -0.55); audio.noise({ dur: 0.05, freq: 800, vol: 0.08 }); }
            if (!next) step = 'panela';
          } else {
            const v = onBoard;
            const near = Math.abs(hp.x - v.m.position.x) < 0.1 && Math.abs(hp.z - v.m.position.z) < 0.1;
            const goingDown = prevTip.y - tip.y > 0.004;
            if (near && tip.y < v.m.position.y + 0.04) knife.position.y = Math.max(knife.position.y, v.m.position.y - 0.03 + (1 - Math.min(1, chopT * 6)) * 0.03);
            if (near && goingDown && tip.y < v.m.position.y) chopT += dt; else if (!near || tip.y > v.m.position.y + 0.05) chopT = 0;
            if (chopT > 0.08 || (input.pinchDown && input.source !== 'hand' && near)) {
              chopT = 0; v.cuts++;
              audio.noise({ dur: 0.05, freq: 1800, vol: 0.2 }); audio.tone({ freq: 160, to: 90, dur: 0.06, vol: 0.15 });
              const piece = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.025), v.m.material);
              piece.position.copy(v.m.position).add(new THREE.Vector3(0.05 + v.cuts * 0.03, -0.02, (Math.random() - 0.5) * 0.06));
              root.add(piece); v.pieces.push(piece);
              v.m.scale.multiplyScalar(0.82);
              if (v.cuts >= 3) { v.state = 'cortado'; v.m.visible = false; }
            }
          }
        } else if (step === 'panela') {
          knife.position.set(-0.85, H + 0.04, -0.6); knife.rotation.set(0, 0.5, Math.PI / 2);
          // pinça nos pedaços e leve para a panela (ou toque para despejar tudo)
          const pieces = veg.flatMap((v) => v.pieces).filter((p) => !p.userData.inPot);
          for (const ip of ptrs) {
            const h = hpOf(ip);
            let held = holds.get(ip.id);
            const taken = new Set(holds.values());
            if (ip.pinch && !held) { held = pieces.find((p) => !taken.has(p) && p.position.distanceTo(h) < 0.12) || null; if (held) holds.set(ip.id, held); }
            if (!ip.pinch && held) { if (held.position.distanceTo(potCenter) < 0.18) { held.userData.inPot = true; held.position.copy(potCenter).add(new THREE.Vector3((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15)); audio.noise({ dur: 0.1, freq: 600, vol: 0.15 }); } holds.delete(ip.id); held = null; }
            if (held) held.position.lerp(h, Math.min(1, dt * 15));
          }
          if (input.pinchDown && input.source !== 'hand' && !holds.size) for (const p of pieces) { p.userData.inPot = true; p.position.copy(potCenter).add(new THREE.Vector3((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15)); }
          if (pieces.length === 0) { step = 'mexer'; soupMat.color.set('#c0703a'); }
        } else if (step === 'mexer') {
          // colher arrasta devagar: resistência viscosa
          const target = hpOf(op || kp || input); target.y = Math.max(H + 0.12, target.y);
          spoon.rotation.set(0.25, 0, 0);
          spoon.position.lerp(target, Math.min(1, dt * 3.5));
          const rel = spoon.position.clone().sub(potCenter); rel.y = 0;
          if (rel.length() < 0.16 && rel.length() > 0.02) {
            const ang = Math.atan2(rel.z, rel.x);
            if (stirAng !== null) { const d = Math.atan2(Math.sin(ang - stirAng), Math.cos(ang - stirAng)); stir += Math.abs(d); if (Math.abs(d) > 0.02) audio.noise({ dur: 0.04, freq: 500, vol: 0.02 }); }
            stirAng = ang;
          } else stirAng = null;
          if (input.source !== 'hand' && input.pinch) stir += dt * 2;
          soupMat.color.lerpColors(new THREE.Color('#c0703a'), new THREE.Color('#d9542a'), Math.min(1, stir / 25));
          for (const v of veg) for (const p of v.pieces) { const a = Math.atan2(p.position.z - potCenter.z, p.position.x - potCenter.x) + dt * 0.6; const r = Math.hypot(p.position.z - potCenter.z, p.position.x - potCenter.x); p.position.x = potCenter.x + Math.cos(a) * r; p.position.z = potCenter.z + Math.sin(a) * r; }
          if (stir > 25) { step = 'pronto'; audio.success(); }
        }
        const msg = { cortar: 'Desça a faca sobre o legume na tábua (3 cortes cada)', panela: 'Pinça nos pedaços e solte sobre a panela', mexer: 'Mexa em círculos dentro da panela', pronto: 'Sopa pronta! Que cheiro bom' }[step];
        ctx.hud(`Sopa de legumes · ${step}`, msg);
      },
    };
  },
};
