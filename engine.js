/* =========================================================================
   Business Tour — Analiz Merkezi · Karar Motoru & Simülasyon
   Tüm hesaplar saf JS (DOM yok). Veri: data.js
   ========================================================================= */
if (typeof module !== 'undefined') Object.assign(global, require('./data.js'));

/* ---------- Zar olasılıkları (2 zar) ---------- */
const DICE = (() => {
  const dist = {};
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
    dist[a + b] = (dist[a + b] || 0) + 1;
  }
  const total = 36;
  const out = [];
  for (let s = 2; s <= 12; s++) out.push({ sum: s, p: dist[s] / total });
  return out;
})();

/* ---------- Yardımcılar ---------- */
const tileById = id => BOARD[id];
const isPurchasable = t => t.type === 'city' || t.type === 'resort';

function rentOf(tile, level, festival = false, champMult = 1) {
  if (!isPurchasable(tile)) return 0;
  const r = tile.rents[Math.max(0, Math.min(4, level | 0))] * (festival ? GAME.festivalMult : 1);
  return Math.round(r * champMult);
}

function tileInvested(tile, level) {
  return tile.price + buildCost(tile) * Math.max(0, level | 0);
}

function landscapeWorth(state, idx) {
  let total = 0;
  for (const t of BOARD) {
    if (!isPurchasable(t)) continue;
    const pr = state.props[t.id];
    if (pr && pr.owner === idx) total += tileInvested(t, pr.level);
  }
  return total;
}

/* Rakip pozisyonlarına göre bir kareye "gelecek tur başına" düşme olasılığı */
function landProbAt(tileId, state, horizons = 3) {
  let p = 0;
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i].bankrupt) continue;
    const pos = state.players[i].pos;
    const d = ((tileId - pos) % 40 + 40) % 40;
    for (const { sum, p: prob } of DICE) {
      if (sum === d) { p += prob / state.players.length; break; }
    }
  }
  // kaba çok-tur katkısı
  const extra = (horizons - 1) * 0.35;
  return Math.min(1, p * (1 + extra));
}

/* ---------- ROI / EV ---------- */
/* Bir karenin "yatırım getirisi": kira / yatırım (her gelişte ortalama) */
function roiOf(tile, level, festival = false, champMult = 1) {
  const inv = tileInvested(tile, level || 0);
  if (!inv) return 0;
  return rentOf(tile, level, festival, champMult) / inv;
}

/* Satın al + geliştirme kararının EV'i: gelecek N turda rakiplerin bu kareye
   gelme olasılığına göre beklenen kira geliri vs. yatırım */
function evOwnership(state, tileId, level, horizons = 6) {
  const tile = BOARD[tileId];
  const festival = state.festival.includes(tileId);
  const champMult = state.champ && state.champ.tileId === tileId ? state.champ.mult : 1;
  const pPerTurn = landProbAt(tileId, state, 1);
  const expRentPerTurn = pPerTurn * rentOf(tile, level, festival, champMult) * (state.players.length - 1) * 0.85;
  const income = expRentPerTurn * horizons;
  const cost = tileInvested(tile, level);
  return { income, cost, net: income - cost, pPerTurn, roi: rentOf(tile, level, festival, champMult) / cost };
}

