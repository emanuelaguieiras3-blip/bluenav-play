import { std, glowTexture } from './common.js';
import { BODY_TYPES, circularVelocity, makeBody, stepUniverse, tidalRadius } from './universePhysics.js';

const MAX_BODIES = 48;
const TOOL_LABELS = { star: 'Estrela', planet: 'Planeta', moon: 'Lua', blackhole: 'Buraco negro', meteor: 'Meteoro' };
const V = (THREE, p) => new THREE.Vector3(p.x, p.y, p.z);
const P = vector => ({ x: vector.x, y: vector.y, z: vector.z });

function solarTexture(THREE) {
  const width = 256, height = 128, pixels = new Uint8Array(width * height * 4);
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const smooth = (x, y, scale) => {
    const gx = x / scale, gy = y / scale, ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = gx - ix, fy = gy - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const coarse = smooth(x, y, 24), medium = smooth(x, y, 7), fine = smooth(x, y, 2);
    const swirl = Math.sin(x * 0.12 + y * 0.13 + coarse * 8) * 0.12;
    const heat = Math.max(0, Math.min(1, coarse * 0.42 + medium * 0.33 + fine * 0.17 + swirl + 0.06));
    const i = (y * width + x) * 4;
    pixels[i] = 240 + heat * 15;
    pixels[i + 1] = 69 + heat * 176;
    pixels[i + 2] = 12 + heat * 76;
    pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function destroy(group) {
  group.parent?.remove(group);
  group.traverse(object => {
    object.geometry?.dispose?.();
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose?.();
  });
}

function starfield(THREE, root) {
  const points = new Float32Array(360 * 3), colors = new Float32Array(360 * 3);
  for (let i = 0; i < 360; i++) {
    const a = i * 2.399963, y = ((i * 73) % 359) / 359 * 2 - 1, r = Math.sqrt(1 - y * y);
    points.set([Math.cos(a) * r * 70, y * 70, -8 + Math.sin(a) * r * 70], i * 3);
    const shade = 0.45 + ((i * 97) % 101) / 202;
    colors.set([shade, shade * (i % 5 ? 1 : 0.85), 1], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  root.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#ffffff', vertexColors: true, size: 0.18, sizeAttenuation: true, depthWrite: false })));
}

function bodyVisual(ctx, body, sunMap, lightEnabled = true) {
  const { THREE, tex, lowEnd } = ctx;
  const group = new THREE.Group(); group.name = `celestial-${body.id}`;
  let material;
  if (body.type === 'star') material = new THREE.MeshBasicMaterial({ map: sunMap, color: '#fff3d8', toneMapped: false });
  else if (body.type === 'planet') material = std({ map: tex.get('earth'), color: '#d3e7fa', roughness: 0.95 });
  else if (body.type === 'moon') material = std({ map: tex.get('roughStone'), color: '#b6bbc6', roughness: 1 });
  else if (body.type === 'blackhole') material = new THREE.MeshBasicMaterial({ color: '#020207' });
  else material = std({ map: tex.get('roughStone'), color: '#9a7661', roughness: 1 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(BODY_TYPES[body.type].radius, lowEnd ? 16 : 32, lowEnd ? 12 : 20), material);
  group.add(core); group.userData.core = core;
  if (body.type === 'star') {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,125,1)', 'rgba(255,99,25,0)'), color: '#ffad6b', transparent: true,
      opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(3.3, 3.3, 1); group.add(glow);
    if (!lowEnd && lightEnabled) { const light = new THREE.PointLight('#ffce96', 10, 16, 2); group.add(light); }
  }
  if (body.type === 'planet') {
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(body.radius * 1.045, 24, 16), new THREE.MeshBasicMaterial({ color: '#7abbf1', transparent: true, opacity: 0.13,
      side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(atmosphere);
  }
  if (body.type === 'blackhole') {
    const disk = new THREE.Mesh(new THREE.RingGeometry(0.53, 1.35, 80, 8), new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float time; varying vec2 vUv; void main(){vec2 p=vUv-0.5; float r=length(p)*2.0; float a=atan(p.y,p.x); float spiral=sin(a*11.0-r*22.0-time*4.0); float turbulence=sin(a*23.0+r*31.0+time*2.0); float glow=smoothstep(1.0,0.18,r)*smoothstep(0.12,0.36,r); float hot=clamp(1.0-r+spiral*0.16+turbulence*0.06,0.0,1.0); vec3 c=mix(vec3(0.35,0.16,0.52),vec3(1.0,0.45,0.08),hot); c=mix(c,vec3(1.0,0.91,0.56),pow(hot,4.0)); gl_FragColor=vec4(c,glow*(0.54+0.21*spiral));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }));
    disk.rotation.x = -0.36; group.add(disk); group.userData.disk = disk;
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.028, 8, 64), new THREE.MeshBasicMaterial({ color: '#a6d6ff', transparent: true, opacity: 0.73 }));
    group.add(lens);
  }
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: body.type === 'meteor' ? '#ffb27b' : '#8cafd2', transparent: true, opacity: 0.48, depthWrite: false }));
  trail.frustumCulled = false; group.userData.trail = trail;
  return { group, trail, positions: [], sample: 0 };
}

