import { useState, useEffect, useRef } from "react";
import { ensureTigamodelWeb, getTigamodel, evaluateAllProviders, createTeachingPolicy, createTeachingLoop } from "./tigamodel/web.js";

/* ── TigamodelLab.tsx ──
   Admin-only "TIGA Model Lab" (tab: tigamodel, tier >= 3): the owner's
   hands-on surface for the tigamodel/ intelligence layer built this session.

   Three panels:
   1. ทดสอบแชท — send a message through the REAL routing path (router →
      existing-backend adapter → piano-chat edge function → whatever model
      the admin configured for that feature). Provider/model/latency shown
      per reply. Falls back to mock when signed-out session is missing, and
      the panel labels which provider actually answered (never lies).
   2. ประเมินโมเดล (eval) — runs evaluation/eval-suite.js against every
      registered provider and renders the score table. Deterministic,
      no network for mock; real calls for existing-backend.
   3. จำลองวงจรสอน — teaching-loop simulator: feed practice stats
      (accuracy / repeated errors / pauses / self-report) → see the state
      estimates (probability+evidence), diagnosis, selected strategy and
      the composed message. Rule-based — runs instantly, no model call.

   Styling reuses the admin console classes (adminpage-era cards) so it
   looks native inside the existing console. ── */

export function TigamodelLab({ lang = "th" }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);

  const [tab, setTab] = useState("chat");
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState("");

  // chat panel
  const [prompt, setPrompt] = useState("");
  const [taskType, setTaskType] = useState("chat");
  const [chatRows, setChatRows] = useState([]); // {q, a, provider, latency, status}
  const [chatBusy, setChatBusy] = useState(false);

  // eval panel
  const [evalBusy, setEvalBusy] = useState(false);
  const [evalResults, setEvalResults] = useState(null);
  const [evalErr, setEvalErr] = useState("");

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
    return () => { alive = false; };
  }, []);

  async function sendPrompt() {
    const t = prompt.trim();
    if (!t || chatBusy) return;
    setChatBusy(true);
    const tiga = getTigamodel();
    try {
      const t0 = performance.now();
      const { response, routed } = await tiga.chat({ message: t, taskType });
      const latency = Math.round(performance.now() - t0);
      setChatRows(rows => [...rows.slice(-9), {
        q: t, a: response.text || (T("(ไม่มีข้อความตอบกลับ)", "(empty reply)", "(无回复)")),
        provider: routed.selected_provider || "—",
        model: response.model || "",
        latency, status: response.status,
        attempts: routed.attempts,
      }]);
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

  const card = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, marginBottom: 14 };
  const btn = { padding: "9px 16px", borderRadius: 10, border: "none", background: "#d97757", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" };
  const btnGhost = { ...btn, background: "transparent", border: "1px solid rgba(255,255,255,0.25)" };
  const input = { flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.25)", color: "#fff", fontSize: 14 };
  const chip = (on) => ({ padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? "#d97757" : "rgba(255,255,255,0.2)"), background: on ? "rgba(217,119,87,0.18)" : "transparent", color: "#fff", fontSize: 12.5, cursor: "pointer" });
  const mono = { fontFamily: "ui-monospace, monospace", fontSize: 12.5, color: "rgba(255,255,255,0.75)" };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "10px 4px 40px" }}>
      <div style={{ textAlign: "center", margin: "8px 0 18px" }}>
        <div style={{ fontSize: 34 }}>🧪</div>
        <div style={{ fontSize: 21, fontWeight: 800 }}>TIGA Model Lab</div>
        <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 4 }}>
          {T("ชั้นปัญญาการสอนเปียโน — ทดสอบโมเดล ประเมินคุณภาพ จำลองวงจรสอน", "Piano teaching intelligence — test models, run evals, simulate the teaching loop", "钢琴教学智能 — 测试模型、评估、模拟教学循环")}
          {ready && <span style={mono}> · v{version}</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
        <button style={chip(tab === "chat")} onClick={() => setTab("chat")}>💬 {T("ทดสอบแชท", "Chat test", "聊天测试")}</button>
        <button style={chip(tab === "eval")} onClick={() => setTab("eval")}>📊 {T("ประเมินโมเดล", "Eval", "评估")}</button>
        <button style={chip(tab === "loop")} onClick={() => setTab("loop")}>🔁 {T("จำลองวงจรสอน", "Teaching loop", "教学循环")}</button>
      </div>

      {!ready && <div style={card}>{T("กำลังเริ่มระบบ…", "Starting…", "启动中…")}</div>}

      {ready && tab === "chat" && (
        <div style={card}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>
            {T("ข้อความเดินทางจริงผ่าน: router → piano-chat → โมเดลที่ตั้งไว้ในแท็บโมเดล AI", "Real path: router → piano-chat → your configured model", "真实路径：路由 → piano-chat → 已配置模型")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {["chat", "coach-tip", "practice-plan", "diagnose"].map(t => (
              <button key={t} style={chip(taskType === t)} onClick={() => setTaskType(t)}>{t}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={input} value={prompt} placeholder={T("พิมพ์ข้อความทดสอบ…", "Type a test message…", "输入测试消息…")}
              onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && sendPrompt()} />
            <button style={btn} onClick={sendPrompt} disabled={chatBusy}>{chatBusy ? "…" : "➤"}</button>
          </div>
          {chatRows.map((r, i) => (
            <div key={i} style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.22)" }}>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>🧑 {r.q}</div>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>🤖 {r.a}</div>
              <div style={{ ...mono, marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>provider: <b style={{ color: r.provider === "existing-backend" ? "#4ade80" : "#ffd23f" }}>{r.provider}</b></span>
                {r.model && <span>model: {r.model}</span>}
                <span>{r.latency}ms</span>
                <span>status: {r.status}</span>
              </div>
            </div>
          ))}
          {chatRows.length === 0 && <div style={{ textAlign: "center", opacity: 0.4, fontSize: 13, padding: 18 }}>{T("ยังไม่มีข้อความ", "No messages yet", "暂无消息")}</div>}
        </div>
      )}

      {ready && tab === "eval" && (
        <div style={card}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>
            {T("รันชุดประเมินกับทุก provider ที่ลงทะเบียน — ห้ามเชื่อโมเดลใหม่ก่อนดูคะแนนที่นี่", "Runs the eval suite against every registered provider — never trust a new model before this table", "对每个已注册提供方运行评估 — 换模型前先看这张表")}
          </div>
          <button style={btn} onClick={runEval} disabled={evalBusy}>{evalBusy ? T("กำลังประเมิน…", "Evaluating…", "评估中…") : T("▶ รันประเมิน", "Run eval", "运行评估")}</button>
          {evalErr && <div style={{ color: "#f87171", marginTop: 10, fontSize: 13 }}>{evalErr}</div>}
          {evalResults && (
            <div style={{ marginTop: 14 }}>
              {evalResults.map(r => (
                <div key={r.provider} style={{ padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.22)", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b style={{ fontSize: 15 }}>{r.provider}</b>
                    <span style={{ fontSize: 18, fontWeight: 800, color: r.overall >= 0.8 ? "#4ade80" : r.overall >= 0.6 ? "#ffd23f" : "#f87171" }}>
                      {(r.overall * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ ...mono, marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    {Object.entries(r.scores).map(([k, v]) => (
                      <span key={k} style={{ color: v >= 1 ? "#4ade80" : v >= 0.5 ? "#ffd23f" : "#f87171" }}>{k}: {v}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ready && tab === "loop" && (
        <div style={card}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>
            {T("จำลองสัญญาณการซ้อมจริง → ดูสถานะนักเรียน (probability+evidence) การวินิจฉัย และกลยุทธ์ที่เลือก — ไม่ยิงโมเดล", "Simulate practice signals → see student states (probability+evidence), diagnosis, chosen strategy — no model call", "模拟练习信号 → 查看学生状态、诊断与策略 — 不调用模型")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>ความแม่นยำ: <b>{acc}%</b>
              <input type="range" min="0" max="100" value={acc} onChange={e => setAcc(+e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 13 }}>พลาดซ้ำ: <b>{repeats}</b>
              <input type="range" min="0" max="6" value={repeats} onChange={e => setRepeats(+e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 13 }}>หยุดกลางทาง: <b>{pauses}</b>
              <input type="range" min="0" max="8" value={pauses} onChange={e => setPauses(+e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 13 }}>นักเรียนบอกว่า:
              <select value={selfReport} onChange={e => setSelfReport(e.target.value)} style={{ ...input, width: "100%", marginTop: 4 }}>
                <option value="">— {T("ไม่ระบุ", "none", "无")} —</option>
                <option value="too_easy">{T("ง่ายไป", "too easy", "太简单")}</option>
                <option value="too_hard">{T("ยากไป", "too hard", "太难")}</option>
              </select>
            </label>
          </div>
          <button style={btn} onClick={runLoop}>{T("▶ รันวงจร", "Run loop", "运行循环")}</button>
          {loopOut && (
            <div style={{ marginTop: 12 }}>
              <div style={{ padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.22)", marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>{T("สถานะนักเรียน (ประมาณการ)", "Student states (estimates)", "学生状态（估计）")}</b>
                {loopOut.states.length === 0 && <div style={mono}>{T("ไม่มีสัญญาณเพียงพอ — ระบบไม่เดา (ตามหลัก observation≠inference)", "insufficient signal — no guessing", "信号不足 — 不猜测")}</div>}
                {loopOut.states.map((s, i) => (
                  <div key={i} style={{ ...mono, marginTop: 6 }}>
                    <b style={{ color: "#ffd23f" }}>{s.state}</b> p={s.probability.toFixed(2)} conf={s.confidence.toFixed(2)}
                    <div style={{ opacity: 0.75 }}>หลักฐาน: {s.evidence.join("; ")}</div>
                    {s.alternative_explanations.length > 0 && <div style={{ opacity: 0.55 }}>สมมติฐานอื่น: {s.alternative_explanations.join("; ")}</div>}
                  </div>
                ))}
              </div>
              <div style={{ padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.22)", marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>{T("การวินิจฉัย", "Diagnosis", "诊断")}</b>
                {loopOut.diagnosis.issues.length === 0 && <div style={mono}>—</div>}
                {loopOut.diagnosis.issues.map((d, i) => <div key={i} style={mono}>• {d.code} — {d.detail} (conf {d.confidence.toFixed(2)})</div>)}
              </div>
              <div style={{ padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.22)", marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>{T("กลยุทธ์ที่เลือก", "Selected strategy", "所选策略")}</b>
                <div style={mono}>{loopOut.decision.strategy_id}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{loopOut.decision.rationale}</div>
                {loopOut.decision.actions.length > 0 && <div style={mono}>actions: {loopOut.decision.actions.join(" → ")}</div>}
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: "rgba(217,119,87,0.12)", border: "1px solid rgba(217,119,87,0.35)" }}>
                <b style={{ fontSize: 13 }}>🤖 {T("ข้อความที่จะแสดงนักเรียน", "Message the student would see", "学生将看到的消息")}</b>
                <div style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap" }}>{loopOut.response.text}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
