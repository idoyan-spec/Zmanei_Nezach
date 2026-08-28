/* לוח שבת לזכרם — כלי אישי ליצירת לוח זמני שבת לזכר יקיריכם */
'use strict';

const BUILD = '2026-08-28 12:30 v1 builder-mvp';

const W = 1254, H = 1254;
const SETTINGS_KEY = 'memorialBoard.v1';

/* ---------- templates ----------
 * Each template is a text-free background image plus the palette the code
 * draws with on top of it. `cream` is the paper tone the readability
 * lozenges fade toward, so it must match the template's paper. */
const TEMPLATES = {
  classic: {
    label: 'קלאסי', file: 'templates/classic.jpg',
    ink: '#1e2d55', gold: '#b98a44', cream: '246,240,226', plaque: '#2f425a'
  },
  olive: {
    label: 'ענף זית', file: 'templates/olive.jpg',
    ink: '#2f4a33', gold: '#a08b3f', cream: '247,243,232', plaque: '#3c523f'
  },
  jerusalem: {
    label: 'ירושלים', file: 'templates/jerusalem.jpg',
    ink: '#5a4326', gold: '#b08d4f', cream: '245,237,221', plaque: '#5a4326'
  },
  night: {
    label: 'שמי לילה', file: 'templates/night.jpg',
    ink: '#17203d', gold: '#b98a44', cream: '243,239,229', plaque: '#1f2a4a',
    /* the title zone sits on the dark night sky, so it needs light ink */
    titleInk: '#f2e9c9', titleShadow: 'rgba(10,16,38,0.55)'
  }
};

/* ---------- cities ----------
 * Candle-lighting customs: Jerusalem 40 min before sunset, Haifa 30,
 * everywhere else 18. Havdalah: tzeit hakochavim (Hebcal M=on). */
const CITIES = [
  { key: 'jerusalem', name: 'ירושלים',   lat: 31.7683, lng: 35.2137,  tzid: 'Asia/Jerusalem',      candles: 40, israel: true },
  { key: 'telaviv',   name: 'תל אביב',   lat: 32.0853, lng: 34.7818,  tzid: 'Asia/Jerusalem',      candles: 18, israel: true },
  { key: 'haifa',     name: 'חיפה',      lat: 32.7940, lng: 34.9896,  tzid: 'Asia/Jerusalem',      candles: 30, israel: true },
  { key: 'beersheva', name: 'באר שבע',   lat: 31.2530, lng: 34.7915,  tzid: 'Asia/Jerusalem',      candles: 18, israel: true },
  { key: 'ashdod',    name: 'אשדוד',     lat: 31.8014, lng: 34.6435,  tzid: 'Asia/Jerusalem',      candles: 18, israel: true },
  { key: 'netanya',   name: 'נתניה',     lat: 32.3215, lng: 34.8532,  tzid: 'Asia/Jerusalem',      candles: 18, israel: true },
  { key: 'tzfat',     name: 'צפת',       lat: 32.9646, lng: 35.4960,  tzid: 'Asia/Jerusalem',      candles: 18, israel: true },
  { key: 'eilat',     name: 'אילת',      lat: 29.5581, lng: 34.9482,  tzid: 'Asia/Jerusalem',      candles: 18, israel: true },
  { key: 'modiin',    name: 'מודיעין',   lat: 31.8928, lng: 35.0153,  tzid: 'Asia/Jerusalem',      candles: 18, israel: true },
  { key: 'ariel',     name: 'שומרון',    lat: 32.1046, lng: 35.1745,  tzid: 'Asia/Jerusalem',      candles: 18, israel: true },
  { key: 'katzrin',   name: 'רמת הגולן', lat: 32.9925, lng: 35.6899,  tzid: 'Asia/Jerusalem',      candles: 18, israel: true },
  { key: 'london',    name: 'לונדון',    lat: 51.5074, lng: -0.1278,  tzid: 'Europe/London',       candles: 18, israel: false },
  { key: 'newyork',   name: 'ניו יורק',  lat: 40.7128, lng: -74.0060, tzid: 'America/New_York',    candles: 18, israel: false },
  { key: 'paris',     name: 'פריז',      lat: 48.8566, lng: 2.3522,   tzid: 'Europe/Paris',        candles: 18, israel: false },
  { key: 'la',        name: 'לוס אנג׳לס', lat: 34.0522, lng: -118.2437, tzid: 'America/Los_Angeles', candles: 18, israel: false }
];
const MAX_CITIES = 8;

const DEDICATIONS = ['לעילוי נשמת', 'לזכר', 'לזכרו של', 'לזכרה של'];
const VERSES = [
  '', 'נר ה׳ נשמת אדם', 'יהי זכרו ברוך', 'יהי זכרה ברוך',
  'תהא נשמתו צרורה בצרור החיים', 'תהא נשמתה צרורה בצרור החיים',
  '__custom__'
];

