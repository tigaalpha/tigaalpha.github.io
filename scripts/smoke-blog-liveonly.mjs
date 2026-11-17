#!/usr/bin/env node
/* smoke-blog-liveonly.mjs — rows flagged live_only (supabase-blog-translation-queue-migration.sql, owner 2026-11-17: ~18,000 translated articles) are served LIVE from the database and get no static file anywhere.
   No network, no browser, no repo file touched: the generator is run through its BLOG_FIXTURE / BLOG_OUT door (and, for sitemap.xml and the live catalog, in a throw-away copy of the repo root, also with its database read
   answered by a local fake PostgREST), the live function with a fake fetch.
     node scripts/smoke-blog-liveonly.mjs          (PERF=1 adds the timing run: 3,500 static + 12,000 live-only synthetic rows; PERF=full also runs the old generator on all of them)
   What it proves
     generator   adding live_only rows to the input adds no file and changes no byte (article pages, indexes, feeds and pagination of the source-file languages, blog/sitemap-static.xml, sitemap.xml, hreflang sets, related lists,
                 the live catalog); a row with the flag absent / false / null is still a static page; a blog-src file shadowed by a live-only row is not written and not in the catalog; the log line says how many were left out.
     baseline    the static rows' files are byte-identical to what the generator at BASELINE_REF (the commit before this change, read with `git show`) writes for the same rows, and that old generator DOES write the live-only
                 files (so the fixture can see the problem). Needs that commit in the object store; without it this part is skipped and says so (BLOG_BASELINE_REQUIRED=1 makes that a failure). When the page output changes
                 on purpose later, move BASELINE_REF (env BLOG_BASELINE_REF) to the commit before that change.
     live        a live-only article is served 200 with the page structure of a static one; its related box costs one or two small queries (8 rows), never the whole language, under a short deadline of its own; a list is paged
                 with Prefer: count=exact, in pages of 1,000 and eight requests at a time (a server that caps a page is followed by what it sent), with the old sequential loop as the fallback; 60,000 rows still fit the guard;
                 every request has a deadline (8 s) and an empty first page with a positive total is a failure (503), never an empty list; an unpublished row (live-only or not) is never served, even when the API wrongly returns it.
     sitemap     (reviews 1, 4, 5) the blog sitemap is TEN files, /sitemap-blog-<lang>.xml, one per language, because a Vercel Function may not answer more than ~4.5 MB. At the size of the whole queue (21,200 rows; the old single
                 file is 9.8 MB) every file is far below the limit, well-formed, holds its language's rows (the ones that are files in the deploy AND the live-only ones), and together they hold every address once; one file reads
                 only its own language (2 to 4 requests, two rounds); an unknown language is a 404; and the pieces around it are in place: the rewrite, the 301 of /sitemap-blog.xml to /sitemap.xml, the app's catch-all letting the
                 files through, maxDuration of both functions, the safety cap of one file (urls and bytes), and the root sitemap.xml and robots.txt written by the REAL build-song-pages.mjs (the ten files listed directly, no index
                 inside an index, the old generator's other outputs byte for byte).
     build       (reviews 2, 3) the build reads only the rows that are not flagged (live_only=eq.false: a seventh of the bytes at the full queue), repeats without the filter on a 400, looks up the blog-src files a flagged row
                 shadows, reads past 20,000 rows (page guard 200 pages, and it says so when it is hit), and a read that is not complete (page guard, fewer rows than the announced total, a failed lookup) is not used: the older
                 pages stay. The whole generator is run against a local fake PostgREST and writes byte for byte what the BLOG_FIXTURE run of the same rows writes, also against the reviewers' mock that ignores the filter. */
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process"; import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.tigaalpha.com";
const BASELINE_REF = process.env.BLOG_BASELINE_REF || "0269a178d";
let pass = 0, fail = 0, skipped = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const skip = (m) => { skipped++; console.log("  - skipped:", m); };
const heading = (m) => console.log("\n" + m);
// what the functions log through console.warn (the reason of a sitemap 503, the page guard) is expected output of some checks below: show it as such
const realWarn = console.warn; console.warn = (...a) => realWarn("      (function log)", ...a);
// the generator and the live function read these at import / run time: a stray value from the caller's shell must not change what is tested
for (const k of ["SITE_URL", "BLOG_OFFLINE", "BLOG_OUT", "BLOG_FIXTURE", "BLOG_SRC", "BLOG_LIVE_CATALOG", "VERCEL"]) delete process.env[k];
const GEN = pathToFileURL(path.join(ROOT, "scripts/build-blog-pages.mjs")).href, LIVE = pathToFileURL(path.join(ROOT, "scripts/blog-live.mjs")).href, PATHS = pathToFileURL(path.join(ROOT, "scripts/blog-paths.mjs")).href;
const gen = await import(GEN), live = await import(LIVE), paths = await import(PATHS);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-liveonly-"));
const mtimes = () => ["sitemap.xml", "blog/sitemap-static.xml", "api/blog-live-catalog.json"].map(f => { try { return fs.statSync(path.join(ROOT, f)).mtimeMs; } catch { return 0; } }).join(",");
const repoBefore = mtimes();

/* ── rows ── */
let seq = 0;
const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const CATS = ["tips", "theory", "songs", "news", "story"];
const day = (n) => new Date(Date.UTC(2026, 8, 1) + n * 86400000).toISOString();   // 2026-09-01 plus n days
const bodyOf = (t, n = 6) => `## ${t}\n\n${"A paragraph of the article that is long enough to be a body. ".repeat(n)}\n\n- one\n- two\n\n**bold** and [a link](https://example.com/x)\n`;
const mk = (lang, slug, extra = {}) => ({ id: uid(), lang, slug, category: "tips", title: `${lang} ${slug}`, excerpt: `Excerpt of ${slug}`, body: bodyOf(slug), cover_url: null, cover_alt: null, author_id: null, published: true, created_at: day(30), updated_at: day(30), ...extra });

// STATIC: what a build has always written. The flag is false on some rows, null on one and ABSENT on the others (blog-src rows never have it).
const STATIC = [];
STATIC.push(mk("en", "piano-posture", { live_only: false, category: "tips", created_at: day(10), updated_at: day(10) }));
STATIC.push(mk("th", "piano-posture", { live_only: null, category: "tips", created_at: day(10), updated_at: day(10) }));
STATIC.push(mk("zh", "piano-posture", { category: "tips", created_at: day(10), updated_at: day(10) }));
for (let i = 0; i < 8; i++) STATIC.push(mk("en", `static-en-${i}`, { category: CATS[i % 5], created_at: day(11 + i), updated_at: day(11 + i), ...(i % 2 ? { live_only: false } : {}) }));
for (let i = 0; i < 3; i++) STATIC.push(mk("th", `static-th-${i}`, { category: CATS[i % 5], created_at: day(11 + i), updated_at: day(11 + i) }));
for (let i = 0; i < 3; i++) STATIC.push(mk("zh", `static-zh-${i}-zh`, { category: CATS[i % 5], created_at: day(11 + i), updated_at: day(11 + i) }));
for (let i = 0; i < 40; i++) STATIC.push(mk("ja", `static-ja-${i}-ja`, { category: CATS[i % 5], created_at: day(5 + (i % 20)), updated_at: day(5 + (i % 20)) }));
for (let i = 0; i < 2; i++) STATIC.push(mk("hi", `static-hi-${i}-hi`, { category: CATS[i % 5], created_at: day(5 + i), updated_at: day(5 + i) }));
STATIC.push(mk("en", "shared-slug-static", { category: "songs", created_at: day(25), updated_at: day(25), live_only: false }));
const CLONE = { category: "tips", title: "Clone article", excerpt: "The same article, once as a static row and once as a flagged one.", body: bodyOf("clone", 10), created_at: day(26), updated_at: day(26) };
STATIC.push(mk("en", "clone-static", { ...CLONE }));

// LIVE: the translated articles. The title carries a token and the slug starts with "lvo-", so a leak into any file is one search away. Newer than every static row, so a leak would sit on top of a list.
const TOKEN = "LIVEONLYTOKEN";
const LIVE_ROWS = [];
const lv = (lang, slug, extra = {}) => { const d = day(40 + (LIVE_ROWS.length % 20)); const r = mk(lang, slug, { live_only: true, title: `${TOKEN} ${lang} ${slug}`, created_at: d, updated_at: d, ...extra }); LIVE_ROWS.push(r); return r; };
for (let i = 0; i < 4; i++) lv("zh", `lvo-zh-${i}-zh`, { category: CATS[i % 5] });
for (let i = 0; i < 4; i++) lv("en", `lvo-en-${i}`, { category: CATS[i % 5] });
lv("th", "lvo-en-0");                // the queue gives en and th the same slug: a set of two
lv("th", "shared-slug-static");      // a live-only th row on the slug of a STATIC en row: the static page must not link to it
for (let i = 0; i < 20; i++) lv("ja", `lvo-ja-${i}-ja`, { category: CATS[i % 5] });
for (let i = 0; i < 3; i++) lv("ko", `lvo-ko-${i}-ko`);       // a source-file language with live-only rows ONLY: nothing may be written for it
for (let i = 0; i < 3; i++) lv("ar", `lvo-ar-${i}-ar`);
for (let i = 0; i < 2; i++) lv("hi", `lvo-hi-${i}-hi`);
const MIXED = STATIC.concat(LIVE_ROWS);

// blog-src: one ja and one ar article, committed files (no flag field at all)
const srcDir = path.join(tmp, "blog-src");
for (const [lang, slug] of [["ja", "src-ja"], ["ar", "src-ar"]]) {
  fs.mkdirSync(path.join(srcDir, lang), { recursive: true });
  fs.writeFileSync(path.join(srcDir, lang, slug + ".json"), JSON.stringify({ lang, slug, category: "tips", title: `${lang} source article`, excerpt: "From a committed file.", body: bodyOf(slug), created_at: "2026-09-02T00:00:00Z", published: true }));
}
const fx = (name, rows) => { const f = path.join(tmp, name + ".json"); fs.writeFileSync(f, JSON.stringify(rows)); return f; };

