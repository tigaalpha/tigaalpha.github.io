import { useState } from "react";
import { sb } from "./supabase-client";
import { buildVisitors, groupVisitors, DIMS, isWebviewUa, type Dim } from "./campaign-funnel";

/* ── admin: the landing funnel by campaign, ad set, creative, browser, variant,
   language, region and in-app-browser escape ──
   Computed here, in the browser, from the raw usage_events rows (kind land +
   attr) the admin is already allowed to read — no new RPC and no migration, so
   it works the day it ships. Paged by id so a month (≈30k rows) is ~30 small
   requests; the card loads only when asked, never on every dashboard refresh.

   The pure maths is campaign-funnel.ts (tested on its own). When this grows past
   a few months of data, replace fetchRows with a server-side aggregate; the
   record shape and the grouping stay. */

const PAGE = 1000;
const MAX_PAGES = 90;

async function fetchRows(since: string | null, onProgress: (n: number) => void) {
  const out: any[] = [];
  let last = 0;
  for (let p = 0; p < MAX_PAGES; p++) {
    let q = sb.from("usage_events")
      .select("id,anon_id,kind,item_id,ua,src")
      .in("kind", ["land", "attr"]).eq("simulated", false)
      .gt("id", last).order("id", { ascending: true }).limit(PAGE);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || !data.length) break;
    for (const r of data) out.push(r);
    last = Number(data[data.length - 1].id);
    onProgress(out.length);
    if (data.length < PAGE) break;
  }
  return out;
}

const DIM_LABEL: Record<Dim, [string, string, string]> = {
  inapp: ["ในแอปโซเชียล หรือเบราว์เซอร์จริง", "In-app vs real browser", "应用内 / 真实浏览器"],
  browser: ["เบราว์เซอร์ที่เปิดครั้งแรก", "Browser it started in", "起始浏览器"],
  source: ["แหล่งที่มา (src)", "Source", "来源"],
  campaign: ["แคมเปญ (utm_campaign)", "Campaign", "活动"],
  adset: ["ชุดโฆษณา (utm_term)", "Ad set", "广告组"],
  creative: ["ครีเอทีฟ (utm_content)", "Creative", "创意"],
  variant: ["เวอร์ชันหน้า (?v=)", "Landing variant", "页面版本"],
  lang: ["ภาษาของหน้า", "Landing language", "页面语言"],
  region: ["ภูมิภาค (จากโซนเวลา)", "Region (from time zone)", "地区（时区）"],
  escape: ["กดเปิดในเบราว์เซอร์จริง", "Tapped open-in-browser", "点了在浏览器打开"],
};

const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0) + "%" : "—");

