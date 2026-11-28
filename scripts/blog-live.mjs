// On-demand blog HTML. Reads published rows only. Never writes a post, a slug, or a queue.
import fs from "node:fs";
import { articleHtml, feedXml, indexHtml, relatedPosts } from "./build-blog-pages.mjs";
import { BLOG_LANGS, STATIC_BLOG_LANGS, baseSlug, groupSlugs, sameGroup, blogSitemapIndexXml, fromQuery, notFoundHtml, pickPost, sitemapLangBuild, totalFromContentRange } from "./blog-paths.mjs";
export { totalFromContentRange };

const src = fs.readFileSync(new URL("../supabase-client.ts", import.meta.url), "utf8");
export const BLOG_API_URL = (/SUPABASE_URL = "([^"]+)"/.exec(src) || [])[1];
export const BLOG_API_KEY = (/SUPABASE_ANON_KEY = "([^"]+)"/.exec(src) || [])[1];
export const BLOG_SITE = (process.env.SITE_URL || "https://www.tigaalpha.com").replace(/\/+$/, "");

const HTML = "text/html; charset=utf-8";
const MISS = { "content-type": HTML, "cache-control": "no-store", "x-blog-source": "live", "x-robots-tag": "noindex" };
/* Cache policy of the live answers. The CDN keeps an answer for s-maxage and, after that, serves the stale copy once while it fetches a fresh one (stale-while-revalidate), so a crawler or a reader
   almost never waits for the database. An article changes only when its translation is fixed (rare), so it may live an hour at the edge; a list, a feed or a sitemap gains rows as articles are published,
   so it lives ten minutes. A 404 / 503 stays "no-store" (MISS above), so an article that is not published yet is never cached as missing. */
export const CACHE_ARTICLE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
export const CACHE_LIST = "public, max-age=120, s-maxage=600, stale-while-revalidate=3600";

function result(status, body, headers) {
  return { status, body, headers };
}

export async function fetchSlug(slug, fetchImpl, lang) {
  // one query for the whole translation group (<slug>, <slug>-<lang> ...), so the hreflang set is complete without a second request
  const url = `${BLOG_API_URL}/rest/v1/blog_posts?select=*&published=eq.true&slug=in.(${groupSlugs(slug, lang).map(encodeURIComponent).join(",")})`;
  const r = await fetchImpl(url, { headers: { apikey: BLOG_API_KEY, Authorization: "Bearer " + BLOG_API_KEY, Accept: "application/json" }, signal: AbortSignal.timeout(LIST_TIMEOUT_MS) });
  if (!r.ok) throw new Error("blog read " + r.status);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("blog read shape");
  return data;
}

/* Reading a list of rows. With ~18,000 translated articles (rows flagged live_only: no static file, served from here) the table holds 20,000+ published rows, so a list is read in pages of 1,000 (Supabase's default
   max-rows) and the pages are fetched TOGETHER, not one after the other (sequentially a full read was ~40 round trips, 1 s each at the origin).
   The first page asks PostgREST for the total ("Prefer: count=exact" answers "Content-Range: 0-999/20234"); with the total known the other pages go out eight at a time. The step between pages is what the first answer
   really held: a server that caps a page below the asked 1,000 (its own max-rows) is followed page by page, never skipped over. An answer without a Content-Range total (a test double has no headers at all) falls back to
   the old sequential loop, which stops at the first short page. The guard is 200 pages (it was 40 pages of 500 = 20,000 rows) and says so when it is hit.
   Every request has a deadline (LIST_TIMEOUT_MS): a Supabase that does not answer would otherwise hold the function until its maxDuration (30 s, vercel.json). A first page that comes back EMPTY while the total says there are
   rows is a failure (it throws, so the sitemap is a 503 and a language list falls back), never an empty list: an empty sitemap tells a crawler that every article is gone.
   What a function reads is also small by construction: a sitemap file reads only the rows of its own language (see sitemapLangBuild in blog-paths.mjs), never the whole table. */
const LIST_COLS = "slug,lang,title,excerpt,category,created_at,updated_at,published";
const META_COLS = "slug,lang,published,created_at,updated_at";
const LIST_PAGE = 1000, LIST_MAX_PAGES = 200, LIST_PARALLEL = 8;
export const LIST_TIMEOUT_MS = 8000, RELATED_TIMEOUT_MS = 3000;

