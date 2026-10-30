import { useState, useEffect } from "react";
import { sb } from "./supabase-client";

/* Blog (owner 2026-10-31): articles in Thai, English and Mandarin, written only by the top admin (AdminBlog.tsx) and stored in public.blog_posts.
   The body is plain text with a tiny markup: "# " / "## " headings, "- " bullets, **bold**, [text](https://link) and ![alt](https://image) — rendered as React elements, never as HTML. */
export type BlogPost = { id: string; lang: string; slug: string; title: string; excerpt: string; body: string; cover_url: string | null; published: boolean; created_at: string; updated_at: string };
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
const fmtDate = (d: string, lang: string) => { try { return new Date(d).toLocaleDateString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-GB", { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return ""; } };

export function BlogPage({ lang, onBack }: { lang: string; onBack?: () => void }) {
  const T = (th: string, en: string, zh: string) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [open, setOpen] = useState<BlogPost | null>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<string>(lang === "th" || lang === "zh" ? lang : "en");
  useEffect(() => {
    let off = false; setPosts(null); setErr(false);
    sb.from("blog_posts").select("*").eq("published", true).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }: any) => { if (off) return; if (error) { setErr(true); setPosts([]); } else setPosts(data || []); }, () => { if (!off) { setErr(true); setPosts([]); } });
    return () => { off = true; };
  }, []);
  const shown = (posts || []).filter(p => p.lang === tab), mine = shown;
  return (
    <div className="profpage" data-blog>
      <div className="profhdr">
        <div className="profavwrap"><div style={{ fontSize: 36 }}>📝</div></div>
        <div className="profname">{T("บล็อก", "Blog", "博客")}</div>
        <div className="profxp-lbl" style={{ color: "var(--muted)", fontSize: 13 }}>{T("บทความเรื่องการเรียนเปียโนและดนตรี", "Articles on learning piano and music", "钢琴与音乐学习文章")}</div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 90px" }}>
        {!open && (
          <div data-blog-langs style={{ display: "flex", gap: 6, background: "var(--card2, #f4ece4)", borderRadius: 999, padding: 4, margin: "4px 0 16px" }}>
            {([["th", "ไทย"], ["en", "English"], ["zh", "中文"]] as const).map(([l, n]) => (
              <button key={l} type="button" data-blog-lang={l} onClick={() => setTab(l)} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 999, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", background: tab === l ? "var(--card, #fff)" : "transparent", color: tab === l ? "var(--clay, #d97757)" : "var(--muted)", boxShadow: tab === l ? "0 1px 4px rgba(0,0,0,.12)" : "none" }}>{n}</button>
            ))}
          </div>
        )}
        {open ? (
          <article data-blog-post>
            <button className="songbtn ghost" onClick={() => setOpen(null)} style={{ marginBottom: 12 }}>← {T("กลับ", "Back", "返回")}</button>
            {open.cover_url && safeUrl(open.cover_url) && <img src={safeUrl(open.cover_url)} alt="" style={{ width: "100%", borderRadius: 14, marginBottom: 12 }} />}
            <h1 style={{ fontSize: 26, lineHeight: 1.3, margin: "4px 0 6px" }}>{open.title}</h1>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>{fmtDate(open.created_at, lang)} · {open.lang.toUpperCase()}</div>
            <BlogBody text={open.body} />
          </article>
        ) : posts === null ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>…</div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>{err ? T("โหลดบทความไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't load articles — please try again", "文章加载失败，请重试") : tab === "th" ? "ยังไม่มีบทความภาษาไทย โปรดรอติดตาม" : tab === "zh" ? "暂无中文文章，敬请期待" : "No English articles yet — check back soon"}</div>
        ) : shown.map(p => (
          <button key={p.id} data-blog-card onClick={() => setOpen(p)} style={{ display: "block", width: "100%", textAlign: "left", background: "var(--card)", border: "1px solid var(--bd, #eadfd4)", borderRadius: 16, padding: 14, margin: "0 0 12px", cursor: "pointer", color: "var(--text)", fontFamily: "inherit" }}>
            {p.cover_url && safeUrl(p.cover_url) && <img src={safeUrl(p.cover_url)} alt="" loading="lazy" style={{ width: "100%", borderRadius: 10, marginBottom: 10 }} />}
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.35 }}>{p.title}</div>
            {p.excerpt && <div style={{ fontSize: 14, color: "var(--text2, #6b5d52)", margin: "6px 0 8px", lineHeight: 1.55 }}>{p.excerpt}</div>}
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(p.created_at, tab)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
