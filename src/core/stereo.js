// Tela dividida para óculos de papelão / VR Box / Shinecon
import * as THREE from 'three';

export class StereoRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.stereo = new THREE.StereoCamera();
    this.stereo.eyeSep = 0.064;
    this._size = new THREE.Vector2();
  }

  render(scene, camera, monocular = false) {
    const r = this.renderer;
    // One phone camera supplies one viewpoint. A fake IPD moves the overlay
    // relative to that image by centimetres at hand distance.
    this.stereo.eyeSep = monocular ? 0 : 0.064;
    scene.updateMatrixWorld();
    if (camera.parent === null) camera.updateMatrixWorld();
    this.stereo.update(camera);
    r.getSize(this._size);
    const w = this._size.x / 2, h = this._size.y;
    if (r.autoClear) r.clear();
    r.setScissorTest(true);
    // a cena já foi atualizada acima: os dois olhos não precisam recalcular tudo de novo
    const auto = scene.matrixWorldAutoUpdate;
    scene.matrixWorldAutoUpdate = false;
    r.setScissor(0, 0, w, h); r.setViewport(0, 0, w, h);
    r.render(scene, this.stereo.cameraL);
    r.setScissor(w, 0, w, h); r.setViewport(w, 0, w, h);
    r.render(scene, this.stereo.cameraR);
    scene.matrixWorldAutoUpdate = auto;
    r.setScissorTest(false);
    r.setViewport(0, 0, this._size.x, this._size.y);
  }
}
