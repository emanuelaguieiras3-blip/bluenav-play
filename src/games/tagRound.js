import * as THREE from 'three';
import { std, sweptDistanceSq } from './common.js';
import { walkStep } from '../core/locomotion.js';

// Local arm-locomotion tag against bots. No network players are simulated.
export function createTagRound(ctx, allowed) {
  const colors = ['#cb7e50', '#4d8597', '#9a8d55'], bots = [];
  const fur = colors.map(color => std({ color, map: ctx.tex.get('fabric') }));
  const face = std({ color: '#b9ac94' }), eyes = std({ color: '#161b20' });
  // The tagger glows like lava, as in arm-locomotion tag games.
  const lava = std({ color: '#ff5a1f', emissive: '#ff3a00', emissiveIntensity: 0.7, roughness: 0.6 });
  const sphere = new THREE.SphereGeometry(1, 12, 8), limb = new THREE.CapsuleGeometry(0.085, 0.48, 4, 8);
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Group(), arms = [];
    const add = (geometry, material, position, scale) => { const part = new THREE.Mesh(geometry, material); part.position.set(...position); if (scale) part.scale.set(...scale); mesh.add(part); return part; };
    add(sphere, fur[i], [0, 0.75, 0], [0.3, 0.4, 0.23]);
    add(sphere, fur[i], [0, 1.18, 0.02], [0.25, 0.24, 0.22]);
    add(sphere, face, [0, 1.14, 0.19], [0.18, 0.14, 0.07]);
    for (const sign of [-1, 1]) {
      arms.push(add(limb, fur[i], [sign * 0.35, 0.64, 0]));
      add(sphere, fur[i], [sign * 0.35, 0.3, 0.12], [0.1, 0.09, 0.12]);
      add(sphere, eyes, [sign * 0.07, 1.2, 0.245], [0.025, 0.025, 0.012]);
    }
    mesh.position.set(-3 + i * 3, 0, -2 - i); ctx.root.add(mesh);
    const furParts = mesh.children.filter(c => c.material === fur[i]);
    bots.push({ mesh, arms, furParts, fur: fur[i], tagged: false, origin: mesh.position.clone(), waypoint: new THREE.Vector3(), nextRoute: 0, hop: i * 1.3 });
  }
  let role = 'catch', state = 'ready', time = 90, captures = 0, immunity = 2, clock = 0;
  const handHistory = new Map(), target = new THREE.Vector3();
  const start = (nextRole = role) => {
    role = nextRole === 'run' ? 'run' : 'catch'; state = 'playing'; time = 90; captures = 0; immunity = 2; clock = 0; handHistory.clear(); hadEye = false;
    bots.forEach(b => { b.tagged = false; b.mesh.visible = true; b.mesh.position.copy(b.origin); b.nextRoute = 0; b.furParts.forEach(part => part.material = role === 'run' ? lava : b.fur); });
  };
  const toggle = ctx.button({ label: 'Caçar / fugir', w: 0.30, h: 0.07, onClick: () => start(role === 'catch' ? 'run' : 'catch') });
  const play = ctx.button({ label: 'Começar rodada', w: 0.30, h: 0.07, onClick: () => start() });
  toggle.position.set(-0.17, 0.85, -0.85); play.position.set(0.17, 0.85, -0.85); ctx.root.add(toggle, play);
  const previousEye = new THREE.Vector3(); let hadEye = false;
  return {
    bots, start,
    getState: () => ({ role, state, time, captures, remaining: bots.filter(b => !b.tagged).length }),
    update(dt) {
      const eye = ctx.eye(), center = eye.clone(); center.y -= 0.55;
      if (state !== 'playing') { previousEye.copy(center); hadEye = false; handHistory.clear(); return state === 'ready' ? 'Comece a rodada · encoste nos bots com a mão' : captures === 3 ? 'Você pegou todos! Comece outra rodada.' : 'Rodada encerrada · comece outra'; }
      dt = Math.max(0, Math.min(dt, 0.05)); clock += dt; time = Math.max(0, time - dt); immunity = Math.max(0, immunity - dt);
      for (let i = 0; i < bots.length; i++) {
        const bot = bots[i]; if (bot.tagged) continue;
        const position = bot.mesh.position, distance = Math.hypot(position.x - eye.x, position.z - eye.z);
        if (role === 'run') target.copy(eye);
        else if (distance < 5) target.copy(position).multiplyScalar(2).sub(eye);
        else {
          if (clock >= bot.nextRoute) { const angle = clock * 0.6 + i * 2; bot.waypoint.set(Math.cos(angle) * (4 + i), 0, Math.sin(angle) * (4 + i)); bot.nextRoute = clock + 3; }
          target.copy(bot.waypoint);
        }
        const direction = target.clone().sub(position).setY(0); if (direction.lengthSq() > 0.01) {
          direction.normalize(); const speed = (role === 'run' ? 1.25 : 0.9) * dt;
          let next = walkStep(position.x, position.z, direction.x * speed, direction.z * speed, allowed);
          if (Math.hypot(next.x - position.x, next.z - position.z) < speed * 0.25) {
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i % 2 ? -1 : 1) * Math.PI / 2);
            next = walkStep(position.x, position.z, direction.x * speed, direction.z * speed, allowed);
          }
          position.set(next.x, position.y, next.z); bot.mesh.rotation.y = Math.atan2(direction.x, direction.z);
          // Bots move like gorillas too: knuckle hops in short arcs.
          bot.hop += dt * (role === 'run' ? 7 : 6);
          position.y = Math.abs(Math.sin(bot.hop)) * 0.3;
        } else position.y = Math.max(0, position.y - dt * 2);
        // Bots stay on the ground; climbing is a valid way to evade them.
        bot.arms.forEach((arm, j) => arm.rotation.x = Math.sin(clock * 7 + j * Math.PI + i) * 0.5);
        bot.mesh.updateMatrixWorld(true);
        if (role === 'run' && !immunity && hadEye && sweptDistanceSq(position.clone().setY(0.9), position.clone().setY(0.9), previousEye, center) < 0.55 ** 2) { captures++; immunity = 3; ctx.audio.thud?.(); }
      }
      const seen = new Set();
      for (const p of ctx.pointers()) {
        if (p.source !== 'hand' && p.source !== 'xr') continue;
        const hand = p.hand?.palm || p.handPos, previous = handHistory.get(p.id) || hand; seen.add(p.id);
        if (role === 'catch' && !immunity && previous.distanceTo(hand) < 0.4) for (const bot of bots) {
          if (bot.tagged) continue;
          const at = bot.mesh.position.clone().add(new THREE.Vector3(0, 0.85, 0));
          if (sweptDistanceSq(at, at, previous, hand) < 0.43 ** 2) { bot.tagged = true; bot.mesh.visible = false; captures++; ctx.audio.success?.(); }
        }
        handHistory.set(p.id, hand.clone());
      }
      for (const id of handHistory.keys()) if (!seen.has(id)) handHistory.delete(id);
      previousEye.copy(center); hadEye = true;
      if (!time || role === 'catch' && captures === 3) state = 'finished';
      return `${Math.ceil(time)} s · ${role === 'catch' ? `pegue os bots (${captures}/3)` : `fuja dos bots · capturas ${captures}`}`;
    },
  };
}
