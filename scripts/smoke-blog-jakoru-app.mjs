#!/usr/bin/env node
/* smoke-blog-jakoru-app.mjs — the IN-APP blog (BlogPage.tsx) and its admin screens in ten languages (owner 2026-11-11: Japanese, Korean and Russian next to Thai, English and Mandarin;
   owner 2026-11-13: Hindi, Spanish, French and Arabic, Arabic being right-to-left). The real components are bundled with esbuild (supabase-client stubbed) and rendered in jsdom with React 18; no network.
   What it covers: the helpers (viewsText, fmtDate, minsText, catName, readMins) for all ten languages; the one-flag menu with ten languages; the committed articles of ja ko ru hi es fr ar (blog-data/<lang>.ts,
   generated from blog-src/ by scripts/build-blog-static-data.mjs) shown straight away while the database has nothing; a database row winning over a committed article of the same slug; no view / read call for a
   committed article; a failing database leaving the committed articles; Arabic: dir / lang on the list and on an open article, the menu and the Back arrow keeping the app's direction; the generator itself
   (fixtures, --check); the admin language lists and the migration hint. Run by scripts/smoke-blog-jakoru.mjs, or alone:
     node scripts/smoke-blog-jakoru-app.mjs */
import { build } from "esbuild"; import { JSDOM } from "jsdom"; import { pathToFileURL } from "node:url"; import path from "node:path"; import os from "node:os"; import fs from "node:fs"; import vm from "node:vm"; import { spawnSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bja-"));
const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "https://x.test/", pretendToBeVisual: true });
for (const k of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent"]) { try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch (e) {} }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__posts = []; globalThis.__calls = []; globalThis.__eqs = []; globalThis.__dbError = false; globalThis.__writes = []; globalThis.__writeError = null; globalThis.__stats = null;
// the in-app article counts a "read" after 5 seconds: shorten exactly that timer so the test can see it (and see that a committed article never sends one)
const realSetTimeout = globalThis.setTimeout; globalThis.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms === 5000 ? 40 : ms, ...a);
const stub = `
export const sb = {
  from(table) { const q = { select() { return q; }, eq(c, v) { globalThis.__eqs.push([c, v]); return q; }, order() { return q; }, limit() { return q; },
      then(a, b) { return Promise.resolve(globalThis.__dbError ? { data: null, error: { message: "boom" } } : { data: globalThis.__posts, error: null }).then(a, b); } };
    q.insert = (row) => { globalThis.__writes.push({ table, op: "insert", row }); return Promise.resolve({ error: globalThis.__writeError }); };
    q.update = (row) => { globalThis.__writes.push({ table, op: "update", row }); const r = { eq() { return Promise.resolve({ error: globalThis.__writeError }); } }; return r; };
    return q; },
  auth: { getUser() { return Promise.resolve({ data: { user: { id: "u1" } } }); } },
  rpc(name, args) { globalThis.__calls.push({ name, ...args });
    if (name === "blog_view_counts") return Promise.resolve({ data: [{ slug: "piano-posture", views: 1500 }], error: null });
    if (name === "blog_hit") return Promise.resolve({ data: 1234, error: null });
    if (name === "blog_stats") return Promise.resolve({ data: globalThis.__stats, error: null });
    return Promise.resolve({ data: null, error: null }); }
};`;
const entry = `export { BlogPage, BlogBody, viewsText, fmtDate, minsText, catLabel, catName, readMins, mergeRows, BLOG_CATS } from "./BlogPage"; export { AdminBlog } from "./AdminBlog"; export { BlogStatsCard } from "./AdminBlogStats";
export { ALL_LANGS, LANG_META, isRtl, dirOf } from "./lang-extra";
export { default as ja } from "./blog-data/ja"; export { default as ko } from "./blog-data/ko"; export { default as ru } from "./blog-data/ru"; export { default as hi } from "./blog-data/hi"; export { default as es } from "./blog-data/es"; export { default as fr } from "./blog-data/fr"; export { default as ar } from "./blog-data/ar";
export { createRoot } from "react-dom/client"; export { createElement as h } from "react"; export { act } from "react";`;
// emptyStatic: every blog-data/<lang> file is replaced by an empty array (what a language with an empty blog-src folder would ship)
const plugins = (emptyStatic) => [{ name: "stub", setup(b) {
  b.onResolve({ filter: /supabase-client$/ }, () => ({ path: "sb-stub", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: stub, loader: "js" }));
  if (emptyStatic) { b.onResolve({ filter: /blog-data\/(ja|ko|ru|hi|es|fr|ar)$/ }, (a) => ({ path: a.path, namespace: "emptydata" })); b.onLoad({ filter: /.*/, namespace: "emptydata" }, () => ({ contents: "export default [];", loader: "js" })); }
} }];
const bundle = async (name, emptyStatic) => { const out = path.join(dir, name + ".mjs"); await build({ stdin: { contents: entry, resolveDir: ROOT, loader: "ts" }, outfile: out, bundle: true, format: "esm", platform: "node", logLevel: "silent", jsx: "automatic", plugins: plugins(emptyStatic) }); return import(pathToFileURL(out).href); };
const M = await bundle("t", false);
const E = await bundle("t-empty", true);   // the same components with no committed articles
let fail = 0, n = 0; const ok = (name, c, d = "") => { n++; console.log((c ? "PASS " : "FAIL ") + name + (d ? " — " + d : "")); if (!c) fail++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const live = [];
async function mount(el, X = M) { const host = document.createElement("div"); document.body.appendChild(host); const root = X.createRoot(host); live.push({ root, host, X }); await X.act(async () => { root.render(el); }); await X.act(async () => { await sleep(60); }); return { host, root }; }
// unmount everything of the section before: a pending timer of an article opened earlier must not send its call into the next section
async function reset() { for (const l of live.splice(0)) { await l.X.act(async () => { l.root.unmount(); }); l.host.remove(); } globalThis.__calls.length = 0; globalThis.__eqs.length = 0; globalThis.__writes.length = 0; globalThis.__dbError = false; globalThis.__writeError = null; globalThis.__posts = []; globalThis.__stats = null; }
const click = async (el, X = M, wait = 60) => { await X.act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await sleep(wait); }); };
const typeInto = async (el, v, X = M) => { await X.act(async () => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set.call(el, v); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); await sleep(10); }); };
const post = (lang, extra = {}) => ({ id: "p-" + lang, lang, slug: "piano-posture", category: "tips", title: "T-" + lang, excerpt: "x", body: "# Hi\nbody text", cover_url: null, published: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", ...extra });
const norm = (s) => String(s).replace(/[\s  ]+/g, " ").replace(/[‎‏؜]/g, "");
const cardByTitle = (host, t) => [...host.querySelectorAll("[data-blog-card]")].find(c => c.textContent.includes(t));
const LANGS = M.ALL_LANGS, EXTRA = ["ja", "ko", "ru", "hi", "es", "fr", "ar"];
const src = (lang) => fs.readdirSync(path.join(ROOT, "blog-src", lang)).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(fs.readFileSync(path.join(ROOT, "blog-src", lang, f), "utf8")));
const LS = String.fromCharCode(0x2028);   // U+2028 written as a code point: a raw one in a source file is a trap
const sh = (args, env = {}) => spawnSync("node", args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } });

