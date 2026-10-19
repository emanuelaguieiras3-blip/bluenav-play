// Shared space materials: procedural nebulae, twinkling stars, gas giants,
// planetary rings and atmospheres. Everything is generated in the shader, so
// no texture download is needed and the detail holds up close in VR.
import * as THREE from 'three';

export const NOISE_GLSL = `
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;

const FINISH = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';

// Cloud-edged nebula on a plane. The edge follows the noise, so the outline
// reads as gas, not as a rectangle.
export function nebulaMaterial({ colors = ['#050818', '#2a1650', '#13607f', '#d86aa0'], opacity = 1 } = {}) {
  const [deep, violet, teal, rose] = colors.map(c => new THREE.Color(c));
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, deep: { value: deep }, violet: { value: violet }, teal: { value: teal }, rose: { value: rose }, opacity: { value: opacity } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time; uniform vec3 deep, violet, teal, rose; uniform float opacity; varying vec2 vUv;
${NOISE_GLSL}
void main(){
  vec2 p = (vUv - 0.5) * vec2(2.6, 2.0);
  vec3 q = vec3(p * 1.4, time * 0.03);
  vec2 warp = vec2(fbm(q + vec3(0.0, 0.0, 1.3)), fbm(q + vec3(5.2, 1.3, 2.8)));
  float n = fbm(q + vec3(warp * 2.2, time * 0.02));
  float filament = pow(1.0 - abs(fbm(q * 2.3 + vec3(warp, 0.0)) * 2.0 - 1.0), 6.0);
  vec3 c = mix(deep, violet, smoothstep(0.35, 0.75, n));
  c = mix(c, teal, smoothstep(0.55, 0.85, warp.x) * 0.75);
  c = mix(deep, c, 0.35 + 0.65 * smoothstep(0.3, 0.7, n));
  c += rose * filament * 0.18 + teal * filament * 0.22;
  vec2 cell = floor(vUv * 220.0); float star = step(0.9965, hash13(vec3(cell, 4.0)));
  float tw = 0.6 + 0.4 * sin(time * 2.5 + hash13(vec3(cell, 9.0)) * 40.0);
  vec2 sub = fract(vUv * 220.0) - 0.5; c += vec3(0.9, 0.95, 1.0) * star * tw * smoothstep(0.42, 0.0, length(sub)) * 1.4;
  vec2 e = abs(vUv - 0.5) * 2.0;
  float frame = smoothstep(1.0, 0.8, max(e.x, e.y));
  float alpha = smoothstep(1.0, 0.3, length(e) * 0.85 + (n - 0.5) * 0.6) * frame;
  gl_FragColor = vec4(c, alpha * opacity);${FINISH}}`,
  });
}

// Round, soft stars with per-star size, colour temperature and twinkle phase.
export function twinkleMaterial({ scale = 260, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, scale: { value: scale }, opacity: { value: opacity } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float size; attribute float phase; attribute vec3 color; uniform float time, scale; varying vec3 vColor; varying float vTw;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vColor = color; vTw = 0.55 + 0.45 * sin(time * (1.2 + phase) + phase * 37.0);
  gl_PointSize = max(1.0, size * scale / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float opacity; varying vec3 vColor; varying float vTw;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float core = smoothstep(0.5, 0.0, r); float spike = max(0.0, 1.0 - abs(d.x) * 14.0) * max(0.0, 1.0 - abs(d.y) * 2.2) + max(0.0, 1.0 - abs(d.y) * 14.0) * max(0.0, 1.0 - abs(d.x) * 2.2);
  float a = (pow(core, 2.4) + spike * 0.35) * vTw * opacity; if (a < 0.01) discard; gl_FragColor = vec4(vColor * a, a);${FINISH}}`,
  });
}

const STAR_TINTS = ['#9bb7ff', '#cad7ff', '#f8f7ff', '#fff4e8', '#ffd2a1', '#ffb08a'].map(c => new THREE.Color(c));

// positions: Float32Array of xyz. Sizes and tints are deterministic per index.
export function twinkleGeometry(positions, { minSize = 0.6, maxSize = 2.2 } = {}) {
  const count = positions.length / 3, sizes = new Float32Array(count), phases = new Float32Array(count), colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const h = ((i * 2654435761) >>> 0) / 4294967296, k = ((i * 40503 + 17) % 997) / 997;
    sizes[i] = minSize + (maxSize - minSize) * Math.pow(h, 3);
    phases[i] = k * 3;
    STAR_TINTS[Math.floor(k * STAR_TINTS.length) % STAR_TINTS.length].toArray(colors, i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Banded gas giant lit from a fixed direction, with storms and a fresnel rim.
export function gasGiantMaterial({ a = '#e8c79a', b = '#9c6b4a', c = '#f6ead2', storm = '#d0603a', light = [0.6, 0.45, 0.65] } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, ca: { value: new THREE.Color(a) }, cb: { value: new THREE.Color(b) }, cc: { value: new THREE.Color(c) },
      cs: { value: new THREE.Color(storm) }, lightDir: { value: new THREE.Vector3(...light).normalize() } },
    vertexShader: 'varying vec3 vPos; varying vec3 vN; varying vec3 vV; void main(){ vPos = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float time; uniform vec3 ca, cb, cc, cs, lightDir; varying vec3 vPos; varying vec3 vN; varying vec3 vV;
${NOISE_GLSL}
void main(){
  vec3 p = normalize(vPos);
  float turb = fbm(p * 4.0 + vec3(time * 0.02, 0.0, 0.0));
  float lat = p.y * 9.0 + turb * 1.6;
  float band = sin(lat) * 0.5 + 0.5, fine = sin(lat * 3.7 + turb * 4.0) * 0.5 + 0.5;
  vec3 col = mix(cb, ca, band); col = mix(col, cc, fine * 0.35);
  vec2 sp = vec2(atan(p.z, p.x) - time * 0.05, p.y + 0.32); sp.x = mod(sp.x + 3.14159, 6.28318) - 3.14159;
  float spot = smoothstep(0.22, 0.0, length(sp * vec2(0.55, 2.6)));
  col = mix(col, cs, spot * (0.7 + 0.3 * sin(turb * 12.0)));
  vec3 n = normalize(vN); float diff = smoothstep(-0.15, 0.9, dot(n, lightDir));
  float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 3.0);
  col = col * (0.16 + 1.0 * diff) + vec3(0.55, 0.75, 1.0) * rim * 0.55 * (0.3 + diff);
  gl_FragColor = vec4(col, 1.0);${FINISH}}`,
  });
}

