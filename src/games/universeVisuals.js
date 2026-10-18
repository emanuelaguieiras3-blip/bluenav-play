import { std, glowTexture } from './common.js';
import { BODY_TYPES, kindOf } from './universePhysics.js';
import { NOISE_GLSL, atmosphereMaterial, twinkleGeometry, twinkleMaterial } from '../core/spaceShaders.js';

const STAR_LOOK = {
  reddwarf: { color: '#ffb08a', glow: ['rgba(255,150,105,1)', 'rgba(255,60,25,0)'], tint: '#ff7a52', size: 2.2 },
  star: { color: '#fff3d8', glow: ['rgba(255,210,125,1)', 'rgba(255,99,25,0)'], tint: '#ffad6b', size: 3.3 },
  bluegiant: { color: '#d6e4ff', glow: ['rgba(170,205,255,1)', 'rgba(70,120,255,0)'], tint: '#9cc2ff', size: 4.8 },
  redgiant: { color: '#ff9a6e', glow: ['rgba(255,120,80,1)', 'rgba(200,40,20,0)'], tint: '#ff6a3d', size: 5.4 },
  whitedwarf: { color: '#f4f8ff', glow: ['rgba(235,245,255,1)', 'rgba(150,190,255,0)'], tint: '#dfeaff', size: 1.1 },
  neutron: { color: '#d8ecff', glow: ['rgba(200,230,255,1)', 'rgba(110,170,255,0)'], tint: '#bfe0ff', size: 0.9 },
};
const PLANET_LOOK = {
  rocky: { map: 'roughStone', color: '#b38f74' },
  planet: { map: 'earth', color: '#d3e7fa' },
  icy: { map: 'roughStone', color: '#d9eeff' },
  moon: { map: 'roughStone', color: '#b6bbc6' },
  asteroid: { map: 'roughStone', color: '#8f7a68' },
  comet: { map: 'roughStone', color: '#cfe3ee' },
  meteor: { map: 'roughStone', color: '#9a7661' },
};

function noiseTexture(THREE, width, height, paint) {
  const pixels = new Uint8Array(width * height * 4);
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const smooth = (x, y, scale) => {
    const gx = x / scale, gy = y / scale, ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = gx - ix, fy = gy - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx) * (1 - sy) + (hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx) * sy;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) paint(pixels, (y * width + x) * 4, x, y, smooth);
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  return texture;
}

export function createMaps(THREE) {
  const solar = noiseTexture(THREE, 256, 128, (px, i, x, y, smooth) => {
    const coarse = smooth(x, y, 24), medium = smooth(x, y, 7), fine = smooth(x, y, 2);
    const swirl = Math.sin(x * 0.12 + y * 0.13 + coarse * 8) * 0.12;
    const heat = Math.max(0, Math.min(1, coarse * 0.42 + medium * 0.33 + fine * 0.17 + swirl + 0.06));
    px[i] = 240 + heat * 15; px[i + 1] = 69 + heat * 176; px[i + 2] = 12 + heat * 76; px[i + 3] = 255;
  });
  const clouds = noiseTexture(THREE, 256, 128, (px, i, x, y, smooth) => {
    const density = smooth(x, y, 27) * 0.55 + smooth(x, y, 9) * 0.3 + smooth(x, y, 3) * 0.15;
    px[i] = 244; px[i + 1] = 250; px[i + 2] = 255; px[i + 3] = Math.round(Math.max(0, Math.min(1, (density - 0.48) * 6)) * 190);
  });
  const bands = noiseTexture(THREE, 256, 128, (px, i, x, y, smooth) => {
    const band = Math.sin(y * 0.32 + smooth(x, y, 18) * 3.5) * 0.5 + 0.5, storm = smooth(x, y, 5) * 0.25;
    px[i] = 150 + band * 80 + storm * 40; px[i + 1] = 110 + band * 70 + storm * 30; px[i + 2] = 80 + band * 40; px[i + 3] = 255;
  });
  const rings = noiseTexture(THREE, 128, 4, (px, i, x) => {
    const shade = 0.55 + 0.45 * Math.sin(x * 0.6) * Math.sin(x * 0.13);
    px[i] = 215 * shade + 30; px[i + 1] = 195 * shade + 25; px[i + 2] = 160 * shade + 20; px[i + 3] = x < 6 || x > 122 ? 0 : 120 + shade * 120;
  });
  return { solar, clouds, bands, rings };
}

export function destroy(group) {
  group.parent?.remove(group);
  group.traverse(object => {
    object.geometry?.dispose?.();
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose?.();
  });
}

