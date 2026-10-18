import * as THREE from './vendor/three.module.js';

export const CLASS_VISUALS = Object.freeze({
  guardiao: { outfit: 'armor', hat: 'helmet', weapon: 'spear', shield: true },
  guerreiro: { outfit: 'armor', weapon: 'sword' },
  arqueiro: { weapon: 'bow', quiver: true },
  mago: { outfit: 'robe', hat: 'wizard', weapon: 'staff' },
  ladino: { hat: 'hood', weapon: 'dagger' },
  clerigo: { outfit: 'robe', weapon: 'staff', emblem: true },
  druida: { outfit: 'robe', weapon: 'staff', antlers: true },
  berserker: { weapon: 'axe', shoulders: true },
  paladino: { outfit: 'armor', weapon: 'sword', shield: true, emblem: true },
  necromante: { outfit: 'robe', hat: 'hood', weapon: 'scythe' },
  bardo: { hat: 'feather', weapon: 'lute' },
  monarca: { hat: 'crown', cape: true, weapon: 'dagger' },
  artifice: { outfit: 'apron', hat: 'cap', weapon: 'hammer', belt: true },
});
const WEAPONS = { espada: 'sword', machado: 'axe', adaga: 'dagger', lanca: 'spear', arco: 'bow', cajado: 'staff', martelo: 'hammer', foice: 'scythe' };

export function personVisual(entity = {}, color = '#927e66', items = {}) {
  const style = CLASS_VISUALS[entity.classId] || {}, look = entity.look || {};
  const weaponId = entity.equipment?.weapon;
  const weapon = weaponId ? WEAPONS[weaponId.split('-')[0].replace(/\d+$/, '')] || style.weapon : look.item || style.weapon;
  const headId = entity.equipment?.head || '';
  const armorId = entity.equipment?.armor || '';
  const equippedOutfit = armorId.startsWith('peitoral') ? 'armor' : armorId.startsWith('tunica') ? 'tunic' : armorId.startsWith('manto') ? 'robe' : null;
  return { ...style, ...look,
    skin: look.skin || '#eab893', main: look.main || color, accent: look.accent || '#e8d8b0', hairColor: look.hairColor || '#9a5b2e',
    hair: look.hair || (entity.appearance === 'male' || look.body === 'man' ? 'short' : 'ponytail'),
    outfit: equippedOutfit || look.outfit || style.outfit || 'tunic',
    hat: headId.startsWith('elmo') ? 'helmet' : headId.startsWith('capuz') ? 'hood' : look.hat ?? style.hat ?? 'none',
    weapon, weaponColor: items[weaponId]?.color || '#bdc5c9', armorColor: items[armorId]?.color || '#abb9bf', race: entity.isekai?.chosen ? entity.isekai.race : 'humano',
  };
}

// Static details merge by material; joints and the interaction body remain separate.
function batchDetails(root, protectedMeshes) {
  const batches = new Map();
  for (const mesh of [...root.children]) {
    if (!mesh.isMesh || protectedMeshes.has(mesh) || mesh.material.transparent) continue;
    let entry = batches.get(mesh.material); if (!entry) batches.set(mesh.material, entry = []);
    entry.push(mesh);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const data = { position: [], normal: [], uv: [] };
    for (const mesh of meshes) {
      mesh.updateMatrix(); const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      for (const key of Object.keys(data)) data[key].push(geometry.getAttribute(key).array);
      geometry.dispose(); mesh.geometry.dispose(); root.remove(mesh);
    }
    const geometry = new THREE.BufferGeometry();
    for (const [key, arrays] of Object.entries(data)) {
      const buffer = new Float32Array(arrays.reduce((sum, array) => sum + array.length, 0)); let offset = 0;
      for (const array of arrays) { buffer.set(array, offset); offset += array.length; }
      geometry.setAttribute(key, new THREE.BufferAttribute(buffer, key === 'uv' ? 2 : 3));
    }
    geometry.computeBoundingSphere(); const batch = new THREE.Mesh(geometry, material);
    batch.userData.roles = meshes.flatMap(mesh => mesh.userData.roles || (mesh.userData.role ? [mesh.userData.role] : [])); root.add(batch);
  }
}

