/* לוח שבת לזכרם — כלי אישי ליצירת לוח זמני שבת לזכר יקיריכם */
'use strict';

const BUILD = '2026-09-01 09:40 v7 watercolour-depth-city-rename';

const W = 1254, H = 1254;
const SETTINGS_KEY = 'memorialBoard.v1';

/* ================= amorphous background engine =================
 * The board art is no longer a photograph. Every design is drawn as vector
 * shapes at export resolution, which buys three things a picture cannot:
 *   - any design can be painted in any palette, because nothing is baked in;
 *   - a gallery thumbnail is a real render, not a downscaled JPEG;
 *   - the whole gallery costs zero bytes over the wire.
 * A design is therefore a pair: a PATTERN (the composition) and a PALETTE
 * (the colours). 10 x 14 = 140 backgrounds, times 5 type pairs. */

/* deterministic noise, so a design looks identical every single week */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h;
  const n = parseInt(full, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/* A closed organic outline: polar points with seeded jitter, joined by
 * quadratics through their midpoints, so there is not a single straight
 * segment or visible vertex anywhere on the curve. */
function blobPath(c, cx, cy, rx, ry, pts, wob, rnd, rot) {
  const P = [];
  for (let i = 0; i < pts; i++) {
    const a = rot + i / pts * Math.PI * 2;
    const k = 1 + (rnd() * 2 - 1) * wob;
    P.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  c.beginPath();
  const m0 = mid(P[pts - 1], P[0]);
  c.moveTo(m0[0], m0[1]);
  for (let i = 0; i < pts; i++) {
    const cur = P[i], nxt = P[(i + 1) % pts];
    const m = mid(cur, nxt);
    c.quadraticCurveTo(cur[0], cur[1], m[0], m[1]);
  }
  c.closePath();
}

/* One soft disc of colour. The gradient is circular and the context is
 * squashed, so the fade reaches nothing at exactly the outline — nothing
 * clips a gradient that still has pigment in it, which is what put hard
 * flat-sided edges on the first attempt. */
function disc(c, cx, cy, rx, ry, color, a) {
  if (rx <= 0 || ry <= 0) return;
  c.save();
  c.translate(cx, cy);
  c.scale(1, ry / rx);
  c.translate(-cx, -cy);
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, hexA(color, a));
  g.addColorStop(0.42, hexA(color, a * 0.84));
  g.addColorStop(0.72, hexA(color, a * 0.44));
  g.addColorStop(0.90, hexA(color, a * 0.13));
  g.addColorStop(1, hexA(color, 0));
  c.fillStyle = g;
  c.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
  c.restore();
}

/* A wash of colour built as a cluster of soft discs rather than one filled
 * outline. Two things fall out of that for free: the silhouette is amorphous
 * with no edge anywhere, and where the discs of a single cluster overlap the
 * pigment reads as denser — which is the pooling and granulation that makes
 * watercolour look like paint instead of a printed gradient. `layers`
 * repeats the whole cluster smaller and weaker, the way a second pass is
 * laid over a first once it has dried. */
function wash(c, cx, cy, rx, ry, color, a, rnd, o) {
  o = o || {};
  const puffs = o.puffs || 8;
  const layers = o.layers || 1;
  for (let L = 0; L < layers; L++) {
    const k = 1 - L * 0.17;
    const al = a * (L === 0 ? 0.72 : 0.46 - L * 0.07);
    disc(c, cx, cy, rx * 0.82 * k, ry * 0.82 * k, color, al * 1.05);
    /* The discs are large, close in and individually faint on purpose. Small
     * distinct ones at full strength read as bubbles; heavily overlapped ones
     * merge into a single amorphous mass whose density still varies. */
    for (let i = 0; i < puffs; i++) {
      const ang = (i + rnd() * 0.85) / puffs * Math.PI * 2;
      const d = 0.16 + rnd() * 0.42;
      const pr = 0.42 + rnd() * 0.34;
      disc(c, cx + Math.cos(ang) * rx * d * k, cy + Math.sin(ang) * ry * d * k,
        rx * pr * k, ry * pr * k, color, al * (0.26 + rnd() * 0.30));
    }
  }
}

/* kept for callers that want a single soft pass */
function softBlob(c, cx, cy, rx, ry, color, a, rnd, o) {
  wash(c, cx, cy, rx, ry, color, a, rnd, o);
}
/* Watercolour gets its depth from pigment laid over pigment: two washes that
 * overlap make a third colour, they do not merely sit next to one another.
 * `multiply` on light paper and `screen` on dark is exactly that behaviour,
 * and it is the single reason these backgrounds stopped looking flat. */
function mixed(c, P, fn) {
  c.save();
  c.globalCompositeOperation = P.dark ? 'screen' : 'multiply';
  fn();
  c.restore();
}

/* Pigment does not dry evenly — it granulates, settling into the tooth of
 * the paper in blotches. Forty barely-there specks of the palette's darkest
 * and lightest notes, and a flat wash starts to look like it was painted. */
function mottle(c, w, h, P, rnd, strength) {
  c.save();
  c.globalCompositeOperation = P.dark ? 'screen' : 'multiply';
  for (let i = 0; i < 46; i++) {
    const cx = rnd() * w, cy = rnd() * h;
    const r = w * (0.03 + rnd() * 0.10);
    const col = rnd() < 0.62 ? (P.deep || P.c1) : P.c3;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, hexA(col, strength * (0.5 + rnd() * 0.5)));
    g.addColorStop(0.6, hexA(col, strength * 0.35));
    g.addColorStop(1, hexA(col, 0));
    c.fillStyle = g;
    c.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  c.restore();
}

/* Every composition keeps its middle clear for the type, and a middle of
 * bare paper is a hole. This lays the faintest all-over tint and a little
 * granulation back on top afterwards — not enough to touch legibility, but
 * enough that the centre of the board is painted rather than blank. */
function veil(c, w, h, P, rnd) {
  c.save();
  c.globalCompositeOperation = P.dark ? 'screen' : 'multiply';
  const g = c.createLinearGradient(0, 0, w * 0.6, h);
  g.addColorStop(0, hexA(P.c2, P.dark ? 0.12 : 0.15));
  g.addColorStop(0.5, hexA(P.c4, P.dark ? 0.07 : 0.09));
  g.addColorStop(1, hexA(P.c1, P.dark ? 0.12 : 0.16));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.restore();
  mottle(c, w, h, P, rnd, P.dark ? 0.045 : 0.055);
}

/* One light source, from the upper right where the Hebrew eye enters the
 * page. Symmetric shading is what made every design read as a flat panel. */
function sheen(c, w, h, P) {
  /* A long, slow ramp. A short one puts a visible wedge with an edge across
   * every design — light, not a stripe. */
  const g = c.createLinearGradient(w, 0, w * 0.10, h);
  g.addColorStop(0, hexA(P.glow, P.dark ? 0.12 : 0.24));
  g.addColorStop(0.30, hexA(P.glow, P.dark ? 0.06 : 0.12));
  g.addColorStop(0.58, hexA(P.glow, 0));
  g.addColorStop(1, hexA(P.deep || P.ink, P.dark ? 0.18 : 0.09));
  c.save();
  c.globalCompositeOperation = 'soft-light';
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.restore();
}

/* A wandering horizontal edge, kept as data so the same curve can be both
 * filled and stroked — a band with a drawn top edge reads as a band, while
 * a bare gradient reads as nothing at all. */
function waveEdge(w, y0, amp, rnd, seg) {
  seg = seg || 3;
  const segs = [];
  let x = 0, y = y0;
  for (let i = 0; i < seg; i++) {
    const nx = (i + 1) / seg * w;
    const ny = y0 + (rnd() * 2 - 1) * amp;
    const cp = x + (nx - x) / 2;
    segs.push([cp, y + (rnd() * 2 - 1) * amp * 0.8, cp, ny + (rnd() * 2 - 1) * amp * 0.8, nx, ny]);
    x = nx; y = ny;
  }
  return { y0: y0, segs: segs };
}

function traceWave(c, e) {
  c.moveTo(0, e.y0);
  for (let i = 0; i < e.segs.length; i++) {
    const s = e.segs[i];
    c.bezierCurveTo(s[0], s[1], s[2], s[3], s[4], s[5]);
  }
}

/* The band darkens just under its own edge before falling away — the line of
 * pigment a brush leaves when a wet edge is allowed to settle. */
function fillWave(c, w, e, depth, color, a, up) {
  const dir = up ? -1 : 1;
  c.save();
  c.beginPath();
  traceWave(c, e);
  c.lineTo(w, e.y0 + dir * depth);
  c.lineTo(0, e.y0 + dir * depth);
  c.closePath();
  const g = c.createLinearGradient(0, e.y0, 0, e.y0 + dir * depth);
  g.addColorStop(0, hexA(color, a * 0.72));
  g.addColorStop(0.06, hexA(color, a));
  g.addColorStop(0.34, hexA(color, a * 0.80));
  g.addColorStop(1, hexA(color, a * 0.06));
  c.fillStyle = g;
  c.fill();
  c.restore();
}

function strokeWave(c, e, color, a, wid) {
  c.save();
  c.beginPath();
  traceWave(c, e);
  c.strokeStyle = hexA(color, a);
  c.lineWidth = wid;
  c.stroke();
  c.restore();
}

/* A long meandering stroke that thins and fades along its length. A single
 * bezier from end to end can only ever draw a gentle arc — which is why the
 * marble read as scratches ruled across the glass. Four chained segments
 * actually wander. */
function vein(c, x0, y0, x1, y1, wid, color, a, rnd) {
  c.save();
  c.beginPath();
  c.moveTo(x0, y0);
  const dx = x1 - x0, dy = y1 - y0, N = 4;
  let px = x0, py = y0;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const nx = i === N ? x1 : x0 + dx * t + (rnd() * 2 - 1) * 90;
    const ny = i === N ? y1 : y0 + dy * t + (rnd() * 2 - 1) * 160;
    c.bezierCurveTo(
      px + (nx - px) * 0.35 + (rnd() * 2 - 1) * 200, py + (ny - py) * 0.35 + (rnd() * 2 - 1) * 240,
      px + (nx - px) * 0.72 + (rnd() * 2 - 1) * 200, py + (ny - py) * 0.72 + (rnd() * 2 - 1) * 240,
      nx, ny);
    px = nx; py = ny;
  }
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, hexA(color, 0));
  g.addColorStop(0.35, hexA(color, a));
  g.addColorStop(0.7, hexA(color, a * 0.7));
  g.addColorStop(1, hexA(color, 0));
  c.strokeStyle = g;
  c.lineWidth = wid;
  c.lineCap = 'round';
  c.stroke();
  c.restore();
}