export function CampaignFunnelCard({ range, T }) {
  const [dim, setDim] = useState<Dim>("inapp");
  const [vis, setVis] = useState<Map<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const [got, setGot] = useState(0);
  const [err, setErr] = useState("");

  const load = async () => {
    if (busy) return;
    setBusy(true); setErr(""); setGot(0);
    try {
      const since = range === "all" ? null : new Date(Date.now() - Number(range) * 86400000).toISOString();
      const rows = await fetchRows(since, setGot);
      setVis(buildVisitors(rows));
    } catch (e: any) {
      setErr(String((e && e.message) || e || "error"));
    } finally {
      setBusy(false);
    }
  };

  const rows = vis ? groupVisitors(vis.values(), dim) : [];
  const total = rows.reduce((n, r) => n + r.n, 0);
  const head = { fontSize: 10.5, opacity: 0.55, textAlign: "right" as const };
  const cell = { fontSize: 12, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };

  return (
    <div className="admstu-card" style={{ marginBottom: 10 }}>
      <div className="admstu-h">
        {T("กรวยแยกตามแคมเปญ · เบราว์เซอร์ · ภาษา", "Funnel by campaign · browser · language", "按活动 · 浏览器 · 语言的漏斗")}
      </div>
      <div className="admstu-row-sub">
        {T("คำนวณจากเหตุการณ์ดิบของหน้า Landing (นับตามเครื่อง) ไม่แตะฐานข้อมูล", "Computed from the raw landing events (per device); nothing is written", "由落地页原始事件计算（按设备）")}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0", flexWrap: "wrap" }}>
        <button className="billtog on" onClick={load} disabled={busy}>
          {busy ? `⏳ ${got}` : vis ? T("โหลดใหม่", "Reload", "重新加载") : T("โหลดข้อมูล", "Load data", "加载数据")}
        </button>
        <span className="admstu-row-sub">
          {range === "all" ? T("ทั้งหมด", "all time", "全部") : T(`${range} วันล่าสุด`, `last ${range}d`, `近 ${range} 天`)}
          {vis ? ` · ${total} ${T("คน", "visitors", "人")}` : ""}
        </span>
      </div>
      {err && <div className="admstu-row-sub" style={{ color: "#c2410c" }}>{err}</div>}

      {vis && (
        <>
          <div className="billtoggle" style={{ flexWrap: "wrap", marginBottom: 8 }}>
            {DIMS.map(d => (
              <button key={d} className={`billtog${dim === d ? " on" : ""}`} onClick={() => setDim(d)}>
                {T(DIM_LABEL[d][0], DIM_LABEL[d][1], DIM_LABEL[d][2])}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(90px,1.6fr) repeat(6, minmax(40px,1fr))", gap: "2px 8px", alignItems: "baseline", overflowX: "auto" }}>
            <div style={{ ...head, textAlign: "left" }}>{T(DIM_LABEL[dim][0], DIM_LABEL[dim][1], DIM_LABEL[dim][2])}</div>
            <div style={head}>{T("คน", "People", "人")}</div>
            <div style={head}>{T("กดคีย์", "Played", "弹琴")}</div>
            <div style={head}>{T("เจอด่าน", "Gate", "见门槛")}</div>
            <div style={head}>{T("ลองสมัคร", "Tried", "尝试")}</div>
            <div style={head}>{T("สมัครแล้ว", "Signed", "已注册")}</div>
            <div style={head}>{T("สมัคร %", "Signed %", "注册率")}</div>
            {rows.slice(0, 40).map(r => (
              <div key={r.key} style={{ display: "contents" }}>
                <div style={{ ...cell, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.key}>
                  {dim === "browser" && isWebviewUa(r.key) ? "⚠️ " : ""}{r.key}
                </div>
                <div style={cell}>{r.n}</div>
                <div style={cell}>{pct(r.played, r.n)}</div>
                <div style={cell}>{pct(r.gate, r.n)}</div>
                <div style={cell}>{r.tried}</div>
                <div style={{ ...cell, color: r.signed ? "#16a34a" : undefined, fontWeight: r.signed ? 700 : 400 }}>{r.signed}</div>
                <div style={{ ...cell, color: r.signed ? "#16a34a" : undefined }}>{pct(r.signed, r.n)}</div>
              </div>
            ))}
          </div>
          {dim === "escape" && (
            <div className="admstu-row-sub" style={{ marginTop: 8 }}>
              {T("“escaped” = กดปุ่มเปิดในเบราว์เซอร์จริง หรือมาถึงจากลิงก์นั้น (เครื่องเดียวกันนับเป็นคนเดียวหลังอัปเดตนี้)", "“escaped” = tapped the open-in-browser button or arrived from that link (one person after this update)", "“escaped” = 点了按钮或从该链接到达")}
            </div>
          )}
          <div className="admstu-row-sub" style={{ marginTop: 8 }}>
            {T("ข้อมูลแคมเปญ/ชุดโฆษณา/ครีเอทีฟ/ภูมิภาค เริ่มเก็บหลังอัปเดตนี้ และต้องใส่ utm_campaign / utm_term / utm_content ในลิงก์โฆษณา (ดูคู่มือด้านล่าง)", "Campaign / ad set / creative / region are collected from this update on, and need utm_campaign / utm_term / utm_content in the ad links (see the guide below)", "活动 / 广告组 / 创意 / 地区自本次更新后开始收集")}
          </div>
        </>
      )}

      <details style={{ marginTop: 8 }}>
        <summary className="admstu-row-sub" style={{ cursor: "pointer" }}>
          {T("คู่มือ: ตั้งลิงก์โฆษณาให้ระบบจับแคมเปญได้", "Guide: how to tag the ad links", "指南：如何给广告链接加标签")}
        </summary>
        <div className="admstu-row-sub" style={{ marginTop: 6, lineHeight: 1.6 }}>
          {T("Meta (Facebook / Instagram) — ใส่ในช่อง URL Parameters ของโฆษณา:", "Meta (Facebook / Instagram) — put this in the ad's URL Parameters:", "Meta —— 填入广告的 URL 参数：")}
          <code style={{ display: "block", margin: "4px 0", wordBreak: "break-all" }}>
            utm_source=fb&amp;utm_medium=paid&amp;utm_campaign={"{{campaign.name}}"}&amp;utm_term={"{{adset.name}}"}&amp;utm_content={"{{ad.name}}"}
          </code>
          {T("หน้าปลายทาง: /landing/ (ไทย) · /landing-en/ · /landing-zh/ — ต่อท้ายด้วย ", "Destinations: /landing/ (Thai) · /landing-en/ · /landing-zh/ — append ", "落地页：/landing/ · /landing-en/ · /landing-zh/ —— 末尾加 ")}
          <code>&amp;v=b</code>
          {T(" เพื่อทดสอบหน้าเวอร์ชัน B (ไม่ใส่ = เวอร์ชันเดิม) TikTok / YouTube ใช้ตัวแปรของแพลตฟอร์มนั้น หรือพิมพ์ชื่อเองก็ได้ ขอแค่ชื่อไม่ซ้ำกัน", " for landing variant B (none = the original). For TikTok / YouTube use that platform's macros, or type names by hand — just keep them unique.", " 测试 B 版（不加 = 原版）。TikTok / YouTube 用各自的宏，或手动命名。")}
        </div>
      </details>
    </div>
  );
}
