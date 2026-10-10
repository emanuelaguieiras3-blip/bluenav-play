// Céu em degradê, neblina e luzes básicas de cada ambiente
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { detectDevice } from './perf.js';

const skyVert = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const skyFrag = `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform float sharp; uniform vec3 sunDirection; uniform vec3 sunColor; uniform float sunGlow; varying vec3 vDir;
void main(){ vec3 dir=normalize(vDir); float h = dir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, sharp)) : mix(horizon, bottom, pow(-h, 0.6));
float facing=max(0.0,dot(dir,sunDirection));
c+=sunColor*sunGlow*(pow(facing,96.0)*0.2+pow(facing,1600.0)*1.3);
float haze=exp(-abs(h)*18.0)*0.12;c=mix(c,horizon,haze);gl_FragColor = vec4(c,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export class Environment {
  constructor(app) {
    this.app = app;
    this.uniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sharp: { value: 0.6 }, sunDirection: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color('#fff2da') }, sunGlow: { value: 1 } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false }));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.skyHolder = new THREE.Group(); this.skyHolder.add(this.sky);
    app.scene.add(this.skyHolder);
    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x404850, 1.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.position.set(3, 8, 2);
    app.scene.add(this.hemi, this.sun, this.sun.target);
    this.sunOffset = new THREE.Vector3(3, 8, 2).normalize().multiplyScalar(45);
    this.shadowCenter = new THREE.Vector3();
    const mobile = detectDevice().mobile;
    this.shadows = !mobile;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 100 });
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.03;
    if (!mobile) {
      const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(app.renderer);
      this.reflections = generator.fromScene(room, 0.06, 0.1, 100);
      this.reflections.texture.userData.shared = true;
      room.dispose(); generator.dispose();
      app.scene.environment = this.reflections.texture;
    }
  }

  set({ top = '#4f8fe6', horizon = '#bcd8f5', bottom = '#5a6470', sharp = 0.6, fog = null, hemi = ['#dfefff', '#404850', 1.6], sun = ['#ffffff', 1.5], sunPos = [3, 8, 2], sky = true } = {}) {
    this.uniforms.top.value.set(top); this.uniforms.horizon.value.set(horizon); this.uniforms.bottom.value.set(bottom); this.uniforms.sharp.value = sharp;
    this.sky.visible = sky;
    const s = this.app.scene;
    if (fog) s.fog = fog.density ? new THREE.FogExp2(fog.color, fog.density) : new THREE.Fog(fog.color, fog.near ?? 1, fog.far ?? 60);
    else s.fog = null;
    s.background = new THREE.Color(horizon);
    this.hemi.color.set(hemi[0]); this.hemi.groundColor.set(hemi[1]); this.hemi.intensity = hemi[2];
    this.sun.color.set(sun[0]); this.sun.intensity = sun[1]; this.sun.position.set(...sunPos);
    this.sunOffset.set(...sunPos).normalize().multiplyScalar(45);
    this.uniforms.sunDirection.value.copy(this.sunOffset).normalize();
    this.uniforms.sunColor.value.set(sun[0]); this.uniforms.sunGlow.value = sky ? Math.min(1, sun[1] / 2) : 0;
    this.sun.castShadow = this.shadows && sun[1] > 0.4;
  }

  update() {
    // o céu acompanha a câmera (sempre "infinito")
    this.app.camera.getWorldPosition(this.skyHolder.position);
    if (this.sun.castShadow) {
      this.shadowCenter.copy(this.skyHolder.position); this.shadowCenter.y = this.app.rig.position.y;
      this.sun.target.position.copy(this.shadowCenter);
      this.sun.position.copy(this.shadowCenter).add(this.sunOffset);
      this.sun.target.updateMatrixWorld();
    }
  }
}