/* Font stacks (same faces as the original Yair board, all OFL). */
const F_TITLE = '"TitleAlt", FrankRuhl, serif';
const F_BODY  = '"BodyAlt", FrankRuhl, serif';
const F_HEAD  = '"TitleAlt", FrankRuhl, serif';

const S_TITLE = 104, S_SUB = 48, S_HEAD = 52, S_NAME = 38, S_TIME = 42;
const W_TITLE = '700', W_SUB = '400', W_HEAD = '700', W_NAME = '400', W_TIME = '400';

/* ---------- state ---------- */

let settings = null;
let bgImage = null;      // loaded template image
let bgFile = '';         // which template file bgImage holds
let photoImage = null;   // loaded user photo
let lastFilename = 'zmanei-shabbat.png';

const $ = id => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const canShareFiles = !!(navigator.canShare &&
  navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }));

/* ---------- settings ---------- */

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.name || !s.cities || !s.cities.length || !TEMPLATES[s.template]) return null;
    return s;
  } catch (e) { return null; }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/* ---------- helpers ---------- */

function setStatus(msg, isErr) {
  $('status').textContent = msg;
  $('status').className = isErr ? 'err' : '';
}

function pad(n) { return String(n).padStart(2, '0'); }
function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function dayOf(itemDate) { return String(itemDate).substring(0, 10); }
function timeOf(itemDate) { return String(itemDate).substring(11, 16); }
function stripNikud(s) { return (s || '').replace(/[֑-ׇ]/g, ''); }

function fitFont(text, weight, family, maxSize, maxWidth) {
  let size = maxSize;
  do {
    ctx.font = weight + ' ' + size + 'px ' + family;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 18);
  return size;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED: ' + src.substring(0, 60)));
    img.src = src;
  });
}

/* ---------- Hebcal data (source: hebcal.com — see sources modal) ---------- */

