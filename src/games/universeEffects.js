import { std, glowTexture, Particles } from './common.js';
import { BODY_TYPES, GRAVITY, habitableZone, kindOf } from './universePhysics.js';
import { destroy, bodyName } from './universeVisuals.js';

const HOT = [[1, 0.97, 0.92], [0.8, 0.88, 1]], COLD = [[1, 0.5, 0.14], [0.78, 0.16, 0.05]];

// Tidal stream + accretion disk around one black hole, from a fixed particle pool.
class AccretionDisk {
  constructor(THREE, parent, max) {
    this.THREE = THREE; this.max = max;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4);
    this.mode = new Uint8Array(max); this.r = new Float32Array(max); this.theta = new Float32Array(max);
    this.h = new Float32Array(max); this.t = new Float32Array(max); this.start = new Float32Array(max * 3);
    this.r0 = new Float32Array(max); this.next = 0;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.09, map: glowTexture(), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false; this.points.name = 'universe-accretion'; parent.add(this.points);
    this.normal = new THREE.Vector3(0, 1, 0); this.u = new THREE.Vector3(1, 0, 0); this.w = new THREE.Vector3(0, 0, 1);
    this.tmp = new THREE.Vector3(); this.alive = 0;
  }
  orient(hole, star) {
    const rx = star.position.x - hole.position.x, ry = star.position.y - hole.position.y, rz = star.position.z - hole.position.z;
    const vx = star.velocity.x - hole.velocity.x, vy = star.velocity.y - hole.velocity.y, vz = star.velocity.z - hole.velocity.z;
    this.normal.set(ry * vz - rz * vy, rz * vx - rx * vz, rx * vy - ry * vx);
    if (this.normal.lengthSq() < 1e-6) this.normal.set(0, 1, 0);
    this.normal.normalize();
    this.u.set(1, 0, 0); if (Math.abs(this.normal.x) > 0.9) this.u.set(0, 0, 1);
    this.u.cross(this.normal).normalize(); this.w.copy(this.normal).cross(this.u).normalize();
  }
  feed(hole, star, count) {
    if (!this.alive) this.orient(hole, star);
    const dx = hole.position.x - star.position.x, dy = hole.position.y - star.position.y, dz = hole.position.z - star.position.z;
    const distance = Math.hypot(dx, dy, dz) || 1;
    for (let n = 0; n < count; n++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      const jitter = star.radius * 0.6;
      this.start[i * 3] = star.position.x + dx / distance * star.radius * 0.8 + (Math.random() - 0.5) * jitter;
      this.start[i * 3 + 1] = star.position.y + dy / distance * star.radius * 0.8 + (Math.random() - 0.5) * jitter;
      this.start[i * 3 + 2] = star.position.z + dz / distance * star.radius * 0.8 + (Math.random() - 0.5) * jitter;
      this.mode[i] = 1; this.t[i] = 0;
      this.r0[i] = Math.max(hole.radius * 1.9, Math.min(3.6, distance * 0.55)) * (0.85 + Math.random() * 0.3);
      this.tmp.set(-dx, -dy, -dz);
      this.theta[i] = Math.atan2(this.tmp.dot(this.w), this.tmp.dot(this.u)) + 1.4 + Math.random() * 0.5;
      this.h[i] = (Math.random() - 0.5) * 0.12;
    }
  }
  update(dt, hole, power) {
    const hx = hole.position.x, hy = hole.position.y, hz = hole.position.z, inner = hole.radius * 1.2, outer = Math.max(inner + 0.1, 3.6);
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      const c = i * 4, p = i * 3;
      if (!this.mode[i]) { this.col[c + 3] = 0; continue; }
      alive++;
      if (this.mode[i] === 1) {
        this.t[i] += dt * 0.75;
        const t = Math.min(1, this.t[i]), r = this.r0[i], a = this.theta[i];
        const ex = hx + (this.u.x * Math.cos(a) + this.w.x * Math.sin(a)) * r;
        const ey = hy + (this.u.y * Math.cos(a) + this.w.y * Math.sin(a)) * r;
        const ez = hz + (this.u.z * Math.cos(a) + this.w.z * Math.sin(a)) * r;
        const bend = Math.sin(t * Math.PI) * 0.35;
        this.pos[p] = this.start[p] + (ex - this.start[p]) * t + this.normal.x * bend * this.h[i] * 8;
        this.pos[p + 1] = this.start[p + 1] + (ey - this.start[p + 1]) * t + this.normal.y * bend * this.h[i] * 8;
        this.pos[p + 2] = this.start[p + 2] + (ez - this.start[p + 2]) * t + this.normal.z * bend * this.h[i] * 8;
        this.col[c] = 1; this.col[c + 1] = 0.55 + t * 0.2; this.col[c + 2] = 0.25 + t * 0.15; this.col[c + 3] = 0.6;
        if (this.t[i] >= 1) { this.mode[i] = 2; this.r[i] = r; }
        continue;
      }
      const r = this.r[i] -= dt * 0.11 * (1 + 1 / Math.max(this.r[i], 0.2));
      if (r < inner) { this.mode[i] = 0; this.col[c + 3] = 0; continue; }
      const a = this.theta[i] += dt * 2.4 / Math.pow(Math.max(r, 0.2), 1.5);
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r, h = this.h[i] * r * 0.3;
      this.pos[p] = hx + this.u.x * ca + this.w.x * sa + this.normal.x * h;
      this.pos[p + 1] = hy + this.u.y * ca + this.w.y * sa + this.normal.y * h;
      this.pos[p + 2] = hz + this.u.z * ca + this.w.z * sa + this.normal.z * h;
      const k = Math.max(0, Math.min(1, (r - inner) / (outer - inner)));
      const hot = HOT[i & 1], cold = COLD[i & 1];
      this.col[c] = hot[0] + (cold[0] - hot[0]) * k; this.col[c + 1] = hot[1] + (cold[1] - hot[1]) * k; this.col[c + 2] = hot[2] + (cold[2] - hot[2]) * k;
      this.col[c + 3] = Math.min(0.75, 0.32 + power * 0.5) * (1 - k * 0.3);
    }
    this.alive = alive;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
  dispose() { destroy(this.points); }
}