async function readListPage(url, fetchImpl, wantTotal, signal) {
  const headers = { apikey: BLOG_API_KEY, Authorization: "Bearer " + BLOG_API_KEY, Accept: "application/json" };
  if (wantTotal) headers.Prefer = "count=exact";
  const r = await fetchImpl(url, { headers, signal: signal || AbortSignal.timeout(LIST_TIMEOUT_MS) });
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

// pageUrl(offset, limit) -> the URL of the page that starts at that offset. Throws like the old loops did ("blog list <status>" / "blog list shape" / "blog list empty").
export async function fetchAllPages(pageUrl, fetchImpl, opts = {}) {
  const page = opts.page || LIST_PAGE, maxPages = opts.maxPages || LIST_MAX_PAGES, parallel = opts.parallel || LIST_PARALLEL, ms = opts.timeoutMs || LIST_TIMEOUT_MS;
  const first = await readListPage(pageUrl(0, page), fetchImpl, true, AbortSignal.timeout(ms));
  const got = first.data.length;
  if (first.total != null) {
    if (first.total > 0 && !got) throw new Error(`blog list empty (${first.total} rows announced, none sent)`);
    if (got >= first.total) return first.data;
    const stride = got, wanted = Math.ceil(first.total / stride), pages = Math.min(wanted, maxPages), offsets = [];
    if (pages < wanted) console.warn(`blog list: ${first.total} rows need ${wanted} pages, only the first ${pages} are read (page guard)`);
    for (let i = 1; i < pages; i++) offsets.push(i * stride);
    const rest = await mapLimit(offsets, parallel, async (off) => (await readListPage(pageUrl(off, page), fetchImpl, false, AbortSignal.timeout(ms))).data);
    return [].concat(first.data, ...rest);
  }
  if (got < page) return first.data;
  let all = first.data, n = 1;
  for (; n < maxPages; n++) {
    const { data } = await readListPage(pageUrl(n * page, page), fetchImpl, false, AbortSignal.timeout(ms));
    all = all.concat(data);
    if (data.length < page) break;
  }
  if (n >= maxPages) console.warn(`blog list: ${maxPages} pages read and the last one was full: more rows may be left (page guard)`);
  return all;
}

export function fetchLangRows(lang, fetchImpl) {
  return fetchAllPages((off, limit) => `${BLOG_API_URL}/rest/v1/blog_posts?select=${LIST_COLS}&published=eq.true&lang=eq.${encodeURIComponent(lang)}&order=created_at.desc,id.asc&limit=${limit}&offset=${off}`, fetchImpl);
}

// The rows of ONE language, the five columns a sitemap needs, newest first: what a sitemap-blog-<lang>.xml is made of. No live_only filter: the file lists the rows that are files in the deploy and the live_only ones alike,
// and a database without that column (it answers 400 to a filter on it) needs no special case.
export function fetchLangMeta(lang, fetchImpl, readOpts) {
  return fetchAllPages((off, limit) => `${BLOG_API_URL}/rest/v1/blog_posts?select=${META_COLS}&published=eq.true&lang=eq.${encodeURIComponent(lang)}&order=created_at.desc,id.asc&limit=${limit}&offset=${off}`, fetchImpl, readOpts);
}

/* The "related articles" box of ONE article page must not download the whole language (a language holds ~1,300 rows once the translations are in). At most two small queries of 8 rows:
   the newest published articles of the same language and category (not this one), and, only when fewer than 6 came back, the newest of the other categories. relatedPosts() stays the arranger
   (same category first, newest first, at most 5), so the page has the same shape as before; this only decides which rows it gets to choose from. A failure of the first query throws (the caller
   falls back to the catalog), a failure of the second keeps the first answer. The box is a nicety, so both queries share ONE short deadline (RELATED_TIMEOUT_MS): a slow database costs the page
   3 seconds at most, and the page is served without the box. */
const RELATED_LIMIT = 8, RELATED_ENOUGH = 6;
export async function fetchRelated(lang, category, slug, fetchImpl, opts = {}) {
  const base = `${BLOG_API_URL}/rest/v1/blog_posts?select=${LIST_COLS}&published=eq.true&lang=eq.${encodeURIComponent(lang)}&slug=neq.${encodeURIComponent(slug)}`;
  const tail = `&order=created_at.desc,id.asc&limit=${RELATED_LIMIT}`;
  const signal = AbortSignal.timeout(opts.timeoutMs || RELATED_TIMEOUT_MS);
  const get = async (url) => (await readListPage(url, fetchImpl, false, signal)).data;
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
   With no catalog and no rows, the index of a static language (and of de, whose articles are all live_only rows) is 404 + noindex, never an empty 200 list. Arabic pages come out right-to-left (dir="rtl") from the same page code. */
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
  const set = {}, base = baseSlug(post.slug, post.lang);
  for (const row of rows || []) if (sameGroup(row, base) && BLOG_LANGS.includes(row.lang) && row.published !== false) set[row.lang] = row;
  for (const c of catalog || []) if (sameGroup(c, base) && BLOG_LANGS.includes(c.lang) && !set[c.lang]) set[c.lang] = c;
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
    if (!list.length && (STATIC_BLOG_LANGS.includes(parsed.lang) || parsed.lang === "de")) return result(404, notFoundHtml(parsed.lang), miss(parsed.lang));   // de has no committed article: until a row exists its index is a 404, like a source-file language
    if (parsed.kind === "feed") {
      return result(200, feedXml(parsed.lang, list), {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control": CACHE_LIST,
        "x-blog-source": "live",
      });
    }
    const html = indexHtml(parsed.lang, list, parsed.page || 1);
    return result(200, html, {
      "content-type": HTML,
      "content-language": contentLanguage(parsed.lang),
      "cache-control": CACHE_LIST,
      "x-blog-source": "live",
    });
  }
  if (parsed.kind !== "article") return result(404, notFoundHtml(parsed.lang), miss(parsed.lang));
  let rows;
  try { rows = await fetchSlug(parsed.slug, fetchImpl, parsed.lang); }
  catch {
    if (!parsed.html && catalogHit(catalog, parsed)) return redirectToFile(parsed.lang, parsed.slug);
    return result(503, notFoundHtml(parsed.lang), miss(parsed.lang));
  }
  const post = pickPost(rows.filter(r => r && r.slug === parsed.slug), parsed.lang, parsed.hint);   // exactly the rows the old single-slug query returned; the rest of the group only feeds the hreflang set
  if (!post) {
    // A committed article has no database row yet. Send the extension-less address to the file Vercel already has.
    // The .html address itself is not redirected: that file is served before this function, and a redirect would loop if it were missing.
    if (!parsed.html && catalogHit(catalog, parsed)) return redirectToFile(parsed.lang, parsed.slug);
    return result(404, notFoundHtml(parsed.lang), miss(parsed.lang));
  }
  const set = siblingSet(rows, post, catalog);
  let related = [];
  try { related = relatedPosts(rowsForLang(post.lang, await fetchRelated(post.lang, post.category, post.slug, fetchImpl, { timeoutMs: opts && opts.relatedTimeoutMs }), catalog), post); }
  catch { related = relatedPosts(rowsForLang(post.lang, [], catalog), post); }
  const html = articleHtml(post, set, related);
  return result(200, html, {
    "content-type": HTML,
    "content-language": contentLanguage(post.lang),
    "cache-control": CACHE_ARTICLE,
    "x-blog-source": "live",
  });
}

