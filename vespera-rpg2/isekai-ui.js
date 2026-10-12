'use strict';
// Isekai interface: the arrival scene with the Goddess (race + unique skill), the holographic Status
// window (U), System messages and the guild card. It talks to the game only through window.GameSession,
// and uses the game's modal, so touch, mouse, keyboard and gamepad navigation all work the same way.
window.IsekaiUI = (() => {
  const V = window.Vespera, I = V.isekai, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = () => window.GameSession;
  let deferred = false, sent = false, intro = null, statusTab = 'status', raf = 0;

  // ---------- System messages ----------
  const stack = document.createElement('div'); stack.id = 'system-stack'; stack.setAttribute('role', 'status'); stack.setAttribute('aria-live', 'polite'); document.body.append(stack);
  const KIND = { level: ['NÍVEL', '#ffd86a'], skill: ['PROFICIÊNCIA', '#9fe8ff'], title: ['TÍTULO', '#e6b8ff'], rank: ['GUILDA', '#ffd86a'], unique: ['HABILIDADE ÚNICA', '#7ff0ff'], race: ['RAÇA', '#b8f0c8'], tame: ['PACTO', '#ff9ecb'], evolve: ['EVOLUÇÃO', '#9fe8ff'], fail: ['PACTO', '#ffb0a0'], info: ['SISTEMA', '#bfe8ff'] };
  function system(text, kind = 'info') {
    const [tag, color] = KIND[kind] || KIND.info, el = document.createElement('div');
    el.className = 'sys-msg'; el.style.setProperty('--sys', color); el.innerHTML = `<b>『${tag}』</b><span>${esc(text)}</span>`;
    stack.prepend(el); while (stack.children.length > 4) stack.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 4300); setTimeout(() => el.remove(), 4900);
  }
  function event(e) {
    if (e.type === 'system') system(e.text, e.color);
    if (e.type === 'rankup') rankCard(e.text);
    if (G()?.player && ['system', 'rankup'].includes(e.type) && $('overlay') && !$('overlay').classList.contains('hidden') && $('modal').classList.contains('status-modal')) setTimeout(() => openStatus(statusTab), 250);
  }

  // ---------- Guild card ----------
  function rankCard(letter) {
    const p = G()?.player; const el = document.createElement('div'); el.className = 'rank-card-show';
    el.innerHTML = `<div class="guild-card flip"><div class="gc-face"><small>GUILDA DOS CAMINHANTES</small><strong class="gc-rank">${esc(letter)}</strong><span>${esc(p ? V.fullName(p) : '')}</span><em>Promovido a rank ${esc(letter)}</em></div></div>`;
    document.body.append(el); setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3200);
  }

  // ---------- The Goddess (pixel art on a 320×150 canvas) ----------
  const goddessArt = new Image(); goddessArt.src = 'assets/goddess-anim.png';
  function goddess(g, t, W, Hh) {
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const sky = g.createLinearGradient(0, 0, 0, Hh); sky.addColorStop(0, '#0b0a24'); sky.addColorStop(.6, '#1c1846'); sky.addColorStop(1, '#2a2160'); g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 60; i++) { const x = (i * 97.3) % W, y = (i * 53.7) % (Hh * .7), tw = Math.sin(t * 2 + i) > .4; R(x, y, 1, 1, tw ? '#ffffff' : '#8a88c8'); }
    for (let i = 0; i < 18; i++) { const k = (t * .12 + i / 18) % 1, x = (i * 41.7 + Math.sin(t + i) * 8) % W; R(x, k * Hh, 1, 3, '#fff2c099'); }
    const cx = W / 2, floor = Hh - 18, bob = Math.round(Math.sin(t * 1.4) * 2), rot = t * .6;
    // Painted goddess: 8 frames (4 floating, 4 blessing); the blessing plays every 8 s.
    if (goddessArt.complete && goddessArt.naturalWidth) {
      const fw = goddessArt.naturalWidth / 8, fh = goddessArt.naturalHeight, still = window.Experience?.settings?.reducedMotion;
      const cycle = t % 8, frame = still ? 0 : cycle > 7 ? 4 + Math.min(3, Math.floor((cycle - 7) / .25)) : Math.floor(t * 5) % 4;
      g.drawImage(goddessArt, frame * fw, 0, fw, fh, Math.round(cx - fw / 2), Hh - fh - 2, fw, fh);
      return;
    }
    // Magic circle on the floor.
    for (const [r, n, sp, c] of [[70, 44, 1, '#7ff0ff'], [52, 32, -1.3, '#e8c14a'], [30, 20, 1.8, '#b8a8ff']]) for (let i = 0; i < n; i++) { const a = rot * sp + i / n * Math.PI * 2; R(cx + Math.cos(a) * r, floor + Math.sin(a) * r * .22, 2, 1, c); }
    for (let i = 0; i < 8; i++) { const a = -rot + i * Math.PI / 4, x = cx + Math.cos(a) * 61, y = floor + Math.sin(a) * 13; R(x - 1, y - 2, 3, 1, '#ffffff'); R(x, y - 3, 1, 3, '#7ff0ff'); }
    // Warm column of light from above (additive, so it glows instead of greying the sky).
    g.globalCompositeOperation = 'lighter'; const beam = g.createLinearGradient(cx - 30, 0, cx + 30, 0); beam.addColorStop(0, '#fff2c000'); beam.addColorStop(.5, `rgba(255,236,170,${.22 + Math.sin(t * 2) * .05})`); beam.addColorStop(1, '#fff2c000'); g.fillStyle = beam; g.fillRect(cx - 30, 0, 60, floor); g.globalCompositeOperation = 'source-over';
    const top = 30 + bob, flap = Math.sin(t * 1.6) * 2;
    // Wings.
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const w = 22 - i * 2, x = cx + s * (10 + i * 5) - (s < 0 ? w : 0), y = top + 20 + i * 5 - flap * (i / 6) * s * s; R(x, y, w, 4, i % 2 ? '#f4f0ff' : '#dcd6f6'); R(x, y + 3, w, 1, '#b8b0e0'); }
    // Hair behind.
    for (let i = 0; i < 14; i++) { const sw = Math.round(Math.sin(t * 1.2 + i * .4) * 1.5); R(cx - 11 + sw, top + 10 + i * 4, 22 - i * .4, 4, i % 3 ? '#e8ecff' : '#cfd6f4'); }
    // Robe.
    for (let r = 0; r < 52; r++) { const hw = 8 + r * .36, y = top + 30 + r; R(cx - hw, y, hw * 2, 1, '#f6f1e6'); R(cx + hw * .35, y, hw * .65, 1, '#ddd4c2'); R(cx - hw, y, 1, 1, '#b8ae98'); R(cx + hw - 1, y, 1, 1, '#b8ae98'); }
    R(cx - 27, top + 80, 54, 3, '#e8c14a'); R(cx - 9, top + 40, 18, 2, '#e8c14a'); R(cx - 1, top + 42, 2, 36, '#e8c14a');
    // Arms raised holding the light.
    R(cx - 16, top + 18, 6, 14, '#f6f1e6'); R(cx + 10, top + 18, 6, 14, '#f6f1e6'); R(cx - 15, top + 14, 4, 5, '#f3dcc8'); R(cx + 11, top + 14, 4, 5, '#f3dcc8');
    const orb = .7 + Math.sin(t * 3) * .3; g.globalAlpha = orb * .35; R(cx - 14, top - 6, 28, 22, '#fff2c0'); g.globalAlpha = 1; R(cx - 5, top + 2, 10, 10, '#fff8e0'); R(cx - 3, top + 4, 6, 6, '#ffffff');
    // Face and hair front.
    R(cx - 6, top + 14, 12, 13, '#f3dcc8'); R(cx - 7, top + 12, 14, 5, '#eef0ff'); R(cx - 8, top + 14, 3, 14, '#eef0ff'); R(cx + 5, top + 14, 3, 14, '#eef0ff');
    R(cx - 4, top + 20, 3, 1, '#6a5a70'); R(cx + 1, top + 20, 3, 1, '#6a5a70'); R(cx - 1, top + 24, 2, 1, '#d89a9a');
    // Halo.
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2 + t; R(cx + Math.cos(a) * 11, top + 5 + Math.sin(a) * 3, 2, 1, i % 5 ? '#e8c14a' : '#fff6c0'); }
  }

  // ---------- Arrival scene ----------
  const lines = ['…Abra os olhos, viajante.', 'Sua vida anterior terminou cedo demais. Não foi por acaso: fui eu que trouxe sua alma até aqui.', 'Eu sou Aurelia, a Deusa do Véu. Este é Véspera, um mundo de espadas, magia, monstros e reinos.', 'Antes de despertar, escolha a forma que terá neste mundo… e o dom que só você terá.'];
  function openIntro() {
    intro = { step: 0, line: 0, typed: 0, race: 'humano', unique: 'analise', started: performance.now() };
    renderIntro(); loop();
  }
  function setModalClass(cls) { const m = $('modal'); m.classList.remove('isekai-modal', 'status-modal'); if (cls) m.classList.add(cls); }
  function renderIntro() {
    const g = G(); if (!g) return; const s = intro;
    if (s.step === 0) {
      g.modal('isekai', 'Além do Véu', `<div class="isekai-scene"><canvas id="isekai-canvas" width="320" height="150" aria-label="A Deusa Aurelia flutua sobre um círculo mágico"></canvas><p id="isekai-line" class="isekai-line" aria-live="polite"></p><div class="isekai-actions"><button id="isekai-later" class="isekai-ghost">Decidir depois</button><button id="isekai-next" class="isekai-btn">Continuar ▸</button></div></div>`);
      $('isekai-next').onclick = () => { const full = lines[s.line]; if (s.typed < full.length) { s.typed = full.length; return; } if (s.line < lines.length - 1) { s.line++; s.typed = 0; } else { s.step = 1; renderIntro(); } };
      $('isekai-later').onclick = () => { deferred = true; intro = null; g.close(); system('A Deusa espera. Abra a Janela de Status (U) quando quiser receber a bênção.', 'info'); };
    } else if (s.step === 1) {
      g.modal('isekai', 'Escolha sua raça', `<p class="isekai-hint">Sua aparência muda de verdade no mundo. A escolha é para esta vida inteira.</p><div class="isekai-cards">${I.races.map(r => `<button class="isekai-card ${r.id === s.race ? 'on' : ''}" data-race="${r.id}"><canvas class="race-preview" data-preview="${r.id}" width="56" height="72"></canvas><strong>${r.icon} ${esc(r.name)}</strong><small>${esc(r.desc)}</small><ul>${r.perks.map(x => `<li>${esc(x)}</li>`).join('')}</ul></button>`).join('')}</div><div class="isekai-actions"><button id="isekai-back" class="isekai-ghost">◂ Voltar</button><button id="isekai-next" class="isekai-btn">Próximo ▸</button></div>`);
      document.querySelectorAll('[data-race]').forEach(b => b.onclick = () => { s.race = b.dataset.race; document.querySelectorAll('[data-race]').forEach(x => x.classList.toggle('on', x === b)); });
      $('isekai-back').onclick = () => { s.step = 0; s.line = lines.length - 1; s.typed = 999; renderIntro(); }; $('isekai-next').onclick = () => { s.step = 2; renderIntro(); };
    } else {
      g.modal('isekai', 'Escolha sua Habilidade Única', `<p class="isekai-hint">O "cheat" que só quem veio de outro mundo recebe.</p><div class="isekai-cards uniques">${I.uniques.map(u => `<button class="isekai-card unique ${u.id === s.unique ? 'on' : ''}" data-unique="${u.id}"><span class="u-icon"><canvas class="gift-anim" data-gift="${u.id}" width="56" height="56"></canvas><i class="gift-fallback">${u.icon}</i></span><strong>${esc(u.name)}</strong><small>${esc(u.desc)}</small></button>`).join('')}</div><div class="isekai-actions"><button id="isekai-back" class="isekai-ghost">◂ Voltar</button><button id="isekai-confirm" class="isekai-btn gold">Receber a bênção ✦</button></div>`);
      document.querySelectorAll('[data-unique]').forEach(b => b.onclick = () => { s.unique = b.dataset.unique; document.querySelectorAll('[data-unique]').forEach(x => x.classList.toggle('on', x === b)); });
      $('isekai-back').onclick = () => { s.step = 1; renderIntro(); };
      $('isekai-confirm').onclick = () => { sent = true; const { race, unique } = s; intro = null; g.close(); flash(); setTimeout(() => g.command('isekaiChoose', { race, unique }), 350); };
    }
    setModalClass('isekai-modal');
  }
  function flash() { const f = document.createElement('div'); f.className = 'isekai-flash'; document.body.append(f); setTimeout(() => f.remove(), 1700); }
  function loop() {
    cancelAnimationFrame(raf);
    const tick = now => {
      const t = now / 1000, c = $('isekai-canvas');
      if (c && intro) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; goddess(g, t, c.width, c.height); const full = lines[intro.line]; if (intro.typed < full.length) intro.typed += .9; const el = $('isekai-line'); const shown = full.slice(0, Math.floor(intro.typed)); if (el && el.textContent !== shown) el.textContent = shown; }
      const p = G()?.player;
      if (p) (document.querySelectorAll('canvas[data-gift]').forEach(cv=>{const f=window.GameAssets?.frame?.('fx-gift-'+cv.dataset.gift,window.Experience?.settings?.reducedMotion?0:Math.floor(t*6)%4);if(!f)return;cv.classList.add('ready');const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,cv.width,cv.height);g.drawImage(f,0,0,cv.width,cv.height);}),document.querySelectorAll('canvas[data-preview]')).forEach(cv => {
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height);
        const frame = 1 + Math.floor(t * 7) % 6, art = window.WorldArt.sprite(p.classId, 0, frame, p.appearance || 'female'); if (!art) return;
        const k = Math.min(1, (cv.height - 6) / art.height); g.save(); g.translate(cv.width / 2, cv.height - 2); g.scale(k, k); g.drawImage(art, -art.width / 2, -art.height + 4);
        window.IsekaiArt.race(g, { isekai: { chosen: true, race: cv.dataset.preview }, dir: 0, appearance: p.appearance, x: 1 }, art, t); g.restore();
      });
      if (intro || document.querySelector('canvas[data-preview]')) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  // ---------- Status window ----------
  const bar = (v, max, cls) => `<span class="st-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v / Math.max(1, max) * 100))}%"></i><em>${Math.floor(v)} / ${Math.floor(max)}</em></span>`;
  function openStatus(tab = statusTab) {
    const g = G(), p = g?.player; if (!g?.playing || !p) return; statusTab = tab;
    const s = p.isekai || {}, st = V.stats(p), race = I.raceById[s.race] || I.raceById.humano, un = s.chosen ? I.uniqueById[s.unique] : null, title = I.titleById[s.title], cls = V.classById[p.classId];
    const tabs = [['status', 'Status'], ['skills', 'Habilidades'], ['titles', 'Títulos'], ['pets', 'Companheiros'], ['guild', 'Guilda']].map(([k, n]) => `<button class="st-tab ${k === tab ? 'on' : ''}" data-status-tab="${k}">${n}</button>`).join('');
    let body = '';
    if (tab === 'status') {
      body = `<div class="st-head"><div><strong>${esc(V.fullName(p))}</strong>${title ? `<span class="st-title">「${esc(title.name)}」</span>` : ''}</div><span class="st-rank">RANK ${esc(s.rank || 'F')}</span></div>
      <dl class="st-grid"><dt>Raça</dt><dd>${s.chosen ? race.icon + ' ' + esc(race.name) : '<em>não escolhida</em>'}</dd><dt>Classe</dt><dd>${esc(cls.name)}</dd><dt>Nível</dt><dd>${p.level}</dd><dt>EXP</dt><dd>${bar(p.xp, p.level * 55, 'xp')}</dd>
      <dt>Vida</dt><dd>${bar(p.hp, st.hp, 'hp')}</dd><dt>Mana</dt><dd>${bar(p.mana, st.mana, 'mp')}</dd><dt>Ataque</dt><dd>${Math.round(st.atk)}</dd><dt>Defesa</dt><dd>${Math.round(st.def * 10) / 10}</dd><dt>Velocidade</dt><dd>${(Math.round(st.speed * 10) / 10)}</dd><dt>Crítico</dt><dd>${Math.round(st.crit * 100)}%</dd><dt>Bônus de EXP</dt><dd>+${Math.round((I.xpMult(p) - 1) * 100)}%</dd></dl>
      ${un ? `<div class="st-unique"><span><canvas class="gift-anim" data-gift="${un.id}" width="56" height="56"></canvas><i class="gift-fallback">${un.icon}</i></span><div><b>Habilidade Única · ${esc(un.name)}</b><small>${esc(un.desc)}</small></div></div>` : `<button class="isekai-btn gold" id="st-bless">✦ Receber a bênção da Deusa</button>`}
      <div class="isekai-actions"><button class="isekai-ghost" id="st-attributes">Distribuir atributos (P)</button></div>`;
    } else if (tab === 'skills') {
      body = `<p class="st-note">Proficiências sobem com o uso. ${s.unique === 'crescimento' ? 'Crescimento Acelerado: dobro de progresso.' : ''}</p><div class="st-skills">${I.profs.map(pf => { const lv = I.profLevel(s.profs?.[pf.id] || 0); return `<div class="st-skill"><span>${pf.icon}</span><div><b>${esc(pf.name)} <em>Nv. ${lv.level}${lv.level >= 10 ? ' · MÁX' : ''}</em></b>${lv.level < 10 ? bar(lv.into, lv.need, 'xp') : '<span class="st-bar max"><i style="width:100%"></i><em>MESTRE</em></span>'}<small>${esc(pf.desc)}</small></div></div>`; }).join('')}</div>
      <p class="st-note">Habilidade de classe: <b>${esc(cls.skill)}</b> (Q). Magias: grimório (G).</p>`;
    } else if (tab === 'titles') {
      body = `<p class="st-note">Títulos aparecem acima do seu nome e dão bônus. Use um de cada vez.</p><div class="st-titles">${I.titles.map(t => { const has = s.titles?.includes(t.id), on = s.title === t.id; return `<div class="st-t ${has ? 'has' : ''} ${on ? 'on' : ''}"><b>${has ? '「' + esc(t.name) + '」' : '「？？？」'}</b><small>${esc(t.desc)}</small><em>${Object.entries(t.bonus).map(([k, v]) => ({ atk: 'Ataque', def: 'Defesa', hp: 'Vida', mana: 'Mana', crit: 'Crítico', speed: 'Velocidade', xp: 'EXP' }[k] + ' +' + (k === 'crit' || k === 'xp' ? Math.round(v * 100) + '%' : v))).join(' · ')}</em>${has ? `<button class="isekai-ghost" data-equip-title="${on ? '' : t.id}">${on ? 'Remover' : 'Usar'}</button>` : ''}</div>`; }).join('')}</div>`;
    } else if (tab === 'pets') {
      const cap = I.companionCap(p), list = s.companions || [];
      body = `<p class="st-note">${s.chosen ? `Companheiros: ${list.length}/${cap}. Enfraqueça um monstro comum até 35% da vida e aperte Interagir ao lado dele para firmar o pacto. <b>Dar um nome faz o companheiro evoluir.</b>` : 'Receba a bênção da Deusa para firmar pactos com monstros.'}</p>
      <div class="st-pets">${list.map((c, i) => `<div class="st-pet stage${c.stage}"><div class="st-pet-head"><b>${esc(c.named ? c.name : c.name)}</b><em>${esc(V.monsterTypes[c.kind]?.name || c.kind)}${c.stage ? ' · ' + I.stageNames[c.stage] : ''} · Nv. ${c.level}</em></div>${bar(c.xp, 10 + c.level * 8, 'xp')}<small>Dano ${I.companionDamage(p, c)} · evolui nos níveis 6 e 14${c.named ? '' : ' ou ao receber um nome'}</small>
        <div class="st-pet-actions"><label class="sr-only" for="pet-name-${i}">Nome</label><input id="pet-name-${i}" maxlength="16" placeholder="${c.named ? 'Novo nome' : 'Dê um nome…'}" value=""><button class="isekai-btn ${c.named ? '' : 'gold'}" data-pet-name="${i}">${c.named ? 'Renomear' : 'Nomear ✦'}</button><button class="isekai-ghost" data-pet-release="${i}">Libertar</button></div></div>`).join('') || '<div class="st-empty">Nenhum companheiro ainda.</div>'}</div>`;
    } else {
      const rep = p.guild?.reputation || 0, next = I.nextRank(rep), idx = I.rankIndex(s.rank || 'F');
      body = `<div class="guild-card big"><div class="gc-face"><small>GUILDA DOS CAMINHANTES · CARTÃO DE AVENTUREIRO</small><strong class="gc-rank">${esc(s.rank || 'F')}</strong><span>${esc(V.fullName(p))}</span><em>${p.guild ? 'Reputação ' + rep : 'Ainda não é membro: visite o quadro da guilda na vila'}</em></div></div>
      <div class="st-ladder">${I.ranks.map(([k], i) => `<span class="${i <= idx ? 'on' : ''}">${k}</span>`).join('')}</div>
      <p class="st-note">${next ? `Próximo rank: <b>${next[0]}</b> com ${next[1]} de reputação (faltam ${next[1] - rep}). Contratos e raides dão reputação.` : 'Rank máximo alcançado. Você é uma lenda da guilda.'} Cada rank dá +3% de EXP.</p>`;
    }
    g.modal('status', 'Janela de Status', `<div class="st-tabs" role="tablist">${tabs}</div><div class="st-body">${body}</div>`);
    setModalClass('status-modal');
    document.querySelectorAll('[data-status-tab]').forEach(b => b.onclick = () => openStatus(b.dataset.statusTab));
    const act = (type, extra) => { g.command(type, extra); setTimeout(() => G()?.playing && $('modal').classList.contains('status-modal') && openStatus(statusTab), g.online ? 450 : 60); };
    document.querySelectorAll('[data-equip-title]').forEach(b => b.onclick = () => act('equipTitle', { id: b.dataset.equipTitle || null }));
    document.querySelectorAll('[data-pet-name]').forEach(b => b.onclick = () => { const i = b.dataset.petName, v = $('pet-name-' + i).value.trim(); if (!v) { $('pet-name-' + i).focus(); return; } act('nameCompanion', { index: Number(i), name: v }); });
    document.querySelectorAll('[data-pet-release]').forEach(b => b.onclick = () => { if (confirm('Libertar este companheiro? Ele volta para a natureza.')) act('releaseCompanion', { index: Number(b.dataset.petRelease) }); });
    $('st-bless')?.addEventListener('click', () => { deferred = false; openIntro(); });
    $('st-attributes')?.addEventListener('click', () => { g.close(); setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true })), 30); });
  }

  // ---------- Entry points ----------
  const hot = document.querySelector('.hotbar');
  if (hot) { const b = document.createElement('button'); b.id = 'status-button'; b.setAttribute('aria-label', 'Janela de Status'); b.innerHTML = '<kbd>U</kbd><span class="hot-icon">◈</span><small>Status</small>'; b.onclick = () => openStatus('status'); hot.prepend(b); }
  new MutationObserver(() => { const menu = document.querySelector('#modal-body .menu-grid'); if (menu && !menu.querySelector('[data-isekai-menu]')) { const b = document.createElement('button'); b.className = 'button secondary'; b.dataset.isekaiMenu = ''; b.textContent = 'Janela de Status · U'; b.onclick = () => openStatus('status'); menu.prepend(b); } }).observe($('modal-body'), { childList: true, subtree: true });
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.repeat) return;
    if (e.key.toLowerCase() === 'u' && G()?.playing) { e.preventDefault(); if ($('modal').classList.contains('status-modal') && !$('overlay').classList.contains('hidden')) G().close(); else if ($('overlay').classList.contains('hidden')) openStatus(statusTab); }
  });
  // The modal is shared: drop the isekai look whenever another window replaces ours.
  new MutationObserver(() => { const t = $('modal-title').textContent; if (!['Além do Véu', 'Escolha sua raça', 'Escolha sua Habilidade Única', 'Janela de Status'].includes(t)) setModalClass(null); }).observe($('modal-title'), { childList: true, characterData: true, subtree: true });
  // A soul without the blessing is called by the Goddess (new characters and older saves).
  setInterval(() => {
    const g = G(), p = g?.player; if (!g?.playing || !p || p.dead || sent || deferred || intro || window.ArenaUI?.active) return;
    if (p.isekai?.chosen) { sent = true; return; }
    if ($('overlay').classList.contains('hidden')) openIntro();
  }, 700);
  addEventListener('game-started', () => { sent = false; deferred = false; });
  return { system, event, openStatus, openIntro, rankCard };
})();