export function createPerson(entity, color, items = {}) {
  const visual = personVisual(entity, color, items), root = new THREE.Group(), limbs = [], details = [];
  root.name = 'vespera-person';
  const cloth = new THREE.MeshStandardMaterial({ color: visual.main, roughness: .91 });
  const skin = new THREE.MeshStandardMaterial({ color: visual.skin, roughness: .85 });
  const hair = new THREE.MeshStandardMaterial({ color: visual.hairColor, roughness: .97 });
  const dark = new THREE.MeshStandardMaterial({ color: '#302d32', roughness: .85 });
  const trim = new THREE.MeshStandardMaterial({ color: visual.accent, roughness: .65, metalness: .15 });
  const steel = new THREE.MeshStandardMaterial({ color: visual.weaponColor, roughness: .48, metalness: .65 });
  const armor = new THREE.MeshStandardMaterial({ color: visual.armorColor, roughness: .58, metalness: .45 });
  const wood = new THREE.MeshStandardMaterial({ color: '#785339', roughness: .94 });
  const part = (geometry, material, x, y, z, detail) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); root.add(mesh);
    if (detail) { details.push(detail); mesh.userData.role = detail; } return mesh;
  };
  const body = part(new THREE.CapsuleGeometry(.22, .43, 5, 12), cloth, 0, .89, 0);
  part(new THREE.CylinderGeometry(.055, .07, .16, 10), skin, 0, 1.21, 0);
  part(new THREE.SphereGeometry(.19, 14, 10), skin, 0, 1.43, 0);
  part(new THREE.SphereGeometry(.035, 8, 6), skin, 0, 1.43, -.182);
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(.03, 8, 6), dark, s * .069, 1.46, -.169);
    const arm = new THREE.Group(); arm.position.set(s * .27, 1.08, 0); arm.userData.walkPhase = s < 0 ? 0 : Math.PI; root.add(arm); limbs.push(arm);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.065, .25, 4, 8), cloth); sleeve.position.y = -.15; arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 6), skin); hand.position.set(0, -.35, 0); arm.add(hand);
    const leg = new THREE.Group(); leg.position.set(s * .11, .66, 0); leg.userData.walkPhase = s < 0 ? Math.PI : 0; root.add(leg); limbs.push(leg);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .44, 4, 8), dark); shin.position.y = -.24; leg.add(shin);
    const boot = new THREE.Mesh(new THREE.SphereGeometry(.092, 10, 6).scale(1, .65, 1.4), dark); boot.position.set(0, -.59, -.035); leg.add(boot);
    const ear = part(new THREE.SphereGeometry(.042, 8, 6), skin, s * .181, 1.43, .015); ear.scale.set(.65, 1, .8);
    if (visual.race === 'elfo') { ear.scale.y = 2.5; ear.rotation.z = -s * .45; }
    if (visual.race === 'fera') part(new THREE.ConeGeometry(.06, .17, 8), hair, s * .11, 1.66, 0, 'beast-ear');
    if (visual.race === 'demonio') part(new THREE.ConeGeometry(.043, .20, 8), dark, s * .12, 1.66, 0, 'horn').rotation.z = -s * .35;
  }
  if (visual.hair !== 'bald' && visual.hair !== 'none') {
    part(new THREE.SphereGeometry(.195, 14, 8, 0, Math.PI * 2, 0, Math.PI * .53), hair, 0, 1.45, .018, 'hair');
    if (['ponytail', 'braids', 'long'].includes(visual.hair)) part(new THREE.CapsuleGeometry(.05, .21, 4, 8), hair, 0, 1.32, .18, 'long-hair');
  }
  if (visual.beard && visual.beard !== 'none') part(new THREE.SphereGeometry(.14, 12, 8).scale(1, visual.beard === 'full' ? .65 : .24, .4), hair, 0, 1.30, -.11, 'beard');
  const robe = ['robe', 'dress', 'gown', 'noble'].includes(visual.outfit);
  if (robe) part(new THREE.CylinderGeometry(.18, .31, .69, 14), cloth, 0, .56, .018, 'robe');
  if (visual.outfit === 'armor') {
    part(new THREE.SphereGeometry(.24, 14, 10).scale(1, 1.18, .76), armor, 0, .96, -.05, 'armor');
    for (const s of [-1, 1]) part(new THREE.SphereGeometry(.095, 10, 6), armor, s * .255, 1.11, 0, 'pauldron');
  }
  if (visual.outfit === 'apron') part(new THREE.BoxGeometry(.31, .51, .024), trim, 0, .72, -.23, 'apron');
  part(new THREE.CylinderGeometry(.225, .225, .042, 14), trim, 0, .74, 0, 'belt');
  if (visual.cape) part(new THREE.CylinderGeometry(.18, .36, .72, 12, 1, true, 0, Math.PI).rotateY(Math.PI / 2), cloth, 0, .77, .13, 'cape');
  switch (visual.hat) {
    case 'helmet': part(new THREE.SphereGeometry(.207, 14, 8, 0, Math.PI * 2, 0, Math.PI * .57), armor, 0, 1.46, 0, 'helmet'); break;
    case 'wizard': part(new THREE.ConeGeometry(.22, .48, 12), cloth, 0, 1.86, 0, 'wizard-hat'); part(new THREE.CylinderGeometry(.29, .29, .018, 16), cloth, 0, 1.64, 0); break;
    case 'hood':
      part(new THREE.SphereGeometry(.216, 14, 10, 0, Math.PI, 0, Math.PI), cloth, 0, 1.43, .025, 'hood');
      part(new THREE.TorusGeometry(.21, .035, 6, 16, Math.PI), cloth, 0, 1.43, -.07, 'hood-rim'); break;
    case 'crown': case 'tiara':
      part(new THREE.CylinderGeometry(.17, .15, visual.hat === 'tiara' ? .06 : .11, 8, 1, true), trim, 0, 1.66, 0, 'crown');
      if (visual.hat === 'crown') for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4; part(new THREE.ConeGeometry(.022, .065, 5), trim, Math.sin(angle) * .16, 1.74, Math.cos(angle) * .16);
      }
      break;
    case 'chef': part(new THREE.CylinderGeometry(.12, .15, .24, 12), trim, 0, 1.73, 0, 'chef-hat'); break;
    case 'cap': case 'feather': case 'bandana': part(new THREE.SphereGeometry(.20, 12, 8, 0, Math.PI * 2, 0, Math.PI * .45), cloth, 0, 1.49, 0, 'cap'); break;
    case 'straw': part(new THREE.CylinderGeometry(.29, .29, .025, 16), wood, 0, 1.65, 0, 'straw-hat'); break;
  }
  if (visual.hat === 'feather') part(new THREE.ConeGeometry(.027, .25, 6), trim, .13, 1.76, .025, 'feather').rotation.z = -.35;
  if (visual.antlers) for (const s of [-1, 1]) part(new THREE.TorusGeometry(.17, .022, 6, 12, Math.PI * .7), wood, s * .14, 1.66, .025, 'antler').rotation.z = -s * .5;
  if (visual.emblem) {
    part(new THREE.BoxGeometry(.045, .15, .02), trim, 0, .99, -.25, 'emblem'); part(new THREE.BoxGeometry(.12, .04, .02), trim, 0, 1.02, -.25);
  }
  if (visual.shoulders) for (const s of [-1, 1]) part(new THREE.SphereGeometry(.12, 10, 8), hair, s * .26, 1.12, .02, 'fur-shoulder');
  if (visual.belt) for (const s of [-1, 1]) part(new THREE.BoxGeometry(.09, .12, .07), wood, s * .20, .69, -.04, 'tool-pouch');
  const wx = .34, wz = -.12;
  const weapon = visual.weapon;
  const weaponStart = root.children.length;
  if (weapon === 'bow') {
    part(new THREE.TorusGeometry(.32, .019, 6, 18, Math.PI).rotateZ(Math.PI / 2), wood, wx, .84, wz, 'bow');
    part(new THREE.CylinderGeometry(.003, .003, .64, 5), trim, wx, .84, wz);
  } else if (weapon === 'lute') {
    part(new THREE.SphereGeometry(.15, 12, 8).scale(.86, 1.2, .45), wood, .23, .80, -.27, 'lute');
    part(new THREE.BoxGeometry(.045, .28, .045), wood, .23, 1.06, -.27);
  } else if (weapon === 'book') {
    part(new THREE.BoxGeometry(.19, .25, .045), wood, wx, .83, wz, 'book');
    part(new THREE.BoxGeometry(.15, .21, .052), trim, wx, .83, wz);
  } else if (weapon === 'basket' || weapon === 'flowers') {
    part(new THREE.CylinderGeometry(.10, .08, .13, 12), wood, wx, .73, wz, weapon);
    part(new THREE.TorusGeometry(.10, .008, 6, 12, Math.PI), wood, wx, .80, wz);
    if (weapon === 'flowers') for (const dx of [-.04, 0, .04]) part(new THREE.SphereGeometry(.035, 8, 6), trim, wx + dx, .88 + Math.abs(dx), wz);
  } else if (['staff', 'spear', 'scythe'].includes(weapon)) {
    part(new THREE.CylinderGeometry(.016, .021, 1.40, 8), wood, wx, .83, wz, weapon);
    if (weapon === 'staff') part(new THREE.IcosahedronGeometry(.09, 1), trim, wx, 1.59, wz);
    if (weapon === 'spear') part(new THREE.ConeGeometry(.055, .21, 8), steel, wx, 1.63, wz);
    if (weapon === 'scythe') part(new THREE.TorusGeometry(.24, .029, 6, 14, Math.PI / 2), steel, wx - .23, 1.47, wz);
  } else if (['sword', 'dagger', 'axe', 'hammer'].includes(weapon)) {
    const length = weapon === 'dagger' ? .25 : .55;
    part(new THREE.CylinderGeometry(.018, .018, .17, 8), wood, wx, .70, wz, weapon);
    if (weapon === 'sword' || weapon === 'dagger') {
      part(new THREE.BoxGeometry(.043, length, .014), steel, wx, .80 + length / 2, wz);
      part(new THREE.BoxGeometry(.14, .024, .027), trim, wx, .79, wz);
    } else part(new THREE.BoxGeometry(weapon === 'axe' ? .23 : .17, .14, .06), steel, wx, .98, wz);
  }
  const weaponArm = limbs[2];
  for (const mesh of root.children.slice(weaponStart)) { mesh.position.sub(weaponArm.position); weaponArm.add(mesh); }
  if (visual.quiver) part(new THREE.CylinderGeometry(.073, .073, .36, 10), wood, -.19, 1.06, .20, 'quiver').rotation.z = -.32;
  if (visual.shield) {
    const shield = part(new THREE.CylinderGeometry(.20, .20, .04, 16).rotateX(Math.PI / 2), trim, -.34, .85, -.10, 'shield');
    shield.position.sub(limbs[0].position); limbs[0].add(shield);
  }
  if (visual.body === 'child') root.scale.setScalar(.68);
  if (visual.body === 'elder') root.scale.y = .93;
  if (visual.race === 'anao') root.scale.set(1.15, .77, 1.12);
  root.userData = { body, limbs, weaponArm, shape: 'humanoid', visual, details };
  batchDetails(limbs[0], new Set()); batchDetails(weaponArm, new Set());
  batchDetails(root, new Set([body, ...limbs]));
  return root;
}
