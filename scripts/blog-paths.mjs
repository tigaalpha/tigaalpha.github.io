// Path rules for a public blog URL. Pure: no network, no files, no article text.
// The stable address the static build already publishes is /blog/<lang>/<slug>.html.
// A one-segment /blog/<slug> is the short address some links use; the slug is kept whole (a trailing -zh is only a language hint).
export const BLOG_LANGS = ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar"];
const LANGS = new Set(BLOG_LANGS);
// ja / ko / ru (2026-11-11) and hi / es / fr / ar (2026-11-13) ship as committed source files (blog-src/) and get a REAL index.html, page/N/index.html and feed.xml from the build, so they never depend on the database being filled in.
// Arabic is right-to-left: its pages carry dir="rtl" (the 404 page below and every page build-blog-pages.mjs writes).
export const STATIC_BLOG_LANGS = ["ja", "ko", "ru", "hi", "es", "fr", "ar"];
const LANG_ALT = BLOG_LANGS.join("|");
const FEED_RE = new RegExp(`^/blog/(${LANG_ALT})/feed\\.xml$`), PAGED_RE = new RegExp(`^/blog/(${LANG_ALT})/page/(\\d+)$`), HINT_RE = new RegExp(`-(${LANG_ALT})$`);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseBlogPath(raw) {
  let path = String(raw || "").split("?")[0];
  try { path = decodeURIComponent(path); } catch { return { kind: "bad" }; }
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const feed = path.match(FEED_RE);
  if (feed) return { kind: "feed", lang: feed[1] };
  const paged = path.match(PAGED_RE);
  if (paged) return { kind: "index", lang: paged[1], page: Math.max(1, Number(paged[2]) || 1) };
  const two = path.match(/^\/blog\/([^/]+)\/([^/]+)$/);
  if (two) {
    const lang = two[1], file = two[2];
    if (!LANGS.has(lang)) return { kind: "bad" };
    if (file === "index.html") return { kind: "index", lang };
    const slug = file.endsWith(".html") ? file.slice(0, -5) : file;
    if (!SLUG.test(slug)) return { kind: "bad" };
    return { kind: "article", lang, slug, hint: false, html: file.endsWith(".html") };
  }
  const one = path.match(/^\/blog\/([^/]+)$/);
  if (one) {
    const slug = one[1];
    if (LANGS.has(slug)) return { kind: "index", lang: slug };
    if (!SLUG.test(slug)) return { kind: "bad" };
    const suf = slug.match(HINT_RE);
    return { kind: "article", lang: suf ? suf[1] : null, slug, hint: true, html: false };
  }
  return { kind: "ignore" };
}

export function fromQuery(q) {
  const query = q || {};
  const rest = Array.isArray(query.rest) ? query.rest.join("/") : (query.rest || "");
  let parsed = { kind: "bad" };
  if (query.lang && rest) parsed = parseBlogPath(`/blog/${query.lang}/${rest}`);
  else if (query.slug) parsed = parseBlogPath(`/blog/${query.slug}`);
  else if (query.lang) parsed = parseBlogPath(`/blog/${query.lang}`);
  if (parsed.kind === "index" && query.page && !parsed.page) parsed.page = Math.max(1, Number(query.page) || 1);
  return parsed;
}

export function pickPost(rows, lang, hint) {
  const list = (rows || []).filter(p => p && p.published !== false && SLUG.test(p.slug || "") && LANGS.has(p.lang));
  if (lang) {
    const hit = list.find(p => p.lang === lang);
    if (hit) return hit;
    if (!hint) return null;
  }
  return list.length === 1 ? list[0] : null;
}

