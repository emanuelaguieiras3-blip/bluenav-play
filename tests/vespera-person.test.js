import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerson, personVisual, CLASS_VISUALS } from '../vespera-rpg2/vr-person.js';
import { disposeActor } from '../vespera-rpg2/vr-actors.js';
import * as THREE from 'three';

test('Véspera: as classes possuem geometria de equipamento, corpo interativo e juntas válidas', () => {
  const signatures = new Set();
  for (const classId of Object.keys(CLASS_VISUALS)) {
    const person = createPerson({ classId, appearance: 'female' }, '#7195b0');
    try {
      person.updateMatrixWorld(true); const details = person.userData.details;
      signatures.add(JSON.stringify([...details].sort()));
      assert.ok(details.includes(CLASS_VISUALS[classId].weapon), classId + ' possui arma ou instrumento tridimensional');
      assert.equal(person.userData.body.parent, person, 'interação usa um corpo presente na cena');
      assert.equal(person.userData.limbs.length, 4);
      assert.equal(person.userData.limbs[0].userData.walkPhase, person.userData.limbs[3].userData.walkPhase);
      let calls = 0;
      person.traverse(object => {
        assert.ok([...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()].every(Number.isFinite));
        if (object.isMesh) {
          calls++;
          assert.equal(object.geometry.attributes.normal.count, object.geometry.attributes.position.count);
          assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));
        }
      });
      assert.ok(calls <= 18, `${classId}: detalhes agrupados, ${calls} meshes`);
    } finally { disposeActor(person); }
  }
  assert.equal(signatures.size, 13, 'as classes não diferem apenas pela cor');
});

test('Véspera: equipamento equipado e visual escolhido têm precedência sobre padrão de classe', () => {
  const entity = { classId: 'mago', look: { skin: '#41302a', main: '#125f4d', hairColor: '#dad3c5', hair: 'short', hat: 'none', outfit: 'tunic', cape: false },
    equipment: { weapon: 'espada-3', armor: 'peitoral-4', head: 'elmo-4' } };
  const items = { 'espada-3': { color: '#cab288' }, 'peitoral-4': { color: '#737b9f' } };
  const visual = personVisual(entity, '#ffffff', items);
  assert.equal(visual.weapon, 'sword'); assert.equal(visual.outfit, 'armor'); assert.equal(visual.hat, 'helmet');
  assert.equal(visual.weaponColor, '#cab288'); assert.equal(visual.armorColor, '#737b9f'); assert.equal(visual.skin, '#41302a');
  entity.equipment = {};
  const custom = personVisual(entity, '#ffffff'); assert.equal(custom.hat, 'none'); assert.equal(custom.outfit, 'tunic');
  const person = createPerson(entity, '#ffffff');
  try { assert.equal(person.userData.body.material.color.getHexString(), '125f4d'); assert.ok(!person.userData.details.includes('wizard-hat')); }
  finally { disposeActor(person); }
});

test('Véspera: raça modifica forma sem modificar o estado da partida', () => {
  for (const race of ['elfo', 'fera', 'anao', 'demonio']) {
    const entity = { classId: 'guerreiro', isekai: { chosen: true, race } }, before = JSON.stringify(entity);
    const person = createPerson(entity, '#7195b0');
    try {
      assert.equal(JSON.stringify(entity), before);
      if (race === 'anao') assert.equal(person.scale.y, .77);
      if (race === 'demonio') assert.ok(person.userData.details.includes('horn'));
      if (race === 'fera') assert.ok(person.userData.details.includes('beast-ear'));
    } finally { disposeActor(person); }
  }
});

test('Véspera: arma acompanha o braço em vez de flutuar durante a caminhada', () => {
  const person = createPerson({ classId: 'guerreiro' }, '#bc7458');
  try {
    const weapon = person.userData.weaponArm.children.find(mesh => (mesh.userData.roles || [mesh.userData.role]).includes('sword'));
    assert.ok(weapon);
    person.updateMatrixWorld(true); const before = new THREE.Box3().setFromObject(weapon).getCenter(new THREE.Vector3());
    person.userData.weaponArm.rotation.x = .4; person.updateMatrixWorld(true);
    const after = new THREE.Box3().setFromObject(weapon).getCenter(new THREE.Vector3());
    assert.ok(before.distanceTo(after) > .02);
    assert.equal(weapon.parent, person.userData.weaponArm);
  } finally { disposeActor(person); }
});

test('Véspera: botas se ligam às pernas e capuz mantém o rosto exposto', () => {
  const person = createPerson({ classId: 'ladino', look: { skin: '#eab893' } }, '#9276a4');
  try {
    person.updateMatrixWorld(true);
    for (const leg of [person.userData.limbs[1], person.userData.limbs[3]]) {
      const shin = new THREE.Box3().setFromObject(leg.children[0]), boot = new THREE.Box3().setFromObject(leg.children[1]);
      assert.ok(shin.min.y <= boot.max.y + .001, 'sem espaço vazio entre perna e bota');
      assert.ok(boot.min.y >= 0, 'bota acima do chão');
    }
    const ray = new THREE.Raycaster(new THREE.Vector3(-.09, 1.38, -2), new THREE.Vector3(0, 0, 1));
    const hit = ray.intersectObject(person, true)[0];
    assert.ok(hit); assert.equal(hit.object.material.color.getHexString(), 'eab893', 'capuz não cobre metade do rosto');
  } finally { disposeActor(person); }
});
