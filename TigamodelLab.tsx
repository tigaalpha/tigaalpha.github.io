import { useState, useEffect, useRef, useMemo } from "react";
import { ensureTigamodelWeb, getTigamodel, evaluateAllProviders, createTeachingPolicy, createTeachingLoop, getUniversitySources, appendChatSession, saveEvalRun, loadEvalRuns, getSelfLearner, isSelfLearningEnabled, setSelfLearningEnabled, getSkillGraph, getCoach, plm1mStats, plm1mRank, plm1mSample, PLM1M_DIMENSIONS, runExtendedEvalWithRegression, loadEvalExtendedBaseline, getKnowledgeBaseForTest, getStudentContextBlock, getKBContext, capabilitySummary, capabilityWorklist, generateStudentExercise, kbHotPath, isKbHotPathSwitchOn, setKbHotPathSwitch, runModelAccuracyAudit, accuracyAuditHistory, saveAccuracyAuditRun, clearAccuracyAuditHistory } from "./tigamodel/web.js";
import { ROADMAP_GROUPS, ROADMAP_STATUS, roadmapProgress } from "./tigamodel/roadmap-100.js";
import { getUnifiedPlan, getCapabilityEngine } from "./tigamodel/web.js";
import { KnowledgeGraphView } from "./tigamodel-lab-graph.tsx";
import { tigaHub } from "./tigamodel/web.js"; // Phase 5: live specialist/capability view from the Capability Hub
import { sb } from "./supabase-client";
import { AI_PROVIDERS } from "./AdminAIModels";
import { pickTeachCard, cardSourceInfo, TEACH_CARDS } from "./tigamodel/knowledge/teach-cards.js";
import TeachVisual from "./TeachVisual";

/* ── TigamodelLab.tsx ──
   Admin-only "TIGA Model Lab" (tab: tigamodel, tier >= 3): the owner's
   hands-on surface for the tigamodel/ intelligence layer.

   Three panels:
   1. ทดสอบแชท — send a message through the REAL routing path (router →
      existing-backend adapter → piano-chat edge function → whatever model
      the admin configured for that feature). Provider/model/latency shown
      per reply. Falls back to mock when signed-out session is missing, and
      the panel labels which provider actually answered (never lies).
   2. ประเมินโมเดล (eval) — runs evaluation/eval-suite.js against every
      registered provider and renders the score table.
   3. จำลองวงจรสอน — teaching-loop simulator: feed practice stats → see the
      state estimates (probability+evidence), diagnosis, selected strategy
      and the composed message. Rule-based, instant, no model call.
   Plus a 📚 ความรู้ tab listing the university-sourced knowledge base with
   its real source links.

   THEME (fixed after owner report — iPad light theme made white-on-light
   text invisible): every colour reads the app's own CSS variables
   (--text/--text2/--muted/--card/--card2/--bd1..) so the lab is correct in
   BOTH light and dark themes, exactly like every other admin page.

   HISTORY + MODEL STATUS (owner request 2026-09-17): every chat test is
   saved to the local session store (viewable in the TIGA Back Office),
   eval runs are saved on completion, and the chat panel shows the model
   the system currently stands on for the selected task type (read from
   app_settings.ai_models — the same resolution piano-chat does). ── */

