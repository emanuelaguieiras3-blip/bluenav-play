import * as THREE from 'three';

export const XR_JOINTS = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'];

export function readXRHand(source, frame, reference, matrix, previousPinch = false) {
  if (!source.hand || !frame?.getJointPose || !reference) return null;
  const points = [];
  for (const name of XR_JOINTS) {
    const space = source.hand.get(name); if (!space) return null;
    const pose = frame.getJointPose(space, reference); if (!pose) return null;
    const p = pose.transform.position;
    if (![p.x, p.y, p.z].every(Number.isFinite)) return null;
    points.push(new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(matrix));
  }
  const distance = points[4].distanceTo(points[8]);
  const pinch = distance < (previousPinch ? 0.035 : 0.025);
  const palm = points[0].clone().add(points[5]).add(points[17]).multiplyScalar(1 / 3);
  return { id: 'native-' + source.handedness, label: source.handedness === 'left' ? 'Left' : 'Right', points, palm,
    dir: points[9].clone().sub(points[0]).normalize(), tip: points[8], gesture: pinch ? 'pinça' : 'aberta',
    confianca: 1, stale: false, pinchStrength: THREE.MathUtils.clamp(1 - (distance - 0.015) / 0.035, 0, 1), palmFacing: 0 };
}
