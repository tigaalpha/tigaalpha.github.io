// Chinese article raw HTML, without touching the live database or the committed blog files.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { articleHtml } from "./build-blog-pages.mjs";
import { fromQuery, notFoundHtml, parseBlogPath, pickPost, sitemapBlogXml } from "./blog-paths.mjs";
import { serveBlog, serveBlogSitemap } from "./blog-live.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0, fail = 0;
const ok = (name, cond) => { n++; if (!cond) { fail++; console.log("FAIL " + name); } else console.log("ok " + name); };

const kept = path.join(ROOT, "blog/zh/music-event-sponsorship-proposal-zh.html");
const before = fs.statSync(kept).mtimeMs;
const old = fs.readFileSync(kept, "utf8");
ok("old committed page is Chinese HTML", /<html lang="zh-Hans">/.test(old) && old.includes("BlogPosting") && /<h1>/.test(old) && !old.includes('id="root"'));
const keptTh = path.join(ROOT, "blog/th/tiga-alpha-a440-concert-pitch.html");
const keptEn = path.join(ROOT, "blog/en/what-is-tiga-alpha.html");
const oldTh = fs.readFileSync(keptTh, "utf8");
const oldEn = fs.readFileSync(keptEn, "utf8");
ok("old Thai page is Thai HTML", /<html lang="th">/.test(oldTh) && oldTh.includes("BlogPosting") && !oldTh.includes('id="root"'));
ok("old English page is English HTML", /<html lang="en">/.test(oldEn) && oldEn.includes("BlogPosting") && !oldEn.includes('id="root"'));

const zh = {
  lang: "zh", slug: "mechanical-music-box-how-it-plays-zh", published: true, category: "theory",
  title: "八音盒如何发声：滚筒、音梳与机械旋律",
  excerpt: "滚筒上的针拨动音梳。",
  body: "## 发声原理\n\n滚筒转动时，针拨动金属音梳。\n\n### 听的时候\n\n1. 先听整段旋律\n2. 再看滚筒上的针\n\n- 音梳越长，声音越低\n",
  created_at: "2026-11-08T20:31:07.968549+00:00", updated_at: "2026-11-08T20:31:07.806+00:00", cover_url: "",
};
const en = { ...zh, lang: "en", title: "How a mechanical music box plays", excerpt: "Pins on a cylinder pluck a comb.", body: "A cylinder plucks a metal comb.\n" };
const html = articleHtml(zh, { zh, en });
ok("dynamic page language is zh-Hans", /<html lang="zh-Hans">/.test(html));
ok("own title", html.includes("<title>八音盒如何发声：滚筒、音梳与机械旋律 | TIGA ALPHA</title>"));
ok("own h1", html.includes("<h1>八音盒如何发声：滚筒、音梳与机械旋律</h1>"));
ok("canonical is the stable html address", html.includes('rel="canonical" href="https://www.tigaalpha.com/blog/zh/mechanical-music-box-how-it-plays-zh.html"'));
ok("article body is in the raw html", html.includes("滚筒转动时，针拨动金属音梳") && html.includes("<h2>发声原理</h2>") && html.includes("<h3>听的时候</h3>") && html.includes("<ol>") && html.includes("<ul>"));
ok("BlogPosting in Chinese", /"@type":"BlogPosting"/.test(html) && html.includes('"inLanguage":"zh-Hans"'));
ok("not the app shell", !html.includes('id="root"') && !html.includes("<html lang=\"en\">"));
ok("english alternate is linked", html.includes('hreflang="en" href="https://www.tigaalpha.com/blog/en/mechanical-music-box-how-it-plays-zh.html"'));
ok("same bytes whoever asks", articleHtml(zh, { zh }) === articleHtml(zh, { zh }));
const thPost = { lang: "th", slug: "tiga-alpha-a440-concert-pitch", published: true, category: "story", title: "ความถี่มาตรฐาน A440", excerpt: "โน้ตลา", body: "โน้ตลาอยู่ที่ 440 เฮิรตซ์\n", created_at: "2026-01-01T00:00:00+00:00", updated_at: "2026-01-01T00:00:00+00:00", cover_url: "" };
const thHtml = articleHtml(thPost, { th: thPost });
ok("thai fixture is Thai HTML", /<html lang="th">/.test(thHtml) && thHtml.includes("BlogPosting") && thHtml.includes("โน้ตลาอยู่ที่ 440") && !thHtml.includes('id="root"'));
const enHtml = articleHtml(en, { en });
ok("english fixture is English HTML", /<html lang="en">/.test(enHtml) && enHtml.includes("BlogPosting") && enHtml.includes("How a mechanical music box plays") && !enHtml.includes('id="root"'));

ok("short address keeps the full slug and hints Chinese", (() => {
  const p = parseBlogPath("/blog/mechanical-music-box-how-it-plays-zh");
  return p.kind === "article" && p.slug === "mechanical-music-box-how-it-plays-zh" && p.lang === "zh" && p.hint === true;
})());
ok("html address is Chinese and not a hint", (() => {
  const p = parseBlogPath("/blog/zh/mechanical-music-box-how-it-plays-zh.html");
  return p.kind === "article" && p.lang === "zh" && p.slug === "mechanical-music-box-how-it-plays-zh" && p.hint === false;
})());
ok("language index is not an article", parseBlogPath("/blog/zh").kind === "index" && parseBlogPath("/blog/th/").kind === "index");
ok("fake slug is bad", parseBlogPath("/blog/zzz-nonexistent").kind === "bad" || parseBlogPath("/blog/Not_A_Slug").kind === "bad");
ok("a nested path is not one article", parseBlogPath("/blog/zh/a/b.html").kind !== "article");
ok("app paths are ignored", parseBlogPath("/").kind === "ignore" && parseBlogPath("/landing/").kind === "ignore" && parseBlogPath("/songs/zh/twinkle.html").kind === "ignore");

