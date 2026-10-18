import { BODY_TYPES, circularVelocity, climateOf, detonate, dominantBody, kindOf, lifetimeOf, makeBody, orbitalElements,
  predictTrajectory, stepUniverse, temperatureOf, tidalRadius } from './universePhysics.js';
import { EDIT_ACTIONS, editCelestialBody, setCelestialValue, valueRange } from './universeEditing.js';
import { UniverseHistory, loadSlot, sanitizeBodies, saveSlot, slotInfo } from './universeStore.js';
import { AssistTurn, createFlight, rotateAbout, speedOf, stepFlight } from './universeFlight.js';
import { WalkIntent } from '../core/locomotion.js';
import { bodyName, bodyVisual, createMaps, destroy, starfield } from './universeVisuals.js';
import { UniverseEffects, UniverseOverlays } from './universeEffects.js';
import { UniversePanels } from './universeUI.js';
import { UniverseDesktop } from './universeDesktop.js';
import { PRESET_IDS, SPEEDS, TOOL_HINTS, TOOLS, labelOf } from './universeCatalog.js';

const MAX_BODIES = 64;
const DIGIT_TYPES = ['star', 'planet', 'moon', 'blackhole', 'meteor', 'bluegiant', 'gasgiant', 'comet', 'whitehole'];
const WORLD_LIMIT = 88;
const V = (THREE, p) => new THREE.Vector3(p.x, p.y, p.z);
const P = vector => ({ x: vector.x, y: vector.y, z: vector.z });
const finiteVector = (v, limit = 100) => v && ['x', 'y', 'z'].every(axis => Number.isFinite(v[axis]) && Math.abs(v[axis]) <= limit);
const fmt = (value, digits = 2) => value >= 1000 ? value.toFixed(0) : value.toFixed(digits);

function comfortVignette(THREE) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float strength; varying vec2 vUv; void main(){float r=length(vUv-0.5)*2.0; gl_FragColor=vec4(0.0,0.0,0.0,smoothstep(0.32,0.62,r)*strength);}',
  }));
  mesh.position.z = -0.1; mesh.renderOrder = 995; mesh.name = 'universe-vignette'; mesh.visible = false; mesh.frustumCulled = false;
  return mesh;
}

