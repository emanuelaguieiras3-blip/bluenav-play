// Visual BlueNav: avatar, roupas e carros. Itens com preço são liberados com
// fichas ganhas nas salas. Tudo fica salvo no navegador.

export const COSMETICS = {
  skin: [['Clara', '#f2d3b8', 0], ['Média', '#d9a77f', 0], ['Morena', '#a8714a', 0], ['Escura', '#6b4428', 0], ['Azul', '#7fb2ff', 40], ['Verde', '#7fdc9a', 40], ['Roxa', '#b892ff', 60], ['Dourada', '#ffd25e', 150]],
  shirt: [['Camiseta azul', '#3f7fd1', 0], ['Camiseta vermelha', '#d64545', 0], ['Moletom verde', '#3c9a5f', 0], ['Listrada', '#f2f2f2', 20, 'stripes'], ['Xadrez', '#c0392b', 30, 'checker'], ['Jaqueta preta', '#22252b', 40], ['Estrelas', '#25315f', 60, 'stars'], ['Neon', '#ff3ea5', 80, 'stripes'], ['Camuflada', '#5b6b3a', 90, 'checker'], ['Dourada', '#e0b03a', 200, 'stars']],
  hair: [['Careca', null, 0], ['Curto', 'short', 0], ['Cacheado', 'curly', 0], ['Moicano', 'mohawk', 30], ['Rabo de cavalo', 'ponytail', 20], ['Coque', 'bun', 20], ['Franja', 'fringe', 30], ['Black power', 'afro', 40]],
  hairColor: [['Castanho', '#5a3a22', 0], ['Preto', '#1d1a1a', 0], ['Loiro', '#e6c36a', 0], ['Ruivo', '#b5502a', 10], ['Grisalho', '#c9c9c9', 10], ['Azul', '#3a7bff', 40], ['Rosa', '#ff6fb5', 40], ['Verde', '#3ccf7a', 40]],
  mouth: [['Sorriso', 'smile', 0], ['Sorrisão', 'grin', 0], ['Sério', 'flat', 0], ['Surpreso', 'o', 10], ['Língua', 'tongue', 30]],
  hat: [['Nenhum', null, 0], ['Boné', '#d64545', 0], ['Gorro', '#3f7fd1', 10], ['Cartola', '#1c1c22', 50], ['Coroa', '#ffcc33', 200], ['Capacete', '#f2f2f2', 40], ['Chapéu de praia', '#e8c37a', 30], ['Orelhas', '#ff9ec7', 70], ['Halo', '#fff6a8', 250], ['Chifres', '#8a2b2b', 120]],
  face: [['Nada', null, 0], ['Óculos', 'glasses', 0], ['Óculos escuros', 'shades', 20], ['Bigode', 'mustache', 30], ['Visor', 'visor', 60], ['Máscara', 'mask', 80], ['Estrelas', 'stareyes', 120]],
  car: [['Esportivo', 'sport', 0], ['Buggy', 'buggy', 40], ['Caminhonete', 'truck', 80], ['Kart', 'kart', 30]],
  paint: [['Vermelho', '#c21f2a', 0], ['Azul', '#2a64d8', 0], ['Amarelo', '#f2b01e', 0], ['Verde', '#1f9a52', 10], ['Preto', '#1b1d22', 20], ['Branco', '#eef1f4', 20], ['Rosa', '#ff5fa2', 40], ['Laranja', '#ff7a1a', 40], ['Roxo', '#7a3cff', 60], ['Ciano', '#21d4e8', 60], ['Prata', '#b9c2cc', 90], ['Ouro', '#d4a017', 300]],
  pattern: [['Liso', null, 0], ['Faixas', 'stripes', 30], ['Chamas', 'flames', 80], ['Xadrez', 'checker', 60], ['Estrelas', 'stars', 100]],
};
export const CATEGORY_NAMES = { hair: 'Cabelo', hairColor: 'Cor do cabelo', mouth: 'Boca', skin: 'Pele', shirt: 'Roupa', hat: 'Chapéu', face: 'Rosto', car: 'Carro', paint: 'Pintura', pattern: 'Adesivo' };
export const DEFAULT_LOOK = { skin: 1, shirt: 0, hair: 1, hairColor: 0, mouth: 0, hat: 0, face: 0, car: 0, paint: 0, pattern: 0 };
export const SKIN_COUNT = Object.values(COSMETICS).reduce((n, list) => n + list.length, 0);
const KEY = 'bluenav.plaza';

export function itemOf(category, index) { const it = COSMETICS[category]?.[index]; return it ? { name: it[0], value: it[1], price: it[2], pattern: it[3] || null } : null; }

export function validLook(look) {
  const out = { ...DEFAULT_LOOK };
  for (const k of Object.keys(DEFAULT_LOOK)) if (Number.isInteger(look?.[k]) && look[k] >= 0 && look[k] < COSMETICS[k].length) out[k] = look[k];
  return out;
}

export class Wardrobe {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage; this.look = { ...DEFAULT_LOOK }; this.tokens = 50; this.owned = new Set(); this.completed = new Set();
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || 'null');
      if (saved) { this.look = validLook(saved.look); this.tokens = Number.isFinite(saved.tokens) ? Math.max(0, Math.floor(saved.tokens)) : 50; this.owned = new Set((saved.owned || []).filter(s => typeof s === 'string')); this.completed = new Set((saved.completed || []).filter(Number.isInteger)); }
    } catch { /* storage blocked or corrupt: defaults */ }
  }
  save() { try { this.storage?.setItem(KEY, JSON.stringify({ look: this.look, tokens: this.tokens, owned: [...this.owned], completed: [...this.completed] })); } catch { /* private mode */ } }
  owns(category, index) { const it = itemOf(category, index); return !!it && (it.price === 0 || this.owned.has(`${category}:${index}`)); }
  // Equip if owned; buy first if there are enough tokens.
  choose(category, index) {
    const it = itemOf(category, index); if (!it) return { ok: false, reason: 'Item inexistente' };
    if (!this.owns(category, index)) {
      if (this.tokens < it.price) return { ok: false, reason: `Faltam ${it.price - this.tokens} fichas` };
      this.tokens -= it.price; this.owned.add(`${category}:${index}`);
    }
    this.look[category] = index; this.save(); return { ok: true };
  }
  cycle(category, step) { const n = COSMETICS[category].length; return (this.look[category] + step + n) % n; }
  // First completion of a map pays more than a replay.
  reward(mapIndex, amount) { const first = !this.completed.has(mapIndex); this.completed.add(mapIndex); const paid = first ? amount : Math.ceil(amount / 4); this.tokens += paid; this.save(); return paid; }
}
