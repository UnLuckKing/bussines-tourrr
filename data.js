/* =========================================================================
   Business Tour — Analiz Merkezi · Oyun Verisi
   -------------------------------------------------------------------------
   Klasik 40 karelik tahta (saat yönünde). Köşeler: 0 Başlangıç, 10 Kayıp Ada,
   20 Dünya Turu, 30 Vergi Dairesi. Fiyat/kiralar topluluk verisiyle
   oluşturulmuş tahminlerdir — "Harita Düzenle" sekmesinden kendi
   oyunundaki gerçek değerlerle eşleştirebilirsin.
   ========================================================================= */

const GAME = {
  startMoney: 2000000,   // başlangıç parası
  startBonus: 300000,    // başlangıçtan her geçişte
  maxPlayers: 4,
  rerollCost: 3,         // zar tekrarı (çip)
  islandLeaveCost: 200000,
  worldTourCost: 50000,
  championshipCost: 50000,
  taxRate: 0.10,         // vergi dairesi: mülk değerinin %10'u
  festivalMult: 2.0,     // festival kentlerinde kira çarpanı
  houseCostRate: 0.28,   // ev maliyeti = fiyat × bu oran (seviye başına)
  defaultMinutes: 20,    // hızlı oyun
};

/* Kare tipleri:
   start | island | worldtour | tax | championship | chance | city | resort
   side: 1=üst, 2=sağ, 3=alt, 4=sol */
