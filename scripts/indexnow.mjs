// Tell Bing and Yandex that the published blog URLs exist.
//   node scripts/indexnow.mjs
// Reads published rows only. Does not write posts. Google and Baidu have no
// IndexNow endpoint; their verification tags stay empty until a real code is given.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.tigaalpha.com";
const KEY = "8f3c1a9e6b274d05a1c8e7f04b2d6a91";
const KEY_URL = `${SITE}/${KEY}.txt`;
const src = fs.readFileSync(path.join(ROOT, "supabase-client.ts"), "utf8");
const URL_ = (/SUPABASE_URL = "([^"]+)"/.exec(src) || [])[1];
const ANON = (/SUPABASE_ANON_KEY = "([^"]+)"/.exec(src) || [])[1];

const urls = [`${SITE}/`, `${SITE}/blog/th/`, `${SITE}/blog/en/`, `${SITE}/blog/zh/`];
let off = 0;
for (let guard = 0; guard < 40; guard++) {
  const r = await fetch(`${URL_}/rest/v1/blog_posts?select=slug,lang&published=eq.true&order=created_at.desc&limit=500&offset=${off}`, {
    headers: { apikey: ANON, Authorization: "Bearer " + ANON },
  });
  if (!r.ok) { console.error("indexnow: list " + r.status); process.exit(1); }
  const rows = await r.json();
  for (const p of rows) if (p.slug && p.lang) urls.push(`${SITE}/blog/${p.lang}/${encodeURIComponent(p.slug)}.html`);
  if (rows.length < 500) break;
  off += 500;
}
const body = { host: "www.tigaalpha.com", key: KEY, keyLocation: KEY_URL, urlList: urls.slice(0, 10000) };
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
console.log(`indexnow: ${res.status} for ${body.urlList.length} urls`);
if (res.status !== 200 && res.status !== 202) process.exit(1);
