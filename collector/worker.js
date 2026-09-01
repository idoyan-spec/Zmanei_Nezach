/* ============================================================================
 * Zmanei Nezach — usage collector
 *
 * A Cloudflare Worker with a D1 database. Two routes and nothing else:
 *
 *   POST /            a browser reports one anonymous event
 *   GET  /stats       the author's local dashboard reads the aggregates,
 *                     with a bearer token that only they hold
 *
 * Why a row per event and not a counter per key: KV's free tier allows a
 * thousand writes a day, and one finished board touches a dozen counters, so
 * a busy Friday would silently stop recording. D1 takes one INSERT per event
 * and does the arithmetic at read time, where it belongs.
 *
 * The IP address is never written. Cloudflare hands us one on every request
 * and we use it for nothing but the country letter code it already resolved.
 * ========================================================================= */

const ALLOWED_ORIGINS = [
  'https://idoyan-spec.github.io',
  'http://127.0.0.1:8783',
  'http://localhost:8783',
  'http://127.0.0.1:8783'
];

/* Closed vocabularies. Anything arriving that is not on these lists is
 * dropped rather than stored — a collector that writes whatever it is handed
 * is one bug away from being a place personal text ends up. */
const PATTERNS = ['mist', 'halo', 'bloom', 'waves', 'dunes', 'strata', 'aurora', 'veins', 'orbit', 'arch'];
const PALETTES = ['navy', 'olive', 'stone', 'amber', 'sage', 'tchelet', 'wine', 'rose',
                  'plum', 'forest', 'slate', 'sand', 'midnight', 'charcoal'];
const FONTS = ['classic', 'modern', 'festive', 'soft', 'stone'];
const MODES = ['shabbat', 'fast', 'chag', 'unknown'];
const SAVES = ['download', 'share'];

const pick = (v, list) => (list.indexOf(v) > -1 ? v : null);
const int = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), max) : 0;
};
/* Free text never reaches the database, but a label can still be absurdly
 * long by accident; clip everything on the way in. */
const label = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);

function cors(origin) {
  const ok = ALLOWED_ORIGINS.indexOf(origin) > -1;
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const head = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });

    if (url.pathname === '/stats' && request.method === 'GET') {
      return stats(request, env, head);
    }
    if (request.method === 'POST') {
      return collect(request, env, head);
    }
    return new Response('not found', { status: 404, headers: head });
  }
};

/* -------------------------------------------------------------- collecting */

