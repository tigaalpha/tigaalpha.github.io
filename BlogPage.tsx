import { useState, useEffect, useMemo, useRef } from "react";
import { sb } from "./supabase-client";

import { pickT, xl, ALL_LANGS, LANG_META, localeOf, dateLocale, isExtraLang, dirOf } from "./lang-extra";
/* Blog (owner 2026-10-31): articles in Thai, English and Mandarin (since 2026-11-11 also Japanese, Korean and Russian, since 2026-11-13 also Hindi, Spanish, French and Arabic), written only by the top admin (AdminBlog.tsx) and stored in public.blog_posts.
   The body is plain text with a tiny markup: "# " / "## " headings, "- " bullets, **bold**, [text](https://link) and ![alt](https://image) — rendered as React elements, never as HTML.
   Where the list comes from (owner 2026-11-13: "choosing a flag shows that language's articles straight away"): the rows of public.blog_posts for the open language, merged by slug with the committed articles of
   blog-data/<lang>.ts (ja ko ru hi es fr ar, generated from blog-src/ by scripts/build-blog-static-data.mjs, one lazy chunk per language, never in the main bundle). A database row wins; the committed articles
   fill what the table lacks, so the list is complete before supabase-blog-ja-ko-ru-migration.sql / supabase-blog-hi-es-fr-ar-migration.sql have been applied. A committed article has the id "static:<lang>:<slug>"
   and sends no view / read call (public.blog_hit() only counts an article with a published row). Arabic is right-to-left: the list and an open article take the direction of THEIR language (dir + lang),
   while the buttons, the language menu and the Back arrow keep the direction of the app's own language. */
