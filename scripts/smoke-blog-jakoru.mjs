#!/usr/bin/env node
/* smoke-blog-jakoru.mjs — the blog in Japanese, Korean and Russian (owner 2026-11-11), next to Thai, English and Mandarin.
   Articles for the new languages are committed files, blog-src/<ja|ko|ru>/<slug>.json; the generator turns them into pages, a real index, a feed and a sitemap file even when the database is
   unreachable, and a database row with the same (lang, slug) wins. This test runs the REAL generator, blog-paths.mjs, blog-live.mjs and the wall in Chromium; it touches no repo file and no network:
   scripts/build-blog-pages.mjs is run with BLOG_FIXTURE / BLOG_OUT / BLOG_SRC / SITE_URL into a temp folder.
     node scripts/smoke-blog-jakoru.mjs */
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import http from "node:http";
import { execSync, execFileSync, spawnSync } from "node:child_process"; import { pathToFileURL, fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-jkr-"));
const SITE = "https://www.tigaalpha.com";
const W = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof s === "string" ? s : JSON.stringify(s)); };
const rd = (f) => fs.readFileSync(f, "utf8");
const GEN = path.join(ROOT, "scripts/build-blog-pages.mjs");
function gen(env, { cwd } = {}) {
  const r = spawnSync("node", [env.__script || GEN], { env: { ...process.env, BLOG_SRC: "", BLOG_FIXTURE: "", BLOG_OFFLINE: "", BLOG_OUT: "", SITE_URL: SITE, ...env, __script: undefined }, encoding: "utf8", cwd });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const src = (lang, slug, o = {}) => ({ lang, slug, category: "tips", title: `${lang.toUpperCase()} title ${slug}`, excerpt: `${lang} excerpt for ${slug}, long enough to read like a summary`, body: "## Head\n\nPara **bold** here.\n\n- a\n- b\n\n1. one\n2. two\n" + "word ".repeat(80), created_at: "2026-11-11", published: true, ...o });

// ───────── fixtures ─────────
// the real article titles, so the language-specific checks look at real text
const TITLE = { ja: "ピアノの姿勢と座り方", ko: "피아노 자세와 앉는 법", ru: "Посадка за фортепиано" };
const S = path.join(tmp, "blog-src");
for (const l of ["ja", "ko", "ru"]) W(path.join(S, l, "piano-posture.json"), src(l, "piano-posture", { title: TITLE[l], category: "theory", created_at: "2026-11-11" }));
W(path.join(S, "ja", "second-article.json"), src("ja", "second-article", { created_at: "2026-11-12", category: "news" }));
W(path.join(S, "ja", "db-wins.json"), src("ja", "db-wins", { title: "STATIC TITLE (must lose to the database row)" }));
// malformed files: each one must be skipped with a warning and must not stop the build
W(path.join(S, "ja", "broken.json"), "{ this is not json");
W(path.join(S, "ja", "wrong-lang.json"), src("ko", "wrong-lang"));
W(path.join(S, "ja", "no-title.json"), src("ja", "no-title", { title: "" }));
W(path.join(S, "ja", "bad-date.json"), src("ja", "bad-date", { created_at: "yesterday" }));
W(path.join(S, "ja", "name-mismatch.json"), src("ja", "other-name"));
W(path.join(S, "ko", "Bad_Slug.json"), src("ko", "Bad_Slug"));
W(path.join(S, "ja", "draft.json"), src("ja", "draft", { published: false }));
W(path.join(S, "th", "ignored.json"), src("th", "ignored"));   // blog-src only holds ja / ko / ru: th / en / zh stay in the database
const dbPosts = [
  ...["th", "en", "zh"].map(lang => ({ id: "p-" + lang, lang, slug: "piano-posture", category: "tips", title: { th: "ท่านั่งเล่นเปียโน", en: "Piano posture", zh: "钢琴坐姿" }[lang], excerpt: "x", body: "# H\n" + "para ".repeat(200) + "\n\n" + "more ".repeat(400), cover_url: null, published: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" })),
  { id: "p-dbwins", lang: "ja", slug: "db-wins", category: "tips", title: "DB TITLE (wins)", excerpt: "db excerpt", body: "From the database.\n", cover_url: null, published: true, created_at: "2026-11-05T00:00:00Z", updated_at: "2026-11-05T00:00:00Z" },
];
W(path.join(tmp, "posts.json"), dbPosts);
const OUT = path.join(tmp, "out");
const r1 = gen({ BLOG_FIXTURE: path.join(tmp, "posts.json"), BLOG_OUT: OUT, BLOG_SRC: S });

console.log("reading the source files");
ok(r1.code === 0, "the build succeeds although some source files are malformed");
for (const [f, why] of [["ja/broken.json", "not valid JSON"], ["ja/wrong-lang.json", "lang is"], ["ja/no-title.json", "title is empty"], ["ja/bad-date.json", "created_at"], ["ja/name-mismatch.json", "does not match the file name"], ["ko/Bad_Slug.json", "slug"]])
  ok(r1.err.includes(f) && r1.err.includes(why), "a warning names " + f + " (" + why + ")");
ok(!r1.err.includes("draft.json") && !fs.existsSync(path.join(OUT, "ja", "draft.html")), "a draft (published: false) is skipped quietly and gets no page");
for (const bad of ["broken", "wrong-lang", "no-title", "bad-date", "other-name", "name-mismatch"]) ok(!fs.existsSync(path.join(OUT, "ja", bad + ".html")), "no page for the malformed " + bad);
ok(!fs.existsSync(path.join(OUT, "ko", "Bad_Slug.html")) && !fs.existsSync(path.join(OUT, "th", "ignored.html")), "no page for an invalid slug, and blog-src/th is not read");
ok(/\(\d+ from blog-src\)/.test(r1.out), "the build reports how many posts came from blog-src: " + (r1.out.match(/\(\d+ from blog-src\)/) || [""])[0]);

console.log("article pages in ja / ko / ru");
const wall = { ja: ["続きを読むにはログイン", "Googleで続ける", "無料で会員登録", "ログイン"], ko: ["계속 읽으려면 로그인하세요", "Google로 계속하기", "무료로 가입하기", "로그인"], ru: ["Войдите, чтобы читать дальше", "Продолжить через Google", "Зарегистрироваться бесплатно", "Войти"] };
const LOC = { ja: "ja_JP", ko: "ko_KR", ru: "ru_RU" }, AUM = { ja: "アウム先生", ko: "아움 선생님", ru: "Учитель Аум" }, CAT = { ja: "音楽理論", ko: "음악 이론", ru: "Теория музыки" }, BACK = { ja: "すべての記事", ko: "모든 글", ru: "Все статьи" }, CTA = { ja: "TIGA ALPHAで無料で始めよう", ko: "TIGA ALPHA에서 무료로 시작하기", ru: "Начните учиться бесплатно в TIGA ALPHA" }, WORDS = { ja: "回閲覧", ko: "회 조회", ru: "просмотров" };
for (const lang of ["ja", "ko", "ru"]) {
  const f = path.join(OUT, lang, "piano-posture.html"); ok(fs.existsSync(f), lang + ": the page is written from blog-src");
  const h = rd(f);
  ok(h.includes(`<html lang="${lang}">`), lang + ': <html lang="' + lang + '">');
  ok(h.includes(`<link rel="canonical" href="${SITE}/blog/${lang}/piano-posture.html">`), lang + ": canonical is its own address");
  ok(h.includes(`<meta property="og:locale" content="${LOC[lang]}">`), lang + ": og:locale " + LOC[lang]);
  ok(h.includes(`<title>${TITLE[lang]} | TIGA ALPHA</title>`) && h.includes(`<h1>${TITLE[lang]}</h1>`), lang + ": own title and h1");
  const alt = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => m[1] + "=" + m[2]);
  ok(["ja", "ko", "ru", "th", "en", "zh-Hans", "x-default"].every(l => alt.some(a => a.startsWith(l + "="))) && alt.length === 7, lang + ": hreflang for all six languages and x-default (" + alt.length + " links)");
  ok(alt.includes(`x-default=${SITE}/blog/en/piano-posture.html`), lang + ": x-default is the English version when there is one");
  ok(alt.includes(`${lang}=${SITE}/blog/${lang}/piano-posture.html`) && alt.includes(`th=${SITE}/blog/th/piano-posture.html`), lang + ": each alternate points at /blog/<lang>/<slug>.html");
  ok(h.includes(`"inLanguage":"${lang}"`) && h.includes('"@type":"BlogPosting"'), lang + ": BlogPosting JSON-LD with inLanguage " + lang);
  ok(h.includes('"isAccessibleForFree":false') && h.includes('"cssSelector":"article"'), lang + ": gated-content markup");
  ok(h.includes(`"name":"${AUM[lang]}"`), lang + ": the teacher's name in " + lang + " (" + AUM[lang] + ")");
  ok(h.includes(CAT[lang]) && h.includes(BACK[lang]) && h.includes(CTA[lang]), lang + ": category, 'all articles' and call-to-action in " + lang);
  ok(h.includes(`href="${SITE}/blog/${lang}/feed.xml"`), lang + ": the feed is linked from the head");
  ok(wall[lang].slice(0, 3).every(w => h.includes(w)) && h.includes("TIGA AI"), lang + ": the wall copy is in " + lang + " and names the TIGA AI app");
  ok(h.includes(`lg=${lang}`) && h.includes("utm_campaign=piano-posture") && h.includes("go=google") && h.includes("wall=signup") && h.includes("wall=login"), lang + ": wall links carry lg=" + lang + ", the attribution and the three entry points");
  ok(h.includes(`LANG="${lang}"`) && h.includes(`LBL="${WORDS[lang]}"`), lang + ": the reader script knows its language and the unit '" + WORDS[lang] + "'");
  ok(h.includes("MS=15000") && !/data-gate-close|tg-g-x|tg-g-later/.test(h), lang + ": the wall is the same uncloseable 15 second wall");
  ok(/id="tg-gate"[^>]*data-nosnippet[^>]*hidden/.test(h), lang + ": the pop-up is hidden and marked data-nosnippet");
  ok(h.includes("<time datetime=\"2026-11-11\">2026-11-11</time>"), lang + ": a plain date string in created_at gives a valid date");
  ok(/class="tg-views"|\.tg-views\{/.test(h), lang + ": the view counter styles are in");
}
{
  const ja = rd(path.join(OUT, "ja", "piano-posture.html")), ko = rd(path.join(OUT, "ko", "piano-posture.html")), ru = rd(path.join(OUT, "ru", "piano-posture.html")), en = rd(path.join(OUT, "en", "piano-posture.html"));
  ok(/"Hiragino Sans","Yu Gothic","Noto Sans JP","Noto Sans SC"/.test(ja) && !/Malgun/.test(ja), "ja: the page font stack names Japanese faces (before the Chinese one)");
  ok(/"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Noto Sans SC"/.test(ko) && !/Hiragino/.test(ko), "ko: the page font stack names Korean faces");
  ok(!/Hiragino|Malgun/.test(ru) && !/Hiragino|Malgun/.test(en), "ru and en keep the old font stack");
  ok((ja.match(/Hiragino Sans/g) || []).length === 2, "ja: the wall card uses the same Japanese faces (page and card)");
  ok(/toLocaleString\("ja-JP"\)/.test(ja) && /toLocaleString\("ko-KR"\)/.test(ko) && /toLocaleString\("ru-RU"\)/.test(ru), "the reader script formats the number in the page's locale (ja-JP / ko-KR / ru-RU)");
  ok(/\+""\+LBL/.test(ja) && /\+""\+LBL/.test(ko) && /\+" "\+LBL/.test(ru), "ja and ko put the unit straight after the number, ru with a space");
  ok(/"wordCount":\d+/.test(ja) && Number(/"wordCount":(\d+)/.exec(ja)[1]) > 100, "ja: the word count counts characters");
  ok(/"keywords":"ピアノ指導/.test(ja) && /"keywords":"피아노 교육/.test(ko) && /"keywords":"обучение игре на фортепиано/.test(ru), "keywords in each language");
  ok(en.includes('hreflang="ja"') && en.includes('hreflang="ko"') && en.includes('hreflang="ru"'), "the English page of the same article now lists ja / ko / ru as alternates (reciprocal links)");
  ok(rd(path.join(OUT, "th", "piano-posture.html")).includes(`hreflang="ru" href="${SITE}/blog/ru/piano-posture.html"`), "...and so does the Thai one");
}

console.log("database wins");
{
  const h = rd(path.join(OUT, "ja", "db-wins.html"));
  ok(h.includes("DB TITLE (wins)") && !h.includes("STATIC TITLE"), "a database row beats the source file with the same (lang, slug)");
  ok(rd(path.join(OUT, "ja", "index.html")).includes("DB TITLE (wins)") && !rd(path.join(OUT, "ja", "index.html")).includes("STATIC TITLE"), "...also in the index");
  ok(rd(path.join(OUT, "ja", "feed.xml")).includes("DB TITLE (wins)") && !rd(path.join(OUT, "ja", "feed.xml")).includes("STATIC TITLE"), "...and in the feed");
}

console.log("index and feed are real files for ja / ko / ru");
{
  const idx = rd(path.join(OUT, "ja", "index.html"));
  ok(idx.includes('<html lang="ja">') && idx.includes("<h1>ブログ</h1>") && idx.includes("ピアノと音楽の学習に役立つ記事"), "ja/index.html is a real Japanese page");
  ok(idx.includes(`href="${SITE}/blog/ja/piano-posture.html"`) && idx.includes(`href="${SITE}/blog/ja/second-article.html"`) && idx.includes(`href="${SITE}/blog/ja/db-wins.html"`), "...it lists every ja article");
  ok(idx.indexOf("second-article.html") < idx.indexOf("piano-posture.html") && idx.indexOf("piano-posture.html") < idx.indexOf("db-wins.html"), "...newest first (12 Nov, 11 Nov, 5 Nov)");
  ok(idx.includes('<link rel="canonical" href="' + SITE + '/blog/ja/">') && idx.includes('hreflang="x-default" href="' + SITE + '/blog/en/"') && ["ja", "ko", "ru", "th", "en", "zh-Hans"].every(l => idx.includes(`hreflang="${l}" href="${SITE}/blog/`)), "...canonical, and hreflang for all six index pages with x-default = English");
  ok(idx.includes("blog_view_counts") && idx.includes("toLocaleString(\"ja-JP\")"), "...the card counter script is in, formatted for Japanese");
  ok(!idx.includes("tg-gate"), "...and the index has no wall");
  ok(rd(path.join(OUT, "ko", "index.html")).includes("<h1>블로그</h1>") && rd(path.join(OUT, "ru", "index.html")).includes("<h1>Блог</h1>"), "ko and ru indexes exist and are in their language");
  ok(rd(path.join(OUT, "ru", "index.html")).includes("Теория музыки"), "the index card shows the category in Russian");
  for (const l of ["th", "en", "zh"]) ok(!fs.existsSync(path.join(OUT, l, "index.html")), l + ": still no baked index (the function renders it from the database, as before)");
  const feed = rd(path.join(OUT, "ko", "feed.xml"));
  ok(feed.startsWith("<?xml") && feed.includes("<language>ko</language>") && feed.includes("<title>TIGA ALPHA 블로그</title>") && feed.includes(`${SITE}/blog/ko/piano-posture.html`), "ko/feed.xml is a real RSS feed with <language>ko</language>");
  ok(rd(path.join(OUT, "ja", "feed.xml")).includes("<language>ja</language>") && rd(path.join(OUT, "ru", "feed.xml")).includes("<language>ru</language>"), "ja and ru feeds carry their language");
}

console.log("sitemap");
{
  const sm = rd(path.join(OUT, "sitemap-static.xml"));
  ok(sm.includes("<urlset") && sm.includes("xmlns:xhtml"), "blog/sitemap-static.xml is a urlset");
  for (const l of ["ja", "ko", "ru"]) ok(sm.includes(`<loc>${SITE}/blog/${l}/piano-posture.html</loc>`) && sm.includes(`<loc>${SITE}/blog/${l}/</loc>`), l + ": the article and the index are in the sitemap");
  ok(sm.includes(`<loc>${SITE}/blog/ja/second-article.html</loc>`) && !sm.includes("/blog/ja/broken.html") && !sm.includes("/blog/ja/draft.html"), "the second ja article is in; a malformed one and a draft are not");
  const entry = sm.split("<url>").find(u => u.includes("<loc>" + SITE + "/blog/ru/piano-posture.html</loc>")) || "";
  ok(['hreflang="ja"', 'hreflang="ko"', 'hreflang="ru"', 'hreflang="th"', 'hreflang="en"', 'hreflang="zh-Hans"', 'hreflang="x-default" href="' + SITE + '/blog/en/piano-posture.html"'].every(x => entry.includes(x)), "an entry lists the alternates of all six languages and x-default = English");
  ok(/<lastmod>2026-11-1[12]<\/lastmod>/.test(sm), "lastmod comes from created_at");
  ok(!sm.includes("/blog/th/piano-posture.html</loc>"), "th / en / zh articles are NOT repeated here (the live sitemap-blog.xml has them)");
}

console.log("th / en / zh output is unchanged");
{
  // (1) the same fixture with no source files at all must give exactly the old output; (2) source files for other slugs must not change a single byte of th / en / zh
  const mkOld = () => { const posts = []; let k = 0; const cats = ["tips", "theory", "songs", "news", "story"];
    for (const slug of ["alpha-post", "beta-post", "gamma-post", "delta-post", "eps-post", "zeta-post"]) for (const lang of ["th", "en", "zh"]) { if (slug === "zeta-post" && lang !== "zh") continue; k++;
      posts.push({ id: "p" + k, lang, slug, category: cats[k % 5], title: `${lang} title ${slug} & <b>`, excerpt: `excerpt ${lang} ${slug} "q"`, body: `# Head\n\nPara **bold** [link](https://example.com/x) ![img](https://example.com/i.png)\n\n- a\n- b\n\n1. one\n2. two\n\n### Sub\n` + "word ".repeat(50) + (lang === "zh" ? "汉字内容测试" : ""), cover_url: k % 3 === 0 ? "https://example.com/c.jpg" : null, published: true, created_at: `2026-10-${String(10 + k).padStart(2, "0")}T00:00:00Z`, updated_at: `2026-10-${String(11 + k).padStart(2, "0")}T00:00:00Z` }); }
    return posts; };
  W(path.join(tmp, "old.json"), mkOld());
  const empty = path.join(tmp, "empty-src"); fs.mkdirSync(empty, { recursive: true });
  const A = path.join(tmp, "o-none"), B = path.join(tmp, "o-other");
  ok(gen({ BLOG_FIXTURE: path.join(tmp, "old.json"), BLOG_OUT: A, BLOG_SRC: empty }).code === 0 && gen({ BLOG_FIXTURE: path.join(tmp, "old.json"), BLOG_OUT: B, BLOG_SRC: S }).code === 0, "(both builds ran)");
  const list = (d) => { const o = {}; for (const l of ["th", "en", "zh"]) for (const f of fs.existsSync(path.join(d, l)) ? fs.readdirSync(path.join(d, l)) : []) o[l + "/" + f] = rd(path.join(d, l, f)); return o; };
  const a = list(A), b = list(B);
  ok(Object.keys(a).length === 16 && JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b)), "the same 16 th / en / zh files");
  ok(Object.keys(a).every(k => a[k] === b[k]), "...byte for byte the same with and without source files for other slugs");
  ok(!fs.existsSync(path.join(A, "ja")) && !fs.existsSync(path.join(A, "sitemap-static.xml")), "with no source files nothing is written for ja / ko / ru");
  // against the generator as it was before this change, when git still has it
  let oldSrc = ""; try { oldSrc = execSync("git show HEAD:scripts/build-blog-pages.mjs", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (e) {}
  if (oldSrc && !oldSrc.includes("STATIC_LANGS")) {
    const br = path.join(tmp, "base-root"); W(path.join(br, "scripts", "build-blog-pages.mjs"), oldSrc); fs.copyFileSync(path.join(ROOT, "supabase-client.ts"), path.join(br, "supabase-client.ts"));
    const C = path.join(tmp, "o-base"); const rr = spawnSync("node", [path.join(br, "scripts", "build-blog-pages.mjs")], { env: { ...process.env, BLOG_FIXTURE: path.join(tmp, "old.json"), BLOG_OUT: C, SITE_URL: SITE }, encoding: "utf8" });
    const c = list(C); ok(rr.status === 0 && Object.keys(c).length === 16 && Object.keys(c).every(k => c[k] === a[k]), "...and byte for byte the same as the generator in git HEAD (before this change)");
  } else console.log("  - (git HEAD already holds the new generator: no 'before' copy to compare with)");
}

console.log("offline: the database cannot be reached");
{
  const keep = path.join(tmp, "keep"); fs.mkdirSync(path.join(keep, "th"), { recursive: true }); fs.mkdirSync(path.join(keep, "en"), { recursive: true });
  fs.copyFileSync(path.join(OUT, "th", "piano-posture.html"), path.join(keep, "th", "piano-posture.html")); fs.copyFileSync(path.join(OUT, "en", "piano-posture.html"), path.join(keep, "en", "piano-posture.html"));
  const th0 = rd(path.join(keep, "th", "piano-posture.html")), en0 = rd(path.join(keep, "en", "piano-posture.html"));
  const r = gen({ BLOG_OFFLINE: "1", BLOG_OUT: keep, BLOG_SRC: S });
  ok(r.code === 0 && /fetch failed, leaving the existing blog pages in place/.test(r.out), "the 'fetch failed, leaving existing pages' path runs");
  for (const l of ["ja", "ko", "ru"]) ok(fs.existsSync(path.join(keep, l, "piano-posture.html")) && fs.existsSync(path.join(keep, l, "index.html")) && fs.existsSync(path.join(keep, l, "feed.xml")), l + ": page, index and feed are still written offline");
  ok(rd(path.join(keep, "ja", "db-wins.html")).includes("STATIC TITLE"), "offline there is no database row, so the source file is the page");
  ok(rd(path.join(keep, "th", "piano-posture.html")) === th0 && rd(path.join(keep, "en", "piano-posture.html")) === en0, "the kept th / en pages are not rewritten (they are already current)");
  const ja = rd(path.join(keep, "ja", "piano-posture.html"));
  ok(ja.includes(`hreflang="x-default" href="${SITE}/blog/en/piano-posture.html"`) && ja.includes(`hreflang="th" href="${SITE}/blog/th/piano-posture.html"`) && !ja.includes('hreflang="zh-Hans"'), "an English / Thai page already on disk counts as a language of the article (x-default = English; zh is not on disk so it is not claimed)");
  ok(fs.existsSync(path.join(keep, "sitemap-static.xml")), "the static sitemap is written offline too");
  const before = rd(path.join(keep, "ja", "index.html")); gen({ BLOG_OFFLINE: "1", BLOG_OUT: keep, BLOG_SRC: S });
  ok(rd(path.join(keep, "ja", "index.html")) === before && rd(path.join(keep, "ja", "piano-posture.html")) === ja, "running it again changes nothing");
  // the sources vanish (a checkout without blog-src): the pages already on disk are kept and patched like any kept page, never deleted
  const r2 = gen({ BLOG_OFFLINE: "1", BLOG_OUT: keep, BLOG_SRC: path.join(tmp, "nowhere") });
  ok(r2.code === 0 && fs.existsSync(path.join(keep, "ja", "piano-posture.html")) && fs.existsSync(path.join(keep, "ja", "index.html")), "no blog-src: the ja pages and index already on disk stay");
  ok(rd(path.join(keep, "ja", "piano-posture.html")) === ja, "...and are not changed either (already current)");
}

console.log("pagination of the static index");
{
  const S2 = path.join(tmp, "src-many");
  for (let i = 1; i <= 50; i++) W(path.join(S2, "ru", `post-${i}.json`), src("ru", `post-${i}`, { created_at: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}` }));
  W(path.join(tmp, "none.json"), []);
  const O2 = path.join(tmp, "out-many"); const r = gen({ BLOG_FIXTURE: path.join(tmp, "none.json"), BLOG_OUT: O2, BLOG_SRC: S2 });
  const p1 = rd(path.join(O2, "ru", "index.html")), p2f = path.join(O2, "ru", "page", "2", "index.html");
  ok(r.code === 0 && (p1.match(/class="card"/g) || []).length === 48, "page 1 lists 48 cards");
  ok(p1.includes(`<link rel="next" href="${SITE}/blog/ru/page/2">`) && !p1.includes('rel="prev"'), "...and links to page 2");
  ok(fs.existsSync(p2f), "ru/page/2/index.html is written");
  const p2 = fs.existsSync(p2f) ? rd(p2f) : "";
  ok((p2.match(/class="card"/g) || []).length === 2 && p2.includes(`<link rel="prev" href="${SITE}/blog/ru/">`) && p2.includes(`<link rel="canonical" href="${SITE}/blog/ru/page/2">`), "page 2 has the last 2 cards, prev = the index, canonical = /page/2");
  ok(p2.includes("Предыдущая страница") && p1.includes("Следующая страница"), "the pager text is Russian");
  ok((rd(path.join(O2, "ru", "feed.xml")).match(/<item>/g) || []).length === 40, "the feed keeps its 40 newest");
  const O3 = path.join(tmp, "out-many2"); fs.cpSync(O2, O3, { recursive: true });
  gen({ BLOG_OFFLINE: "1", BLOG_OUT: O3, BLOG_SRC: S });
  ok(!fs.existsSync(path.join(O3, "ru", "page")), "when the language shrinks, the old page/N folder is removed");
}

console.log("sitemap index gets one more entry (what build-song-pages.mjs writes), once");
{
  const root = path.join(tmp, "root"); fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.copyFileSync(GEN, path.join(root, "scripts/build-blog-pages.mjs")); fs.copyFileSync(path.join(ROOT, "supabase-client.ts"), path.join(root, "supabase-client.ts")); fs.cpSync(S, path.join(root, "blog-src"), { recursive: true });
  const idx = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap><loc>${SITE}/sitemap-pages.xml</loc><lastmod>2026-11-10</lastmod></sitemap>\n<sitemap><loc>${SITE}/sitemap-blog.xml</loc><lastmod>2026-11-10</lastmod></sitemap>\n</sitemapindex>\n`;
  W(path.join(root, "sitemap.xml"), idx);
  const run = () => gen({ __script: path.join(root, "scripts/build-blog-pages.mjs"), BLOG_FIXTURE: path.join(tmp, "posts.json") }, { cwd: root });
  const a = run(); const s1 = rd(path.join(root, "sitemap.xml")); run(); const s2 = rd(path.join(root, "sitemap.xml"));
  ok(a.code === 0 && s1.includes(`<sitemap><loc>${SITE}/blog/sitemap-static.xml</loc><lastmod>2026-11-12</lastmod></sitemap>`), "the index lists blog/sitemap-static.xml with the newest date");
  ok(s1 === s2 && (s2.match(/sitemap-static\.xml/g) || []).length === 1, "...once, also after a second run");
  ok(s2.includes("sitemap-pages.xml") && s2.includes("sitemap-blog.xml") && s2.trim().endsWith("</sitemapindex>"), "...and the other entries and a closed file are kept");
  ok(fs.existsSync(path.join(root, "blog", "sitemap-static.xml")) && fs.existsSync(path.join(root, "blog", "ja", "index.html")), "(the files were written under the root's blog/)");
}

console.log("blog-paths.mjs and blog-live.mjs");
{
  const P = await import(pathToFileURL(path.join(ROOT, "scripts/blog-paths.mjs")).href + "?t=" + Date.now());
  const L = await import(pathToFileURL(path.join(ROOT, "scripts/blog-live.mjs")).href + "?t=" + Date.now());
  for (const l of ["th", "en", "zh", "ja", "ko", "ru"]) {
    ok(P.parseBlogPath(`/blog/${l}/`).kind === "index" && P.parseBlogPath(`/blog/${l}`).lang === l, l + ": the index path is recognised");
    ok(P.parseBlogPath(`/blog/${l}/feed.xml`).kind === "feed" && P.parseBlogPath(`/blog/${l}/page/3`).page === 3, l + ": feed and page/N are recognised");
    const a = P.parseBlogPath(`/blog/${l}/practice-15-minutes-5-methods.html`);
    ok(a.kind === "article" && a.lang === l && a.hint === false, l + ": an article address is recognised");
  }
  ok(P.parseBlogPath("/blog/xx/foo.html").kind === "bad" && P.parseBlogPath("/blog/fr/").kind !== "index", "an unknown language is still refused");
  const h = P.parseBlogPath("/blog/piano-posture-ja"); ok(h.kind === "article" && h.lang === "ja" && h.hint === true && h.slug === "piano-posture-ja", "the short address with a -ja hint keeps the whole slug and hints Japanese");
  ok(P.parseBlogPath("/blog/piano-posture-ru").lang === "ru" && P.parseBlogPath("/blog/piano-posture-ko").lang === "ko" && P.parseBlogPath("/blog/piano-posture-zh").lang === "zh", "-ru / -ko / -zh hints");
  ok(P.fromQuery({ lang: "ko", rest: "feed.xml" }).kind === "feed" && P.fromQuery({ lang: "ru", rest: "page/2" }).page === 2 && P.fromQuery({ slug: "ja" }).lang === "ja", "fromQuery handles the new languages (what the Vercel rewrite hands over)");
  ok(P.pickPost([{ lang: "ja", slug: "a-b", published: true }], "ja", false).lang === "ja" && P.pickPost([{ lang: "ru", slug: "a-b" }], "ko", false) === null, "pickPost accepts and separates the new languages");
  const nf = P.notFoundHtml(); ok(nf.includes("/blog/ja/") && nf.includes("/blog/ko/") && nf.includes("/blog/ru/") && nf.includes("/blog/th/") && !nf.includes('id="root"'), "the 404 page links to all six blogs");
  const rows = [{ slug: "p", lang: "en", published: true, created_at: "2026-10-01" }, { slug: "p", lang: "ja", published: true, created_at: "2026-11-11" }, { slug: "p", lang: "ru", published: true, created_at: "2026-11-11" }];
  const xml = P.sitemapBlogXml(rows, SITE);
  ok(xml.includes(`<loc>${SITE}/blog/ja/p.html</loc>`) && xml.includes('hreflang="ja"') && xml.includes('hreflang="ru"') && xml.includes(`hreflang="x-default" href="${SITE}/blog/en/p.html"`), "the live sitemap lists ja / ru articles with their alternates");
  ok(xml.includes(`<loc>${SITE}/blog/ja/</loc>`) && xml.includes(`<loc>${SITE}/blog/ru/</loc>`) && !xml.includes(`<loc>${SITE}/blog/ko/</loc>`), "...and an index line only for a language that has an article");
  // the function: it never replaces a good static index with an empty list
  const mk = (data) => async () => ({ ok: true, json: async () => data });
  for (const l of ["ja", "ko", "ru"]) {
    const idx = await L.serveBlog({ lang: l }, mk([])), feed = await L.serveBlog({ lang: l, rest: "feed.xml" }, mk([]));
    ok(idx.status === 404 && idx.headers["x-robots-tag"] === "noindex" && !idx.body.includes('class="card"'), l + ": asked for an index with no database rows the function answers 404 + noindex, not an empty 200 list");
    ok(feed.status === 404, l + ": ...and the same for the feed");
  }
  const th = await L.serveBlog({ lang: "th" }, mk([])); ok(th.status === 200, "th: an empty list still answers 200 (old behaviour kept)");
  const row = { lang: "ja", slug: "live-one", title: "ライブ記事", excerpt: "e", body: "本文\n", category: "tips", published: true, created_at: "2026-11-12T00:00:00Z", updated_at: "2026-11-12T00:00:00Z" };
  const li = await L.serveBlog({ lang: "ja" }, mk([row])); ok(li.status === 200 && li.headers["content-language"] === "ja" && li.body.includes("/blog/ja/live-one.html"), "ja: with database rows the index is rendered live");
  const la = await L.serveBlog({ lang: "ja", rest: "live-one.html" }, mk([row])); ok(la.status === 200 && la.body.includes('<html lang="ja">') && la.headers["content-language"] === "ja", "ja: an article published after the build is served live");
  const lr = await L.serveBlog({ lang: "ru", rest: "live-ru.html" }, mk([{ ...row, lang: "ru", slug: "live-ru" }, { ...row, lang: "en", slug: "live-ru" }])); ok(lr.status === 200 && lr.body.includes('hreflang="en"') && lr.body.includes('hreflang="ru"'), "ru: the live page lists the English row as an alternate (language whitelist covers all six)");
  const sm = await L.serveBlogSitemap(mk(rows)); ok(sm.status === 200 && sm.body.includes("/blog/ja/p.html"), "the live sitemap function includes ja");
}

console.log("vercel.json and the redirect rules");
{
  const v = JSON.parse(rd(path.join(ROOT, "vercel.json")));
  ok(v.rewrites.some(r => r.source === "/blog/:lang/" && r.destination.includes("api/blog-page")) && v.rewrites.some(r => r.source === "/blog/:lang/:rest*"), "the generic /blog/:lang rewrites (any language, after the filesystem) are still there");
  ok(v.redirects.some(r => r.source === "/blog/" && r.destination === "/blog/th/") && v.redirects.some(r => r.source === "/th"), "old redirects unchanged");
  ok(v.headers.some(h => h.source === "/blog/(ja|ko|ru)/feed.xml" && /application\/rss\+xml/.test(JSON.stringify(h.headers))), "the static ja / ko / ru feeds are served as RSS");
  ok(v.functions["api/blog-page.js"].includeFiles === "supabase-client.ts", "the function bundle is unchanged: it does not read blog-src at run time");
  const E = await import(pathToFileURL(path.join(ROOT, "scripts/edge-redirect.mjs")).href);
  ok(E.redirectTarget("https://www.tigaalpha.com/blog/ja/", "www.tigaalpha.com", "https") === null && E.redirectTarget("https://www.tigaalpha.com/blog/ru/x.html", "www.tigaalpha.com", "https") === null, "edge redirects leave /blog/ja|ru/ alone");
  ok(E.redirectTarget("http://www.tigaalpha.com/blog/ko/", "www.tigaalpha.com", "http") === "https://www.tigaalpha.com/blog/ko/", "http -> https works for the new blogs too");
}

console.log("SQL");
{
  const mig = rd(path.join(ROOT, "supabase-blog-ja-ko-ru-migration.sql"));
  ok(mig.includes("WRITTEN, NOT APPLIED") && mig.includes("blog_posts_lang_check") && mig.includes("drop constraint if exists blog_posts_lang_check") && mig.includes("'th','en','zh','ja','ko','ru'"), "the migration says NOT APPLIED and swaps the language check for six languages");
  const chk = spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs"), "--check"], { encoding: "utf8" });
  ok(chk.status === 0, "gen-blog-seed-sql.mjs --check: the committed migration is current with blog-src (" + (chk.stdout || chk.stderr).trim().slice(0, 90) + ")");
  const G = await import(pathToFileURL(GEN).href + "?sql=" + Date.now()); const valid = G.readStaticPosts(path.join(ROOT, "blog-src"));
  const inserts = (mig.match(/^insert into public\.blog_posts/gm) || []).length;
  ok(inserts === valid.length && inserts > 0 && valid.every(p => mig.includes(`values ('${p.lang}', '${p.slug}',`)), "one insert per valid source article in blog-src (" + inserts + " of " + valid.length + "), each with its lang and slug");
  ok((mig.match(/on conflict \(lang, slug\) do nothing;/g) || []).length === inserts, "every insert is 'on conflict (lang, slug) do nothing'");
  // stale detection and quoting, on a throw-away output
  const S3 = path.join(tmp, "src-sql"); W(path.join(S3, "ja", "quote-test.json"), src("ja", "quote-test", { title: "It's a \"test\" with $b1$ and \\ backslash", body: "line 1\n$b1\n'single' \\n literal $$ dollars\n" }));
  const sqlOut = path.join(tmp, "seed.sql"); const env = { ...process.env, BLOG_SRC: S3, BLOG_SEED_OUT: sqlOut };
  ok(spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs"), "--check"], { env, encoding: "utf8" }).status === 1, "--check fails when the file is missing");
  spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs")], { env, encoding: "utf8" });
  const q = rd(sqlOut);
  ok(spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs"), "--check"], { env, encoding: "utf8" }).status === 0, "--check passes right after writing");
  // a small SQL tokenizer (comments, 'strings', $tag$ strings): what a server would read out of the file must be exactly the article text
  const dollarStrings = (sql) => { const out = []; let i = 0; while (i < sql.length) { const c = sql[i];
    if (c === "-" && sql[i + 1] === "-") { i = sql.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "'") { i++; while (i < sql.length) { if (sql[i] === "'" && sql[i + 1] === "'") i += 2; else if (sql[i] === "'") { i++; break; } else i++; } continue; }
    if (c === "$") { const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 40)); if (m) { const end = sql.indexOf(m[0], i + m[0].length); out.push(sql.slice(i + m[0].length, end)); i = end + m[0].length; continue; } }
    i++; } return out; };
  const ds = dollarStrings(q);
  ok(ds.length === 3 && ds[0] === "It's a \"test\" with $b1$ and \\ backslash" && ds[1] === src("ja", "quote-test").excerpt && ds[2] === "line 1\n$b1\n'single' \\n literal $$ dollars\n", "read back by a SQL tokenizer, title / excerpt / body come out exactly as written (quotes, backslashes, $b1$ and $$ inside the text get their own tags)");
  W(path.join(S3, "ja", "added.json"), src("ja", "added"));
  ok(spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs"), "--check"], { env, encoding: "utf8" }).status === 1, "--check fails again once an article is added (stale)");
  const views = rd(path.join(ROOT, "supabase-blog-views-migration.sql"));
  ok(!/in \('th','en','zh'\)/.test(views) && (views.match(/'th','en','zh','ja','ko','ru'/g) || []).length >= 6, "the reader-count migration allows six languages everywhere (no three-language check left)");
  ok(/create or replace function public\.blog_hit/.test(views) && /create or replace function public\.blog_view_counts/.test(views) && /create or replace function public\.blog_stats/.test(views) && /blog_purge/.test(views), "...and is otherwise intact (four functions)");
}

// ───────── the pages in a real browser: the wall copy and the counter, per language ─────────
console.log("the wall and the reader counter in Chromium");
const server = http.createServer((q, s) => { let f = path.join(tmp, "serve", decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { s.writeHead(404); return s.end("nf"); } s.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain" }); s.end(fs.readFileSync(f)); });
await new Promise(r => server.listen(0, "127.0.0.1", r)); const ORIGIN = "http://127.0.0.1:" + server.address().port;
gen({ BLOG_FIXTURE: path.join(tmp, "posts.json"), BLOG_OUT: path.join(tmp, "serve", "blog"), BLOG_SRC: S, SITE_URL: ORIGIN });
const pwm = await import("playwright").catch(async () => import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href)); const pw = pwm.chromium ? pwm : pwm.default;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const errs = []; const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "apikey, authorization, content-type", "access-control-allow-methods": "POST, OPTIONS" };
async function open(lang, { ms = 1200, w = 1000, h = 720, url = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, userAgent: UA }); const calls = [];
  await ctx.route("**/rest/v1/rpc/**", async (route) => { const req = route.request(); if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS }); const name = req.url().split("/rpc/")[1]; let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch (e) {} calls.push({ name, ...body }); route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(name === "blog_view_counts" ? [{ slug: "piano-posture", views: 1234 }, { slug: "second-article", views: 7 }] : 1234) }); });
  await ctx.addInitScript(() => { try { localStorage.setItem("tg_test_hook", "1"); } catch (e) {} });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(url || `${ORIGIN}/blog/${lang}/piano-posture.html?gate_ms=${ms}`);
  return { ctx, page, calls };
}
const vis = (page) => page.evaluate(() => { const e = document.getElementById("tg-gate"); return !!e && !e.hidden && getComputedStyle(e).display !== "none"; });
for (const lang of ["ja", "ko", "ru"]) {
  const { ctx, page, calls } = await open(lang, { ms: 1200 });
  await page.waitForTimeout(600);
  const b = await page.evaluate(() => { const e = document.querySelector(".tg-views"); return e ? { text: e.textContent, hidden: e.hidden, inMeta: !!e.closest("article .meta") } : null; });
  const want = { ja: "1,234回閲覧", ko: "1,234회 조회", ru: "1 234 просмотров" }[lang];
  ok(b && !b.hidden && b.inMeta && b.text.replace(/[\s  ]+/g, " ").includes(want), lang + ": the reader count shows beside the date as '" + want + "' (" + (b && b.text.trim()) + ")");
  const v = calls.find(c => c.name === "blog_hit" && c.p_kind === "view");
  ok(v && v.p_lang === lang && v.p_slug === "piano-posture", lang + ": one view is sent with p_lang = " + lang);
  ok(!(await vis(page)), lang + ": the wall is not shown before the reading time");
  await page.waitForTimeout(1300);
  ok(await vis(page), lang + ": the wall opens after the reading time");
  const txt = await page.evaluate(() => document.getElementById("tg-gate").innerText);
  ok(wall[lang].every(x => txt.includes(x)), lang + ": the card text is in " + lang + " (" + wall[lang][0] + ")");
  const r = await page.evaluate(() => { const c = document.querySelector(".tg-g-card").getBoundingClientRect(); return { cx: c.left + c.width / 2, cy: c.top + c.height / 2, w: innerWidth, h: innerHeight }; });
  ok(Math.abs(r.cx - r.w / 2) < 3 && Math.abs(r.cy - r.h / 2) < 40, lang + ": the card is in the middle of the screen");
  await page.keyboard.press("Escape"); ok(await vis(page), lang + ": Escape does not close it");
  ok((await page.$$eval("#tg-gate button", b => b.length)) === 0, lang + ": no button in it, only the three links");
  const hrefs = await page.$$eval("#tg-gate a[data-gate]", as => as.map(a => a.getAttribute("href")));
  ok(hrefs.length === 3 && hrefs.every(h => h.startsWith(ORIGIN + "/?") && h.includes("lg=" + lang)), lang + ": three links into the app with lg=" + lang);
  await page.route("**/*", route => { const u = route.request().url(); if (route.request().isNavigationRequest() && !u.includes("/blog/")) return route.fulfill({ status: 200, contentType: "text/html", body: "<title>app</title>" }); route.fallback(); });
  await page.click("[data-gate=signup]"); await page.waitForTimeout(400);
  const gl = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("tg_guest_profile") || "{}").lang; } catch (e) { return null; } });
  ok(gl === lang, lang + ": the app is told to open in " + lang + " (guest profile lang = " + gl + ")");
  ok(calls.some(c => c.p_kind === "click"), lang + ": a tap on a log-in button is recorded");
  await ctx.close();
}
{
  // the index page: counter on the card, formatted per language
  const { ctx, page, calls } = await open("ja", { url: `${ORIGIN}/blog/ja/` });
  await page.waitForTimeout(600);
  const t = await page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent));
  ok(t.length === 2 && t.some(x => x.includes("1,234回閲覧")) && t.some(x => x.includes("7回閲覧")), "ja index: the number shows on each card as 回閲覧 (" + t.join(" | ") + ")");
  ok(calls.some(c => c.name === "blog_view_counts" && c.p_lang === "ja"), "ja index: one call per list, for ja");
  const cards = await page.$$eval("a.card", a => a.map(x => x.getAttribute("href")));
  ok(cards.length === 3 && cards.every(h => h.startsWith(ORIGIN + "/blog/ja/")), "ja index: three cards link to the ja articles");
  await ctx.close();
  const k = await open("ko", { url: `${ORIGIN}/blog/ko/` }); await k.page.waitForTimeout(600);
  const kt = await k.page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent)); ok(kt.length === 1 && kt[0].includes("1,234회 조회"), "ko index: '1,234회 조회' on the card (" + kt.join("|") + ")"); await k.ctx.close();
  const ru = await open("ru", { url: `${ORIGIN}/blog/ru/` }); await ru.page.waitForTimeout(600);
  const rt = await ru.page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent.replace(/[\s  ]+/g, " "))); ok(rt.length === 1 && rt[0].includes("1 234 просмотров"), "ru index: '1 234 просмотров' on the card (" + rt.join("|") + ")"); await ru.ctx.close();
}
{
  // a phone: the new fonts and long Russian / Korean copy still fit
  for (const lang of ["ru", "ko", "ja"]) {
    const { ctx, page } = await open(lang, { ms: 600, w: 360, h: 640 }); await page.waitForTimeout(1300);
    const m = await page.evaluate(() => { const c = document.querySelector(".tg-g-card").getBoundingClientRect(); const bs = [...document.querySelectorAll("#tg-gate a.tg-g-btn")].map(b => b.getBoundingClientRect().height); return { l: c.left, r: c.right, t: c.top, b: c.bottom, w: innerWidth, h: innerHeight, bs, sx: document.documentElement.scrollWidth > innerWidth }; });
    ok(await vis(page) && m.l >= 0 && m.r <= m.w && m.t >= 0 && m.b <= m.h && m.bs.every(x => x >= 44) && !m.sx, lang + ": the card fits a 360x640 phone, buttons >= 44 px, no sideways scroll");
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${lang}-phone.png` });
    await ctx.close();
  }
}
ok(errs.length === 0, "no page errors" + (errs.length ? ": " + [...new Set(errs)].slice(0, 3).join(" | ") : ""));
await browser.close(); server.close();

console.log("the in-app blog (BlogPage.tsx)");
{
  const r = spawnSync("node", [path.join(ROOT, "scripts/smoke-blog-jakoru-app.mjs")], { encoding: "utf8" });
  const lines = (r.stdout || "").split("\n"); const p = lines.filter(l => l.startsWith("PASS ")).length, f = lines.filter(l => l.startsWith("FAIL ")).length;
  for (const l of lines.filter(l => l.startsWith("FAIL "))) console.log("  ✗ " + l);
  ok(r.status === 0 && f === 0 && p > 40, "scripts/smoke-blog-jakoru-app.mjs: " + p + " checks pass, " + f + " fail");
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
