import * as THREE from 'three';
import { walkStep } from '../core/locomotion.js';

export class ArmMotion {
  constructor(ctx, surfaces, allowed) { this.ctx = ctx; this.surfaces = surfaces; this.allowed = allowed; this.previous = new Map(); this.velocity = new THREE.Vector3(); this.wasContact = false; }
  reset() { this.previous.clear(); this.velocity.set(0, 0, 0); this.wasContact = false; }
  update(dt, enabled = true) {
    const { ctx } = this, rig = ctx.rig; rig.updateMatrixWorld(true);
    const push = new THREE.Vector3(), nearest = new THREE.Vector3(), active = new Set(); let contacts = 0;
    for (const p of ctx.pointers()) {
      if (p.source !== 'hand' && p.source !== 'xr') continue;
      const palm = p.hand?.palm || p.handPos, local = rig.worldToLocal(palm.clone()), old = this.previous.get(p.id); active.add(p.id); this.previous.set(p.id, local);
      if (!old || !enabled || p.pinch) continue;
      const touching = palm.y < 0.15 || this.surfaces.some(box => box.clampPoint(palm, nearest).distanceToSquared(palm) < 0.14 ** 2);
      const movement = local.clone().sub(old).applyQuaternion(rig.getWorldQuaternion(new THREE.Quaternion()));
      if (touching && movement.length() < 0.35) { push.sub(movement); contacts++; }
    }
    for (const id of this.previous.keys()) if (!active.has(id)) this.previous.delete(id);
    if (!enabled) { this.velocity.set(0, 0, 0); this.wasContact = false; return; }
    if (contacts) {
      push.multiplyScalar(1.15 / contacts).clampLength(0, 3.5 * dt);
      this.velocity.copy(push).divideScalar(Math.max(dt, 0.001)); this.wasContact = true;
    } else {
      if (!active.size) this.velocity.set(0, 0, 0); // tracking loss must never launch player
      this.velocity.y -= 9.81 * dt; this.velocity.x *= Math.exp(-0.7 * dt); this.velocity.z *= Math.exp(-0.7 * dt);
      push.copy(this.velocity).multiplyScalar(dt); this.wasContact = false;
    }
    const eye = ctx.eye(), next = walkStep(eye.x, eye.z, push.x, push.z, this.allowed);
    rig.position.x += next.x - eye.x; rig.position.z += next.z - eye.z;
    const oldY = rig.position.y; rig.position.y = Math.max(0, Math.min(14, oldY + push.y));
    // Only land on a branch directly beneath the feet, never a distant tree.
    let floor = 0;
    for (const box of this.surfaces) if (box.max.y <= oldY + 0.08 && eye.x >= box.min.x && eye.x <= box.max.x && eye.z >= box.min.z && eye.z <= box.max.z) floor = Math.max(floor, box.max.y);
    if (this.velocity.y <= 0 && rig.position.y <= floor && oldY >= floor - 0.08) { rig.position.y = floor; this.velocity.y = 0; }
    if (!rig.position.y && this.velocity.y < 0) this.velocity.y = 0;
  }
}
