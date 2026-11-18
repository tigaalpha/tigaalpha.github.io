// Static, crawlable blog: one HTML page per published article (th / en / zh / ja / ko / ru / hi / es / fr / ar), an index per language, and the article URLs appended to sitemap.xml.
// Reads public.blog_posts through the public REST API with the anon key (RLS only returns published rows). Fails soft: no table / no network = no blog pages, build continues.
// Japanese, Korean and Russian (owner 2026-11-11), then Hindi, Spanish, French and Arabic (owner 2026-11-13) are ALSO read from committed source files, blog-src/<lang>/<slug>.json (see readStaticPosts):
// the table does not allow those languages until supabase-blog-ja-ko-ru-migration.sql / supabase-blog-hi-es-fr-ar-migration.sql are applied, so the articles must be able to ship without them.
// A database row wins over a source file with the same (lang, slug). A language whose blog-src folder is missing or empty is simply skipped. Arabic is right-to-left: its pages carry dir="rtl".
// A row flagged live_only = true (the translation queue, owner 2026-11-17) is NOT written here at all: it is served from the database by scripts/blog-live.mjs (see isLiveOnly and the filter right after mergeStatic in writeBlog),
// and it is not even downloaded: the build asks the database for the rows that are not flagged (fetchBuildRows).
// Run by `npm run build` after build-song-pages.mjs (it appends to that script's sitemap.xml). SITE_URL overrides the domain.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { STATIC_BLOG_LANGS as STATIC_LANGS, totalFromContentRange } from "./blog-paths.mjs";
export { STATIC_LANGS };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE_URL || "https://www.tigaalpha.com").replace(/\/+$/, "");
const OUT = path.resolve(process.env.BLOG_OUT || path.join(ROOT, "blog"));   // BLOG_OUT / BLOG_FIXTURE exist for scripts/smoke-blog-gate.mjs (no network, no repo files touched)
const src = fs.readFileSync(path.join(ROOT, "supabase-client.ts"), "utf8");
const URL_ = (/SUPABASE_URL = "([^"]+)"/.exec(src) || [])[1], KEY = (/SUPABASE_ANON_KEY = "([^"]+)"/.exec(src) || [])[1];
// Importing this file (the on-demand page does) must not fetch or delete blog/. Only `node scripts/build-blog-pages.mjs` writes pages.
const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeUrl = (u) => /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : "";
const LG = { th: { name: "บล็อก", sub: "บทความเรื่องการเรียนเปียโนและดนตรี", cta: "เริ่มเรียนฟรีที่ TIGA ALPHA", back: "ทุกบทความ", loc: "th_TH", html: "th" }, en: { name: "Blog", sub: "Articles on learning piano and music", cta: "Start learning free on TIGA ALPHA", back: "All articles", loc: "en_US", html: "en" }, zh: { name: "博客", sub: "钢琴与音乐学习文章", cta: "在 TIGA ALPHA 免费开始学习", back: "全部文章", loc: "zh_CN", html: "zh-Hans" },
  ja: { name: "ブログ", sub: "ピアノと音楽の学習に役立つ記事", cta: "TIGA ALPHAで無料で始めよう", back: "すべての記事", loc: "ja_JP", html: "ja" },
  ko: { name: "블로그", sub: "피아노와 음악 학습에 관한 글", cta: "TIGA ALPHA에서 무료로 시작하기", back: "모든 글", loc: "ko_KR", html: "ko" },
  ru: { name: "Блог", sub: "Статьи об обучении игре на фортепиано и музыке", cta: "Начните учиться бесплатно в TIGA ALPHA", back: "Все статьи", loc: "ru_RU", html: "ru" },
  hi: { name: "ब्लॉग", sub: "पियानो और संगीत सीखने पर लेख", cta: "TIGA ALPHA पर मुफ़्त में शुरू करें", back: "सभी लेख", loc: "hi_IN", html: "hi" },
  es: { name: "Blog", sub: "Artículos para aprender piano y música", cta: "Empieza gratis en TIGA ALPHA", back: "Todos los artículos", loc: "es_ES", html: "es" },
  fr: { name: "Blog", sub: "Articles pour apprendre le piano et la musique", cta: "Commencez gratuitement sur TIGA ALPHA", back: "Tous les articles", loc: "fr_FR", html: "fr" },
  ar: { name: "المدونة", sub: "مقالات عن تعلّم البيانو والموسيقى", cta: "ابدأ التعلّم مجانًا على TIGA ALPHA", back: "كل المقالات", loc: "ar_AR", html: "ar" } };
// Right-to-left languages (keep in step with LANG_META in lang-extra.ts: this file is plain node and imports no TypeScript). Their pages get dir="rtl", a font stack of their own and a few direction rules.
const RTL_LANGS = new Set(["ar"]);
export const dirOf = (lang) => (RTL_LANGS.has(lang) ? "rtl" : "ltr");
// Languages whose articles ship as committed files under blog-src/ and whose index and feed are therefore BUILT as real files (see writeBlog). th / en / zh keep the database-rendered index.
// The index pages of hi / es / fr / ar are only listed as hreflang alternates once that language has an article (see INDEX_LANGS below), so no alternate ever points at a 404.
// (STATIC_LANGS is STATIC_BLOG_LANGS of blog-paths.mjs, imported above: one list, so the page generator and the live function cannot disagree)
const STATIC_CATS = ["tips", "theory", "songs", "news", "story"], STATIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/, STATIC_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const SRC_DIR = path.resolve(process.env.BLOG_SRC || path.join(ROOT, "blog-src"));   // BLOG_SRC lets the tests point at a temp folder
// blog-src/<lang>/<slug>.json = { lang, slug, category, title, excerpt, body, created_at, published } -> a published post of that language. A malformed file is skipped with a warning (never fails the build).
// The slug is the SAME as the English article's slug: that is how the translations find each other for hreflang. The result is newest first, ties by slug.
export function readStaticPosts(dir = SRC_DIR) {
  const out = [], seen = new Set();
  for (const lang of STATIC_LANGS) {
    const d = path.join(dir, lang);
    let files = [];
    try { files = fs.readdirSync(d).filter(f => f.endsWith(".json")).sort(); } catch (e) { continue; }
    for (const f of files) {
      const where = `${path.basename(dir)}/${lang}/${f}`;
      let j;
      try { j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } catch (e) { console.warn(`build-blog-pages: skipping ${where} (not valid JSON: ${e && e.message})`); continue; }
      const bad = !j || typeof j !== "object" ? "not an object"
        : j.lang !== lang ? `lang is "${j.lang}", the folder says "${lang}"`
        : typeof j.slug !== "string" || !STATIC_SLUG.test(j.slug) ? "slug is missing or not a plain a-z0-9- slug"
        : j.slug + ".json" !== f ? `slug "${j.slug}" does not match the file name`
        : typeof j.title !== "string" || !j.title.trim() ? "title is empty"
        : typeof j.body !== "string" || !j.body.trim() ? "body is empty"
        : typeof j.created_at !== "string" || !STATIC_DATE.test(j.created_at) || isNaN(new Date(j.created_at)) ? "created_at is missing or not an ISO date"
        : j.updated_at != null && (typeof j.updated_at !== "string" || !STATIC_DATE.test(j.updated_at) || isNaN(new Date(j.updated_at))) ? "updated_at is not an ISO date"
        : j.published === false ? "published is false (draft)" : "";
      if (bad) { if (j && j.published === false) continue; console.warn(`build-blog-pages: skipping ${where} (${bad})`); continue; }
      const key = lang + "/" + j.slug; if (seen.has(key)) continue; seen.add(key);
      out.push({ id: "static:" + key, lang, slug: j.slug, category: STATIC_CATS.includes(j.category) ? j.category : "tips", title: j.title.trim(), excerpt: typeof j.excerpt === "string" ? j.excerpt.trim() : "", body: j.body, cover_url: typeof j.cover_url === "string" && j.cover_url ? j.cover_url : null, published: true, created_at: j.created_at, updated_at: j.updated_at || j.created_at });
    }
  }
  return out.sort((a, b) => (new Date(b.created_at) - new Date(a.created_at)) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}
// database rows first (they win), then the source files that no row covers
export function mergeStatic(dbPosts, staticPosts) {
  const have = new Set((dbPosts || []).map(p => p.lang + "/" + p.slug));
  return (dbPosts || []).concat((staticPosts || []).filter(p => !have.has(p.lang + "/" + p.slug)));
}
// live_only (supabase-blog-translation-queue-migration.sql, owner 2026-11-17): a row with this flag is served from the database by the on-demand function (scripts/blog-live.mjs) and gets NO static file anywhere,
// because ~11,000 translated articles written as files would add ~340 MB to blog/, the git repo, the Vercel deployment and the OTA zip. Only a real `true` counts: a row from blog-src/ has no such field,
// and false / null / a database without the column all mean "static, exactly as before".
export const isLiveOnly = (p) => !!p && p.live_only === true;
function inline(s) {
  return esc(s).replace(/!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/g, (_, a, u) => `<img src="${u}" alt="${a}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" rel="noopener">${t}</a>`).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function body(text) {
  const out = []; let ul = [], ol = [];
  const fl = () => { if (ul.length) { out.push("<ul>" + ul.map(x => "<li>" + inline(x) + "</li>").join("") + "</ul>"); ul = []; } if (ol.length) { out.push("<ol>" + ol.map(x => "<li>" + inline(x) + "</li>").join("") + "</ol>"); ol = []; } };
  for (const ln of String(text || "").replace(/\r/g, "").split("\n")) {
    if (/^\s*[-*] /.test(ln)) { if (ol.length) fl(); ul.push(ln.replace(/^\s*[-*] /, "")); continue; }
    if (/^\s*\d+[.)] /.test(ln)) { if (ul.length) fl(); ol.push(ln.replace(/^\s*\d+[.)] /, "")); continue; } fl();
    if (/^### /.test(ln)) out.push("<h3>" + inline(ln.slice(4)) + "</h3>"); else if (/^## /.test(ln)) out.push("<h2>" + inline(ln.slice(3)) + "</h2>"); else if (/^# /.test(ln)) out.push("<h2>" + inline(ln.slice(2)) + "</h2>"); else if (ln.trim()) out.push("<p>" + inline(ln) + "</p>");
  } fl(); return out.join("\n");
}
const FONT_STACK = `system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Noto Sans SC",sans-serif`;
// Japanese and Korean pages name their own faces BEFORE "Noto Sans SC": a Chinese face listed first would draw kanji in Chinese glyph shapes on a machine that has it. th / en / zh / ru keep the stack byte for byte.
// Hindi names the Devanagari faces the same way (Noto Sans Devanagari on Android / ChromeOS, Nirmala UI on Windows, Mangal as the older Windows face). Arabic has a stack of its own (FONT_FULL):
// Naskh first for body text, then Noto Sans Arabic, Tahoma (on every Windows) and the system faces.
const FONT_LANG = { ja: `"Hiragino Sans","Yu Gothic","Noto Sans JP"`, ko: `"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR"`, hi: `"Noto Sans Devanagari","Nirmala UI","Mangal"` };
const FONT_FULL = { ar: `"Noto Naskh Arabic","Noto Sans Arabic",Tahoma,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif` };
const fontFor = (lang) => FONT_FULL[lang] ? FONT_FULL[lang] : FONT_LANG[lang] ? FONT_STACK.replace(`"Noto Sans SC"`, FONT_LANG[lang] + `,"Noto Sans SC"`) : FONT_STACK;
const forLang = (css, lang) => (FONT_FULL[lang] || FONT_LANG[lang]) ? css.split(FONT_STACK).join(fontFor(lang)) : css;
const CSS = `body{margin:0;background:#faf6f1;color:#2a211b;font:17px/1.75 ${FONT_STACK}}main{max-width:720px;margin:0 auto;padding:24px 18px 60px}header.top{border-bottom:1px solid #eadfd4;background:#fff}header.top div{max-width:720px;margin:0 auto;padding:12px 18px;display:flex;justify-content:space-between;align-items:center}header.top a{color:#d97757;font-weight:800;text-decoration:none;letter-spacing:.05em}h1{font-size:30px;line-height:1.3;margin:.3em 0}h2{font-size:23px;margin:1.6em 0 .4em}h3{font-size:19px;margin:1.4em 0 .3em}img{max-width:100%;border-radius:12px}a{color:#c2552d}.meta{color:#7a6a5e;font-size:14px}.card{display:block;background:#fff;border:1px solid #eadfd4;border-radius:14px;padding:14px 16px;margin:0 0 12px;text-decoration:none;color:inherit}.card b{font-size:18px}.card span{display:block;color:#6b5d52;font-size:15px;margin-top:4px}.cta{display:inline-block;background:#d97757;color:#fff!important;padding:12px 22px;border-radius:10px;font-weight:800;text-decoration:none;margin-top:28px}`;
/* Right-to-left rules (only written into a page whose language is RTL; every other page is byte for byte what it was). The base CSS has no physical left/right property, so what is left is
   reading rhythm (Arabic needs a taller line), lists and quotes by logical property, and letter-spacing: it would break the joined Arabic letters, so only the Latin brand name keeps it. */
const RTL_CSS = `[dir=rtl] body{line-height:1.85}[dir=rtl] h1{line-height:1.5}[dir=rtl] h2,[dir=rtl] h3{line-height:1.6}[dir=rtl] .card b,[dir=rtl] .card span{line-height:1.7}[dir=rtl] header.top a:not(:first-child){letter-spacing:0}[dir=rtl] ul,[dir=rtl] ol{padding-inline-start:1.6em;padding-inline-end:0}[dir=rtl] blockquote{margin-inline:0;padding-inline-start:14px;padding-inline-end:0;border-inline-start:3px solid #eadfd4;border-inline-end:0}[dir=rtl] .meta,[dir=rtl] .card,[dir=rtl] .rel,[dir=rtl] .pager{text-align:start}[dir=rtl] time{direction:ltr;unicode-bidi:isolate}`;
/* The date is an ISO string ("2026-11-17"): after Arabic text the bidi rules would turn its hyphens into right-to-left neutrals and show the three numbers in reverse order ("17-11-2026"),
   so the date is its own left-to-right island (the reader counter does the same, see viewsCss). Hindi has no direction rule, but Devanagari carries marks above and below the line (head-stroke, matras)
   and wants a taller line in the headings and cards than the Latin and CJK pages, and no letter-spacing on the blog name in the header (it pulls a letter from its matra). */
const HI_CSS = `h1{line-height:1.5}h2,h3{line-height:1.55}.card b,.card span{line-height:1.7}header.top a:not(:first-child){letter-spacing:0}`;
const rtlCss = (lang) => (dirOf(lang) === "rtl" ? RTL_CSS : "");
const langCss = (lang) => rtlCss(lang) + (lang === "hi" ? HI_CSS : "");
const dirAttr = (lang) => (dirOf(lang) === "rtl" ? ` dir="rtl"` : "");
const arrowBack = (lang) => (dirOf(lang) === "rtl" ? "→" : "←");
const head = (lang, title, desc, canon, extra, ld) => `<!doctype html>
<html lang="${LG[lang].html}"${dirAttr(lang)}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}">
${extra}<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article"><meta property="og:url" content="${canon}"><meta property="og:image" content="${SITE}/og-card.png"><meta property="og:locale" content="${LG[lang].loc}">
<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(LG[lang].name)}" href="${SITE}/blog/${lang}/feed.xml">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script><style>${forLang(CSS, lang)}.rel{margin-top:28px}.rel a{display:block;margin:6px 0}.pager{display:flex;gap:16px;margin:18px 0}${langCss(lang)}</style><script src="/ga.js" defer></script></head>
`;
const topbar = (lang) => `<header class="top"><div><a href="${SITE}/">TIGA ALPHA</a><a href="${SITE}/blog/${lang}/" style="font-weight:600">${LG[lang].name}</a></div></header>`;
const KW = { th: "สอนเปียโน, เรียนเปียโน, คอร์สเรียนเปียโน, เล่นเปียโน, เล่นดนตรี, สอนดนตรี, คอร์สเปียโน, เรียนเปียโนออนไลน์, เรียนดนตรี, แอปพลิเคชันสอนเปียโนออนไลน์, สอนเปียโนด้วยเอไอ, แอปสอนเปียโน, แอปสอนเปียโนออนไลน์, แอปสอนเปียโน AI, คอร์สเรียนเปียโนออนไลน์ AI", en: "piano teaching, learn piano, piano learning course, play piano, play music, music teaching, piano course, learn piano online, learn music, online piano teaching application, piano teaching with AI, piano teaching app, online piano lessons app, AI piano teaching app, AI online piano course", zh: "钢琴教学, 学钢琴, 钢琴学习课程, 弹钢琴, 演奏音乐, 音乐教学, 钢琴课程, 在线学钢琴, 学音乐, 在线钢琴教学应用, 用AI教钢琴, 钢琴教学App, 在线钢琴教学App, AI钢琴教学App, AI在线钢琴课程",
  ja: "ピアノ指導, ピアノを習う, ピアノ学習コース, ピアノを弾く, 音楽を演奏する, 音楽指導, ピアノレッスン, オンラインでピアノを習う, 音楽を学ぶ, オンラインピアノ指導アプリ, AIでピアノを教える, ピアノ学習アプリ, オンラインピアノレッスンアプリ, AIピアノ学習アプリ, AIオンラインピアノコース",
  ko: "피아노 교육, 피아노 배우기, 피아노 학습 과정, 피아노 연주, 음악 연주, 음악 교육, 피아노 강좌, 온라인 피아노 배우기, 음악 배우기, 온라인 피아노 교육 앱, AI 피아노 교육, 피아노 학습 앱, 온라인 피아노 레슨 앱, AI 피아노 학습 앱, AI 온라인 피아노 강좌",
  ru: "обучение игре на фортепиано, учиться играть на фортепиано, курс фортепиано, играть на пианино, играть музыку, обучение музыке, уроки фортепиано, уроки фортепиано онлайн, изучать музыку, приложение для обучения фортепиано, обучение фортепиано с ИИ, приложение для уроков фортепиано, онлайн-уроки фортепиано, ИИ-приложение для фортепиано, онлайн-курс фортепиано с ИИ",
  hi: "पियानो सिखाना, पियानो सीखें, पियानो सीखने का कोर्स, पियानो बजाना, संगीत बजाना, संगीत सिखाना, पियानो कोर्स, ऑनलाइन पियानो सीखें, संगीत सीखें, ऑनलाइन पियानो सिखाने वाला ऐप, AI से पियानो सिखाना, पियानो सिखाने वाला ऐप, ऑनलाइन पियानो लेसन ऐप, AI पियानो ऐप, AI ऑनलाइन पियानो कोर्स",
  es: "enseñanza de piano, aprender piano, curso de piano, tocar el piano, tocar música, enseñanza de música, clases de piano, aprender piano online, aprender música, aplicación para aprender piano online, aprender piano con IA, app para aprender piano, app de clases de piano online, app de piano con IA, curso de piano online con IA",
  fr: "enseignement du piano, apprendre le piano, cours de piano, jouer du piano, jouer de la musique, enseignement de la musique, formation au piano, apprendre le piano en ligne, apprendre la musique, application d'apprentissage du piano en ligne, apprendre le piano avec l'IA, appli pour apprendre le piano, appli de cours de piano en ligne, appli de piano avec IA, cours de piano en ligne avec IA",
  ar: "تعليم البيانو, تعلّم البيانو, دورة تعلّم البيانو, عزف البيانو, عزف الموسيقى, تعليم الموسيقى, دورة بيانو, تعلّم البيانو أونلاين, تعلّم الموسيقى, تطبيق تعليم البيانو أونلاين, تعليم البيانو بالذكاء الاصطناعي, تطبيق تعليم البيانو, تطبيق دروس بيانو أونلاين, تطبيق بيانو بالذكاء الاصطناعي, دورة بيانو أونلاين بالذكاء الاصطناعي" };
const ORG = { "@type": "Organization", "@id": SITE + "/#org", name: "TIGA ALPHA", url: SITE + "/", logo: { "@type": "ImageObject", url: SITE + "/og-card.png" }, founder: { "@id": SITE + "/#teacher-aum" }, sameAs: ["https://www.tigastudio.net/", "https://www.tigaalpha.com/"] };
const AUM = { th: "ครูอั้ม", en: "Teacher Aum", zh: "Aum 老师", ja: "アウム先生", ko: "아움 선생님", ru: "Учитель Aum", hi: "टीचर Aum", es: "Profe Aum", fr: "Prof Aum", ar: "المعلّم Aum" };
// The index pages are listed as hreflang alternates (in each index and in the static sitemap) only for languages that HAVE one: th / en / zh are rendered on demand and always exist; a source-file language
// (STATIC_LANGS) counts once it has an article. writeBlog() sets the list from what it found, so an empty blog-src/<lang>/ folder never leaves an alternate that points at a 404. The on-demand page (blog-live.mjs)
// does not call it and lists every language, as before.
let INDEX_LANGS = null;
export const setIndexLangs = (list) => { INDEX_LANGS = list ? new Set(list) : null; };
const indexLangs = () => Object.keys(LG).filter(l => !STATIC_LANGS.includes(l) || !INDEX_LANGS || INDEX_LANGS.has(l));
const indexAlts = () => indexLangs().map(l => `<link rel="alternate" hreflang="${LG[l].html}" href="${SITE}/blog/${l}/">`).join("") + `<link rel="alternate" hreflang="x-default" href="${SITE}/blog/en/">\n`;
const indexSm = () => indexLangs().map(l => [LG[l].html, `${SITE}/blog/${l}/`]).concat([["x-default", `${SITE}/blog/en/`]]);
const CATN = { tips: { th: "เทคนิคการฝึก", en: "Practice tips", zh: "练习技巧", ja: "練習のコツ", ko: "연습 팁", ru: "Советы по занятиям", hi: "अभ्यास के टिप्स", es: "Consejos de práctica", fr: "Conseils de pratique", ar: "نصائح للتدريب" }, theory: { th: "ทฤษฎีดนตรี", en: "Music theory", zh: "乐理", ja: "音楽理論", ko: "음악 이론", ru: "Теория музыки", hi: "संगीत सिद्धांत", es: "Teoría musical", fr: "Théorie musicale", ar: "نظرية الموسيقى" }, songs: { th: "เพลงและเพลงฝึก", en: "Songs", zh: "曲目", ja: "曲と練習曲", ko: "곡과 연습곡", ru: "Песни и пьесы", hi: "गाने और अभ्यास के टुकड़े", es: "Canciones y piezas", fr: "Morceaux et pièces", ar: "أغانٍ وقطع للتدريب" }, news: { th: "ข่าวและประกาศ", en: "News", zh: "新闻公告", ja: "お知らせ", ko: "소식과 공지", ru: "Новости", hi: "समाचार और घोषणाएँ", es: "Noticias", fr: "Actualités", ar: "الأخبار والإعلانات" }, story: { th: "เรื่องราว", en: "Stories", zh: "故事", ja: "ストーリー", ko: "이야기", ru: "Истории", hi: "कहानियाँ", es: "Historias", fr: "Histoires", ar: "قصص" } };
/* ── the reading gate (owner 2026-11-04) ──
   Anyone may read an article without an account — that is what lets search send people here. After THIRTY SECONDS of actual reading (it was one minute until 2026-11-07, owner) (time the tab is
   visible; a tab in the background does not count) a pop-up opens in the middle of the screen and invites the reader to log in or sign up free for
   the TIGA AI app. It is a plain link into the app, because the app's login card (Google, e-mail link, password) is the one place accounts are
   made: "Google" goes to /?go=google, which starts the Google sign-in at once (App.tsx), "sign up" and "log in" open that card on its own tab
   (?wall=signup | ?wall=login, app-shell.tsx). Every link carries utm_source=blog&utm_campaign=<article> so the admin funnel can say how many
   members this channel brings.
   Rules it keeps (owner 2026-11-07, third version: "the pop-up must not be closable, to read on you have to log in"): it never shows to someone who already has a
   session in this browser; it has NO close button, no Esc and no tap-outside; the page behind is inert and locked, and the wall lifts only when a session appears
   (the reader logged in, even in another tab). A reader who met it is walled again at once for 24 hours (localStorage tg_blog_walled), so a reload or another article is
   no way round. Crawlers are never walled (BOT) and the article's JSON-LD says isAccessibleForFree false with the article as the gated part, which is Google's
   way of telling a login wall from cloaking. The SEO cost of an uncloseable wall (Google's intrusive-interstitial rule) is the owner's accepted trade-off;
   the text is data-nosnippet so it never replaces the article's snippet. The test door: with
   localStorage.tg_test_hook = "1" the page reads ?gate_ms=<ms> instead of 3000. */
// hi / es / fr / ar (owner 2026-11-13): hi "aap", es "tú", fr "vous", ar Modern Standard with masculine-singular imperatives; the button words follow the app's catalog ("Continue with Google", "Log in", "Sign up"). The product name "TIGA AI" (and, in es,
// "Inicia sesión") carries a no-break space (U+00A0, written \u00a0 in the strings), so a 320 px phone never splits the name over two lines or leaves one word of the log-in link alone.
const GATE_T = {
  th: { title: "ล็อกอินเพื่ออ่านต่อ", sub: "ล็อกอินหรือสมัครสมาชิกฟรีเพื่ออ่านบทความนี้ต่อ แล้วเริ่มเรียนเปียโนฟรีผ่านแอป TIGA AI ได้ทันที", google: "ล็อกอินด้วย Google", signup: "สมัครสมาชิกฟรี", login: "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ", trial: "ล็อกอินเพื่อทดลองเรียนเปียโนฟรี 7 วัน โดยไม่ต้องใช้บัตรเครดิต" },
  en: { title: "Log in to keep reading", sub: "Log in or sign up free to read the rest of this article, then start learning piano for free with the TIGA AI app.", google: "Continue with Google", signup: "Sign up free", login: "Already a member? Log in", trial: "Log in to try piano lessons free for 7 days — no credit card needed." },
  zh: { title: "登录后继续阅读", sub: "免费登录或注册即可继续阅读本文，并通过 TIGA AI 应用免费学习钢琴。", google: "使用 Google 继续", signup: "免费注册", login: "已有账号？登录", trial: "登录即可免费试学钢琴 7 天，无需信用卡。" },
  ja: { title: "続きを読むにはログイン", sub: "無料でログインまたは会員登録すると、この記事の続きを読めます。そのままTIGA AIアプリで、ピアノを無料で学び始められます。", google: "Googleで続ける", signup: "無料で会員登録", login: "アカウントをお持ちの方はログイン", trial: "ログインして、ピアノのレッスンを7日間無料で体験。クレジットカードは不要です。" },
  ko: { title: "계속 읽으려면 로그인하세요", sub: "무료로 로그인하거나 가입하면 이 글의 나머지를 읽을 수 있고, 바로 TIGA AI 앱에서 피아노를 무료로 배우기 시작할 수 있어요.", google: "Google로 계속하기", signup: "무료로 가입하기", login: "이미 회원이신가요? 로그인", trial: "로그인하고 피아노 레슨을 7일 동안 무료로 체험하세요. 신용카드는 필요 없어요." },
  ru: { title: "Войдите, чтобы читать дальше", sub: "Войдите или зарегистрируйтесь бесплатно, чтобы дочитать эту статью, а затем начните бесплатно учиться играть на фортепиано в приложении TIGA AI.", google: "Продолжить через Google", signup: "Зарегистрироваться бесплатно", login: "Уже есть аккаунт? Войти", trial: "Войдите и 7 дней бесплатно пробуйте уроки фортепиано — банковская карта не нужна." },
  hi: { title: "आगे पढ़ने के लिए लॉग इन करें", sub: "इस लेख का बाकी हिस्सा पढ़ने के लिए मुफ़्त में लॉग इन करें या साइन अप करें, फिर TIGA\u00a0AI ऐप से मुफ़्त में पियानो सीखना शुरू करें।", google: "Google से जारी रखें", signup: "मुफ़्त में साइन अप करें", login: "पहले से सदस्य हैं? लॉग इन करें", trial: "लॉग इन करें और 7 दिन तक पियानो के पाठ मुफ़्त में आज़माएँ — क्रेडिट कार्ड की ज़रूरत नहीं।" },
  es: { title: "Inicia sesión para seguir leyendo", sub: "Inicia sesión o regístrate gratis para leer el resto de este artículo y empieza a aprender piano gratis con la app TIGA\u00a0AI.", google: "Continuar con Google", signup: "Regístrate gratis", login: "¿Ya eres miembro? Inicia\u00a0sesión", trial: "Inicia sesión para probar clases de piano gratis durante 7\u00a0días, sin tarjeta de crédito." },
  fr: { title: "Connectez-vous pour continuer à lire", sub: "Connectez-vous ou inscrivez-vous gratuitement pour lire la suite de cet article, puis commencez à apprendre le piano gratuitement avec l'application TIGA\u00a0AI.", google: "Continuer avec Google", signup: "S'inscrire gratuitement", login: "Déjà membre\u00a0? Se connecter", trial: "Connectez-vous pour essayer les cours de piano gratuitement pendant 7\u00a0jours, sans carte bancaire." },
  ar: { title: "سجّل الدخول لمواصلة القراءة", sub: "سجّل الدخول أو أنشئ حسابًا مجانًا لقراءة بقية هذا المقال، ثم ابدأ تعلّم البيانو مجانًا عبر تطبيق TIGA\u00a0AI.", google: "المتابعة باستخدام Google", signup: "إنشاء حساب مجاني", login: "لديك حساب بالفعل؟ تسجيل الدخول", trial: "سجّل الدخول لتجرّب دروس البيانو مجانًا لمدة 7 أيام، دون الحاجة إلى بطاقة ائتمان." },
};
const GATE_CSS = `#tg-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(34,26,21,.95);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);overscroll-behavior:contain;animation:tgGf .22s ease-out}#tg-gate[hidden]{display:none}
.tg-g-card{position:relative;box-sizing:border-box;width:100%;max-width:400px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#2a211b;border:1px solid #eee3d8;border-radius:18px;padding:28px 22px 14px;text-align:center;box-shadow:0 18px 60px rgba(60,30,10,.35);font:16px/1.5 ${FONT_STACK};animation:tgGu .28s cubic-bezier(.2,.8,.2,1)}
.tg-g-badge{display:inline-block;border:2px solid #d97757;color:#d97757;border-radius:12px;padding:5px 14px;font-weight:800;font-size:19px;letter-spacing:1px}
.tg-g-card h2{margin:14px 0 6px;font-size:22px;line-height:1.3;font-weight:800}.tg-g-card p{margin:0 0 16px;color:#6f5f53;font-size:15px;line-height:1.55}
.tg-g-card p.tg-g-trial{margin:0 0 16px;padding:10px 12px;border-radius:12px;background:#fff3ec;color:#9a4424;font-size:15px;font-weight:700;line-height:1.5}
.tg-g-card a.tg-g-btn{display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;width:100%;min-height:48px;padding:12px 14px;margin:0 0 10px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;cursor:pointer}
.tg-g-google{background:#fff;color:#3c4043;border:1.5px solid #dadce0}.tg-g-signup{background:#d97757;color:#fff;border:1.5px solid #d97757}
.tg-g-card a.tg-g-login{display:block;margin:2px 0 4px;padding:8px;color:#b85a3a;font-size:15px;font-weight:700;text-decoration:none}
.tg-g-card a:focus-visible,.tg-g-card button:focus-visible{outline:3px solid #d9775799;outline-offset:2px}
@keyframes tgGf{from{opacity:0}to{opacity:1}}@keyframes tgGu{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
@media (max-width:380px),(max-height:650px){#tg-gate{padding:10px}.tg-g-card{max-height:calc(100vh - 20px);padding:18px 16px 8px}.tg-g-badge{font-size:17px;padding:4px 12px}.tg-g-card h2{margin:10px 0 4px;font-size:20px}.tg-g-card p{margin:0 0 10px;font-size:14px;line-height:1.45}.tg-g-card p.tg-g-trial{margin:0 0 12px;padding:8px 10px;font-size:14px;line-height:1.4}.tg-g-card a.tg-g-btn{min-height:46px;padding:9px 12px;margin:0 0 8px}.tg-g-card a.tg-g-login{padding:6px;margin:0}}
@media (prefers-reduced-motion:reduce){#tg-gate,.tg-g-card{animation:none}}`;
// Taller lines in the wall for the scripts that need them (the card is centred in every language, so nothing here moves it): Devanagari marks above and below the line, Arabic stacked vowel marks.
const GATE_LANG_CSS = {
  hi: `.tg-g-card{line-height:1.7}.tg-g-card h2{line-height:1.5}.tg-g-card p{line-height:1.75}`,
  ar: `[dir=rtl] .tg-g-card{line-height:1.7}[dir=rtl] .tg-g-card h2{line-height:1.6}[dir=rtl] .tg-g-card p{line-height:1.85}`,
};
const gateLangCss = (lang) => GATE_LANG_CSS[lang] || "";
const GMARK = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>`;
const J = (v) => JSON.stringify(v).replace(/</g, "\\u003c");   // JSON inside an inline <script>: never let a slug close it
const VIEWS_CSS = `.tg-views{color:#7a6a5e;white-space:nowrap}.tg-cv{display:block;margin-top:6px;color:#8a7a6e;font-size:13px}`;
// In a right-to-left page the badge is its own bidi island: the number keeps its digits in order and the Arabic unit does not pull the "·" and the eye to the wrong side of the date.
const viewsCss = (lang) => VIEWS_CSS + (dirOf(lang) === "rtl" ? `[dir=rtl] .tg-views,[dir=rtl] .tg-cv{unicode-bidi:isolate}` : "");
// hi follows the app (BlogPage.tsx shows "व्यूज़" for the same count). th / zh / ja / ko / ru are the units the in-app blog already uses.
const VIEWS_LBL = { th: "ยอดวิว", en: "views", zh: "次浏览", ja: "回閲覧", ko: "회 조회", ru: "просмотров", hi: "व्यूज़", es: "visualizaciones", fr: "vues", ar: "مشاهدة" };
// The unit changes with the number in es / fr (one view is singular: "1 visualización", "1 vue") and in Arabic (1, 2, 3-10 and 11+ each take their own form). The count is always >= 1 when it is shown.
// UNIT_JS is the JavaScript expression the page scripts append to the number (n is the number there); every other language keeps `LBL`, so those pages are byte for byte what they were.
const VIEWS_ONE = { es: "visualización", fr: "vue" };
const UNIT_JS = (lang) => lang === "ar" ? `(n===1?LBL:n===2?${J("مشاهدتان")}:n<=10?${J("مشاهدات")}:LBL)` : VIEWS_ONE[lang] ? `(n===1?${J(VIEWS_ONE[lang])}:LBL)` : "LBL";
// (Arabic asks for Latin digits through the -u-nu-latn extension: a bare "ar" prints Arabic-Indic digits in some engines.) The number sits straight against the unit in Japanese ("1,234回閲覧") and Korean ("1,234회 조회"); the others have a space. LOC_JS is the locale expression the page scripts format the number with (th / en / zh keep their old text).
const VIEWS_SEP = (lang) => lang === "ja" || lang === "ko" ? "" : " ";
const LOC_JS = (lang) => ["th", "en", "zh"].includes(lang) ? `LANG==="th"?"th-TH":LANG==="zh"?"zh-CN":"en-US"` : J(({ ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", hi: "hi-IN", es: "es-ES", fr: "fr-FR", ar: "ar-u-nu-latn" })[lang] || "en-US");
/* The reader script of an article page (owner 2026-11-07): one shared reading clock does three jobs. (1) It counts the visit and shows the number of readers beside the date
   ("👁 1,234 views"): public.blog_hit() (supabase-blog-views-migration.sql) counts one view per device per article per day and returns the all-time number. (2) After 3 seconds of
   reading it records a "read" and, for someone with no session in this browser, opens the log-in pop-up (one minute until 2026-11-07, 30 seconds until 2026-11-12, 15 seconds until 2026-11-13, 5 seconds until 2026-11-16 — owner 2026-11-13: "5 seconds, in every language: most readers stay under 10 seconds, so sign them up in the first 10"; owner 2026-11-16: "3 seconds", and the pop-up says that the 7-day trial needs no credit card). (3) It records when the pop-up was shown and
   tapped. Every call fails soft: before the migration is applied the page shows no number and nothing else changes. Crawlers are not counted. A page kept from an earlier build is re-patched
   between the two markers, so the committed pages follow the generator. */
const GATE_MARK = "<!--tg-gate:v7-->", GATE_END = "<!--/tg-gate-->";
function gateHtml(lang, slug) {
  const T = GATE_T[lang] || GATE_T.en;
  const base = `${SITE}/?utm_source=blog&utm_medium=seo&utm_campaign=${encodeURIComponent(slug)}&lg=${lang}`;
  const L = (x) => esc(`${base}&${x}`);
  const js = `(function(){var D=document,W=window,LS=null,SS=null,MS=3000,READ=0,OPEN=false,GOAL,SENT=0,API=${J(URL_)},KEY=${J(KEY)},LANG=${J(lang)},SLUG=${J(slug)},VID="",BOT=false,OFF=false,LBL=${J(VIEWS_LBL[lang] || VIEWS_LBL.en)},badge=null,MEM=null;
try{LS=W.localStorage}catch(e){}try{SS=W.sessionStorage}catch(e){}
try{BOT=/googlebot|bingbot|baiduspider|yandex|duckduckbot|applebot|slurp|crawler|spider|lighthouse|headlesschrome|prerender|facebookexternalhit|ahrefsbot|semrushbot|gptbot|claudebot|petalbot|bytespider/i.test(navigator.userAgent||"")}catch(e){}
function isAuth(){try{if(LS)for(var i=0;i<LS.length;i++){var k=LS.key(i);if(k&&/^sb-.*-auth-token$/.test(k)&&LS.getItem(k))return true}}catch(e){}return false}
try{if(LS&&LS.getItem("tg_test_hook")==="1"){var q=/[?&]gate_ms=(\\d+)/.exec(location.search);if(q){MS=+q[1]}}}catch(e){}
GOAL=MS;
/* a reader who already met the wall (within the last 24 hours, in this browser) meets it again at once on any article: reloading or opening another one is not a way round */
try{var wt=+(LS&&LS.getItem("tg_blog_walled"))||0;if(wt&&Date.now()-wt<86400000)GOAL=0}catch(e){}
try{OFF=!!(SS&&SS.getItem("tg_blog_rpc_off"))}catch(e){}
function rnd(){var s="",c="abcdefghijklmnopqrstuvwxyz0123456789",n=20,j;try{var a=new Uint8Array(n);W.crypto.getRandomValues(a);for(j=0;j<n;j++)s+=c.charAt(a[j]%36)}catch(e){s="";for(j=0;j<n;j++)s+=c.charAt(Math.floor(Math.random()*36))}return s}
function okId(v){return /^[A-Za-z0-9_-]{8,64}$/.test(v||"")}
try{VID=(LS&&LS.getItem("tg_blog_vid"))||""}catch(e){}
if(!okId(VID)){try{VID=(SS&&SS.getItem("tg_blog_vid"))||""}catch(e){}}
if(!okId(VID)){VID=rnd();try{LS&&LS.setItem("tg_blog_vid",VID)}catch(e){try{SS&&SS.setItem("tg_blog_vid",VID)}catch(e2){}}}
function ev(n,p){try{if(W.gtag)W.gtag("event",n,p)}catch(e){}}
function rpc(name,body,cb,ka){if(BOT||OFF)return;var o={method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},body:JSON.stringify(body)};if(ka)o.keepalive=true;try{W.fetch(API+"/rest/v1/rpc/"+name,o).then(function(r){if(r.status===404){OFF=true;try{SS&&SS.setItem("tg_blog_rpc_off","1")}catch(e){}}return r.ok?r.json():null}).then(function(j){if(cb)cb(j)},function(){})}catch(e){}}
function hit(kind,cb,ka){rpc("blog_hit",{p_lang:LANG,p_slug:SLUG,p_vid:VID,p_kind:kind},cb,ka)}
function badgeEl(){if(badge)return badge;var t=D.querySelector("article time");if(!t||!t.parentNode)return null;badge=D.createElement("span");badge.className="tg-views";badge.setAttribute("data-nosnippet","");badge.hidden=true;t.parentNode.appendChild(badge);return badge}
function show(n){if(typeof n!=="number"||!(n>=1))return;var b=badgeEl();if(!b)return;var s;try{s=n.toLocaleString(${LOC_JS(lang)})}catch(e){s=String(n)}b.textContent=" \\u00b7 \\ud83d\\udc41 "+s+${J(VIEWS_SEP(lang))}+${UNIT_JS(lang)};b.hidden=false}
/* the view is counted once the page is really in front of the reader: not while it is only prerendered, not in a tab that was opened in the background and never looked at */
var VIEWED=0;function view(){if(VIEWED)return;if(D.prerendering||D.hidden)return;VIEWED=1;hit("view",show)}
if(D.prerendering)D.addEventListener("prerenderingchange",view);D.addEventListener("visibilitychange",function(){last=Date.now();view()});view();
var el=D.getElementById("tg-gate");
/* the wall has no close control, no Esc, no tap-outside: it lifts only when a session appears in this browser (the reader logged in, even in another tab) */
function lock(on){try{D.documentElement.style.overflow=on?"hidden":(el._ov||"");var c=D.body.children;for(var i=0;i<c.length;i++){var n=c[i];if(n===el||n.tagName==="SCRIPT"||n.tagName==="STYLE")continue;if(on){if(!n.hasAttribute("inert")){n.setAttribute("inert","");n.setAttribute("data-tg-inert","1")}}else if(n.getAttribute("data-tg-inert")){n.removeAttribute("inert");n.removeAttribute("data-tg-inert")}}}catch(e){}}
function closeIt(){if(!OPEN)return;OPEN=false;el.hidden=true;lock(false)}
function openIt(){OPEN=true;try{LS&&LS.setItem("tg_blog_walled",String(Date.now()))}catch(e){}el._ov=D.documentElement.style.overflow;lock(true);el.hidden=false;ev("blog_gate_shown",{slug:SLUG});hit("gate");var b=el.querySelector("[data-gate=google]");if(b&&b.focus)try{b.focus({preventScroll:true})}catch(e){}}
/* the reading clock: a gap of more than 1.5 s between two 250 ms ticks means the page was frozen or throttled (another app, a locked phone), and that time is not reading */
var last=Date.now();setInterval(function(){var n=Date.now(),d=n-last;last=n;if(D.hidden||d>1500||d<0)return;if(OPEN){if(isAuth())closeIt();return}READ+=d;if(!SENT&&READ>=MS){SENT=1;hit("read");ev("blog_read",{slug:SLUG,seconds:Math.round(READ/1000)})}if(el&&!BOT&&READ>=GOAL&&!isAuth())openIt()},250);
W.addEventListener("pageshow",function(e){last=Date.now();if(e&&e.persisted&&OPEN&&isAuth())closeIt()});
if(!el)return;
el.addEventListener("click",function(e){var t=e.target;while(t&&t!==el){if(t.getAttribute&&t.getAttribute("data-gate")){ev("blog_gate_click",{method:t.getAttribute("data-gate"),slug:SLUG});hit("click",null,true);try{if(LS){var p=JSON.parse(LS.getItem("tg_guest_profile")||"{}")||{};p.lang=LANG;LS.setItem("tg_guest_profile",JSON.stringify(p))}}catch(e){}return}t=t.parentNode}});
if(W.__tgGate===undefined)W.__tgGate={open:function(){if(!OPEN&&!isAuth())openIt()},state:function(){return{open:OPEN,read:READ,auth:isAuth()}}};})();`;
  return `${GATE_MARK}<style>${forLang(GATE_CSS, lang)}${gateLangCss(lang)}${viewsCss(lang)}</style><div id="tg-gate" role="dialog" aria-modal="true" aria-labelledby="tg-gate-t" data-nosnippet hidden><div class="tg-g-card"><div class="tg-g-badge">TIGA ALPHA</div><h2 id="tg-gate-t">${esc(T.title)}</h2><p>${esc(T.sub)}</p><p class="tg-g-trial">${esc(T.trial || GATE_T.en.trial)}</p><a class="tg-g-btn tg-g-google" data-gate="google" rel="nofollow" href="${L("go=google")}">${GMARK}${esc(T.google)}</a><a class="tg-g-btn tg-g-signup" data-gate="signup" rel="nofollow" href="${L("wall=signup")}">${esc(T.signup)}</a><a class="tg-g-login" data-gate="login" rel="nofollow" href="${L("wall=login")}">${esc(T.login)}</a></div></div><script>${js}</script>${GATE_END}`;
}
/* The article lists show the same number on every card (one call per list). Patched into kept pages like the gate. */
const IDX_MARK = "<!--tg-idx:v1-->", IDX_END = "<!--/tg-idx-->";
function idxHtml(lang) {
  const js = `(function(){var W=window,D=document,API=${J(URL_)},KEY=${J(KEY)},LANG=${J(lang)},LBL=${J(VIEWS_LBL[lang] || VIEWS_LBL.en)};try{if(/googlebot|bingbot|baiduspider|yandex|duckduckbot|applebot|slurp|crawler|spider|lighthouse|headlesschrome|prerender|facebookexternalhit|ahrefsbot|semrushbot|gptbot|claudebot|petalbot|bytespider/i.test(navigator.userAgent||""))return}catch(e){}
var cards=D.querySelectorAll("a.card");if(!cards.length)return;
try{W.fetch(API+"/rest/v1/rpc/blog_view_counts",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},body:JSON.stringify({p_lang:LANG})}).then(function(r){return r.ok?r.json():null}).then(function(rows){if(!rows||!rows.length)return;var m={},i;for(i=0;i<rows.length;i++)m[rows[i].slug]=rows[i].views;for(i=0;i<cards.length;i++){var h=cards[i].getAttribute("href")||"",s;try{s=decodeURIComponent(h.replace(/^.*\\/blog\\/[a-z]+\\//,"").replace(/\\.html$/,""))}catch(e){continue}var n=m[s];if(typeof n==="number"&&n>=1){var sp=D.createElement("span");sp.className="tg-cv";sp.setAttribute("data-nosnippet","");var t;try{t=n.toLocaleString(${LOC_JS(lang)})}catch(e){t=String(n)}sp.textContent="\\ud83d\\udc41 "+t+${J(VIEWS_SEP(lang))}+${UNIT_JS(lang)};cards[i].appendChild(sp)}}},function(){})}catch(e){}})();`;
  return `${IDX_MARK}<style>${viewsCss(lang)}</style><script>${js}</script>${IDX_END}`;
}
// strip a gate / list-script block written by any earlier version of this generator (v1 pages carry no markers)
const OLD_GATE = /<!--tg-gate:v\d+-->[\s\S]*?<!--\/tg-gate-->|<style>#tg-gate\{[\s\S]*?<\/style><div id="tg-gate"[\s\S]*?<\/div><\/div><script>[\s\S]*?<\/script>/g;
const OLD_IDX = /<!--tg-idx:v\d+-->[\s\S]*?<!--\/tg-idx-->/g;
const lastBody = /<\/body>(?![\s\S]*<\/body>)/;
// A page kept from an earlier build (th / en / zh while the database is not reachable) cannot be rendered again, so it does not know about a translation written after it: its hreflang cluster
// gets the missing alternates, in the order of LG and in front of x-default (where a rendered page would have them), or Google ignores the new pages' links back (hreflang must be reciprocal).
// Nothing already in the cluster is changed or removed (the x-default of a kept page stays), a page with no cluster is left alone, and a second run adds nothing.
const ALT_RUN = /(?:<link rel="alternate" hreflang="[^"]*" href="[^"]*">)+\n/;
export function addAlternates(html, slug, set) {
  const m = set && ALT_RUN.exec(html);
  if (!m) return html;
  const have = new Set([...m[0].matchAll(/hreflang="([^"]*)"/g)].map(x => x[1]));
  const add = Object.keys(LG).filter(l => set[l] && !have.has(LG[l].html)).map(l => `<link rel="alternate" hreflang="${LG[l].html}" href="${SITE}/blog/${l}/${encodeURIComponent(slug)}.html">`).join("");
  if (!add) return html;
  const run = m[0].includes('<link rel="alternate" hreflang="x-default"') ? m[0].replace('<link rel="alternate" hreflang="x-default"', () => add + '<link rel="alternate" hreflang="x-default"') : m[0].replace(/\n$/, () => add + "\n");
  return html.slice(0, m.index) + run + html.slice(m.index + m[0].length);
}
// One article page. `set` is the same slug in every language that exists ({ th, en, zh }). Used by the static build and by the on-demand page, so both emit the same raw HTML.
function plainText(md) {
  return String(md || "").replace(/```[\s\S]*?```/g, " ").replace(/[#>*_\[\]()!`-]/g, " ").replace(/\s+/g, " ").trim();
}
export function relatedPosts(posts, p, n = 5) {
  const same = (posts || []).filter(x => x && x.lang === p.lang && x.slug && x.slug !== p.slug && x.published !== false);
  const cat = same.filter(x => p.category && x.category === p.category);
  const rest = same.filter(x => !p.category || x.category !== p.category);
  return [...cat, ...rest].slice(0, Math.min(6, Math.max(3, n))).slice(0, n);
}
const REL = { th: "บทความที่เกี่ยวข้อง", en: "Related articles", zh: "相关文章", ja: "関連記事", ko: "관련 글", ru: "Похожие статьи", hi: "संबंधित लेख", es: "Artículos relacionados", fr: "Articles similaires", ar: "مقالات ذات صلة" };
function relatedHtml(lang, items) {
  const list = (items || []).slice(0, 6);
  if (list.length < 3) return "";
  return `<nav class="rel" aria-label="${esc(REL[lang])}"><h2>${esc(REL[lang])}</h2>${list.map(x => `<a href="${SITE}/blog/${lang}/${encodeURIComponent(x.slug)}.html">${esc(x.title)}</a>`).join("")}</nav>`;
}
export function articleHtml(p, set, related = []) {
  const L = LG[p.lang], canon = `${SITE}/blog/${p.lang}/${encodeURIComponent(p.slug)}.html`;
  const alts = Object.keys(set).map(l => `<link rel="alternate" hreflang="${LG[l].html}" href="${SITE}/blog/${l}/${encodeURIComponent(p.slug)}.html">`).join("") + `<link rel="alternate" hreflang="x-default" href="${SITE}/blog/${set.en ? "en" : p.lang}/${encodeURIComponent(p.slug)}.html">\n`;
  const desc = p.excerpt || plainText(p.body).slice(0, 155);
  const articleBody = plainText(p.body).slice(0, 8000);
  const words = ["zh", "ja", "ko"].includes(p.lang) ? articleBody.replace(/\s/g, "").length : articleBody.split(/\s+/).filter(Boolean).length;   // no spaces between words in Chinese / Japanese, so characters are counted (Korean the same way, by the owner's rule)
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "BlogPosting", "@id": canon + "#article", isAccessibleForFree: false, hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: "article" }, headline: p.title, keywords: KW[p.lang], isPartOf: { "@id": `${SITE}/blog/${p.lang}/#blog` }, about: { "@id": SITE + "/#app" }, articleSection: (CATN[p.category || "tips"] || {})[p.lang] || undefined, description: desc, articleBody, wordCount: words, inLanguage: L.html, datePublished: p.created_at, dateModified: p.updated_at || p.created_at, mainEntityOfPage: { "@type": "WebPage", "@id": canon }, url: canon, image: { "@type": "ImageObject", url: safeUrl(p.cover_url || "") || `${SITE}/og-card.png` }, author: { "@id": SITE + "/#teacher-aum" }, publisher: { "@id": SITE + "/#org" } },
    { "@type": "Person", "@id": SITE + "/#teacher-aum", name: AUM[p.lang], jobTitle: "Founder & CEO, TIGA ALPHA", worksFor: { "@id": SITE + "/#org" }, sameAs: ["https://www.tigastudio.net/", "https://www.tigaalpha.com/"] },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "TIGA ALPHA", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: L.name, item: `${SITE}/blog/${p.lang}/` }, { "@type": "ListItem", position: 3, name: p.title, item: canon }] }, ORG] };
  const d = new Date(p.created_at).toISOString().slice(0, 10);
  const coverAlt = String(p.cover_alt || "").trim() || p.title;
  return head(p.lang, `${p.title} | TIGA ALPHA`, desc, canon, alts, ld) + `<body>${topbar(p.lang)}<main><article><p class="meta"><a href="${SITE}/blog/${p.lang}/">${arrowBack(p.lang)} ${L.back}</a></p><h1>${esc(p.title)}</h1><p class="meta">${esc(CATN[p.category || "tips"] ? CATN[p.category || "tips"][p.lang] : "")} · <time datetime="${d}">${d}</time></p>${safeUrl(p.cover_url || "") ? `<img src="${safeUrl(p.cover_url)}" alt="${esc(coverAlt)}">` : ""}${body(p.body)}${relatedHtml(p.lang, related)}<p><a class="cta" href="${SITE}/">${L.cta}</a></p></article></main>${gateHtml(p.lang, p.slug)}</body></html>\n`;
}
export const INDEX_PAGE = 48;
const MORE = { th: "หน้าถัดไป", en: "Next page", zh: "下一页", ja: "次のページ", ko: "다음 페이지", ru: "Следующая страница", hi: "अगला पृष्ठ", es: "Página siguiente", fr: "Page suivante", ar: "الصفحة التالية" };
const PREV = { th: "หน้าก่อน", en: "Previous page", zh: "上一页", ja: "前のページ", ko: "이전 페이지", ru: "Предыдущая страница", hi: "पिछला पृष्ठ", es: "Página anterior", fr: "Page précédente", ar: "الصفحة السابقة" };
export function indexHtml(lang, list, page = 1) {
  const L = LG[lang];
  const rows = (list || []).filter(p => p && p.lang === lang && p.slug);
  const pages = Math.max(1, Math.ceil(rows.length / INDEX_PAGE));
  const p = Math.min(Math.max(1, page || 1), pages);
  const slice = rows.slice((p - 1) * INDEX_PAGE, p * INDEX_PAGE);
  const base = `${SITE}/blog/${lang}/`;
  const canon = p === 1 ? base : `${base}page/${p}`;
  const prev = p === 1 ? "" : (p === 2 ? base : `${base}page/${p - 1}`);
  const next = p < pages ? `${base}page/${p + 1}` : "";
  const links = `${prev ? `<link rel="prev" href="${prev}">` : ""}${next ? `<link rel="next" href="${next}">` : ""}`;
  const ld = { "@context": "https://schema.org", "@type": "Blog", "@id": base + "#blog", name: "TIGA ALPHA " + L.name, inLanguage: L.html, url: base, publisher: ORG, blogPost: slice.map(x => ({ "@type": "BlogPosting", headline: x.title, url: `${base}${encodeURIComponent(x.slug)}.html`, datePublished: x.created_at })) };
  const pager = `<nav class="pager">${prev ? `<a href="${prev}">${esc(PREV[lang])}</a>` : ""}${next ? `<a href="${next}">${esc(MORE[lang])}</a>` : ""}</nav>`;
  return head(lang, `${L.name} | TIGA ALPHA`, L.sub, canon, indexAlts() + links, ld) + `<body>${topbar(lang)}<main><h1>${L.name}</h1><p class="meta">${L.sub}</p>${slice.map(x => `<a class="card" href="${SITE}/blog/${lang}/${encodeURIComponent(x.slug)}.html"><b>${esc(x.title)}</b>${x.excerpt ? `<span>${esc(x.excerpt)}</span>` : ""}<span style="font-size:13px;color:#a39486">${esc((CATN[x.category || "tips"] || {})[lang] || "")}</span></a>`).join("")}${pager}</main>${idxHtml(lang)}</body></html>\n`;
}
export function feedXml(lang, list) {
  const rows = (list || []).filter(p => p && p.lang === lang && p.slug).slice(0, 40);
  const L = LG[lang];
  const items = rows.map(p => {
    const link = `${SITE}/blog/${lang}/${encodeURIComponent(p.slug)}.html`;
    const when = new Date(p.updated_at || p.created_at || Date.now()).toUTCString();
    return `<item><title>${esc(p.title)}</title><link>${link}</link><guid>${link}</guid><pubDate>${when}</pubDate><description>${esc(p.excerpt || p.title)}</description></item>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>TIGA ALPHA ${esc(L.name)}</title><link>${SITE}/blog/${lang}/</link><description>${esc(L.sub)}</description><language>${L.html}</language>${items}</channel></rss>\n`;
}
// The sitemap file for the languages that ship as source files. sitemap.xml is an index whose blog entries (the ten sitemap-blog-<lang>.xml, see blogSitemapIndexEntries in blog-paths.mjs) are rendered from the database on request, and the
// database does not hold these articles until the owner applies the seed SQL, so they get a plain file of their own (with the hreflang sets), listed in the index below. Duplicates with the live sitemap files are harmless.
function staticSitemapXml(posts, bySlug) {
  const day = (p) => String(p.updated_at || p.created_at || "").slice(0, 10);
  const xl = (l, h) => `<xhtml:link rel="alternate" hreflang="${l}" href="${h}"/>`;
  const lines = [];
  for (const p of posts) {
    if (!STATIC_LANGS.includes(p.lang)) continue;
    const set = bySlug[p.slug] || { [p.lang]: p }, href = (l) => `${SITE}/blog/${l}/${encodeURIComponent(p.slug)}.html`;
    lines.push(`<url><loc>${href(p.lang)}</loc><lastmod>${new Date(day(p)).toISOString().slice(0, 10)}</lastmod>${Object.keys(set).map(l => xl(LG[l].html, href(l))).join("")}${xl("x-default", href(set.en ? "en" : p.lang))}</url>`);
  }
  for (const lang of STATIC_LANGS) {
    const rows = posts.filter(p => p.lang === lang);
    if (!rows.length) continue;
    lines.push(`<url><loc>${SITE}/blog/${lang}/</loc><lastmod>${rows.map(day).sort().pop()}</lastmod>${indexSm().map(([l, h]) => xl(l, h)).join("")}</url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${lines.join("\n")}\n</urlset>\n`;
}
const newestFirst = (a, b) => (new Date(b.created_at) - new Date(a.created_at)) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
// Index, further pages and feed of a language that ships as source files, written as REAL files into blog/ (what GitHub Pages serves, and what the tests read).
// th / en / zh delete their index.html so the on-demand function lists the database. ja / ko / ru / hi / es / fr / ar keep a file here for the same reason ja / ko / ru always did (a checkout with no function still has a list),
// but scripts/copy-seo-to-dist.mjs removes index.html, feed.xml and page/ from dist/ only. On tigaalpha.com those URLs hit scripts/blog-live.mjs, which merges api/blog-live-catalog.json with
// published rows, so an article saved in the admin after this build is on the index and in the feed without another build. The article HTML files stay, so a database row with the same slug does not replace the file until the next build.
function writeStaticIndex(lang, list) {
  const rows = list.slice().sort(newestFirst), dir = path.join(OUT, lang), pages = Math.max(1, Math.ceil(rows.length / INDEX_PAGE));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), indexHtml(lang, rows, 1));
  fs.rmSync(path.join(dir, "page"), { recursive: true, force: true });   // pagination left by an earlier build
  for (let n = 2; n <= pages; n++) { fs.mkdirSync(path.join(dir, "page", String(n)), { recursive: true }); fs.writeFileSync(path.join(dir, "page", String(n), "index.html"), indexHtml(lang, rows, n)); }
  fs.writeFileSync(path.join(dir, "feed.xml"), feedXml(lang, rows));
}
/* What `npm run build` reads from the database: the published rows that become files. Used by writeBlog; exported so that the tests can run it against a fake fetch.
   - live_only rows are NOT downloaded (&live_only=eq.false; the column is NOT NULL, so that is every row that is not flagged). They are served live and written nowhere, and with the translation queue they are ~85% of the table;
     downloading them with select=* (about 8.7 KB a row, the body included) multiplied the Supabase egress of every build run by about 7 (57 runs a day, 4-5 per push) only to throw them away. A database without the column
     answers 400: the read is repeated without the filter, as before. (A server that ignores the filter changes nothing but the download: writeBlog still takes the flagged rows out by their flag.)
   - A blog-src file is shadowed by a database row of the same (lang, slug), flagged or not (mergeStatic). With the flagged rows not downloaded, the few files that could be shadowed are looked up by name (select=lang,slug,
     a request per 50 names) and come back as stub rows { live_only: true } that the merge and the catalog treat exactly like the real rows.
   - The read must be COMPLETE or it is not used: the caller deletes blog/ and rewrites it from these rows, so a read that stopped early would delete the pages of every row it never saw (the old loop gave up after 40 pages = 20,000 rows
     and still called that a success). `complete` is false when the page guard (BUILD_MAX_PAGES = 200 pages of 500 = 100,000 rows, was 40) ran out with rows left, or when fewer rows came back than the total PostgREST announced
     ("Prefer: count=exact", Content-Range); the caller then keeps the existing pages, as it does for a failed request, and the build log names the reason (`incomplete read: ... page guard`). The step between pages is the number
     of rows the last answer held, so a server that caps a page below `page` is followed, not skipped over. */
export const BUILD_PAGE = 500, BUILD_MAX_PAGES = 200;
export async function fetchBuildRows(o = {}) {
  const { url, key, statics = [], fetchImpl = fetch, page = BUILD_PAGE, maxPages = BUILD_MAX_PAGES, timeoutMs = 20000, log = console.log } = o;
  const get = (query, count) => fetchImpl(`${url}/rest/v1/blog_posts?${query}`, { headers: { apikey: key, Authorization: "Bearer " + key, ...(count ? { Prefer: "count=exact" } : {}) }, signal: AbortSignal.timeout(timeoutMs) });
  const readAll = async (filter) => {
    const rows = []; let total = null;
    for (let n = 0; n < maxPages; n++) {
      const r = await get(`select=*&published=eq.true${filter}&order=created_at.desc,id.asc&limit=${page}&offset=${rows.length}`, n === 0);
      if (!r.ok) return { status: r.status, why: `no posts (${r.status})` };
      const data = await r.json();
      if (!Array.isArray(data)) return { why: "no posts (the answer is not a list)" };
      if (n === 0) total = totalFromContentRange(r);
      for (const p of data) rows.push(p);
      if (total != null ? rows.length >= total : data.length < page) return { rows, total };
      if (!data.length) return { why: `incomplete read: ${rows.length} of ${total} rows (an empty page before the total)` };
    }
    return { why: `incomplete read: ${rows.length}${total != null ? " of " + total : ""} rows after ${maxPages} pages, more are left (the page guard; raise BUILD_MAX_PAGES if the table really is this big)` };
  };
  let filtered = true, res = await readAll("&live_only=eq.false");
  if (res.status === 400) { log("build-blog-pages: this database has no live_only column (400): reading every published row"); filtered = false; res = await readAll(""); }
  if (!res.rows) return { complete: false, rows: [], why: res.why };
  const stubs = [];
  if (filtered && statics.length) {
    const have = new Set(res.rows.map(p => p.lang + "/" + p.slug)), plain = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const open = statics.filter(p => plain.test(p.slug) && /^[a-z]{2,3}$/.test(p.lang) && !have.has(p.lang + "/" + p.slug));
    const want = new Set(open.map(p => p.lang + "/" + p.slug)), slugs = [...new Set(open.map(p => p.slug))], langs = [...new Set(open.map(p => p.lang))];
    for (let i = 0; i < slugs.length; i += 50) {
      const r = await get(`select=lang,slug&published=eq.true&live_only=is.true&lang=in.(${langs.join(",")})&slug=in.(${slugs.slice(i, i + 50).join(",")})&limit=1000`, false);
      if (!r.ok) return { complete: false, rows: [], why: `shadow lookup failed (${r.status})` };
      const data = await r.json();
      if (!Array.isArray(data)) return { complete: false, rows: [], why: "shadow lookup failed (the answer is not a list)" };
      for (const p of data) if (p && want.delete(p.lang + "/" + p.slug)) stubs.push({ id: "shadow:" + p.lang + "/" + p.slug, lang: p.lang, slug: p.slug, published: true, live_only: true });
    }
  }
  return { complete: true, rows: res.rows.concat(stubs), read: res.rows.length, filtered, ignored: filtered ? res.rows.filter(isLiveOnly).length : 0, shadowed: stubs.length, total: res.total };
}
async function writeBlog() {
// The source files (ja / ko / ru / hi / es / fr / ar) are read whether or not the database answered: they are committed, so a build with no network (this sandbox) still emits those pages, indexes and feeds.
// (Read first: the database read below looks up the ones a flagged row may shadow.)
const statics = readStaticPosts();
let dbPosts = [];
let fetched = false, dbRead = null;
if (process.env.BLOG_OFFLINE) console.log("build-blog-pages: offline (BLOG_OFFLINE), keeping the pages in " + OUT);
else if (process.env.BLOG_FIXTURE) { dbPosts = JSON.parse(fs.readFileSync(process.env.BLOG_FIXTURE, "utf8")); fetched = true; }
else try {
  // page through the API (the old single request was capped at 500 rows, so past 500 published rows the oldest articles would have been deleted from the deploy); see fetchBuildRows for what is asked and when the read counts as complete
  const r = await fetchBuildRows({ url: URL_, key: KEY, statics });
  if (r.complete) { dbPosts = r.rows; fetched = true; dbRead = r; } else console.log("build-blog-pages: " + r.why);
} catch (e) { console.log("build-blog-pages: skipped (" + (e && e.message) + ")"); }
// The live_only rows are taken out ONCE, here, right after the merge (a database row still wins over a blog-src file of the same (lang, slug), flagged or not), so everything below that reads `posts` sees static rows only:
// the article pages, the index pages and feeds of the source-file languages, blog/sitemap-static.xml, the sitemap.xml appends, the hreflang sets (bySlug) and the related lists. With no flagged row `posts` is the merged list itself.
const merged = mergeStatic(dbPosts, statics);
const liveOnly = merged.filter(isLiveOnly);
const posts = liveOnly.length ? merged.filter(p => !isLiveOnly(p)) : merged;
if (dbRead && dbRead.filtered && dbRead.ignored) console.log(`build-blog-pages: ${dbRead.read} rows read, ${dbRead.ignored} of them live-only (the database did not apply live_only=eq.false: they are downloaded and dropped here)`);
else if (dbRead && dbRead.filtered) console.log(`build-blog-pages: ${dbRead.read} static rows read, live-only rows not downloaded${dbRead.shadowed ? ` (${dbRead.shadowed} blog-src file(s) are shadowed by one)` : ""}`);
else if (liveOnly.length) console.log(`build-blog-pages: ${liveOnly.length} live-only rows served from the database (no static file)`);
setIndexLangs(STATIC_LANGS.filter(l => posts.some(p => p.lang === l)));
if (fetched) fs.rmSync(OUT, { recursive: true, force: true });
else console.log("build-blog-pages: fetch failed, leaving the existing blog pages in place");
const urls = [], bySlug = {}, emitted = new Set(), emittedIndex = new Set();
for (const p of posts) { (bySlug[p.slug] = bySlug[p.slug] || {})[p.lang] = p; }
if (!fetched) {
  // Offline, the th / en / zh page of the same article is on disk but not in `posts`; it still counts as a language of the article, or the x-default and the alternates of a source-file page (ja / ko / ru / hi / es / fr / ar) would be wrong; the kept th / en / zh page itself is given the alternates it lacks (addAlternates).
  for (const p of posts) for (const l of Object.keys(LG)) if (!STATIC_LANGS.includes(l) && !bySlug[p.slug][l] && fs.existsSync(path.join(OUT, l, p.slug + ".html"))) bySlug[p.slug][l] = { lang: l, slug: p.slug, published: true };
}
for (const p of posts) {
  if (!LG[p.lang] || !p.slug) continue;
  const canon = `${SITE}/blog/${p.lang}/${encodeURIComponent(p.slug)}.html`, set = bySlug[p.slug];
  const d = new Date(p.created_at).toISOString().slice(0, 10);
  fs.mkdirSync(path.join(OUT, p.lang), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.lang, p.slug + ".html"), articleHtml(p, set, relatedPosts(posts, p)));
  emitted.add(p.lang + "/" + p.slug);
  urls.push([canon, Object.keys(set).map(l => [LG[l].html, `${SITE}/blog/${l}/${encodeURIComponent(p.slug)}.html`]), d]);
}
for (const lang of Object.keys(LG)) {
  const list = posts.filter(p => p.lang === lang && p.slug);
  if (!list.length) continue;
  const newest = list.map(p => String(p.updated_at || p.created_at || "").slice(0, 10)).filter(Boolean).sort().pop() || null;
  if (STATIC_LANGS.includes(lang)) { writeStaticIndex(lang, list); emittedIndex.add(lang); urls.push([`${SITE}/blog/${lang}/`, indexSm(), newest]); continue; }
  // The language index is rendered from the database when it is requested, so a
  // file baked at build time cannot omit posts that were published afterwards.
  const indexFile = path.join(OUT, lang, "index.html");
  if (fs.existsSync(indexFile)) fs.rmSync(indexFile);
  urls.push([`${SITE}/blog/${lang}/`, indexSm(), newest]);
}
if (!fetched) {
  for (const lang of Object.keys(LG)) {
    const dir = path.join(OUT, lang);
    if (!fs.existsSync(dir)) continue;
    if (!emittedIndex.has(lang) && fs.existsSync(path.join(dir, "index.html"))) urls.push([`${SITE}/blog/${lang}/`, indexSm(), new Date().toISOString().slice(0, 10)]);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".html") || f === "index.html") continue;
      if (emitted.has(lang + "/" + f.slice(0, -5))) continue;   // written a moment ago from a source file: already current
      urls.push([`${SITE}/blog/${lang}/${encodeURIComponent(f.slice(0, -5))}.html`, [], null]);
      // the pages kept from an earlier build are brought up to the current reader script (gate after 5 s, view count) in place
      const fp = path.join(dir, f), h0 = fs.readFileSync(fp, "utf8");
      if (h0.includes("</body>")) {
        let h1 = h0.replace(OLD_GATE, "").replace(lastBody, () => gateHtml(lang, f.slice(0, -5)) + "</body>");
        if (!h1.includes('"isAccessibleForFree"')) h1 = h1.replace('"@type":"BlogPosting","@id"', '"@type":"BlogPosting","isAccessibleForFree":false,"hasPart":{"@type":"WebPageElement","isAccessibleForFree":false,"cssSelector":"article"},"@id"');
        h1 = addAlternates(h1, f.slice(0, -5), bySlug[f.slice(0, -5)]);   // a translation added after this page was rendered: link to it (and it links back, see the pages written from blog-src)
        if (h1 !== h0) fs.writeFileSync(fp, h1);
      }
    }
    // the list page of this language: same view numbers on its cards
    const ip = path.join(dir, "index.html");
    if (!emittedIndex.has(lang) && fs.existsSync(ip)) { const i0 = fs.readFileSync(ip, "utf8"); const i1 = i0.replace(OLD_IDX, "").replace(lastBody, () => idxHtml(lang) + "</body>"); if (i1 !== i0) fs.writeFileSync(ip, i1); }
  }
}
const staticPosts = posts.filter(p => STATIC_LANGS.includes(p.lang));
if (staticPosts.length) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, "sitemap-static.xml"), staticSitemapXml(posts, bySlug)); }
const sm = path.join(ROOT, "sitemap.xml");
if (urls.length && fs.existsSync(sm) && !process.env.BLOG_OUT && !process.env.BLOG_OFFLINE && !fs.readFileSync(sm, "utf8").includes("<sitemapindex")) {   // an offline patch run only knows the pages on disk (no dates, no alternates): it must not rewrite the sitemap. A sitemap index points at the ten sitemap-blog-<lang>.xml instead of copying each post.
  const add = urls.map(([u, alts, d]) => `<url><loc>${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}${alts.map(([l, h]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${h}"/>`).join("")}</url>`).join("\n");
  // blog entries already in the file (a second run without build-song-pages.mjs in front of it) are dropped first, so the append never duplicates them
  fs.writeFileSync(sm, fs.readFileSync(sm, "utf8").replace(/<url><loc>[^<]*\/blog\/[^<]*<\/loc>[\s\S]*?<\/url>\n?/g, "").replace("</urlset>", add + "\n</urlset>"));
} else if (staticPosts.length && fs.existsSync(sm) && !process.env.BLOG_OUT && !process.env.BLOG_OFFLINE) {
  // A sitemap INDEX (what build-song-pages.mjs writes) gets one more entry for the file above. Written again on every run, never twice.
  const t0 = fs.readFileSync(sm, "utf8");
  if (t0.includes("<sitemapindex")) {
    const last = staticPosts.map(p => String(p.updated_at || p.created_at || "").slice(0, 10)).sort().pop();
    const entry = `<sitemap><loc>${SITE}/blog/sitemap-static.xml</loc><lastmod>${last}</lastmod></sitemap>`;
    const t1 = t0.replace(/<sitemap><loc>[^<]*\/blog\/sitemap-static\.xml<\/loc>[\s\S]*?<\/sitemap>\n?/g, "").replace("</sitemapindex>", entry + "\n</sitemapindex>");
    if (t1 !== t0) fs.writeFileSync(sm, t1);
  }
}
console.log(`build-blog-pages: ${posts.length} posts (${statics.length} from blog-src), ${urls.length} urls  (${SITE})`);
// Titles of the committed source-file articles (ja / ko / ru / hi / es / fr / ar), for the on-demand index / feed / sitemap. Bodies stay in the HTML files.
// Written only by a real build (BLOG_OUT is the test door): Vercel bundles api/blog-live-catalog.json into the function.
if (!process.env.BLOG_OUT) {
  // the catalog names the blog-src files that got a page: one shadowed by a live-only database row (the row wins, and it has no file) is not listed
  const shadowed = new Set(liveOnly.map(p => p.lang + "/" + p.slug));
  const cat = liveCatalogRows(shadowed.size ? statics.filter(p => !shadowed.has(p.lang + "/" + p.slug)) : statics);
  fs.mkdirSync(path.join(ROOT, "api"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "api/blog-live-catalog.json"), JSON.stringify(cat));
  console.log(`build-blog-pages: live catalog ${cat.length} static rows`);
}
}
export function liveCatalogRows(posts) {
  return (posts || []).filter(p => STATIC_LANGS.includes(p.lang) && p && p.slug && p.published !== false && !isLiveOnly(p)).map(p => ({
    lang: p.lang, slug: p.slug, title: p.title || "", excerpt: typeof p.excerpt === "string" ? p.excerpt : "",
    category: p.category || "tips", published: true, created_at: p.created_at, updated_at: p.updated_at || p.created_at,
  }));
}
if (IS_MAIN) await writeBlog();
