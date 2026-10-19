import * as THREE from './vendor/three.module.js';
import { createPerson } from './vr-person.js';

export function actorShape(kind = '') {
  if (/slime/i.test(kind)) return 'slime';
  if (/hound|wolf/i.test(kind)) return 'hound';
  if (/wraith|sylph/i.test(kind)) return 'spirit';
  if (/dragon|gargoyle|demon/i.test(kind)) return 'winged';
  return 'humanoid';
}

export function createActor(color, kind = '', withArt = false, entity = null, items = {}) {
  if (!kind && entity) return createPerson(entity, color, items);
  const group = new THREE.Group(), shape = actorShape(kind);
  group.name = `actor-${shape}`;
  const coat = new THREE.MeshStandardMaterial({ color, roughness: .86, metalness: .04 });
  const dark = new THREE.MeshStandardMaterial({ color: '#24202b', roughness: .8 });
  const skin = new THREE.MeshStandardMaterial({ color: '#d6ac87', roughness: .9 });
  const limbs = [];
  const part = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };
  let body;
  if (shape === 'slime') {
    body = part(new THREE.SphereGeometry(.47, 16, 10), coat, 0, .32, 0);
    body.scale.set(1, .68, 1);
  } else if (shape === 'hound') {
    body = part(new THREE.CapsuleGeometry(.22, .48, 4, 12), coat, 0, .55, 0); body.rotation.x = Math.PI / 2;
    part(new THREE.SphereGeometry(.19, 12, 8), coat, 0, .72, -.42);
    part(new THREE.ConeGeometry(.13, .3, 8), dark, 0, .68, -.61).rotation.x = -Math.PI / 2;
    for (const side of [-1, 1]) for (const z of [-.24, .24]) {
      const leg = part(new THREE.CapsuleGeometry(.065, .25, 4, 8), coat, side * .18, .24, z); limbs.push(leg);
    }
    part(new THREE.ConeGeometry(.085, .5, 8), coat, 0, .69, .5).rotation.x = .9;
  } else {
    body = part(new THREE.CapsuleGeometry(.23, .43, 6, 14), coat, 0, .86, 0);
    part(new THREE.SphereGeometry(.21, 16, 12), shape === 'humanoid' ? skin : coat, 0, 1.4, 0);
    for (const side of [-1, 1]) {
      const arm = part(new THREE.CapsuleGeometry(.068, .36, 4, 8), coat, side * .32, .9, 0);
      arm.rotation.z = side * .17; limbs.push(arm);
      part(new THREE.SphereGeometry(.075, 8, 6), skin, side * .36, .63, 0);
      if (shape !== 'spirit') {
        const leg = part(new THREE.CapsuleGeometry(.09, .3, 4, 10), dark, side * .12, .31, 0); limbs.push(leg);
        part(new THREE.SphereGeometry(.11, 10, 6), dark, side * .12, .08, -.05).scale.set(1, .6, 1.5);
      }
    }
    if (shape === 'spirit') {
      part(new THREE.ConeGeometry(.3, .72, 14), coat, 0, .48, 0).rotation.z = Math.PI;
      coat.transparent = true; coat.opacity = .78;
    }
    if (shape === 'winged') for (const side of [-1, 1]) {
      const wing = part(new THREE.ConeGeometry(.35, .95, 3), coat, side * .58, 1.12, .16);
      wing.rotation.z = side * -.85; wing.scale.z = .18;
      part(new THREE.ConeGeometry(.065, .28, 8), dark, side * .13, 1.62, 0).rotation.z = side * -.3;
    }
  }
  const faceY = shape === 'slime' ? .39 : shape === 'hound' ? .79 : 1.44;
  const faceZ = shape === 'slime' ? -.4 : shape === 'hound' ? -.53 : -.19;
  for (const side of [-1, 1]) part(new THREE.SphereGeometry(.029, 8, 6), dark, side * .085, faceY, faceZ);
  if (withArt) {
    const plane = part(new THREE.PlaneGeometry(.42, .56), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false }), 0, .95, -.245);
    plane.visible = false; group.userData.art = plane;
  }
  group.userData.body = body; group.userData.limbs = limbs; group.userData.shape = shape;
  return group;
}

export function disposeActor(group, disposeArt = true) {
  const geometries = new Set(), materials = new Set();
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
  });
  if (disposeArt) group.userData.art?.material.map?.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
