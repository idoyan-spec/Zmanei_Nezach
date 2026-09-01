/* Pulls the aggregates from the collector and drops them next to the
 * dashboard as stats.js, then opens the page.
 *
 *   node dashboard/refresh.mjs
 *
 * The admin token is fetched from Bitwarden Secrets Manager at run time and
 * never written anywhere — not to a file, not into the page, not into a URL.
 * It exists for the length of a few HTTPS requests.
 */
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
/* A .js payload rather than .json on purpose: the dashboard is opened straight
 * from disk, and a file:// page is not allowed to fetch a file next to it —
 * but it may always load a script. */
const OUT = join(HERE, 'stats.js');

/* Set these two once, after the collector is deployed — as environment
 * variables, or by editing the two defaults here. */
const COLLECTOR = process.env.ZN_COLLECTOR || '';
const BWS_SECRET_ID = process.env.ZN_TOKEN_SECRET_ID || '';

/* All four periods are fetched in one go and stored together. A dashboard
 * whose period buttons each need a terminal command behind them is a
 * dashboard on which nobody ever changes the period. */
const RANGES = [7, 30, 90, 365];

function die(msg, hint) {
  console.error('\n  ' + msg + (hint ? '\n  ' + hint : '') + '\n');
  process.exit(1);
}

function token() {
  /* Bitwarden first, as the project's rule requires. A plain environment
   * variable is the escape hatch for a machine with no bws configured. */
  if (BWS_SECRET_ID) {
    try {
      const out = execFileSync('bws', ['secret', 'get', BWS_SECRET_ID, '-o', 'json'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const v = JSON.parse(out).value;
      if (v) return v.trim();
    } catch (e) {
      die('לא הצלחתי לקרוא את הטוקן מ-Bitwarden.',
          'ודאו ש-BWS_ACCESS_TOKEN מוגדר ושמזהה הסוד נכון: ' + BWS_SECRET_ID);
    }
  }
  if (process.env.ZN_ADMIN_TOKEN) return process.env.ZN_ADMIN_TOKEN.trim();
  die('אין טוקן גישה.',
      'הגדירו ZN_TOKEN_SECRET_ID (מזהה הסוד ב-Bitwarden) או ZN_ADMIN_TOKEN.');
}

if (!COLLECTOR) {
  die('כתובת האוסף לא הוגדרה.',
      'הגדירו ZN_COLLECTOR לכתובת ה-Worker, למשל https://zmanei-nezach-usage.<שם>.workers.dev');
}

const auth = { Authorization: 'Bearer ' + token() };
const base = COLLECTOR.replace(/\/+$/, '');
const ranges = {};

for (const days of RANGES) {
  const res = await fetch(base + '/stats?days=' + days, { headers: auth });
  if (res.status === 401) {
    die('האוסף דחה את הטוקן (401).',
        'הטוקן שנשלף שונה מזה שהוגדר ב-wrangler secret put ADMIN_TOKEN.');
  }
  if (!res.ok) {
    die('האוסף החזיר ' + res.status + ' עבור ' + days + ' ימים.', await res.text().catch(() => ''));
  }
  ranges[days] = await res.json();
}

writeFileSync(OUT,
  'window.ZN_STATS = ' + JSON.stringify({ generated: new Date().toISOString(), ranges }, null, 1) + ';' + String.fromCharCode(10),
  'utf8');

const t = (ranges[30] || {}).totals || {};
console.log('\n  נשמר: ' + OUT);
console.log('  30 יום · ' + (t.visits || 0) + ' ביקורים · ' +
            (t.boards || 0) + ' לוחות · ' + (t.saves || 0) + ' שמירות');
console.log('  (נשמרו גם ' + RANGES.join(', ') + ' ימים — כל הכפתורים בדשבורד יעבדו)\n');

const page = join(HERE, 'usage-dashboard.html');
if (existsSync(page) && !process.argv.includes('--no-open')) {
  spawn('cmd', ['/c', 'start', '""', page], { detached: true, stdio: 'ignore' }).unref();
}
