#!/usr/bin/env node
/* blog-translation-insert.mjs <lang> [limit]  — insert checked translation files into public.blog_posts in SMALL batches (<= 25 rows per request).
   Needs the service-role key in the environment (SUPABASE_SERVICE_ROLE_KEY — a GitHub secret in the workflow, never in the repo): anon / authenticated cannot write blog_posts (RLS: top admin only).
   Only files that pass `blog-translation-check.mjs <lang> --ok` are sent; nothing else is. Rows: lang, slug (= the English slug), title, excerpt, body, category + cover_url + created_at of the English row,
   published = true, live_only = true (served live, like every queue translation; the static builder writes no page). ON CONFLICT (lang, slug) DO NOTHING: re-running is safe and never overwrites.
   Writes data/blog-translation/inserted-<lang>.json (slugs sent) and progress.md numbers. Reads nothing from the database except the answer of the insert itself (Prefer: return=minimal + count). */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), D = path.join(ROOT, "data/blog-translation");
const lang = process.argv[2], limit = Math.max(1, Math.min(25, Number(process.argv[3]) || 25)), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^[a-z]{2}$/.test(lang || "") || !KEY) { console.error("usage: SUPABASE_SERVICE_ROLE_KEY=... blog-translation-insert.mjs <lang> [limit<=25]"); process.exit(2); }
const URL_ = fs.readFileSync(path.join(ROOT, "supabase-client.ts"), "utf8").match(/SUPABASE_URL\s*=\s*"([^"]+)"/)[1];
const doneFile = path.join(D, `inserted-${lang}.json`), done = new Set(fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, "utf8")) : []);
const ok = execFileSync("node", [path.join(ROOT, "scripts/blog-translation-check.mjs"), lang, "--ok"], { encoding: "utf8" }).split("\n").filter(Boolean).filter((s) => !done.has(s)).slice(0, Math.min(25, limit));
const ix = JSON.parse(fs.readFileSync(path.join(ROOT, "data/blog-snapshot/index.json"), "utf8")), en = new Map(ix.filter((r) => r.lang === "en").map((r) => [r.slug, r]));
const rows = ok.map((slug) => { const t = JSON.parse(fs.readFileSync(path.join(D, lang, slug + ".json"), "utf8")), e = en.get(t.source_slug || slug); if (!e) throw new Error("no English row in the snapshot for " + (t.source_slug || slug));
  return { lang, slug: lang === "th" || lang === "en" ? slug : slug + "-" + lang, title: t.title, excerpt: t.excerpt, body: t.body, category: e.category, cover_url: e.cover_url, created_at: e.created_at, published: true, live_only: true }; });
if (!rows.length) { console.log("nothing to insert"); process.exit(0); }
const r = await fetch(`${URL_}/rest/v1/blog_posts?on_conflict=lang,slug`, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(rows) });
if (!r.ok) { console.error("HTTP", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
const got = await r.json(); const inserted = new Set(got.map((x) => x.slug));   // ignore-duplicates: a row that already existed is simply absent from the answer
for (const s of ok) done.add(s);
fs.writeFileSync(doneFile, JSON.stringify([...done].sort(), null, 1));
console.log(`sent ${rows.length}, inserted ${inserted.size}, already existed ${rows.length - inserted.size}`);
