import { useCallback, useEffect, useState } from "react";
import { sb } from "./supabase-client";

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN LEARNING DATA — ระบบสะสมและเรียนรู้ข้อมูลผู้เรียน รุ่นที่ 1 (owner spec)

   Sits inside the existing Analysis/Activity dashboard (adminTab "activity")
   as its own sub-tab, next to กิจกรรมผู้ใช้ — the owner asked for learning
   intelligence to live with the analysis pages, not in a new nav group.

   Three views, all backed by the tier-2+ RPCs in
   supabase-learning-data-migration.sql:

   1. Overview   — admin_learning_overview(): today / 7d / 30d sessions,
                   minutes, success verdicts (§15 server-computed), top skills
                   with avg ability, top diagnosed problems, and strategy
                   effect (which teaching strategy actually moved accuracy).
   2. Learners   — admin_learning_learners(): everyone with learning activity,
                   sessions/minutes/success rate, tap → per-learner drill-down
                   (admin_learner_intelligence: skill states, evidence-backed
                   memories, recent diagnoses + interventions).
   3. Sessions   — admin_learning_session_detail(): full one-session
                   reconstruction — observations → diagnoses → interventions →
                   practice, the §17 "ย้อนกลับมาดู session นี้ได้ทั้งหมด" view.

   Conventions copied from AdminActivityDashboard: an RPC that isn't applied
   yet (PGRST202 schema-cache miss) hides its card rather than erroring — the
   page renders fine before the migration runs, just emptier.
   ═══════════════════════════════════════════════════════════════════════════ */

const fmtMin = (sec) => ((Number(sec) || 0) / 60).toFixed(1);
const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) + "%" : "—");

