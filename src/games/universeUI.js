import { CATEGORIES, PRESETS, SHORT_LABELS, TOOLS, VIEWS } from './universeCatalog.js';
import { PalmMenu, palmFacing } from './universeFlight.js';

const TABS = [['create', 'Criar'], ['systems', 'Sistemas'], ['tools', 'Ferram.'], ['sim', 'Simular'], ['view', 'Visual']];
const BH = 0.05, GAP = 0.008, PANEL_W = 0.5;

// VR panels: a palette that opens when the left palm faces the eyes (or from the Menu button)
// and an inspector for the selected body. Both live in rig space so they travel with the player.
export class UniversePanels {
  constructor(ctx, api) {
    const { THREE } = ctx;
    this.ctx = ctx; this.api = api; this.THREE = THREE;
    this.parent = ctx.rig || ctx.root;
    this.palm = new PalmMenu(); this.open = false; this.anchor = 'front'; this.pinned = false;
    this.tab = 'create'; this.category = 'stars'; this.pages = {}; this.buttons = [];
    this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3(); this.quat = new THREE.Quaternion();
    this.followYaw = 0; this.inspectorYaw = 0;

    this.palette = new THREE.Group(); this.palette.name = 'universe-palette'; this.palette.visible = false; this.parent.add(this.palette);
    const back = ctx.label('', { w: PANEL_W + 0.03, h: 0.52, bg: 'rgba(4,12,28,.9)', radius: 0.08 });
    back.position.z = -0.004; back.renderOrder = -1; this.palette.add(back);
    TABS.forEach(([id, label], i) => {
      const button = this.button(label, 0.094, 0.048, () => this.setTab(id), this.palette);
      button.position.set(-PANEL_W / 2 + 0.047 + i * 0.1, 0.225, 0); this.tabButtons = { ...this.tabButtons, [id]: button };
    });
    const footer = [['Fixar', () => this.togglePin()], ['Fechar', () => this.setOpen(false)]];
    this.footer = footer.map(([label, onClick], i) => {
      const button = this.button(label, 0.15, 0.042, onClick, this.palette);
      button.position.set(0.08 + i * 0.16, -0.225, 0); return button;
    });
    this.selectedLabel = ctx.label('', { w: 0.24, h: 0.042, size: 0.34, bg: 'rgba(0,0,0,0)' });
    this.selectedLabel.position.set(-0.13, -0.225, 0.002); this.palette.add(this.selectedLabel);
    this.buildCreate(); this.buildSystems(); this.buildTools(); this.buildSim(); this.buildView();

    this.menuButton = this.button('Menu', 0.13, 0.05, () => this.setOpen(!this.open, 'front'), this.parent);
    this.menuButton.name = 'universe-menu-button';
    this.buildInspector();
    this.setTab('create');
  }

  button(label, w, h, onClick, parent) {
    const button = this.ctx.button({ label, w, h, fontSize: 0.36, variant: 'glass', onClick });
    parent.add(button); this.buttons.push(button);
    return button;
  }

  page(id) {
    const group = new this.THREE.Group(); group.name = `universe-page-${id}`; group.visible = false;
    this.palette.add(group); this.pages[id] = group; return group;
  }

  grid(page, items, columns, width, top = 0.16, left = -PANEL_W / 2) {
    return items.map(([label, onClick], i) => {
      const button = this.button(label, width, BH, onClick, page);
      button.position.set(left + width / 2 + (i % columns) * (width + GAP), top - Math.floor(i / columns) * (BH + GAP), 0);
      return button;
    });
  }

  buildCreate() {
    const page = this.page('create');
    this.categoryButtons = Object.fromEntries(CATEGORIES.map((category, i) => {
      const button = this.button(category.label, 0.13, BH, () => { this.category = category.id; this.refresh(); }, page);
      button.position.set(-PANEL_W / 2 + 0.065, 0.16 - i * (BH + GAP), 0);
      return [category.id, button];
    }));
    this.itemPages = {};
    for (const category of CATEGORIES) {
      const sub = new this.THREE.Group(); page.add(sub); this.itemPages[category.id] = sub;
      this.itemButtons = { ...this.itemButtons, ...Object.fromEntries(category.items.map((type, i) => {
        const button = this.button(SHORT_LABELS[type], 0.17, BH, () => this.api.selectType(type), sub);
        button.position.set(-PANEL_W / 2 + 0.145 + 0.085 + (i % 2) * 0.178, 0.16 - Math.floor(i / 2) * (BH + GAP), 0);
        return [type, button];
      })) };
    }
  }

  buildSystems() {
    this.grid(this.page('systems'), PRESETS.map(([id, label]) => [label, () => this.api.preset(id)]), 2, 0.245);
  }

  buildTools() {
    this.toolButtons = Object.fromEntries(this.grid(this.page('tools'), TOOLS.map(([id, label]) => [label, () => this.api.setTool(id)]), 2, 0.245)
      .map((button, i) => [TOOLS[i][0], button]));
  }

