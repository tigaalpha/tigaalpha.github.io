#!/usr/bin/env node
/* blog-topic-map.mjs — group the blog snapshot into TOPICS (one article across languages) and list what each language still lacks.
   Reads only the repo: data/blog-snapshot/index.json (+ en-bodies.json for the English source) and data/blog-translation/inserted-<lang>.json (rows the insert workflow added after the snapshot).
   Grouping (union-find): same stem (slug minus its own "-<lang>" suffix; th and en keep the plain slug) OR the same cover_url (queue translations copy the cover of their source).
   Source language per topic: en, else zh, else th, else the language with the most articles. Target slug of a new translation: the topic stem for th / en, <stem>-<lang> for every other language.
   Writes data/blog-translation/topics.json (per language: have / missing counts + the missing list [{stem, src_lang, src_slug, category, created_at, title}]). No database call. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), D = path.join(ROOT, "data/blog-translation");
const LANGS = ["th", "en", "zh", "es", "hi", "de", "ar", "fr", "ru", "ja", "ko"], ORDER = ["th", "en", "zh", "es", "hi", "de", "ar", "fr", "ru", "ja", "ko"];
const ix = JSON.parse(fs.readFileSync(path.join(ROOT, "data/blog-snapshot/index.json"), "utf8"));
const stemOf = (slug, lang) => (lang !== "en" && lang !== "th" && slug.endsWith("-" + lang) ? slug.slice(0, -lang.length - 1) : slug);
const rows = ix.map((r) => ({ lang: r.lang, slug: r.slug, stem: stemOf(r.slug, r.lang), cover: r.cover_url || "", cat: r.category, at: r.created_at, title: r.title }));
// rows the insert workflow added after the snapshot (their stem is the English slug; cover/date come from the English row)
const enRows = new Map(rows.filter((r) => r.lang === "en").map((r) => [r.slug, r]));
for (const l of LANGS) { const f = path.join(D, `inserted-${l}.json`); if (!fs.existsSync(f)) continue; for (const s of JSON.parse(fs.readFileSync(f, "utf8"))) { const slug = l === "th" || l === "en" ? s : s + "-" + l; if (!rows.some((r) => r.lang === l && r.slug === slug)) { const e = enRows.get(s) || {}; rows.push({ lang: l, slug, stem: s, cover: e.cover || "", cat: e.cat, at: e.at, title: "", added: true }); } } }
const par = new Map(); const find = (x) => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; }; const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par.set(a, b); };
const node = (k) => { if (!par.has(k)) par.set(k, k); return k; };
for (const r of rows) { uni(node("s:" + r.stem), node("s:" + r.stem)); if (r.cover) uni(node("s:" + r.stem), node("c:" + r.cover)); }
const topics = new Map();
for (const r of rows) { const k = find("s:" + r.stem); if (!topics.has(k)) topics.set(k, []); topics.get(k).push(r); }
const out = { taken_at: new Date().toISOString().slice(0, 10), topics: topics.size, per_lang: {}, missing: {}, merged_groups: 0 };
for (const l of LANGS) { out.per_lang[l] = { have: 0, missing: 0 }; out.missing[l] = []; }
const bigLang = (() => { const c = {}; for (const r of rows) c[r.lang] = (c[r.lang] || 0) + 1; return Object.keys(c).sort((a, b) => c[b] - c[a])[0]; })();
for (const [, g] of topics) {
  const stems = new Set(g.map((r) => r.stem)); if (stems.size > 1) out.merged_groups++;
  const have = new Set(g.map((r) => r.lang));
  const srcLang = ["en", "zh", "th", bigLang].find((l) => have.has(l)) || g[0].lang, src = g.find((r) => r.lang === srcLang && !r.added) || g.find((r) => r.lang === srcLang);
  // the topic stem: the English slug if there is one, else the source's own stem
  const stem = (g.find((r) => r.lang === "en") || src).stem;
  for (const l of LANGS) { if (have.has(l)) out.per_lang[l].have++; else { out.per_lang[l].missing++; out.missing[l].push({ stem, src_lang: srcLang, src_slug: src.slug, category: src.cat, created_at: src.at, title: src.title }); } }
}
for (const l of LANGS) out.missing[l].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.stem.localeCompare(b.stem));
// the full lists are big (~9 MB): they go where TOPIC_LIST says (default: not written); the committed file holds the counts only
if (process.env.TOPIC_LIST) fs.writeFileSync(process.env.TOPIC_LIST, JSON.stringify(out));
const sum = { taken_at: out.taken_at, topics: out.topics, per_lang: out.per_lang, missing_by_source: Object.fromEntries(LANGS.map((l) => [l, out.missing[l].reduce((a, m) => ((a[m.src_lang] = (a[m.src_lang] || 0) + 1), a), {})])) };
fs.writeFileSync(path.join(D, "topics-summary.json"), JSON.stringify(sum, null, 1));
console.log("topics", out.topics, "merged groups (several stems, one cover)", out.merged_groups, "source lang default", bigLang);
for (const l of ORDER) console.log(l.padEnd(3), "have", String(out.per_lang[l].have).padStart(5), "missing", String(out.per_lang[l].missing).padStart(5), "(from en:", out.missing[l].filter((m) => m.src_lang === "en").length + ")");
