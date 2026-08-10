/* =========================================================================
   Business Tour — Analiz Merkezi · Arayüz
   ========================================================================= */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const PLAYER_CLASS = ['you', 'r1', 'r2', 'r3'];
const PLAYER_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#eab308'];

/* ---------------- DURUM ---------------- */
const LS_KEY = 'bt-analiz-v1';

function defaultState() {
  return {
    players: [
      { name: 'Sen', money: 2000000, pos: 0, jailTurns: 0, isYou: true },
      { name: 'R1', money: 2000000, pos: 0, jailTurns: 0 },
      { name: 'R2', money: 2000000, pos: 0, jailTurns: 0 },
      { name: 'R3', money: 2000000, pos: 0, jailTurns: 0 },
    ],
    props: {},
    festival: [],
    champ: null,
    minutesLeft: 20,
    turnsLeft: 50,
    heatMode: 'off',
  };
}

let state;
try { state = JSON.parse(localStorage.getItem(LS_KEY)) || defaultState(); }
catch (e) { state = defaultState(); }
if (!state.players || state.players.length !== 4) state = defaultState();
if (!state.festival) state.festival = [];

function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }

/* ---------------- TAHTA KONUMLARI ---------------- */
function gridPos(id) {
  if (id === 0) return [1, 1];
  if (id <= 9) return [id + 1, 1];
  if (id === 10) return [11, 1];
  if (id <= 19) return [11, id - 9];
  if (id === 20) return [11, 11];
  if (id <= 29) return [31 - id, 11];
  if (id === 30) return [1, 11];
  return [1, 41 - id];
}

function buildBoard() {
  const board = $('#board');
  BOARD.forEach(t => {
    const [c, r] = gridPos(t.id);
    const el = document.createElement('div');
    el.className = 'tile' + (t.type === 'chance' ? ' chance' : '') + (['start', 'island', 'worldtour', 'tax'].includes(t.type) ? ' corner' : '');
    el.dataset.id = t.id;
    el.style.gridColumn = c;
    el.style.gridRow = r;
    el.innerHTML = `
      <div class="t-strip" style="background:${t.type === 'city' ? GROUP_COLORS[t.group] : t.type === 'resort' ? '#06b6d4' : '#33466e'}"></div>
      <div class="t-flags"></div>
      <div class="t-name">${t.name}</div>
      <div class="t-price">${isPurchasable(t) ? fmt(t.price) : t.type === 'chance' ? '❓' : ''}</div>
      <div class="t-level"></div>
      <div class="t-tokens"></div>
      <div class="t-heat"></div>`;
    el.addEventListener('click', () => openTileModal(t.id));
    board.appendChild(el);
  });
  // merkez başlangıç içeriği
  $('#boardCenter').innerHTML = `
    <div class="scoreboard" id="scoreboard"></div>
    <div class="dice-zone">
      <button id="btnRollC" class="btn primary">🎲 Zar At</button>
      <select id="diceSelectC" class="inp"></select>
      <button id="btnWTc" class="btn accent">🌍 Tur Öner</button>
    </div>
    <div class="ctr-recs" id="ctrRecs"></div>
    <div class="ctr-danger" id="ctrDanger"></div>`;
  fillDiceSelect($('#diceSelect'));
  fillDiceSelect($('#diceSelectC'));
  $('#btnRoll').addEventListener('click', doRoll);
  $('#btnRollC').addEventListener('click', doRoll);
  $('#btnWorldTour').addEventListener('click', doWorldTour);
  $('#btnWTc').addEventListener('click', doWorldTour);
}

function fillDiceSelect(sel) {
  sel.innerHTML = '';
  for (let s = 2; s <= 12; s++) {
    const p = DICE.find(d => d.sum === s).p;
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = `${s} (${(p * 100).toFixed(1)}%)`;
    sel.appendChild(opt);
  }
}