// A path with no language keeps the original Chinese page (callers and tests compare it byte for byte).
// A ja / ko / ru / hi / es / fr / ar (or th / en) path must not claim zh-Hans: the tag, title and first line are that language.
// Arabic is right-to-left: its page says dir="rtl" (and the one fixed English line below is its own bidi island, so its full stop stays at the end of the sentence).
const NOT_FOUND = {
  zh: { html: "zh-Hans", title: "找不到这篇文章", line: "这篇公开文章不存在，或还没有发布。" },
  th: { html: "th", title: "ไม่พบบทความนี้", line: "บทความนี้ยังไม่มี หรือยังไม่ได้เผยแพร่" },
  en: { html: "en", title: "This article was not found", line: "This article is not published." },
  ja: { html: "ja", title: "この記事は見つかりません", line: "この記事は公開されていないか、まだありません。" },
  ko: { html: "ko", title: "이 글을 찾을 수 없습니다", line: "공개되지 않았거나 없는 글입니다." },
  ru: { html: "ru", title: "Статья не найдена", line: "Этой статьи нет или она ещё не опубликована." },
  hi: { html: "hi", title: "यह लेख नहीं मिला", line: "यह लेख प्रकाशित नहीं है या अभी मौजूद नहीं है।" },
  es: { html: "es", title: "No se encontró este artículo", line: "Este artículo no existe o todavía no está publicado." },
  fr: { html: "fr", title: "Cet article est introuvable", line: "Cet article n'existe pas ou n'est pas encore publié." },
  ar: { html: "ar", dir: "rtl", title: "لم يتم العثور على هذا المقال", line: "هذا المقال غير موجود أو لم يُنشر بعد." },
};
const NOT_FOUND_LINKS = `<a href="https://www.tigaalpha.com/blog/zh/">中文博客</a> · <a href="https://www.tigaalpha.com/blog/en/">English</a> · <a href="https://www.tigaalpha.com/blog/th/">ไทย</a> · <a href="https://www.tigaalpha.com/blog/ja/">日本語</a> · <a href="https://www.tigaalpha.com/blog/ko/">한국어</a> · <a href="https://www.tigaalpha.com/blog/ru/">Русский</a> · <a href="https://www.tigaalpha.com/blog/hi/">हिन्दी</a> · <a href="https://www.tigaalpha.com/blog/es/">Español</a> · <a href="https://www.tigaalpha.com/blog/fr/">Français</a> · <a href="https://www.tigaalpha.com/blog/ar/">العربية</a>`;
export function notFoundHtml(lang) {
  const L = NOT_FOUND[lang] || NOT_FOUND.zh;
  return `<!doctype html>
<html lang="${L.html}"${L.dir ? ` dir="${L.dir}"` : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${L.title} | TIGA ALPHA</title>
<meta name="robots" content="noindex">
</head><body>
<main style="max-width:640px;margin:40px auto;font:17px/1.6 system-ui,sans-serif">
<h1>${L.title}</h1>
<p>${L.line}</p>
<p>${L.dir ? "<bdi>This article is not published.</bdi>" : "This article is not published."}</p>
<p>${NOT_FOUND_LINKS}</p>
</main>
</body></html>
`;
}

/* The blog sitemap is TEN files, one per language: /sitemap-blog-<lang>.xml for th en zh ja ko ru hi es fr ar (reviews of 2026-11-17).
   The protocol allows 50,000 urls and 50 MB in a file, but these files are built in memory and sent in ONE piece by a Vercel Function, and a Function may not answer more than about 4.5 MB (a larger body is refused with
   FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE, a 500 for the crawler; found in review, not measurable from the sandbox: confirm on a preview deployment). With ~11,000 translated articles on top of ~3,000 the single sitemap-blog.xml
   would have been 6 to 9 MB, and because robots.txt and the root sitemap.xml both named it, the sitemap of the WHOLE blog (the old pages too) would have stopped being served.
   So the file of a language lists only that language's published rows, the ones that are files in the deploy AND the live_only ones (sitemapLangBuild): about 1,300 to 3,000 rows, 0.2 to 0.4 MB, a tenth of the platform's limit.
   The set of files is FIXED (BLOG_LANGS), so the root sitemap.xml (written at build time by build-song-pages.mjs, see blogSitemapIndexEntries) names every one of them directly and never needs a row count; a sitemap index may not
   list another index, so there is no index of the ten below sitemap-blog.xml: that old address is a 301 to /sitemap.xml (vercel.json). SITEMAP_MAX_URLS / SITEMAP_MAX_BYTES are the safety cap of ONE file (far under the protocol's
   50,000 urls and the platform's 4.5 MB): a file that ever reaches it leaves out its oldest articles, says so (log line, x-blog-sitemap-dropped) and is still a file the crawlers accept. */
