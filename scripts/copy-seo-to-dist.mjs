// Vercel serves dist/ only, but the song pages, landing pages, sitemap.xml, robots.txt and the blog are written to the repo root (that is what GitHub Pages serves).
// Without this step tigaalpha.com/sitemap.xml and /landing/ fall through to the app's index.html. Copies those outputs into dist/ as the last build step.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DIST = path.join(ROOT, "dist");
let n = 0;
for (const x of ["songs", "blog", "landing", "landing-en", "landing-zh", "landing.html", "landing-en.html", "landing-zh.html", "sitemap.xml", "robots.txt", "privacy-policy.html", "knowledge-sources.html"]) {
  const from = path.join(ROOT, x); if (!fs.existsSync(from)) continue;
  fs.cpSync(from, path.join(DIST, x), { recursive: true, force: true }); n++;
}
console.log(`copy-seo-to-dist: ${n} items copied into dist/`);
