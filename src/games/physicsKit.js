import * as THREE from 'three';
import { std } from './common.js';
import { RigidWorld, grabbable } from './rigidWorld.js';

// Optional physical objects in every app, in a local tray rather than unregistered scenery.
export function createPhysicsKit(ctx) {
  const group = new THREE.Group(); group.name = 'physics-kit'; ctx.root.add(group);
  const eye = ctx.eye(), forward = ctx.forward().setY(0).normalize();
  const center = eye.clone().addScaledVector(forward, 1.15); center.y = eye.y - 0.85;
  const world = new RigidWorld({ floor: center.y - 0.7, limit: 6 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 0.6), std({ map: ctx.tex.get('woodMedium') }));
  tray.position.copy(center); group.add(tray); world.box(center.toArray(), [1, 0.06, 0.6]);
  for (const x of [-0.3, 0, 0.3]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), std({ map: ctx.tex.get(x ? 'woodLight' : 'brushedMetal') }));
    mesh.position.copy(center).add(new THREE.Vector3(x, 0.16, 0)); group.add(mesh);
    grabbable(ctx, world, world.add(mesh, { size: [0.12, 0.12, 0.12], mass: x ? 0.3 : 2 }));
  }
  const reset = ctx.button({ label: 'Restaurar objetos', w: 0.36, h: 0.08, onClick: () => world.reset() });
  reset.position.copy(center).add(new THREE.Vector3(0, 0.4, 0)); group.add(reset);
  return { world, group, enabled: true, update(dt) { if (this.enabled) world.update(dt); }, toggle() {
    this.enabled = !this.enabled; group.visible = this.enabled;
    for (const body of world.bodies) world.release(body);
  } };
}