export const SITEMAP_MAX_URLS = 45000, SITEMAP_MAX_BYTES = 4000000;

const dayOf = (p) => String(p.updated_at || p.created_at || "").slice(0, 10);
const validDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/* sitemap-blog-<lang>.xml. `posts` are rows as the function reads them (slug, lang, published, created_at, updated_at; newest first); a row of another language, an unpublished one, a duplicate slug, a bad slug and a null are
   ignored. An entry is the address and the day and nothing else (about 130 bytes): no xhtml:link. The page of an article carries its own hreflang set (the generator writes it into a static file, the live page builds it from the
   database), and a sitemap that says less than the page cannot disagree with it; a file that reads only ONE language's rows could not name the sibling languages anyway. The language index address closes the file (lastmod: the
   newest article), and only when the language has an article, so no address in a sitemap is a 404; a language with no article yet is an empty but valid urlset. The newest articles are kept when the cap is reached,
   and the result says how many were left out. */
export function sitemapLangBuild(posts, site, lang, limits) {
  const maxUrls = (limits && limits.maxUrls) || SITEMAP_MAX_URLS, maxBytes = (limits && limits.maxBytes) || SITEMAP_MAX_BYTES;
  const seen = new Set(), list = [];
  if (LANGS.has(lang)) for (const p of posts || []) {
    if (!p || p.published === false || p.lang !== lang || !SLUG.test(p.slug || "") || seen.has(p.slug)) continue;
    seen.add(p.slug); list.push(p);
  }
  const newest = list.map(dayOf).filter(validDay).sort().pop();
  const tail = list.length ? `<url><loc>${site}/blog/${lang}/</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>` : "";
  let urlsLeft = maxUrls - (tail ? 1 : 0), bytesLeft = maxBytes - 1024 - (tail ? tail.length + 1 : 0);   // 1,024 bytes for the xml header and the closing tag (every line is ASCII: a slug is a-z0-9-)
  const lines = [];
  for (const p of list) {
    const day = dayOf(p);
    const line = `<url><loc>${site}/blog/${lang}/${encodeURIComponent(p.slug)}.html</loc>${validDay(day) ? `<lastmod>${day}</lastmod>` : ""}</url>`;
    if (urlsLeft < 1 || line.length + 1 > bytesLeft) break;
    lines.push(line); urlsLeft--; bytesLeft -= line.length + 1;
  }
  const kept = lines.length;
  if (tail) lines.push(tail);
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}${lines.length ? "\n" : ""}</urlset>\n`,
    total: list.length, kept, dropped: list.length - kept, urls: lines.length, maxUrls, maxBytes,
  };
}

// The blog entries of the ROOT sitemap.xml (a sitemap index): the ten per-language files, listed directly. build-song-pages.mjs writes them at build time; the set is fixed, so it never has to know how many rows exist.
export function blogSitemapIndexEntries(site, lastmod) {
  return BLOG_LANGS.map(lang => `<sitemap><loc>${site}/sitemap-blog-${lang}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`);
}
// What the function answers when it is asked for no language (/api/blog-sitemap): the ten files as a sitemap index. Nothing links to it (/sitemap-blog.xml is a 301 to /sitemap.xml); it only gives that address a valid answer.
export function blogSitemapIndexXml(site, lastmod) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${blogSitemapIndexEntries(site, lastmod).join("\n")}\n</sitemapindex>\n`;
}

// "0-499/15234" -> 15234. null when there is no header object, no Content-Range, or no number after the slash ("0-499/*"). PostgREST answers it for a request that sent "Prefer: count=exact".
export function totalFromContentRange(r) {
  try {
    const raw = r && r.headers && typeof r.headers.get === "function" ? r.headers.get("content-range") : null;
    const m = raw ? /\/(\d+)\s*$/.exec(String(raw)) : null;
    return m ? Number(m[1]) : null;
  } catch { return null; }
}
