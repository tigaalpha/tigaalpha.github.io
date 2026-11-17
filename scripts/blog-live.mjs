// On-demand blog HTML. Reads published rows only. Never writes a post, a slug, or a queue.
import fs from "node:fs";
import { articleHtml, feedXml, indexHtml, relatedPosts } from "./build-blog-pages.mjs";
import { BLOG_LANGS, STATIC_BLOG_LANGS, fromQuery, notFoundHtml, pickPost, sitemapBlogBuild } from "./blog-paths.mjs";

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

/* Reading a list of rows. With ~11,000 translated articles (rows flagged live_only: no static file, served from here) the table holds 15,000+ published rows, so a list is read in pages of 500
   and the pages are fetched TOGETHER, not one after the other (sequentially the sitemap alone was ~30 round trips, about 10 s, close to what a Vercel function may take).
   The first page asks PostgREST for the total ("Prefer: count=exact" answers "Content-Range: 0-499/15234"); with the total known the other pages go out six at a time. An answer without
   a Content-Range total (a test double has no headers at all) falls back to the old sequential loop, which stops at the first short page. The guard is 200 pages = 100,000 rows (it was 40 pages = 20,000). */
const LIST_COLS = "slug,lang,title,excerpt,category,created_at,updated_at,published";
const META_COLS = "slug,lang,published,created_at,updated_at";
const LIST_PAGE = 500, LIST_MAX_PAGES = 200, LIST_PARALLEL = 6;

// "0-499/15234" -> 15234. null when there is no header object, no Content-Range, or no number after the slash ("0-499/*").
export function totalFromContentRange(r) {
  try {
    const raw = r && r.headers && typeof r.headers.get === "function" ? r.headers.get("content-range") : null;
    const m = raw ? /\/(\d+)\s*$/.exec(String(raw)) : null;
    return m ? Number(m[1]) : null;
  } catch { return null; }
}

async function readListPage(url, fetchImpl, wantTotal) {
  const headers = { apikey: BLOG_API_KEY, Authorization: "Bearer " + BLOG_API_KEY, Accept: "application/json" };
  if (wantTotal) headers.Prefer = "count=exact";
  const r = await fetchImpl(url, { headers });
  if (!r.ok) throw new Error("blog list " + r.status);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("blog list shape");
  return { data, total: wantTotal ? totalFromContentRange(r) : null };
}

// fn(item) for every item, `limit` at a time; the results come back in the order of the items. The first failure stops new work and rejects.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0, failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i]); } catch (e) { failed = true; throw e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// pageUrl(offset) -> the URL of the page that starts at that offset. Throws like the old loops did ("blog list <status>" / "blog list shape").
export async function fetchAllPages(pageUrl, fetchImpl, opts = {}) {
  const page = opts.page || LIST_PAGE, maxPages = opts.maxPages || LIST_MAX_PAGES, parallel = opts.parallel || LIST_PARALLEL;
  const first = await readListPage(pageUrl(0), fetchImpl, true);
  if (first.data.length < page) return first.data;
  if (first.total != null) {
    const pages = Math.min(Math.ceil(first.total / page), maxPages), offsets = [];
    for (let i = 1; i < pages; i++) offsets.push(i * page);
    const rest = await mapLimit(offsets, parallel, async (off) => (await readListPage(pageUrl(off), fetchImpl, false)).data);
    return [].concat(first.data, ...rest);
  }
  let all = first.data;
  for (let n = 1; n < maxPages; n++) {
    const { data } = await readListPage(pageUrl(n * page), fetchImpl, false);
    all = all.concat(data);
    if (data.length < page) break;
  }
  return all;
}

export function fetchLangRows(lang, fetchImpl) {
  return fetchAllPages((off) => `${BLOG_API_URL}/rest/v1/blog_posts?select=${LIST_COLS}&published=eq.true&lang=eq.${encodeURIComponent(lang)}&order=created_at.desc,id.asc&limit=${LIST_PAGE}&offset=${off}`, fetchImpl);
}

