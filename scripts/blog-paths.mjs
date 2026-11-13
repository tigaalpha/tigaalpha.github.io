// Path rules for a public blog URL. Pure: no network, no files, no article text.
// The stable address the static build already publishes is /blog/<lang>/<slug>.html.
// A one-segment /blog/<slug> is the short address some links use; the slug is kept whole (a trailing -zh is only a language hint).
export const BLOG_LANGS = ["th", "en", "zh", "ja", "ko", "ru"];
const LANGS = new Set(BLOG_LANGS);
// ja / ko / ru ship as committed source files (blog-src/) and get a REAL index.html, page/N/index.html and feed.xml from the build, so they never depend on the database being filled in.
export const STATIC_BLOG_LANGS = ["ja", "ko", "ru"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseBlogPath(raw) {
  let path = String(raw || "").split("?")[0];
  try { path = decodeURIComponent(path); } catch { return { kind: "bad" }; }
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const feed = path.match(/^\/blog\/(th|en|zh|ja|ko|ru)\/feed\.xml$/);
  if (feed) return { kind: "feed", lang: feed[1] };
  const paged = path.match(/^\/blog\/(th|en|zh|ja|ko|ru)\/page\/(\d+)$/);
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
    const suf = slug.match(/-(zh|en|th|ja|ko|ru)$/);
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
// A ja / ko / ru (or th / en) path must not claim zh-Hans: the tag, title and first line are that language.
const NOT_FOUND = {
  zh: { html: "zh-Hans", title: "找不到这篇文章", line: "这篇公开文章不存在，或还没有发布。" },
  th: { html: "th", title: "ไม่พบบทความนี้", line: "บทความนี้ยังไม่มี หรือยังไม่ได้เผยแพร่" },
  en: { html: "en", title: "This article was not found", line: "This article is not published." },
  ja: { html: "ja", title: "この記事は見つかりません", line: "この記事は公開されていないか、まだありません。" },
  ko: { html: "ko", title: "이 글을 찾을 수 없습니다", line: "공개되지 않았거나 없는 글입니다." },
  ru: { html: "ru", title: "Статья не найдена", line: "Этой статьи нет или она ещё не опубликована." },
};
const NOT_FOUND_LINKS = `<a href="https://www.tigaalpha.com/blog/zh/">中文博客</a> · <a href="https://www.tigaalpha.com/blog/en/">English</a> · <a href="https://www.tigaalpha.com/blog/th/">ไทย</a> · <a href="https://www.tigaalpha.com/blog/ja/">日本語</a> · <a href="https://www.tigaalpha.com/blog/ko/">한국어</a> · <a href="https://www.tigaalpha.com/blog/ru/">Русский</a>`;
export function notFoundHtml(lang) {
  const L = NOT_FOUND[lang] || NOT_FOUND.zh;
  return `<!doctype html>
<html lang="${L.html}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${L.title} | TIGA ALPHA</title>
<meta name="robots" content="noindex">
</head><body>
<main style="max-width:640px;margin:40px auto;font:17px/1.6 system-ui,sans-serif">
<h1>${L.title}</h1>
<p>${L.line}</p>
<p>This article is not published.</p>
<p>${NOT_FOUND_LINKS}</p>
</main>
</body></html>
`;
}

const HTML_LANG = { th: "th", en: "en", zh: "zh-Hans", ja: "ja", ko: "ko", ru: "ru" };

export function sitemapBlogXml(posts, site) {
  const list = (posts || []).filter(p => p && p.published !== false && SLUG.test(p.slug || "") && LANGS.has(p.lang));
  const by = {};
  for (const p of list) (by[p.slug] = by[p.slug] || {})[p.lang] = p;
  const lines = [];
  for (const slug of Object.keys(by)) {
    const set = by[slug];
    const xd = set.en ? "en" : Object.keys(set)[0];
    for (const lang of Object.keys(set)) {
      const p = set[lang];
      const loc = `${site}/blog/${lang}/${encodeURIComponent(slug)}.html`;
      const day = String(p.updated_at || p.created_at || "").slice(0, 10);
      const alts = Object.keys(set).map(l => `<xhtml:link rel="alternate" hreflang="${HTML_LANG[l]}" href="${site}/blog/${l}/${encodeURIComponent(slug)}.html"/>`).join("");
      lines.push(`<url><loc>${loc}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(day) ? `<lastmod>${day}</lastmod>` : ""}${alts}<xhtml:link rel="alternate" hreflang="x-default" href="${site}/blog/${xd}/${encodeURIComponent(slug)}.html"/></url>`);
    }
  }
  for (const lang of BLOG_LANGS) {
    const rows = list.filter(p => p.lang === lang);
    if (!rows.length) continue;
    const newest = rows.map(p => String(p.updated_at || p.created_at || "").slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop();
    lines.push(`<url><loc>${site}/blog/${lang}/</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${lines.join("\n")}\n</urlset>\n`;
}
