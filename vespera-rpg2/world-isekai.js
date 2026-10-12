'use strict';
// Isekai layer: arrival in the other world (race + unique skill), status data, skill proficiency,
// titles, adventurer guild ranks F→S and monster taming with evolution. Deterministic and pure, so the
// browser, the Node server and the tests share it. World-core binds its helpers with bind().
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.WorldIsekai = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  let H = null;
  const bind = hooks => { H = hooks; };
  const byId = list => Object.fromEntries(list.map(x => [x.id, x]));

  const races = [
    { id: 'humano', name: 'Humano', icon: '☀', desc: 'Adaptável. Aprende 10% mais rápido e tem um pouco mais de vida.', bonus: { xp: .10, hp: 5 }, perks: ['+10% de experiência', '+5 de vida'] },
    { id: 'elfo', name: 'Elfo', icon: '❦', desc: 'Orelhas longas e sangue antigo. A mana responde ao seu chamado.', bonus: { mana: 35, spell: .12, hp: -10 }, perks: ['+35 de mana', '+12% de dano mágico', '−10 de vida'] },
    { id: 'fera', name: 'Povo-fera', icon: '♞', desc: 'Orelhas e cauda de lobo. Sentidos afiados e passos leves.', bonus: { speed: .35, crit: .05, def: -1 }, perks: ['+ velocidade', '+5% de crítico', '−1 de defesa'] },
    { id: 'anao', name: 'Anão', icon: '⛏', desc: 'Robusto, teimoso e nascido para a picareta.', bonus: { hp: 30, def: 3, speed: -.25, mining: 1 }, perks: ['+30 de vida', '+3 de defesa', '+1 minério por veio', '− velocidade'] },
    { id: 'demonio', name: 'Meio-demônio', icon: '♆', desc: 'Chifres e sangue quente. Mais força, menos defesa, e cada golpe devolve vida.', bonus: { atk: 4, def: -2, lifesteal: .05 }, perks: ['+4 de ataque', 'Rouba 5% do dano como vida', '−2 de defesa'] },
  ];
  const uniques = [
    { id: 'analise', name: 'Olhos da Análise', icon: '◎', desc: 'Veja nível, vida, ataque, comportamento e recompensa de qualquer criatura. Seus olhos também encontram brechas: +6% de crítico.', bonus: { crit: .06 } },
    { id: 'crescimento', name: 'Crescimento Acelerado', icon: '⇪', desc: '+50% de experiência e proficiências sobem duas vezes mais rápido.', bonus: { xp: .5 } },
    { id: 'domador', name: 'Pacto do Domador', icon: '♥', desc: 'Dome até três monstros (os demais, só um) com 90% de chance. Companheiros ganham experiência em dobro.', bonus: {} },
    { id: 'sorte', name: 'Sorte do Herói', icon: '✧', desc: '+50% de moedas de monstros, 25% de chance de recompensa em dobro e +8% de crítico.', bonus: { crit: .08 } },
    { id: 'mana', name: 'Fonte Infinita', icon: '❖', desc: 'A mana se recupera sozinha (+3 por segundo) e o limite sobe em 20.', bonus: { mana: 20 } },
  ];
  const profs = [
    { id: 'combate', name: 'Combate', icon: '⚔', desc: '+2% de dano de ataque por nível.' },
    { id: 'pontaria', name: 'Pontaria', icon: '➶', desc: '+2% de dano à distância por nível.' },
    { id: 'magia', name: 'Magia', icon: '✦', desc: '+3% de dano e cura mágicos por nível.' },
    { id: 'coleta', name: 'Coleta', icon: '❀', desc: '+5% de chance de colher um item extra por nível.' },
    { id: 'mineracao', name: 'Mineração', icon: '⛏', desc: '+5% de chance de minério extra por nível.' },
    { id: 'pesca', name: 'Pesca', icon: '≈', desc: '+5% de chance de peixe extra por nível.' },
    { id: 'criacao', name: 'Criação', icon: '⚒', desc: '+2 de experiência por item fabricado a cada nível.' },
    { id: 'doma', name: 'Doma', icon: '♞', desc: '+4% de chance de pacto e companheiros mais fortes por nível.' },
  ];
  const ranks = [['F', 0], ['E', 40], ['D', 100], ['C', 200], ['B', 350], ['A', 550], ['S', 800]];
  const titles = [
    { id: 'outro-mundo', name: 'Visitante de Outro Mundo', desc: 'Chegou a Véspera pelas mãos da Deusa.', bonus: { xp: .02 }, test: (p, s) => s.chosen },
    { id: 'primeiro-sangue', name: 'Primeiro Sangue', desc: 'Derrotou a primeira criatura.', bonus: { atk: 1 }, test: p => p.kills >= 1 },
    { id: 'terror-limos', name: 'Terror dos Limos', desc: 'Derrotou 25 limos.', bonus: { atk: 2 }, test: (p, s) => (s.slain.slime || 0) >= 25 },
    { id: 'cacador', name: 'Caçador do Vale', desc: 'Derrotou 150 criaturas.', bonus: { crit: .02 }, test: p => p.kills >= 150 },
    { id: 'maos-abencoadas', name: 'Mãos Abençoadas', desc: 'Coletou 200 vezes.', bonus: { hp: 10 }, test: p => (p.gathered || 0) >= 200 },
    { id: 'artesao', name: 'Artesão Lendário', desc: 'Fabricou 30 itens.', bonus: { def: 1 }, test: p => (p.crafted || 0) >= 30 },
    { id: 'amigo-monstros', name: 'Amigo dos Monstros', desc: 'Firmou o primeiro pacto com um monstro.', bonus: { hp: 10 }, test: (p, s) => s.companions.length >= 1 || s.tamed >= 1 },
    { id: 'senhor-feras', name: 'Senhor das Feras', desc: 'Um companheiro chegou à forma Soberana.', bonus: { atk: 2 }, test: (p, s) => s.companions.some(c => c.stage >= 2) },
    { id: 'elite', name: 'Aventureiro de Elite', desc: 'Alcançou o rank A da guilda.', bonus: { xp: .03 }, test: (p, s) => rankIndex(s.rank) >= 5 },
    { id: 'rank-s', name: 'Herói Rank S', desc: 'Alcançou o rank S da guilda.', bonus: { atk: 3, def: 2 }, test: (p, s) => s.rank === 'S' },
    { id: 'matador-chefes', name: 'Matador de Chefes', desc: 'Derrotou três chefes.', bonus: { atk: 3 }, test: p => (p.bossesSlain || 0) >= 3 },
    { id: 'intocavel', name: 'Intocável', desc: 'Chegou ao nível 10 sem cair nenhuma vez.', bonus: { def: 2 }, test: p => p.level >= 10 && !(p.deaths > 0) },
    { id: 'lendario', name: 'Herói Lendário', desc: 'Alcançou o nível 20.', bonus: { hp: 30, mana: 20 }, test: p => p.level >= 20 },
    { id: 'cartografo', name: 'Cartógrafo de Mundos', desc: 'Explorou 150 áreas do mapa.', bonus: { speed: .15 }, test: p => Object.keys(p.discovered || {}).length >= 150 },
    { id: 'cavaleiro-auroria', name: 'Cavaleiro de Aurória', desc: 'Favorito da corte de Aurória.', bonus: { def: 2, hp: 15 }, test: p => (p.renown?.auroria || 0) >= 180 },
    { id: 'cavaleiro-lunaria', name: 'Cavaleiro de Lunária', desc: 'Favorito da corte de Lunária.', bonus: { mana: 25, crit: .02 }, test: p => (p.renown?.lunaria || 0) >= 180 },
    { id: 'cavaleiro-brasalar', name: 'Cavaleiro de Brasalar', desc: 'Favorito da corte de Brasalar.', bonus: { atk: 3 }, test: p => (p.renown?.brasalar || 0) >= 180 },
    { id: 'campeao', name: 'Campeão do Reino', desc: 'Declarado campeão por um rei.', bonus: { atk: 3, def: 3, hp: 20 }, test: p => Object.values(p.renown || {}).some(v => v >= 320) },
    { id: 'protegido', name: 'Protegido da Nobreza', desc: 'Uma casa nobre o tem como protegido.', bonus: { xp: .03 }, test: p => Object.values(p.favor || {}).some(v => v >= 60) },
    { id: 'veterano', name: 'Veterano da Guilda', desc: 'Concluiu 25 contratos.', bonus: { hp: 15, xp: .02 }, test: p => (p.guildQuests?.completed || 0) >= 25 },
    { id: 'mestre', name: 'Mestre Supremo', desc: 'Levou uma proficiência ao nível 10.', bonus: { xp: .05 }, test: (p, s) => profs.some(x => profLevel(s.profs[x.id] || 0).level >= 10) },
  ];
  const raceById = byId(races), uniqueById = byId(uniques), profById = byId(profs), titleById = byId(titles);
  const stageNames = ['', 'Desperto', 'Soberano'];

  function ensure(p) {
    if (!p.isekai) p.isekai = { chosen: false, race: 'humano', unique: null, profs: {}, titles: [], title: null, companions: [], rank: 'F', slain: {}, tamed: 0, serial: 0 };
    const s = p.isekai; s.profs ||= {}; s.titles ||= []; s.companions ||= []; s.slain ||= {}; s.rank ||= 'F'; s.tamed ||= 0; s.serial ||= 0; return s;
  }
  const rankIndex = r => Math.max(0, ranks.findIndex(x => x[0] === r));
  const rankOf = rep => { let r = 'F'; for (const [k, need] of ranks) if (rep >= need) r = k; return r; };
  const nextRank = rep => ranks.find(([, need]) => rep < need) || null;
  const profNeed = l => Math.round(18 * Math.pow(l, 1.4));
  function profLevel(xp) { let level = 1, need = profNeed(1); while (level < 10 && xp >= need) { xp -= need; level++; need = profNeed(level); } return { level, into: xp, need: level >= 10 ? 0 : need }; }
  const lvl = (p, id) => profLevel(p.isekai?.profs?.[id] || 0).level;
  // Deterministic "chance" from state, so server, host and tests agree without an rng argument.
  const roll = (...k) => { const n = Math.sin(k.reduce((a, v, i) => a + (typeof v === 'number' ? v : String(v).length * 7.1) * (i + 1) * 12.9898, 0)) * 43758.5453; return n - Math.floor(n); };

  // Nothing counts before the Goddess's choice: old saves and fresh characters keep their exact numbers.
  function bonuses(p) { const s = p.isekai; if (!s?.chosen) return []; return [raceById[s.race]?.bonus, uniqueById[s.unique]?.bonus, titleById[s.title]?.bonus].filter(Boolean); }
  function applyStats(p, st) {
    for (const b of bonuses(p)) { for (const k of ['hp', 'mana', 'atk', 'def']) if (b[k]) st[k] += b[k]; if (b.crit) st.crit = Math.min(.75, st.crit + b.crit); if (b.speed) st.speed += b.speed; }
    return st;
  }
  const xpMult = p => 1 + bonuses(p).reduce((a, b) => a + (b.xp || 0), 0) + (p.isekai?.chosen ? rankIndex(p.isekai.rank || 'F') * .03 : 0);
  const spellMult = p => 1 + (p.isekai?.chosen ? raceById[p.isekai.race]?.bonus.spell || 0 : 0) + (lvl(p, 'magia') - 1) * .03;
  const attackMult = (p, ranged) => 1 + (lvl(p, ranged ? 'pontaria' : 'combate') - 1) * .02;

  function system(w, p, text, kind = 'info') { H.event(w, 'system', p.x, p.y, text, kind, p.id); }
  function train(w, p, id, amount = 1) {
    const s = ensure(p); if (!profById[id]) return;
    const before = profLevel(s.profs[id] || 0).level; s.profs[id] = (s.profs[id] || 0) + amount * (s.unique === 'crescimento' ? 2 : 1);
    const after = profLevel(s.profs[id]).level; if (after > before) system(w, p, `Proficiência ${profById[id].name} subiu para o nível ${after}.`, 'skill');
  }
  function check(w, p) {
    const s = ensure(p);
    const r = rankOf(p.guild?.reputation || 0);
    if (r !== s.rank) { const up = rankIndex(r) > rankIndex(s.rank); s.rank = r; if (up) { H.event(w, 'rankup', p.x, p.y, r, '#9fe8ff', p.id); system(w, p, `Rank de aventureiro promovido: ${r}. Bônus de experiência da guilda +${rankIndex(r) * 3}%.`, 'rank'); } }
    for (const t of titles) if (!s.titles.includes(t.id) && t.test(p, s)) { s.titles.push(t.id); if (!s.title) s.title = t.id; system(w, p, `Título obtido: 「${t.name}」. ${t.desc}`, 'title'); }
  }

  function choose(w, p, race, unique) {
    const s = ensure(p);
    if (s.chosen) throw new Error('A Deusa já concedeu sua bênção nesta vida.');
    if (!raceById[race]) throw new Error('Raça inválida.'); if (!uniqueById[unique]) throw new Error('Habilidade inválida.');
    s.chosen = true; s.race = race; s.unique = unique;
    const st = H.stats(p); p.hp = st.hp; p.mana = st.mana;
    H.event(w, 'rebirth', p.x, p.y, '', '#fff2c0');
    system(w, p, `Raça definida: ${raceById[race].name}.`, 'race');
    system(w, p, `Habilidade Única adquirida: 「${uniqueById[unique].name}」.`, 'unique');
    check(w, p);
  }
  function equipTitle(p, id) { const s = ensure(p); if (id !== null && !s.titles.includes(id)) throw new Error('Título ainda não conquistado.'); s.title = id; }

  // ---------- Hooks called by world-core ----------
  function onHit(w, p, m, damage) {
    const ls = raceById[p.isekai?.race]?.bonus.lifesteal; if (ls && p.isekai.chosen && damage > 0) { const s = H.stats(p); p.hp = Math.min(s.hp, p.hp + Math.max(1, Math.round(damage * ls))); }
  }
  function onKill(w, p, m, gold) {
    const s = ensure(p); s.slain[m.kind] = (s.slain[m.kind] || 0) + 1;
    if (s.chosen && s.unique === 'sorte') {
      p.gold += Math.ceil(gold * .5);
      if (roll(w.eventId, m.x, m.y, p.kills) < .25) { const drop = H.monsterTypes[m.kind].drop; H.give(p, drop, H.isBoss(m) ? 8 : 2); H.event(w, 'loot', m.x, m.y - .4, 'SORTE! +' + H.items[drop].name, '#ffe28a', p.id); }
    }
    for (const c of s.companions) companionXp(w, p, c, 3 + m.tier * 2);
    check(w, p);
  }
  function onGather(w, p, kind, id, tile) {
    const s = ensure(p), prof = kind === 'rock' ? 'mineracao' : kind === 'water' ? 'pesca' : 'coleta';
    train(w, p, prof, 1);
    let extra = 0; if (roll(w.eventId, p.gathered, tile?.ore || 0, prof) < (lvl(p, prof) - 1) * .05) extra++;
    if (kind === 'rock' && s.chosen && raceById[s.race]?.bonus.mining) extra += raceById[s.race].bonus.mining;
    if (extra) { H.give(p, id, extra); H.event(w, 'loot', p.x, p.y - .6, `+${extra} ${H.items[id].name} (proficiência)`, '#bfe8ff', p.id); }
  }

  // ---------- Taming ----------
  const companionCap = p => p.isekai?.chosen && p.isekai.unique === 'domador' ? 3 : 1;
  function tameable(w, p) {
    const s = p.isekai; if (!s?.chosen || (s.companions || []).length >= companionCap(p)) return null;
    let best = null, bd = 2.6;
    for (const m of Object.values(w.monsters)) {
      const spec = H.monsterTypes[m.kind]; if (m.hp <= 0 || !spec || spec.inert || spec.human || H.isBoss(m) || m.raid || m.citadel || m.minion || m.kind === 'totem') continue;
      if (H.dungeonAt(m.x, m.y) !== H.dungeonAt(p.x, p.y)) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd && m.hp <= m.maxHp * .35) { best = m; bd = d; }
    }
    return best;
  }
  function tame(w, p) {
    const s = ensure(p), m = tameable(w, p);
    if (!s.chosen) throw new Error('Receba a bênção da Deusa antes de firmar pactos.');
    if (s.companions.length >= companionCap(p)) throw new Error(`Você já tem ${s.companions.length} companheiro(s). ${s.unique === 'domador' ? '' : 'O Pacto do Domador permite até três.'}`);
    if (!m) throw new Error('Enfraqueça um monstro comum até 35% da vida e fique ao lado dele.');
    train(w, p, 'doma', 3);
    const chance = Math.min(.95, (s.unique === 'domador' ? .9 : .55) + (lvl(p, 'doma') - 1) * .04);
    if (roll(w.eventId, m.hp, m.x, s.tamed, p.kills) > chance) { m.hp = Math.min(m.maxHp, m.hp + Math.ceil(m.maxHp * .1)); H.event(w, 'hit', m.x, m.y, 'RESISTIU!', '#ffb0a0'); system(w, p, `${H.monsterTypes[m.kind].name} resistiu ao pacto. Tente de novo.`, 'fail'); return false; }
    const c = { id: 'c' + (++s.serial), kind: m.kind, name: H.monsterTypes[m.kind].name, level: 1, xp: 0, stage: 0, named: false, x: m.x, y: m.y, dir: 0, cd: 0, tier: m.tier || 0 };
    s.companions.push(c); s.tamed++;
    m.hp = 0; m.respawn = w.time + 70; m.enraged = false;
    H.event(w, 'tame', c.x, c.y, c.name, '#ff9ecb');
    system(w, p, `Pacto firmado! ${c.name} agora é seu companheiro. Abra o Status (U) para dar um nome e fazê-lo evoluir.`, 'tame');
    check(w, p); return true;
  }
  const stageName = c => (c.named ? c.name + ' · ' : '') + H.monsterTypes[c.kind].name + (c.stage ? ' ' + stageNames[c.stage] : '');
  function evolve(w, p, c, reason) {
    if (c.stage >= 2) return; c.stage++;
    H.event(w, 'evolve', c.x, c.y, c.name, '#b8f0ff');
    system(w, p, `${reason}! ${c.name} evoluiu para a forma ${stageNames[c.stage]}.`, 'evolve'); check(w, p);
  }
  function nameCompanion(w, p, index, name) {
    const s = ensure(p), c = s.companions[Number(index)]; if (!c) throw new Error('Companheiro não encontrado.');
    name = String(name || '').replace(/[\u0000-\u001f<>"'`]/g, '').trim().slice(0, 16); if (!name) throw new Error('Escolha um nome.');
    c.name = name; if (!c.named) { c.named = true; evolve(w, p, c, 'A nomeação desperta um poder oculto'); } else system(w, p, `Seu companheiro agora se chama ${name}.`, 'info');
  }
  function release(w, p, index) { const s = ensure(p), c = s.companions[Number(index)]; if (!c) throw new Error('Companheiro não encontrado.'); s.companions.splice(Number(index), 1); system(w, p, `${c.name} voltou para a natureza.`, 'info'); }
  function companionXp(w, p, c, n) {
    c.xp += n * (p.isekai.unique === 'domador' ? 2 : 1);
    while (c.level < 30 && c.xp >= 10 + c.level * 8) { c.xp -= 10 + c.level * 8; c.level++; if (c.level === 6 || c.level === 14) evolve(w, p, c, 'O companheiro ficou mais forte'); }
  }
  const companionDamage = (p, c) => Math.round(5 + c.level * 2 + c.stage * 7 + c.tier + (lvl(p, 'doma') - 1));

  function tick(w, dt, active) {
    for (const p of active) {
      const s = p.isekai; if (!s?.chosen) continue;
      if (s.unique === 'mana') { const st = H.stats(p); p.mana = Math.min(st.mana, p.mana + 3 * dt); }
      if ((s.nextCheck || 0) <= w.time) { s.nextCheck = w.time + 2; check(w, p); }
      const here = H.dungeonAt(p.x, p.y);
      s.companions.forEach((c, i) => {
        let target = null, td = 5.5;
        for (const m of Object.values(w.monsters)) { if (m.hp <= 0 || H.monsterTypes[m.kind]?.inert || H.dungeonAt(m.x, m.y) !== here) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < td) { td = d; target = m; } }
        const slot = [[-1.1, .7], [1.1, .7], [0, 1.4]][i] || [0, 1.2], gx = target ? target.x : p.x + slot[0], gy = target ? target.y : p.y + slot[1];
        if (Math.hypot(c.x - p.x, c.y - p.y) > 10 || H.dungeonAt(c.x, c.y) !== here) { c.x = p.x + slot[0]; c.y = p.y + slot[1]; }
        const dx = gx - c.x, dy = gy - c.y, dist = Math.hypot(dx, dy), stop = target ? 1.2 : .15;
        if (dist > stop) { const step = Math.min(dist - stop, (target ? 3.6 : 4.4) * dt); c.x += dx / dist * step; c.y += dy / dist * step; if (Math.abs(dx) > .05 || Math.abs(dy) > .05) c.dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 2 : 1 : dy > 0 ? 0 : 3; }
        if (target && dist <= 1.6 && w.time >= (c.cd || 0)) {
          c.cd = w.time + 1.3; const dmg = companionDamage(p, c); c.attackAt = w.time;
          H.event(w, 'slash', c.x, c.y, c.dir, '#bfe8ff'); H.hitMonster(w, p, target, dmg); companionXp(w, p, c, 1);
        }
      });
    }
  }

  return { bind, races, uniques, profs, titles, ranks, raceById, uniqueById, profById, titleById, stageNames, ensure, profLevel, rankOf, nextRank, rankIndex, applyStats, xpMult, spellMult, attackMult, system, train, check, choose, equipTitle, onHit, onKill, onGather, tameable, tame, nameCompanion, release, companionCap, companionDamage, stageName, tick };
});
