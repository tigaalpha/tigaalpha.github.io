#!/usr/bin/env node
/* smoke-blog-liveonly.mjs — rows flagged live_only (supabase-blog-translation-queue-migration.sql, owner 2026-11-17: ~11,000 translated articles) are served LIVE from the database and get no static file anywhere.
   No network, no browser, no repo file touched: the generator is run through its BLOG_FIXTURE / BLOG_OUT door (and, for sitemap.xml and the live catalog, in a throw-away copy of the repo root), the live function with a fake fetch.
     node scripts/smoke-blog-liveonly.mjs          (PERF=1 adds the timing run: 3,500 static + 12,000 live-only synthetic rows; PERF=full also runs the old generator on all of them)
   What it proves
     generator   adding live_only rows to the input adds no file and changes no byte (article pages, indexes, feeds and pagination of the source-file languages, blog/sitemap-static.xml, sitemap.xml, hreflang sets, related lists,
                 the live catalog); a row with the flag absent / false / null is still a static page; a blog-src file shadowed by a live-only row is not written and not in the catalog; the log line says how many were left out.
     baseline    the static rows' files are byte-identical to what the generator at BASELINE_REF (the commit before this change, read with `git show`) writes for the same rows, and that old generator DOES write the live-only
                 files (so the fixture can see the problem). Needs that commit in the object store; without it this part is skipped and says so (BLOG_BASELINE_REQUIRED=1 makes that a failure). When the page output changes
                 on purpose later, move BASELINE_REF (env BLOG_BASELINE_REF) to the commit before that change.
     live        a live-only article is served 200 with the page structure of a static one; its related box costs one or two small queries (8 rows), never the whole language; a list is paged with Prefer: count=exact and six
                 requests at a time, with the old sequential loop as the fallback; 60,000 rows still fit the guard; the sitemap is well-formed, holds every URL and stays under the protocol limits; an unpublished row (live-only or
                 not) is never served, even when the API wrongly returns it. */
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process"; import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.tigaalpha.com";
const BASELINE_REF = process.env.BLOG_BASELINE_REF || "0269a178d";
let pass = 0, fail = 0, skipped = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const skip = (m) => { skipped++; console.log("  - skipped:", m); };
const heading = (m) => console.log("\n" + m);
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
const INDEX = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap><loc>${SITE}/sitemap-pages.xml</loc><lastmod>2026-11-10</lastmod></sitemap>\n<sitemap><loc>${SITE}/sitemap-blog.xml</loc><lastmod>2026-11-10</lastmod></sitemap>\n</sitemapindex>\n`;
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
// A fake PostgREST: honours published / lang / slug / category (eq and neq) / order / limit / offset / select, answers Content-Range like the real one ("0-499/15234" only when the call sent
// Prefer: count=exact, "0-499/*" otherwise), 206 for a partial range, and records every request. { headers: false } is the plain double of the older smokes (no headers at all).
function makeApi(rows, o = {}) {
  const sorted = rows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const log = []; let inflight = 0, maxInflight = 0;
  const op = (v) => { const m = /^(neq|eq)\.(.*)$/.exec(v || ""); return m ? { neg: m[1] === "neq", val: m[2] } : null; };
  const fetchImpl = async (url, init) => {
    const u = new URL(url), q = u.searchParams, prefer = init && init.headers && init.headers.Prefer || null;
    const entry = { url: String(url), q: Object.fromEntries(q), prefer, auth: !!(init && init.headers && init.headers.apikey) };
    log.push(entry); inflight++; maxInflight = Math.max(maxInflight, inflight);
    try {
      if (o.delayMs) await new Promise(r => setTimeout(r, o.delayMs));
      if (o.failAt != null && Number(q.get("offset") || 0) === o.failAt) return { ok: false, status: 500, json: async () => ({}) };
      let list = sorted;
      if (o.honourPublished !== false && q.get("published") === "eq.true") list = list.filter(r => r.published === true);
      for (const col of ["lang", "slug", "category"]) { const t = op(q.get(col)); if (t) list = list.filter(r => (r[col] === t.val) !== t.neg); }
      const total = list.length, off = Number(q.get("offset") || 0), lim = q.get("limit") ? Number(q.get("limit")) : total;
      const sel = q.get("select"), cols = sel && sel !== "*" ? sel.split(",") : null;
      const data = list.slice(off, off + lim).map(r => cols ? Object.fromEntries(cols.map(c => [c, r[c]])) : { ...r });
      entry.rows = data.length;
      const cr = `${data.length ? `${off}-${off + data.length - 1}` : "*"}/${prefer === "count=exact" ? total : "*"}`;
      const res = { ok: true, status: data.length < total ? 206 : 200, json: async () => data };
      if (o.headers !== false) res.headers = { get: (n) => (String(n).toLowerCase() === "content-range" ? (o.noRange ? null : cr) : null) };
      return res;
    } finally { inflight--; }
  };
  return { fetchImpl, log, maxInflight: () => maxInflight };
}
const OPTS = { catalog: [] };
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
}

heading("live function: lists are paged with Prefer: count=exact, six at a time");
const bigRows = (n, startLive = 0) => { const rows = []; for (let i = 0; i < n; i++) { const lang = paths.BLOG_LANGS[i % 10]; const d = new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(); rows.push({ id: uid(), lang, slug: `x${i}-${lang}`, title: `T${i}`, excerpt: "e", category: CATS[i % 5], published: true, live_only: i >= startLive, created_at: d, updated_at: d }); } return rows; };
{
  const rows = bigRows(20000, 8000);
  const api = makeApi(rows, { delayMs: 4 });
  const t0 = Date.now();
  const out = await live.serveBlogSitemap(api.fetchImpl, OPTS);
  const ms = Date.now() - t0;
  const offs = api.log.map(e => Number(e.q.offset)).sort((a, b) => a - b);
  ok(out.status === 200 && api.log.length === 40 && offs.every((o, i) => o === i * 500), `20,000 rows are read in 40 requests, one per page of 500, each offset once (${api.log.length} requests, ${ms} ms)`);
  ok(api.maxInflight() > 1 && api.maxInflight() <= 6, `the pages are fetched together, never more than six at a time (at most ${api.maxInflight()} in flight)`);
  ok(api.log[0].prefer === "count=exact" && api.log[0].q.offset === "0" && api.log.slice(1).every(e => e.prefer === null) && api.log.every(e => e.auth), "only the first request asks for the total (Prefer: count=exact); every request carries the API key");
  const doc = parseXml(out.body);
  ok(doc.getElementsByTagName("parsererror").length === 0 && doc.documentElement.nodeName === "urlset", "the sitemap is well-formed XML (parsed strictly)");
  const locs = new Set([...doc.getElementsByTagName("loc")].map(e => e.textContent));
  const want = new Set(rows.map(r => `${live.BLOG_SITE}/blog/${r.lang}/${r.slug}.html`).concat(paths.BLOG_LANGS.map(l => `${live.BLOG_SITE}/blog/${l}/`)));
  ok(locs.size === want.size && locs.size === 20010 && [...want].every(u => locs.has(u)), "it holds every article URL (20,000) and the ten language index URLs, each once");
  ok(doc.getElementsByTagName("url").length === 20010 && !out.headers["x-blog-sitemap-dropped"] && out.headers["content-type"].startsWith("application/xml") && Buffer.byteLength(out.body) < paths.SITEMAP_MAX_BYTES, `20,010 <url> entries, ${(Buffer.byteLength(out.body) / 1e6).toFixed(1)} MB, nothing left out`);
  // the fallback: a double with no headers at all (the older smokes) is read the old way, page after page, to the same result
  const plain = makeApi(rows, { headers: false });
  const outPlain = await live.serveBlogSitemap(plain.fetchImpl, OPTS);
  ok(outPlain.status === 200 && outPlain.body === out.body && plain.log.length === 41 && plain.maxInflight() === 1, `with no Content-Range total the pages are read one after the other (41 requests, the last one empty) and the sitemap is byte-identical (${plain.log.length} requests, at most ${plain.maxInflight()} in flight)`);
  const noTotal = makeApi(rows, { noRange: true });
  ok((await live.serveBlogSitemap(noTotal.fetchImpl, OPTS)).body === out.body && noTotal.maxInflight() === 1, "headers without a Content-Range (or with 0-499/*) take the same sequential road");
}
{
  const rows = bigRows(60000);
  const par = makeApi(rows), seq1 = makeApi(rows, { headers: false });
  const a = await live.fetchPublishedMeta(par.fetchImpl), b = await live.fetchPublishedMeta(seq1.fetchImpl);
  ok(a.length === 60000 && b.length === 60000 && par.log.length === 120 && seq1.log.length === 121, `60,000 rows still fit the guard, in parallel (${par.log.length} requests) and sequentially (${seq1.log.length})`);
  ok(a.every((r, i) => r.slug === b[i].slug) && new Set(a.map(r => r.lang + "/" + r.slug)).size === 60000, "...with every row once, in the same order both ways");
  const lang = await live.fetchLangRows("en", makeApi(rows).fetchImpl);
  ok(lang.length === 6000 && lang.every(r => r.lang === "en" && "title" in r && "excerpt" in r && "category" in r), "fetchLangRows pages one language the same way (6,000 en rows; title, excerpt and category selected)");
}
{
  const rows = bigRows(20000);
  const api = makeApi(rows, { delayMs: 3, failAt: 1500 });
  const out = await live.serveBlogSitemap(api.fetchImpl, OPTS);
  ok(out.status === 503 && out.body === "" && api.log.length < 20, `a failing page makes the sitemap a 503 (not half a file) and stops new requests (${api.log.length} sent of 40)`);
  const idx = await live.serveBlog({ lang: "ja" }, makeApi(rows, { failAt: 1000 }).fetchImpl, OPTS);
  ok(idx.status === 503, "a failing page of a language list is a 503 as before");
}

heading("sitemap: the 50,000-url / 50 MB limit of one file");
{
  const rows = bigRows(500);
  const api = makeApi(rows);
  const warned = []; const warn = console.warn; console.warn = (...a) => warned.push(a.join(" "));
  let out; try { out = await live.serveBlogSitemap(api.fetchImpl, { catalog: [], sitemapLimits: { maxUrls: 210 } }); } finally { console.warn = warn; }
  const doc = parseXml(out.body);
  const locs = [...doc.getElementsByTagName("loc")].map(e => e.textContent);
  const articleLocs = locs.filter(u => u.endsWith(".html"));
  ok(out.status === 200 && doc.getElementsByTagName("parsererror").length === 0 && locs.length === 210 && articleLocs.length === 200, "past the url limit the file stops at it: 200 article urls + the 10 language index urls");
  ok(out.headers["x-blog-sitemap-dropped"] === "300" && warned.length === 1 && /300 of 500/.test(warned[0]), "...the answer carries x-blog-sitemap-dropped and the function log says how many were left out");
  const newest = rows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200).map(r => `${live.BLOG_SITE}/blog/${r.lang}/${r.slug}.html`);
  ok(newest.every(u => articleLocs.includes(u)), "...and what is kept is the newest 200");
  ok(paths.BLOG_LANGS.every(l => locs.includes(`${live.BLOG_SITE}/blog/${l}/`)), "...the language index urls are always kept");
  const byBytes = paths.sitemapBlogBuild(rows, SITE, { maxBytes: 60000 });
  ok(byBytes.dropped > 0 && Buffer.byteLength(byBytes.xml) <= 60000 && byBytes.kept + byBytes.dropped === 500, `the byte limit works the same way (${byBytes.kept} kept, ${byBytes.dropped} left out, ${Buffer.byteLength(byBytes.xml)} of 60,000 bytes)`);
  const grouped = [{ slug: "g1", lang: "en", published: true, created_at: day(2) }, { slug: "g1", lang: "th", published: true, created_at: day(2) }, { slug: "g2", lang: "en", published: true, created_at: day(1) }, { slug: "g2", lang: "th", published: true, created_at: day(1) }];
  const g = paths.sitemapBlogBuild(grouped, SITE, { maxUrls: 4 + 2 });   // two index urls (en, th) + room for 4
  const g2 = paths.sitemapBlogBuild(grouped, SITE, { maxUrls: 3 + 2 });
  ok(g.kept === 4 && g2.kept === 2 && g2.xml.includes("/blog/en/g1.html") && g2.xml.includes("/blog/th/g1.html") && !g2.xml.includes("g2.html"), "a slug is kept whole (all its languages) or left out whole");
  const small = [{ slug: "a-zh", lang: "zh", published: true, updated_at: "2026-11-08" }];
  ok(paths.sitemapBlogXml(small, SITE) === paths.sitemapBlogBuild(small, SITE).xml && paths.sitemapBlogXml(small, SITE).includes("/blog/zh/a-zh.html") && paths.SITEMAP_MAX_URLS <= 45000 && paths.SITEMAP_MAX_BYTES <= 45000000, "sitemapBlogXml keeps its signature; the defaults are 45,000 urls and 45,000,000 bytes, under the protocol's 50,000 and 50 MB");
}

heading("live function: an unpublished row is never served");
{
  const strict = makeApi(DB), careless = makeApi(DB, { honourPublished: false });
  const ctl = await live.fetchPublishedMeta(careless.fetchImpl), ctl2 = await live.fetchRelated("en", "story", "story-lone", careless.fetchImpl);
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
    const sm = await live.serveBlogSitemap(api.fetchImpl, OPTS);
    ok(sm.status === 200 && !sm.body.includes("hidden-") && !sm.body.includes("/blog/th/pair-slug.html") && sm.body.includes("/blog/en/clone-live.html") && sm.body.includes("/blog/en/pair-slug.html"), `${name}: the sitemap names the published rows (live-only ones too) and none of the unpublished`);
  }
}

heading("baseline: the live function before this change, on rows that are not live-only");
if (!haveBase) {
  if (process.env.BLOG_BASELINE_REQUIRED) ok(false, `the baseline commit ${BASELINE_REF} is not in this checkout (BLOG_BASELINE_REQUIRED is set)`); else skip(`commit ${BASELINE_REF} is not in this checkout: the old live function was not compared`);
} else {
  const oldLive = await import(pathToFileURL(path.join(baseRoot, "scripts/blog-live.mjs")).href), oldPaths = await import(pathToFileURL(path.join(baseRoot, "scripts/blog-paths.mjs")).href);
  const publishedDb = DB.filter(r => r.published), differ = [];
  let compared = 0;
  const same = async (what, query, fn = "serveBlog") => {
    const a = fn === "serveBlog" ? await oldLive.serveBlog(query, makeApi(DB).fetchImpl, OPTS) : await oldLive.serveBlogSitemap(makeApi(DB).fetchImpl, OPTS);
    const b = fn === "serveBlog" ? await live.serveBlog(query, makeApi(DB).fetchImpl, OPTS) : await live.serveBlogSitemap(makeApi(DB).fetchImpl, OPTS);
    compared++;
    if (a.status !== b.status || a.body !== b.body || JSON.stringify(a.headers) !== JSON.stringify(b.headers)) differ.push(what);
  };
  for (const r of publishedDb) await same(`${r.lang}/${r.slug}`, { lang: r.lang, rest: r.slug + ".html" });
  await same("en index", { lang: "en" }); await same("en index page 2", { lang: "en", page: "2" }); await same("ja index", { lang: "ja" }); await same("en feed", { lang: "en", rest: "feed.xml" }); await same("th index (one hidden row only)", { lang: "th" });
  await same("sitemap", null, "sitemap");
  ok(compared === publishedDb.length + 6 && differ.length === 0, `${compared} answers (every published article page with its related box, the en / ja / th lists, the en feed, the sitemap) are byte-identical to the old live function's` + (differ.length ? ": " + differ.slice(0, 6).join(", ") + MOVE : ""));
  const bag = [{ slug: "a-zh", lang: "zh", published: true, updated_at: "2026-11-08" }, { slug: "b", lang: "en", published: true, created_at: "2026-01-02T00:00:00Z" }, { slug: "b", lang: "th", published: true, created_at: "2026-01-03T00:00:00Z" }, { slug: "Bad_Slug", lang: "en", published: true }, { slug: "c", lang: "xx", published: true }, { slug: "d", lang: "ja", published: false }, { slug: "e", lang: "ko", published: true }, null, { slug: "f", lang: "ar", published: true, updated_at: "garbage" }];
  ok(oldPaths.sitemapBlogXml(bag, SITE) === paths.sitemapBlogXml(bag, SITE) && oldPaths.sitemapBlogXml([], SITE) === paths.sitemapBlogXml([], SITE) && oldPaths.sitemapBlogXml(bigRows(3000), SITE) === paths.sitemapBlogXml(bigRows(3000), SITE), "sitemapBlogXml is byte-identical to the old one: odd rows, an empty list and 3,000 rows");
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
    ok(r2.statusCode === 200 && r2.body.includes("/blog/en/clone-live.html") && r2.headers["content-type"].startsWith("application/xml"), "api/blog-sitemap.js lists it");
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
