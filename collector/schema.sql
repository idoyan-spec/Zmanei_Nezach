-- Zmanei Nezach usage collector — one row per anonymous event.
-- There is no column here that can hold something a visitor typed.

CREATE TABLE IF NOT EXISTS ev (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,          -- unix seconds
  day     TEXT    NOT NULL,          -- YYYY-MM-DD, so grouping needs no date maths
  kind    TEXT    NOT NULL,          -- visit | step | board | save
  ref     TEXT,                      -- referring host only, never the full URL
  dev     TEXT,                      -- mobile | desktop
  country TEXT,                      -- two letters, resolved by Cloudflare
  lang    TEXT,
  step    INTEGER,                   -- furthest wizard step reached
  how     TEXT,                      -- download | share
  pattern TEXT, palette TEXT, font TEXT,
  ncities INTEGER,
  verse   TEXT,                      -- 'none' | 'custom' | v1..v5 — never the words
  ded     TEXT,                      -- index into DEDICATIONS
  photo   INTEGER,                   -- 0/1: was a photo used at all
  mode    TEXT,                      -- shabbat | fast | chag
  secs    INTEGER                    -- wizard open -> board ready
);

CREATE INDEX IF NOT EXISTS ev_day  ON ev (day);
CREATE INDEX IF NOT EXISTS ev_kind ON ev (kind, day);

-- One board carries up to eight cities, so they get rows of their own.
CREATE TABLE IF NOT EXISTS city (
  id  INTEGER PRIMARY KEY AUTOINCREMENT,
  ts  INTEGER NOT NULL,
  day TEXT    NOT NULL,
  tag TEXT    NOT NULL               -- a preset key, or 'il:<name from OUR list>', or 'tz:<zone>'
);

CREATE INDEX IF NOT EXISTS city_day ON city (day);
CREATE INDEX IF NOT EXISTS city_tag ON city (tag);
