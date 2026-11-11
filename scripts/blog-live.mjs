// On-demand blog HTML. Reads published rows only. Never writes a post, a slug, or a queue.
import fs from "node:fs";
import { articleHtml, feedXml, indexHtml, relatedPosts } from "./build-blog-pages.mjs";
import { BLOG_LANGS, STATIC_BLOG_LANGS, fromQuery, notFoundHtml, pickPost, sitemapBlogXml } from "./blog-paths.mjs";

const src = fs.readFileSync(new URL("../supabase-client.ts", import.meta.url), "utf8");
export const BLOG_API_URL = (/SUPABASE_URL = "([^"]+)"/.exec(src) || [])[1];
export const BLOG_API_KEY = (/SUPABASE_ANON_KEY = "([^"]+)"/.exec(src) || [])[1];
export const BLOG_SITE = (process.env.SITE_URL || "https://www.tigaalpha.com").replace(/\/+$/, "");

const HTML = "text/html; charset=utf-8";
const MISS = { "content-type": HTML, "cache-control": "no-store", "x-blog-source": "live", "x-robots-tag": "noindex" };

function result(status, body, headers) {
  return { status, body, headers };
}

export async function fetchSlug(slug, fetchImpl) {
  const url = `${BLOG_API_URL}/rest/v1/blog_posts?select=*&published=eq.true&slug=eq.${encodeURIComponent(slug)}`;
  const r = await fetchImpl(url, { headers: { apikey: BLOG_API_KEY, Authorization: "Bearer " + BLOG_API_KEY, Accept: "application/json" } });
  if (!r.ok) throw new Error("blog read " + r.status);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("blog read shape");
  return data;
}

export async function fetchLangRows(lang, fetchImpl) {
  const page = 500;
  let off = 0, all = [];
  for (let guard = 0; guard < 40; guard++) {
    const url = `${BLOG_API_URL}/rest/v1/blog_posts?select=slug,lang,title,excerpt,category,created_at,updated_at,published&published=eq.true&lang=eq.${encodeURIComponent(lang)}&order=created_at.desc,id.asc&limit=${page}&offset=${off}`;
    const r = await fetchImpl(url, { headers: { apikey: BLOG_API_KEY, Authorization: "Bearer " + BLOG_API_KEY, Accept: "application/json" } });
    if (!r.ok) throw new Error("blog list " + r.status);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error("blog list shape");
    all = all.concat(data);
    if (data.length < page) break;
    off += page;
  }
  return all;
}

export async function fetchPublishedMeta(fetchImpl) {
  const page = 500;
  let off = 0, all = [];
  for (let guard = 0; guard < 40; guard++) {
    const url = `${BLOG_API_URL}/rest/v1/blog_posts?select=slug,lang,published,created_at,updated_at&published=eq.true&order=created_at.desc,id.asc&limit=${page}&offset=${off}`;
    const r = await fetchImpl(url, { headers: { apikey: BLOG_API_KEY, Authorization: "Bearer " + BLOG_API_KEY, Accept: "application/json" } });
    if (!r.ok) throw new Error("blog list " + r.status);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error("blog list shape");
    all = all.concat(data);
    if (data.length < page) break;
    off += page;
  }
  return all;
}

/* ja / ko / ru (owner 2026-11-11): their articles are committed files (blog-src/), NOT database rows, until supabase-blog-ja-ko-ru-migration.sql is applied.
   The build therefore writes a real blog/<lang>/index.html, page/N/index.html and feed.xml for them, and Vercel serves a file in dist/ BEFORE any rewrite, so this function is never asked for
   those URLs while the files exist. This function does NOT read blog-src at runtime on purpose: it is a serverless bundle that only includes supabase-client.ts (vercel.json "functions"),
   and a file that is not in the bundle cannot be read there. What it does if it IS reached for one of these indexes or feeds (a build that wrote no file, or a page number past the files):
   it lists the database rows, and when there are none it answers 404 + noindex, never an empty 200 list that search engines could keep in place of the real page.
   An article published in the database after the last build is still served here like any other language; the static index shows it at the next deploy. */
// Same HTML for every caller. The user agent is not an input.
export async function serveBlog(query, fetchImpl) {
  const parsed = fromQuery(query);
  if (parsed.kind === "index" || parsed.kind === "feed") {
    let list;
    try { list = await fetchLangRows(parsed.lang, fetchImpl); }
    catch { return result(503, notFoundHtml(), MISS); }
    if (!list.length && STATIC_BLOG_LANGS.includes(parsed.lang)) return result(404, notFoundHtml(), MISS);
    if (parsed.kind === "feed") {
      return result(200, feedXml(parsed.lang, list), {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control": "public, max-age=120, s-maxage=120",
        "x-blog-source": "live",
      });
    }
    const html = indexHtml(parsed.lang, list, parsed.page || 1);
    return result(200, html, {
      "content-type": HTML,
      "content-language": parsed.lang === "zh" ? "zh-Hans" : parsed.lang,
      "cache-control": "public, max-age=120, s-maxage=120",
      "x-blog-source": "live",
    });
  }
  if (parsed.kind !== "article") return result(404, notFoundHtml(), MISS);
  let rows;
  try { rows = await fetchSlug(parsed.slug, fetchImpl); }
  catch { return result(503, notFoundHtml(), MISS); }
  const post = pickPost(rows, parsed.lang, parsed.hint);
  if (!post) return result(404, notFoundHtml(), MISS);
  const set = {};
  for (const row of rows) if (BLOG_LANGS.includes(row.lang)) set[row.lang] = row;
  let related = [];
  try { related = relatedPosts(await fetchLangRows(post.lang, fetchImpl), post); }
  catch { related = []; }
  const html = articleHtml(post, set, related);
  return result(200, html, {
    "content-type": HTML,
    "content-language": post.lang === "zh" ? "zh-Hans" : post.lang,
    "cache-control": "public, max-age=120, s-maxage=120",
    "x-blog-source": "live",
  });
}

export async function serveBlogSitemap(fetchImpl) {
  try {
    const posts = await fetchPublishedMeta(fetchImpl);
    return result(200, sitemapBlogXml(posts, BLOG_SITE), {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=120",
      "x-blog-source": "live",
    });
  } catch {
    return result(503, "", { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-blog-source": "live" });
  }
}

export function writeNode(res, out) {
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers)) if (v) res.setHeader(k, v);
  res.end(out.body || "");
}
