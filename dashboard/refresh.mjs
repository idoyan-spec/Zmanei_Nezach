/* Pulls the aggregates from the collector and writes them next to the
 * dashboard, then opens the page.
 *
 * This script knows nothing about where secrets live. It reads two
 * environment variables and that is all — per the house rule in
 * ~/.claude/HOW_TO_ADD_KEY.md: "הקוד לא יודע מאיפה המפתח מגיע. הוא רק קורא
 * ל-os.environ". The launcher injects them with `bws run`.
 *
 *   ZN_COLLECTOR    the deployed Worker URL
 *   ZN_ADMIN_TOKEN  the bearer token that /stats requires
 *
 * Run it through the launcher, never directly:
 *   dashboard\refresh.cmd
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/* A .js payload rather than .json on purpose: the dashboard is opened straight
 * from disk, and a file:// page is not allowed to fetch a file next to it —
 * but it may always load a script. */
const OUT = join(HERE, 'stats.js');

/* All four periods are fetched in one go and stored together. A dashboard
 * whose period buttons each need a terminal command behind them is a
 * dashboard on which nobody ever changes the period. */
const RANGES = [7, 30, 90, 365];

function die(msg, hint) {
  console.error('\n  ' + msg + (hint ? '\n  ' + hint : '') + '\n');
  process.exit(1);
}

const COLLECTOR = (process.env.ZN_COLLECTOR || '').trim();
const TOKEN = (process.env.ZN_ADMIN_TOKEN || '').trim();

if (!COLLECTOR) die('ZN_COLLECTOR חסר.', 'הפעילו דרך refresh.cmd — הוא מזריק את הסודות מ-Bitwarden.');
if (!TOKEN) die('ZN_ADMIN_TOKEN חסר.', 'הפעילו דרך refresh.cmd — הוא מזריק את הסודות מ-Bitwarden.');

const auth = { Authorization: 'Bearer ' + TOKEN };
const base = COLLECTOR.replace(/\/+$/, '');
const ranges = {};

for (const days of RANGES) {
  const res = await fetch(base + '/stats?days=' + days, { headers: auth });
  if (res.status === 401) {
    die('האוסף דחה את הטוקן (401).',
        'ZN_ADMIN_TOKEN ב-Bitwarden שונה מזה שהוגדר ב-wrangler secret put ADMIN_TOKEN.');
  }
  if (!res.ok) {
    die('האוסף החזיר ' + res.status + ' עבור ' + days + ' ימים.', await res.text().catch(() => ''));
  }
  ranges[days] = await res.json();
}

writeFileSync(OUT,
  'window.ZN_STATS = ' + JSON.stringify({ generated: new Date().toISOString(), ranges }, null, 1) +
  ';' + String.fromCharCode(10),
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
