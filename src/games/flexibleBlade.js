import * as THREE from 'three';

// Small, bounded elastic bend. Collision samples use the rendered centerline.
export class FlexibleBlade {
  constructor(length = 0.85, segments = 8) {
    this.length = length; this.segments = segments;
    this.local = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
    this.world = this.local.map(() => new THREE.Vector3()); this.previous = this.local.map(() => new THREE.Vector3());
    this.bend = new THREE.Vector2(); this.velocity = new THREE.Vector2(); this.targetTip = null;
    this.inverse = new THREE.Quaternion(); this.delta = new THREE.Vector3();
    this.geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array((segments + 1) * 9 * 3), indices = [];
    this.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage));
    for (let row = 0; row < segments; row++) for (let side = 0; side < 8; side++) { const a = row * 9 + side, b = a + 9; indices.push(a, b, a + 1, a + 1, b, b + 1); }
    this.geometry.setIndex(indices);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, length / 2, 0), length);
  }
  update(base, quaternion, scale, dt, reset = false) {
    const tip = new THREE.Vector3(0, this.length * scale, 0).applyQuaternion(quaternion).add(base);
    this.inverse.copy(quaternion).invert();
    const target = new THREE.Vector2();
    if (reset || !this.targetTip || !(dt > 0) || dt > 0.1) { this.bend.set(0, 0); this.velocity.set(0, 0); reset = true; }
    else {
      this.delta.copy(this.targetTip).sub(tip).applyQuaternion(this.inverse).multiplyScalar(2.5 / Math.max(scale, 0.01));
      target.set(this.delta.x, this.delta.z).clampLength(0, 0.14);
      const count = Math.ceil(Math.min(dt, 0.05) / (1 / 240)), h = Math.min(dt, 0.05) / count;
      for (let i = 0; i < count; i++) {
        this.velocity.x += ((target.x - this.bend.x) * 160 - this.velocity.x * 18) * h;
        this.velocity.y += ((target.y - this.bend.y) * 160 - this.velocity.y * 18) * h;
        this.bend.addScaledVector(this.velocity, h).clampLength(0, 0.16);
      }
    }
    this.targetTip = tip;
    const positions = this.geometry.attributes.position;
    let previousX = 0, previousZ = 0, y = 0;
    for (let i = 0; i <= this.segments; i++) {
      const u = i / this.segments, x = this.bend.x * u * u, z = this.bend.y * u * u;
      if (i) y += Math.sqrt(Math.max(0, (this.length / this.segments) ** 2 - (x - previousX) ** 2 - (z - previousZ) ** 2));
      this.local[i].set(x, y, z); previousX = x; previousZ = z;
      this.previous[i].copy(this.world[i]); this.world[i].copy(this.local[i]).multiplyScalar(scale).applyQuaternion(quaternion).add(base);
      if (reset) this.previous[i].copy(this.world[i]);
      for (let side = 0; side <= 8; side++) {
        const angle = side / 8 * Math.PI * 2, radius = 0.012 - u * 0.003;
        positions.setXYZ(i * 9 + side, x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius);
      }
    }
    positions.needsUpdate = true;
    return this;
  }
}
