import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RigidWorld, grabbable, nearestAxisQuaternion, pointerFrame } from '../src/games/rigidWorld.js';

// Hand with knuckles along +x and fingers along +y; rotate() turns it about z.
function hand(id, at, angle = 0) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
  const local = Array.from({ length: 21 }, () => new THREE.Vector3());
  local[0].set(0, -0.08, 0); local[5].set(0.04, 0, 0); local[9].set(0.013, 0, 0); local[13].set(-0.013, 0, 0); local[17].set(-0.04, 0, 0);
  const points = local.map(v => v.clone().applyQuaternion(q).add(at));
  return { id, source: 'hand', handPos: at.clone(), hand: { points, palm: at.clone() }, ray: new THREE.Ray(at.clone(), new THREE.Vector3(0, 0, -1)), pinch: true, vel: new THREE.Vector3() };
}
function setup(options) {
  const world = new RigidWorld({ limit: 8 }), drags = [];
  const ctx = { addUI: (mesh, o) => drags.push(o.drag), input: { pointers: [] } };
  const mesh = new THREE.Object3D(); mesh.position.set(0, 0.11, -0.5);
  const body = grabbable(ctx, world, world.add(mesh, options), {});
  return { world, body, drag: drags[0], ctx };
}
const hold = (world, drag, pointers, frames, move = () => {}) => {
  for (let i = 0; i < frames; i++) { move(i); pointers.forEach(p => drag.move(p)); world.update(1 / 60); }
};

test('light objects reach the hand; heavy ones lag and sag unless held with two hands', () => {
  const light = setup({ size: [0.2, 0.2, 0.2], mass: 0.5 }), p = hand('r', new THREE.Vector3(0, 1.2, -0.5));
  light.drag.start(p, { distance: 1 }); hold(light.world, light.drag, [p], 30);
  assert.ok(light.body.mesh.position.distanceTo(p.handPos) < 0.03, `light ${light.body.mesh.position.toArray()}`);

  const heavy = setup({ size: [0.2, 0.2, 0.2], mass: 9 }), one = hand('r', new THREE.Vector3(0, 1.2, -0.5));
  heavy.drag.start(one, { distance: 1 }); hold(heavy.world, heavy.drag, [one], 30);
  const single = heavy.body.mesh.position.y;
  assert.ok(single < 1.0, `one hand lifts heavy too high: ${single}`);

  const both = setup({ size: [0.2, 0.2, 0.2], mass: 9 }), a = hand('r', new THREE.Vector3(0.1, 1.2, -0.5)), b = hand('l', new THREE.Vector3(-0.1, 1.2, -0.5));
  both.drag.start(a, { distance: 1 }); both.drag.start(b, { distance: 1 }); hold(both.world, both.drag, [a, b], 30);
  assert.equal(both.body.holders.size, 2);
  assert.ok(both.body.mesh.position.y > single + 0.05, `two hands ${both.body.mesh.position.y} vs ${single}`);
  // Releasing one hand keeps the grab without a jump.
  const before = both.body.mesh.position.clone(); both.ctx.input.pointers = [a];
  both.drag.end(b); assert.equal(both.body.holders.size, 1); assert.ok(both.body.held);
  both.drag.move(a); both.world.update(1 / 60);
  assert.ok(both.body.mesh.position.distanceTo(before) < 0.06);
});

test('held object turns with the wrist and keeps the grab offset', () => {
  const s = setup({ size: [0.2, 0.2, 0.2], mass: 0.5, rotates: true });
  s.body.mesh.position.set(0, 1.2, -0.5);
  const p = hand('r', new THREE.Vector3(0, 1.2, -0.42));
  s.drag.start(p, { distance: 0.1 });
  const offset = s.body.mesh.position.clone().sub(p.handPos);
  hold(s.world, s.drag, [p], 40, i => { const turned = hand('r', p.handPos, Math.PI / 2 * Math.min(1, i / 20)); p.hand = turned.hand; });
  const angle = new THREE.Euler().setFromQuaternion(s.body.mesh.quaternion).z;
  assert.ok(Math.abs(angle - Math.PI / 2) < 0.1, `angle ${angle}`);
  assert.ok(Math.abs(s.body.mesh.position.distanceTo(p.handPos) - offset.length()) < 0.02);
  assert.ok(pointerFrame(p));
});

test('throws use the object motion: a heavy object flies slower than a light one', () => {
  const throwWith = mass => {
    const s = setup({ size: [0.2, 0.2, 0.2], mass }), p = hand('r', new THREE.Vector3(0, 1.2, -0.5));
    s.body.mesh.position.copy(p.handPos); s.drag.start(p, { distance: 0.1 });
    hold(s.world, s.drag, [p], 12, () => { p.handPos.z -= 0.06; p.hand.points.forEach(v => v.z -= 0.06); });
    s.drag.end(p); return s.body.velocity.length();
  };
  const light = throwWith(0.5), heavy = throwWith(9);
  assert.ok(light > 2.5, `light ${light}`); assert.ok(heavy < light * 0.7, `heavy ${heavy} light ${light}`);
});

test('a fast hand knocks a resting box and spins it', () => {
  const world = new RigidWorld(), mesh = new THREE.Object3D(); mesh.position.set(0, 0.1, 0);
  const body = world.add(mesh, { rotates: true });
  world.setHands([{ id: 'h', position: new THREE.Vector3(-0.14, 0.17, 0), velocity: new THREE.Vector3(3, 0, 0), radius: 0.055 }]);
  world.update(1 / 60); world.setHands([]);
  assert.ok(body.velocity.x > 1, `vx ${body.velocity.x}`); assert.ok(body.angular.length() > 0.5);
});

test('a tumbling cube settles flat on a face', () => {
  const world = new RigidWorld(), mesh = new THREE.Object3D(); mesh.position.set(0, 0.6, 0);
  mesh.quaternion.setFromEuler(new THREE.Euler(0.4, 0.3, 0.2));
  const body = world.add(mesh, { rotates: true, bounce: 0.1 }); body.angular.set(3, 1, 0);
  for (let i = 0; i < 240; i++) world.update(1 / 60);
  const snapped = nearestAxisQuaternion(mesh.quaternion);
  assert.ok(mesh.quaternion.angleTo(snapped) < 0.02, `angle ${mesh.quaternion.angleTo(snapped)}`);
  assert.ok(Math.abs(mesh.position.y - 0.1) < 0.01);
});

test('a rolling ball spins around the axis matching its motion', () => {
  const world = new RigidWorld(), mesh = new THREE.Object3D(); mesh.position.set(0, 0.12, 0);
  const body = world.add(mesh, { size: [0.24, 0.24, 0.24], rotates: true, shape: 'sphere', friction: 0.05 });
  body.velocity.set(2, 0, 0); world.update(1 / 60);
  assert.ok(body.angular.z < -5, `wz ${body.angular.z}`);
});

test('impacts report speed for breakable objects only when hard enough', () => {
  const world = new RigidWorld(), hits = [];
  world.onImpact = (b, speed) => hits.push(speed);
  const mesh = new THREE.Object3D(); mesh.position.set(0, 0.25, 0); world.add(mesh);
  for (let i = 0; i < 60; i++) world.update(1 / 60);
  assert.equal(hits.length, 1); assert.ok(hits[0] < 3);
  const fast = new THREE.Object3D(); fast.position.set(1, 3, 0); world.add(fast).velocity.set(0, -4, 0);
  for (let i = 0; i < 60; i++) world.update(1 / 60);
  assert.ok(Math.max(...hits) > 7);
});
