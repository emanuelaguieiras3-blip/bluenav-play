// Tema visual inspirado no Horizon OS (Meta Quest): vidro escuro neutro,
// texto claro, pílulas brancas para o item ativo e um único azul de destaque.
export const T = {
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  panel: 'rgba(24,25,28,0.94)',
  panelSolid: '#18191c',
  surface: '#26282d',      // botão padrão
  surfaceHover: '#33363c',
  surfaceActive: '#f2f3f5', // selecionado: pílula branca
  text: '#f2f3f5',
  textDim: '#a3a7b0',
  textOnLight: '#111214',
  line: 'rgba(255,255,255,0.08)',
  accent: '#2d88ff',        // azul de ação (único destaque)
  danger: '#e5484d',
};

// Ícones de linha desenhados no canvas (sem emojis)
export function drawIcon(x, name, cx, cy, s, color = T.text, lw = Math.max(2, s * 0.09)) {
  x.save();
  x.translate(cx, cy); x.scale(s / 24, s / 24); x.translate(-12, -12);
  x.strokeStyle = color; x.fillStyle = color; x.lineWidth = lw * 24 / s; x.lineCap = 'round'; x.lineJoin = 'round';
  const P = (d) => x.stroke(new Path2D(d));
  switch (name) {
    case 'home': P('M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5h4v5'); break;
    case 'grid': for (const [a, b] of [[4, 4], [13, 4], [4, 13], [13, 13]]) { x.beginPath(); x.roundRect(a, b, 7, 7, 1.8); x.stroke(); } break;
    case 'play': P('M8 5.5v13l10.5-6.5z'); break;
    case 'recenter': x.beginPath(); x.arc(12, 12, 7.5, 0, 6.29); x.stroke(); x.beginPath(); x.arc(12, 12, 2.2, 0, 6.29); x.fill(); P('M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3'); break;
    case 'keyboard': x.beginPath(); x.roundRect(2.5, 6, 19, 12, 2.5); x.stroke(); P('M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14.5h8'); break;
    case 'close': P('M6 6l12 12M18 6 6 18'); break;
    case 'minus': P('M5.5 12h13'); break;
    case 'search': x.beginPath(); x.arc(10.5, 10.5, 6.5, 0, 6.29); x.stroke(); P('M15.5 15.5 21 21'); break;
    case 'left': P('M15 5l-7 7 7 7'); break;
    case 'right': P('M9 5l7 7-7 7'); break;
    case 'eye': P('M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z'); x.beginPath(); x.arc(12, 12, 3, 0, 6.29); x.stroke(); break;
    case 'menu': P('M4 7h16M4 12h16M4 17h16'); break;
    case 'back': P('M20 12H5m6-6-6 6 6 6'); break;
    case 'enter': P('M19 5v7a3 3 0 0 1-3 3H5m4-4-4 4 4 4'); break;
    case 'refresh': P('M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'); break;
    case 'next': P('M5 12h14m-6-6 6 6-6 6'); break;
    case 'shuffle': P('M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3'); break;
    case 'dice': x.beginPath(); x.roundRect(4, 4, 16, 16, 3.5); x.stroke(); for (const [a, b] of [[8.5, 8.5], [12, 12], [15.5, 15.5]]) { x.beginPath(); x.arc(a, b, 1.3, 0, 6.29); x.fill(); } break;
    case 'card': x.beginPath(); x.roundRect(6, 3, 12, 18, 2.5); x.stroke(); break;
    case 'pick': P('M14.5 4.5c3 0 5 2 5 5M4 20l9-9M9.5 4.5c3-1 7 0 10 3'); break;
    case 'block': P('M12 3 20 7.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5'); break;
    case 'walk': x.beginPath(); x.arc(13, 4.5, 1.8, 0, 6.29); x.fill(); P('M9 21l3-6 3 2v5M8 12l3-4 4 1 2 4M12 15l-1-6'); break;
    default: break;
  }
  x.restore();
}
