// Catálogo dos jogos próprios BlueNav. Originais comerciais têm acesso externo.
// Cada jogo BlueNav é carregado sob demanda (import dinâmico),
// então a abertura do site continua leve.
export const GAMES = [
  { id: 'complex', name: 'Complexo', emoji: '🤖', color: '#4a5560', file: 'complex' },
  { id: 'sandbox', name: 'Laboratório Sandbox', emoji: '🧱', color: '#627b91', file: 'sandbox' },
  { id: 'jobs', name: 'Oficina de Trabalho', emoji: '🛠️', color: '#6e9b84', file: 'jobs' },
  { id: 'tactical', name: 'Treino Tático VR', emoji: '🎯', color: '#5b6975', file: 'tactical' },
  { id: 'racing', name: 'Piloto', emoji: '🏎️', color: '#3a3f4a', file: 'racing' },
  { id: 'ski', name: 'Descida Alpina', emoji: '⛷️', color: '#91c9e9', file: 'ski' },
  { id: 'motorbike', name: 'Moto de Trilha', emoji: '🏍️', color: '#b95d3e', file: 'motorbike' },
  { id: 'shiftworld', name: 'Mundo Transformado', emoji: '🌀', color: '#9368aa', file: 'shiftworld' },
  { id: 'jungle', name: 'Pega-pega VR', emoji: '🦍', color: '#2f6b2a', file: 'jungle' },
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

export const GAME_OBJECTIVES = Object.freeze({
  complex: 'Abra as portas e atravesse o pátio até a saída.',
  sandbox: 'Construa e teste máquinas com objetos físicos.',
  jobs: 'Conclua os pedidos das estações de trabalho.',
  tactical: 'Elimine os alvos usando cobertura e recarga.',
  racing: 'Complete três voltas e termine em primeiro.',
  ski: 'Passe por pelo menos 9 dos 12 portões e chegue ao fim da pista.',
  motorbike: 'Acelere, passe por pelo menos 9 portões e chegue ao fim da trilha.',
  shiftworld: 'Restaure três âncoras e atravesse o portal para salvar o mundo.',
  jungle: 'Mova-se com os braços e vença a rodada de pega-pega.',
  arena: 'Derrote os adversários com espada e escudo.',
  archery: 'Acerte os alvos com o arco.',
  rhythm: 'Corte os blocos na direção indicada e evite obstáculos.',
  kingdom: 'Explore, construa e proteja seu reino.',
  dungeon: 'Explore a masmorra e derrote o chefe.',
  galaxy: 'Pilote, complete a missão e sobreviva.',
  puzzle: 'Resolva o quebra-cabeça para avançar.',
  dive: 'Mergulhe, colete recursos e retorne em segurança.',
  climb: 'Escale até o ponto final.',
  night: 'Sobreviva às ondas de inimigos.',
  cook: 'Prepare os pedidos antes do tempo acabar.',
  tablegames: 'Escolha um jogo de mesa e vença a partida.',
  physics: 'Resolva os desafios usando física.',
  blocks: 'Explore e construa no mundo de blocos.',
});

export function loadGameModule(id) {
  if (id === 'lobby') return import('./lobby.js');
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error('Jogo não encontrado: ' + id);
  return import(`./${g.file}.js`);
}
