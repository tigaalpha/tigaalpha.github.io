import { useCallback, useEffect, useState } from "react";
import { sb } from "./supabase-client";
import { GUEST_TRIAL_MS } from "./shared-infra";

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
// minutes to one decimal — the unit the owner actually thinks in when asking
// "how long did they play before leaving"
const fmtMin = (ms) => ((Number(ms) || 0) / 60000).toFixed(1);
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
      <span className="anrow-hits">{valueLabel(Number(valueFor(r)) || 0, r)}</span>
    </div>
  ));
}


/* ═══════════════ 3. ANONYMOUS VISITORS ═══════════════
   Who came to the site and never logged in, and what they did while they were
   here. This existed nowhere before: logUsage() returned early whenever there
   was no session, so the admin could see everything members did and nothing at
   all about the people the advertising actually paid for. Three days of ads
   bought 393 visits, produced 0 accounts, and left no record to look at.

   The browser column is here for a specific reason — see uaKind() in
   shared-infra.ts. Google refuses OAuth inside a social app's WebView, so a
   high "facebook-webview" share is not trivia: it is the number that explains
   a dead sign-up funnel. */
const UA_LABEL = {
  "facebook-webview": "📘 ในแอป Facebook",
  "instagram-webview": "📷 ในแอป Instagram",
  "messenger-webview": "💬 ในแอป Messenger",
  "line-webview": "💚 ในแอป LINE",
  "tiktok-webview": "🎵 ในแอป TikTok",
  "android-webview": "📱 ในแอปอื่น (Android)",
  "ios-webview": "📱 ในแอปอื่น (iOS)",
  "android-chrome": "✅ Chrome (Android)",
  "ios-chrome": "✅ Chrome (iOS)",
  "ios-safari": "✅ Safari",
  desktop: "🖥️ คอมพิวเตอร์",
};
const uaLabel = (u) => UA_LABEL[u] || String(u || "?");
const isWebview = (u) => String(u || "").includes("webview");
/* The gate has been seconds and minutes at different times, so print whichever
   unit reads naturally rather than "0.3 min". */
const fmtSecs = (ms) => {
  const s = Math.round((Number(ms) || 0) / 1000);
  if (s < 90) return s + "s";
  const m = s / 60;
  return (Number.isInteger(m) ? m : m.toFixed(1)) + " min";
};

/* Which door the people who DID get an account came through. Rendered on both
   admin pages: the activity page asks how many visitors never signed up, and
   this is the other half of the same question, so it reads as a pair on either.
   One component rather than two copies — the last thing this dashboard needs is
   a second place to update when the wording or the maths changes.

   The big number is all-time deliberately. Scoped to the selected range it
   would read "0 and 0" on a quiet week and look broken rather than
   informative; the in-range figure is the small line underneath, where a zero
   is honest instead of alarming. */
function SignupMethodCards({ signup, range, T }) {
  if (!signup) return null;
  const su = signup;
  const total = Number(su.total) || 0;
  const rangeLabel = range === "all"
    ? T("ทั้งหมด", "all time", "全部")
    : T(`${range} วันนี้`, `last ${range}d`, `近 ${range} 天`);
  return (
    <div className="sumeth">
      <div className="sumeth-c">
        <div className="sumeth-k">🔵 {T("ล็อกอินด้วย Google", "Signed in with Google", "用 Google 登录")}</div>
        <div className="sumeth-v">{su.google ?? 0}<span>{T("คน", "people", "人")}</span></div>
        <div className="sumeth-s">{T("ใหม่", "new", "新增")} {rangeLabel}: <b>{su.google_new ?? 0}</b></div>
      </div>
      <div className="sumeth-c">
        <div className="sumeth-k">✉️ {T("สมัครสมาชิกใหม่ (อีเมล)", "Signed up with email", "邮箱注册")}</div>
        <div className="sumeth-v">{su.email ?? 0}<span>{T("คน", "people", "人")}</span></div>
        <div className="sumeth-s">{T("ใหม่", "new", "新增")} {rangeLabel}: <b>{su.email_new ?? 0}</b></div>
      </div>
      {total > 0 && (
        <div className="sumeth-f">
          {T(`สมาชิกทั้งหมด ${total} คน`, `${total} members in total`, `共 ${total} 位会员`)}
          {" · "}{Math.round(((Number(su.google) || 0) / total) * 100)}% Google
          {" · "}{Math.round(((Number(su.email) || 0) / total) * 100)}% {T("อีเมล", "email", "邮箱")}
        </div>
      )}
    </div>
  );
}