console.log("wiring: the committed articles are generated files, a lazy chunk each, and the build makes them");
{
  const files = fs.readdirSync(path.join(ROOT, "blog-data")).sort();
  ok("blog-data holds exactly one file per committed language: ja ko ru hi es fr ar", JSON.stringify(files) === JSON.stringify(EXTRA.map(l => l + ".ts").sort()), files.join(" "));
  ok("every file says GENERATED - do not edit by hand", EXTRA.every(l => fs.readFileSync(path.join(ROOT, "blog-data", l + ".ts"), "utf8").startsWith("/* GENERATED - do not edit by hand")));
  const r = sh(["scripts/build-blog-static-data.mjs", "--check"]);
  ok("node scripts/build-blog-static-data.mjs --check: the files are current", r.status === 0 && /blog-data is current \(\d+ articles in 7 files\)/.test(r.stdout), (r.stdout + r.stderr).trim().split("\n").slice(-2).join(" | "));
  const page = fs.readFileSync(path.join(ROOT, "BlogPage.tsx"), "utf8");
  ok("BlogPage.tsx imports blog-data only through import() (one lazy chunk per language, never in the main bundle)", !/^\s*import[^\n]*blog-data/m.test(page) && !/\bfrom\s+["']\.\/blog-data/.test(page) && EXTRA.every(l => page.includes('import("./blog-data/' + l + '")')) && (page.match(/import\("\.\/blog-data\//g) || []).length === 7);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")), b = pkg.scripts.build;
  ok("npm run build runs the generator before vite build, and npm run verify:blogdata checks it", b.indexOf("build-blog-static-data.mjs") > -1 && b.indexOf("build-blog-static-data.mjs") < b.indexOf("vite build") && /build-blog-static-data\.mjs --check/.test(pkg.scripts["verify:blogdata"] || ""));
  // with code splitting the seven files must land in chunks of their own and the page's own chunk must not hold an article
  const sp = path.join(dir, "split"); const meta = await build({ stdin: { contents: `export { BlogPage } from "./BlogPage";`, resolveDir: ROOT, loader: "ts" }, outdir: sp, bundle: true, splitting: true, format: "esm", platform: "node", logLevel: "silent", jsx: "automatic", metafile: true, plugins: plugins(false) });
  const outs = Object.entries(meta.metafile.outputs), holder = (l) => outs.find(([, o]) => Object.keys(o.inputs).some(i => i.endsWith("blog-data/" + l + ".ts")));
  const mainOut = outs.find(([, o]) => o.entryPoint === "<stdin>"), chunkOf = EXTRA.map(holder);
  ok("code splitting: each language's file is its own chunk, none inside the page's entry chunk", chunkOf.every(c => c) && new Set(chunkOf.map(c => c[0])).size === 7 && chunkOf.every(c => c[0] !== (mainOut && mainOut[0])) && !Object.keys(mainOut[1].inputs).some(i => /blog-data\//.test(i)), chunkOf.map(c => c && path.basename(c[0])).join(" "));
}

console.log("data: blog-data/<lang>.ts is BlogPost-shaped, newest first, and equal to its blog-src files");
for (const lang of EXTRA) {
  const rows = M[lang], source = src(lang), by = Object.fromEntries(source.map(s => [s.slug, s]));
  const KEYS = ["body", "category", "cover_alt", "cover_url", "created_at", "excerpt", "id", "lang", "published", "slug", "title", "updated_at"];
  ok(lang + ": " + source.length + " articles, one per source file", Array.isArray(rows) && rows.length === source.length && source.length >= 12 && rows.every(r => by[r.slug]));
  ok(lang + ": the exact field names BlogPage reads, id static:" + lang + ":<slug>, published, cover null", rows.every(r => JSON.stringify(Object.keys(r).sort()) === JSON.stringify(KEYS) && r.id === "static:" + lang + ":" + r.slug && r.lang === lang && r.published === true && r.cover_url === null && r.cover_alt === null && r.updated_at === r.created_at));
  ok(lang + ": title, excerpt, body, category and date are the source's, byte for byte", rows.every(r => r.title === by[r.slug].title.trim() && r.excerpt === by[r.slug].excerpt.trim() && r.body === by[r.slug].body && r.category === by[r.slug].category && r.created_at === by[r.slug].created_at));
  ok(lang + ": newest first (an equal date by slug)", rows.every((r, i) => !i || Date.parse(rows[i - 1].created_at) > Date.parse(r.created_at) || (Date.parse(rows[i - 1].created_at) === Date.parse(r.created_at) && rows[i - 1].slug < r.slug)));
}
ok("the same slugs in every language (that is how translations find each other)", EXTRA.every(l => JSON.stringify(M[l].map(r => r.slug).sort()) === JSON.stringify(M.ja.map(r => r.slug).sort())));

console.log("the generator: fixtures, an empty folder, drafts, a broken file, --check");
{
  const fx = path.join(dir, "fx-src"), out = path.join(dir, "fx-out"), w = (l, f, o) => { fs.mkdirSync(path.join(fx, l), { recursive: true }); fs.writeFileSync(path.join(fx, l, f + ".json"), typeof o === "string" ? o : JSON.stringify(o)); };
  const art = (lang, slug, date, extra = {}) => ({ lang, slug, category: "tips", title: "Title " + slug, excerpt: "ex " + slug, body: "# H\nbody " + slug + " " + LS + " end", created_at: date, published: true, ...extra });
  w("ja", "older", art("ja", "older", "2026-01-02")); w("ja", "newer", art("ja", "newer", "2026-01-05")); w("ja", "same-a", art("ja", "same-a", "2026-01-02")); w("ja", "draft", art("ja", "draft", "2026-02-01", { published: false })); w("ja", "broken", "{ not json");
  w("ar", "only", art("ar", "only", "2026-03-03", { category: "story", cover_url: "https://example.com/c.png", updated_at: "2026-03-04" })); fs.mkdirSync(path.join(fx, "hi"), { recursive: true });   // hi: an empty folder, ko es fr ru: no folder
  const env = { BLOG_SRC: fx, BLOG_DATA_OUT: out };
  const r = sh(["scripts/build-blog-static-data.mjs"], env), read = (l) => fs.readFileSync(path.join(out, l + ".ts"), "utf8");
  ok("it writes a file for all seven languages, even for an empty folder and a missing one", r.status === 0 && fs.readdirSync(out).sort().join() === EXTRA.map(l => l + ".ts").sort().join(), (r.stdout + r.stderr).trim().split("\n").pop());
  ok("an empty or missing folder gives an empty array", ["hi", "ko", "es", "fr", "ru"].every(l => /const posts: BlogPost\[\] = \[\];/.test(read(l))));
  const evalTs = (l) => { const t = read(l).replace(/^import type[^\n]*\n/m, "").replace("const posts: BlogPost[] =", "const posts =").replace("export default posts;", "return posts;"); return vm.runInNewContext("(function(){" + t + "})()"); };
  const ja = evalTs("ja");
  ok("newest first, an equal date by slug; the draft and the broken file are left out", JSON.stringify(ja.map(p => p.slug)) === JSON.stringify(["newer", "older", "same-a"]) && /not valid JSON/.test(r.stderr), ja.map(p => p.slug).join());
  ok("ids static:<lang>:<slug>; a line separator inside a body survives (escaped)", ja[0].id === "static:ja:newer" && ja[0].body.includes(LS) && !read("ja").includes(LS));
  const ar = evalTs("ar")[0];
  ok("a source cover and updated_at are kept, cover_alt stays null, the category is kept", ar.cover_url === "https://example.com/c.png" && ar.cover_alt === null && ar.updated_at === "2026-03-04" && ar.category === "story" && ar.published === true);
  const chk = sh(["scripts/build-blog-static-data.mjs", "--check"], env);
  ok("--check passes on files it just wrote", chk.status === 0 && /blog-data is current/.test(chk.stdout));
  const before = EXTRA.map(l => fs.statSync(path.join(out, l + ".ts")).mtimeMs).join(), again = sh(["scripts/build-blog-static-data.mjs"], env), after = EXTRA.map(l => fs.statSync(path.join(out, l + ".ts")).mtimeMs).join();
  ok("a second run rewrites nothing (idempotent, the files keep their time stamp)", again.status === 0 && /0 written, 7 unchanged/.test(again.stdout) && before === after, again.stdout.trim().split("\n").pop());
  fs.appendFileSync(path.join(out, "ja.ts"), "// hand edit\n"); fs.rmSync(path.join(out, "fr.ts"));
  const bad = sh(["scripts/build-blog-static-data.mjs", "--check"], env);
  ok("--check exits 1 and names a hand-edited file and a missing one", bad.status === 1 && /stale: .*ja\.ts/.test(bad.stdout) && /stale: .*fr\.ts \(missing\)/.test(bad.stdout) && !fs.existsSync(path.join(out, "fr.ts")), bad.stdout.trim().split("\n").slice(-1)[0]);
  const fix = sh(["scripts/build-blog-static-data.mjs"], env);
  ok("a normal run puts both right again", fix.status === 0 && /2 written/.test(fix.stdout) && sh(["scripts/build-blog-static-data.mjs", "--check"], env).status === 0);
}

console.log("helpers: the three old languages read exactly as before");
for (const lang of ["th", "en", "zh"]) {
  const oldViews = "👁 " + (1234).toLocaleString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-US") + " " + (lang === "th" ? "ยอดวิว" : lang === "zh" ? "次浏览" : "views");
  ok(lang + ": views text is the old text (" + oldViews + ")", M.viewsText(1234, lang) === oldViews);
  const oldDate = new Date("2026-10-01T00:00:00Z").toLocaleDateString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-GB", { year: "numeric", month: "short", day: "numeric" });
  ok(lang + ": date text is the old text (" + oldDate + ")", M.fmtDate("2026-10-01T00:00:00Z", lang) === oldDate);
  const oldMin = lang === "th" ? "3 นาที" : lang === "zh" ? "3 分钟" : "3 min";
  ok(lang + ": short read time is the old text", M.minsText(3, lang) === oldMin);
  ok(lang + ": long read time is the old text", M.minsText(3, lang, true) === (lang === "th" ? "3 นาที" : lang === "zh" ? "3 分钟" : "3 min read"));
}
ok("category names th / zh / en unchanged", M.catName("theory", "th") === "🎼 ทฤษฎีดนตรี" && M.catName("theory", "zh") === "🎼 乐理" && M.catName("theory", "en") === "🎼 Music theory");

console.log("helpers: ja / ko / ru");
ok("ja views: 1,234回閲覧 (no space before the unit)", M.viewsText(1234, "ja") === "👁 1,234回閲覧", M.viewsText(1234, "ja"));
ok("ko views: 1,234회 조회", M.viewsText(1234, "ko") === "👁 1,234회 조회", M.viewsText(1234, "ko"));
ok("ru views: 1 234 просмотров (Russian grouping)", norm(M.viewsText(1234, "ru")) === "👁 1 234 просмотров", M.viewsText(1234, "ru"));
ok("ja date is Japanese", /2026年10月1日/.test(M.fmtDate("2026-10-01T00:00:00Z", "ja")), M.fmtDate("2026-10-01T00:00:00Z", "ja"));
ok("ko date is Korean", /2026년 10월 1일/.test(M.fmtDate("2026-10-01T00:00:00Z", "ko")), M.fmtDate("2026-10-01T00:00:00Z", "ko"));
ok("ru date is Russian", /2026/.test(M.fmtDate("2026-10-01T00:00:00Z", "ru")) && /окт/.test(M.fmtDate("2026-10-01T00:00:00Z", "ru")), M.fmtDate("2026-10-01T00:00:00Z", "ru"));
ok("read time in ja / ko / ru", M.minsText(3, "ja") === "3分" && M.minsText(3, "ja", true) === "3分で読めます" && M.minsText(3, "ko") === "3분" && M.minsText(3, "ru") === "3 мин" && M.minsText(3, "ru", true) === "3 мин чтения");
ok("category names in ja / ko / ru", M.catName("tips", "ja") === "💡 練習のコツ" && M.catName("songs", "ko") === "🎵 곡과 연습곡" && M.catName("story", "ru") === "✨ Истории");
const jaText = "ピアノは毎日少しずつ練習するのが大切です。".repeat(60), ruText = "Занимайтесь каждый день понемногу. ".repeat(60);
ok("reading speed: kana / hangul count as characters (450 a minute), Cyrillic as Latin", M.readMins(jaText) === Math.round(jaText.length / 450) && M.readMins("한국어 글입니다. ".repeat(100)) === Math.round(("한국어 글입니다. ".repeat(100)).length / 450) && M.readMins(ruText) === Math.max(1, Math.round(ruText.length / 1100)));

console.log("helpers: hi / es / fr / ar");
const D = "2026-10-01T00:00:00Z";
ok("hi views: 1,234 बार देखा गया", norm(M.viewsText(1234, "hi")) === "👁 1,234 बार देखा गया", M.viewsText(1234, "hi"));
ok("es views: 1234 visualizaciones (Spanish writes a four-digit number without a separator)", /^👁 1[.\s]?234 visualizaciones$/.test(norm(M.viewsText(1234, "es"))), M.viewsText(1234, "es"));
ok("fr views: 1 234 vues (French grouping)", norm(M.viewsText(1234, "fr")) === "👁 1 234 vues", M.viewsText(1234, "fr"));
ok("ar views: 1,234 مشاهدة (Latin digits, as on the static pages)", norm(M.viewsText(1234, "ar")) === "👁 1,234 مشاهدة", M.viewsText(1234, "ar"));
ok("hi date is Devanagari with the year", /2026/.test(M.fmtDate(D, "hi")) && /[ऀ-ॿ]/.test(M.fmtDate(D, "hi")), M.fmtDate(D, "hi"));
ok("es date is Spanish (1 oct 2026)", /^1 oct\.? 2026$/.test(norm(M.fmtDate(D, "es"))), M.fmtDate(D, "es"));
ok("fr date is French (1 oct. 2026)", /^1 oct\.? 2026$/.test(norm(M.fmtDate(D, "fr"))), M.fmtDate(D, "fr"));
ok("ar date is Arabic month name with Latin digits and the Gregorian year", /^1 [؀-ۿ]+ 2026$/.test(norm(M.fmtDate(D, "ar"))) && !/[٠-٩]/.test(M.fmtDate(D, "ar")), M.fmtDate(D, "ar"));
ok("read time in hi / es / fr", M.minsText(3, "hi") === "3 मिनट" && M.minsText(3, "hi", true) === "3 मिनट में पढ़ें" && M.minsText(3, "es") === "3 min" && M.minsText(3, "es", true) === "3 min de lectura" && M.minsText(3, "fr") === "3 min" && M.minsText(3, "fr", true) === "3 min de lecture");
ok("read time in ar: the noun agrees with the number (1, 2, 3-10, 11+)", M.minsText(1, "ar") === "دقيقة واحدة" && M.minsText(2, "ar") === "دقيقتان" && M.minsText(3, "ar") === "3 دقائق" && M.minsText(10, "ar") === "10 دقائق" && M.minsText(11, "ar") === "11 دقيقة" && M.minsText(5, "ar", true) === "5 دقائق للقراءة" && M.minsText(1, "ar", true) === "دقيقة واحدة للقراءة");
const hiText = "पियानो का अभ्यास हर दिन थोड़ा थोड़ा करना ज़रूरी है। ".repeat(60), arText = "التدريب على البيانو كل يوم قليلًا قليلًا مهم جدًا. ".repeat(60);
ok("reading speed: Devanagari and Arabic are space-separated scripts, read like Latin (1100 a minute)", M.readMins(hiText) === Math.max(1, Math.round(hiText.length / 1100)) && M.readMins(arText) === Math.max(1, Math.round(arText.length / 1100)) && M.readMins("") === 1);
// the category names are the words of the static pages: read CATN out of the generator and compare every language and category
{
  const gen = fs.readFileSync(path.join(ROOT, "scripts/build-blog-pages.mjs"), "utf8"), m = /const CATN = (\{[\s\S]*?\});\n/.exec(gen);
  let CATN = null; try { CATN = m ? vm.runInNewContext("(" + m[1] + ")") : null; } catch (e) {}
  ok("the generator's CATN table could be read (it is the source of the category words)", !!CATN && ["tips", "theory", "songs", "news", "story"].every(k => CATN[k]));
  ok("every category name in all ten languages is the word the static pages use", !!CATN && LANGS.every(l => M.BLOG_CATS.every(c => M.catLabel(c, l) === CATN[c.id][l])), CATN ? LANGS.flatMap(l => M.BLOG_CATS.filter(c => M.catLabel(c, l) !== CATN[c.id][l]).map(c => l + "/" + c.id)).join(" ") : "");
  ok("category names in hi / es / fr / ar", M.catName("tips", "hi") === "💡 अभ्यास के टिप्स" && M.catName("theory", "es") === "🎼 Teoría musical" && M.catName("songs", "fr") === "🎵 Morceaux et pièces" && M.catName("story", "ar") === "✨ قصص" && M.catName("news", "ar") === "📣 الأخبار والإعلانات");
}
{
  const a = { id: "1", lang: "hi", slug: "s1", title: "db", created_at: "2026-11-13T00:00:00Z" }, b = { id: "static:hi:s1", lang: "hi", slug: "s1", title: "file", created_at: "2026-11-13" }, c = { id: "static:hi:s2", lang: "hi", slug: "s2", title: "file2", created_at: "2026-11-14" }, d = { id: "static:hi:s0", lang: "hi", slug: "s0", title: "file0", created_at: "2026-11-13" };
  const r = M.mergeRows([a], [b, c, d]);
  ok("mergeRows: a database row wins over a committed one of the same language and slug, the others fill in, newest first, an equal date keeps the database row first", JSON.stringify(r.map(x => x.id)) === JSON.stringify(["static:hi:s2", "1", "static:hi:s0"]));
  ok("mergeRows: a slug of another language is not 'the same article'; no rows at all gives an empty list", M.mergeRows([{ ...a, lang: "fr" }], [b]).length === 2 && M.mergeRows([], []).length === 0 && M.mergeRows(null, null).length === 0);
}

console.log("the page: one flag button with a menu of ten languages, the language follows the app");
for (const lang of LANGS) {
  await reset();
  const { host } = await mount(M.h(M.BlogPage, { lang }));
  const flagBtn = host.querySelector("[data-blog-langbtn]");
  ok(lang + ": ONE flag button (no row of tabs), the menu starts closed", !!flagBtn && host.querySelectorAll("[data-blog-langbtn]").length === 1 && !host.querySelector("[data-blog-langmenu]") && host.querySelectorAll("[data-blog-lang]").length === 0, flagBtn && flagBtn.textContent);
  ok(lang + ": the button shows the flag of the app language and no language name", !!flagBtn && flagBtn.textContent.includes(M.LANG_META[lang].flag) && !LANGS.some(l => flagBtn.textContent.includes(M.LANG_META[l].name)), flagBtn && flagBtn.textContent);
  await click(flagBtn, M, 40);
  const opts = [...host.querySelectorAll("[data-blog-lang]")], tabs = opts.map(b => b.getAttribute("data-blog-lang") + ":" + b.textContent);
  ok(lang + ": the menu lists ten languages, each with its flag and native name", opts.length === 10 && LANGS.every(l => tabs.some(t => t.startsWith(l + ":") && t.includes(M.LANG_META[l].flag) && t.includes(M.LANG_META[l].name))), tabs.join(" | "));
  const active = opts.find(b => b.getAttribute("aria-selected") === "true");
  ok(lang + ": the menu marks the app language as the current one", !!active && active.getAttribute("data-blog-lang") === lang && opts.filter(b => b.getAttribute("aria-selected") === "true").length === 1, active && active.getAttribute("data-blog-lang"));
  const menu = host.querySelector("[data-blog-langmenu]");
  ok(lang + ": the list scrolls inside a max-height (60 vh up to 420 px), so ten rows stay reachable on a 320 x 568 phone; every row is a 48 px touch target", !!menu && menu.style.overflowY === "auto" && /min\(60vh,\s*420px\)/.test(menu.style.maxHeight) && opts.every(o => o.style.minHeight === "48px") && menu.getAttribute("role") === "listbox");
  const rtl = lang === "ar";
  ok(lang + ": the menu hangs under the button on the end side of the app's direction (" + (rtl ? "left" : "right") + ")", !!menu && (rtl ? menu.style.left === "0px" && menu.style.right === "" : menu.style.right === "0px" && menu.style.left === ""), menu && (menu.style.left + "|" + menu.style.right));
  await reset(); const again = await mount(M.h(M.BlogPage, { lang })); await click(again.host.querySelector("[data-blog-langbtn]"), M, 40);
  await M.act(async () => { dom.window.document.body.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })); await sleep(40); });
  ok(lang + ": a tap outside closes the menu", !again.host.querySelector("[data-blog-langmenu]"));
  ok(lang + ": no external link card (the owner wants the articles themselves, not another tap)", !again.host.querySelector("[data-blog-static]") && !again.host.querySelector('a[href*="tigaalpha.com/blog"]'));
}
{
  await reset();
  const { host } = await mount(M.h(M.BlogPage, { lang: "en" }));
  await click(host.querySelector("[data-blog-langbtn]"), M, 40);
  await M.act(async () => { document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(40); });
  ok("Escape closes the menu", !host.querySelector("[data-blog-langmenu]"));
  await click(host.querySelector("[data-blog-langbtn]"), M, 40); await click(host.querySelector('[data-blog-lang="ru"]'), M, 80);
  ok("en: choosing Russian in the menu closes the menu and shows the Russian list straight away (no link card)", !host.querySelector('[data-blog-static]') && !host.querySelector("[data-blog-langmenu]") && host.querySelector("[data-blog-langbtn]").textContent.includes("🇷🇺") && host.querySelectorAll("[data-blog-card]").length === M.ru.length);
}
{
  await reset();
  const { host } = await mount(M.h(M.BlogPage, { lang: "de" }));
  ok("an app language the blog does not have falls back to the English tab", /No English articles yet/.test(host.textContent) && host.querySelector("[data-blog-langbtn]").textContent.includes("🇬🇧"));
}

console.log("the committed articles: shown straight away while the database has nothing (ja ko ru hi es fr ar)");
const ALLWORD = { ja: "すべて", ko: "전체", ru: "Все", hi: "सभी", es: "Todos", fr: "Tous", ar: "الكل" };
for (const lang of EXTRA) {
  await reset(); globalThis.__posts = [];
  const { host } = await mount(M.h(M.BlogPage, { lang })), source = src(lang), cards = [...host.querySelectorAll("[data-blog-card]")];
  ok(lang + ": the database answers with no rows and the list still shows all " + source.length + " articles", cards.length === source.length && !host.querySelector("[data-blog-empty]") && !/…/.test(host.querySelector("[data-blog-list]").textContent.slice(0, 2)), cards.length + " cards");
  ok(lang + ": the cards carry the committed titles, excerpts and slugs, in the order of blog-data (newest first, an equal date by slug)", cards.every((c, i) => c.getAttribute("data-blog-slug") === M[lang][i].slug && c.textContent.includes(M[lang][i].title) && c.textContent.includes(M[lang][i].excerpt)));
  const meta = norm(cards[0].textContent);
  ok(lang + ": a card shows the category, the date and the read time in " + lang + " (no view number: the database has no row)", meta.includes(M.catName(M[lang][0].category, lang)) && meta.includes(M.fmtDate(M[lang][0].created_at, lang)) && meta.includes(M.minsText(M.readMins(M[lang][0].body), lang)) && !host.querySelector("[data-blog-views]"), meta.slice(-70));
  const chips = [...host.querySelectorAll("[data-blog-cat]")];
  ok(lang + ": the category row starts with the word for All and offers the categories the articles have", chips.length > 1 && chips[0].getAttribute("data-blog-cat") === "all" && chips[0].textContent.includes(ALLWORD[lang]) && chips.slice(1).every(c => c.textContent.includes(M.catName(c.getAttribute("data-blog-cat"), lang).slice(2))), chips.map(c => c.textContent).join(" | "));
  ok(lang + ": the database was asked for this language only (eq lang), published rows", globalThis.__eqs.some(e => e[0] === "lang" && e[1] === lang) && globalThis.__eqs.some(e => e[0] === "published" && e[1] === true) && globalThis.__calls.some(c => c.name === "blog_view_counts" && c.p_lang === lang));
  const one = chips.find(c => c.getAttribute("data-blog-cat") !== "all");
  await click(one, M, 40);
  const shownCats = [...host.querySelectorAll("[data-blog-card]")];
  ok(lang + ": a category chip filters the list", shownCats.length > 0 && shownCats.length < cards.length && shownCats.every(c => norm(c.textContent).includes(M.catName(one.getAttribute("data-blog-cat"), lang))));
}
for (const lang of ["th", "zh", "en"]) {
  await reset(); const { host } = await mount(M.h(M.BlogPage, { lang }));
  ok(lang + ": no committed articles for this language: an empty table gives its own line, no cards", host.querySelectorAll("[data-blog-card]").length === 0 && host.querySelector("[data-blog-empty]") && ({ th: /ยังไม่มีบทความภาษาไทย/, zh: /暂无中文文章/, en: /No English articles yet/ })[lang].test(host.textContent));
}
for (const lang of EXTRA) {
  await reset(); const { host } = await mount(E.h(E.BlogPage, { lang }), E);   // the same page with empty blog-data files
  const line = host.querySelector("[data-blog-empty]");
  ok(lang + ": with no committed articles and no rows, the empty line is in " + lang + " itself, whatever the app's catalog (never the English-tab line)", !!line && host.querySelectorAll("[data-blog-card]").length === 0 && !/No English articles/.test(host.textContent) && ({ ja: /この言語の記事はまだありません/, ko: /아직 이 언어로 된 글이 없어요/, ru: /Статей на этом языке пока нет/, hi: /इस भाषा में अभी कोई लेख नहीं है/, es: /Aún no hay artículos/, fr: /Pas encore d'articles/, ar: /لا توجد مقالات بهذه اللغة بعد/ })[lang].test(line.textContent), line && line.textContent);
}
{
  await reset(); globalThis.__dbError = true;
  const e1 = await mount(M.h(M.BlogPage, { lang: "hi" }));
  ok("the database fails and the language has committed articles: the list is still complete, with no error line", e1.host.querySelectorAll("[data-blog-card]").length === M.hi.length && !/लोड नहीं हो सके|Couldn't load/.test(e1.host.textContent));
  await reset(); globalThis.__dbError = true;
  const e2 = await mount(M.h(M.BlogPage, { lang: "en" }));
  ok("the database fails and the language has none (en): the error line, as before", /Couldn't load articles/.test(e2.host.textContent) && e2.host.querySelectorAll("[data-blog-card]").length === 0);
  await reset(); globalThis.__dbError = true;
  const e3 = await mount(E.h(E.BlogPage, { lang: "ar" }), E);
  ok("the database fails and the committed file is empty: the error line (in the app's language), no cards", /Couldn't load articles/.test(e3.host.textContent) && e3.host.querySelectorAll("[data-blog-card]").length === 0);
}
{
  await reset(); const { host } = await mount(M.h(M.BlogPage, { lang: "en" }));
  for (const lang of EXTRA) {
    await click(host.querySelector("[data-blog-langbtn]"), M, 40); await click(host.querySelector('[data-blog-lang="' + lang + '"]'), M, 80);
    const cards = host.querySelectorAll("[data-blog-card]");
    ok("en app: choosing " + lang + " in the menu shows its " + M[lang].length + " committed articles straight away", cards.length === M[lang].length && cards[0].getAttribute("data-blog-slug") === M[lang][0].slug && host.querySelector("[data-blog-langbtn]").textContent.includes(M.LANG_META[lang].flag));
  }
  await click(host.querySelector("[data-blog-langbtn]"), M, 40); await click(host.querySelector('[data-blog-lang="th"]'), M, 80);
  ok("en app: back to Thai, whose articles live only in the database: its empty line, no cards", host.querySelectorAll("[data-blog-card]").length === 0 && /ยังไม่มีบทความภาษาไทย/.test(host.textContent));
}

console.log("the database and the committed articles together");
{
  await reset();
  const s = M.hi[3], dbWins = post("hi", { id: "db-1", slug: s.slug, title: "DB-WINS-" + s.slug, created_at: s.created_at + "T00:00:00Z" }), dbOnly = post("hi", { id: "db-2", slug: "only-in-the-database", title: "DB-ONLY", created_at: "2026-12-01T00:00:00Z", category: "news" });
  globalThis.__posts = [dbWins, dbOnly];
  const { host } = await mount(M.h(M.BlogPage, { lang: "hi" })), cards = [...host.querySelectorAll("[data-blog-card]")], slugs = cards.map(c => c.getAttribute("data-blog-slug"));
  ok("a database row of a slug the files also have wins: its title shows, the file's does not, the slug is listed once", cards.length === M.hi.length + 1 && slugs.filter(x => x === s.slug).length === 1 && host.textContent.includes("DB-WINS-" + s.slug) && !host.textContent.includes(s.title), cards.length + " cards");
  ok("a row only the database has is added, and as the newest article it comes first; the others follow in the files' order", slugs[0] === "only-in-the-database" && cards[0].textContent.includes("DB-ONLY") && slugs.slice(1).filter(x => x !== s.slug).join() === M.hi.map(r => r.slug).filter(x => x !== s.slug).join());
  ok("the News category the database row brings is offered as a chip", !![...host.querySelectorAll("[data-blog-cat]")].find(c => c.getAttribute("data-blog-cat") === "news" && c.textContent.includes("समाचार और घोषणाएँ")));
}
{
  await reset(); globalThis.__posts = [post("th")];
  const { host } = await mount(M.h(M.BlogPage, { lang: "th" }));
  ok("th: database rows alone, as before (no committed articles are mixed in)", host.querySelectorAll("[data-blog-card]").length === 1 && /T-th/.test(host.textContent));
}
{
  await reset(); globalThis.__posts = [post("ja", { title: "T-ja-late", created_at: "2026-09-01T00:00:00Z" })];
  const { host } = await mount(M.h(M.BlogPage, { lang: "ja" })), titles = [...host.querySelectorAll("[data-blog-card]")].map(c => c.getAttribute("data-blog-slug"));
  ok("an older database-only row sorts below the newer committed articles (newest first across both)", titles.length === M.ja.length + 1 && titles[titles.length - 1] === "piano-posture", titles.join());
}

console.log("view counting: a database article counts, a committed one sends nothing");
{
  await reset();
  const { host } = await mount(M.h(M.BlogPage, { lang: "hi" }));
  const sawCounts = globalThis.__calls.some(c => c.name === "blog_view_counts" && c.p_lang === "hi");
  globalThis.__calls.length = 0;
  await click(host.querySelector("[data-blog-card]"), M, 200);
  const art = host.querySelector("[data-blog-post]");
  ok("a committed article opens, with no view number", !!art && !host.querySelector("[data-blog-views]") && art.textContent.length > 300);
  await M.act(async () => { await sleep(150); });   // longer than the shortened 5-second "read" timer
  ok("it sends no blog_hit at all, neither the view nor the read (no row for an id that starts with static:)", !globalThis.__calls.some(c => c.name === "blog_hit"), JSON.stringify(globalThis.__calls.map(c => c.name)));
  await click([...host.querySelectorAll("[data-blog-back] button")][0], M, 40);
  ok("back to the list works for a committed article", host.querySelectorAll("[data-blog-card]").length === M.hi.length && !host.querySelector("[data-blog-post]"));
  ok("the list still asks blog_view_counts for the tab's language (fails soft: no number when the function has no rows)", sawCounts);
}
{
  await reset(); globalThis.__posts = [post("es", { slug: M.es[0].slug })];
  const { host } = await mount(M.h(M.BlogPage, { lang: "es" }));
  globalThis.__calls.length = 0;
  await click(cardByTitle(host, "T-es"), M, 200); await M.act(async () => { await sleep(150); });
  const hits = globalThis.__calls.filter(c => c.name === "blog_hit");
  ok("a database article of the same language still counts: one view, then one read after the timer, with its own language and slug", hits.length === 2 && hits[0].p_kind === "view" && hits[1].p_kind === "read" && hits.every(h => h.p_lang === "es" && h.p_slug === M.es[0].slug && /^[A-Za-z0-9_-]{8,64}$/.test(h.p_vid)), JSON.stringify(hits.map(h => h.p_kind)));
  ok("and its view number shows beside the date", /1234 visualizaciones|1[.\s]234 visualizaciones/.test(norm(host.querySelector("[data-blog-post]").textContent)));
}
{
  await reset(); globalThis.__posts = [post("fr", { id: "static:fr:fake" })];
  const { host } = await mount(M.h(M.BlogPage, { lang: "fr" }));
  globalThis.__calls.length = 0;
  await click(cardByTitle(host, "T-fr"), M, 200); await M.act(async () => { await sleep(100); });
  ok("anything whose id starts with static: sends nothing, wherever it came from", !globalThis.__calls.some(c => c.name === "blog_hit"));
}

console.log("the page: rows from the database in ja / ko / ru / hi / es / fr / ar (the card is found by its title; the committed articles sit around it)");
const EXPECT = {
  ja: { cat: "練習のコツ", min: "1分", views: /1,500回閲覧/, long: "1分で読めます", openViews: /1,234回閲覧/ },
  ko: { cat: "연습 팁", min: "1분", views: /1,500회 조회/, long: "1분이면 읽어요", openViews: /1,234회 조회/ },
  ru: { cat: "Советы по занятиям", min: "1 мин", views: /1 500 просмотров/, long: "1 мин чтения", openViews: /1 234 просмотров/ },
  hi: { cat: "अभ्यास के टिप्स", min: "1 मिनट", views: /1,500 बार देखा गया/, long: "1 मिनट में पढ़ें", openViews: /1,234 बार देखा गया/ },
  es: { cat: "Consejos de práctica", min: "1 min", views: /1[.\s]?500 visualizaciones/, long: "1 min de lectura", openViews: /1[.\s]?234 visualizaciones/ },
  fr: { cat: "Conseils de pratique", min: "1 min", views: /1 500 vues/, long: "1 min de lecture", openViews: /1 234 vues/ },
  ar: { cat: "نصائح للتدريب", min: "دقيقة واحدة", views: /1,500 مشاهدة/, long: "دقيقة واحدة للقراءة", openViews: /1,234 مشاهدة/ },
};
for (const lang of EXTRA) {
  await reset(); globalThis.__posts = [post(lang)];
  const { host } = await mount(M.h(M.BlogPage, { lang })), card = cardByTitle(host, "T-" + lang), t = card ? norm(card.textContent) : "", X = EXPECT[lang];
  ok(lang + ": the article card shows title, category, read time and the view number", !!card && t.includes("T-" + lang) && t.includes(X.cat) && t.includes(X.min) && X.views.test(t), t);
  ok(lang + ": the articles are the list itself, with no link card under it", !host.querySelector("[data-blog-static]"));
  await click(card, M, 80);
  const mt = norm(host.querySelector("[data-blog-post]").textContent);
  ok(lang + ": the open article shows the long read time and its view number beside the date", mt.includes(X.long) && X.openViews.test(mt), mt.slice(0, 120));
  ok(lang + ": the language button is hidden while an article is open", !host.querySelector("[data-blog-langs]") && !host.querySelector("[data-blog-static]"));
}
{
  await reset(); globalThis.__calls.length = 0; globalThis.__posts = [post("ja")];
  await mount(M.h(M.BlogPage, { lang: "ja" }));
  ok("the view counts are asked for the tab's language (p_lang = ja)", globalThis.__calls.some(c => c.name === "blog_view_counts" && c.p_lang === "ja"));
}

console.log("Arabic is right-to-left: the list and an open article take the direction of THEIR language; the menu and the Back arrow keep the app's");
{
  await reset();
  const { host } = await mount(M.h(M.BlogPage, { lang: "ar" })), list = host.querySelector("[data-blog-list]"), langs = host.querySelector("[data-blog-langs]");
  ok("ar app, ar tab: the list is dir=rtl lang=ar, the cards align to the start", !!list && list.getAttribute("dir") === "rtl" && list.getAttribute("lang") === "ar" && [...host.querySelectorAll("[data-blog-card]")].every(c => c.style.textAlign === "start"));
  ok("ar app: the language button row and the menu are rtl too (the app itself is rtl), the label is Arabic", langs.getAttribute("dir") === "rtl" && /لغة المقال|Article language/.test(host.querySelector("[data-blog-langlbl]").textContent));
  await click(host.querySelector("[data-blog-card]"), M, 80);
  const art = host.querySelector("[data-blog-post]"), back = host.querySelector("[data-blog-back]");
  ok("ar app: the open Arabic article is dir=rtl lang=ar; the Back button follows the app: rtl, arrow points right", art.getAttribute("dir") === "rtl" && art.getAttribute("lang") === "ar" && back.getAttribute("dir") === "rtl" && back.textContent.trim().startsWith("→") && !back.textContent.includes("←") && !art.contains(back));
  ok("the Arabic article reads right-to-left: title, meta line and body sit inside the rtl article, in Arabic", /[؀-ۿ]/.test(art.querySelector("h1").textContent) && norm(art.textContent).includes(M.minsText(M.readMins(M.ar[0].body), "ar", true)) && art.querySelectorAll("ul").length > 0);
  await click(back.querySelector("button"), M, 40);
  await click(host.querySelector("[data-blog-langbtn]"), M, 40); await click(host.querySelector('[data-blog-lang="en"]'), M, 60);
  ok("ar app, then the English tab: the list is ltr lang=en (the English list is not flipped), the language row stays rtl", host.querySelector("[data-blog-list]").getAttribute("dir") === "ltr" && host.querySelector("[data-blog-list]").getAttribute("lang") === "en" && host.querySelector("[data-blog-langs]").getAttribute("dir") === "rtl");
}
{
  await reset();
  const { host } = await mount(M.h(M.BlogPage, { lang: "en" }));
  ok("en app, en tab: ltr everywhere", host.querySelector("[data-blog-list]").getAttribute("dir") === "ltr" && host.querySelector("[data-blog-langs]").getAttribute("dir") === "ltr");
  await click(host.querySelector("[data-blog-langbtn]"), M, 40); await click(host.querySelector('[data-blog-lang="ar"]'), M, 80);
  ok("en app, ar tab: the list is dir=rtl lang=ar, the language row (the app's words and the menu) stays ltr", host.querySelector("[data-blog-list]").getAttribute("dir") === "rtl" && host.querySelector("[data-blog-list]").getAttribute("lang") === "ar" && host.querySelector("[data-blog-langs]").getAttribute("dir") === "ltr" && host.querySelectorAll("[data-blog-card]").length === M.ar.length);
  await click(host.querySelector("[data-blog-langbtn]"), M, 40);
  ok("en app: the menu stays anchored on the right with the Arabic tab open", host.querySelector("[data-blog-langmenu]").style.right === "0px" && host.querySelector("[data-blog-langmenu]").style.left === "");
  await click(host.querySelector("[data-blog-langbtn]"), M, 40);
  await click(host.querySelector("[data-blog-card]"), M, 80);
  const art = host.querySelector("[data-blog-post]"), back = host.querySelector("[data-blog-back]");
  ok("en app, an Arabic article: the article is dir=rtl lang=ar, the Back button stays ltr with the arrow pointing left", art.getAttribute("dir") === "rtl" && art.getAttribute("lang") === "ar" && back.getAttribute("dir") === "ltr" && back.textContent.trim().startsWith("←") && /Back/.test(back.textContent));
  await click(back.querySelector("button"), M, 40);
  await click(host.querySelector("[data-blog-langbtn]"), M, 40); await click(host.querySelector('[data-blog-lang="fr"]'), M, 80);
  ok("en app, back to a left-to-right language (fr): the list is ltr lang=fr again", host.querySelector("[data-blog-list]").getAttribute("dir") === "ltr" && host.querySelector("[data-blog-list]").getAttribute("lang") === "fr");
  await click(host.querySelector("[data-blog-card]"), M, 80);
  ok("an open French article is ltr and lang=fr", host.querySelector("[data-blog-post]").getAttribute("dir") === "ltr" && host.querySelector("[data-blog-post]").getAttribute("lang") === "fr");
}
{
  const page = fs.readFileSync(path.join(ROOT, "BlogPage.tsx"), "utf8");
  ok("the article body's bullets use paddingInlineStart (a physical paddingLeft would put them on the wrong side in Arabic), the cards align to the start", /paddingInlineStart\s*:/.test(page) && !/paddingLeft\s*:/.test(page) && !/textAlign:\s*"left"/.test(page));
  ok("every direction in the page comes from dirOf() (the registry in lang-extra.ts), never from a hard-coded language", /dirOf\(/.test(page) && !/lang === "ar" \?[^;]*dir/.test(page) && M.isRtl("ar") && !M.isRtl("hi") && M.LANG_META.ar.rtl === true);
}

console.log("admin: ten languages in the lists and the filter, the migration hint names the right file");
{
  await reset(); globalThis.__posts = [{ ...post("ar"), id: "r1", title: "AR-ROW" }, { ...post("hi"), id: "r2", title: "HI-ROW" }, { ...post("th"), id: "r3", title: "TH-ROW" }];
  const { host } = await mount(M.h(M.AdminBlog, { lang: "en" }));
  const fl = [...host.querySelectorAll("[data-blog-filter]")];
  ok("the filter row has All and one button per language with its native name (ten)", fl.length === 11 && fl[0].getAttribute("data-blog-filter") === "all" && LANGS.every(l => fl.some(b => b.getAttribute("data-blog-filter") === l && b.textContent === M.LANG_META[l].name)), fl.map(b => b.textContent).join(" | "));
  ok("with All every row shows", host.querySelectorAll("[data-blog-row]").length === 3);
  await click(fl.find(b => b.getAttribute("data-blog-filter") === "ar"), M, 40);
  ok("the Arabic filter shows only the Arabic row", host.querySelectorAll("[data-blog-row]").length === 1 && /AR-ROW/.test(host.textContent) && !/HI-ROW/.test(host.textContent));
  await click(host.querySelector("[data-blog-new]"), M, 60);
  const set = [...host.querySelectorAll("[data-blog-setlang]")];
  ok("the editor offers the article language as ten buttons", set.length === 10 && LANGS.every(l => set.some(b => b.getAttribute("data-blog-setlang") === l && b.textContent === M.LANG_META[l].name)));
  const dirs = async (l) => { await click(host.querySelector('[data-blog-setlang="' + l + '"]'), M, 30); return ["input", "textarea"].map(t => host.querySelector(t).getAttribute("dir")).concat(host.querySelectorAll("input")[1].getAttribute("dir")).join(); };
  ok("what is typed into is right-to-left for an Arabic article only (title, summary, text)", (await dirs("ar")) === "rtl,rtl,rtl" && (await dirs("hi")) === "ltr,ltr,ltr" && (await dirs("th")) === "ltr,ltr,ltr");
  await click(host.querySelector('[data-blog-setlang="hi"]'), M, 30);
  await typeInto(host.querySelector("input"), "Hindi draft");
  globalThis.__writeError = { message: 'new row for relation "blog_posts" violates check constraint "blog_posts_lang_check"' };
  await click(host.querySelector("[data-blog-draft]"), M, 120);
  const msg1 = (host.querySelector('[role="status"]') || {}).textContent || "";
  ok("saving a Hindi draft before the migration: the hint names supabase-blog-hi-es-fr-ar-migration.sql", /supabase-blog-hi-es-fr-ar-migration\.sql/.test(msg1) && !/ja-ko-ru/.test(msg1), msg1);
  ok("the draft row went out with lang hi", globalThis.__writes.length === 1 && globalThis.__writes[0].row.lang === "hi" && globalThis.__writes[0].row.title === "Hindi draft" && globalThis.__writes[0].row.published === false);
  for (const [l, want] of [["ar", "supabase-blog-hi-es-fr-ar-migration.sql"], ["es", "supabase-blog-hi-es-fr-ar-migration.sql"], ["fr", "supabase-blog-hi-es-fr-ar-migration.sql"], ["ja", "supabase-blog-ja-ko-ru-migration.sql"], ["ru", "supabase-blog-ja-ko-ru-migration.sql"]]) {
    await click(host.querySelector('[data-blog-setlang="' + l + '"]'), M, 30); await click(host.querySelector("[data-blog-draft]"), M, 120);
    const m = (host.querySelector('[role="status"]') || {}).textContent || "";
    ok("saving a " + l + " draft before its migration names " + want, m.includes(want) && (want.includes("hi-es") ? !m.includes("ja-ko-ru") : !m.includes("hi-es-fr-ar")), m);
  }
  globalThis.__writeError = { message: "some other error" };
  await click(host.querySelector("[data-blog-draft]"), M, 120);
  ok("any other error is shown as it is", /some other error/.test((host.querySelector('[role="status"]') || {}).textContent || ""));
}
{
  await reset(); globalThis.__stats = { totals: { views: 10, readers: 5, gates: 2, clicks: 1, devices: 7 }, rows: [{ lang: "ar", slug: "a", title: "AR-STAT", views: 5, readers: 2, gates: 1, clicks: 0, total: 9 }, { lang: "es", slug: "b", title: "ES-STAT", views: 5, readers: 3, gates: 1, clicks: 1, total: 8 }], daily: [], allTime: 17 };
  const { host } = await mount(M.h(M.BlogStatsCard, { lang: "en", range: "30" })), fl = [...host.querySelectorAll("[data-blog-stats-lang]")];
  ok("the readers card filters its table by All and the ten languages", fl.length === 11 && LANGS.every(l => fl.some(b => b.getAttribute("data-blog-stats-lang") === l && b.textContent === M.LANG_META[l].name)) && host.querySelectorAll("[data-blog-stats-table] tbody tr").length === 2);
  await click(fl.find(b => b.getAttribute("data-blog-stats-lang") === "ar"), M, 40);
  ok("the Arabic filter keeps only the Arabic article, shown with its upper-case code", host.querySelectorAll("[data-blog-stats-table] tbody tr").length === 1 && /AR-STAT/.test(host.textContent) && /AR/.test(host.querySelector("[data-blog-stats-table] tbody tr b").textContent));
  await click(fl.find(b => b.getAttribute("data-blog-stats-lang") === "hi"), M, 40);
  ok("a language with no reader says so", !host.querySelector("[data-blog-stats-table]") && /No readers in this period yet/.test(host.textContent));
}
await reset();

console.log(fail ? `\nFAILED ${fail} / ${n}` : `\nall passed (${n})`); fs.rmSync(dir, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