async function fetchCityCal(city, startISO, endISO) {
  const p = new URLSearchParams({
    v: '1', cfg: 'json', c: 'on', M: 'on',
    b: city.candles, latitude: city.lat, longitude: city.lng, tzid: city.tzid,
    lg: 'he', start: startISO, end: endISO,
    maj: 'on', min: 'on', mf: 'on', ss: 'on', s: 'on', mod: 'off', nx: 'off'
  });
  if (city.israel) p.set('i', 'on');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch('https://www.hebcal.com/hebcal?' + p.toString(), { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/* Decide what the board shows (fast / chag / kippur / shabbat) — same logic
 * as the original Yair board, verified against Hebcal for shabbat, Rosh
 * Hashana, Tisha B'Av and Yom Kippur. */
function analyze(items, chosenISO) {
  const sorted = items.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const candles = sorted.filter(i => i.category === 'candles');
  const havdalot = sorted.filter(i => i.category === 'havdalah');
  const fastBegins = sorted.filter(i => i.title_orig === 'Fast begins');
  const fastEnds = sorted.filter(i => i.title_orig === 'Fast ends');
  const holidays = sorted.filter(i => i.category === 'holiday');

  const fastNameOn = day =>
    stripNikud((holidays.find(i => dayOf(i.date) === day && !stripNikud(i.hebrew).startsWith('ערב')) || {}).hebrew || 'תענית');
  if (fastEnds.some(f => dayOf(f.date) === chosenISO)) {
    return { mode: 'fast', name: fastNameOn(chosenISO), entryDay: null, exitDay: chosenISO };
  }
  const evFast = fastBegins.find(f => dayOf(f.date) === chosenISO && timeOf(f.date) > '12:00');
  if (evFast) {
    const fe = fastEnds.find(f => dayOf(f.date) > chosenISO);
    const exitDay = fe ? dayOf(fe.date) : chosenISO;
    return { mode: 'fast', name: fastNameOn(exitDay), entryDay: null, exitDay };
  }

  const endEv = havdalot.find(h => dayOf(h.date) >= chosenISO);
  if (endEv) {
    const endDay = dayOf(endEv.date);
    const prevHav = havdalot.filter(h => dayOf(h.date) < endDay).pop();
    const runStart = candles.filter(c =>
      dayOf(c.date) < endDay && (!prevHav || String(c.date) > String(prevHav.date)));
    if (runStart.length) {
      const startDay = dayOf(runStart[0].date);
      const contains = startDay <= chosenISO && chosenISO <= endDay;
      /* Major holidays only: candle/havdalah blocks exist only for shabbat
       * and real yom tov, but minor items (e.g. Leil Selichot) can land
       * inside a plain shabbat block and must not turn it into a "chag". */
      const chagNames = holidays.filter(i =>
        i.subcat === 'major' &&
        !stripNikud(i.hebrew).startsWith('ערב') &&
        dayOf(i.date) > startDay && dayOf(i.date) <= endDay)
        .map(i => stripNikud(i.hebrew).replace(/\s+\d+$/, '').replace(/\s+[אב]׳$/, ''));
      const uniq = [...new Set(chagNames)];
      if (contains && uniq.length) {
        return {
          mode: uniq.some(n => n.includes('יום כפור') || n.includes('יום כיפור')) ? 'kippur' : 'chag',
          name: uniq.join(' · '),
          entryDay: startDay,
          exitDay: endDay
        };
      }
    }
  }

  const d = new Date(chosenISO + 'T12:00:00');
  const day = d.getDay();
  const friday = addDays(d, day === 6 ? -1 : (5 - day + 7) % 7);
  const friISO = isoOf(friday), satISO = isoOf(addDays(friday, 1));

  let parasha = '', special = '', other = '';
  for (const it of sorted) {
    const heb = stripNikud(it.hebrew || '');
    if (it.category === 'parashat' && dayOf(it.date) === satISO) parasha = heb.replace(/^פרשת\s*/, '');
    if (it.category === 'holiday' && dayOf(it.date) === satISO) {
      if (heb.startsWith('שבת') && !special) special = heb;
      else if (!other) other = heb;
    }
  }
  let name = parasha;
  if (parasha && special) name = parasha + ' - ' + special;
  else if (!parasha) name = special || other || '';

  return { mode: 'shabbat', name, entryDay: friISO, exitDay: satISO };
}

function cityTimes(items, plan) {
  let entry = '—', exit = '—';
  for (const it of items) {
    const d = dayOf(it.date);
    if (plan.mode === 'fast') {
      if (it.title_orig === 'Fast begins' && d <= plan.exitDay) entry = timeOf(it.date);
      if (it.title_orig === 'Fast ends' && d === plan.exitDay && exit === '—') exit = timeOf(it.date);
    } else {
      if (it.category === 'candles' && d === plan.entryDay) entry = timeOf(it.date);
      if (it.category === 'havdalah' && d === plan.exitDay) exit = timeOf(it.date);
    }
  }
  return { entry, exit };
}

const LABELS = {
  shabbat: { title: 'זמני כניסת ויציאת שבת', right: 'כניסת שבת', left: 'יציאת שבת', prefix: 'שבת' },
  chag:    { title: 'זמני כניסת ויציאת החג', right: 'כניסת החג', left: 'יציאת החג', prefix: 'חג' },
  kippur:  { title: 'זמני כניסת ויציאת הצום', right: 'כניסת הצום', left: 'יציאת הצום', prefix: 'יום-כיפור' },
  fast:    { title: 'זמני תחילת וסיום הצום', right: 'תחילת הצום', left: 'סיום הצום', prefix: 'צום' }
};

/* ---------- drawing ---------- */

function tpl() { return TEMPLATES[settings.template] || TEMPLATES.classic; }

function diamond(x, y, r, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTitle(title, subtitle) {
  const T = tpl();
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = T.titleInk || T.ink;
  const size = fitFont(title, W_TITLE, F_TITLE, S_TITLE, W - 200);
  ctx.font = W_TITLE + ' ' + size + 'px ' + F_TITLE;
  ctx.shadowColor = T.titleShadow || 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fillText(title, W / 2, 158);
  ctx.shadowColor = 'transparent';

  if (subtitle) {
    const sSize = fitFont(subtitle, W_SUB, F_TITLE, S_SUB, W - 500);
    ctx.font = W_SUB + ' ' + sSize + 'px ' + F_TITLE;
    ctx.fillText(subtitle, W / 2, 235);
    const w = ctx.measureText(subtitle).width;
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 2;
    const y = 222;
    [[W / 2 - w / 2 - 30, -1], [W / 2 + w / 2 + 30, 1]].forEach(([x0, dir]) => {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + dir * 70, y);
      ctx.stroke();
      diamond(x0 + dir * 82, y, 6, T.gold);
    });
  }
  ctx.restore();
}

// Column headers are always drawn by code (the templates are text-free).
function drawHeaders(rightLabel, leftLabel) {
  const T = tpl();
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // adaptive backdrop first — invisible on clean paper, covers busy art
  const SLICES = 14;
  [[1020], [240]].forEach(([cx]) => {
    const box = { x: cx - 190, y: 352, w: 380, h: 84 };
    const lums = sliceLum(box.x, box.y, box.w, box.h, SLICES);
    box.alphas = lums.map((_, k) =>
      lumToAlpha(Math.min(lums[k], lums[Math.max(0, k - 1)], lums[Math.min(SLICES - 1, k + 1)])));
    lozenge(box);
  });
  [[1020, rightLabel], [240, leftLabel]].forEach(([cx, label]) => {
    const size = fitFont(label, W_HEAD, F_HEAD, S_HEAD, 350);
    ctx.font = W_HEAD + ' ' + size + 'px ' + F_HEAD;
    ctx.fillStyle = T.ink;
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillText(label, cx, 408);
    ctx.shadowColor = 'transparent';
    const w = ctx.measureText(label).width;
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, 428);
    ctx.lineTo(cx + w / 2, 428);
    ctx.stroke();
    diamond(cx, 428, 5, T.gold);
  });
  ctx.restore();
}

/* Feathered photo in the center — cover-fit into a fixed frame, then faded
 * out toward an ellipse edge so it melts into the template paper. */
function drawPhoto() {
  if (!photoImage) return;
  const frame = { x: 297, y: 300, w: 660, h: 790 };
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');

  const scale = Math.max(frame.w / photoImage.width, frame.h / photoImage.height);
  const dw = photoImage.width * scale, dh = photoImage.height * scale;
  const offY = (settings.photoOffset != null ? settings.photoOffset : 25) / 100;
  const sx = frame.x + (frame.w - dw) / 2;
  const sy = frame.y - (dh - frame.h) * offY;
  octx.save();
  octx.beginPath();
  octx.rect(frame.x, frame.y, frame.w, frame.h);
  octx.clip();
  octx.drawImage(photoImage, sx, sy, dw, dh);
  octx.restore();

  // ellipse fade mask
  const cx = frame.x + frame.w / 2, cy = frame.y + frame.h / 2;
  const rx = frame.w / 2, ry = frame.h / 2;
  octx.globalCompositeOperation = 'destination-in';
  octx.save();
  octx.translate(cx, cy);
  octx.scale(1, ry / rx);
  const g = octx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.62, 'rgba(0,0,0,1)');
  g.addColorStop(0.88, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  octx.fillStyle = g;
  octx.beginPath();
  octx.arc(0, 0, rx, 0, Math.PI * 2);
  octx.fill();
  octx.restore();

  ctx.drawImage(off, 0, 0);
}

function roundRectPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* Memorial plaque at the bottom, fully code-drawn: navy shield with a gold
 * double border, a small candle tab on top, and the dedication lines. */
function drawPlaque() {
  const T = tpl();
  const px = 235, pw = 784, py = 1078, ph = 158;
  ctx.save();

  // candle tab
  const tabW = 150, tabH = 44, tabX = W / 2 - tabW / 2, tabY = py - tabH + 12;
  roundRectPath(ctx, tabX, tabY, tabW, tabH, 16);
  ctx.fillStyle = T.plaque;
  ctx.fill();
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // main plate
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  roundRectPath(ctx, px, py, pw, ph, 20);
  ctx.fillStyle = T.plaque;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 3;
  ctx.stroke();
  roundRectPath(ctx, px + 7, py + 7, pw - 14, ph - 14, 14);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // candle
  const ccx = W / 2, cby = tabY + tabH - 8;
  ctx.fillStyle = '#f2ead8';
  ctx.fillRect(ccx - 4, cby - 18, 8, 18);
  const fg = ctx.createRadialGradient(ccx, cby - 24, 1, ccx, cby - 24, 9);
  fg.addColorStop(0, '#fff3c4');
  fg.addColorStop(0.55, '#f0b643');
  fg.addColorStop(1, 'rgba(240,182,67,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(ccx, cby - 24, 9, 0, Math.PI * 2);
  ctx.fill();

  // texts
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const line1 = (settings.dedication + ' ' + settings.name).trim();
  const line2 = [settings.dateLine, settings.verse].filter(Boolean).join('  ·  ');

  ctx.fillStyle = '#f2ead8';
  const s1 = fitFont(line1, '700', F_TITLE, 46, pw - 90);
  ctx.font = '700 ' + s1 + 'px ' + F_TITLE;
  ctx.fillText(line1, W / 2, line2 ? py + 72 : py + 95);

  if (line2) {
    ctx.fillStyle = '#dcc389';
    const s2 = fitFont(line2, '400', F_TITLE, 30, pw - 120);
    ctx.font = '400 ' + s2 + 'px ' + F_TITLE;
    ctx.fillText(line2, W / 2, py + 122);
    const w2 = ctx.measureText(line2).width;
    ctx.strokeStyle = 'rgba(220,195,137,0.8)';
    ctx.lineWidth = 1.5;
    [[W / 2 - w2 / 2 - 22, -1], [W / 2 + w2 / 2 + 22, 1]].forEach(([x0, dir]) => {
      ctx.beginPath();
      ctx.moveTo(x0, py + 113);
      ctx.lineTo(x0 + dir * 34, py + 113);
      ctx.stroke();
    });
  }
  ctx.restore();
}

/* ---------- readable-over-anything backdrop (from the Yair board) ---------- */

const BLUR_OK = (function () {
  const c = document.createElement('canvas').getContext('2d');
  c.filter = 'blur(4px)';
  return c.filter === 'blur(4px)';
})();

function sliceLum(x, y, w, h, slices) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.min(W - x, Math.round(w)); h = Math.min(H - y, Math.round(h));
  const out = new Array(slices).fill(255);
  if (w <= 0 || h <= 0) return out;
  const d = ctx.getImageData(x, y, w, h).data;
  const sum = new Array(slices).fill(0), n = new Array(slices).fill(0);
  for (let py = 0; py < h; py += 2) {
    for (let px = 0; px < w; px += 2) {
      const k = Math.min(slices - 1, Math.floor(px / w * slices));
      const i = (py * w + px) * 4;
      sum[k] += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n[k]++;
    }
  }
  for (let k = 0; k < slices; k++) if (n[k]) out[k] = sum[k] / n[k];
  return out;
}

function lumToAlpha(lum) {
  const t = Math.max(0, Math.min(1, (232 - lum) / 112));
  return 0.15 + t * 0.82;
}

function lozenge(box) {
  const T = tpl();
  ctx.save();
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(box.x, 0, box.x + box.w, 0);
  const n = box.alphas.length;
  const fade = k => Math.min(1, Math.min(k + 0.7, n - 0.7 - k) / 2.2);
  g.addColorStop(0, 'rgba(' + T.cream + ',0)');
  for (let k = 0; k < n; k++) {
    g.addColorStop((k + 0.5) / n,
      'rgba(' + T.cream + ',' + (box.alphas[k] * fade(k)).toFixed(3) + ')');
  }
  g.addColorStop(1, 'rgba(' + T.cream + ',0)');
  ctx.fillStyle = g;
  if (BLUR_OK) {
    ctx.filter = 'blur(12px)';
    roundRectPath(ctx, box.x, box.y, box.w, box.h, box.h / 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = 0.34;
    for (let k = 4; k >= 0; k--) {
      const p = k * 3;
      roundRectPath(ctx, box.x - p, box.y - p, box.w + p * 2, box.h + p * 2, (box.h + p * 2) / 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawRows(rows) {
  const T = tpl();
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // With fewer cities the rows spread a little and stay vertically centered
  // between the headers and the plaque.
  const top = 492, bottom = 1042;
  const rowH = rows.length > 1
    ? Math.min(78, (bottom - top) / (rows.length - 1))
    : 0;
  const startY = rows.length > 1
    ? top + ((bottom - top) - rowH * (rows.length - 1)) / 2
    : (top + bottom) / 2;

  const cols = [
    { nameX: 1168, timeX: 858, key: 'entry' },
    { nameX: 400, timeX: 90, key: 'exit' }
  ];

  const SLICES = 22;
  const boxes = [];
  rows.forEach((row, i) => {
    const y = startY + i * rowH;
    for (const col of cols) {
      const x0 = Math.min(col.timeX, col.nameX) - 48;
      const x1 = Math.max(col.timeX, col.nameX) + 48;
      const box = { x: x0, y: y - 42, w: x1 - x0, h: 66 };
      const lums = sliceLum(box.x, box.y, box.w, box.h, SLICES);
      box.alphas = lums.map((_, k) =>
        lumToAlpha(Math.min(lums[k], lums[Math.max(0, k - 1)], lums[Math.min(SLICES - 1, k + 1)])));
      boxes.push(box);
    }
  });
  boxes.forEach(lozenge);

  rows.forEach((row, i) => {
    const y = startY + i * rowH;
    for (const col of cols) {
      ctx.save();
      ctx.shadowColor = 'rgba(' + T.cream + ',0.95)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = T.ink;

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      const nSize = fitFont(row.name, W_NAME, F_BODY, S_NAME, 190);
      ctx.font = W_NAME + ' ' + nSize + 'px ' + F_BODY;
      ctx.fillText(row.name, col.nameX, y);

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = W_TIME + ' ' + S_TIME + 'px ' + F_BODY;
      ctx.fillText(row[col.key], col.timeX, y);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(185,138,68,0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 7]);
      ctx.beginPath();
      ctx.moveTo(col.timeX, y + 18);
      ctx.lineTo(col.nameX, y + 18);
      ctx.stroke();
      ctx.restore();
    }
  });
  ctx.restore();
}

function drawBoard(plan, rows) {
  const labels = LABELS[plan.mode];
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(bgImage, 0, 0, W, H);
  drawPhoto();
  drawTitle(labels.title, plan.name);
  drawHeaders(labels.right, labels.left);
  drawPlaque();
  drawRows(rows);
}

/* ---------- assets ---------- */

async function loadAssets() {
  const T = tpl();
  if (!bgImage || bgFile !== T.file) {
    bgImage = await loadImage(T.file);
    bgFile = T.file;
  }
  if (settings.photo && (!photoImage || photoImage._src !== settings.photo)) {
    photoImage = await loadImage(settings.photo);
    photoImage._src = settings.photo;
  }
  if (!settings.photo) photoImage = null;
}

/* ---------- main flow ---------- */

async function generate() {
  const btnMake = $('btnMake');
  try {
    btnMake.disabled = true;
    $('btnDownload').style.display = 'none';
    $('btnShare').style.display = 'none';
    $('saveHint').style.display = 'none';
    setStatus('טוען נתונים מהאינטרנט…');

    const chosenISO = $('datePick').value || isoOf(new Date());
    const chosen = new Date(chosenISO + 'T12:00:00');
    const startISO = isoOf(addDays(chosen, -2));
    const endISO = isoOf(addDays(chosen, 9));

    const cities = CITIES.filter(c => settings.cities.includes(c.key));

    await Promise.all([
      loadAssets(),
      document.fonts.load(W_TITLE + ' ' + S_TITLE + 'px ' + F_TITLE).catch(() => {}),
      document.fonts.load(W_SUB + ' ' + S_SUB + 'px ' + F_TITLE).catch(() => {}),
      document.fonts.load(W_NAME + ' ' + S_NAME + 'px ' + F_BODY).catch(() => {}),
      document.fonts.load(W_TIME + ' ' + S_TIME + 'px ' + F_BODY).catch(() => {})
    ]);

    const results = await Promise.all(cities.map(c =>
      fetchCityCal(c, startISO, endISO).then(data => ({ city: c, data }))
    ));

    const refResult = results.find(r => r.city.israel) || results[0];
    const plan = analyze(refResult.data.items || [], chosenISO);

    const rows = results.map(r => {
      const t = cityTimes(r.data.items || [], plan);
      return { name: r.city.name, entry: t.entry, exit: t.exit };
    });

    drawBoard(plan, rows);

    canvas.style.display = 'block';
    $('btnDownload').style.display = 'inline-block';
    if (canShareFiles) {
      $('btnShare').style.display = 'inline-block';
      $('saveHint').style.display = 'block';
    }
    const labels = LABELS[plan.mode];
    const safeName = (plan.name || '').replace(/[\\/:*?"<>|·]/g, '').replace(/\s+/g, '-');
    lastFilename = labels.prefix + (safeName ? '-' + safeName : '') + '-' + plan.exitDay + '.png';

    const exitD = new Date(plan.exitDay + 'T12:00:00');
    const kind = plan.mode === 'shabbat' ? 'לשבת' : (plan.mode === 'fast' ? 'לצום' : 'לחג');
    setStatus('הלוח מוכן ' + kind + (plan.name ? ' — ' + plan.name : '') +
      ' (יוצא ב-' + pad(exitD.getDate()) + '.' + pad(exitD.getMonth() + 1) + '.' + exitD.getFullYear() + ')');
  } catch (e) {
    console.error(e);
    if (String(e.message).startsWith('IMAGE_LOAD_FAILED')) {
      setStatus('שגיאה בטעינת רקע העיצוב. רעננו את הדף ונסו שוב.', true);
    } else {
      setStatus('שגיאה: לא הצלחתי להביא את הזמנים מהאינטרנט. ודאו שיש חיבור לאינטרנט ונסו שוב. (' + e.message + ')', true);
    }
  } finally {
    btnMake.disabled = false;
  }
}

function download() {
  canvas.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = lastFilename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

function share() {
  canvas.toBlob(async b => {
    const file = new File([b], lastFilename, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: 'לוח זמני שבת' });
    } catch (e) {
      if (e.name !== 'AbortError') download();
    }
  }, 'image/png');
}

/* ---------- wizard ---------- */

const wizardState = { step: 0, draft: null };
const WSTEPS = 5;

function defaultDraft() {
  return {
    v: 1,
    photo: '',
    photoOffset: 25,
    dedication: DEDICATIONS[0],
    name: '',
    dateLine: '',
    verse: '',
    cities: ['jerusalem', 'telaviv', 'haifa', 'beersheva'],
    template: 'classic'
  };
}

function openWizard(prefill) {
  wizardState.step = 0;
  wizardState.draft = prefill ? JSON.parse(JSON.stringify(prefill)) : defaultDraft();
  $('screenBoard').style.display = 'none';
  $('wizard').style.display = 'block';
  $('wizCancel').style.display = prefill ? 'inline-block' : 'none';
  $('wizTitle').textContent = prefill ? 'עריכת ההגדרות' : 'יצירת לוח שבת אישי';
  fillWizardFields();
  showStep(0);
}

function closeWizardToBoard() {
  $('wizard').style.display = 'none';
  $('screenBoard').style.display = 'flex';
}

function fillWizardFields() {
  const d = wizardState.draft;

  // dedication select
  const ded = $('fDedication');
  ded.innerHTML = '';
  DEDICATIONS.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    ded.appendChild(o);
  });
  ded.value = DEDICATIONS.includes(d.dedication) ? d.dedication : DEDICATIONS[0];

  $('fName').value = d.name || '';
  $('fDateLine').value = d.dateLine || '';

  // verse select
  const vs = $('fVerse');
  vs.innerHTML = '';
  VERSES.forEach(v => {
    const o = document.createElement('option');
    if (v === '') { o.value = ''; o.textContent = 'ללא משפט'; }
    else if (v === '__custom__') { o.value = '__custom__'; o.textContent = 'משפט אישי משלי…'; }
    else { o.value = v; o.textContent = v; }
    vs.appendChild(o);
  });
  if (d.verse && !VERSES.includes(d.verse)) {
    vs.value = '__custom__';
    $('fVerseCustom').value = d.verse;
    $('fVerseCustomWrap').style.display = 'block';
  } else {
    vs.value = d.verse || '';
    $('fVerseCustomWrap').style.display = 'none';
  }

  // photo preview
  if (d.photo) {
    $('photoPreview').src = d.photo;
    $('photoPreviewWrap').style.display = 'block';
    $('photoDrop').classList.add('has');
  } else {
    $('photoPreviewWrap').style.display = 'none';
    $('photoDrop').classList.remove('has');
  }
  $('photoOffset').value = d.photoOffset != null ? d.photoOffset : 25;

  // cities
  const grid = $('cityGrid');
  grid.innerHTML = '';
  CITIES.forEach(c => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = c.key;
    cb.checked = d.cities.includes(c.key);
    if (cb.checked) label.classList.add('checked');
    cb.addEventListener('change', () => {
      label.classList.toggle('checked', cb.checked);
      updateCityCount();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(c.name));
    grid.appendChild(label);
  });
  updateCityCount();

  // templates
  const tg = $('tplGrid');
  tg.innerHTML = '';
  Object.entries(TEMPLATES).forEach(([key, t]) => {
    const label = document.createElement('label');
    const rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'tplPick';
    rb.value = key;
    rb.checked = d.template === key;
    if (rb.checked) label.classList.add('checked');
    rb.addEventListener('change', () => {
      tg.querySelectorAll('label').forEach(l => l.classList.remove('checked'));
      label.classList.add('checked');
    });
    const img = document.createElement('img');
    img.src = t.file;
    img.alt = t.label;
    const nm = document.createElement('div');
    nm.className = 'tname';
    nm.textContent = t.label;
    label.appendChild(rb);
    label.appendChild(img);
    label.appendChild(nm);
    tg.appendChild(label);
  });

  // progress dots
  const pr = $('wizProgress');
  pr.innerHTML = '';
  for (let i = 0; i < WSTEPS; i++) {
    const s = document.createElement('span');
    pr.appendChild(s);
  }
}

function updateCityCount() {
  const n = $('cityGrid').querySelectorAll('input:checked').length;
  $('cityCount').textContent = 'נבחרו ' + n + ' מתוך ' + MAX_CITIES + ' אפשריות';
}

function showStep(i) {
  wizardState.step = i;
  document.querySelectorAll('.wstep').forEach(el =>
    el.classList.toggle('active', Number(el.dataset.step) === i));
  document.querySelectorAll('#wizProgress span').forEach((el, k) =>
    el.classList.toggle('on', k <= i));
  $('wizPrev').style.visibility = i === 0 ? 'hidden' : 'visible';
  $('wizNext').textContent = i === WSTEPS - 1 ? '✓ סיום ושמירה' : 'הבא ←';
  $('wizErr').textContent = '';
}

function collectStep(i) {
  const d = wizardState.draft;
  if (i === 0) {
    d.photoOffset = Number($('photoOffset').value);
    // photo itself is set on file pick
  } else if (i === 1) {
    d.dedication = $('fDedication').value;
    d.name = $('fName').value.trim();
    d.dateLine = $('fDateLine').value.trim();
    if (!d.name) return 'כתבו את שם יקירכם כדי להמשיך';
  } else if (i === 2) {
    const v = $('fVerse').value;
    d.verse = v === '__custom__' ? $('fVerseCustom').value.trim() : v;
  } else if (i === 3) {
    const picked = [...$('cityGrid').querySelectorAll('input:checked')].map(cb => cb.value);
    if (!picked.length) return 'בחרו לפחות עיר אחת';
    if (picked.length > MAX_CITIES) return 'אפשר לבחור עד ' + MAX_CITIES + ' ערים';
    d.cities = picked;
  } else if (i === 4) {
    const rb = document.querySelector('input[name="tplPick"]:checked');
    if (!rb) return 'בחרו אחד מהעיצובים';
    d.template = rb.value;
  }
  return '';
}

function wizardNext() {
  const err = collectStep(wizardState.step);
  if (err) { $('wizErr').textContent = err; return; }
  if (wizardState.step < WSTEPS - 1) {
    showStep(wizardState.step + 1);
    return;
  }
  // finish
  settings = wizardState.draft;
  try {
    saveSettings(settings);
  } catch (e) {
    $('wizErr').textContent = 'התמונה גדולה מדי לשמירה במכשיר — נסו תמונה קטנה יותר';
    return;
  }
  applySettingsToHeader();
  closeWizardToBoard();
  generate();
}

function applySettingsToHeader() {
  $('memorialLine').textContent =
    (settings.dedication + ' ' + settings.name).trim() +
    (settings.dateLine ? ' · ' + settings.dateLine : '');
}

/* photo pick: resize to max 1000px and store as JPEG data-URL, so it fits
 * comfortably in localStorage. The photo never leaves the device. */
function handlePhotoFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1000;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const dataURL = c.toDataURL('image/jpeg', 0.85);
      wizardState.draft.photo = dataURL;
      $('photoPreview').src = dataURL;
      $('photoPreviewWrap').style.display = 'block';
      $('photoDrop').classList.add('has');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ---------- init ---------- */

function initBoardScreen() {
  applySettingsToHeader();
  $('screenBoard').style.display = 'flex';
  $('wizard').style.display = 'none';
}

const urlParams = new URLSearchParams(location.search);
if (urlParams.get('reset')) {
  localStorage.removeItem(SETTINGS_KEY);
}

$('datePick').value = urlParams.get('date') || isoOf(new Date());

$('btnMake').addEventListener('click', generate);
$('btnDownload').addEventListener('click', download);
$('btnShare').addEventListener('click', share);
$('btnSettings').addEventListener('click', () => openWizard(settings));

$('wizNext').addEventListener('click', wizardNext);
$('wizPrev').addEventListener('click', () => showStep(Math.max(0, wizardState.step - 1)));
$('wizCancel').addEventListener('click', () => {
  if (settings) { closeWizardToBoard(); }
});

$('photoDrop').addEventListener('click', () => $('photoFile').click());
$('photoFile').addEventListener('change', e => handlePhotoFile(e.target.files[0]));
$('photoOffset').addEventListener('input', () => {
  wizardState.draft.photoOffset = Number($('photoOffset').value);
  const p = $('photoPreview');
  p.style.objectPosition = '50% ' + $('photoOffset').value + '%';
});
$('fVerse').addEventListener('change', () => {
  $('fVerseCustomWrap').style.display = $('fVerse').value === '__custom__' ? 'block' : 'none';
});

$('srcLink').addEventListener('click', e => { e.preventDefault(); $('modalBack').classList.add('open'); });
$('modalClose').addEventListener('click', () => $('modalBack').classList.remove('open'));
$('modalBack').addEventListener('click', e => {
  if (e.target === $('modalBack')) $('modalBack').classList.remove('open');
});

/* demo mode for testing: ?demo=1 seeds settings with the bundled sample */
async function boot() {
  if (urlParams.get('demo')) {
    try {
      const img = await loadImage('demo.jpg');
      const c = document.createElement('canvas');
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      settings = defaultDraft();
      settings.photo = c.toDataURL('image/jpeg', 0.85);
      settings.name = 'סגן יאיר נבנצאל הי״ד';
      settings.dateLine = 'שנהרג בכ״ה אייר תשס״א';
      settings.verse = 'נר ה׳ נשמת אדם';
      settings.template = urlParams.get('tpl') || 'classic';
      settings.cities = ['jerusalem', 'telaviv', 'haifa', 'beersheva', 'ariel', 'katzrin', 'london'];
      saveSettings(settings);
    } catch (e) { console.error('demo seed failed', e); }
  }

  settings = settings || loadSettings();
  if (settings) {
    initBoardScreen();
    if (urlParams.get('auto')) generate();
  } else {
    openWizard(null);
  }
}
boot();

document.getElementById('buildStamp').textContent = 'גרסה: ' + BUILD;