/* ── helpers ── */
function listFiles(dir) { const out = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(path.relative(dir, p).split(path.sep).join("/")); } }; if (fs.existsSync(dir)) walk(dir); return out.sort(); }
function diffTrees(a, b) {
  const fa = listFiles(a), fb = listFiles(b), sa = new Set(fa), sb = new Set(fb), d = [];
  for (const f of fa) if (!sb.has(f)) d.push("only in the first: " + f);
  for (const f of fb) if (!sa.has(f)) d.push("only in the second: " + f);
  for (const f of fa) if (sb.has(f) && !fs.readFileSync(path.join(a, f)).equals(fs.readFileSync(path.join(b, f)))) d.push("differs: " + f);
  return d;
}
const MOVE = ` (if the page output was changed on purpose after ${BASELINE_REF}, move BLOG_BASELINE_REF to the commit before that change)`;
const gitShow = (rel) => { try { return execFileSync("git", ["show", `${BASELINE_REF}:${rel}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const writeRoot = (root, files) => { for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); } };
const runGen = (script, env) => execFileSync(process.execPath, [script], { env: { ...process.env, SITE_URL: SITE, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
const CUR = { "scripts/build-blog-pages.mjs": read("scripts/build-blog-pages.mjs"), "scripts/blog-paths.mjs": read("scripts/blog-paths.mjs"), "scripts/blog-live.mjs": read("scripts/blog-live.mjs"), "supabase-client.ts": read("supabase-client.ts") };
const BASE = Object.fromEntries(Object.keys(CUR).map(k => [k, gitShow(k)]));
const haveBase = Object.values(BASE).every(v => typeof v === "string" && v.length > 0);
const baseRoot = path.join(tmp, "base-root"), curRoot = path.join(tmp, "cur-root");
writeRoot(curRoot, CUR);
if (haveBase) writeRoot(baseRoot, BASE);
const CUR_SCRIPT = path.join(ROOT, "scripts/build-blog-pages.mjs"), BASE_SCRIPT = path.join(baseRoot, "scripts/build-blog-pages.mjs");
const outRun = (script, rows, name) => { const out = path.join(tmp, "out-" + name); const log = runGen(script, { BLOG_FIXTURE: fx("fx-" + name, rows), BLOG_OUT: out, BLOG_SRC: srcDir }); return { out, log }; };

/* ── 1. the generator ── */
heading("generator: a row with live_only = true gets no file and changes nothing else");
const A = outRun(CUR_SCRIPT, MIXED, "mixed"), B = outRun(CUR_SCRIPT, STATIC, "static");
ok(A.log.includes(`build-blog-pages: ${LIVE_ROWS.length} live-only rows served from the database (no static file)`), `the log says "${LIVE_ROWS.length} live-only rows served from the database (no static file)"`);
ok(!B.log.includes("live-only"), "with no flagged row the log has no live-only line (a missing or false flag changes nothing)");
const dAB = diffTrees(A.out, B.out);
ok(dAB.length === 0, `the output tree with ${LIVE_ROWS.length} live-only rows added is the output tree without them, file for file and byte for byte (${listFiles(A.out).length} files)` + (dAB.length ? ": " + dAB.slice(0, 5).join("; ") : ""));
const filesA = listFiles(A.out);
const noFile = LIVE_ROWS.filter(r => fs.existsSync(path.join(A.out, r.lang, r.slug + ".html")));
ok(noFile.length === 0, `none of the ${LIVE_ROWS.length} live-only rows has an article file` + (noFile.length ? ": " + noFile.slice(0, 3).map(r => r.lang + "/" + r.slug).join(", ") : ""));
const leaks = filesA.filter(f => { const t = fs.readFileSync(path.join(A.out, f), "utf8"); return t.includes(TOKEN) || t.includes("lvo-"); });
ok(leaks.length === 0, "no generated file (page, index, feed, sitemap-static.xml, hreflang, related box) mentions a live-only title or slug" + (leaks.length ? ": " + leaks.slice(0, 3).join(", ") : ""));
ok(["en/piano-posture.html", "th/piano-posture.html", "zh/piano-posture.html", "en/static-en-0.html", "en/static-en-1.html", "ja/static-ja-0-ja.html", "ja/src-ja.html", "ar/src-ar.html"].every(f => filesA.includes(f)), "a row whose flag is false, null or absent (and a blog-src file) is a static page, as before");
const sharedStatic = fs.readFileSync(path.join(A.out, "en/shared-slug-static.html"), "utf8");
ok(!sharedStatic.includes('hreflang="th"') && sharedStatic.includes('hreflang="en"') && sharedStatic.includes('hreflang="x-default"'), "the static en page does not list the live-only th row of the same slug as an hreflang alternate (bySlug)");
ok(!fs.existsSync(path.join(A.out, "ko")), "a source-file language with live-only rows only (ko) gets no folder, no index, no feed");
ok(filesA.includes("ja/index.html") && filesA.includes("ja/feed.xml") && !filesA.includes("ja/page/2/index.html"), "the ja index is built from the static rows (41 of them: one page), the 20 live-only ones do not make a page 2");
ok(!fs.readFileSync(path.join(A.out, "ja/feed.xml"), "utf8").includes("lvo-") && !fs.readFileSync(path.join(A.out, "sitemap-static.xml"), "utf8").includes("lvo-"), "the ja feed and blog/sitemap-static.xml do not list a live-only row");
const relBox = (html) => (/<nav class="rel"[\s\S]*?<\/nav>/.exec(html) || [""])[0];
ok(relBox(fs.readFileSync(path.join(A.out, "en/static-en-0.html"), "utf8")).includes("/blog/en/static-en-") && !relBox(fs.readFileSync(path.join(A.out, "en/static-en-0.html"), "utf8")).includes("lvo-"), "the related box of a static page is filled from static rows only");

heading("generator: the pieces, on their own");
ok(gen.isLiveOnly({ live_only: true }) === true && [{ live_only: false }, { live_only: null }, {}, { live_only: "true" }, { live_only: 1 }, null, undefined].every(p => gen.isLiveOnly(p) === false), "isLiveOnly is true for a real true only: false, null, missing, \"true\", 1 and no row are all static");
const cat = gen.liveCatalogRows([{ lang: "ja", slug: "a", title: "A" }, { lang: "ja", slug: "b", title: "B", live_only: true }, { lang: "ja", slug: "c", title: "C", live_only: false }, { lang: "en", slug: "d" }]);
ok(cat.map(c => c.slug).join() === "a,c", "liveCatalogRows lists no live-only row (and still only the source-file languages)");
const mergedRows = gen.mergeStatic([{ lang: "ja", slug: "s", live_only: true, id: "db" }], [{ lang: "ja", slug: "s", id: "file" }, { lang: "ja", slug: "t", id: "file2" }]);
ok(mergedRows.length === 2 && mergedRows[0].id === "db" && mergedRows[1].id === "file2", "mergeStatic is unchanged: a database row, flagged or not, still wins over a blog-src file of the same (lang, slug)");

heading("generator: sitemap.xml, the sitemap index entry and the live catalog (in a throw-away copy of the repo root)");
const FLAT = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n<url><loc>${SITE}/</loc></url>\n<url><loc>${SITE}/blog/th/old-entry.html</loc></url>\n</urlset>\n`;
const INDEX = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap><loc>${SITE}/sitemap-pages.xml</loc><lastmod>2026-11-10</lastmod></sitemap>\n${paths.blogSitemapIndexEntries(SITE, "2026-11-10").join("\n")}\n</sitemapindex>\n`;
function sandboxRun(files, kind, rows, name) {
  const root = path.join(tmp, "sbx-" + name);
  writeRoot(root, { ...files, "sitemap.xml": kind === "flat" ? FLAT : INDEX });
  const log = runGen(path.join(root, "scripts/build-blog-pages.mjs"), { BLOG_FIXTURE: fx("fx-" + name, rows), BLOG_SRC: srcDir });
  return { root, log };
}
for (const kind of ["flat", "index"]) {
  const m = sandboxRun(CUR, kind, MIXED, `${kind}-mixed`), s = sandboxRun(CUR, kind, STATIC, `${kind}-static`);
  const sm = fs.readFileSync(path.join(m.root, "sitemap.xml"), "utf8");
  ok(diffTrees(path.join(m.root, "blog"), path.join(s.root, "blog")).length === 0, `${kind} sitemap.xml: the blog/ folder is the same with and without the live-only rows`);
  ok(sm === fs.readFileSync(path.join(s.root, "sitemap.xml"), "utf8") && !sm.includes("lvo-") && (kind === "flat" ? sm.includes("/blog/en/piano-posture.html") && !sm.includes("old-entry") : sm.includes("blog/sitemap-static.xml")), `${kind} sitemap.xml: ${kind === "flat" ? "the appended blog urls" : "the sitemap-static.xml entry"} name no live-only row and are the same as without them`);
  const catM = fs.readFileSync(path.join(m.root, "api/blog-live-catalog.json"), "utf8");
  ok(catM === fs.readFileSync(path.join(s.root, "api/blog-live-catalog.json"), "utf8") && !catM.includes("lvo-") && JSON.parse(catM).some(c => c.slug === "src-ja") && JSON.parse(catM).some(c => c.slug === "src-ar"), `${kind}: api/blog-live-catalog.json has the two blog-src articles and no live-only row`);
  if (haveBase) {
    const b = sandboxRun(BASE, kind, STATIC, `${kind}-base`);
    const sameAsBase = diffTrees(path.join(s.root, "blog"), path.join(b.root, "blog")).length === 0 && fs.readFileSync(path.join(s.root, "sitemap.xml"), "utf8") === fs.readFileSync(path.join(b.root, "sitemap.xml"), "utf8") && fs.readFileSync(path.join(s.root, "api/blog-live-catalog.json"), "utf8") === fs.readFileSync(path.join(b.root, "api/blog-live-catalog.json"), "utf8");
    ok(sameAsBase, `${kind}: blog/, sitemap.xml and the catalog for the static rows are byte-identical to the generator at ${BASELINE_REF}` + (sameAsBase ? "" : MOVE));
  }
}
{
  // a database row that shadows a blog-src file: it wins (as it always did) and, being live-only, leaves no file; the catalog does not list the file either
  const shadowRows = [mk("en", "only-static", { created_at: day(3), updated_at: day(3) }), mk("ja", "src-ja", { live_only: true, title: `${TOKEN} shadow`, created_at: day(40), updated_at: day(40) })];
  const sh = sandboxRun(CUR, "index", shadowRows, "shadow");
  const catS = JSON.parse(fs.readFileSync(path.join(sh.root, "api/blog-live-catalog.json"), "utf8"));
  ok(!fs.existsSync(path.join(sh.root, "blog/ja")) && fs.existsSync(path.join(sh.root, "blog/ar/src-ar.html")) && fs.existsSync(path.join(sh.root, "blog/en/only-static.html")), "a live-only row shadowing a blog-src file: no ja page is written, the other pages are");
  ok(!catS.some(c => c.slug === "src-ja") && catS.some(c => c.slug === "src-ar") && !fs.readFileSync(path.join(sh.root, "blog/sitemap-static.xml"), "utf8").includes("src-ja"), "...and the catalog and blog/sitemap-static.xml do not list the shadowed file");
}

heading("baseline: the generator before this change");
if (!haveBase) {
  if (process.env.BLOG_BASELINE_REQUIRED) ok(false, `the baseline commit ${BASELINE_REF} is not in this checkout (BLOG_BASELINE_REQUIRED is set)`); else skip(`commit ${BASELINE_REF} is not in this checkout (shallow clone?): the byte comparison with the old generator was not run`);
} else {
  ok(BASE["scripts/build-blog-pages.mjs"] !== CUR["scripts/build-blog-pages.mjs"], `the baseline generator (${BASELINE_REF}) is a different file from the current one`);
  const C = outRun(BASE_SCRIPT, STATIC, "base-static"), D = outRun(BASE_SCRIPT, MIXED, "base-mixed");
  const dCB = diffTrees(C.out, B.out);
  ok(dCB.length === 0, `the static rows: the files of the old generator and of the new one are byte-identical (${listFiles(C.out).length} files)` + (dCB.length ? ": " + dCB.slice(0, 5).join("; ") + MOVE : ""));
  ok(diffTrees(C.out, A.out).length === 0, "...also when the live-only rows are in the input of the new generator");
  const filesD = listFiles(D.out);
  ok(LIVE_ROWS.every(r => filesD.includes(`${r.lang}/${r.slug}.html`)) && filesD.length > filesA.length && filesD.includes("ja/page/2/index.html"), `control: the old generator writes a file for every live-only row (${filesD.length} files instead of ${filesA.length}) and a ja page 2: this fixture does see the problem`);
}

/* ── 2. the live function ── */
// A fake PostgREST: honours published / live_only / lang / slug / category (eq, neq, in.(...) and, for live_only, is.true / not.is.true) / order / limit / offset / select, answers Content-Range like the real one ("0-999/15234" only
// when the call sent Prefer: count=exact, "0-999/*" otherwise), 206 for a partial range, and records every request. { headers: false } is the plain double of the older smokes (no headers at all).
// Options: delayMs (every request takes that long), failAt (the offset that answers 500), maxRows (the server's own cap on a page), rejectColumn (answers 400 when the request names that column: a database without it),
// lieTotal (the announced total is that much larger than the rows there are), honourPublished / honourLiveOnly = false (a careless double that ignores the filter), measure (the bytes of every answer in entry.bytes).
function makeApi(rows, o = {}) {
  const sorted = rows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const log = []; let inflight = 0, maxInflight = 0;
  const cond = (v) => {
    if (v == null) return null;
    let m;
    if ((m = /^neq\.(.*)$/.exec(v))) return (x) => String(x) !== m[1];
    if ((m = /^eq\.(.*)$/.exec(v))) return (x) => String(x) === m[1];
    if ((m = /^in\.\((.*)\)$/.exec(v))) { const set = new Set(m[1].split(",")); return (x) => set.has(String(x)); }
    if (v === "is.true") return (x) => x === true;
    if (v === "not.is.true") return (x) => x !== true;
    throw new Error("fake PostgREST: no filter for " + v);
  };
  const fetchImpl = async (url, init) => {
    const u = new URL(url), q = u.searchParams, prefer = init && init.headers && init.headers.Prefer || null;
    const entry = { url: String(url), q: Object.fromEntries(q), prefer, auth: !!(init && init.headers && init.headers.apikey) };
    log.push(entry); inflight++; maxInflight = Math.max(maxInflight, inflight);
    try {
      if (o.delayMs) await new Promise(r => setTimeout(r, o.delayMs));
      if (o.rejectColumn && (q.has(o.rejectColumn) || String(q.get("select") || "").split(",").includes(o.rejectColumn))) { entry.rows = 0; return { ok: false, status: 400, json: async () => ({ code: "42703", message: `column blog_posts.${o.rejectColumn} does not exist` }) }; }
      if (o.failAt != null && Number(q.get("offset") || 0) === o.failAt) return { ok: false, status: 500, json: async () => ({}) };
      let list = sorted;
      if (o.honourPublished !== false && q.get("published") === "eq.true") list = list.filter(r => r.published === true);
      if (o.honourLiveOnly !== false) { const t = cond(q.get("live_only")); if (t) list = list.filter(r => t(r.live_only)); }
      for (const col of ["lang", "slug", "category"]) { const t = cond(q.get(col)); if (t) list = list.filter(r => t(r[col])); }
      const total = list.length, off = Number(q.get("offset") || 0), lim = Math.min(q.get("limit") ? Number(q.get("limit")) : total, o.maxRows || Infinity);
      const sel = q.get("select"), cols = sel && sel !== "*" ? sel.split(",") : null;
      const data = list.slice(off, off + lim).map(r => cols ? Object.fromEntries(cols.map(c => [c, r[c]])) : { ...r });
      entry.rows = data.length;
      if (o.measure) entry.bytes = JSON.stringify(data).length;
      const cr = `${data.length ? `${off}-${off + data.length - 1}` : "*"}/${prefer === "count=exact" ? total + (o.lieTotal || 0) : "*"}`;
      const res = { ok: true, status: data.length < total ? 206 : 200, json: async () => data };
      if (o.headers !== false) res.headers = { get: (n) => (String(n).toLowerCase() === "content-range" ? (o.noRange ? null : cr) : null) };
      return res;
    } finally { inflight--; }
  };
  return { fetchImpl, log, maxInflight: () => maxInflight };
}
const OPTS = { catalog: [] };
// a database that never answers but honours the abort (the real fetch does). AbortSignal.timeout() runs on an UNREF'd timer, so the test keeps the event loop alive itself, as the open socket of a real request does.
const hang = (u, i) => new Promise((res, rej) => { const keep = setTimeout(() => {}, 20000); if (i && i.signal) i.signal.addEventListener("abort", () => { clearTimeout(keep); rej(i.signal.reason); }); });
// runs fn and waits at most `limit` ms for it to settle: { state: "resolved" | "rejected" | "pending", value, error, ms }. The machine this runs on is often loaded, so the limits are generous: what is tested is that a deadline
// SETTLES the call at all (a hung call would never), not how fast.
const settle = async (fn, limit = 8000) => { const t0 = Date.now(); let timer; const gate = new Promise(res => { timer = setTimeout(() => res({ state: "pending" }), limit); }); const run = Promise.resolve().then(fn).then(value => ({ state: "resolved", value }), error => ({ state: "rejected", error })); const r = await Promise.race([run, gate]); clearTimeout(timer); return { ...r, ms: Date.now() - t0 }; };
const parseXml = (xml) => new (new JSDOM("").window.DOMParser)().parseFromString(xml, "application/xml");
const relSlugs = (html) => [...relBox(html).matchAll(/href="[^"]*\/blog\/[a-z]+\/([^"]+)\.html"/g)].map(m => decodeURIComponent(m[1]));

const DB = [];
const add = (lang, slug, extra) => { const r = mk(lang, slug, extra); DB.push(r); return r; };
for (let i = 0; i < 45; i++) add("en", `en-${i}`, { category: ["tips", "theory", "songs"][i % 3], live_only: i % 4 === 0, created_at: day(i), updated_at: day(i), title: `EN Title ${i}` });
add("en", "news-a", { category: "news", created_at: day(60), updated_at: day(60), title: "News A" });
add("en", "news-b", { category: "news", created_at: day(61), updated_at: day(61), title: "News B" });
add("en", "news-live", { category: "news", live_only: true, created_at: day(62), updated_at: day(62), title: "News flagged article" });
add("en", "clone-live", { ...CLONE, live_only: true });
add("en", "story-lone", { category: "story", created_at: day(80), updated_at: day(80), title: "Story lone" });
add("en", "hidden-staged", { published: false, live_only: true, created_at: day(70), title: "HIDDEN staged" });
add("en", "hidden-plain", { published: false, created_at: day(71), title: "HIDDEN plain" });
add("en", "pair-slug", { created_at: day(5), title: "Pair en" });
add("th", "pair-slug", { published: false, created_at: day(5), title: "HIDDEN pair th" });
for (let i = 0; i < 5; i++) add("ja", `ja-${i}-ja`, { live_only: true, created_at: day(i), title: `JA Title ${i}` });
const publishedEn = DB.filter(r => r.lang === "en" && r.published);

heading("live function: a live-only article is a normal article page");
{
  const api = makeApi(DB);
  const out = await live.serveBlog({ lang: "en", rest: "clone-live.html" }, api.fetchImpl, OPTS);
  ok(out.status === 200 && out.headers["content-type"].startsWith("text/html") && out.headers["content-language"] === "en" && out.headers["cache-control"] === "public, max-age=120, s-maxage=120" && out.headers["x-blog-source"] === "live", "GET /blog/en/clone-live.html (live_only = true) is 200, text/html, content-language en, cached 120 s");
  const staticPage = fs.readFileSync(path.join(A.out, "en/clone-static.html"), "utf8");
  const norm = (h) => h.split("clone-static").join("clone-live").replace(/<nav class="rel"[\s\S]*?<\/nav>/, "");
  ok(norm(staticPage) === norm(out.body), "its HTML is the HTML the generator writes for the same article as a static row (slug aside, related box aside)");
  ok(out.body.includes("<h1>Clone article</h1>") && out.body.includes('rel="canonical" href="' + SITE + '/blog/en/clone-live.html"') && out.body.includes('"@type":"BlogPosting"') && /<!--tg-gate:v\d+-->/.test(out.body) && out.body.includes('id="tg-gate"'), "h1, canonical to the .html address, BlogPosting JSON-LD and the reading wall are there");
  const leak = /.{0,60}(live_only|live-only).{0,60}/.exec(out.body);
  ok(!leak, "the flag does not leak into the page" + (leak ? ": " + leak[0] : ""));
  const plain = await live.serveBlog({ lang: "en", rest: "clone-live.html" }, makeApi(DB.map(r => ({ ...r, live_only: false }))).fetchImpl, OPTS);
  ok(plain.status === 200 && plain.body === out.body, "the same row with live_only = false gives the very same page: the flag changes nothing in the rendering");
  for (const rest of ["clone-live", "clone-live/", "clone-live.html/"]) ok((await live.serveBlog({ lang: "en", rest }, makeApi(DB).fetchImpl, OPTS)).status === 200, `/blog/en/${rest} is served too`);
  ok((await live.serveBlog({ slug: "clone-live" }, makeApi(DB).fetchImpl, OPTS)).status === 200, "/blog/clone-live (no language) is served");
}

heading("live function: the related box is one or two small queries, never the whole language");
{
  const api = makeApi(DB);
  const post = DB.find(r => r.slug === "en-10");   // theory: 14 other theory rows
  const out = await live.serveBlog({ lang: "en", rest: "en-10.html" }, api.fetchImpl, OPTS);
  const q = api.log.map(e => e.q);
  ok(out.status === 200 && api.log.length === 2, `an article with plenty of same-category rows: 2 requests in all, the article and one related query (${api.log.length})`);
  const selApi = makeApi(DB); await live.fetchLangRows("en", selApi.fetchImpl);
  const sel = selApi.log[0].q.select;
  ok(q[0].slug === "eq.en-10" && q[0].select === "*" && q[0].published === "eq.true", "request 1 is the article itself (select=*, slug=eq., published=eq.true)");
  ok(q[1].published === "eq.true" && q[1].lang === "eq.en" && q[1].category === "eq.theory" && q[1].slug === "neq.en-10" && q[1].order === "created_at.desc,id.asc" && q[1].limit === "8" && q[1].offset === undefined && q[1].select === sel, "request 2 is published, same language, same category, not this slug, newest first, limit 8, and the columns fetchLangRows selects");
  ok(api.log.every(e => e.q.limit !== "500" && e.q.offset === undefined) && api.log.slice(1).every(e => e.rows <= 8), "no request pages the language (no limit=500, no offset) and no answer is larger than 8 rows");
  const oldRows = live.rowsForLang("en", publishedEn, []);
  const expected = gen.relatedPosts(oldRows, post).map(p => p.slug);
  ok(expected.length === 5 && relSlugs(out.body).join() === expected.join(), `the related box is exactly what the whole-language read gave: ${expected.join(", ")}`);

  const api2 = makeApi(DB);
  const post2 = DB.find(r => r.slug === "news-live");   // news: 2 others, the second query fills the rest
  const out2 = await live.serveBlog({ lang: "en", rest: "news-live.html" }, api2.fetchImpl, OPTS);
  const q2 = api2.log.map(e => e.q);
  ok(out2.status === 200 && api2.log.length === 3 && q2[1].category === "eq.news" && q2[2].category === "neq.news" && q2[2].slug === "neq.news-live" && q2[2].limit === "8" && q2[2].lang === "eq.en" && q2[2].published === "eq.true", "with fewer than 6 same-category rows a second small query asks for the other categories (3 requests in all)");
  const expected2 = gen.relatedPosts(oldRows, post2).map(p => p.slug);
  ok(expected2.length === 5 && expected2.slice(0, 2).sort().join() === "news-a,news-b" && relSlugs(out2.body).join() === expected2.join(), `...and the box is again what the whole-language read gave, same category first: ${expected2.join(", ")}`);
  ok(!relSlugs(out.body).concat(relSlugs(out2.body)).some(s => s === "hidden-staged" || s === "hidden-plain"), "no unpublished row is in a related box");

  // fetchRelated on its own
  const a3 = makeApi(DB);
  const r3 = await live.fetchRelated("en", "theory", "en-10", a3.fetchImpl);
  ok(a3.log.length === 1 && r3.length === 8 && r3.every(r => r.category === "theory" && r.slug !== "en-10"), "fetchRelated: 8 or more same-category rows end it after one query");
  const a4 = makeApi(DB);
  const r4 = await live.fetchRelated("en", "", "en-10", a4.fetchImpl);
  ok(a4.log.length === 1 && a4.log[0].q.category === undefined && r4.length === 8, "fetchRelated: a post with no category gets one query with no category filter");
  const a5 = makeApi(DB);
  await live.fetchRelated("en", "a b&c", "x", a5.fetchImpl);
  ok(a5.log[0].url.includes("category=eq.a%20b%26c") && a5.log[0].url.includes("slug=neq.x"), "fetchRelated: category and slug are percent-encoded in the filters");
  let threw = false; try { await live.fetchRelated("en", "theory", "en-10", async () => ({ ok: false, status: 500, json: async () => ({}) })); } catch (e) { threw = /blog list 500/.test(e.message); }
  ok(threw, "fetchRelated: a failing first query throws (serveBlog then falls back to the catalog)");
  let calls = 0;
  const half = await live.fetchRelated("en", "news", "news-live", async (u, i) => { calls++; if (calls === 2) throw new Error("boom"); return makeApi(DB).fetchImpl(u, i); });
  ok(half.length === 2 && half.every(r => r.category === "news"), "fetchRelated: a failing second query keeps the first answer");
  const down = await live.serveBlog({ lang: "en", rest: "en-10.html" }, (() => { let n = 0; const a = makeApi(DB); return (u, i) => (++n === 1 ? a.fetchImpl(u, i) : Promise.reject(new Error("offline"))); })(), OPTS);
  ok(down.status === 200 && down.body.includes("<h1>EN Title 10</h1>") && !down.body.includes('class="rel"'), "when the related query fails the article is still served, without the box");

  // the box has a short deadline of its own: a database that is slow costs the page a few seconds at most, and the page is served without the box (minor item of the integrator's direction)
  ok(live.RELATED_TIMEOUT_MS === 3000 && live.LIST_TIMEOUT_MS === 8000 && live.RELATED_TIMEOUT_MS < live.LIST_TIMEOUT_MS, "the deadlines: 8 s for a page of a list, 3 s for the whole related box");
  const seen = [];
  await live.fetchRelated("en", "news", "news-live", (u, i) => { seen.push(i && i.signal); return makeApi(DB).fetchImpl(u, i); });
  ok(seen.length === 2 && seen.every(sg => sg instanceof AbortSignal && !sg.aborted) && seen[0] === seen[1], "both related queries carry ONE abort signal (one deadline for the box, not one each)");
  const gaveUp = await settle(() => live.fetchRelated("en", "theory", "en-10", hang, { timeoutMs: 60 }));
  ok(gaveUp.state === "rejected", `a related query that never answers is given up at its deadline and throws (settled after ${gaveUp.ms} ms with a 60 ms deadline; 3,000 ms in production)`);
  const seq = makeApi(DB); let n = 0;
  const slowRelated = (u, i) => (++n === 1 ? seq.fetchImpl(u, i) : hang(u, i));   // the article answers, the related query hangs
  const slow = await settle(() => live.serveBlog({ lang: "en", rest: "en-10.html" }, slowRelated, { catalog: [], relatedTimeoutMs: 60 }));
  ok(slow.state === "resolved" && slow.value.status === 200 && slow.value.body.includes("<h1>EN Title 10</h1>") && !slow.value.body.includes('class="rel"'), `a hung related query does not hold the page: the article is served without the box (${slow.ms} ms)`);
}

heading("live function: lists are paged with Prefer: count=exact, eight at a time, in pages of 1,000");
// n rows spread over the ten languages, one a minute apart; from index `startLive` on they are flagged live_only (default: none are)
const bigRows = (n, startLive = n) => { const rows = []; for (let i = 0; i < n; i++) { const lang = paths.BLOG_LANGS[i % 10]; const d = new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(); rows.push({ id: uid(), lang, slug: `x${i}-${lang}`, title: `T${i}`, excerpt: "e", category: CATS[i % 5], published: true, live_only: i >= startLive, created_at: d, updated_at: d }); } return rows; };
// every published row of the table, the five sitemap columns: what the single sitemap-blog.xml used to read (the control of the sitemap tests below, and the way to exercise fetchAllPages on its own)
const metaPage = (off, limit) => `${live.BLOG_API_URL}/rest/v1/blog_posts?select=slug,lang,published,created_at,updated_at&published=eq.true&order=created_at.desc,id.asc&limit=${limit}&offset=${off}`;
const readAllMeta = (fetchImpl, opts) => live.fetchAllPages(metaPage, fetchImpl, opts);
{
  const rows = bigRows(20000);
  const api = makeApi(rows, { delayMs: 4 });
  const t0 = Date.now();
  const all = await readAllMeta(api.fetchImpl);
  const ms = Date.now() - t0;
  const offs = api.log.map(e => Number(e.q.offset)).sort((a, b) => a - b);
  ok(all.length === 20000 && api.log.length === 20 && offs.every((o, i) => o === i * 1000), `20,000 rows are read in 20 requests, one per page of 1,000, each offset once (${api.log.length} requests, ${ms} ms)`);
  ok(api.maxInflight() === 8, `the pages are fetched together, eight at a time (${api.maxInflight()} in flight at the peak: the first request alone, then the 19 others eight at a time)`);
  ok(api.log[0].prefer === "count=exact" && api.log[0].q.offset === "0" && api.log.every(e => e.q.limit === "1000") && api.log.slice(1).every(e => e.prefer === null) && api.log.every(e => e.auth), "only the first request asks for the total (Prefer: count=exact); every request asks for 1,000 rows and carries the API key");
  // the fallback: a double with no headers at all (the older smokes) is read the old way, page after page, to the same result
  const plain = makeApi(rows, { headers: false });
  const allPlain = await readAllMeta(plain.fetchImpl);
  ok(allPlain.length === 20000 && allPlain.every((r, i) => r.slug === all[i].slug) && plain.log.length === 21 && plain.maxInflight() === 1, `with no Content-Range total the pages are read one after the other (21 requests, the last one empty), to the same rows in the same order (${plain.log.length} requests, at most ${plain.maxInflight()} in flight)`);
  const noTotal = makeApi(rows, { noRange: true });
  const allNoTotal = await readAllMeta(noTotal.fetchImpl);
  ok(allNoTotal.length === 20000 && noTotal.maxInflight() === 1, "headers without a Content-Range (or with 0-999/*) take the same sequential road");
  // a server that answers fewer rows than asked (its own max-rows) must be followed page by page: stepping by the asked 1,000 would skip half of every page
  const capped = makeApi(rows, { maxRows: 500 });
  const allCapped = await readAllMeta(capped.fetchImpl);
  ok(allCapped.length === 20000 && new Set(allCapped.map(r => r.slug)).size === 20000 && allCapped.every((r, i) => r.slug === all[i].slug) && capped.log.length === 40, `a server that caps a page at 500 rows is followed by what it really sent: every row once, in order (${capped.log.length} requests, not 20 holes)`);
}
{
  const rows = bigRows(60000);
  const par = makeApi(rows), seq1 = makeApi(rows, { headers: false });
  const a = await readAllMeta(par.fetchImpl), b = await readAllMeta(seq1.fetchImpl);
  ok(a.length === 60000 && b.length === 60000 && par.log.length === 60 && seq1.log.length === 61, `60,000 rows still fit the guard, in parallel (${par.log.length} requests) and sequentially (${seq1.log.length})`);
  ok(a.every((r, i) => r.slug === b[i].slug) && new Set(a.map(r => r.lang + "/" + r.slug)).size === 60000, "...with every row once, in the same order both ways");
  const lang = await live.fetchLangRows("en", makeApi(rows).fetchImpl);
  ok(lang.length === 6000 && lang.every(r => r.lang === "en" && "title" in r && "excerpt" in r && "category" in r), "fetchLangRows pages one language the same way (6,000 en rows; title, excerpt and category selected)");
  // the page guard says so when it is hit (a list that is cut short without a word is how the build lost pages)
  const warned = []; const warn = console.warn; console.warn = (...x) => warned.push(x.join(" "));
  let cut, cutSeq; try { cut = await readAllMeta(makeApi(rows).fetchImpl, { maxPages: 5 }); cutSeq = await readAllMeta(makeApi(rows, { headers: false }).fetchImpl, { maxPages: 5 }); } finally { console.warn = warn; }
  ok(cut.length === 5000 && cutSeq.length === 5000 && warned.length === 2 && warned.every(w => /page guard/.test(w)), "a list that does not fit the page guard is cut at it AND says so in the log (both roads): the guard is 200 pages of 1,000, 200,000 rows");
}
{
  const rows = bigRows(20000);
  const api = makeApi(rows, { delayMs: 3, failAt: 3000 });
  let rejected = null; try { await readAllMeta(api.fetchImpl); } catch (e) { rejected = e; }
  ok(rejected && /blog list 500/.test(rejected.message) && api.log.length < 20, `a failing page rejects the read and stops new requests (${api.log.length} sent of 20)`);
  const sm = await live.serveBlogSitemap(makeApi(rows, { failAt: 1000 }).fetchImpl, OPTS, "en");
  ok(sm.status === 503 && sm.body === "", "a failing page of a language's sitemap file is a 503 with no body, never half a file");
  const idx = await live.serveBlog({ lang: "ja" }, makeApi(rows, { failAt: 1000 }).fetchImpl, OPTS);
  ok(idx.status === 503, "a failing page of a language list is a 503 as before");
}

heading("live function: every request has a deadline, and an empty first page is a failure (the minor items of the integrator's direction)");
{
  const rows = bigRows(3000);
  const api = makeApi(rows), sigs = [];
  await readAllMeta((u, i) => { sigs.push(i && i.signal); return api.fetchImpl(u, i); });
  ok(sigs.length === 3 && sigs.every(sg => sg instanceof AbortSignal && !sg.aborted) && new Set(sigs).size === 3, "every request of a list (the first and the parallel ones) carries its own abort signal (AbortSignal.timeout(8000))");
  const slugSigs = []; await live.fetchSlug("en-1", (u, i) => { slugSigs.push(i && i.signal); return makeApi(DB).fetchImpl(u, i); });
  ok(slugSigs.length === 1 && slugSigs[0] instanceof AbortSignal, "the article query has one too");
  const first = await settle(() => live.fetchAllPages(metaPage, hang, { timeoutMs: 60 }));
  ok(first.state === "rejected", `a first page that never answers is given up at its deadline (settled after ${first.ms} ms with a 60 ms deadline; 8,000 ms in production)`);
  let n = 0; const api2 = makeApi(rows);
  const later = await settle(() => live.fetchAllPages(metaPage, (u, i) => (++n === 1 ? api2.fetchImpl(u, i) : hang(u, i)), { timeoutMs: 60 }));
  ok(later.state === "rejected", `a later page that never answers rejects the whole read at its deadline (${later.ms} ms): no half list`);
  const gone = await settle(() => live.serveBlogSitemap(hang, { catalog: [], listTimeoutMs: 60 }, "en"));
  ok(gone.state === "resolved" && gone.value.status === 503 && gone.value.body === "", `a database that hangs gives the sitemap file a 503 at the deadline, not a function held until maxDuration (${gone.ms} ms)`);
  // an EMPTY first page for which PostgREST announced rows
  const announced = (total, body) => async () => ({ ok: true, status: body.length ? 206 : 200, json: async () => body, headers: { get: (h) => (String(h).toLowerCase() === "content-range" ? (body.length ? `0-${body.length - 1}/${total}` : `*/${total}`) : null) } });
  let empty = null; try { await readAllMeta(announced(1234, [])); } catch (e) { empty = e; }
  ok(empty && /blog list empty/.test(empty.message) && /1234/.test(empty.message), "an empty first page with 1,234 rows announced throws (blog list empty), whatever reads it");
  const logged = [], w0 = console.warn; console.warn = (...a) => logged.push(a.join(" "));
  let e503; try { e503 = await live.serveBlogSitemap(announced(1234, []), OPTS, "en"); } finally { console.warn = w0; }
  ok(e503.status === 503 && e503.body === "", "...so a sitemap file is a 503 with no body, not an empty urlset that tells a crawler every article is gone");
  ok(logged.length === 1 && /blog-sitemap en/.test(logged[0]) && /blog list empty/.test(logged[0]) && /503/.test(logged[0]), "...and the function log says which file failed and why (the only place a crawler's 503 with no body can be explained)");
  const l503 = await live.serveBlog({ lang: "en" }, announced(1234, []), OPTS), f503 = await live.serveBlog({ lang: "en", rest: "feed.xml" }, announced(1234, []), OPTS);
  ok(l503.status === 503 && f503.status === 503, "...and the list and the feed of a language are a 503 (not an empty 200 list)");
  const fromCatalog = await live.serveBlog({ lang: "ja" }, announced(1234, []), { catalog: [{ lang: "ja", slug: "static-only", title: "S", excerpt: "e", category: "tips", published: true, created_at: day(1) }] });
  ok(fromCatalog.status === 200 && fromCatalog.body.includes("/blog/ja/static-only.html"), "...a source-file language still lists its committed articles from the catalog (a failed read is not an empty one)");
  const honest = await live.serveBlogSitemap(announced(0, []), OPTS, "fr");
  ok(honest.status === 200 && parseXml(honest.body).getElementsByTagName("parsererror").length === 0 && parseXml(honest.body).documentElement.nodeName === "urlset" && !honest.body.includes("<url>"), "a table that honestly has no row for the language (total 0) is a valid, empty urlset (200), not an error");
  ok((await readAllMeta(async () => ({ ok: true, status: 200, json: async () => [] }))).length === 0, "an empty answer with no Content-Range at all (a test double) is an empty list, as before: only an ANNOUNCED total makes it a failure");
}

// ── the whole queue, on top of today's table ──
// Today: ~3,020 rows that become files (1,312 Chinese originals, 1,000 th and 708 en articles). The queue: 9 languages x 2,020 live-only rows (18,180), slugs by the queue's rule (<stem> for en and th, <stem>-<lang> for the others).
// 21,200 rows in all, about what the review measured for the full queue (21,208). Rows are small here: the sitemap and the paging only read slug, lang, published and the dates.
const STEM = "how-to-practice-piano-scales-for-beginners", QUEUE_LANGS = ["th", "en", "ja", "ko", "ru", "hi", "es", "fr", "ar"];
function queueRows() {
  const rows = [], row = (lang, slug, i, flagged) => ({ id: uid(), lang, slug, published: true, live_only: flagged, category: CATS[i % 5], title: `T ${slug}`, created_at: day(i % 300), updated_at: day(i % 300) });
  for (let i = 0; i < 1312; i++) rows.push(row("zh", `${STEM}-${i}-zh`, i, false));
  for (let i = 0; i < 1000; i++) rows.push(row("th", `${STEM}-old-${i}`, i, false));
  for (let i = 0; i < 708; i++) rows.push(row("en", `${STEM}-old-${i}`, i, false));
  for (let i = 0; i < 2020; i++) for (const lang of QUEUE_LANGS) rows.push(row(lang, lang === "en" || lang === "th" ? `${STEM}-${i}` : `${STEM}-${i}-${lang}`, i, true));
  return rows;
}
const PLATFORM_LIMIT = 4500000;   // a Vercel Function may not answer more than ~4.5 MB (FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE)
const TARGET = queueRows(), TARGET_STATIC = TARGET.filter(r => !r.live_only), TARGET_LIVE = TARGET.filter(r => r.live_only);
const urlOfRow = (r) => `${live.BLOG_SITE}/blog/${r.lang}/${r.slug}.html`;
const oldPathsP = haveBase ? import(pathToFileURL(path.join(baseRoot, "scripts/blog-paths.mjs")).href) : Promise.resolve(null);

heading("sitemap: with the whole queue published, every file stays far below what a Vercel Function may send (reviews 1 and 4)");
{
  ok(TARGET.length === 21200 && TARGET_STATIC.length === 3020 && TARGET_LIVE.length === 18180, "the fixture is the size of the full queue: 3,020 rows that become files and 18,180 live-only rows (21,200)");
  ok(paths.SITEMAP_MAX_BYTES <= 4000000 && paths.SITEMAP_MAX_URLS <= 45000 && paths.SITEMAP_MAX_BYTES < PLATFORM_LIMIT, "the safety cap of ONE file (SITEMAP_MAX_BYTES) is under the platform's 4.5 MB and the protocol's 50,000 urls: it was the protocol's 45 MB, which no Function can send");
  const oldPaths = await oldPathsP;
  if (oldPaths) {
    const control = oldPaths.sitemapBlogXml(TARGET, SITE);
    ok(Buffer.byteLength(control) > PLATFORM_LIMIT, `control: the single sitemap-blog.xml of the old function for these rows is ${(Buffer.byteLength(control) / 1e6).toFixed(1)} MB, more than a Function may send: this fixture does see the problem`);
  } else skip(`commit ${BASELINE_REF} is not in this checkout: the size of the old single file was not measured`);
  const api = makeApi(TARGET);
  const files = [];
  for (const l of paths.BLOG_LANGS) files.push([l, await live.serveBlogSitemap(api.fetchImpl, OPTS, l)]);
  const sizes = files.map(([, a]) => Buffer.byteLength(a.body)), biggest = Math.max(...sizes);
  ok(files.length === 10 && files.every(([, a]) => a.status === 200 && a.headers["content-type"].startsWith("application/xml") && a.headers["cache-control"] === "public, max-age=120, s-maxage=120" && a.headers["x-blog-source"] === "live" && !a.headers["x-blog-sitemap-dropped"]), "ten files answer 200 as XML, cached 120 s, with nothing left out");
  ok(biggest < PLATFORM_LIMIT / 4, `the biggest file (sitemap-blog-${files[sizes.indexOf(biggest)][0]}.xml) is ${(biggest / 1e6).toFixed(2)} MB, under a quarter of the platform's 4.5 MB (the ten: ${sizes.map(n => (n / 1e6).toFixed(2)).join(" ")} MB)`);
  const locsOf = new Map();
  for (const [l, a] of files) {
    const doc = parseXml(a.body);
    if (doc.getElementsByTagName("parsererror").length || doc.documentElement.nodeName !== "urlset") { ok(false, `sitemap-blog-${l}.xml is well-formed XML with a urlset root`); continue; }
    locsOf.set(l, [...doc.getElementsByTagName("loc")].map(e => e.textContent));
  }
  ok(locsOf.size === 10, "all ten files are well-formed XML (parsed strictly), each a urlset (an index never lists an index)");
  const articleUrls = []; for (const locs of locsOf.values()) for (const u of locs) if (u.endsWith(".html")) articleUrls.push(u);
  const have = new Set(articleUrls);
  ok(articleUrls.length === TARGET.length && have.size === TARGET.length && TARGET.every(r => have.has(urlOfRow(r))), `together the files hold every one of the ${TARGET.length} article urls, each exactly once`);
  ok(TARGET_STATIC.every(r => have.has(urlOfRow(r))) && TARGET_LIVE.every(r => have.has(urlOfRow(r))), "...the 3,020 rows that are files in the deploy AND the 18,180 live-only ones: a language's file lists both");
  let perLang = true;
  for (const l of paths.BLOG_LANGS) {
    const locs = locsOf.get(l), art = locs.filter(u => u.endsWith(".html")), n = TARGET.filter(r => r.lang === l).length;
    if (!(art.length === n && art.every(u => u.startsWith(`${live.BLOG_SITE}/blog/${l}/`)) && locs.length === n + 1 && locs[locs.length - 1] === `${live.BLOG_SITE}/blog/${l}/`)) perLang = false;
  }
  ok(perLang, "each file holds only the rows of its own language and closes with that language's index address (th 3,020, en 2,728, zh 1,312, the other seven 2,020 each)");
  const jaBody = files.find(([l]) => l === "ja")[1].body;
  ok(!jaBody.includes("xhtml") && /<url><loc>[^<]+\.html<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod><\/url>/.test(jaBody) && jaBody.length / 2021 < 200, `an entry is the address and the day, nothing else (${(jaBody.length / 2021).toFixed(0)} bytes): the page carries its own hreflang`);
  const days = [...jaBody.matchAll(/\.html<\/loc><lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].map(m => m[1]);
  ok(days.length === 2020 && days.every((d, i) => i === 0 || d <= days[i - 1]), "the entries are newest first (so the cap, if it is ever reached, leaves out the OLDEST articles)");
}

heading("sitemap: the reviewers' own figures (1,312 stems x 10 languages, the queue's slug rule, 13,130 urls)");
{
  const W = STEM, rows = [];
  for (let i = 0; i < 1312; i++) for (const l of paths.BLOG_LANGS) rows.push({ id: uid(), lang: l, slug: l === "zh" ? `${W}-${i}-zh` : (l === "en" || l === "th") ? `${W}-${i}` : `${W}-${i}-${l}`, published: true, created_at: "2026-01-01T00:00:00Z" });
  const api = makeApi(rows), answers = [];
  for (const l of paths.BLOG_LANGS) answers.push(await live.serveBlogSitemap(api.fetchImpl, OPTS, l));
  const urls = answers.reduce((n, a) => n + a.body.split("<url>").length - 1, 0), biggest = Math.max(...answers.map(a => Buffer.byteLength(a.body)));
  ok(rows.length === 13120 && urls === 13120 + 10 && answers.every(a => a.status === 200), "all ten answer 200 and name every address once (13,120 article urls + 10 language index addresses)");
  ok(biggest < PLATFORM_LIMIT / 10, `the biggest of the ten is ${(biggest / 1e6).toFixed(2)} MB (under a tenth of the platform's limit)`);
  const oldPaths = await oldPathsP;
  if (oldPaths) { const control = Buffer.byteLength(oldPaths.sitemapBlogXml(rows, SITE)); ok(control > PLATFORM_LIMIT && control > biggest * 10, `control: the one file for the same rows is ${(control / 1e6).toFixed(2)} MB (the reviewers measured 5.92 MB), over the 4.5 MB a Function may send: ten files of ${(biggest / 1e6).toFixed(2)} MB at most are what a crawler gets now`); }
}

heading("sitemap: the entry points of the Vercel function (api/blog-sitemap.js)");
{
  const realFetch = globalThis.fetch, api = makeApi(TARGET);
  globalThis.fetch = api.fetchImpl;
  try {
    const mockRes = () => { const r = { statusCode: 0, headers: {}, body: null, setHeader(k, v) { r.headers[String(k).toLowerCase()] = v; }, end(b) { r.body = b; } }; return r; };
    const handler = (await import(pathToFileURL(path.join(ROOT, "api/blog-sitemap.js")).href)).default;
    const call = async (req) => { const r = mockRes(); await handler(req, r); return r; };
    const none = await call({}), emptyQuery = await call({ query: {} });
    const idxDoc = parseXml(none.body), idxLocs = [...idxDoc.getElementsByTagName("loc")].map(e => e.textContent);
    ok(none.statusCode === 200 && none.body === emptyQuery.body && none.headers["content-type"].startsWith("application/xml") && idxDoc.documentElement.nodeName === "sitemapindex" && api.log.length === 0, "no lang (also with an empty query): the index of the ten files, without asking the database");
    ok(idxLocs.join() === paths.BLOG_LANGS.map(l => `${live.BLOG_SITE}/sitemap-blog-${l}.xml`).join(), "...naming sitemap-blog-<lang>.xml for the ten languages, in order");
    let allSmall = true, allOwn = true;
    for (const l of paths.BLOG_LANGS) {
      const r = await call({ query: { lang: l } }), doc = parseXml(r.body), locs = [...doc.getElementsByTagName("loc")].map(e => e.textContent);
      if (!(r.statusCode === 200 && doc.documentElement.nodeName === "urlset" && locs.every(u => u.startsWith(`${live.BLOG_SITE}/blog/${l}/`)) && locs.includes(`${live.BLOG_SITE}/blog/${l}/`))) allOwn = false;
      if (Buffer.byteLength(r.body) >= PLATFORM_LIMIT / 4) allSmall = false;
    }
    ok(allOwn && allSmall, "?lang=<each of the ten languages>: that language's urlset, its own addresses only, each far below the platform's limit, through the handler");
    const before = api.log.length;
    const arr = await call({ query: { lang: ["ar"] } }), bad = [await call({ query: { lang: "xx" } }), await call({ query: { lang: "ja/../../x" } }), await call({ query: { lang: "JA" } }), await call({ query: { lang: "live-ja" } }), await call({ query: { lang: "th.xml" } })];
    ok(arr.statusCode === 200 && arr.body.includes("/blog/ar/") && bad.every(r => r.statusCode === 404 && r.body === "" && r.headers["cache-control"] === "no-store"), "an array lang takes the first; a language that is not one of the ten (xx, JA, live-ja, th.xml, a path) is a 404 with no body, never cached");
    ok(api.log.length - before === 3, "...and a 404 never reaches the database (the ar file read its 3 requests, the five 404s none)");
  } finally { globalThis.fetch = realFetch; }
  const direct = await live.serveBlogSitemap(makeApi(TARGET).fetchImpl, { catalog: [], lang: "zh" }), plain = await live.serveBlogSitemap(makeApi(TARGET).fetchImpl, { catalog: [] }, "zh");
  ok(direct.status === 200 && direct.body === plain.body, "serveBlogSitemap takes the language as a third argument or as opts.lang: the same file");
}

heading("sitemap: one file reads its own language only, in two rounds at most (review 5)");
{
  const roundsOf = (api) => 1 + Math.ceil((api.log.length - 1) / 8);   // the first request, then the rest eight at a time
  const a1 = makeApi(TARGET, { delayMs: 2, measure: true }), a2 = makeApi(TARGET, { delayMs: 2, measure: true }), a3 = makeApi(TARGET, { delayMs: 2, measure: true });
  await live.serveBlogSitemap(a1.fetchImpl, OPTS, "th"); await live.serveBlogSitemap(a2.fetchImpl, OPTS, "ja"); await readAllMeta(a3.fetchImpl);
  ok(a1.log.length === 4 && roundsOf(a1) === 2, `the th file (the biggest) reads its 3,020 rows in ${a1.log.length} requests, ${roundsOf(a1)} rounds`);
  ok(a2.log.length === 3 && roundsOf(a2) === 2, `the ja file reads its 2,020 rows in ${a2.log.length} requests, ${roundsOf(a2)} rounds`);
  ok(a3.log.length === 22 && roundsOf(a3) === 4, `control: reading every row for one file (the old way) is ${a3.log.length} requests, ${roundsOf(a3)} rounds even at 1,000 rows a page (it was 43 requests, 8 rounds at 500)`);
  ok(a1.log.every(e => e.q.published === "eq.true" && e.q.lang === "eq.th" && e.q.live_only === undefined && e.q.select === "slug,lang,published,created_at,updated_at" && e.q.order === "created_at.desc,id.asc" && e.q.limit === "1000") && a1.log[0].prefer === "count=exact" && a1.log.slice(1).every(e => !e.prefer), "a file asks for the published rows of its own language, the five sitemap columns only, newest first, 1,000 a page, with no live_only filter at all");
  const bytes = (api) => api.log.reduce((n, e) => n + (e.bytes || 0), 0);
  ok(bytes(a2) < bytes(a3) / 4, `what one file reads (${(bytes(a2) / 1e6).toFixed(2)} MB for ja, ${(bytes(a1) / 1e6).toFixed(2)} MB for th) is under a quarter of the whole table's (${(bytes(a3) / 1e6).toFixed(2)} MB)`);
  // a database that does not know the column answers 400 to a filter on it: a file never names it, so there is nothing to special-case
  const old = makeApi(TARGET_STATIC.map(({ live_only, ...r }) => r), { rejectColumn: "live_only" });
  const s400 = await live.serveBlogSitemap(old.fetchImpl, OPTS, "en");
  ok(s400.status === 200 && s400.body.split("<url>").length - 1 === 709 && old.log.length === 1, "a database without live_only needs no special case: the file never names the column (en: 708 rows and the index address, one request)");
}

heading("vercel.json, the root sitemap index and robots.txt");
{
  const vj = JSON.parse(read("vercel.json"));
  ok(["api/blog-sitemap.js", "api/blog-page.js"].every(f => vj.functions[f] && vj.functions[f].maxDuration >= 15 && vj.functions[f].maxDuration <= 60 && String(vj.functions[f].includeFiles).includes("supabase-client.ts")), "both blog functions have a maxDuration (30 s; the Hobby plan allows 60) and still bundle supabase-client.ts and the catalog (review 5)");
  const idxOf = (s) => vj.rewrites.findIndex(r => r.source === s), rw = vj.rewrites[idxOf("/sitemap-blog-:lang.xml")];
  ok(rw && rw.destination === "/api/blog-sitemap?lang=:lang" && idxOf("/sitemap-blog-:lang.xml") < vj.rewrites.length - 1 && !vj.rewrites.some(r => /sitemap-blog(?:\.xml|-live)/.test(r.source)), "/sitemap-blog-<lang>.xml is rewritten to the function with ?lang=, ahead of the app's catch-all; no rewrite is left for the old /sitemap-blog.xml or the earlier -live- name");
  ok(vj.redirects.some(r => /^\/blog\/:lang\/:file\.html\/$/.test(r.source)), "the :lang.xml pattern is the form this file already uses (/blog/:lang/:file.html/)");
  const red = vj.redirects.find(r => r.source === "/sitemap-blog.xml");
  ok(red && red.destination === "/sitemap.xml" && (red.statusCode === 301 || red.permanent === true), "/sitemap-blog.xml (Search Console may still have it) is a 301 to /sitemap.xml, a redirect (checked before the rewrites), not a function");
  const spa = vj.rewrites[vj.rewrites.length - 1], inner = /^\/\((.*)\)$/.exec(spa.source)[1], spaRe = new RegExp("^" + inner + "$");
  ok(spa.destination === "/index.html" && !spaRe.test("sitemap-blog.xml") && paths.BLOG_LANGS.every(l => !spaRe.test(`sitemap-blog-${l}.xml`)) && spaRe.test("settings") && spaRe.test("song/12") && spaRe.test("sitemap-blog-th.xml.bak"), "the app's catch-all lets the ten files (and /sitemap-blog.xml) through and still catches every other path");
  const entries = paths.blogSitemapIndexEntries(SITE, "2026-11-17");
  ok(entries.length === 10 && paths.BLOG_LANGS.every((l, i) => entries[i] === `<sitemap><loc>${SITE}/sitemap-blog-${l}.xml</loc><lastmod>2026-11-17</lastmod></sitemap>`) && !entries.join("").includes("sitemap-blog.xml"), "the root sitemap index names the ten per-language files and nothing else of the blog (the set is fixed, so it is written at build time)");
  ok(parseXml(paths.blogSitemapIndexXml(SITE, "2026-11-17")).getElementsByTagName("sitemap").length === 10, "...as well-formed sitemapindex entries");

  // the REAL build-song-pages.mjs and then the REAL build-blog-pages.mjs, in a throw-away root: what the release build writes into sitemap.xml and robots.txt
  const mkSongRoot = (name, files) => {
    const root = path.join(tmp, name);
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
    fs.symlinkSync(path.join(ROOT, "node_modules/esbuild"), path.join(root, "node_modules/esbuild"));
    for (const f of ["songs-data.ts", "songs-classical.ts"]) fs.copyFileSync(path.join(ROOT, f), path.join(root, f));
    writeRoot(root, files);
    return root;
  };
  const songRoot = mkSongRoot("sbx-song", { ...CUR, "scripts/build-song-pages.mjs": read("scripts/build-song-pages.mjs") });
  runGen(path.join(songRoot, "scripts/build-song-pages.mjs"), {});
  const smA = fs.readFileSync(path.join(songRoot, "sitemap.xml"), "utf8"), robotsA = fs.readFileSync(path.join(songRoot, "robots.txt"), "utf8");
  runGen(path.join(songRoot, "scripts/build-blog-pages.mjs"), { BLOG_FIXTURE: fx("fx-song-chain", MIXED), BLOG_SRC: srcDir });   // appends the entry of blog/sitemap-static.xml, as in `npm run build`
  const smB = fs.readFileSync(path.join(songRoot, "sitemap.xml"), "utf8"), docB = parseXml(smB);
  const kids = [...docB.getElementsByTagName("sitemap")].map(e => e.getElementsByTagName("loc")[0].textContent);
  const lastmods = [...docB.getElementsByTagName("lastmod")].map(e => e.textContent);
  ok(docB.getElementsByTagName("parsererror").length === 0 && docB.documentElement.nodeName === "sitemapindex" && kids.join() === [`${SITE}/sitemap-pages.xml`, `${SITE}/sitemap-songs.xml`, ...paths.BLOG_LANGS.map(l => `${SITE}/sitemap-blog-${l}.xml`), `${SITE}/blog/sitemap-static.xml`].join(), "the real generators write a root sitemap.xml that names pages, songs, the ten blog files directly and the static file of the source-file languages, in that order, and not sitemap-blog.xml");
  const diskKids = ["sitemap-pages.xml", "sitemap-songs.xml", "blog/sitemap-static.xml"].map(f => parseXml(fs.readFileSync(path.join(songRoot, f), "utf8")).documentElement.nodeName);
  ok(diskKids.every(n => n === "urlset") && !kids.includes(`${SITE}/sitemap.xml`), "no entry is itself an index: the three files on disk are urlsets, the ten served by the function are urlsets (checked above), and the root does not name itself");
  ok(lastmods.slice(0, 12).every(d => d === lastmods[0]) && /^\d{4}-\d{2}-\d{2}$/.test(lastmods[0]), "the ten blog entries carry the lastmod of the build, like the entries before them");
  const sitemapLines = robotsA.split("\n").filter(l => /^sitemap:/i.test(l));
  ok(sitemapLines.join() === `Sitemap: ${SITE}/sitemap.xml` && !/sitemap-blog/.test(robotsA) && /^User-agent: \*\nUser-agent: GPTBot\n/.test(robotsA) && robotsA.includes("Allow: /\nDisallow: /updates/\n"), "robots.txt names the root index only (it covers the ten files; a second Sitemap: line for the blog would repeat it) and keeps its crawler groups and rules");
  if (haveBase) {
    const oldRoot = mkSongRoot("sbx-song-old", { "scripts/build-song-pages.mjs": gitShow("scripts/build-song-pages.mjs") });
    runGen(path.join(oldRoot, "scripts/build-song-pages.mjs"), {});
    const smOld = fs.readFileSync(path.join(oldRoot, "sitemap.xml"), "utf8"), robotsOld = fs.readFileSync(path.join(oldRoot, "robots.txt"), "utf8"), oldLine = `<sitemap><loc>${SITE}/sitemap-blog.xml</loc><lastmod>${lastmods[0]}</lastmod></sitemap>`;
    ok(["sitemap-pages.xml", "sitemap-songs.xml"].every(f => fs.readFileSync(path.join(oldRoot, f)).equals(fs.readFileSync(path.join(songRoot, f)))) && smOld.includes(oldLine) && smOld.replace(oldLine, paths.blogSitemapIndexEntries(SITE, lastmods[0]).join("\n")) === smA && robotsOld === robotsA + `Sitemap: ${SITE}/sitemap-blog.xml\n`, `against the generator at ${BASELINE_REF}: sitemap-pages.xml and sitemap-songs.xml are byte-identical, and the only differences are the one sitemap-blog.xml entry (now the ten) in sitemap.xml and the one Sitemap: line of robots.txt`);
  }
  // the committed files the release build will rewrite: until then they already say the same, so /sitemap-blog.xml (a 301 to /sitemap.xml) is never named by the file it redirects to
  const idxC = read("sitemap.xml"), robotsC = read("robots.txt");
  ok(paths.BLOG_LANGS.every(l => idxC.includes(`<loc>${SITE}/sitemap-blog-${l}.xml</loc>`)) && !idxC.includes(`${SITE}/sitemap-blog.xml`) && idxC.includes(`${SITE}/sitemap-pages.xml`) && idxC.includes(`${SITE}/blog/sitemap-static.xml`) && !/sitemap-blog\.xml/.test(robotsC) && robotsC.includes(`Sitemap: ${SITE}/sitemap.xml`), "the committed sitemap.xml and robots.txt already name the ten files and not sitemap-blog.xml (the release build rewrites them with today's date)");
}

heading("build: the database read asks only for the rows that become files, and is used only when it is complete (reviews 2 and 3)");
const DBURL = "https://db.test";
const readBuild = (rows, o = {}, extra = {}) => { const api = makeApi(rows, { measure: true, ...o }), logs = []; return gen.fetchBuildRows({ url: DBURL, key: "anon-key", fetchImpl: o.fetchImpl || api.fetchImpl, statics: [], log: (m) => logs.push(m), ...extra }).then(res => ({ res, api, logs })); };
{
  // review 2: every build run used to download every published row with select=* (bodies included) and throw the live-only ones away
  const BODY = "x".repeat(1500);
  const fat = TARGET.map(r => ({ ...r, body: BODY, excerpt: "e", cover_url: null, cover_alt: null, author_id: null }));
  const { res, api } = await readBuild(fat);
  ok(res.complete && res.filtered && res.rows.length === 3020 && res.rows.every(r => r.live_only !== true) && api.log.length === 7, `at the size of the full queue (21,200 rows) the build reads the 3,020 rows that become files in ${api.log.length} requests of 500, not the 43 it used to send`);
  ok(api.log.every(e => e.q.select === "*" && e.q.published === "eq.true" && e.q.live_only === "eq.false" && e.q.order === "created_at.desc,id.asc" && e.q.limit === "500") && api.log[0].prefer === "count=exact" && api.log.slice(1).every(e => !e.prefer) && api.log.every(e => e.auth), "every request is published=eq.true&live_only=eq.false, newest first, 500 a page, with the API key; only the first asks for the total");
  const all = await readBuild(fat, { honourLiveOnly: false });
  const mb = (a) => a.api.log.reduce((n, e) => n + e.bytes, 0) / 1e6;
  ok(all.res.rows.length === 21200 && all.api.log.length === 43 && mb({ api }) * 5 < mb(all), `control: a read the database does not filter (the old query) is ${all.api.log.length} requests and ${mb(all).toFixed(0)} MB; the filtered one is ${api.log.length} requests and ${mb({ api }).toFixed(0)} MB (a seventh)`);
  ok(res.rows.every((r, i) => r.id === all.res.rows.filter(x => x.live_only !== true)[i].id), "the rows it keeps are exactly the unfiltered read's rows that are not flagged, in the same order");
}
{
  // a database without the column answers 400: the read is repeated without the filter, as before the flag existed
  const rows = TARGET_STATIC.slice(0, 1200).map(({ live_only, ...r }) => ({ ...r, body: "b" }));
  const { res, api, logs } = await readBuild(rows, { rejectColumn: "live_only" });
  ok(res.complete && res.filtered === false && res.rows.length === 1200 && api.log.length === 4 && api.log[0].q.live_only === "eq.false" && api.log[1].q.live_only === undefined && logs.length === 1 && /no live_only column/.test(logs[0]), "a database without live_only (400): the read is repeated without the filter and gives every published row, and says so");
  const fail500 = await readBuild(rows.map(r => ({ ...r, live_only: false })), { failAt: 500 });
  ok(!fail500.res.complete && /no posts \(500\)/.test(fail500.res.why) && fail500.res.rows.length === 0 && fail500.api.log.length === 2 && fail500.logs.length === 0, "any other failure (a 500) is not retried without the filter: the read fails, with the status in the reason");
  const nonList = await gen.fetchBuildRows({ url: DBURL, key: "k", fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ message: "no" }) }), log: () => {} });
  ok(!nonList.complete && /not a list/.test(nonList.why), "an answer that is not a list is a failed read");
}
{
  // review 3: the loop gave up after 40 pages (20,000 rows) and called that a success, then deleted blog/ and wrote only the rows it had seen
  const rows = Array.from({ length: 21000 }, (_, i) => ({ id: uid(), lang: "en", slug: `s-${i}`, published: true, live_only: false, created_at: day(i % 300), updated_at: day(i % 300), title: "t", body: "b" }));
  const { res, api } = await readBuild(rows);
  ok(res.complete && res.rows.length === 21000 && new Set(res.rows.map(r => r.slug)).size === 21000 && api.log.length === 42, `21,000 rows that become files are all read (${api.log.length} requests): the old 40-page guard stopped at 20,000 and still said it was done`);
  const cut = await readBuild(rows, {}, { maxPages: 40 });
  ok(!cut.res.complete && cut.res.rows.length === 0 && /incomplete read: 20000 of 21000 rows after 40 pages/.test(cut.res.why), "a read that runs out of pages with rows left is NOT complete, whatever the page guard: it says how many it saw (20,000 of 21,000)");
  const lie = await readBuild(rows.slice(0, 1200), { lieTotal: 7 });
  ok(!lie.res.complete && lie.res.rows.length === 0 && /incomplete read: 1200 of 1207 rows/.test(lie.res.why), "fewer rows than the total the database announced is NOT complete (1,200 of 1,207), so nothing is deleted on the strength of it");
  const capped = await readBuild(rows.slice(0, 1200), { maxRows: 100 });
  ok(capped.res.complete && capped.res.rows.length === 1200 && new Set(capped.res.rows.map(r => r.slug)).size === 1200 && capped.api.log.length === 12, `a server that caps a page at 100 rows is followed by what it sent (${capped.api.log.length} requests): every row once, complete`);
  const plain = await readBuild(rows.slice(0, 1200), { headers: false });
  ok(plain.res.complete && plain.res.rows.length === 1200 && plain.api.log.length === 3, "with no Content-Range total (a double with no headers) the read ends at the first short page, as before");
  const empty = await readBuild([]);
  ok(empty.res.complete && empty.res.rows.length === 0, "an empty table is a complete read of nothing, as it always was");
}
{
  // review 3 (integrator's direction): the page guard is 200 pages like the live reader's (it was 40), and it says so when it is hit
  ok(gen.BUILD_MAX_PAGES === 200 && gen.BUILD_PAGE === 500, "the build's page guard is 200 pages of 500 rows (100,000 rows); it was 40 pages (20,000 rows)");
  const endless = (withTotal) => { let calls = 0; const f = async (u) => { calls++; const off = Number(new URL(u).searchParams.get("offset")); const data = Array.from({ length: 500 }, (_, i) => ({ id: `e${off + i}`, lang: "en", slug: `e-${off + i}`, published: true })); return { ok: true, status: 206, json: async () => data, headers: { get: (h) => (withTotal && String(h).toLowerCase() === "content-range" ? `${off}-${off + 499}/1000000000` : null) } }; }; return { f, calls: () => calls }; };
  for (const withTotal of [true, false]) {
    const e = endless(withTotal), r = await gen.fetchBuildRows({ url: DBURL, key: "k", fetchImpl: e.f, statics: [], log: () => {} });
    ok(!r.complete && r.rows.length === 0 && e.calls() === 200 && /incomplete read: 100000 (of 1000000000 )?rows after 200 pages/.test(r.why) && /page guard/.test(r.why), `a table with no end stops at the guard after exactly 200 requests (${withTotal ? "a total announced" : "no total"}), is not complete and says why: "${r.why.slice(0, 64)}..."`);
  }
}
{
  // a blog-src file is shadowed by a database row of the same (lang, slug), flagged or not: the flagged rows are not downloaded, so the files that could be shadowed are looked up by name
  const sf = (lang, slug) => ({ lang, slug, title: "file", body: "b", published: true, created_at: day(1) });
  const statics = [sf("ja", "src-ja"), sf("ar", "src-ar"), sf("ja", "also-here"), sf("ko", "no-row")];
  const rows = [mk("ja", "src-ja", { live_only: true }), mk("ar", "src-ar", { live_only: true, published: false }), mk("ja", "also-here", { live_only: false }), mk("ar", "src-ja", { live_only: true }), mk("en", "plain", { live_only: false })];
  const { res, api } = await readBuild(rows, {}, { statics });
  const shadowReq = api.log.filter(e => e.q.select === "lang,slug");
  ok(res.complete && res.read === 2 && res.shadowed === 1 && res.rows.length === 3 && res.rows.filter(r => r.live_only === true).map(r => r.lang + "/" + r.slug).join() === "ja/src-ja", "a published flagged row on a blog-src file comes back as a stub { live_only: true } (ja/src-ja); an unpublished one (ar/src-ar), a row of another language with the slug (ar/src-ja) and a file with no row do not");
  ok(shadowReq.length === 1 && shadowReq[0].q.published === "eq.true" && shadowReq[0].q.live_only === "is.true" && shadowReq[0].q.lang === "in.(ja,ar,ko)" && shadowReq[0].q.slug === "in.(src-ja,src-ar,no-row)", "one small request names them (select=lang,slug, published, live_only, the languages and slugs of the files that no unflagged row already covers: ja/also-here is not asked for)");
  const merged = gen.mergeStatic(res.rows, statics), kept = merged.filter(p => !gen.isLiveOnly(p)).map(p => p.lang + "/" + p.slug).sort();
  ok(kept.join() === "ar/src-ar,en/plain,ja/also-here,ko/no-row", "...and through mergeStatic and the live-only filter the shadowed file is gone and the others stay: what the generator did with the real flagged row");
  const many = Array.from({ length: 120 }, (_, i) => sf("ja", `f-${i}`));
  const rows2 = [mk("ja", "f-119", { live_only: true }), mk("ja", "f-3", { live_only: true })];
  const m = await readBuild(rows2, {}, { statics: many });
  ok(m.api.log.filter(e => e.q.select === "lang,slug").length === 3 && m.res.shadowed === 2, "120 files are looked up 50 names a request (3 requests) and the ones found in the last and the first request are both found");
  const none = await readBuild(rows, {}, { statics: [] });
  ok(none.api.log.length === 1 && none.res.shadowed === 0, "no blog-src file, no lookup");
  const base = makeApi(rows, {}), failShadow = await gen.fetchBuildRows({ url: DBURL, key: "k", statics, log: () => {}, fetchImpl: (u, i) => (/select=lang,slug/.test(u) ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) }) : base.fetchImpl(u, i)) });
  ok(!failShadow.complete && /shadow lookup failed \(500\)/.test(failShadow.why), "a failed lookup makes the read incomplete (the old pages stay) rather than guessing which files are shadowed");
  const old = await readBuild(rows.map(({ live_only, ...r }) => r), { rejectColumn: "live_only" }, { statics });
  ok(old.res.complete && old.res.filtered === false && old.res.shadowed === 0 && !old.api.log.some(e => e.q.select === "lang,slug"), "without the column there is nothing to look up: the unfiltered read has every row");
}

