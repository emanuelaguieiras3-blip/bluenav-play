// Planar mirror without nested rendering: before each frame a camera placed
// at the eye reflected through the mirror renders the room into a texture,
// with an off-axis frustum that exactly covers the glass. The glass shows the
// texture flipped horizontally. Works in stereo and WebXR (one pass per frame).
import * as THREE from 'three';

// Pure math (tested): reflected eye and off-axis frustum for a mirror in the
// plane z = planeZ facing +z, centred at (cx, cy) with size w x h.
export function mirrorFrustum(eye, { planeZ, cx, cy, w, h }) {
  const d = eye.z - planeZ; // distance from the eye to the glass
  if (!(d > 0.05)) return null; // behind or touching the glass
  const virtualEye = new THREE.Vector3(eye.x, eye.y, planeZ - d);
  // The virtual camera looks toward +z, so its right is world -x.
  return { virtualEye, near: d, left: eye.x - (cx + w / 2), right: eye.x - (cx - w / 2), top: cy + h / 2 - eye.y, bottom: cy - h / 2 - eye.y };
}

export function createMirror({ planeZ, cx, cy, w, h, resolution = 512, layers = [] }) {
  const aspect = w / h, rt = new THREE.WebGLRenderTarget(Math.round(resolution * Math.min(1, aspect)), Math.round(resolution / Math.max(1, aspect)), { samples: 0 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false });
  rt.texture.wrapS = THREE.RepeatWrapping; rt.texture.repeat.x = -1; rt.texture.offset.x = 1; // mirror image
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); glass.position.set(cx, cy, planeZ);
  const camera = new THREE.PerspectiveCamera(); camera.rotation.set(0, Math.PI, 0); camera.layers.enable(0); layers.forEach(l => camera.layers.enable(l));
  let frame = 0;
  return {
    glass, camera, renderTarget: rt,
    // Call once per frame before the main render. `every` skips frames on phones.
    render(renderer, scene, eye, { every = 1, far = 60 } = {}) {
      if (!renderer?.setRenderTarget || !renderer.render || (frame++ % every)) return false;
      const f = mirrorFrustum(eye, { planeZ, cx, cy, w, h }); if (!f) return false;
      camera.position.copy(f.virtualEye); camera.updateMatrixWorld(true);
      camera.projectionMatrix.makePerspective(f.left, f.right, f.top, f.bottom, f.near, far);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      const xr = renderer.xr, xrEnabled = xr?.enabled, previous = renderer.getRenderTarget?.() ?? null;
      glass.visible = false; if (xr) xr.enabled = false;
      renderer.setRenderTarget(rt); renderer.clear?.(); renderer.render(scene, camera); renderer.setRenderTarget(previous);
      if (xr) xr.enabled = xrEnabled; glass.visible = true;
      return true;
    },
    dispose() { rt.dispose(); material.dispose(); glass.geometry.dispose(); },
  };
}