  buildSim() {
    const api = this.api, page = this.page('sim');
    [this.pauseButton] = this.grid(page, [['Pausar', () => api.togglePause()], ['Vel. −', () => api.speedStep(-1)],
      ['Vel. +', () => api.speedStep(1)], ['Desfazer', () => api.undo()], ['Refazer', () => api.redo()], ['Limpar', () => api.clear()]], 3, 0.162);
    this.slotButtons = this.grid(page, [1, 2, 3].flatMap(slot => [[`Salvar ${slot}`, () => api.save(slot)], [`Abrir ${slot}`, () => api.load(slot)]]), 2, 0.245, 0.16 - 2 * (BH + GAP));
    this.speedLabel = this.ctx.label('', { w: 0.4, h: 0.045, size: 0.4, bg: 'rgba(0,0,0,0)' });
    this.speedLabel.position.set(0, 0.16 - 5 * (BH + GAP), 0.002); page.add(this.speedLabel);
  }

  buildView() {
    this.viewButtons = Object.fromEntries(this.grid(this.page('view'), VIEWS.map(([id, label]) => [label, () => this.api.toggleView(id)]), 2, 0.245)
      .map((button, i) => [VIEWS[i][0], button]));
  }

  buildInspector() {
    const { THREE, ctx, api } = this;
    const inspector = this.inspector = new THREE.Group(); inspector.name = 'universe-inspector'; inspector.visible = false; this.parent.add(inspector);
    const back = ctx.label('', { w: 0.56, h: 0.74, bg: 'rgba(4,12,28,.9)', radius: 0.06 });
    back.position.z = -0.004; back.renderOrder = -1; inspector.add(back);
    this.title = ctx.label('', { w: 0.52, h: 0.06, size: 0.42, bg: 'rgba(0,0,0,0)' }); this.title.position.y = 0.33; inspector.add(this.title);
    this.stats = ctx.label('', { w: 0.52, h: 0.1, size: 0.24, bg: 'rgba(0,0,0,0)' }); this.stats.position.y = 0.255; inspector.add(this.stats);
    this.orbit = ctx.label('', { w: 0.52, h: 0.05, size: 0.3, bg: 'rgba(0,0,0,0)' }); this.orbit.position.y = 0.19; inspector.add(this.orbit);
    this.sliders = [['mass', 'Massa'], ['radius', 'Raio'], ['speed', 'Velocidade']].map(([key, label], i) => this.slider(key, label, 0.12 - i * 0.075));
    const actions = [['Seguir', () => api.follow()], ['Ir até', () => api.goTo()], ['Órbita', () => api.edit('orbit')], ['Parar', () => api.edit('stop')],
      ['Duplicar', () => api.duplicate()], ['Apagar', () => api.remove()], ['Renomear', () => api.rename()], ['Detonar', () => api.detonate()]];
    this.inspectorButtons = actions.map(([label, onClick], i) => {
      const button = this.button(label, 0.165, 0.048, onClick, inspector);
      button.position.set(-0.175 + (i % 3) * 0.175, -0.14 - Math.floor(i / 3) * 0.056, 0);
      return button;
    });
    const close = this.button('Fechar', 0.165, 0.048, () => api.deselect(), inspector);
    close.position.set(0.175, -0.252, 0);
  }