function Tile({ k, v, sub }) {
  return (
    <div style={{ background: "var(--tg-card, #fff)", borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, opacity: 0.6 }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
      {sub ? <div style={{ fontSize: 10.5, opacity: 0.55, marginTop: 1 }}>{sub}</div> : null}
    </div>
  );
}

function Card({ title, children, style }) {
  return (
    <div className="adminpay-cfg" style={style}>
      <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Empty({ T, missing }) {
  return (
    <div className="admstu-empty">
      {missing
        ? T("ยังไม่เปิดใช้ — ต้องรัน migration ก่อน", "Not active yet — run the migration first", "尚未启用 — 请先执行迁移")
        : T("ยังไม่มีข้อมูล", "No data yet", "暂无数据")}
    </div>
  );
}

function BarRows({ rows, nameKey, valueFor, T }) {
  const list = (rows || []).slice();
  const max = Math.max(1, ...list.map(valueFor));
  if (!list.length) return <div className="admstu-empty">{T("ยังไม่มีข้อมูล", "No data yet", "暂无数据")}</div>;
  return list.map((r, i) => {
    const v = valueFor(r) || 0;
    return (
      <div key={i} className="anrow">
        <span className="anrow-name" style={{ maxWidth: "58%" }}>{r[nameKey] || T("ไม่ระบุ", "unspecified", "未指定")}</span>
        <span className="anrow-barwrap">
          <span className="anrow-bar" style={{ width: Math.max(2, (v / max) * 100) + "%", background: "#d97757" }} />
        </span>
        <span className="anrow-hits">{v}</span>
      </div>
    );
  });
}

/* ── view 1: overview ──────────────────────────────────────────────────────── */
function OverviewView({ T }) {
  const [ov, setOv] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    sb.rpc("admin_learning_overview").then(
      ({ data, error }) => {
        if (!alive) return;
        if (error && (error.code === "PGRST202" || (error.message || "").includes("schema cache"))) setMissing(true);
        setOv(data || {});
      },
      () => { if (alive) setMissing(true); }
    );
    return () => { alive = false; };
  }, []);

  if (missing) return (
    <Card title={`🎓 ${T("ข้อมูลผู้เรียน", "Learning Data", "学习数据")}`}>
      {T("ระบบข้อมูลผู้เรียนยังไม่เปิดใช้ — ต้องรัน supabase-learning-data-migration.sql ใน Supabase ก่อน",
         "Learning data isn't active yet — apply supabase-learning-data-migration.sql first",
         "学习数据尚未启用 — 请先在 Supabase 执行 supabase-learning-data-migration.sql")}
    </Card>
  );
  if (!ov) return <div className="admstu-msg">⏳</div>;

  const today = ov.today || {}, d7 = ov.d7 || {}, d30 = ov.d30 || {};
  return (
    <>
      <div className="adminpay-cfg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <Tile k={T("คนเรียนวันนี้", "Learners today", "今日学员")} v={today.learners ?? 0} />
        <Tile k={T("ครั้งวันนี้", "Sessions today", "今日次数")} v={today.sessions ?? 0} />
        <Tile k={T("นาทีวันนี้", "Minutes today", "今日分钟")} v={fmtMin(today.minutes)} />
        <Tile k={T("สำเร็จวันนี้", "Successful today", "今日成功")} v={today.successful ?? 0} />
      </div>
      <div className="adminpay-cfg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <Tile k={T("7 วัน — ครั้ง", "7d sessions", "7天次数")} v={d7.sessions ?? 0} sub={T(`คน ${d7.active_learners ?? 0}`, `${d7.active_learners ?? 0} learners`, `${d7.active_learners ?? 0} 人`)} />
        <Tile k={T("7 วัน — นาที", "7d minutes", "7天分钟")} v={fmtMin(d7.minutes)} />
        <Tile k={T("7 วัน — สำเร็จ", "7d successful", "7天成功")} v={d7.successful ?? 0} sub={pct(d7.successful ?? 0, d7.sessions ?? 0)} />
        <Tile k={T("7 วัน — ดีขึ้น", "7d improved", "7天进步")} v={d7.improved ?? 0} />
      </div>
      <div className="adminpay-cfg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Tile k={T("30 วัน — ครั้ง", "30d sessions", "30天次数")} v={d30.sessions ?? 0} />
        <Tile k={T("30 วัน — คน", "30d learners", "30天人数")} v={d30.active_learners ?? 0} />
        <Tile k={T("กลับมา ≥2 ครั้ง", "Repeat (≥2 sessions)", "回头客（≥2次）")} v={d30.retained_7d ?? 0} />
      </div>

      <Card title={`🧠 ${T("ทักษะที่ติดตาม (ค่าความสามารถเฉลี่ย)", "Tracked skills (avg ability)", "追踪技能")}`}>
        <BarRows rows={ov.top_skills || []} nameKey="skill" valueFor={(r) => r.n} T={T} />
        {(ov.top_skills || []).length > 0 && (
          <div style={{ fontSize: 10.5, opacity: 0.55, marginTop: 4 }}>
            {(ov.top_skills || []).map((s) => `${s.skill}: ${Math.round((Number(s.avg_ability) || 0) * 100)}%`).join(" · ")}
          </div>
        )}
      </Card>

      <Card title={`⚠️ ${T("ปัญหาที่ AI วินิจฉัยบ่อย (30 วัน)", "Most-diagnosed problems (30d)", "常见诊断问题")}`}>
        <BarRows rows={ov.top_problems || []} nameKey="problem" valueFor={(r) => r.n} T={T} />
      </Card>

      <Card title={`📈 ${T("กลยุทธ์สอนไหนได้ผล (30 วัน)", "Which teaching strategy works (30d)", "教学策略效果")}`}>
        {(ov.strategy_effect || []).length === 0 ? <Empty T={T} /> : (ov.strategy_effect || []).map((s, i) => (
          <div key={i} className="anrow">
            <span className="anrow-name" style={{ maxWidth: "42%" }}>{s.strategy_id}</span>
            <span className="anrow-barwrap">
              <span className="anrow-bar" style={{
                width: Math.max(2, Math.min(100, 50 + (Number(s.avg_gain) || 0) * 5)) + "%",
                background: (Number(s.avg_gain) || 0) >= 0 ? "#16a34a" : "#e11d48",
              }} />
            </span>
            <span className="anrow-hits">
              {(Number(s.avg_gain) || 0) >= 0 ? "+" : ""}{(Number(s.avg_gain) || 0).toFixed(1)}
              <span className="admstu-row-sub"> · {s.n} {T("ครั้ง", "runs", "次")}</span>
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}

/* ── view 2: learners + per-learner drill-down ─────────────────────────────── */
function LearnersView({ T }) {
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [sel, setSel] = useState(null);
  const [intel, setIntel] = useState(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    sb.rpc("admin_learning_learners", { p_search: q || null, p_limit: 50 }).then(
      ({ data, error }) => {
        if (error && (error.code === "PGRST202" || (error.message || "").includes("schema cache"))) { setMissing(true); return; }
        setRows(data || []);
      },
      () => setMissing(true)
    );
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const openLearner = (u) => {
    setSel(u);
    setIntel(null);
    sb.rpc("admin_learner_intelligence", { p_learner: u.learner_id }).then(
      ({ data }) => setIntel(data || {}),
      () => setIntel({})
    );
  };

  if (missing) return <Empty T={T} missing />;
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("ค้นหาชื่อ/อีเมล…", "Search name/email…", "搜索姓名/邮箱…")}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--bd2, #ddd)", marginBottom: 10, fontSize: 13 }} />
      <Card title={`👥 ${T("ผู้เรียนที่มีข้อมูลการเรียน", "Learners with learning data", "有学习数据的学员")}`}>
        {rows === null ? <div className="admstu-msg">⏳</div> : !(rows || []).length ? <Empty T={T} /> : rows.map((u) => (
          <button key={u.learner_id} onClick={() => openLearner(u)} className="admstu-row"
            style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid var(--tg-line, #eee)", background: "none", textAlign: "left" }}>
            <span style={{ fontSize: 14 }}>👤</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name || u.email || u.learner_id.slice(0, 8)}</span>
              <span style={{ display: "block", fontSize: 10, opacity: 0.5 }}>{u.email || u.learner_id.slice(0, 8)}… · {T("ล่าสุด", "last", "最近")} {fmtTime(u.last_session)}</span>
            </span>
            <span style={{ fontSize: 11, opacity: 0.7, textAlign: "right" }}>
              {u.sessions} {T("ครั้ง", "sess", "次")}<br />
              {fmtMin(u.minutes)} {T("นาที", "min", "分")} · ✅ {u.successful} · 📈 {u.improved}
            </span>
          </button>
        ))}
      </Card>

      {sel && (
        <Card title={`👤 ${sel.full_name || sel.email || "—"} — ${T("ข้อมูลผู้เรียน", "learner intelligence", "学员画像")}`}>
          <button onClick={() => { setSel(null); setIntel(null); }} style={{ float: "right", background: "none", border: "none", fontSize: 16 }}>✕</button>
          {intel === null ? <div className="admstu-msg">⏳</div> : (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, margin: "6px 0 4px" }}>🧠 {T("สถานะทักษะ (โมเดลประเมิน)", "Skill states (model estimate)", "技能状态")}</div>
              {(intel.skills || []).length === 0 ? <Empty T={T} /> : (intel.skills || []).map((s) => (
                <div key={s.skill} className="anrow">
                  <span className="anrow-name" style={{ maxWidth: "40%" }}>{s.skill}</span>
                  <span className="anrow-barwrap">
                    <span className="anrow-bar" style={{ width: Math.max(2, (Number(s.ability) || 0) * 100) + "%", background: "#d97757" }} />
                  </span>
                  <span className="anrow-hits">{Math.round((Number(s.ability) || 0) * 100)}%<span className="admstu-row-sub"> · {s.evidence_count} {T("หลักฐาน", "evidence", "证据")}</span></span>
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 600, margin: "10px 0 4px" }}>💡 {T("สิ่งที่ระบบจำเกี่ยวกับผู้เรียน", "What the system remembers", "系统记忆")}</div>
              {(intel.memories || []).length === 0 ? <Empty T={T} /> : (intel.memories || []).slice(0, 12).map((m) => (
                <div key={m.id} style={{ fontSize: 11, opacity: 0.8, padding: "2px 0", borderBottom: "1px dashed var(--tg-line, #eee)" }}>
                  <b>{m.category}</b> · {m.content} <span style={{ opacity: 0.5 }}>({m.source}, {Math.round((Number(m.confidence) || 0) * 100)}%)</span>
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 600, margin: "10px 0 4px" }}>⚠️ {T("การวินิจฉัยล่าสุด", "Recent diagnoses", "最近诊断")}</div>
              {(intel.diagnoses_recent || []).length === 0 ? <Empty T={T} /> : (intel.diagnoses_recent || []).slice(0, 8).map((d) => (
                <div key={d.id} style={{ fontSize: 11, opacity: 0.8, padding: "2px 0", borderBottom: "1px dashed var(--tg-line, #eee)" }}>
                  {fmtTime(d.created_at)} · {d.problem} <span style={{ opacity: 0.5 }}>({Math.round((Number(d.confidence) || 0) * 100)}%, {d.engine || d.model || "?"})</span>
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 600, margin: "10px 0 4px" }}>🎓 {T("การสอนล่าสุด", "Recent interventions", "最近干预")}</div>
              {(intel.interventions_recent || []).length === 0 ? <Empty T={T} /> : (intel.interventions_recent || []).slice(0, 8).map((iv) => (
                <div key={iv.id} style={{ fontSize: 11, opacity: 0.8, padding: "2px 0", borderBottom: "1px dashed var(--tg-line, #eee)" }}>
                  {fmtTime(iv.created_at)} · <b>{iv.strategy_id}</b>{iv.message_shown ? ` · ${String(iv.message_shown).slice(0, 80)}` : ""}
                </div>
              ))}
            </>
          )}
        </Card>
      )}
    </>
  );
}

/* ── view 3: session drill-down ─────────────────────────────────────────────── */
function SessionsView({ T }) {
  const [learners, setLearners] = useState(null);
  const [missing, setMissing] = useState(false);
  const [learnerId, setLearnerId] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [sessId, setSessId] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    sb.rpc("admin_learning_learners", { p_limit: 50 }).then(
      ({ data, error }) => {
        if (error && (error.code === "PGRST202" || (error.message || "").includes("schema cache"))) { setMissing(true); return; }
        setLearners(data || []);
      },
      () => setMissing(true)
    );
  }, []);

  const loadSessions = useCallback((id) => {
    if (!id) { setSessions(null); return; }
    sb.rpc("admin_learner_intelligence", { p_learner: id }).then(
      ({ data }) => setSessions((data && data.sessions) || []),
      () => setSessions([])
    );
  }, []);

  const openSession = (id) => {
    setSessId(id);
    setDetail(null);
    sb.rpc("admin_learning_session_detail", { p_session: id }).then(
      ({ data }) => setDetail(data || {}),
      () => setDetail({})
    );
  };

  if (missing) return <Empty T={T} missing />;
  return (
    <>
      <Card title={`🗂️ ${T("เลือกผู้เรียน", "Pick a learner", "选择学员")}`}>
        {learners === null ? <div className="admstu-msg">⏳</div> : !(learners || []).length ? <Empty T={T} /> : (
          <select value={learnerId || ""} onChange={(e) => { setLearnerId(e.target.value || null); loadSessions(e.target.value || null); }}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--bd2, #ddd)", fontSize: 13 }}>
            <option value="">— {T("เลือก", "select", "选择")} —</option>
            {learners.map((u) => (
              <option key={u.learner_id} value={u.learner_id}>{u.full_name || u.email || u.learner_id.slice(0, 8)} ({u.sessions})</option>
            ))}
          </select>
        )}
      </Card>

      {learnerId && sessions === null ? <div className="admstu-msg">⏳</div> : null}
      {learnerId && sessions && (sessions.length === 0 ? <Card title="📚">{<Empty T={T} />}</Card> : (
        <Card title={`📚 ${T("ครั้งการเรียนล่าสุด (แตะเพื่อเปิด)", "Recent sessions (tap to open)", "最近学习记录")}`}>
          {sessions.slice(0, 15).map((s) => (
            <button key={s.id} onClick={() => openSession(s.id)} className="admstu-row"
              style={{ display: "flex", width: "100%", gap: 8, padding: "7px 4px", borderBottom: "1px solid var(--tg-line, #eee)", background: "none", textAlign: "left" }}>
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{fmtTime(s.started_at)} · {s.goal || "—"}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {s.status === "completed" ? "✅" : s.status === "abandoned" ? "⛔" : "⏳"} {fmtMin(s.duration_sec)} {T("นาที", "min", "分")}
                {s.successful ? " · 🏆" : ""}
              </span>
            </button>
          ))}
        </Card>
      ))}

      {sessId && (
        <Card title={`🔍 ${T("รายละเอียดครั้งการเรียน", "Session detail", "学习详情")}`}>
          <button onClick={() => { setSessId(null); setDetail(null); }} style={{ float: "right", background: "none", border: "none", fontSize: 16 }}>✕</button>
          {detail === null ? <div className="admstu-msg">⏳</div> : (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, margin: "6px 0 4px" }}>👁️ {T("สิ่งที่ระบบสังเกต (ข้อเท็จจริง)", "Observations (facts)", "观察（事实）")}</div>
              {(detail.observations || []).length === 0 ? <Empty T={T} /> : (detail.observations || []).slice(0, 20).map((o) => (
                <div key={o.id} style={{ fontSize: 11, opacity: 0.8, padding: "2px 0", borderBottom: "1px dashed var(--tg-line, #eee)" }}>
                  {fmtTime(o.observed_at)} · <b>{o.kind}</b> ({o.source}) · {JSON.stringify(o.value)}
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 600, margin: "10px 0 4px" }}>⚠️ {T("สิ่งที่ AI วินิจฉัย (การอนุมาน)", "Diagnoses (AI inference)", "诊断（推断）")}</div>
              {(detail.diagnoses || []).length === 0 ? <Empty T={T} /> : (detail.diagnoses || []).map((d) => (
                <div key={d.id} style={{ fontSize: 11, opacity: 0.8, padding: "2px 0", borderBottom: "1px dashed var(--tg-line, #eee)" }}>
                  {fmtTime(d.created_at)} · {d.problem} <span style={{ opacity: 0.5 }}>({Math.round((Number(d.confidence) || 0) * 100)}%)</span>
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 600, margin: "10px 0 4px" }}>🎓 {T("สิ่งที่ AI สอน", "Interventions", "干预")}</div>
              {(detail.interventions || []).length === 0 ? <Empty T={T} /> : (detail.interventions || []).map((iv) => (
                <div key={iv.id} style={{ fontSize: 11, opacity: 0.8, padding: "2px 0", borderBottom: "1px dashed var(--tg-line, #eee)" }}>
                  {fmtTime(iv.created_at)} · <b>{iv.strategy_id}</b> · {String(iv.message_shown || "").slice(0, 90)}
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 600, margin: "10px 0 4px" }}>🎹 {T("การฝึกของผู้เรียน", "Practice events", "练习记录")}</div>
              {(detail.practice || []).length === 0 ? <Empty T={T} /> : (detail.practice || []).map((p) => (
                <div key={p.id} style={{ fontSize: 11, opacity: 0.8, padding: "2px 0", borderBottom: "1px dashed var(--tg-line, #eee)" }}>
                  {fmtTime(p.created_at)} · {p.what || "—"} · {fmtMin(p.duration_sec)} {T("นาที", "min", "分")}
                  {p.score_before != null && p.score_after != null ? ` · ${Math.round(Number(p.score_before))}% → ${Math.round(Number(p.score_after))}%` : ""}
                </div>
              ))}
            </>
          )}
        </Card>
      )}
    </>
  );
}

/* ── the exported panel: three sub-tabs ─────────────────────────────────────── */
export function AdminLearningData({ lang }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [tab, setTab] = useState("overview");
  return (
    <div className="adminpay" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="billtoggle">
        {[["overview", T("ภาพรวม", "Overview", "总览")], ["learners", T("ผู้เรียน", "Learners", "学员")], ["sessions", T("ครั้งการเรียน", "Sessions", "学习记录")]].map(([v, l]) => (
          <button key={v} className={`billtog${tab === v ? " on" : ""}`} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>
      {tab === "overview" ? <OverviewView T={T} /> : tab === "learners" ? <LearnersView T={T} /> : <SessionsView T={T} />}
    </div>
  );
}
