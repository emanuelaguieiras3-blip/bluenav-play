// 🧩 QUEBRA-CABEÇA 3D — Formas que Fazem Sentido
import { std } from './common.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// níveis: peças formadas por cubinhos (policubos) que montam um cubo 3×3×3 / 2×2×2
const LEVELS = [
  { n: 2, pieces: [[[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[1, 1, 0], [1, 1, 1], [0, 1, 1]], [[0, 0, 1], [1, 0, 1]]] },
  { n: 3, pieces: [
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[1, 1, 0], [2, 1, 0], [2, 2, 0], [1, 2, 0], [0, 2, 0]],
    [[1, 0, 1], [2, 0, 1], [2, 0, 2], [1, 0, 2], [0, 0, 2]],
    [[0, 1, 1], [1, 1, 1], [2, 1, 1], [0, 1, 2]],
    [[1, 1, 2], [2, 1, 2], [2, 2, 2], [2, 2, 1]],
    [[0, 2, 1], [1, 2, 1], [0, 2, 2], [1, 2, 2]],
  ] },
];

export default {
  id: 'puzzle',
  create(ctx) {
    ctx.lookDown();
    const { THREE, root, audio, input, env } = ctx;
    env.set({ top: '#cfd3d9', horizon: '#e4e6ea', bottom: '#c4c7cc', sharp: 1, hemi: ['#ffffff', '#b8bcc4', 1.8], sun: ['#ffffff', 1.4], sunPos: [1, 4, 3] });

    const U = 0.11; // tamanho do cubinho
    const ceramic = () => std({ color: '#eef3fb', roughness: 0.42, metalness: 0, emissive: '#ffcf5a', emissiveIntensity: 0 });
    const holder = new THREE.Group(); holder.position.set(0, 1.35, -0.75); root.add(holder);
    let level = 0, pieces = [], solved = false, glowT = 0, idleT = 0;
    const grabs = new Map(); // mão -> peça segurada
    let twist = null;         // giro com as duas mãos

    const build = () => {
      for (const p of pieces) { ctx.app.ui.remove(p.mesh); p.mesh.removeFromParent(); p.mesh.geometry.dispose(); p.mesh.material.dispose(); p.edges.geometry.dispose(); p.edges.material.dispose(); }
      pieces = []; grabs.clear(); solved = false; glowT = 0; holder.rotation.set(0.35, 0.5, 0);
      const L = LEVELS[level], off = (L.n - 1) / 2;
      L.pieces.forEach((cells, i) => {
        const geos = cells.map(([x, y, z]) => new RoundedBoxGeometry(U * 0.985, U * 0.985, U * 0.985, 2, 0.012).translate((x - off) * U, (y - off) * U, (z - off) * U));
        const g = mergeGeometries(geos); geos.forEach((q) => q.dispose());
        const mesh = new THREE.Mesh(g, ceramic());
        // linhas de encaixe finas e escuras
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: '#4a5260', transparent: true, opacity: 0.6 }));
        mesh.add(edges);
        // espalhadas em volta, flutuando
        const a = (i / L.pieces.length) * Math.PI * 1.6 - Math.PI * 0.8;
        const home = new THREE.Vector3(Math.sin(a) * 0.5, -0.05 + Math.cos(i * 2.1) * 0.12, Math.cos(a) * 0.12 + 0.18);
        mesh.position.copy(home);
        holder.add(mesh);
        const p = { mesh, edges, placed: false, home };
        pieces.push(p);
        ctx.addUI(mesh, {
          sound: false,
          onHover: (on) => { if (!p.placed) mesh.material.emissiveIntensity = on ? 0.12 : 0; },
          drag: p.drag = {
            // cada mão pode segurar uma peça diferente ao mesmo tempo
            start: (inp, hit) => { if (p.placed) return; grabs.set(inp.id, { piece: p, ptr: inp, off: mesh.position.clone().sub(holder.worldToLocal(hit.point.clone())), dist: hit.distance }); audio.tone({ freq: 300, dur: 0.06, vol: 0.06 }); },
            move: () => {},
            end: (inp) => { const g = inp && grabs.get(inp.id); if (g) { release(g.piece); grabs.delete(inp.id); } },
          },
        });
      });
    };
    const release = (p) => {
      if (p.mesh.position.length() < 0.06) {
        p.placed = true; p.mesh.position.set(0, 0, 0);
        p.edges.material.opacity = 0; // linhas desaparecem ao juntar
        audio.tone({ freq: 220, to: 160, dur: 0.12, vol: 0.2 }); audio.noise({ dur: 0.03, freq: 1800, vol: 0.08 });
        if (pieces.every((q) => q.placed)) { solved = true; audio.success(); }
      }
    };
    build();
    const next = ctx.button({ w: 0.26, h: 0.08, label: 'Próximo nível', icon: 'next', variant: 'accent', fontSize: 0.34, onClick: () => { level = (level + 1) % LEVELS.length; build(); } });
    next.position.set(0, 0.92, -0.7); root.add(next);
    const reset = ctx.button({ w: 0.22, h: 0.08, label: 'Recomeçar', icon: 'refresh', variant: 'glass', fontSize: 0.34, onClick: build });
    reset.position.set(0.3, 0.92, -0.7); root.add(reset);
    const tmp = new THREE.Vector3();

    return {
      update(dt) {
        if (grabs.size) {
          idleT = 0;
          for (const [id, g] of grabs) {
            // a peça acompanha a mão com leve resistência (massa)
            const target = holder.worldToLocal(g.ptr.ray.origin.clone().addScaledVector(g.ptr.ray.direction, g.dist)).add(g.off);
            const m = g.piece.mesh.position;
            m.lerp(target, Math.min(1, dt * 12));
            // atração suave perto do lugar certo
            const d = m.length();
            if (d < 0.12) { m.multiplyScalar(1 - Math.min(1, dt * 6 * (1 - d / 0.12))); g.piece.mesh.material.emissiveIntensity = 0.2 * (1 - d / 0.12); }
            if (d < 0.025) { release(g.piece); grabs.delete(id); ctx.app.ui.cancelDrag(g.piece.drag); }
          }
        }
        // DUAS mãos pinçando no vazio: gira o objeto inteiro (como girar um objeto no Quest)
        const ps = ctx.pointers().filter((q) => q.source === 'hand' || q.source === 'xr');
        if (ps.length >= 2 && ps[0].pinch && ps[1].pinch && !grabs.size && !ps[0].uiBusy && !ps[1].uiBusy) {
          const v = ps[1].handPos.clone().sub(ps[0].handPos);
          const yaw = Math.atan2(v.x, v.z), pitch = Math.atan2(v.y, Math.hypot(v.x, v.z));
          if (!twist) twist = { yaw, pitch, ry: holder.rotation.y, rx: holder.rotation.x };
          holder.rotation.y = twist.ry + (yaw - twist.yaw);
          holder.rotation.x = THREE.MathUtils.clamp(twist.rx - (pitch - twist.pitch), -1.2, 1.2);
          idleT = 0;
        } else twist = null;
        if (!grabs.size && !twist) {
          idleT += dt;
          // gira sozinho devagar quando ninguém toca
          if (idleT > 1.2) holder.rotation.y += dt * 0.25;
          for (const p of pieces) if (!p.placed && ![...grabs.values()].some((g) => g.piece === p)) { tmp.copy(p.home); p.mesh.position.lerp(tmp, Math.min(1, dt * 0.6)); }
        }
        if (solved) {
          // acende por dentro: brilho dourado nas bordas
          glowT = Math.min(1, glowT + dt * 0.8);
          for (const p of pieces) p.mesh.material.emissiveIntensity = 0.35 * glowT * (0.8 + Math.sin(performance.now() * 0.003) * 0.2);
        }
        const left = pieces.filter((p) => !p.placed).length;
        ctx.hud(`Nível ${level + 1} · ${solved ? 'Completo!' : `faltam ${left} peças`}`, 'Pince uma peça e leve ao centro · pince o vazio com as duas mãos para girar');
      },
    };
  },
};