heading("build: the whole generator against a local fake PostgREST (what `npm run build` does with the network)");
{
  const http = await import("node:http");
  const serveFake = async (rows, o = {}) => {
    const api = makeApi(rows, o);
    const server = http.createServer(async (req, res) => {
      try {
        const r = await api.fetchImpl("http://127.0.0.1" + req.url, { headers: { apikey: req.headers.apikey, Prefer: req.headers.prefer } });
        const cr = r.headers && r.headers.get("content-range");
        res.writeHead(r.status, { "content-type": "application/json", ...(cr ? { "content-range": cr } : {}) });
        res.end(JSON.stringify(await r.json()));
      } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
    });
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    return { api, server, port: server.address().port };
  };
  const spawnAsync = (script, env) => new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { env: { ...process.env, SITE_URL: SITE, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", d => { out += d; }); child.stderr.on("data", d => { err += d; });
    child.on("close", code => resolve({ code, out, err }));
  });
  const SENTINEL = "th/sentinel-old-page.html";
  // the real column is NOT NULL: a fixture row with the flag absent or null is a row with false there (unless the scenario is a database that has no such column at all)
  const asDb = (rows) => rows.map(r => ({ ...r, live_only: r.live_only === true }));
  async function restRun(rows, name, serverOpts, kind = "index") {
    const { api, server, port } = await serveFake(serverOpts && serverOpts.rejectColumn ? rows : asDb(rows), serverOpts);
    try {
      const root = path.join(tmp, "rest-" + name);
      writeRoot(root, { ...CUR, "supabase-client.ts": CUR["supabase-client.ts"].replace(/SUPABASE_URL = "[^"]+"/, `SUPABASE_URL = "http://127.0.0.1:${port}"`), "sitemap.xml": kind === "flat" ? FLAT : INDEX, ["blog/" + SENTINEL]: "<html>an older build's page</html>" });
      const r = await spawnAsync(path.join(root, "scripts/build-blog-pages.mjs"), { BLOG_SRC: srcDir });
      return { root, api, port, ...r };
    } finally { server.close(); }
  }
  // the database hands the rows over newest first, and the related lists follow that order: the BLOG_FIXTURE reference gets the same order. The pages also carry the API address (the local fake's here).
  const dbOrder = (rows) => rows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const REAL_URL = (/SUPABASE_URL = "([^"]+)"/.exec(CUR["supabase-client.ts"]) || [])[1];
  const shadowRow = mk("ja", "src-ja", { live_only: true, title: `${TOKEN} shadow of a file`, created_at: day(40), updated_at: day(40) });
  const rowsAll = MIXED.concat([shadowRow]);
  const ref = sandboxRun(CUR, "index", dbOrder(rowsAll), "rest-ref");   // the same rows through BLOG_FIXTURE: what the generator has always done with a table it already holds
  const R = await restRun(rowsAll, "complete");
  const sameAsRef = (a, b) => {
    const fa = listFiles(path.join(a.root, "blog")).filter(f => f !== SENTINEL), fb = listFiles(path.join(b.root, "blog"));
    if (fa.join("\n") !== fb.join("\n")) return false;
    for (const f of fa) if (fs.readFileSync(path.join(a.root, "blog", f), "utf8").split(`http://127.0.0.1:${a.port}`).join(REAL_URL) !== fs.readFileSync(path.join(b.root, "blog", f), "utf8")) return false;
    return ["sitemap.xml", "api/blog-live-catalog.json"].every(f => fs.readFileSync(path.join(a.root, f), "utf8") === fs.readFileSync(path.join(b.root, f), "utf8"));
  };
  ok(R.code === 0 && /build-blog-pages: 61 static rows read, live-only rows not downloaded \(1 blog-src file\(s\) are shadowed by one\)/.test(R.out) && !/live-only rows served from the database/.test(R.out), "the run says how many rows it read and that the live-only ones were not downloaded (and how many blog-src files one shadows)");
  ok(R.api.log.length === 2 && R.api.log[0].q.live_only === "eq.false" && R.api.log[1].q.select === "lang,slug" && R.api.log.every(e => e.q.published === "eq.true"), "it sent two requests: the 61 rows that become files (one page) and one lookup of the blog-src files a flagged row might shadow");
  ok(!fs.existsSync(path.join(R.root, "blog", SENTINEL)) && sameAsRef(R, ref), "complete read: blog/ is rewritten (the page of an older build is gone), and blog/, sitemap.xml and the live catalog are byte-identical to the BLOG_FIXTURE run of the same rows, shadowed file and all");
  const flat = await restRun(rowsAll, "complete-flat", {}, "flat"), flatRef = sandboxRun(CUR, "flat", dbOrder(rowsAll), "rest-ref-flat");
  ok(flat.code === 0 && sameAsRef(flat, flatRef), "...also with a flat sitemap.xml (the appended blog urls)");
  const lied = await restRun(rowsAll, "incomplete", { lieTotal: 9 });
  ok(lied.code === 0 && /incomplete read: 61 of 70 rows/.test(lied.out) && /fetch failed, leaving the existing blog pages in place/.test(lied.out) && fs.existsSync(path.join(lied.root, "blog", SENTINEL)) && !fs.existsSync(path.join(lied.root, "blog/en/piano-posture.html")), "a read that is not complete (the database announced 70 rows, 61 came): the build says so, keeps the older pages and writes none of the rows it did see");
  const down = await restRun(rowsAll, "down", { failAt: 0 });
  ok(down.code === 0 && /no posts \(500\)/.test(down.out) && fs.existsSync(path.join(down.root, "blog", SENTINEL)), "a failing database: the older pages stay, as before");
  const oldDb = await restRun(MIXED.map(({ live_only, ...r }) => r), "old-db", { rejectColumn: "live_only" });
  const oldRef = sandboxRun(CUR, "index", dbOrder(MIXED.map(({ live_only, ...r }) => r)), "rest-ref-old");
  ok(oldDb.code === 0 && /no live_only column/.test(oldDb.out) && oldDb.api.log.length === 2 && sameAsRef(oldDb, oldRef), "a database without the column: the build repeats the read without the filter and writes what it always wrote");
  if (haveBase) {
    // the old generator's read of the same table: it downloads the flagged rows too (and writes their files)
    const { api, server, port } = await serveFake(rowsAll, { honourLiveOnly: false });
    try {
      const root = path.join(tmp, "rest-old-gen");
      writeRoot(root, { ...BASE, "supabase-client.ts": BASE["supabase-client.ts"].replace(/SUPABASE_URL = "[^"]+"/, `SUPABASE_URL = "http://127.0.0.1:${port}"`), "sitemap.xml": INDEX });
      const r = await spawnAsync(path.join(root, "scripts/build-blog-pages.mjs"), { BLOG_SRC: srcDir });
      ok(r.code === 0 && api.log.length === 1 && api.log[0].q.live_only === undefined && api.log[0].rows === rowsAll.length, `control: the old generator's query has no live_only filter and brings all ${api.log[0].rows} rows, the flagged ones too (the new one's first query brings 61)`);
    } finally { server.close(); }
  }
  // review 3 through the whole generator: a database that never ends reaches the 200-page guard; the build says so, writes none of what it read and keeps the older pages
  {
    const server = http.createServer((req, res) => {
      const off = Number(new URL(req.url, "http://x").searchParams.get("offset") || 0);
      const data = Array.from({ length: 500 }, (_, i) => ({ id: `e${off + i}`, lang: "en", slug: `e-${off + i}`, title: "t", body: "b", category: "tips", published: true, live_only: false, created_at: day(1), updated_at: day(1) }));
      res.writeHead(206, { "content-type": "application/json", "content-range": `${off}-${off + 499}/1000000000` });
      res.end(JSON.stringify(data));
    });
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    try {
      const root = path.join(tmp, "rest-endless");
      writeRoot(root, { ...CUR, "supabase-client.ts": CUR["supabase-client.ts"].replace(/SUPABASE_URL = "[^"]+"/, `SUPABASE_URL = "http://127.0.0.1:${server.address().port}"`), "sitemap.xml": INDEX, ["blog/" + SENTINEL]: "<html>an older build's page</html>" });
      const r = await spawnAsync(path.join(root, "scripts/build-blog-pages.mjs"), { BLOG_SRC: srcDir });
      ok(r.code === 0 && /incomplete read: 100000 of 1000000000 rows after 200 pages/.test(r.out) && /page guard/.test(r.out) && /fetch failed, leaving the existing blog pages in place/.test(r.out) && fs.existsSync(path.join(root, "blog", SENTINEL)) && !fs.existsSync(path.join(root, "blog/en/e-0.html")), "a database that never ends: the generator stops at the 200-page guard, says so in the build log, writes none of the rows it read and keeps the older pages");
    } finally { server.close(); }
  }
  // review 3, the reviewers' own setup: a mock PostgREST that knows limit / offset only (no live_only filter, no Content-Range) and holds the whole queue (3,020 static + 18,180 live-only rows)
  {
    const rows = TARGET.map(r => ({ ...r, body: "A short body of the article, long enough to be one.", excerpt: "e", cover_url: null, cover_alt: null, author_id: null }));
    const rev = await restRun(rows, "reviewer-mock", { honourLiveOnly: false, headers: false });
    const blogDir = path.join(rev.root, "blog"), arts = listFiles(blogDir).filter(f => /^[a-z]{2}\/[^/]+\.html$/.test(f) && !f.endsWith("/index.html"));
    const leaked = TARGET_LIVE.filter(r => fs.existsSync(path.join(blogDir, r.lang, r.slug + ".html")));
    ok(rev.code === 0 && rev.api.log.length === 44 && arts.length === 3020 + 2 && leaked.length === 0 && !fs.existsSync(path.join(blogDir, SENTINEL)), `against a server that ignores the filter and sends no total (43 pages of 500 and the blog-src lookup): the 3,020 static rows and the 2 blog-src files become files (${arts.length}), none of the 18,180 live-only rows does, and the older page is replaced (the old loop gave 2,546 files at 21,208 rows)`);
    ok(/21200 rows read, 18180 of them live-only \(the database did not apply live_only=eq\.false/.test(rev.out), "...and the log says the filter was not applied (it does not claim the live-only rows were not downloaded)");
  }
}

heading("sitemap: the safety cap of one file (urls and bytes)");
{
  // 500 en rows, one a minute apart; the cap is a test door (opts.sitemapLimits) so a small table reaches it
  const enRows = Array.from({ length: 500 }, (_, i) => { const d = new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(); return { id: uid(), lang: "en", slug: `cap-${i}`, published: true, live_only: i % 2 === 0, created_at: d, updated_at: d }; });
  const warned = []; const warn = console.warn; console.warn = (...a) => warned.push(a.join(" "));
  let out; try { out = await live.serveBlogSitemap(makeApi(enRows).fetchImpl, { catalog: [], sitemapLimits: { maxUrls: 21 } }, "en"); } finally { console.warn = warn; }
  const doc = parseXml(out.body), locs = [...doc.getElementsByTagName("loc")].map(e => e.textContent), articleLocs = locs.filter(u => u.endsWith(".html"));
  ok(out.status === 200 && doc.getElementsByTagName("parsererror").length === 0 && locs.length === 21 && articleLocs.length === 20, "past the url limit the file stops at it: 20 article urls + the language index address");
  ok(out.headers["x-blog-sitemap-dropped"] === "480" && warned.length === 1 && /480 of 500/.test(warned[0]) && /en/.test(warned[0]), "...the answer carries x-blog-sitemap-dropped and the function log says how many were left out, and for which language");
  const newest = enRows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 20).map(r => `${live.BLOG_SITE}/blog/en/${r.slug}.html`);
  ok(newest.every(u => articleLocs.includes(u)) && locs.includes(`${live.BLOG_SITE}/blog/en/`), "...what is kept is the newest 20 (the oldest go first), live-only or not, and the language index address");
  const byBytes = paths.sitemapLangBuild(enRows, SITE, "en", { maxBytes: 3000 });
  ok(byBytes.dropped > 0 && byBytes.kept + byBytes.dropped === 500 && Buffer.byteLength(byBytes.xml) <= 3000, `the byte limit works the same way (${byBytes.kept} kept, ${byBytes.dropped} left out, ${Buffer.byteLength(byBytes.xml)} of 3,000 bytes)`);
  // the real cap, on a language far bigger than any real one: still a file a Function can send, still well-formed, and it says what it left out
  const monster = Array.from({ length: 60000 }, (_, i) => ({ lang: "en", slug: `how-to-practice-piano-scales-for-beginners-${i}`, published: true, created_at: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString() }));
  const big = paths.sitemapLangBuild(monster, SITE, "en");
  ok(big.dropped > 0 && big.kept + big.dropped === 60000 && Buffer.byteLength(big.xml) <= paths.SITEMAP_MAX_BYTES && Buffer.byteLength(big.xml) < PLATFORM_LIMIT && big.urls <= paths.SITEMAP_MAX_URLS && parseXml(big.xml).getElementsByTagName("parsererror").length === 0, `60,000 articles in one language: the file is held to ${(Buffer.byteLength(big.xml) / 1e6).toFixed(2)} MB and ${big.urls} urls (${big.dropped} oldest left out), under the platform's 4.5 MB, and still well-formed`);
  const odd = paths.sitemapLangBuild([{ slug: "a", lang: "ja", published: true, created_at: "2026-11-08T10:00:00Z" }, { slug: "a", lang: "ja", published: true, created_at: "2026-11-09" }, { slug: "Bad_Slug", lang: "ja", published: true }, { slug: "b", lang: "ko", published: true }, { slug: "c", lang: "ja", published: false }, { slug: "d é", lang: "ja", published: true }, null, { slug: "e", lang: "ja", published: true, updated_at: "garbage" }], SITE, "ja");
  ok(odd.kept === 2 && odd.total === 2 && odd.xml.includes("/blog/ja/a.html</loc><lastmod>2026-11-08</lastmod>") && odd.xml.includes("/blog/ja/e.html</loc></url>") && !odd.xml.includes("Bad_Slug") && !odd.xml.includes("/ko/") && !odd.xml.includes("/blog/ja/c.html") && odd.xml.endsWith(`<url><loc>${SITE}/blog/ja/</loc><lastmod>2026-11-08</lastmod></url>\n</urlset>\n`), "a file skips a duplicate slug, a bad slug, another language, an unpublished row and a null; a missing or odd date is no lastmod; the index address (lastmod: the newest day) closes the file");
  const none = paths.sitemapLangBuild([], SITE, "fr");
  ok(none.urls === 0 && none.total === 0 && parseXml(none.xml).getElementsByTagName("parsererror").length === 0 && !none.xml.includes("<url>") && paths.sitemapLangBuild([{ slug: "a", lang: "xx", published: true }], SITE, "xx").urls === 0, "a language with no article is a valid, empty urlset with no index address (the address would be a 404); a language that is not one of the ten has nothing");
}

heading("live function: an unpublished row is never served");
{
  const strict = makeApi(DB), careless = makeApi(DB, { honourPublished: false });
  const ctl = await readAllMeta(careless.fetchImpl), ctl2 = await live.fetchRelated("en", "story", "story-lone", careless.fetchImpl);
  ok(ctl.some(r => r.slug === "hidden-plain") && ctl.some(r => r.slug === "hidden-staged") && ctl2.some(r => r.slug === "hidden-plain"), "control: the careless double does hand back the unpublished rows (list, sitemap read and related read)");
  for (const [name, api] of [["the API filters published (as PostgREST does)", strict], ["the API wrongly returns unpublished rows too", careless]]) {
    for (const slug of ["hidden-staged", "hidden-plain"]) {
      const out = await live.serveBlog({ lang: "en", rest: slug + ".html" }, api.fetchImpl, OPTS);
      ok(out.status === 404 && !out.body.includes("HIDDEN") && out.headers["x-robots-tag"] === "noindex", `${name}: /blog/en/${slug}.html is a 404 (noindex), live-only or not`);
    }
    ok((await live.serveBlog({ slug: "hidden-staged" }, api.fetchImpl, OPTS)).status === 404, `${name}: the short address of an unpublished row is a 404 as well`);
    const idx = await live.serveBlog({ lang: "en" }, api.fetchImpl, OPTS), feed = await live.serveBlog({ lang: "en", rest: "feed.xml" }, api.fetchImpl, OPTS);
    ok(idx.status === 200 && feed.status === 200 && !idx.body.includes("HIDDEN") && !feed.body.includes("HIDDEN") && !idx.body.includes("hidden-") && !feed.body.includes("hidden-"), `${name}: the en index and feed do not list one`);
    const page = await live.serveBlog({ lang: "en", rest: "story-lone.html" }, api.fetchImpl, OPTS);
    ok(page.status === 200 && relSlugs(page.body).length === 5 && !page.body.includes("HIDDEN") && !page.body.includes("hidden-"), `${name}: no related box lists one`);
    const pair = await live.serveBlog({ lang: "en", rest: "pair-slug.html" }, api.fetchImpl, OPTS);
    ok(pair.status === 200 && !pair.body.includes('hreflang="th"') && !pair.body.includes("HIDDEN"), `${name}: the unpublished th sibling of a published article is not an hreflang alternate`);
    const th = await live.serveBlog({ lang: "th", rest: "pair-slug.html" }, api.fetchImpl, OPTS);
    ok(th.status === 404, `${name}: the unpublished th page itself is a 404`);
    const smEn = await live.serveBlogSitemap(api.fetchImpl, OPTS, "en"), smTh = await live.serveBlogSitemap(api.fetchImpl, OPTS, "th"), smJa = await live.serveBlogSitemap(api.fetchImpl, OPTS, "ja");
    ok(smEn.status === 200 && smTh.status === 200 && smJa.status === 200 && ![smEn.body, smTh.body, smJa.body].some(b => b.includes("hidden-") || b.includes("HIDDEN")) && !smTh.body.includes("/blog/th/pair-slug.html") && smEn.body.includes("/blog/en/pair-slug.html") && smEn.body.includes("/blog/en/en-1.html") && smEn.body.includes("/blog/en/clone-live.html") && smEn.body.includes("/blog/en/news-live.html") && smJa.body.includes("/blog/ja/ja-0-ja.html"), `${name}: the language files name the published rows (the static ones and the live-only ones alike) and none of the unpublished`);
  }
}

heading("baseline: the live function before this change, on rows that are not live-only");
if (!haveBase) {
  if (process.env.BLOG_BASELINE_REQUIRED) ok(false, `the baseline commit ${BASELINE_REF} is not in this checkout (BLOG_BASELINE_REQUIRED is set)`); else skip(`commit ${BASELINE_REF} is not in this checkout: the old live function was not compared`);
} else {
  const oldLive = await import(pathToFileURL(path.join(baseRoot, "scripts/blog-live.mjs")).href), oldPaths = await import(pathToFileURL(path.join(baseRoot, "scripts/blog-paths.mjs")).href);
  const publishedDb = DB.filter(r => r.published), differ = [];
  const DB0 = DB.map(r => ({ ...r, live_only: false }));   // the same table with no row flagged: what the old function knew
  let compared = 0;
  const same = async (what, query) => {
    const a = await oldLive.serveBlog(query, makeApi(DB).fetchImpl, OPTS), b = await live.serveBlog(query, makeApi(DB).fetchImpl, OPTS);
    compared++;
    if (a.status !== b.status || a.body !== b.body || JSON.stringify(a.headers) !== JSON.stringify(b.headers)) differ.push(what);
  };
  for (const r of publishedDb) await same(`${r.lang}/${r.slug}`, { lang: r.lang, rest: r.slug + ".html" });
  await same("en index", { lang: "en" }); await same("en index page 2", { lang: "en", page: "2" }); await same("ja index", { lang: "ja" }); await same("en feed", { lang: "en", rest: "feed.xml" }); await same("th index (one hidden row only)", { lang: "th" });
  ok(compared === publishedDb.length + 5 && differ.length === 0, `${compared} answers (every published article page with its related box, the en / ja / th lists, the en feed) are byte-identical to the old live function's` + (differ.length ? ": " + differ.slice(0, 6).join(", ") + MOVE : ""));
  // the sitemap is the one thing that changed on purpose: the ten files together name the very addresses (articles AND the ten language index addresses) the old single file named, each once
  const oldAll = await oldLive.serveBlogSitemap(makeApi(DB).fetchImpl, OPTS);
  const locsOf = (body) => [...parseXml(body).getElementsByTagName("loc")].map(e => e.textContent);
  const newFiles = []; for (const l of paths.BLOG_LANGS) newFiles.push(await live.serveBlogSitemap(makeApi(DB).fetchImpl, OPTS, l));
  const oldLocs = locsOf(oldAll.body), newLocs = newFiles.flatMap(f => locsOf(f.body));
  ok(oldLocs.filter(u => u.endsWith(".html")).length > 40 && new Set(newLocs).size === newLocs.length && newLocs.length === oldLocs.length && oldLocs.every(u => newLocs.includes(u)), `with live-only rows in the table (${DB.filter(r => r.published && r.live_only).length} of ${publishedDb.length}) the ten files together name exactly the ${oldLocs.length} addresses the old single file named (articles and language index addresses), each once; the alternates of the old entries are what is left out (the pages carry them)`);
  ok(oldAll.body.includes("xhtml:link") && !newFiles.some(f => f.body.includes("xhtml:link")), "control: the old entries did carry xhtml:link alternates, the new ones do not (a file that reads one language cannot name the others, and the page's own <link rel=alternate hreflang> says it all)");
}

heading("live function: the two Vercel entry points");
{
  const realFetch = globalThis.fetch;
  const api = makeApi(DB);
  globalThis.fetch = api.fetchImpl;
  try {
    const mockRes = () => { const r = { statusCode: 0, headers: {}, body: null, setHeader(k, v) { r.headers[String(k).toLowerCase()] = v; }, end(b) { r.body = b; } }; return r; };
    const page = (await import(pathToFileURL(path.join(ROOT, "api/blog-page.js")).href)).default, map = (await import(pathToFileURL(path.join(ROOT, "api/blog-sitemap.js")).href)).default;
    const r1 = mockRes(); await page({ query: { lang: "en", rest: "clone-live.html" } }, r1);
    ok(r1.statusCode === 200 && r1.body.includes("<h1>Clone article</h1>") && r1.headers["x-blog-source"] === "live", "api/blog-page.js serves a live-only article");
    const r2 = mockRes(); await map({}, r2);
    ok(r2.statusCode === 200 && r2.body.includes("<sitemapindex") && r2.body.includes("/sitemap-blog-en.xml") && !r2.body.includes("/blog/en/en-1.html") && r2.headers["content-type"].startsWith("application/xml"), "api/blog-sitemap.js with no language answers the index of the ten files");
    const r3 = mockRes(); await map({ query: { lang: "en" } }, r3);
    ok(r3.statusCode === 200 && r3.body.includes("/blog/en/clone-live.html") && r3.body.includes("/blog/en/en-1.html") && !r3.body.includes("/blog/ja/ja-0-ja.html") && r3.headers["content-type"].startsWith("application/xml"), "api/blog-sitemap.js?lang=en lists the static rows and the live-only one of that language, and no other language");
  } finally { globalThis.fetch = realFetch; }
}

/* ── 3. timing (opt in) ── */
if (process.env.PERF) {
  heading("timing: 3,500 static + 12,000 live-only synthetic rows");
  const perfRows = (nStatic, nLive) => {
    const st = [], lvr = [], L3 = ["th", "en", "zh"], LL = ["ja", "ko", "ru", "hi", "es", "fr", "ar", "th", "en", "zh"];
    for (let i = 0; i < nStatic; i++) { const lang = L3[i % 3], k = Math.floor(i / 3); st.push(mk(lang, `perf-static-${k}${lang === "zh" ? "-zh" : ""}`, { category: CATS[k % 5], created_at: day(k % 60), updated_at: day(k % 60), body: bodyOf("perf" + k, 25) })); }
    for (let i = 0; i < nLive; i++) { const lang = LL[i % 10]; lvr.push(mk(lang, `lvo-perf-${i}-${lang}`, { live_only: true, category: CATS[i % 5], created_at: day(70 + (i % 60)), updated_at: day(70 + (i % 60)), body: bodyOf("perf" + i, 25) })); }
    return { st, all: st.concat(lvr) };
  };
  const { st, all } = perfRows(3500, 12000);
  // wall time AND the CPU time of the generator process (user + system, read by a tiny wrapper at exit): on a shared machine the wall time moves with the load, the CPU time much less
  const WRAP = path.join(tmp, "cpu-wrap.mjs");
  fs.writeFileSync(WRAP, `import { pathToFileURL } from "node:url"; const s = process.argv[2]; process.argv[1] = s; process.on("exit", () => { const u = process.cpuUsage(); process.stderr.write("CPUMS " + Math.round((u.user + u.system) / 1000) + "\\n"); }); await import(pathToFileURL(s).href);`);
  const time = (script, rows, name) => {
    const f = fx("perf-" + name, rows), out = path.join(tmp, "perf-out-" + name), t0 = performance.now();
    const r = spawnSync(process.execPath, [WRAP, script], { env: { ...process.env, SITE_URL: SITE, BLOG_FIXTURE: f, BLOG_OUT: out, BLOG_SRC: path.join(tmp, "no-blog-src") }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const ms = performance.now() - t0;
    if (r.status !== 0) throw new Error("generator failed: " + r.stderr);
    return { ms, cpu: Number((/CPUMS (\d+)/.exec(r.stderr) || [0, 0])[1]), out, files: listFiles(out), log: r.stdout };
  };
  const bytes = (r) => r.files.reduce((n, f) => n + fs.statSync(path.join(r.out, f)).size, 0);
  const fmt = (r) => `${(r.ms / 1000).toFixed(1)} s, ${r.files.length} files, ${(bytes(r) / 1e6).toFixed(0)} MB`;
  // three rounds, the three configurations interleaved (the first round also warms the disk cache); the median of the three is what is reported
  const REPS = 3, runs = { newStatic: [], newAll: [], oldStatic: [] };
  for (let i = 0; i < REPS; i++) {
    runs.newStatic.push(time(CUR_SCRIPT, st, "new-static"));
    if (haveBase) runs.oldStatic.push(time(BASE_SCRIPT, st, "old-static"));
    runs.newAll.push(time(CUR_SCRIPT, all, "new-all"));
  }
  const med = (list) => list.slice().sort((a, b) => a.cpu - b.cpu)[Math.floor(list.length / 2)];
  const newStatic = med(runs.newStatic), newAll = med(runs.newAll), oldStatic = haveBase ? med(runs.oldStatic) : null;
  const secs = (list) => list.map(r => (r.cpu / 1000).toFixed(1) + "|" + (r.ms / 1000).toFixed(1)).join("  ");
  const one = (r) => `${(r.cpu / 1000).toFixed(1)} s cpu / ${(r.ms / 1000).toFixed(1)} s wall`;
  console.log(`    new generator, 3,500 static rows only                              median ${one(newStatic)} (cpu|wall per run: ${secs(runs.newStatic)}), ${newStatic.files.length} files, ${(bytes(newStatic) / 1e6).toFixed(0)} MB`);
  console.log(`    new generator, 3,500 static + 12,000 live-only                     median ${one(newAll)} (cpu|wall per run: ${secs(runs.newAll)}), ${newAll.files.length} files, ${(bytes(newAll) / 1e6).toFixed(0)} MB`);
  if (oldStatic) console.log(`    old generator, 3,500 static rows only                              median ${one(oldStatic)} (cpu|wall per run: ${secs(runs.oldStatic)}), ${oldStatic.files.length} files, ${(bytes(oldStatic) / 1e6).toFixed(0)} MB`);
  let oldAll = null;
  if (haveBase && process.env.PERF === "full") { oldAll = time(BASE_SCRIPT, all, "old-all"); console.log(`    old generator, all 15,500 rows (what the build would have written) ${one(oldAll)}, ${oldAll.files.length} files, ${(bytes(oldAll) / 1e6).toFixed(0)} MB`); }
  ok(newAll.files.length === newStatic.files.length && diffTrees(newAll.out, newStatic.out).length === 0, `the 12,000 live-only rows write no extra file: ${newAll.files.length} files with them, ${newStatic.files.length} without, byte-identical`);
  ok(newAll.log.includes("12000 live-only rows served from the database (no static file)"), "the build log names the 12,000");
  if (oldStatic) ok(oldStatic.files.length === newStatic.files.length && diffTrees(oldStatic.out, newStatic.out).length === 0, "the static part is byte-identical to the old generator's output");
  if (oldStatic) ok(newStatic.cpu <= oldStatic.cpu * 1.5 + 500, `the static part is not slower than before (median CPU ${(newStatic.cpu / 1000).toFixed(1)} s now, ${(oldStatic.cpu / 1000).toFixed(1)} s before; with the 12,000 flagged rows in the input: ${(newAll.cpu / 1000).toFixed(1)} s)`);
  if (oldAll) ok(oldAll.files.length >= 15500 && bytes(oldAll) > 3 * bytes(newAll), `control: the old generator writes ${oldAll.files.length} files, ${(bytes(oldAll) / 1e6).toFixed(0)} MB, for the same input`);
}

ok(mtimes() === repoBefore, "no committed file (sitemap.xml, blog/sitemap-static.xml, api/blog-live-catalog.json) was written");
if (!process.env.KEEP) fs.rmSync(tmp, { recursive: true, force: true }); else console.log("kept: " + tmp);
console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
process.exit(fail ? 1 : 0);
