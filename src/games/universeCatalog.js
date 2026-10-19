import { BODY_TYPES } from './universePhysics.js';

// Shared by the VR wrist palette and the PC overlay so both offer the same things.
export const CATEGORIES = [
  { id: 'stars', label: 'Estrelas', items: ['reddwarf', 'star', 'bluegiant', 'redgiant', 'whitedwarf', 'neutron'] },
  { id: 'planets', label: 'Planetas', items: ['rocky', 'planet', 'icy', 'gasgiant', 'ringed'] },
  { id: 'small', label: 'Pequenos', items: ['moon', 'asteroid', 'comet', 'meteor'] },
  { id: 'exotic', label: 'Exóticos', items: ['blackhole', 'smbh', 'whitehole'] },
];
export const SHORT_LABELS = {
  reddwarf: 'Anã vermelha', star: 'Tipo Sol', bluegiant: 'Gigante azul', redgiant: 'Gig. vermelha', whitedwarf: 'Anã branca',
  neutron: 'Nêutrons', rocky: 'Rochoso', planet: 'Terrestre', icy: 'Gelado', gasgiant: 'Gasoso', ringed: 'Com anéis',
  moon: 'Lua', asteroid: 'Asteroide', comet: 'Cometa', meteor: 'Meteoro', blackhole: 'Buraco negro', smbh: 'Supermassivo',
  whitehole: 'Buraco branco',
};
export const PRESETS = [
  ['system', 'Sol, Terra e Lua'], ['solar', 'Sistema Solar'], ['binary', 'Sistema binário'], ['earthmoon', 'Terra + Lua'], ['impact', 'Impacto na Terra'],
  ['tidal', 'Estrela vs buraco negro'], ['galaxies', 'Colisão de galáxias'], ['belt', 'Cinturão de asteroides'], ['supernova', 'Supernova'],
];
export const PRESET_IDS = PRESETS.map(([id]) => id);
export const TOOLS = [['create', 'Criar'], ['select', 'Selecionar'], ['move', 'Mover'], ['launch', 'Lançar'], ['erase', 'Apagar'], ['ruler', 'Régua']];
export const TOOL_HINTS = {
  create: 'Pince no espaço para criar o astro escolhido.',
  select: 'Pince um astro para abrir o inspetor.',
  move: 'Pince um astro e arraste; solte para largar.',
  launch: 'Pince um astro (ou o vazio para criar) e puxe para trás como estilingue.',
  erase: 'Pince um astro para apagar.',
  ruler: 'Pince dois astros para medir a distância.',
};
export const VIEWS = [
  ['orbits', 'Órbitas'], ['labels', 'Rótulos'], ['plane', 'Grade orbital'], ['vectors', 'Vetores'], ['grid', 'Campo gravitacional'],
  ['habitable', 'Zona habitável'], ['jets', 'Jatos'], ['lensing', 'Lente'], ['focus', 'Modo foco'], ['assist', 'Giro assistido'],
  ['evolution', 'Evolução estelar'],
];
export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
export const labelOf = type => BODY_TYPES[type]?.label || type;
