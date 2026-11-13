import { useState, useEffect } from "react";
import { sb } from "./supabase-client";

import { pickT, xl, ALL_LANGS, LANG_META, localeOf, dateLocale, isExtraLang } from "./lang-extra";
/* Blog (owner 2026-10-31): articles in Thai, English and Mandarin (and, since 2026-11-11, Japanese, Korean and Russian), written only by the top admin (AdminBlog.tsx) and stored in public.blog_posts.
   The body is plain text with a tiny markup: "# " / "## " headings, "- " bullets, **bold**, [text](https://link) and ![alt](https://image) — rendered as React elements, never as HTML. */
type Cat = { id: string; icon: string; th: string; en: string; zh: string; ja?: string; ko?: string; ru?: string };
export const BLOG_CATS: Cat[] = [
  { id: "tips", icon: "💡", th: "เทคนิคการฝึก", en: "Practice tips", zh: "练习技巧", ja: "練習のコツ", ko: "연습 팁", ru: "Советы по занятиям" },
  { id: "theory", icon: "🎼", th: "ทฤษฎีดนตรี", en: "Music theory", zh: "乐理", ja: "音楽理論", ko: "음악 이론", ru: "Теория музыки" },
  { id: "songs", icon: "🎵", th: "เพลงและเพลงฝึก", en: "Songs", zh: "曲目", ja: "曲と練習曲", ko: "곡과 연습곡", ru: "Песни и пьесы" },
  { id: "news", icon: "📣", th: "ข่าวและประกาศ", en: "News", zh: "新闻公告", ja: "お知らせ", ko: "소식과 공지", ru: "Новости" },
  { id: "story", icon: "✨", th: "เรื่องราว", en: "Stories", zh: "故事", ja: "ストーリー", ko: "이야기", ru: "Истории" },
];
// a category's name in any of the six languages (the names above are the same words the static blog pages use)
export const catLabel = (c: Cat, lang: string): string => lang === "th" ? c.th : lang === "zh" ? c.zh : (isExtraLang(lang) && (c as any)[lang]) || xl(lang, c.en);
export const catName = (id: string, lang: string) => { const c = BLOG_CATS.find(x => x.id === id) || BLOG_CATS[0]; return c.icon + " " + catLabel(c, lang); };
export const readMins = (t: string) => Math.max(1, Math.round(((t || "").length) / (/[\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(t || "") ? 450 : 1100)));
// "3 min" in the language of the article; `long` is the form beside the date in an open article
const MIN_TXT: Record<string, [string, string]> = { th: ["นาที", "นาที"], zh: ["分钟", "分钟"], ja: ["分", "分で読めます"], ko: ["분", "분이면 읽어요"], ru: ["мин", "мин чтения"] };
export const minsText = (n: number, lang: string, long = false) => { const u = MIN_TXT[lang]; return u ? (lang === "ja" || lang === "ko" ? "" + n : n + " ") + u[long ? 1 : 0] : n + " " + (long ? xl(lang, "min read") : "min"); };
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
  const flush = () => { if (bullets.length) { els.push(<ul key={"u" + key++} style={{ paddingLeft: 22, margin: "8px 0" }}>{bullets.map((b, i) => <li key={i} style={{ margin: "4px 0" }}>{inline(b, "b" + i)}</li>)}</ul>); bullets = []; } };
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
// th-TH, zh-CN, ja-JP, ko-KR, ru-RU for their own readers, en-GB for English (dateLocale in lang-extra.ts)
export const fmtDate = (d: string, lang: string) => { try { return new Date(d).toLocaleDateString(dateLocale(lang), { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return ""; } };

/* Reader counts (owner 2026-11-07, supabase-blog-views-migration.sql): opening an article counts one view per device per day (public.blog_hit, the same call the static pages make) and the
   number is shown beside the date; the list shows it on every card. A random id of this browser (tg_blog_vid, never an account) is the "device". Every call fails soft: until the migration
   is applied no number shows. */
let memVid = "";
const blogVid = () => {
  const mk = () => Array.from({ length: 20 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  const okId = (v: string) => /^[A-Za-z0-9_-]{8,64}$/.test(v || "");
  try { let v = localStorage.getItem("tg_blog_vid") || ""; if (!okId(v)) { v = memVid || mk(); localStorage.setItem("tg_blog_vid", v); } memVid = v; return v; }
  catch (e) { if (!okId(memVid)) memVid = mk(); return memVid; }   // no storage: one id for this tab, so a reader is one device, not one per article
};
// the same words the static pages use: "1,234回閲覧" and "1,234회 조회" sit straight against the number, the others have a space
const VIEWS_UNIT: Record<string, string> = { th: "ยอดวิว", zh: "次浏览", ja: "回閲覧", ko: "회 조회", ru: "просмотров" };
export const viewsText = (n: number, lang: string) => "👁 " + n.toLocaleString(localeOf(lang)) + (lang === "ja" || lang === "ko" ? "" : " ") + (VIEWS_UNIT[lang] || xl(lang, "views"));
// ja / ko / ru articles are also committed as static pages (blog-src/ -> /blog/<lang>/) that exist before the database has any row in those languages
const STATIC_LANGS = ["ja", "ko", "ru"];
const STATIC_HOME: Record<string, { t: string; b: string }> = {
  ja: { t: "日本語の記事はこちらからお読みいただけます", b: "ブログの全記事を見る →" },
  ko: { t: "한국어 글은 여기에서 읽을 수 있어요", b: "블로그 전체 글 보기 →" },
  ru: { t: "Статьи на русском языке доступны на странице блога", b: "Все статьи блога →" },
};

export function BlogPage({ lang, onBack }: { lang: string; onBack?: () => void }) {
  const T = (th, en, zh) => pickT(lang, th, en, zh);
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [open, setOpen] = useState<BlogPost | null>(null);
  const [err, setErr] = useState(false);
  const [cat, setCat] = useState<string>("all");
  const [tab, setTab] = useState<string>(ALL_LANGS.includes(lang) ? lang : "en");   // the tab follows the app language
  const [counts, setCounts] = useState<Record<string, number>>({});   // "lang|slug" -> all-time views
  const [openViews, setOpenViews] = useState<number | null>(null);
  const [langOpen, setLangOpen] = useState(false);
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
    setOpenViews(null); if (!open) return; let off = false;
    const key = open.lang + "|" + open.slug;
    (sb as any).rpc("blog_hit", { p_lang: open.lang, p_slug: open.slug, p_vid: blogVid(), p_kind: "view" }).then(({ data, error }: any) => {
      if (off || error || typeof data !== "number" || data < 1) return;
      setOpenViews(data); setCounts(c => ({ ...c, [key]: data }));   // the list shows the same number when the reader goes back
    }, () => {});
    // fifteen seconds with the article open is a "read" (30 until 2026-11-12) (the static pages count the same), so the percentage in the admin card compares like with like
    const t = setTimeout(() => { (sb as any).rpc("blog_hit", { p_lang: open.lang, p_slug: open.slug, p_vid: blogVid(), p_kind: "read" }).then(() => {}, () => {}); }, 15000);
    return () => { off = true; clearTimeout(t); };
  }, [open && open.id]);
  useEffect(() => {
    let off = false; setPosts(null); setErr(false);
    sb.from("blog_posts").select("*").eq("published", true).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }: any) => { if (off) return; if (error) { setErr(true); setPosts([]); } else setPosts(data || []); }, () => { if (!off) { setErr(true); setPosts([]); } });
    return () => { off = true; };
  }, []);
  const inLang = (posts || []).filter(p => p.lang === tab), shown = cat === "all" ? inLang : inLang.filter(p => (p.category || "tips") === cat), mine = shown;
  return (
    <div className="profpage" data-blog>
      <div className="profhdr">
        <div className="profavwrap"><div style={{ fontSize: 36 }}>📝</div></div>
        <div className="profname">{T("บล็อก", "Blog", "博客")}</div>
        <div className="profxp-lbl" style={{ color: "var(--muted)", fontSize: 13 }}>{T("บทความเรื่องการเรียนเปียโนและดนตรี", "Articles on learning piano and music", "钢琴与音乐学习文章")}</div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 90px" }}>
        {!open && (
          /* ONE round flag button at the right edge (the thumb's side), a drop-down under it: the row of six tabs ran off the screen and every language added would have made it worse */
          <div data-blog-langs style={{ position: "relative", display: "flex", justifyContent: "flex-end", margin: "4px 0 14px" }}>
            <button type="button" data-blog-langbtn aria-haspopup="listbox" aria-expanded={langOpen} aria-label={T("เลือกภาษา", "Choose language", "选择语言")} onClick={() => setLangOpen(o => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 64, minHeight: 46, padding: "0 14px", border: "1.5px solid var(--bd, #e2d8cf)", borderRadius: 999, background: "var(--card, #fff)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontSize: 24, lineHeight: 1, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
              <span aria-hidden="true">{(LANG_META[tab] || LANG_META.en).flag}</span>
              <span aria-hidden="true" style={{ fontSize: 11, color: "var(--muted)", transform: langOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
            </button>
            {langOpen && (
              <div role="listbox" data-blog-langmenu style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, minWidth: 190, maxHeight: "min(60vh, 420px)", overflowY: "auto", background: "var(--card, #fff)", border: "1px solid var(--bd, #e2d8cf)", borderRadius: 16, padding: 6, boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>
                {ALL_LANGS.map(l => (
                  <button key={l} type="button" role="option" aria-selected={tab === l} data-blog-lang={l} onClick={() => { setTab(l); setCat("all"); setLangOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48, padding: "0 12px", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: tab === l ? 800 : 600, textAlign: "left", background: tab === l ? "var(--card2, #f4ece4)" : "transparent", color: tab === l ? "var(--clay, #d97757)" : "var(--text)" }}>
                    <span aria-hidden="true" style={{ fontSize: 22 }}>{LANG_META[l].flag}</span>
                    <span style={{ flex: 1 }}>{LANG_META[l].name}</span>
                    {tab === l ? <span aria-hidden="true">✓</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!open && inLang.length > 0 && (
          <div data-blog-cats style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, margin: "0 0 14px", scrollbarWidth: "none" }}>
            {[{ id: "all", icon: "📚", th: "ทั้งหมด", en: "All", zh: "全部", ja: "すべて", ko: "전체", ru: "Все" } as Cat, ...BLOG_CATS.filter(c => inLang.some(p => (p.category || "tips") === c.id))].map(c => (
              <button key={c.id} type="button" data-blog-cat={c.id} onClick={() => setCat(c.id)} style={{ flex: "0 0 auto", padding: "8px 14px", borderRadius: 999, border: "1.5px solid " + (cat === c.id ? "var(--clay, #d97757)" : "var(--bd, #e2d8cf)"), background: cat === c.id ? "var(--clay, #d97757)" : "var(--card, #fff)", color: cat === c.id ? "#fff" : "var(--text)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{c.icon} {catLabel(c, tab)}</button>
            ))}
          </div>
        )}
        {open ? (
          <article data-blog-post>
            <button className="songbtn ghost" onClick={() => setOpen(null)} style={{ marginBottom: 12 }}>← {T("กลับ", "Back", "返回")}</button>
            {open.cover_url && safeUrl(open.cover_url) && <img src={safeUrl(open.cover_url)} alt={open.cover_alt || ""} style={{ width: "100%", borderRadius: 14, marginBottom: 12 }} />}
            <h1 style={{ fontSize: 26, lineHeight: 1.3, margin: "4px 0 6px" }}>{open.title}</h1>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>{catName(open.category || "tips", open.lang)} · {fmtDate(open.created_at, open.lang)} · {minsText(readMins(open.body), open.lang, true)}{openViews ? <span data-blog-views> · {viewsText(openViews, open.lang)}</span> : null}</div>
            <BlogBody text={open.body} />
          </article>
        ) : posts === null ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>…</div>
        ) : shown.length === 0 ? (
          STATIC_LANGS.includes(tab) ? null : <div style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>{err ? T("โหลดบทความไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't load articles — please try again", "文章加载失败，请重试") : tab === "th" ? "ยังไม่มีบทความภาษาไทย โปรดรอติดตาม" : tab === "zh" ? "暂无中文文章，敬请期待" : "No English articles yet — check back soon"}</div>
        ) : shown.map(p => (
          <button key={p.id} data-blog-card onClick={() => setOpen(p)} style={{ display: "block", width: "100%", textAlign: "left", background: "var(--card)", border: "1px solid var(--bd, #eadfd4)", borderRadius: 16, padding: 14, margin: "0 0 12px", cursor: "pointer", color: "var(--text)", fontFamily: "inherit" }}>
            {p.cover_url && safeUrl(p.cover_url) && <img src={safeUrl(p.cover_url)} alt={p.cover_alt || ""} loading="lazy" style={{ width: "100%", borderRadius: 10, marginBottom: 10 }} />}
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.35 }}>{p.title}</div>
            {p.excerpt && <div style={{ fontSize: 14, color: "var(--text2, #6b5d52)", margin: "6px 0 8px", lineHeight: 1.55 }}>{p.excerpt}</div>}
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{catName(p.category || "tips", tab)} · {fmtDate(p.created_at, tab)} · {minsText(readMins(p.body), tab)}{counts[tab + "|" + p.slug] ? <span data-blog-views> · {viewsText(counts[tab + "|" + p.slug], tab)}</span> : null}</div>
          </button>
        ))}
        {!open && posts !== null && STATIC_LANGS.includes(tab) && (
          <a data-blog-static={tab} href={"https://www.tigaalpha.com/blog/" + tab + "/"} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", textDecoration: "none", background: "var(--card)", border: "1px solid var(--bd, #eadfd4)", borderRadius: 16, padding: shown.length ? 12 : 22, margin: "0 0 12px", color: "var(--text)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.4 }}>{STATIC_HOME[tab].t}</div>
            <div style={{ fontSize: 14, color: "var(--clay, #d97757)", fontWeight: 700, marginTop: 6 }}>{STATIC_HOME[tab].b}</div>
          </a>
        )}
      </div>
    </div>
  );
}