export class UniverseEffects {
  constructor(ctx, root, { body, visual, status, audio }) {
    const { THREE } = ctx;
    this.ctx = ctx; this.THREE = THREE; this.root = root; this.body = body; this.visual = visual; this.status = status; this.audio = audio;
    this.impacts = []; this.tides = new Map(); this.disks = new Map(); this.jets = new Map(); this.flashes = []; this.shells = [];
    this.options = { jets: true, lensing: !ctx.lowEnd };
    this.sparks = new Particles(root, { max: ctx.lowEnd ? 260 : 900, size: 0.16, blending: THREE.AdditiveBlending });
    this.sparks.points.name = 'universe-sparks';
    this.diskSize = ctx.lowEnd ? 220 : 650;
    this.v = new THREE.Vector3(); this.v2 = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.z = new THREE.Vector3(0, 0, 1);
  }

  // Shock wave, crater and debris where a small body hit a larger one.
  impact(event, { debris = this.ctx.lowEnd ? 8 : 18, lava = false } = {}) {
    const { THREE } = this, target = this.body(event.targetId);
    if (!target) return;
    const group = new THREE.Group(); this.root.add(group);
    if (this.impacts.length >= 8) { destroy(this.impacts[0].group); this.impacts.shift(); }
    const wave = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0.75 } }, transparent: true, depthWrite: false, side: THREE.FrontSide, toneMapped: false,
      blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
      fragmentShader: 'uniform float opacity; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),1.5); gl_FragColor=vec4(1.0,0.28,0.04,rim*opacity);}',
    }));
    wave.position.set(target.position.x, target.position.y, target.position.z); group.add(wave);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 7, 48), new THREE.MeshBasicMaterial({ color: '#ffcc8e', transparent: true, opacity: 0.9, depthWrite: false }));
    ring.position.set(event.point.x, event.point.y, event.point.z);
    const normal = new THREE.Vector3(event.direction.x, event.direction.y, event.direction.z).normalize();
    ring.quaternion.setFromUnitVectors(this.z, normal); group.add(ring);
    const targetVisual = this.visual(target.id);
    const localNormal = targetVisual ? normal.clone().applyQuaternion(targetVisual.group.quaternion.clone().invert()) : normal.clone();
    const kind = kindOf(target);
    if (targetVisual && (kind === 'planet' || kind === 'moon')) {
      const spec = BODY_TYPES[target.type];
      const crater = new THREE.Mesh(new THREE.CircleGeometry(0.07 + Math.min(0.05, event.speed * 0.01), 24),
        new THREE.MeshBasicMaterial({ color: lava ? '#ff7a2a' : '#261c1b', side: THREE.DoubleSide, depthWrite: false }));
      crater.position.copy(localNormal).multiplyScalar(spec.radius * 1.018);
      crater.quaternion.setFromUnitVectors(this.z, localNormal);
      targetVisual.group.add(crater);
      if (lava && targetVisual.group.userData.heat) targetVisual.group.userData.lava = 8;
    }
    const pieces = [];
    const point = new THREE.Vector3(event.point.x, event.point.y, event.point.z);
    const tangent = this.up.clone().cross(normal).normalize();
    if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
    const bitangent = normal.clone().cross(tangent).normalize();
    for (let i = 0; i < debris; i++) {
      const angle = i * 2.399, direction = normal.clone().multiplyScalar(0.5).addScaledVector(tangent, Math.cos(angle)).addScaledVector(bitangent, Math.sin(angle)).normalize();
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025 + (i % 3) * 0.012, 0), std({ color: lava && i % 3 === 0 ? '#ff8a3a' : i % 2 ? '#e8c8a6' : '#8a7466', roughness: 1 }));
      mesh.position.copy(point); group.add(mesh);
      pieces.push({ mesh, velocity: direction.multiplyScalar(0.7 + event.speed * 0.32), life: lava ? 3 : 1.8 });
    }
    this.impacts.push({ group, ring, wave, debris: pieces, impactNormal: localNormal.clone(), age: 0, targetId: target.id, life: lava ? 3 : 1.8 });
    this.audio?.thud?.();
  }

  collision(event) {
    this.impact(event, { debris: this.ctx.lowEnd ? 12 : 30, lava: true });
    this.flash(event.point, '#ffb070', 3 + Math.min(4, event.speed));
  }

  flash(position, color = '#ffffff', size = 6, life = 1.2) {
    const { THREE } = this;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.position.set(position.x, position.y, position.z); sprite.scale.setScalar(0.1); sprite.name = 'universe-flash';
    this.root.add(sprite); this.flashes.push({ sprite, size, life, age: 0 });
    if (this.flashes.length > 10) { const old = this.flashes.shift(); destroy(old.sprite); }
  }

  shockShell(position, reach, color = '#ffb36b', life = 3) {
    const { THREE } = this;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0.9 }, tint: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
      fragmentShader: 'uniform float opacity; uniform vec3 tint; varying vec3 vN; varying vec3 vV; void main(){float rim=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.0); gl_FragColor=vec4(tint,rim*opacity);}',
    }));
    shell.position.set(position.x, position.y, position.z); shell.name = 'universe-shock'; this.root.add(shell);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.position.copy(shell.position); ring.rotation.x = Math.PI / 2; this.root.add(ring);
    this.shells.push({ shell, ring, reach, life, age: 0 });
  }

  burst(position, count, speed, colors, life = 6, drag = 0.25) {
    for (let i = 0; i < count; i++) {
      const y = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - y * y), s = speed * (0.4 + Math.random() * 0.6);
      this.sparks.spawn(position, { x: Math.cos(a) * r * s, y: y * s, z: Math.sin(a) * r * s }, { life: life * (0.6 + Math.random() * 0.4), drag, color: [...colors[i % colors.length], 1] });
    }
  }

  supernova(event) {
    const scale = this.ctx.lowEnd ? 0.35 : 1;
    this.flash(event.position, '#ffffff', 22, 1.6);
    this.flash(event.position, '#ffb36b', 12, 3);
    this.shockShell(event.position, event.reach * 0.75, '#ffcf8a', 3.5);
    this.burst(event.position, Math.round(420 * scale), 5.5, [[1, 0.62, 0.3], [0.55, 0.72, 1], [1, 0.35, 0.62], [1, 0.9, 0.7]], 7);
    this.status(`Supernova! Restou ${event.remnantType === 'blackhole' ? 'um buraco negro' : 'uma estrela de nêutrons'}.`, 6);
    this.audio?.thud?.();
  }

  nebula(event) {
    this.flash(event.position, '#9ff6ff', 6, 2);
    this.burst(event.position, this.ctx.lowEnd ? 90 : 260, 1.4, [[0.4, 0.95, 0.9], [1, 0.45, 0.7], [0.6, 0.6, 1]], 10, 0.15);
    this.status('A gigante vermelha soltou uma nebulosa planetária e virou anã branca.', 6);
  }

  // Matter streams from star to hole; the disk keeps glowing a while after.
  tidal(event) {
    const hole = this.body(event.holeId), star = this.body(event.starId);
    if (!hole || !star) return;
    let disk = this.disks.get(hole.id);
    if (!disk) { disk = new AccretionDisk(this.THREE, this.root, this.diskSize); this.disks.set(hole.id, disk); }
    disk.feed(hole, star, Math.max(1, Math.round((event.proximity || 0.3) * (this.ctx.lowEnd ? 3 : 7))));
    const key = `${event.starId}:${event.holeId}`;
    let record = this.tides.get(key);
    if (!record) {
      if (this.tides.size >= 4) return;
      const lines = Array.from({ length: 3 }, () => {
        const geometry = new this.THREE.BufferGeometry();
        geometry.setAttribute('position', new this.THREE.BufferAttribute(new Float32Array(32 * 3), 3).setUsage(this.THREE.DynamicDrawUsage));
        const line = new this.THREE.Line(geometry, new this.THREE.LineBasicMaterial({ color: '#ffb55c', transparent: true, opacity: 0.83, depthWrite: false }));
        line.frustumCulled = false; this.root.add(line); return line;
      });
      record = { holeId: event.holeId, starId: event.starId, lines, expires: 0 }; this.tides.set(key, record);
      this.status('Maré gravitacional: a estrela está sendo despedaçada pelo buraco negro.');
    }
    record.expires = 0.4;
  }

  consume(event) {
    if (kindOf({ type: event.sourceType }) === 'star' || event.mass > 50) {
      this.flash(event.position, '#ffe3b0', 9, 1.4);
      this.shockShell(event.position, 6, '#ffd7a0', 2);
      this.status('A estrela cruzou o horizonte de eventos!', 5);
    } else this.status('Buraco negro absorveu um corpo.');
  }

  disrupt(event) {
    this.flash(event.position, '#ffd2a0', 7, 1.5);
    this.status('Estrela despedaçada pelo buraco negro!', 6);
  }

  stellarMerge(event) {
    this.flash(event.position, '#fff1c8', 10, 1.6);
    this.shockShell(event.position, 5, '#ffe6b0', 2);
    this.status('Duas estrelas se fundiram numa estrela maior.');
  }

  roche(event) {
    const planet = this.body(event.planetId);
    if (planet) this.ensureRing(planet, true);
    this.status('Limite de Roche: a lua se desfez num anel de detritos.', 6);
  }

  ensureRing(planet, fresh = false) {
    const visual = this.visual(planet.id);
    if (!visual || visual.group.userData.debrisRing) return;
    const { THREE } = this, spec = BODY_TYPES[planet.type], count = this.ctx.lowEnd ? 90 : 220;
    const inner = spec.radius * 1.35, outer = spec.radius * 2.4, positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = i * 2.399963 + Math.random() * 0.2, r = inner + Math.random() * (outer - inner);
      positions.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.03, Math.sin(a) * r], i * 3);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const ring = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#d8cbb8', size: 0.035, transparent: true, opacity: fresh ? 0 : 0.9, depthWrite: false }));
    ring.name = 'universe-roche-ring'; ring.rotation.x = 0.25;
    visual.group.add(ring); visual.group.userData.debrisRing = ring;
  }

  jetFor(hole) {
    let jet = this.jets.get(hole.id);
    if (jet) return jet;
    const { THREE } = this, group = new THREE.Group(); group.name = 'universe-jets';
    for (const side of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 7, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#a9d4ff', transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.geometry.translate(0, -3.5, 0); cone.rotation.z = side > 0 ? Math.PI : 0; group.add(cone);
    }
    this.root.add(group); jet = { group }; this.jets.set(hole.id, jet);
    return jet;
  }

  update(dt, bodies, time) {
    const { THREE } = this;
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const effect = this.impacts[i], target = this.body(effect.targetId);
      effect.age += dt;
      effect.ring.scale.setScalar(Math.min(target?.radius * 0.65 || 0.3, 0.02 + effect.age * 0.8));
      effect.ring.material.opacity = Math.max(0, 0.9 * (1 - effect.age / 1.7));
      if (target) {
        effect.wave.position.set(target.position.x, target.position.y, target.position.z);
        const visual = this.visual(target.id);
        const surfaceNormal = visual ? this.v.copy(effect.impactNormal).applyQuaternion(visual.group.quaternion) : this.v.copy(effect.impactNormal);
        effect.ring.position.set(target.position.x, target.position.y, target.position.z).addScaledVector(surfaceNormal, target.radius);
        effect.ring.quaternion.setFromUnitVectors(this.z, surfaceNormal);
      }
      effect.wave.scale.setScalar((target?.radius || 0.4) + effect.age * 0.75);
      effect.wave.material.uniforms.opacity.value = Math.max(0, 0.8 * (1 - effect.age / 1.5));
      for (const debris of effect.debris) {
        if (debris.life <= 0) continue;
        debris.life -= dt;
        if (target) {
          const gravity = this.v2.set(target.position.x, target.position.y, target.position.z).sub(debris.mesh.position);
          const distance = Math.max(0.18, gravity.length());
          debris.velocity.addScaledVector(gravity.normalize(), Math.min(5, GRAVITY * target.mass / (distance * distance)) * dt);
        }
        debris.mesh.position.addScaledVector(debris.velocity, dt);
        debris.mesh.rotation.x += dt * 3; debris.mesh.rotation.y += dt * 4;
        if (target && debris.mesh.position.distanceTo(this.v2.set(target.position.x, target.position.y, target.position.z)) < target.radius * 0.8) debris.life = 0;
        debris.mesh.visible = debris.life > 0;
      }
      if (effect.age > effect.life) { destroy(effect.group); this.impacts.splice(i, 1); }
    }
    for (const [key, record] of this.tides) {
      const hole = this.body(record.holeId), star = this.body(record.starId);
      record.expires -= dt;
      if (!hole || !star || record.expires <= 0) { for (const line of record.lines) destroy(line); this.tides.delete(key); continue; }
      const a = new THREE.Vector3(star.position.x, star.position.y, star.position.z), b = new THREE.Vector3(hole.position.x, hole.position.y, hole.position.z);
      const direction = b.clone().sub(a).normalize(), side = this.up.clone().cross(direction).normalize();
      if (side.lengthSq() < 0.01) side.set(1, 0, 0);
      const up = direction.clone().cross(side).normalize();
      record.lines.forEach((line, lane) => {
        const attr = line.geometry.attributes.position;
        for (let i = 0; i < 32; i++) {
          const t = i / 31, spiral = t * Math.PI * 4 + time * 5 + lane * Math.PI * 2 / 3, spread = (1 - t) * 0.28 + 0.03;
          const point = this.v.copy(a).lerp(b, t).addScaledVector(side, Math.cos(spiral) * spread).addScaledVector(up, Math.sin(spiral) * spread);
          attr.setXYZ(i, point.x, point.y, point.z);
        }
        attr.needsUpdate = true;
      });
    }
    for (const [id, disk] of this.disks) {
      const hole = this.body(id);
      if (!hole) { disk.dispose(); this.disks.delete(id); continue; }
      disk.update(dt, hole, Math.min(1, (hole.accretion || 0) / 80));
    }
    for (const body of bodies) {
      if (kindOf(body) !== 'blackhole') continue;
      const visual = this.visual(body.id), power = Math.min(1, (body.accretion || 0) / 80);
      if (visual?.group.userData.disk) visual.group.userData.disk.material.uniforms.power.value = 0.35 + power;
      if (visual?.group.userData.halo) visual.group.userData.halo.visible = this.options.lensing;
      const strength = this.options.jets ? Math.max(0, Math.min(0.55, ((body.accretion || 0) - 25) / 120)) : 0;
      if (!strength && !this.jets.has(body.id)) continue;
      const jet = this.jetFor(body), disk = this.disks.get(body.id);
      jet.group.position.set(body.position.x, body.position.y, body.position.z);
      if (disk) jet.group.quaternion.setFromUnitVectors(this.up, disk.normal);
      jet.group.scale.setScalar(Math.max(0.6, body.radius / 0.46));
      for (const cone of jet.group.children) cone.material.opacity = strength * (0.75 + Math.sin(time * 14) * 0.25);
      jet.group.visible = strength > 0.01;
    }
    for (const [id, jet] of this.jets) if (!this.body(id)) { destroy(jet.group); this.jets.delete(id); }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const flash = this.flashes[i]; flash.age += dt;
      const t = flash.age / flash.life;
      flash.sprite.scale.setScalar(flash.size * Math.min(1, t * 5));
      flash.sprite.material.opacity = Math.max(0, 1 - t);
      if (t >= 1) { destroy(flash.sprite); this.flashes.splice(i, 1); }
    }
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shell = this.shells[i]; shell.age += dt;
      const t = shell.age / shell.life, radius = 0.3 + shell.reach * (1 - (1 - t) ** 2);
      shell.shell.scale.setScalar(radius); shell.ring.scale.setScalar(radius);
      shell.shell.material.uniforms.opacity.value = Math.max(0, 0.9 * (1 - t));
      shell.ring.material.opacity = Math.max(0, 0.8 * (1 - t));
      if (t >= 1) { destroy(shell.shell); destroy(shell.ring); this.shells.splice(i, 1); }
    }
    this.sparks.update(dt);
    for (const body of bodies) {
      const visual = this.visual(body.id);
      const ring = visual?.group.userData.debrisRing;
      if (body.ring && visual && !ring) this.ensureRing(body);
      if (ring) { ring.rotation.y += dt * 0.5; ring.material.opacity = Math.min(0.9, ring.material.opacity + dt * 0.6); }
    }
  }

  clear() {
    for (const effect of this.impacts) destroy(effect.group);
    for (const record of this.tides.values()) for (const line of record.lines) destroy(line);
    for (const disk of this.disks.values()) disk.dispose();
    for (const jet of this.jets.values()) destroy(jet.group);
    for (const flash of this.flashes) destroy(flash.sprite);
    for (const shell of this.shells) { destroy(shell.shell); destroy(shell.ring); }
    this.impacts.length = 0; this.tides.clear(); this.disks.clear(); this.jets.clear(); this.flashes.length = 0; this.shells.length = 0;
    this.sparks.life.fill(0);
  }
}