export function TigamodelLab({ lang = "th" }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);

  /* theme-aware style tokens, resolved once per render */
  const S = {
    card: { background: "var(--card)", border: "1px solid var(--bd2)", borderRadius: 14, padding: 16, marginBottom: 14 },
    inner: { background: "var(--card2)", border: "1px solid var(--bd1)", borderRadius: 12, padding: 12 },
    btn: { padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent, #d97757)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
    btnGhost: { padding: "9px 16px", borderRadius: 10, border: "1px solid var(--bd3)", background: "transparent", color: "var(--text)", fontWeight: 600, fontSize: 14, cursor: "pointer" },
    input: { flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--bd3)", background: "var(--card2)", color: "var(--text)", fontSize: 14 },
    chip: (on) => ({
      padding: "6px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer",
      border: "1px solid " + (on ? "var(--accent, #d97757)" : "var(--bd3)"),
      background: on ? "color-mix(in srgb, var(--accent, #d97757) 14%, var(--card))" : "var(--card)",
      color: "var(--text)", fontWeight: on ? 700 : 500,
    }),
    mono: { fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 12.5, color: "var(--text2)" },
    good: "var(--ok, #3f9d63)",
    warn: "var(--warn, #b8860b)",
    bad: "var(--bad, #c4423a)",
  };

  const [tab, setTab] = useState("chat");
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState("");

  // self-learning tab (owner's master switch lives here)
  const [slOn, setSlOn] = useState(null);       // null = loading
  const [slSnap, setSlSnap] = useState(null);   // { enabled, stats, entries }
  const [slBusy, setSlBusy] = useState(false);
  const [slMsg, setSlMsg] = useState("");

  // chat panel
  const [prompt, setPrompt] = useState("");
  const [taskType, setTaskType] = useState("chat");
  const [chatRows, setChatRows] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);

  // eval panel
  const [evalBusy, setEvalBusy] = useState(false);
  const [evalResults, setEvalResults] = useState(null);
  const [evalErr, setEvalErr] = useState("");
  const [evalVerdict, setEvalVerdict] = useState(null);

  // 🎯 accuracy audit tab (docs/16 §2, m50): five measured layers from the
  // real modules + a bounded per-browser history the admin can re-run against
  const [accAudit, setAccAudit] = useState(null);
  const [accHistory, setAccHistory] = useState([]);
  const [accBusy, setAccBusy] = useState(false);
  const [accErr, setAccErr] = useState("");

  // "which model are we on right now" — read from the same app_settings row
  // piano-chat resolves from, so the label cannot drift from reality.
  // Owner request 2026-09-17: it is ALSO editable right here — the pill opens
  // a picker (provider shelf + free-text model id) and saves via the same
  // admin_set_app_setting RPC the Back Office and AI-Models panels use, so
  // every writer converges on one config and one truth.
  const [activeModels, setActiveModels] = useState(null); // { default: {provider,model}, [taskType]: {...} }
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDraft, setPickerDraft] = useState(null);   // {provider, model}
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerSaved, setPickerSaved] = useState(false);
  const [pickerErr, setPickerErr] = useState("");

  function resolvedModelFor(tt) {
    if (!activeModels) return null;
    if (tt === "chat" && !activeModels.chat && !activeModels.default) {
      return { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free", builtin: true };
    }
    const v = activeModels[tt] || activeModels.default;
    return v && v.provider && v.model ? { ...v, builtin: false } : null;
  }

  function openPicker() {
    const cur = resolvedModelFor(taskType) || { provider: "openrouter", model: "" };
    setPickerDraft({ provider: cur.provider, model: cur.model || "" });
    setPickerSaved(false); setPickerErr("");
    setPickerOpen(true);
  }

  async function savePicker() {
    if (!pickerDraft || !pickerDraft.model.trim() || pickerBusy) return;
    setPickerBusy(true); setPickerErr("");
    // re-read latest server value first — never clobber a change made from
    // another panel since this page loaded
    let base = {};
    try {
      const r = await sb.from("app_settings").select("value").eq("key", "ai_models").maybeSingle();
      const v = r && r.data && r.data.value;
      if (v && typeof v === "object") base = v;
    } catch (e) { /* server value unreadable → start from what we loaded */ base = activeModels || {}; }
    const next = { ...base, [taskType]: { provider: pickerDraft.provider, model: pickerDraft.model.trim() } };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "ai_models", p_value: next });
    setPickerBusy(false);
    if (error) { setPickerErr(error.message || "error"); return; }
    setActiveModels(next);
    setPickerSaved(true);
    setTimeout(() => setPickerSaved(false), 2500);
    setTimeout(() => setPickerOpen(false), 900);
  }

  // loop panel
  const policyRef = useRef(null);
  const loopRef = useRef(null);
  const [acc, setAcc] = useState(45);
  const [repeats, setRepeats] = useState(3);
  const [pauses, setPauses] = useState(4);
  const [selfReport, setSelfReport] = useState("");
  const [loopOut, setLoopOut] = useState(null);
  const [loopErr, setLoopErr] = useState("");

  useEffect(() => {
    let alive = true;
    ensureTigamodelWeb().then(t => {
      if (!alive || !t) return;
      policyRef.current = createTeachingPolicy();
      loopRef.current = createTeachingLoop({ policy: policyRef.current });
      setVersion(t.version);
      setReady(true);
    });
    // load the saved model config (also the edit target for the inline picker)
    sb.from("app_settings").select("value").eq("key", "ai_models").maybeSingle()
      .then(r => {
        if (!alive) return;
        const v = r && r.data && r.data.value;
        setActiveModels(v && typeof v === "object" ? v : {});
      }, () => { if (alive) setActiveModels({}); });
    // self-learning state (switch position + learned entries)
    (async () => {
      try {
        const learner = getSelfLearner();
        const on = await isSelfLearningEnabled();
        if (!alive) return;
        setSlOn(on);
        setSlSnap(await learner.snapshot());
      } catch (e) { if (alive) setSlOn(false); }
    })();
    return () => { alive = false; };
  }, []);

  async function toggleSelfLearn() {
    if (slBusy) return;
    setSlBusy(true);
    try {
      const next = await setSelfLearningEnabled(!slOn);
      setSlOn(next);
      setSlSnap(await getSelfLearner().snapshot());
      setSlMsg(next
        ? T("🟢 เปิดแล้ว — โมเดลจะเรียนรู้จากการสอนของคุณใน Admin Chat และจากผลการซ้อมของนักเรียน", "🟢 ON — the model now learns from your admin-chat teaching and from learner practice outcomes", "🟢 已开启 — 模型将从管理员教学和练习结果中学习")
        : T("🔴 ปิดแล้ว — โมเดลหยุดเรียนรู้และหยุดใช้ความรู้ที่เรียนมาทันที", "🔴 OFF — the model stops learning and stops injecting learned knowledge immediately", "🔴 已关闭 — 模型立即停止学习并停止使用已学知识"));
    } catch (e) { setSlMsg("⚠️ " + (e?.message || "error")); }
    setSlBusy(false);
    setTimeout(() => setSlMsg(""), 6000);
  }
  async function slRefresh() {
    setSlSnap(await getSelfLearner().snapshot());
  }
  async function slRemove(id) {
    await getSelfLearner().removeEntry(id);
    await slRefresh();
  }
  async function slClear() {
    if (!confirm(T("ลบความรู้ที่โมเดลเรียนมาทั้งหมด?", "Delete ALL learned knowledge?", "删除所有已学知识？"))) return;
    await getSelfLearner().clearLearned();
    await slRefresh();
  }

  async function sendPrompt() {
    const t = prompt.trim();
    if (!t || chatBusy) return;
    setChatBusy(true);
    const tiga = getTigamodel();
    const prevRows = chatRows;
    try {
      const t0 = performance.now();
      const { response, routed } = await tiga.chat({ message: t, taskType });
      const latency = Math.round(performance.now() - t0);
      const row = {
        q: t, a: response.text || T("(ไม่มีข้อความตอบกลับ)", "(empty reply)", "(无回复)"),
        provider: routed.selected_provider || "—",
        model: response.model || "",
        latency, status: response.status,
        attempts: routed.attempts,
      };
      setChatRows(rows => [...rows.slice(-9), row]);
      // persist the running session (visible in the TIGA Back Office)
      const msgs = [
        ...prevRows.flatMap(r => ([{ role: "user", text: r.q }, { role: "assistant", text: r.a, provider: r.provider, model: r.model, latency: r.latency, status: r.status }])),
        { role: "user", text: row.q },
        { role: "assistant", text: row.a, provider: row.provider, model: row.model, latency: row.latency, status: row.status },
      ];
      appendChatSession({
        id: `lab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ts: new Date().toISOString(), task_type: taskType,
        providers_used: routed.attempts ? routed.attempts.filter(a => a.status === "ok").map(a => ({ provider: a.provider })) : [],
        messages: msgs.slice(-40),
      });
    } catch (e) {
      setChatRows(rows => [...rows.slice(-9), { q: t, a: "⚠️ " + (e?.message || "error"), provider: "—", latency: 0, status: "error", attempts: [] }]);
    }
    setChatBusy(false);
    setPrompt("");
  }

  async function runEval() {
    if (evalBusy) return;
    setEvalBusy(true); setEvalErr("");
    try {
      // EXTENDED run (roadmap #81-#86): 124 cases + regression alarm against
      // the stored baseline; falls back to the quick eval when anything's off.
      const ext = await runExtendedEvalWithRegression();
      if (ext && ext.results) {
        setEvalResults(ext.results);
        setEvalVerdict(ext.verdict || null);
        saveEvalRun({ results: ext.results, extended: true, verdict: ext.verdict });
      } else {
        const tiga = getTigamodel();
        const results = await evaluateAllProviders(tiga.providers.list());
        setEvalResults(results);
        setEvalVerdict(null);
        saveEvalRun({ results });
      }
    } catch (e) {
      setEvalErr(String(e?.message || e));
    }
    setEvalBusy(false);
  }

  async function runAccuracyAudit() {
    if (accBusy) return;
    setAccBusy(true); setAccErr("");
    try {
      const audit = await runModelAccuracyAudit();
      const stamped = { ...audit, ranAt: new Date().toISOString() };
      setAccAudit(stamped);
      setAccHistory(saveAccuracyAuditRun(stamped));
    } catch (e) { setAccErr(String(e?.message || e)); }
    setAccBusy(false);
  }

  async function runLoop() {
    if (!loopRef.current) return;
    setLoopErr("");
    try {
      // runOnce is async — the awaited result (states/diagnosis/decision) is
      // what renders; a bare Promise would make this tab show nothing.
      const out = await loopRef.current.runOnce({
        practiceStats: { accuracy: acc, repeatedErrors: repeats, pauses, rhythmScore: Math.max(20, 100 - repeats * 12) },
        selfReport: selfReport || null,
      });
      setLoopOut(out);
    } catch (e) {
      // never let the button die silently — show what went wrong
      setLoopErr(String(e?.message || e));
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "10px 4px 40px", color: "var(--text)" }}>
      <div style={{ textAlign: "center", margin: "8px 0 18px" }}>
        <div style={{ fontSize: 34 }}>🧪</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "var(--text)" }}>TIGA Model Lab</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
          {T("ชั้นปัญญาการสอนเปียโน — ทดสอบโมเดล ประเมินคุณภาพ จำลองวงจรสอน", "Piano teaching intelligence — test models, run evals, simulate the teaching loop", "钢琴教学智能 — 测试模型、评估、模拟教学循环")}
          {ready && <span style={S.mono}> · v{version}</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button style={S.chip(tab === "chat")} onClick={() => setTab("chat")}>💬 {T("ทดสอบแชท", "Chat test", "聊天测试")}</button>
        <button style={S.chip(tab === "eval")} onClick={() => setTab("eval")}>📊 {T("ประเมินโมเดล", "Eval", "评估")}</button>
        <button style={S.chip(tab === "measure")} onClick={() => setTab("measure")}>📈 {T("สรุปวัดผลโมเดล", "Measure summary", "测量汇总")}</button>
        <button style={S.chip(tab === "accuracy")} onClick={() => { setTab("accuracy"); if (!accAudit && !accBusy) { setAccHistory(accuracyAuditHistory()); runAccuracyAudit(); } }}>🎯 {T("Audit 5 ชั้น", "5-layer audit", "五层审计")}</button>
        <button style={S.chip(tab === "loop")} onClick={() => setTab("loop")}>🔁 {T("จำลองวงจรสอน", "Teaching loop", "教学循环")}</button>
        <button style={S.chip(tab === "kb")} onClick={() => setTab("kb")}>📚 {T("ความรู้", "Knowledge", "知识")}</button>
        <button style={S.chip(tab === "map")} onClick={() => setTab("map")}>🕸 {T("แผนที่ความรู้", "Knowledge map", "知识图谱")}</button>
        <button style={S.chip(tab === "coach")} onClick={() => setTab("coach")}>🎯 {T("โค้ชอัจฉริยะ", "Coach", "智能教练")}</button>
        <button style={S.chip(tab === "selflearn")} onClick={() => setTab("selflearn")}>🧬 {T("เรียนรู้เอง", "Self-learning", "自我学习")}</button>
        <button style={S.chip(tab === "roadmap")} onClick={() => setTab("roadmap")}>🗺 {T("แผน 100 สิ่ง", "100-item plan", "百项计划")}</button>
        <button style={S.chip(tab === "plan1m")} onClick={() => setTab("plan1m")}>🧭 {T("แผน 1,000,000", "1M plan", "百万计划")}</button>
        <button style={S.chip(tab === "student")} onClick={() => setTab("student")}>👤 {T("นักเรียนของครู", "Student view", "学生视角")}</button>
        <button style={S.chip(tab === "cap")} onClick={() => setTab("cap")}>⚡ {T("ความพร้อมโมเดล", "Readiness", "模型能力")}</button>
        <button style={S.chip(tab === "specialist")} onClick={() => setTab("specialist")}>🎛 {T("โมเดลเชี่ยวชาญ", "Specialists", "专长模型")}</button>
        <button style={S.chip(tab === "atip")} onClick={() => setTab("atip")}>🎓 {T("Auto-Teach 2.0", "Auto-Teach 2.0", "Auto-Teach 2.0")}</button>
        <button style={S.chip(tab === "evidence")} onClick={() => setTab("evidence")}>🔍 {T("หลักฐานจริง", "Evidence", "真实证据")}</button>
      </div>

      {!ready && <div style={S.card}>{T("กำลังเริ่มระบบ…", "Starting…", "启动中…")}</div>}

      {ready && tab === "kb" && (<>
        <KbHotPathPanel lang={lang} S={S} T={T} />
        <KnowledgePanel lang={lang} S={S} />
      </>)}

      {ready && tab === "atip" && <AtipPreview lang={lang} S={S} />}
      {ready && tab === "evidence" && <EvidencePanel lang={lang} S={S} T={T} />}

      {ready && tab === "map" && <KnowledgeGraphView lang={lang} S={S} />}

      {ready && tab === "specialist" && <SpecialistPanel lang={lang} S={S} T={T} />}

      {ready && tab === "selflearn" && slOn !== null && (
        <SelfLearningPanel lang={lang} S={S} T={T} on={slOn} snap={slSnap} busy={slBusy}
          msg={slMsg} onToggle={toggleSelfLearn} onRemove={slRemove} onClear={slClear} />
      )}

      {ready && tab === "roadmap" && <RoadmapPanel lang={lang} S={S} T={T} />}
      {ready && tab === "plan1m" && <OneMPlanPanel lang={lang} S={S} T={T} />}

      {ready && tab === "student" && <StudentViewPanel lang={lang} S={S} T={T} />}

      {ready && tab === "cap" && <CapabilityPanel lang={lang} S={S} T={T} />}

      {ready && tab === "coach" && <CoachPanel lang={lang} S={S} T={T} />}

      {ready && tab === "chat" && (
        <div style={S.card}>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
            {T("ข้อความเดินทางจริงผ่าน: router → piano-chat → โมเดลที่ตั้งไว้", "Real path: router → piano-chat → configured model", "真实路径：路由 → piano-chat → 已配置模型")}
          </div>
          {activeModels && (() => {
            const cur = resolvedModelFor(taskType);
            return (
              <div style={{ ...S.inner, marginBottom: 10 }}>
                <button onClick={openPicker} disabled={!cur}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                  title={T("แตะเพื่อเปลี่ยนโมเดลของ task นี้", "Tap to switch this task's model", "点击切换此任务的模型")}>
                  <span style={{ fontSize: 12.5, color: "var(--text2)" }}>{T("ยืนอยู่บนโมเดล (แตะเพื่อเปลี่ยน)", "Currently on (tap to switch)", "当前模型（点击切换）")}:</span>
                  <b style={{ fontSize: 13.5, color: "var(--accent, #d97757)" }}>
                    {cur ? `${cur.provider === "openrouter" ? "🌐" : cur.provider === "gemini" ? "🔵" : cur.provider === "deepseek" ? "🟣" : cur.provider === "anthropic" ? "🟠" : "🎙️"} ${cur.model}${cur.builtin ? T(" · ค่า built-in", " · built-in", " · 内置") : ""}` : T("กำลังโหลด…", "loading…", "加载中…")}
                  </b>
                </button>
              </div>
            );
          })()}
          {pickerOpen && pickerDraft && (
            <div style={{ ...S.inner, marginBottom: 10, borderColor: "color-mix(in srgb, var(--accent, #d97757) 35%, var(--bd1))" }}>
              <div style={{ fontSize: 12.5, color: "var(--text2)", marginBottom: 6 }}>
                {T("เปลี่ยนโมเดลสำหรับ", "Switch model for", "切换模型：")} <b style={{ color: "var(--text)" }}>{taskType}</b> — {T("มีผลทันทีกับ request ถัดไป", "applies to the very next request", "下一个请求立即生效")}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {Object.entries(AI_PROVIDERS).map(([pid, P]) => (
                  <button key={pid} style={S.chip(pickerDraft.provider === pid)}
                    onClick={() => setPickerDraft(d => ({ provider: pid, model: (P.models[0] || {}).id || "" }))}>
                    {P.icon} {P.label}
                  </button>
                ))}
              </div>
              <select style={S.input} value={(AI_PROVIDERS[pickerDraft.provider]?.models || []).some(m => m.id === pickerDraft.model) ? pickerDraft.model : ""}
                onChange={e => e.target.value && setPickerDraft(d => ({ ...d, model: e.target.value }))}>
                <option value="">{T("— เลือกจากชั้นวาง —", "— pick from the shelf —", "— 从列表选择 —")}</option>
                {(AI_PROVIDERS[pickerDraft.provider]?.models || []).map(m => <option key={m.id} value={m.id}>{m.label} ({m.id})</option>)}
              </select>
              <input style={{ ...S.input, marginTop: 6 }} placeholder={T("หรือพิมพ์ model id เอง (เช่น โมเดลใหม่ที่ยังไม่อยู่ในชั้นวาง)", "or type any model id (e.g. a brand-new release)", "或输入任意模型 id")}
                value={pickerDraft.model} onChange={e => setPickerDraft(d => ({ ...d, model: e.target.value }))} />
              {pickerErr && <div style={{ color: S.bad, fontSize: 12.5, marginTop: 6 }}>⚠️ {pickerErr}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <button style={S.btn} onClick={savePicker} disabled={pickerBusy || !pickerDraft.model.trim()}>
                  {pickerBusy ? "…" : T("💾 บันทึก", "💾 Save", "💾 保存")}
                </button>
                <button style={S.btnGhost} onClick={() => setPickerOpen(false)}>{T("ยกเลิก", "Cancel", "取消")}</button>
                {pickerSaved && <span style={{ color: S.good, fontSize: 13, fontWeight: 700 }}>✓ {T("บันทึกแล้ว — ทดสอบได้เลย", "saved — test away", "已保存 — 可以测试")}</span>}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {["chat", "coach-tip", "practice-plan", "diagnose"].map(t => (
              <button key={t} style={S.chip(taskType === t)} onClick={() => setTaskType(t)}>{t}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={S.input} value={prompt} placeholder={T("พิมพ์ข้อความทดสอบ…", "Type a test message…", "输入测试消息…")}
              onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && sendPrompt()} />
            <button style={S.btn} onClick={sendPrompt} disabled={chatBusy}>{chatBusy ? "…" : "➤"}</button>
          </div>
          {chatRows.map((r, i) => (
            <div key={i} style={{ ...S.inner, marginTop: 12 }}>
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 6 }}>🧑 {r.q}</div>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap", color: "var(--text)" }}>🤖 {r.a}</div>
              <div style={{ ...S.mono, marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>provider: <b style={{ color: r.provider === "existing-backend" ? S.good : S.warn }}>{r.provider}</b></span>
                {r.model && <span>model: {r.model}</span>}
                <span>{r.latency}ms</span>
                <span>status: {r.status}</span>
              </div>
            </div>
          ))}
          {chatRows.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 18 }}>{T("ยังไม่มีข้อความ", "No messages yet", "暂无消息")}</div>}
        </div>
      )}

      {ready && tab === "measure" && <MeasurePanel lang={lang} S={S} T={T} />}

      {ready && tab === "eval" && (
        <div style={S.card}>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
            {T("รันชุดประเมินกับทุก provider ที่ลงทะเบียน — ห้ามเชื่อโมเดลใหม่ก่อนดูคะแนนที่นี่", "Runs the eval suite against every registered provider — never trust a new model before this table", "对每个已注册提供方运行评估 — 换模型前先看这张表")}
          </div>
          <button style={S.btn} onClick={runEval} disabled={evalBusy}>{evalBusy ? T("กำลังประเมิน 124 เคส…", "Running 124 cases…", "评估 124 案例中…") : T("▶ รันประเมินเต็ม 124 เคส", "Run full 124-case eval", "运行完整评估")}</button>
          {evalErr && <div style={{ color: S.bad, marginTop: 10, fontSize: 13 }}>{evalErr}</div>}
          {evalVerdict && (
            <div style={{ ...S.inner, marginTop: 10, borderLeft: "3px solid " + (evalVerdict.verdict === "block" ? S.bad : evalVerdict.verdict === "warn" ? S.warn : S.good) }}>
              <b style={{ fontSize: 13.5, color: "var(--text)" }}>
                {evalVerdict.verdict === "block" ? "🚨 " : evalVerdict.verdict === "warn" ? "⚠️ " : evalVerdict.verdict === "pass" ? "✅ " : "📌 "}
                {T("การตัดสินถดถอย", "Regression verdict", "回归判定")}: {evalVerdict.verdict}
              </b>
              <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 4 }}>{lang === "en" ? evalVerdict.message.en : evalVerdict.message.th}</div>
              {evalVerdict.regressions && evalVerdict.regressions.length > 0 && (
                <div style={{ ...S.mono, marginTop: 5 }}>
                  {evalVerdict.regressions.map(r => (
                    <div key={r.family} style={{ color: r.family && evalVerdict.blocking.some(b => b.family === r.family) ? S.bad : S.warn }}>
                      {r.family}: {r.from} → {r.to} (−{r.drop})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {evalResults && (
            <div style={{ marginTop: 14 }}>
              {evalResults.map(r => (
                <div key={r.provider} style={{ ...S.inner, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b style={{ fontSize: 15, color: "var(--text)" }}>{r.provider}</b>
                    <span style={{ fontSize: 18, fontWeight: 800, color: r.overall >= 0.8 ? S.good : r.overall >= 0.6 ? S.warn : S.bad }}>
                      {(r.overall * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ ...S.mono, marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    {Object.entries(r.scores).map(([k, v]) => (
                      <span key={k} style={{ color: v >= 1 ? S.good : v >= 0.5 ? S.warn : S.bad }}>{k}: {v}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ready && tab === "accuracy" && (
        <div style={S.card}>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
            {T("ตรวจความแม่นยำของโมเดล 5 ชั้นจากโมดูลจริง: การหยิบความรู้ · การตัดสินใจสอน · สื่อการสอน · คุณภาพคำตอบ · ความสะอาดของคลังความรู้ — รันซ้ำได้ทุกครั้งที่เปลี่ยนโมเดล", "Audit the model's accuracy in five real-module layers: knowledge retrieval · teaching decisions · teaching materials · answer quality · knowledge-base cleanliness — re-run after every model change", "五个真实模块层面审计模型准确性：知识检索·教学决策·教材·答案质量·知识库清洁——换模型后可随时重跑")}
          </div>
          <button style={S.btn} onClick={runAccuracyAudit} disabled={accBusy}>{accBusy ? T("กำลังตรวจจริง…", "Auditing…", "审计中…") : T("▶ ตรวจความแม่นยำตอนนี้", "Run accuracy audit now", "立即审计")}</button>
          {accErr && <div style={{ color: S.bad, marginTop: 10, fontSize: 13 }}>{accErr}</div>}
          {accAudit && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <b style={{ fontSize: 16, color: "var(--text)" }}>{T("ความแม่นยำรวม", "Overall accuracy", "总体准确度")}</b>
                <span style={{ fontSize: 22, fontWeight: 800, color: accAudit.allPass ? S.good : S.bad }}>
                  {accAudit.overall == null ? "—" : accAudit.overall.toFixed(1) + "%"} {accAudit.allPass ? "✅" : "❌"}
                </span>
              </div>
              {accAudit.layers.map(l => (
                <div key={l.id} style={{ ...S.inner, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <b style={{ fontSize: 13.5, color: "var(--text)" }}>{l.name}</b>
                    <span style={{ fontSize: 15, fontWeight: 800, color: l.pass ? S.good : S.bad }}>{l.score.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, background: "var(--bd2, rgba(0,0,0,0.08))", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
                    <div style={{ width: Math.max(0, Math.min(100, l.score)) + "%", height: "100%", background: l.pass ? S.good : l.score >= l.bar * 0.75 ? S.warn : S.bad }} />
                  </div>
                  <div style={{ ...S.mono, fontSize: 11, color: "var(--text2)", marginTop: 4 }}>{l.detail} · เกณฑ์ผ่าน ≥ {l.bar}%</div>
                </div>
              ))}
              {accAudit.unavailable && accAudit.unavailable.length > 0 && (
                <div style={{ fontSize: 12, color: S.warn, marginTop: 6 }}>
                  {T("ชั้นที่วัดไม่ได้รอบนี้ (แสดงผลซื่อสัตย์ ไม่เดาตัวเลข): ", "Layers unavailable this run (shown honestly, never guessed): ", "本轮不可用层（诚实显示，不猜数字）：")}{accAudit.unavailable.join(", ")}
                </div>
              )}
            </div>
          )}
          {accHistory.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <b style={{ fontSize: 13.5, color: "var(--text)" }}>{T("ประวัติการตรวจ (เครื่องนี้, เก็บสูงสุด 30 รอบ)", "Audit history (this device, last 30 runs)", "审计历史（本机，最近30次）")}</b>
                <button style={{ ...S.chip(false), fontSize: 11 }} onClick={() => { clearAccuracyAuditHistory(); setAccHistory([]); }}>{T("ล้างประวัติ", "Clear", "清除")}</button>
              </div>
              {accHistory.slice(0, 10).map((r, i) => (
                <div key={r.saved_at + "-" + i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", padding: "3px 0", borderBottom: "1px solid var(--bd2, rgba(0,0,0,0.05))" }}>
                  <span style={S.mono}>{new Date(r.saved_at).toLocaleString()}</span>
                  <span style={{ fontWeight: 700, color: r.allPass ? S.good : S.bad }}>{r.overall == null ? "—" : r.overall.toFixed(1) + "%"} {r.allPass ? "✅" : "❌"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ready && tab === "loop" && (
        <div style={S.card}>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
            {T("จำลองสัญญาณการซ้อมจริง → ดูสถานะนักเรียน (probability+evidence) การวินิจฉัย และกลยุทธ์ที่เลือก — ไม่ยิงโมเดล", "Simulate practice signals → see student states (probability+evidence), diagnosis, chosen strategy — no model call", "模拟练习信号 → 查看学生状态、诊断与策略 — 不调用模型")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "var(--text)" }}>{T("ความแม่นยำ", "Accuracy", "准确度")}: <b>{acc}%</b>
              <input type="range" min="0" max="100" value={acc} onChange={e => setAcc(+e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 13, color: "var(--text)" }}>{T("พลาดซ้ำ", "Repeated errors", "重复错误")}: <b>{repeats}</b>
              <input type="range" min="0" max="6" value={repeats} onChange={e => setRepeats(+e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 13, color: "var(--text)" }}>{T("หยุดกลางทาง", "Pauses", "中途停顿")}: <b>{pauses}</b>
              <input type="range" min="0" max="8" value={pauses} onChange={e => setPauses(+e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 13, color: "var(--text)" }}>{T("นักเรียนบอกว่า", "Student says", "学生说")}:
              <select value={selfReport} onChange={e => setSelfReport(e.target.value)} style={{ ...S.input, width: "100%", marginTop: 4 }}>
                <option value="">— {T("ไม่ระบุ", "none", "无")} —</option>
                <option value="too_easy">{T("ง่ายไป", "too easy", "太简单")}</option>
                <option value="too_hard">{T("ยากไป", "too hard", "太难")}</option>
              </select>
            </label>
          </div>
          <button style={S.btn} onClick={runLoop}>{T("▶ รันวงจร", "Run loop", "运行循环")}</button>
          {loopErr && (
            <div style={{ ...S.inner, marginBottom: 10, borderLeft: "3px solid " + S.bad }}>
              <b style={{ fontSize: 13, color: S.bad }}>⚠ {T("วงจรหยุดด้วยข้อผิดพลาด", "Loop failed", "循环出错")}</b>
              <div style={{ ...S.mono, marginTop: 4, whiteSpace: "pre-wrap" }}>{loopErr}</div>
            </div>
          )}
          {loopOut && (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...S.inner, marginBottom: 8 }}>
                <b style={{ fontSize: 13, color: "var(--text)" }}>{T("สถานะนักเรียน (ประมาณการ)", "Student states (estimates)", "学生状态（估计）")}</b>
                {loopOut.states.length === 0 && <div style={S.mono}>{T("ไม่มีสัญญาณเพียงพอ — ระบบไม่เดา (ตามหลัก observation ≠ inference)", "Insufficient signal — the system does not guess (observation ≠ inference)", "信号不足 — 不猜测（观察≠推断）")}</div>}
                {loopOut.states.map((s, i) => (
                  <div key={i} style={{ ...S.mono, marginTop: 6 }}>
                    <b style={{ color: S.warn }}>{s.state}</b> p={s.probability.toFixed(2)} conf={s.confidence.toFixed(2)}
                    <div style={{ color: "var(--text2)" }}>{T("หลักฐาน", "Evidence", "证据")}: {s.evidence.join("; ")}</div>
                    {s.alternative_explanations.length > 0 && <div style={{ color: "var(--muted)" }}>{T("สมมติฐานอื่น", "Alternatives", "其他可能")}: {s.alternative_explanations.join("; ")}</div>}
                  </div>
                ))}
              </div>
              <div style={{ ...S.inner, marginBottom: 8 }}>
                <b style={{ fontSize: 13, color: "var(--text)" }}>{T("การวินิจฉัย", "Diagnosis", "诊断")}</b>
                {loopOut.diagnosis.issues.length === 0 && <div style={S.mono}>—</div>}
                {loopOut.diagnosis.issues.map((d, i) => <div key={i} style={S.mono}>• {d.code} — {d.detail} ({T("มั่นใจ", "conf", "置信")} {d.confidence.toFixed(2)})</div>)}
              </div>
              <div style={{ ...S.inner, marginBottom: 8 }}>
                <b style={{ fontSize: 13, color: "var(--text)" }}>{T("กลยุทธ์ที่เลือก", "Selected strategy", "所选策略")}</b>
                <div style={S.mono}>{loopOut.decision.strategy_id}</div>
                <div style={{ fontSize: 13, marginTop: 4, color: "var(--text)" }}>{loopOut.decision.rationale}</div>
                {loopOut.decision.actions.length > 0 && <div style={S.mono}>actions: {loopOut.decision.actions.join(" → ")}</div>}
              </div>
              <div style={{ ...S.inner, borderColor: "color-mix(in srgb, var(--accent, #d97757) 35%, var(--bd1))" }}>
                <b style={{ fontSize: 13, color: "var(--text)" }}>🤖 {T("ข้อความที่จะแสดงนักเรียน", "Message the student would see", "学生将看到的消息")}</b>
                <div style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap", color: "var(--text)" }}>{loopOut.response.text}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Coach panel (roadmap #62/#73/#75/#78): the reasoning layer made visible.
   Skill graph stats + mastery slider demo → next-skill suggestion, hint
   ladder walker, flow-band tempo decision, and a recap from real numbers.
   Everything runs locally/synchronously — no model call, honest when data
   is absent. ── */
function CoachPanel({ lang, S, T }) {
  const sg = getSkillGraph();
  const coach = getCoach();
  const [acc, setAcc] = useState(88);
  const [reps, setReps] = useState(2);
  const [mastery, setMastery] = useState({}); // {skill_id: 0..1} — simulated learner
  const [bpm, setBpm] = useState(72);
  const [goalBpm, setGoalBpm] = useState(96);
  const [hintCtx, setHintCtx] = useState({ attempts: 1, sameSpotFails: 0, selfReport: null, lastRung: null });

  const order = sg ? sg.unlockOrder() : null;
  const ready = sg ? sg.readySkills(mastery, { max: 6 }) : [];
  const next = sg ? sg.nextSkill(mastery) : null;
  const rung = coach.rungFor ? coach.rungFor(hintCtx) : 0;
  const hint = coach.renderHint ? coach.renderHint(rung, { barLabel: T("ห้อง 5-6", "bars 5-6", "第5-6小节") }) : null;
  const tempo = coach.tempoTarget ? coach.tempoTarget({ currentBpm: bpm, goalBpm, accuracy: acc, cleanReps: reps }) : null;
  const rc = coach.recap ? coach.recap({
    session: { accuracy: acc, weekAgoAccuracy: acc - 6, worstSpotLabel: T("ห้อง 5-6", "bars 5-6", "第5-6小节") },
    nextSkill: next, tempo: tempo ? tempo.bpm : null,
  }) : null;

  if (!sg || !order) return <div style={S.card}>{T("กราฟทักษะยังไม่พร้อม", "Skill graph unavailable", "技能图不可用")}</div>;

  const domainCounts = {};
  // walk the public order API to count domains (no internals needed)
  for (const id of order) { const n = sg.get(id); if (n) domainCounts[n.domain] = (domainCounts[n.domain] || 0) + 1; }

  function bumpNext() {
    // "จำลองผู้เรียน": mark the current best next skill mastered → watch the
    // graph pick the logical follower (this is the adaptive-pathway demo)
    if (!next) return;
    setMastery(m => ({ ...m, [next.id]: 0.9 }));
  }
  function resetLearner() { setMastery({}); }

  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {T(
          `ชั้นใบ้เหตุผลการสอน: กราฟทักษะ ${sg.count()} โหนด + ขั้นบันไดใบ้ 4 ชั้น + ความยากปรับตาม flow (±10%) + สรุปท้ายคลาสอัตโนมัติ — ทุกอย่างคำนวณจากข้อมูลจริง ไม่เดา ไม่ยิงโมเดล`,
          `The teaching reasoning layer: ${sg.count()}-node skill graph + 4-rung hint ladder + flow-band adaptive difficulty (±10%) + auto recap — all computed from real data, no guessing, no model call.`,
          `教学推理层：${sg.count()} 节点技能图 + 4 级提示阶梯 + 心流自适应难度（±10%）+ 自动总结——全部由真实数据计算。`
        )}
      </div>

      {/* Skill graph overview */}
      <div style={{ ...S.inner, marginBottom: 10 }}>
        <b style={{ fontSize: 13.5, color: "var(--text)" }}>🕸 {T("กราฟทักษะ", "Skill graph", "技能图")}</b>
        <div style={{ ...S.mono, marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span>{sg.count()} {T("โหนด", "nodes", "节点")}</span>
          <span>{order.length} {T("เรียงลำดับสอนได้", "in teaching order", "已排序")}</span>
          <span>{Object.keys(domainCounts).length} {T("หมวด", "domains", "领域")}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).map(([d, n]) => (
            <span key={d} style={{ ...S.mono, border: "1px solid var(--bd2)", borderRadius: 999, padding: "2px 10px" }}>{d}: {n}</span>
          ))}
        </div>
      </div>

      {/* Next-skill demo */}
      <div style={{ ...S.inner, marginBottom: 10 }}>
        <b style={{ fontSize: 13.5, color: "var(--text)" }}>🧭 {T("ทักษะถัดไปที่ควรสอน", "Next skill to teach", "下一个应教技能")}</b>
        {next ? (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 14.5, color: "var(--text)", fontWeight: 700 }}>{lang === "en" ? next.en : next.th}</div>
            <div style={S.mono}>{next.domain} · tier {next.tier} · {T("พื้นฐานครบ", "prerequisites met", "前置已满足")}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button style={{ ...S.btn, padding: "7px 14px", fontSize: 13 }} onClick={bumpNext}>{T("✔ จำลองว่าเรียนผ่านแล้ว", "✔ Simulate mastered", "✔ 模拟已掌握")}</button>
              <button style={{ ...S.btnGhost, padding: "7px 14px", fontSize: 13 }} onClick={resetLearner}>{T("รีเซ็ตผู้เรียนจำลอง", "Reset simulated learner", "重置模拟学习者")}</button>
              <span style={S.mono}>{T("ผ่านแล้ว", "mastered", "已掌握")}: {Object.keys(mastery).length}</span>
            </div>
          </div>
        ) : (
          <div style={{ ...S.mono, marginTop: 6 }}>{T("ยังไม่มีข้อมูลความถนัด — ระบบจะไม่เดา (ตามหลัก observation ≠ inference)", "No mastery data yet — the system will not guess (observation ≠ inference)", "暂无掌握度数据——系统不猜测")}</div>
        )}
        {ready.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12.5, color: "var(--text2)" }}>{T("พร้อมเรียน (พื้นฐานครบ)", "Ready to learn (prereqs met)", "可学习（前置满足）")}:</div>
            {ready.map(r => (
              <div key={r.id} style={{ ...S.mono, marginTop: 3 }}>• {lang === "en" ? r.en : r.th} <span style={{ color: "var(--muted)" }}>({r.domain}, tier {r.tier})</span></div>
            ))}
          </div>
        )}
      </div>

      {/* Hint ladder demo */}
      <div style={{ ...S.inner, marginBottom: 10 }}>
        <b style={{ fontSize: 13.5, color: "var(--text)" }}>🪜 {T("บันไดใบ้ 4 ชั้น", "4-rung hint ladder", "4 级提示阶梯")}</b>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          <label style={{ fontSize: 13, color: "var(--text)" }}>{T("ลองผิดครั้งที่", "Attempt #", "第几次尝试")}: <b>{hintCtx.attempts}</b>
            <input type="range" min="1" max="6" value={hintCtx.attempts} onChange={e => setHintCtx(h => ({ ...h, attempts: +e.target.value }))} style={{ width: "100%" }} />
          </label>
          <label style={{ fontSize: 13, color: "var(--text)" }}>{T("ผิดจุดเดิม", "Same-spot fails", "同处失败")}: <b>{hintCtx.sameSpotFails}</b>
            <input type="range" min="0" max="4" value={hintCtx.sameSpotFails} onChange={e => setHintCtx(h => ({ ...h, sameSpotFails: +e.target.value }))} style={{ width: "100%" }} />
          </label>
        </div>
        <div style={{ ...S.mono, marginTop: 6 }}>{T("ชั้นที่เลือก", "Selected rung", "所选级别")}: <b style={{ color: "var(--accent, #d97757)" }}>{rung + 1}/4 — {lang === "en" ? (rung === 0 ? "Ask back" : rung === 1 ? "Point" : rung === 2 ? "Show how" : "Play it") : (rung === 0 ? "ถามกลับ" : rung === 1 ? "ชี้จุด" : rung === 2 ? "โชว์วิธี" : "เล่นให้ดู")}</b></div>
        {hint && <div style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap", color: "var(--text)" }}>🤖 {hint[lang === "en" ? "en" : lang === "zh" ? "zh" : "th"]}</div>}
      </div>

      {/* Adaptive tempo demo */}
      <div style={{ ...S.inner, marginBottom: 10 }}>
        <b style={{ fontSize: 13.5, color: "var(--text)" }}>🎚 {T("ความยากปรับตาม flow (±10%)", "Flow-band adaptive tempo (±10%)", "心流自适应速度（±10%）")}</b>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          <label style={{ fontSize: 13, color: "var(--text)" }}>{T("ความแม่นยำ", "Accuracy", "准确度")}: <b>{acc}%</b>
            <input type="range" min="0" max="100" value={acc} onChange={e => setAcc(+e.target.value)} style={{ width: "100%" }} />
          </label>
          <label style={{ fontSize: 13, color: "var(--text)" }}>{T("ครั้งสมบูรณ์ติดกัน", "Clean reps", "连续完美次数")}: <b>{reps}</b>
            <input type="range" min="0" max="5" value={reps} onChange={e => setReps(+e.target.value)} style={{ width: "100%" }} />
          </label>
          <label style={{ fontSize: 13, color: "var(--text)" }}>{T("เทมโปปัจจุบัน", "Current tempo", "当前速度")}: <b>{bpm} BPM</b>
            <input type="range" min="40" max="200" value={bpm} onChange={e => setBpm(+e.target.value)} style={{ width: "100%" }} />
          </label>
          <label style={{ fontSize: 13, color: "var(--text)" }}>{T("เทมโปเป้าหมาย", "Goal tempo", "目标速度")}: <b>{goalBpm} BPM</b>
            <input type="range" min="50" max="208" value={goalBpm} onChange={e => setGoalBpm(+e.target.value)} style={{ width: "100%" }} />
          </label>
        </div>
        {tempo && (
          <div style={{ ...S.mono, marginTop: 8 }}>
            → <b style={{ fontSize: 15, color: "var(--accent, #d97757)" }}>{tempo.bpm} BPM</b> ({tempo.step >= 0 ? "+" : ""}{tempo.step}) · {tempo.reason}
            {tempo.band && <span> · {tempo.band.pctOfGoal}% {T("ของเป้า", "of goal", "占目标")}</span>}
          </div>
        )}
      </div>

      {/* Recap demo */}
      <div style={{ ...S.inner }}>
        <b style={{ fontSize: 13.5, color: "var(--text)" }}>📝 {T("สรุปท้ายคลาส (3 ข้อ + การบ้าน ≤15 นาที)", "Session recap (3 lines + ≤15-min homework)", "课程总结（3 行 + 15 分钟内作业）")}</b>
        {rc && (
          <div style={{ marginTop: 8 }}>
            {rc.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 14, color: "var(--text)", marginBottom: 5, whiteSpace: "pre-wrap" }}>
                {i + 1}. {l[lang === "en" ? "en" : lang === "zh" ? "zh" : "th"]}
              </div>
            ))}
            <div style={{ ...S.inner, marginTop: 8, borderColor: "color-mix(in srgb, var(--accent, #d97757) 35%, var(--bd1))" }}>
              <div style={{ fontSize: 13.5, color: "var(--text)" }}>📚 {rc.homework[lang === "en" ? "en" : lang === "zh" ? "zh" : "th"]}</div>
            </div>
            {rc.summary.masteryDelta != null && <div style={S.mono}>mastery Δ: {rc.summary.masteryDelta}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── KB hot path: the owner's switch for how much knowledge the chat sends the model ──
   OFF (how it works today): the legacy block — every entry of every matched
   domain; one harmony question measured 1.38 MB. ON: only the most relevant
   lines, capped (kbHotPath().config), the same content with only the selection
   changed. Stored in app_settings.tiga_kb_hot_path; every device picks it up
   within a minute, no deploy. Fails closed: if the setting cannot be read the
   chat keeps the legacy block. Flip it only after reading the capped-vs-legacy
   report (node tigamodel/scripts/eval-kb-capped-vs-legacy.mjs). ── */
function KbHotPathPanel({ lang, S, T }) {
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const cfg = (kbHotPath() as any).config || {};
  useEffect(() => {
    let alive = true;
    isKbHotPathSwitchOn().then(v => { if (alive) setOn(!!v); }, () => { if (alive) setOn(false); });
    return () => { alive = false; };
  }, []);
  async function toggle() {
    if (busy || on === null) return;
    setBusy(true); setMsg("");
    try {
      const next = await setKbHotPathSwitch(!on);
      setOn(next);
      setMsg(next
        ? T("🟢 เปิดแล้ว — แชทจะส่งเฉพาะความรู้ที่เกี่ยวข้องที่สุดให้โมเดล (มีผลภายใน 1 นาทีบนทุกเครื่อง)", "🟢 ON — the chat now sends only the most relevant knowledge to the model (takes effect within a minute on every device)", "🟢 已开启 — 聊天只把最相关的知识发给模型（1 分钟内所有设备生效）")
        : T("🔴 ปิดแล้ว — แชทกลับไปส่งบล็อกความรู้แบบเดิมทั้งหมด", "🔴 OFF — the chat is back to sending the full legacy knowledge block", "🔴 已关闭 — 聊天恢复发送完整的旧知识块"));
    } catch (e: any) { setMsg("⚠️ " + (e?.message || "error")); }
    setBusy(false);
  }
  if (on === null) return null;
  return (
    <div style={{ ...S.card, marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {T(
          `วิธีส่งความรู้ให้โมเดลในแชท: ตอนนี้ส่ง "ทุกเรื่อง" ของหมวดที่ตรงคำถาม (คำถามเรื่องคอร์ดข้อเดียววัดได้ ~1.4 ล้านตัวอักษร) — เมื่อเปิด จะส่งเฉพาะบรรทัดที่เกี่ยวข้องที่สุด ไม่เกิน ${cfg.maxLines || 24} บรรทัด / ${(cfg.maxChars || 8000).toLocaleString()} ตัวอักษร เนื้อหาเหมือนเดิมทุกตัวอักษร เปลี่ยนแค่การเลือก`,
          `How the chat hands knowledge to the model: today it sends EVERY entry of the matched domains (one chord question measured ~1.4 million characters). When ON it sends only the most relevant lines — at most ${cfg.maxLines || 24} lines / ${(cfg.maxChars || 8000).toLocaleString()} characters — with the content unchanged; only the selection differs.`,
          `聊天把知识交给模型的方式：目前发送匹配领域的全部条目（一个和弦问题实测约 140 万字符）。开启后只发送最相关的行——最多 ${cfg.maxLines || 24} 行 / ${(cfg.maxChars || 8000).toLocaleString()} 字符——内容不变，只改变选择。`
        )}
      </div>
      <div style={{ ...S.inner, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderColor: on ? "color-mix(in srgb, var(--ok, #3f9d63) 45%, var(--bd1))" : "var(--bd1)" }}>
        <div>
          <b style={{ fontSize: 15, color: "var(--text)" }}>{on ? "🟢 " : "⚪ "}{T("บล็อกความรู้แบบจำกัด (Hot path)", "Capped knowledge block (hot path)", "限量知识块（Hot path）")}</b>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 3 }}>
            {on ? T("เปิด — ส่งเฉพาะบรรทัดที่เกี่ยวข้องที่สุด", "ON — only the most relevant lines are sent", "开启 — 只发送最相关的行") : T("ปิด — ส่งบล็อกเดิมทั้งหมด (ค่าเริ่มต้น)", "OFF — the full legacy block is sent (default)", "关闭 — 发送完整的旧知识块（默认）")}
          </div>
        </div>
        <button onClick={toggle} disabled={busy}
          style={{ padding: "10px 22px", borderRadius: 999, border: "none", cursor: busy ? "wait" : "pointer", fontWeight: 800, fontSize: 14,
            background: on ? "var(--ok, #3f9d63)" : "var(--bd3)", color: on ? "#fff" : "var(--text)" }}>
          {busy ? "…" : on ? T("เปิดอยู่ — กดปิด", "ON — tap to turn OFF", "开启 — 点击关闭") : T("ปิดอยู่ — กดเปิด", "OFF — tap to turn ON", "关闭 — 点击开启")}
        </button>
      </div>
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: "var(--text2)" }}>{msg}</div>}
    </div>
  );
}

/* ── Self-Learning panel: the owner's master switch + everything the model
   has learned so far (admin-taught entries + reinforcement stats). Switch OFF
   = the model stops learning AND stops using learned knowledge at once. ── */
function SelfLearningPanel({ lang, S, T, on, snap, busy, msg, onToggle, onRemove, onClear }) {
  const entries = (snap && snap.entries) || [];
  const stats = (snap && snap.stats) || {};
  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {T(
          "โมเดลเรียนรู้และอัปเดตตัวเองได้ — เรียนจากการสอนของคุณใน Admin Chat และปรับน้ำหนักกลยุทธ์จากผลการซ้อมจริงของนักเรียน คุณเป็นคนควบคุมสวิตช์นี้เพียงผู้เดียว",
          "The model can learn and update itself — from your admin-chat teaching and by re-weighting strategies from real practice outcomes. You alone control this switch.",
          "模型可以自我学习——从管理员教学和练习结果中更新知识。此开关由您独自控制。"
        )}
      </div>
      {/* THE master switch */}
      <div style={{ ...S.inner, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderColor: on ? "color-mix(in srgb, var(--ok, #3f9d63) 45%, var(--bd1))" : "var(--bd1)" }}>
        <div>
          <b style={{ fontSize: 15, color: "var(--text)" }}>{on ? "🟢 " : "⚪ "}{T("การเรียนรู้อัตโนมัติ", "Self-learning", "自动学习")}</b>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 3 }}>
            {on
              ? T("เปิด — โมเดลกำลังเรียนรู้และใช้ความรู้ที่เรียนมา", "ON — learning and injecting learned knowledge", "开启 — 正在学习并注入已学知识")
              : T("ปิด — โมเดลหยุดเรียนรู้ ไม่มีข้อมูลใดถูกเก็บ", "OFF — not learning; nothing is stored", "关闭 — 不学习，不存储")}
          </div>
        </div>
        <button onClick={onToggle} disabled={busy}
          style={{ padding: "10px 22px", borderRadius: 999, border: "none", cursor: busy ? "wait" : "pointer", fontWeight: 800, fontSize: 14,
            background: on ? "var(--ok, #3f9d63)" : "var(--bd3)", color: on ? "#fff" : "var(--text)" }}>
          {busy ? "…" : on ? T("เปิดอยู่ — กดปิด", "ON — tap to turn OFF", "开启 — 点击关闭") : T("ปิดอยู่ — กดเปิด", "OFF — tap to turn ON", "关闭 — 点击开启")}
        </button>
      </div>
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: "var(--text2)" }}>{msg}</div>}
      {/* stats */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ ...S.inner, flex: 1, minWidth: 120, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{entries.length}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{T("ความรู้ที่เรียนมา", "learned entries", "已学条目")}</div>
        </div>
        <div style={{ ...S.inner, flex: 1, minWidth: 120, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{stats.learned || 0}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{T("เรียนจากการสอน", "taught events", "教学学习")}</div>
        </div>
        <div style={{ ...S.inner, flex: 1, minWidth: 120, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{stats.reinforced || 0}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{T("ปรับจากผลซ้อม", "outcome events", "结果强化")}</div>
        </div>
      </div>
      {/* learned entries */}
      {entries.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <b style={{ fontSize: 13.5, color: "var(--text)" }}>{T("🧠 สิ่งที่โมเดลเรียนรู้", "🧠 What the model learned", "🧠 模型已学内容")}</b>
            <button style={{ ...S.btnGhost, padding: "5px 12px", fontSize: 12.5 }} onClick={onClear}>🗑 {T("ลบทั้งหมด", "Clear all", "全部清除")}</button>
          </div>
          {entries.map(e => (
            <div key={e.id} style={{ ...S.inner, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, color: "var(--text)", whiteSpace: "pre-wrap" }}>{e.body}</div>
                  <div style={{ ...S.mono, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>{e.domain}</span>
                    <span>conf: {Number(e.confidence || 0).toFixed(2)}</span>
                    {e.up > 0 && <span style={{ color: S.good }}>▲{e.up}</span>}
                    {e.down > 0 && <span style={{ color: S.bad }}>▼{e.down}</span>}
                    <span>{(e.created_at || "").slice(0, 10)}</span>
                  </div>
                </div>
                <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "var(--muted)", padding: 2 }}
                  onClick={() => onRemove(e.id)} aria-label="remove">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {entries.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 16 }}>
          {T("ยังไม่มีความรู้ที่เรียนมา — เปิดสวิตช์แล้วไปสอนโมเดลในแท็บ Admin Chat (สอน AI) ได้เลย", "Nothing learned yet — flip the switch, then teach the model in the Admin Chat (Teach AI) tab", "暂无已学知识——打开开关后，在管理员聊天中教学即可")}
        </div>
      )}
    </div>
  );
}

/* ── Roadmap panel: the 100-item development plan, grouped, with live status ── */
/* ── 1M-plan panel (owner directive 2026-09-18): the 1,000,000-item
   combinatorial development plan from tigamodel/roadmap-1m.js. Walks the
   ranked work order (highest priority-score first), filters per dimension,
   shows live coverage stats, and can draw a deterministic audit sample. ── */
/* ── 👤 Student view: exactly what the production chat teacher knows about
   THIS student right now (same function use-chat injects). No simulation —
   a live mirror of getStudentContextBlock() + the learner-wave domains the
   KB serves when the owner asks a real teaching question. ── */
function StudentViewPanel({ lang, S, T }) {
  const [probe, setProbe] = useState("");
  const block = getStudentContextBlock(); // same call the production chat makes
  const hasBlock = !!block.trim();
  const tiga = getTigamodel();
  const kbCount = tiga && tiga.kb ? tiga.kb.count() : 0;
  const probeOut = probe.trim()
    ? (() => { try { return getKBContext(probe); } catch (e) { return null; } })()
    : null;
  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {T(
          "สิ่งที่ครู AI ในแชทจริงรู้เกี่ยวกับนักเรียนคนนี้ — อ่านจากความจำการซ้อมของแอปด้วยฟังก์ชันเดียวกับที่ฉีดเข้า prompt ทุกครั้งที่ผู้เรียนคุยกับครู (ไม่มีการจำลอง)",
          "Exactly what the production chat teacher knows about THIS student — read from the app's practice memory through the same function injected into every chat prompt (no simulation).",
          "生产聊天老师对该学生的全部认知——用与聊天注入相同的函数从练习记忆读取（非模拟）。"
        )}
      </div>
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        {T("📚 ความรู้รวมที่ครูใช้ได้: ", "📚 Total KB entries the teacher can draw on: ", "📚 可用知识条目: ")}
        <b style={{ color: "var(--primary)" }}>{kbCount.toLocaleString()}</b>
      </div>
      <div style={{ ...S.card, background: "var(--bg2, rgba(0,0,0,0.04))" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          {T("ข้อมูลนักเรียนที่จะถูกฉีดเข้าแชท:", "Student block injected into chat:", "注入聊天的学生信息:")}
        </div>
        {hasBlock
          ? <div style={{ fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{block.trim()}</div>
          : <div style={{ fontSize: 13, color: "var(--text2)" }}>
              {T("ยังว่าง — นักเรียนนี้ยังไม่มีประวัติการซ้อมพอ (ระบบไม่เดา: ครูจะสอนแบบกลางๆ จนมีข้อมูลจริง)", "Empty — this student has no practice history yet (the system does not guess: the teacher stays neutral until real data exists).", "尚无练习记录——系统不猜测，老师保持中立。")}
            </div>}
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          {T("ลองถามครู (ทดสอบความรู้ที่จะถูกเสิร์ฟ):", "Ask the teacher (probe what KB slice would be served):", "试问老师(测试将注入的知识):")}
        </div>
        <input style={S.input} value={probe} onChange={(e) => setProbe(e.target.value)}
          placeholder={T("เช่น ลูกอ่านโน้ตไม่ค่อยได้ / ท่องจำไม่อยู่ / อยากเล่นเพลงไทย", "e.g. can't read notes / can't memorize / Thai songs", "例:识谱差/记不住/泰国歌")} />
        {probeOut && (
          <div style={{ ...S.card, marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>
              {T("ความรู้ที่ถูกเลือกเสิร์ฟสำหรับคำถามนี้:", "KB slice selected for this question:", "该问题将注入的知识:")}
            </div>
            <div style={{ fontSize: 12, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{probeOut}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ⚡ Readiness: the capability engine's live verdict over all 1,000
   t×m×s routes (kb/reasoning/surface/measure/evolve from REAL modules) —
   plus the worklist of weakest routes and a real generated exercise. ── */
function CapabilityPanel({ lang, S, T }) {
  const st = capabilitySummary();
  const wl = capabilityWorklist(10);
  const [seed, setSeed] = useState(1);
  const ex = (() => { try { return generateStudentExercise(0, 3, seed); } catch (e) { return null; } })();
  const bar = (v, color) => (
    <div style={{ height: 8, background: "rgba(128,128,128,0.15)", borderRadius: 4, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.round(v * 100)}%`, background: color || "var(--primary)" }} />
    </div>
  );
  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {T(
          "เอนจินประเมินความพร้อมจริง: เดินทุกเส้นทาง t×m×s (1,000 เส้นทาง) ถามว่า 'ผู้เรียนมาถึงช่องทางนี้ ถามเรื่องนี้ — โมเดลมีอะไรจริงไหม' คะแนนจากโมดูลจริง ไม่ใช่การติ๊กรายการ",
          "The real readiness engine: walks every t×m×s route (1,000) and asks 'if a learner arrives on this surface asking about this topic at this layer — does the model have anything real?' Scored from actual modules, not tickboxes.",
          "真实能力引擎：遍历全部 1000 条路线，按真实模块评分，非打勾。"
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: st.readyPct >= 100 ? "var(--primary)" : "var(--text)", minWidth: 120 }}>
          {st.readyPct}%
        </div>
        <div style={{ flex: 1, fontSize: 13 }}>
          <div>{T("เส้นทางพร้อม", "Routes ready", "就绪路线")}: <b>{st.ready.toLocaleString()}</b> / {st.total.toLocaleString()}</div>
          <div>{T("คะแนนเฉลี่ย", "Avg score", "平均分")}: <b>{st.avgScore}</b> · {T("ช่องว่าง", "gaps", "空白")}: <b>{st.gaps}</b></div>
        </div>
      </div>
      <div style={{ ...S.card, background: "var(--bg2, rgba(0,0,0,0.04))", marginBottom: 10 }}>
        {Object.entries(st.capAvg).sort((a, b) => a[1] - b[1]).map(([cap, v]) => (
          <div key={cap} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 90, fontSize: 12, color: "var(--text2)" }}>{cap}</div>
            {bar(v, v >= 0.95 ? "var(--primary)" : v >= 0.7 ? "#e8a03c" : "#d9534f")}
            <div style={{ width: 44, fontSize: 12, textAlign: "right" }}>{Math.round(v * 100)}%</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        {T("งานที่อ่อนที่สุดถัดไป (worklist สด)", "Weakest routes next (live worklist)", "最弱路线工作清单")}
      </div>
      {wl.length === 0
        ? <div style={{ fontSize: 13, color: "var(--primary)", marginBottom: 10 }}>✅ {T("ทุกเส้นทางพร้อมแล้ว — เหลืองานเจาะลึกคุณภาพตามแผน 1M (WHO/HOW/QUALITY ต่อเซลล์)", "All routes ready — remaining work is per-cell depth (WHO/HOW/QUALITY) on the 1M plan.", "全部路线就绪——余下为逐格深度。")}</div>
        : <div style={{ marginBottom: 10 }}>
            {wl.map(r => (
              <div key={`${r.t}${r.m}${r.s}`} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 3 }}>
                <div style={{ fontFamily: "monospace" }}>T{r.t}M{r.m}S{r.s}</div>
                {bar(r.score, "#d9534f")}
                <div style={{ color: "var(--text2)", minWidth: 70 }}>{r.worstCap} {Math.round(r.worstScore * 100)}%</div>
              </div>
            ))}
          </div>}
      <div style={{ fontSize: 13, fontWeight: 700, margin: "8px 0 6px" }}>
        {T("ตัวอย่างแบบฝึกหัดที่โมเดลสร้างเอง (จากทฤษฎีคำนวณจริง):", "A real generated exercise (from computed theory):", "模型生成的练习示例:")}
      </div>
      {ex && (
        <div style={{ ...S.card, background: "var(--bg2, rgba(0,0,0,0.04))" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{ex.title}</div>
          <div style={{ fontSize: 13, margin: "4px 0" }}>{ex.task}</div>
          {ex.steps.map((s, i) => <div key={i} style={{ fontSize: 12, color: "var(--text2)" }}>• {s}</div>)}
          <div style={{ fontSize: 12, marginTop: 4 }}>✔ {ex.check}</div>
        </div>
      )}
      <button style={{ ...S.btn, marginTop: 8 }} onClick={() => setSeed(s => s + 1)}>{T("🎲 สุ่มแบบฝึกหัดใหม่", "🎲 New exercise", "🎲 换一个")}</button>
    </div>
  );
}