/* The sitemap answers (see the comment above SITEMAP_MAX_URLS in blog-paths.mjs for why there are ten files):
     serveBlogSitemap(fetch, opts, lang)       /sitemap-blog-<lang>.xml   (vercel.json rewrites it to api/blog-sitemap?lang=<lang>) the published rows of ONE language, the static ones and the live_only ones, merged with the
                                                blog-src catalog; `lang` is one of the ten (BLOG_LANGS), anything else is a 404 with no body. The language can also come as opts.lang. With no language the answer is the
                                                sitemap index of the ten files (nothing links to it: /sitemap-blog.xml is a 301 to /sitemap.xml).
     serveBlogSitemapQuery(query, fetch, opts) what api/blog-sitemap.js calls: it takes ?lang= (the first one, when it is an array).
   A file reads only its own language (2 to 4 requests of 1,000 rows, two rounds) and is held under the platform's response limit by a safety cap (the newest urls are kept, what is left out is logged and sent as
   x-blog-sitemap-dropped). A failing read is a 503 with no body, never half a file. */
const SITEMAP_HEADERS = { "content-type": "application/xml; charset=utf-8", "cache-control": CACHE_LIST, "x-blog-source": "live" };
const SITEMAP_FAILED = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-blog-source": "live" };
function sitemapAnswer(built, lang) {
  const headers = { ...SITEMAP_HEADERS };
  if (built.dropped) {
    // the file reached the safety cap of one sitemap answer: the oldest articles are left out (see sitemapLangBuild) and the function log says so
    headers["x-blog-sitemap-dropped"] = String(built.dropped);
    console.warn(`blog-sitemap ${lang}: ${built.dropped} of ${built.total} article urls left out (limit ${built.maxUrls} urls / ${built.maxBytes} bytes in one file); split this language further`);
  }
  return result(200, built.xml, headers);
}

export async function serveBlogSitemap(fetchImpl, opts, lang) {
  const which = lang !== undefined ? lang : opts && opts.lang;
  if (which === undefined || which === null || which === "") return result(200, blogSitemapIndexXml(BLOG_SITE, new Date().toISOString().slice(0, 10)), { ...SITEMAP_HEADERS });
  if (typeof which !== "string" || !BLOG_LANGS.includes(which)) return result(404, "", { ...SITEMAP_FAILED });
  const catalog = activeCatalog(opts);
  try {
    const rows = rowsForLang(which, await fetchLangMeta(which, fetchImpl, { timeoutMs: opts && opts.listTimeoutMs }), catalog);
    return sitemapAnswer(sitemapLangBuild(rows, BLOG_SITE, which, opts && opts.sitemapLimits), which);
  } catch (e) {
    console.warn(`blog-sitemap ${which}: not served (${e && e.message}); answering 503`);   // the function log is the only place that says why a crawler got a 503 with no body
    return result(503, "", { ...SITEMAP_FAILED });
  }
}

export function serveBlogSitemapQuery(query, fetchImpl, opts) {
  const raw = query && query.lang;
  const lang = Array.isArray(raw) ? raw[0] : raw;
  return serveBlogSitemap(fetchImpl, opts, lang === undefined || lang === null ? undefined : String(lang));
}

export function writeNode(res, out) {
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers)) if (v) res.setHeader(k, v);
  res.end(out.body || "");
}