export function fetchPublishedMeta(fetchImpl) {
  return fetchAllPages((off) => `${BLOG_API_URL}/rest/v1/blog_posts?select=${META_COLS}&published=eq.true&order=created_at.desc,id.asc&limit=${LIST_PAGE}&offset=${off}`, fetchImpl);
}

/* The "related articles" box of ONE article page must not download the whole language (a language holds ~1,300 rows once the translations are in). At most two small queries of 8 rows:
   the newest published articles of the same language and category (not this one), and, only when fewer than 6 came back, the newest of the other categories. relatedPosts() stays the arranger
   (same category first, newest first, at most 5), so the page has the same shape as before; this only decides which rows it gets to choose from. A failure of the first query throws (the caller
   falls back to the catalog), a failure of the second keeps the first answer. */
const RELATED_LIMIT = 8, RELATED_ENOUGH = 6;
export async function fetchRelated(lang, category, slug, fetchImpl) {
  const base = `${BLOG_API_URL}/rest/v1/blog_posts?select=${LIST_COLS}&published=eq.true&lang=eq.${encodeURIComponent(lang)}&slug=neq.${encodeURIComponent(slug)}`;
  const tail = `&order=created_at.desc,id.asc&limit=${RELATED_LIMIT}`;
  const get = async (url) => (await readListPage(url, fetchImpl, false)).data;
  const same = category ? await get(`${base}&category=eq.${encodeURIComponent(category)}${tail}`) : [];
  if (same.length >= RELATED_ENOUGH) return same;
  let others = [];
  try { others = await get(`${base}${category ? `&category=neq.${encodeURIComponent(category)}` : ""}${tail}`); } catch { /* the same-category rows are an answer already */ }
  return same.concat(others);
}

/* ja / ko / ru / hi / es / fr / ar articles that shipped in blog-src/ (STATIC_BLOG_LANGS) are real HTML files, so Vercel serves /blog/<lang>/<slug>.html before this function.
   Their index.html, feed.xml and page/N are left in the repo (GitHub Pages) but stripped from dist/ (scripts/copy-seo-to-dist.mjs), so on
   tigaalpha.com those three URLs reach here. The function does not read blog-src (the bundle cannot hold the bodies). It reads
   api/blog-live-catalog.json — titles only, written by the build — and merges it with published rows: a database row wins on the same
   (lang, slug), a slug that exists only as a file is still listed, and a slug published after the build (no file yet) is served as HTML
   for the .html address, the address without .html, and the trailing-slash form, the same as th / en / zh.
   With no catalog and no rows, the index of a static language is 404 + noindex, never an empty 200 list. Arabic pages come out right-to-left (dir="rtl") from the same page code. */
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
  for (const row of rows || []) if (row && row.slug === post.slug && BLOG_LANGS.includes(row.lang) && row.published !== false) set[row.lang] = row;
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
  try { related = relatedPosts(rowsForLang(post.lang, await fetchRelated(post.lang, post.category, post.slug, fetchImpl), catalog), post); }
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
    const built = sitemapBlogBuild(posts, BLOG_SITE, opts && opts.sitemapLimits);
    const headers = {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=120",
      "x-blog-source": "live",
    };
    if (built.dropped) {
      // the file would pass the 50,000-url / 50 MB limit of one sitemap: the oldest articles are left out (see sitemapBlogBuild) and the function log says so
      headers["x-blog-sitemap-dropped"] = String(built.dropped);
      console.warn(`blog-sitemap: ${built.dropped} of ${built.total} article urls left out (limit ${built.maxUrls} urls / ${built.maxBytes} bytes in one file); split sitemap-blog.xml into parts`);
    }
    return result(200, built.xml, headers);
  } catch {
    return result(503, "", { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-blog-source": "live" });
  }
}

export function writeNode(res, out) {
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers)) if (v) res.setHeader(k, v);
  res.end(out.body || "");
}
