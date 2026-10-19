// AuraOS XR modules listed in the BlueNav library. Each one opens auraos-xr.html
// directly on that experience; covers live in assets/covers/aura-<exp>.jpg.
export const AURA_GAMES = [
  ['chem', 'ChemHands XR', 'Ciência', '#1f6f8a'], ['aether', 'AetherForge VR', 'Espaço', '#7a4a1f'],
  ['chrono', 'ChronoGlass', 'Puzzle', '#7a5a1a'], ['prismata', 'Prismata', 'Puzzle', '#5a3a8a'],
  ['void', 'VoidStriker', 'Ação', '#7a2a3a'], ['kinetix', 'Kinetix', 'Engenharia', '#2a6a4a'],
  ['pulse', 'CyberPulse', 'Música', '#6a1f6a'], ['spell', 'SpellWeaver', 'Ação', '#7a4a1a'],
  ['shadow', 'ShadowWire', 'Furtividade', '#6a1a2a'], ['sling', 'Gravity Sling', 'Espaço', '#2a3f7a'],
  ['bio', 'BioGenesis', 'Criação', '#1a6a5a'], ['terra', 'TerraSculpt', 'Criação', '#4a6a2a'],
  ['aero', 'AeroDynamics', 'Ciência', '#2a5a7a'], ['ruin', 'Echoes of Ruin', 'Puzzle', '#6a5030'],
  ['neural', 'NeuralNet', 'Estratégia', '#1f4a7a'], ['zen', 'Zen Bonsai', 'Relaxar', '#7a3a5a'],
  ['atelier', 'Atelier de Luz', 'Arte', '#4a3a8a'], ['sound', 'Santuário Sonoro', 'Música', '#7a6030'],
  ['observ', 'Observatório Cósmico', 'Relaxar', '#1a5a5a'], ['koi', 'Lagoa Koi', 'Realidade mista', '#1f5a7a'],
].map(([exp, name, category, color]) => ({ id: 'aura-' + exp, exp, name, category, color, aura: true }));

export const auraUrl = (exp, mode = '') => new URL(`auraos-xr.html?exp=${encodeURIComponent(exp)}&from=bluenav${mode ? '&mode=' + mode : ''}`, document.baseURI).href;
