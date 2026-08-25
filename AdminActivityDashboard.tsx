import { useCallback, useEffect, useState } from "react";
import { sb } from "./supabase-client";

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN ACTIVITY ANALYTICS — visible ONLY to admin_tier >= 3 (the owner).

   Two views, both backed by is_top_admin()-gated RPCs (see
   supabase-activity-analytics-migration.sql):

   1. AdminActivity  — who used the app, which pages they stayed on and for
      how long, which buttons they pressed, where their score went up, plus a
      live event feed and a per-user drill-down.
   2. AdminSimBots   — demo-data generator for THIS dashboard only: a roster
      of simulated users that produce plausible activity rows so the owner can
      see the dashboard populated before real users arrive, and phase them out
      gradually. Rows are flagged simulated=true and are NEVER rendered to
      real learners anywhere in the app.
   ═══════════════════════════════════════════════════════════════════════════ */

const NAV_LABELS = {
  pathway: "⬡ Pathway", sensei: "◈ TIGA Chat", studio: "▶ Studio", videos: "🎬 วิดีโอสอน",
  profile: "Profile", admin: "Admin", today: "วันนี้", insights: "Insights", eargym: "Ear Gym",
  reading: "Reading", challenging: "Challenging", songs: "เพลง",
};
const fmtMs = (ms) => {
  const n = Number(ms) || 0;
  if (n < 60000) return Math.round(n / 1000) + " วิ";
  return (n / 60000).toFixed(1) + " นาที";
};
const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const label = (id) => NAV_LABELS[id] || String(id || "—");

/* ── shared: range picker ── */
function RangePicker({ range, setRange, T }) {
  return (
    <div className="billtoggle">
      {[["1", T("1 วัน", "1d", "1天")], ["7", T("7 วัน", "7d", "7天")], ["30", T("30 วัน", "30d", "30天")], ["all", T("ทั้งหมด", "All", "全部")]].map(([v, l]) => (
        <button key={v} className={`billtog${range === v ? " on" : ""}`} onClick={() => setRange(v)}>{l}</button>
      ))}
    </div>
  );
}

