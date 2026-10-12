import { std } from './common.js';

export const ANCHOR_Z = [-5, -13, -21];

export function canRestore(eye, anchor, range = 2.5) {
  return Math.hypot(eye.x - anchor.x, eye.z - anchor.z) <= range;
}

export default {
  id: 'shiftworld',
  create(ctx) {
    const { THREE, root, tex, env, rig, input, audio } = ctx;
    env.set({ top: '#473164', horizon: '#a66890', bottom: '#291b3d', fog: { color: '#765375', near: 14, far: 55 }, hemi: ['#b594cc', '#382943', 1.15], sun: ['#f7cdaf', 1.25], sunPos: [-9, 20, -19] });
    const corrupted = std({ color: '#634f78', roughness: 0.96 }), restored = std({ map: tex.get('grass'), color: '#73ac70', roughness: 1 });
    const rock = std({ map: tex.get('roughStone'), color: '#675d72', roughness: 0.95 });
    const bark = std({ map: tex.get('bark'), color: '#735943', roughness: 1 });
    const crownBad = std({ color: '#9566a7', roughness: 0.85 }), crownGood = std({ color: '#377848', roughness: 0.95 });
    const crystalBad = std({ color: '#d657b2', emissive: '#63205d', emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.25 });
    const crystalGood = std({ color: '#7de7c3', emissive: '#2d967b', emissiveIntensity: 0.7, roughness: 0.23, metalness: 0.2 });
    const zones = [];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 29, 6, 29).rotateX(-Math.PI / 2), std({ map: tex.get('dirt'), color: '#887865', roughness: 1 }));
    path.position.z = -13; path.position.y = 0.012; root.add(path);
    for (let i = 0; i < 3; i++) {
      const z = ANCHOR_Z[i];
      const groundGeo = new THREE.CylinderGeometry(6, 6.4, 0.16, 24, 1);
      const ground = new THREE.Mesh(groundGeo, corrupted.clone()); ground.position.set(0, -0.09, z); root.add(ground);
      const trees = [];
      for (let j = 0; j < 8; j++) {
        const angle = j / 8 * Math.PI * 2 + i * 0.3, r = 3.5 + (j % 3) * 0.65;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 1.5, 9), bark); trunk.position.y = 0.75; tree.add(trunk);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.72 + (j % 3) * 0.1, 2.15, 10), crownBad.clone());
        crown.position.y = 2.0; crown.rotation.z = (j % 2 ? -1 : 1) * 0.85; tree.add(crown);
        // Keep the 5.5 m path clear: a tree once spawned inside the player's head.
        let tx = Math.cos(angle) * r; if (Math.abs(tx) < 3.4) tx = (Math.sign(tx) || 1) * (3.4 + (j % 3) * 0.4);
        tree.position.set(tx, 0, z + Math.sin(angle) * r); root.add(tree); trees.push(crown);
      }
      for (let j = 0; j < 7; j++) {
        const a = j * 2.399, r = 2.2 + (j % 3) * 1.1;
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + j % 3 * 0.12, 1), rock);
        mesh.position.set(Math.cos(a) * r, 0.22, z + Math.sin(a) * r); mesh.scale.y = 0.6; root.add(mesh);
      }
      const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.53, 1), crystalBad.clone());
      crystal.position.set(i % 2 ? 1.25 : -1.25, 1.45, z); root.add(crystal);
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.8, 12), rock); pedestal.position.set(crystal.position.x, 0.4, z); root.add(pedestal);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.035, 7, 32), crystalBad.clone()); ring.position.copy(crystal.position); ring.rotation.x = Math.PI / 2; root.add(ring);
      const sign = ctx.label(`ÂNCORA ${i + 1}: APROXIME-SE E PINCE`, { w: 2.25, h: 0.17, size: 0.31, bg: 'rgba(20,16,34,.82)' });
      sign.position.set(crystal.position.x, 2.65, z); root.add(sign);
      zones.push({ z, ground, trees, crystal, ring, sign, restored: false });
    }
    const portal = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.17, 12, 48), std({ color: '#5c4e69', metalness: 0.45, roughness: 0.35 }));
    portal.position.set(0, 1.45, -27); root.add(portal);
    const portalGlow = new THREE.Mesh(new THREE.CircleGeometry(1.17, 40), new THREE.MeshBasicMaterial({ color: '#39b9a0', transparent: true, opacity: 0.08, side: THREE.DoubleSide }));
    portalGlow.position.set(0, 1.45, -27); root.add(portalGlow);
    const portalSign = ctx.label('PORTAL: RESTAURE AS 3 ÂNCORAS', { w: 2.5, h: 0.17, size: 0.29, bg: 'rgba(20,16,34,.84)' });
    portalSign.position.set(0, 3.35, -27); root.add(portalSign);
    const intro = ctx.label('BLUENAV · MUNDO TRANSFORMADO', { w: 2.3, h: 0.25, size: 0.38, bg: 'rgba(20,16,34,.9)' });
    intro.position.set(0, 2.7, -1.2); root.add(intro);
    ctx.teleport({ enabled: true, walk: true });
    let restoredCount = 0, complete = false, time = 0, message = '', messageTime = 0;
    const restore = (index) => {
      const zone = zones[index]; if (!zone || zone.restored || complete) return false;
      zone.restored = true; restoredCount++;
      zone.ground.material.dispose(); zone.ground.material = restored.clone();
      zone.crystal.material.dispose(); zone.crystal.material = crystalGood.clone();
      zone.ring.material.dispose(); zone.ring.material = crystalGood.clone();
      for (const tree of zone.trees) { tree.material.dispose(); tree.material = crownGood.clone(); tree.rotation.z = 0; }
      zone.sign.userData.set(`ÂNCORA ${index + 1} RESTAURADA`);
      message = `Região ${index + 1} restaurada`; messageTime = 3; audio.success?.();
      if (restoredCount === 3) { portalGlow.material.opacity = 0.72; portalSign.userData.set('PORTAL ABERTO: ENTRE PARA CONCLUIR'); }
      ctx.objective?.(restoredCount < 3 ? `Restaure as âncoras restantes (${restoredCount}/3).` : 'Entre no portal ao fim da trilha.');
      return true;
    };
    const restart = () => {
      // Recreate the scene so materials and progression return to their original state.
      ctx.app.loadGame('shiftworld');
    };
    const restartButton = ctx.button({ label: 'Recomeçar', w: 0.3, h: 0.08, onClick: restart });
    restartButton.position.set(0.9, 1.4, -1.2); root.add(restartButton);
    const tryNearest = (pointer) => {
      const eye = ctx.eye();
      for (let i = 0; i < zones.length; i++) {
        const zone = zones[i]; if (zone.restored || !canRestore(eye, zone.crystal.position)) continue;
        if (pointer?.ray && pointer.ray.distanceSqToPoint(zone.crystal.position) > 0.45 &&
            (!pointer.handPos || pointer.handPos.distanceToSquared(zone.crystal.position) > 0.3)) continue;
        if (restore(i)) return true;
      }
      return false;
    };
    return {
      zones, restore, restart,
      getState: () => ({ restored: restoredCount, complete, time }),
      update(dt) {
        dt = Math.max(0, Math.min(0.05, dt)); time += dt; messageTime = Math.max(0, messageTime - dt);
        if (!complete) {
          if (input.keys.has('KeyE')) { tryNearest(null); input.keys.delete('KeyE'); }
          for (const pointer of ctx.pointers()) if (pointer.pinchDown && !pointer.uiBusy) { if (tryNearest(pointer)) pointer.uiBusy = true; }
          const eye = ctx.eye();
          if (restoredCount === 3 && Math.hypot(eye.x, eye.z + 27) < 1.2) { complete = true; message = `Mundo restaurado em ${Math.round(time)} s`; messageTime = 10; audio.success?.(); ctx.objective?.('Concluído. O mundo foi restaurado.'); }
        }
        for (const zone of zones) if (!zone.restored) { zone.crystal.rotation.y += dt * 0.5; zone.crystal.position.y = 1.45 + Math.sin(time * 2 + zone.z) * 0.07; zone.ring.rotation.z += dt * 0.3; }
        portal.rotation.z += dt * (restoredCount === 3 ? 0.3 : 0.05);
        ctx.hud(`Mundo Transformado · ${restoredCount}/3 âncoras`, messageTime ? message : complete ? 'Mundo restaurado' : 'Aproxime-se de um cristal e pince, ou pressione E.');
      },
    };
  },
};
