import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBody } from '../src/games/universePhysics.js';
import { editCelestialBody } from '../src/games/universeEditing.js';

test('edits change physical values and keep them within simulation limits', () => {
  const sun = makeBody('star', 'u1', { x: 0, y: 0, z: -9 });
  const planet = makeBody('planet', 'u2', { x: 4, y: 0, z: -9 });
  const bodies = [sun, planet];
  assert.equal(editCelestialBody(bodies, 'u2', 'mass-up'), true);
  assert.equal(planet.mass, 11.25);
  assert.equal(editCelestialBody(bodies, 'u2', 'size-up'), true);
  assert.ok(planet.radius > 0.4);
  assert.equal(editCelestialBody(bodies, 'u2', 'orbit'), true);
  assert.ok(Math.hypot(...Object.values(planet.velocity)) > 0);
  assert.equal(editCelestialBody(bodies, 'u2', 'stop'), true);
  assert.deepEqual(planet.velocity, { x: 0, y: 0, z: 0 });
  for (let i = 0; i < 60; i++) editCelestialBody(bodies, 'u2', 'mass-up');
  assert.equal(planet.mass, 2000);
  assert.equal(editCelestialBody(bodies, 'u2', 'invalid'), false);
  assert.equal(editCelestialBody(bodies, 'unknown', 'mass-up'), false);
});
