// Applies a reviewer's corrections to translated UI batches and re-verifies them.
//   node scripts/apply-i18n-review.mjs <workspace dir> <lang> <review.json>
// review.json: [{ batch: "07", k: "07-012", after: "corrected text", why: "short reason" }, ...]   (an empty array is a valid review)
// For each change the current text is read from <workspace>/out-<lang>/batch-<batch>.json, replaced, and the batch is re-checked with
// scripts/verify-i18n-batch.mjs; a change that makes the batch FAIL is reverted. The result, with the "before" text, is written next to the
// review as <review>.applied.json so the owner or the next agent can audit every edit.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [, , ws, lang, reviewFile] = process.argv;
if (!ws || !lang || !reviewFile) { console.error("usage: apply-i18n-review.mjs <workspace> <lang> <review.json>"); process.exit(2); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let changes;
try { changes = JSON.parse(fs.readFileSync(reviewFile, "utf8")); } catch (e) { console.log("FAIL cannot read the review file: " + e.message); process.exit(1); }
if (!Array.isArray(changes)) { console.log("FAIL the review file must be a JSON array"); process.exit(1); }

const outFile = b => path.join(ws, "out-" + lang, `batch-${b}.json`);
const inFile = b => path.join(ws, "in", `batch-${b}.json`);
const cache = {};
const load = b => (cache[b] ||= JSON.parse(fs.readFileSync(outFile(b), "utf8")));
const verify = b => spawnSync("node", [path.join(ROOT, "scripts/verify-i18n-batch.mjs"), inFile(b), outFile(b), lang], { encoding: "utf8" });

const applied = [], skipped = [];
const touched = new Set();
for (const c of changes) {
  const b = String(c.batch || "").padStart(2, "0");
  if (!c.k || typeof c.after !== "string" || !c.after.trim() || !fs.existsSync(outFile(b))) { skipped.push({ ...c, reason: "malformed or unknown batch" }); continue; }
  const out = load(b);
  if (!out[c.k]) { skipped.push({ ...c, reason: "unknown key" }); continue; }
  const before = out[c.k][lang];
  if (before === c.after) { skipped.push({ ...c, reason: "no change" }); continue; }
  out[c.k][lang] = c.after;
  fs.writeFileSync(outFile(b), JSON.stringify(out, null, 1));
  const r = verify(b);
  if (r.status !== 0) {
    out[c.k][lang] = before;   // this change broke the structure (holes, **, line breaks, language): put the old text back
    fs.writeFileSync(outFile(b), JSON.stringify(out, null, 1));
    skipped.push({ ...c, before, reason: "reverted: " + (r.stdout.split("\n").find(l => l.includes(c.k)) || "verifier failed") });
    continue;
  }
  applied.push({ ...c, before }); touched.add(b);
}
fs.writeFileSync(reviewFile.replace(/\.json$/, "") + ".applied.json", JSON.stringify({ applied, skipped }, null, 1));
for (const b of [...touched].sort()) { const r = verify(b); console.log(r.stdout.trim().split("\n").pop()); }
console.log(`${lang}: ${applied.length} corrections applied, ${skipped.length} skipped`);
