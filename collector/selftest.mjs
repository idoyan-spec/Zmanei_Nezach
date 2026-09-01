/* Runs the real worker.js against a real SQLite database through a minimal D1
 * shim, so the SQL is proven before anyone deploys it. Node 25 ships
 * node:sqlite, so this needs nothing installed.
 *
 *   node collector/selftest.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.js';

const db = new DatabaseSync(':memory:');
for (const stmt of readFileSync(new URL('./schema.sql', import.meta.url), 'utf8').split(';')) {
  if (stmt.trim()) db.exec(stmt);
}

/* the slice of the D1 API worker.js actually uses */
const D1 = {
  prepare(sql) {
    let args = [];
    return {
      bind(...a) { args = a.map(v => (v === undefined ? null : v)); return this; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      _run() { db.prepare(sql).run(...args); }
    };
  },
  async batch(stmts) { for (const s of stmts) s._run(); }
};

const env = { DB: D1, ADMIN_TOKEN: 'test-token' };
const ORIGIN = 'https://idoyan-spec.github.io';

const post = (body) => worker.fetch(new Request('https://c.example/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-IPCountry': 'IL' },
  body: JSON.stringify(body)
}), env);

let fails = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  <- ' + JSON.stringify(extra)));
  if (!cond) fails++;
};

/* ---- a realistic afternoon of traffic ---- */
await post({ kind: 'visit', ref: 'web.whatsapp.com', dev: 'mobile', lang: 'he-IL' });
await post({ kind: 'visit', ref: 'direct', dev: 'desktop', lang: 'he' });
await post({ kind: 'visit', ref: 'google.com', dev: 'mobile', lang: 'he' });
for (let i = 0; i <= 5; i++) await post({ kind: 'step', step: i });
for (let i = 0; i <= 2; i++) await post({ kind: 'step', step: i });   // this one gave up at step 2
for (let i = 0; i <= 0; i++) await post({ kind: 'step', step: i });   // and this one bounced at once
await post({
  kind: 'board', pattern: 'mist', palette: 'navy', font: 'classic', ncities: 4,
  cities: ['jerusalem', 'telaviv', 'il:טלמון', 'tz:Europe/London'],
  verse: 'v1', ded: '1', photo: 1, mode: 'shabbat', secs: 240
});
await post({
  kind: 'board', pattern: 'dunes', palette: 'stone', font: 'classic', ncities: 2,
  cities: ['jerusalem', 'il:טלמון'],
  verse: 'custom', ded: '0', photo: 1, mode: 'shabbat', secs: 180
});
await post({ kind: 'board', pattern: 'mist', palette: 'navy', font: 'modern', ncities: 1,
  cities: ['haifa'], verse: 'none', ded: '2', photo: 0, mode: 'chag', secs: 0 });
await post({ kind: 'save', how: 'download' });
await post({ kind: 'save', how: 'share' });

/* ---- things that must be refused ---- */
await post({ kind: 'board', pattern: '<script>x</script>', palette: 'navy', font: 'classic',
             verse: 'מרים בת אברהם', ncities: 2, cities: ['jerusalem'], mode: 'shabbat', secs: 5 });
await post({ kind: 'nonsense', payload: 'whatever' });
await post({ kind: 'visit', ref: 'x'.repeat(500), dev: 'phone', lang: 'x'.repeat(50) });

const bad = db.prepare("SELECT COUNT(*) c FROM ev WHERE pattern LIKE '%script%' OR verse LIKE '%מרים%'").get();
ok('a pattern that is not one of the ten is stored as NULL, not as text', bad.c === 0, bad);
ok('a verse that is free text is stored as NULL, not as the words',
   db.prepare("SELECT COUNT(*) c FROM ev WHERE verse NOT IN ('none','custom','v1','v2','v3','v4','v5') AND verse IS NOT NULL").get().c === 0);
ok('an unknown event kind writes no row',
   db.prepare("SELECT COUNT(*) c FROM ev WHERE kind='nonsense'").get().c === 0);
ok('an over-long referrer is clipped to 40 chars',
   (db.prepare("SELECT MAX(LENGTH(ref)) m FROM ev").get().m || 0) <= 40);
ok('a device that is neither mobile nor desktop is dropped',
   db.prepare("SELECT COUNT(*) c FROM ev WHERE dev NOT IN ('mobile','desktop') AND dev IS NOT NULL").get().c === 0);
ok('no column anywhere holds a name',
   db.prepare("SELECT COUNT(*) c FROM ev WHERE ref LIKE '%מרים%' OR how LIKE '%מרים%'").get().c === 0);

/* ---- the report ---- */
const unauth = await worker.fetch(new Request('https://c.example/stats?days=90', {
  headers: { Origin: ORIGIN }
}), env);
ok('/stats without a token is refused', unauth.status === 401, unauth.status);

const res = await worker.fetch(new Request('https://c.example/stats?days=90', {
  headers: { Origin: ORIGIN, Authorization: 'Bearer test-token' }
}), env);
ok('/stats with the token answers 200', res.status === 200, res.status);
const s = await res.json();

ok('visits counted', Number(s.totals.visits) === 4, s.totals);
ok('boards counted', Number(s.totals.boards) === 3, s.totals);
ok('saves counted', Number(s.totals.saves) === 2, s.totals);
ok('mist is the most popular design', s.patterns[0].k === 'mist' && s.patterns[0].n === 2, s.patterns);
ok('navy is the most popular palette', s.palettes[0].k === 'navy', s.palettes);
const jlm = s.cities.find(c => c.k === 'jerusalem');
ok('jerusalem counted once per board it appeared on', jlm && jlm.n === 2, s.cities.slice(0, 3));
ok('city ranking is stable, not tie-order-dependent',
   s.cities.map(c => c.n).every((n, i, a) => i === 0 || a[i - 1] >= n), s.cities.slice(0, 4));
ok('a searched yishuv is reported by OUR list name', s.cities.some(c => c.k === 'il:טלמון' && c.n === 2), s.cities);
ok('abroad is reported as a timezone, never a place name',
   s.cities.some(c => c.k === 'tz:Europe/London'), s.cities);
ok('drop-off visible: 3 reached step 0, 2 reached step 2, 1 reached step 5',
   s.steps[0].n === 3 && s.steps[2].n === 2 && s.steps[5].n === 1, s.steps);
ok('average duration ignores the zero-second reruns',
   Math.round(Number(s.duration.avg)) === 210 && Number(s.duration.n) === 2, s.duration);
ok('verse popularity is by index only',
   s.verses.every(v => /^(none|custom|v[1-9])$/.test(v.k)), s.verses);
ok('daily series present', Array.isArray(s.daily) && s.daily.length >= 1, s.daily);
ok('referrers include whatsapp', s.refs.some(r => r.k === 'web.whatsapp.com'), s.refs);
ok('devices split', s.devices.length === 2, s.devices);
ok('photo usage counted', s.photos.length === 2, s.photos);

console.log(fails ? `\n${fails} FAILED` : '\nall green');
process.exit(fails ? 1 : 0);
