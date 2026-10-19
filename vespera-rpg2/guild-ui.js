'use strict';
// Guild window: receptionist scene on the left, wooden panel on the right with a detail card on top and a
// grid of pinned contracts below; a contract or letter opens as a parchment scroll that unrolls. Tabs for
// the board, active contracts, fame with crowns and noble houses, and sealed letters. Uses the game's modal,
// so touch, mouse, keyboard and gamepad all work; actions go through GameSession.command.
window.GuildUI = (() => {
  const V = window.Vespera, Gd = V.guild, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = () => window.GameSession;
  const TYPE = { hunt: ['Caça', '⚔'], bring: ['Coleta', '❀'], craft: ['Fabricação', '⚒'], visit: ['Exploração', '⌖'], deliver: ['Entrega', '➶'], raid: ['Raide', '♛'] };
  let tab = 'board', selected = null, scroll = null, raf = 0, speechText = '', speechShown = 0, isOpen = false;
  const jag = (() => { const pts = []; for (let i = 0; i <= 24; i++) pts.push(`${(i % 2 ? 1.6 : 0) + Math.sin(i * 7.3) * .8}% ${i / 24 * 100}%`); const right = []; for (let i = 24; i >= 0; i--) right.push(`${98.4 - (i % 2 ? 1.6 : 0) + Math.sin(i * 3.1) * .8}% ${i / 24 * 100}%`); return `polygon(${[...pts, ...right].join(',')})`; })();

  const player = () => { const p = G()?.player; if (p) Gd.ensure(p); return p; };
  const itemName = id => V.items[id]?.name || id;
  function objective(t) {
    if (t.type === 'hunt') return `Derrotar ${t.n} × ${V.monsterTypes[t.target]?.name || t.target}`;
    if (t.type === 'bring') return `Entregar ${t.n} × ${itemName(t.target)} no balcão`;
    if (t.type === 'craft') return `Fabricar e entregar ${t.n} × ${itemName(t.target)}`;
    if (t.type === 'visit') return `Visitar ${V.landmarks.find(l => l.id === t.target)?.name || t.target}`;
    if (t.type === 'deliver') return `Levar ${t.n} × ${itemName(t.target)} até ${Gd.nationById[Gd.clients[t.client].nation]?.name}`;
    return 'Concluir uma raide';
  }
  function rewards(t) { const c = Gd.clients[t.client]; return `<span class="gu-coin">● ${t.reward.gold}</span><span>✦ ${t.reward.xp} EXP</span><span>⚑ ${t.reward.rep} rep.</span>${c.nation ? `<span style="color:${Gd.nationById[c.nation].color}">${Gd.nationById[c.nation].crest} +${c.noble ? Math.ceil(t.reward.fame / 2) : t.reward.fame} fama</span>` : ''}${c.noble ? `<span style="color:${Gd.nobleById[c.noble].color}">♥ +${t.reward.fame} favor</span>` : ''}`; }
  function state(p, t) { const g = p.guildQuests, q = g.active.find(x => x.instance === t.instance); if (g.done[t.instance]) return 'done'; if (q) return Gd.complete(p, q) ? 'ready' : 'accepted'; if (t.locked) return 'locked'; return 'open'; }

  function speech(p, board) {
    const r = p.isekai?.rank || 'F', ready = p.guildQuests.active.filter(q => Gd.complete(p, q)).length, unread = p.letters.filter(l => !l.read).length;
    if (!p.guild) return 'Bem-vindo à Guilda dos Caminhantes! Assine o registro aqui no balcão e pegue seu primeiro contrato rank F.';
    if (ready) return `Oh! Você terminou ${ready > 1 ? ready + ' contratos' : 'um contrato'}. Entregue aqui que eu carimbo na hora!`;
    if (unread) return `Chegou ${unread > 1 ? unread + ' cartas' : 'uma carta'} para você, com selo e tudo! Veja na aba Cartas.`;
    if (board.some(t => t.royal)) return 'Tem pedido com selo real no mural hoje... Isso não aparece para qualquer um, sabia?';
    const tips = [`Rank ${r}? Nada mal! Contratos acima do seu rank pagam melhor, mas espere ser promovido.`, 'Contratos das casas nobres chamam a atenção das coroas. É assim que começam as cartas com selo.', 'O mural muda todo dia. Volte amanhã e encontre novos pedidos.', 'Você pode ter três contratos ao mesmo tempo. Escolha bem!', 'Entregas em outros reinos são concluídas lá mesmo. Depois é só voltar aqui para receber.'];
    return tips[Math.floor(Date.now() / 9000) % tips.length];
  }

  function open(opts = {}) { if (opts.tab) tab = opts.tab; scroll = null; isOpen = true; render(); loop(); }
  function render() {
    const g = G(), p = player(); if (!g || !p) return;
    const board = Gd.board(g.world, p), here = Gd.atGuild(p), active = p.guildQuests.active, unread = p.letters.filter(l => !l.read).length;
    if (!selected || !board.some(t => t.instance === selected)) selected = board.find(t => !t.locked)?.instance || board[0]?.instance;
    const tabs = [['board', '✎', 'Mural'], ['active', '✔', 'Meus contratos', active.length], ['nobles', '♛', 'Nobres e Reinos'], ['letters', '✉', 'Cartas', unread], ['counter', '⚖', 'Balcão']].map(([k, i, n, c]) => `<button class="gu-tab ${tab === k ? 'on' : ''}" data-gu-tab="${k}" aria-label="${n}"><span>${i}</span><small>${n}</small>${c ? `<em>${c}</em>` : ''}</button>`).join('');
    const titles = { board: 'MURAL DE MISSÕES', active: 'MEUS CONTRATOS', nobles: 'NOBRES E REINOS', letters: 'CARTAS SELADAS', counter: 'BALCÃO DE COMPRAS' };
    let body = '';
    if (tab === 'board') body = boardView(p, board, here);
    if (tab === 'active') body = activeView(p, here);
    if (tab === 'nobles') body = noblesView(p);
    if (tab === 'counter') body = counterView(p, here);
    if (tab === 'letters') body = lettersView(p);
    speechText = speech(p, board); speechShown = 0;
    g.modal('guild', 'Guilda dos Caminhantes', `<div class="guild-ui"><section class="gu-scene"><canvas id="guild-scene" width="400" height="320" aria-label="Mirela, a recepcionista da guilda, atrás do balcão"></canvas><div class="gu-nameplate">Mirela · recepcionista</div><p class="gu-speech" id="gu-speech" aria-live="polite"></p></section>
      <section class="gu-panel"><nav class="gu-tabs">${tabs}</nav><header class="gu-head"><b>${titles[tab]}</b><span class="gu-rank"><canvas class="gu-badge" data-rank="${esc(p.isekai?.rank || 'F')}" width="44" height="44" aria-hidden="true"></canvas>RANK ${esc(p.isekai?.rank || 'F')}</span><span class="gu-coins">● ${p.gold}</span></header>
      ${!here && (tab === 'board' || tab === 'active') ? '<p class="gu-away">Você está longe do balcão: dá para consultar, mas aceitar e entregar só na guilda.</p>' : ''}<div class="gu-body">${body}</div><div id="gu-scroll-host"></div></section></div>`);
    $('modal').classList.add('guild-modal');
    wire(p, board);badges();
    if (scroll) openScroll(scroll, false);
  }

  function boardView(p, board, here) {
    if (!p.guild) return `<div class="gu-join"><p>Registro de aventureiros: assine e receba seu cartão rank F.</p><button class="gu-btn gold" data-gu-join ${here ? '' : 'disabled'}>✍ Assinar o registro da guilda</button></div>`;
    const t = board.find(x => x.instance === selected) || board[0], st = t ? state(p, t) : 'open', c = t ? Gd.clients[t.client] : null;
    const card = t ? `<article class="gu-card ${t.royal ? 'royal' : ''}"><div class="gu-card-icon" style="--seal:${c.seal}"><span>${TYPE[t.type][1]}</span><i>${c.crest}</i></div>
      <div class="gu-card-info"><h3>${esc(t.title)}</h3><p class="gu-client">${esc(c.name)}${t.royal ? ' · <b>selo real</b>' : t.special ? ' · <b>pedido especial</b>' : ''}</p><p>${esc(objective(t))}</p>
      <div class="gu-badges"><span class="rk"><canvas class="gu-badge small" data-rank="${t.rank}" width="28" height="28" aria-hidden="true"></canvas>${t.rank}</span><span>${TYPE[t.type][0]}</span></div><div class="gu-rew">${rewards(t)}</div>
      <div class="gu-card-actions"><button class="gu-btn" data-gu-read="${t.instance}">❧ Ler o pergaminho</button>${actionButton(p, t, st, here)}</div></div></article>` : '';
    const notes = board.map((b, i) => { const s = state(p, b), cc = Gd.clients[b.client]; return `<button class="gnote ${s} ${b.royal ? 'royal' : ''} ${b.instance === selected ? 'sel' : ''}" data-gu-note="${b.instance}" style="--rot:${(Math.sin(i * 12.3) * 3.5).toFixed(1)}deg;--seal:${cc.seal}" aria-label="${esc(b.title)}, rank ${b.rank}"><i class="pin"></i><span class="gn-rank">${b.rank}</span><span class="gn-icon">${TYPE[b.type][1]}</span><span class="gn-title">${esc(b.title)}</span><span class="gn-client">${cc.crest}</span>${s === 'accepted' || s === 'ready' ? '<b class="gn-stamp">ACEITO</b>' : s === 'done' ? '<b class="gn-stamp done">FEITO</b>' : s === 'locked' ? '<b class="gn-lock">⊘</b>' : ''}</button>`; }).join('');
    return card + `<div class="gu-grid">${notes}</div><p class="gu-foot">Contratos ativos: ${p.guildQuests.active.length}/${Gd.MAX_ACTIVE} · o mural muda a cada dia do vale (dia ${G().world.day || 1}).</p>`;
  }
  function actionButton(p, t, st, here) {
    if (st === 'done') return '<button class="gu-btn" disabled>✔ Concluído hoje</button>';
    if (st === 'ready') return `<button class="gu-btn gold" data-gu-turnin="${t.instance}" ${here ? '' : 'disabled'}>★ Entregar contrato</button>`;
    if (st === 'accepted') return '<button class="gu-btn" disabled>✔ Aceito</button>';
    if (st === 'locked') return `<button class="gu-btn" disabled>⊘ Rank ${t.rank}</button>`;
    return `<button class="gu-btn gold" data-gu-accept="${t.instance}" ${here && p.guildQuests.active.length < Gd.MAX_ACTIVE ? '' : 'disabled'}>✍ Aceitar contrato</button>`;
  }
  function activeView(p, here) {
    const list = p.guildQuests.active; if (!list.length) return '<div class="gu-empty">Nenhum contrato ativo. Escolha um no mural!</div>';
    return `<div class="gu-active">${list.map(q => { const t = Gd.byId[q.tid], c = Gd.clients[t.client], prog = Gd.progress(p, q), done = Gd.complete(p, q), n = t.type === 'visit' ? 1 : t.n; return `<div class="gu-strip ${done ? 'ready' : ''}" style="--seal:${c.seal}"><div class="gu-strip-head"><b>${esc(t.title)}</b><span class="rk"><canvas class="gu-badge small" data-rank="${t.rank}" width="28" height="28" aria-hidden="true"></canvas>${t.rank}</span></div><small>${esc(c.name)} · ${esc(objective(t))}</small>
      <div class="gu-prog"><i style="width:${Math.min(100, prog / n * 100)}%"></i><em>${t.type === 'visit' || t.type === 'deliver' ? (done ? 'Cumprido' : 'A caminho') : prog + ' / ' + n}</em></div>
      <div class="gu-card-actions">${done ? `<button class="gu-btn gold" data-gu-turnin="${q.instance}" ${here ? '' : 'disabled'}>★ Entregar</button>` : ''}<button class="gu-btn" data-gu-read="${q.instance}">❧ Pergaminho</button><button class="gu-btn ghost" data-gu-abandon="${q.instance}">Desistir</button></div></div>`; }).join('')}</div>`;
  }
  function noblesView(p) {
    const fame = Object.values(p.renown).reduce((a, b) => a + b, 0);
    const mood = fame < 20 ? 'Seu nome ainda não saiu da vila.' : fame < 100 ? 'Mercadores comentam seu nome nas estradas.' : fame < 250 ? 'Nobres perguntam por você nos salões.' : fame < 500 ? 'Os reis já sabem quem você é.' : 'Três coroas disputam sua lealdade.';
    const nations = Gd.nations.map(n => { const v = p.renown[n.id], ti = Gd.fameTier(p, n.id), next = Gd.fameTiers[ti + 1], max = Gd.fameTiers.at(-1)[0];
      return `<div class="gu-nation" style="--nc:${n.color}"><div class="gu-crest">${n.crest}</div><div><b>${esc(n.crown)}</b><small>${esc(n.ruler)}</small><div class="gu-fame"><i style="width:${Math.min(100, v / max * 100)}%"></i>${Gd.fameTiers.slice(1).map(([need]) => `<u style="left:${need / max * 100}%"></u>`).join('')}</div>
        <em>${Gd.fameTiers[ti][1]} · ${v} de fama</em><small class="gu-next">${next ? `Próximo: <b>${next[1]}</b> com ${next[0]} (${['', 'carta da corte', 'pedidos reais no mural', 'título de Cavaleiro', 'Campeão do Reino'][ti + 1]})` : 'A coroa inteira canta seu nome.'}</small></div></div>`; }).join('');
    const houses = Gd.nobles.map(h => { const v = p.favor[h.id], ti = Gd.favorTier(p, h.id), max = Gd.favorTiers.at(-1)[0];
      return `<div class="gu-house" style="--nc:${h.color}"><span class="gu-crest sm">${h.crest}</span><div><b>${esc(h.name)}</b><small>${esc(h.lord)} · ${Gd.nationById[h.nation].name}</small></div><div class="gu-fame sm"><i style="width:${Math.min(100, v / max * 100)}%"></i></div><em>${Gd.favorTiers[ti][1]}</em></div>`; }).join('');
    return `<p class="gu-mood">“${mood}”</p><div class="gu-nations">${nations}</div><h4 class="gu-sub">Casas nobres</h4><div class="gu-houses">${houses}</div><p class="gu-foot">Contratos dos reinos e das casas aumentam fama e favor. Cada degrau traz uma carta selada com presente.</p>`;
  }
  function lettersView(p) {
    if (!p.letters.length) return '<div class="gu-empty">Nenhuma carta ainda. Quando as coroas e as casas nobres notarem você, elas escrevem.</div>';
    return `<div class="gu-letters">${p.letters.map(l => `<button class="gu-letter ${l.read ? '' : 'new'}" data-gu-letter="${l.id}" style="--seal:${l.seal}"><span class="wax">${l.crest || '✉'}</span><span><b>${esc(l.title)}</b><small>${esc(l.from)} · dia ${l.day}</small></span>${l.read ? '' : '<em>nova</em>'}</button>`).join('')}</div>`;
  }

  // ---------- Parchment scroll (contracts and letters) ----------
  function openScroll(id, animate = true) {
    const p = player(), host = $('gu-scroll-host'); if (!p || !host) return; scroll = id;
    const letter = p.letters.find(l => l.id === id); let inner = '';
    if (letter) {
      const gift = letter.gift || {}, giftText = [gift.gold ? gift.gold + ' moedas' : '', ...Object.entries(gift.items || {}).map(([k, n]) => n + '× ' + itemName(k))].filter(Boolean).join(', ');
      inner = `<div class="sc-seal ${letter.read ? 'broken' : ''}" style="--seal:${letter.seal}">${letter.crest || '✉'}</div><p class="sc-kicker">${esc(letter.from)}</p><h2>${esc(letter.title)}</h2><p class="sc-text">${esc(letter.text)}</p>${giftText ? `<p class="sc-gift">Anexo: ${esc(giftText)}${letter.read ? ' · recebido' : ''}</p>` : ''}<p class="sc-sign">— com o selo de ${esc(letter.from.split(' · ')[1] || letter.from)}</p>`;
      if (!letter.read) setTimeout(() => act('letterRead', { id: letter.id }), 700);
    } else {
      const board = Gd.board(G().world, p), q = p.guildQuests.active.find(x => x.instance === id), t = board.find(x => x.instance === id) || (q && { ...Gd.byId[q.tid], instance: id }); if (!t) return;
      const c = Gd.clients[t.client], st = q ? (Gd.complete(p, q) ? 'ready' : 'accepted') : state(p, t), prog = q ? Gd.progress(p, q) : 0;
      inner = `<div class="sc-seal" style="--seal:${c.seal}">${c.crest}</div><p class="sc-kicker">Contrato da guilda · Rank ${t.rank} · ${TYPE[t.type][0]}${t.royal ? ' · Selo Real' : ''}</p><h2>${esc(t.title)}</h2><p class="sc-client">Solicitante: <b>${esc(c.name)}</b></p><p class="sc-text">${esc(t.text)}</p>
        <p class="sc-obj"><b>Objetivo:</b> ${esc(objective(t))}${q ? ` · <b>progresso:</b> ${t.type === 'visit' || t.type === 'deliver' ? (st === 'ready' ? 'cumprido' : 'a caminho') : prog + '/' + t.n}` : ''}</p><p class="sc-rew"><b>Recompensa:</b> ${rewards(t)}</p>
        <p class="sc-sign">Registrado por <i>Mirela</i>, Guilda dos Caminhantes</p>${st === 'accepted' || st === 'ready' ? '<b class="sc-stamp">ACEITO</b>' : st === 'done' ? '<b class="sc-stamp done">CONCLUÍDO</b>' : ''}
        <div class="sc-actions"><button class="gu-btn ghost" data-gu-close-scroll>◂ Voltar ao mural</button>${actionButton(p, t, st, Gd.atGuild(p))}</div>`;
    }
    host.innerHTML = `<div class="scroll-wrap ${animate ? 'anim' : ''}" role="dialog" aria-label="Pergaminho"><div class="scroll-rod"></div><div class="scroll-body"><div class="scroll-paper" style="clip-path:${jag}"><div class="scroll-inner">${inner}</div></div></div><div class="scroll-rod bottom"></div>${letter ? '<div class="sc-actions letter"><button class="gu-btn ghost" data-gu-close-scroll>◂ Fechar carta</button></div>' : ''}</div>`;
    wireButtons(host); host.querySelector('button')?.focus({ preventScroll: true });
  }
  function stamp(text, done) { const w = document.querySelector('.scroll-inner') || document.querySelector('.gu-card'); if (!w) return; const s = document.createElement('b'); s.className = 'sc-stamp fresh' + (done ? ' done' : ''); s.textContent = text; w.append(s); }

  // Buying counter: monster parts at today's price, the hunting ledger and the other adventurers.
  function counterView(p, here) {
    const V = window.Vespera, T = V.trade, w = G().world; if (!T) return '';
    const parts = Object.entries(p.inventory || {}).filter(([id, n]) => n > 0 && T.itemById[id]).sort((a, b) => T.price(w, p, b[0]) * b[1] - T.price(w, p, a[0]) * a[1]);
    const rows = parts.length ? parts.map(([id, n]) => { const pr = T.price(w, p, id), base = T.itemById[id].value, trend = pr < base * .9 ? '<i class="down">▼ muita oferta hoje</i>' : pr > base * 1.05 ? '<i class="up">▲ procurado</i>' : ''; return `<div class="gu-sale"><b>${esc(V.items[id].name)}</b><span>× ${n}</span><span class="gu-price">${pr} moedas cada ${trend}</span><button class="gu-btn" data-gu-sell="${id}" ${here ? '' : 'disabled'}>Vender 1</button><button class="gu-btn gold" data-gu-sell-all="${id}" ${here ? '' : 'disabled'}>Vender ${n} · ~${pr * n - Math.round(pr * .025 * n * (n - 1))}</button></div>`; }).join('') : '<p class="gu-away">Nada para vender. Monstros deixam presas, peles, cristais e outras partes; traga aqui.</p>';
    const L = p.ledger || { notable: 0, kinds: {} }, next = T.MILESTONES.find(([need]) => need > L.notable);
    const ledger = `<div class="gu-ledger"><h4>Livro de caça</h4><p>${L.notable} abate(s) de criaturas com mais de 100 de vida${T.titleOf(p) ? ` · <b>«${esc(T.titleOf(p))}»</b>` : ''}.${L.best ? ` Maior abate: ${esc(L.best.name)} (${L.best.hp} de vida).` : ''}${next ? ` Próximo reconhecimento aos ${next[0]}: «${next[1]}».` : ''}</p>${p.trade?.sold ? `<p>Você já vendeu ${p.trade.sold} peças por ${p.trade.earned} moedas.</p>` : ''}</div>`;
    const advs = V.npcsAt(w, p).filter(n => n.adventurer), where = { read: 'no mural', hunt: 'caçando', sell: 'no balcão', social: 'na taverna', sleep: 'dormindo na pousada' };
    const people = `<div class="gu-ledger"><h4>Aventureiros da guilda</h4><ul class="gu-advs">${advs.map(n => { const s = w.adventurers?.[n.id] || {}; return `<li><b>${esc(n.name)}</b> <span>${where[s.state] || ''} · ${s.kills || 0} abates</span></li>`; }).join('')}</ul></div>`;
    return `${here ? '' : '<p class="gu-away">Você está longe do balcão: dá para ver os preços, mas vender só na guilda.</p>'}<div class="gu-sales">${rows}</div>${ledger}${people}`;
  }
  function act(type, extra) { const g = G(); g.command(type, extra); setTimeout(() => { if (isOpen && $('modal').classList.contains('guild-modal')) render(); }, g.online ? 500 : 80); }
  function wireButtons(root) {
    root.querySelectorAll('[data-gu-read]').forEach(b => b.onclick = () => openScroll(b.dataset.guRead));
    root.querySelectorAll('[data-gu-sell]').forEach(b => b.onclick = () => { stamp('VENDIDO'); act('guildSell', { id: b.dataset.guSell, n: 1 }); });
    root.querySelectorAll('[data-gu-sell-all]').forEach(b => b.onclick = () => { stamp('VENDIDO'); act('guildSell', { id: b.dataset.guSellAll, all: true }); });
    root.querySelectorAll('[data-gu-accept]').forEach(b => b.onclick = () => { stamp('ACEITO'); act('questAccept', { id: b.dataset.guAccept }); });
    root.querySelectorAll('[data-gu-turnin]').forEach(b => b.onclick = () => { stamp('CONCLUÍDO', true); scroll = null; act('questTurnIn', { id: b.dataset.guTurnin }); });
    root.querySelectorAll('[data-gu-abandon]').forEach(b => b.onclick = () => { if (confirm('Desistir deste contrato? O progresso é perdido.')) act('questAbandon', { id: b.dataset.guAbandon }); });
    root.querySelectorAll('[data-gu-close-scroll]').forEach(b => b.onclick = () => { scroll = null; $('gu-scroll-host').innerHTML = ''; });
  }
  function wire(p, board) {
    const root = $('modal-body'); wireButtons(root);
    root.querySelectorAll('[data-gu-tab]').forEach(b => b.onclick = () => { tab = b.dataset.guTab; scroll = null; render(); });
    root.querySelectorAll('[data-gu-note]').forEach(b => b.onclick = () => { selected = b.dataset.guNote; render(); openScroll(selected); });
    root.querySelectorAll('[data-gu-letter]').forEach(b => b.onclick = () => openScroll(b.dataset.guLetter));
    root.querySelector('[data-gu-join]')?.addEventListener('click', () => act('guildJoin'));
  }
  function badges() {
    document.querySelectorAll('canvas.gu-badge').forEach(c => { const art = window.GameAssets?.get('guild-rank' + c.dataset.rank); if (!art) { c.hidden = true; return; } c.hidden = false; const g = c.getContext('2d'), k = Math.min(c.width / art.width, c.height / art.height), w = Math.round(art.width * k), h = Math.round(art.height * k); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(art, (c.width - w) / 2, (c.height - h) / 2, w, h); });
  }
  function loop() {
    cancelAnimationFrame(raf);
    const tick = now => {
      const c = $('guild-scene'); if (!c || !isOpen) return;
      window.GuildArt.scene(c.getContext('2d'), now / 1000, c.width, c.height);
      const el = $('gu-speech'); if (el && speechShown < speechText.length) { speechShown = Math.min(speechText.length, speechShown + 1.2); el.textContent = speechText.slice(0, Math.floor(speechShown)); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function event(e) {
    if (!isOpen || !$('modal').classList.contains('guild-modal')) return;
    if (e.type === 'questDone' || e.type === 'letter') setTimeout(render, 300);
  }
  // Menu entry: consult the guild (letters, fame, contracts) from anywhere.
  new MutationObserver(() => { const menu = document.querySelector('#modal-body .menu-grid'); if (menu && !menu.querySelector('[data-guild-menu]')) { const b = document.createElement('button'); b.className = 'button secondary'; b.dataset.guildMenu = ''; b.textContent = 'Guilda, nobres e cartas'; b.onclick = () => open({ tab: 'nobles' }); menu.prepend(b); } }).observe($('modal-body'), { childList: true, subtree: true });
  new MutationObserver(() => { if ($('modal-title').textContent !== 'Guilda dos Caminhantes') { $('modal').classList.remove('guild-modal'); isOpen = false; } }).observe($('modal-title'), { childList: true, characterData: true, subtree: true });
  new MutationObserver(() => { if ($('overlay').classList.contains('hidden')) isOpen = false; }).observe($('overlay'), { attributes: true, attributeFilter: ['class'] });
  return { open, event, render };
})();
