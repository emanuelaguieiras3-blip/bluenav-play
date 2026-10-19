import * as THREE from './vendor/three.module.js';

// Phone stereo shares the RPG simulation with WebXR. No synthetic hand tracking.
export function createPhoneView(renderer, camera) {
  const stereo = new THREE.StereoCamera();
  const size = new THREE.Vector2(), yaw = new THREE.Quaternion();
  const correction = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
  let active = false, orientation = null, offset = null, permission = false;
  const sensor = event => { if (event.alpha != null && event.beta != null && event.gamma != null) orientation = event; };
  return {
    get active() { return active; },
    get sensorActive() { return !!orientation; },
    async start() {
      if (active) return;
      // Invoke permissions and fullscreen from the click, before awaiting either.
      const request = globalThis.DeviceOrientationEvent?.requestPermission;
      const access = request ? request.call(DeviceOrientationEvent).catch(() => 'denied') : Promise.resolve('granted');
      const fullscreen = document.documentElement.requestFullscreen?.();
      fullscreen?.catch(() => {});
      permission = await access === 'granted';
      if (permission) window.addEventListener('deviceorientation', sensor);
      active = true; orientation = null; offset = null;
      camera.quaternion.identity();
    },
    stop() {
      active = false; orientation = null; offset = null;
      window.removeEventListener('deviceorientation', sensor);
      renderer.setScissorTest(false); renderer.getSize(size);
      renderer.setViewport(0, 0, size.x, size.y);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    },
    recenter() { offset = null; },
    update() {
      if (!orientation) return;
      const radians = Math.PI / 180, d = orientation;
      const angle = (screen.orientation?.angle ?? window.orientation ?? 0) * radians;
      camera.quaternion.setFromEuler(new THREE.Euler(d.beta * radians, d.alpha * radians, -d.gamma * radians, 'YXZ'));
      camera.quaternion.multiply(correction).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle));
      const heading = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
      if (offset == null) offset = -heading;
      camera.quaternion.premultiply(yaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), offset));
    },
    render(scene) {
      renderer.getSize(size); camera.aspect = size.x / (2 * size.y); camera.updateProjectionMatrix();
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); stereo.update(camera);
      renderer.clear(); renderer.setScissorTest(true);
      renderer.setViewport(0, 0, size.x / 2, size.y); renderer.setScissor(0, 0, size.x / 2, size.y);
      renderer.render(scene, stereo.cameraL);
      renderer.setViewport(size.x / 2, 0, size.x / 2, size.y); renderer.setScissor(size.x / 2, 0, size.x / 2, size.y);
      renderer.render(scene, stereo.cameraR);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
    },
  };
}
