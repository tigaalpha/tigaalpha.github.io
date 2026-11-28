#!/usr/bin/env node
/* blog-translation-check.mjs — judge translation files BEFORE anything is inserted into the database. Mirrors supabase-blog-translation-validate.sql (blog_check_staged) and adds what that file cannot see:
   the glossary keywords, competitor names, the school price, links, and every number / link / image of the English source.
     node scripts/blog-translation-check.mjs th            (every data/blog-translation/th/*.json)
     node scripts/blog-translation-check.mjs th some-slug  (one)
   Source = data/blog-snapshot/en-bodies.json (never the database). A translation file = { slug, source_slug, title, excerpt, body }.
   Schema note: blog_posts has title / excerpt / body only (no separate meta title, meta description or FAQ field): the title is the <title>, the excerpt the meta description, the FAQ lives inside the body as bold
   question lines, so "meta + FAQ present" is checked as title length, excerpt length and the same count of bold FAQ lines as the source.
   Exit 1 when any file has a problem. It checks form, not style: a human or the SQL checker (blog_check_staged) still sees the staged row later. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), D = path.join(ROOT, "data/blog-translation");
const lang = process.argv[2], only = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : "";
const GL = JSON.parse(fs.readFileSync(path.join(D, "glossary.json"), "utf8"));
if (!lang || !GL[lang] || lang === "brand" || lang === "forbidden" || lang === "_note") { console.error("usage: blog-translation-check.mjs <lang> [slug]"); process.exit(2); }
const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, "data/blog-snapshot/en-bodies.json"), "utf8"));
// a translation whose source is NOT English (owner 2026-11-28: every language gets every topic) carries source_lang; its source text is read from data/blog-snapshot/src-bodies/<srclang>.json (fetched by the blog-source-bodies Action)
const SRCX = {}; const srcOf = (t) => { if (!t.source_lang || t.source_lang === "en") return SRC[t.source_slug || t.slug]; const f = path.join(ROOT, "data/blog-snapshot/src-bodies", t.source_lang + ".json"); SRCX[t.source_lang] = SRCX[t.source_lang] || (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}); return SRCX[t.source_lang][t.source_slug]; };
const CTA = (() => { try { return JSON.parse(fs.readFileSync(path.join(D, "cta.json"), "utf8"))[lang]; } catch (e) { return null; } })();
const LIST_OK = process.argv.includes("--ok");   // print only the slugs that pass (used by the insert script)
const dir = path.join(D, lang); const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && (!only || f === only + ".json")) : [];
// same bands and shares as blog_check_staged (English is the source here, so the length bands are relative to English; zh/ja/ko are shorter, de/ru/es/fr longer)
const SHARE = { ja: [/[^ぁ-んァ-ヶー一-龯]/g, 0.75], ko: [/[^가-힣]/g, 0.7], ru: [/[^а-яА-ЯёЁ]/g, 0.85], hi: [/[^ऀ-ॿ]/g, 0.8], ar: [/[^؀-ۿݐ-ݿ]/g, 0.8], th: [/[^฀-๿]/g, 0.78], zh: [/[^㐀-鿿]/g, 0.7] };
const BAND = { th: [0.7, 2.0], zh: [0.25, 0.8], ja: [0.5, 1.4], ko: [0.5, 1.4], ru: [0.85, 1.6], hi: [0.8, 1.8], es: [0.95, 1.5], fr: [0.95, 1.5], ar: [0.7, 1.5], de: [0.95, 1.6] };
const letters = (s) => s.replace(/[^\p{L}]/gu, "");
const share = (s, l) => { const t = letters(s); if (!t.length) return 0; const x = SHARE[l]; return x ? t.replace(x[0], "").length / t.length : t.replace(/[^A-Za-zÀ-ÿĀ-ſ]/g, "").length / t.length; };
const links = (s) => [...s.matchAll(/\]\((https?:\/\/[^)\s]+)\)|<(https?:\/\/[^>\s]+)>/g)].map((m) => m[1] || m[2]);
const imgs = (s) => [...s.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]).sort();
const nums = (s) => (s.replace(/\(https?:\/\/[^)]*\)/g, "").match(/\d[\d.,]*\d|\d/g) || []).map((n) => n.replace(/[.,]/g, "")).sort();
const count = (s, re) => (s.match(re) || []).length;
const fold = (s) => s.toLowerCase().normalize("NFC");
let bad = 0;
for (const f of files) {
  const t = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), src = srcOf(t), P = [];
  const all = [t.title, t.excerpt, t.body].join("\n"), lowAll = fold(all);
  if (!src) P.push("no_source");
  const sb = src ? src.body : "";
  if (lang !== "ja" && lang !== "zh" && /[㐀-䶿一-鿿]/.test(all)) P.push("han_characters");
  if (/(here is the translation|translation:|translator|todo|lorem ipsum|as an ai|i cannot|\[object|undefined)/i.test(all)) P.push("junk_text");
  if (SHARE[lang] ? share(t.body, lang) < SHARE[lang][1] : share(t.body, lang) < 0.97) P.push("body_script_share");
  if (!t.title || t.title.length < (["th","zh","ja","ko","ar","hi"].includes(lang) ? 4 : 8) || t.title.length > 130) P.push("title_length");
  if (!t.excerpt || t.excerpt.length < 20 || t.excerpt.length > 340 || /[*#`\[\n]/.test(t.excerpt)) P.push("excerpt_shape");
  const kw = GL[lang].core.concat(GL[lang].extra).map(fold); const core = GL[lang].core.map(fold);
  if (!core.some((k) => lowAll.includes(k))) P.push("no_core_keyword");
  if (!kw.some((k) => fold(t.title + " " + t.excerpt).includes(k))) P.push("keyword_not_in_title_or_excerpt");
  if (!/TIGA ALPHA/.test(all) && /TIGA/.test(sb)) P.push("brand_missing");
  if (/TIGA AI/i.test(all)) P.push("brand_tiga_ai");
  if (GL.forbidden.some((w) => lowAll.includes(w))) P.push("forbidden_name_or_price");
  const bl = links(t.body), sl = links(sb);
  if (bl.some((u) => /github\.io/.test(u))) P.push("old_domain_link");
  // the source may still carry the old github.io host (the automation writes it); the translation must carry the same NUMBER of links to the site, all on www.tigaalpha.com
  if (sl.length && bl.filter((u) => /tigaalpha\.com/.test(u)).length !== sl.filter((u) => /tigaalpha\.(com|github\.io)/.test(u)).length) P.push("site_link_count");
  if (bl.filter((u) => /tigaalpha\.com/.test(u)).some((u) => !u.startsWith("https://www.tigaalpha.com"))) P.push("site_link_host");
  if (JSON.stringify(imgs(t.body)) !== JSON.stringify(imgs(sb))) P.push("image_urls_differ");
  if (src) {
    const h = (s) => count(s, /(^|\n)#{2,3} /g), b = (s) => count(s, /(^|\n)[-*] /g), q = (s) => count(s, /(^|\n)\*\*/g);
    if (Math.abs(h(t.body) - h(sb)) > 2) P.push("heading_count");
    if (Math.abs(b(t.body) - b(sb)) > 4) P.push("bullet_count");
    if (Math.abs(q(t.body) - q(sb)) > 3) P.push("faq_count");
    const r = t.body.length / Math.max(1, sb.length), band = t.source_lang && t.source_lang !== "en" ? [0.6, 8] : BAND[lang]; if (r < band[0]) P.push("too_short"); if (r > band[1]) P.push("too_long");
    // prices: Thai keeps 799 baht, every other language US$24.99; numbers of the source must survive (years, steps, durations), except those that are the price itself
    const strip = (s) => s.replace(/US\$\s?24\.99|24\.99|799|฿\s?799/g, "");
    const sn = nums(strip(sb)), tn = nums(strip(t.body)); const missing = sn.filter((n) => !tn.includes(n));
    if (missing.length > Math.max(2, Math.floor(sn.length * 0.1))) P.push("numbers_differ(" + missing.slice(0, 5).join(",") + ")");
    const hasPrice = /US\$\s?24\.99|799/.test(sb);
    if (hasPrice && lang === "th" && !/799/.test(t.body)) P.push("price_missing");
    if (hasPrice && lang !== "th" && !/US\$\s?24\.99/.test(t.body)) P.push("price_missing");
  }
  if (lang !== "th" && /THB|฿|บาท|¥|元|RMB/.test(t.body)) P.push("wrong_price_text");
  if (CTA && (!t.body.includes(CTA.paragraph) || !t.body.includes(CTA.bullets))) P.push("stored_promo_block_missing");   // blog_check_staged: cta_paragraph_missing / cta_links_missing
  if (LIST_OK) { if (!P.length) console.log(f.replace(/\.json$/, "")); } else console.log((P.length ? "✗ " : "✓ ") + f + (P.length ? "  " + P.join(", ") : ""));
  if (P.length) bad++;
}
if (!LIST_OK) console.log(`\n${files.length} file(s), ${bad} with problems`);
process.exit(bad ? 1 : 0);
