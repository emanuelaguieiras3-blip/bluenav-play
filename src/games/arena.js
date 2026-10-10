// ⚔️ ARENA DE BATALHA — Ferro e Pedra
import { Particles, glowTexture, std, hands2 } from './common.js';

export default {
  id: 'arena',
  create(ctx) {
    const { THREE, root, tex, audio, input, env, rig } = ctx;
    env.set({ sky: false, top: '#000', horizon: '#141210', bottom: '#000', hemi: ['#d8cbb0', '#2a2620', 0.6], sun: ['#fff1d6', 0.0] });
    audio.setEcho(0.35);
    ctx.teleport({ enabled: true, walk: true, check: (p) => Math.hypot(p.x, p.z) < 6.5 });

    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 48).rotateX(-Math.PI / 2), std({ map: tex.get('stoneTiles'), roughness: 0.95 }));
    root.add(floor);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 7, 48, 1, true).translate(0, 3.5, 0), std({ map: tex.get('roughStone'), side: THREE.BackSide, roughness: 1 }));
    root.add(wall);
    const ceil = new THREE.Mesh(new THREE.RingGeometry(2.2, 8.2, 48).rotateX(Math.PI / 2), std({ map: tex.get('roughStone'), side: THREE.DoubleSide }));
    ceil.position.y = 7; root.add(ceil);
    // abertura no teto: luz de cima em círculo suave
    const spot = new THREE.SpotLight('#fff3dc', 90, 20, 0.42, 0.7, 1.6);
    spot.position.set(0, 7.5, 0); spot.target.position.set(0, 0, 0);
    root.add(spot, spot.target);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 3.2, 7, 32, 1, true).translate(0, 3.5, 0), new THREE.MeshBasicMaterial({ color: '#fff2d0', transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    root.add(shaft);

    // ---- espada do jogador ----
    const steel = std({ map: tex.get('steel'), metalness: 0.9, roughness: 0.28 });
    const sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.82, 0.008).translate(0, 0.52, 0), steel);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04).translate(0, 0.1, 0), steel);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.17, 10).translate(0, 0, 0), std({ map: tex.get('leather'), color: '#6b4426' }));
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8).translate(0, -0.1, 0), steel);
    sword.add(blade, guard, grip, pommel); root.add(sword);
    // escudo
    const shield = new THREE.Group();
    const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.035, 32).rotateX(Math.PI / 2), std({ map: tex.get('woodMedium') }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 8, 40), steel);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.02).translate(0, 0, -0.03), std({ color: '#b08a50', roughness: 0.9 }));
    shield.add(wood, rim, strap); root.add(shield);

    // ---- oponente ----
    const foe = new THREE.Group();
    const leatherArm = std({ map: tex.get('leather'), color: '#8a5a32' });
    const cloth = std({ map: tex.get('fabric'), color: '#7a2a24' });
    const skin = std({ color: '#c79a76', roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 12).translate(0, 1.25, 0), leatherArm);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.35, 12).translate(0, 0.82, 0), cloth);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12).translate(0, 1.78, 0), skin);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.8, 0), steel);
    const legs = [-0.1, 0.1].map((x) => new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.6, 4, 8).translate(x, 0.38, 0), cloth));
    const foeArm = new THREE.Group(); foeArm.position.set(0.28, 1.45, 0);
    const foeSword = blade.clone(); foeSword.position.set(0, -0.05, 0.25); foeSword.rotation.x = Math.PI / 2;
    const foeArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 4, 8).rotateX(Math.PI / 2).translate(0, 0, 0.2), skin);
    foeArm.add(foeArmMesh, foeSword);
    const foeShield = shield.clone(); foeShield.position.set(-0.3, 1.25, 0.2);
    foe.add(torso, skirt, head, helm, ...legs, foeArm, foeShield);
    foe.position.set(0, 0, -2.6); root.add(foe);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ff6a3a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const telegraph = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), glowMat); foeArm.add(telegraph); telegraph.position.z = 0.6;

    const sparks = new Particles(root, { max: 200, size: 0.03, texture: glowTexture('rgba(255,200,90,1)'), blending: THREE.AdditiveBlending });
    const sand = new Particles(root, { max: 160, size: 0.18, texture: glowTexture('rgba(222,200,150,0.8)') });
    const vignette = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: '#a00', transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false }));
    vignette.renderOrder = 990; ctx.camera.add(vignette);
    ctx.onDispose(() => { vignette.removeFromParent(); vignette.geometry.dispose(); vignette.material.dispose(); });

    let hpYou = 10, hpFoe = 10, phase = 'idle', phaseT = 2, tremble = 0, hitCd = 0, guardSide = 1, stepT = 0, wins = 0;
    const tip = new THREE.Vector3(), prevTip = new THREE.Vector3(), tmp = new THREE.Vector3();
    const foeBox = new THREE.Box3(), shieldBox = new THREE.Box3();

    const impact = (p, big) => {
      for (let k = 0; k < (big ? 26 : 12); k++) sparks.spawn(p, new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3), { life: 0.35, color: [1, 0.75, 0.35, 1], gravity: 6 });
      const g = p.clone(); g.y = 0.05;
      for (let k = 0; k < 8; k++) sand.spawn(g, new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 1.2), { life: 1.2, color: [0.87, 0.78, 0.6, 0.45], drag: 2 });
    };

    return {
      update(dt, t) {
        const eye = ctx.eye(), fwd = ctx.forward();
        // espada na mão direita (dominante), escudo na esquerda. Com uma mão só: espada nela, escudo flutua.
        const { main: swordP, off: shieldP } = hands2(ctx);
        let swordPos, swordDir;
        if (swordP && swordP.source === 'hand' && swordP.hand) { swordPos = swordP.hand.palm.clone().lerp(swordP.hand.points[9], 0.5); swordDir = swordP.hand.dir.clone(); }
        else if (swordP && swordP.source === 'xr') { swordPos = swordP.handPos.clone(); swordDir = swordP.ray.direction.clone(); }
        else { const rd = (swordP || input).ray.direction; swordPos = eye.clone().addScaledVector(rd, 0.55).add(new THREE.Vector3(0, -0.15, 0)); swordDir = rd.clone(); }
        const shieldPos = shieldP && shieldP.hand ? shieldP.hand.palm.clone() : shieldP ? shieldP.handPos.clone() : eye.clone().addScaledVector(fwd, 0.6).add(tmp.set(-fwd.z, 0, fwd.x).multiplyScalar(-0.42)).add(new THREE.Vector3(0, -0.4, 0));
        const swinging_input = swordP ? swordP.pinchDown && !swordP.uiBusy : input.pinchDown;
        sword.position.copy(swordPos);
        sword.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), swordDir.normalize());
        if (tremble > 0) { tremble -= dt; sword.position.x += Math.sin(t * 90) * 0.006 * tremble * 4; sword.position.y += Math.cos(t * 77) * 0.006 * tremble * 4; }
        shield.position.copy(shieldPos); shield.lookAt(eye.x, shieldPos.y, eye.z);

        prevTip.copy(tip);
        tip.set(0, 0.85, 0).applyMatrix4(sword.matrixWorld);
        sword.updateMatrixWorld();
        const tipSpeed = tip.distanceTo(prevTip) / Math.max(dt, 1e-3);

        // oponente encara o jogador e se aproxima
        const toYou = tmp.copy(eye).sub(foe.position).setY(0);
        const dist = toYou.length();
        foe.rotation.y = Math.atan2(toYou.x, toYou.z);
        if (dist > 1.7 && phase !== 'strike') { foe.position.addScaledVector(toYou.normalize(), dt * 0.7); if ((stepT -= dt) < 0) { stepT = 0.5; audio.noise({ dur: 0.07, freq: 300, vol: 0.12, echo: true }); } }
        foeShield.position.y = 1.25 + guardSide * 0.15;

        // ataque do oponente: aviso brilhante -> golpe
        phaseT -= dt;
        if (phase === 'idle' && phaseT < 0 && dist < 2.4) { phase = 'wind'; phaseT = 0.9; guardSide = Math.random() < 0.5 ? 1 : -1; }
        if (phase === 'wind') { foeArm.rotation.x = -1.2 * (1 - phaseT / 0.9); glowMat.opacity = 0.8 * (1 - phaseT / 0.9); if (phaseT < 0) { phase = 'strike'; phaseT = 0.25; } }
        if (phase === 'strike') {
          foeArm.rotation.x = -1.2 + 2.2 * (1 - phaseT / 0.25); glowMat.opacity = 0.3;
          if (phaseT < 0) {
            const strikeP = foe.position.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(tmp.copy(eye).sub(foe.position).setY(0).normalize(), 0.9);
            const blocked = shield.position.distanceTo(strikeP) < 0.45 || sword.position.distanceTo(strikeP) < 0.4;
            if (blocked) { audio.metal(); impact(strikeP, true); tremble = 0.35; }
            else { hpYou--; audio.thud(); vignette.material.opacity = 0.45; }
            phase = 'idle'; phaseT = 1.6 + Math.random() * 1.4; glowMat.opacity = 0; foeArm.rotation.x = 0;
          }
        }
        vignette.material.opacity = Math.max(0, vignette.material.opacity - dt * 0.8);

        // golpes do jogador
        hitCd -= dt;
        foe.updateMatrixWorld(true);
        shieldBox.setFromObject(foeShield).expandByScalar(0.05);
        foeBox.setFromObject(torso).union(new THREE.Box3().setFromObject(head));
        const swinging = tipSpeed > 1.6 || swinging_input;
        if (hitCd < 0 && swinging) {
          if (shieldBox.containsPoint(tip) || shieldBox.containsPoint(sword.position.clone().lerp(tip, 0.6))) {
            audio.metal(); impact(tip, true); tremble = 0.4; hitCd = 0.35;
          } else if (foeBox.containsPoint(tip) || foeBox.containsPoint(sword.position.clone().lerp(tip, 0.6)) || (swinging_input && input.source !== 'hand' && dist < 2.0)) {
            hpFoe--; hitCd = 0.45; audio.noise({ dur: 0.12, freq: 700, vol: 0.3, echo: true }); audio.thud(); impact(tip, false);
            foe.position.addScaledVector(tmp.copy(foe.position).sub(eye).setY(0).normalize(), 0.35);
          }
        }
        if (hpFoe <= 0) { wins++; audio.success(); hpFoe = 10; hpYou = Math.min(10, hpYou + 3); foe.position.set(Math.sin(t) * 3, 0, -Math.cos(t) * 3 - 1); }
        if (hpYou <= 0) { hpYou = 10; hpFoe = 10; rig.position.set(0, 0, 0); foe.position.set(0, 0, -3); }
        sparks.update(dt); sand.update(dt);
        const bar = (n) => '█'.repeat(Math.max(0, n)) + '░'.repeat(Math.max(0, 10 - n));
        ctx.hud(`Você ${bar(hpYou)}  Oponente ${bar(hpFoe)}`, `Vitórias ${wins} · bloqueie quando a espada dele brilhar`);
      },
    };
  },
};
