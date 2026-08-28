/* לוח שבת לזכרם — כלי אישי ליצירת לוח זמני שבת לזכר יקיריכם */
'use strict';

const BUILD = '2026-08-28 18:15 v5 auto-save-backup-nudge';

const W = 1254, H = 1254;
const SETTINGS_KEY = 'memorialBoard.v1';

/* ---------- templates ----------
 * Each template is a text-free background image plus the palette the code
 * draws with on top of it. `cream` is the paper tone the readability
 * lozenges fade toward, so it must match the template's paper. */
const TEMPLATES = {
  classic: {
    label: 'קלאסי', file: 'templates/classic.webp',
    ink: '#1e2d55', gold: '#b98a44', cream: '246,240,226', plaque: '#2f425a'
  },
  olive: {
    label: 'ענף זית', file: 'templates/olive.webp',
    ink: '#2f4a33', gold: '#a08b3f', cream: '247,243,232', plaque: '#3c523f'
  },
  jerusalem: {
    label: 'ירושלים', file: 'templates/jerusalem.webp',
    ink: '#5a4326', gold: '#b08d4f', cream: '245,237,221', plaque: '#5a4326'
  },
  night: {
    label: 'שמי לילה', file: 'templates/night.webp',
    ink: '#17203d', gold: '#b98a44', cream: '243,239,229', plaque: '#1f2a4a',
    /* the title zone sits on the dark night sky, so it needs light ink */
    titleInk: '#f2e9c9', titleShadow: 'rgba(10,16,38,0.55)'
  },
  field: {
    label: 'שדה זהב', file: 'templates/field.webp',
    ink: '#5a4423', gold: '#a8843c', cream: '246,239,222', plaque: '#5f4d28'
  },
  galilee: {
    label: 'הגליל', file: 'templates/galilee.webp',
    ink: '#2e4a3a', gold: '#8f9a55', cream: '244,243,232', plaque: '#3a5244'
  },
  tchelet: {
    label: 'תכלת', file: 'templates/tchelet.webp',
    ink: '#28486b', gold: '#8aa3c0', cream: '240,244,248', plaque: '#31517a'
  },
  /* --- Shabbat-themed --- */
  candles: {
    label: 'נרות שבת', file: 'templates/candles.webp', shabbat: true,
    ink: '#4a3b25', gold: '#b08d4f', cream: '250,245,230', plaque: '#4a3f2a'
  },
  challah: {
    label: 'חלות וקידוש', file: 'templates/challah.webp', shabbat: true,
    ink: '#5a2a33', gold: '#a8853f', cream: '250,247,238', plaque: '#5e2f38'
  },
  'shabbat-table': {
    label: 'שולחן שבת', file: 'templates/shabbat-table.webp', shabbat: true,
    ink: '#3a3f4a', gold: '#a3947a', cream: '248,248,246', plaque: '#474d59'
  },
  havdala: {
    label: 'הבדלה', file: 'templates/havdala.webp', shabbat: true,
    ink: '#3a3550', gold: '#9a8fa8', cream: '245,242,234', plaque: '#3f3a5c',
    titleInk: '#f2eee4', titleShadow: 'rgba(30,24,55,0.5)'
  },
  pomegranate: {
    label: 'רימונים', file: 'templates/pomegranate.webp', shabbat: true,
    ink: '#5c232c', gold: '#b08d3f', cream: '249,246,236', plaque: '#5c232c'
  }
};

/* Tone variations — a real extra axis of choice without a server: the
 * template art is redrawn through a canvas filter before anything else is
 * painted, so the adaptive lozenges measure the tinted result, not the
 * original. */
const TONES = {
  natural: { label: 'טבעי',  filter: '' },
  warm:    { label: 'חמים',  filter: 'sepia(0.32) saturate(1.12)' },
  soft:    { label: 'רך',    filter: 'saturate(0.55) brightness(1.05)' },
  deep:    { label: 'עמוק',  filter: 'saturate(1.3) contrast(1.08)' }
};