// A star shell that rides with the player so the sky never runs out while
// flying: a nebula dome with a galactic band plus twinkling stars that crowd
// toward the band like the Milky Way.
export function starfield(THREE, root) {
  const sky = new THREE.Group(); sky.name = 'universe-starfield'; sky.frustumCulled = false;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(74, 48, 32), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time; varying vec3 vDir;
${NOISE_GLSL}
void main(){
  vec3 d = normalize(vDir);
  vec3 axis = normalize(vec3(0.25, 0.92, 0.3));
  float band = exp(-pow(dot(d, axis) * 3.2, 2.0));
  vec3 w = d * 3.0 + vec3(fbm(d * 2.0), fbm(d * 2.0 + 7.1), 0.0) * 1.4;
  float gas = fbm(w), dust = fbm(d * 9.0 + 3.0);
  vec3 col = vec3(0.004, 0.006, 0.018);
  float glow = smoothstep(0.35, 0.85, gas) * band;
  col += mix(vec3(0.09, 0.04, 0.2), vec3(0.04, 0.17, 0.27), gas) * glow;
  col += vec3(0.5, 0.36, 0.26) * pow(band, 4.0) * smoothstep(0.55, 0.85, gas) * 0.18;
  col *= 1.0 - smoothstep(0.55, 0.8, dust) * band * 0.85;
  col += vec3(0.3, 0.05, 0.16) * smoothstep(0.66, 0.92, fbm(d * 1.4 + 11.0)) * 0.12;
  gl_FragColor = vec4(col, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  }));
  dome.renderOrder = -10; dome.frustumCulled = false; sky.add(dome);
  const count = 1600, points = new Float32Array(count * 3), axis = new THREE.Vector3(0.25, 0.92, 0.3).normalize(), v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const a = i * 2.399963, y = ((i * 73) % (count - 1)) / (count - 1) * 2 - 1, r = Math.sqrt(1 - y * y);
    v.set(Math.cos(a) * r, y, Math.sin(a) * r);
    // Half the stars are pulled toward the galactic plane.
    if (i % 2) { const along = v.dot(axis); v.addScaledVector(axis, -along * 0.8).normalize(); }
    points.set([v.x * 70, v.y * 70, v.z * 70], i * 3);
  }
  const stars = new THREE.Points(twinkleGeometry(points, { minSize: 0.08, maxSize: 0.42 }), twinkleMaterial({ scale: 520 }));
  stars.frustumCulled = false; sky.add(stars);
  const clock = performance.now();
  dome.onBeforeRender = () => { const t = (performance.now() - clock) / 1000; dome.material.uniforms.time.value = t; stars.material.uniforms.time.value = t; };
  root.add(sky);
  return sky;
}

function glowSprite(THREE, colors, tint, size, opacity = 0.34) {
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(...colors), color: tint, transparent: true,
    opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(size, size, 1);
  return glow;
}

