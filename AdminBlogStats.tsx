import { useEffect, useState } from "react";
import { sb } from "./supabase-client";

import { pickT, ALL_LANGS, LANG_META } from "./lang-extra";
/* Blog readers for the admin analytics (owner 2026-11-07): views, people who stayed 30 seconds, log-in pop-ups shown and tapped, per article and per day.
   Data: public.blog_stats() from supabase-blog-views-migration.sql (top admin only). Until that migration is applied the card says so instead of showing zeros. Shown on the
   Analytics page (it follows that page's range) and at the top of the Blog admin (its own range). A "view" is one device per article per day, a "reader" one that stayed 30 s. */
type Stats = { totals: { views: number; readers: number; gates: number; clicks: number; devices: number }; rows: any[]; daily: { day: string; views: number; readers: number }[]; allTime: number };
const nf = (n: number) => (Number(n) || 0).toLocaleString("en-US");
export function BlogStatsCard({ lang, range = "30", own = false }: { lang: string; range?: string; own?: boolean }) {
  const T = (th, en, zh) => pickT(lang, th, en, zh);
  const [r, setR] = useState(range);
  const days = r === "all" ? 0 : Number(r) || 30;
  const [d, setD] = useState<Stats | null>(null);
  const [st, setSt] = useState<"load" | "ok" | "missing" | "err">("load");
  const [fl, setFl] = useState("all");   // language filter of the per-article table (th en zh ja ko ru)
  useEffect(() => { if (!own) setR(range); }, [range, own]);
  useEffect(() => {
    let off = false; setSt("load");
    (sb as any).rpc("blog_stats", { p_days: days }).then(({ data, error }: any) => {
      if (off) return;
      if (error) { setSt(error.code === "PGRST202" || error.code === "42883" || /Could not find the function/i.test(String(error.message || "")) ? "missing" : "err"); setD(null); return; }
      setD(data as Stats); setSt("ok");
    }, () => { if (!off) setSt("err"); });
    return () => { off = true; };
  }, [days]);
  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--bd, #eadfd4)", borderRadius: 14, padding: 14, margin: "0 0 12px" };
  const tile = (label: string, v: string, sub?: string) => (
    <div style={{ flex: "1 1 96px", background: "var(--card2, #f4ece4)", borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
      {sub ? <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div> : null}
    </div>
  );
  const t = d && d.totals;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) + "%" : "—");
  // the chart: the last 60 days as one bar each, days with no reader drawn as an empty slot, the scale taken from the days that are drawn
  const bars = (() => {
    if (!d || !d.daily || d.daily.length < 2) return [] as { day: string; views: number }[];
    const by: Record<string, number> = {}; d.daily.forEach(x => { by[x.day] = x.views; });
    const out: { day: string; views: number }[] = []; const last = new Date(d.daily[d.daily.length - 1].day + "T00:00:00Z"); const first = new Date(d.daily[0].day + "T00:00:00Z");
    for (let t = last.getTime(); t >= first.getTime() && out.length < 60; t -= 86400000) { const k = new Date(t).toISOString().slice(0, 10); out.unshift({ day: k, views: by[k] || 0 }); }
    return out;
  })();
  const maxDay = Math.max(1, ...bars.map(x => x.views));
  return (
    <div data-blog-stats style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>📝 {T("ผู้อ่านบล็อก", "Blog readers", "博客读者")}{days === 1 ? <span style={{ fontWeight: 400, fontSize: 12, color: "var(--muted)" }}> · {T("วันนี้ (เวลาไทย)", "today (Bangkok)", "今天（曼谷时间）")}</span> : null}</div>
        {own && (
          <div className="billtoggle">
            {[["7", T("7 วัน", "7d", "7天")], ["30", T("30 วัน", "30d", "30天")], ["all", T("ทั้งหมด", "All", "全部")]].map(([v, l]) => (
              <button key={v} className={`billtog${r === v ? " on" : ""}`} onClick={() => setR(v)}>{l}</button>
            ))}
          </div>
        )}
      </div>
      {st === "load" && <div style={{ color: "var(--muted)", fontSize: 14 }}>…</div>}
      {st === "missing" && <div data-blog-stats-missing style={{ color: "#a8651a", fontSize: 14 }}>{T("ยังไม่ได้รัน supabase-blog-views-migration.sql ในฐานข้อมูล จึงยังไม่มีตัวเลข", "supabase-blog-views-migration.sql has not been run yet, so there are no numbers", "尚未运行 supabase-blog-views-migration.sql，暂无数据")}</div>}
      {st === "err" && <div style={{ color: "#b3261e", fontSize: 14 }}>{T("โหลดสถิติไม่สำเร็จ", "Could not load the statistics", "统计加载失败")}</div>}
      {st === "ok" && t && (<>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tile(T("ยอดวิว", "Views", "浏览"), nf(t.views), T("เครื่องละครั้งต่อบทความต่อวัน", "one per device per article per day", "每设备每篇每天一次"))}
          {tile(T("อ่านนาน 30 วินาที", "Read 30 s", "阅读满30秒"), nf(t.readers), pct(t.readers, t.views) + " " + T("ของยอดวิว", "of views", "占浏览"))}
          {tile(T("ป๊อปอัปเด้ง", "Pop-up shown", "弹窗显示"), nf(t.gates))}
          {tile(T("กดสมัคร/ล็อกอิน", "Tapped sign-up / log-in", "点击注册/登录"), nf(t.clicks), pct(t.clicks, t.gates) + " " + T("ของที่เด้ง", "of shown", "占显示"))}
          {tile(T("จำนวนเครื่อง", "Devices", "设备数"), nf(t.devices))}
        </div>
        {bars.length > 1 && (
          <div data-blog-daily style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 56, margin: "12px 0 4px" }} aria-label={T("ยอดวิวรายวัน", "Views per day", "每日浏览")}>
            {bars.map(x => <div key={x.day} title={x.day + " · " + nf(x.views)} style={{ flex: 1, minWidth: 2, height: Math.max(2, Math.round((x.views / maxDay) * 52)), background: "var(--clay, #d97757)", borderRadius: 2, opacity: 0.85 }} />)}
          </div>
        )}
        {d && d.rows && d.rows.length > 0 && (
          <div data-blog-stats-langs style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {([["all", T("ทุกภาษา", "All languages", "全部语言")], ...ALL_LANGS.map(l => [l, LANG_META[l].name])] as [string, string][]).map(([l, n]) => (
              <button key={l} type="button" data-blog-stats-lang={l} onClick={() => setFl(l)} className={fl === l ? "songbtn" : "songbtn ghost"} style={{ padding: "4px 10px", fontSize: 12 }}>{n}</button>
            ))}
          </div>
        )}
        {d && d.rows && d.rows.filter((x: any) => fl === "all" || x.lang === fl).length > 0 ? (
          <div style={{ marginTop: 8, overflowX: "auto" }}>
            <table data-blog-stats-table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "4px 6px" }}>{T("บทความ", "Article", "文章")}</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>{T("วิว", "Views", "浏览")}</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>30s</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>{T("กด", "Taps", "点击")}</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>{T("รวมทั้งหมด", "All time", "累计")}</th>
              </tr></thead>
              <tbody>{d.rows.filter((x: any) => fl === "all" || x.lang === fl).slice(0, 40).map((x: any) => (
                <tr key={x.lang + x.slug} style={{ borderTop: "1px solid var(--bd, #eadfd4)" }}>
                  <td style={{ padding: "6px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b style={{ fontSize: 11, color: "var(--muted)" }}>{String(x.lang).toUpperCase()}</b> {x.title}</td>
                  <td style={{ padding: "6px", textAlign: "right", fontWeight: 700 }}>{nf(x.views)}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>{nf(x.readers)}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>{nf(x.clicks)}</td>
                  <td style={{ padding: "6px", textAlign: "right", color: "var(--muted)" }}>{nf(x.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>{T("ยังไม่มีคนอ่านในช่วงนี้", "No readers in this period yet", "此期间暂无读者")}</div>}
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>{T("นับเครื่องละครั้งต่อบทความต่อวัน ไม่นับบอท สมาชิกที่ล็อกอินอยู่ก็นับ", "Counted once per device per article per day; crawlers are not counted; logged-in members are", "每设备每篇文章每天计一次；不含爬虫；已登录会员也计入")}</div>
      </>)}
    </div>
  );
}
