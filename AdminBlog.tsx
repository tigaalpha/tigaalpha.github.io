import { useState, useEffect } from "react";
import { sb } from "./supabase-client";
import { BlogBody, BlogPost } from "./BlogPage";

/* Admin: write, edit, publish and delete blog articles in Thai / English / Mandarin. Rendered only for admin_tier >= 3 (App.tsx), and the table's RLS
   (public.is_top_admin()) refuses anyone else even if this screen were reached. */
const slugOf = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "post-" + Date.now().toString(36);
const EMPTY = { id: "", lang: "th", slug: "", title: "", excerpt: "", body: "", cover_url: "", published: false };
export function AdminBlog({ lang }: { lang: string }) {
  const T = (th: string, en: string, zh: string) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [rows, setRows] = useState<BlogPost[] | null>(null);
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(""), [prev, setPrev] = useState(false);
  const load = () => sb.from("blog_posts").select("*").order("created_at", { ascending: false }).limit(200).then(({ data, error }: any) => { if (error) setMsg(error.message); setRows(data || []); }, (e: any) => { setMsg(String(e && e.message || e)); setRows([]); });
  useEffect(() => { load(); }, []);
  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--bd, #e2d8cf)", background: "var(--card)", color: "var(--text)", fontSize: 15, fontFamily: "inherit" };
  async function save(publish?: boolean) {
    if (!f || busy) return; setMsg("");
    if (!f.title.trim()) { setMsg(T("กรุณาใส่หัวข้อ", "Please enter a title", "请输入标题")); return; }
    setBusy(true);
    try {
      const { data: u } = await sb.auth.getUser();
      const row: any = { lang: f.lang, slug: (f.slug || slugOf(f.title)).trim(), title: f.title.trim(), excerpt: f.excerpt.trim(), body: f.body, cover_url: f.cover_url.trim() || null, published: publish === undefined ? f.published : publish, updated_at: new Date().toISOString() };
      const q = f.id ? sb.from("blog_posts").update(row).eq("id", f.id) : sb.from("blog_posts").insert({ ...row, author_id: u && u.user ? u.user.id : null });
      const { error } = await q; if (error) { setMsg(error.message); return; }
      setMsg(T("บันทึกแล้ว", "Saved", "已保存")); setF(null); await load();
    } catch (e: any) { setMsg(String(e && e.message || e)); } finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!window.confirm(T("ลบบทความนี้?", "Delete this article?", "删除这篇文章？"))) return;
    const { error } = await sb.from("blog_posts").delete().eq("id", id); if (error) setMsg(error.message); else { setF(null); load(); }
  }
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  return (
    <div className="adminscroll" data-admin-blog style={{ padding: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>📝 {T("บล็อก", "Blog", "博客")}</div>
      {msg && <div role="status" style={{ background: "var(--card2, #f4ece4)", borderRadius: 8, padding: "8px 10px", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      {!f ? (<>
        <button className="songbtn" data-blog-new onClick={() => { setF({ ...EMPTY }); setPrev(false); setMsg(""); }} style={{ marginBottom: 12 }}>＋ {T("เขียนบทความใหม่", "New article", "写新文章")}</button>
        {rows === null ? "…" : rows.length === 0 ? <div style={{ color: "var(--muted)" }}>{T("ยังไม่มีบทความ", "No articles yet", "暂无文章")}</div> : rows.map(r => (
          <div key={r.id} data-blog-row style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--card)", border: "1px solid var(--bd, #eadfd4)", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, background: "var(--card2, #f4ece4)", borderRadius: 6, padding: "2px 7px" }}>{r.lang.toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div><div style={{ fontSize: 12, color: r.published ? "#1e6b3a" : "var(--muted)" }}>{r.published ? T("เผยแพร่แล้ว", "Published", "已发布") : T("ฉบับร่าง", "Draft", "草稿")}</div></div>
            <button className="songbtn ghost" onClick={() => { setF({ ...r, cover_url: r.cover_url || "" }); setPrev(false); setMsg(""); }}>{T("แก้ไข", "Edit", "编辑")}</button>
          </div>
        ))}
      </>) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["th", "en", "zh"].map(l => <button key={l} type="button" onClick={() => set("lang", l)} className={f.lang === l ? "songbtn" : "songbtn ghost"} style={{ flex: 1 }}>{l === "th" ? "ไทย" : l === "en" ? "English" : "中文"}</button>)}
          </div>
          <input style={inp} placeholder={T("หัวข้อ", "Title", "标题")} value={f.title} onChange={e => set("title", e.target.value)} />
          <input style={inp} placeholder={T("ลิงก์สั้น (ภาษาอังกฤษ/ตัวเลข เว้นว่างได้)", "Slug (letters/numbers, optional)", "链接名（字母/数字，可留空）")} value={f.slug} onChange={e => set("slug", e.target.value)} />
          <input style={inp} placeholder={T("คำโปรยสั้น ๆ", "Short summary", "简短摘要")} value={f.excerpt} onChange={e => set("excerpt", e.target.value)} />
          <input style={inp} placeholder={T("ลิงก์รูปปก https://… (ไม่บังคับ)", "Cover image https://… (optional)", "封面图 https://…（可选）")} value={f.cover_url} onChange={e => set("cover_url", e.target.value)} />
          <textarea data-blog-body style={{ ...inp, minHeight: 280, lineHeight: 1.6 }} placeholder={T("เนื้อหา\n# หัวข้อใหญ่\n## หัวข้อรอง\n- ข้อความแบบรายการ\n**ตัวหนา**  [ลิงก์](https://…)  ![รูป](https://…)", "Body\n# Heading\n## Subheading\n- bullet\n**bold**  [link](https://…)  ![image](https://…)", "正文\n# 大标题\n## 小标题\n- 列表\n**加粗**  [链接](https://…)  ![图片](https://…)")} value={f.body} onChange={e => set("body", e.target.value)} />
          <label style={{ fontSize: 14 }}><input type="checkbox" checked={prev} onChange={e => setPrev(e.target.checked)} /> {T("ดูตัวอย่าง", "Preview", "预览")}</label>
          {prev && <div style={{ border: "1px dashed var(--bd, #e2d8cf)", borderRadius: 12, padding: 12 }}><h2 style={{ marginTop: 0 }}>{f.title}</h2><BlogBody text={f.body} /></div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="songbtn" disabled={busy} data-blog-publish onClick={() => save(true)}>{T("เผยแพร่", "Publish", "发布")}</button>
            <button className="songbtn ghost" disabled={busy} onClick={() => save(false)}>{T("บันทึกเป็นฉบับร่าง", "Save as draft", "存为草稿")}</button>
            <button className="songbtn ghost" onClick={() => setF(null)}>{T("ยกเลิก", "Cancel", "取消")}</button>
            {f.id && <button className="songbtn ghost" style={{ color: "#b3261e", borderColor: "#b3261e" }} onClick={() => del(f.id)}>{T("ลบ", "Delete", "删除")}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
