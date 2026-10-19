import * as THREE from 'three';

export const TABLE = Object.freeze({ width: 1.525, height: .76, near: -.65, far: -3.39, net: -2.02, netHeight: .1525, radius: .02 });

// Swept sphere against a moving disc, in the paddle's relative frame.
export function paddleContact(from, to, paddle, radius = TABLE.radius) {
  const normal = paddle.normal.clone().normalize();
  if (normal.lengthSq() < .5) return null;
  const a = from.clone().sub(paddle.previous), b = to.clone().sub(paddle.position);
  const da = a.dot(normal), db = b.dot(normal), thickness = radius + .008;
  if (da > thickness && db > thickness || da < -thickness && db < -thickness) return null;
  const travel = da - db;
  if (Math.abs(travel) < 1e-8) return null;
  const face = da >= 0 ? thickness : -thickness;
  const t = THREE.MathUtils.clamp((da - face) / travel, 0, 1);
  const relative = a.lerp(b, t); relative.addScaledVector(normal, -relative.dot(normal));
  if (relative.length() > (paddle.radius ?? .095) + radius) return null;
  return { t, normal: normal.multiplyScalar(da >= 0 ? 1 : -1) };
}

export function createPingPongMatch() {
  const position = new THREE.Vector3(), velocity = new THREE.Vector3();
  const score = [0, 0];
  let phase = 'ready', server = 1, lastHit = 1, expected = 1, bounces = 0, serving = false, cooldown = 0;
  let winner = null, message = 'Escolha Sacar para começar', rally = 0, bestRally = 0;
  const sideAt = z => z > TABLE.net ? 0 : 1;
  function point(side, reason) {
    score[side]++; bestRally = Math.max(bestRally, rally); phase = 'point';
    message = reason; velocity.set(0, 0, 0);
    const total = score[0] + score[1];
    server = total >= 20 ? (1 + total - 20) % 2 : (1 + Math.floor(total / 2)) % 2;
    if (score[side] >= 11 && Math.abs(score[0] - score[1]) >= 2) { winner = side; phase = 'finished'; }
  }
  function serve() {
    if (phase === 'playing' || phase === 'finished') return false;
    lastHit = expected = server; bounces = 0; serving = true; rally = 0; cooldown = 0;
    position.set(0, 1.16, server === 0 ? -.79 : -3.25);
    velocity.set(0, .35, server === 0 ? -2.8 : 2.8); phase = 'playing'; message = 'Saque'; return true;
  }
  function step(dt, paddles = []) {
    if (phase !== 'playing') return [];
    const events = [], duration = Math.min(.05, Math.max(0, dt));
    const steps = Math.max(1, Math.ceil(duration * 240)), h = duration / steps;
    for (let i = 0; i < steps && phase === 'playing'; i++) {
      cooldown = Math.max(0, cooldown - h);
      const old = position.clone(); velocity.y -= 9.81 * h; position.addScaledVector(velocity, h);
      if (!cooldown) for (const paddle of paddles) {
        if (!paddle.active) continue;
        const previous = paddle.previous.clone().lerp(paddle.position, i / steps);
        const next = paddle.previous.clone().lerp(paddle.position, (i + 1) / steps);
        const hit = paddleContact(old, position, { ...paddle, previous, position: next });
        if (!hit) continue;
        const speed = paddle.velocity?.clone().clampLength(0, 8) ?? new THREE.Vector3();
        const relative = velocity.clone().sub(speed), incoming = relative.dot(hit.normal);
        if (incoming >= 0) continue;
        if (serving || paddle.side !== expected || bounces !== 1) { point(1 - paddle.side, 'Devolução antes do quique'); break; }
        relative.addScaledVector(hit.normal, -1.78 * incoming); velocity.copy(relative).add(speed);
        velocity.clampLength(0, 12);
        position.copy(old).lerp(position, hit.t).addScaledVector(hit.normal, .004);
        lastHit = paddle.side; expected = 1 - paddle.side; bounces = 0; rally++; cooldown = .07;
        message = 'Troca de bola'; events.push('paddle'); break;
      }
      if (phase !== 'playing') break;
      if ((old.z - TABLE.net) * (position.z - TABLE.net) <= 0 && old.z !== position.z) {
        const t = (TABLE.net - old.z) / (position.z - old.z), y = THREE.MathUtils.lerp(old.y, position.y, t);
        const x = THREE.MathUtils.lerp(old.x, position.x, t);
        if (Math.abs(x) <= TABLE.width / 2 + .02 && y <= TABLE.height + TABLE.netHeight + TABLE.radius && y >= TABLE.height - TABLE.radius) {
          if (serving) { phase = 'ready'; message = 'Rede no saque: repita'; velocity.set(0, 0, 0); }
          else point(1 - lastHit, 'Bola na rede');
          events.push('net'); break;
        }
      }
      const surface = TABLE.height + TABLE.radius;
      if (old.y >= surface && position.y < surface && velocity.y < 0) {
        const t = (old.y - surface) / (old.y - position.y), x = THREE.MathUtils.lerp(old.x, position.x, t), z = THREE.MathUtils.lerp(old.z, position.z, t);
        if (Math.abs(x) <= TABLE.width / 2 + TABLE.radius && z >= TABLE.far && z <= TABLE.near) {
          const side = sideAt(z);
          if (side !== expected) { point(1 - lastHit, 'Bola fora da metade adversária'); break; }
          if (serving) { serving = false; expected = 1 - server; bounces = 0; }
          else if (++bounces > 1) { point(1 - side, 'Dois quiques'); break; }
          position.y = surface + (surface - position.y) * .88; velocity.y = -velocity.y * .88;
          velocity.x *= .98; velocity.z *= .98; events.push('table');
        }
      }
      if (position.y < TABLE.radius || Math.abs(position.x) > 4 || position.z < -5 || position.z > 1.5) {
        point(bounces === 1 ? lastHit : 1 - lastHit, 'Bola fora'); events.push('point');
      }
    }
    return events;
  }
  return { position, velocity, score, serve, step,
    getState: () => ({ phase, server, expected, bounces, serving, winner, message, rally, bestRally, score: [...score] }),
    reset() { score.fill(0); phase = 'ready'; winner = null; server = 1; rally = bestRally = 0; message = 'Nova partida'; velocity.set(0, 0, 0); },
  };
}