/* ---------------- RENDER: TAHTA ---------------- */
function renderBoard() {
  BOARD.forEach(t => {
    const el = document.querySelector(`.tile[data-id="${t.id}"]`);
    if (!el) return;
    el.classList.remove('landing', 'sel');
    const pr = state.props[t.id];

    // sahiplik arka planı
    if (pr) {
      const col = PLAYER_COLORS[pr.owner];
      el.style.background = hexA(col, 0.30);
      el.style.borderColor = col;
    } else {
      el.style.background = '';
      el.style.borderColor = '';
    }

    // bayraklar
    const flags = [];
    if (state.festival.includes(t.id)) flags.push('🎪');
    if (state.champ && state.champ.tileId === t.id) flags.push('🏆');
    el.querySelector('.t-flags').textContent = flags.join(' ');

    // seviye
    const lv = el.querySelector('.t-level');
    if (pr && isPurchasable(t)) {
      if (pr.level >= 4) lv.innerHTML = '<span style="font-size:10px">🏨</span>';
      else {
        lv.innerHTML = '';
        for (let i = 0; i < 4; i++) {
          const b = document.createElement('i');
          if (i < pr.level) b.className = 'on';
          lv.appendChild(b);
        }
      }
    } else lv.innerHTML = '';

    // oyuncu tokenları
    const tk = el.querySelector('.t-tokens');
    tk.innerHTML = '';
    state.players.forEach((p, i) => {
      if (p.pos === t.id) {
        const s = document.createElement('span');
        s.className = 'tok ' + PLAYER_CLASS[i];
        tk.appendChild(s);
      }
    });

    // ısı haritası
    const heat = el.querySelector('.t-heat');
    heat.style.background = '';
    if (state.heatMode === 'danger' && isPurchasable(t)) {
      const p = landProbAt(t.id, state, 1);
      heat.style.background = hexA('#f87171', p * 1.6);
    } else if (state.heatMode === 'ev') {
      if (!pr) {
        const ev = evOwnership(state, t.id, 1, 6);
        const max = 800000;
        const k = Math.max(0, Math.min(1, ev.net / max));
        heat.style.background = hexA('#4ade80', k * 0.85);
      } else if (pr.owner === 0) {
        const ev = evOwnership(state, t.id, pr.level, 6);
        heat.style.background = hexA('#60a5fa', Math.min(0.6, Math.abs(ev.net) / 1000000));
      }
    }
  });

  // zar sonucu vurgusu
  if (lastRollLanding != null) {
    const el = document.querySelector(`.tile[data-id="${lastRollLanding}"]`);
    if (el) el.classList.add('landing');
  }

  renderScoreboard();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

let lastRollLanding = null;

function renderScoreboard() {
  const sb = $('#scoreboard');
  if (!sb) return;
  sb.innerHTML = state.players.map((p, i) => `
    <div class="score ${p.isYou ? 'you' : ''}" style="border-left:3px solid ${PLAYER_COLORS[i]}">
      <div class="nm"><span class="tok ${PLAYER_CLASS[i]}"></span> ${p.name} ${p.isYou ? '(sen)' : ''}</div>
      <div class="mn">${fmt(p.money)}</div>
    </div>`).join('');
}

/* ---------------- RENDER: OYUNCULAR ---------------- */
function renderPlayers() {
  const wrap = $('#playerList');
  wrap.innerHTML = state.players.map((p, i) => `
    <div class="player-card ${p.isYou ? 'you' : ''}">
      <div class="pc-head">
        <span class="tok ${PLAYER_CLASS[i]}"></span>
        <input class="inp pc-name-inp" value="${p.name}" data-p="${i}" style="width:90px">
      </div>
      <div class="pc-row">
        <span>Para:</span>
        <input type="number" class="inp pc-money" value="${p.money}" step="50000" data-p="${i}">
        <span>Konum:</span>
        <select class="inp pc-pos" data-p="${i}">
          ${BOARD.map(t => `<option value="${t.id}" ${t.id === p.pos ? 'selected' : ''}>${t.id} · ${t.name}</option>`).join('')}
        </select>
      </div>
      <div class="pc-row">
        <span>Kayıp Ada turu:</span>
        <input type="number" class="inp pc-jail" value="${p.jailTurns}" min="0" max="3" data-p="${i}" style="width:60px">
        <span>İflas:</span>
        <input type="checkbox" class="pc-bank" data-p="${i}" ${p.bankrupt ? 'checked' : ''}>
      </div>
    </div>`).join('');

  $$('.pc-name-inp').forEach(el => el.addEventListener('change', e => {
    state.players[+e.target.dataset.p].name = e.target.value.trim() || 'Oyuncu';
    save(); renderAll();
  }));
  $$('.pc-money').forEach(el => el.addEventListener('change', e => {
    state.players[+e.target.dataset.p].money = Math.max(0, +e.target.value || 0);
    save(); renderAll();
  }));
  $$('.pc-pos').forEach(el => el.addEventListener('change', e => {
    state.players[+e.target.dataset.p].pos = +e.target.value;
    save(); renderAll();
  }));
  $$('.pc-jail').forEach(el => el.addEventListener('change', e => {
    state.players[+e.target.dataset.p].jailTurns = Math.max(0, Math.min(3, +e.target.value || 0));
    save(); renderAll();
  }));
  $$('.pc-bank').forEach(el => el.addEventListener('change', e => {
    state.players[+e.target.dataset.p].bankrupt = e.target.checked;
    save(); renderAll();
  }));

  // şampiyona select
  const cs = $('#champSelect');
  const myCities = BOARD.filter(t => isPurchasable(t) && state.props[t.id] && state.props[t.id].owner === 0);
  cs.innerHTML = '<option value="">— seç —</option>' + myCities.map(t =>
    `<option value="${t.id}" ${state.champ && state.champ.tileId === t.id ? 'selected' : ''}>${t.name} (${LEVEL_NAMES[state.props[t.id].level]})</option>`).join('');
  cs.onchange = () => {
    const v = +cs.value;
    state.champ = v ? { tileId: v, mult: 2 } : null;
    save(); renderAll();
  };
}

/* ---------------- RENDER: ÖNERİLER ---------------- */
function renderRecs() {
  const recs = recommend(state, 0);
  const valid = recs.filter(r => r.score > -1e6);
  const list = (valid.length ? valid : recs).slice(0, 7);

  // en iyi 1
  const top = list[0];
  const topEl = $('#recTop');
  if (top) {
    topEl.innerHTML = `
      <div class="card" style="border-left:4px solid ${top.priority === 'KRİTİK' || top.priority === 'ACİL' || top.priority === 'UYARI' ? 'var(--danger)' : 'var(--ok)'}">
        <div style="font-size:11px;color:var(--dim)">⚡ ŞU AN YAPILACAK EN İYİ HAMLE</div>
        <div style="font-weight:800;font-size:16px;margin-top:3px">${top.title}</div>
        <div class="hint">${top.detail}</div>
      </div>`;
  }

  // liste
  const wrap = $('#recList');
  wrap.innerHTML = list.map(r => `
    <div class="rec-card p-${r.priority}">
      <div class="rc-title">${r.title}<span class="pill p-${r.priority}">${r.priority}</span></div>
      <div class="rc-detail">${r.detail}</div>
    </div>`).join('');

  // merkez
  const ctr = $('#ctrRecs');
  if (ctr) ctr.innerHTML = list.slice(0, 2).map(r => `
    <div class="rec-card p-${r.priority}">
      <div class="rc-title" style="font-size:12px">${r.title}</div>
      <div class="rc-detail" style="font-size:11px">${r.detail}</div>
    </div>`).join('');
  const dg = $('#ctrDanger');
  if (dg) dg.textContent = `🔥 Önümüzdeki turlarda tehlike skoru: %${Math.round(dangerScore(state, 0) * 100)}`;
}

/* ---------------- ZAR MODU ---------------- */
function doRoll() {
  const activeTab = $('#tab-play').classList.contains('active');
  const sum = +(activeTab ? $('#diceSelect').value : $('#diceSelectC').value);
  const me = state.players[0];
  const landing = (me.pos + sum) % 40;
  lastRollLanding = landing;
  const tile = BOARD[landing];
  const pr = state.props[landing];
  const festival = state.festival.includes(landing);
  const champMult = state.champ && state.champ.tileId === landing ? state.champ.mult : 1;

  let html = `<b>Zar ${sum} → Kare ${landing}: ${tile.name}</b>`;
  if (tile.type === 'city' || tile.type === 'resort') {
    if (!pr) {
      const ev = evOwnership(state, landing, 1, 6);
      html += `<br>🏷️ <b>Sahipsiz</b> — ${fmt(tile.price)}'e satın al${festival ? ' <span class="hl">(FESTİVAL ×2!)</span>' : ''}. Beklenen net: ${fmt(ev.net)} (6 tur)`;
      if (me.money < tile.price) html += `<br>⚠️ Paran yetmiyor (${fmt(me.money)}).`;
    } else if (pr.owner === 0) {
      const nextLv = Math.min(4, pr.level + 1);
      const cost = buildCost(tile);
      html += `<br>✅ Kendi mülkün — ${LEVEL_NAMES[nextLv]} dik (${fmt(cost)}). Kira → ${fmt(rentOf(tile, nextLv, festival, champMult))}`;
    } else {
      const rent = rentOf(tile, pr.level, festival, champMult);
      html += `<br>🔥 <b>Rakibin (${state.players[pr.owner].name})</b> — Seviye ${pr.level}, ödemen: <b class="hl">${fmt(rent)}</b>${festival ? ' (FESTİVAL!)' : ''}`;
      if (rent > 120000 && me.money > rent + 100000) {
        html += `<br>🎲 <b>Öneri:</b> ${GAME.rerollCost} çip verip zarları tekrar atmayı düşün (beklenen hasar çok yüksek).`;
      }
      if (rent > me.money) html += `<br>🚨 <b>İflas riski!</b> Bu kirayı ödeyemeyebilirsin — mülk satmayı planla.`;
    }
  } else if (tile.type === 'chance') {
    html += `<br>❓ Şans kartı: iyi veya kötü olabilir (~%50 her biri).`;
  } else if (tile.type === 'tax') {
    const w = landscapeWorth(state, 0);
    html += `<br>💰 Vergi: mülk değerinin %10'u = <b>${fmt(w * GAME.taxRate)}</b>`;
  } else if (tile.type === 'island') {
    html += `<br>🏝️ Kayıp Ada! ${fmt(GAME.islandLeaveCost)} öde ya da 3 tur bekle.`;
  } else if (tile.type === 'worldtour') {
    html += `<br>🌍 Dünya Turu! En iyi hedef listesi aşağıda hesaplandı.`;
    setTimeout(doWorldTour, 50);
  } else if (tile.type === 'start') {
    html += `<br>💵 Başlangıç: +${fmt(GAME.startBonus)} kazandın.`;
  } else if (tile.type === 'championship') {
    html += `<br>🏆 Şampiyona: kendi şehrine seçersen kirası ×2 olur.`;
  }

  $('#diceResult').innerHTML = html;
  $('#diceResult').classList.remove('dim');
  renderBoard();
  save();
}

/* ---------------- DÜNYA TURU ---------------- */
function doWorldTour() {
  const wb = worldTourBest(state, 0).filter(w => w.owner === -1 || w.owner === 0).slice(0, 8);
  const wrap = $('#wtList');
  wrap.innerHTML = wb.map((w, i) => `
    <div class="wt-item" data-tile="${w.tileId}" title="Buraya ışınlan (${fmt(GAME.worldTourCost)})">
      <span>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️'} <span class="wt-name">${w.name}</span> ${w.festival ? '🎪' : ''}
        <span class="wt-num">${w.reason}</span></span>
      <span class="wt-num">net ${fmt(w.evNet)} · kira ${fmt(w.rent)}</span>
    </div>`).join('');
  $$('#wtList .wt-item').forEach(el => el.addEventListener('click', () => {
    state.players[0].pos = +el.dataset.tile;
    save(); renderAll();
  }));
  // otomatik: sen dünya turundaysan
  if (state.players[0].pos === 20) renderRecs();
}

/* ---------------- SİMÜLASYON ---------------- */
let simRunning = false;
function doSim() {
  if (simRunning) return;
  simRunning = true;
  const iter = Math.max(200, Math.min(10000, +$('#simIter').value || 2000));
  const turns = Math.max(10, Math.min(200, +$('#simTurns').value || 50));
  $('#simResult').innerHTML = '⏳ Hesaplanıyor (' + iter + ' simülasyon × ' + turns + ' tur)...';
  $('#btnSim').disabled = true;

  setTimeout(() => {
    const mc = monteCarlo(state, iter, turns);
    const bars = state.players.map((p, i) => {
      const wp = mc.winProb[i];
      const col = PLAYER_COLORS[i];
      return `
        <div class="sim-bar-row">
          <div class="sim-bar-label"><span>${p.name} ${p.isYou ? '(sen)' : ''}</span><b>%${(wp * 100).toFixed(1)}</b></div>
          <div class="sim-bar"><div style="width:${wp * 100}%;background:${col}"></div></div>
          <div class="hint">Ort. servet: ${fmt(mc.avgWealth[i])}</div>
        </div>`;
    }).join('');
    const you = mc.winProb[0];
    const adv = you < 0.2 ? '⚠️ Şu an kaybetmeye yakınsın — riskli agresif oyna: yüksek ROI mülklere yatır, festival karelerini kap.'
      : you < 0.35 ? '📈 Şansın düşük-orta — bloklara öncelik ver (rakibin kazanma yollarını kapat).'
      : you > 0.6 ? '👑 Şu an favorisin — oyunu kilitle: riskli zarlardan kaç, yüksek kira mülklerini koru.'
      : '⚖️ Dengeli oyun — rakibin kazanma yollarını blokla ve en yüksek ROI yatırımlarına devam.';
    $('#simResult').innerHTML = bars + `<div class="card" style="margin-top:8px">${adv}</div>`;
    $('#mcBadge').textContent = `Simülasyon: %${(you * 100).toFixed(1)} kazanma`;
    $('#btnSim').disabled = false;
    simRunning = false;
  }, 30);
}

/* ---------------- KAZANMA ---------------- */
function renderWin() {
  // tehditler
  const th = winThreat(state, 0);
  $('#winThreats').innerHTML = th
    ? `<div class="threat-card">🚨 <b>${th.name}</b> — ${th.text}</div>`
    : '<div class="hint">Şu an kimse kazanma noktasında değil.</div>';

  const grid = $('#winProgress');
  grid.innerHTML = '<div class="win-grid">' + state.players.map((p, i) => {
    const wp = winProgress(state, i);
    const sideRows = Object.entries(wp.sides).map(([s, v]) => {
      const pct = Math.round(v.own / v.total * 100);
      return `<div class="mini-bar"><div style="width:${pct}%;background:${PLAYER_COLORS[i]}"></div></div>
              <div class="hint" style="font-size:10.5px">${SIDE_NAMES[s]}: ${v.own}/${v.total}</div>`;
    }).join('');
    const grpRows = Object.entries(wp.groups).map(([g, v]) => {
      const done = v.own === v.total ? '✅' : '';
      return `<span style="font-size:10.5px">${done} Grup ${g}: ${v.own}/${v.total}</span>`;
    }).join(' · ');
    return `<div class="win-cell">
      <div style="font-weight:700;color:${PLAYER_COLORS[i]}">${p.name} ${p.isYou ? '(sen)' : ''}</div>
      <div class="hint">Kenarlar (tam: ${wp.completeSides})</div>${sideRows}
      <div class="hint" style="margin-top:4px">Gruplar (tam: ${wp.completeGroups})</div>
      <div style="font-size:10.5px">${grpRows}</div>
      <div class="hint" style="margin-top:4px">Tatil köyleri: ${'🏝️'.repeat(wp.resorts)}${wp.resorts}/4</div>
    </div>`;
  }).join('') + '</div>';
}

/* ---------------- HARİTA DÜZENLE ---------------- */
function renderMapEditor() {
  const wrap = $('#mapEditor');
  const head = `<div class="me-row me-head"><span>Kare</span><span>Fiyat</span><span>Arsa</span><span>+1</span><span>+2</span><span>+3</span><span>Otel</span><span>Grup</span></div>`;
  const rows = BOARD.map(t => `
    <div class="me-row" data-id="${t.id}">
      <span class="me-name">${t.id} · ${t.name}</span>
      <input class="me-price" value="${isPurchasable(t) ? t.price : ''}" ${isPurchasable(t) ? '' : 'disabled'}>
      ${[0, 1, 2, 3, 4].map(l => `<input class="me-rent" data-l="${l}" value="${isPurchasable(t) ? t.rents[l] : ''}" ${isPurchasable(t) ? '' : 'disabled'}>`).join('')}
      <input class="me-group" value="${t.type === 'city' ? t.group : ''}" ${t.type === 'city' ? '' : 'disabled'}>
    </div>`).join('');
  wrap.innerHTML = head + rows;
}

$('#btnMapSave').addEventListener('click', () => {
  $$('#mapEditor .me-row').forEach(row => {
    const id = +row.dataset.id;
    const t = BOARD[id];
    if (!isPurchasable(t)) return;
    t.price = Math.max(10000, +row.querySelector('.me-price').value || t.price);
    row.querySelectorAll('.me-rent').forEach(inp => {
      const l = +inp.dataset.l;
      t.rents[l] = Math.max(0, +inp.value || t.rents[l]);
    });
    if (t.type === 'city') {
      const g = row.querySelector('.me-group').value.trim().toUpperCase();
      if (g) t.group = g;
    }
  });
  save(); renderAll();
  alert('✅ Kaydedildi — tüm hesaplar (EV, ROI, simülasyon) güncellendi.');
});
$('#btnMapReset').addEventListener('click', () => {
  if (confirm('Varsayılan harita verisine dönülsün mü?')) {
    localStorage.removeItem(LS_KEY);
    location.reload();
  }
});

/* ---------------- KARE MODAL ---------------- */
function openTileModal(id) {
  const t = BOARD[id];
  const pr = state.props[id];
  const festival = state.festival.includes(id);
  const champMult = state.champ && state.champ.tileId === id ? state.champ.mult : 1;

  let body = `<h3>${t.name} <span class="hint">(Kare ${id})</span></h3>`;
  if (t.type === 'chance') body += '<p class="hint">❓ Şans karesi</p>';
  else if (t.type === 'start') body += `<p class="hint">💵 Geçiş: +${fmt(GAME.startBonus)}</p>`;
  else if (t.type === 'island') body += `<p class="hint">🏝️ 3 tur bekle ya da ${fmt(GAME.islandLeaveCost)} öde</p>`;
  else if (t.type === 'worldtour') body += `<p class="hint">🌍 ${fmt(GAME.worldTourCost)} ile istediğin kareye ışınlan</p>`;
  else if (t.type === 'tax') body += `<p class="hint">💰 Mülk değerinin %${GAME.taxRate * 100} vergi</p>`;
  else if (t.type === 'championship') body += `<p class="hint">🏆 Seçilen şehirde kira ×2</p>`;

  if (isPurchasable(t)) {
    body += `
      <table class="rents-table">
        <tr><th></th><th>Arsa</th><th>+1 Ev</th><th>+2 Ev</th><th>+3 Ev</th><th>Otel</th></tr>
        <tr><td>Kira</td>${t.rents.map(r => `<td>${fmt(r)}</td>`).join('')}</tr>
        <tr><td>Festival</td>${t.rents.map(r => `<td class="hl">${fmt(r * GAME.festivalMult)}</td>`).join('')}</tr>
      </table>
      <div class="m-row">
        <span>Sahip:</span>
        <select id="mOwner" class="inp">
          <option value="-1">Boş</option>
          ${state.players.map((p, i) => `<option value="${i}" ${pr && pr.owner === i ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
        <span>Seviye:</span>
        <select id="mLevel" class="inp">
          ${LEVEL_NAMES.map((n, l) => `<option value="${l}" ${pr && pr.level === l ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="m-row">
        <button class="btn" id="mFestival">${festival ? '🎪 Festivali Kaldır' : '🎪 Festival Yap'}</button>
        <button class="btn" id="mGoHere">📍 Beni Buraya Getir</button>
      </div>
      <div class="hint">Ev maliyeti: ${fmt(buildCost(t))} · Yatırım: ${fmt(tileInvested(t, pr ? pr.level : 0))}</div>`;
  } else {
    body += `<div class="m-row"><button class="btn" id="mGoHere">📍 Beni Buraya Getir</button></div>`;
  }

  const modal = $('#tileModal');
  $('#tileModalBody').innerHTML = body;
  modal.classList.remove('hidden');

  $('#mGoHere')?.addEventListener('click', () => {
    state.players[0].pos = id;
    save(); renderAll(); closeModal();
  });
  $('#mFestival')?.addEventListener('click', () => {
    if (state.festival.includes(id)) state.festival = state.festival.filter(f => f !== id);
    else { state.festival.push(id); state.festival = state.festival.slice(-3); }
    save(); renderAll(); openTileModal(id);
  });
  $('#mOwner')?.addEventListener('change', e => {
    const v = +e.target.value;
    if (v === -1) delete state.props[id];
    else state.props[id] = { owner: v, level: 0 };
    save(); renderAll(); openTileModal(id);
  });
  $('#mLevel')?.addEventListener('change', e => {
    if (!state.props[id]) state.props[id] = { owner: 0, level: 0 };
    state.props[id].level = +e.target.value;
    save(); renderAll(); openTileModal(id);
  });
}
function closeModal() { $('#tileModal').classList.add('hidden'); }
$('#tileModal').addEventListener('click', e => { if (e.target.id === 'tileModal') closeModal(); });

/* ---------------- SEKMELER / AKSİYONLAR ---------------- */
function initTabs() {
  $$('#tabs .tab').forEach(btn => btn.addEventListener('click', () => {
    $$('#tabs .tab').forEach(b => b.classList.remove('active'));
    $$('.tab-body').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('#tab-' + btn.dataset.tab).classList.add('active');
  }));
  $$('.heat-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.heat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.heatMode = btn.dataset.mode;
    save(); renderBoard();
  }));
  $('#btnFestival').addEventListener('click', () => {
    const cities = BOARD.filter(t => isPurchasable(t)).map(t => t.id);
    const pick = cities.sort(() => Math.random() - 0.5).slice(0, 3);
    state.festival = pick;
    save(); renderAll();
  });
  $('#btnReset').addEventListener('click', () => {
    if (confirm('Tüm durum sıfırlansın mı?')) {
      localStorage.removeItem(LS_KEY);
      location.reload();
    }
  });
  $('#btnSim').addEventListener('click', doSim);
  $('#minutesLeft').addEventListener('change', e => { state.minutesLeft = Math.max(0, +e.target.value || 0); save(); renderAll(); });
  $('#turnsLeft').addEventListener('change', e => { state.turnsLeft = Math.max(0, +e.target.value || 0); save(); renderAll(); });
}

/* ---------------- ANA ---------------- */
function renderAll() {
  renderBoard();
  renderPlayers();
  renderRecs();
  renderWin();
  if (state.players[0].pos === 20) doWorldTour();
  $('#minutesLeft').value = state.minutesLeft;
  $('#turnsLeft').value = state.turnsLeft;
}

document.addEventListener('DOMContentLoaded', () => {
  buildBoard();
  initTabs();
  renderMapEditor();
  $('#tileModal').classList.add('hidden');
  renderAll();
  if (state.players[0].pos === 20) doWorldTour();
});