/* The board carries a portrait, a title, two columns of times and a plaque.
 * Rather than time every pattern to tiptoe around that, each one paints
 * boldly and then has the middle eased back — which is exactly the
 * composition the watercolour backgrounds used to have. It is deliberately
 * gentle: the adaptive lozenges behind the type already handle legibility,
 * and a heavy wash here is what bleached the first attempt flat. */
function clearCentre(c, w, h, P, strength) {
  const g = c.createRadialGradient(w / 2, h * 0.48, 0, w / 2, h * 0.48, w * 0.54);
  g.addColorStop(0, hexA(P.paper[0], strength));
  g.addColorStop(0.38, hexA(P.paper[0], strength * 0.86));
  g.addColorStop(0.70, hexA(P.paper[0], strength * 0.38));
  g.addColorStop(1, hexA(P.paper[0], 0));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

/* ---------- patterns ----------
 * Ten compositions that have to stay apart from one another at 150px in the
 * gallery, in fourteen palettes, without ever fighting the text. Each one
 * paints its colour inside mixed(), so wherever two of its shapes overlap a
 * third colour appears that is in none of the palette's entries — which is
 * where the depth comes from. */

const PATTERNS = {
  mist: {
    label: 'ערפל', hint: 'עננים רכים', frame: 'double',
    draw: function (c, w, h, P, rnd) {
      mixed(c, P, function () {
        [[0.04, 1.02, 0.60, 0.36, P.c1, 0.90],
         [0.92, 0.96, 0.56, 0.38, P.c4, 0.72],
         [0.58, 1.14, 0.54, 0.28, P.c2, 0.84],
         [0.24, 0.90, 0.38, 0.24, P.deep, 0.46],
         [0.02, 0.02, 0.48, 0.32, P.c2, 0.76],
         [1.02, 0.06, 0.46, 0.28, P.c1, 0.68],
         [0.72, 0.10, 0.34, 0.20, P.c4, 0.50],
         [0.48, -0.12, 0.62, 0.24, P.c3, 0.62]
        ].forEach(function (s) {
          wash(c, s[0] * w, s[1] * h, s[2] * w, s[3] * h, s[4], s[5], rnd,
            { puffs: 8, layers: 3 });
        });
      });
      mottle(c, w, h, P, rnd, 0.07);
      clearCentre(c, w, h, P, 0.46);
    }
  },

  halo: {
    label: 'הילה', hint: 'אור מן המרכז', frame: 'thin',
    draw: function (c, w, h, P, rnd) {
      const g = c.createRadialGradient(w / 2, h * 0.46, w * 0.20, w / 2, h * 0.46, w * 0.82);
      g.addColorStop(0, hexA(P.c1, 0));
      g.addColorStop(0.42, hexA(P.c1, 0.38));
      g.addColorStop(0.72, hexA(P.c1, 0.95));
      g.addColorStop(1, hexA(P.deep || P.c1, 0.95));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      /* the ring is not one colour: warm on one shoulder, cool on the other,
         so the light looks like it fell on something */
      mixed(c, P, function () {
        wash(c, w * 0.12, h * 0.16, w * 0.52, h * 0.34, P.c4, 0.64, rnd, { puffs: 8, layers: 2 });
        wash(c, w * 0.94, h * 0.86, w * 0.50, h * 0.34, P.c3, 0.58, rnd, { puffs: 8, layers: 2 });
      });
      const core = c.createRadialGradient(w / 2, h * 0.44, 0, w / 2, h * 0.44, w * 0.46);
      core.addColorStop(0, hexA(P.glow, 0.72));
      core.addColorStop(0.55, hexA(P.glow, 0.34));
      core.addColorStop(1, hexA(P.glow, 0));
      c.fillStyle = core;
      c.fillRect(0, 0, w, h);
      mottle(c, w, h, P, rnd, 0.06);
      clearCentre(c, w, h, P, 0.30);
    }
  },

  bloom: {
    label: 'פריחה', hint: 'עלי כותרת', frame: 'none',
    draw: function (c, w, h, P, rnd) {
      /* the petals are laid deliberately overlapping: where two cross, the
         multiply makes the darker third colour a real flower has */
      mixed(c, P, function () {
        /* A wreath, not a ring of beads: neighbouring petals sit closer
           together than the sum of their radii, so each pair overlaps into a
           third colour and the eight of them read as one continuous mass. */
        [[1.05, 0.52, 0.38, 0.34, P.c1, 0.80],
         [0.89, 0.91, 0.38, 0.34, P.c2, 0.74],
         [0.50, 1.07, 0.38, 0.34, P.c4, 0.78],
         [0.11, 0.91, 0.38, 0.34, P.c1, 0.72],
         [-0.05, 0.52, 0.38, 0.34, P.c3, 0.66],
         [0.11, 0.13, 0.36, 0.32, P.c2, 0.62],
         [0.50, -0.03, 0.36, 0.32, P.c4, 0.60],
         [0.89, 0.13, 0.36, 0.32, P.c1, 0.58]
        ].forEach(function (s) {
          wash(c, s[0] * w, s[1] * h, s[2] * w, s[3] * h, s[4], s[5], rnd,
            { puffs: 8, layers: 2 });
        });
      });
      mottle(c, w, h, P, rnd, 0.07);
      clearCentre(c, w, h, P, 0.48);
    }
  },

  waves: {
    label: 'גלים', hint: 'פסים זורמים', frame: 'double',
    draw: function (c, w, h, P, rnd) {
      mixed(c, P, function () {
        /* a wash under the bands so the water has a floor to sit on */
        wash(c, w * 0.5, h * 1.06, w * 0.75, h * 0.34, P.c2, 0.52, rnd, { puffs: 7, layers: 2 });
        const cols = [P.c2, P.c1, P.c4, P.c1, P.c3];
        [0.66, 0.745, 0.83, 0.905, 0.975].forEach(function (t, i) {
          const e = waveEdge(w, h * t, h * 0.042, rnd);
          fillWave(c, w, e, h * 0.30, cols[i], 0.64);
          strokeWave(c, e, P.gold, 0.26, 2.5);
        });
        [0.21, 0.135, 0.065].forEach(function (t, i) {
          const e = waveEdge(w, h * t, h * 0.034, rnd);
          fillWave(c, w, e, h * 0.20, [P.c2, P.c1, P.c4][i], 0.38, true);
          strokeWave(c, e, P.gold, 0.20, 2);
        });
      });
      mottle(c, w, h, P, rnd, 0.06);
      clearCentre(c, w, h, P, 0.38);
    }
  },

  dunes: {
    label: 'חולות', hint: 'גבעות ושמש', frame: 'thin',
    draw: function (c, w, h, P, rnd) {
      const sun = c.createRadialGradient(w * 0.5, h * 0.20, 0, w * 0.5, h * 0.20, w * 0.50);
      sun.addColorStop(0, hexA(P.glow, 0.95));
      sun.addColorStop(0.30, hexA(P.c3, 0.58));
      sun.addColorStop(1, hexA(P.c3, 0));
      c.fillStyle = sun;
      c.fillRect(0, 0, w, h);
      const disc = c.createRadialGradient(w * 0.5, h * 0.20, w * 0.055, w * 0.5, h * 0.20, w * 0.135);
      disc.addColorStop(0, hexA(P.glow, 0.92));
      disc.addColorStop(0.62, hexA(P.glow, 0.60));
      disc.addColorStop(1, hexA(P.glow, 0));
      c.fillStyle = disc;
      c.fillRect(0, 0, w, h);
      /* five overlapping ridges instead of three: each one darkens the ones
         behind it, which is what turns a flat cut-out into distance */
      mixed(c, P, function () {
        /* nearer ridges are stronger: that gradient of weight is the distance */
        const hills = [[0.575, P.c4, 0.40], [0.655, P.c2, 0.52],
                       [0.745, P.c1, 0.66], [0.845, P.c4, 0.78], [0.945, P.c3, 0.88]];
        hills.forEach(function (s) {
          const e = waveEdge(w, h * s[0], h * 0.062, rnd, 2);
          fillWave(c, w, e, h * 0.42, s[1], s[2]);
          strokeWave(c, e, P.gold, 0.20, 2);
        });
      });
      mottle(c, w, h, P, rnd, 0.06);
      clearCentre(c, w, h, P, 0.36);
    }
  },

  strata: {
    label: 'שכבות', hint: 'רבדים אופקיים', frame: 'double',
    draw: function (c, w, h, P, rnd) {
      mixed(c, P, function () {
        const cols = [P.c1, P.c2, P.c4, P.c3, P.c1, P.c4, P.c2, P.c3, P.c1];
        let y = -0.02;
        for (let i = 0; i < 9; i++) {
          const thick = 0.05 + rnd() * 0.085;   // uneven beds, not a ruler
          /* the edges have to roll, or nine parallel bands read as an awning */
          const e = waveEdge(w, h * y, h * (0.030 + rnd() * 0.030), rnd, 3);
          fillWave(c, w, e, h * thick * 1.9, cols[i], 0.36 + rnd() * 0.30);
          strokeWave(c, e, P.gold, 0.20, 1.6);
          y += thick;
        }
        /* a broad diagonal wash across the beds, the way sediment stains */
        wash(c, w * 0.15, h * 0.30, w * 0.55, h * 0.42, P.c4, 0.34, rnd, { puffs: 8, layers: 2 });
        wash(c, w * 0.88, h * 0.78, w * 0.50, h * 0.38, P.deep, 0.26, rnd, { puffs: 8, layers: 2 });
      });
      mottle(c, w, h, P, rnd, 0.09);
      clearCentre(c, w, h, P, 0.46);
    }
  },

  aurora: {
    label: 'זוהר', hint: 'סרטי אור אלכסוניים', frame: 'thin',
    draw: function (c, w, h, P, rnd) {
      mixed(c, P, function () {
        c.save();
        c.translate(w / 2, h / 2);
        c.rotate(-0.52);
        c.translate(-w / 2, -h / 2);
        const cols = [P.c1, P.c4, P.c2, P.c3, P.c1, P.c4, P.c2, P.c3];
        let y = -0.10;
        for (let i = 0; i < 8; i++) {
          const thick = 0.022 + rnd() * 0.055;
          /* Ribbons of light are not a barber pole: each one gets its own
             length, its own centre and a wobbling edge, and some fall short
             of the board entirely. */
          const span = 0.55 + rnd() * 0.62;
          const cx = 0.5 + (rnd() - 0.5) * 0.55;
          wash(c, w * cx, h * y, w * span * 0.62, h * thick,
            cols[i], 0.34 + rnd() * 0.30, rnd,
            { puffs: 10, layers: 3 });
          y += thick * 2 + 0.030 + rnd() * 0.085;
        }
        c.restore();
      });
      mottle(c, w, h, P, rnd, 0.08);
      clearCentre(c, w, h, P, 0.46);
    }
  },

  veins: {
    label: 'שיש', hint: 'עורקי אבן', frame: 'double',
    draw: function (c, w, h, P, rnd) {
      mixed(c, P, function () {
        const g = c.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, hexA(P.c2, 0.50));
        g.addColorStop(0.5, hexA(P.c4, 0.26));
        g.addColorStop(1, hexA(P.c2, 0.54));
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        /* clouded stone: broad, genuinely irregular washes crossing each
           other. Nine points at low wobble gave lozenges, not clouds. */
        [[0.02, 0.04, 0.46, 0.34, P.c1], [0.98, 0.96, 0.46, 0.34, P.c1],
         [0.88, 0.16, 0.38, 0.30, P.c4], [0.10, 0.84, 0.38, 0.30, P.c4],
         [0.50, 0.50, 0.44, 0.36, P.c2]
        ].forEach(function (s) {
          wash(c, s[0] * w, s[1] * h, s[2] * w, s[3] * h, s[4], 0.50, rnd,
            { puffs: 11, layers: 2 });
        });
      });
      /* Fewer veins, wandering much further. Eleven near-straight lines read
         as scratches on the glass; six meandering ones read as stone. */
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const col = i % 3 === 1 ? P.gold : (P.deep || P.c1);
        const y0 = h * (-0.14 + t * 0.50), y1 = h * (0.52 + t * 0.62);
        vein(c, -80, y0, w + 80, y1, 4 + rnd() * 10, col, 0.44 + rnd() * 0.24, rnd);
        vein(c, -80, y0 + h * 0.012, w + 80, y1 + h * 0.012, 1.4, P.glow, 0.28, rnd);
        /* a hair branching off, which is what stops it looking ruled */
        vein(c, w * (0.2 + rnd() * 0.5), y0 + h * 0.06, w + 80, y1 - h * 0.10,
          1.6 + rnd() * 3, col, 0.26, rnd);
      }
      mottle(c, w, h, P, rnd, 0.10);
      clearCentre(c, w, h, P, 0.36);
    }
  },

  orbit: {
    label: 'מעגלים', hint: 'טבעות רכות', frame: 'thin',
    draw: function (c, w, h, P, rnd) {
      const cx = w / 2, cy = h * 1.02;
      /* Two notes and the deep, alternating — cycling all four made a
         rainbow, which is the wrong register for a memorial board. */
      const cols = [P.c1, P.c2, P.deep, P.c1, P.c2, P.c4, P.c1];
      mixed(c, P, function () {
        for (let i = 7; i >= 1; i--) {
          const r = w * (0.16 + i * 0.135);
          c.save();
          blobPath(c, cx, cy, r, r * 0.94, 16, 0.075, mulberry32(i * 977), i * 0.7);
          const g = c.createRadialGradient(cx, cy, r * 0.62, cx, cy, r);
          g.addColorStop(0, hexA(cols[i - 1], 0));
          g.addColorStop(0.58, hexA(cols[i - 1], 0.16));
          g.addColorStop(0.88, hexA(cols[i - 1], 0.46));
          g.addColorStop(0.97, hexA(cols[i - 1], 0.58));
          g.addColorStop(1, hexA(P.gold, 0.30));
          c.fillStyle = g;
          c.fill();
          c.restore();
        }
        /* a wash across the rings so they are not a clean diagram */
        wash(c, w * 0.06, h * 0.10, w * 0.44, h * 0.34, P.c4, 0.34, rnd, { puffs: 10, layers: 2 });
        wash(c, w * 0.96, h * 0.16, w * 0.40, h * 0.32, P.c3, 0.30, rnd, { puffs: 10, layers: 2 });
      });
      mottle(c, w, h, P, rnd, 0.08);
      clearCentre(c, w, h, P, 0.40);
    }
  },

  arch: {
    label: 'קשת', hint: 'קשת בית כנסת', frame: 'none',
    draw: function (c, w, h, P, rnd) {
      /* deep surround first, then the arch is cut back out of it in light */
      mixed(c, P, function () {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, hexA(P.c1, 0.84));
        g.addColorStop(0.5, hexA(P.c2, 0.64));
        g.addColorStop(1, hexA(P.c1, 0.90));
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        /* stonework, so the surround is masonry and not a painted panel */
        wash(c, w * 0.02, h * 0.10, w * 0.34, h * 0.34, P.c4, 0.67, rnd, { puffs: 7, layers: 2 });
        wash(c, w * 0.98, h * 0.12, w * 0.34, h * 0.34, P.c3, 0.58, rnd, { puffs: 7, layers: 2 });
        wash(c, w * 0.06, h * 0.92, w * 0.32, h * 0.30, P.c4, 0.61, rnd, { puffs: 7, layers: 2 });
        wash(c, w * 0.94, h * 0.94, w * 0.32, h * 0.30, P.deep, 0.43, rnd, { puffs: 7, layers: 2 });
      });
      mottle(c, w, h, P, rnd, 0.08);

      const x0 = w * 0.105, x1 = w * 0.895, top = h * 0.055, spring = h * 0.42;
      c.save();
      c.beginPath();
      c.moveTo(x0, h * 1.02);
      c.lineTo(x0, spring);
      c.bezierCurveTo(x0, top, x1, top, x1, spring);
      c.lineTo(x1, h * 1.02);
      c.closePath();
      c.clip();
      paintPaper(c, w, h, P);
      const inner = c.createRadialGradient(w / 2, h * 0.30, 0, w / 2, h * 0.42, w * 0.62);
      inner.addColorStop(0, hexA(P.glow, 0.70));
      inner.addColorStop(1, hexA(P.glow, 0));
      c.fillStyle = inner;
      c.fillRect(0, 0, w, h);
      /* The light inside the arch falls from its head, not evenly, and the
       * floor of it carries colour — bare paper inside a painted surround is
       * exactly the flat panel this was meant to stop being. */
      mixed(c, P, function () {
        wash(c, w * 0.5, h * 1.06, w * 0.52, h * 0.34, P.c2, 0.46, rnd, { puffs: 8, layers: 2 });
        wash(c, w * 0.20, h * 0.28, w * 0.26, h * 0.26, P.c4, 0.26, rnd, { puffs: 9, layers: 2 });
        wash(c, w * 0.82, h * 0.22, w * 0.24, h * 0.24, P.c3, 0.24, rnd, { puffs: 9, layers: 2 });
      });
      mottle(c, w, h, P, rnd, 0.05);
      c.restore();

      /* the arch mouldings */
      c.save();
      c.beginPath();
      c.moveTo(x0, h);
      c.lineTo(x0, spring);
      c.bezierCurveTo(x0, top, x1, top, x1, spring);
      c.lineTo(x1, h);
      c.strokeStyle = hexA(P.gold, 0.72);
      c.lineWidth = Math.max(2, w * 0.0032);
      c.stroke();
      const p = w * 0.018;
      c.beginPath();
      c.moveTo(x0 + p, h);
      c.lineTo(x0 + p, spring + p);
      c.bezierCurveTo(x0 + p, top + p * 1.8, x1 - p, top + p * 1.8, x1 - p, spring + p);
      c.lineTo(x1 - p, h);
      c.strokeStyle = hexA(P.gold, 0.34);
      c.lineWidth = Math.max(1, w * 0.0014);
      c.stroke();
      c.restore();
    }
  }
};

