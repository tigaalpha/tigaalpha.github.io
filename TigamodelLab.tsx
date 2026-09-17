import { useState, useEffect, useRef } from "react";
import { ensureTigamodelWeb, getTigamodel, evaluateAllProviders, createTeachingPolicy, createTeachingLoop, getUniversitySources } from "./tigamodel/web.js";

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
   BOTH light and dark themes, exactly like every other admin page. ── */

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

  // chat panel
  const [prompt, setPrompt] = useState("");
  const [taskType, setTaskType] = useState("chat");
  const [chatRows, setChatRows] = useState([]);
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
        q: t, a: response.text || T("(ไม่มีข้อความตอบกลับ)", "(empty reply)", "(无回复)"),
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
      </div>

      {!ready && <div style={S.card}>{T("กำลังเริ่มระบบ…", "Starting…", "启动中…")}</div>}

      {ready && tab === "kb" && <KnowledgePanel lang={lang} S={S} />}

      {ready && tab === "chat" && (
        <div style={S.card}>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
            {T("ข้อความเดินทางจริงผ่าน: router → piano-chat → โมเดลที่ตั้งไว้ในแท็บโมเดล AI", "Real path: router → piano-chat → your configured model", "真实路径：路由 → piano-chat → 已配置模型")}
          </div>
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

/* ── Knowledge panel: university-sourced entries + their real source links ── */
function KnowledgePanel({ lang, S }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const tiga = getTigamodel();
  const { sources } = getUniversitySources();
  const [openId, setOpenId] = useState(null);
  if (!tiga || !tiga.kb) return null;
  const entries = Array.from(tiga.kb._entries.values()).filter(e => e.source && sources[e.source]);
  const bySource = {};
  entries.forEach(e => { (bySource[e.source] = bySource[e.source] || []).push(e); });

  return (
    <div>
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