export function AdminAnonVisitors({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [range, setRange] = useState("7");
  const [ov, setOv] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);
  const [trail, setTrail] = useState([]);
  const [signup, setSignup] = useState(null); // Google vs email sign-up split
  // Whether the "สมัครแล้ว" tile's breakdown is open. "converted" only ever
  // meant "this anon_id was later seen with a real user_id" — it said nothing
  // about which door they walked through. admin_anon_overview now reports that
  // too (signup_methods), and admin_anon_visitors names it per row (provider),
  // so the click just reveals what was already being fetched.
  const [showConvBreak, setShowConvBreak] = useState(false);

  const since = useCallback(() => {
    if (range === "all") return null;
    return new Date(Date.now() - Number(range) * 86400000).toISOString();
  }, [range]);

  const load = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const p_since = since();
      const [a, b, c] = await Promise.all([
        sb.rpc("admin_anon_overview", { p_since, p_gate_ms: GUEST_TRIAL_MS }),
        sb.rpc("admin_anon_visitors", { p_since, p_limit: 200 }),
        sb.rpc("admin_signup_methods", { p_since }),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      setOv(a.data || null);
      setRows(b.data || []);
      // Not fatal: this page is about visitors, and the sign-up split is extra
      // context. If the RPC is missing the cards just don't render.
      setSignup(c.error ? null : (c.data || null));
    } catch (e) {
      setErr((e && e.message) || "load failed");
    } finally { setBusy(false); }
  }, [since]);

  useEffect(() => { load(); }, [load]);

  async function openTrail(anon) {
    setSel(anon); setTrail([]);
    try {
      const { data, error } = await sb.rpc("admin_anon_visitor_detail", { p_anon: anon, p_limit: 200 });
      if (!error) setTrail(data || []);
    } catch (e) {}
  }

  const webviewShare = (() => {
    const b = (ov && ov.browsers) || [];
    const total = b.reduce((n, x) => n + (Number(x.n) || 0), 0);
    if (!total) return null;
    const rows = b.filter(x => isWebview(x.ua)).sort((x, y) => (Number(y.n) || 0) - (Number(x.n) || 0));
    const wv = rows.reduce((n, x) => n + (Number(x.n) || 0), 0);
    /* Name the apps actually in the data instead of a fixed guess. The text
       used to read "Facebook / YouTube / TikTok" whatever the numbers said,
       which was wrong the moment Instagram became the second largest source
       at a third of all traffic and went unmentioned. */
    const names = rows.slice(0, 4).map(x => `${uaLabel(x.ua)} ${x.n}`).join(" · ");
    return { pct: Math.round((wv / total) * 100), wv, total, names };
  })();

  return (
    <div className="admstu">
      <div className="admstu-head">
        <div>
          <div className="admstu-title">{T("ผู้เข้าชมที่ยังไม่ล็อกอิน", "Visitors who never logged in", "未登录访客")}</div>
          <div className="admstu-sub">{T("คนที่เข้าเว็บมาแล้วทำอะไรบ้าง ก่อนจะสมัครหรือหายไป",
            "What people did before they signed up — or left", "访客在注册或离开前做了什么")}</div>
        </div>
        <RangePicker range={range} setRange={setRange} T={T} />
      </div>

      {err && <div className="lockerr" style={{ margin: "8px 0" }}>{err}</div>}
      {busy && <div className="admstu-empty">{T("กำลังโหลด...", "Loading...", "加载中...")}</div>}

      {!busy && ov && (
        <>
          <div className="admmg-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 12 }}>
            {[
              { id: "visitors", k: T("ผู้เข้าชม", "Visitors", "访客"), v: ov.visitors },
              { id: "anon_only", k: T("ยังไม่ล็อกอิน", "Never logged in", "未登录"), v: ov.anon_only },
              { id: "avg", k: T("เล่นเฉลี่ยคนละ", "Average each", "人均"), v: fmtMin(ov.avg_ms) + T(" นาที", " min", " 分") },
              { id: "median", k: T("ค่ากลาง", "Median", "中位数"), v: fmtMin(ov.median_ms) + T(" นาที", " min", " 分") },
              { id: "max", k: T("นานที่สุด", "Longest", "最长"), v: fmtMin(ov.max_ms) + T(" นาที", " min", " 分") },
              { id: "total_time", k: T("เวลารวม", "Total time", "总时长"), v: fmtMin(ov.dwell_ms) + T(" นาที", " min", " 分") },
              { id: "converted", k: T("สมัครแล้ว", "Signed up", "已注册"), v: ov.converted },
            ].map(({ id, k, v }) => id === "converted" ? (
              // The one tile that opens something — tappable, and says so with a
              // caret, rather than looking identical to its six read-only siblings.
              <button key={id} type="button" className="admmg" disabled={!ov.converted}
                onClick={() => setShowConvBreak(o => !o)}
                style={{ padding: "10px 12px", textAlign: "left", cursor: ov.converted ? "pointer" : "default",
                  border: showConvBreak ? "1px solid #d97757" : "1px solid transparent", font: "inherit", color: "inherit" }}>
                <div className="admstu-row-sub" style={{ marginBottom: 2, display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span>{k}</span>
                  {!!ov.converted && <span style={{ fontSize: 10, opacity: .7 }}>{showConvBreak ? "▲" : "▼"}</span>}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#d97757" }}>{v}</div>
              </button>
            ) : (
              <div key={id} className="admmg" style={{ padding: "10px 12px" }}>
                <div className="admstu-row-sub" style={{ marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#d97757" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* "สมัครแล้ว" only ever counted a browser that was later seen
              signed in — it never said which door. The totals here come from
              ov.signup_methods (exact, independent of the 200-row cap below);
              the list underneath names WHICH of the converted anon_ids used
              which method, straight from admin_anon_visitors' new `provider`
              column, so it can only ever agree with the totals above it. */}
          {showConvBreak && !!ov.converted && (() => {
            const sm = ov.signup_methods || {};
            const g = Number(sm.google) || 0, e = Number(sm.email) || 0;
            const other = (Number(sm.other) || 0) + (Number(sm.unknown) || 0);
            const conv = rows.filter(r => r.converted);
            return (
              <div className="admmg" style={{ marginBottom: 12 }}>
                <div className="admmg-h">🔑 {T("สมัครแล้ว — ผ่านช่องทางไหน", "Signed up — which door", "已注册 — 通过哪种方式")} ({ov.converted})</div>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "2px 0 12px" }}>
                  <div><b style={{ fontSize: 19 }}>{g}</b> <span className="admstu-row-sub">🔵 Google</span></div>
                  <div><b style={{ fontSize: 19 }}>{e}</b> <span className="admstu-row-sub">✉️ {T("แอป TIGA (อีเมล)", "TIGA app (email)", "TIGA 应用（邮箱）")}</span></div>
                  {other > 0 && <div><b style={{ fontSize: 19 }}>{other}</b> <span className="admstu-row-sub">{T("อื่น ๆ / ไม่ทราบ", "other / unknown", "其他/未知")}</span></div>}
                </div>
                {conv.length ? conv.map(r => (
                  <div key={r.anon_id} className="anrow">
                    <span className="anrow-rank" style={{ width: 26 }}>{r.provider === "google" ? "🔵" : r.provider === "email" ? "✉️" : "❔"}</span>
                    <span className="anrow-name" style={{ maxWidth: "34%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.last_item || "—"}
                    </span>
                    <span className="admstu-row-sub" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {uaLabel(r.ua)} · {r.src || "direct"}
                    </span>
                    <span className="anrow-hits">{fmtTime(r.last_seen)}</span>
                  </div>
                )) : (
                  // Only reachable if MORE than the 200-row cap below converted in
                  // this range — the totals above stay exact either way, only
                  // this per-person list is capped.
                  <div className="admstu-empty">
                    {T("คนสมัครมีมากกว่าที่รายชื่อด้านล่างแสดงได้ — ตัวเลขด้านบนยังถูกต้อง",
                       "More people signed up than the list below can show — the totals above are still exact",
                       "本时段注册人数超过下方列表可显示上限 — 以上总数仍准确")}
                  </div>
                )}
              </div>
            );
          })()}

          {/* The same two cards as the activity page. This page answers "who never
              made an account"; these say which door the ones who did came
              through, and the pair only means something read together. */}
          <SignupMethodCards signup={signup} range={range} T={T} />

          {webviewShare && webviewShare.pct >= 20 && (
            <div className="anonwv">
              <b>⚠️ {webviewShare.pct}% {T("เข้ามาจากเบราว์เซอร์ในแอป", "arrived inside an in-app browser", "来自应用内浏览器")}</b>
              {webviewShare.names && <div className="anonwv-n">{webviewShare.names}</div>}
              {T("Google ไม่ยอมให้ล็อกอินในเบราว์เซอร์ที่ฝังมากับแอปพวกนี้ — คนกลุ่มนี้จะสมัครด้วย Google ไม่ได้เลย ตอนนี้แอปจะเสนอสมัครด้วยอีเมลให้แทนโดยอัตโนมัติ",
                "Google refuses to sign people in inside these apps' built-in browsers. These visitors cannot use Google at all — the app now offers them email sign-up instead.",
                "Google 拒绝在这些应用的内置浏览器中登录，这些访客无法使用 Google 注册 — 应用现已自动改为邮箱注册。")}
            </div>
          )}

          {/* How long they lasted, split at the sign-up gate. This is the number
              that says whether the gate is reachable at all — a gate nobody
              plays long enough to see cannot convert anyone. The boundaries
              come from gate_ms, which the server echoed back from the value
              this app is actually using, so the bars can never be graded
              against a threshold the app has moved on from. */}
          <div className="admmg" style={{ marginBottom: 12 }}>
            <div className="admmg-h">⏱️ {T("เล่นนานแค่ไหนก่อนจะออก", "How long they lasted", "停留时长分布")}</div>
            {(() => {
              const a = Number(ov.under30) || 0, b = Number(ov.mid) || 0, c = Number(ov.well_past) || 0;
              const tot = a + b + c;
              if (!tot) return <div className="admstu-empty">{T("ยังไม่มีข้อมูล", "No data yet", "暂无数据")}</div>;
              const gate = fmtSecs(Number(ov.gate_ms) || GUEST_TRIAL_MS);
              const far = fmtSecs((Number(ov.gate_ms) || GUEST_TRIAL_MS) * 3);
              const rows = [
                [T(`ไม่ถึง ${gate} — เข้ามาแล้วออกเลย`, `Under ${gate} — in and straight out`, `不到 ${gate}`), a, "#ff6b81"],
                [T(`${gate} – ${far} — เห็นหน้าชวนสมัครแล้ว`, `${gate} – ${far} — saw the sign-up gate`, `${gate} – ${far}`), b, "#ffb236"],
                [T(`${far} ขึ้นไป — อยู่ต่อหลังเห็นหน้าชวนสมัคร`, `${far}+ — stayed on past the gate`, `${far} 以上`), c, "#3ddc84"],
              ];
              return rows.map(([lb, n, col]) => (
                <div key={lb} className="anrow">
                  <span className="anrow-name" style={{ maxWidth: "52%", whiteSpace: "normal", lineHeight: 1.35 }}>{lb}</span>
                  <span className="anrow-barwrap">
                    <span className="anrow-bar" style={{ width: `${Math.max(3, (n / tot) * 100)}%`, background: col }} />
                  </span>
                  <span className="anrow-hits">{n} {T("คน", "", "人")} ({Math.round((n / tot) * 100)}%)</span>
                </div>
              ));
            })()}
          </div>

          <div className="admmg-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            <div className="admmg">
              <div className="admmg-h">🌐 {T("เข้ามาจากเบราว์เซอร์อะไร", "Which browser", "使用的浏览器")}</div>
              <RankRows rows={(ov.browsers || []).map(b => ({ item_id: uaLabel(b.ua), n: b.n }))}
                valueFor={(r) => r.n} T={T} valueLabel={(n) => n + T(" คน", "", " 人")} />
            </div>
            <div className="admmg">
              <div className="admmg-h">📍 {T("มาจากไหน", "Where from", "来源")}</div>
              <RankRows rows={(ov.sources || []).map(b => ({ item_id: b.src, n: b.n }))}
                valueFor={(r) => r.n} T={T} valueLabel={(n) => n + T(" คน", "", " 人")} />
            </div>
            <div className="admmg">
              <div className="admmg-h">🎯 {T("ใช้ฟีเจอร์อะไร และนานแค่ไหน", "Features and time spent", "功能与时长")}</div>
              <RankRows rows={(ov.features || []).map(b => ({ item_id: b.kind + " · " + b.item, n: b.people, ms: b.ms }))}
                valueFor={(r) => r.n} T={T}
                valueLabel={(n, r) => n + T(" คน", "p", "人") + (r && Number(r.ms) ? " · " + fmtMin(r.ms) + T(" น.", "m", "分") : "")} />
            </div>
            <div className="admmg">
              <div className="admmg-h">🚪 {T("ทำอะไรเป็นอย่างสุดท้ายก่อนออก", "Last thing before leaving", "离开前最后一步")}</div>
              <RankRows rows={(ov.exits || []).map(b => ({ item_id: b.kind + " · " + b.item, n: b.n }))}
                valueFor={(r) => r.n} T={T} valueLabel={(n) => n + T(" คน", "", " 人")} />
            </div>
          </div>

          <div className="admmg" style={{ marginTop: 12 }}>
            <div className="admmg-h">👤 {T("รายคน", "Visitor by visitor", "逐位访客")} ({rows.length})</div>
            {!rows.length && <div className="admstu-empty">{T("ยังไม่มีข้อมูล", "No data yet", "暂无数据")}</div>}
            {rows.map(r => (
              <div key={r.anon_id}>
                <button className="anrow" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  onClick={() => openTrail(r.anon_id === sel ? null : r.anon_id)}>
                  <span className="anrow-rank">{r.converted ? "✅" : isWebview(r.ua) ? "⚠️" : "👤"}</span>
                  <span className="anrow-name" style={{ maxWidth: "34%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.last_item || "—"}
                  </span>
                  <span className="admstu-row-sub" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {uaLabel(r.ua)} · {r.src || "direct"} · {r.events} {T("ครั้ง", "events", "次")} · {fmtMs(r.dwell_ms)}
                  </span>
                  <span className="anrow-hits">{fmtTime(r.last_seen)}</span>
                </button>
                {sel === r.anon_id && (
                  <div style={{ padding: "4px 0 10px 26px" }}>
                    {!trail.length && <div className="admstu-empty">{T("กำลังโหลด...", "Loading...", "加载中...")}</div>}
                    {trail.map((t, i) => (
                      <div key={i} className="admstu-row-sub" style={{ display: "flex", gap: 10, padding: "2px 0" }}>
                        <span style={{ opacity: .6, minWidth: 96 }}>{fmtTime(t.created_at)}</span>
                        <span style={{ flex: 1 }}>{t.signed_in ? "🔓 " : ""}{t.kind} · {label(t.item_id)}</span>
                        <span style={{ opacity: .6 }}>{t.duration_ms ? fmtMs(t.duration_ms) : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════ 1. ACTIVITY DASHBOARD ═══════════════ */
export function AdminActivity({ lang, onOpenAnon }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [range, setRange] = useState("7");
  const [anon, setAnon] = useState(null);   // headline count of signed-out visitors
  const [signup, setSignup] = useState(null); // Google vs email sign-up split
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [sel, setSel] = useState(null);      // selected user uuid
  const [detail, setDetail] = useState(null);
  const [showSim, setShowSim] = useState(true);
  const [hours, setHours] = useState(null);   // [{h:0..23, events, users, time_ms}] — null until admin_activity_hourly exists (RPC error → card stays hidden)
  const [hourSel, setHourSel] = useState(null); // tapped hour for the detail line

  // compute the ISO cutoff INSIDE each callback — computing it during render made
  // `since` a new string every render (Date.now() advances), giving `load` a new
  // identity every render, re-running the effect in an infinite spinner/data loop
  // (the "flickering screen" bug).
  const sinceFor = (r) => (r === "all" ? null : new Date(Date.now() - Number(r) * 86400000).toISOString());

  const load = useCallback(() => {
    const since = sinceFor(range);
    // NOTE: deliberately do NOT reset overview/users/detail to null here.
    // Nulling them shows the ⏳ spinner on every refetch — if anything ever
    // re-triggers `load` in a tight cycle that IS the flicker. Keeping the
    // previous data visible while refreshing can only ever look calm.
    sb.rpc("admin_activity_overview", { p_since: since, p_include_sim: showSim })
      .then(({ data }) => setOverview(data || {}), () => setOverview((o) => o || {}));
    sb.rpc("admin_activity_users", { p_since: since })
      .then(({ data }) => setUsers(data || []), () => setUsers((u) => u || []));
    // by-hour buckets ( Bangkok wall-clock, computed server-side — see
    // supabase-activity-hourly-migration.sql ). On failure (RPC not yet applied)
    // hours stays null and the histogram card is simply not rendered.
    sb.rpc("admin_activity_hourly", { p_since: since, p_include_sim: showSim })
      .then(({ data }) => setHours((data && data.hours) || []), () => setHours(null));
    // Signed-out visitors are the top line of this page now: they are most of
    // the traffic and none of them are in the member list below.
    sb.rpc("admin_anon_overview", { p_since: since, p_gate_ms: GUEST_TRIAL_MS })
      .then(({ data }) => setAnon(data || null), () => setAnon(null));
    // How the people who DID get an account actually got one. The email path
    // exists because Google will not work inside an in-app browser, so the
    // split between the two is the measure of whether that was worth building.
    sb.rpc("admin_signup_methods", { p_since: since })
      .then(({ data }) => setSignup(data || null), () => setSignup(null));
  }, [range, showSim]);

  useEffect(() => { load(); }, [load]);

  // refresh the feed every 30s while the tab is open (overview only, silently —
  // never touches users/detail and never clears anything to a spinner)
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === "hidden") return; // don't churn while backgrounded
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

  const anonWv = (() => {
    const b = (anon && anon.browsers) || [];
    const total = b.reduce((n, x) => n + (Number(x.n) || 0), 0);
    if (!total) return 0;
    return Math.round((b.filter(x => isWebview(x.ua)).reduce((n, x) => n + (Number(x.n) || 0), 0) / total) * 100);
  })();

  return (
    <div className="adminpay">
      {/* ── signed-out visitors, first thing on the page ──
          They are the majority of the traffic and appear nowhere in the member
          list below, so burying them was how "393 visits, 0 accounts" stayed
          invisible for three days. */}
      {anon && (
        <button className="anonhero" onClick={() => onOpenAnon && onOpenAnon()}>
          <div className="anonhero-l">
            <div className="anonhero-k">{T("ผู้เข้าชมที่ยังไม่ล็อกอิน", "Visitors not logged in", "未登录访客")}</div>
            <div className="anonhero-v">{anon.anon_only ?? 0}<span>{T("คน", "people", "人")}</span></div>
          </div>
          <div className="anonhero-l" style={{ borderLeft: "1px solid var(--bd2)", paddingLeft: 14 }}>
            <div className="anonhero-k">{T("เล่นเฉลี่ยคนละ", "Average time each", "人均时长")}</div>
            <div className="anonhero-v">{fmtMin(anon.avg_ms)}<span>{T("นาที", "min", "分")}</span></div>
          </div>
          <div className="anonhero-r">
            <div className="anonhero-s"><b>{fmtMin(anon.median_ms)}</b> {T("นาที — ค่ากลาง (ครึ่งหนึ่งเล่นน้อยกว่านี้)", "min median", "分 中位数")}</div>
            <div className="anonhero-s"><b>{anon.reached ?? 0}</b> {T(`คนเล่นถึง ${fmtSecs(Number(anon.gate_ms) || GUEST_TRIAL_MS)} (เห็นหน้าชวนสมัคร)`, `reached the ${fmtSecs(Number(anon.gate_ms) || GUEST_TRIAL_MS)} gate`, `达到 ${fmtSecs(Number(anon.gate_ms) || GUEST_TRIAL_MS)}`)}</div>
            <div className="anonhero-s"><b>{anon.converted ?? 0}</b> {T("สมัครแล้ว", "signed up", "已注册")}</div>
            {anonWv >= 20 && <div className="anonhero-w">⚠️ {anonWv}% {T("มาจากเบราว์เซอร์ในแอป", "in-app browser", "应用内浏览器")}</div>}
          </div>
          <span className="anonhero-go">{T("ดูรายละเอียด", "Details", "详情")} ›</span>
        </button>
      )}

      {/* ── how the people who DID sign up got in ──
          Second on the page, straight under the visitor count, because it is
          the other half of the same story: the one above is who never made an
          account, this is which door the ones who did came through. The email
          route was built for the ~70% arriving inside an in-app browser, where
          Google refuses to sign anyone in, so these two numbers are what say
          whether that route is carrying its weight. */}
      <SignupMethodCards signup={signup} range={range} T={T} />

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

          {/* when users come in — 24h histogram (hours null → RPC missing → skip card) */}
          {hours && hours.length > 0 && (() => {
            const evs = hours.map((h) => Number(h.events) || 0);
            const maxE = Math.max(...evs, 1);
            const peak = hours.reduce((a, b) => (((Number(b.events) || 0) > (Number(a.events) || 0)) ? b : a), hours[0]);
            const hh = (n) => String(n).padStart(2, "0");
            return (
              <div className="adminpay-cfg">
                <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 2 }}>🕒 {T("ช่วงเวลาที่ผู้ใช้เข้ามา (เวลาไทย)", "When users come in (Bangkok time)", "用户活跃时段（曼谷时间）")}</div>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
                  {T("แตะแท่งเพื่อดูรายละเอียด · ช่วงพีค: ", "Tap a bar for detail · Peak: ", "点击柱子查看详情 · 高峰: ")}
                  <b>{hh(peak.h)}:00</b> ({Number(peak.events) || 0} {T("ครั้ง", "events", "次")})
                </div>
                <div style={{ display: "flex", alignItems: "stretch", gap: 2, height: 90 }}>
                  {hours.map((h) => {
                    const ev = Number(h.events) || 0;
                    const pct = (ev / maxE) * 100;
                    return (
                      <div key={h.h}
                        title={`${hh(h.h)}:00 — ${ev} ${T("ครั้ง", "events", "次")} · ${h.users} ${T("คน", "users", "人")}`}
                        onClick={() => setHourSel(hourSel === h.h ? null : h.h)}
                        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", cursor: "pointer" }}>
                        {hourSel === h.h && <div style={{ fontSize: 9, textAlign: "center", fontWeight: 700, marginBottom: 2 }}>{ev}</div>}
                        <div style={{ height: `${Math.max(ev > 0 ? 6 : 2, pct)}%`, background: hourSel === h.h ? "#d97757" : "rgba(217,119,87,.7)", borderRadius: 3 }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                  {hours.map((h) => (
                    <div key={h.h} style={{ flex: 1, minWidth: 0, fontSize: 8, textAlign: "center", opacity: h.h % 6 === 0 ? 0.85 : 0.3 }}>{h.h}</div>
                  ))}
                </div>
                {hourSel !== null && (() => {
                  const h = hours.find((x) => x.h === hourSel);
                  return h ? (
                    <div style={{ fontSize: 11, marginTop: 6, background: "var(--tg-card, #f6f6f8)", borderRadius: 8, padding: "6px 10px" }}>
                      🕒 {hh(h.h)}:00–{hh(h.h)}:59 — <b>{Number(h.events) || 0}</b> {T("เหตุการณ์ · ", "events · ", "事件 · ")}
                      <b>{h.users}</b> {T("คน · ", "users · ", "人 · ")}{fmtMs(h.time_ms)}
                    </div>
                  ) : null;
                })()}
              </div>
            );
          })()}

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
