import { CATEGORIES, PRESETS, SHORT_LABELS, TOOLS, TOOL_HINTS, VIEWS } from './universeCatalog.js';

const CSS = `
.uvs{position:fixed;inset:0;pointer-events:none;z-index:20;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#e8f0ff}
.uvs *{box-sizing:border-box}
.uvs-panel{pointer-events:auto;background:rgba(6,14,32,.88);border:1px solid rgba(120,170,255,.22);border-radius:14px;backdrop-filter:blur(8px);box-shadow:0 8px 30px rgba(0,0,0,.35)}
.uvs-side{position:absolute;left:12px;top:12px;bottom:12px;width:268px;display:flex;flex-direction:column;overflow:hidden}
.uvs-side.closed{bottom:auto}
.uvs-side.closed .uvs-body,.uvs-side.closed .uvs-tabs{display:none}
.uvs-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(120,170,255,.15)}
.uvs-head b{flex:1;letter-spacing:.06em;font-size:13px}
.uvs-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:8px}
.uvs-body{flex:1;overflow:auto;padding:4px 10px 12px}
.uvs button{font:inherit;color:inherit;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:7px 8px;cursor:pointer;text-align:left}
.uvs button:hover{background:rgba(255,255,255,.14)}
.uvs button.on{background:#e8f0ff;color:#0b1730;border-color:#e8f0ff}
.uvs-tabs button{text-align:center;font-size:12px;padding:6px 2px}
.uvs-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.uvs-grid.three{grid-template-columns:1fr 1fr 1fr}
.uvs h4{margin:12px 2px 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8fb4e8}
.uvs-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:middle}
.uvs-hint{margin:10px 2px 0;color:#9fb6d8;font-size:12px}
.uvs-inspector{position:absolute;right:12px;top:64px;width:290px;padding:12px;max-height:calc(100% - 140px);overflow:auto}
.uvs-inspector input[type=text]{width:100%;font:inherit;font-weight:600;font-size:16px;color:#fff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 8px}
.uvs-kv{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:10px 0;font-size:13px}
.uvs-kv span:nth-child(odd){color:#8fb4e8}
.uvs-slider{display:grid;grid-template-columns:76px 1fr 64px;align-items:center;gap:6px;margin:6px 0;font-size:13px}
.uvs-slider input{width:100%}
.uvs-slider output{text-align:right;color:#cfe0ff;font-variant-numeric:tabular-nums}
.uvs-status{position:absolute;left:50%;transform:translateX(-50%);top:12px;padding:7px 14px;display:flex;gap:14px;align-items:center;white-space:nowrap;max-width:calc(100% - 620px);overflow:hidden;font-size:13px}
.uvs-status .msg{color:#ffd59a;overflow:hidden;text-overflow:ellipsis}
.uvs-help{position:absolute;right:12px;bottom:12px;width:290px;padding:10px 12px;font-size:12px;color:#b9cbe6}
.uvs-help.closed{width:auto;padding:6px 8px}
.uvs-help.closed b{display:none}
.uvs-help kbd{background:rgba(255,255,255,.1);border-radius:4px;padding:0 5px;font:11px ui-monospace,monospace;color:#fff}
.uvs-help.closed p{display:none}
@media (max-width:760px){.uvs-side{width:220px}.uvs-inspector,.uvs-help{width:230px}.uvs-status{max-width:calc(100% - 260px);left:auto;right:12px;transform:none;top:auto;bottom:60px}}
`;
const DOTS = { reddwarf: '#ff8a5c', star: '#ffd27a', bluegiant: '#9cc2ff', redgiant: '#ff6a3d', whitedwarf: '#f4f8ff', neutron: '#bfe0ff',
  rocky: '#b38f74', planet: '#5aa0e6', icy: '#d9eeff', gasgiant: '#e2b98f', ringed: '#f1dcb4', moon: '#b6bbc6', asteroid: '#8f7a68',
  comet: '#bfe6ff', meteor: '#c08a6a', blackhole: '#2a2140', smbh: '#3a1f55', whitehole: '#ffffff' };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

