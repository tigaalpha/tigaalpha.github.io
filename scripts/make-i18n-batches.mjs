// Splits the English UI strings of the app into translation batches for a new language.
//   node scripts/make-i18n-batches.mjs --out=DIR [--size=190] [--chars=15000]
// Writes DIR/in/batch-NN.json  [{ k: "NN-001", en, file }]  with every string the code shows (scripts/extract-i18n.mjs) that is
// already in i18n-src/catalog.json or still has to be translated (the same rule as `build-i18n-catalogs.mjs --coverage`), grouped by the file
// it appears in so a translator sees related strings together. Strings whose ja / ko / ru entry is missing are ALSO written to DIR/in/batch-gap.json,
// so the older languages can catch up. Merge translated output back with `build-i18n-catalogs.mjs --merge=DIR --langs=hi,es,fr`.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const arg = n => (process.argv.find(a => a.startsWith("--" + n + "=")) || "").slice(n.length + 3);
const out = arg("out");
if (!out) { console.error("usage: make-i18n-batches.mjs --out=DIR [--size=190] [--chars=15000]"); process.exit(2); }
const SIZE = +(arg("size") || 190), CHARS = +(arg("chars") || 15000);

const tmp = path.join(ROOT, "i18n-src", ".batches.json");
execFileSync("node", [path.join(ROOT, "scripts/extract-i18n.mjs"), "--out=" + tmp], { stdio: "ignore" });
const used = JSON.parse(fs.readFileSync(tmp, "utf8")).strings;
fs.rmSync(tmp);
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n-src", "catalog.json"), "utf8"));
const SKIP = /^(songs-classical\.ts|songs-data\.ts|admin-nav\.tsx|ra-planets\.ts|landing\/|Admin|Lead|Tigamodel)/;
const target = used.filter(x => catalog[x.en] || (!x.files.every(f => SKIP.test(f)) && x.en.length <= 1200));
target.sort((a, b) => (a.files[0] || "").localeCompare(b.files[0] || "") || a.en.localeCompare(b.en));

fs.mkdirSync(path.join(out, "in"), { recursive: true });
let batch = [], chars = 0, nb = 0, total = 0;
const flush = () => {
  if (!batch.length) return;
  nb++;
  const nn = String(nb).padStart(2, "0");
  fs.writeFileSync(path.join(out, "in", `batch-${nn}.json`), JSON.stringify(batch.map((x, i) => ({ k: `${nn}-${String(i + 1).padStart(3, "0")}`, en: x.en, file: x.files.slice(0, 2).join(", ") })), null, 1));
  total += batch.length; batch = []; chars = 0;
};
for (const x of target) {
  if (batch.length >= SIZE || (chars + x.en.length > CHARS && batch.length)) flush();
  batch.push(x); chars += x.en.length;
}
flush();
const gap = target.filter(x => !catalog[x.en] || !catalog[x.en].ja || !catalog[x.en].ko || !catalog[x.en].ru);
fs.writeFileSync(path.join(out, "in", "batch-gap.json"), JSON.stringify(gap.map((x, i) => ({ k: `gap-${String(i + 1).padStart(3, "0")}`, en: x.en, file: x.files.slice(0, 2).join(", ") })), null, 1));
const stale = Object.keys(catalog).filter(k => !used.some(x => x.en === k)).length;
console.log(`${nb} batches, ${total} strings (${used.length} used in the code, ${Object.keys(catalog).length} in the catalog, ${stale} catalog entries no longer used by the code, ${gap.length} strings missing ja / ko / ru)`);
