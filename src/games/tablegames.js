// 🃏 SALA DE JOGOS — Madeira e Tempo Parado
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { std, phys } from './common.js';

const SUITS = [['♠', '#111'], ['♥', '#c0262d'], ['♦', '#c0262d'], ['♣', '#111']];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function cardFace(THREE, r, s) {
  const c = document.createElement('canvas'); c.width = 180; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#f4ecdc'; x.fillRect(0, 0, 180, 256);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(120,100,70,${Math.random() * 0.05})`; x.fillRect(Math.random() * 180, Math.random() * 256, 1, 1); }
  const [sym, col] = SUITS[s];
  x.fillStyle = col; x.font = 'bold 40px Georgia, serif'; x.textAlign = 'left'; x.textBaseline = 'top';
  x.fillText(RANKS[r], 12, 10); x.font = '34px Georgia'; x.fillText(sym, 14, 52);
  x.font = '110px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sym, 90, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function diceFace(THREE, n) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#f7f7f4'; x.fillRect(0, 0, 128, 128);
  const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] };
  for (const [px, py] of P[n]) { const g = x.createRadialGradient(px - 3, py - 3, 2, px, py, 13); g.addColorStop(0, '#000'); g.addColorStop(1, '#2a2a2a'); x.fillStyle = g; x.beginPath(); x.arc(px, py, 12, 0, 6.28); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default {
  id: 'tablegames',
  create(ctx) {
    ctx.lookDown();
    const { THREE, root, tex, audio, input, env } = ctx;
    env.set({ sky: false, top: '#000', horizon: '#0d0907', bottom: '#000', hemi: ['#ffe8c8', '#100a06', 0.25], sun: ['#fff', 0] });
    const H = 0.78;
    // mesa polida: quase se reflete
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.05, 64), phys({ map: tex.get('tableWood'), roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 }));
    table.position.set(0, H, -0.75); root.add(table);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 12, 64).rotateX(Math.PI / 2), std({ map: tex.get('tableWood'), roughness: 0.4 }));
    rim.position.set(0, H + 0.005, -0.75); root.add(rim);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, H, 16).translate(0, H / 2, 0), std({ map: tex.get('tableWood') })); leg.position.set(0, 0, -0.75); root.add(leg);
    // lâmpada acima
    const lamp = new THREE.SpotLight('#ffe2b0', 22, 6, 0.75, 0.6, 1.4); lamp.position.set(0, 2.4, -0.75); lamp.target.position.set(0, H, -0.75); root.add(lamp, lamp.target);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 32, 1, true), std({ color: '#3a2a1a', side: THREE.DoubleSide })); shade.position.set(0, 2.45, -0.75); root.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3d0' })); bulb.position.set(0, 2.36, -0.75); root.add(bulb);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 32).rotateX(-Math.PI / 2), std({ color: '#2a1e16' })); root.add(floor);

    // ---- dados ----
    const dmats = [diceFace(THREE, 3), diceFace(THREE, 4), diceFace(THREE, 1), diceFace(THREE, 6), diceFace(THREE, 2), diceFace(THREE, 5)].map((m) => std({ map: m, roughness: 0.35 }));
    // ordem BoxGeometry: +x,-x,+y,-y,+z,-z
    const FACE_VAL = [3, 4, 1, 6, 2, 5];
    const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((v) => new THREE.Vector3(...v));
    const D = 0.045;
    const dGeo = new RoundedBoxGeometry(D, D, D, 3, 0.007);
    const dice = [-0.08, 0.08].map((x) => {
      const m = new THREE.Mesh(dGeo, dmats); m.position.set(0.35 + x, H + 0.025 + D / 2, -0.55); root.add(m);
      return { m, v: new THREE.Vector3(), w: new THREE.Vector3(), rolling: false, settle: 0 };
    });
    let diceResult = '', rollCount = 0;
    const rollDice = (strength = 1) => {
      dice.forEach((d, i) => {
        d.m.position.set(0.3 + i * 0.07, H + 0.25, -0.45);
        d.v.set(-0.4 - Math.random() * 0.3, 0.6, -0.5 - Math.random() * 0.3).multiplyScalar(strength);
        d.w.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
        d.rolling = true; d.settle = 0;
      });
      diceResult = ''; rollCount++;
    };
    const topValue = (m) => { let best = -2, val = 1; NORMALS.forEach((n, i) => { const y = n.clone().applyQuaternion(m.quaternion).y; if (y > best) { best = y; val = FACE_VAL[i]; } }); return val; };

    // ---- cartas ----
    const backMat = std({ map: tex.get('cardBack'), roughness: 0.7 });
    const CW = 0.063, CH = 0.088;
    const cardGeo = new THREE.BoxGeometry(CW, 0.0012, CH);
    const deck = [];
    for (let i = 0; i < 52; i++) deck.push(i);
    const deckGroup = new THREE.Group(); deckGroup.position.set(-0.3, H + 0.026, -0.6); root.add(deckGroup);
    const deckMeshes = Array.from({ length: 12 }, (_, i) => { const c = new THREE.Mesh(cardGeo, backMat); c.position.y = i * 0.0012; deckGroup.add(c); return c; });
    const dealt = [];
    let shuffleT = 0, you = null, house = null, wins = 0, losses = 0, msg = 'Toque em "Virar" para jogar Maior Carta';
    const shuffle = () => {
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      shuffleT = 0.9;
      // papel contra papel
      for (let k = 0; k < 10; k++) audio.noise({ dur: 0.05, freq: 3000 + Math.random() * 2000, q: 0.6, vol: 0.05, delay: k * 0.07 });
      for (const d of dealt) { d.removeFromParent(); d.material.forEach((m) => { m.map?.dispose(); m.dispose(); }); }
      dealt.length = 0; you = house = null; msg = 'Baralho embaralhado';
    };
    const deal = (pos, flipDelay) => {
      if (!deck.length) shuffle();
      const id = deck.pop(), r = id % 13, s = Math.floor(id / 13);
      const face = std({ map: cardFace(THREE, r, s), roughness: 0.75 });
      const edge = std({ color: '#efe6d4' });
      const c = new THREE.Mesh(cardGeo, [edge, edge, face, backMat.clone(), edge, edge]);
      c.position.copy(deckGroup.position).setY(H + 0.04); c.rotation.x = Math.PI; // virada para baixo
      root.add(c); dealt.push(c);
      c.userData = { to: pos.clone(), t: -flipDelay, r };
      audio.noise({ dur: 0.08, freq: 2600, q: 0.7, vol: 0.06 });
      return { r, s, c };
    };
    const play = () => {
      if (dealt.length > 8) shuffle();
      you = deal(new THREE.Vector3(-0.08 + dealt.length * 0.004, H + 0.027, -0.42), 0);
      house = deal(new THREE.Vector3(0.0 + dealt.length * 0.004, H + 0.027, -0.95), 0.4);
      const rv = (x) => (x.r === 0 ? 13 : x.r);
      setTimeout(() => {
        if (rv(you) > rv(house)) { wins++; msg = 'Você venceu!'; audio.success(); }
        else if (rv(you) < rv(house)) { losses++; msg = 'A casa venceu desta vez'; }
        else msg = 'Empate';
      }, 1100);
    };

    // botões físicos sobre a mesa
    const b1 = ctx.button({ w: 0.17, h: 0.07, label: 'Virar', icon: 'card', variant: 'light', fontSize: 0.34, onClick: play });
    const b2 = ctx.button({ w: 0.17, h: 0.07, label: 'Embaralhar', icon: 'shuffle', variant: 'glass', fontSize: 0.3, onClick: shuffle });
    const b3 = ctx.button({ w: 0.17, h: 0.07, label: 'Rolar', icon: 'dice', variant: 'glass', fontSize: 0.34, onClick: () => rollDice(1) });
    [b1, b2, b3].forEach((b, i) => { b.position.set(-0.2 + i * 0.2, H + 0.18, -0.3); b.rotation.x = -0.7; root.add(b); });
    // pegar e arremessar os dados com a mão
    dice.forEach((d) => ctx.addUI(d.m, {
      sound: false,
      drag: {
        start: () => { d.held = true; d.rolling = false; },
        move: (inp) => { d.m.position.lerp(inp.handPos.clone().setY(Math.max(H + 0.05, inp.handPos.y)), 0.5); d.m.rotation.x += 0.1; },
        end: (inp) => { d.held = false; d.rolling = true; d.settle = 0; d.v.copy(inp.handVel).clampLength(0, 2.5); d.w.set(Math.random() * 20 - 10, 8, Math.random() * 20 - 10); diceResult = ''; rollCount++; },
      },
    }));

    const center = new THREE.Vector3(0, 0, -0.75);
    return {
      update(dt) {
        // física simples dos dados: quicam na madeira e param
        let allStill = true;
        for (const d of dice) {
          if (d.held) { allStill = false; continue; }
          if (!d.rolling) continue;
          allStill = false;
          d.v.y -= 9.8 * dt;
          d.m.position.addScaledVector(d.v, dt);
          d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
          const floorY = H + 0.025 + D / 2;
          if (d.m.position.y < floorY) {
            d.m.position.y = floorY;
            if (Math.abs(d.v.y) > 0.25) { audio.tone({ freq: 700 + Math.random() * 300, to: 400, dur: 0.04, vol: Math.min(0.15, Math.abs(d.v.y) * 0.1) }); audio.noise({ dur: 0.03, freq: 1500, vol: 0.05 }); }
            d.v.y = -d.v.y * 0.35; d.v.x *= 0.8; d.v.z *= 0.8; d.w.multiplyScalar(0.7);
          }
          // fica na mesa
          const rel = d.m.position.clone().sub(center).setY(0);
          if (rel.length() > 0.85) { rel.setLength(0.85); d.m.position.x = center.x + rel.x; d.m.position.z = center.z + rel.z; d.v.x *= -0.5; d.v.z *= -0.5; }
          if (d.m.position.y <= floorY + 0.001 && d.v.length() < 0.15) {
            d.settle += dt;
            // encaixa na face de cima
            const up = new THREE.Vector3(0, 1, 0); let bestN = NORMALS[0], best = -2;
            for (const n of NORMALS) { const y = n.clone().applyQuaternion(d.m.quaternion).y; if (y > best) { best = y; bestN = n; } }
            const q = new THREE.Quaternion().setFromUnitVectors(bestN.clone().applyQuaternion(d.m.quaternion), up).multiply(d.m.quaternion);
            d.m.quaternion.slerp(q, Math.min(1, dt * 8)); d.w.multiplyScalar(0.8);
            if (d.settle > 0.5) { d.rolling = false; d.v.set(0, 0, 0); }
          }
        }
        if (allStill && rollCount && !diceResult) { const a = topValue(dice[0].m), b = topValue(dice[1].m); diceResult = `Dados: ${a} + ${b} = ${a + b}`; }
        // cartas deslizam e viram
        for (const c of dealt) {
          const u = c.userData; u.t += dt; if (u.t < 0) continue;
          const k = Math.min(1, u.t / 0.45);
          c.position.lerp(u.to, Math.min(1, dt * 10));
          c.position.y = u.to.y + Math.sin(k * Math.PI) * 0.05;
          c.rotation.x = Math.PI * (1 - Math.min(1, Math.max(0, (u.t - 0.25) / 0.35)));
        }
        if (shuffleT > 0) { shuffleT -= dt; deckMeshes.forEach((m, i) => { m.position.x = Math.sin(shuffleT * 20 + i) * 0.02 * Math.min(1, shuffleT * 2); }); }
        ctx.hud(`Você ${wins} × ${losses} Casa`, diceResult || msg);
      },
    };
  },
};
