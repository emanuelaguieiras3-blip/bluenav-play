'use strict';
// Guild of the Wayfarers: a daily contract board (hunts, deliveries, crafting, exploration, royal and
// noble requests), fame with the three crowns and favor with the noble houses, and sealed letters when
// they start paying attention. Pure and deterministic (the board comes from the world seed and day),
// so the browser, the Node server and the tests agree. World-core binds its helpers with bind().
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.WorldGuild = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  let H = null; const bind = h => { H = h; };
  const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const nations = [
    { id: 'auroria', name: 'Aurória', crown: 'Coroa de Aurória', crest: '☀', color: '#c69b48', ruler: 'Rei Aldren Solalto', chancellor: 'Chanceler Ivo Marés' },
    { id: 'lunaria', name: 'Lunária', crown: 'Coroa de Lunária', crest: '☾', color: '#9a86d6', ruler: 'Rei Orion Véulunar', chancellor: 'Astróloga Nádia Céu' },
    { id: 'brasalar', name: 'Brasalar', crown: 'Coroa de Brasalar', crest: '✧', color: '#e07a4f', ruler: 'Rei Darian Rubrálio', chancellor: 'Mestre-ferreiro Otávio Brasa' },
  ];
  const nobles = [
    { id: 'salgueiro', name: 'Casa Salgueiro', nation: 'auroria', lord: 'Lady Iolanda Salgueiro', color: '#6f9a63', crest: '❦' },
    { id: 'luar', name: 'Casa Luar', nation: 'lunaria', lord: 'Conde Elias Luar', color: '#8c95c9', crest: '☾' },
    { id: 'brum', name: 'Casa Brum', nation: 'brasalar', lord: 'Barão Tadeu Brum', color: '#9fb4bf', crest: '⛰' },
    { id: 'ferraz', name: 'Casa Ferraz', nation: 'brasalar', lord: 'Dama Celeste Ferraz', color: '#d0a45a', crest: '⚜' },
  ];
  const clients = {
    vila: { name: 'Aldeões de Salgueiro', seal: '#8a6a3e', crest: '✿' }, mercadores: { name: 'Mercadores das Estradas', seal: '#6b5a3a', crest: '⚖' }, guilda: { name: 'Guilda dos Caminhantes', seal: '#3f6f8f', crest: '⚔' },
    ...Object.fromEntries(nations.map(n => [n.id, { name: n.crown, seal: n.color, crest: n.crest, nation: n.id }])),
    ...Object.fromEntries(nobles.map(n => [n.id, { name: n.name, seal: n.color, crest: n.crest, nation: n.nation, noble: n.id }])),
  };
  const nationById = Object.fromEntries(nations.map(n => [n.id, n])), nobleById = Object.fromEntries(nobles.map(n => [n.id, n]));
  const fameTiers = [[0, 'Desconhecido'], [30, 'Notado'], [90, 'Reconhecido'], [180, 'Favorito da Corte'], [320, 'Campeão do Reino']];
  const favorTiers = [[0, 'Estranho'], [25, 'Conhecido'], [60, 'Protegido'], [120, 'Aliado da Casa']];

  // [id, rank, client, type, target, n, title, text] — type: hunt | bring | craft | visit | deliver | raid
  const T = [
    ['limos', 'F', 'vila', 'hunt', 'slime', 6, 'Limo na horta', 'Os limos invadiram as hortas ao sul da vila. Derrote {n} deles antes que comam as sementes.'],
    ['lenha', 'F', 'vila', 'bring', 'wood', 12, 'Lenha para o inverno', 'A pousada precisa de lenha seca. Traga {n} madeiras.'],
    ['ervas', 'F', 'salgueiro', 'bring', 'herb', 8, 'Chá da senhora Iolanda', 'A Casa Salgueiro pede {n} ervas frescas para o chá da tarde da família.'],
    ['amoras', 'F', 'vila', 'bring', 'berry', 10, 'Torta de amora', 'A padeira quer {n} amoras. Diz que a primeira fatia é de quem trouxer.'],
    ['gosma', 'F', 'guilda', 'bring', 'slime', 6, 'Gosma para colas', 'O depósito da guilda ficou sem cola. Traga {n} gosmas de limo.'],
    ['fibra', 'F', 'mercadores', 'bring', 'fiber', 10, 'Cordas para a caravana', 'As caravanas precisam de cordas novas: {n} fibras.'],
    ['poco', 'F', 'guilda', 'visit', 'well', 1, 'Primeiro dia de aventureiro', 'Todo novato começa pelo poço da vila. Vá até lá e volte para registrar seu primeiro contrato.'],
    ['lobos', 'E', 'salgueiro', 'hunt', 'wolf', 5, 'Lobos no bosque', 'Lobos de musgo atacam os rebanhos da Casa Salgueiro. Derrote {n}.'],
    ['couro', 'E', 'mercadores', 'bring', 'leather', 5, 'Couro para selas', 'Traga {n} couros. As selas das carroças estão rachando.'],
    ['peixe', 'E', 'vila', 'bring', 'fish', 6, 'Peixe para a feira', 'Dia de feira! Pesque {n} peixes para as barracas.'],
    ['cercas', 'E', 'vila', 'craft', 'fence', 3, 'Cercas novas', 'O vento derrubou o curral. Fabrique {n} cercas.'],
    ['pocoes', 'E', 'guilda', 'craft', 'potion', 4, 'Estoque de poções', 'A enfermaria da guilda precisa de {n} poções de vida.'],
    ['solar', 'E', 'salgueiro', 'visit', 'seat-salgueiro', 1, 'Convite ao solar', 'A Casa Salgueiro quer conhecer quem anda ajudando a vila. Visite o Solar Salgueiro.'],
    ['lunaria-pocoes', 'E', 'lunaria', 'deliver', 'potion', 3, 'Remédios para Lunária', 'Febre nas torres violetas. Leve {n} poções até o pátio de Lunária.'],
    ['fagulhas', 'D', 'luar', 'hunt', 'wisp', 5, 'Fagulhas no pântano', 'Os astrônomos da Casa Luar não enxergam as estrelas com tantas fagulhas. Apague {n}.'],
    ['besouros', 'D', 'ferraz', 'hunt', 'scarab', 5, 'Besouros nas escavações', 'A Casa Ferraz perdeu três ferramentas para os besouros. Derrote {n}.'],
    ['essencia', 'D', 'luar', 'bring', 'essence', 4, 'Essência para lunetas', 'Traga {n} essências. As lentes da Casa Luar brilham com elas.'],
    ['cobre', 'D', 'ferraz', 'bring', 'ore2', 6, 'Metal para o palácio', 'O Palácio das Dunas encomendou {n} minérios de ferro.'],
    ['carvao', 'D', 'brasalar', 'bring', 'coal', 6, 'Brasas para as forjas', 'As forjas de Brasalar esfriaram. Traga {n} carvões.'],
    ['lanternas', 'D', 'auroria', 'craft', 'lantern', 2, 'Luz nas muralhas', 'A guarda de Aurória pede {n} lanternas para a ronda noturna.'],
    ['ambar', 'D', 'lunaria', 'visit', 'amber', 1, 'O Altar de Âmbar', 'A rainha de Lunária quer notícias do Altar de Âmbar. Vá até lá.'],
    ['cobre-cav', 'D', 'guilda', 'visit', 'copper-cave', 1, 'Mapa da Gruta do Cobre', 'A cartógrafa precisa de alguém que confirme a entrada da Gruta do Cobre.'],
    ['brasalar-lenha', 'D', 'brasalar', 'deliver', 'wood', 10, 'Madeira para Brasalar', 'Leve {n} madeiras até o pátio de Brasalar para os andaimes do palácio.'],
    ['gelo', 'C', 'brum', 'hunt', 'ice', 5, 'Passagem congelada', 'Guardiões de gelo bloqueiam a passagem da Casa Brum. Derrote {n}.'],
    ['vigias', 'C', 'auroria', 'hunt', 'necromancer', 4, 'Vigias da floresta densa', 'A Coroa de Aurória teme os vigias das almas. Derrote {n}.'],
    ['goblins', 'C', 'mercadores', 'hunt', 'goblin', 6, 'Saqueadores goblins', 'Goblins saqueiam as minas. Derrote {n} e as caravanas voltam a passar.'],
    ['morcegos', 'C', 'guilda', 'hunt', 'bat', 6, 'Morcegos das profundezas', 'Os mineiros não descem mais com tantos morcegos. Derrote {n}.'],
    ['bombas', 'C', 'brum', 'craft', 'bomb', 3, 'Explosivos para a pedreira', 'A Casa Brum quer abrir um novo túnel. Fabrique {n} bombas.'],
    ['tonicos', 'C', 'auroria', 'craft', 'tonic', 3, 'Tônicos para a guarda', 'O capitão da guarda de Aurória pede {n} tônicos.'],
    ['estanho', 'C', 'auroria', 'deliver', 'ore5', 4, 'Minério para a capital', 'Leve {n} minérios de prata até a praça de Aurória.'],
    ['geada', 'C', 'brum', 'visit', 'frost', 1, 'O Templo da Geada', 'A Casa Brum perdeu contato com o Templo da Geada. Vá verificar.'],
    ['cristais', 'C', 'luar', 'visit', 'crystal-cave', 1, 'A Caverna dos Cristais', 'A Casa Luar quer saber se a Caverna dos Cristais ainda brilha.'],
    ['brasas', 'B', 'brasalar', 'hunt', 'ember', 5, 'Brasas vivas na savana', 'As brasas vivas incendeiam o capim de Brasalar. Apague {n}.'],
    ['xamas', 'B', 'ferraz', 'hunt', 'goblinShaman', 3, 'Xamãs da mina', 'Xamãs goblins amaldiçoaram a mina dos Ferraz. Derrote {n}.'],
    ['aranhas', 'B', 'luar', 'hunt', 'spider', 5, 'Teias no Abismo', 'Aranhas tecelãs cobriram a entrada do Abismo. Derrote {n}.'],
    ['elixir', 'B', 'lunaria', 'craft', 'elixir', 2, 'Elixir da rainha', 'A rainha Selene pede {n} elixires para os estudiosos da corte.'],
    ['raide', 'B', 'guilda', 'raid', 'any', 1, 'Prova de fogo', 'Conclua uma raide. A guilda quer ver você com um grupo, ou sozinho, vencendo três ondas.'],
    ['cinzas', 'B', 'brasalar', 'visit', 'cinder', 1, 'O Portal das Cinzas', 'O rei Darian quer saber o estado do Portal das Cinzas.'],
    ['golens', 'A', 'auroria', 'hunt', 'golem', 3, 'Golens de cristal', 'Golens despertaram nas fendas. A Coroa de Aurória paga bem por {n}.'],
    ['yeti', 'A', 'brum', 'hunt', 'frostBoss', 1, 'Hrokk, o Yeti', 'Hrokk voltou ao Templo do Gelo. A Casa Brum oferece uma recompensa pela cabeça dele.'],
    ['barao', 'A', 'salgueiro', 'hunt', 'rootBoss', 1, 'O barão das raízes', 'O Barão Cardo Espinheiro ameaça as terras dos Salgueiro. Derrote-o.'],
    ['condessa', 'A', 'ferraz', 'hunt', 'ashBoss', 1, 'A condessa das cinzas', 'A Condessa Ísis Valcinza reacendeu seus salões. A Casa Ferraz quer vê-la derrotada.'],
    ['cidadela', 'A', 'guilda', 'visit', 'totem-citadel', 1, 'Às portas da Cidadela', 'A guilda precisa de um relatório da entrada da Cidadela do Totem.'],
    ['aracne', 'S', 'lunaria', 'hunt', 'spiderQueen', 1, 'A rainha tecelã', 'Aracne governa o covil das teias. Lunária pede sua derrota.'],
    ['ignarok', 'S', 'auroria', 'hunt', 'wyrm', 1, 'Ignarok, o coração de magma', 'O rei Aldren em pessoa pede: derrote Ignarok no Coração de Magma.'],
    // Royal requests appear only once the crown already knows your name (fame "Reconhecido").
    ['r-auroria', 'C', 'auroria', 'hunt', 'wolf', 12, 'Pedido real: rotas seguras', 'Selo real de Aurória. As estradas do rei devem estar livres de lobos: derrote {n}.', { royal: true }],
    ['r-lunaria', 'C', 'lunaria', 'visit', 'marsh', 1, 'Pedido real: a névoa do pântano', 'Selo real de Lunária. O rei Orion quer um relatório do Santuário do Pântano.', { royal: true }],
    ['r-brasalar', 'C', 'brasalar', 'craft', 'bench', 2, 'Pedido real: bancos para o salão', 'Selo real de Brasalar. O salão do trono precisa de {n} bancos dignos.', { royal: true }],
    ['r-salgueiro', 'D', 'salgueiro', 'bring', 'ore0', 10, 'Pedido da casa: sinos de cobre', 'A Casa Salgueiro confia em você: traga {n} minérios de cobre para os sinos.', { special: true }],
    ['r-luar', 'B', 'luar', 'hunt', 'wisp', 10, 'Pedido da casa: a noite limpa', 'O Conde Elias quer a noite mais limpa em cem anos. Apague {n} fagulhas.', { special: true }],
  ];
  const REWARD = { gold: [30, 55, 90, 140, 220, 340, 520], xp: [40, 70, 110, 170, 260, 380, 560], rep: [8, 12, 18, 26, 36, 50, 70], fame: [6, 9, 13, 18, 25, 34, 46] };
  const templates = T.map(([id, rank, client, type, target, n, title, text, flags = {}]) => {
    const r = RANKS.indexOf(rank), boost = flags.royal ? 1.6 : flags.special ? 1.4 : 1;
    return { id, rank, rankIndex: r, client, type, target, n, title, text: text.replace('{n}', n), royal: !!flags.royal, special: !!flags.special,
      reward: { gold: Math.round(REWARD.gold[r] * boost), xp: Math.round(REWARD.xp[r] * boost), rep: Math.round(REWARD.rep[r] * boost), fame: Math.round(REWARD.fame[r] * (flags.royal ? 2 : boost)) } };
  });
  const byId = Object.fromEntries(templates.map(t => [t.id, t]));
  const MAX_ACTIVE = 3, BOARD = 10;

  const tierOf = (tiers, v) => { let i = 0; tiers.forEach(([need], k) => { if (v >= need) i = k; }); return i; };
  function ensure(p) {
    p.guildQuests ||= { active: [], done: {}, completed: 0 }; const g = p.guildQuests; g.active ||= []; g.done ||= {}; g.completed ||= 0;
    p.renown ||= {}; p.favor ||= {}; p.nobility ||= { fame: {}, favor: {} }; p.letters ||= [];
    for (const n of nations) p.renown[n.id] ||= 0; for (const n of nobles) p.favor[n.id] ||= 0; return g;
  }
  const rankIndex = p => Math.max(0, RANKS.indexOf(p.isekai?.rank || rankFromRep(p.guild?.reputation || 0)));
  function rankFromRep(rep) { const need = [0, 40, 100, 200, 350, 550, 800]; let r = 0; need.forEach((v, i) => { if (rep >= v) r = i; }); return RANKS[r]; }
  function unlocked(p, t) {
    const c = clients[t.client];
    if (t.royal) return c.nation && tierOf(fameTiers, p.renown?.[c.nation] || 0) >= 2;
    if (t.special) return c.noble && (p.favor?.[c.noble] || 0) >= 60;
    return true;
  }
  // Same board for every player on a given world day; availability is personal.
  function board(w, p) {
    const day = w.day || 1, seed = (w.seed || 1) * 31 + day * 977;
    const rnd = i => { const x = Math.sin(seed + i * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const pool = templates.filter(t => !t.royal && !t.special).map((t, i) => ({ t, k: rnd(i) })).sort((a, b) => a.k - b.k).map(x => x.t);
    const pick = [], rank = p ? rankIndex(p) : 0;
    // Keep the board useful: most contracts at or near the player's rank, a couple to aim for.
    for (const t of pool) { if (pick.length >= BOARD) break; if (t.rankIndex <= rank + 1 || pick.filter(x => x.rankIndex > rank + 1).length < 2) pick.push(t); }
    const extra = p ? templates.filter(t => (t.royal || t.special) && unlocked(p, t)) : [];
    return [...extra, ...pick].map(t => ({ ...t, instance: t.id + '@' + day, locked: p ? t.rankIndex > rank + 1 : false }));
  }
  const slain = (p, kind) => p.isekai?.slain?.[kind] || 0;
  function progress(p, q) {
    const t = byId[q.tid]; if (!t) return 0;
    if (t.type === 'hunt') return Math.min(t.n, slain(p, t.target) - (q.base || 0));
    if (t.type === 'raid') return Math.min(t.n, (p.raidsCompleted || 0) - (q.base || 0));
    if (t.type === 'visit') return q.ready ? 1 : 0;
    if (t.type === 'deliver') return q.ready ? t.n : Math.min(t.n, p.inventory[t.target] || 0);
    return Math.min(t.n, p.inventory[t.target] || 0);
  }
  const complete = (p, q) => { const t = byId[q.tid]; return t && (t.type === 'visit' || t.type === 'deliver' ? !!q.ready : progress(p, q) >= t.n); };
  const atGuild = p => H.landmarkAt(p.x, p.y, 2.3)?.kind === 'guild' || H.buildingAt(p.x, p.y)?.kind === 'guild';

  function accept(w, p, instance) {
    const g = ensure(p); if (!p.guild) throw new Error('Inscreva-se na guilda antes de aceitar contratos.');
    if (!atGuild(p)) throw new Error('Aceite contratos no mural da guilda.');
    if (g.active.length >= MAX_ACTIVE) throw new Error('Você já tem três contratos. Conclua ou desista de um.');
    const t = board(w, p).find(x => x.instance === instance); if (!t) throw new Error('Este contrato não está mais no mural.');
    if (t.locked) throw new Error(`Rank insuficiente: este contrato é para rank ${t.rank}.`);
    if (g.done[instance] || g.active.some(q => q.instance === instance)) throw new Error('Você já pegou este contrato hoje.');
    const q = { instance, tid: t.id, day: w.day || 1, base: t.type === 'hunt' ? slain(p, t.target) : t.type === 'raid' ? (p.raidsCompleted || 0) : 0, ready: false, noted: false };
    g.active.push(q); H.event(w, 'questAccept', p.x, p.y, t.title, '#e8c14a', p.id);
    H.system(w, p, `Contrato aceito: 「${t.title}」.`, 'info');
  }
  function abandon(w, p, instance) { const g = ensure(p), i = g.active.findIndex(q => q.instance === instance); if (i < 0) throw new Error('Contrato não encontrado.'); const [q] = g.active.splice(i, 1); H.system(w, p, `Contrato abandonado: 「${byId[q.tid].title}」.`, 'info'); }
  function turnIn(w, p, instance) {
    const g = ensure(p), i = g.active.findIndex(q => q.instance === instance); if (i < 0) throw new Error('Contrato não encontrado.');
    if (!atGuild(p)) throw new Error('Entregue contratos no balcão da guilda.');
    const q = g.active[i], t = byId[q.tid]; if (!complete(p, q)) throw new Error('O contrato ainda não foi cumprido.');
    if (t.type === 'bring' || t.type === 'craft') { if ((p.inventory[t.target] || 0) < t.n) throw new Error('Faltam itens para entregar.'); H.consume(p, t.target, t.n); }
    g.active.splice(i, 1); g.done[instance] = true; g.completed++;
    for (const k of Object.keys(g.done)) if (Number(k.split('@')[1]) < (w.day || 1) - 3) delete g.done[k];
    const r = t.reward, noble = H.familyOf(p).noble;
    p.gold += r.gold; H.gainXP(w, p, r.xp); if (p.guild) p.guild.reputation += r.rep + (noble ? 2 : 0);
    const c = clients[t.client]; if (c.nation) addFame(w, p, c.nation, c.noble ? Math.ceil(r.fame / 2) : r.fame); if (c.noble) addFavor(w, p, c.noble, r.fame);
    H.event(w, 'questDone', p.x, p.y, t.title, '#ffd86a', p.id);
    H.system(w, p, `Contrato concluído: 「${t.title}」. +${r.gold} moedas, +${r.xp} EXP, +${r.rep} de reputação${c.nation ? ', fama em ' + nationById[c.nation].name : ''}.`, 'quest');
    H.check?.(w, p);
  }
  function addFame(w, p, nation, n) {
    ensure(p); p.renown[nation] += n; const before = p.nobility.fame[nation] || 0, now = tierOf(fameTiers, p.renown[nation]);
    for (let k = before + 1; k <= now; k++) fameLetter(w, p, nation, k); p.nobility.fame[nation] = Math.max(before, now);
  }
  function addFavor(w, p, house, n) {
    ensure(p); p.favor[house] += n; const before = p.nobility.favor[house] || 0, now = tierOf(favorTiers, p.favor[house]);
    for (let k = before + 1; k <= now; k++) favorLetter(w, p, house, k); p.nobility.favor[house] = Math.max(before, now);
  }
  function letter(w, p, l) { ensure(p); p.letters.unshift({ id: 'l' + (p.letters.length + 1) + '-' + (w.day || 1), day: w.day || 1, read: false, ...l }); if (p.letters.length > 30) p.letters.pop(); H.event(w, 'letter', p.x, p.y, l.from, l.seal, p.id); H.system(w, p, `Uma carta com o selo de ${l.from} chegou. Leia na guilda (aba Cartas).`, 'letter'); }
  function fameLetter(w, p, nation, tier) {
    const n = nationById[nation], name = H.fullName(p);
    const L = {
      1: { title: 'Seu nome chegou à corte', text: `${name}, a ${n.crown} tomou conhecimento dos seus contratos. Continue servindo o povo e a corte saberá recompensar.`, gift: { items: { potion: 3 } }, from: n.chancellor },
      2: { title: 'Reconhecimento da coroa', text: `${name}, por ordem de ${n.ruler}, seu nome foi escrito no livro da corte. A partir de hoje, pedidos reais com o nosso selo aparecerão no mural da guilda.`, gift: { gold: 150 }, from: n.chancellor },
      3: { title: 'Convite ao salão real', text: `${name}, ${n.ruler} deseja que você seja tratado como amigo da coroa em ${n.name}. Receba o título de Cavaleiro e estes elixires para as estradas.`, gift: { items: { elixir: 2 } }, from: n.ruler },
      4: { title: 'Campeão do reino', text: `${name}, o reino inteiro fala do seu nome. Eu, ${n.ruler}, declaro você Campeão de ${n.name}. Que as portas do palácio estejam sempre abertas.`, gift: { gold: 800, items: { elixir: 3 } }, from: n.ruler },
    }[tier];
    if (L) letter(w, p, { ...L, seal: n.color, crest: n.crest, kind: 'fame', nation, tier, from: L.from + ' · ' + n.crown });
  }
  function favorLetter(w, p, house, tier) {
    const h = nobleById[house], name = H.fullName(p);
    const L = {
      1: { title: 'Um bilhete perfumado', text: `${name}, a ${h.name} ouviu falar do seu trabalho. ${h.lord} gostaria de conhecer você algum dia.`, gift: { gold: 60 } },
      2: { title: 'Sob a proteção da casa', text: `${name}, a ${h.name} considera você um protegido. Nossos pedidos especiais serão confiados a você no mural da guilda.`, gift: { items: { tonic: 2, potion: 2 } } },
      3: { title: 'Aliado da casa', text: `${name}, ${h.lord} pede que aceite este presente e a amizade eterna da ${h.name}.`, gift: { gold: 300, items: { elixir: 1 } } },
    }[tier];
    if (L) letter(w, p, { ...L, seal: h.color, crest: h.crest, kind: 'favor', house, tier, from: h.lord + ' · ' + h.name });
  }
  function readLetter(w, p, id) {
    ensure(p); const l = p.letters.find(x => x.id === id); if (!l) throw new Error('Carta não encontrada.'); if (l.read) return;
    l.read = true; const gift = l.gift || {}; if (gift.gold) p.gold += gift.gold; for (const [k, n] of Object.entries(gift.items || {})) H.give(p, k, n);
    if (gift.gold || gift.items) H.system(w, p, `Presente recebido: ${[gift.gold ? gift.gold + ' moedas' : '', ...Object.entries(gift.items || {}).map(([k, n]) => n + '× ' + H.items[k].name)].filter(Boolean).join(', ')}.`, 'letter');
  }

  // Field checks: exploration and deliveries complete where they happen; hunts announce completion once.
  function tick(w, active) {
    for (const p of active) {
      const g = p.guildQuests; if (!g?.active?.length) continue;
      for (const q of g.active) {
        const t = byId[q.tid]; if (!t || q.ready) continue;
        if (t.type === 'visit') { const l = H.landmarks.find(l => l.id === t.target); if (l && Math.hypot(l.x + .5 - p.x, l.y + .5 - p.y) < 3.2) { q.ready = true; H.system(w, p, `Local encontrado: ${l.name}. Volte à guilda para receber o contrato 「${t.title}」.`, 'quest'); } }
        else if (t.type === 'deliver') { const k = H.kingdomAt(p.x, p.y), nation = clients[t.client].nation; if (k?.id === nation && (p.inventory[t.target] || 0) >= t.n) { H.consume(p, t.target, t.n); q.ready = true; H.system(w, p, `Entrega feita em ${nationById[nation].name}. Volte à guilda para receber 「${t.title}」.`, 'quest'); } }
        else if (!q.noted && complete(p, q)) { q.noted = true; H.system(w, p, `Contrato cumprido: 「${t.title}」. Entregue no balcão da guilda.`, 'quest'); }
      }
    }
  }
  const fameTier = (p, nation) => tierOf(fameTiers, p.renown?.[nation] || 0), favorTier = (p, house) => tierOf(favorTiers, p.favor?.[house] || 0);
  return { bind, letter, RANKS, nations, nobles, clients, nationById, nobleById, fameTiers, favorTiers, templates, byId, MAX_ACTIVE, ensure, board, progress, complete, accept, abandon, turnIn, addFame, addFavor, readLetter, tick, fameTier, favorTier, tierOf, atGuild, unlocked };
});