type Cat = { id: string; icon: string; th: string; en: string; zh: string; ja?: string; ko?: string; ru?: string; hi?: string; es?: string; fr?: string; ar?: string };
export const BLOG_CATS: Cat[] = [
  { id: "tips", icon: "💡", th: "เทคนิคการฝึก", en: "Practice tips", zh: "练习技巧", ja: "練習のコツ", ko: "연습 팁", ru: "Советы по занятиям", hi: "अभ्यास के टिप्स", es: "Consejos de práctica", fr: "Conseils de pratique", ar: "نصائح للتدريب" },
  { id: "theory", icon: "🎼", th: "ทฤษฎีดนตรี", en: "Music theory", zh: "乐理", ja: "音楽理論", ko: "음악 이론", ru: "Теория музыки", hi: "संगीत सिद्धांत", es: "Teoría musical", fr: "Théorie musicale", ar: "نظرية الموسيقى" },
  { id: "songs", icon: "🎵", th: "เพลงและเพลงฝึก", en: "Songs", zh: "曲目", ja: "曲と練習曲", ko: "곡과 연습곡", ru: "Песни и пьесы", hi: "गाने और अभ्यास के टुकड़े", es: "Canciones y piezas", fr: "Morceaux et pièces", ar: "أغانٍ وقطع للتدريب" },
  { id: "news", icon: "📣", th: "ข่าวและประกาศ", en: "News", zh: "新闻公告", ja: "お知らせ", ko: "소식과 공지", ru: "Новости", hi: "समाचार और घोषणाएँ", es: "Noticias", fr: "Actualités", ar: "الأخبار والإعلانات" },
  { id: "story", icon: "✨", th: "เรื่องราว", en: "Stories", zh: "故事", ja: "ストーリー", ko: "이야기", ru: "Истории", hi: "कहानियाँ", es: "Historias", fr: "Histoires", ar: "قصص" },
];
// the first chip of the category row: every article of the language
const ALL_CHIP: Cat = { id: "all", icon: "📚", th: "ทั้งหมด", en: "All", zh: "全部", ja: "すべて", ko: "전체", ru: "Все", hi: "सभी", es: "Todos", fr: "Tous", ar: "الكل" };
// a category's name in any of the ten languages (the names above are the same words the static blog pages use: CATN in scripts/build-blog-pages.mjs)
export const catLabel = (c: Cat, lang: string): string => lang === "th" ? c.th : lang === "zh" ? c.zh : (isExtraLang(lang) && (c as any)[lang]) || xl(lang, c.en);
export const catName = (id: string, lang: string) => { const c = BLOG_CATS.find(x => x.id === id) || BLOG_CATS[0]; return c.icon + " " + catLabel(c, lang); };
// Thai, the CJK scripts and kana are written without spaces (450 characters a minute); every other script here, Devanagari and Arabic included, is read like Latin text (1100)
export const readMins = (t: string) => Math.max(1, Math.round(((t || "").length) / (/[\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(t || "") ? 450 : 1100)));
// "3 min" in the language of the article; `long` is the form beside the date in an open article
const MIN_TXT: Record<string, [string, string]> = { th: ["นาที", "นาที"], zh: ["分钟", "分钟"], ja: ["分", "分で読めます"], ko: ["분", "분이면 읽어요"], ru: ["мин", "мин чтения"], hi: ["मिनट", "मिनट में पढ़ें"], es: ["min", "min de lectura"], fr: ["min", "min de lecture"] };
// Arabic counts its minutes with a different word for 1, 2, 3-10 and 11 or more
const arMins = (n: number) => n === 1 ? "دقيقة واحدة" : n === 2 ? "دقيقتان" : n >= 3 && n <= 10 ? n + " دقائق" : n + " دقيقة";
export const minsText = (n: number, lang: string, long = false) => {
  if (lang === "ar") return arMins(n) + (long ? " للقراءة" : "");
  const u = MIN_TXT[lang]; return u ? (lang === "ja" || lang === "ko" ? "" + n : n + " ") + u[long ? 1 : 0] : n + " " + (long ? xl(lang, "min read") : "min");
};
export type BlogPost = { id: string; lang: string; slug: string; category?: string; title: string; excerpt: string; body: string; cover_url: string | null; cover_alt?: string | null; published: boolean; created_at: string; updated_at: string };
const safeUrl = (u: string) => /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : "";
function inline(s: string, k: string) {
  const out: any[] = []; const re = /(\*\*[^*]+\*\*|!\[[^\]]*\]\([^)\s]+\)|\[[^\]]+\]\([^)\s]+\))/g; let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index)); const t = m[0];
    if (t.startsWith("**")) out.push(<b key={k + i}>{t.slice(2, -2)}</b>);
    else if (t.startsWith("![")) { const mm = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t); const u = mm ? safeUrl(mm[2]) : ""; if (u) out.push(<img key={k + i} src={u} alt={mm![1]} loading="lazy" style={{ maxWidth: "100%", borderRadius: 12, display: "block", margin: "10px 0" }} />); }
    else { const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t); const u = mm ? safeUrl(mm[2]) : ""; out.push(u ? <a key={k + i} href={u} target="_blank" rel="noopener noreferrer" style={{ color: "var(--clay,#d97757)" }}>{mm![1]}</a> : t); }
    last = m.index + t.length; i++;
  }
  if (last < s.length) out.push(s.slice(last)); return out;
}
export function BlogBody({ text }: { text: string }) {
  const lines = (text || "").replace(/\r/g, "").split("\n"), els: any[] = []; let bullets: string[] = [], key = 0;
  // the bullets' indent is paddingInlineStart, never a physical left padding: in a right-to-left article the bullets sit on the right
  const flush = () => { if (bullets.length) { els.push(<ul key={"u" + key++} style={{ paddingInlineStart: 22, margin: "8px 0" }}>{bullets.map((b, i) => <li key={i} style={{ margin: "4px 0" }}>{inline(b, "b" + i)}</li>)}</ul>); bullets = []; } };
  for (const ln of lines) {
    if (/^\s*[-*] /.test(ln)) { bullets.push(ln.replace(/^\s*[-*] /, "")); continue; }
    flush();
    if (/^## /.test(ln)) els.push(<h3 key={"h" + key++} style={{ fontSize: 18, margin: "18px 0 6px" }}>{inline(ln.slice(3), "h" + key)}</h3>);
    else if (/^# /.test(ln)) els.push(<h2 key={"h" + key++} style={{ fontSize: 21, margin: "20px 0 8px" }}>{inline(ln.slice(2), "h" + key)}</h2>);
    else if (ln.trim() === "") continue;
    else els.push(<p key={"p" + key++} style={{ margin: "8px 0", lineHeight: 1.75 }}>{inline(ln, "p" + key)}</p>);
  }
  flush(); return <div>{els}</div>;
}
// Arabic asks for Latin digits and the Gregorian calendar, as the static pages do (LOC_JS in scripts/build-blog-pages.mjs): a bare "ar" prints Arabic-Indic digits in some engines
const latnAr = (loc: string, lang: string) => lang === "ar" ? "ar-u-nu-latn" : loc;
// th-TH, zh-CN, ja-JP, ko-KR, ru-RU, hi-IN, es-ES, fr-FR, ar for their own readers, en-GB for English (dateLocale in lang-extra.ts).
// A plain calendar date ("2026-11-13", what the committed articles carry) is read in UTC, like the static pages do: in the device's own zone, west of Greenwich, it would show the day before. A full timestamp keeps the reader's zone, as before.
export const fmtDate = (d: string, lang: string) => { try { return new Date(d).toLocaleDateString(latnAr(dateLocale(lang), lang), { year: "numeric", month: "short", day: "numeric", ...(/^\d{4}-\d{2}-\d{2}$/.test(d) ? { timeZone: "UTC" } : {}) }); } catch (e) { return ""; } };

/* Reader counts (owner 2026-11-07, supabase-blog-views-migration.sql): opening an article counts one view per device per day (public.blog_hit, the same call the static pages make) and the
   number is shown beside the date; the list shows it on every card. A random id of this browser (tg_blog_vid, never an account) is the "device". Every call fails soft: until the migration
   is applied no number shows. A committed article (id "static:...") has no row to count, so it sends nothing at all. */
let memVid = "";
const blogVid = () => {
  const mk = () => Array.from({ length: 20 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  const okId = (v: string) => /^[A-Za-z0-9_-]{8,64}$/.test(v || "");
  try { let v = localStorage.getItem("tg_blog_vid") || ""; if (!okId(v)) { v = memVid || mk(); localStorage.setItem("tg_blog_vid", v); } memVid = v; return v; }
  catch (e) { if (!okId(memVid)) memVid = mk(); return memVid; }   // no storage: one id for this tab, so a reader is one device, not one per article
};
const isStaticId = (id: string) => typeof id === "string" && id.startsWith("static:");
// the same words the static pages use (VIEWS_LBL, VIEWS_ONE and UNIT_JS in scripts/build-blog-pages.mjs; Hindi is also the UI catalog's word for "views"): "1,234回閲覧" and "1,234회 조회" sit straight against the number, the others have a space
const VIEWS_UNIT: Record<string, string> = { th: "ยอดวิว", zh: "次浏览", ja: "回閲覧", ko: "회 조회", ru: "просмотров", hi: "व्यूज़", es: "visualizaciones", fr: "vues", ar: "مشاهدة" };
// one view is singular in es / fr ("1 visualización", "1 vue") and Arabic gives 1, 2, 3-10 and 11+ each its own form, as the static pages do; a count is only shown from 1 up. The other languages keep their one unit.
const VIEWS_ONE: Record<string, string> = { es: "visualización", fr: "vue" };
const viewsUnit = (n: number, lang: string) => lang === "ar" ? (n === 2 ? "مشاهدتان" : n >= 3 && n <= 10 ? "مشاهدات" : VIEWS_UNIT.ar) : (n === 1 && VIEWS_ONE[lang]) || VIEWS_UNIT[lang] || xl(lang, "views");
export const viewsText = (n: number, lang: string) => "👁 " + n.toLocaleString(latnAr(localeOf(lang), lang)) + (lang === "ja" || lang === "ko" ? "" : " ") + viewsUnit(n, lang);

/* The committed articles: one lazy chunk per language (a literal path each, so the bundler can see every file). th / en / zh have none: their articles live only in the table. */
const STATIC_LOADERS: Record<string, () => Promise<{ default: BlogPost[] }>> = {
  ja: () => import("./blog-data/ja"), ko: () => import("./blog-data/ko"), ru: () => import("./blog-data/ru"),
  hi: () => import("./blog-data/hi"), es: () => import("./blog-data/es"), fr: () => import("./blog-data/fr"), ar: () => import("./blog-data/ar"),
};
/* database rows first (they win, matched by language + slug), then the committed articles no row covers; newest first, an equal date keeps the order it had */
export const mergeRows = (db: BlogPost[], files: BlogPost[]): BlogPost[] => {
  const have = new Set((db || []).map(p => p.lang + "/" + p.slug));
  return (db || []).concat((files || []).filter(p => !have.has(p.lang + "/" + p.slug)))
    .map((p, i) => ({ p, i, t: Date.parse(p.created_at) || 0 })).sort((a, b) => b.t - a.t || a.i - b.i).map(x => x.p);
};
// "no articles in this language yet" for the seven catalog languages, written in the language of the LIST (the app's own catalog may not be the one that is loaded). th / zh / en keep their lines in the JSX below:
// an object holding th + en + zh would be read by scripts/extract-i18n.mjs as a { th, en, zh } triple and put the English-tab line into the catalog.
const EMPTY_TXT: Record<string, string> = {
  ja: "この言語の記事はまだありません。もうしばらくお待ちください", ko: "아직 이 언어로 된 글이 없어요. 곧 만나요", ru: "Статей на этом языке пока нет — загляните позже",
  hi: "इस भाषा में अभी कोई लेख नहीं है — जल्द ही दोबारा देखें", es: "Aún no hay artículos en este idioma — vuelve pronto", fr: "Pas encore d'articles dans cette langue — reviens bientôt", ar: "لا توجد مقالات بهذه اللغة بعد — عاود الزيارة قريبًا",
};
const htmlLang = (l: string) => (LANG_META[l] || LANG_META.en).html;
const tall = (l: string) => l === "ar" || l === "hi";   // Arabic and Devanagari need a taller line than the 1.3-1.35 the Latin titles use
export function BlogPage({ lang, onBack }: { lang: string; onBack?: () => void }) {
  const T = (th, en, zh) => pickT(lang, th, en, zh);
  const appDir = dirOf(lang);   // the direction of the APP's words (Back, the language menu); an article takes the direction of its own language
  const [open, setOpen] = useState<BlogPost | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [tab, setTab] = useState<string>(ALL_LANGS.includes(lang) ? lang : "en");   // the tab follows the app language
  const [got, setGot] = useState<Record<string, { rows: BlogPost[]; err: boolean }>>({});   // language -> what public.blog_posts answered
  const [files, setFiles] = useState<Record<string, BlogPost[]>>({});   // language -> the committed articles (blog-data/<lang>.ts)
  const [counts, setCounts] = useState<Record<string, number>>({});   // "lang|slug" -> all-time views
  const [openViews, setOpenViews] = useState<number | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const asked = useRef<Record<string, boolean>>({}), fileAsked = useRef<Record<string, boolean>>({}), menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {   // a short screen (a 320 x 568 phone with the tab bar under the page, a landscape phone): scroll the page just far enough that the whole menu is on screen, never further
    const el = menuRef.current; if (langOpen && el && el.scrollIntoView) { try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) {} }
  }, [langOpen]);
  useEffect(() => {   // the language menu closes on a tap anywhere else, on Escape and when an article opens
    if (!langOpen) return;
    const away = (e: Event) => { const t = e.target as Element | null; if (!t || !t.closest || !t.closest("[data-blog-langs]")) setLangOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setLangOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [langOpen]);
  useEffect(() => {
    let off = false;
    (sb as any).rpc("blog_view_counts", { p_lang: tab }).then(({ data, error }: any) => { if (off || error || !Array.isArray(data)) return; setCounts(c => { const n = { ...c }; data.forEach((r: any) => { n[tab + "|" + r.slug] = Number(r.views) || 0; }); return n; }); }, () => {});
    return () => { off = true; };
  }, [tab]);
  useEffect(() => {
    setOpenViews(null); if (!open || isStaticId(open.id)) return; let off = false;   // a committed article has no row: nothing to count
    const key = open.lang + "|" + open.slug;
    (sb as any).rpc("blog_hit", { p_lang: open.lang, p_slug: open.slug, p_vid: blogVid(), p_kind: "view" }).then(({ data, error }: any) => {
      if (off || error || typeof data !== "number" || data < 1) return;
      setOpenViews(data); setCounts(c => ({ ...c, [key]: data }));   // the list shows the same number when the reader goes back
    }, () => {});
    // five seconds with the article open is a "read" (30 until 2026-11-12, 15 until 2026-11-13) (the static pages count the same), so the percentage in the admin card compares like with like
    const t = setTimeout(() => { (sb as any).rpc("blog_hit", { p_lang: open.lang, p_slug: open.slug, p_vid: blogVid(), p_kind: "read" }).then(() => {}, () => {}); }, 5000);
    return () => { off = true; clearTimeout(t); };
  }, [open && open.id]);
  useEffect(() => {   // the rows of the open language, once per language (an answer that arrives after the reader moved on is kept for when they come back); a failed call is not repeated, as before
    if (asked.current[tab]) return; asked.current[tab] = true;
    const put = (rows: BlogPost[], err: boolean) => setGot(g => ({ ...g, [tab]: { rows, err } }));
    sb.from("blog_posts").select("*").eq("published", true).eq("lang", tab).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }: any) => { if (error) put([], true); else put(Array.isArray(data) ? data : [], false); }, () => put([], true));
  }, [tab]);
  useEffect(() => {   // the committed articles of the open language: its own chunk, fetched when the tab opens. A chunk that cannot be fetched (offline, a file of an older release) leaves the database to fill the list, and the next visit to the tab tries again
    const load = STATIC_LOADERS[tab]; if (!load || fileAsked.current[tab]) return; fileAsked.current[tab] = true;
    load().then(m => { setFiles(f => ({ ...f, [tab]: m && Array.isArray(m.default) ? m.default : [] })); }, () => { fileAsked.current[tab] = false; setFiles(f => ({ ...f, [tab]: [] })); });
  }, [tab]);
  const merged = useMemo(() => mergeRows(got[tab] ? got[tab].rows : [], files[tab] || []), [got, files, tab]);
  const inLang = merged.filter(p => p.lang === tab), shown = cat === "all" ? inLang : inLang.filter(p => (p.category || "tips") === cat);
  const err = !!(got[tab] && got[tab].err), loading = inLang.length === 0 && !(got[tab] && (!STATIC_LOADERS[tab] || files[tab]));
  const tabHtml = htmlLang(tab);
  return (
    <div className="profpage" data-blog>
      <div className="profhdr">
        <div className="profavwrap"><div style={{ fontSize: 36 }}>📝</div></div>
        <div className="profname">{T("บล็อก", "Blog", "博客")}</div>
        <div className="profxp-lbl" style={{ color: "var(--muted)", fontSize: 13 }}>{T("บทความเรื่องการเรียนเปียโนและดนตรี", "Articles on learning piano and music", "钢琴与音乐学习文章")}</div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 90px" }}>
        {!open && (
          /* ONE round flag button at the end edge (the thumb's side in a left-to-right app, mirrored in an Arabic one), a drop-down under it: the row of six tabs ran off the screen and every language added would have made it worse.
             It keeps the direction of the APP language, never that of the article language that is chosen in it. The list scrolls inside a max-height, so ten languages stay reachable on a 320 x 568 phone. */
          <div data-blog-langs dir={appDir} style={{ position: "relative", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, margin: "4px 0 14px" }}>
            <span data-blog-langlbl style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{T("ภาษาบทความ", "Article language", "文章语言")}</span>
            <button type="button" data-blog-langbtn aria-haspopup="listbox" aria-expanded={langOpen} aria-label={T("เลือกภาษา", "Choose language", "选择语言")} onClick={() => setLangOpen(o => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 64, minHeight: 46, padding: "0 14px", border: "1.5px solid var(--bd, #e2d8cf)", borderRadius: 999, background: "var(--card, #fff)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontSize: 24, lineHeight: 1, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
              <span aria-hidden="true">{(LANG_META[tab] || LANG_META.en).flag}</span>
              <span aria-hidden="true" style={{ fontSize: 11, color: "var(--muted)", transform: langOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
            </button>
            {langOpen && (
              <div role="listbox" data-blog-langmenu ref={menuRef} style={{ position: "absolute", top: "calc(100% + 6px)", ...(appDir === "rtl" ? { left: 0 } : { right: 0 }), zIndex: 30, minWidth: 190, maxHeight: "min(60vh, 420px)", overflowY: "auto", background: "var(--card, #fff)", border: "1px solid var(--bd, #e2d8cf)", borderRadius: 16, padding: 6, boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>
                {ALL_LANGS.map(l => (
                  <button key={l} type="button" role="option" aria-selected={tab === l} data-blog-lang={l} onClick={() => { setTab(l); setCat("all"); setLangOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48, padding: "0 12px", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: tab === l ? 800 : 600, textAlign: "start", background: tab === l ? "var(--card2, #f4ece4)" : "transparent", color: tab === l ? "var(--clay, #d97757)" : "var(--text)" }}>
                    <span aria-hidden="true" style={{ fontSize: 22 }}>{LANG_META[l].flag}</span>
                    <span style={{ flex: 1 }}>{LANG_META[l].name}</span>
                    {tab === l ? <span aria-hidden="true">✓</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {open ? (<>
          <div data-blog-back dir={appDir}>
            <button className="songbtn ghost" onClick={() => setOpen(null)} style={{ marginBottom: 12 }}><span aria-hidden="true">{appDir === "rtl" ? "→" : "←"}</span> {T("กลับ", "Back", "返回")}</button>
          </div>
          <article data-blog-post dir={dirOf(open.lang)} lang={htmlLang(open.lang)}>
            {open.cover_url && safeUrl(open.cover_url) && <img src={safeUrl(open.cover_url)} alt={open.cover_alt || ""} style={{ width: "100%", borderRadius: 14, marginBottom: 12 }} />}
            <h1 style={{ fontSize: 26, lineHeight: tall(open.lang) ? 1.55 : 1.3, margin: "4px 0 6px" }}>{open.title}</h1>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>{catName(open.category || "tips", open.lang)} · {fmtDate(open.created_at, open.lang)} · {minsText(readMins(open.body), open.lang, true)}{openViews ? <span data-blog-views> · {viewsText(openViews, open.lang)}</span> : null}</div>
            <BlogBody text={open.body} />
          </article>
        </>) : (
          /* the list takes the direction (and the language, for the right glyph shapes) of the ARTICLES in it, not of the app */
          <div data-blog-list dir={dirOf(tab)} lang={tabHtml}>
            {inLang.length > 0 && (
              <div data-blog-cats style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, margin: "0 0 14px", scrollbarWidth: "none" }}>
                {[ALL_CHIP, ...BLOG_CATS.filter(c => inLang.some(p => (p.category || "tips") === c.id))].map(c => (
                  <button key={c.id} type="button" data-blog-cat={c.id} onClick={() => setCat(c.id)} style={{ flex: "0 0 auto", padding: "8px 14px", borderRadius: 999, border: "1.5px solid " + (cat === c.id ? "var(--clay, #d97757)" : "var(--bd, #e2d8cf)"), background: cat === c.id ? "var(--clay, #d97757)" : "var(--card, #fff)", color: cat === c.id ? "#fff" : "var(--text)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{c.icon} {catLabel(c, tab)}</button>
                ))}
              </div>
            )}
            {loading ? (
              <div style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>…</div>
            ) : shown.length === 0 ? (
              err ? <div dir={appDir} style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>{T("โหลดบทความไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't load articles — please try again", "文章加载失败，请重试")}</div>
                : <div data-blog-empty style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>{tab === "th" ? "ยังไม่มีบทความภาษาไทย โปรดรอติดตาม" : tab === "zh" ? "暂无中文文章，敬请期待" : tab === "en" ? "No English articles yet — check back soon" : EMPTY_TXT[tab] || xl(tab, "No articles in this language yet — check back soon")}</div>
            ) : shown.map(p => (
              <button key={p.id} data-blog-card data-blog-slug={p.slug} onClick={() => setOpen(p)} style={{ display: "block", width: "100%", textAlign: "start", background: "var(--card)", border: "1px solid var(--bd, #eadfd4)", borderRadius: 16, padding: 14, margin: "0 0 12px", cursor: "pointer", color: "var(--text)", fontFamily: "inherit" }}>
                {p.cover_url && safeUrl(p.cover_url) && <img src={safeUrl(p.cover_url)} alt={p.cover_alt || ""} loading="lazy" style={{ width: "100%", borderRadius: 10, marginBottom: 10 }} />}
                <div style={{ fontWeight: 800, fontSize: 17, lineHeight: tall(tab) ? 1.6 : 1.35 }}>{p.title}</div>
                {p.excerpt && <div style={{ fontSize: 14, color: "var(--text2, #6b5d52)", margin: "6px 0 8px", lineHeight: 1.55 }}>{p.excerpt}</div>}
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{catName(p.category || "tips", tab)} · {fmtDate(p.created_at, tab)} · {minsText(readMins(p.body), tab)}{counts[tab + "|" + p.slug] ? <span data-blog-views> · {viewsText(counts[tab + "|" + p.slug], tab)}</span> : null}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
