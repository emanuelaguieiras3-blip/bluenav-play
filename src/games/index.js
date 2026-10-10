// Catálogo dos 16 jogos. Cada um é carregado sob demanda (import dinâmico),
// então a abertura do site continua leve.
export const GAMES = [
  { id: 'racing', name: 'Piloto', emoji: '🏎️', color: '#3a3f4a', file: 'racing' },
  { id: 'jungle', name: 'Selva Livre', emoji: '🦍', color: '#2f6b2a', file: 'jungle' },
  { id: 'arena', name: 'Arena', emoji: '⚔️', color: '#6b5a44', file: 'arena' },
  { id: 'archery', name: 'Arqueiro', emoji: '🎯', color: '#8a5a2b', file: 'archery' },
  { id: 'rhythm', name: 'Ritmo de Luz', emoji: '🎧', color: '#20242c', file: 'rhythm' },
  { id: 'kingdom', name: 'Reinos', emoji: '🏰', color: '#3c7fb5', file: 'kingdom' },
  { id: 'dungeon', name: 'Masmorra', emoji: '🗝️', color: '#3b3330', file: 'dungeon' },
  { id: 'galaxy', name: 'Galáxia', emoji: '🚀', color: '#1d2a5c', file: 'galaxy' },
  { id: 'puzzle', name: 'Quebra-cabeça', emoji: '🧩', color: '#7a8aa6', file: 'puzzle' },
  { id: 'dive', name: 'Mergulho', emoji: '🌊', color: '#1a6f8a', file: 'dive' },
  { id: 'climb', name: 'Escalada', emoji: '🧗', color: '#6a6f78', file: 'climb' },
  { id: 'night', name: 'Sobrevivência', emoji: '🔦', color: '#26263a', file: 'night' },
  { id: 'cook', name: 'Cozinheiro', emoji: '🍳', color: '#a0522d', file: 'cook' },
  { id: 'tablegames', name: 'Sala de Jogos', emoji: '🃏', color: '#5a3a22', file: 'tablegames' },
  { id: 'physics', name: 'Física', emoji: '🧪', color: '#4a7a8a', file: 'physics' },
  { id: 'blocks', name: 'Mundo de Blocos', emoji: '🟫', color: '#5e8a34', file: 'blocks' },
];

export function loadGameModule(id) {
  if (id === 'lobby') return import('./lobby.js');
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error('Jogo não encontrado: ' + id);
  return import(`./${g.file}.js`);
}
