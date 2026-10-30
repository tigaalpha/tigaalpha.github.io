import { useState, useEffect, useRef } from "react";
import { sb } from "./supabase-client";
import { BlogBody, BlogPost, BLOG_CATS, catName } from "./BlogPage";

/* Admin: write, edit, publish and delete blog articles in Thai / English / Mandarin, with a category, a cover picture, pictures inside the text and links.
   Rendered only for admin_tier >= 3 (App.tsx); the table's and the image bucket's RLS (public.is_top_admin()) refuse anyone else even if this screen were reached. */
const slugOf = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const EMPTY = { id: "", lang: "th", category: "tips", slug: "", title: "", excerpt: "", body: "", cover_url: "", published: false };
const BUCKET = "blog-images";
export function AdminBlog({ lang }: { lang: string }) {
  const T = (th: string, en: string, zh: string) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [rows, setRows] = useState<BlogPost[] | null>(null);
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null), [prev, setPrev] = useState(false), [up, setUp] = useState(false);
  const [filt, setFilt] = useState("all");
  const taRef = useRef<HTMLTextAreaElement>(null), coverRef = useRef<HTMLInputElement>(null), imgRef = useRef<HTMLInputElement>(null);
  const say = (t: string, ok = false) => setMsg({ t, ok });
  const load = () => sb.from("blog_posts").select("*").order("created_at", { ascending: false }).limit(300).then(({ data, error }: any) => { if (error) say(error.message.includes("blog_posts") ? T("ยังไม่มีตารางบล็อกในฐานข้อมูล — รัน supabase-blog-migration.sql ก่อน", "The blog table does not exist yet — run supabase-blog-migration.sql first", "数据库中还没有博客表 — 请先运行 supabase-blog-migration.sql") : error.message); setRows(data || []); }, (e: any) => { say(String(e && e.message || e)); setRows([]); });
  useEffect(() => { load(); }, []);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, border: "1.5px solid var(--bd, #e2d8cf)", background: "var(--card)", color: "var(--text)", fontSize: 15, fontFamily: "inherit" };
  const lab: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "var(--text2, #6b5d52)", margin: "4px 0 -4px" };
  const tb: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--bd, #e2d8cf)", background: "var(--card)", color: "var(--text)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

  function insert(before: string, after = "", fallback = "") {
    const ta = taRef.current, body: string = f.body || ""; const s = ta ? ta.selectionStart : body.length, e = ta ? ta.selectionEnd : body.length;
    const mid = body.slice(s, e) || fallback, next = body.slice(0, s) + before + mid + after + body.slice(e); set("body", next);
    setTimeout(() => { if (ta) { ta.focus(); const p = s + before.length; ta.setSelectionRange(p, p + mid.length); } }, 0);
  }
  function addLink() {
    const url = window.prompt(T("วางลิงก์ (ขึ้นต้นด้วย https://)", "Paste the link (starts with https://)", "粘贴链接（以 https:// 开头）"), "https://");
    if (!url) return; if (!/^https:\/\/\S+$/i.test(url)) { say(T("ลิงก์ต้องขึ้นต้นด้วย https://", "The link must start with https://", "链接必须以 https:// 开头")); return; }
    insert("[", `](${url})`, T("ข้อความลิงก์", "link text", "链接文字"));
  }
  async function upload(file: File): Promise<string> {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error(T("ใช้ได้เฉพาะรูป JPG, PNG, WebP, GIF", "Only JPG, PNG, WebP or GIF pictures", "仅支持 JPG、PNG、WebP、GIF 图片"));
    if (file.size > 5 * 1024 * 1024) throw new Error(T("รูปใหญ่เกิน 5 MB", "The picture is over 5 MB", "图片超过 5 MB"));
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1], path = `${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) throw new Error(error.message.includes("Bucket not found") ? T("ยังไม่มีที่เก็บรูป — รัน supabase-blog-migration.sql ก่อน", "The image storage does not exist yet — run supabase-blog-migration.sql first", "图片存储尚未创建 — 请先运行 supabase-blog-migration.sql") : error.message);
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  async function pick(e: React.ChangeEvent<HTMLInputElement>, kind: "cover" | "body") {
    const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
    setUp(true); say(T("กำลังอัปโหลดรูป…", "Uploading the picture…", "正在上传图片…"), true);
    try { const url = await upload(file); if (kind === "cover") set("cover_url", url); else insert(`\n![${T("คำอธิบายรูป", "describe the picture", "图片说明")}](${url})\n`); say(T("อัปโหลดรูปแล้ว", "Picture uploaded", "图片已上传"), true); }
    catch (err: any) { say(String(err && err.message || err)); } finally { setUp(false); }
  }
  async function save(publish?: boolean) {
    if (!f || busy) return; setMsg(null);
    if (!f.title.trim()) { say(T("กรุณาใส่หัวข้อ", "Please enter a title", "请输入标题")); return; }
    if (publish && f.body.trim().length < 20) { say(T("เนื้อหาสั้นเกินไปสำหรับเผยแพร่", "The text is too short to publish", "正文太短，无法发布")); return; }
    setBusy(true);
    try {
      const { data: u } = await sb.auth.getUser();
      let slug = (f.slug.trim() ? slugOf(f.slug) : slugOf(f.title)) || "post-" + Date.now().toString(36);
      const row: any = { lang: f.lang, category: f.category, slug, title: f.title.trim(), excerpt: f.excerpt.trim(), body: f.body, cover_url: f.cover_url.trim() || null, published: publish === undefined ? f.published : publish, updated_at: new Date().toISOString() };
      const q = f.id ? sb.from("blog_posts").update(row).eq("id", f.id) : sb.from("blog_posts").insert({ ...row, author_id: u && u.user ? u.user.id : null });
      const { error } = await q;
      if (error) { say(/duplicate|unique/i.test(error.message) ? T("มีบทความภาษานี้ที่ใช้ลิงก์สั้นนี้แล้ว ลองเปลี่ยนลิงก์สั้น", "An article in this language already uses this slug — change the slug", "该语言下已有相同链接名的文章，请更换") : error.message); return; }
      say(publish ? T("เผยแพร่แล้ว ✓", "Published ✓", "已发布 ✓") : T("บันทึกแล้ว ✓", "Saved ✓", "已保存 ✓"), true); setF(null); await load();
    } catch (e: any) { say(String(e && e.message || e)); } finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!window.confirm(T("ลบบทความนี้ถาวร?", "Delete this article for good?", "永久删除这篇文章？"))) return;
    const { error } = await sb.from("blog_posts").delete().eq("id", id); if (error) say(error.message); else { setF(null); say(T("ลบแล้ว", "Deleted", "已删除"), true); load(); }
  }
  const shownRows = (rows || []).filter(r => filt === "all" || r.lang === filt);
  return (
    <div className="adminscroll" data-admin-blog style={{ padding: 14, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>📝 {T("บล็อก", "Blog", "博客")}</div>
      {msg && <div role="status" style={{ background: msg.ok ? "#e7f5ec" : "#fdecea", color: msg.ok ? "#1e6b3a" : "#b3261e", borderRadius: 10, padding: "9px 12px", fontSize: 14, marginBottom: 12 }}>{msg.t}</div>}
      {!f ? (<>
        <button className="songbtn" data-blog-new onClick={() => { setF({ ...EMPTY }); setPrev(false); setMsg(null); }} style={{ marginBottom: 12, width: "100%", padding: "14px 0", fontSize: 16 }}>＋ {T("เขียนบทความใหม่", "Write a new article", "写新文章")}</button>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {([["all", T("ทั้งหมด", "All", "全部")], ["th", "ไทย"], ["en", "English"], ["zh", "中文"]] as const).map(([l, n]) => <button key={l} type="button" onClick={() => setFilt(l)} className={filt === l ? "songbtn" : "songbtn ghost"} style={{ flex: 1, padding: "8px 0" }}>{n}</button>)}
        </div>
        {rows === null ? "…" : shownRows.length === 0 ? <div style={{ color: "var(--muted)", padding: 16, textAlign: "center" }}>{T("ยังไม่มีบทความ กด “เขียนบทความใหม่” เพื่อเริ่ม", "No articles yet — tap “Write a new article” to start", "暂无文章，点“写新文章”开始")}</div> : shownRows.map(r => (
          <div key={r.id} data-blog-row style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--card)", border: "1px solid var(--bd, #eadfd4)", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
            {r.cover_url ? <img src={r.cover_url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 52, height: 52, borderRadius: 8, background: "var(--card2, #f4ece4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📄</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.lang.toUpperCase()} · {catName(r.category || "tips", lang)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: r.published ? "#1e6b3a" : "#a8651a" }}>{r.published ? "● " + T("เผยแพร่แล้ว", "Published", "已发布") : "○ " + T("ฉบับร่าง", "Draft", "草稿")}</div>
            </div>
            <button className="songbtn ghost" onClick={() => { setF({ ...EMPTY, ...r, category: r.category || "tips", cover_url: r.cover_url || "" }); setPrev(false); setMsg(null); }}>{T("แก้ไข", "Edit", "编辑")}</button>
          </div>
        ))}
      </>) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={lab}>1 · {T("ภาษาของบทความ", "Article language", "文章语言")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["th", "en", "zh"].map(l => <button key={l} type="button" data-blog-setlang={l} onClick={() => set("lang", l)} className={f.lang === l ? "songbtn" : "songbtn ghost"} style={{ flex: 1 }}>{l === "th" ? "ไทย" : l === "en" ? "English" : "中文"}</button>)}
          </div>
          <div style={lab}>2 · {T("หมวดหมู่", "Category", "分类")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {BLOG_CATS.map(c => <button key={c.id} type="button" onClick={() => set("category", c.id)} className={f.category === c.id ? "songbtn" : "songbtn ghost"} style={{ padding: "8px 12px" }}>{c.icon} {lang === "th" ? c.th : lang === "zh" ? c.zh : c.en}</button>)}
          </div>
          <div style={lab}>3 · {T("หัวข้อ", "Title", "标题")}</div>
          <input style={{ ...inp, fontSize: 18, fontWeight: 700 }} placeholder={T("หัวข้อบทความ", "Article title", "文章标题")} value={f.title} onChange={e => set("title", e.target.value)} />
          <div style={lab}>4 · {T("คำโปรยสั้น ๆ (แสดงในรายการและ Google)", "Short summary (shown in the list and on Google)", "简短摘要（显示在列表和 Google 中）")}</div>
          <input style={inp} maxLength={200} value={f.excerpt} onChange={e => set("excerpt", e.target.value)} />
          <div style={lab}>5 · {T("รูปปก", "Cover picture", "封面图")}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {f.cover_url ? <img src={f.cover_url} alt="" style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 96, height: 64, borderRadius: 8, background: "var(--card2, #f4ece4)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>{T("ไม่มีรูป", "No picture", "无图片")}</div>}
            <button type="button" style={tb} disabled={up} onClick={() => coverRef.current && coverRef.current.click()}>📷 {f.cover_url ? T("เปลี่ยนรูป", "Change", "更换") : T("อัปโหลดรูปปก", "Upload cover", "上传封面")}</button>
            {f.cover_url && <button type="button" style={tb} onClick={() => set("cover_url", "")}>✕</button>}
            <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => pick(e, "cover")} />
          </div>
          <div style={lab}>6 · {T("เนื้อหา", "Content", "正文")}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" style={tb} onClick={() => insert("\n# ", "\n", T("หัวข้อใหญ่", "Heading", "大标题"))}>H1</button>
            <button type="button" style={tb} onClick={() => insert("\n## ", "\n", T("หัวข้อรอง", "Subheading", "小标题"))}>H2</button>
            <button type="button" style={tb} onClick={() => insert("**", "**", T("ตัวหนา", "bold", "加粗"))}><b>B</b></button>
            <button type="button" style={tb} onClick={() => insert("\n- ", "", T("รายการ", "item", "列表项"))}>• {T("รายการ", "List", "列表")}</button>
            <button type="button" data-blog-link style={tb} onClick={addLink}>🔗 {T("ใส่ลิงก์", "Link", "链接")}</button>
            <button type="button" data-blog-img style={tb} disabled={up} onClick={() => imgRef.current && imgRef.current.click()}>🖼 {T("ใส่รูป", "Picture", "图片")}</button>
            <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => pick(e, "body")} />
          </div>
          <textarea ref={taRef} data-blog-body style={{ ...inp, minHeight: 300, lineHeight: 1.7 }} placeholder={T("พิมพ์บทความที่นี่ — ใช้ปุ่มด้านบนเพื่อใส่หัวข้อ ตัวหนา ลิงก์ และรูปตรงตำแหน่งเคอร์เซอร์", "Write here — use the buttons above for headings, bold, links and pictures at the cursor", "在此写作 — 用上方按钮在光标处插入标题、加粗、链接和图片")} value={f.body} onChange={e => set("body", e.target.value)} />
          <div style={lab}>7 · {T("ลิงก์สั้นของบทความ (ไม่ต้องกรอกก็ได้)", "Article web address (optional)", "文章网址名（可选）")}</div>
          <input style={inp} placeholder="piano-posture" value={f.slug} onChange={e => set("slug", e.target.value)} />
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -6 }}>{T("ใช้ตัวอักษรอังกฤษ ตัวเลข และ - เท่านั้น ถ้าเขียนบทความเดียวกันหลายภาษา ให้ใช้ลิงก์สั้นเดียวกัน ระบบจะเชื่อมภาษาให้อัตโนมัติ", "Letters, numbers and - only. Use the same address for the same article in other languages and they link up for search engines.", "仅限字母、数字和 -。同一篇文章的不同语言版本请使用相同网址名，搜索引擎会自动关联。")}</div>
          <label style={{ fontSize: 14, display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={prev} onChange={e => setPrev(e.target.checked)} style={{ width: 18, height: 18 }} /> 👁 {T("ดูตัวอย่างบทความ", "Preview the article", "预览文章")}</label>
          {prev && <div data-blog-preview style={{ border: "1px dashed var(--bd, #e2d8cf)", borderRadius: 12, padding: 14, background: "var(--card)" }}>{f.cover_url && <img src={f.cover_url} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 8 }} />}<h2 style={{ marginTop: 0 }}>{f.title}</h2><BlogBody text={f.body} /></div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "sticky", bottom: 0, background: "var(--bg, #faf6f1)", padding: "10px 0" }}>
            <button className="songbtn" disabled={busy || up} data-blog-publish onClick={() => save(true)} style={{ flex: 2 }}>{f.published ? T("อัปเดตและเผยแพร่", "Update & publish", "更新并发布") : T("เผยแพร่เลย", "Publish now", "立即发布")}</button>
            <button className="songbtn ghost" disabled={busy || up} data-blog-draft onClick={() => save(false)} style={{ flex: 1 }}>{T("เก็บเป็นฉบับร่าง", "Save draft", "存草稿")}</button>
            <button className="songbtn ghost" onClick={() => setF(null)}>{T("ยกเลิก", "Cancel", "取消")}</button>
            {f.id && <button className="songbtn ghost" style={{ color: "#b3261e", borderColor: "#b3261e" }} onClick={() => del(f.id)}>{T("ลบ", "Delete", "删除")}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
