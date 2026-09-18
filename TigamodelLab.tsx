import { useState, useEffect, useRef } from "react";
import { ensureTigamodelWeb, getTigamodel, evaluateAllProviders, createTeachingPolicy, createTeachingLoop, getUniversitySources, appendChatSession, saveEvalRun, getSelfLearner, isSelfLearningEnabled, setSelfLearningEnabled } from "./tigamodel/web.js";
import { ROADMAP_GROUPS, ROADMAP_STATUS, roadmapProgress } from "./tigamodel/roadmap-100.js";
import { KnowledgeGraphView } from "./tigamodel-lab-graph.tsx";
import { sb } from "./supabase-client";
import { AI_PROVIDERS } from "./AdminAIModels";

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
      const tiga = getTigamodel();
      const results = await evaluateAllProviders(tiga.providers.list());
      setEvalResults(results);
      saveEvalRun({ results }); // visible in the Back Office eval history
    } catch (e) {
      setEvalErr(String(e?.message || e));
    }
    setEvalBusy(false);
  }

  function runLoop() {
    if (!loopRef.current) return;
    const out = loopRef.current.runOnce({
      practiceStats: { accuracy: acc, repeatedErrors: repeats, pauses, rhythmScore: Math.max(20, 100 - repeats * 12) },
      selfReport: selfReport || null,
    });
    setLoopOut(out);
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
        <button style={S.chip(tab === "loop")} onClick={() => setTab("loop")}>🔁 {T("จำลองวงจรสอน", "Teaching loop", "教学循环")}</button>
        <button style={S.chip(tab === "kb")} onClick={() => setTab("kb")}>📚 {T("ความรู้", "Knowledge", "知识")}</button>
        <button style={S.chip(tab === "map")} onClick={() => setTab("map")}>🕸 {T("แผนที่ความรู้", "Knowledge map", "知识图谱")}</button>
        <button style={S.chip(tab === "selflearn")} onClick={() => setTab("selflearn")}>🧬 {T("เรียนรู้เอง", "Self-learning", "自我学习")}</button>
        <button style={S.chip(tab === "roadmap")} onClick={() => setTab("roadmap")}>🗺 {T("แผน 100 สิ่ง", "100-item plan", "百项计划")}</button>
      </div>

      {!ready && <div style={S.card}>{T("กำลังเริ่มระบบ…", "Starting…", "启动中…")}</div>}

      {ready && tab === "kb" && <KnowledgePanel lang={lang} S={S} />}

      {ready && tab === "map" && <KnowledgeGraphView lang={lang} S={S} />}

      {ready && tab === "selflearn" && slOn !== null && (
        <SelfLearningPanel lang={lang} S={S} T={T} on={slOn} snap={slSnap} busy={slBusy}
          msg={slMsg} onToggle={toggleSelfLearn} onRemove={slRemove} onClear={slClear} />
      )}

      {ready && tab === "roadmap" && <RoadmapPanel lang={lang} S={S} T={T} />}

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

      {ready && tab === "eval" && (
        <div style={S.card}>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
            {T("รันชุดประเมินกับทุก provider ที่ลงทะเบียน — ห้ามเชื่อโมเดลใหม่ก่อนดูคะแนนที่นี่", "Runs the eval suite against every registered provider — never trust a new model before this table", "对每个已注册提供方运行评估 — 换模型前先看这张表")}
          </div>
          <button style={S.btn} onClick={runEval} disabled={evalBusy}>{evalBusy ? T("กำลังประเมิน…", "Evaluating…", "评估中…") : T("▶ รันประเมิน", "Run eval", "运行评估")}</button>
          {evalErr && <div style={{ color: S.bad, marginTop: 10, fontSize: 13 }}>{evalErr}</div>}
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
function RoadmapPanel({ lang, S, T }) {
  const prog = roadmapProgress();
  const [openGroup, setOpenGroup] = useState("F"); // default open the loop group (most ⭐⭐⭐ done/next)
  const starStr = (n) => "⭐".repeat(n);
  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {T(
          "แผนพัฒนา 100 สิ่ง — ทุกข้อคือสิ่งที่ครูเปียโนระดับโลกทำได้ และโมเดลนี้ต้องทำได้ ⭐⭐⭐ = ทำก่อน (เพิ่มความฉลาดเร็วสุด) · เข็มขัดสถานะอัปเดตจากโค้ดจริง",
          "The 100-item plan — every item is something a world-class human piano teacher can do, so this model must too. ⭐⭐⭐ = do first. Status chips reflect real code state.",
          "百项发展计划——每项都是世界级人类钢琴老师能做到的事。⭐⭐⭐=优先做。状态反映真实代码状态。"
        )}
      </div>
      {/* progress bar */}
      <div style={{ ...S.inner, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text)", marginBottom: 6 }}>
          <b>{T("ความคืบหน้า", "Progress", "进度")}</b>
          <span style={S.mono}>{prog.done + prog.partial}/{prog.total}</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--bd1)", overflow: "hidden", display: "flex" }}>
          <div style={{ width: (prog.done / prog.total * 100) + "%", background: "var(--ok, #3f9d63)" }} />
          <div style={{ width: (prog.partial / prog.total * 100) + "%", background: "var(--warn, #b8860b)" }} />
        </div>
        <div style={{ ...S.mono, marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: ROADMAP_STATUS.done.color }}>■ {ROADMAP_STATUS.done[lang] || ROADMAP_STATUS.done.en} {prog.done}</span>
          <span style={{ color: ROADMAP_STATUS.partial.color }}>■ {ROADMAP_STATUS.partial[lang] || ROADMAP_STATUS.partial.en} {prog.partial}</span>
          <span style={{ color: "var(--muted)", marginLeft: "auto" }}>{T("ทำก่อน (⭐⭐⭐) ค้าง", "priority (⭐⭐⭐) left", "优先（⭐⭐⭐）剩余")}: {prog.nextSprint}</span>
        </div>
      </div>
      {ROADMAP_GROUPS.map(g => {
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
                  return (
                    <div key={it.n} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", borderTop: "1px solid var(--bd1)" }}>
                      <span style={{ ...S.mono, minWidth: 28, color: "var(--muted)" }}>{it.n}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, color: "var(--text)" }}>{lang === "en" ? it.en : it.th}</div>
                        <div style={{ fontSize: 11.5, marginTop: 2 }}>{it.stars > 0 && <span>{starStr(it.stars)}</span>}{it.gated ? <span style={{ color: S.warn }}> 🔒</span> : null}</div>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: st.color, whiteSpace: "nowrap" }}>{st[lang] || st.en}</span>
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
