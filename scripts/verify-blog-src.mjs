// Checks a translated blog article (blog-src/<lang>/<slug>.json) against its English source.
//   node scripts/verify-blog-src.mjs <english.json> <translated.json> <lang>
// Both files: { lang, slug, title, excerpt, body, category, created_at, published }.
// The body is the light markdown the blog renders (## headings, - lists, 1. lists, **bold**, [text](https://url), ![alt](https://url)).
import fs from "node:fs";

const [, , enFile, trFile, lang] = process.argv;
const en = JSON.parse(fs.readFileSync(enFile, "utf8"));
let tr;
try { tr = JSON.parse(fs.readFileSync(trFile, "utf8")); } catch (e) { console.log("FAIL cannot read " + trFile + ": " + e.message); process.exit(1); }
const SCRIPT = { ja: /[぀-ヿ㐀-鿿]/g, ko: /[가-힯]/g, ru: /[Ѐ-ӿ]/g }[lang];
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
const mapUrl = u => u.replace(/\/landing-(en|zh)\//g, `/landing-${lang}/`).replace(/([?&])lg=(en|zh|th)\b/g, `$1lg=${lang}`);
if (urls(b0).split("\n").map(mapUrl).sort().join("\n") !== urls(b1)) bad("URLs differ from the English (only /landing-en/ -> /landing-" + lang + "/ and lg=" + lang + " may change)");
const scriptChars = count(b1, SCRIPT);
const bodyLetters = b1.replace(/https?:\/\/\S+/g, "").replace(/[^\p{L}]/gu, "").length;
if (scriptChars < bodyLetters * 0.5) bad(`body is not mostly ${lang} script (${scriptChars} of ${bodyLetters} letters)`);
if (count(tr.title, SCRIPT) < 2) bad("title is not written in " + lang);
const ratio = b1.length / Math.max(1, b0.length);
if (ratio < 0.25 || ratio > 2.2) bad(`body length ratio ${ratio.toFixed(2)} looks wrong`);
if (/[぀-ヿ]/.test(b1) && lang !== "ja") bad("kana in a non-Japanese article");
if (/[가-힯]/.test(b1) && lang !== "ko") bad("hangul in a non-Korean article");
if (/[Ѐ-ӿ]/.test(b1) && lang !== "ru") bad("cyrillic in a non-Russian article");
console.log(`${lang}/${tr.slug}: ${fail ? fail + " problem(s)" : "ok"}  (${b1.length} chars, ratio ${ratio.toFixed(2)})`);
process.exit(fail ? 1 : 0);
