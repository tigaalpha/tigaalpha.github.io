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

/* ja / ko / ru articles that shipped in blog-src/ are real HTML files, so Vercel serves /blog/<lang>/<slug>.html before this function.
   Their index.html, feed.xml and page/N are left in the repo (GitHub Pages) but stripped from dist/ (scripts/copy-seo-to-dist.mjs), so on
   tigaalpha.com those three URLs reach here. The function does not read blog-src (the bundle cannot hold the bodies). It reads
   api/blog-live-catalog.json — titles only, written by the build — and merges it with published rows: a database row wins on the same
   (lang, slug), a slug that exists only as a file is still listed, and a slug published after the build (no file yet) is served as HTML
   for the .html address, the address without .html, and the trailing-slash form, the same as th / en / zh.
   With no catalog and no rows, a ja / ko / ru index is 404 + noindex, never an empty 200 list. */
const CATALOG_FILE = new URL("../api/blog-live-catalog.json", import.meta.url);
const SLUG_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const byTime = (a, b) => (new Date(b.created_at) - new Date(a.created_at)) || String(a.slug).localeCompare(String(b.slug));

export function readLiveCatalog(file = CATALOG_FILE) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(data)) return [];
    return data.filter(p => p && STATIC_BLOG_LANGS.includes(p.lang) && typeof p.slug === "string" && SLUG_OK.test(p.slug) && p.published !== false);
  } catch { return []; }
}

// Tests pass opts.catalog. On Vercel the build's catalog is read. Anywhere else an empty list keeps the old "no rows → 404" behaviour.
export function activeCatalog(opts) {
  if (opts && Array.isArray(opts.catalog)) return opts.catalog;
  if (opts && opts.catalog === false) return [];
  if (process.env.BLOG_LIVE_CATALOG === "0") return [];
  if (process.env.BLOG_LIVE_CATALOG) return readLiveCatalog(process.env.BLOG_LIVE_CATALOG);
  if (process.env.VERCEL) return readLiveCatalog();
  return [];
}

export function rowsForLang(lang, dbRows, catalog) {
  const db = (dbRows || []).filter(p => p && p.lang === lang && p.published !== false && p.slug);
  const have = new Set(db.map(p => p.slug));
  const extra = (catalog || []).filter(p => p && p.lang === lang && p.slug && p.published !== false && !have.has(p.slug));
  return db.concat(extra).sort(byTime);
}

export function mergeLiveRows(dbRows, catalog) {
  const db = (dbRows || []).filter(p => p && p.published !== false && p.slug && p.lang);
  const have = new Set(db.map(p => p.lang + "/" + p.slug));
  const extra = (catalog || []).filter(p => p && p.lang && p.slug && p.published !== false && !have.has(p.lang + "/" + p.slug));
  return db.concat(extra);
}

function contentLanguage(lang) {
  if (lang === "zh") return "zh-Hans";
  if (BLOG_LANGS.includes(lang)) return lang;
  return "";
}
function miss(lang) {
  const h = { ...MISS };
  const cl = contentLanguage(lang);
  if (cl) h["content-language"] = cl;
  return h;
}
function catalogHit(catalog, parsed) {
  if (!parsed || !parsed.lang || !parsed.slug) return null;
  return (catalog || []).find(c => c.lang === parsed.lang && c.slug === parsed.slug) || null;
}
function redirectToFile(lang, slug) {
  return result(301, "", {
    location: `${BLOG_SITE}/blog/${lang}/${encodeURIComponent(slug)}.html`,
    "cache-control": "no-store",
    "x-blog-source": "live",
  });
}
function siblingSet(rows, post, catalog) {
  const set = {};
  for (const row of rows || []) if (row && row.slug === post.slug && BLOG_LANGS.includes(row.lang)) set[row.lang] = row;
  for (const c of catalog || []) if (c && c.slug === post.slug && BLOG_LANGS.includes(c.lang) && !set[c.lang]) set[c.lang] = c;
  if (!set[post.lang]) set[post.lang] = post;
  return set;
}

// Same HTML for every caller. The user agent is not an input.
export async function serveBlog(query, fetchImpl, opts) {
  const catalog = activeCatalog(opts);
  const parsed = fromQuery(query);
  if (parsed.kind === "index" || parsed.kind === "feed") {
    let db = [], failed = false;
    try { db = await fetchLangRows(parsed.lang, fetchImpl); }
    catch { failed = true; }
    const list = rowsForLang(parsed.lang, failed ? [] : db, catalog);
    if (!list.length && failed) return result(503, notFoundHtml(parsed.lang), miss(parsed.lang));
    if (!list.length && STATIC_BLOG_LANGS.includes(parsed.lang)) return result(404, notFoundHtml(parsed.lang), miss(parsed.lang));
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
      "content-language": contentLanguage(parsed.lang),
      "cache-control": "public, max-age=120, s-maxage=120",
      "x-blog-source": "live",
    });
  }
  if (parsed.kind !== "article") return result(404, notFoundHtml(parsed.lang), miss(parsed.lang));
  let rows;
  try { rows = await fetchSlug(parsed.slug, fetchImpl); }
  catch {
    if (!parsed.html && catalogHit(catalog, parsed)) return redirectToFile(parsed.lang, parsed.slug);
    return result(503, notFoundHtml(parsed.lang), miss(parsed.lang));
  }
  const post = pickPost(rows, parsed.lang, parsed.hint);
  if (!post) {
    // A committed article has no database row yet. Send the extension-less address to the file Vercel already has.
    // The .html address itself is not redirected: that file is served before this function, and a redirect would loop if it were missing.
    if (!parsed.html && catalogHit(catalog, parsed)) return redirectToFile(parsed.lang, parsed.slug);
    return result(404, notFoundHtml(parsed.lang), miss(parsed.lang));
  }
  const set = siblingSet(rows, post, catalog);
  let related = [];
  try { related = relatedPosts(rowsForLang(post.lang, await fetchLangRows(post.lang, fetchImpl), catalog), post); }
  catch { related = relatedPosts(rowsForLang(post.lang, [], catalog), post); }
  const html = articleHtml(post, set, related);
  return result(200, html, {
    "content-type": HTML,
    "content-language": contentLanguage(post.lang),
    "cache-control": "public, max-age=120, s-maxage=120",
    "x-blog-source": "live",
  });
}

export async function serveBlogSitemap(fetchImpl, opts) {
  const catalog = activeCatalog(opts);
  try {
    const posts = mergeLiveRows(await fetchPublishedMeta(fetchImpl), catalog);
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
