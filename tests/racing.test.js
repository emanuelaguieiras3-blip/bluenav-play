import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.matchMedia ??= () => ({ matches: false }); globalThis.screen ??= { width: 1920, height: 1080 }; globalThis.window ??= { addEventListener() {} };
const { stepCar, collideCars, CAR } = await import('../src/games/racing.js');

const fresh = (o = {}) => ({ s: 0, lat: 0, v: 0, heading: 0, slip: 0, ...o });

test('car accelerates to a bounded top speed and brakes', () => {
  const car = fresh();
  for (let i = 0; i < 60 * 20; i++) stepCar(car, { steer: 0 }, 1 / 60, { vmax: 40 });
  assert.ok(car.v > 30 && car.v < 45, `top ${car.v}`);
  for (let i = 0; i < 60 * 3; i++) stepCar(car, { steer: 0, brake: true }, 1 / 60);
  assert.equal(car.v, 0);
});

test('grip limits cornering: low grip slides and drifts wider than asphalt', () => {
  const corner = grip => {
    const car = fresh({ v: 30 });
    for (let i = 0; i < 90; i++) stepCar(car, { steer: 1, throttle: 0.5 }, 1 / 60, { curvature: 0.02, grip, half: 50 });
    return car;
  };
  const asphalt = corner(CAR.grip.asphalt), grass = corner(CAR.grip.grass);
  assert.ok(grass.slip > asphalt.slip, `slip ${grass.slip} vs ${asphalt.slip}`);
  assert.ok(grass.lat < asphalt.lat, 'less grip, wider line');
});

test('unsteered car drifts to the outside of a curve and scrapes along the wall', () => {
  const car = fresh({ v: 35 });
  for (let i = 0; i < 240; i++) stepCar(car, { steer: 0, throttle: 0 }, 1 / 60, { curvature: 0.02, half: 5.5 });
  assert.ok(car.lat <= -(5.5 + 2.6) + 0.2, `outside ${car.lat}`);
  assert.ok(car.v < 35);
});

test('cars bump: rear-ender slows down and the front car is pushed', () => {
  const rear = fresh({ s: 0, v: 30 }), front = fresh({ s: 3, v: 20 });
  assert.ok(collideCars(rear, front, 1000));
  assert.ok(rear.v < 30 && front.v > 20);
  assert.ok(front.s - rear.s >= CAR.length - 1e-9);
  const side = fresh({ s: 0, lat: 0 }), other = fresh({ s: 0.5, lat: 1 });
  collideCars(side, other, 1000); assert.ok(other.lat - side.lat >= CAR.width - 1e-9);
  assert.equal(collideCars(fresh({ s: 0 }), fresh({ s: 999 + 3 }), 1000), true, 'wraps around the lap');
});