// Optional overlays: habitable zones, gravity well grid, name labels and velocity arrows.
export class UniverseOverlays {
  constructor(ctx, root, maxBodies) {
    const { THREE } = ctx;
    this.ctx = ctx; this.THREE = THREE; this.root = root;
    this.show = { habitable: false, grid: false, labels: false, vectors: false };
    this.zones = new Map(); this.labels = new Map(); this.gridClock = 0;
    const lines = ctx.lowEnd ? 24 : 40, spacing = 1.5;
    this.grid = { lines, spacing, center: new THREE.Vector3(), y: 1.5 };
    const segments = (lines + 1) * lines * 2;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.gridMesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#4f8fd8', transparent: true, opacity: 0.42, depthWrite: false }));
    this.gridMesh.name = 'universe-gravity-grid'; this.gridMesh.frustumCulled = false; this.gridMesh.visible = false; root.add(this.gridMesh);
    const vectorGeometry = new THREE.BufferGeometry();
    vectorGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxBodies * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.vectors = new THREE.LineSegments(vectorGeometry, new THREE.LineBasicMaterial({ color: '#7dffb2', transparent: true, opacity: 0.85, depthWrite: false }));
    this.vectors.name = 'universe-velocity'; this.vectors.frustumCulled = false; this.vectors.visible = false; root.add(this.vectors);
  }

