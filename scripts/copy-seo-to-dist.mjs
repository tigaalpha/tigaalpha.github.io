// Vercel serves dist/ only, but the song pages, landing pages, sitemap.xml, robots.txt and the blog are written to the repo root (that is what GitHub Pages serves).
// Without this step tigaalpha.com/sitemap.xml and /landing/ fall through to the app's index.html. Copies those outputs into dist/ as the last build step.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DIST = path.join(ROOT, "dist");
// ja / ko / ru indexes and feeds are baked into blog/ for GitHub Pages. On Vercel a file wins over the rewrite, so those three
// would hide posts published after the build. Drop only them from dist/; the article HTML stays, and the repo files are not touched.
export function stripLiveBlogShell(blogDir) {
  for (const lang of ["ja", "ko", "ru"]) {
    const dir = path.join(blogDir, lang);
    for (const name of ["index.html", "feed.xml"]) fs.rmSync(path.join(dir, name), { force: true });
    fs.rmSync(path.join(dir, "page"), { recursive: true, force: true });
  }
}
function copySeo() {
let n = 0;
for (const x of ["songs", "blog", "landing", "landing-en", "landing-zh", "landing-ja", "landing-ko", "landing-ru", "landing.html", "landing-en.html", "landing-zh.html", "landing-ja.html", "landing-ko.html", "landing-ru.html", "sitemap.xml", "sitemap-pages.xml", "sitemap-songs.xml", "robots.txt", "privacy-policy.html", "knowledge-sources.html"]) {
  const from = path.join(ROOT, x); if (!fs.existsSync(from)) continue;
  fs.cpSync(from, path.join(DIST, x), { recursive: true, force: true }); n++;
}
stripLiveBlogShell(path.join(DIST, "blog"));
// Vite copies public/ into dist, but these two must exist as text/plain even if a later step is the one that places them.
for (const x of ["llms.txt", "llms-full.txt", "humans.txt", "8f3c1a9e6b274d05a1c8e7f04b2d6a91.txt"]) {
  const from = path.join(ROOT, "public", x);
  if (!fs.existsSync(from)) { console.error("copy-seo-to-dist: missing public/" + x); process.exit(1); }
  fs.copyFileSync(from, path.join(DIST, x)); n++;
}
const about = path.join(ROOT, "public", "about");
if (fs.existsSync(about)) { fs.cpSync(about, path.join(DIST, "about"), { recursive: true, force: true }); n++; }
console.log(`copy-seo-to-dist: ${n} items copied into dist/`);
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) copySeo();
