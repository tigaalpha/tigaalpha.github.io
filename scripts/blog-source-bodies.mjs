#!/usr/bin/env node
/* blog-source-bodies.mjs <target-lang> [limit]  — READ-ONLY. Fetch the bodies of the SOURCE articles (zh / ja / ko / ru / hi / es / fr / ar ... : every topic whose source is not English) that <target-lang> still lacks.
   Owner approval 2026-11-28 19:09 ("fetch the non-English source text through a read-only GitHub Action"). Uses the public anon key that already ships in supabase-client.ts: no secret, nothing is written to the database.
   The list of what is needed comes from scripts/blog-topic-map.mjs (repo snapshot, no database). Rows already stored in data/blog-snapshot/src-bodies/<srclang>.json are never fetched again;
   at most <limit> (default 300) bodies per run, in pages of 20 ids, so one answer stays small (Supabase free plan). Output: data/blog-snapshot/src-bodies/<srclang>.json  { "<slug>": { title, excerpt, category, updated_at, body } } */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), OUT = path.join(ROOT, "data/blog-snapshot/src-bodies");
const target = process.argv[2], limit = Math.max(1, Math.min(1000, Number(process.argv[3]) || 300));
if (!/^[a-z]{2}$/.test(target || "")) { console.error("usage: blog-source-bodies.mjs <target-lang> [limit]"); process.exit(2); }
const list = path.join(os.tmpdir(), "topics-full.json");
execFileSync("node", [path.join(ROOT, "scripts/blog-topic-map.mjs")], { env: { ...process.env, TOPIC_LIST: list }, stdio: "ignore" });
const miss = JSON.parse(fs.readFileSync(list, "utf8")).missing[target] || [];
const skip = path.join(ROOT, "data/blog-translation", `skip-${target}.json`), skipped = new Set(fs.existsSync(skip) ? JSON.parse(fs.readFileSync(skip, "utf8")) : []);
const src = fs.readFileSync(path.join(ROOT, "supabase-client.ts"), "utf8");
const URL_ = src.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)[1], KEY = src.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)[1], H = { apikey: KEY, Authorization: "Bearer " + KEY };
fs.mkdirSync(OUT, { recursive: true });
const store = {}; const load = (l) => (store[l] = store[l] || (fs.existsSync(path.join(OUT, l + ".json")) ? JSON.parse(fs.readFileSync(path.join(OUT, l + ".json"), "utf8")) : {}));
const want = {};   // srclang -> [slug]
let n = 0;
for (const m of miss) { if (m.src_lang === "en" || skipped.has(m.stem)) continue; if (load(m.src_lang)[m.src_slug]) continue; if (n >= limit) break; (want[m.src_lang] = want[m.src_lang] || []).push(m.src_slug); n++; }
let got = 0;
for (const [l, slugs] of Object.entries(want)) {
  for (let i = 0; i < slugs.length; i += 20) {
    const part = slugs.slice(i, i + 20), q = part.map((s) => `"${s}"`).join(",");
    const r = await fetch(`${URL_}/rest/v1/blog_posts?select=slug,title,excerpt,category,updated_at,body&published=eq.true&lang=eq.${l}&slug=in.(${encodeURIComponent(q)})`, { headers: H });
    if (!r.ok) { console.error("HTTP", r.status, (await r.text()).slice(0, 200)); process.exit(1); }
    for (const row of await r.json()) { store[l][row.slug] = { title: row.title, excerpt: row.excerpt, category: row.category, updated_at: row.updated_at, body: row.body }; got++; }
  }
  fs.writeFileSync(path.join(OUT, l + ".json"), JSON.stringify(store[l]));
}
const left = miss.filter((m) => m.src_lang !== "en" && !skipped.has(m.stem) && !load(m.src_lang)[m.src_slug]).length;
console.log(`source bodies for ${target}: asked ${n}, stored ${got}; still to fetch ${left}`);
