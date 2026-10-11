// Real edges instead of perfect cubes: every axis-aligned BoxGeometry in a
// scene is swapped for a RoundedBoxGeometry with the same size, position and
// material groups. Voxel games keep their cubes on purpose.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const CUBIC_GAMES = new Set(['blocks', 'kingdom']);

const _size = new THREE.Vector3(), _center = new THREE.Vector3();

// Bevel radius: proportional to the thinnest side, capped so walls keep crisp
// silhouettes and tiny details (arrows, lines) only get a soft edge.
export function bevelRadius(size, { ratio = 0.18, max = 0.05 } = {}) {
  const thin = Math.min(size.x, size.y, size.z);
  return thin < 0.004 ? 0 : Math.min(max, thin * ratio);
}

export function roundedFromBox(geometry, options = {}) {
  if (!geometry?.isBufferGeometry || geometry.type !== 'BoxGeometry' || geometry instanceof RoundedBoxGeometry || geometry.userData.keepCube) return null;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox; if (!box || box.isEmpty()) return null;
  box.getSize(_size); box.getCenter(_center);
  // Only axis-aligned boxes: an arbitrary baked rotation changes the bounds.
  const p = geometry.parameters || {}, expected = [p.width, p.height, p.depth].map(Number).sort((a, b) => a - b);
  const actual = [_size.x, _size.y, _size.z].sort((a, b) => a - b);
  if (!expected.every((v, i) => Number.isFinite(v) && Math.abs(v - actual[i]) < 1e-4 * Math.max(1, v))) return null;
  const radius = bevelRadius(_size, options); if (!radius) return null;
  const rounded = new RoundedBoxGeometry(_size.x, _size.y, _size.z, options.segments ?? 2, radius);
  rounded.translate(_center.x, _center.y, _center.z);
  rounded.userData.roundedFrom = 'box';
  return rounded;
}

// Replaces geometries in place; shared geometries are converted once.
export function roundBoxes(root, options = {}) {
  const cache = new Map(); let replaced = 0;
  root.traverse(object => {
    if (!object.isMesh || object.userData.keepCube) return;
    // Hundreds of instanced stripes would multiply the triangle count: they stay flat.
    if (object.isInstancedMesh && object.count > 48) return;
    const old = object.geometry;
    if (!cache.has(old)) cache.set(old, roundedFromBox(old, options));
    const next = cache.get(old);
    if (!next) return;
    object.geometry = next; replaced++;
  });
  for (const [old, next] of cache) if (next) old.dispose();
  return replaced;
}