/* ---------- palettes ----------
 * `cream` is the tone the readability lozenges fade toward, so it must be
 * the paper itself; `ink` is what stays legible on that paper. The two dark
 * palettes swap those two roles, and every other piece of drawing code
 * follows along without a special case. c1/c2 are the two masses the
 * patterns are built from, c3 is the accent, c4 the deliberate outsider —
 * the note from the other side of the wheel, whose only job is to make the
 * overlaps land on a colour the palette itself never lists — and `deep` the
 * darkest note. */

const PALETTES = {
  navy:     { label: 'כחול קלאסי', sw: ['#5c7ab0', '#1e2d55'],
              paper: ['#fdf9f0', '#f3ecdb'], c1: '#6d8ab9', c2: '#a2b8d6', c3: '#d6b979', c4: '#c08a5e', deep: '#3b527f', glow: '#fffdf4',
              ink: '#1e2d55', gold: '#b98a44', cream: '250,246,236', plaque: '#26355f' },
  olive:    { label: 'ירוק זית', sw: ['#8ca063', '#38502f'],
              paper: ['#fbf9ee', '#f0f0dc'], c1: '#93a86e', c2: '#bfcb9c', c3: '#cdaf5f', c4: '#c08a5a', deep: '#5b7042', glow: '#fdfcf0',
              ink: '#31492f', gold: '#a08b3f', cream: '249,249,238', plaque: '#3a533a' },
  stone:    { label: 'אבן ירושלים', sw: ['#c9a163', '#7a5c35'],
              paper: ['#fdf9ee', '#f5e9d2'], c1: '#c9a367', c2: '#e2c9a0', c3: '#a67f47', c4: '#8496a6', deep: '#8a6739', glow: '#fffcf0',
              ink: '#5a4326', gold: '#b08d4f', cream: '251,245,231', plaque: '#5f4728' },
  amber:    { label: 'שדה זהב', sw: ['#e0ac4c', '#8a6321'],
              paper: ['#fefaea', '#f8edc9'], c1: '#e3b962', c2: '#f2dda2', c3: '#c08f39', c4: '#cf9276', deep: '#96702c', glow: '#fffdee',
              ink: '#5a4423', gold: '#a8843c', cream: '253,247,229', plaque: '#5f4d28' },
  sage:     { label: 'מרווה', sw: ['#87a894', '#42604e'],
              paper: ['#fafcf7', '#ecf1e8'], c1: '#8dae9a', c2: '#bcd3c1', c3: '#c2c67c', c4: '#8aa5bd', deep: '#5b7d68', glow: '#fdfefa',
              ink: '#2e4a3a', gold: '#7f9060', cream: '248,251,246', plaque: '#3a5244' },
  tchelet:  { label: 'תכלת', sw: ['#5fa5cb', '#2b5c86'],
              paper: ['#f8fcfe', '#e6f1f8'], c1: '#6fadd0', c2: '#a9cfe5', c3: '#8fb0cd', c4: '#d6bd88', deep: '#3d7ba6', glow: '#fdffff',
              ink: '#28486b', gold: '#6f93b6', cream: '244,250,253', plaque: '#31517a' },
  wine:     { label: 'יין ורימון', sw: ['#b0616c', '#6d2029'],
              paper: ['#fefaf6', '#f7ebe4'], c1: '#b96f77', c2: '#dcaaa4', c3: '#c79a4e', c4: '#75978a', deep: '#8a3a44', glow: '#fffdfa',
              ink: '#5c232c', gold: '#b08d3f', cream: '253,248,242', plaque: '#5f2830' },
  rose:     { label: 'ורד עתיק', sw: ['#d09a97', '#8a5a5c'],
              paper: ['#fefaf8', '#f8ece9'], c1: '#d3a09c', c2: '#ecc9c2', c3: '#c6a37e', c4: '#a5bb9f', deep: '#9c6a68', glow: '#fffdfc',
              ink: '#6b4046', gold: '#ab7f6a', cream: '254,249,246', plaque: '#6d454b' },
  plum:     { label: 'סגול עמוק', sw: ['#8f7cb4', '#4a3a70'],
              paper: ['#fcf9fd', '#efe9f5'], c1: '#9784bd', c2: '#c4b6da', c3: '#ab93bd', c4: '#bfa96c', deep: '#63528d', glow: '#fefcff',
              ink: '#3a3550', gold: '#8e82a8', cream: '250,247,252', plaque: '#403a5e' },
  forest:   { label: 'יער', sw: ['#5f8a70', '#22412f'],
              paper: ['#f8fbf8', '#e6efe7'], c1: '#69906f', c2: '#a3c1a8', c3: '#a7ac5f', c4: '#bb7d55', deep: '#3c6248', glow: '#fbfefb',
              ink: '#23412f', gold: '#7e8f52', cream: '245,250,246', plaque: '#2b4c37' },
  slate:    { label: 'אפור-כחול', sw: ['#8896a8', '#3d4a5c'],
              paper: ['#fbfcfd', '#eaeef2'], c1: '#8f9dad', c2: '#bfc9d4', c3: '#ab9f8b', c4: '#bfa07d', deep: '#5b6a7c', glow: '#fdfeff',
              ink: '#33404f', gold: '#8e9099', cream: '248,250,252', plaque: '#3c4a5c' },
  sand:     { label: 'חול ולבן', sw: ['#cbb794', '#8b7a5f'],
              paper: ['#fefcf7', '#f4eee1'], c1: '#cfbc9c', c2: '#e7dcc6', c3: '#ad9a76', c4: '#93a3ae', deep: '#8f7d5d', glow: '#fffefa',
              ink: '#524634', gold: '#a08f6b', cream: '253,251,245', plaque: '#584c39' },
  /* the two dark palettes: paper and ink swap roles */
  midnight: { label: 'ליל חצות', dark: true, sw: ['#3a5390', '#0b1024'],
              paper: ['#141d40', '#0a0f24'], c1: '#2d4a8c', c2: '#1d2f5e', c3: '#6d80bd', c4: '#7a5f9e', deep: '#060a18', glow: '#7d92d2',
              ink: '#f4ebd0', gold: '#dcbc72', cream: '17,23,48', plaque: '#0b1226' },
  charcoal: { label: 'פחם וזהב', dark: true, sw: ['#5a5449', '#171512'],
              paper: ['#242118', '#141210'], c1: '#453f33', c2: '#2d2924', c3: '#8a7448', c4: '#5c5270', deep: '#0d0c0a', glow: '#a98d52',
              ink: '#f2e9d4', gold: '#cca960', cream: '26,24,20', plaque: '#191713' }
};

