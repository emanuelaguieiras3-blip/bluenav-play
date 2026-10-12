// 🏰 CONSTRUTOR DE REINOS — Blocos com Personalidade
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { std, phys } from './common.js';

export default {
  id: 'kingdom',
  create(ctx) {
    ctx.lookDown();
    const { THREE, root, tex, audio, input, env } = ctx;
    ctx.teleport({ enabled: false, walk: true });
    const S = 0.25; // tamanho do bloco
    const geo = new RoundedBoxGeometry(S, S, S, 2, 0.025);
    const TYPES = {
      pedra: { label: 'Pedra', mat: std({ map: tex.get('blockStone'), roughness: 0.95 }) },
      madeira: { label: 'Madeira', mat: std({ map: tex.get('blockWood'), roughness: 0.8 }) },
      grama: { label: 'Grama', mat: [std({ map: tex.get('blockGrassSide') }), std({ map: tex.get('blockGrassSide') }), std({ map: tex.get('blockGrassTop') }), std({ color: '#7a4e30' }), std({ map: tex.get('blockGrassSide') }), std({ map: tex.get('blockGrassSide') })] },
      agua: { label: 'Água', mat: phys({ map: tex.get('blockWater'), transparent: true, opacity: 0.7, roughness: 0.1, depthWrite: false }) },
      nuvem: { label: 'Nuvem', mat: std({ map: tex.get('blockCloud'), transparent: true, opacity: 0.92, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 }) },
    };
    // mesa de construção: gramado redondo
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.12, 48), std({ map: tex.get('blockGrassTop', { repeat: [6, 6] }), roughness: 1 }));
    table.position.set(0, 0.69, -1.3); root.add(table);
    const TOP = 0.75;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), std({ color: '#6aa04a', roughness: 1 }));
    root.add(ground);

    const blocks = new Map(); // "x,y,z" -> mesh
    const key = (x, y, z) => `${x},${y},${z}`;
    const toWorld = (x, y, z) => new THREE.Vector3(x * S, TOP + S / 2 + y * S, -1.3 + z * S);
    const pops = [], falling = [];
    let current = 'pedra', mode = 'colocar';

    const place = (x, y, z, type, silent) => {
      if (blocks.has(key(x, y, z)) || y < 0 || y > 14 || Math.hypot(x * S, z * S) > 1.5) return;
      const m = new THREE.Mesh(geo, TYPES[type].mat);
      m.position.copy(toWorld(x, y, z)); m.userData.cell = [x, y, z]; m.userData.type = type;
      root.add(m); blocks.set(key(x, y, z), m);
      if (!silent) { pops.push({ m, t: 0 }); audio.tone({ freq: 520, to: 380, dur: 0.07, vol: 0.12 }); audio.noise({ dur: 0.03, freq: 2500, vol: 0.06 }); }
    };
    const breakBlock = (m) => {
      blocks.delete(key(...m.userData.cell));
      falling.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4), spin: new THREE.Vector3(Math.random() * 2, Math.random() * 2, Math.random() * 2), t: 0 });
      audio.noise({ dur: 0.15, freq: 600, vol: 0.15 });
    };
    // castelinho inicial
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) === 2 || Math.abs(z) === 2) { place(x, 0, z, 'pedra', true); if ((x + z) % 2 === 0) place(x, 1, z, 'pedra', true); }
    place(0, 0, 0, 'agua', true); place(3, 4, -1, 'nuvem', true); place(4, 4, -1, 'nuvem', true);

    // paleta e modo
    const pal = new THREE.Group(); pal.position.set(-0.85, 1.25, -0.75); pal.rotation.y = 0.6; root.add(pal);
    const buttons = {};
    Object.entries(TYPES).forEach(([id, t], i) => {
      const b = ctx.button({ w: 0.2, h: 0.08, label: t.label, variant: 'glass', fontSize: 0.38, onClick: () => { current = id; refresh(); } });
      b.position.set(0, 0.2 - i * 0.1, 0); pal.add(b); buttons[id] = b;
    });
    const modeBtn = ctx.button({ w: 0.2, h: 0.08, label: 'Colocar', icon: 'block', variant: 'accent', fontSize: 0.38, onClick: () => { mode = mode === 'colocar' ? 'quebrar' : 'colocar'; refresh(); } });
    modeBtn.position.set(0, -0.36, 0); pal.add(modeBtn);
    const refresh = () => {
      for (const [id, b] of Object.entries(buttons)) b.userData.setActive(id === current);
      modeBtn.userData.setLabel(mode === 'colocar' ? 'Colocar' : 'Quebrar'); modeBtn.userData.setIcon(mode === 'colocar' ? 'block' : 'pick');
    };
    refresh();

    // fantasma mostrando onde o bloco vai encaixar
    const ghosts = [0, 1].map(() => { const g = new THREE.Mesh(new THREE.BoxGeometry(S * 1.02, S * 1.02, S * 1.02), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false })); root.add(g); return g; });
    let twoHands = false;
    const rc = new THREE.Raycaster();
    let dayT = 0.1;
    const sky = [['#7fb8ef', '#d8ecff'], ['#e9a560', '#ffd9a0'], ['#4a3a7a', '#a58ad0'], ['#7fb8ef', '#d8ecff']];

    return {
      update(dt) {
        // céu muda suave: manhã azul -> entardecer dourado -> noite roxa
        dayT = (dayT + dt / 120) % 1;
        const f = dayT * 3, i = Math.floor(f), k = f - i;
        const top = new THREE.Color(sky[i][0]).lerp(new THREE.Color(sky[i + 1][0]), k), hor = new THREE.Color(sky[i][1]).lerp(new THREE.Color(sky[i + 1][1]), k);
        env.uniforms.top.value.copy(top); env.uniforms.horizon.value.copy(hor); ctx.scene.background = hor;
        env.hemi.color.copy(hor); env.hemi.intensity = 2.0;

        // cada mão constrói com o próprio raio. Com DUAS mãos: direita coloca, esquerda quebra.
        const ps = ctx.pointers().slice(0, 2);
        const two = ps.length === 2 && ps.every((q) => q.source === 'hand' || q.source === 'xr');
        ghosts.forEach((g) => { g.visible = false; });
        let mainHit = null;
        ps.forEach((pp, gi) => {
          const pMode = two ? (pp.side === 'left' ? 'quebrar' : 'colocar') : mode;
          const ghost = ghosts[gi];
          rc.ray.copy(pp.ray);
          const h = rc.intersectObjects([table, ...blocks.values()], false)[0];
          if (!h || pp.uiBusy) return;
          let cell;
          if (h.object === table) {
            const p = h.point; cell = [Math.round(p.x / S), 0, Math.round((p.z + 1.3) / S)];
            if (pMode === 'quebrar') cell = null;
          } else {
            // Rounded edges have diagonal normals; snap to the dominant face only.
            const c = h.object.userData.cell, n = h.face.normal, axis = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
            const k = axis.indexOf(Math.max(...axis)), step = [0, 0, 0]; step[k] = Math.sign([n.x, n.y, n.z][k]);
            cell = pMode === 'colocar' ? [c[0] + step[0], c[1] + step[1], c[2] + step[2]] : c;
          }
          if (!cell) return;
          ghost.visible = true; ghost.position.copy(toWorld(...cell));
          ghost.material.color.set(pMode === 'colocar' ? '#ffffff' : '#ff6a4a');
          if (pp.main) mainHit = h.point;
          if (pp.pinchDown) {
            if (pMode === 'colocar') place(...cell, current);
            else if (h.object !== table) breakBlock(h.object);
          }
        });
        ctx.setPointerHit(mainHit);
        twoHands = two;
        // encaixe com um "clique" suave (escala)
        for (let j = pops.length - 1; j >= 0; j--) { const p = pops[j]; p.t += dt; p.m.scale.setScalar(1 + Math.sin(Math.min(1, p.t / 0.2) * Math.PI) * 0.12); if (p.t > 0.2) { p.m.scale.setScalar(1); pops.splice(j, 1); } }
        // blocos quebrados caem girando devagar, flutuam e somem
        for (let j = falling.length - 1; j >= 0; j--) {
          const fb = falling[j]; fb.t += dt;
          fb.v.y -= dt * 0.6; fb.m.position.addScaledVector(fb.v, dt);
          fb.m.rotation.x += fb.spin.x * dt; fb.m.rotation.y += fb.spin.y * dt;
          fb.m.scale.setScalar(Math.max(0.01, 1 - fb.t / 2));
          if (fb.t > 2) { fb.m.removeFromParent(); falling.splice(j, 1); }
        }
        ctx.hud(`Blocos: ${blocks.size} · ${TYPES[current].label}`, twoHands ? 'Mão direita coloca · mão esquerda quebra' : mode === 'colocar' ? 'Pinça/toque para colocar' : 'Pinça/toque num bloco para quebrar');
      },
    };
  },
};