// PC (non-VR) mode: an HTML control surface over the 3D view.
export class UniverseDesktop {
  constructor(api) {
    this.api = api; this.tab = 'create'; this.category = 'stars'; this.clock = 0;
    this.style = el('style', {}, CSS); document.head.append(this.style);
    this.root = el('div', { class: 'uvs', 'data-universe-ui': 'pc' });
    const stop = event => event.stopPropagation();
    for (const type of ['keydown', 'keyup']) this.root.addEventListener(type, event => { if (event.target.tagName === 'INPUT' && event.target.type === 'text') stop(event); });
    // Buttons never keep focus, so Space stays "pause" instead of re-clicking the last button.
    this.root.addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
    this.side = el('div', { class: 'uvs-panel uvs-side' });
    const collapse = el('button', { onclick: () => this.side.classList.toggle('closed'), title: 'Recolher' }, '☰');
    this.side.append(el('div', { class: 'uvs-head' }, el('b', {}, 'UNIVERSE SANDBOX'), collapse));
    this.tabs = el('div', { class: 'uvs-tabs' });
    this.tabButtons = {};
    for (const [id, label] of [['create', 'Criar'], ['systems', 'Sistemas'], ['tools', 'Ferram.'], ['sim', 'Simular'], ['view', 'Visual']]) {
      this.tabButtons[id] = el('button', { onclick: () => { this.tab = id; this.renderBody(); } }, label);
      this.tabs.append(this.tabButtons[id]);
    }
    this.body = el('div', { class: 'uvs-body' });
    this.side.append(this.tabs, this.body);
    this.inspector = el('div', { class: 'uvs-panel uvs-inspector', hidden: '' });
    this.status = el('div', { class: 'uvs-panel uvs-status' });
    this.help = el('div', { class: 'uvs-panel uvs-help closed' },
      el('button', { onclick: () => this.help.classList.toggle('closed'), style: 'float:right;padding:2px 8px', title: 'Controles do PC' }, '? Controles'),
      el('b', {}, 'Controles do PC'),
      el('p', {}, ...helpLines()));
    this.root.append(this.side, this.inspector, this.status, this.help);
    document.body.append(this.root);
    this.buildInspector();
    this.renderBody();
  }

  renderBody() {
    const api = this.api, state = api.state;
    for (const [id, button] of Object.entries(this.tabButtons)) button.classList.toggle('on', id === this.tab);
    this.body.replaceChildren();
    if (this.tab === 'create') {
      const cats = el('div', { class: 'uvs-grid' });
      for (const category of CATEGORIES) {
        cats.append(el('button', { class: category.id === this.category ? 'on' : '', onclick: () => { this.category = category.id; this.renderBody(); } }, category.label));
      }
      const items = el('div', { class: 'uvs-grid' });
      for (const type of CATEGORIES.find(category => category.id === this.category).items) {
        items.append(el('button', { class: state.selected === type && state.tool === 'create' ? 'on' : '', 'data-type': type, onclick: () => { api.selectType(type); this.renderBody(); } },
          el('span', { class: 'uvs-dot', style: `background:${DOTS[type]}` }), SHORT_LABELS[type]));
      }
      this.body.append(el('h4', {}, 'Categoria'), cats, el('h4', {}, 'Astro'), items,
        el('p', { class: 'uvs-hint' }, 'Clique no espaço para criar. Com “Lançar”, arraste para dar velocidade.'));
    } else if (this.tab === 'systems') {
      const grid = el('div', { class: 'uvs-grid' });
      for (const [id, label] of PRESETS) grid.append(el('button', { onclick: () => api.preset(id) }, label));
      this.body.append(el('h4', {}, 'Sistemas prontos'), grid);
    } else if (this.tab === 'tools') {
      const grid = el('div', { class: 'uvs-grid' });
      for (const [id, label] of TOOLS) grid.append(el('button', { class: state.tool === id ? 'on' : '', onclick: () => { api.setTool(id); this.renderBody(); } }, label));
      this.body.append(el('h4', {}, 'Ferramenta'), grid, el('p', { class: 'uvs-hint' }, TOOL_HINTS[state.tool] || ''));
    } else if (this.tab === 'sim') {
      const controls = el('div', { class: 'uvs-grid three' },
        el('button', { onclick: () => { api.togglePause(); this.renderBody(); } }, state.paused ? 'Continuar' : 'Pausar'),
        el('button', { onclick: () => { api.speedStep(-1); this.renderBody(); } }, 'Vel. −'),
        el('button', { onclick: () => { api.speedStep(1); this.renderBody(); } }, 'Vel. +'),
        el('button', { onclick: () => api.undo() }, 'Desfazer'),
        el('button', { onclick: () => api.redo() }, 'Refazer'),
        el('button', { onclick: () => api.clear() }, 'Limpar'));
      const slots = el('div', { class: 'uvs-grid' });
      for (const slot of [1, 2, 3]) {
        const info = api.slotInfo(slot);
        slots.append(el('button', { onclick: () => { api.save(slot); this.renderBody(); } }, `Salvar ${slot}`),
          el('button', { onclick: () => api.load(slot), title: info ? `${info.count} corpos` : 'vazio' }, info ? `Abrir ${slot} · ${info.count}` : `Abrir ${slot} · vazio`));
      }
      this.body.append(el('h4', {}, `Simulação · ${state.speed}×`), controls, el('h4', {}, 'Salvar e abrir'), slots);
    } else {
      const grid = el('div', { class: 'uvs-grid' });
      for (const [id, label] of VIEWS) {
        if (id === 'assist') continue;
        grid.append(el('button', { class: api.view(id) ? 'on' : '', onclick: () => { api.toggleView(id); this.renderBody(); } }, label));
      }
      this.body.append(el('h4', {}, 'Mostrar'), grid);
    }
  }

