#!/usr/bin/env node
/* fix-old-domain-links.mjs — points the article sources at the real domain (owner 2026-11-26, Step 1.4).
     node scripts/fix-old-domain-links.mjs --dry     list what would change, write nothing
     node scripts/fix-old-domain-links.mjs           rewrite the files
   What it does, in blog-src/<lang>/<slug>.json (the committed article sources; blog-data/<lang>.ts is GENERATED from them by `npm run build` / build-blog-static-data.mjs and is not edited here):
     https://tigaalpha.github.io/landing<xx>/...  ->  https://www.tigaalpha.com/landing<xx>/...   (the language of the link is kept)
     a landing link with no utm_source gets  utm_source=blog&utm_medium=seo&utm_campaign=<slug of the article>  (added with ? or, when the link already has a query, with &; never twice)
     any other https://tigaalpha.github.io/<path> a reader can tap  ->  https://www.tigaalpha.com/<path>   (the path is kept)
   Idempotent: after one run nothing matches, a second run changes 0 files. The slug comes from the file's own "slug" field. The edit is on the raw text of the file, so the formatting of the JSON is untouched.
   NOT touched on purpose (system URLs, not links for people): native-updater.ts UPDATE_MANIFEST_URL, updates/, scripts/publish-update.mjs, the JSDOM urls of the test scripts, studio/, bos/, backups/, the already-applied supabase-blog-*-migration* files. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const SRC = path.resolve(process.env.BLOG_SRC || path.join(ROOT, "blog-src"));
const OLD = /https:\/\/tigaalpha\.github\.io(\/[^\s"'\\)<>\]]*)?/g;
const NEW_HOST = "https://www.tigaalpha.com";

/* the new text of one link; `slug` is the campaign name */
export function fixLink(url, slug) {
  const m = /^https:\/\/tigaalpha\.github\.io(\/[^\s"'\\)<>\]]*)?$/.exec(url);
  if (!m) return url;
  const rest = m[1] || "/";
  const q = rest.indexOf("?");
  const pathPart = q < 0 ? rest : rest.slice(0, q), query = q < 0 ? "" : rest.slice(q + 1);
  let out = NEW_HOST + pathPart + (q < 0 ? "" : "?" + query);
  if (/^\/landing[a-z-]*(\/|$)/.test(pathPart) && !/(^|&)utm_source=/.test(query) && slug) {
    out += (q < 0 ? "?" : "&") + "utm_source=blog&utm_medium=seo&utm_campaign=" + encodeURIComponent(slug);
  }
  return out;
}

const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".json")) files.push(p); } };
if (fs.existsSync(SRC)) walk(SRC);

const perDir = {};   // folder -> { files, links }
let totalFiles = 0, totalLinks = 0;
for (const f of files.sort()) {
  const text = fs.readFileSync(f, "utf8");
  let slug = ""; try { slug = String(JSON.parse(text).slug || ""); } catch (e) { console.error("skipped (not valid JSON): " + path.relative(ROOT, f)); continue; }
  let n = 0;
  const out = text.replace(OLD, (u) => { const v = fixLink(u, slug); if (v !== u) n++; return v; });
  if (!n) continue;
  const dir = path.relative(ROOT, path.dirname(f));
  perDir[dir] = perDir[dir] || { files: 0, links: 0 };
  perDir[dir].files++; perDir[dir].links += n; totalFiles++; totalLinks += n;
  if (!DRY) fs.writeFileSync(f, out);
}
for (const [d, v] of Object.entries(perDir)) console.log(`${DRY ? "would change" : "changed"} ${String(v.links).padStart(3)} link(s) in ${String(v.files).padStart(3)} file(s)  ${d}`);
console.log(`${DRY ? "dry run: " : ""}${totalLinks} link(s) in ${totalFiles} file(s)` + (totalFiles ? "" : " (nothing to change)") + (DRY ? "" : totalFiles ? "; now run `node scripts/build-blog-static-data.mjs` (npm run build does) so blog-data/ follows" : ""));
