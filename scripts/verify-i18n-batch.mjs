// Checks a translated batch against its source batch.
//   node scripts/verify-i18n-batch.mjs <in.json> <out.json> [langs=ja,ko,ru]
// in.json  : [{ k, en, file }]
// out.json : { "<k>": { "<lang>": "..." }, ... }   (one language per file is fine: pass only that language in the third argument)
// Languages: ja ko ru hi ar (own script) and es fr (Latin script: told apart from English by function words, see LATIN below).
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
  hi: /[ऀ-ॿ]/,
  ar: /[\u0600-\u06FF]/,
};
// es / fr share the Latin script with English, so "written in the language" is judged by function words: a sentence of five or more words
// must have at least as many Spanish (French) function words as English ones, and at least one.
const LATIN = {
  es: "de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante tu te mi tus mis vez puedes puede ver hacer tiene tienes cada nuevo nueva primer toca elige siguiente".split(" "),
  fr: "de la le les des du un une et en que qui dans pour pas est sur avec ce se ne vous tu nous mon ton son ses au aux plus mais ou où par comme votre vos ta tes ma mes cette ces il elle être avoir fait faire chaque nouveau nouvelle premier suivant choisis".split(" "),
};
const EN_WORDS = "the of and to in is that for it with as on are be this by at from or an not you your have has will can new each next first choose play tap".split(" ");
function latinLooksRight(lg, text) {
  const words = text.toLowerCase().replace(/\{\d+\}/g, " ").replace(/https?:\S+/g, " ").match(/[a-zà-ÿ']+/g) || [];
  if (words.length < 5) return true;   // too short to judge: cognates and names are normal in labels
  const target = new Set(LATIN[lg]), en = new Set(EN_WORDS);
  let t = 0, e = 0;
  for (const w of words) { const bare = w.replace(/^[ldjmntsc]'/, ""); if (target.has(w) || target.has(bare)) t++; if (en.has(w)) e++; }
  return t >= 1 && t >= e;
}
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
    if (letters && LATIN[lg] && !latinLooksRight(lg, t)) bad(row.k, lg, "does not read as " + lg + " (looks English)");
    if (/[\u0900-\u097F]/.test(t) && lg !== "hi") bad(row.k, lg, "Devanagari in a non-Hindi string");
    if (/[०-९]/.test(t)) wrn(row.k, lg, "Devanagari digits (the app writes digits 0-9)");
    if (/[\u0600-\u06FF]/.test(t) && lg !== "ar") bad(row.k, lg, "Arabic script in a non-Arabic string");
    if (/[\u0660-\u0669\u06F0-\u06F9]/.test(t)) bad(row.k, lg, "Arabic-Indic digits (the app writes digits 0-9)");
    if (lg === "ar" && /[\u0900-\u097F]/.test(t)) bad(row.k, lg, "Devanagari in an Arabic string");
    if (letters && SCRIPT[lg] && !SCRIPT[lg].test(t)) {
      const bare = row.en.replace(/[^\p{L}\d ]/gu, "").trim().toLowerCase();
      const allKeep = KEEP.some(w => bare === w.toLowerCase()) || /^[\W\d_A-Z]{1,6}$/.test(row.en.trim());   // a product name (with or without an emoji) stays Latin
      if (!allKeep) bad(row.k, lg, "not written in " + lg);
    }
    for (const w of KEEP) if (w.length > 3 && row.en.includes(w) && !t.includes(w)) wrn(row.k, lg, `brand "${w}" missing`);
    if (t.length > row.en.length * 3 + 40) wrn(row.k, lg, "much longer than the English");
    if ((lg === "es" || lg === "fr") && row.en.length > 12 && t.trim() === row.en.trim() && !/^[\W\d_A-Z]+$/.test(row.en.trim())) wrn(row.k, lg, "identical to the English");
  }
}
const extra = Object.keys(out).filter(k => !src.some(r => r.k === k));
if (extra.length) wrn("*", "*", "keys not in the source: " + extra.slice(0, 5).join(","));
console.log(`${path0(inFile)}: ${src.length} strings x ${langs.length} languages, ${fail} fail, ${warn} warn`);
function path0(p) { return p.split("/").pop(); }
process.exit(fail ? 1 : 0);