export default {
  id: 'universe',
  create(ctx) {
    const { THREE, root, env, audio, input } = ctx;
    env.set({ top: '#030815', horizon: '#111c38', bottom: '#050816', fog: { color: '#050816', near: 45, far: 105 },
      hemi: ['#788ac5', '#15172b', 0.55], sun: ['#bcc9ff', 0.35], sunPos: [-5, 10, 5] });
    starfield(THREE, root);
    const bodiesRoot = new THREE.Group(); bodiesRoot.name = 'universe-bodies'; root.add(bodiesRoot);
    const effectsRoot = new THREE.Group(); effectsRoot.name = 'universe-effects'; root.add(effectsRoot);
    const state = { bodies: [], time: 0, paused: false, speed: 1, selected: null, impactSeen: false, lastImpactType: null, tidalSeen: false, complete: false, nextId: 1 };
    const sunMap = solarTexture(THREE);
    const visuals = new Map(), effects = [], tides = new Map();
    const net = ctx.app?.network, pendingEvents = [], lastCommand = new Map();
    let syncClock = 0;
    const guest = () => !!(net?.room && net.id !== net.host);
    let message = 'Escolha um corpo e pince no espaço para colocá-lo.', messageTime = 5;
    ctx.teleport({ enabled: false, walk: false });
    ctx.objective?.('Crie estrela, planeta e lua. Observe um impacto ou uma maré gravitacional.');

    function status(text, seconds = 4) { message = text; messageTime = seconds; }
    function spawn(type, position, velocity) {
      if (guest()) { net.sendEvent('universe-command', { action: 'spawn', type, position }); return null; }
      if (!BODY_TYPES[type] || state.bodies.length >= MAX_BODIES) { status('Limite de 48 corpos. Reinicie para criar outro sistema.'); return null; }
      if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) return null;
      const pos = { x: Math.max(-12, Math.min(12, position.x)), y: Math.max(-5, Math.min(8, position.y)), z: Math.max(-22, Math.min(-3, position.z)) };
      const centralType = type === 'moon' ? 'planet' : type === 'planet' ? 'star' : null;
      const central = centralType && state.bodies.filter(b => b.type === centralType)
        .sort((a, b) => V(THREE, a.position).distanceToSquared(V(THREE, pos)) - V(THREE, b.position).distanceToSquared(V(THREE, pos)))[0];
      if (!velocity && central) velocity = circularVelocity(central, pos);
      if (!velocity && type === 'meteor') {
        const target = state.bodies.find(b => b.type === 'planet');
        if (target) velocity = P(V(THREE, target.position).sub(V(THREE, pos)).normalize().multiplyScalar(3.5).add(V(THREE, target.velocity)));
      }
      const body = makeBody(type, `u${state.nextId++}`, pos, velocity);
      state.bodies.push(body);
      const visual = bodyVisual(ctx, body, sunMap, state.bodies.filter(item => item.type === 'star').length <= 2);
      bodiesRoot.add(visual.group, visual.trail); visuals.set(body.id, visual);
      status(`${TOOL_LABELS[type]} criado. ${state.bodies.length}/${MAX_BODIES} corpos.`);
      return body;
    }
    function clear() {
      if (guest()) { net.sendEvent('universe-command', { action: 'clear' }); return; }
      for (const visual of visuals.values()) { destroy(visual.group); destroy(visual.trail); }
      visuals.clear();
      for (const effect of effects) destroy(effect.group);
      effects.length = 0;
      for (const lines of tides.values()) for (const line of lines) destroy(line);
      tides.clear();
      Object.assign(state, { bodies: [], time: 0, impactSeen: false, lastImpactType: null, tidalSeen: false, complete: false, nextId: 1, paused: false });
    }
    function preset(kind) {
      if (guest()) { net.sendEvent('universe-command', { action: 'preset', kind }); return; }
      clear();
      if (kind === 'impact') {
        const sun = spawn('star', { x: -3, y: 1.5, z: -9 });
        const earth = spawn('planet', { x: 2, y: 1.5, z: -9 }, circularVelocity(sun, { x: 2, y: 1.5, z: -9 }));
        const moonPosition = { x: 2.85, y: 1.5, z: -8 };
        spawn('moon', moonPosition, circularVelocity(earth, moonPosition));
        spawn('meteor', { x: 4.4, y: 1.5, z: -9 }, { x: earth.velocity.x - 3.5, y: 0, z: earth.velocity.z });
        status('Impacto: observe o meteoro atingir o planeta.');
      } else if (kind === 'tidal') {
        spawn('blackhole', { x: -1.4, y: 1.5, z: -9 });
        spawn('star', { x: 1.65, y: 1.5, z: -9 }, { x: -0.28, y: 0, z: 0.15 });
        status('Maré: a gravidade arranca matéria da estrela.');
      } else {
        const sun = spawn('star', { x: -3, y: 1.5, z: -9 });
        const earth = spawn('planet', { x: 2, y: 1.5, z: -9 }, circularVelocity(sun, { x: 2, y: 1.5, z: -9 }));
        spawn('moon', { x: 2.9, y: 1.5, z: -9 }, { ...earth.velocity, z: earth.velocity.z + Math.sqrt(0.045 * earth.mass / 0.9) });
        status('Sistema: estrela, planeta e lua em movimento.');
      }
    }
    function togglePause() {
      if (guest()) { net.sendEvent('universe-command', { action: 'pause' }); return; }
      state.paused = !state.paused;
      pauseButton.userData.setLabel?.(state.paused ? 'Continuar' : 'Pausar');
    }
    function cycleSpeed() {
      if (guest()) { net.sendEvent('universe-command', { action: 'speed' }); return; }
      state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 0.5;
      speedButton.userData.setLabel?.(`Velocidade ${state.speed}×`);
    }

    const tools = Object.keys(TOOL_LABELS);
    tools.forEach((type, i) => {
      const button = ctx.button({ label: TOOL_LABELS[type], w: type === 'blackhole' ? 0.34 : 0.23, h: 0.075,
        onClick: () => { state.selected = type; status(`${TOOL_LABELS[type]} selecionado. Pince onde quer criar.`); } });
      button.position.set(-1.15 + i * 0.57, 1.16, -1.45); root.add(button);
    });
    [['Sistema', 'system'], ['Impacto', 'impact'], ['Maré', 'tidal']].forEach(([label, kind], i) => {
      const button = ctx.button({ label, w: 0.27, h: 0.075, onClick: () => preset(kind) });
      button.position.set(-0.7 + i * 0.7, 0.98, -1.45); root.add(button);
    });
    const pauseButton = ctx.button({ label: 'Pausar', w: 0.25, h: 0.075, onClick: togglePause });
    pauseButton.position.set(-0.47, 0.8, -1.45); root.add(pauseButton);
    const resetButton = ctx.button({ label: 'Limpar', w: 0.25, h: 0.075, onClick: clear });
    resetButton.position.set(0.05, 0.8, -1.45); root.add(resetButton);
    const speedButton = ctx.button({ label: 'Velocidade 1×', w: 0.35, h: 0.075, onClick: cycleSpeed });
    speedButton.position.set(0.67, 0.8, -1.45); root.add(speedButton);
    const title = ctx.label('UNIVERSE SANDBOX', { w: 2.8, h: 0.21, size: 0.36, bg: 'rgba(2,8,22,.84)' });
    title.position.set(0, 2.8, -3.2); root.add(title);
    const mark = new THREE.Group(); mark.position.set(-1.53, 2.8, -3.16);
    mark.add(new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 8, 24), new THREE.MeshBasicMaterial({ color: '#93cfff' })));
    mark.add(new THREE.Mesh(new THREE.SphereGeometry(0.037, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffbf7e' })));
    root.add(mark);

    function createImpact(event) {
      const target = state.bodies.find(body => body.id === event.targetId);
      if (!target) return;
      const group = new THREE.Group(); effectsRoot.add(group);
      if (effects.length >= 8) { destroy(effects[0].group); effects.shift(); }
      const wave = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.ShaderMaterial({
        uniforms: { opacity: { value: 0.75 } }, transparent: true, depthWrite: false, side: THREE.FrontSide, toneMapped: false,
        blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
        fragmentShader: 'uniform float opacity; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),1.5); gl_FragColor=vec4(1.0,0.28,0.04,rim*opacity);}',
      }));
      wave.position.copy(V(THREE, target.position)); group.add(wave);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 7, 48), new THREE.MeshBasicMaterial({ color: '#ffcc8e', transparent: true, opacity: 0.9, depthWrite: false }));
      ring.position.copy(V(THREE, event.point));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(THREE, event.direction));
      group.add(ring);
      const targetVisual = visuals.get(target.id);
      if (targetVisual && target.type === 'planet') {
        const crater = new THREE.Mesh(new THREE.CircleGeometry(0.07 + Math.min(0.05, event.speed * 0.01), 24),
          new THREE.MeshBasicMaterial({ color: '#261c1b', side: THREE.DoubleSide, depthWrite: false }));
        crater.position.copy(V(THREE, event.direction).multiplyScalar(BODY_TYPES.planet.radius * 1.018));
        crater.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(THREE, event.direction));
        targetVisual.group.add(crater);
      }
      const debris = [];
      const point = V(THREE, event.point), normal = V(THREE, event.direction);
      const tangent = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
      if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
      const bitangent = normal.clone().cross(tangent).normalize();
      for (let i = 0; i < (ctx.lowEnd ? 8 : 18); i++) {
        const angle = i * 2.399, direction = normal.clone().multiplyScalar(0.5).addScaledVector(tangent, Math.cos(angle)).addScaledVector(bitangent, Math.sin(angle)).normalize();
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025 + (i % 3) * 0.012, 0), std({ color: i % 2 ? '#e8c8a6' : '#8a7466', roughness: 1 }));
        mesh.position.copy(point); group.add(mesh);
        debris.push({ mesh, velocity: direction.multiplyScalar(0.7 + event.speed * 0.32), life: 1.8 });
      }
      effects.push({ group, ring, wave, debris, age: 0, targetId: target.id });
      state.impactSeen = true; state.lastImpactType = target.type;
      status('Impacto: onda de choque e destroços lançados.'); audio.thud?.();
    }
    function updateEffects(dt) {
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i], target = state.bodies.find(body => body.id === effect.targetId);
        effect.age += dt;
        effect.ring.scale.setScalar(Math.min(target?.radius * 0.65 || 0.3, 0.02 + effect.age * 0.8));
        effect.ring.material.opacity = Math.max(0, 0.9 * (1 - effect.age / 1.7));
        if (target) effect.wave.position.copy(V(THREE, target.position));
        effect.wave.scale.setScalar((target?.radius || 0.4) + effect.age * 0.75);
        effect.wave.material.uniforms.opacity.value = Math.max(0, 0.8 * (1 - effect.age / 1.5));
        for (const debris of effect.debris) {
          if (debris.life <= 0) continue;
          debris.life -= dt;
          if (target) {
            const gravity = V(THREE, target.position).sub(debris.mesh.position);
            const distance = Math.max(0.18, gravity.length());
            debris.velocity.addScaledVector(gravity.normalize(), Math.min(5, 0.045 * target.mass / (distance * distance)) * dt);
          }
          debris.mesh.position.addScaledVector(debris.velocity, dt);
          debris.mesh.rotation.x += dt * 3; debris.mesh.rotation.y += dt * 4;
          if (target && debris.mesh.position.distanceTo(V(THREE, target.position)) < target.radius * 0.8) debris.life = 0;
          debris.mesh.visible = debris.life > 0;
        }
        if (effect.age > 1.8) { destroy(effect.group); effects.splice(i, 1); }
      }
    }
    function updateTides() {
      for (const [key, record] of tides) {
        const hole = state.bodies.find(body => body.id === record.holeId), star = state.bodies.find(body => body.id === record.starId);
        if (!hole || !star || state.time > record.expires) {
          for (const line of record.lines) destroy(line);
          tides.delete(key); continue;
        }
        const a = V(THREE, star.position), b = V(THREE, hole.position), direction = b.clone().sub(a).normalize();
        const side = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        if (side.lengthSq() < 0.01) side.set(1, 0, 0);
        const up = direction.clone().cross(side).normalize();
        record.lines.forEach((line, lane) => {
          const attr = line.geometry.attributes.position;
          for (let i = 0; i < 32; i++) {
            const t = i / 31, spiral = t * Math.PI * 4 + state.time * 5 + lane * Math.PI * 2 / 3;
            const spread = (1 - t) * 0.28 + 0.03;
            const point = a.clone().lerp(b, t)
              .addScaledVector(side, Math.cos(spiral) * spread)
              .addScaledVector(up, Math.sin(spiral) * spread);
            attr.setXYZ(i, point.x, point.y, point.z);
          }
          attr.needsUpdate = true;
        });
      }
    }
    function markTide(event) {
      const key = `${event.starId}:${event.holeId}`;
      let record = tides.get(key);
      if (!record) {
        if (tides.size >= 4) { state.tidalSeen = true; return; }
        const lines = Array.from({ length: 3 }, () => {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 3), 3).setUsage(THREE.DynamicDrawUsage));
          const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ffb55c', transparent: true, opacity: 0.83, depthWrite: false }));
          line.frustumCulled = false; effectsRoot.add(line); return line;
        });
        record = { holeId: event.holeId, starId: event.starId, lines, expires: 0 }; tides.set(key, record);
        status('Maré gravitacional: matéria estelar flui para o buraco negro.');
      }
      record.expires = state.time + 0.4; state.tidalSeen = true;
    }
    function updateVisuals(dt) {
      for (const [id, visual] of visuals) if (!state.bodies.some(body => body.id === id)) {
        destroy(visual.group); destroy(visual.trail); visuals.delete(id);
      }
      for (const body of state.bodies) {
        const visual = visuals.get(body.id); if (!visual) continue;
        visual.group.position.copy(V(THREE, body.position));
        visual.group.rotation.y += dt * (body.type === 'star' ? 0.32 : body.type === 'blackhole' ? 0 : 0.6);
        visual.group.scale.setScalar(body.radius / BODY_TYPES[body.type].radius);
        if (body.type === 'blackhole') {
          visual.group.userData.disk.rotation.z += dt * 0.15;
          visual.group.userData.disk.material.uniforms.time.value = state.time;
        }
        if (body.type === 'star') {
          const hole = state.bodies.filter(other => other.type === 'blackhole')
            .sort((a, b) => V(THREE, a.position).distanceToSquared(visual.group.position) - V(THREE, b.position).distanceToSquared(visual.group.position))[0];
          if (hole) {
            const distance = V(THREE, hole.position).distanceTo(visual.group.position);
            if (distance < tidalRadius(hole, body)) {
              const stretch = 1 + (1 - distance / tidalRadius(hole, body)) * 2.4;
              visual.group.userData.core.scale.z = stretch;
              visual.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(THREE, hole.position).sub(visual.group.position).normalize());
            } else { visual.group.userData.core.scale.z = 1; visual.group.quaternion.identity(); }
          }
        }
        visual.sample += dt;
        if (visual.sample >= 0.12) {
          visual.sample = 0; visual.positions.push(body.position.x, body.position.y, body.position.z);
          if (visual.positions.length > 48 * 3) visual.positions.splice(0, 3);
          visual.trail.geometry.attributes.position.array.set(visual.positions);
          visual.trail.geometry.attributes.position.needsUpdate = true;
          visual.trail.geometry.setDrawRange(0, visual.positions.length / 3);
          visual.trail.geometry.computeBoundingSphere();
        }
      }
    }
    const round = value => Math.round(value * 1000) / 1000;
    const encodeBody = body => [body.id, body.type, round(body.mass), round(body.radius),
      round(body.position.x), round(body.position.y), round(body.position.z),
      round(body.velocity.x), round(body.velocity.y), round(body.velocity.z)];
    function decodeBody(row) {
      if (!Array.isArray(row) || row.length !== 10 || !/^u\d{1,5}$/.test(row[0]) || !BODY_TYPES[row[1]] ||
          !row.slice(2).every(value => Number.isFinite(value) && Math.abs(value) < 50000) || row[2] <= 0 || row[3] <= 0) return null;
      return { id: row[0], type: row[1], mass: row[2], radius: row[3],
        position: { x: row[4], y: row[5], z: row[6] }, velocity: { x: row[7], y: row[8], z: row[9] } };
    }
    function applySnapshot(data, sender) {
      if (!guest() || sender !== net.host || !data || !Array.isArray(data.bodies) || data.bodies.length > MAX_BODIES) return;
      const bodies = data.bodies.map(decodeBody);
      if (bodies.some(body => !body) || new Set(bodies.map(body => body.id)).size !== bodies.length ||
          !Number.isFinite(data.time) || data.time < 0 || data.time > 1e8) return;
      state.bodies = bodies; state.time = data.time;
      state.paused = !!data.paused;
      state.speed = [0.5, 1, 2, 4].includes(data.speed) ? data.speed : 1;
      state.impactSeen = !!data.impactSeen; state.tidalSeen = !!data.tidalSeen; state.complete = !!data.complete;
      state.nextId = Math.max(state.nextId, ...bodies.map(body => Number(body.id.slice(1)) + 1), 1);
      for (const body of bodies) if (!visuals.has(body.id)) {
        const visual = bodyVisual(ctx, body, sunMap, bodies.filter(item => item.type === 'star').indexOf(body) < 2);
        bodiesRoot.add(visual.group, visual.trail); visuals.set(body.id, visual);
      }
      for (const event of Array.isArray(data.events) ? data.events.slice(0, 12) : []) {
        if (event?.type === 'impact' && event.targetId && event.point && event.direction &&
            Object.values(event.point).every(Number.isFinite) && Object.values(event.direction).every(Number.isFinite) &&
            Number.isFinite(event.speed)) createImpact(event);
        else if (event?.type === 'tidal' && event.holeId && event.starId) markTide(event);
      }
    }
    function receiveCommand(data, sender) {
      if (!net?.room || net.host !== net.id || sender === net.id || !data || typeof data !== 'object') return;
      const now = Date.now(); if (now - (lastCommand.get(sender) || 0) < 90) return; lastCommand.set(sender, now);
      if (data.action === 'spawn' && BODY_TYPES[data.type] && data.position &&
          [data.position.x, data.position.y, data.position.z].every(value => Number.isFinite(value) && Math.abs(value) <= 30)) {
        spawn(data.type, data.position);
      } else if (data.action === 'preset' && ['system', 'impact', 'tidal'].includes(data.kind)) preset(data.kind);
      else if (data.action === 'clear') clear();
      else if (data.action === 'pause') togglePause();
      else if (data.action === 'speed') cycleSpeed();
    }
    const unsubscribe = net ? [net.on?.('universe-command', receiveCommand), net.on?.('universe-state', applySnapshot)] : [];
    ctx.onDispose?.(() => unsubscribe.forEach(stop => stop?.()));
    if (!guest()) preset('system');
    function placeFromPointer(pointer) {
      if (!state.selected || pointer.uiBusy || !pointer.ray) return;
      const position = pointer.ray.at(8, new THREE.Vector3());
      if (position.z > -2.5 || position.z < -25) return;
      spawn(state.selected, P(position)); pointer.uiBusy = true;
    }
    return {
      state, spawn, preset, clear,
      update(dt) {
        dt = Math.max(0, Math.min(0.05, dt)); messageTime = Math.max(0, messageTime - dt);
        for (let i = 0; i < tools.length; i++) if (input.keys.has(`Digit${i + 1}`)) { state.selected = tools[i]; input.keys.delete(`Digit${i + 1}`); }
        if (input.keys.has('Space')) { togglePause(); input.keys.delete('Space'); }
        if (input.keys.has('KeyR')) { clear(); input.keys.delete('KeyR'); }
        if (input.keys.has('KeyI')) { preset('impact'); input.keys.delete('KeyI'); }
        if (input.keys.has('KeyB')) { preset('tidal'); input.keys.delete('KeyB'); }
        for (const pointer of ctx.pointers()) if (pointer.pinchDown) placeFromPointer(pointer);
        const simulated = state.paused || guest() ? 0 : dt * state.speed;
        const events = simulated ? stepUniverse(state, simulated) : [];
        for (const event of events) {
          if (event.type === 'impact') createImpact(event);
          else if (event.type === 'tidal') markTide(event);
          else if (event.type === 'consume') status('Buraco negro absorveu um corpo.');
        }
        updateVisuals(dt); updateTides(); updateEffects(dt);
        if (net?.room && !guest()) {
          pendingEvents.push(...events.filter(event => ['impact', 'tidal', 'consume'].includes(event.type)));
          syncClock += dt;
          if (syncClock >= 0.2) {
            syncClock = 0;
            net.sendEvent('universe-state', { bodies: state.bodies.map(encodeBody), time: round(state.time),
              paused: state.paused, speed: state.speed, impactSeen: state.impactSeen, tidalSeen: state.tidalSeen,
              complete: state.complete, events: pendingEvents.splice(0, 12) });
            pendingEvents.length = 0;
          }
        }
        const has = type => state.bodies.some(body => body.type === type);
        if (!state.complete && has('star') && has('planet') && has('moon') && (state.impactSeen || state.tidalSeen)) {
          state.complete = true; ctx.objective?.('Objetivo concluído. Continue criando e testando o universo.'); audio.success?.();
        }
        ctx.hud(`Universe Sandbox · ${state.bodies.length}/${MAX_BODIES} corpos · ${state.speed}×${state.paused ? ' · pausado' : ''}`,
          messageTime ? message : `1–5 escolhem corpo; pince para criar. Sistema, Impacto e Maré mostram fenômenos. ${state.complete ? 'Objetivo concluído.' : ''}`);
      },
    };
  },
};
