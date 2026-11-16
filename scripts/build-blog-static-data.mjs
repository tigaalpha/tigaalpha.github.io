#!/usr/bin/env node
/* build-blog-static-data.mjs — writes blog-data/<lang>.ts for ja ko ru hi es fr ar from the committed article sources (blog-src/<lang>/<slug>.json).
     node scripts/build-blog-static-data.mjs               write the files (a file is only rewritten when its text changed)
     node scripts/build-blog-static-data.mjs --check       exit 1 when a file is missing or stale (does not write)
     node scripts/build-blog-static-data.mjs --out=DIR     write into DIR instead of blog-data/ (also BLOG_DATA_OUT=DIR; BLOG_SRC=DIR points at another blog-src, as for build-blog-pages.mjs)
   Why: the in-app blog (BlogPage.tsx) reads public.blog_posts, and until supabase-blog-ja-ko-ru-migration.sql / supabase-blog-hi-es-fr-ar-migration.sql have been applied the table does not hold
   these languages. So that choosing a flag shows that language's articles straight away, BlogPage lazy-imports blog-data/<lang>.ts (its own chunk, never in the main bundle) and merges it with the
   database rows by slug: a database row wins, these rows fill what the database lacks. Each file is `export default` an array of BlogPost-shaped objects, newest first, ids "static:<lang>:<slug>"
   (BlogPage sends no view / read RPC for such an id: public.blog_hit() only counts an article that has a published row). A language with an empty or missing blog-src folder still gets a file
   (an empty array), because BlogPage imports all seven by name and a missing file would break the bundle.
   The articles are read through readStaticPosts() of build-blog-pages.mjs, the function the static pages and the SQL seed use, so a draft or malformed source file is skipped here exactly as there.
   The output depends only on blog-src (no dates, no randomness), so --check is a plain text comparison. `npm run build` runs this before vite (verify with `npm run verify:blogdata`). */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { readStaticPosts, STATIC_LANGS } from "./build-blog-pages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "").slice(n.length + 3);
const CHECK = process.argv.includes("--check");
const OUT = path.resolve(arg("out") || process.env.BLOG_DATA_OUT || path.join(ROOT, "blog-data"));
const SRC_LABEL = process.env.BLOG_SRC ? path.basename(path.resolve(process.env.BLOG_SRC)) : "blog-src";
const show = (f) => { const r = path.relative(ROOT, f); return r.startsWith("..") ? f : r || "."; };   // a path inside the repo is shown relative, any other (a test folder) as it is

// JSON.stringify leaves U+2028 / U+2029 raw (legal in a JS string since ES2019); escape them so no tool that still reads them as line breaks can trip over an article
const LS_PS = new RegExp("[" + String.fromCharCode(0x2028, 0x2029) + "]", "g");
const js = (v) => JSON.stringify(v).replace(LS_PS, (c) => "\\u" + c.charCodeAt(0).toString(16));
const byNewest = (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

// the exact field names BlogPage.tsx reads (BlogPost): cover_url / cover_alt are null unless a source file carries a cover, updated_at falls back to created_at
const rowText = (p) => {
  const f = [
    ["id", "static:" + p.lang + ":" + p.slug], ["lang", p.lang], ["slug", p.slug], ["title", p.title], ["excerpt", p.excerpt || ""], ["body", p.body], ["category", p.category || "tips"],
    ["cover_url", p.cover_url || null], ["cover_alt", null], ["created_at", p.created_at], ["updated_at", p.updated_at || p.created_at], ["published", true],
  ];
  return "  {\n" + f.map(([k, v]) => `    ${k}: ${js(v)},`).join("\n") + "\n  },\n";
};
const fileText = (lang, list) => `/* GENERATED - do not edit by hand. Written by scripts/build-blog-static-data.mjs from ${SRC_LABEL}/${lang}/*.json (${list.length} article${list.length === 1 ? "" : "s"}); edit the source file and rerun the script
   (node scripts/build-blog-static-data.mjs, or npm run build; node scripts/build-blog-static-data.mjs --check fails when this file is stale).
   BlogPage.tsx imports this file lazily when the ${lang} tab of the in-app blog is open and merges it with the rows of public.blog_posts by slug: a database row wins, these rows fill what the
   database lacks. Newest first. The "static:" id means: no view counting (public.blog_hit() has no row for it). */
import type { BlogPost } from "../BlogPage";
const posts: BlogPost[] = [${list.length ? "\n" + list.map(rowText).join("") : ""}];
export default posts;
`;

const all = readStaticPosts();
let stale = 0, wrote = 0, same = 0, articles = 0;
if (!CHECK) fs.mkdirSync(OUT, { recursive: true });
for (const lang of STATIC_LANGS) {
  const list = all.filter((p) => p.lang === lang).sort(byNewest);
  articles += list.length;
  const text = fileText(lang, list), file = path.join(OUT, lang + ".ts");
  let cur = ""; try { cur = fs.readFileSync(file, "utf8"); } catch (e) { /* missing */ }
  if (cur === text) { same++; continue; }
  if (CHECK) { stale++; console.log("stale: " + show(file) + (cur ? "" : " (missing)")); continue; }
  const tmp = file + ".tmp-" + process.pid;   // write + rename: another build reading the folder at the same time never sees half a file
  fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); wrote++;
  console.log(`wrote ${show(file)} (${list.length} article${list.length === 1 ? "" : "s"}, ${(Buffer.byteLength(text) / 1024).toFixed(0)} kB)`);
}
if (CHECK) {
  if (stale) { console.log(`blog-data is stale: ${stale} of ${STATIC_LANGS.length} files differ from ${SRC_LABEL}/ (run: node scripts/build-blog-static-data.mjs)`); process.exit(1); }
  console.log(`blog-data is current (${articles} articles in ${STATIC_LANGS.length} files)`);
} else console.log(`build-blog-static-data: ${articles} articles in ${STATIC_LANGS.length} files (${wrote} written, ${same} unchanged) -> ${show(OUT)}`);