ok("explicit Chinese path does not fall through to English", pickPost([en, zh], "zh", false).lang === "zh" && pickPost([en], "zh", false) === null);
ok("short address prefers the hinted language", pickPost([en, zh], "zh", true).lang === "zh");
ok("one published row is enough when there is no language", pickPost([zh], null, true).lang === "zh");

const fakeFetch = async (url) => ({ ok: true, json: async () => String(url).includes("mechanical-music-box") ? [zh, en] : [] });
ok("a nested path 404s", (await serveBlog({ lang: "zh", rest: "a/b.html" }, fakeFetch)).status === 404);
const live = await serveBlog({ slug: "mechanical-music-box-how-it-plays-zh" }, fakeFetch);
const live2 = await serveBlog({ lang: "zh", rest: "mechanical-music-box-how-it-plays-zh.html" }, fakeFetch);
ok("short url returns the Chinese article", live.status === 200 && live.body.includes("滚筒转动时") && live.headers["content-language"] === "zh-Hans");
ok("html url returns the same article", live2.status === 200 && live2.body === live.body);
ok("two callers get the same body", live.body === (await serveBlog({ slug: "mechanical-music-box-how-it-plays-zh" }, fakeFetch)).body);
const missing = await serveBlog({ slug: "zzz-nonexistent" }, fakeFetch);
ok("fake url is a real 404, not the app", missing.status === 404 && missing.body === notFoundHtml() && !missing.body.includes('id="root"') && missing.headers["x-robots-tag"] === "noindex");
const down = await serveBlog({ slug: "mechanical-music-box-how-it-plays-zh" }, async () => { throw new Error("offline"); });
ok("a failed read is 503 and not the app shell", down.status === 503 && !down.body.includes('id="root"'));
const indexFetch = async () => ({ ok: true, json: async () => [zh, en, { ...zh, slug: "second-zh-piece", title: "第二篇", excerpt: "อีกเรื่อง" }] });
const idx = await serveBlog({ slug: "zh" }, indexFetch);
ok("language index lists every published post in that language", idx.status === 200 && idx.body.includes("/blog/zh/mechanical-music-box-how-it-plays-zh.html") && idx.body.includes("/blog/zh/second-zh-piece.html") && !idx.body.includes("How a mechanical music box plays") && !idx.body.includes('id="root"') && idx.headers["content-language"] === "zh-Hans");
ok("a feed is real rss", (await serveBlog({ lang: "zh", rest: "feed.xml" }, indexFetch)).status === 200 && (await serveBlog({ lang: "zh", rest: "feed.xml" }, indexFetch)).headers["content-type"].includes("rss"));

const sm = await serveBlogSitemap(async () => ({ ok: true, json: async () => [zh, en] }));
ok("fresh sitemap names the Chinese canonical url", sm.status === 200 && sm.body.includes("https://www.tigaalpha.com/blog/zh/mechanical-music-box-how-it-plays-zh.html") && sm.body.includes("<lastmod>2026-11-08</lastmod>"));
ok("sitemap helper escapes nothing it should not invent", sitemapBlogXml([{ slug: "a-zh", lang: "zh", published: true, updated_at: "2026-11-08" }], "https://www.tigaalpha.com").includes("/blog/zh/a-zh.html"));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-zh-"));
const fixture = path.join(tmp, "posts.json");
fs.writeFileSync(fixture, JSON.stringify([zh, en]));
execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_FIXTURE: fixture, BLOG_OUT: path.join(tmp, "out"), SITE_URL: "https://www.tigaalpha.com" }, stdio: "pipe" });
const baked = fs.readFileSync(path.join(tmp, "out/zh/mechanical-music-box-how-it-plays-zh.html"), "utf8");
ok("on-demand html matches the static builder", baked === html);
ok("import did not rewrite the committed Chinese page", fs.statSync(kept).mtimeMs === before && fs.readFileSync(kept, "utf8") === old);
ok("import did not rewrite the committed Thai or English page", fs.readFileSync(keptTh, "utf8") === oldTh && fs.readFileSync(keptEn, "utf8") === oldEn);

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const sources = vercel.rewrites.map(r => r.source);
ok("blog rewrites sit before the app rewrite", sources.indexOf("/blog/:lang/:rest*") < sources.findIndex(s => s.includes("index.html") || vercel.rewrites.find(r => r.source === s).destination === "/index.html"));
const app = vercel.rewrites.find(r => r.destination === "/index.html");
ok("the app rewrite is still there and does not drop api", app && app.source.includes("api/") && !app.source.startsWith("/(.*)"));
ok("robots generator names the fresh sitemap", fs.readFileSync(path.join(ROOT, "scripts/build-song-pages.mjs"), "utf8").includes("Sitemap: ${SITE}/sitemap-blog.xml"));
ok("404 page does not name a plan or a rating", !/aggregateRating|\bPro\b/.test(notFoundHtml()));

console.log(fail ? `${fail} FAIL / ${n}` : `ALL PASS ${n}`);
process.exit(fail ? 1 : 0);
