/* Business Tour Live desktop OCR bridge.
   Runs after app.js and updates only high-confidence fields. */
(() => {
  'use strict';

  const live = {
    lastText: '', lastAt: '', scans: 0, detected: [],
    money: null, tile: null, dice: null
  };

  const tr = s => (s || '').toLocaleLowerCase('tr-TR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/[^a-z0-9₺$€.,:+\-\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  function parseAmount(raw) {
    if (!raw) return null;
    let s = raw.trim().toUpperCase().replace(/\s/g, '');
    let mult = 1;
    if (s.endsWith('M')) { mult = 1_000_000; s = s.slice(0, -1); }
    else if (s.endsWith('K')) { mult = 1_000; s = s.slice(0, -1); }
    s = s.replace(/[₺$€]/g, '');
    if (mult > 1) s = s.replace(',', '.');
    else {
      const comma = (s.match(/,/g) || []).length, dot = (s.match(/\./g) || []).length;
      if (comma + dot > 1 || /[.,]\d{3}$/.test(s)) s = s.replace(/[.,]/g, '');
      else s = s.replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * mult) : null;
  }

  function detectMoney(text) {
    const lines = text.split(/\r?\n/).map(x => tr(x)).filter(Boolean);
    const patterns = [
      /(?:money|cash|para|balance|bakiye)\s*[:=]?\s*([₺$€]?\s*\d[\d.,]*\s*[mk]?)/i,
      /([₺$€]\s*\d[\d.,]*\s*[mk]?)/i
    ];
    for (const line of lines) {
      for (const re of patterns) {
        const m = line.match(re);
        if (!m) continue;
        const n = parseAmount(m[1]);
        if (n != null && n >= 0 && n <= 100_000_000) return n;
      }
    }
    return null;
  }

  function detectTile(text) {
    const nt = tr(text);
    const actionWords = ['satin al', 'buy', 'rent', 'kira', 'upgrade', 'gelistir', 'hotel', 'otel', 'festival', 'championship', 'sampiyona'];
    const hasAction = actionWords.some(x => nt.includes(x));
    if (!hasAction) return null; // board labels alone are too ambiguous

    let best = null;
    for (const t of BOARD) {
      const name = tr(t.name);
      const at = nt.lastIndexOf(name);
      if (at < 0) continue;
      let proximity = 99999;
      for (const w of actionWords) {
        const wi = nt.lastIndexOf(w);
        if (wi >= 0) proximity = Math.min(proximity, Math.abs(at - wi));
      }
      if (!best || proximity < best.proximity) best = { id: t.id, name: t.name, proximity };
    }
    return best && best.proximity < 160 ? best : null;
  }

  function detectDice(text) {
    const nt = tr(text);
    const m = nt.match(/(?:dice|zar)\s*[:=]?\s*(\d{1,2})/i);
    if (!m) return null;
    const n = +m[1];
    return n >= 2 && n <= 12 ? n : null;
  }

  function ensurePanel() {
    let el = document.getElementById('btLivePanel');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'btLivePanel';
    el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;width:min(430px,calc(100vw - 36px));background:#0c1428ee;border:1px solid #33466e;border-radius:14px;padding:12px;box-shadow:0 18px 55px #0009;color:#e7eefc;font:12px system-ui;backdrop-filter:blur(10px)';
    document.body.appendChild(el);
    return el;
  }

  function renderPanel() {
    const el = ensurePanel();
    const rec = typeof recommend === 'function' ? recommend(state, 0)[0] : null;
    const detected = live.detected.length ? live.detected.join(' · ') : 'OCR var, yüksek güvenli oyun verisi bekleniyor';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <b style="font-size:14px">👁 CANLI OCR</b><span style="color:#7dd3fc">${live.lastAt || '—'}</span>
      </div>
      <div style="margin-top:6px;color:#94a3b8">${detected}</div>
      <div style="margin-top:9px;padding:9px;border-radius:10px;background:#13203a">
        <div style="font-size:10px;color:#94a3b8">ŞU ANKİ ÖNERİ</div>
        <b style="font-size:14px">${rec ? rec.title : 'Durum bekleniyor'}</b>
        <div style="margin-top:2px;color:#cbd5e1">${rec ? rec.detail : ''}</div>
      </div>
      <details style="margin-top:8px"><summary style="cursor:pointer;color:#94a3b8">Son OCR metni</summary>
        <pre style="white-space:pre-wrap;max-height:150px;overflow:auto;color:#94a3b8">${escapeHtml(live.lastText.slice(0, 5000))}</pre>
      </details>`;
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  window.BTLive = {
    ingestOcr(payload) {
      const text = payload && payload.text || '';
      live.lastText = text;
      live.lastAt = new Date().toLocaleTimeString('tr-TR');
      live.scans++;
      live.detected = [];

      const money = detectMoney(text);
      if (money != null) {
        live.money = money;
        if (Math.abs((state.players[0].money || 0) - money) >= 1000) {
          state.players[0].money = money;
          live.detected.push(`Para ${fmt(money)}`);
        }
      }

      const tile = detectTile(text);
      if (tile) {
        live.tile = tile;
        if (state.players[0].pos !== tile.id) state.players[0].pos = tile.id;
        live.detected.push(`Konum ${tile.name}`);
      }

      const dice = detectDice(text);
      if (dice != null) {
        live.dice = dice;
        live.detected.push(`Zar ${dice}`);
      }

      try { save(); renderAll(); } catch (_) {}
      renderPanel();
    },
    snapshot: () => ({ ...live })
  };

  renderPanel();
})();
