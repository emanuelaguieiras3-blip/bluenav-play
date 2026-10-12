'use strict';
// Monster parts, the guild's buying counter and hunting recognition. Everyday realism, kept quiet:
// every creature leaves something worth selling, prices move with how much the town sold that day,
// and strong kills (over 100 life) are written in the guild's hunting ledger and repeated by the town.
// Pure and deterministic; world-core binds its helpers with bind().
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.WorldTrade = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  let H = null; const bind = h => { H = h; };
  // kind: [common part, value, rare part, value, rare chance]
  const PARTS = {
    slime: [['geleia-limo', 'Geleia de limo densa', 6], ['nucleo-limo', 'Núcleo de limo', 28, .08]],
    wolf: [['presa-lobo', 'Presa de lobo', 9], ['pele-lobo', 'Pele de lobo inteira', 34, .1]],
    wisp: [['cinza-fagulha', 'Cinza de fagulha', 8], ['chama-fagulha', 'Chama engarrafada', 40, .07]],
    scarab: [['carapaca', 'Carapaça de besouro', 11], ['escaravelho-dourado', 'Escaravelho dourado', 55, .06]],
    ice: [['lasca-gelo', 'Lasca de gelo eterno', 14], ['coracao-gelo', 'Coração de gelo', 60, .07]],
    ember: [['brasa', 'Brasa que não apaga', 15], ['olho-brasa', 'Olho de magma', 62, .07]],
    necromancer: [['osso-ritual', 'Osso ritual', 16], ['grimorio-rasgado', 'Página de grimório proibido', 70, .08]],
    shade: [['essencia-sombra', 'Resíduo de sombra', 12], ['veu-sombra', 'Véu de sombra', 48, .08]],
    bat: [['asa-morcego', 'Asa de morcego', 8], ['presa-morcego', 'Presa venenosa', 30, .08]],
    spider: [['seda', 'Seda de aranha', 12], ['glandula', 'Glândula de veneno', 44, .09]],
    golem: [['po-cristal', 'Pó de cristal', 20], ['nucleo-golem', 'Núcleo de golem', 90, .07]],
    goblin: [['orelha-goblin', 'Orelha de goblin', 7], ['bolsa-goblin', 'Bolsa de moedas roubadas', 40, .1]],
    goblinArcher: [['orelha-goblin', 'Orelha de goblin', 7], ['flechas-goblin', 'Aljava goblin', 30, .12]],
    goblinShaman: [['amuleto-osso', 'Amuleto de osso', 18], ['cajado-xama', 'Cajado de xamã', 65, .08]],
    goblinBrute: [['clava', 'Clava cravejada', 22], ['armadura-osso', 'Armadura de ossos', 80, .08]],
    bandit: [['bolsa-bandido', 'Bolsa de bandido', 15], ['cartaz', 'Cartaz de recompensa', 60, .1]]
  };
  const MYSTIC = ['escama-mistica', 'Escama de criatura mística', 140];
  const BOSS_PART = ['relicario', 'Relicário de chefe', 320];
  // Every part becomes a sellable item (type 'loot'); the value is the guild's base price.
  const items = [];
  { const seen = new Set(); for (const list of [...Object.values(PARTS).flat(), MYSTIC, BOSS_PART]) { const [id, name, value] = list; if (seen.has(id)) continue; seen.add(id); items.push({ id, name, value }); } }
  const itemById = Object.fromEntries(items.map(i => [i.id, i]));

  // Drops: always the common part (two for strong creatures), sometimes the rare one.
  function roll(w, p, m, rng = Math.random) {
    const t = H.monsterTypes[m.kind]; if (!t || t.inert || m.minion && !t.boss) return [];
    const out = [], strong = (m.maxHp || t.hp) > 100;
    if (t.boss) { out.push([BOSS_PART[0], 1]); const own = PARTS[t.art] || PARTS[m.kind]; if (own) out.push([own[1][0], 1]); }
    else if (t.mystic) out.push([MYSTIC[0], 1]);
    else { const own = PARTS[m.kind] || PARTS[t.art]; if (!own) return []; out.push([own[0][0], strong ? 2 : 1]); if (rng() < own[1][3] * (1 + (p.isekai?.unique === 'sorte' ? .8 : 0))) out.push([own[1][0], 1]); }
    for (const [id, n] of out) { H.give(p, id, n); }
    return out;
  }

  // Market: each sale lowers that part's price for the day (−5% per unit, floor 45%);
  // a new day restores it. Guild rank adds +4% per rank; the day shifts prices a little.
  const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
  function market(w) { const day = w.day || 1; if (!w.market || w.market.day !== day) w.market = { day, sold: {} }; return w.market; }
  function price(w, p, id) {
    const it = itemById[id]; if (!it) return 0; const m = market(w), sold = m.sold[id] || 0;
    const mood = .9 + ((Math.sin((w.seed || 1) * 7.1 + (w.day || 1) * 3.7 + id.length) + 1) / 2) * .2;
    const rank = Math.max(0, RANKS.indexOf(p?.isekai?.rank || 'F'));
    return Math.max(1, Math.round(it.value * mood * Math.max(.45, 1 - sold * .05) * (1 + rank * .04)));
  }
  const atGuild = p => H.landmarkAt(p.x, p.y, 2.3)?.kind === 'guild' || H.buildingAt(p.x, p.y)?.kind === 'guild';
  function sell(w, p, id, n = 1) {
    if (!itemById[id]) throw new Error('A guilda não compra este item.');
    if (!atGuild(p)) throw new Error('Venda no balcão da guilda.');
    n = Math.max(1, Math.min(Number(n) || 1, p.inventory[id] || 0)); if (!(p.inventory[id] > 0)) throw new Error('Você não tem este item.');
    let total = 0; for (let i = 0; i < n; i++) { total += price(w, p, id); market(w).sold[id] = (market(w).sold[id] || 0) + 1; }
    H.consume(p, id, n); p.gold += total; p.trade ||= { sold: 0, earned: 0 }; p.trade.sold += n; p.trade.earned += total;
    if (p.guild) p.guild.reputation += Math.floor(n / 5);
    H.system(w, p, `Vendido na guilda: ${n}× ${itemById[id].name} por ${total} moedas.`, 'info');
    return total;
  }
  // Adventurers selling their haul also move the market (called by world-adventurers).
  function supply(w, id, n) { if (itemById[id]) market(w).sold[id] = (market(w).sold[id] || 0) + n; }

  // Recognition: kills of creatures over 100 life go in the ledger; the first of each kind, and every
  // tenth, become town news. Milestones bring a letter from the guild master.
  const MILESTONES = [[5, 'Caçador reconhecido', { gold: 80 }], [25, 'Matador de feras', { gold: 250, items: { elixir: 1 } }], [60, 'Terror das estradas', { gold: 500, items: { elixir: 2 } }], [120, 'Lenda da guilda', { gold: 1200, items: { elixir: 3 } }]];
  function recognize(w, p, m) {
    const t = H.monsterTypes[m.kind], hp = m.maxHp || t?.hp || 0; if (!t || hp <= 100 || t.inert) return;
    const log = p.ledger ||= { notable: 0, kinds: {}, best: null, titles: [] }; log.notable++; const first = !log.kinds[m.kind]; log.kinds[m.kind] = (log.kinds[m.kind] || 0) + 1;
    if (!log.best || hp > log.best.hp) log.best = { kind: m.kind, name: t.name, hp, day: w.day || 1 };
    if (p.guild) p.guild.reputation += t.boss ? 12 : 2;
    const name = H.fullName(p);
    if (first || log.kinds[m.kind] % 10 === 0) {
      const text = t.boss ? `Dizem que ${name} derrubou ${t.name}. A guilda já pendurou o aviso.` : first ? `${name} abateu uma criatura forte: ${t.name}, com ${hp} de vida. A guilda anotou no livro de caça.` : `${name} já soma ${log.kinds[m.kind]} abates de ${t.name}. Os caçadores comentam na taverna.`;
      const l = w.life ||= { revision: 1, npcs: {}, animals: [], news: [], nextTick: 0 }; l.news ||= []; l.news.push({ text, at: w.time }); if (l.news.length > 12) l.news.shift();
      H.system(w, p, first ? `Abate registrado pela guilda: ${t.name} (${hp} de vida).` : `Registro de caça: ${log.kinds[m.kind]}× ${t.name}.`, 'info');
    }
    for (const [need, title, gift] of MILESTONES) if (log.notable === need && !log.titles.includes(title)) {
      log.titles.push(title);
      H.letter?.(w, p, { title: 'Livro de caça da guilda', text: `${name}, o livro da guilda já tem ${need} abates seus de criaturas fortes. A partir de hoje os aventureiros te chamam de «${title}». Receba este pagamento pelo serviço às estradas.`, gift, seal: '#b8302a', crest: '⚔', kind: 'guild', from: 'Mestre da guilda · Guilda dos Caminhantes' });
    }
  }
  const titleOf = p => p.ledger?.titles?.at(-1) || '';
  return { bind, PARTS, items, itemById, roll, price, sell, supply, market, recognize, titleOf, MILESTONES };
});