export default {
  id: 'universe',
  create(ctx) {
    const { THREE, root, env, audio, input } = ctx;
    env.set({ top: '#030815', horizon: '#111c38', bottom: '#050816', fog: { color: '#050816', near: 45, far: 105 },
      hemi: ['#788ac5', '#15172b', 0.55], sun: ['#bcc9ff', 0.35], sunPos: [-5, 10, 5] });
    const stars = starfield(THREE, root);
    const bodiesRoot = new THREE.Group(); bodiesRoot.name = 'universe-bodies'; root.add(bodiesRoot);
    const effectsRoot = new THREE.Group(); effectsRoot.name = 'universe-effects'; root.add(effectsRoot);
    const state = { bodies: [], time: 0, paused: false, speed: 1, selected: null, tool: 'select', selectedBodyId: null, followId: null,
      trajectoryVisible: true, evolution: true, impactSeen: false, lastImpactType: null, tidalSeen: false, complete: false, nextId: 1 };
    const views = { orbits: true, labels: false, plane: false, vectors: false, grid: false, habitable: false, jets: true,
      lensing: !ctx.lowEnd, focus: false, assist: true, evolution: true };
    const maps = createMaps(THREE), visuals = new Map(), history = new UniverseHistory();
    const net = ctx.app?.network, pendingEvents = [], lastCommand = new Map();
    const storage = ctx.storage !== undefined ? ctx.storage : (() => { try { return typeof window !== 'undefined' && window.localStorage || null; } catch { return null; } })();
    let syncClock = 0, climateClock = 0;
    const guest = () => !!(net?.room && net.id !== net.host);
    const flat = () => ctx.app?.mode === 'flat' && !ctx.app?.renderer?.xr?.isPresenting;
    let message = 'Escolha um astro no menu e pince no espaço para criá-lo.', messageTime = 5;
    ctx.teleport({ enabled: false, walk: false });
    ctx.freeFlight?.(true);
    ctx.objective?.('Crie estrela, planeta e lua. Observe um impacto ou uma estrela despedaçada por um buraco negro.');

    const status = (text, seconds = 4) => { message = text; messageTime = seconds; };
    const bodyById = id => state.bodies.find(body => body.id === id);
    const effects = new UniverseEffects(ctx, effectsRoot, { body: bodyById, visual: id => visuals.get(id), status, audio });
    const overlays = new UniverseOverlays(ctx, effectsRoot, MAX_BODIES);
    const planeGrid = new THREE.GridHelper(120, 60, '#2c5a8c', '#173352');
    planeGrid.material.transparent = true; planeGrid.material.opacity = 0.35; planeGrid.material.depthWrite = false;
    planeGrid.name = 'universe-orbital-plane'; planeGrid.visible = false; root.add(planeGrid);

    function eyePosition() { return ctx.camera ? ctx.camera.getWorldPosition(new THREE.Vector3()) : null; }
    function presetCenter() {
      const eye = eyePosition();
      if (!eye) return { x: 0, y: 1.5, z: -9 };
      const forward = new THREE.Vector3(0, 0, -1).transformDirection(ctx.camera.matrixWorld); forward.y = 0;
      if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
      forward.normalize();
      return { x: eye.x + forward.x * 9, y: eye.y - 0.1, z: eye.z + forward.z * 9 };
    }
    function clampToWorld(position) {
      const r = Math.hypot(position.x, position.y, position.z);
      return r > WORLD_LIMIT ? { x: position.x / r * WORLD_LIMIT, y: position.y / r * WORLD_LIMIT, z: position.z / r * WORLD_LIMIT } : { ...position };
    }

    function spawn(type, position, velocity, { record = true, quiet = false } = {}) {
      if (guest()) {
        if (BODY_TYPES[type] && finiteVector(position)) net.sendEvent('universe-command', { action: 'spawn', type, position: P(position), ...(finiteVector(velocity, 40) ? { velocity: P(velocity) } : {}) });
        return null;
      }
      if (!BODY_TYPES[type] || state.bodies.length >= MAX_BODIES) { status(`Limite de ${MAX_BODIES} corpos. Apague algo ou limpe o sistema.`); return null; }
      if (!finiteVector(position, 1e4)) return null;
      if (record) history.record(state);
      const pos = clampToWorld(position), mass = BODY_TYPES[type].mass;
      if (!velocity && type === 'meteor') {
        const target = state.bodies.filter(b => kindOf(b) === 'planet')
          .sort((a, b) => V(THREE, a.position).distanceToSquared(V(THREE, pos)) - V(THREE, b.position).distanceToSquared(V(THREE, pos)))[0];
        if (target) velocity = P(V(THREE, target.position).sub(V(THREE, pos)).normalize().multiplyScalar(3.5).add(V(THREE, target.velocity)));
      }
      if (!velocity) {
        const central = dominantBody(state.bodies, pos, mass);
        if (central) {
          velocity = circularVelocity(central, pos);
          if (type === 'comet') velocity = P(V(THREE, velocity).sub(V(THREE, central.velocity)).multiplyScalar(0.55).add(V(THREE, central.velocity)));
        }
      }
      const body = makeBody(type, `u${state.nextId++}`, pos, velocity);
      state.bodies.push(body);
      if (!quiet) status(`${labelOf(type)} criado. ${state.bodies.length}/${MAX_BODIES} corpos.`);
      return body;
    }
    function resetFlags() {
      Object.assign(state, { impactSeen: false, lastImpactType: null, tidalSeen: false, complete: false });
    }
    function clear({ record = true } = {}) {
      if (guest()) { net.sendEvent('universe-command', { action: 'clear' }); return; }
      if (record && state.bodies.length) history.record(state);
      effects.clear();
      Object.assign(state, { bodies: [], time: 0, nextId: 1, paused: false, selectedBodyId: null, followId: null });
      resetFlags();
    }
    function orbiting(type, central, offset, { tilt = 0 } = {}) {
      const position = { x: central.position.x + offset.x, y: central.position.y + (offset.y || 0), z: central.position.z + offset.z };
      const velocity = circularVelocity(central, position);
      if (tilt) velocity.y += tilt;
      return spawn(type, position, velocity, { record: false, quiet: true });
    }
    function preset(kind) {
      if (guest()) { net.sendEvent('universe-command', { action: 'preset', kind }); return; }
      if (!PRESET_IDS.includes(kind)) return;
      clear({ record: state.bodies.length > 0 });
      const c = presetCenter(), at = (x, y, z) => ({ x: c.x + x, y: c.y + y, z: c.z + z });
      const quiet = { record: false, quiet: true };
      if (kind === 'impact') {
        const sun = spawn('star', at(-5, 0, 0), undefined, quiet);
        const earth = orbiting('planet', sun, { x: 9, z: 0 });
        orbiting('moon', earth, { x: 0.85, z: 0 });
        spawn('meteor', at(4, 0, 2.4), { x: earth.velocity.x, y: 0, z: earth.velocity.z - 3.5 }, quiet);
        status('Impacto: observe o meteoro atingir o planeta.');
      } else if (kind === 'tidal') {
        const hole = spawn('blackhole', at(-1.4, 0, 0), undefined, quiet);
        const position = at(1.8, 0, 0), velocity = circularVelocity(hole, position);
        // Orbit tilted 45° toward the viewer so the accretion disk is seen face-on, not edge-on.
        const speed = Math.hypot(velocity.x, velocity.z) * 0.8 * Math.SQRT1_2;
        spawn('star', position, { x: 0, y: speed, z: Math.sign(velocity.z || 1) * speed }, quiet);
        status('Estrela vs buraco negro: a maré vai despedaçar a estrela.');
      } else if (kind === 'solar') {
        const sun = spawn('star', at(-5, 0, 0), undefined, quiet);
        orbiting('rocky', sun, { x: 3.6, z: 0 });
        orbiting('rocky', sun, { x: 0, z: 6.4 });
        const earth = orbiting('planet', sun, { x: 9, z: 0 });
        orbiting('moon', earth, { x: 0.85, z: 0 });
        orbiting('rocky', sun, { x: -12.5, z: 0 });
        orbiting('gasgiant', sun, { x: 0, z: -19 });
        orbiting('ringed', sun, { x: 25, z: 0 });
        orbiting('icy', sun, { x: 0, z: 31 });
        status('Sistema Solar compacto: oito corpos em órbita.');
      } else if (kind === 'binary') {
        const a = spawn('star', at(-3, 0, 0), undefined, quiet), b = spawn('reddwarf', at(3, 0, 0), undefined, quiet);
        const total = a.mass + b.mass, d = 6, omega = Math.sqrt(0.045 * total / d ** 3);
        a.velocity = { x: 0, y: 0, z: -omega * d * b.mass / total }; b.velocity = { x: 0, y: 0, z: omega * d * a.mass / total };
        const barycenter = { position: at(-3 + d * b.mass / total, 0, 0), velocity: { x: 0, y: 0, z: 0 }, mass: total, radius: 1 };
        orbiting('planet', barycenter, { x: 15, z: 0 });
        orbiting('icy', barycenter, { x: 0, z: -21 });
        status('Sistema binário: dois sóis e planetas circumbinários.');
      } else if (kind === 'earthmoon') {
        const earth = spawn('planet', at(0, 0, 0), undefined, quiet);
        orbiting('moon', earth, { x: 0.9, z: 0 });
        orbiting('asteroid', earth, { x: 0, z: 2.2 });
        status('Terra e Lua de perto. Aproxime a Lua para ver o limite de Roche.');
      } else if (kind === 'galaxies') {
        const count = ctx.lowEnd ? 10 : 15;
        [[-12, 0, -2, 0.55, 0.25], [12, 2, 4, -0.55, -0.25]].forEach(([x, y, z, vx, vz], g) => {
          const core = spawn('smbh', at(x, y, z), { x: vx, y: 0, z: vz }, quiet);
          for (let i = 0; i < count; i++) {
            const a = i * 2.399963 + g, r = 2.6 + (i / count) * 6;
            const position = { x: core.position.x + Math.cos(a) * r, y: core.position.y + Math.sin(a * 3) * 0.2, z: core.position.z + Math.sin(a) * r };
            spawn(i % 4 === 0 ? 'star' : 'reddwarf', position, circularVelocity(core, position), quiet);
          }
        });
        status('Colisão de galáxias: dois núcleos supermassivos e suas estrelas.');
      } else if (kind === 'belt') {
        const sun = spawn('star', at(-5, 0, 0), undefined, quiet);
        orbiting('planet', sun, { x: 7, z: 0 });
        const count = ctx.lowEnd ? 18 : 30;
        for (let i = 0; i < count; i++) {
          const a = i * 2.399963, r = 10.5 + (i % 5) * 0.6;
          orbiting(i % 7 ? 'asteroid' : 'comet', sun, { x: Math.cos(a) * r, y: Math.sin(a * 5) * 0.25, z: Math.sin(a) * r });
        }
        orbiting('gasgiant', sun, { x: 0, z: 17 });
        status('Cinturão de asteroides entre a Terra e um gigante gasoso.');
      } else if (kind === 'supernova') {
        const giant = spawn('bluegiant', at(-2, 0, 0), undefined, quiet);
        giant.age = Math.max(0, lifetimeOf(giant) - 8);
        orbiting('rocky', giant, { x: 4, z: 0 });
        orbiting('planet', giant, { x: 0, z: 7.5 });
        orbiting('gasgiant', giant, { x: -12, z: 0 });
        status('A gigante azul vai explodir em cerca de 8 segundos!', 8);
      } else {
        const sun = spawn('star', at(-5, 0, 0), undefined, quiet);
        const earth = orbiting('planet', sun, { x: 9, z: 0 });
        orbiting('moon', earth, { x: 0.85, z: 0 });
        status('Sistema: estrela, planeta e lua em movimento.');
      }
    }
    function togglePause() {
      if (guest()) { net.sendEvent('universe-command', { action: 'pause' }); return; }
      state.paused = !state.paused; refreshUI();
    }
    function setSpeed(value) {
      if (!SPEEDS.includes(value)) return;
      if (guest()) { net.sendEvent('universe-command', { action: 'speed-set', value }); return; }
      state.speed = value; status(`Velocidade da simulação: ${value}×`, 2); refreshUI();
    }
    function speedStep(direction) {
      const index = Math.max(0, SPEEDS.indexOf(state.speed));
      setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, index + direction))]);
    }
    function cycleSpeed() {
      const index = SPEEDS.indexOf(state.speed);
      setSpeed(SPEEDS[(index + 1) % SPEEDS.length]);
    }
    function restore(snap) {
      state.bodies = structuredClone(snap.bodies); state.nextId = Math.max(snap.nextId || 1, ...state.bodies.map(body => Number(body.id.slice(1)) + 1), 1);
      if (Number.isFinite(snap.time)) state.time = snap.time;
      if (!bodyById(state.selectedBodyId)) state.selectedBodyId = null;
      if (!bodyById(state.followId)) state.followId = null;
    }
    function undo() {
      if (guest()) { net.sendEvent('universe-command', { action: 'undo' }); return; }
      const snap = history.undo(state);
      if (snap) { restore(snap); status('Desfeito.', 2); } else status('Nada para desfazer.', 2);
    }
    function redo() {
      if (guest()) { net.sendEvent('universe-command', { action: 'redo' }); return; }
      const snap = history.redo(state);
      if (snap) { restore(snap); status('Refeito.', 2); } else status('Nada para refazer.', 2);
    }
    function save(slot) {
      const ok = storage && saveSlot(storage, slot, state);
      status(ok ? `Sistema salvo no espaço ${slot}.` : 'Não foi possível salvar neste navegador.', 3);
      refreshUI(); return !!ok;
    }
    function load(slot) {
      const snap = storage && loadSlot(storage, slot);
      if (!snap) { status(`Espaço ${slot} vazio.`, 2); return false; }
      if (guest()) { net.sendEvent('universe-command', { action: 'restore', bodies: snap.bodies }); return true; }
      history.record(state); effects.clear(); restore(snap); resetFlags();
      status(`Sistema do espaço ${slot} carregado.`, 3); return true;
    }
    function selectType(type) {
      if (!BODY_TYPES[type]) return;
      state.selected = type; state.tool = 'create';
      status(`${labelOf(type)} selecionado. ${TOOL_HINTS.create}`); refreshUI();
    }
    function setTool(tool) {
      if (!TOOLS.some(([id]) => id === tool)) return;
      state.tool = tool; ruler.first = null;
      if (tool === 'create' && !state.selected) state.selected = 'planet';
      status(TOOL_HINTS[tool]); refreshUI();
    }
    function toggleView(id) {
      if (!(id in views)) return;
      views[id] = !views[id];
      if (id === 'orbits') state.trajectoryVisible = views.orbits;
      if (id === 'evolution') {
        if (guest()) net.sendEvent('universe-command', { action: 'evolution', on: views.evolution });
        else state.evolution = views.evolution;
      }
      if (id === 'focus' && views.focus && state.selectedBodyId) state.followId = state.selectedBodyId;
      assist.enabled = views.assist;
      Object.assign(overlays.show, { habitable: views.habitable, grid: views.grid, labels: views.labels, vectors: views.vectors });
      Object.assign(effects.options, { jets: views.jets, lensing: views.lensing });
      refreshUI();
    }
    function editSelected(action) {
      const id = state.selectedBodyId;
      if (!id) { status('Selecione um astro primeiro.'); return false; }
      if (!EDIT_ACTIONS.includes(action)) return false;
      if (guest()) { net.sendEvent('universe-command', { action: 'edit', id, edit: action }); return true; }
      history.record(state);
      const changed = editCelestialBody(state.bodies, id, action);
      if (changed) forecastClock = 0;
      status(changed ? 'Propriedade atualizada na simulação.' : 'Edição indisponível para este astro.');
      return changed;
    }
    function removeBody(id = state.selectedBodyId) {
      if (!bodyById(id)) return false;
      if (guest()) { net.sendEvent('universe-command', { action: 'remove', id }); return true; }
      history.record(state);
      state.bodies = state.bodies.filter(body => body.id !== id);
      status('Astro apagado.', 2); return true;
    }
    function duplicate(id = state.selectedBodyId) {
      const body = bodyById(id);
      if (!body) return null;
      const offset = body.radius * 2.5 + 0.4, position = { x: body.position.x + offset, y: body.position.y, z: body.position.z };
      if (guest()) { net.sendEvent('universe-command', { action: 'duplicate', id }); return null; }
      const copy = spawn(body.type, position, { ...body.velocity });
      if (copy) { copy.mass = body.mass; copy.radius = body.radius; state.selectedBodyId = copy.id; }
      return copy;
    }
    function detonateSelected(id = state.selectedBodyId) {
      const body = bodyById(id);
      if (!body || kindOf(body) !== 'star' || BODY_TYPES[body.type].compact) { status('Só estrelas vivas podem ser detonadas.'); return false; }
      if (guest()) { net.sendEvent('universe-command', { action: 'detonate', id }); return true; }
      history.record(state);
      const events = [];
      detonate(state, id, events);
      for (const event of events) handleEvent(event);
      pendingEvents.push(...events);
      return true;
    }
    function rename(name, id = state.selectedBodyId) {
      const body = bodyById(id);
      if (!body) return false;
      if (name === undefined) {
        ctx.app?.keyboard?.show?.(bodyName(body), text => rename(text, id));
        return true;
      }
      const clean = String(name).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24);
      if (guest()) { net.sendEvent('universe-command', { action: 'rename', id, name: clean }); return true; }
      if (clean) body.name = clean; else delete body.name;
      return true;
    }
    function moveBody(id, position) {
      const body = bodyById(id);
      if (!body || !finiteVector(position)) return;
      if (guest()) { net.sendEvent('universe-command', { action: 'move', id, position: P(position) }); return; }
      body.position = clampToWorld(position);
    }
    function launch(id, type, position, velocity) {
      if (guest()) { net.sendEvent('universe-command', { action: 'launch', id, type, position: P(position), velocity: P(velocity) }); return; }
      const body = id && bodyById(id);
      if (body) { body.velocity = { ...velocity }; body.position = clampToWorld(position); status('Lançado!', 2); }
      else spawn(type, position, velocity);
    }

    // Slider mapping: logarithmic mass and radius, squared speed for finer low values.
    const sliderMaps = {
      mass: { get: (body, [lo, hi]) => Math.log(body.mass / lo) / Math.log(hi / lo), set: (t, [lo, hi]) => lo * (hi / lo) ** t, text: body => fmt(body.mass) },
      radius: { get: (body, [lo, hi]) => Math.log(body.radius / lo) / Math.log(hi / lo), set: (t, [lo, hi]) => lo * (hi / lo) ** t, text: body => body.radius.toFixed(2) },
      speed: { get: (body, [, hi]) => Math.sqrt(Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z) / hi), set: (t, [, hi]) => hi * t * t,
        text: body => Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z).toFixed(2) },
    };
    let sliderActive = false, sliderClock = 0;
    function sliderValue(key) {
      const body = bodyById(state.selectedBodyId), map = sliderMaps[key];
      if (!body || !map) return { t: 0, text: '' };
      return { t: Math.max(0, Math.min(1, map.get(body, valueRange(body, key)))), text: map.text(body) };
    }
    function setSlider(key, t) {
      const body = bodyById(state.selectedBodyId), map = sliderMaps[key];
      if (!body || !map || !Number.isFinite(t)) return;
      const value = map.set(Math.max(0, Math.min(1, t)), valueRange(body, key));
      if (guest()) {
        setCelestialValue(state.bodies, body.id, key, value);
        if (sliderClock <= 0) { sliderClock = 0.12; net.sendEvent('universe-command', { action: 'set', id: body.id, key, value }); }
        return;
      }
      if (!sliderActive) { history.record(state); sliderActive = true; }
      setCelestialValue(state.bodies, body.id, key, value); forecastClock = 0;
    }
    function commitSlider(key) {
      sliderActive = false;
      const body = bodyById(state.selectedBodyId);
      if (guest() && body) net.sendEvent('universe-command', { action: 'set', id: body.id, key, value: key === 'mass' ? body.mass : key === 'radius' ? body.radius
        : Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z) });
    }

    function primaryOf(body) { return dominantBody(state.bodies, body.position, body.mass, body.id); }
    function info(body) {
      const speed = Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z), kind = kindOf(body);
      const temperature = temperatureOf(body, state.bodies), climate = climateOf(body, state.bodies);
      const primary = primaryOf(body), orbit = primary && orbitalElements(primary, body);
      const climateText = { molten: 'derretido', hot: 'quente', frozen: 'congelado', temperate: 'temperado (habitável)' }[climate] || '';
      const lifetime = lifetimeOf(body), rows = [['Tipo', labelOf(body.type)], ['Massa', fmt(body.mass)], ['Raio', body.radius.toFixed(2)],
        ['Velocidade', speed.toFixed(2)]];
      if (temperature) rows.push(['Temperatura', `${Math.round(temperature)} K`]);
      if (climateText) rows.push(['Clima', climateText]);
      if (primary) rows.push(['Orbita', bodyName(primary)]);
      if (orbit?.period) rows.push(['Excentricidade', orbit.eccentricity.toFixed(2)], ['Período', `${orbit.period.toFixed(1)} s`]);
      if (lifetime) rows.push(['Vida restante', `${Math.max(0, lifetime - (body.age || 0)).toFixed(0)} s`]);
      if (kind === 'blackhole') rows.push(['Acreção', fmt(body.accretion || 0, 1)]);
      return { name: bodyName(body), title: bodyName(body), rows,
        stats: `massa ${fmt(body.mass)} · raio ${body.radius.toFixed(2)} · vel. ${speed.toFixed(2)}`,
        extra: [temperature ? `${Math.round(temperature)} K` : '', climateText, lifetime ? `vida ${Math.max(0, lifetime - (body.age || 0)).toFixed(0)} s` : ''].filter(Boolean).join(' · '),
        orbit: orbit?.period ? `Órbita: e≈${orbit.eccentricity.toFixed(2)} · T≈${orbit.period.toFixed(1)} s` : 'Sem órbita fechada',
        canDetonate: kind === 'star' && !BODY_TYPES[body.type].compact };
    }

    // Camera helpers: follow a body, or fly the rig there.
    let travel = null, followLast = null;
    function follow() {
      const id = state.selectedBodyId;
      state.followId = state.followId === id ? null : id; followLast = null;
      status(state.followId ? `Seguindo ${bodyName(bodyById(id))}.` : 'Parou de seguir.', 2);
    }
    function goTo(id = state.selectedBodyId) {
      const body = bodyById(id), eye = eyePosition();
      if (!body || !eye || !ctx.rig) return;
      const away = eye.clone().sub(V(THREE, body.position));
      if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
      travel = { id, offset: away.normalize().multiplyScalar(body.radius * 3 + 1.4), time: 0, from: eye.clone() };
      status(`Indo até ${bodyName(body)}.`, 2);
    }

    const api = {
      state, maxBodies: MAX_BODIES, selectType, setTool, preset, togglePause, speedStep, undo, redo, clear: () => clear(), save, load,
      slotInfo: slot => storage ? slotInfo(storage, slot) : null, toggleView, view: id => !!views[id],
      selected: () => bodyById(state.selectedBodyId) || null, edit: editSelected, setSlider, sliderValue, commitSlider,
      follow, goTo: () => goTo(), duplicate: () => duplicate(), remove: () => removeBody(), detonate: () => detonateSelected(),
      rename: name => rename(name), deselect: () => { state.selectedBodyId = null; }, info, message: () => (messageTime ? message : ''),
    };
    const panels = new UniversePanels(ctx, api);
    const desktop = flat() && typeof document !== 'undefined' && document.body ? new UniverseDesktop(api) : null;
    function refreshUI() { panels.refresh(); desktop?.renderBody(); }

    // Free flight: closed left hand (or WASD/E/Q) flies where you look; holding the head to a side turns.
    const flight = createFlight(), walkIntent = new WalkIntent(), assist = new AssistTurn();
    const vignette = comfortVignette(THREE);
    ctx.camera?.add(vignette);
    const forward = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3(), euler = new THREE.Euler();
    function updateFlight(dt) {
      const rig = ctx.rig, camera = ctx.camera;
      if (!rig || !camera) return;
      const pointers = ctx.app?.input?.pointers || [];
      const intent = walkIntent.update(dt, pointers, true);
      if (intent) { const hand = pointers.find(p => p.id === walkIntent.id); if (hand) hand.locomotion = true; }
      const keys = input.keys, pad = ctx.app?.input?.gamepad || {};
      camera.updateMatrixWorld(true);
      forward.set(0, 0, -1).transformDirection(camera.matrixWorld);
      right.set(1, 0, 0).transformDirection(camera.matrixWorld);
      const typing = typeof document !== 'undefined' && document.activeElement?.tagName === 'INPUT';
      const key = code => !typing && keys.has(code);
      const f = Math.max(intent, pad.forward || 0) + (key('KeyW') ? 1 : 0) - (key('KeyS') ? 1 : 0);
      const s = (pad.x || 0) + (key('KeyD') ? 1 : 0) - (key('KeyA') ? 1 : 0), u = (key('KeyE') ? 1 : 0) - (key('KeyQ') ? 1 : 0);
      wish.copy(forward).multiplyScalar(f).addScaledVector(right, s); wish.y += u;
      const throttle = Math.min(1, wish.length());
      if (throttle > 0) wish.normalize();
      const eye = camera.getWorldPosition(new THREE.Vector3());
      const delta = stepFlight(flight, { eye, direction: wish, throttle, bodies: state.bodies, dt, boost: key('ShiftLeft') || key('ShiftRight') ? 2.5 : 1 });
      rig.position.x += delta.x; rig.position.y += delta.y; rig.position.z += delta.z;
      if (throttle > 0) travel = null;
      if (flight.warning) status('Borda do universo: não dá para ir além daqui.', 1);
      const seated = !!ctx.app?.renderer?.xr?.isPresenting || !!ctx.app?.orientation?.active;
      const turn = seated ? assist.update(dt, euler.setFromQuaternion(camera.quaternion, 'YXZ').y) : (assist.reset(), 0);
      if (turn) {
        const head = camera.getWorldPosition(new THREE.Vector3());
        rig.rotation.y += turn;
        const next = rotateAbout(rig.position.x, rig.position.z, head.x, head.z, turn);
        rig.position.x = next.x; rig.position.z = next.z;
      }
      const comfort = Math.max(turn ? 0.75 : 0, Math.min(0.7, (speedOf(flight) - 3) / 10));
      vignette.material.uniforms.strength.value += (comfort - vignette.material.uniforms.strength.value) * Math.min(1, dt * 6);
      vignette.visible = !flat() && vignette.material.uniforms.strength.value > 0.02;
      if (travel) {
        const body = bodyById(travel.id);
        if (!body) travel = null;
        else {
          travel.time += dt;
          const t = Math.min(1, travel.time / 1.4), ease = t * t * (3 - 2 * t);
          const target = V(THREE, body.position).add(travel.offset), current = camera.getWorldPosition(new THREE.Vector3());
          const goal = travel.from.clone().lerp(target, ease);
          rig.position.add(goal.sub(current));
          if (t >= 1) travel = null;
        }
      }
      const followed = bodyById(state.followId);
      if (followed) {
        if (followLast) {
          rig.position.x += followed.position.x - followLast.x; rig.position.y += followed.position.y - followLast.y; rig.position.z += followed.position.z - followLast.z;
        }
        followLast = { ...followed.position };
        if (views.focus) {
          const angle = dt * 0.18, next = rotateAbout(rig.position.x, rig.position.z, followed.position.x, followed.position.z, angle);
          rig.position.x = next.x; rig.position.z = next.z; rig.rotation.y += angle;
        }
      } else { followLast = null; if (state.followId) state.followId = null; }
      stars.position.copy(camera.getWorldPosition(new THREE.Vector3()));
    }

    // Selection ring, forecast line, launch preview and ruler.
    const selectionRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 64),
      new THREE.MeshBasicMaterial({ color: '#83d8ff', transparent: true, opacity: 0.85, depthWrite: false }));
    selectionRing.name = 'universe-selection'; selectionRing.visible = false; root.add(selectionRing);
    function pathLine(name, color, count) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, 0);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
      line.name = name; line.visible = false; line.frustumCulled = false; root.add(line);
      return line;
    }
    const forecast = pathLine('universe-trajectory', '#72f0d0', 97), launchPath = pathLine('universe-launch-path', '#ffd36b', 65);
    const launchArrow = pathLine('universe-launch-arrow', '#ff9b5c', 2), rulerLine = pathLine('universe-ruler', '#ffffff', 2);
    const rulerLabel = ctx.label('', { w: 0.9, h: 0.16, size: 0.42, bg: 'rgba(5,16,35,.8)' });
    rulerLabel.visible = false; root.add(rulerLabel);
    const ruler = { first: null, a: null, b: null };
    let forecastClock = 0, forecastId = null, launchClock = 0;
    function setLine(line, points) {
      const attr = line.geometry.attributes.position, count = Math.min(points.length, attr.count);
      for (let i = 0; i < count; i++) attr.setXYZ(i, points[i].x, points[i].y, points[i].z);
      attr.needsUpdate = true; line.geometry.setDrawRange(0, count);
    }

    // Pointer tools.
    const drags = new Map();
    const pickRay = new THREE.Ray(), toBody = new THREE.Vector3();
    function pickBody(ray) {
      let best = null, bestAlong = Infinity;
      for (const body of state.bodies) {
        toBody.set(body.position.x, body.position.y, body.position.z).sub(ray.origin);
        const along = toBody.dot(ray.direction);
        if (along <= 0) continue;
        const distance = Math.sqrt(Math.max(0, toBody.lengthSq() - along * along));
        if (distance < body.radius * 1.15 + 0.012 * along && along < bestAlong) { best = body; bestAlong = along; }
      }
      return best ? { body: best, along: bestAlong } : null;
    }
    function spawnDistance(type) { return (flat() ? 7 : 4) + BODY_TYPES[type].radius * 2; }
    function press(pointer) {
      pickRay.copy(pointer.ray);
      const hit = pickBody(pickRay), tool = state.tool;
      if (tool === 'create') {
        const type = state.selected || 'planet';
        spawn(type, P(pickRay.at(spawnDistance(type), new THREE.Vector3())));
      } else if (tool === 'select' || !tool) {
        if (!hit) return;
        state.selectedBodyId = hit.body.id;
        status(`${bodyName(hit.body)} selecionado. Use o inspetor para editar.`);
      } else if (tool === 'erase') {
        if (hit) removeBody(hit.body.id);
      } else if (tool === 'move') {
        if (!hit) return;
        if (!guest()) history.record(state);
        drags.set(pointer.id, { mode: 'move', id: hit.body.id, distance: hit.along, clock: 0 });
        state.selectedBodyId = hit.body.id;
      } else if (tool === 'launch') {
        const type = state.selected || 'planet';
        const anchor = hit ? { id: hit.body.id, type: hit.body.type, position: { ...hit.body.position }, distance: hit.along }
          : { id: null, type, position: P(pickRay.at(spawnDistance(type), new THREE.Vector3())), distance: spawnDistance(type) };
        drags.set(pointer.id, { mode: 'launch', ...anchor, pull: { ...anchor.position } });
      } else if (tool === 'ruler') {
        if (!hit) return;
        if (!ruler.first || ruler.a) { ruler.first = hit.body.id; ruler.a = null; ruler.b = null; status('Agora pince o segundo astro.', 3); }
        else { ruler.a = ruler.first; ruler.b = hit.body.id; ruler.first = null; }
      }
    }
    function launchVelocity(drag) {
      const pull = V(THREE, drag.pull), anchor = V(THREE, drag.position);
      const base = dominantBody(state.bodies, drag.position, BODY_TYPES[drag.type].mass, drag.id)?.velocity || { x: 0, y: 0, z: 0 };
      return P(anchor.sub(pull).multiplyScalar(1.6).add(V(THREE, base)));
    }
    function dragUpdate(pointer, drag, dt) {
      const point = pointer.ray.at(drag.distance, new THREE.Vector3());
      if (drag.mode === 'move') {
        drag.clock -= dt;
        if (guest()) { if (drag.clock <= 0) { drag.clock = 0.07; moveBody(drag.id, P(point)); } }
        else moveBody(drag.id, P(point));
      } else drag.pull = P(point);
    }
    function release(pointer) {
      const drag = drags.get(pointer.id);
      drags.delete(pointer.id);
      if (!drag) return;
      if (drag.mode === 'move') { if (guest()) moveBody(drag.id, P(pointer.ray.at(drag.distance, new THREE.Vector3()))); status('Astro reposicionado.', 2); return; }
      const velocity = launchVelocity(drag);
      if (Math.hypot(velocity.x, velocity.y, velocity.z) > 40) Object.assign(velocity, P(V(THREE, velocity).setLength(40)));
      launch(drag.id, drag.type, drag.position, velocity);
    }

    function handleEvent(event) {
      if (event.type === 'impact') {
        effects.impact(event);
        const target = bodyById(event.targetId);
        state.impactSeen = true; state.lastImpactType = target?.type || state.lastImpactType;
        status('Impacto: onda de choque e destroços lançados.');
      } else if (event.type === 'collision') {
        effects.collision(event);
        state.impactSeen = true; state.lastImpactType = bodyById(event.targetId)?.type || state.lastImpactType;
        status('Colisão planetária: fragmentos e lava!', 5);
      } else if (event.type === 'tidal') { effects.tidal(event); state.tidalSeen = true; }
      else if (event.type === 'disrupt') { effects.disrupt(event); state.tidalSeen = true; }
      else if (event.type === 'consume') effects.consume(event);
      else if (event.type === 'supernova') effects.supernova(event);
      else if (event.type === 'nebula') effects.nebula(event);
      else if (event.type === 'roche') effects.roche(event);
      else if (event.type === 'stellar-merge') effects.stellarMerge(event);
    }

    function lightSlots() {
      let lights = 0;
      for (const visual of visuals.values()) if (visual.group.userData.light) lights++;
      return lights < 2;
    }
    function updateVisuals(dt) {
      for (const [id, visual] of visuals) if (!bodyById(id)) { destroy(visual.group); destroy(visual.trail); visuals.delete(id); }
      const eye = eyePosition();
      for (const body of state.bodies) {
        let visual = visuals.get(body.id);
        if (!visual || visual.type !== body.type) {
          if (visual) { destroy(visual.group); destroy(visual.trail); }
          visual = bodyVisual(ctx, body, maps, lightSlots());
          bodiesRoot.add(visual.group, visual.trail); visuals.set(body.id, visual);
        }
        const kind = kindOf(body), data = visual.group.userData;
        visual.group.position.set(body.position.x, body.position.y, body.position.z);
        visual.group.scale.setScalar(body.radius / BODY_TYPES[body.type].radius);
        visual.trail.visible = views.orbits;
        if (kind !== 'star' && body.type !== 'comet') visual.group.rotation.y += dt * (kind === 'blackhole' ? 0 : 0.6);
        if (data.clouds) data.clouds.rotation.y += dt * 0.18;
        if (data.beams) data.beams.rotation.y += dt * 9;
        if (data.pulse) data.pulse.scale.setScalar(1 + Math.sin(state.time * 3) * 0.08);
        if (data.disk) { data.disk.rotation.z += dt * 0.15; data.disk.material.uniforms.time.value = state.time; }
        if (data.halo && eye) data.halo.lookAt(eye);
        if (kind === 'star') {
          visual.group.rotation.y += dt * 0.32;
          const hole = state.bodies.filter(other => kindOf(other) === 'blackhole')
            .sort((a, b) => V(THREE, a.position).distanceToSquared(visual.group.position) - V(THREE, b.position).distanceToSquared(visual.group.position))[0];
          const reach = hole && !BODY_TYPES[body.type].compact ? tidalRadius(hole, body) : 0;
          const distance = hole ? V(THREE, hole.position).distanceTo(visual.group.position) : Infinity;
          if (distance < reach) {
            data.core.scale.z = 1 + (1 - distance / reach) * 2.4;
            visual.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(THREE, hole.position).sub(visual.group.position).normalize());
          } else if (data.core.scale.z !== 1) { data.core.scale.z = 1; visual.group.quaternion.identity(); }
        }
        if (data.tail) {
          const sun = state.bodies.filter(other => kindOf(other) === 'star')
            .sort((a, b) => V(THREE, a.position).distanceToSquared(visual.group.position) - V(THREE, b.position).distanceToSquared(visual.group.position))[0];
          if (sun) {
            const away = visual.group.position.clone().sub(V(THREE, sun.position)), distance = away.length();
            visual.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), away.normalize());
            data.tail.scale.set(1, Math.max(0.3, Math.min(2.5, 18 / Math.max(distance, 1))), 1);
            data.tail.material.opacity = Math.min(0.55, 4 / Math.max(distance, 1));
          }
        }
        if (data.heat) {
          if (data.lava) data.lava = Math.max(0, data.lava - dt);
          const molten = visual.climate === 'molten' ? 0.55 : visual.climate === 'hot' ? 0.18 : 0;
          const glow = Math.max(molten, Math.min(0.85, (data.lava || 0) / 8));
          data.heat.visible = glow > 0.01; data.heat.material.opacity = glow;
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
      climateClock -= dt;
      if (climateClock <= 0) {
        climateClock = 0.5;
        for (const body of state.bodies) {
          const visual = visuals.get(body.id), base = visual?.group.userData.baseColor;
          if (!visual || !base) continue;
          const climate = climateOf(body, state.bodies);
          visual.climate = climate;
          const core = visual.group.userData.core;
          if (!core.material.color || body.type === 'icy') continue;
          core.material.color.copy(base);
          if (climate === 'frozen' && kindOf(body) === 'planet') core.material.color.lerp(new THREE.Color('#e9f4ff'), 0.55);
          else if (climate === 'hot' || climate === 'molten') core.material.color.lerp(new THREE.Color('#d4703f'), climate === 'molten' ? 0.6 : 0.3);
        }
      }
    }

    const round = value => Math.round(value * 1000) / 1000;
    const encodeBody = body => [body.id, body.type, round(body.mass), round(body.radius),
      round(body.position.x), round(body.position.y), round(body.position.z),
      round(body.velocity.x), round(body.velocity.y), round(body.velocity.z), round(body.ring || 0), body.name || ''];
    function decodeBody(row) {
      if (!Array.isArray(row) || (row.length !== 10 && row.length !== 12) || !/^u\d{1,5}$/.test(row[0]) || !BODY_TYPES[row[1]] ||
          !row.slice(2, 10).every(value => Number.isFinite(value) && Math.abs(value) < 50000) || row[2] <= 0 || row[3] <= 0) return null;
      const body = { id: row[0], type: row[1], mass: row[2], radius: row[3],
        position: { x: row[4], y: row[5], z: row[6] }, velocity: { x: row[7], y: row[8], z: row[9] } };
      if (row.length === 12) {
        if (!Number.isFinite(row[10]) || row[10] < 0 || typeof row[11] !== 'string' || row[11].length > 24) return null;
        if (row[10] > 0) body.ring = row[10];
        if (row[11]) body.name = row[11];
      }
      return body;
    }
    const eventShapes = {
      impact: e => e.targetId && finiteVector(e.point, 1e4) && finiteVector(e.direction, 2) && Number.isFinite(e.speed),
      collision: e => e.targetId && finiteVector(e.point, 1e4) && finiteVector(e.direction, 2) && Number.isFinite(e.speed),
      tidal: e => e.holeId && e.starId, disrupt: e => e.holeId && finiteVector(e.position, 1e4),
      consume: e => e.targetId && finiteVector(e.position, 1e4), supernova: e => finiteVector(e.position, 1e4) && Number.isFinite(e.reach) && e.reach < 40,
      nebula: e => finiteVector(e.position, 1e4), roche: e => e.planetId, 'stellar-merge': e => finiteVector(e.position, 1e4),
    };
    function applySnapshot(data, sender) {
      if (!guest() || sender !== net.host || !data || !Array.isArray(data.bodies) || data.bodies.length > MAX_BODIES) return;
      const bodies = data.bodies.map(decodeBody);
      if (bodies.some(body => !body) || new Set(bodies.map(body => body.id)).size !== bodies.length ||
          !Number.isFinite(data.time) || data.time < 0 || data.time > 1e8) return;
      const accretion = new Map(state.bodies.map(body => [body.id, body.accretion]));
      for (const body of bodies) if (accretion.get(body.id)) body.accretion = accretion.get(body.id) * 0.995;
      state.bodies = bodies; state.time = data.time;
      state.paused = !!data.paused;
      state.speed = SPEEDS.includes(data.speed) ? data.speed : 1;
      state.impactSeen = !!data.impactSeen; state.tidalSeen = !!data.tidalSeen; state.complete = !!data.complete;
      state.nextId = Math.max(state.nextId, ...bodies.map(body => Number(body.id.slice(1)) + 1), 1);
      for (const event of Array.isArray(data.events) ? data.events.slice(0, 12) : []) {
        if (!event || typeof event !== 'object' || !eventShapes[event.type]?.(event)) continue;
        if (event.type === 'tidal') { const hole = bodyById(event.holeId); if (hole) hole.accretion = (hole.accretion || 0) + Math.min(50, Number(event.transfer) || 0) * 5; }
        handleEvent(event);
      }
    }
    function receiveCommand(data, sender) {
      if (!net?.room || net.host !== net.id || sender === net.id || !data || typeof data !== 'object') return;
      const now = Date.now(), key = data.action === 'move' || data.action === 'set' ? `${sender}:${data.action}` : sender;
      if (now - (lastCommand.get(key) || 0) < (key === sender ? 90 : 30)) return; lastCommand.set(key, now);
      const id = typeof data.id === 'string' && /^u\d{1,5}$/.test(data.id) ? data.id : null;
      if (data.action === 'spawn' && BODY_TYPES[data.type] && finiteVector(data.position)) {
        spawn(data.type, data.position, finiteVector(data.velocity, 40) ? data.velocity : undefined);
      } else if (data.action === 'preset' && PRESET_IDS.includes(data.kind)) preset(data.kind);
      else if (data.action === 'edit' && id && typeof data.edit === 'string' && EDIT_ACTIONS.includes(data.edit)) {
        history.record(state); editCelestialBody(state.bodies, id, data.edit);
      } else if (data.action === 'set' && id && ['mass', 'radius', 'speed'].includes(data.key) && Number.isFinite(data.value)) setCelestialValue(state.bodies, id, data.key, data.value);
      else if (data.action === 'move' && id && finiteVector(data.position)) moveBody(id, data.position);
      else if (data.action === 'launch' && finiteVector(data.position) && finiteVector(data.velocity, 40) && (id ? bodyById(id) : BODY_TYPES[data.type])) {
        launch(id, data.type, data.position, data.velocity);
      } else if (data.action === 'remove' && id) removeBody(id);
      else if (data.action === 'duplicate' && id) duplicate(id);
      else if (data.action === 'detonate' && id) detonateSelected(id);
      else if (data.action === 'rename' && id && typeof data.name === 'string') rename(data.name.slice(0, 24), id);
      else if (data.action === 'restore') {
        const bodies = sanitizeBodies(data.bodies, MAX_BODIES);
        if (bodies) { history.record(state); effects.clear(); restore({ bodies, nextId: 1 }); }
      } else if (data.action === 'undo') undo();
      else if (data.action === 'redo') redo();
      else if (data.action === 'evolution') state.evolution = !!data.on;
      else if (data.action === 'clear') clear();
      else if (data.action === 'pause') togglePause();
      else if (data.action === 'speed') cycleSpeed();
      else if (data.action === 'speed-set') setSpeed(data.value);
    }
    const unsubscribe = net ? [net.on?.('universe-command', receiveCommand), net.on?.('universe-state', applySnapshot)] : [];
    ctx.onDispose?.(() => {
      unsubscribe.forEach(stop => stop?.());
      panels.dispose(); desktop?.dispose(); overlays.dispose(); effects.clear();
      vignette.removeFromParent(); vignette.geometry.dispose(); vignette.material.dispose();
      for (const map of Object.values(maps)) map.dispose();
      ctx.freeFlight?.(false);
    });
    if (!guest()) preset('system');

    function shortcuts() {
      const keys = input.keys, take = code => { if (!keys.has(code)) return false; keys.delete(code); return true; };
      if (typeof document !== 'undefined' && document.activeElement?.tagName === 'INPUT') return;
      const ctrl = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('MetaLeft');
      for (let i = 0; i < DIGIT_TYPES.length; i++) if (take(`Digit${i + 1}`)) selectType(DIGIT_TYPES[i]);
      if (take('Space')) togglePause();
      if (ctrl && take('KeyZ')) undo();
      if (ctrl && take('KeyY')) redo();
      if (!ctrl && take('KeyR')) clear();
      if (take('KeyI')) preset('impact');
      if (take('KeyB')) preset('tidal');
      if (take('Delete')) removeBody();
      if (take('KeyF') && state.selectedBodyId) follow();
      if (take('KeyG')) goTo();
      if (take('Equal') || take('NumpadAdd')) speedStep(1);
      if (take('Minus') || take('NumpadSubtract')) speedStep(-1);
    }

    return {
      state, views, spawn, preset, clear: () => clear(), editSelected, undo, redo, save, load, removeBody, duplicate, rename, setSlider, commitSlider,
      detonate: detonateSelected, selectType, setTool, toggleView, setSpeed, goTo, follow, api, flight, assist, panels,
      update(dt) {
        dt = Math.max(0, Math.min(0.05, dt)); messageTime = Math.max(0, messageTime - dt); sliderClock -= dt;
        const spaceHeld = input.keys.has('Space');
        updateFlight(dt);
        shortcuts();
        const pointers = ctx.pointers();
        for (const pointer of pointers) {
          if (pointer.pinchDown && !spaceHeld && !drags.has(pointer.id) && pointer.ray) press(pointer);
          const drag = drags.get(pointer.id);
          if (drag && pointer.pinch && pointer.ray) dragUpdate(pointer, drag, dt);
          if (drag && pointer.pinchUp) release(pointer);
        }
        for (const id of drags.keys()) if (!pointers.some(pointer => pointer.id === id)) drags.delete(id);
        state.evolution = guest() ? state.evolution : views.evolution;
        const simulated = state.paused || guest() ? 0 : dt * state.speed;
        const events = [];
        let remaining = simulated, guard = ctx.lowEnd ? 4 : 12;
        const held = [...drags.values()].filter(drag => drag.mode === 'launch' && drag.id).map(drag => bodyById(drag.id)).filter(Boolean);
        while (remaining > 1e-6 && guard-- > 0) {
          const step = Math.min(0.1, remaining);
          events.push(...stepUniverse(state, step)); remaining -= step;
          for (const body of held) { const drag = [...drags.values()].find(item => item.id === body.id); body.position = { ...drag.position }; body.velocity = { x: 0, y: 0, z: 0 }; }
        }
        for (const event of events) handleEvent(event);
        updateVisuals(dt); effects.update(dt, state.bodies, state.time);
        const eye = eyePosition();
        overlays.update(dt, state.bodies, eye, ctx.camera?.getWorldQuaternion(new THREE.Quaternion()));
        planeGrid.visible = views.plane;
        if (views.plane) {
          let mass = 0, y = 0;
          for (const body of state.bodies) { mass += body.mass; y += body.position.y * body.mass; }
          planeGrid.position.set(Math.round((eye?.x || 0) / 2) * 2, mass ? y / mass : 1.5, Math.round((eye?.z || 0) / 2) * 2);
        }
        const selectedBody = bodyById(state.selectedBodyId);
        selectionRing.visible = !!selectedBody;
        forecast.visible = !!selectedBody && state.trajectoryVisible && views.orbits;
        if (selectedBody) {
          selectionRing.position.set(selectedBody.position.x, selectedBody.position.y, selectedBody.position.z);
          selectionRing.scale.setScalar(selectedBody.radius * 1.28);
          selectionRing.quaternion.copy(ctx.app?.camera?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion());
          forecastClock -= dt;
          if (forecastId !== selectedBody.id || forecastClock <= 0) {
            forecastId = selectedBody.id; forecastClock = 0.8;
            const steps = state.bodies.length > 24 ? 24 : state.bodies.length > 12 ? 48 : ctx.lowEnd ? 48 : 96;
            setLine(forecast, [selectedBody.position, ...predictTrajectory(state, selectedBody.id, steps)]);
          }
        } else { forecastId = null; if (state.selectedBodyId) state.selectedBodyId = null; }
        const aiming = [...drags.values()].find(drag => drag.mode === 'launch');
        launchArrow.visible = launchPath.visible = !!aiming;
        if (aiming) {
          const velocity = launchVelocity(aiming);
          setLine(launchArrow, [aiming.position, { x: aiming.position.x + (velocity.x) * 0.5, y: aiming.position.y + velocity.y * 0.5, z: aiming.position.z + velocity.z * 0.5 }]);
          launchClock -= dt;
          if (launchClock <= 0) {
            launchClock = 0.2;
            const probe = { time: state.time, bodies: state.bodies.filter(body => body.id !== aiming.id).map(body => ({ ...body, position: { ...body.position }, velocity: { ...body.velocity } })) };
            probe.bodies.push({ ...makeBody(aiming.type, 'probe', aiming.position, velocity), mass: bodyById(aiming.id)?.mass ?? BODY_TYPES[aiming.type].mass });
            setLine(launchPath, [aiming.position, ...predictTrajectory(probe, 'probe', ctx.lowEnd ? 32 : 64)]);
          }
        }
        const a = bodyById(ruler.a), b = bodyById(ruler.b);
        rulerLine.visible = rulerLabel.visible = !!(a && b);
        if (a && b) {
          setLine(rulerLine, [a.position, b.position]);
          const distance = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
          rulerLabel.userData.set?.(`${distance.toFixed(2)} u · ${(distance / 9).toFixed(2)} UA`);
          rulerLabel.position.set((a.position.x + b.position.x) / 2, (a.position.y + b.position.y) / 2 + 0.3, (a.position.z + b.position.z) / 2);
          const scale = eye ? Math.max(0.6, Math.min(5, eye.distanceTo(rulerLabel.position) * 0.09)) : 1;
          rulerLabel.scale.setScalar(scale);
          if (ctx.camera) rulerLabel.quaternion.copy(ctx.camera.getWorldQuaternion(new THREE.Quaternion()));
        }
        panels.update(dt, { flat: flat(), headYaw: ctx.camera ? euler.setFromQuaternion(ctx.camera.quaternion, 'YXZ').y : 0 });
        if (desktop) { desktop.root.hidden = !flat(); if (flat()) desktop.update(dt); }
        if (net?.room && !guest()) {
          pendingEvents.push(...events.filter(event => eventShapes[event.type]));
          syncClock += dt;
          if (syncClock >= 0.2) {
            syncClock = 0;
            net.sendEvent('universe-state', { bodies: state.bodies.map(encodeBody), time: round(state.time),
              paused: state.paused, speed: state.speed, impactSeen: state.impactSeen, tidalSeen: state.tidalSeen,
              complete: state.complete, events: pendingEvents.splice(0, 12) });
            pendingEvents.length = 0;
          }
        } else pendingEvents.length = 0;
        const has = kind => state.bodies.some(body => kindOf(body) === kind);
        if (!state.complete && has('star') && has('planet') && has('moon') && (state.impactSeen || state.tidalSeen)) {
          state.complete = true; ctx.objective?.('Objetivo concluído. Continue criando e testando o universo.'); audio.success?.();
        }
        const hint = flat() ? 'WASD voa · E/Q sobe/desce · botão direito olha · clique usa a ferramenta'
          : 'Feche a mão esquerda para voar · vire a palma esquerda para abrir o menu';
        ctx.hud(`Universe Sandbox · ${state.bodies.length}/${MAX_BODIES} corpos · ${state.speed}×${state.paused ? ' · pausado' : ''}`,
          messageTime ? message : `${hint}${state.complete ? ' · Objetivo concluído.' : ''}`);
      },
    };
  },
};
