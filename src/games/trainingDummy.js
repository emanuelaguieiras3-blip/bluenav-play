import * as THREE from 'three';
import { std, sweptDistanceSq } from './common.js';
import { grabbable } from './rigidWorld.js';

// Original training mannequin: bounded distance joints, not a humanoid AI.
export function createTrainingDummy(ctx, world, position = [2.3, 0, -4.8]) {
  const offset = new THREE.Vector3(...position), bodies = [], group = 'training-dummy';
  const shell = std({ color: '#c8a77c', map: ctx.tex.get('fabric'), roughness: 0.85 });
  const armor = std({ color: '#425664', map: ctx.tex.get('brushedMetal'), roughness: 0.45 });
  const parts = [
    ['torso', [0, 1.12, 0], [0.4, 0.46, 0.24], 6], ['head', [0, 1.56, 0], [0.28, 0.3, 0.28], 1.5],
    ['hip', [0, 0.76, 0], [0.32, 0.2, 0.23], 4],
    ['leftArm', [-0.31, 1.16, 0], [0.15, 0.34, 0.15], 1], ['rightArm', [0.31, 1.16, 0], [0.15, 0.34, 0.15], 1],
    ['leftHand', [-0.38, 0.88, -0.04], [0.14, 0.25, 0.14], 0.6], ['rightHand', [0.38, 0.88, -0.04], [0.14, 0.25, 0.14], 0.6],
    ['leftLeg', [-0.1, 0.37, 0], [0.16, 0.62, 0.18], 2], ['rightLeg', [0.1, 0.37, 0], [0.16, 0.62, 0.18], 2],
  ];
  let standing = true, falls = 0;
  const activate = (velocity = null) => {
    if (!standing) return;
    standing = false; falls++;
    for (const body of bodies) { body.held = null; if (velocity) body.velocity.copy(velocity).clampLength(0, 5); }
    ctx.audio.thud?.();
  };
  for (const [name, at, size, mass] of parts) {
    const radius = Math.min(size[0], size[2]) / 2;
    const geometry = name === 'head' ? new THREE.SphereGeometry(0.145, 16, 12) : new THREE.CapsuleGeometry(radius, Math.max(0.02, size[1] - radius * 2), 4, 10);
    const mesh = new THREE.Mesh(geometry, name === 'torso' || name === 'hip' ? armor : shell);
    if (name === 'torso' || name === 'hip') mesh.scale.x = size[0] / (radius * 2);
    mesh.position.set(...at).add(offset); ctx.root.add(mesh);
    const body = world.add(mesh, { size, mass, bounce: 0.04, friction: 0.9 });
    body.kind = 'dummy'; body.part = name; body.collisionGroup = group; body.held = group; bodies.push(body);
    grabbable(ctx, world, body, { onGrab: () => activate() });
  }
  for (const [a, b] of [[0, 1], [0, 2], [0, 3], [0, 4], [3, 5], [4, 6], [2, 7], [2, 8]]) world.connect(bodies[a], bodies[b]);
  const previous = new Map();
  return {
    bodies, activate, getState: () => ({ standing, falls }),
    reset() { standing = true; falls = 0; previous.clear(); for (const body of bodies) { world.release(body); body.mesh.position.copy(body.origin); body.held = group; } },
    update(dt) {
      const active = new Set();
      for (const p of ctx.pointers()) {
        if (p.source !== 'hand' && p.source !== 'xr') continue;
        const now = p.hand?.palm || p.handPos, old = previous.get(p.id); active.add(p.id); previous.set(p.id, now.clone());
        if (!standing || !old || !(dt > 0) || p.pinch) continue;
        const motion = now.clone().sub(old), speed = motion.length() / dt;
        if (speed > 1 && speed < 10 && bodies.some(b => sweptDistanceSq(b.mesh.position, b.mesh.position, old, now) < (b.half.length() + 0.055) ** 2)) activate(motion.divideScalar(dt));
      }
      for (const id of previous.keys()) if (!active.has(id)) previous.delete(id);
      if (standing) for (const object of world.bodies) if (object.kind !== 'dummy' && object.enabled && object.velocity.length() > 1.8 && bodies.some(b => world.bounds(b).intersectsBox(world.bounds(object)))) { activate(object.velocity); break; }
    },
  };
}