// Ring with Cassini-style gaps, dust grain and the planet's shadow.
export function ringMaterial({ inner, outer, tint = '#e9d8b8', planetRadius, light = [0.6, 0.45, 0.65] }) {
  return new THREE.ShaderMaterial({
    uniforms: { inner: { value: inner }, outer: { value: outer }, tint: { value: new THREE.Color(tint) }, pr: { value: planetRadius },
      lightDir: { value: new THREE.Vector3(...light).normalize() } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vLocal; varying vec3 vWorldDir; void main(){ vLocal = position; vWorldDir = (modelViewMatrix * vec4(position, 0.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float inner, outer, pr; uniform vec3 tint, lightDir; varying vec3 vLocal; varying vec3 vWorldDir;
${NOISE_GLSL}
void main(){
  float r = length(vLocal.xy), t = (r - inner) / (outer - inner);
  float grain = vnoise(vec3(t * 180.0, 0.0, 0.0)) * 0.5 + vnoise(vec3(t * 46.0, 3.0, 0.0)) * 0.5;
  float gaps = smoothstep(0.015, 0.03, abs(t - 0.62)) * smoothstep(0.006, 0.014, abs(t - 0.82)) * (0.65 + 0.35 * smoothstep(0.0, 0.08, abs(t - 0.3)));
  float edge = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.94, t);
  vec3 d = normalize(vWorldDir); vec3 L = lightDir;
  float along = dot(vWorldDir, L); vec3 perp = vWorldDir - L * along;
  float shadow = along < 0.0 ? smoothstep(pr * 0.92, pr * 1.04, length(perp)) : 1.0;
  vec3 col = tint * (0.55 + 0.6 * grain) * (0.25 + 0.75 * shadow);
  gl_FragColor = vec4(col, edge * gaps * (0.35 + 0.55 * grain));${FINISH}}`,
  });
}

// Fresnel atmosphere shell: bright on the limb, clear when facing the viewer.
export function atmosphereMaterial({ color = '#7abbf1', power = 2.6, strength = 0.9, light = null } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { glow: { value: new THREE.Color(color) }, power: { value: power }, strength: { value: strength },
      lightDir: { value: light ? new THREE.Vector3(...light).normalize() : new THREE.Vector3() }, lit: { value: light ? 1 : 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 glow, lightDir; uniform float power, strength, lit; varying vec3 vN; varying vec3 vV;
void main(){ vec3 n = normalize(vN); float f = pow(1.0 - max(dot(n, normalize(vV)), 0.0), power);
  float day = mix(1.0, smoothstep(-0.35, 0.6, dot(n, lightDir)), lit);
  float a = f * strength * day; gl_FragColor = vec4(glow * a, a);${FINISH}}`,
  });
}

// Cratered moon: icosphere displaced on the CPU, lit in the shader.
export function crateredMoonGeometry(radius, detail = 4, seed = 1) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geometry.attributes.position, v = new THREE.Vector3();
  const craters = Array.from({ length: 18 }, (_, i) => {
    const a = (i + seed) * 2.399963, y = 1 - 2 * ((i * 0.618 + seed * 0.13) % 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    return { c: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), size: 0.12 + ((i * 37) % 11) / 40 };
  });
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let h = 0;
    for (const crater of craters) {
      const d = v.distanceTo(crater.c) / crater.size;
      if (d < 1) h -= (1 - d * d) * 0.07; else if (d < 1.35) h += (1.35 - d) * 0.06;
    }
    h += (Math.sin(v.x * 23 + seed) * Math.sin(v.y * 19) * Math.sin(v.z * 17)) * 0.015;
    v.multiplyScalar(radius * (1 + h)); pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function litMaterial({ color = '#b6bbc6', light = [0.6, 0.45, 0.65], ambient = 0.07 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { base: { value: new THREE.Color(color) }, lightDir: { value: new THREE.Vector3(...light).normalize() }, ambient: { value: ambient } },
    vertexShader: 'varying vec3 vN; varying vec3 vPos; void main(){ vPos = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 base, lightDir; uniform float ambient; varying vec3 vN; varying vec3 vPos;
${NOISE_GLSL}
void main(){ float d = max(dot(normalize(vN), lightDir), 0.0); float g = 0.8 + 0.35 * fbm(vPos * 30.0);
  gl_FragColor = vec4(base * g * (ambient + d), 1.0);${FINISH}}`,
  });
}