  slider(key, text, y) {
    const { THREE, ctx, api } = this, width = 0.3;
    const name = ctx.label(text, { w: 0.15, h: 0.045, size: 0.4, bg: 'rgba(0,0,0,0)' }); name.position.set(-0.19, y, 0.002); this.inspector.add(name);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.05), new THREE.MeshBasicMaterial({ color: '#1d3354', transparent: true, opacity: 0.95 }));
    track.position.set(0.07, y, 0); track.name = `universe-slider-${key}`; this.inspector.add(track);
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.05), new THREE.MeshBasicMaterial({ color: '#5aa8ff', transparent: true, opacity: 0.9 }));
    fill.position.set(0.07, y, 0.001); this.inspector.add(fill);
    const value = ctx.label('', { w: 0.13, h: 0.04, size: 0.42, bg: 'rgba(0,0,0,0)' }); value.position.set(0.07, y, 0.003); this.inspector.add(value);
    const plane = new THREE.Plane(), hit = new THREE.Vector3(), local = new THREE.Vector3();
    const set = pointer => {
      if (!pointer?.ray) return;
      track.updateMatrixWorld(true);
      plane.setFromNormalAndCoplanarPoint(this.tmp.set(0, 0, 1).transformDirection(track.matrixWorld), track.getWorldPosition(this.tmp2));
      if (!pointer.ray.intersectPlane(plane, hit)) return;
      local.copy(hit); track.worldToLocal(local);
      api.setSlider(key, Math.max(0, Math.min(1, local.x / width + 0.5)));
    };
    ctx.addUI?.(track, { drag: { start: set, move: set, end: () => api.commitSlider?.(key) } });
    return { key, fill, value, width, x: 0.07 };
  }

  setTab(id) {
    this.tab = id;
    for (const [key, page] of Object.entries(this.pages)) page.visible = key === id;
    this.refresh();
  }

  setOpen(open, anchor = this.anchor) {
    this.open = !!open; this.anchor = anchor;
    if (!open) this.pinned = false;
    this.placed = false;
  }

  togglePin() { this.pinned = !this.pinned; if (this.pinned) this.anchor = 'pinned'; this.refresh(); }

  refresh() {
    const state = this.api.state;
    for (const [id, button] of Object.entries(this.tabButtons)) button.userData.setActive?.(id === this.tab);
    for (const [id, button] of Object.entries(this.categoryButtons)) button.userData.setActive?.(id === this.category);
    for (const [id, page] of Object.entries(this.itemPages)) page.visible = id === this.category;
    for (const [type, button] of Object.entries(this.itemButtons)) button.userData.setActive?.(type === state.selected && state.tool === 'create');
    for (const [id, button] of Object.entries(this.toolButtons)) button.userData.setActive?.(id === state.tool);
    for (const [id, button] of Object.entries(this.viewButtons)) button.userData.setActive?.(this.api.view(id));
    this.pauseButton.userData.setLabel?.(state.paused ? 'Continuar' : 'Pausar');
    this.speedLabel.userData.set?.(`Velocidade ${state.speed}×`);
    this.footer[0].userData.setActive?.(this.pinned);
    this.selectedLabel.userData.set?.(state.selected ? SHORT_LABELS[state.selected] : '');
  }

  handPointers() {
    return (this.ctx.app?.input?.pointers || []).filter(p => p.source === 'hand' && !p.stale && p.hand?.points?.length === 21);
  }

  // Yaw-follow pose in rig space: offset is in camera-yaw coordinates.
  follow(object, yaw, offset) {
    const camera = this.ctx.camera;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    object.position.set(camera.position.x + offset.x * c + offset.z * s, camera.position.y + offset.y, camera.position.z - offset.x * s + offset.z * c);
    object.rotation.set(0, yaw, 0);
  }

  update(dt, { flat, headYaw }) {
    const camera = this.ctx.camera;
    const hidden = flat || !camera;
    this.menuButton.visible = !hidden;
    if (hidden) { this.palette.visible = false; this.inspector.visible = false; return; }
    if (Math.abs(angleDelta(headYaw, this.followYaw)) > 0.6) this.followYaw += angleDelta(headYaw, this.followYaw) * Math.min(1, dt * 3);
    this.follow(this.menuButton, this.followYaw, { x: -0.36, y: -0.42, z: -0.62 });
    const left = this.handPointers().find(p => p.side === 'left');
    const eye = camera.getWorldPosition(this.tmp2);
    const facing = left && !left.locomotion ? this.palm.update(dt, palmFacing(left.hand.points, 'left', eye)) : this.palm.update(dt, -1);
    if (facing && !this.open) this.setOpen(true, 'wrist');
    if (!facing && this.open && this.anchor === 'wrist' && !this.pinned) this.setOpen(false);
    this.palette.visible = this.open;
    if (this.open) {
      if (this.anchor === 'wrist' && left && !this.pinned) {
        const wrist = this.tmp.copy(left.hand.points[0]);
        const target = this.parent.worldToLocal(wrist.clone()).add(this.tmp.set(Math.cos(headYaw) * 0.16, 0.2, -Math.sin(headYaw) * 0.16));
        this.palette.position.lerp(target, this.placed ? Math.min(1, dt * 10) : 1);
        this.palette.scale.setScalar(0.85);
        this.palette.lookAt(eye); this.placed = true;
      } else if (!this.placed) {
        this.follow(this.palette, headYaw, { x: -0.12, y: -0.12, z: -0.7 }); this.palette.scale.setScalar(1); this.placed = true;
      }
    }
    const selected = this.api.selected();
    this.inspector.visible = !!selected;
    if (selected) {
      if (!this.inspectorShown) this.inspectorYaw = headYaw;
      if (Math.abs(angleDelta(headYaw, this.inspectorYaw)) > 0.7) this.inspectorYaw += angleDelta(headYaw, this.inspectorYaw) * Math.min(1, dt * 2.5);
      this.follow(this.inspector, this.inspectorYaw, { x: 0.46, y: -0.08, z: -0.78 });
      this.inspector.rotation.y -= 0.35;
      const info = this.api.info(selected);
      this.title.userData.set?.(info.title);
      this.stats.userData.set?.(info.stats, info.extra);
      this.orbit.userData.set?.(info.orbit);
      for (const slider of this.sliders) {
        const { t, text } = this.api.sliderValue(slider.key);
        slider.fill.scale.x = Math.max(0.001, t * slider.width);
        slider.fill.position.x = slider.x - slider.width / 2 + t * slider.width / 2;
        slider.value.userData.set?.(text);
      }
      this.inspectorButtons[7].visible = info.canDetonate;
    }
    this.inspectorShown = !!selected;
  }

  dispose() {
    for (const button of this.buttons) button.userData.dispose?.();
    for (const object of [this.palette, this.inspector, this.menuButton]) object.parent?.remove(object);
  }
}

function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