const PATTERN_KEYS = Object.keys(PATTERNS);
const PALETTE_KEYS = Object.keys(PALETTES);

function patternOf(key) { return PATTERNS[key] || PATTERNS.mist; }
function paletteOf(key) { return PALETTES[key] || PALETTES.navy; }

/* ---------- painting ---------- */

/* paper base — a broad diagonal wash, never a flat fill */
function paintPaper(c, w, h, P) {
  const g = c.createLinearGradient(0, 0, w * 0.35, h);
  g.addColorStop(0, P.paper[0]);
  g.addColorStop(1, P.paper[1]);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

/* a whisper of tooth, so large gradients do not band on cheap screens */
let grainTile = null;
function grain(c, w, h, dark) {
  if (!grainTile) {
    const t = document.createElement('canvas');
    t.width = t.height = 96;
    const tx = t.getContext('2d');
    const d = tx.createImageData(96, 96);
    const r = mulberry32(20260831);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 128 + (r() * 2 - 1) * 127;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    tx.putImageData(d, 0, 0);
    grainTile = t;
  }
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = dark ? 0.03 : 0.05;
  c.fillStyle = c.createPattern(grainTile, 'repeat');
  c.fillRect(0, 0, w, h);
  c.restore();
}

/* A rim shade, not a grey wash: tinting with the palette's own deep note
 * keeps the paper warm, where neutral ink turned every light design dusty. */
function vignette(c, w, h, P) {
  const g = c.createRadialGradient(w / 2, h / 2, w * 0.52, w / 2, h / 2, w * 0.86);
  const col = P.deep || P.ink;
  g.addColorStop(0, hexA(col, 0));
  g.addColorStop(1, hexA(col, P.dark ? 0.38 : 0.15));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

function diamondOn(c, x, y, r, color) {
  c.beginPath();
  c.moveTo(x, y - r); c.lineTo(x + r, y);
  c.lineTo(x, y + r); c.lineTo(x - r, y);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function drawFrame(c, w, h, P, style) {
  if (style === 'none') return;
  const m = w * 0.035;
  c.save();
  c.strokeStyle = hexA(P.gold, 0.72);
  c.lineWidth = Math.max(1.5, w * 0.0028);
  c.strokeRect(m, m, w - m * 2, h - m * 2);
  if (style === 'double') {
    const m2 = m + w * 0.012;
    c.strokeStyle = hexA(P.gold, 0.30);
    c.lineWidth = Math.max(1, w * 0.0011);
    c.strokeRect(m2, m2, w - m2 * 2, h - m2 * 2);
    const r = w * 0.007;
    [[m, m], [w - m, m], [m, h - m], [w - m, h - m]].forEach(function (p) {
      diamondOn(c, p[0], p[1], r, hexA(P.gold, 0.7));
    });
    [[w / 2, m], [w / 2, h - m]].forEach(function (p) {
      diamondOn(c, p[0], p[1], r * 0.8, hexA(P.gold, 0.55));
    });
  }
  c.restore();
}

function hashKey(s) {
  let n = 2166136261;
  for (let i = 0; i < s.length; i++) { n ^= s.charCodeAt(i); n = Math.imul(n, 16777619); }
  return n >>> 0;
}

/* Renders one design at any size. The pattern draws in board coordinates and
 * the context is scaled, so a 220px gallery tile and the 1254px export come
 * out of exactly the same code. */
function paintDesign(c, size, patternKey, paletteKey) {
  const pat = patternOf(patternKey), P = paletteOf(paletteKey);
  c.save();
  c.scale(size / W, size / H);
  paintPaper(c, W, H, P);
  pat.draw(c, W, H, P, mulberry32(hashKey(patternKey) ^ 0x5f3a));
  veil(c, W, H, P, mulberry32(hashKey(patternKey) ^ 0x2b17));
  sheen(c, W, H, P);
  vignette(c, W, H, P);
  grain(c, W, H, P.dark);
  drawFrame(c, W, H, P, pat.frame);
  c.restore();
}

/* one-entry cache: the board is redrawn every week with the same design */
let bgCache = { key: '', canvas: null };
function boardBackground() {
  const key = designKey() + '|' + paletteKeyOf();
  if (bgCache.key === key && bgCache.canvas) return bgCache.canvas;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  paintDesign(cv.getContext('2d'), W, designKey(), paletteKeyOf());
  bgCache = { key: key, canvas: cv };
  return cv;
}

function designKey() { return (settings && PATTERNS[settings.template]) ? settings.template : 'mist'; }
function paletteKeyOf() { return (settings && PALETTES[settings.palette]) ? settings.palette : 'navy'; }

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
let photoImage = null;   // loaded user photo
let lastFilename = 'zmanei-shabbat.png';

const $ = id => document.getElementById(id);
let canvas = $('board');
let ctx = canvas.getContext('2d', { willReadFrequently: true });

/* Point the whole drawing pipeline at another canvas for the duration of one
 * render. The intro page needs a real example board, and re-implementing the
 * board for it would guarantee the example drifts from the product. */
function renderTo(target, fn) {
  const pc = canvas, px = ctx;
  canvas = target;
  ctx = target.getContext('2d', { willReadFrequently: true });
  try { fn(); } finally { canvas = pc; ctx = px; }
}

const canShareFiles = !!(navigator.canShare &&
  navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }));

/* ---------- settings ---------- */

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.name || !s.cities || !s.cities.length) return null;
    return migrateSettings(s);
  } catch (e) { return null; }
}