const BOARD = [
  { id: 0,  type: 'start',        name: 'BAŞLANGIÇ',            side: 1 },
  { id: 1,  type: 'city',   group: 'A', name: 'Granada',        price: 100000,  rents: [  8000,  18000,  35000,  60000,  95000 ],  side: 1 },
  { id: 2,  type: 'city',   group: 'A', name: 'Madrid',         price: 130000,  rents: [ 10400,  23400,  45500,  78000, 123500 ],  side: 1 },
  { id: 3,  type: 'city',   group: 'A', name: 'Barselona',      price: 160000,  rents: [ 12800,  28800,  56000,  96000, 152000 ],  side: 1 },
  { id: 4,  type: 'chance',            name: 'ŞANS',            side: 1 },
  { id: 5,  type: 'city',   group: 'B', name: 'Lyon',           price: 200000,  rents: [ 16000,  36000,  70000, 120000, 190000 ],  side: 1 },
  { id: 6,  type: 'city',   group: 'B', name: 'Marsilya',       price: 230000,  rents: [ 18400,  41400,  80500, 138000, 218500 ],  side: 1 },
  { id: 7,  type: 'city',   group: 'B', name: 'Paris',          price: 260000,  rents: [ 20800,  46800,  91000, 156000, 247000 ],  side: 1 },
  { id: 8,  type: 'chance',            name: 'ŞANS',            side: 1 },
  { id: 9,  type: 'city',   group: 'C', name: 'Şanghay',        price: 300000,  rents: [ 24000,  54000, 105000, 180000, 285000 ],  side: 1 },

  { id: 10, type: 'island',            name: 'KAYIP ADA',       side: 2 },
  { id: 11, type: 'city',   group: 'D', name: 'Hamburg',        price: 340000,  rents: [ 27200,  61200, 119000, 204000, 323000 ],  side: 2 },
  { id: 12, type: 'city',   group: 'D', name: 'Berlin',         price: 380000,  rents: [ 30400,  68400, 133000, 228000, 361000 ],  side: 2 },
  { id: 13, type: 'city',   group: 'D', name: 'Amsterdam',      price: 420000,  rents: [ 33600,  75600, 147000, 252000, 399000 ],  side: 2 },
  { id: 14, type: 'chance',            name: 'ŞANS',            side: 2 },
  { id: 15, type: 'city',   group: 'E', name: 'Viyana',         price: 460000,  rents: [ 36800,  82800, 161000, 276000, 437000 ],  side: 2 },
  { id: 16, type: 'city',   group: 'E', name: 'Zürih',          price: 500000,  rents: [ 40000,  90000, 175000, 300000, 475000 ],  side: 2 },
  { id: 17, type: 'city',   group: 'E', name: 'Moskova',        price: 540000,  rents: [ 43200,  97200, 189000, 324000, 513000 ],  side: 2 },
  { id: 18, type: 'championship',      name: 'ŞAMPİYONA',       side: 2 },
  { id: 19, type: 'resort',            name: 'Dubai',           price: 480000,  rents: [ 60000,  90000, 130000, 180000, 240000 ],  side: 2 },

  { id: 20, type: 'worldtour',         name: 'DÜNYA TURU',      side: 3 },
  { id: 21, type: 'city',   group: 'F', name: 'New York',       price: 600000,  rents: [ 48000, 108000, 210000, 360000, 570000 ],  side: 3 },
  { id: 22, type: 'city',   group: 'F', name: 'Londra',         price: 650000,  rents: [ 52000, 117000, 227500, 390000, 617500 ],  side: 3 },
  { id: 23, type: 'city',   group: 'F', name: 'Milano',         price: 700000,  rents: [ 56000, 126000, 245000, 420000, 665000 ],  side: 3 },
  { id: 24, type: 'chance',            name: 'ŞANS',            side: 3 },
  { id: 25, type: 'city',   group: 'G', name: 'Las Vegas',      price: 750000,  rents: [ 60000, 135000, 262500, 450000, 712500 ],  side: 3 },
  { id: 26, type: 'city',   group: 'G', name: 'Sidney',         price: 800000,  rents: [ 64000, 144000, 280000, 480000, 760000 ],  side: 3 },
  { id: 27, type: 'city',   group: 'G', name: 'Roma',           price: 850000,  rents: [ 68000, 153000, 297500, 510000, 807500 ],  side: 3 },
  { id: 28, type: 'resort',            name: 'Kıbrıs',          price: 480000,  rents: [ 60000,  90000, 130000, 180000, 240000 ],  side: 3 },
  { id: 29, type: 'resort',            name: 'Bali',            price: 480000,  rents: [ 60000,  90000, 130000, 180000, 240000 ],  side: 3 },

  { id: 30, type: 'tax',               name: 'VERGİ DAİRESİ',   side: 4 },
  { id: 31, type: 'city',   group: 'H', name: 'Kahire',         price: 900000,  rents: [ 72000, 162000, 315000, 540000, 855000 ],  side: 4 },
  { id: 32, type: 'city',   group: 'H', name: 'Mumbai',         price: 960000,  rents: [ 76800, 172800, 336000, 576000, 912000 ],  side: 4 },
  { id: 33, type: 'city',   group: 'H', name: 'Bangkok',        price: 1020000, rents: [ 81600, 183600, 357000, 612000, 969000 ], side: 4 },
  { id: 34, type: 'chance',            name: 'ŞANS',            side: 4 },
  { id: 35, type: 'city',   group: 'I', name: 'Osaka',          price: 1100000, rents: [ 88000, 198000, 385000, 660000, 1045000], side: 4 },
  { id: 36, type: 'city',   group: 'I', name: 'Tokyo',          price: 1200000, rents: [ 96000, 216000, 420000, 720000, 1140000], side: 4 },
  { id: 37, type: 'resort',            name: 'Nizza',           price: 480000,  rents: [ 60000,  90000, 130000, 180000, 240000 ],  side: 4 },
  { id: 38, type: 'chance',            name: 'ŞANS',            side: 4 },
  { id: 39, type: 'chance',            name: 'ŞANS',            side: 4 },
];

/* Grup → renk (tahta gösterimi) */
const GROUP_COLORS = {
  A: '#4caf50', B: '#8bc34a', C: '#cddc39',
  D: '#2196f3', E: '#3f51b5', F: '#9c27b0',
  G: '#e91e63', H: '#ff9800', I: '#f44336',
};

/* Tatil köyü id'leri */
const RESORTS = BOARD.filter(t => t.type === 'resort').map(t => t.id);

const fmt = n => {
  const a = Math.abs(n);
  const s = a >= 1000000
    ? (a / 1000000).toFixed(a % 1000000 === 0 ? 0 : 2) + 'M'
    : Math.round(a / 1000) + 'K';
  return (n < 0 ? '-' : '') + s;
};

/* Kare için ev maliyeti (seviye başına) */
function buildCost(tile) {
  return Math.round(tile.price * GAME.houseCostRate);
}

/* Seviye adı */
const LEVEL_NAMES = ['Arsa', '+1 Ev', '+2 Ev', '+3 Ev', 'Otel'];

/* Node testleri için */
if (typeof module !== 'undefined') module.exports = { GAME, BOARD, GROUP_COLORS, RESORTS, fmt, buildCost, LEVEL_NAMES };