async function collect(request, env, head) {
  let b;
  try {
    b = await request.json();
  } catch (e) {
    return new Response('bad json', { status: 400, headers: head });
  }

  const now = Math.floor(Date.now() / 1000);
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  const country = request.headers.get('CF-IPCountry') || 'XX';
  const kind = pick(b.kind, ['visit', 'step', 'board', 'save']);
  if (!kind) return new Response('ok', { headers: head });   // never argue, just drop

  const rows = [];

  if (kind === 'visit') {
    rows.push(env.DB.prepare(
      'INSERT INTO ev (ts,day,kind,ref,dev,country,lang) VALUES (?,?,?,?,?,?,?)'
    ).bind(now, day, 'visit', label(b.ref, 40), pick(b.dev, ['mobile', 'desktop']), country, label(b.lang, 5)));
  }

  if (kind === 'step') {
    rows.push(env.DB.prepare(
      'INSERT INTO ev (ts,day,kind,step,country) VALUES (?,?,?,?,?)'
    ).bind(now, day, 'step', int(b.step, 10), country));
  }

  if (kind === 'save') {
    rows.push(env.DB.prepare(
      'INSERT INTO ev (ts,day,kind,how,country) VALUES (?,?,?,?,?)'
    ).bind(now, day, 'save', pick(b.how, SAVES), country));
  }

  if (kind === 'board') {
    /* Our own client can only ever send one of the ten designs. Anything else
     * is a bug or a stranger poking the endpoint, and counting it would
     * inflate "boards created" — the one number here that has to be true. */
    if (!pick(b.pattern, PATTERNS)) return new Response('ok', { headers: head });
    rows.push(env.DB.prepare(
      `INSERT INTO ev (ts,day,kind,pattern,palette,font,ncities,verse,ded,photo,mode,secs,country)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      now, day, 'board',
      pick(b.pattern, PATTERNS), pick(b.palette, PALETTES), pick(b.font, FONTS),
      int(b.ncities, 8),
      /* a verse is 'none', 'custom', or v1..v5 — never the words themselves */
      (/^(none|custom|v[1-9])$/.test(b.verse) ? b.verse : null),
      (/^-?[0-9]$/.test(String(b.ded)) ? String(b.ded) : null),
      b.photo ? 1 : 0,
      pick(b.mode, MODES),
      int(b.secs, 3600),
      country
    ));

    /* Cities go in their own table: one board carries up to eight, and a
     * column per city would be a schema that lies about the shape. */
    if (Array.isArray(b.cities)) {
      b.cities.slice(0, 8).forEach(function (tag) {
        const t = label(tag, 60);
        if (t) rows.push(env.DB.prepare('INSERT INTO city (ts,day,tag) VALUES (?,?,?)').bind(now, day, t));
      });
    }
  }

  try {
    if (rows.length) await env.DB.batch(rows);
  } catch (e) {
    /* A collector that returns an error teaches the browser to retry, and a
     * retry storm over a counter is worse than a lost row. */
  }
  return new Response('ok', { headers: head });
}

/* --------------------------------------------------------------- reporting */

async function stats(request, env, head) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return new Response('unauthorized', { status: 401, headers: head });
  }

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 90));
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const q = (sql, ...bind) => env.DB.prepare(sql).bind(...bind).all().then(r => r.results || []);

  const [totals, daily, patterns, palettes, fonts, cities, steps, refs, devices,
         countries, verses, saves, ncities, duration, modes, photos] = await Promise.all([
    q(`SELECT
         SUM(kind='visit') AS visits,
         SUM(kind='board') AS boards,
         SUM(kind='save')  AS saves
       FROM ev WHERE day >= ?`, from),
    q(`SELECT day,
         SUM(kind='visit') AS visits,
         SUM(kind='board') AS boards
       FROM ev WHERE day >= ? GROUP BY day ORDER BY day`, from),
    q(`SELECT pattern AS k, COUNT(*) AS n FROM ev
       WHERE kind='board' AND pattern IS NOT NULL AND day >= ?
       GROUP BY pattern ORDER BY n DESC, k`, from),
    q(`SELECT palette AS k, COUNT(*) AS n FROM ev
       WHERE kind='board' AND palette IS NOT NULL AND day >= ?
       GROUP BY palette ORDER BY n DESC, k`, from),
    q(`SELECT font AS k, COUNT(*) AS n FROM ev
       WHERE kind='board' AND font IS NOT NULL AND day >= ?
       GROUP BY font ORDER BY n DESC, k`, from),
    q(`SELECT tag AS k, COUNT(*) AS n FROM city
       WHERE day >= ? GROUP BY tag ORDER BY n DESC, k LIMIT 60`, from),
    /* COUNT(*), not COUNT(DISTINCT ts): the client already sends each step
       at most once per visit, and de-duplicating by timestamp would merge two
       different people who happened to reach the same step in the same second. */
    q(`SELECT step AS k, COUNT(*) AS n FROM ev
       WHERE kind='step' AND day >= ? GROUP BY step ORDER BY step`, from),
    q(`SELECT ref AS k, COUNT(*) AS n FROM ev
       WHERE kind='visit' AND ref IS NOT NULL AND day >= ?
       GROUP BY ref ORDER BY n DESC, k LIMIT 20`, from),
    q(`SELECT dev AS k, COUNT(*) AS n FROM ev
       WHERE kind='visit' AND dev IS NOT NULL AND day >= ? GROUP BY dev`, from),
    q(`SELECT country AS k, COUNT(*) AS n FROM ev
       WHERE kind='visit' AND day >= ? GROUP BY country ORDER BY n DESC, k LIMIT 20`, from),
    q(`SELECT verse AS k, COUNT(*) AS n FROM ev
       WHERE kind='board' AND verse IS NOT NULL AND day >= ?
       GROUP BY verse ORDER BY n DESC, k`, from),
    q(`SELECT how AS k, COUNT(*) AS n FROM ev
       WHERE kind='save' AND how IS NOT NULL AND day >= ? GROUP BY how`, from),
    q(`SELECT ncities AS k, COUNT(*) AS n FROM ev
       WHERE kind='board' AND day >= ? GROUP BY ncities ORDER BY ncities`, from),
    /* Boards made from settings that already existed report secs=0; counting
       them would drag the average toward zero and make the wizard look faster
       than anyone has ever experienced it. */
    q(`SELECT AVG(secs) AS avg, COUNT(*) AS n,
              MIN(secs) AS lo, MAX(secs) AS hi
       FROM ev WHERE kind='board' AND secs > 0 AND day >= ?`, from),
    q(`SELECT mode AS k, COUNT(*) AS n FROM ev
       WHERE kind='board' AND mode IS NOT NULL AND day >= ? GROUP BY mode ORDER BY n DESC, k`, from),
    q(`SELECT photo AS k, COUNT(*) AS n FROM ev
       WHERE kind='board' AND day >= ? GROUP BY photo`, from)
  ]);

  return new Response(JSON.stringify({
    generated: new Date().toISOString(),
    days, from,
    totals: totals[0] || {},
    daily, patterns, palettes, fonts, cities, steps, refs, devices,
    countries, verses, saves, ncities, modes, photos,
    duration: duration[0] || {}
  }), { headers: Object.assign({ 'Content-Type': 'application/json' }, head) });
}