  updateGrid(bodies, eye) {
    const { lines, spacing } = this.grid, half = lines * spacing / 2;
    let mass = 0, y = 0;
    for (const body of bodies) { mass += body.mass; y += body.position.y * body.mass; }
    const cy = mass ? y / mass - 0.6 : 0.9;
    const cx = Math.round((eye?.x || 0) / spacing) * spacing, cz = Math.round((eye?.z || 0) / spacing) * spacing;
    const depth = (x, z) => {
      let d = 0;
      for (const body of bodies) {
        const dx = x - body.position.x, dz = z - body.position.z;
        d += body.mass * (kindOf(body) === 'whitehole' ? -1 : 1) / Math.sqrt(dx * dx + dz * dz + (body.radius + 0.5) ** 2);
      }
      return cy - Math.max(-2, Math.min(6, d * 0.004));
    };
    const attr = this.gridMesh.geometry.attributes.position, heights = new Float32Array((lines + 1) * (lines + 1));
    for (let i = 0; i <= lines; i++) for (let j = 0; j <= lines; j++) heights[i * (lines + 1) + j] = depth(cx - half + j * spacing, cz - half + i * spacing);
    let n = 0;
    const put = (i, j) => { attr.setXYZ(n++, cx - half + j * spacing, heights[i * (lines + 1) + j], cz - half + i * spacing); };
    for (let i = 0; i <= lines; i++) for (let j = 0; j < lines; j++) { put(i, j); put(i, j + 1); put(j, i); put(j + 1, i); }
    attr.needsUpdate = true;
  }