function OneMPlanPanel({ lang, S, T }) {
  const st = plm1mStats();
  const PAGE = 12;
  const [sort, setSort] = useState("rank");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [dims, setDims] = useState({});            // { t?, w?, h?, m?, s?, q? } numeric filters
  const [walk, setWalk] = useState({ rows: [], next: null, done: false, key: "" });
  const [sampleItem, setSampleItem] = useState(null);

  const queryKey = JSON.stringify([dims, onlyOpen, sort]);
  const filter = { ...dims, onlyOpen: onlyOpen ? true : undefined };
  useEffect(() => {
    const r = plm1mRank({ offset: 0, limit: PAGE, sort, filter });
    setWalk({ rows: r.rows, next: r.nextOffset, done: r.exhausted, key: queryKey });
  }, [queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadMore() {
    const r = plm1mRank({ offset: walk.next || 0, limit: PAGE, sort, filter });
    setWalk(w => ({ rows: w.rows.concat(r.rows), next: r.nextOffset, done: r.exhausted, key: w.key }));
  }

  const fmt = (n) => n.toLocaleString();
  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {T(
          `แผนพัฒนา 1,000,000 สิ่ง — สเปกความสามารถแบบผสม 6 มิติ × 10 ค่า (สอนอะไร × เพื่อใคร × สอนอย่างไร × ชั้นโมเดล × ช่องทาง × เกณฑ์คุณภาพ) ทุกรายการไม่ซ้ำ ตรวจรับได้ และเรียงตามคะแนนความสำคัญ คู่มือฉบับเต็ม: docs/03-roadmap-1m.md`,
          `The 1,000,000-item plan — a 6-dimension × 10-value capability-spec space (WHAT × WHO × HOW × LAYER × WHERE × QUALITY BAR). Every item unique, acceptance-testable, ranked by priority. Full write-up: docs/03-roadmap-1m.md.`,
          `百万项发展计划——6维×10值能力规格空间，每项唯一、可验收、按优先级排序。`
        )}
      </div>

      {/* live coverage stats */}
      <div style={{ ...S.inner, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text)", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
          <b>{T("ทั้งหมด", "Total", "总计")}: {fmt(st.total)}</b>
          <span style={S.mono}>
            <span style={{ color: S.good }}>■ {T("เริ่มแล้ว", "started", "已启动")} {fmt(st.started)} ({st.startedPct}%)</span>
            {"  ·  "}
            <span style={{ color: "var(--muted)", marginLeft: 10 }}>■ {T("ยังเปิด", "open", "待办")} {fmt(st.open)}</span>
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--bd1)", overflow: "hidden", display: "flex" }}>
          <div style={{ width: st.startedPct + "%", background: "var(--ok, #3f9d63)" }} />
        </div>
        <div style={{ ...S.mono, marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {st.byDim.map(d => (
            <span key={d.id} style={{ color: d.touched === d.of ? S.good : S.warn }}>
              {d.icon} {d.id.toUpperCase()} {d.touched}/{d.of}
            </span>
          ))}
          <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
            {T("งานกลุ่มคะแนนสูงสุด", "top-priority bucket", "最高优先组")} p{st.buckets[0] && st.buckets[0].p}: {st.buckets[0] ? fmt(st.buckets[0].count) : 0}
          </span>
        </div>
      </div>

      {/* controls */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button style={S.chip(onlyOpen)} onClick={() => setOnlyOpen(v => !v)}>
          {onlyOpen ? "⭕ " : "○ "}{T("เฉพาะที่ยังไม่ได้แตะ", "open items only", "仅待办")}
        </button>
        <button style={S.chip(sort === "index")} onClick={() => setSort(s => (s === "rank" ? "index" : "rank"))}>
          {sort === "rank" ? "🏆 " + T("เรียงตามอันดับ", "by rank", "按排名") : "#️⃣ " + T("เรียงตามดัชนี", "by index", "按编号")}
        </button>
        <button style={S.chip(false)} onClick={() => setSampleItem(plm1mSample(Math.floor(Math.random() * 999983) + 1))}>
          🎲 {T("สุ่มตรวจ 1 รายการ", "random audit sample", "随机抽查")}
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {PLM1M_DIMENSIONS.map(d => (
          <select key={d.id} value={dims[d.id] ?? ""}
            onChange={e => setDims(prev => { const n = { ...prev }; if (e.target.value === "") delete n[d.id]; else n[d.id] = parseInt(e.target.value, 10); return n; })}
            style={{ ...S.input, flex: "1 1 150px", minWidth: 140, fontSize: 12.5, padding: "7px 8px" }}>
            <option value="">{d.icon} {lang === "en" ? d.en : d.th} — {T("ทั้งหมด", "all", "全部")}</option>
            {d.values.map((v, vi) => <option key={vi} value={vi}>{vi} · {lang === "en" ? v.en : v.th}</option>)}
          </select>
        ))}
      </div>

      {/* random audit card */}
      {sampleItem && (
        <div style={{ ...S.inner, marginBottom: 10, borderLeft: "3px solid var(--accent, #d97757)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 13.5, color: "var(--text)" }}>🎲 #{fmt(sampleItem.index)} <span style={S.mono}>{sampleItem.code}</span></b>
            <button style={{ ...S.btnGhost, padding: "3px 10px", fontSize: 12 }} onClick={() => setSampleItem(null)}>✕</button>
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text)", marginTop: 4 }}>{sampleItem.title.th}</div>
          <div style={{ ...S.mono, marginTop: 3 }}>{sampleItem.body.th} · {T("ลำดับ", "priority", "优先")} {sampleItem.priority}</div>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 4 }}>{T("เกณฑ์ตรวจรับ", "acceptance", "验收")}: {sampleItem.criterion.th}</div>
        </div>
      )}

      {/* ranked rows */}
      <div style={{ ...S.mono, marginBottom: 6 }}>
        {walk.done ? T(`แสดง ${walk.rows.length} รายการ (ครบที่ตรงเงื่อนไข)`, `showing ${walk.rows.length} (all matches)`, `显示 ${walk.rows.length} 条（全部）`) : T(`แสดง ${walk.rows.length} รายการ`, `showing ${walk.rows.length}`, `显示 ${walk.rows.length} 条`)}
      </div>
      {walk.rows.map(it => (
        <div key={it.code} style={{ ...S.inner, marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 13.5, color: "var(--text)" }}>#{fmt(it.index)} — {lang === "en" ? it.title.en : it.title.th}</b>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: it.covered ? S.good : "var(--muted)", whiteSpace: "nowrap" }}>
              {it.covered ? T("เริ่มแล้ว", "started", "已启动") : T("ยังเปิด", "open", "待办")}
            </span>
          </div>
          <div style={{ ...S.mono, marginTop: 3 }}>{it.code} · {lang === "en" ? it.body.en : it.body.th} · {T("ลำดับ", "prio", "优先")} {it.priority}</div>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 4 }}>{T("เกณฑ์", "bar", "标准")}: {lang === "en" ? it.criterion.en : it.criterion.th}</div>
          {it.roadmapRefs.length > 0 && (
            <div style={{ fontSize: 11.5, color: S.warn, marginTop: 3 }}>↳ roadmap-100: {it.roadmapRefs.map(n => "#" + n).join(", ")}</div>
          )}
        </div>
      ))}
      {!walk.done && walk.rows.length > 0 && (
        <button style={{ ...S.btnGhost, width: "100%" }} onClick={loadMore}>
          ⬇ {T("โหลดอีก (จาก 1,000,000)", "load more (of 1,000,000)", "加载更多")}
        </button>
      )}
    </div>
  );
}

function RoadmapPanel({ lang, S, T }) {
  /* ── 🪟 THE UNIFIED PLAN (แผ่นใหญ่แผนเดียว): 100 streams × their 1M cells —
     statuses are the WEAKER of hand-set vs engine-verified, every stream row
     expands into its real cells, and one work order spans both grains. ── */
  const uni = getUnifiedPlan();
  const sum = uni.summary();
  const groups = uni.groups();
  const [openGroup, setOpenGroup] = useState("F");
  const [openCells, setOpenCells] = useState(null); // stream n → { rows, total, nextOffset }
  const [cellPage, setCellPage] = useState({});
  const wo = uni.workOrder(6);
  const starStr = (n) => "⭐".repeat(n);
  const prog = sum.streams;

  const loadCells = (n, offset) => {
    const page = uni.streamCells(n, { limit: 8, offset: offset || 0 });
    setOpenCells(page.total && page.rows.length ? { n, ...page } : null);
  };

  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {T(
          "🪟 แผ่นใหญ่แผนเดียว: 100 สตรีมพัฒนา (สิ่งที่ครูระดับโลกทำได้) × 1,000,000 เซลล์เจาะลึก (T×W×H×M×S×Q) — สถานะแต่ละสตรีมคือค่าที่อ่อนกว่าระหว่าง 'สิ่งที่แชปจริง' กับ 'สิ่งที่เอนจินตรวจได้' กดสตรีมเพื่อดูเซลล์จริงของมัน",
          "🪟 One unified sheet: 100 development streams (world-class-teacher capabilities) × 1,000,000 deepening cells (T×W×H×M×S×Q). Each stream's status is the WEAKER of what's shipped vs what the engine verifies. Tap a stream to drill into its real cells.",
          "🪟 统一大表：100条发展流 × 1,000,000个深化单元。状态取“已交付”与“引擎验证”中较弱者。"
        )}
      </div>

      {/* unified progress: streams + cells on one bar */}
      <div style={{ ...S.inner, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
          <b>{T("แผ่นใหญ่ — สตรีม + เซลล์", "Unified — streams + cells", "统一 — 流 + 单元")}</b>
          <span style={S.mono}>{prog.done + prog.partial}/{prog.total} {T("สตรีม", "streams", "流")}</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--bd1)", overflow: "hidden", display: "flex" }}>
          <div style={{ width: (prog.done / prog.total * 100) + "%", background: "var(--ok, #3f9d63)" }} />
          <div style={{ width: (prog.partial / prog.total * 100) + "%", background: "var(--warn, #b8860b)" }} />
        </div>
        <div style={{ ...S.mono, marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: ROADMAP_STATUS.done.color }}>■ {ROADMAP_STATUS.done[lang] || ROADMAP_STATUS.done.en} {prog.done}</span>
          <span style={{ color: ROADMAP_STATUS.partial.color }}>■ {ROADMAP_STATUS.partial[lang] || ROADMAP_STATUS.partial.en} {prog.partial}</span>
          <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
            {T("เซลล์พร้อม", "cells ready", "单元就绪")}: {sum.cells.readyPct}%
          </span>
        </div>
      </div>

      {/* ONE work order across both grains */}
      <div style={{ ...S.inner, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{T("คิวงานเดียว (รวมสองแผน)", "One work order (both plans merged)", "统一工作队列")}</div>
        {wo.map(r => (
          <div key={r.n} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "4px 0", borderTop: "1px solid var(--bd1)" }}>
            <span style={{ ...S.mono, minWidth: 26, color: "var(--muted)" }}>#{r.n}</span>
            <div style={{ flex: 1 }}>
              <span style={{ color: "var(--text)" }}>{lang === "en" ? r.en : r.th}</span>
              <span style={{ color: "var(--muted)" }}> · {r.cells.toLocaleString()} {T("เซลล์", "cells", "单元")}</span>
            </div>
            <span style={{ color: "var(--text2)", fontSize: 11.5 }}>{r.nextWork}</span>
          </div>
        ))}
      </div>

      {groups.map(g => {
        const open = openGroup === g.id;
        const done = g.items.filter(i => i.status === "done").length;
        return (
          <div key={g.id} style={{ ...S.inner, marginBottom: 8, padding: 0, overflow: "hidden" }}>
            <button style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--text)", padding: "12px 14px" }}
              onClick={() => setOpenGroup(open ? null : g.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <b style={{ fontSize: 14 }}>{g.icon} {lang === "en" ? g.en : g.th}</b>
                <span style={S.mono}>{done}/{g.items.length}</span>
              </div>
            </button>
            {open && (
              <div style={{ padding: "0 14px 12px" }}>
                {g.items.map(it => {
                  const st = ROADMAP_STATUS[it.status] || ROADMAP_STATUS.todo;
                  const cellsOpen = openCells && openCells.n === it.n;
                  return (
                    <div key={it.n} style={{ borderTop: "1px solid var(--bd1)" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0" }}>
                        <span style={{ ...S.mono, minWidth: 28, color: "var(--muted)" }}>{it.n}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, color: "var(--text)" }}>
                            {lang === "en" ? it.en : it.th}
                            {it.status !== it.handSetStatus && (
                              <span title="engine-verified status differs from hand-set" style={{ fontSize: 10.5, color: "var(--text2)" }}>
                                {" "}· {T("เอนจินประเมิน", "engine-verified", "引擎验证")}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, marginTop: 2 }}>
                            {it.stars > 0 && <span>{starStr(it.stars)}</span>}
                            <span style={{ color: "var(--muted)" }}> · {it.cells.toLocaleString()} {T("เซลล์", "cells", "单元")}</span>
                            {it.nextWork && <span style={{ color: "var(--text2)" }}> · {T("งานถัดไป", "next", "下一步")}: {it.nextWork}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: st.color, whiteSpace: "nowrap" }}>{st[lang] || st.en}</span>
                        <button style={{ ...S.btn, fontSize: 11, padding: "3px 8px" }}
                          onClick={() => (cellsOpen ? setOpenCells(null) : loadCells(it.n, 0))}>
                          {cellsOpen ? "▲" : T("เซลล์", "cells", "单元")}
                        </button>
                      </div>
                      {cellsOpen && (
                        <div style={{ padding: "0 0 10px 36px" }}>
                          {openCells.rows.map(c => (
                            <div key={c.index} style={{ display: "flex", gap: 6, fontSize: 11.5, padding: "2px 0", color: "var(--text2)" }}>
                              <span style={{ ...S.mono, minWidth: 92 }}>{c.code}</span>
                              <span style={{ flex: 1 }}>{lang === "en" ? c.title.en : c.title.th}</span>
                              <span>{c.covered ? "✅" : "—"}</span>
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            {openCells.nextOffset != null && (
                              <button style={{ ...S.btn, fontSize: 11, padding: "3px 8px" }}
                                onClick={() => { const next = (cellPage[it.n] || 0) + 8; setCellPage(p => ({ ...p, [it.n]: next })); loadCells(it.n, next); }}>
                                {T("ถัดไป", "more", "更多")} ({openCells.total.toLocaleString()} {T("เซลล์", "cells", "单元")})
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Knowledge panel: university-sourced entries + their real source links ── */
function KnowledgePanel({ lang, S }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const tiga = getTigamodel();
  const { sources } = getUniversitySources();
  const [openId, setOpenId] = useState(null);
  const [view, setView] = useState("all"); // "all" = full expansion KB · "uni" = university sources only
  const [q, setQ] = useState("");
  const [dom, setDom] = useState("");
  if (!tiga || !tiga.kb) return null;
  const allEntries = Array.from(tiga.kb._entries.values());
  const uniEntries = allEntries.filter(e => e.source && sources[e.source]);
  const bySource = {};
  uniEntries.forEach(e => { (bySource[e.source] = bySource[e.source] || []).push(e); });

  /* Full-KB search view (16,000+ computed knowledge entries) */
  const doms = {};
  allEntries.forEach(e => { doms[e.domain] = (doms[e.domain] || 0) + 1; });
  const needle = q.trim().toLowerCase();
  const matched = needle || dom
    ? allEntries.filter(e =>
        (!dom || e.domain === dom) &&
        (!needle || e.title.toLowerCase().includes(needle) || e.body.toLowerCase().includes(needle) || (e.tags || []).some(t => t.toLowerCase().includes(needle))))
      .slice(0, 120)
    : allEntries.slice(0, 40);

  if (view === "all") return (
    <div>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
        {T(
          `คลังความรู้ทั้งหมด ${allEntries.length.toLocaleString()} รายการ — คำนวณจากคณิตทฤษฎีดนตรีจริง (สเกล คอร์ด คีย์ จังหวะ เทคนิค การสอน) ทุกรายการตรวจสอบได้ ไม่มีข้อความมั่ว`,
          `Full knowledge base: ${allEntries.length.toLocaleString()} entries — computed from real music-theory math (scales, chords, keys, rhythm, technique, pedagogy). Every entry verifiable, zero filler.`,
          `全部知识库：${allEntries.length.toLocaleString()} 条 — 由真实音乐理论计算生成，每条可验证`
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={T("ค้นหา... (เช่น C major, dorian, hanon)", "Search... (e.g. C major, dorian, hanon)", "搜索...")}
          style={{ ...S.input, flex: 1, minWidth: 160 }} />
        <select value={dom} onChange={e => setDom(e.target.value)} style={{ ...S.input, maxWidth: 180 }}>
          <option value="">{T("ทุกหมวด", "All domains", "所有领域")} ({allEntries.length.toLocaleString()})</option>
          {Object.entries(doms).sort((a, b) => b[1] - a[1]).map(([d, n]) => (
            <option key={d} value={d}>{d} ({n.toLocaleString()})</option>
          ))}
        </select>
        <button style={S.chip(false)} onClick={() => setView("uni")}>🏛 {T("แหล่งมหาวิทยาลัย", "University sources", "大学来源")}</button>
      </div>
      <div style={{ ...S.mono, marginBottom: 8 }}>
        {matched.length < allEntries.length
          ? T(`แสดง ${matched.length} รายการ`, `showing ${matched.length}`, `显示 ${matched.length} 条`)
          : T("แสดงตัวอย่างแรก", "showing first", "显示开头")}
      </div>
      {matched.map(e => (
        <div key={e.id} style={{ ...S.inner, marginBottom: 6 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{e.title}</div>
          <div style={{ fontSize: 13.5, marginTop: 4, color: "var(--text)" }}>{e.body}</div>
          <div style={{ ...S.mono, marginTop: 5 }}>type: {e.type} · confidence: {e.confidence} · domain: {e.domain}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button style={S.chip(false)} onClick={() => setView("all")}>📚 {T(`คลังทั้งหมด (${allEntries.length.toLocaleString()})`, `Full KB (${allEntries.length.toLocaleString()})`, `全部 (${allEntries.length.toLocaleString()})`)}</button>
      </div>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {T(
          "องค์ความรู้ดนตรีที่รวบรวมจากสถาบันดนตรีชั้นนำของแต่ละประเทศ (หน้าเว็บสาธารณะ อ่านจริง 17 ก.ย. 2026) — เนื้อหาเรียบเรียงใหม่ทั้งหมด ไม่คัดลอกข้อความดิบ ทุกข้อมูลมีลิงก์แหล่งอ้างอิงจริง",
          "Music knowledge gathered from leading conservatories of each country (public pages, read 17 Sep 2026) — fully paraphrased, every entry linked to its real source",
          "从各国顶尖音乐学院收集的音乐知识（公开网页，2026年9月17日阅读）— 全部改写并附真实来源链接"
        )}
      </div>
      {Object.entries(sources).map(([sid, s]) => {
        const ents = bySource[sid] || [];
        const open = openId === sid;
        return (
          <div key={sid} style={{ ...S.card, padding: 14 }}>
            <button style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--text)", padding: 0 }}
              onClick={() => setOpenId(open ? null : sid)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontSize: 14.5, color: "var(--text)" }}>🏛 {s.institution}</b>
                <span style={S.mono}>{T(ents.length + " รายการ", ents.length + " entries", ents.length + " 条")}</span>
              </div>
              <div style={{ ...S.mono, marginTop: 3 }}>{s.country} · {s.read_at} · reliability: {s.reliability}</div>
            </button>
            {open && (
              <div style={{ marginTop: 10 }}>
                {ents.map(e => (
                  <div key={e.id} style={{ ...S.inner, marginBottom: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{e.title}</div>
                    <div style={{ fontSize: 13.5, marginTop: 4, color: "var(--text)" }}>{e.body}</div>
                    <div style={{ ...S.mono, marginTop: 5 }}>type: {e.type} · confidence: {e.confidence} · domain: {e.domain}</div>
                  </div>
                ))}
                <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--accent, #4a6fa5)", wordBreak: "break-all" }}>
                  🔗 {s.url}
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Auto-Teach 2.0 preview (plan §3): exactly what learners see — the
   coaching card with a demo data chart + a REAL knowledge card straight
   from the picker (real cited university source). Read-only: nothing is
   recorded and no card is marked seen. ── */
function AtipPreview({ lang = "th", S }) {
  const [seed, setSeed] = useState(0);
  const [picked, setPicked] = useState(null);
  const card = useMemo(
    () => pickTeachCard({ level: [0, 4, 9][seed % 3], struggleLabel: ["จังหวะ rhythm ไม่แม่น", "อ่านโน้ต sight reading ช้า", "สองมือ hands"][seed % 3], now: Date.now() + seed * 86400000 }),
    [seed]
  );
  const src = card ? cardSourceInfo(card) : null;
  const q = card && card.quiz ? card.quiz : null;
  const KC = {
    th: { t: "ตัวอย่างการ์ดที่นักเรียนเห็น", knowIt: "รู้ไว้ใช่ว่า", ok: "ถูกต้อง! ได้ +5 Gems (จ่ายจริงผ่าน RPC)", no: "ยังไม่ถูก — คำตอบคือ", src: "ที่มา", weak: "ท่อนชอรัสพลาดบ่อยที่โน้ต C และ F (62%)", next: "สุ่มโปรไฟล์ตัวอย่างใหม่", noCard: "ไม่มีการ์ดตรงเงื่อนไข" },
    en: { t: "What learners actually see", knowIt: "Did you know", ok: "Correct! +5 gems (paid via RPC)", no: "Not quite — the answer is", src: "Source", weak: "Chorus keeps missing C and F (62%)", next: "Shuffle sample profile", noCard: "No card matches" },
    zh: { t: "学生看到的卡片预览", knowIt: "你知道吗", ok: "答对了！+5 Gems（RPC 实发）", no: "还差一点——答案是", src: "来源", weak: "副歌常错 C 和 F（62%）", next: "换一个示例", noCard: "没有匹配的卡片" },
  }[lang] || {};
  return (
    <div style={S.card}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🎓 {KC.t}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        {TEACH_CARDS.length} {lang === "th" ? "การ์ดความรู้ในระบบ · ปรับได้ที่ tigamodel/knowledge/teach-cards.js" : lang === "zh" ? "张知识卡 · 可在 teach-cards.js 调整" : "knowledge cards · editable in tigamodel/knowledge/teach-cards.js"}
      </div>
      <div style={{ maxWidth: 420, margin: "0 auto", background: "var(--card,#fff)", border: "1px solid var(--bd2,rgba(0,0,0,0.08))", borderRadius: 16, padding: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <b style={{ fontSize: 13 }}>🎯 {lang === "th" ? "ครู TiGA แนะนำ" : lang === "zh" ? "TiGA老师建议" : "Coach TiGA's Tip"}</b>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>×</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{KC.weak}</div>
        <div style={{ margin: "8px 0 2px", borderRadius: 12, overflow: "hidden" }}>
          <TeachVisual type="mini-keyboard" data={{ miss: { C: 3, F: 1 } }} lang={lang} />
        </div>
        {card ? (
          <div style={{ margin: "10px 0 4px", padding: "10px 12px", borderRadius: 12, background: "var(--card2,rgba(0,0,0,0.03))", border: "1px solid var(--bd2,rgba(0,0,0,0.06))" }}>
            <b style={{ fontSize: 11.5, color: "var(--accent)" }}>💡 {KC.knowIt}</b>
            {card.diagram && <div style={{ margin: "6px 0 2px" }}><TeachVisual type={card.diagram.type} data={card.diagram} lang={lang} /></div>}
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{card.concept[lang] || card.concept.th}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>{card.why[lang] || card.why.th}</div>
            {q && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{q.q[lang] || q.q.th}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {q.choices.map((ch, i) => {
                    const revealed = picked !== null;
                    const isRight = i === q.correct;
                    return (
                      <button key={i} type="button" disabled={revealed} onClick={() => setPicked(i)} style={{ textAlign: "left", padding: "7px 10px", borderRadius: 9, border: "1px solid " + (revealed && isRight ? "rgba(34,197,94,0.5)" : "var(--bd2,rgba(0,0,0,0.1))"), background: revealed ? (isRight ? "rgba(34,197,94,0.16)" : picked === i ? "rgba(249,115,22,0.16)" : "transparent") : "transparent", color: "var(--text)", fontSize: 12, fontWeight: revealed && isRight ? 700 : 500, cursor: revealed ? "default" : "pointer" }}>
                        {String.fromCharCode(65 + i)}. {ch[lang] || ch.th}
                      </button>
                    );
                  })}
                </div>
                {picked !== null && (
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: picked === q.correct ? "var(--ok,#16a34a)" : "var(--accent)" }}>
                    {picked === q.correct ? KC.ok : `${KC.no} ${q.choices[q.correct][lang] || q.choices[q.correct].th}`}
                  </div>
                )}
              </div>
            )}
            {src && src.institution && (
              <a href={src.url} target="_blank" rel="noreferrer noopener" style={{ display: "inline-block", marginTop: 8, fontSize: 10.5, color: "var(--muted)", textDecoration: "underline" }}>📚 {KC.src}: {src.institution}</a>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "10px 0" }}>{KC.noCard}</div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => { setSeed(s => s + 1); setPicked(null); }} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--bd2,rgba(0,0,0,0.1))", background: "transparent", color: "var(--text)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>🎲 {KC.next}</button>
          <button type="button" style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: 0.7 }}>{lang === "th" ? "เข้าใจแล้ว ลองเลย" : lang === "zh" ? "知道了，试试看" : "Got it, let's try"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── EvidencePanel — plan v3 ระลอก 7 (7.2) — THE STRATEGY SCOREBOARD over
   REAL learner evidence. One row per strategy: n · win rate · mean before→
   after · mean delta, aggregated by strategyEvidenceFromRows from the REAL
   tg_atip_outcomes rows the auto-teaching closed loop already writes — this
   tab invents nothing of its own. The 7.2 gate is visible: n < 30 →
   "หลักฐานไม่พอ" (viewable, not decidable — honest-null, same rule as
   12.3/12.5). Lab itself sits behind the admin_tier ≥ 3 gate in App.tsx, so
   this surface is admin-only by construction (แผน 7.2: เห็นเฉพาะแอดมิน). ── */
function EvidencePanel({ lang, S, T }) {
  const [ev, setEv] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        await ensureTigamodelWeb();
        const m = getTigamodel();
        if (dead) return;
        setEv(m && m.learnerEvidenceNow ? m.learnerEvidenceNow() : null);
      } catch (e) { setEv(null); }
      if (!dead) setLoaded(true);
    })();
    return () => { dead = true; };
  }, []);
  const L = {
    th: { t: "หลักฐานจากผู้เรียนจริง — ต่อกลยุทธ์", sub: "รวมจากวงจรปิด Auto-Teaching (tg_atip_outcomes) บนเครื่องนี้ · n < 30 = ดูได้ ตัดสินไม่ได้", n: "จำนวนรอบจริง", win: "อัตราชนะ", after: "หลังเฉลี่ย", delta: "เปลี่ยนแปลงเฉลี่ย", enough: "ตัดสินได้", notEnough: "หลักฐานไม่พอ", empty: "ยังไม่มีหลักฐานจากผู้เรียนจริงบนเครื่องนี้ — วงจรปิด (ยิง tip → ซ้อม → เทียบผล) จะเขียนแถวหลักฐานเองตอนใช้งานจริง", unattr: "แถวที่ผูกกลยุทธ์ไม่ได้ (นับตรง ๆ ไม่เดาที่มา)", total: "แถวหลักฐานรวม", decidable: "กลยุทธ์ที่ตัดสินได้แล้ว", improved: "ดีขึ้น", worse: "แย่ลง", flat: "คงที่/ลอย" },
    en: { t: "Real learner evidence — per strategy", sub: "Aggregated from the Auto-Teaching closed loop (tg_atip_outcomes) on this device · n < 30 = viewable, not decidable", n: "real rounds", win: "win rate", after: "mean after", delta: "mean delta", enough: "decidable", notEnough: "not enough evidence", empty: "No real learner evidence on this device yet — the closed loop (tip fired → practice → outcome) writes it as the learner plays", unattr: "Rows without a strategy (counted honestly, never guessed)", total: "evidence rows", decidable: "decidable strategies", improved: "improved", worse: "worse", flat: "flat/floating" },
    zh: { t: "真实学习者证据——按策略", sub: "汇总自自动教学闭环（tg_atip_outcomes）本机数据 · n < 30 = 可查看，不能决策", n: "真实轮数", win: "胜率", after: "平均后测", delta: "平均变化", enough: "可决策", notEnough: "证据不足", empty: "本机尚无真实学习者证据——闭环（出提示 → 练习 → 比对结果）会在真实使用中自行写入", unattr: "无法归属策略的记录（如实计数，不猜测）", total: "证据记录", decidable: "可决策策略", improved: "变好", worse: "变差", flat: "持平/漂浮" },
  }[lang] || {};
  const rows = ev && ev.strategies ? ev.strategies : [];
  return (
    <div>
      <div style={S.card}>
        <div style={{ ...S.h2, marginBottom: 6 }}>🔍 {L.t}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>{L.sub}</div>
        {!loaded ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{T("กำลังอ่านหลักฐาน…", "Reading evidence…", "正在读取证据…")}</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>🕊 {L.empty}</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12.5, marginBottom: 10 }}>
              <span>{L.total}: <b>{ev.total}</b>{ev.unattributed ? ` · ${L.unattr}: ${ev.unattributed}` : ""}</span>
              <span>{L.decidable}: <b style={{ color: ev.strategiesDecidable > 0 ? S.good : S.warn }}>{ev.strategiesDecidable}</b>/{ev.strategiesWithEvidence}</span>
            </div>
            {rows.map(s => (
              <div key={s.strategyId} style={{ padding: "9px 0", borderBottom: "1px solid var(--bd1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <b style={{ fontSize: 13 }}>{s.strategyId}</b>
                  <span style={{ ...S.mono, fontSize: 11.5, color: s.enough ? S.good : S.warn }}>
                    {s.enough ? `✓ ${L.enough}` : `⏳ ${L.notEnough}`}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, marginTop: 3 }}>
                  <span>{L.n} <b>{s.n}</b></span>
                  <span>{L.win} <b style={{ color: (s.winRate || 0) >= 0.5 ? S.good : S.warn }}>{s.winRate != null ? Math.round(s.winRate * 100) + "%" : "—"}</b></span>
                  <span>{L.after} <b>{s.meanAfter != null ? s.meanAfter + "%" : "—"}</b></span>
                  <span>{L.delta} <b style={{ color: (s.meanDelta || 0) > 0 ? S.good : (s.meanDelta || 0) < 0 ? S.bad : "inherit" }}>{s.meanDelta != null ? (s.meanDelta > 0 ? "+" : "") + s.meanDelta : "—"}</b></span>
                  <span style={{ color: "var(--muted)", fontSize: 11.5 }}>▲{s.improved} ▼{s.worse} ·{s.flat}</span>
                </div>
                {!s.enough && s.enoughNote && <div style={{ ...S.mono, fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>{s.enoughNote[lang] || s.enoughNote.th}</div>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ── SpecialistPanel (Phase 5) — the live registry of TIGA MODEL specialists
   plus the honest readiness sweep. Specialists are deep engines for ONE
   topic domain, mounted in web.js via tigaHub.registerSpecialist; every
   topic-tagged intent consults them FIRST, so each new specialist upgrades
   the whole app with zero surface changes. The readiness table is the real
   capability-engine summary (t×m×s routes), not a claim. ── */
function SpecialistPanel({ lang, S, T }) {
  const status = tigaHub.status();
  const caps = tigaHub.summary().capabilities;
  let routes = null;
  try { routes = getCapabilityEngine().summary(); } catch (e) { routes = null; } // KB may still be building
  return (
    <div>
      <div style={S.card}>
        <div style={{ ...S.h2, marginBottom: 10 }}>🎛 {T("โมเดลเชี่ยวชาญที่ลงทะเบียนแล้ว", "Registered specialists", "已注册的专长模型")}</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12, lineHeight: 1.6 }}>
          {T("โมเดลเชี่ยวชาญ = เอนจินลึกหนึ่งหัวข้อ ถูกเรียกก่อนเอนจินทั่วไปในทุก intent ที่รู้หัวข้อ — เพิ่มตัวใหม่ได้ที่ tigamodel/web.js บรรทัดเดียว ทุกหน้าแอปฉลาดขึ้นทันทีโดยไม่แก้ UI",
             "A specialist is a deep engine for ONE topic domain, consulted FIRST by every topic-tagged intent. Adding one is a single registerSpecialist call in tigamodel/web.js — every screen benefits immediately with zero UI changes.",
             "专长模型 = 深耕单一主题的引擎，所有相关意图优先调用。在 tigamodel/web.js 一行注册即可，全部页面立即受益。")}
        </div>
        {status.specialists.length
          ? status.specialists.map(sp => (
              <div key={sp.topic} style={{ ...S.inner, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <b>{sp.topic}</b>
                  {sp.note && <div style={{ fontSize: 12, color: "var(--muted)" }}>{sp.note}</div>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "rgba(52,199,120,.15)", border: "1px solid rgba(52,199,120,.4)", color: "#4cd98a" }}>
                  {T("🟢 พร้อมใช้", "🟢 live", "🟢 生效")}
                </span>
              </div>
            ))
          : <div style={{ color: "var(--muted)" }}>{T("ยังไม่มี — ทุก intent ใช้เอนจินทั่วไป + baseline", "None yet — general engines + baseline serve all intents", "暂无 — 通用引擎+基线")}</div>}
      </div>
      <div style={S.card}>
        <div style={{ ...S.h2, marginBottom: 10 }}>🧭 {T("เส้นทางที่โมเดลตอบได้ (จากเอนจินจริง)", "What intents the hub serves (live)", "各意图服务状态（实时）")}</div>
        {caps.map(c => (
          <div key={c.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--bd1)" }}>
            <span>{c.name}</span>
            <span style={{ fontWeight: 700 }}>{c.status === "ready" ? "🟢 ready" : c.status === "partial" ? "🟡 partial" : "⚪ baseline"} · {c.score}%</span>
          </div>
        ))}
      </div>
      {routes && (
        <div style={S.card}>
          <div style={{ ...S.h2, marginBottom: 10 }}>⚡ {T("ความพร้อมรวม 1,000 เส้นทาง", "1,000-route readiness", "1000条路径就绪度")}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
            <span>🟢 {T("พร้อม", "ready", "就绪")} <b>{routes.ready}</b> ({routes.readyPct}%)</span>
            <span>🟡 {T("บางส่วน", "partial", "部分")} <b>{routes.partial}</b></span>
            <span>⚪ {T("ช่องว่าง", "gaps", "空白")} <b>{routes.gaps}</b></span>
            <span>📊 avg <b>{routes.avgScore}</b></span>
          </div>
          {routes.weakestCap && (
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--text2)" }}>
              🧩 {T("ความสามารถที่อ่อนที่สุด (ลำดับงานถัดไป):", "Weakest capability (next work item):", "最弱能力（下一步）：")} <b>{routes.weakestCap[0]}</b> ({Math.round(routes.weakestCap[1] * 100)}%)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── MeasurePanel — plan v3.5 6.14: THE ACCURACY DASHBOARD (owner: "สร้างฟีเจอร์
   วัดผลโมเดลไว้ใน TIGA MODEL LAB"). One screen answering: โมเดลวันนี้แม่นแค่ไหน
   และอ่อนตรงไหน — every number read from REAL state, never invented:
   • latest extended-eval run → overall + pass-rate per case family (bars)
   • regression verdict + stored baseline comparison
   • saved eval-run history (loadEvalRuns) with delta vs previous run
   • the 5 owner knowledge pillars (KB counts per domain) — ครบ 5 ด้าน
   • capability engine → READY routes / 1,000 + grid 1M progress
   Everything here is also reachable raw via the eval/selflearn/plan1m tabs;
   this panel is the owner's summary, not a second source of truth. ── */
const MEASURE_PILLARS = [
  { domain: "music-marketing", icon: "📣", th: "การตลาดดนตรี", en: "Music marketing", zh: "音乐营销" },
  { domain: "music-business", icon: "💼", th: "ธุรกิจดนตรี", en: "Music business", zh: "音乐商业" },
  { domain: "music-education-market", icon: "🏫", th: "ตลาดการเรียนดนตรี", en: "Education market", zh: "教育市场" },
  { domain: "music-innovation", icon: "💡", th: "นวัตกรรมดนตรี", en: "Music innovation", zh: "音乐创新" },
  { domain: "music-therapy", icon: "🌿", th: "ดนตรีบำบัด", en: "Music therapy", zh: "音乐治疗" },
];
function MeasurePanel({ lang, S, T }) {
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pillars, setPillars] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [grid, setGrid] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [joy, setJoy] = useState(null);
  const [risk, setRisk] = useState(null);
  const [joyEmptyLine, setJoyEmptyLine] = useState(null);
  const [riskNote, setRiskNote] = useState(null);
  const [bench, setBench] = useState(null);   // 13.4 — the latest bench snapshot (docs/tiga-bench-latest.json)

  useEffect(() => {
    setRuns(loadEvalRuns());
    setBaseline(loadEvalExtendedBaseline());
    /* 13.4 — the owner's "ล้านเท่า" card reads the bench snapshot itself (the
       bundle ships docs/*.json as assets), NOT a hand-copied number — the
       card can never drift from what the bench measured. */
    fetch("docs/tiga-bench-latest.json").then(r => (r.ok ? r.json() : null)).then(j => { if (j && j.grid) setBench(j); }).catch(() => {});
    (async () => {
      try {
        const kb = getKnowledgeBaseForTest();
        if (kb && kb._entries) {
          const all = Array.from(kb._entries.values());
          const ofDomain = (d) => all.filter(e => e.domain === d).length;
          setPillars(MEASURE_PILLARS.map(p => ({ ...p, count: ofDomain(p.domain) })));
          setGrid({ totalEntries: all.length });
        }
      } catch (e) {}
      try { setRoutes(capabilitySummary()); } catch (e) {}
      try { setGrid(g => ({ ...(g || {}), ...(plm1mStats() || {}) })); } catch (e) {}
    })();
  }, []);

  /* 12.3/12.5 — the shadow read comes from the SAME engine the app runs
     (ensureTigamodelWeb + getTigamodel, same as every other panel here);
     its own effect because the honest-null lines must follow the panel's
     language. Model absent → the card renders nothing (the standing honest
     null — no fake placeholder, no loader pretending work). */
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        await ensureTigamodelWeb();
        const m = getTigamodel();
        if (dead || !m || !m.getJoyIndex) return;
        const j = m.getJoyIndex(null);                 // self-read: the app's own localStorage logs
        const b = m.getBoredomRisk ? m.getBoredomRisk(null) : null;
        setJoy(j);
        setRisk(b);
        if (m.joyShadowEmpty) { const e = m.joyShadowEmpty(lang); if (e && e.line) setJoyEmptyLine(e.line); }
        if (b && b.enough === false) {
          if (b.enoughNote) setRiskNote(b.enoughNote[lang] || b.enoughNote.th);
          else if (m.joyShadowNote) { const n = m.joyShadowNote(lang); if (n) setRiskNote(n); }
        }
      } catch (e) { /* shadow read is best-effort — the rest of the panel still renders */ }
    })();
    return () => { dead = true; };
  }, [lang]);

  async function runNow() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const ext = await runExtendedEvalWithRegression();
      if (ext && ext.results) saveEvalRun({ results: ext.results, extended: true, verdict: ext.verdict });
      else {
        const tiga = getTigamodel();
        const results = await evaluateAllProviders(tiga.providers.list());
        saveEvalRun({ results });
      }
      setRuns(loadEvalRuns());
      setBaseline(loadEvalExtendedBaseline());
    } catch (e) { setErr(String(e?.message || e)); }
    setBusy(false);
  }

  const latest = runs[0] || null;
  const prev = runs[1] || null;
  const head = latest && latest.results && latest.results[0] || null;
  const prevHead = prev && prev.results && prev.results[0] || null;
  const famEntries = head && head.scores ? Object.entries(head.scores) : [];
  const famPass = famEntries.filter(([, v]) => v >= 1).length;
  const famPartial = famEntries.filter(([, v]) => v > 0 && v < 1).length;
  const famFail = famEntries.filter(([, v]) => !v).length;
  const delta = head && prevHead && typeof head.overall === "number" && typeof prevHead.overall === "number" ? head.overall - prevHead.overall : null;
  const barColor = (v) => v >= 1 ? S.good : v >= 0.5 ? S.warn : S.bad;

  return (
    <div>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <b style={{ fontSize: 15 }}>🎯 {T("ความแม่นยำล่าสุดของโมเดล", "Latest model accuracy", "模型最新准确度")}</b>
          <button style={S.btn} onClick={runNow} disabled={busy}>{busy ? T("กำลังประเมิน…", "Evaluating…", "评估中…") : T("▶ วัดผลใหม่ตอนนี้", "Measure now", "立即测量")}</button>
        </div>
        {!head && !busy && !err && (
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 14 }}>
            {T("ยังไม่มีผลวัด — กดวัดผลใหม่ได้เลย", "No measurement yet — run one", "暂无测量——立即运行")}
          </div>
        )}
        {err && <div style={{ color: S.bad, fontSize: 13, marginBottom: 8 }}>⚠️ {err}</div>}
        {head && (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: head.overall >= 0.8 ? S.good : head.overall >= 0.6 ? S.warn : S.bad }}>
                {(head.overall * 100).toFixed(0)}%
              </span>
              {delta != null && (
                <span style={{ fontSize: 14, fontWeight: 700, color: delta >= 0 ? S.good : S.bad }}>
                  {delta >= 0 ? "▲" : "▼"} {(delta * 100).toFixed(1)} {T("คะแนนจากรอบก่อน", "vs previous run", "对比上次")}
                </span>
              )}
              <span style={{ ...S.mono, color: "var(--muted)", fontSize: 12 }}>{head.provider} · {new Date(latest.saved_at).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, marginBottom: 12 }}>
              <span style={{ color: S.good }}>✓ {T("ผ่านเต็ม", "full pass", "满分")} <b>{famPass}</b>/{famEntries.length} {T("ตระกูล", "families", "族")}</span>
              <span style={{ color: S.warn }}>◐ {T("บางส่วน", "partial", "部分")} <b>{famPartial}</b></span>
              <span style={{ color: S.bad }}>✕ {T("ตก", "fail", "未过")} <b>{famFail}</b></span>
            </div>
            {famEntries.map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ width: 150, fontSize: 12, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k}>{k}</span>
                <div style={{ flex: 1, height: 8, background: "var(--bd1)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(3, Math.round(v * 100))}%`, height: "100%", background: barColor(v), borderRadius: 4 }} />
                </div>
                <span style={{ ...S.mono, width: 46, textAlign: "right", color: barColor(v) }}>{(v * 100).toFixed(0)}%</span>
              </div>
            ))}
            {latest.verdict && (
              <div style={{ ...S.inner, marginTop: 10, borderLeft: "3px solid " + (latest.verdict.verdict === "block" ? S.bad : latest.verdict.verdict === "warn" ? S.warn : S.good) }}>
                <b style={{ fontSize: 13 }}>{latest.verdict.verdict === "block" ? "🚨" : latest.verdict.verdict === "warn" ? "⚠️" : "✅"} {T("การตัดสินถดถอย", "Regression verdict", "回归判定")}: {latest.verdict.verdict}</b>
                <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 4 }}>{lang === "en" ? latest.verdict.message.en : latest.verdict.message.th}</div>
              </div>
            )}
            {baseline && baseline.overall != null && (
              <div style={{ ...S.mono, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                {T("ฐานเทียบ (baseline) บนเครื่องนี้:", "Baseline on this device:", "本机基线：")} {(baseline.overall * 100).toFixed(0)}%
              </div>
            )}
          </>
        )}
      </div>

      <div style={S.card}>
        <div style={{ ...S.h2, marginBottom: 10 }}>📚 {T("ขุมความรู้ 5 ด้านของ owner — ครบหรือยัง", "The owner's 5 knowledge pillars — coverage", "五大知识支柱——覆盖")}</div>
        {pillars && pillars.map(p => (
          <div key={p.domain} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--bd1)" }}>
            <span style={{ fontSize: 13.5 }}>{p.icon} {lang === "en" ? p.en : lang === "zh" ? p.zh : p.th}</span>
            <span style={{ ...S.mono, fontSize: 13, color: p.count > 0 ? "var(--text)" : S.bad }}>
              {p.count > 0 ? `✓ ${p.count} entries` : "✕ 0"}
            </span>
          </div>
        ))}
        {grid && grid.totalEntries != null && (
          <div style={{ ...S.mono, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            {T("KB รวมทุกโดเมน:", "KB all domains:", "全部知识域：")} <b>{grid.totalEntries.toLocaleString()}</b> entries
          </div>
        )}
      </div>

      {/* ── plan v3.8 ระลอก 12 (12.3/12.5) — JOY & BOREDOM, the shadow read of
          THIS device's real logs. Model-Lab-ONLY surface (plan 12.3): the
          learner never sees a risk score. Every number traces to the log
          field its evidence line names; no practice at all → honest-null
          line; n < 30 loop rounds → enough:false = observation only, never
          a decision input (the 7.2 rule, gate opens at 12.6). ── */}
      <div style={S.card}>
        <div style={{ ...S.h2, marginBottom: 10 }}>💛 {T("ความสุข & ความเสี่ยงท้อ (เงา — จาก log จริง)", "Joy & boredom risk (shadow — from real logs)", "快乐与倦怠风险（影子——来自真实记录）")}</div>
        {joy && joy.score != null ? (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 800 }}>{joy.score}<span style={{ fontSize: 15, color: "var(--muted)" }}>/5</span></span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{T("สัญญาณความสุขวันนี้ (0 = ยังไม่ยิงสักข้อ)", "joy signals today (0 = none fired yet)", "今日快乐信号（0 = 尚未触发）")}</span>
              {joy.enough === false && <span style={{ ...S.mono, fontSize: 11.5, color: S.warn }}>⏳ {T("ยังไม่ครบ 30 รอบวงล้อ — สังเกตอย่างเดียว", "under 30 loop rounds — observation only", "未满30轮循环——仅观察")}</span>}
            </div>
            {joy.evidence.map(e => (
              <div key={e.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--bd1)" }}>
                <span style={{ fontSize: 12.5 }}>
                  {e.fired ? "✓" : "·"} {lang === "en" ? e.label.en : lang === "zh" ? e.label.zh : e.label.th}
                  <span style={{ ...S.mono, fontSize: 10.5, color: "var(--muted)", display: "block" }}>{e.source}</span>
                </span>
                <span style={{ ...S.mono, fontSize: 12.5, color: e.fired ? S.good : "var(--muted)" }}>{e.fired ? T("ยิง", "fired", "触发") : "—"}</span>
              </div>
            ))}
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--muted)", padding: "6px 0" }}>🕊 {joyEmptyLine || T("ยังไม่มีหลักฐานเพียงพอ", "Not enough evidence yet", "证据不足")}</div>
        )}
        {risk && risk.score != null && (
          <>
            <div style={{ ...S.h2, margin: "14px 0 8px", fontSize: 14 }}>🌊 {T("ความเสี่ยงท้อ — 14 วันล่าสุด (จำแนกตามสาเหตุการเลิกเรียน KB 6.8)", "Boredom risk — last 14 days (classified by KB 6.8 quit causes)", "倦怠风险——近14天（按KB 6.8退课原因分类）")}</div>
            {risk.enough === false && <div style={{ ...S.mono, fontSize: 11.5, color: S.warn, marginBottom: 6 }}>⏳ {riskNote || T("ยังเก็บข้อมูลไม่ครบ 30 รอบวงล้อ — สังเกตอย่างเดียว", "Fewer than 30 loop rounds — observation only", "未满30轮循环——仅观察")}</div>}
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: risk.count >= 2 ? S.bad : risk.count === 1 ? S.warn : S.good }}>{risk.count}<span style={{ fontSize: 13, color: "var(--muted)" }}>/4</span></span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{T("ซ้อมจริง", "practice days", "练习天数")} {risk.practicedDays14} {T("วันในหน้าต่าง 14 วัน", "days in the 14-day window", "天在14天窗口内")}</span>
            </div>
            {risk.evidence.map(e => (
              <div key={e.key} style={{ padding: "5px 0", borderBottom: "1px solid var(--bd1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 12.5 }}>{e.fired ? "⚠️" : "·"} {lang === "en" ? e.label.en : lang === "zh" ? e.label.zh : e.label.th}</span>
                  <span style={{ ...S.mono, fontSize: 10.5, color: "var(--muted)" }}>{e.kb}</span>
                </div>
                {e.fired && <span style={{ ...S.mono, fontSize: 10.5, color: "var(--muted)", display: "block" }}>{e.source}</span>}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── plan v3.8 ระลอก 13 (13.4) — THE OWNER'S "ล้านเท่า" CARD. One glance:
          รอบวงล้อที่ N · กริด x% · weakest ขุมไหน · KB vs latency — every
          number read verbatim from the latest bench snapshot (never copied
          by hand → การ์ดตัวเลขเป๊ะกับ bench by construction). No snapshot
          (fresh clone / fetch failed) → the card stays hidden: no invented
          zero, no placeholder pretending data exists. ── */}
      {bench && bench.grid && (
        <div style={S.card}>
          <div style={{ ...S.h2, marginBottom: 10 }}>🧭 {T("ความคืบหน้าล้านเท่า — จาก bench ล่าสุด", "Million-fold progress — from the latest bench", "百万倍进度——来自最新基准")}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 800 }}>{bench.loopRound ?? 1}<span style={{ fontSize: 14, color: "var(--muted)" }}> {T("รอบวงล้อ", "loop round", "轮循环")}</span></span>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{bench.grid.startedPct ?? "?"}%<span style={{ fontSize: 14, color: "var(--muted)" }}> {T("กริดเริ่มแล้ว", "grid started", "网格已开始")}</span></span>
            {bench.perf && bench.perf.kbProbeMs != null && (
              <span style={{ ...S.mono, fontSize: 12.5, color: "var(--muted)" }}>KB {((bench.bundle && bench.bundle.tigamodelMinifiedBytes) || 0) > 0 ? Math.round((bench.bundle.tigamodelMinifiedBytes || 0) / 1024).toLocaleString() + " kB" : "—"} · {bench.perf.kbProbeMs} ms</span>
            )}
          </div>
          {bench.pillars && bench.pillars.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {bench.pillars.map((p, i) => (
                <div key={p.domain} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--bd1)" }}>
                  <span style={{ fontSize: 12.5 }}>{i === 0 ? "🔻" : "·"} {p.icon} {lang === "en" ? p.en : lang === "zh" ? p.zh : p.th}</span>
                  <span style={{ ...S.mono, fontSize: 12, color: i === 0 ? S.warn : "var(--muted)" }}>
                    {p.entries}/{p.min} · {Math.round((p.score || 0) * 100)}%{i === 0 ? " — " + T("อ่อนที่สุด", "weakest", "最弱") : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          {bench.generatedAt && <div style={{ ...S.mono, fontSize: 11, color: "var(--muted)", marginTop: 8 }}>{T("bench:", "bench:", "基准：")} {new Date(bench.generatedAt).toLocaleString()}{bench.barsOk === false ? " ⚠️" : " ✓"}</div>}
        </div>
      )}

      {routes && (
        <div style={S.card}>
          <div style={{ ...S.h2, marginBottom: 10 }}>⚡ {T("ความพร้อมโมเดล 1,000 เส้นทาง", "1,000-route readiness", "1000条路径就绪度")}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
            <span>🟢 {T("พร้อม", "ready", "就绪")} <b>{routes.ready}</b> ({routes.readyPct}%)</span>
            <span>🟡 {T("บางส่วน", "partial", "部分")} <b>{routes.partial}</b></span>
            <span>⚪ {T("ช่องว่าง", "gaps", "空白")} <b>{routes.gaps}</b></span>
            <span>📊 avg <b>{routes.avgScore}</b></span>
          </div>
        </div>
      )}

      {grid && grid.startedPct != null && (
        <div style={S.card}>
          <div style={{ ...S.h2, marginBottom: 10 }}>🧭 {T("กริด 1M — เดินแล้ว", "1M grid progress", "百万网格进度")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{grid.startedPct}%</span>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>{(grid.started || 0).toLocaleString()} / {(grid.total || 0).toLocaleString()} specs</span>
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ ...S.h2, marginBottom: 10 }}>🕘 {T("ประวัติการวัด (เทียบก่อน/หลังสลับโมเดล)", "Measurement history (compare before/after model switch)", "测量历史（换模型前后对比）")}</div>
        {runs.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 12 }}>{T("ยังไม่มีประวัติ", "No history yet", "暂无历史")}</div>}
        {runs.slice(0, 8).map((r, i) => {
          const rh = r.results && r.results[0];
          const rPrev = runs[i + 1] && runs[i + 1].results && runs[i + 1].results[0];
          const d = rh && rPrev && typeof rh.overall === "number" && typeof rPrev.overall === "number" ? rh.overall - rPrev.overall : null;
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--bd1)" }}>
              <span style={{ ...S.mono, fontSize: 12 }}>{new Date(r.saved_at).toLocaleString()}{r.extended ? " · extended" : ""}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                {d != null && <span style={{ fontSize: 12, fontWeight: 700, color: d >= 0 ? S.good : S.bad }}>{d >= 0 ? "▲" : "▼"}{(d * 100).toFixed(1)}</span>}
                <b style={{ fontSize: 14, color: rh && rh.overall >= 0.8 ? S.good : rh && rh.overall >= 0.6 ? S.warn : S.bad }}>{rh ? (rh.overall * 100).toFixed(0) + "%" : "—"}</b>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