/* ---------- font pairs ----------
 * Each pair names a title face and a body face WITH the weight the file
 * really ships (a synthesised bold reads as a scrawl) and an optical scale —
 * every face has a different body height at the same px, so sizes calibrated
 * for the classic pair are multiplied per pair. Google-hosted faces load via
 * the stylesheet in index.html; TitleAlt/BodyAlt/FrankRuhl are bundled. */
const FONT_PAIRS = {
  classic: {
    label: 'קלאסי', sample: 'דוד ליברה + כתב־יד',
    title: { stack: '"TitleAlt", FrankRuhl, serif', weight: '700', scale: 1 },
    body:  { stack: '"BodyAlt", FrankRuhl, serif',  weight: '400', scale: 1 }
  },
  festive: {
    label: 'חגיגי', sample: 'סואץ + פרנק ריהל',
    title: { stack: '"Suez One", FrankRuhl, serif', weight: '400', scale: 0.8 },
    body:  { stack: 'FrankRuhl, serif',             weight: '400', scale: 0.82 }
  },
  elegant: {
    label: 'מהודר', sample: 'בלפייר',
    title: { stack: '"Bellefair", FrankRuhl, serif', weight: '400', scale: 1.02 },
    body:  { stack: '"Bellefair", FrankRuhl, serif', weight: '400', scale: 0.95 }
  },
  modern: {
    label: 'נקי', sample: 'סקולר + היבו',
    title: { stack: '"Secular One", FrankRuhl, sans-serif', weight: '400', scale: 0.8 },
    body:  { stack: '"Heebo", FrankRuhl, sans-serif',       weight: '400', scale: 0.76 }
  },
  script: {
    label: 'כתב יד', sample: 'אמאטיק',
    title: { stack: '"Amatic SC", FrankRuhl, cursive', weight: '700', scale: 1.18 },
    body:  { stack: '"Amatic SC", FrankRuhl, cursive', weight: '700', scale: 1.15 }
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

/* Base optical sizes, calibrated for the classic pair; every other pair
 * multiplies these by its own scale. */
const S_TITLE = 104, S_SUB = 48, S_HEAD = 52, S_NAME = 38, S_TIME = 42;

function fontPair() {
  return FONT_PAIRS[(settings && settings.fontPair)] || FONT_PAIRS.classic;
}
function fTitle() { return fontPair().title.stack; }
function fBody()  { return fontPair().body.stack; }
function wTitle() { return fontPair().title.weight; }
function wBody()  { return fontPair().body.weight; }
function sT(base) { return Math.round(base * fontPair().title.scale); }
function sB(base) { return Math.round(base * fontPair().body.scale); }

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
    // back-compat with v1 settings
    if (!FONT_PAIRS[s.fontPair]) s.fontPair = 'classic';
    if (!Array.isArray(s.customCities)) s.customCities = [];
    if (!s.photoZoom) s.photoZoom = 100;
    if (!TONES[s.tone]) s.tone = 'natural';
    return s;
  } catch (e) { return null; }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/* Re-persist quietly on every board creation. The wizard already saves on
 * finish, so this is belt-and-braces: whatever state produced the picture the
 * family is looking at is the state that survives to next week. */
function touchSettings() {
  try { if (settings) saveSettings(settings); } catch (e) { /* quota — ignore */ }
}

const NUDGE_KEY = 'memorialBoard.backupHinted';

/* Browser storage is per-device and can be cleared — and for these families
 * what would be lost is the photo. Offer a backup once, after the first board
 * actually works, and never nag again. */
function maybeOfferBackup() {
  let hinted = true;
  try { hinted = localStorage.getItem(NUDGE_KEY) === '1'; } catch (e) { /* ignore */ }
  if (hinted || !settings || !settings.photo) return;
  $('backupNudge').style.display = 'block';
}

function dismissNudge() {
  try { localStorage.setItem(NUDGE_KEY, '1'); } catch (e) { /* ignore */ }
  $('backupNudge').style.display = 'none';
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
  const size = fitFont(title, wTitle(), fTitle(), sT(S_TITLE), W - 200);
  ctx.font = wTitle() + ' ' + size + 'px ' + fTitle();
  ctx.shadowColor = T.titleShadow || 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fillText(title, W / 2, 158);
  ctx.shadowColor = 'transparent';

  if (subtitle) {
    /* subtitle stays regular weight — 400 exists in every pair's title face */
    const sSize = fitFont(subtitle, '400', fTitle(), sT(S_SUB), W - 500);
    ctx.font = '400 ' + sSize + 'px ' + fTitle();
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
    const size = fitFont(label, wTitle(), fTitle(), sT(S_HEAD), 350);
    ctx.font = wTitle() + ' ' + size + 'px ' + fTitle();
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

/* Feathered photo — cover-fit into a frame with user-controlled zoom and
 * vertical position, faded out over a wide, gradual ellipse so the figure
 * melts into the paper instead of sitting in a hard-edged window, then
 * warmed with a whisper of the paper tone so its colors sit with the art.
 * Shared by the board (full size) and the wizard's live preview. */
function paintPhoto(octx, cw, ch, img, frame, offsetPct, zoomPct, creamRGB) {
  const scale = Math.max(frame.w / img.width, frame.h / img.height) * (zoomPct / 100);
  const dw = img.width * scale, dh = img.height * scale;
  const sx = frame.x + (frame.w - dw) / 2;
  const sy = frame.y - Math.max(0, dh - frame.h) * (offsetPct / 100);
  octx.save();
  octx.beginPath();
  octx.rect(frame.x, frame.y, frame.w, frame.h);
  octx.clip();
  octx.drawImage(img, sx, sy, dw, dh);
  octx.restore();

  // wide, gradual ellipse fade — the last third of the radius is all falloff
  const cx = frame.x + frame.w / 2, cy = frame.y + frame.h / 2;
  const rx = frame.w / 2, ry = frame.h / 2;
  octx.globalCompositeOperation = 'destination-in';
  octx.save();
  octx.translate(cx, cy);
  octx.scale(1, ry / rx);
  const g = octx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.5, 'rgba(0,0,0,1)');
  g.addColorStop(0.72, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.86, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.95, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  octx.fillStyle = g;
  octx.beginPath();
  octx.arc(0, 0, rx, 0, Math.PI * 2);
  octx.fill();
  octx.restore();

  // harmonizing wash: a hint of the paper tone over the remaining pixels
  octx.globalCompositeOperation = 'source-atop';
  octx.fillStyle = 'rgba(' + creamRGB + ',0.10)';
  octx.fillRect(0, 0, cw, ch);
  octx.globalCompositeOperation = 'source-over';
}

const PHOTO_FRAME = { x: 297, y: 300, w: 660, h: 790 };

function drawPhoto() {
  if (!photoImage) return;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  paintPhoto(octx, W, H, photoImage, PHOTO_FRAME,
    settings.photoOffset != null ? settings.photoOffset : 25,
    settings.photoZoom || 100,
    tpl().cream);
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
  const s1 = fitFont(line1, wTitle(), fTitle(), sT(46), pw - 90);
  ctx.font = wTitle() + ' ' + s1 + 'px ' + fTitle();
  ctx.fillText(line1, W / 2, line2 ? py + 72 : py + 95);

  if (line2) {
    ctx.fillStyle = '#dcc389';
    const s2 = fitFont(line2, '400', fTitle(), sT(30), pw - 120);
    ctx.font = '400 ' + s2 + 'px ' + fTitle();
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
      const nSize = fitFont(row.name, wBody(), fBody(), sB(S_NAME), 190);
      ctx.font = wBody() + ' ' + nSize + 'px ' + fBody();
      ctx.fillText(row.name, col.nameX, y);

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = wBody() + ' ' + sB(S_TIME) + 'px ' + fBody();
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

/* the template art with the chosen tone baked in (cached per template+tone) */
let toneCache = { key: '', canvas: null };
function tonedBg() {
  const tone = TONES[settings.tone] ? settings.tone : 'natural';
  if (tone === 'natural' || !BLUR_OK) return bgImage;   // BLUR_OK == ctx.filter works
  const key = bgFile + '|' + tone;
  if (toneCache.key === key && toneCache.canvas) return toneCache.canvas;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.filter = TONES[tone].filter;
  x.drawImage(bgImage, 0, 0, W, H);
  toneCache = { key, canvas: c };
  return c;
}

const CONTACT_EMAIL = 'idoyan@gmail.com';

/* Discreet credit in the bottom-left corner, outside the plaque, so anyone
 * who receives the image forwarded in a WhatsApp group can find the tool. */
function drawContact() {
  ctx.save();
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '400 19px FrankRuhl, serif';
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.shadowColor = 'rgba(255,255,255,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(CONTACT_EMAIL, 42, 1228);
  ctx.restore();
}

function drawBoard(plan, rows) {
  const labels = LABELS[plan.mode];
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(tonedBg(), 0, 0, W, H);
  drawPhoto();
  drawTitle(labels.title, plan.name);
  drawHeaders(labels.right, labels.left);
  drawPlaque();
  drawRows(rows);
  drawContact();
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

    const cities = allCities(settings).filter(c => settings.cities.includes(c.key));

    await Promise.all([
      loadAssets(),
      document.fonts.ready.catch(() => {}),
      document.fonts.load(wTitle() + ' ' + sT(S_TITLE) + 'px ' + fTitle()).catch(() => {}),
      document.fonts.load('400 ' + sT(S_SUB) + 'px ' + fTitle()).catch(() => {}),
      document.fonts.load(wBody() + ' ' + sB(S_NAME) + 'px ' + fBody()).catch(() => {}),
      document.fonts.load(wBody() + ' ' + sB(S_TIME) + 'px ' + fBody()).catch(() => {})
    ]);
    // last-resort settle: if the chosen title face still isn't usable, give
    // the network one more beat before drawing with a fallback
    if (!document.fonts.check(wTitle() + ' 20px ' + fTitle())) {
      await new Promise(r => setTimeout(r, 700));
    }

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

    touchSettings();
    maybeOfferBackup();
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
const WSTEPS = 6;

function defaultDraft() {
  return {
    v: 2,
    photo: '',
    photoOffset: 25,
    photoZoom: 100,
    dedication: DEDICATIONS[0],
    name: '',
    dateLine: '',
    verse: '',
    cities: ['jerusalem', 'telaviv', 'haifa', 'beersheva'],
    customCities: [],
    template: 'classic',
    tone: 'natural',
    fontPair: 'classic'
  };
}

/* preset cities + the cities this user added via search */
function allCities(src) {
  const custom = (src && src.customCities) || [];
  return CITIES.concat(custom);
}

function openWizard(prefill) {
  wizardState.step = 0;
  wizardState.draft = prefill ? JSON.parse(JSON.stringify(prefill)) : defaultDraft();
  $('screenBoard').style.display = 'none';
  $('wizard').style.display = 'block';
  $('wizCancel').style.display = prefill ? 'inline-block' : 'none';
  // a backup is only meaningful once there is something to back up
  $('wizExport').style.display = prefill ? 'inline-block' : 'none';
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
  $('photoOffset').value = d.photoOffset != null ? d.photoOffset : 25;
  $('photoZoom').value = d.photoZoom || 100;
  refreshPhotoPreview();

  // cities
  renderCityGrid();
  $('cityResults').innerHTML = '';
  $('citySearch').value = '';

  // templates, grouped — twelve tiles in one undifferentiated wall is hard to scan
  const tg = $('tplGrid');
  tg.innerHTML = '';
  const groups = [
    ['שבת ומועד', Object.entries(TEMPLATES).filter(([, t]) => t.shabbat)],
    ['נוף וטבע', Object.entries(TEMPLATES).filter(([, t]) => !t.shabbat)]
  ];
  groups.forEach(([groupName, entries]) => {
    if (!entries.length) return;
    const head = document.createElement('div');
    head.className = 'tplgroup';
    head.textContent = groupName;
    tg.appendChild(head);
    entries.forEach(([key, t]) => renderTplTile(key, t, tg, d));
  });

  function renderTplTile(key, t, tg, d) {
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
    // 320px thumbnail, not the full 1254px art — the gallery shows twelve of
    // these at once, and the full file is fetched only for the chosen one
    img.src = t.file.replace('templates/', 'templates/thumb/');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = t.label;
    const nm = document.createElement('div');
    nm.className = 'tname';
    nm.textContent = t.label;
    label.appendChild(rb);
    label.appendChild(img);
    label.appendChild(nm);
    tg.appendChild(label);
  }

  // tone variations
  const tn = $('toneGrid');
  tn.innerHTML = '';
  Object.entries(TONES).forEach(([key, t]) => {
    const label = document.createElement('label');
    label.className = 'tonechip';
    const rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'tonePick';
    rb.value = key;
    rb.checked = (d.tone || 'natural') === key;
    if (rb.checked) label.classList.add('checked');
    rb.addEventListener('change', () => {
      tn.querySelectorAll('label').forEach(l => l.classList.remove('checked'));
      label.classList.add('checked');
      applyTonePreview(key);
    });
    label.appendChild(rb);
    label.appendChild(document.createTextNode(t.label));
    tn.appendChild(label);
  });
  applyTonePreview(d.tone || 'natural');

  // font pairs
  const fg = $('fontGrid');
  fg.innerHTML = '';
  Object.entries(FONT_PAIRS).forEach(([key, p]) => {
    const label = document.createElement('label');
    const rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'fontPick';
    rb.value = key;
    rb.checked = (d.fontPair || 'classic') === key;
    if (rb.checked) label.classList.add('checked');
    rb.addEventListener('change', () => {
      fg.querySelectorAll('label').forEach(l => l.classList.remove('checked'));
      label.classList.add('checked');
    });
    const ft = document.createElement('div');
    ft.className = 'ft';
    ft.style.fontFamily = p.title.stack;
    ft.style.fontWeight = p.title.weight;
    ft.textContent = 'זמני כניסת ויציאת שבת';
    const fb = document.createElement('div');
    fb.className = 'fb';
    fb.style.fontFamily = p.body.stack;
    fb.style.fontWeight = p.body.weight;
    fb.textContent = 'ירושלים · 18:24';
    const nm = document.createElement('div');
    nm.className = 'fname';
    nm.textContent = p.label + ' — ' + p.sample;
    label.appendChild(rb);
    label.appendChild(ft);
    label.appendChild(fb);
    label.appendChild(nm);
    fg.appendChild(label);
  });

  // progress dots
  const pr = $('wizProgress');
  pr.innerHTML = '';
  for (let i = 0; i < WSTEPS; i++) {
    const s = document.createElement('span');
    pr.appendChild(s);
  }
}

/* the tone applies to every thumbnail at once, so the grid always shows the
 * designs as they will actually be printed */
function applyTonePreview(toneKey) {
  const f = (TONES[toneKey] || TONES.natural).filter;
  $('tplGrid').querySelectorAll('img').forEach(img => { img.style.filter = f; });
}

/* live preview of the actual crop + feather, on a neutral paper tone */
function refreshPhotoPreview() {
  const d = wizardState.draft;
  if (!d || !d.photo) {
    $('photoPreviewWrap').style.display = 'none';
    $('photoDrop').classList.remove('has');
    return;
  }
  $('photoPreviewWrap').style.display = 'block';
  $('photoDrop').classList.add('has');
  const img = new Image();
  img.onload = () => {
    const c = $('photoPreviewCanvas');
    const pctx = c.getContext('2d');
    pctx.clearRect(0, 0, c.width, c.height);
    pctx.fillStyle = '#f3ecdc';
    pctx.fillRect(0, 0, c.width, c.height);
    paintPhoto(pctx, c.width, c.height, img,
      { x: 10, y: 10, w: c.width - 20, h: c.height - 20 },
      Number($('photoOffset').value), Number($('photoZoom').value), '243,236,220');
  };
  img.src = d.photo;
}

function renderCityGrid() {
  const d = wizardState.draft;
  const grid = $('cityGrid');
  grid.innerHTML = '';
  allCities(d).forEach(c => {
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
    // searched-in cities show their candle custom, so a wrong one is visible
    if (!CITIES.some(p => p.key === c.key)) {
      const tag = document.createElement('small');
      tag.style.cssText = 'color:#8a7a50; font-size:13px; margin-inline-start:auto';
      tag.textContent = c.candles + ' דק׳';
      label.appendChild(tag);
    }
    grid.appendChild(label);
  });
  updateCityCount();
}

/* ---------- city search ----------
 * Two sources, because neither alone is enough:
 *   Open-Meteo geocoding — fast, ships a timezone, but its gazetteer has
 *     almost no small Israeli yishuvim (נווה צוף, טלמון, נוקדים… all missing).
 *   Nominatim / OpenStreetMap — has every yishuv, but returns no timezone.
 * Open-Meteo answers first; Nominatim fills the (very common) gap, and the
 * timezone is then derived from the coordinates. */

const IL_BOX = { latMin: 29.3, latMax: 33.45, lngMin: 34.2, lngMax: 35.95 };
function inIsrael(lat, lng) {
  return lat >= IL_BOX.latMin && lat <= IL_BOX.latMax &&
         lng >= IL_BOX.lngMin && lng <= IL_BOX.lngMax;
}

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* Candle-lighting minutes follow local custom, and getting this wrong is a
 * halachic error, not a cosmetic one — so a searched city near Jerusalem or
 * Haifa inherits that city's minhag instead of the 18-minute default. */
function autoCandles(lat, lng) {
  if (distKm(lat, lng, 31.778, 35.235) <= 12) return 40;
  if (distKm(lat, lng, 32.794, 34.989) <= 12) return 30;
  return 18;
}

const CANDLE_CHOICES = [15, 18, 20, 22, 25, 30, 40];

/* ---------- bundled Israeli localities ----------
 * 1,174 localities with Hebrew names and WGS84 coordinates, shipped with the
 * site (~21 KB gzipped). Searching these locally means the common case needs
 * no network at all, and it keeps us far away from Nominatim's rate policy —
 * its 1 req/sec cap counts per application, not per user. */

let ilCities = null, ilLoading = null;

function loadIsraeliCities() {
  if (ilCities) return Promise.resolve(ilCities);
  if (!ilLoading) {
    ilLoading = fetch('cities-il.json')
      .then(r => r.ok ? r.json() : [])
      .then(d => { ilCities = d; return d; })
      .catch(() => { ilCities = []; return []; });
  }
  return ilLoading;
}

/* Hebrew place names are written both plene and defective — נווה/נוה,
 * קריית/קרית — and users type either. Collapsing the doubled letters and
 * the punctuation makes both spellings compare equal. */
function normHe(s) {
  return (s || '')
    .replace(/[֑-ׇ]/g, '')      // nikud / cantillation
    .replace(/["'`׳״]/g, '')
    .replace(/וו/g, 'ו')
    .replace(/יי/g, 'י')
    .replace(/[\s\-־]/g, '');
}

async function searchIsraeliCities(q) {
  const list = await loadIsraeliCities();
  const n = normHe(q);
  if (!n) return [];
  const starts = [], contains = [];
  for (const c of list) {
    const h = normHe(c.h);
    if (h === n || h.startsWith(n)) starts.push(c);
    else if (h.includes(n)) contains.push(c);
    if (starts.length >= 8) break;
  }
  return starts.concat(contains).slice(0, 8).map(c => ({
    key: 'il' + c.h,
    name: c.h,
    region: 'ישראל',
    lat: c.y,
    lng: c.x,
    tzid: 'Asia/Jerusalem'
  }));
}

async function fetchOpenMeteo(q) {
  const url = 'https://geocoding-api.open-meteo.com/v1/search?count=6&language=he&format=json&name=' +
    encodeURIComponent(q);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return (data.results || []).filter(r => r.timezone).map(r => ({
    key: 'g' + r.id,
    name: r.name,
    region: [r.admin1 && r.admin1 !== r.name ? r.admin1 : '', r.country].filter(Boolean).join(' · '),
    lat: r.latitude,
    lng: r.longitude,
    tzid: r.timezone
  }));
}

async function fetchNominatim(q) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6' +
    '&accept-language=he&addressdetails=1&q=' + encodeURIComponent(q);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return (data || []).map(r => {
    const a = r.address || {};
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    // Inside Israel the country label is politically loaded and unhelpful —
    // show the district instead, which is what a reader actually needs.
    const region = inIsrael(lat, lng)
      ? (a.state || a.county || 'ישראל')
      : [a.state || a.county, a.country].filter(Boolean).join(' · ');
    return {
      key: 'osm' + r.osm_id,
      name: r.name || (r.display_name || '').split(',')[0],
      region,
      lat,
      lng,
      tzid: null                 // resolved on add
    };
  }).filter(r => r.name && isFinite(r.lat) && isFinite(r.lng));
}

/* Nominatim gives no timezone. Inside Israel it is unambiguous; elsewhere
 * ask Open-Meteo's forecast endpoint, which reports the tz for a point. */
async function resolveTz(lat, lng) {
  if (inIsrael(lat, lng)) return 'Asia/Jerusalem';
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?forecast_days=1&timezone=auto' +
      '&latitude=' + lat + '&longitude=' + lng);
    if (res.ok) {
      const d = await res.json();
      if (d.timezone) return d.timezone;
    }
  } catch (e) { /* fall through */ }
  return null;
}

let searchSeq = 0;

async function searchCity() {
  const q = $('citySearch').value.trim();
  const box = $('cityResults');
  if (!q) { box.innerHTML = ''; return; }
  const mySeq = ++searchSeq;
  box.innerHTML = '<div class="cnote">מחפש…</div>';
  try {
    // Bundled Israeli list first (instant, offline, no rate policy), then
    // Open-Meteo for the rest of the world, and only as a last resort
    // Nominatim — which still catches colloquial names the official list
    // files differently (נווה צוף is registered there as חלמיש).
    let results = await searchIsraeliCities(q);
    if (!results.length) {
      try {
        results = await fetchOpenMeteo(q);
      } catch (e) { console.warn('open-meteo failed', e); }
    }
    if (!results.length) {
      results = await fetchNominatim(q);
    }
    if (mySeq !== searchSeq) return;          // a newer search already ran

    // OSM often returns the same place several times (village node, boundary
    // relation, place point) — collapse anything with the same name within
    // about a kilometre so the user sees one row per real place.
    const seen = [];
    results = results.filter(r => {
      const dup = seen.some(s => s.name === r.name && distKm(s.lat, s.lng, r.lat, r.lng) < 1);
      if (!dup) seen.push(r);
      return !dup;
    });

    if (!results.length) {
      box.innerHTML = '<div class="cnote">לא נמצא יישוב בשם הזה — נסו איות אחר, שם מלא, או שם באנגלית</div>';
      return;
    }
    box.innerHTML = '';
    results.forEach(r => renderResultRow(r, box));
  } catch (e) {
    console.error(e);
    if (mySeq === searchSeq) {
      box.innerHTML = '<div class="cnote">שגיאה בחיפוש — בדקו את חיבור האינטרנט ונסו שוב</div>';
    }
  }
}

function renderResultRow(r, box) {
  const row = document.createElement('div');
  row.className = 'cres';

  const info = document.createElement('span');
  info.textContent = r.name + (r.region ? ' · ' + r.region : '');

  const right = document.createElement('span');
  right.style.display = 'flex';
  right.style.gap = '6px';
  right.style.alignItems = 'center';

  const sel = document.createElement('select');
  sel.title = 'דקות הדלקת נרות לפני השקיעה';
  const auto = autoCandles(r.lat, r.lng);
  CANDLE_CHOICES.forEach(m => {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = m + ' דק׳';
    if (m === auto) o.selected = true;
    sel.appendChild(o);
  });

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'iconbtn';
  btn.textContent = '+ הוספה';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'מוסיף…';
    const ok = await addCustomCity(r, Number(sel.value));
    if (ok) {
      row.remove();
    } else {
      btn.disabled = false;
      btn.textContent = '+ הוספה';
      const note = document.createElement('div');
      note.className = 'cnote';
      note.textContent = 'לא הצלחתי לקבוע אזור זמן ליישוב הזה — נסו יישוב סמוך גדול יותר';
      box.appendChild(note);
    }
  });

  right.appendChild(sel);
  right.appendChild(btn);
  row.appendChild(info);
  row.appendChild(right);
  box.appendChild(row);
}

async function addCustomCity(r, candles) {
  const d = wizardState.draft;
  const tzid = r.tzid || await resolveTz(r.lat, r.lng);
  if (!tzid) return false;
  if (!allCities(d).some(c => c.key === r.key)) {
    d.customCities.push({
      key: r.key,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      tzid,
      candles: candles || 18,
      israel: tzid === 'Asia/Jerusalem'
    });
  }
  if (!d.cities.includes(r.key)) d.cities.push(r.key);
  renderCityGrid();
  return true;
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
    d.photoZoom = Number($('photoZoom').value);
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
    // custom cities that were unchecked are dropped for good
    d.customCities = d.customCities.filter(c => picked.includes(c.key));
  } else if (i === 4) {
    const rb = document.querySelector('input[name="tplPick"]:checked');
    if (!rb) return 'בחרו אחד מהעיצובים';
    d.template = rb.value;
    const tn = document.querySelector('input[name="tonePick"]:checked');
    d.tone = tn ? tn.value : 'natural';
  } else if (i === 5) {
    const rb = document.querySelector('input[name="fontPick"]:checked');
    if (!rb) return 'בחרו סגנון כתב';
    d.fontPair = rb.value;
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
      refreshPhotoPreview();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ---------- settings file ----------
 * The file IS the account: no server, no registration, no key. A family sets
 * the board up once, saves the file, and can send it in WhatsApp to open the
 * same board on another phone. */

function exportSettings() {
  if (!settings) return;
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const safe = (settings.name || 'לוח').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-');
  a.download = 'הגדרות-' + safe + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus('ההגדרות נשמרו לקובץ. שמרו אותו — אפשר לפתוח אותו בכל מכשיר אחר.');
}

function importSettings(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (!s || !s.name || !Array.isArray(s.cities) || !s.cities.length) {
        throw new Error('bad shape');
      }
      if (!TEMPLATES[s.template]) s.template = 'classic';
      if (!FONT_PAIRS[s.fontPair]) s.fontPair = 'classic';
      if (!TONES[s.tone]) s.tone = 'natural';
      if (!Array.isArray(s.customCities)) s.customCities = [];
      settings = s;
      saveSettings(settings);
      photoImage = null;
      applySettingsToHeader();
      closeWizardToBoard();
      generate();
    } catch (e) {
      setStatus('הקובץ אינו קובץ הגדרות תקין של הכלי.', true);
    }
  };
  reader.readAsText(file);
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
$('importFile').addEventListener('change', e => importSettings(e.target.files[0]));
$('wizImport').addEventListener('click', () => $('importFile').click());
$('wizExport').addEventListener('click', exportSettings);
$('nudgeSave').addEventListener('click', () => { exportSettings(); dismissNudge(); });
$('nudgeLater').addEventListener('click', dismissNudge);

$('wizNext').addEventListener('click', wizardNext);
$('wizPrev').addEventListener('click', () => showStep(Math.max(0, wizardState.step - 1)));
$('wizCancel').addEventListener('click', () => {
  if (settings) { closeWizardToBoard(); }
});

$('photoDrop').addEventListener('click', () => $('photoFile').click());
$('photoFile').addEventListener('change', e => handlePhotoFile(e.target.files[0]));
$('photoOffset').addEventListener('input', () => {
  wizardState.draft.photoOffset = Number($('photoOffset').value);
  refreshPhotoPreview();
});
$('photoZoom').addEventListener('input', () => {
  wizardState.draft.photoZoom = Number($('photoZoom').value);
  refreshPhotoPreview();
});
$('citySearchBtn').addEventListener('click', searchCity);
$('citySearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); searchCity(); }
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
      settings.name = 'שם היקר/ה';
      settings.dateLine = 'תאריך הפטירה';
      settings.verse = 'נר ה׳ נשמת אדם';
      settings.template = urlParams.get('tpl') || 'classic';
      settings.fontPair = urlParams.get('font') || 'classic';
      settings.tone = urlParams.get('tone') || 'natural';
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