  update(dt, bodies, eye, cameraQuaternion) {
    const { THREE } = this;
    this.gridMesh.visible = this.show.grid;
    if (this.show.grid && (this.gridClock -= dt) <= 0) { this.gridClock = 0.12; this.updateGrid(bodies, eye); }
    this.vectors.visible = this.show.vectors;
    if (this.show.vectors) {
      const attr = this.vectors.geometry.attributes.position;
      bodies.forEach((body, i) => {
        if (i * 2 + 1 >= attr.count) return;
        attr.setXYZ(i * 2, body.position.x, body.position.y, body.position.z);
        attr.setXYZ(i * 2 + 1, body.position.x + body.velocity.x * 1.2, body.position.y + body.velocity.y * 1.2, body.position.z + body.velocity.z * 1.2);
      });
      attr.needsUpdate = true; this.vectors.geometry.setDrawRange(0, bodies.length * 2);
    }
    const stars = this.show.habitable ? bodies.filter(body => kindOf(body) === 'star' && !BODY_TYPES[body.type].compact) : [];
    for (const [id, zone] of this.zones) if (!stars.some(star => star.id === id)) { destroy(zone); this.zones.delete(id); }
    for (const star of stars) {
      let zone = this.zones.get(star.id);
      if (!zone) {
        zone = new THREE.Mesh(new THREE.RingGeometry(1, 1.4 / 0.95, 96, 1), new THREE.MeshBasicMaterial({ color: '#4dff88', transparent: true, opacity: 0.13,
          side: THREE.DoubleSide, depthWrite: false }));
        zone.rotation.x = -Math.PI / 2; zone.name = 'universe-habitable'; this.root.add(zone); this.zones.set(star.id, zone);
      }
      zone.position.set(star.position.x, star.position.y, star.position.z);
      zone.scale.setScalar(Math.max(0.01, habitableZone(star).inner));
    }
    const shown = this.show.labels ? bodies : [];
    for (const [id, label] of this.labels) if (!shown.some(body => body.id === id)) { destroy(label); this.labels.delete(id); }
    for (const body of shown) {
      let label = this.labels.get(body.id);
      if (!label) {
        label = this.ctx.label(bodyName(body), { w: 0.9, h: 0.16, size: 0.42, bg: 'rgba(5,16,35,.72)' });
        label.name = 'universe-label'; this.root.add(label); this.labels.set(body.id, label);
      }
      label.userData.set?.(bodyName(body));
      const distance = eye ? Math.hypot(eye.x - body.position.x, eye.y - body.position.y, eye.z - body.position.z) : 6;
      const scale = Math.max(0.5, Math.min(6, distance * 0.09));
      label.position.set(body.position.x, body.position.y + body.radius + 0.16 * scale, body.position.z);
      label.scale.setScalar(scale);
      if (cameraQuaternion) label.quaternion.copy(cameraQuaternion);
    }
  }

  dispose() {
    for (const zone of this.zones.values()) destroy(zone);
    for (const label of this.labels.values()) destroy(label);
    this.zones.clear(); this.labels.clear();
  }
}

