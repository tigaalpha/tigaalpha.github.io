#!/usr/bin/env node
/* blog-gap.mjs — which English articles still lack a translation, per language. Reads ONLY data/blog-snapshot/index.json (never the database).
     node scripts/blog-gap.mjs        -> data/blog-translation/gap.json (+ prints the counts)
   Pairing (from supabase-blog-translation-queue-migration.sql, blog_target_slug): the translation of English article <slug> is
   th -> the same slug in lang th; every other language -> <slug>-<lang> (the queue's rule), and the SAME slug in that language for the committed blog-src articles (blog-src files share the English slug).
   An English article counts as covered in a language when ANY of those slugs exists there (published rows only; staged / unpublished rows are not in the snapshot). */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), SNAP = path.join(ROOT, "data/blog-snapshot/index.json");
if (!fs.existsSync(SNAP)) { console.error("no snapshot yet: run the blog-snapshot workflow first"); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(SNAP, "utf8"));
const LANGS = ["th", "zh", "es", "hi", "de", "ar", "fr", "ru", "ja", "ko"];
const have = {}; for (const l of LANGS) have[l] = new Set(rows.filter((r) => r.lang === l).map((r) => r.slug));
const en = rows.filter((r) => r.lang === "en").sort((a, b) => a.slug.localeCompare(b.slug));
const slugsFor = (slug, l) => (l === "th" ? [slug] : [slug + "-" + l, slug, slug.replace(/-zh$/, "") + "-" + l]);
const out = { taken_from: "data/blog-snapshot/index.json", english_articles: en.length, per_lang: {}, missing: {} };
for (const l of LANGS) {
  const miss = en.filter((r) => !slugsFor(r.slug, l).some((s) => have[l].has(s))).map((r) => ({ slug: r.slug, title: r.title, category: r.category, created_at: r.created_at }));
  out.per_lang[l] = { have: en.length - miss.length, missing: miss.length, rows_in_language: have[l].size };
  out.missing[l] = miss;
}
fs.mkdirSync(path.join(ROOT, "data/blog-translation"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data/blog-translation/gap.json"), JSON.stringify(out, null, 1));
console.log("English articles:", en.length);
for (const l of LANGS) console.log(l.padEnd(3), "have", String(out.per_lang[l].have).padStart(4), "missing", String(out.per_lang[l].missing).padStart(4), " (rows in that language:", out.per_lang[l].rows_in_language + ")");