export function bodyVisual(ctx, body, maps, lightEnabled = true) {
  const { THREE, tex, lowEnd } = ctx, spec = BODY_TYPES[body.type], kind = kindOf(body);
  const group = new THREE.Group(); group.name = `celestial-${body.id}`;
  const segments = [lowEnd ? 16 : 32, lowEnd ? 12 : 20];
  let material, geometry = new THREE.SphereGeometry(spec.radius, ...segments);
  if (kind === 'star') {
    const look = STAR_LOOK[body.type];
    material = new THREE.MeshBasicMaterial({ map: maps.solar, color: look.color, toneMapped: false });
  } else if (kind === 'blackhole') material = new THREE.MeshBasicMaterial({ color: '#020207' });
  else if (kind === 'whitehole') material = new THREE.MeshBasicMaterial({ color: '#f2f8ff', toneMapped: false });
  else if (body.type === 'gasgiant' || body.type === 'ringed') {
    material = std({ map: maps.bands, color: body.type === 'ringed' ? '#f1dcb4' : '#e7c8a8', roughness: 0.9 });
  } else {
    const look = PLANET_LOOK[body.type] || PLANET_LOOK.meteor;
    material = std({ map: tex.get(look.map), color: look.color, roughness: body.type === 'icy' ? 0.55 : 0.95 });
    if (body.type === 'asteroid') geometry = new THREE.IcosahedronGeometry(spec.radius, 1);
  }
  const core = new THREE.Mesh(geometry, material);
  if (body.type === 'asteroid') core.scale.set(1, 0.72, 0.86);
  group.add(core); group.userData.core = core; group.userData.baseColor = material.color?.clone?.();
  if (kind === 'star') {
    const look = STAR_LOOK[body.type];
    const glow = glowSprite(THREE, look.glow, look.tint, look.size); group.add(glow); group.userData.glow = glow;
    if (!lowEnd && lightEnabled) { const light = new THREE.PointLight(look.tint, 80, 40, 2); group.add(light); group.userData.light = light; }
    if (body.type === 'neutron') {
      const beams = new THREE.Group();
      for (const side of [1, -1]) {
        const beam = new THREE.Mesh(new THREE.ConeGeometry(0.16, 3.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true,
          opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.y = side * 1.6; beam.rotation.z = side > 0 ? Math.PI : 0; beams.add(beam);
      }
      beams.rotation.z = 0.5; group.add(beams); group.userData.beams = beams;
    }
  }
  if (body.type === 'planet') {
    if (!lowEnd) {
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * 1.025, 32, 20),
        new THREE.MeshStandardMaterial({ map: maps.clouds, transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide }));
      group.add(clouds); group.userData.clouds = clouds;
    }
    // Fresnel limb glow instead of a flat tinted shell.
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * 1.06, lowEnd ? 24 : 48, lowEnd ? 16 : 32), atmosphereMaterial({ color: '#7abbf1', power: 2.8, strength: 0.95 }));
    group.add(atmosphere);
  }
  if (body.type === 'ringed') {
    const ring = new THREE.Mesh(new THREE.RingGeometry(spec.radius * 1.35, spec.radius * 2.3, 64, 1), new THREE.MeshBasicMaterial({ map: maps.rings,
      transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    remapRingUv(ring.geometry, spec.radius * 1.35, spec.radius * 2.3);
    ring.rotation.x = -Math.PI / 2 + 0.35; group.add(ring);
  }
  if (kind === 'planet' || kind === 'moon') {
    const heat = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * 1.01, 24, 16), new THREE.MeshBasicMaterial({ color: '#ff5a1f', transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    heat.visible = false; group.add(heat); group.userData.heat = heat;
  }
  if (body.type === 'comet') {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true,
      opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    tail.geometry.translate(0, -1.2, 0); group.add(tail); group.userData.tail = tail;
    group.add(glowSprite(THREE, ['rgba(220,240,255,1)', 'rgba(120,180,255,0)'], '#cfeaff', 0.6, 0.6));
  }
  if (kind === 'blackhole') {
    const disk = new THREE.Mesh(new THREE.RingGeometry(0.53, 1.35, 80, 8), new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, power: { value: 0.35 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float time; uniform float power; varying vec2 vUv; void main(){vec2 p=vUv-0.5; float r=length(p)*2.0; float a=atan(p.y,p.x); float spiral=sin(a*11.0-r*22.0-time*4.0); float turbulence=sin(a*23.0+r*31.0+time*2.0); float glow=smoothstep(1.0,0.18,r)*smoothstep(0.12,0.36,r); float hot=clamp(1.0-r+spiral*0.16+turbulence*0.06,0.0,1.0); vec3 c=mix(vec3(0.35,0.16,0.52),vec3(1.0,0.45,0.08),hot); c=mix(c,vec3(1.0,0.91,0.56),pow(hot,4.0)); gl_FragColor=vec4(c*(0.7+power),glow*(0.54+0.21*spiral)*clamp(0.4+power,0.0,1.0));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }));
    disk.rotation.x = -0.36; group.add(disk); group.userData.disk = disk;
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.028, 8, 64), new THREE.MeshBasicMaterial({ color: '#a6d6ff', transparent: true, opacity: 0.73 }));
    group.add(lens); group.userData.lens = lens;
    if (!lowEnd) {
      // Approximate lensing: a thin Einstein ring and a darkened halo instead of a screen-space refraction pass.
      const halo = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * 2.6, 32, 20), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.NormalBlending,
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
        fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){float f=abs(dot(normalize(vN),normalize(vV))); float ring=smoothstep(0.28,0.36,f)*smoothstep(0.5,0.38,f); float dark=smoothstep(0.55,0.95,f); gl_FragColor=vec4(mix(vec3(0.0),vec3(0.75,0.88,1.0),ring), dark*0.55+ring*0.45);}',
      }));
      halo.name = 'universe-lens'; group.add(halo); group.userData.halo = halo;
    }
  }
  if (kind === 'whitehole') {
    group.add(glowSprite(THREE, ['rgba(255,255,255,1)', 'rgba(140,200,255,0)'], '#e4f2ff', 3.2, 0.55));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }));
    group.add(ring); group.userData.pulse = ring;
  }
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: kind === 'small' ? '#ffb27b' : '#8cafd2', transparent: true, opacity: 0.48, depthWrite: false }));
  trail.frustumCulled = false; group.userData.trail = trail;
  return { group, trail, positions: [], sample: 0, type: body.type };
}

function remapRingUv(geometry, inner, outer) {
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
}

export function bodyName(body) {
  return body.name || `${BODY_TYPES[body.type]?.label || 'Astro'} ${body.id.slice(1)}`;
}
