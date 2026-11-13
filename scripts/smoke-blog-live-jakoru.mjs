/* smoke-blog-live-jakoru.mjs — a published ja / ko / ru row is served like th / en / zh, without a network and without touching blog-src or the committed pages.
     node scripts/smoke-blog-live-jakoru.mjs
   The catalog stands in for the 12 static articles. A database row with the same slug wins in the list; the article file itself is not rewritten here. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { articleHtml } from "./build-blog-pages.mjs";
import { notFoundHtml } from "./blog-paths.mjs";
import { serveBlog, serveBlogSitemap, rowsForLang } from "./blog-live.mjs";
import { stripLiveBlogShell as stripDist } from "./copy-seo-to-dist.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.tigaalpha.com";
let n = 0, fail = 0;
const ok = (name, cond) => { n++; if (!cond) { fail++; console.log("FAIL " + name); } else console.log("ok " + name); };

const post = (lang, slug, extra = {}) => ({ lang, slug, title: extra.title || ("T-" + lang), excerpt: extra.excerpt || "e", body: extra.body || "本文です。これは十分な長さの文章です。\n", category: extra.category || "tips", published: true, created_at: extra.created_at || "2026-11-12T00:00:00Z", updated_at: extra.updated_at || "2026-11-12T00:00:00Z", cover_url: extra.cover_url || null, cover_alt: extra.cover_alt });
const db = [
  post("ja", "live-one", { title: "ライブ記事" }),
  post("en", "live-one", { title: "English title", body: "An English article body.\n" }),
  post("th", "live-one", { title: "บทความไทย", body: "เนื้อหาภาษาไทยที่ยาวพอ\n" }),
  post("zh", "live-one", { title: "中文标题", body: "这是一段中文正文。\n" }),
  post("ko", "live-ko", { title: "한국어 기사", body: "한국어 본문입니다. 충분히 깁니다.\n" }),
  post("ru", "live-ru", { title: "Русская статья", body: "Русский текст статьи, достаточно длинный.\n" }),
];
const catalog = [
  { lang: "ja", slug: "live-one", title: "STATIC SHOULD LOSE", excerpt: "s", category: "tips", published: true, created_at: "2026-11-01T00:00:00Z" },
  { lang: "ko", slug: "live-one", title: "한국어 정적", excerpt: "s", category: "tips", published: true, created_at: "2026-11-11T00:00:00Z" },
  { lang: "ru", slug: "live-one", title: "Русский статический", excerpt: "s", category: "tips", published: true, created_at: "2026-11-11T00:00:00Z" },
  { lang: "ja", slug: "static-only", title: "静的だけ", excerpt: "only the file", category: "theory", published: true, created_at: "2026-11-10T00:00:00Z" },
];
const fetchImpl = async (url) => {
  const u = String(url);
  const slug = /slug=eq\.([^&]+)/.exec(u), lang = /lang=eq\.([^&]+)/.exec(u);
  let rows = db;
  if (slug) rows = rows.filter(p => p.slug === decodeURIComponent(slug[1]));
  if (lang) rows = rows.filter(p => p.lang === decodeURIComponent(lang[1]));
  return { ok: true, json: async () => rows };
};
const opts = { catalog };
const alts = (html) => [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(m => m[1] + "=" + m[2]);

ok("the default 404 page is still the Chinese one", notFoundHtml() === notFoundHtml("zh") && notFoundHtml().includes('<html lang="zh-Hans">') && notFoundHtml().includes("/blog/ja/") && !notFoundHtml().includes('id="root"'));
ok("a Japanese 404 does not claim zh-Hans", notFoundHtml("ja").includes('<html lang="ja">') && !notFoundHtml("ja").includes('lang="zh-Hans"') && notFoundHtml("ko").includes('<html lang="ko">') && notFoundHtml("ru").includes('<html lang="ru">'));

const missing = await serveBlog({ lang: "ja", rest: "no-such-article.html" }, fetchImpl, opts);
ok("unknown ja article is 404 in Japanese", missing.status === 404 && missing.body.includes('<html lang="ja">') && !missing.body.includes('lang="zh-Hans"') && missing.headers["content-language"] === "ja" && missing.headers["x-robots-tag"] === "noindex");

for (const rest of ["live-one.html", "live-one", "live-one/", "live-one.html/"]) {
  const out = await serveBlog({ lang: "ja", rest }, fetchImpl, opts);
  ok("ja " + rest + " is the live article", out.status === 200 && out.body.includes("<h1>ライブ記事</h1>") && out.body.includes('<html lang="ja">') && out.headers["content-language"] === "ja");
}
const page = await serveBlog({ lang: "ja", rest: "live-one.html" }, fetchImpl, opts);
ok("canonical, og:locale and x-default", page.body.includes('rel="canonical" href="' + SITE + '/blog/ja/live-one.html"') && page.body.includes('property="og:locale" content="ja_JP"') && page.body.includes('hreflang="x-default" href="' + SITE + '/blog/en/live-one.html"'));
const alt = alts(page.body);
ok("hreflang lists every sibling that exists", ["ja", "en", "th", "zh-Hans", "ko", "ru", "x-default"].every(l => alt.some(a => a.startsWith(l + "="))) && alt.filter(a => a.startsWith("ja=")).length === 1, alt.join(" "));
ok("the static catalog does not replace the database title", page.body.includes("ライブ記事") && !page.body.includes("STATIC SHOULD LOSE"));

const ko = await serveBlog({ lang: "ko", rest: "live-ko" }, fetchImpl, opts);
const ru = await serveBlog({ lang: "ru", rest: "live-ru/" }, fetchImpl, opts);
ok("ko and ru articles use their own language", ko.status === 200 && ko.body.includes('<html lang="ko">') && ko.body.includes('og:locale" content="ko_KR"') && ru.status === 200 && ru.body.includes('<html lang="ru">') && ru.body.includes('og:locale" content="ru_RU"'));

const idx = await serveBlog({ lang: "ja" }, fetchImpl, opts);
ok("the ja index lists the new row and the static-only row", idx.status === 200 && idx.headers["content-language"] === "ja" && idx.body.includes('<html lang="ja">') && idx.body.includes("/blog/ja/live-one.html") && idx.body.includes("/blog/ja/static-only.html") && idx.body.includes("ライブ記事") && idx.body.includes("静的だけ") && !idx.body.includes("STATIC SHOULD LOSE"));
ok("the same slug is one card", (idx.body.match(/class="card" href="[^"]*\/blog\/ja\/live-one\.html"/g) || []).length === 1);
const feed = await serveBlog({ lang: "ja", rest: "feed.xml" }, fetchImpl, opts);
ok("the ja feed is RSS and names both", feed.status === 200 && feed.headers["content-type"].includes("rss") && feed.body.includes("<language>ja</language>") && feed.body.includes("/blog/ja/live-one.html") && feed.body.includes("/blog/ja/static-only.html") && feed.body.includes("ライブ記事") && !feed.body.includes("STATIC SHOULD LOSE"));

const redir = await serveBlog({ lang: "ja", rest: "static-only" }, fetchImpl, opts);
const redirSlash = await serveBlog({ lang: "ja", rest: "static-only/" }, fetchImpl, opts);
const htmlHit = await serveBlog({ lang: "ja", rest: "static-only.html" }, fetchImpl, opts);
ok("an extension-less static article redirects to its file", redir.status === 301 && redir.headers.location === SITE + "/blog/ja/static-only.html" && redirSlash.status === 301 && redirSlash.headers.location === redir.headers.location);
ok("the .html address is not redirected (that would loop)", htmlHit.status === 404 && !htmlHit.headers.location && htmlHit.body.includes('<html lang="ja">'));

const sm = await serveBlogSitemap(fetchImpl, opts);
ok("sitemap-blog names the new ja article, the static-only one, and the index", sm.status === 200 && sm.body.includes(SITE + "/blog/ja/live-one.html") && sm.body.includes(SITE + "/blog/ja/static-only.html") && sm.body.includes("<loc>" + SITE + "/blog/ja/</loc>") && sm.body.includes('hreflang="ko"') && sm.body.includes('hreflang="x-default" href="' + SITE + "/blog/en/live-one.html\""));

const empty = await serveBlog({ lang: "ja" }, async () => ({ ok: true, json: async () => [] }), { catalog: [] });
ok("ja index with nothing at all is still 404, in Japanese", empty.status === 404 && empty.body.includes('<html lang="ja">') && !empty.body.includes('class="card"'));
const thEmpty = await serveBlog({ lang: "th" }, async () => ({ ok: true, json: async () => [] }), { catalog: [] });
ok("an empty Thai index is still 200", thEmpty.status === 200);

const down = await serveBlog({ lang: "ja" }, async () => { throw new Error("offline"); }, opts);
ok("if the database is down the catalog still fills the ja index", down.status === 200 && down.body.includes("/blog/ja/static-only.html") && down.body.includes("静的だけ"));

ok("a database row sorts ahead of an older static sibling of another slug", rowsForLang("ja", db, catalog).map(p => p.slug).join(",") === "live-one,static-only");

const withAlt = articleHtml(post("ja", "cover", { title: "題", cover_url: "https://example.com/c.jpg", cover_alt: "鍵盤の写真" }), { ja: post("ja", "cover") });
const noAlt = articleHtml(post("ja", "cover", { title: "題", cover_url: "https://example.com/c.jpg" }), { ja: post("ja", "cover") });
ok("cover alt is used when set, and the title remains the alt when it is not", withAlt.includes('alt="鍵盤の写真"') && noAlt.includes('alt="題"') && !noAlt.includes("鍵盤"));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-strip-"));
fs.mkdirSync(path.join(tmp, "ja", "page", "2"), { recursive: true });
fs.mkdirSync(path.join(tmp, "th"), { recursive: true });
fs.writeFileSync(path.join(tmp, "ja", "index.html"), "index");
fs.writeFileSync(path.join(tmp, "ja", "feed.xml"), "feed");
fs.writeFileSync(path.join(tmp, "ja", "page", "2", "index.html"), "page");
fs.writeFileSync(path.join(tmp, "ja", "piano-posture.html"), "article");
fs.writeFileSync(path.join(tmp, "th", "index.html"), "th-index");
stripDist(tmp);
ok("dist drops the ja shell and keeps the article and the Thai index", !fs.existsSync(path.join(tmp, "ja", "index.html")) && !fs.existsSync(path.join(tmp, "ja", "feed.xml")) && !fs.existsSync(path.join(tmp, "ja", "page")) && fs.readFileSync(path.join(tmp, "ja", "piano-posture.html"), "utf8") === "article" && fs.readFileSync(path.join(tmp, "th", "index.html"), "utf8") === "th-index");
ok("the repo's Japanese index and an article file are still there", fs.existsSync(path.join(ROOT, "blog/ja/index.html")) && fs.existsSync(path.join(ROOT, "blog/ja/practice-15-minutes-5-methods.html")));

const admin = fs.readFileSync(path.join(ROOT, "AdminBlog.tsx"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-blog-cover-alt-migration.sql"), "utf8");
ok("the admin form has a cover description and retries without the column", admin.includes("data-blog-cover-alt") && admin.includes("cover_alt") && /cover_alt\/i/.test(admin));
ok("the cover-alt SQL is additive and not applied", sql.includes("WRITTEN, NOT APPLIED") && /add column if not exists cover_alt text/i.test(sql) && !/drop column/i.test(sql) && !/drop table/i.test(sql));

console.log(fail ? fail + " FAIL / " + n : "ALL PASS " + n);
process.exit(fail ? 1 : 0);