function RankRows({ rows, valueFor, T, valueLabel }) {
  const max = rows.length ? Math.max(...rows.map((r) => Number(valueFor(r)) || 1)) : 1;
  if (!rows.length) return <div className="admstu-empty">{T("ยังไม่มีข้อมูล", "No data yet", "暂无数据")}</div>;
  return rows.map((r, i) => (
    <div key={(r.item_id || r.user_id) + i} className="anrow">
      <span className="anrow-rank">#{i + 1}</span>
      <span className="anrow-name" style={{ maxWidth: "42%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label(r.item_id)}</span>
      <span className="anrow-barwrap"><span className="anrow-bar" style={{ width: `${Math.max(5, ((Number(valueFor(r)) || 0) / max) * 100)}%` }} /></span>
      <span className="anrow-hits">{valueLabel(Number(valueFor(r)) || 0)}</span>
    </div>
  ));
}

/* ═══════════════ 1. ACTIVITY DASHBOARD ═══════════════ */
export function AdminActivity({ lang }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [range, setRange] = useState("7");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [sel, setSel] = useState(null);      // selected user uuid
  const [detail, setDetail] = useState(null);
  const [showSim, setShowSim] = useState(true);

  // compute the ISO cutoff INSIDE each callback — computing it during render made
  // `since` a new string every render (Date.now() advances), giving `load` a new
  // identity every render, re-running the effect in an infinite spinner/data loop
  // (the "flickering screen" bug).
  const sinceFor = (r) => (r === "all" ? null : new Date(Date.now() - Number(r) * 86400000).toISOString());

  const load = useCallback(() => {
    const since = sinceFor(range);
    setOverview(null); setUsers(null); setDetail(null);
    sb.rpc("admin_activity_overview", { p_since: since, p_include_sim: showSim })
      .then(({ data }) => setOverview(data || {}), () => setOverview({}));
    sb.rpc("admin_activity_users", { p_since: since })
      .then(({ data }) => setUsers(data || []), () => setUsers([]));
  }, [range, showSim]);

  useEffect(() => { load(); }, [load]);

  // refresh the feed every 30s while the tab is open
  useEffect(() => {
    const iv = setInterval(() => {
      sb.rpc("admin_activity_overview", { p_since: sinceFor(range), p_include_sim: showSim })
        .then(({ data }) => setOverview(data || {}), () => {});
    }, 30000);
    return () => clearInterval(iv);
  }, [range, showSim]);

  const openUser = (u) => {
    setSel(u);
    setDetail(null);
    sb.rpc("admin_activity_user_detail", { p_user: u.user_id, p_since: sinceFor(range) })
      .then(({ data }) => setDetail(data || {}), () => setDetail({}));
  };

  const t = overview?.totals || {};

  return (
    <div className="adminpay">
      <RangePicker range={range} setRange={setRange} T={T} />

      <label style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0", fontSize: 12, color: "var(--tg-sub, #888)" }}>
        <input type="checkbox" checked={showSim} onChange={(e) => setShowSim(e.target.checked)} />
        {T("รวมข้อมูลจำลอง (บอท)", "Include simulated (bot) data", "包括模拟数据")}
      </label>

      {overview === null ? <div className="admstu-msg">⏳</div> : (
        <>
          {/* totals */}
          <div className="adminpay-cfg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              [T("ผู้ใช้ที่ทำกิจกรรม", "Active users", "活跃用户"), t.users ?? 0],
              [T("เหตุการณ์ทั้งหมด", "Total events", "事件总数"), t.events ?? 0],
              [T("เวลาใช้แอปรวม", "Total app time", "总使用时长"), fmtMs(t.page_time_ms)],
              [T("Score ขึ้น/เหตุการณ์คะแนน", "Score events", "分数事件"), t.score_events ?? 0],
            ].map(([k, v]) => (
              <div key={k} style={{ background: "var(--tg-card, #fff)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{k}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* pages by dwell time */}
          <div className="adminpay-cfg">
            <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 8 }}>📄 {T("หน้าที่ผู้ใช้อยู่นาน → สั้น", "Pages by time spent (long → short)", "页面停留时长")}</div>
            <RankRows rows={overview.pages || []} valueFor={(r) => r.total_ms} T={T} valueLabel={fmtMs} />
          </div>

          {/* buttons */}
          <div className="adminpay-cfg">
            <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 8 }}>🔘 {T("ปุ่มที่ถูกกดมากที่สุด", "Most-pressed buttons", "最常点击的按钮")}</div>
            <RankRows rows={overview.buttons || []} valueFor={(r) => r.hits} T={T} valueLabel={(n) => String(n)} />
          </div>

          {/* scores */}
          <div className="adminpay-cfg">
            <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 8 }}>🎯 {T("Score ขึ้น (EXP/Coins)", "Score events (EXP/Coins)", "分数事件")}</div>
            <RankRows rows={overview.scores || []} valueFor={(r) => r.hits} T={T} valueLabel={(n) => String(n)} />
          </div>

          {/* users */}
          <div className="adminpay-cfg">
            <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 8 }}>👥 {T("รายผู้ใช้ (กดเพื่อดูรายละเอียด)", "Users (tap for detail)", "用户列表")}</div>
            {users === null ? <div className="admstu-msg">⏳</div> : !users.length ? (
              <div className="admstu-empty">{T("ยังไม่มีข้อมูล", "No data yet", "暂无数据")}</div>
            ) : users.map((u) => (
              <button key={u.user_id} onClick={() => openUser(u)}
                className="admstu-row"
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid var(--tg-line, #eee)", background: "none", border: "none", textAlign: "left" }}>
                <span style={{ fontSize: 14 }}>{u.simulated ? "🤖" : "👤"}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.display_name}{u.simulated && <span style={{ fontSize: 10, opacity: 0.5 }}> (จำลอง)</span>}
                  </span>
                  <span style={{ display: "block", fontSize: 10, opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.user_id?.slice(0, 8)}… {u.email ? "· " + u.email : ""}
                  </span>
                </span>
                <span style={{ fontSize: 11, opacity: 0.7, textAlign: "right" }}>
                  {u.events} ครั้ง<br />{fmtMs(u.page_time_ms)}
                </span>
              </button>
            ))}
          </div>

          {/* per-user drill-down */}
          {sel && (
            <div className="adminpay-cfg" style={{ borderColor: "var(--tg-primary, #7c5cff)" }}>
              <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 8 }}>
                {sel.simulated ? "🤖" : "👤"} {sel.display_name} — {T("รายละเอียด", "Detail", "详情")}
                <button onClick={() => setSel(null)} style={{ float: "right", background: "none", border: "none", fontSize: 16 }}>✕</button>
              </div>
              {detail === null ? <div className="admstu-msg">⏳</div> : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, margin: "6px 0 4px" }}>📄 {T("หน้า + เวลาที่อยู่", "Pages + dwell", "页面与停留")}</div>
                  <RankRows rows={detail.pages || []} valueFor={(r) => r.total_ms} T={T} valueLabel={fmtMs} />
                  <div style={{ fontSize: 12, fontWeight: 600, margin: "10px 0 4px" }}>🔘 {T("ปุ่มที่กด", "Buttons", "按钮")}</div>
                  <RankRows rows={detail.buttons || []} valueFor={(r) => r.hits} T={T} valueLabel={(n) => String(n)} />
                  <div style={{ fontSize: 12, fontWeight: 600, margin: "10px 0 4px" }}>🎯 {T("Score", "Score", "分数")}</div>
                  <RankRows rows={detail.scores || []} valueFor={(r) => r.hits} T={T} valueLabel={(n) => String(n)} />
                  <div style={{ fontSize: 12, fontWeight: 600, margin: "10px 0 4px" }}>🕒 {T("กิจกรรมล่าสุด", "Recent events", "最近活动")}</div>
                  {(detail.recent || []).slice(0, 20).map((r, i) => (
                    <div key={i} style={{ fontSize: 11, opacity: 0.75, padding: "2px 0", borderBottom: "1px dashed var(--tg-line, #eee)" }}>
                      {fmtTime(r.created_at)} · {r.kind === "page" ? "📄" : r.kind === "nav" ? "🔘" : r.kind === "score" ? "🎯" : "•"} {label(r.item_id)}{r.duration_ms ? ` · ${fmtMs(r.duration_ms)}` : ""}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* live feed */}
          <div className="adminpay-cfg">
            <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 8 }}>🔴 {T("ฟีดสด (อัปเดตทุก 30 วิ)", "Live feed (30s refresh)", "实时动态")}</div>
            {(overview.recent || []).map((r, i) => (
              <div key={i} style={{ fontSize: 11, opacity: 0.8, padding: "3px 0", borderBottom: "1px dashed var(--tg-line, #eee)" }}>
                {fmtTime(r.created_at)} · {r.simulated ? "🤖" : "👤"} <b>{r.who}</b> · {r.kind === "page" ? "📄" : r.kind === "nav" ? "🔘" : r.kind === "score" ? "🎯" : "•"} {label(r.item_id)}{r.duration_ms ? ` · ${fmtMs(r.duration_ms)}` : ""}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════ 2. DEMO-BOT CONTROL (admin-only) ═══════════════ */
export function AdminSimBots({ lang }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const load = useCallback(() => {
    sb.rpc("admin_sim_config").then(({ data }) => setCfg(data || {}), () => setCfg({}));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(patch) {
    setBusy(true);
    const { data } = await sb.rpc("admin_sim_config", patch);
    if (data) setCfg(data);
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // generate immediately so the owner sees the effect right away
    sb.rpc("sim_tick").then(() => {}, () => {});
  }

  // "phase out": shrink the roster by ~20% each press, disable at < 1
  async function phaseOut() {
    const next = Math.max(0, Math.floor(((cfg?.bots || 0) * 4) / 5));
    await save({ p_enabled: next >= 1 ? true : false, p_bots: next });
  }

  // wipe ALL simulated rows from the database — real data is never touched.
  async function purgeAll() {
    if (!confirmPurge) { setConfirmPurge(true); setTimeout(() => setConfirmPurge(false), 4000); return; }
    setBusy(true);
    const { data } = await sb.rpc("sim_purge", { p_older_than_days: null });
    setPurgeMsg(data != null ? `${T("ลบแล้ว", "Deleted", "已删除")} ${data} ${T("แถวข้อมูลจำลอง", "simulated rows", "行模拟数据")}` : T("ลบไม่สำเร็จ", "Delete failed", "删除失败"));
    setBusy(false);
    setConfirmPurge(false);
    setTimeout(() => setPurgeMsg(null), 4000);
  }

  if (cfg === null) return <div className="admstu"><div className="admstu-msg">⏳</div></div>;

  const enabled = !!cfg.enabled;
  const realUsers = Number(cfg.real_users) || 0;
  const maxReal = Number(cfg.max_real_users) || 50;
  const overrideOn = !!cfg.override_auto_off;
  const autoOff = !!cfg.auto_disabled;

  // keep bots running past the auto-shutdown threshold (owner change of mind)
  async function setOverride(on) {
    await save({ p_override_auto_off: on });
  }

  return (
    <div className="adminpay">
      <div className="adminpay-cfg">
        <div className="admmg-h">🤖 {T("ข้อมูลจำลองสำหรับแดชบอร์ด (Demo Bots)", "Dashboard demo bots", "仪表板模拟数据")}</div>
        <div className="admstu-row-sub" style={{ margin: "8px 0 12px" }}>
          {T("สร้างกิจกรรมจำลองให้แดชบอร์ดกิจกรรมมีข้อมูลตั้งแต่วันเปิดตัว — แสดงเฉพาะในหน้าแอดมินเท่านั้น ผู้เรียนตัวจริงไม่เห็นทุกจุด ปิดทีละนิดได้ด้วยปุ่ม \"ลดทีละส่วน\"",
            "Generates simulated activity so the Activity dashboard has data from day one. Visible ONLY inside the admin console — real learners never see it anywhere. Phase out gradually with \"Reduce\".",
            "为活动仪表板生成模拟数据，仅管理员可见，学员不会看到。可逐步减少。")}
        </div>

        {/* launch status: real users vs auto-shutdown threshold */}
        <div style={{ background: autoOff ? "rgba(46,158,91,.12)" : "var(--tg-card, #f6f6f8)", borderRadius: 12, padding: "10px 12px", margin: "10px 0", fontSize: 12 }}>
          👥 {T("ผู้ใช้จริง 30 วันล่าสุด", "Real users (last 30d)", "真实用户（近30天）")}: <b>{realUsers}</b> / {maxReal}
          {autoOff
            ? <div style={{ color: "#2e9e5b", marginTop: 4, fontWeight: 600 }}>🎉 {T("มีผู้ใช้จริงครบตามเป้า — บอทปิดตัวเองอัตโนมัติแล้ว", "Real-user goal reached — bots have auto-shut down", "真实用户已达目标——机器人已自动关闭")}</div>
            : <div style={{ opacity: 0.65, marginTop: 4 }}>{T("บอทจะปิดตัวเองอัตโนมัติเมื่อผู้ใช้จริงครบ", "Bots auto-shut down once real users reach", "真实用户达到后将自动关闭机器人")} {maxReal} {T("คน", null, null)}</div>}
          {overrideOn && (
            <div style={{ color: "#b8860b", marginTop: 6, fontWeight: 600 }}>
              ⚡ {T("โหมดเปิดต่อ: บอทจะไม่ปิดอัตโนมัติแม้ผู้ใช้จริงเกินเป้า — คุณเลือกเอง", "Override ON: bots keep running past the threshold — your explicit choice", "覆盖模式：机器人不会自动关闭")}
            </div>
          )}
          {(autoOff || overrideOn) && (
            <button className={`billtog${overrideOn ? " on" : ""}`} disabled={busy}
              onClick={() => setOverride(!overrideOn)}
              style={{ marginTop: 8 }}>
              {overrideOn
                ? `🔒 ${T("กลับไปใช้ปิดอัตโนมัติ", "Back to auto-shutdown", "恢复自动关闭")}`
                : `⚡ ${T("เปลี่ยนใจ — เปิดบอทต่อ (ไม่ปิดอัตโนมัติ)", "Change my mind — keep bots running", "改变主意——继续运行机器人")}`}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{enabled ? "🟢 เปิด" : "⚪ ปิด"}</span>
          <button className={`billtog${enabled ? " on" : ""}`} disabled={busy}
            onClick={() => save({ p_enabled: !enabled })}>
            {enabled ? T("ปิดทั้งหมด", "Turn off", "全部关闭") : T("เปิดใช้งาน", "Enable", "启用")}
          </button>
          {saved && <span style={{ fontSize: 11, color: "#2e9e5b" }}>✓ {T("บันทึกแล้ว", "Saved", "已保存")}</span>}
        </div>

        <div style={{ margin: "12px 0" }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
            👥 {T("จำนวนบอท", "Bot count", "机器人数量")}: <b>{cfg.bots}</b> / 50
          </div>
          <input type="range" min="0" max="50" value={cfg.bots || 0} disabled={busy}
            onChange={(e) => setCfg({ ...cfg, bots: Number(e.target.value) })}
            onMouseUp={(e) => save({ p_bots: Number(e.target.value) })}
            onTouchEnd={(e) => save({ p_bots: Number(e.target.value) })}
            style={{ width: "100%" }} />
        </div>

        <div style={{ margin: "12px 0" }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
            ⚡ {T("ความถี่กิจกรรม/รอบ", "Activity per tick", "每次活动量")}: <b>{cfg.intensity}</b> (1-5)
          </div>
          <input type="range" min="1" max="5" value={cfg.intensity || 2} disabled={busy}
            onChange={(e) => setCfg({ ...cfg, intensity: Number(e.target.value) })}
            onMouseUp={(e) => save({ p_intensity: Number(e.target.value) })}
            onTouchEnd={(e) => save({ p_intensity: Number(e.target.value) })}
            style={{ width: "100%" }} />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button className="billtog" disabled={busy} onClick={() => save({})}>🔄 {T("สร้างกิจกรรมตอนนี้", "Generate now", "立即生成")}</button>
          <button className="billtog" disabled={busy || !(cfg.bots > 0)} onClick={phaseOut}>📉 {T("ลดทีละส่วน (ปิดค่อยๆ)", "Phase out (-20%)", "逐步减少")}</button>
          <button className="billtog" disabled={busy} onClick={purgeAll}
            style={confirmPurge ? { color: "#c0392b", borderColor: "#c0392b" } : undefined}>
            {confirmPurge ? `⚠️ ${T("กดอีกครั้งเพื่อยืนยันลบ", "Tap again to confirm", "再次点击确认删除")}` : `🗑️ ${T("ลบข้อมูลบอททั้งหมด", "Delete all bot data", "删除所有机器人数据")}`}
          </button>
          {purgeMsg && <span style={{ fontSize: 11, color: "#2e9e5b", alignSelf: "center" }}>✓ {purgeMsg}</span>}
        </div>

        <div className="admstu-row-sub" style={{ marginTop: 10, fontSize: 11, opacity: 0.55 }}>
          {T("บอทจะสร้างกิจกรรมใหม่อัตโนมัติทุกครั้งที่เปิดแดชบอร์ด (เว้นอย่างน้อย 5 นาที/รอบ) — แถวที่สร้างมีธง simulated=true แยกจากข้อมูลจริงเสมอ",
            "Bots regenerate whenever you open the dashboard (throttled to one tick / 5 min). Generated rows are always flagged simulated=true, cleanly separated from real data.",
            "每次打开仪表板时机器人会自动生成活动（每 5 分钟一次）。生成的数据始终标记为 simulated=true。")}
        </div>
      </div>
    </div>
  );
}