/* v1/v2 saved a picture filename in `template` and a CSS filter in `tone`.
 * v3 designs are a pattern plus a palette, so an old board is mapped onto the
 * closest new pair — a family that set this up months ago opens the tool and
 * finds their board, not a wizard. */
const LEGACY_DESIGNS = {
  classic:         ['mist',   'navy'],
  olive:           ['bloom',  'olive'],
  jerusalem:       ['arch',   'stone'],
  night:           ['halo',   'midnight'],
  field:           ['dunes',  'amber'],
  galilee:         ['waves',  'sage'],
  tchelet:         ['aurora', 'tchelet'],
  candles:         ['halo',   'amber'],
  challah:         ['bloom',  'wine'],
  'shabbat-table': ['strata', 'slate'],
  havdala:         ['aurora', 'plum'],
  pomegranate:     ['orbit',  'wine']
};

function migrateSettings(s) {
  if (!PATTERNS[s.template]) {
    const m = LEGACY_DESIGNS[s.template] || ['mist', 'navy'];
    s.template = m[0];
    if (!PALETTES[s.palette]) s.palette = m[1];
  }
  if (!PALETTES[s.palette]) s.palette = 'navy';
  delete s.tone;                        // the CSS-filter axis is gone
  if (!FONT_PAIRS[s.fontPair]) s.fontPair = 'classic';
  if (!Array.isArray(s.customCities)) s.customCities = [];
  if (!s.renames || typeof s.renames !== 'object') s.renames = {};
  if (!s.photoZoom) s.photoZoom = 100;
  s.v = 3;
  return s;
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
/* U+05BE MAQAF lives inside the same Unicode block as the vowel points, so a
 * blanket strip silently glued נצבים־וילך into "נצביםוילך". It is a hyphen,
 * not a diacritic — it has to survive, as a hyphen. */
function stripNikud(s) {
  return (s || '').replace(/־/g, '-').replace(/[֑-ׇ]/g, '');
}

/* Hebcal ships the parasha pointed and spelled defectively, so once the vowels
 * are gone a few names read wrong to an unpointed eye — "נצבים", "תולדת".
 * Only the handful that actually change are listed; a double parasha is
 * mapped on each half. */
const PARASHA_MALE = {
  'תולדת': 'תולדות', 'בהעלתך': 'בהעלותך', 'מצרע': 'מצורע', 'קדשים': 'קדושים',
  'בחקתי': 'בחוקותי', 'חקת': 'חוקת', 'שפטים': 'שופטים', 'נצבים': 'ניצבים'
};

function parashaName(s) {
  return (s || '').split('-')
    .map(function (part) { const t = part.trim(); return PARASHA_MALE[t] || t; })
    .join('-');
}

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
    if (it.category === 'parashat' && dayOf(it.date) === satISO) parasha = parashaName(heb.replace(/^פרשת\s*/, ''));
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

function tpl() { return paletteOf(settings && settings.palette); }

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

/* Lays the adaptive lozenge behind a centred line and hands back the box it
 * covered, so the caller can measure the art through it. ctx.font must
 * already be set to the face the line will be drawn in. */
function backdropFor(text, baseline, size, pad) {
  const SL = 14;
  const tw = Math.min(W - 90, ctx.measureText(text).width + pad);
  const box = {
    x: Math.round(W / 2 - tw / 2),
    y: Math.round(baseline - size * 0.86),
    w: Math.round(tw),
    h: Math.round(size * 1.16)
  };
  const lums = sliceLum(box.x, box.y, box.w, box.h, SL);
  box.alphas = lums.map(function (_, k) {
    return lumToAlpha(Math.min(lums[k], lums[Math.max(0, k - 1)], lums[Math.min(SL - 1, k + 1)]));
  });
  lozenge(box);
  return box;
}

function drawTitle(title, subtitle) {
  const T = tpl();
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  /* The title sits wherever the design happens to be light or dark, so it
   * gets the same treatment the column headers get: an adaptive backdrop
   * sized to the words actually being drawn, and then an ink measured off
   * the result. Measuring a fixed strip was not enough — a long title runs
   * out to x=100, well past it, and a bold corner would swallow its first
   * word while the strip still averaged light. */
  const size = fitFont(title, wTitle(), fTitle(), sT(S_TITLE), W - 200);
  ctx.font = wTitle() + ' ' + size + 'px ' + fTitle();
  const tBox = backdropFor(title, 158, size, 96);
  const lum = meanLum(tBox.x, tBox.y, tBox.w, tBox.h);
  const lightInk = lum < 128;
  ctx.fillStyle = lightInk ? (T.dark ? T.ink : '#fdf8ea') : (T.dark ? '#20263f' : T.ink);
  ctx.shadowColor = lightInk ? 'rgba(8,12,28,0.55)' : 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fillText(title, W / 2, 158);
  ctx.shadowColor = 'transparent';

  if (subtitle) {
    /* subtitle stays regular weight — 400 exists in every pair's title face */
    const sSize = fitFont(subtitle, '400', fTitle(), sT(S_SUB), W - 500);
    ctx.font = '400 ' + sSize + 'px ' + fTitle();
    backdropFor(subtitle, 235, sSize, 60);
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

// Column headers are always drawn by code (the backgrounds carry no text).
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

/* mean luminance of a region of whatever is already on the canvas */
function meanLum(x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.min(W - x, Math.round(w)); h = Math.min(H - y, Math.round(h));
  if (w <= 0 || h <= 0) return 255;
  const d = ctx.getImageData(x, y, w, h).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) {
    sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    n++;
  }
  return n ? sum / n : 255;
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

const CONTACT_EMAIL = 'idoyan@gmail.com';

/* Discreet credit in the bottom-left corner, outside the plaque, so anyone
 * who receives the image forwarded in a WhatsApp group can find the tool. */
function drawContact() {
  ctx.save();
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const T = tpl();
  ctx.font = '400 19px FrankRuhl, serif';
  ctx.fillStyle = T.dark ? 'rgba(255,250,235,0.40)' : 'rgba(0,0,0,0.34)';
  ctx.shadowColor = T.dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(CONTACT_EMAIL, 42, 1228);
  ctx.restore();
}

function drawBoard(plan, rows) {
  const labels = LABELS[plan.mode];
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(boardBackground(), 0, 0, W, H);
  drawPhoto();
  drawTitle(labels.title, plan.name);
  drawHeaders(labels.right, labels.left);
  drawPlaque();
  drawRows(rows);
  drawContact();
}

/* ---------- assets ---------- */

async function loadAssets() {
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

/* ---------- intro screen ----------
 * People were arriving here from a forwarded WhatsApp link with no idea what
 * the tool is — one visitor uploaded a photo of themselves. So the first
 * screen now shows a finished board before it asks for anything, and every
 * line of copy says whose photo this is. */

/* A portrait stand-in for the example. Deliberately a drawn silhouette and
 * not a stock face: the example must read as "your photo goes here", and a
 * real-looking stranger would read as "this is the person". */
function silhouetteCanvas(P) {
  const c = document.createElement('canvas');
  c.width = 660; c.height = 790;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 790);
  g.addColorStop(0, hexA(P.c2, 0.55));
  g.addColorStop(1, hexA(P.c1, 0.7));
  x.fillStyle = g;
  x.fillRect(0, 0, 660, 790);

  x.fillStyle = hexA(P.dark ? '#e8e0cc' : P.ink, P.dark ? 0.35 : 0.34);
  // shoulders
  x.beginPath();
  x.moveTo(70, 790);
  x.bezierCurveTo(90, 560, 240, 470, 330, 470);
  x.bezierCurveTo(420, 470, 570, 560, 590, 790);
  x.closePath();
  x.fill();
  // head
  x.beginPath();
  x.ellipse(330, 320, 138, 162, 0, 0, Math.PI * 2);
  x.fill();

  // a soft light so the silhouette does not read as a flat sticker
  const hl = x.createRadialGradient(270, 250, 10, 330, 330, 260);
  hl.addColorStop(0, 'rgba(255,255,255,0.20)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = hl;
  x.fillRect(0, 0, 660, 790);
  return c;
}

const SAMPLE_ROWS = [
  { name: 'ירושלים', entry: '18:34', exit: '19:48' },
  { name: 'תל אביב', entry: '18:52', exit: '19:50' },
  { name: 'חיפה', entry: '18:42', exit: '19:52' },
  { name: 'באר שבע', entry: '18:54', exit: '19:49' },
  { name: 'צפת', entry: '18:49', exit: '19:51' }
];

/* The example is drawn by the very same pipeline that draws the real board —
 * an example maintained separately is an example that quietly goes stale. */
function drawSampleBoard() {
  const target = $('sampleBoard');
  if (!target) return;
  const saved = settings, savedPhoto = photoImage, savedCache = bgCache;
  settings = defaultDraft();
  settings.dedication = 'לזכר';
  settings.name = 'שם יקירכם ז״ל';
  settings.dateLine = 'תאריך הפטירה';
  settings.verse = 'נר ה׳ נשמת אדם';
  settings.template = 'mist';
  settings.palette = 'navy';
  settings.photoOffset = 18;
  settings.photoZoom = 104;
  photoImage = silhouetteCanvas(paletteOf('navy'));
  bgCache = { key: '', canvas: null };
  try {
    renderTo(target, function () {
      drawBoard({ mode: 'shabbat', name: 'פרשת בראשית' }, SAMPLE_ROWS);
    });
  } catch (e) {
    console.warn('sample render failed', e);
  } finally {
    settings = saved;
    photoImage = savedPhoto;
    bgCache = savedCache;
  }
}

function showIntro() {
  $('screenIntro').style.display = 'block';
  $('screenBoard').style.display = 'none';
  $('wizard').style.display = 'none';
  document.fonts.ready.then(drawSampleBoard).catch(drawSampleBoard);
}

function hideIntro() { $('screenIntro').style.display = 'none'; }

/* ---------- wizard ---------- */

const wizardState = { step: 0, draft: null };
const WSTEPS = 6;

function defaultDraft() {
  return {
    v: 3,
    photo: '',
    photoOffset: 25,
    photoZoom: 100,
    dedication: DEDICATIONS[0],
    name: '',
    dateLine: '',
    verse: '',
    cities: ['jerusalem', 'telaviv', 'haifa', 'beersheva'],
    customCities: [],
    renames: {},
    template: 'mist',
    palette: 'navy',
    fontPair: 'classic'
  };
}

/* Preset cities + the ones this user added via search, with any rename the
 * user made applied here and nowhere else — so the checkbox list and the
 * printed board can never end up showing different names for the same place.
 * Renaming is needed because a geocoder answers with whatever object it
 * matched: searching נווה צוף can return the grocery store, "מכולת נווה צוף". */
function allCities(src) {
  const custom = (src && src.customCities) || [];
  const ren = (src && src.renames) || {};
  return CITIES.concat(custom).map(function (c) {
    return ren[c.key] ? Object.assign({}, c, { name: ren[c.key] }) : c;
  });
}

function renameCity(draft, key, name) {
  const clean = (name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!draft.renames) draft.renames = {};
  const original = (CITIES.concat(draft.customCities || []).find(function (c) { return c.key === key; }) || {}).name;
  if (!clean || clean === original) delete draft.renames[key];
  else draft.renames[key] = clean;
}

function openWizard(prefill) {
  wizardState.step = 0;
  wizardState.draft = prefill ? JSON.parse(JSON.stringify(prefill)) : defaultDraft();
  hideIntro();
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
  hideIntro();
  $('wizard').style.display = 'none';
  $('screenBoard').style.display = 'flex';
  window.scrollTo(0, 0);
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

  // design gallery — every tile is a live render of the real background at
  // the currently chosen palette, so what is picked is exactly what prints
  renderDesignGrid();
  renderPaletteGrid();

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

}

/* ---------- design gallery ----------
 * Tiles are canvases, not <img>: a design and a palette are independent, and
 * repainting 10 small canvases when the palette changes is both cheaper and
 * more honest than tinting a photograph with a CSS filter and hoping. */

const TILE_PX = 260;

function renderDesignGrid() {
  const d = wizardState.draft;
  const grid = $('tplGrid');
  grid.innerHTML = '';
  PATTERN_KEYS.forEach(function (key) {
    const pat = PATTERNS[key];
    const label = document.createElement('label');
    label.className = 'tile';
    const rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'tplPick';
    rb.value = key;
    rb.checked = d.template === key;
    if (rb.checked) label.classList.add('checked');
    rb.addEventListener('change', function () {
      grid.querySelectorAll('label').forEach(function (l) { l.classList.remove('checked'); });
      label.classList.add('checked');
      d.template = key;
    });
    const cv = document.createElement('canvas');
    cv.width = cv.height = TILE_PX;
    cv.className = 'tileart';
    cv.dataset.pattern = key;
    const cap = document.createElement('span');
    cap.className = 'tilecap';
    cap.innerHTML = '<b>' + pat.label + '</b><i>' + pat.hint + '</i>';
    label.appendChild(rb);
    label.appendChild(cv);
    label.appendChild(cap);
    grid.appendChild(label);
  });
  repaintDesignGrid(d.palette);
}

function repaintDesignGrid(paletteKey) {
  $('tplGrid').querySelectorAll('canvas.tileart').forEach(function (cv) {
    paintDesign(cv.getContext('2d'), TILE_PX, cv.dataset.pattern, paletteKey);
  });
}

function renderPaletteGrid() {
  const d = wizardState.draft;
  const grid = $('toneGrid');
  grid.innerHTML = '';
  PALETTE_KEYS.forEach(function (key) {
    const P = PALETTES[key];
    const label = document.createElement('label');
    label.className = 'swatch';
    const rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'palettePick';
    rb.value = key;
    rb.checked = d.palette === key;
    if (rb.checked) label.classList.add('checked');
    rb.addEventListener('change', function () {
      grid.querySelectorAll('label').forEach(function (l) { l.classList.remove('checked'); });
      label.classList.add('checked');
      d.palette = key;
      repaintDesignGrid(key);
    });
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = 'linear-gradient(135deg,' + P.sw[0] + ' 0 50%,' + P.sw[1] + ' 50% 100%)';
    const nm = document.createElement('span');
    nm.className = 'swname';
    nm.textContent = P.label;
    label.appendChild(rb);
    label.appendChild(dot);
    label.appendChild(nm);
    grid.appendChild(label);
  });
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

    const nm = document.createElement('span');
    nm.className = 'cnm';
    nm.textContent = c.name;
    label.appendChild(nm);

    // searched-in cities show their candle custom, so a wrong one is visible
    if (!CITIES.some(p => p.key === c.key)) {
      const tag = document.createElement('small');
      tag.className = 'cmin';
      tag.textContent = c.candles + ' דק׳';
      label.appendChild(tag);
    }

    /* The name as it prints is the name shown here, so it is edited here.
     * A <button> inside a <label> is interactive content, which the spec
     * exempts from the label's activation — the checkbox stays put. */
    const pen = document.createElement('button');
    pen.type = 'button';
    pen.className = 'ren';
    pen.title = 'שינוי השם שיודפס בלוח';
    pen.textContent = '✎';
    pen.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      startRename(label, nm, pen, d, c.key);
    });
    label.appendChild(pen);

    grid.appendChild(label);
  });
  updateCityCount();
}

