// Free-roam car physics on a flat map: bicycle steering limited by grip,
// sideways slip that decays (drift), collisions with boxes and other cars.
export const FREE_CAR = { radius: 1.1, wheelBase: 2.6, maxSteer: 0.5, vmax: 30 };

export function newCar(x = 0, z = 0, yaw = 0) { return { x, z, yaw, v: 0, slide: 0, hit: 0 }; }

// boxes: [{ minX, maxX, minZ, maxZ }]
export function stepFreeCar(car, input, dt, { grip = 1, vmax = FREE_CAR.vmax, boxes = [], bound = 200 } = {}) {
  const throttle = input.throttle ?? 0, brake = input.brake ? 1 : 0, steer = Math.max(-1, Math.min(1, input.steer || 0));
  car.steer = (car.steer || 0) + (steer - (car.steer || 0)) * Math.min(1, dt * 10);
  const reverse = input.reverse ? 1 : 0;
  let a = throttle * 9 * (1 - Math.max(0, car.v) / (vmax + 4)) - brake * (car.v > 0 ? 16 : 0) - reverse * 6 - 0.02 * car.v * Math.abs(car.v);
  if (!throttle && !brake && !reverse) a -= Math.sign(car.v) * 1.5;
  car.v = Math.max(-8, Math.min(vmax, car.v + a * dt));
  if (Math.abs(car.v) < 0.05 && !throttle && !reverse) car.v = 0;
  const wanted = car.v * Math.tan(steer * FREE_CAR.maxSteer) / FREE_CAR.wheelBase, limit = grip * 9.81 / Math.max(2, Math.abs(car.v));
  const yawRate = Math.max(-limit, Math.min(limit, wanted));
  // Excess turn becomes sideways slide (drift) that decays with grip.
  car.slide += (wanted - yawRate) * Math.abs(car.v) * 0.04;
  car.slide *= Math.exp(-grip * 3 * dt);
  car.yaw -= yawRate * dt;
  const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);
  car.x += (fx * car.v + rx * car.slide) * dt; car.z += (fz * car.v + rz * car.slide) * dt;
  car.hit = 0;
  const r = FREE_CAR.radius;
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(b.maxX, car.x)), cz = Math.max(b.minZ, Math.min(b.maxZ, car.z));
    const dx = car.x - cx, dz = car.z - cz, d = Math.hypot(dx, dz);
    if (d >= r) continue;
    const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
    car.x = cx + nx * r; car.z = cz + nz * r;
    const into = -(fx * nx + fz * nz) * car.v;
    if (into > 0) { car.hit = Math.max(car.hit, into); car.v *= 1 - Math.min(0.8, 0.25 + into * 0.03); }
    car.slide *= 0.5;
  }
  if (Math.abs(car.x) > bound || Math.abs(car.z) > bound) { car.x = Math.max(-bound, Math.min(bound, car.x)); car.z = Math.max(-bound, Math.min(bound, car.z)); car.v *= 0.5; car.hit = Math.max(car.hit, 3); }
  return car;
}

export function bumpCars(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = FREE_CAR.radius * 2;
  if (d >= min || d < 1e-6) return false;
  const push = (min - d) / 2, nx = dx / d, nz = dz / d;
  a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
  const va = a.v, vb = b.v; a.v = va * 0.7 + vb * 0.3; b.v = vb * 0.7 + va * 0.3;
  return true;
}

// AI driver: steer toward the next waypoint, slow down for sharp turns.
export function aiControl(car, target, skill = 1) {
  const dx = target[0] - car.x, dz = target[1] - car.z;
  const want = Math.atan2(-dx, -dz);
  let err = want - car.yaw; err = Math.atan2(Math.sin(err), Math.cos(err));
  return { steer: Math.max(-1, Math.min(1, -err * 2.2)), throttle: Math.abs(err) > 0.6 && car.v > 12 ? 0 : skill, brake: Math.abs(err) > 0.9 && car.v > 10 };
}
