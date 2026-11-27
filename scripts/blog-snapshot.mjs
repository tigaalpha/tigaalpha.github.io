#!/usr/bin/env node
/* blog-snapshot.mjs — one snapshot of the published blog per day, kept in the repo, so translation work never has to read the live database again (Supabase free plan, nearly over quota).
     node scripts/blog-snapshot.mjs            (the GitHub Action blog-snapshot.yml runs it at 19:00 UTC = 02:00 Thai time)
   Reads through the PUBLIC REST API with the public anon key that already ships in supabase-client.ts (RLS lets everyone read published posts): no secret, nothing written to the database.
   data/blog-snapshot/index.json    one row per published article, NO body: id, lang, slug, title, excerpt, category, cover_url, created_at, updated_at, live_only
   data/blog-snapshot/en-bodies.json  { "<slug>": { updated_at, body } } for the English articles only (the source of every translation)
   data/blog-snapshot/meta.json     { taken_at, rows, en, last_updated_at }
   INCREMENTAL: after the first run only rows with updated_at > the last one seen are fetched (a changed row replaces its old copy; a row deleted in the database stays until FULL=1 is set).
   Bodies are fetched ONLY for English rows that are new or changed, in pages of 25 so one answer stays small. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DIR = path.join(ROOT, "data/blog-snapshot");
const src = fs.readFileSync(path.join(ROOT, "supabase-client.ts"), "utf8");
const URL_ = src.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)[1], KEY = src.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)[1];
const H = { apikey: KEY, Authorization: "Bearer " + KEY };
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch (e) { return d; } };
fs.mkdirSync(DIR, { recursive: true });
const full = process.env.FULL === "1";
const meta = full ? {} : rd("meta.json", {}), index = full ? [] : rd("index.json", []), bodies = full ? {} : rd("en-bodies.json", {});
const since = meta.last_updated_at || "1970-01-01T00:00:00Z";
async function page(select, filter, from, size) {
  const q = `${URL_}/rest/v1/blog_posts?select=${select}&published=eq.true${filter}&order=updated_at.asc,id.asc`;
  const r = await fetch(q, { headers: { ...H, Range: `${from}-${from + size - 1}`, "Range-Unit": "items" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}
const COLS = "id,lang,slug,title,excerpt,category,cover_url,created_at,updated_at,live_only";
const changed = []; let from = 0;
for (;;) {
  const rows = await page(COLS, `&updated_at=gt.${encodeURIComponent(since)}`, from, 1000);
  changed.push(...rows); if (rows.length < 1000) break; from += 1000;
}
const byId = new Map(index.map((r) => [r.id, r]));
for (const r of changed) byId.set(r.id, r);
const out = [...byId.values()].sort((a, b) => (a.lang + a.slug).localeCompare(b.lang + b.slug));
// bodies of the English articles that are new or changed
const needBody = changed.filter((r) => r.lang === "en" && (!bodies[r.slug] || bodies[r.slug].updated_at !== r.updated_at));
for (let i = 0; i < needBody.length; i += 25) {
  const ids = needBody.slice(i, i + 25).map((r) => r.id).join(",");
  const rows = await (await fetch(`${URL_}/rest/v1/blog_posts?select=id,slug,updated_at,body&id=in.(${ids})`, { headers: H })).json();
  for (const r of rows) bodies[r.slug] = { updated_at: r.updated_at, body: r.body };
}
const enSlugs = new Set(out.filter((r) => r.lang === "en").map((r) => r.slug));
for (const s of Object.keys(bodies)) if (!enSlugs.has(s)) delete bodies[s];
const last = changed.length ? changed[changed.length - 1].updated_at : since;
fs.writeFileSync(path.join(DIR, "index.json"), JSON.stringify(out));
fs.writeFileSync(path.join(DIR, "en-bodies.json"), JSON.stringify(bodies));
fs.writeFileSync(path.join(DIR, "meta.json"), JSON.stringify({ taken_at: new Date().toISOString(), rows: out.length, en: enSlugs.size, fetched_rows: changed.length, fetched_bodies: needBody.length, last_updated_at: last }, null, 1));
console.log(`snapshot: ${out.length} published rows (${changed.length} fetched), ${enSlugs.size} English bodies (${needBody.length} fetched)`);
