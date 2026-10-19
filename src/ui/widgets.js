// Botões no estilo Horizon OS: placas planas arredondadas, hover levanta e clareia,
// item ativo vira pílula branca. O rótulo e o ícone são desenhados no canvas.
import * as THREE from 'three';
import { textTexture, textCanvas, fitText } from '../core/textures.js';
import { T, drawIcon } from './theme.js';

const VARIANTS = {
  default: { bg: T.surface, hover: T.surfaceHover, fg: T.text },
  ghost: { bg: 'rgba(255,255,255,0)', hover: 'rgba(255,255,255,0.10)', fg: T.text },
  light: { bg: T.surfaceActive, hover: '#ffffff', fg: T.textOnLight },
  accent: { bg: T.accent, hover: '#4a9bff', fg: '#ffffff' },
  glass: { bg: T.panel, hover: T.surfaceHover, fg: T.text },
};

export function makeButton(app, {
  w = 0.24, h = 0.1, label = '', sub = null, icon = null, variant = 'default', round = false,
  onClick, dwell, owner = 'ui', fontSize = 0.38, keySound = false, onHover = null, hint = null,
} = {}) {
  const group = new THREE.Group();
  const inner = new THREE.Group(); group.add(inner);
  const PX = 160, cw = Math.min(1024, Math.round(PX * w / h)), ch = PX;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const x = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const st = { hover: false, active: false, pressed: false, label, sub, icon };

  const draw = () => {
    const v = st.active ? VARIANTS.light : VARIANTS[variant] || VARIANTS.default;
    x.clearRect(0, 0, cw, ch);
    x.fillStyle = st.hover && !st.active ? v.hover : v.bg;
    x.beginPath();
    if (round) x.arc(cw / 2, ch / 2, Math.min(cw, ch) / 2 - 1, 0, Math.PI * 2);
    else x.roundRect(1, 1, cw - 2, ch - 2, Math.min(ch * 0.5, 34));
    x.fill();
    const fg = v.fg;
    x.fillStyle = fg; x.textBaseline = 'middle'; x.textAlign = 'center';
    const fpx = Math.round(ch * fontSize);
    if (st.icon && !st.label) { drawIcon(x, st.icon, cw / 2, ch / 2, ch * 0.46, fg); }
    else {
      let tx = cw / 2, maxW = cw * 0.86;
      x.font = `600 ${fpx}px ${T.font}`;
      if (st.icon) {
        const tw = Math.min(maxW - ch * 0.5, x.measureText(st.label).width);
        const total = ch * 0.42 + ch * 0.12 + tw;
        const ix = cw / 2 - total / 2 + ch * 0.21;
        drawIcon(x, st.icon, ix, st.sub ? ch * 0.4 : ch / 2, ch * 0.42, fg);
        tx = ix + ch * 0.21 + ch * 0.12; x.textAlign = 'left'; maxW = cw - tx - ch * 0.2;
      }
      fitText(x, st.label, tx, st.sub ? ch * 0.4 : ch / 2, maxW);
      if (st.sub) { x.textAlign = 'center'; x.fillStyle = st.active ? '#4a4d55' : T.textDim; x.font = `500 ${Math.round(ch * 0.2)}px ${T.font}`; fitText(x, st.sub, cw / 2, ch * 0.76, cw * 0.9); }
    }
    tex.needsUpdate = true;
  };
  draw();

  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02 }));
  inner.add(face);
  app.ui.add(face, {
    onClick, dwell, press: inner, owner, keySound, label: () => st.label || hint || st.icon || '',
    onHover: (on) => { st.hover = on; inner.scale.setScalar(on ? 1.035 : 1); draw(); onHover?.(on); },
  });
  face.userData.owner = owner;
  group.userData.body = face;
  group.userData.setLabel = (t, s = st.sub) => { if (t === st.label && s === st.sub) return; st.label = t; st.sub = s; draw(); };
  group.userData.setIcon = (i) => { st.icon = i; draw(); };
  group.userData.setActive = (a) => { if (st.active === !!a) return; st.active = !!a; draw(); };
  group.userData.setColor = () => {}; // compatibilidade: o tema decide as cores
  group.userData.dispose = () => { tex.dispose(); face.material.dispose(); face.geometry.dispose(); };
  return group;
}

// Painel de texto simples (placar, instruções)
export function makeLabel(text, { w = 0.6, h = 0.12, bg = T.panel, fg = T.text, size = 0.42, sub = null, radius = 0.5 } = {}) {
  const px = 256;
  const opts = (t, s) => ({ w: Math.min(1024, Math.round(px * w / h)), h: px, bg, fg, size, sub: s, radius, subColor: T.textDim });
  const mat = new THREE.MeshBasicMaterial({ map: textTexture(text, opts(text, sub)), transparent: true, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.userData.set = (t, s) => {
    if (m.userData.last === t + '|' + s) return;
    m.userData.last = t + '|' + s;
    textCanvas(t, { ...opts(t, s), canvas: mat.map.image });
    mat.map.needsUpdate = true;
  };
  return m;
}
