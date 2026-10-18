import { std, hands2 } from './common.js';

export default {
  id: 'tactical',
  create(ctx) {
    const { THREE, root, tex, audio, env } = ctx;
    env.set({ top: '#8cabc0', horizon: '#d5d6c5', bottom: '#555d56', hemi: ['#e7f0fc', '#3c444b', 1.2], sun: ['#fff4dc', 1.8] });
    const blockers = [];
    const box = (size, pos, map, color = '#ffffff') => { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), std({ map: tex.get(map), color })); m.position.set(...pos); root.add(m); return m; };
    box([20, 0.15, 20], [0, -0.075, 0], 'stoneTiles');
    for (const [size, pos] of [[[20, 3, 0.2], [0, 1.5, -10]], [[0.2, 3, 20], [-10, 1.5, 0]], [[0.2, 3, 20], [10, 1.5, 0]], [[20, 3, 0.2], [0, 1.5, 10]], [[2, 1.1, 0.6], [-2, 0.55, -3]], [[1.6, 1.5, 1.3], [2.5, 0.75, -5]], [[0.5, 2.1, 3], [-4, 1.05, -6]]]) blockers.push(box(size, pos, 'roughStone'));
    const coverBounds = blockers.map(m => new THREE.Box3().setFromObject(m));
    const clearAt = (x, z, radius = 0.25) => Math.abs(x) < 9.5 && Math.abs(z) < 9.5 && !coverBounds.some(b => x > b.min.x - radius && x < b.max.x + radius && z > b.min.z - radius && z < b.max.z + radius);
    ctx.teleport({ enabled: true, walk: true, check: p => clearAt(p.x, p.z) });
    const gun = new THREE.Group();
    const receiver = box([0.065, 0.065, 0.24], [0, 0, 0], 'brushedMetal', '#54616c'); root.remove(receiver); gun.add(receiver);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.055).translate(0, -0.08, 0.07), std({ map: tex.get('rubber') })); gun.add(grip); root.add(gun);
    const botMat = std({ map: tex.get('fabric'), color: '#b27651' }), armorMat = std({ map: tex.get('brushedMetal'), color: '#4d6572' });
    const rubberMat = std({ color: '#25302e', roughness: .88 });
    const visorMat = std({ color: '#d5c28c', roughness: .3, metalness: .4 });
    const botGeometry = {
      torso: new THREE.LatheGeometry([[0,.72],[.15,.73],[.18,.87],[.22,1.12],[.24,1.34],[.20,1.44],[.10,1.49],[0,1.50]].map(p => new THREE.Vector2(...p)), 16),
      head: new THREE.SphereGeometry(.15, 16, 12),
      neck: new THREE.CylinderGeometry(.066, .08, .15, 12),
      helmet: new THREE.SphereGeometry(.16, 16, 8, 0, Math.PI * 2, 0, Math.PI * .58),
      visor: new THREE.BoxGeometry(.21, .064, .034),
      shoulder: new THREE.SphereGeometry(.085, 10, 8),
      arm: new THREE.CapsuleGeometry(.054, .31, 4, 10).translate(0, -.22, .025),
      hand: new THREE.SphereGeometry(.061, 10, 8).scale(.8, 1.2, 1),
      leg: new THREE.CapsuleGeometry(.065, .59, 4, 10).translate(0, -.38, 0),
      boot: new THREE.SphereGeometry(.08, 12, 8).scale(1, .65, 1.65),
      belt: new THREE.CylinderGeometry(.185, .19, .065, 16),
    };
    const bots = Array.from({ length: 4 }, (_, i) => {
      const mesh = new THREE.Group(); mesh.name = 'tactical-adversary';
      const body = new THREE.Mesh(botGeometry.torso, armorMat);
      const head = new THREE.Mesh(botGeometry.head, botMat); head.position.y = 1.72;
      const neck = new THREE.Mesh(botGeometry.neck, rubberMat); neck.position.y = 1.54; mesh.add(neck);
      const helmet = new THREE.Mesh(botGeometry.helmet, armorMat); helmet.position.y = .025; head.add(helmet);
      const visor = new THREE.Mesh(botGeometry.visor, visorMat); visor.position.set(0, .02, .143); head.add(visor);
      const belt = new THREE.Mesh(botGeometry.belt, rubberMat); belt.position.y = .80; mesh.add(belt);
      const legs = [-1, 1].map(s => {
        const leg = new THREE.Group(); leg.name = 'hip-pivot'; leg.position.set(s * .12, .76, 0);
        leg.add(new THREE.Mesh(botGeometry.leg, botMat));
        const boot = new THREE.Mesh(botGeometry.boot, rubberMat); boot.position.set(0, -.71, .045); leg.add(boot); return leg;
      });
      const arms = [-1, 1].map(s => {
        const arm = new THREE.Group(); arm.position.set(s * .27, 1.37, 0); arm.rotation.x = -.18;
        arm.add(new THREE.Mesh(botGeometry.shoulder, armorMat), new THREE.Mesh(botGeometry.arm, botMat));
        const hand = new THREE.Mesh(botGeometry.hand, rubberMat); hand.position.set(0, -.43, .025); arm.add(hand); return arm;
      });
      mesh.add(body, head, ...legs, ...arms); mesh.position.set(-3 + i * 2, 0, -7.7); root.add(mesh);
      return { mesh, body, head, legs, hp: 3, cooldown: 1 + i * 0.5, respawn: 0, box: new THREE.Box3(), headBox: new THREE.Box3() };
    });
    const bulletGeo = new THREE.SphereGeometry(0.022, 6, 4), bulletMat = new THREE.MeshBasicMaterial({ color: '#ffe38b' });
    const bullets = Array.from({ length: 24 }, () => { const mesh = new THREE.Mesh(bulletGeo, bulletMat); mesh.visible = false; root.add(mesh); return { mesh, velocity: new THREE.Vector3(), life: 0 }; });
    const raycaster = new THREE.Raycaster(), previous = new THREE.Vector3(), direction = new THREE.Vector3(), temp = new THREE.Vector3();
    let ammo = 12, health = 10, kills = 0, cooldown = 0, reloadTime = 0, feedback = 'Gatilho/pinça: disparar · R ou botão: recarregar', flash = 0;
    const reload = () => { if (!reloadTime && ammo < 12) { reloadTime = 1.4; feedback = 'Recarregando'; audio.click(); } };
    const button = ctx.button({ label: 'Recarregar', w: 0.3, h: 0.08, onClick: reload }); button.position.set(0, 0.85, -0.75); root.add(button);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffcd5b' })); muzzle.position.z = -0.2; muzzle.visible = false; gun.add(muzzle);
    return { bots, getState: () => ({ ammo, health, kills, reloading: reloadTime > 0, bullets: bullets.filter(b => b.life > 0).length }), update(dt, t) {
      const eye = ctx.eye(), { main, off } = hands2(ctx);
      gun.visible = !!main;
      if (main) { gun.position.copy(main.source === 'mouse' || main.source === 'gaze' ? eye.clone().addScaledVector(main.ray.direction, 0.45).add(temp.set(0.15, -0.18, 0)) : main.handPos); gun.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), main.ray.direction); }
      cooldown = Math.max(0, cooldown - dt); flash = Math.max(0, flash - dt); muzzle.visible = flash > 0;
      if (reloadTime > 0) { reloadTime = Math.max(0, reloadTime - dt); if (!reloadTime) { ammo = 12; feedback = 'Carregador pronto'; } }
      if (ctx.input.keys.has('KeyR') || off?.pinchDown && off.handPos.distanceTo(gun.position) < 0.22) reload();
      if (main?.pinchDown && !reloadTime && !cooldown) {
        if (!ammo) { audio.click(); feedback = 'Sem munição. Recarregue.'; }
        else {
          const bullet = bullets.find(b => b.life <= 0);
          if (bullet) { ammo--; cooldown = 0.18; flash = 0.06; bullet.life = coverBounds.some(box => box.containsPoint(main.ray.origin)) ? 0 : 1.8; bullet.mesh.visible = bullet.life > 0; bullet.mesh.position.copy(main.ray.origin); bullet.velocity.copy(main.ray.direction).multiplyScalar(32); audio.noise({ dur: 0.07, freq: 900, vol: 0.16 }); main.gamepad?.hapticActuators?.[0]?.pulse?.(0.35, 45)?.catch?.(() => {}); }
        }
      }
      for (const bot of bots) {
        if (bot.hp <= 0) { bot.respawn -= dt; if (bot.respawn <= 0) { bot.hp = 3; bot.mesh.visible = true; bot.mesh.position.set(-3 + bots.indexOf(bot) * 2, 0, -7.7); bot.cooldown = 1.5; } else continue; }
        temp.copy(eye).sub(bot.mesh.position).setY(0); const distance = temp.length(); bot.mesh.rotation.y = Math.atan2(temp.x, temp.z);
        if (distance > 3) { temp.normalize().multiplyScalar(dt * 0.65); const p = bot.mesh.position; if (clearAt(p.x + temp.x, p.z + temp.z)) p.add(temp); }
        bot.legs.forEach((leg, i) => leg.rotation.x = distance > 3 ? Math.sin(t * 6 + i * Math.PI) * 0.15 : 0);
        bot.mesh.updateMatrixWorld(true); bot.box.setFromObject(bot.mesh); bot.headBox.setFromObject(bot.head);
        bot.cooldown -= dt;
        if (bot.cooldown <= 0) {
          bot.cooldown = 1.8 + Math.random() * 1.2;
          const from = bot.mesh.position.clone().add(temp.set(0, 1.5, 0)); direction.copy(eye).sub(from); const range = direction.length();
          raycaster.set(from, direction.normalize()); raycaster.far = range;
          if (range < 9 && !raycaster.intersectObjects(blockers, false).length) { health--; feedback = 'Atingido! Use cobertura.'; audio.thud(); }
        }
      }
      for (const b of bullets) if (b.life > 0) {
        previous.copy(b.mesh.position); b.velocity.y -= 9.81 * dt; b.mesh.position.addScaledVector(b.velocity, dt); b.life -= dt;
        direction.copy(b.mesh.position).sub(previous); const length = direction.length(); raycaster.set(previous, direction.normalize()); raycaster.far = length;
        let nearest = raycaster.intersectObjects(blockers, false)[0]?.distance ?? Infinity, target = null;
        for (const bot of bots) { if (bot.hp <= 0) continue; const hit = raycaster.ray.intersectBox(bot.box, temp); if (hit) { const distance = hit.distanceTo(previous); if (distance <= length && distance < nearest) { nearest = distance; target = bot; } } }
        // Bullets push the loose props (cans fly, barrels rock) unless cover is closer.
        if (!target && nearest === Infinity && ctx.app?.sceneProps?.impact(previous, b.mesh.position, b.velocity, 0.06)) { b.life = 0; audio.metal(); }
        if (nearest !== Infinity || b.mesh.position.y < 0) {
          b.life = 0;
          if (target) { const headshot = !!raycaster.ray.intersectBox(target.headBox, temp) && temp.distanceTo(previous) <= length; target.hp -= headshot ? 3 : 1; audio.metal(); feedback = headshot ? 'Acerto na cabeça' : 'Acerto'; if (target.hp <= 0) { kills++; target.respawn = 5; target.mesh.visible = false; } }
        }
        b.mesh.visible = b.life > 0;
      }
      if (health <= 0) { health = 10; ammo = 12; kills = 0; reloadTime = 0; ctx.rig.position.set(0, 0, 0); for (const b of bullets) { b.life = 0; b.mesh.visible = false; } for (const bot of bots) { bot.hp = 3; bot.mesh.visible = true; bot.mesh.position.set(-3 + bots.indexOf(bot) * 2, 0, -7.7); bot.cooldown = 2; } feedback = 'Treino reiniciado'; }
      ctx.hud(`Treino Tático · vida ${health}/10 · munição ${ammo}/12 · ${kills} alvos`, reloadTime ? `Recarregando ${reloadTime.toFixed(1)}s` : feedback);
    } };
  },
};
