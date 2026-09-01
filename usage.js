/* ============================================================================
 * usage.js — the ONLY file in this project that sends anything anywhere.
 *
 * It is deliberately a separate file, and deliberately short, so that the
 * whole answer to "what does this tool tell its author about me?" can be read
 * in one sitting and deleted in one keystroke.
 *
 * The tool's front page promises grieving families this, in these words:
 *
 *     "הכול נשמר במכשיר שלכם בלבד — אין כאן חשבון משתמש
 *      ואף אחד אחר לא רואה את מה שהזנתם."
 *
 * So the rule this file obeys is absolute: NOTHING THE USER TYPED OR CHOSE
 * FROM THEIR OWN LIFE LEAVES THE DEVICE. Not the name of the deceased, not
 * the date line, not a custom verse, not the photo, not a renamed city.
 * What leaves is counters over closed vocabularies the code itself defines —
 * which of ten designs, which of fourteen palettes, which preset verse by
 * its index. A counter cannot name anybody.
 *
 * Where a value could carry typed text it is mapped back onto the project's
 * own data before it is sent: an added locality is reported as the name in
 * OUR bundled cities-il.json nearest to its coordinates, never as the string
 * the user typed into the search box or the rename field.
 *
 * Off by default. With ENDPOINT empty, not one byte goes anywhere and no
 * network call is made at all — see send().
 * ========================================================================= */
'use strict';

const ZN_USAGE = {
  /* Paste the deployed Worker URL here to switch collection on. While this is
   * empty the tool behaves exactly as it did before this file existed. */
  ENDPOINT: '',

  /* Shown to visitors the moment collection is switched on, so the promise on
   * the front page can never quietly drift out of true. */
  DISCLOSURE: 'נאספים נתוני שימוש אנונימיים (כמה לוחות נוצרו, אילו עיצובים וערים נבחרו). ' +
              'השם, התאריך, המשפט והתמונה שהזנתם אינם נשלחים לשום מקום.'
};

(function () {
  const ON = !!ZN_USAGE.ENDPOINT;

  /* ---------- disclosure ----------
   * Rendered from the same flag that enables sending, so turning collection
   * on cannot be separated from telling people about it. */
  function discloseWhenReady() {
    if (!ON) return;
    const put = function () {
      document.querySelectorAll('[data-usage-note]').forEach(function (el) {
        if (el.dataset.filled) return;
        el.dataset.filled = '1';
        el.textContent = ' ' + ZN_USAGE.DISCLOSURE;
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', put);
    } else {
      put();
    }
  }
  discloseWhenReady();

  /* ---------- transport ----------
   * Fire and forget, and wrapped so that a blocked request, an ad blocker or
   * a dead endpoint can never take the tool down with it. A family trying to
   * make a board for Shabbat must not be stopped by a counter. */
  function send(body) {
    if (!ON) return;
    try {
      const json = JSON.stringify(body);
      /* text/plain, although the body is JSON. A beacon is only allowed the
       * three CORS-safelisted content types; label it application/json and the
       * browser demands a preflight that sendBeacon cannot perform, so the
       * request is dropped before it is ever sent — silently, with nothing in
       * the console. The collector parses the body regardless of its label. */
      const blob = new Blob([json], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon && navigator.sendBeacon(ZN_USAGE.ENDPOINT, blob)) return;
      fetch(ZN_USAGE.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: json,
        keepalive: true
      }).catch(function () { /* counters are never worth an error */ });
    } catch (e) { /* same */ }
  }

  /* ---------- helpers ---------- */

  /* Referrer host only. The full URL of the page someone came from can carry
   * a search query, and a search query can carry a name. */
  function refHost() {
    try {
      if (!document.referrer) return 'direct';
      const h = new URL(document.referrer).hostname.replace(/^www\./, '');
      return h === location.hostname ? 'direct' : h.slice(0, 40);
    } catch (e) { return 'direct'; }
  }

  function deviceKind() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  }

  function km(lat1, lng1, lat2, lng2) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* The one place where a user-supplied place could leak. A city the user
   * searched for — and may then have renamed to anything at all — is reported
   * as the name OUR OWN bundled list gives to the nearest locality, or, when
   * there is no match, as nothing more specific than a timezone. The string
   * that goes out is therefore always one of ours, never one of theirs. */
  function cityTag(c) {
    try {
      if (typeof CITIES !== 'undefined' && CITIES.some(function (p) { return p.key === c.key; })) {
        return c.key;                                   // a preset: key is ours
      }
      if (typeof ilCities !== 'undefined' && ilCities && ilCities.length &&
          isFinite(c.lat) && isFinite(c.lng)) {
        let best = null, bestD = 6;                     // 6km is one locality
        for (let i = 0; i < ilCities.length; i++) {
          const p = ilCities[i];
          const d = km(c.lat, c.lng, p.y, p.x);
          if (d < bestD) { bestD = d; best = p; }
        }
        if (best) return 'il:' + best.h;
      }
      return 'tz:' + String(c.tzid || 'unknown').slice(0, 40);
    } catch (e) { return 'tz:unknown'; }
  }

  /* A verse is reported by its position in the fixed VERSES list. A verse the
   * user wrote themselves is reported as the fact that they wrote one. */
  function verseTag(v) {
    try {
      if (!v) return 'none';
      const i = VERSES.indexOf(v);
      return i > 0 ? 'v' + i : 'custom';
    } catch (e) { return 'unknown'; }
  }

  /* ---------- the events ---------- */

  let started = 0;                       // when this visitor opened the wizard
  let deepest = -1;                      // furthest wizard step reached

  const api = {
    /* once per browser session, so a refresh is not a new visitor */
    visit: function () {
      if (!ON) return;
      try {
        if (sessionStorage.getItem('zn.seen')) return;
        sessionStorage.setItem('zn.seen', '1');
      } catch (e) { /* private mode: count it, better than losing it */ }
      send({ kind: 'visit', ref: refHost(), dev: deviceKind(), lang: (navigator.language || '').slice(0, 5) });
    },

    wizardStart: function () {
      started = Date.now();
      deepest = -1;
    },

    /* Only the furthest step is reported, and only once, so stepping back and
     * forth does not read as six people abandoning six times. */
    step: function (i) {
      if (!ON || i <= deepest) return;
      deepest = i;
      send({ kind: 'step', step: i });
    },

    board: function (s, plan, rows) {
      if (!ON) return;
      try {
        const cities = (typeof allCities === 'function' ? allCities(s) : [])
          .filter(function (c) { return (s.cities || []).indexOf(c.key) > -1; });
        send({
          kind: 'board',
          pattern: s.template,
          palette: s.palette,
          font: s.fontPair,
          ncities: cities.length,
          cities: cities.map(cityTag),
          verse: verseTag(s.verse),
          ded: String((typeof DEDICATIONS !== 'undefined' ? DEDICATIONS.indexOf(s.dedication) : -1)),
          photo: s.photo ? 1 : 0,
          mode: (plan && plan.mode) || 'unknown',
          /* seconds from opening the wizard to a finished board — 0 when the
           * board was made from settings that already existed */
          secs: started ? Math.min(3600, Math.round((Date.now() - started) / 1000)) : 0
        });
        started = 0;
      } catch (e) { /* never break a board over a counter */ }
    },

    save: function (how) {
      if (!ON) return;
      send({ kind: 'save', how: how });
    }
  };

  window.ZN_TRACK = api;
})();