/* ---------- Dünya Turu: en iyi hedef ---------- */
function worldTourBest(state, idx) {
  const me = state.players[idx];
  const results = [];
  for (const t of BOARD) {
    if (!isPurchasable(t)) continue;
    const pr = state.props[t.id];
    const festival = state.festival.includes(t.id);
    const champMult = state.champ && state.champ.tileId === t.id ? state.champ.mult : 1;
    if (!pr || pr.owner === idx) {
      // sahipsiz veya bana ait → yatırım EV'i (7 kare ilerideki iyi konum dikkate alınır)
      const cur = pr ? pr.level : 0;
      const nextLv = Math.min(4, cur + 1);
      const ev = evOwnership(state, t.id, nextLv, 7);
      const afford = ev.cost <= me.money;
      results.push({
        tileId: t.id, name: t.name, type: t.type, owner: pr ? pr.owner : -1,
        score: ev.net + (festival ? 40000 : 0) + (t.type === 'city' && t.group === 'I' ? 30000 : 0),
        evNet: ev.net, cost: ev.cost, rent: rentOf(t, nextLv, festival, champMult),
        roi: ev.roi, festival, afford, level: nextLv,
        reason: pr
          ? `Kendi mülkün → ${LEVEL_NAMES[nextLv]} dik (kira ${fmt(rentOf(t, nextLv, festival, champMult))})`
          : `Sahipsiz → satın al ve ${LEVEL_NAMES[nextLv]} dik`,
      });
    } else {
      // rakibe ait → "blok/tehlike" skoru düşük, atlanır
      results.push({ tileId: t.id, name: t.name, type: t.type, owner: pr.owner, score: -1e9, reason: 'Rakibe ait', evNet: 0, cost: 0, rent: 0, roi: 0 });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 10);
}

/* ---------- Kayıp Ada kararı ---------- */
function islandAdvice(state, idx) {
  const me = state.players[idx];
  if (me.jailTurns <= 0) return null;
  const cheap = me.money > 500000;
  const endgame = state.minutesLeft <= 3;
  const danger = dangerScore(state, idx);
  if (endgame) return { pay: false, text: 'Oyun bitiyor: adada kal. Hamle yapmamak = rakibin kiralarına düşmemek. (Süre bitiminde en zengin kazanır.)' };
  if (danger > 0.25) return { pay: false, text: `Tehlike skoru %${Math.round(danger * 100)}: adada kalmak seni korur. Çıkma, bekle.` };
  if (cheap) return { pay: true, text: `Paran ${fmt(me.money)} → ${fmt(GAME.islandLeaveCost)} öde ve çık. İlk turlar mülk almak için kritik.` };
  return { pay: false, text: `Paran ${fmt(me.money)}: ödemek riskli, çift zar bekle (3 deneme).` };
}

/* Rakip mülklerinin oyuncu için tehlikesi (0-1) */
function dangerScore(state, idx) {
  const me = state.players[idx];
  let score = 0;
  for (const t of BOARD) {
    if (!isPurchasable(t)) continue;
    const pr = state.props[t.id];
    if (!pr || pr.owner === idx) continue;
    const d = ((t.id - me.pos) % 40 + 40) % 40;
    const hit = DICE.find(x => x.sum === d);
    if (hit) {
      const festival = state.festival.includes(t.id);
      const champMult = state.champ && state.champ.tileId === t.id ? state.champ.mult : 1;
      score += hit.p * rentOf(t, pr.level, festival, champMult) / 300000;
    }
  }
  return Math.min(1, score);
}

/* ---------- Anlık öneri listesi ---------- */
function recommend(state, idx) {
  const me = state.players[idx];
  const recs = [];
  const tile = BOARD[me.pos];

  /* 1) Üzerinde olduğun kare: satın al / geliştir? */
  if (isPurchasable(tile)) {
    const pr = state.props[tile.id];
    const festival = state.festival.includes(tile.id);
    const champMult = state.champ && state.champ.tileId === tile.id ? state.champ.mult : 1;
    if (!pr || pr.owner === idx) {
      const cur = pr ? pr.level : 0;
      const nextLv = Math.min(4, cur + 1);
      const cost = tileInvested(tile, nextLv) - (pr ? tileInvested(tile, cur) : 0);
      const ev = evOwnership(state, tile.id, nextLv, 6);
      const rentNow = rentOf(tile, nextLv, festival, champMult);
      const priority = (tile.group && (tile.group === 'I' || tile.group === 'H' || tile.group === 'G'))
        ? 'YÜKSEK' : (festival ? 'YÜKSEK' : (cur === 0 && tile.price < 500000 ? 'DÜŞÜK' : 'ORTA'));
      recs.push({
        action: 'buy', tileId: tile.id, priority,
        title: pr
          ? `${tile.name} → ${LEVEL_NAMES[nextLv]} dik`
          : `${tile.name} satın al (${fmt(tile.price)})`,
        detail: `Maliyet ${fmt(cost)} · kira ${fmt(rentNow)}${festival ? ' (FESTİVAL ×2!)' : ''} · beklenen net ${fmt(ev.net)} (6 tur)`,
        score: ev.net + (festival ? 60000 : 0) + (tile.price >= 600000 ? 40000 : tile.price >= 300000 ? 15000 : -20000),
        afford: cost <= me.money,
      });
    } else {
      recs.push({
        action: 'pay-rent-warning', tileId: tile.id, priority: 'UYARI',
        title: `DİKKAT: ${tile.name} rakibin (${state.players[pr.owner].name})`,
        detail: `Seviye ${pr.level} · ödemen gereken kira ${fmt(rentOf(tile, pr.level, festival, champMult))}${festival ? ' (FESTİVAL!)' : ''}`,
        score: -1e6, afford: me.money >= rentOf(tile, pr.level, festival, champMult),
      });
    }
  }

  /* 2) Dünya Turu'ndaysan en iyi hedef */
  if (tile.type === 'worldtour') {
    const wb = worldTourBest(state, idx)[0];
    if (wb && wb.owner !== idx && wb.owner !== -1) {
      // en iyi sonuç rakibin mülkü olursa ilk uygunu al
      const alt = worldTourBest(state, idx).find(x => x.owner === -1 || x.owner === idx);
      if (alt) recs.push({
        action: 'worldtour', tileId: alt.tileId, priority: 'KRİTİK',
        title: `DÜNYA TURU → ${alt.name}`, detail: alt.reason,
        score: 1e9, afford: me.money >= GAME.worldTourCost,
      });
    } else if (wb) recs.push({
      action: 'worldtour', tileId: wb.tileId, priority: 'KRİTİK',
      title: `DÜNYA TURU → ${wb.name}`, detail: wb.reason,
      score: 1e9, afford: me.money >= GAME.worldTourCost,
    });
  }

  /* 3) Kayıp Ada */
  if (tile.type === 'island' && me.jailTurns > 0) {
    const ia = islandAdvice(state, idx);
    recs.push({
      action: 'island', tileId: 10, priority: 'BİLGİ',
      title: ia.pay ? 'Kayıp Ada → çık' : 'Kayıp Ada → kal', detail: ia.text,
      score: 0, afford: true,
    });
  }

  /* 4) Genel strateji uyarıları */
  const worth = landscapeWorth(state, idx);
  if (me.money < 0.08 * worth) {
    recs.push({
      action: 'caution', priority: 'UYARI', title: 'Likit para riski',
      detail: `Mülk değerin ${fmt(worth)}, paran ${fmt(me.money)}. Vergi dairesi (%10=${fmt(worth * GAME.taxRate)}) seni iflasa sürükleyebilir. Nakit biriktir.`,
      score: -500000, afford: true,
    });
  }
  if (worth > 0 && state.minutesLeft <= 2) {
    recs.push({
      action: 'endgame', priority: 'BİLGİ', title: 'Son tur stratejisi',
      detail: 'Süre bitiminde en yüksek mülk değeri kazanır: kalan paranı yüksek ROI\'li mülklere yatır, adada kal, riskli zar atma.',
      score: 300000, afford: true,
    });
  }
  const threat = winThreat(state, idx);
  if (threat) recs.push({
    action: 'block', priority: 'ACİL', title: `BLOKLA: ${threat.name} kazanmaya yakın!`,
    detail: threat.text, score: 1e8, afford: true,
  });

  /* 5) Genel durum (her zaman görünür) */
  const bestAhead = BOARD
    .filter(t => isPurchasable(t) && !state.props[t.id])
    .map(t => {
      const d = ((t.id - me.pos) % 40 + 40) % 40;
      return { t, d };
    })
    .filter(x => x.d <= 12)
    .sort((a, b) =>
      (b.t.price * 0.9 + (state.festival.includes(b.t.id) ? 600000 : 0)) -
      (a.t.price * 0.9 + (state.festival.includes(a.t.id) ? 600000 : 0)))[0];
  const festivalAhead = state.festival
    .map(id => ({ id, d: ((id - me.pos) % 40 + 40) % 40 }))
    .filter(f => f.d > 0 && f.d <= 12)[0];
  recs.push({
    action: 'info', priority: 'BİLGİ', title: `📡 Durum: para ${fmt(me.money)} · mülk ${fmt(worth)}`,
    detail: bestAhead
      ? `${bestAhead.d} kare ileride ${bestAhead.t.name} (${fmt(bestAhead.t.price)})${state.festival.includes(bestAhead.t.id) ? ' 🎪FESTİVAL' : ''}${festivalAhead ? ` · ${festivalAhead.d} kare ileride festival: ${BOARD[festivalAhead.id].name}` : ''} — hazırlıklı ol.`
      : 'Harita temiz — stratejik alımlara devam.',
    score: -1, afford: true,
  });

  const myWin = winProgress(state, idx);
  recs.push({
    action: 'info', priority: 'BİLGİ',
    title: `🏁 Kazanma takibi: ${myWin.completeGroups} grup tam · ${myWin.resorts}/4 köy · ${myWin.completeSides} kenar tam`,
    detail: 'Üçüncü grup veya 4. köy seni anında kazandırır — öncelikli hedefin olsun.',
    score: -2, afford: true,
  });

  recs.sort((a, b) => b.score - a.score);
  return recs;
}

/* ---------- Kazanma takibi ---------- */
const SIDE_NAMES = { 1: '1. Kenar', 2: '2. Kenar', 3: '3. Kenar', 4: '4. Kenar' };

function winProgress(state, idx) {
  const own = {};
  for (const t of BOARD) {
    if (!isPurchasable(t)) continue;
    const pr = state.props[t.id];
    own[t.id] = pr && pr.owner === idx;
  }
  const sides = {};
  for (const t of BOARD) {
    if (!isPurchasable(t)) continue;
    sides[t.side] = sides[t.side] || { own: 0, total: 0 };
    sides[t.side].total++;
    if (own[t.id]) sides[t.side].own++;
  }
  const groups = {};
  for (const t of BOARD) {
    if (t.type !== 'city') continue;
    groups[t.group] = groups[t.group] || { own: 0, total: 0, name: [] };
    groups[t.group].total++;
    groups[t.group].name.push(t.name);
    if (own[t.id]) groups[t.group].own++;
  }
  const resorts = RESORTS.filter(id => own[id]).length;
  const completeGroups = Object.values(groups).filter(g => g.own === g.total).length;
  const completeSides = Object.values(sides).filter(s => s.own === s.total).length;
  return { sides, groups, resorts, completeGroups, completeSides };
}

/* Rakip tehdidi: kazanmaya kaç kare kalmış */
function winThreat(state, idx) {
  const me = state.players[idx];
  for (let i = 0; i < state.players.length; i++) {
    if (i === idx || state.players[i].bankrupt) continue;
    const wp = winProgress(state, i);
    if (wp.resorts === 3) return { name: state.players[i].name, text: `${state.players[i].name} 3 tatil köyüne sahip — sonuncuyu (${RESORTS.filter(id => !state.props[id] || state.props[id].owner !== i).map(id => BOARD[id].name).join(', ')}) kap veya blokla!` };
    if (wp.completeGroups === 2) return { name: state.players[i].name, text: `${state.players[i].name} 2 grup tamamlamış — üçüncü gruba 1 kare kaldıysa o kareyi satın al!` };
    for (const s of Object.values(wp.sides)) if (s.own === s.total - 1) return { name: state.players[i].name, text: `${state.players[i].name} bir kenarı tamamlamak üzere (${s.own}/${s.total}) — eksik kareyi al!` };
  }
  return null;
}

/* ---------- MONTE CARLO ---------- */
function blankState() {
  const s = {
    players: [],
    props: {},
    festival: [],
    champ: null,
    minutesLeft: 20,
  };
  for (let i = 0; i < 4; i++) {
    s.players.push({ name: 'P' + (i + 1), money: GAME.startMoney, pos: 0, jailTurns: 0, bankrupt: false, isYou: i === 0 });
  }
  return s;
}

function roll() {
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  return { sum: a + b, isDouble: a === b };
}

/* Oyuncu için basit "iyi" politika */
function policyBuy(state, idx, tile, strict = false) {
  if (!isPurchasable(tile)) return false;
  const pr = state.props[tile.id];
  const festival = state.festival.includes(tile.id);
  const mine = pr && pr.owner === idx;
  if (pr && !mine) return false;
  const cur = mine ? pr.level : 0;
  const cost = tileInvested(tile, Math.min(4, cur + 1)) - (mine ? tileInvested(tile, cur) : 0);
  if (cost > state.players[idx].money) return false;
  if (mine) return cur < 4 && (cur < 2 || tile.price >= 500000 || festival);
  if (tile.type === 'resort') return festival || Math.random() < 0.3;
  // sahipsiz
  if (strict) return tile.price >= 500000 || festival || tile.group === 'C';
  return true;
}

function policyWorldTour(state, idx) {
  const wb = worldTourBest(state, idx).find(x => x.owner === -1 || x.owner === idx);
  return wb ? wb.tileId : null;
}

function simulateOne(state0, turns, youIdx) {
  const st = JSON.parse(JSON.stringify(state0));
  const T = 40;
  for (let p of st.players) { p.bankrupt = false; p.jailTurns = Math.min(1, p.jailTurns || 0); }

  const chanceEffect = () => {
    const r = Math.random();
    if (r < 0.25) return { type: 'money', v: 25000 };
    if (r < 0.45) return { type: 'money', v: -50000 };
    if (r < 0.6) return { type: 'jail' };
    if (r < 0.75) return { type: 'tax' };
    return { type: 'none' };
  };

  for (let t = 0; t < turns; t++) {
    for (let i = 0; i < st.players.length; i++) {
      const p = st.players[i];
      if (p.bankrupt) continue;
      const isYou = i === youIdx;

      if (p.jailTurns > 0) {
        p.jailTurns--;
        if (p.jailTurns === 0) { /* çıktı */ }
        continue;
      }

      const r = roll();
      // 3 çift → kayıp ada
      p.pos = (p.pos + r.sum) % T;

      // Başlangıçtan geçiş
      const crossedStart = (p.pos < r.sum);
      if (crossedStart) p.money += GAME.startBonus;

      const tile = BOARD[p.pos];

      if (tile.type === 'chance') {
        const c = chanceEffect();
        if (c.type === 'money') p.money += c.v;
        else if (c.type === 'jail') p.jailTurns = 2;
        else if (c.type === 'tax') p.money -= Math.round(landscapeWorth(st, i) * GAME.taxRate * 0.5);
      } else if (tile.type === 'island') {
        // adaya yeni düşüldü → çık ya da 3 tur bekle
        const pay = p.money > 600000 && (isYou || Math.random() < 0.4);
        if (pay && p.money >= GAME.islandLeaveCost) p.money -= GAME.islandLeaveCost;
        else p.jailTurns = 3;
      } else if (tile.type === 'tax') {
        const tax = Math.round(landscapeWorth(st, i) * GAME.taxRate);
        p.money -= tax;
      } else if (tile.type === 'worldtour') {
        if (p.money >= GAME.worldTourCost) {
          const target = policyWorldTour(st, i);
          if (target != null) {
            p.money -= GAME.worldTourCost;
            p.pos = target;
            // hedefte hemen karar
            const tt = BOARD[target];
            if (isPurchasable(tt) && policyBuy(st, i, tt, !isYou)) {
              const pr = st.props[target];
              const cur = pr && pr.owner === i ? pr.level : 0;
              st.props[target] = { owner: i, level: Math.min(4, cur + 1) };
            }
            continue;
          }
        }
      } else if (tile.type === 'championship') {
        // kendi en iyi mülküne şampiyona
        let best = null, bestVal = -1;
        for (const tt of BOARD) {
          const pr = st.props[tt.id];
          if (pr && pr.owner === i && isPurchasable(tt)) {
            const v = rentOf(tt, pr.level);
            if (v > bestVal) { bestVal = v; best = tt.id; }
          }
        }
        if (best != null && p.money >= GAME.championshipCost) {
          p.money -= GAME.championshipCost;
          st.champ = { tileId: best, mult: 2 };
        }
      } else if (isPurchasable(tile)) {
        const pr = st.props[tile.id];
        if (pr && pr.owner !== i) {
          const festival = st.festival.includes(tile.id);
          const champMult = st.champ && st.champ.tileId === tile.id ? st.champ.mult : 1;
          const rent = rentOf(tile, pr.level, festival, champMult);
          p.money -= rent;
          st.players[pr.owner].money += rent;
          if (p.money < 0) { p.bankrupt = true; continue; }
        } else if (policyBuy(st, i, tile, !isYou)) {
          const cur = pr && pr.owner === i ? pr.level : 0;
          const cost = tileInvested(tile, Math.min(4, cur + 1)) - (pr && pr.owner === i ? tileInvested(tile, cur) : 0);
          if (cost <= p.money) {
            p.money -= cost;
            st.props[tile.id] = { owner: i, level: Math.min(4, cur + 1) };
          }
        }
      }

      if (p.money < 0) { p.bankrupt = true; continue; }

      // çift zar → tekrar at (basit: %30 ek tur)
      if (r.isDouble && Math.random() < 0.3) {
        const r2 = roll();
        p.pos = (p.pos + r2.sum) % T;
        if (p.pos < r2.sum) p.money += GAME.startBonus;
      }
    }
    // iflas zinciri kontrol
    const alive = st.players.filter(p => !p.bankrupt);
    if (alive.length <= 1) break;
  }

  // skor: para + mülk değeri
  return st.players.map((p, i) => {
    if (p.bankrupt) return -1e12;
    return p.money + landscapeWorth(st, i);
  });
}

function monteCarlo(state0, iterations = 1500, turns = 50) {
  const counts = new Array(state0.players.length).fill(0);
  const totals = new Array(state0.players.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    const scores = simulateOne(state0, turns, 0);
    let best = -Infinity, bi = -1;
    scores.forEach((s, i) => { if (s > best) { best = s; bi = i; } });
    counts[bi]++;
    scores.forEach((s, i) => totals[i] += Math.max(0, s));
  }
  return {
    winProb: counts.map(c => c / iterations),
    avgWealth: totals.map(t => t / iterations),
    iterations,
  };
}

/* ---------- Modül dışa aktarımı (node testleri için) ---------- */
if (typeof module !== 'undefined') module.exports = { GAME, BOARD, GROUP_COLORS, RESORTS, fmt, buildCost, LEVEL_NAMES, DICE, rentOf, tileInvested, landscapeWorth, landProbAt, roiOf, evOwnership, worldTourBest, islandAdvice, dangerScore, recommend, winProgress, winThreat, blankState, monteCarlo };