  buildInspector() {
    const api = this.api;
    this.nameInput = el('input', { type: 'text', maxlength: '24', 'aria-label': 'Nome do astro',
      onchange: () => api.rename(this.nameInput.value), onkeydown: event => { if (event.key === 'Enter') this.nameInput.blur(); } });
    this.kv = el('div', { class: 'uvs-kv' });
    this.sliders = ['mass', 'radius', 'speed'].map(key => {
      const input = el('input', { type: 'range', min: '0', max: '1000', step: '1', 'aria-label': key,
        oninput: () => api.setSlider(key, input.value / 1000), onchange: () => api.commitSlider?.(key) });
      const output = el('output');
      const row = el('div', { class: 'uvs-slider' }, el('span', {}, { mass: 'Massa', radius: 'Raio', speed: 'Velocidade' }[key]), input, output);
      return { key, input, output, row };
    });
    const actions = el('div', { class: 'uvs-grid three' });
    this.detonateButton = el('button', { onclick: () => api.detonate() }, 'Detonar');
    for (const [label, onClick] of [['Seguir', () => api.follow()], ['Ir até', () => api.goTo()], ['Órbita', () => api.edit('orbit')],
      ['Parar', () => api.edit('stop')], ['Duplicar', () => api.duplicate()], ['Apagar', () => api.remove()]]) actions.append(el('button', { onclick: onClick }, label));
    actions.append(this.detonateButton, el('button', { onclick: () => api.deselect() }, 'Fechar'));
    this.inspector.append(this.nameInput, this.kv, ...this.sliders.map(slider => slider.row), actions);
  }

  update(dt) {
    this.clock -= dt;
    const selected = this.api.selected();
    this.inspector.hidden = !selected;
    if (this.clock > 0) return;
    this.clock = 0.15;
    const state = this.api.state;
    this.status.replaceChildren(el('b', {}, `${state.bodies.length}/${this.api.maxBodies} corpos`), el('span', {}, `${state.speed}×${state.paused ? ' · pausado' : ''}`),
      el('span', {}, `t = ${state.time.toFixed(0)} s`), el('span', {}, `Ferramenta: ${TOOLS.find(([id]) => id === state.tool)?.[1] || ''}`),
      el('span', { class: 'msg' }, this.api.message()));
    if (!selected) { this.lastId = null; return; }
    const info = this.api.info(selected);
    if (document.activeElement !== this.nameInput && (this.lastId !== selected.id || this.nameInput.value !== info.name)) this.nameInput.value = info.name;
    this.lastId = selected.id;
    this.kv.replaceChildren(...info.rows.flatMap(([key, value]) => [el('span', {}, key), el('span', {}, value)]));
    for (const slider of this.sliders) {
      const { t, text } = this.api.sliderValue(slider.key);
      if (document.activeElement !== slider.input) slider.input.value = String(Math.round(t * 1000));
      slider.output.value = text;
    }
    this.detonateButton.hidden = !info.canDetonate;
  }

  dispose() { this.root.remove(); this.style.remove(); }
}

function helpLines() {
  const rows = [['Botão direito + arrastar', 'olhar'], ['W A S D', 'voar'], ['E / Q', 'subir / descer'], ['Shift', 'turbo'],
    ['Clique', 'usar a ferramenta'], ['Espaço', 'pausar'], ['Ctrl+Z / Ctrl+Y', 'desfazer / refazer'], ['1–9', 'escolher astro'],
    ['Delete', 'apagar selecionado'], ['F / G', 'seguir / ir até'], ['R / I / B', 'limpar / impacto / maré']];
  return rows.flatMap(([keys, action], i) => [...(i ? [el('br')] : []), el('kbd', {}, keys), ` ${action}`]);
}
