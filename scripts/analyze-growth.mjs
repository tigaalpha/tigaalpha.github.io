// Reads /tmp/growth-numstat.txt (git log --numstat dump) and computes weekly growth.
import { readFileSync } from "node:fs";
const raw = readFileSync("/tmp/growth-numstat.txt", "utf8");

const ARTIFACT = /^(bundle\/|dist|landing|updates\/|sw\.js$|index\.html$|package-lock\.json$|android\/|ios\/)/;
const DATAFILE = /^(songs-data\.ts$|pathway-data\.ts$|app-styles\.ts$|i18n\.ts$)/;
const STUDIO = /^(studio\/|bos\/)/;

function scopeOf(p) {
  if (STUDIO.test(p)) return "studio";
  if (ARTIFACT.test(p)) return "artifact";
  return DATAFILE.test(p) ? "src" : "piano";
}
const z = () => ({ adds: 0, dels: 0, commits: 0 });

const weeks = new Map();
let cur = null, curKey = null;
for (const line of raw.split("\n")) {
  if (line.startsWith("__C__")) {
    const d = new Date(line.slice(5).slice(0, 10) + "T00:00:00Z");
    const dow = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - (dow - 1));
    curKey = d.toISOString().slice(0, 10);
    if (!weeks.has(curKey)) weeks.set(curKey, { all: z(), piano: z(), src: z(), studio: z() });
    cur = { wk: weeks.get(curKey), counted: new Set() };
    continue;
  }
  const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
  if (!m || !cur) continue;
  const sc = scopeOf(m[3]);
  const adds = m[1] === "-" ? 0 : +m[1];
  const dels = m[2] === "-" ? 0 : +m[2];
  const buckets = ["all", ...(sc === "piano" || sc === "src" ? ["piano"] : []), ...(sc === "src" ? ["src"] : []), ...(sc === "studio" ? ["studio"] : [])];
  for (const b of buckets) {
    cur.wk[b].adds += adds; cur.wk[b].dels += dels;
    if (!cur.counted.has(b)) { cur.wk[b].commits++; cur.counted.add(b); }
  }
}

const keys = [...weeks.keys()].sort();
const all = [];
let d = new Date(keys[0]);
const end = new Date(keys[keys.length - 1]);
while (d <= end) { all.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 7); }

const LOC = { all: 240469, piano: 111816, src: 104705 };

function analyze(label, scope, baseLoc) {
  const rows = all.map(k => ({ k, ...(weeks.get(k)?.[scope] || z()) }));
  let cum = 0;
  for (const r of rows) { r.net = r.adds - r.dels; cum += r.net; }
  const scale = cum > 0 ? baseLoc / cum : 1;
  console.log(`\n===== ${label} =====`);
  console.log(`weeks: ${all.length} (${rows[0].k} → ${rows[rows.length - 1].k}) · commits: ${rows.reduce((a, r) => a + r.commits, 0)} · cumulative net LOC: ${Math.round(cum).toLocaleString()}`);
  for (const W of [4, 8, 12, 26]) {
    const tail = rows.slice(-W);
    const net = tail.reduce((a, r) => a + r.net, 0) * scale;
    const start = baseLoc - net;
    const pct = start > 0 ? (Math.pow(baseLoc / start, 1 / W) - 1) * 100 : NaN;
    console.log(`last ${String(W).padStart(2)}w: net ${net >= 0 ? "+" : ""}${Math.round(net).toLocaleString()} LOC  →  ${isNaN(pct) ? "n/a" : pct.toFixed(2) + "%"} / week (compounded)`);
  }
  const avg = (arr) => Math.round(arr.reduce((a, r) => a + r.adds + r.dels, 0) / arr.length);
  const cavg = (arr) => (arr.reduce((a, r) => a + r.commits, 0) / arr.length).toFixed(1);
  console.log(`churn: ${avg(rows.slice(-4)).toLocaleString()} LOC/wk · ${cavg(rows.slice(-4))} commits/wk (last 4w)`);
  console.log(`churn: ${avg(rows.slice(-12)).toLocaleString()} LOC/wk · ${cavg(rows.slice(-12))} commits/wk (last 12w)`);
  const top = [...rows].sort((a, b) => (b.adds + b.dels) - (a.adds + a.dels)).slice(0, 3);
  for (const t of top) console.log(`  peak ${t.k}: +${t.adds.toLocaleString()}/-${t.dels.toLocaleString()} (${t.commits} commits)`);
}

analyze("ALL repo", "all", LOC.all);
analyze("PIANO app (excl. artifacts & studio)", "piano", LOC.piano);
analyze("HAND-WRITTEN source (excl. data files)", "src", LOC.src);
