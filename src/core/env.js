// Céu em degradê, neblina e luzes básicas de cada ambiente
import * as THREE from 'three';

const skyVert = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const skyFrag = `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform float sharp; varying vec3 vDir;
void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, sharp)) : mix(horizon, bottom, pow(-h, 0.6)); gl_FragColor = vec4(c,1.0);
#include <colorspace_fragment>
}`;

export class Environment {
  constructor(app) {
    this.app = app;
    this.uniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sharp: { value: 0.6 } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false }));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.skyHolder = new THREE.Group(); this.skyHolder.add(this.sky);
    app.scene.add(this.skyHolder);
    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x404850, 1.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.position.set(3, 8, 2);
    app.scene.add(this.hemi, this.sun, this.sun.target);
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
  }

  update() {
    // o céu acompanha a câmera (sempre "infinito")
    this.app.camera.getWorldPosition(this.skyHolder.position);
  }
}
