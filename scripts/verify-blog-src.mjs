// Checks a translated blog article (blog-src/<lang>/<slug>.json) against its English source.
//   node scripts/verify-blog-src.mjs <english.json> <translated.json> <lang>
// Both files: { lang, slug, title, excerpt, body, category, created_at, published }.
// The body is the light markdown the blog renders (## headings, - lists, 1. lists, **bold**, [text](https://url), ![alt](https://url)).
import fs from "node:fs";

const [, , enFile, trFile, lang] = process.argv;
const en = JSON.parse(fs.readFileSync(enFile, "utf8"));
let tr;
try { tr = JSON.parse(fs.readFileSync(trFile, "utf8")); } catch (e) { console.log("FAIL cannot read " + trFile + ": " + e.message); process.exit(1); }
const SCRIPT = { ja: /[぀-ヿ㐀-鿿]/g, ko: /[가-힯]/g, ru: /[Ѐ-ӿ]/g, hi: /[ऀ-ॿ]/g, ar: /[\u0600-\u06FF]/g }[lang];   // es / fr are Latin: judged by function words below
const LATIN = {
  es: "de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante tu te mi tus mis vez puedes puede ver hacer tiene tienes cada nuevo nueva primer".split(" "),
  fr: "de la le les des du un une et en que qui dans pour pas est sur avec ce se ne vous tu nous mon ton son ses au aux plus mais ou où par comme votre vos ta tes ma mes cette ces il elle être avoir fait faire chaque nouveau nouvelle premier".split(" "),
}[lang];
const EN_WORDS = new Set("the of and to in is that for it with as on are be this by at from or an not you your have has will can new each next first".split(" "));
function latinRatio(text) {
  const words = String(text).toLowerCase().replace(/https?:\/\/\S+/g, " ").match(/[a-zà-ÿ']+/g) || [];
  const target = new Set(LATIN);
  let t = 0, e = 0;
  for (const w of words) { const bare = w.replace(/^[ldjmntsc]'/, ""); if (target.has(w) || target.has(bare)) t++; if (EN_WORDS.has(w)) e++; }
  return { words: words.length, t, e };
}
let fail = 0;
const bad = m => { fail++; console.log("FAIL " + m); };
const count = (s, re) => (String(s).match(re) || []).length;

if (tr.lang !== lang) bad(`lang is "${tr.lang}", expected "${lang}"`);
if (tr.slug !== en.slug) bad(`slug "${tr.slug}" != "${en.slug}" (the slug is shared across languages for hreflang)`);
if (tr.category !== en.category) bad(`category "${tr.category}" != "${en.category}"`);
if (tr.published !== true) bad("published must be true");
if (!/^\d{4}-\d{2}-\d{2}/.test(tr.created_at || "")) bad("created_at must be an ISO date");
for (const k of ["title", "excerpt", "body"]) if (typeof tr[k] !== "string" || !tr[k].trim()) bad(`${k} is empty`);
if (tr.title && tr.title.length > 90) bad(`title is ${tr.title.length} chars (keep it under 90)`);
if (tr.excerpt && (tr.excerpt.length < 40 || tr.excerpt.length > 260)) bad(`excerpt is ${tr.excerpt.length} chars (40-260)`);

const b0 = en.body, b1 = tr.body || "";
const kinds = {
  "## headings": /^## /gm, "### headings": /^### /gm, "- bullets": /^\s*[-*] /gm, "numbered items": /^\s*\d+[.)] /gm,
  "bold pairs": /\*\*/g, "links": /\]\(https?:\/\//g, "images": /!\[/g, "paragraph breaks": /\n\n/g,
};
for (const [name, re] of Object.entries(kinds)) {
  const a = count(b0, re), b = count(b1, re);
  if (a !== b) bad(`${name}: English ${a}, translation ${b}`);
}
const urls = s => (String(s).match(/https?:\/\/[^\s)]+/g) || []).sort().join("\n");
const mapUrl = u => u.replace(/\/landing-(en|zh|ja|ko|ru|hi|es|fr|ar)\//g, `/landing-${lang}/`).replace(/\/landing\/(?=[?#]|$)/g, `/landing-${lang}/`).replace(/([?&])lg=(en|zh|th|ja|ko|ru|hi|es|fr|ar)\b/g, `$1lg=${lang}`);
if (urls(b0).split("\n").map(mapUrl).sort().join("\n") !== urls(b1)) bad("URLs differ from the English (only /landing-en/ -> /landing-" + lang + "/ and lg=" + lang + " may change)");
if (SCRIPT) {
  const scriptChars = count(b1, SCRIPT);
  const bodyLetters = b1.replace(/https?:\/\/\S+/g, "").replace(/[^\p{L}]/gu, "").length;
  if (scriptChars < bodyLetters * 0.5) bad(`body is not mostly ${lang} script (${scriptChars} of ${bodyLetters} letters)`);
  if (count(tr.title, SCRIPT) < 2) bad("title is not written in " + lang);
} else {
  const body = latinRatio(b1), ttl = latinRatio(tr.title), ex = latinRatio(tr.excerpt);
  if (body.words < 120) bad(`body has only ${body.words} words`);
  if (body.t < body.words * 0.12 || body.t < body.e * 2) bad(`body does not read as ${lang} (${body.t} ${lang} function words, ${body.e} English ones, ${body.words} words)`);
  if (ttl.words >= 4 && ttl.t < 1) bad(`title does not read as ${lang}`);
  if (ex.words >= 8 && (ex.t < 2 || ex.t < ex.e)) bad(`excerpt does not read as ${lang}`);
}
const ratio = b1.length / Math.max(1, b0.length);
if (ratio < 0.25 || ratio > 2.2) bad(`body length ratio ${ratio.toFixed(2)} looks wrong`);
if (/[぀-ヿ]/.test(b1) && lang !== "ja") bad("kana in a non-Japanese article");
if (/[가-힯]/.test(b1) && lang !== "ko") bad("hangul in a non-Korean article");
if (/[Ѐ-ӿ]/.test(b1) && lang !== "ru") bad("cyrillic in a non-Russian article");
if (/[ऀ-ॿ]/.test(b1) && lang !== "hi") bad("Devanagari in a non-Hindi article");
if (/[०-९]/.test(b1)) bad("Devanagari digits (the app writes digits 0-9)");
if (/[\u0660-\u0669\u06F0-\u06F9]/.test(b1)) bad("Arabic-Indic digits (the app writes digits 0-9)");
if (/[\u0600-\u06FF]/.test(b1) && lang !== "ar") bad("Arabic script in a non-Arabic article");
console.log(`${lang}/${tr.slug}: ${fail ? fail + " problem(s)" : "ok"}  (${b1.length} chars, ratio ${ratio.toFixed(2)})`);
process.exit(fail ? 1 : 0);
