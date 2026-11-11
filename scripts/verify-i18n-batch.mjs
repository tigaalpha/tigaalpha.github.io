// Checks a translated batch against its source batch.
//   node scripts/verify-i18n-batch.mjs <in.json> <out.json> [langs=ja,ko,ru]
// in.json  : [{ k, en, file }]
// out.json : { "<k>": { ja, ko, ru }, ... }
// A string passes when it keeps the English text's structure: the same {0} {1} holes, the same line breaks, the same **bold** pairs,
// the same emoji and the same digits and Latin brand words, and it is written in the target script.
// Exit code 0 only when nothing fails.
import fs from "node:fs";

const [, , inFile, outFile, langArg] = process.argv;
const langs = (langArg || "ja,ko,ru").split(",");
const src = JSON.parse(fs.readFileSync(inFile, "utf8"));
let out;
try { out = JSON.parse(fs.readFileSync(outFile, "utf8")); } catch (e) { console.log("FAIL cannot read " + outFile + ": " + e.message); process.exit(1); }

const SCRIPT = {
  ja: /[぀-ヿ㐀-鿿]/,
  ko: /[가-힯]/,
  ru: /[Ѐ-ӿ]/,
};
const holes = s => (s.match(/\{\d+\}/g) || []).sort().join(",");
const bold = s => (s.match(/\*\*/g) || []).length;
const nl = s => (s.match(/\n/g) || []).length;
const emoji = s => (s.match(/\p{Extended_Pictographic}/gu) || []).join("");
const digits = s => (s.match(/\d+/g) || []).join(",");
// words that are product names and must survive as written
const KEEP = ["TIGA ALPHA", "TIGA CHAT", "TIGA", "Play Along", "Alien Hunt", "Game Power", "Hand Coach", "Ear Gym", "PvP", "Premium", "Max", "Pro", "Spotify", "YouTube", "Google", "LINE", "MIDI", "AI", "XP", "EXP", "SRS"];

let fail = 0, warn = 0;
const bad = (k, lang, why) => { fail++; if (fail <= 60) console.log(`FAIL ${k} ${lang}: ${why}`); };
const wrn = (k, lang, why) => { warn++; if (warn <= 20) console.log(`warn ${k} ${lang}: ${why}`); };

for (const row of src) {
  const o = out[row.k];
  if (!o) { bad(row.k, "*", "missing"); continue; }
  const letters = /[A-Za-z]{3,}/.test(row.en.replace(/\{\d+\}/g, "").replace(/\bhttps?:\S+/g, ""));
  for (const lg of langs) {
    const t = o[lg];
    if (typeof t !== "string" || !t.trim()) { bad(row.k, lg, "empty"); continue; }
    if (holes(t) !== holes(row.en)) bad(row.k, lg, `holes ${holes(row.en)} -> ${holes(t)}`);
    if (nl(t) !== nl(row.en)) bad(row.k, lg, `line breaks ${nl(row.en)} -> ${nl(t)}`);
    if (bold(t) !== bold(row.en)) bad(row.k, lg, `** count ${bold(row.en)} -> ${bold(t)}`);
    if (emoji(t) !== emoji(row.en)) wrn(row.k, lg, `emoji ${emoji(row.en)} -> ${emoji(t)}`);
    if (digits(row.en) && digits(t) !== digits(row.en) && !/[０-９]/.test(t)) wrn(row.k, lg, `digits ${digits(row.en)} -> ${digits(t)}`);
    // the English was not just copied back, unless it is a name/number/symbol string
    if (letters && !SCRIPT[lg].test(t)) {
      const allKeep = KEEP.some(w => row.en.trim() === w) || /^[\W\d_A-Z]{1,6}$/.test(row.en.trim());
      if (!allKeep) bad(row.k, lg, "not written in " + lg);
    }
    for (const w of KEEP) if (w.length > 3 && row.en.includes(w) && !t.includes(w)) wrn(row.k, lg, `brand "${w}" missing`);
    if (t.length > row.en.length * 3 + 40) wrn(row.k, lg, "much longer than the English");
  }
}
const extra = Object.keys(out).filter(k => !src.some(r => r.k === k));
if (extra.length) wrn("*", "*", "keys not in the source: " + extra.slice(0, 5).join(","));
console.log(`${path0(inFile)}: ${src.length} strings x ${langs.length} languages, ${fail} fail, ${warn} warn`);
function path0(p) { return p.split("/").pop(); }
process.exit(fail ? 1 : 0);