function startRename(label, nm, pen, draft, key) {
  const box = document.createElement('input');
  box.type = 'text';
  box.className = 'renbox';
  box.value = nm.textContent;
  box.maxLength = 24;
  let done = false;
  const finish = function (save) {
    if (done) return;
    done = true;
    if (save) renameCity(draft, key, box.value);
    renderCityGrid();
  };
  box.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  box.addEventListener('blur', () => finish(true));
  label.replaceChild(box, nm);
  pen.style.display = 'none';
  box.focus();
  box.select();
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

/* Only the comma form is stripped: plenty of real places end in the word
 * itself (בית ישראל, נחלת ישראל), so a blanket rule would mangle them. */
function cleanPlaceName(s) {
  return (s || '').replace(/\s*,\s*ישראל\s*$/, '').replace(/\s+/g, ' ').trim();
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
    /* A search for a small yishuv often matches something inside it — a shop,
     * a bus stop — and OSM answers with that object's own name ("מכולת נווה
     * צוף"). When the match is not itself a place, prefer the settlement it
     * sits in; the user can still correct whatever comes back. */
    const inhabited = a.village || a.town || a.city || a.hamlet ||
                      a.municipality || a.suburb || a.neighbourhood || '';
    const own = r.name || (r.display_name || '').split(',')[0];
    const isPlace = r.category === 'place' || r.category === 'boundary';
    return {
      key: 'osm' + r.osm_id,
      name: cleanPlaceName(isPlace ? own : (inhabited || own)),
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

  /* Editable right here: this is the moment the user can see the name is
   * wrong, and making them add it first and fix it afterwards is a step too
   * many. Looks like a label until it is clicked. */
  const info = document.createElement('span');
  info.className = 'cresname';
  const nameBox = document.createElement('input');
  nameBox.type = 'text';
  nameBox.className = 'namebox';
  nameBox.value = r.name;
  nameBox.maxLength = 24;
  nameBox.title = 'אפשר לתקן את השם לפני ההוספה';
  info.appendChild(nameBox);
  if (r.region) {
    const reg = document.createElement('small');
    reg.textContent = r.region;
    info.appendChild(reg);
  }

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
    const chosen = nameBox.value.replace(/\s+/g, ' ').trim();
    const ok = await addCustomCity(Object.assign({}, r, { name: chosen || r.name }), Number(sel.value));
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

const STEP_TITLES = [
  'תמונת יקירכם',
  'פרטי ההנצחה',
  'משפט לזיכרון',
  'הערים שיופיעו בלוח',
  'עיצוב הרקע',
  'סגנון הכתב'
];

function showStep(i) {
  wizardState.step = i;
  document.querySelectorAll('.wstep').forEach(el =>
    el.classList.toggle('active', Number(el.dataset.step) === i));
  $('wizPrev').style.visibility = i === 0 ? 'hidden' : 'visible';
  $('wizNext').textContent = i === WSTEPS - 1 ? '✓ סיום ויצירת הלוח' : 'הבא ←';
  $('wizErr').textContent = '';
  $('wizStepNum').textContent = 'שלב ' + (i + 1) + ' מתוך ' + WSTEPS;
  $('wizStepName').textContent = STEP_TITLES[i] || '';
  $('wizBar').style.width = ((i + 1) / WSTEPS * 100).toFixed(1) + '%';
  $('wizard').scrollIntoView({ block: 'start', behavior: 'smooth' });
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
    const pk = document.querySelector('input[name="palettePick"]:checked');
    d.palette = pk ? pk.value : 'navy';
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
      settings = migrateSettings(s);
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
  hideIntro();
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
$('introStart').addEventListener('click', () => openWizard(null));
$('introImport').addEventListener('click', () => $('importFile').click());
$('introSources').addEventListener('click', e => {
  e.preventDefault();
  $('modalBack').classList.add('open');
});
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
      settings.template = urlParams.get('tpl') || 'mist';
      settings.fontPair = urlParams.get('font') || 'classic';
      settings.palette = urlParams.get('palette') || 'navy';
      settings.cities = ['jerusalem', 'telaviv', 'haifa', 'beersheva', 'ariel', 'katzrin', 'london'];
      saveSettings(settings);
    } catch (e) { console.error('demo seed failed', e); }
  }

  settings = settings || loadSettings();
  if (settings) {
    initBoardScreen();
    if (urlParams.get('auto')) generate();
  } else {
    showIntro();
  }
}
boot();

document.getElementById('buildStamp').textContent = 'גרסה: ' + BUILD;
