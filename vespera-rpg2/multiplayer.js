'use strict';
(() => {
  const panel = document.createElement('section');
  panel.id = 'multiplayer'; panel.className = 'table-panel';
  panel.innerHTML = `<div class="eyebrow">HÁ LUGAR PARA MAIS ALGUÉM</div><h3>Uma fogueira. Quatro histórias.</h3><p>Joguem em turnos, dividam descobertas e acompanhem os dados de todos. Cada personagem guarda seu próprio destino.</p><div id="mp-entry"><button id="create-room" class="primary" type="button">Criar mesa para amigos <span>＋</span></button><div class="join-row"><input id="room-code" maxlength="6" aria-label="Código da sala" placeholder="CÓDIGO DA SALA" autocomplete="off"><button id="join-room" class="choice" type="button">Entrar →</button></div><small>Escolha seu nome e classe na ficha antes de entrar.</small></div><div id="mp-room" class="hidden"><div class="room-heading"><strong id="room-label"></strong><button id="copy-room" class="quiet">Copiar convite</button></div><ul id="party"></ul><p id="turn-status" role="status"></p><button id="start-room" class="primary hidden">Reunir o grupo e partir →</button><button id="skip-turn" class="choice hidden">Passar a vez do jogador desconectado</button><button id="leave-room" class="quiet">Sair da mesa</button></div><p id="mp-message" role="status" aria-live="polite"></p>`;
  document.querySelector('.intro').append(panel);
  const waiting = document.createElement('section');
  waiting.className = 'book hidden';
  waiting.innerHTML = '<div class="eyebrow">ANTES DA TRAVESSIA</div><h2>As melhores histórias<br>pedem companhia.</h2><p class="story-text">Seu lugar está reservado à beira da fogueira. Compartilhe o código da mesa e espere seus amigos chegarem.</p><div class="rule"><span>⚄</span><p><strong>Uma decisão por vez.</strong><br>Cada pessoa controla seu personagem. Todos acompanham os dados e compartilham as descobertas.</p></div><p class="hint">O anfitrião inicia quando houver de 2 a 4 jogadores. Mantenha esta aba aberta para guardar seu lugar.</p>';
  document.querySelector('main').append(waiting);
  let session = null, room = null, pending = false, polling = false, animation = null;
  let connected = true;
  const soloRoll = $('roll').onclick, soloContinue = $('continue').onclick, soloRestart = $('restart').onclick;
  const soloSubmit = $('creation').onsubmit;
  const store = () => { try { if (session) sessionStorage.setItem('vespera-room', JSON.stringify(session)); else sessionStorage.removeItem('vespera-room'); } catch {} };
  const message = text => { $('mp-message').textContent = text; };
  function clearAnimation() {
    clearTimeout(animation); animation = null; $('die').classList.remove('rolling');
  }
  async function request(path, body) {
    return VesperaNet.request('rooms', body ? 'POST' : 'GET', path, body, session?.token);
  }
  function character() {
    if (!$('creation').reportValidity()) return null;
    const name = $('name').value.trim();
    if (!name) { $('name').focus(); message('Escreva o nome do seu personagem.'); return null; }
    return { name, class: new FormData($('creation')).get('class') };
  }
  async function enter(join) {
    if (pending || session) return;
    if ($('setup').classList.contains('hidden')) { $('setup').classList.remove('hidden'); $('game').classList.add('hidden'); message('Escolha o personagem para esta mesa. Seu jogo solo continua salvo.'); $('name').focus(); return; }
    const profile = character(); if (!profile) return;
    const code = $('room-code').value.trim().toUpperCase();
    if (join && !/^[A-F0-9]{6}$/.test(code)) { message('O código da sala tem seis letras ou números.'); return; }
    pending = true; $('create-room').disabled = $('join-room').disabled = true; message('Abrindo a mesa…');
    try {
      const data = await request(join ? `/${code}/join` : '', profile);
      session = { code: data.room.code, token: data.token }; store();
      connected = true; message('Convide seus amigos pelo link ou pelo código da sala.'); update(data.room, true);
    } catch (error) { message(error.message); }
    finally { pending = false; $('create-room').disabled = $('join-room').disabled = false; }
  }
  function restoreSolo() {
    clearAnimation(); room = null; session = null; store();
    waiting.classList.add('hidden');
    $('mp-room').classList.add('hidden'); $('mp-entry').classList.remove('hidden');
    $('setup').classList.remove('hidden'); $('game').classList.add('hidden');
    $('restart').textContent = 'Nova história'; $('restart').disabled = false;
    $('roll').disabled = $('continue').disabled = false;
    state = null;
    try { const saved = JSON.parse(localStorage.getItem('vespera-v1')); if (saved && classes[saved.class]) { state = saved; render(); } } catch { state = null; }
  }
  function update(next, force = false) {
    if (room && next.revision < room.revision) return;
    const changed = !room || room.revision !== next.revision;
    const previous = room;
    room = next;
    $('mp-entry').classList.add('hidden'); $('mp-room').classList.remove('hidden');
    $('setup').classList.add('hidden');
    waiting.classList.toggle('hidden', room.status !== 'lobby');
    $('room-label').textContent = `MESA ${room.code} · ${room.players.length}/4`;
    $('party').innerHTML = room.players.map(p => `<li class="${p.id === room.active ? 'current-player' : ''}"><span>${classes[p.state.class].icon}</span><div><strong>${esc(p.state.name)} ${esc(p.state.origin.surname)}${p.id === room.me ? ' (você)' : ''}</strong><small>${classes[p.state.class].name} · ${p.state.spirit}/4 vigor${p.id === room.host ? ' · anfitrião' : ''}</small></div><span class="presence ${p.online ? 'online' : ''}" title="${p.online ? 'Conectado' : 'Desconectado'}" aria-label="${p.online ? 'Conectado' : 'Desconectado'}"></span></li>`).join('');
    const host = room.host === room.me, mine = room.active === room.me;
    const active = room.players.find(p => p.id === room.active);
    $('start-room').classList.toggle('hidden', room.status !== 'lobby' || !host);
    $('start-room').disabled = room.players.length < 2 || pending;
    $('skip-turn').classList.toggle('hidden', room.status !== 'playing' || !host || !active || active.online);
    $('turn-status').textContent = !connected ? 'Reconectando à mesa…' : room.status === 'lobby' ? (host ? 'Espere seus amigos e comece quando o grupo estiver pronto.' : 'O anfitrião vai iniciar a aventura.') : room.status === 'finished' ? 'A travessia terminou. Cada um leva sua própria história.' : mine ? 'Sua vez. O grupo acompanha a sua decisão.' : `Vez de ${active?.state.name}. Você acompanha a cena e o dado.`;
    if (room.status === 'lobby') { $('game').classList.add('hidden'); return; }
    if (!changed && !force) return;
    clearAnimation();
    const shown = room.status === 'finished' ? room.players.find(p => p.id === room.me) : active;
    if (!shown) return;
    state = structuredClone(shown.state);
    render();
    $('restart').textContent = 'Sair da mesa';
    $('journal-list').innerHTML = room.events.map(e => `<li>${esc(e)}</li>`).join('');
    const disable = !mine || !connected || pending;
    for (const button of $('choices').querySelectorAll('button')) button.disabled = disable;
    $('roll').disabled = $('continue').disabled = disable;
    if (room.status === 'finished') {
      $('choices').innerHTML = '';
      const button = document.createElement('button'); button.className = 'primary'; button.textContent = 'Deixar a mesa e criar outra história →'; button.onclick = leave; $('choices').append(button);
    }
    const before = previous?.players.find(p => p.id === shown.id)?.state;
    if (state.result && !before?.result && previous && changed) {
      $('die').classList.add('rolling'); tone(); $('continue').disabled = true;
      animation = setTimeout(() => { clearAnimation(); $('continue').disabled = !mine || !connected || pending; }, 900);
    }
  }
  async function poll() {
    if (!session || polling || pending) return;
    polling = true;
    try {
      const data = await request(`/${session.code}`);
      if (!session || session.code !== data.room.code) return;
      const reconnect = !connected; connected = true;
      if (reconnect) message('Você voltou à mesa.');
      update(data.room, reconnect);
    } catch (error) {
      if (error.status === 401 || error.status === 404) { restoreSolo(); message(error.message); }
      else { connected = false; message('Conexão interrompida. Tentando reconectar…'); if (room) update(room, true); }
    } finally { polling = false; }
  }
  async function act(type, extra = {}) {
    if (!session || !room || pending || !connected) return;
    pending = true; message('');
    update(room, true);
    try {
      const data = await request(`/${session.code}/action`, { type, revision: room.revision, ...extra });
      pending = false; update(data.room, true);
    } catch (error) { message(error.message); pending = false; await poll(); if (room) update(room, true); }
    finally { pending = false; }
  }
  async function leave() {
    if (pending) return;
    if (room?.status !== 'finished' && !confirm('Sair desta mesa? Seu personagem deixa esta aventura.')) return;
    if (!connected) { message('Aguarde a reconexão para sair da mesa sem perder seu lugar.'); return; }
    pending = true;
    try { await request(`/${session.code}/action`, { type: 'leave', revision: room.revision }); restoreSolo(); message('Você saiu da mesa.'); }
    catch (error) { message(error.message); }
    finally { pending = false; await poll(); }
  }
  window.multiplayer = { get active() { return !!session; }, act };
  $('create-room').onclick = () => enter(false); $('join-room').onclick = () => enter(true);
  $('room-code').oninput = () => { $('room-code').value = $('room-code').value.toUpperCase(); };
  $('start-room').onclick = () => act('start'); $('skip-turn').onclick = () => act('skip'); $('leave-room').onclick = leave;
  $('roll').onclick = () => session ? act('roll') : soloRoll();
  $('continue').onclick = () => session ? act('continue') : soloContinue();
  $('restart').onclick = () => session ? leave() : soloRestart();
  $('creation').onsubmit = event => { if (session) { event.preventDefault(); return; } soloSubmit(event); };
  $('copy-room').onclick = async () => {
    const url = new URL(location.href); url.search = ''; url.searchParams.set('sala', room.code); url.hash = '';
    try { await navigator.clipboard.writeText(url.href); message(location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'Convite copiado. Em outro aparelho, use o endereço da rede exibido no terminal e este código: ' + room.code : 'Convite copiado. Envie para seus amigos.'); }
    catch { message(`Convite: ${url.href} · Código: ${room.code}`); }
  };
  const invited = new URLSearchParams(location.search).get('sala');
  if (invited && /^[A-Fa-f0-9]{6}$/.test(invited)) { $('room-code').value = invited.toUpperCase(); message('Você recebeu um convite. Escolha seu nome e classe e entre na mesa.'); }
  try { const saved = JSON.parse(sessionStorage.getItem('vespera-room')); if (saved && /^[A-F0-9]{6}$/.test(saved.code) && /^[a-f0-9]{64}$/.test(saved.token)) session = saved; } catch {}
  if (session) { connected = false; $('setup').classList.add('hidden'); $('game').classList.add('hidden'); message('Retomando seu lugar na mesa…'); poll(); }
  setInterval(poll, 1200);
})();
