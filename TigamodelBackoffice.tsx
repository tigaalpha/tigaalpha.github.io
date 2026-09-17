import { useState, useEffect, useCallback } from "react";
import { sb } from "./supabase-client";
import { playUi } from "./music-engine";
import { AI_PROVIDERS, AI_FEATURES } from "./AdminAIModels";
import { ensureTigamodelWeb, getTigamodel, evaluateAllProviders, loadChatSessions, deleteChatSession, clearChatSessions, loadEvalRuns, clearEvalRuns } from "./tigamodel/web.js";

/* ── TigamodelBackoffice.tsx ──
   TIGA's own back office (แยกจากหลังบ้านทั่วไปของแอป): the single surface
   for managing the tigamodel/ intelligence layer.

   1) 🧠 โมเดลพื้นฐาน — shows the CURRENT foundation model every task type
      resolves to right now (same resolution order the piano-chat edge
      function runs: ai_models[feature] → ai_models["default"] → legacy
      ai_model → built-in), and switches ANY of them to any model on the
      shelf (incl. free-text model id for new releases — GPT-6 etc. land by
      typing the id, no code change).
   2) 💬 ประวัติทดสอบแชท — past Model Lab test sessions with provider/model/
      latency, replayable.
   3) 📊 ประวัติประเมิน — saved eval runs, before/after model switches.

   THEME: reads the app's CSS variables (--text/--card/--bd1..) — correct in
   both light and dark (the Model Lab's first version shipped white-on-white
   on iPad; not repeating that). ── */

const BUILTIN_DEFAULT = { provider: "anthropic", model: "claude-sonnet-4-6" };
// piano-chat's built-in for the chat feature while ai_models["chat"] is empty
const CHAT_BUILTIN = { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" };

function providerLabel(p) {
  const P = AI_PROVIDERS[p];
  return P ? `${P.icon} ${P.label}` : p;
}
function providerIcon(p) { const P = AI_PROVIDERS[p]; return P ? P.icon : "❓"; }

/* Every task type the lab/backoffice can route (the app feature set that
   flows through piano-chat; TTS excluded — not a text model). */
const TASK_TYPES = [
  { id: "chat", icon: "💬", th: "แชททดสอบ (Lab)", en: "Lab chat test", zh: "实验室聊天" },
  ...AI_FEATURES.filter(f => !f.tts).map(f => ({ id: f.id, icon: f.icon, th: f.th, en: f.en, zh: f.zh })),
];

export function TigamodelBackoffice({ lang = "th" }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);

  const S = {
    card: { background: "var(--card)", border: "1px solid var(--bd2)", borderRadius: 14, padding: 16, marginBottom: 14 },
    inner: { background: "var(--card2)", border: "1px solid var(--bd1)", borderRadius: 12, padding: 12 },
    btn: { padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent, #d97757)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
    btnGhost: { padding: "8px 14px", borderRadius: 10, border: "1px solid var(--bd3)", background: "transparent", color: "var(--text)", fontWeight: 600, fontSize: 13, cursor: "pointer" },
    chip: (on) => ({
      padding: "6px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer",
      border: "1px solid " + (on ? "var(--accent, #d97757)" : "var(--bd3)"),
      background: on ? "color-mix(in srgb, var(--accent, #d97757) 14%, var(--card))" : "var(--card)",
      color: "var(--text)", fontWeight: on ? 700 : 500,
    }),
    mono: { fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 12.5, color: "var(--text2)" },
    input: { padding: "9px 12px", borderRadius: 10, border: "1px solid var(--bd3)", background: "var(--card2)", color: "var(--text)", fontSize: 14, width: "100%", boxSizing: "border-box" },
    good: "var(--ok, #3f9d63)",
    warn: "var(--warn, #b8860b)",
    bad: "var(--bad, #c4423a)",
  };

  const [tab, setTab] = useState("models");
  const [cfg, setCfg] = useState(null);       // ai_models map (saved, server truth)
  const [drafts, setDrafts] = useState({});   // taskType → {provider, model}
  const [busyKey, setBusyKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [err, setErr] = useState("");
  const [version, setVersion] = useState("");

  const load = useCallback(() => {
    Promise.all([
      sb.from("app_settings").select("value").eq("key", "ai_models").maybeSingle(),
      sb.from("app_settings").select("value").eq("key", "ai_model").maybeSingle(),
    ]).then(([r1, r2]) => {
      const map = (r1 && r1.data && r1.data.value && typeof r1.data.value === "object") ? r1.data.value : {};
      const legacy = (r2 && r2.data && r2.data.value && r2.data.value.provider && r2.data.value.model) ? r2.data.value : null;
      const merged = { ...map };
      if (!merged.default && legacy) merged.default = legacy;
      if (!merged.default) merged.default = BUILTIN_DEFAULT;
      setCfg(merged);
      const d = {};
      for (const t of TASK_TYPES) d[t.id] = merged[t.id] || merged.default;
      d.default = merged.default;
      setDrafts(d);
    }, () => { setCfg({ default: BUILTIN_DEFAULT }); setDrafts({ default: BUILTIN_DEFAULT }); });
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    /* The Back Office can be the FIRST tigamodel surface opened in a session
       (owner hit exactly this: entered Back Office without ever opening the
       Model Lab, the singleton was still null, and tiga.providers threw
       "Cannot read properties of null" — taking the whole app to the crash
       screen). ensureTigamodelWeb() builds the singleton on first call and
       is idempotent, so calling it here is always safe. */
    let alive = true;
    ensureTigamodelWeb().then(t => {
      if (alive && t) setVersion(t.version);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  function setDraft(fid, patch) {
    setDrafts(prev => ({ ...prev, [fid]: { ...(prev[fid] || cfg.default), ...patch } }));
  }

  async function save(fid) {
    const d = drafts[fid];
    if (!d || !d.model || !d.model.trim()) return;
    setBusyKey(fid); setErr("");
    const next = { ...cfg, [fid]: { provider: d.provider, model: d.model.trim() } };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "ai_models", p_value: next });
    setBusyKey("");
    if (error) { setErr(error.message || "error"); return; }
    if (fid === "default") {
      await sb.rpc("admin_set_app_setting", { p_key: "ai_model", p_value: { provider: d.provider, model: d.model.trim() } }).then(() => {}, () => {});
    }
    setCfg(next); setSavedKey(fid); playUi("levelup");
    setTimeout(() => setSavedKey(""), 2500);
  }

  async function resetToDefault(fid) {
    if (fid === "default") return;
    setBusyKey(fid); setErr("");
    const next = { ...cfg };
    delete next[fid];
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "ai_models", p_value: next });
    setBusyKey("");
    if (error) { setErr(error.message || "error"); return; }
    setCfg(next);
    setDrafts(prev => ({ ...prev, [fid]: next.default }));
    setSavedKey(fid); playUi("click");
    setTimeout(() => setSavedKey(""), 2500);
  }

  /* What piano-chat actually resolves for a task type right now (same order). */
  function resolvedFor(fid) {
    if (!cfg) return BUILTIN_DEFAULT;
    const v = cfg[fid] || cfg.default;
    if (v && v.provider && v.model) return v;
    return fid === "chat" ? CHAT_BUILTIN : BUILTIN_DEFAULT;
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "10px 4px 40px", color: "var(--text)" }}>
      <div style={{ textAlign: "center", margin: "8px 0 16px" }}>
        <div style={{ fontSize: 34 }}>🧠</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "var(--text)" }}>{T("หลังบ้าน TIGA Piano Intelligence", "TIGA Piano Intelligence Back Office", "TIGA 钢琴智能后台")}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
          {T("โมเดลพื้นฐาน · สลับโมเดล · ประวัติทดสอบ · ผลประเมิน", "Foundation models · switching · test history · eval history", "基础模型 · 切换 · 测试历史 · 评估历史")}
          {version && <span style={S.mono}> · v{version}</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button style={S.chip(tab === "models")} onClick={() => setTab("models")}>🧠 {T("โมเดลพื้นฐาน", "Foundation models", "基础模型")}</button>
        <button style={S.chip(tab === "history")} onClick={() => setTab("history")}>💬 {T("ประวัติทดสอบแชท", "Chat test history", "聊天测试历史")}</button>
        <button style={S.chip(tab === "evals")} onClick={() => setTab("evals")}>📊 {T("ประวัติประเมิน", "Eval history", "评估历史")}</button>
      </div>

      {err && <div style={{ color: S.bad, fontSize: 13, marginBottom: 10 }}>⚠️ {err}</div>}

      {/* ══ 1) FOUNDATION MODELS: current + switch ══ */}
      {cfg && tab === "models" && (
        <>
          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🧠 {T("ตอนนี้ระบบยืนอยู่บนโมเดลอะไร", "What the system stands on right now", "当前基础模型")}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
              {T("ลำดับการตัดสิน: ตั้งค่าเฉพาะฟีเจอร์ → ค่าเริ่มต้น → ค่า built-in (เหมือน piano-chat ทำจริง)", "Resolution: per-feature → default → built-in (exactly what piano-chat does)", "解析顺序：按功能 → 默认 → 内置（与 piano-chat 一致）")}
            </div>
            <div style={{ ...S.inner, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 13.5, color: "var(--text)" }}>{T("โมเดลพื้นฐานกลาง (ทุกฟีเจอร์ที่ไม่ได้ตั้งเอง)", "Global default (all unconfigured features)", "全局默认")}</span>
                <b style={{ fontSize: 14.5 }}>{providerLabel(cfg.default.provider)} · {cfg.default.model}</b>
              </div>
            </div>
            {TASK_TYPES.filter(t => t.id !== "chat").map(t => {
              const eff = resolvedFor(t.id);
              const overridden = !!cfg[t.id];
              return (
                <div key={t.id} style={{ ...S.inner, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13 }}>{t.icon} {T(t.th, t.en, t.zh)}</span>
                  <span style={{ ...S.mono, fontWeight: overridden ? 700 : 400 }}>
                    {providerIcon(eff.provider)} {eff.model}{!overridden && <span style={{ color: "var(--muted)" }}> ({T("ตามค่าเริ่มต้น", "default", "默认")})</span>}
                  </span>
                </div>
              );
            })}
          </div>

          {TASK_TYPES.map(t => {
            const d = drafts[t.id] || cfg.default;
            const overridden = !!cfg[t.id];
            const prov = AI_PROVIDERS[d.provider] || { models: [] };
            const saved = savedKey === t.id;
            return (
              <div key={t.id} style={S.card} id={`bo-model-${t.id}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                  <b style={{ fontSize: 14.5 }}>{t.icon} {T(t.th, t.en, t.zh)}</b>
                  <span style={S.mono}>
                    {T("ใช้จริงตอนนี้", "active now", "当前生效")}: <b style={{ color: S.good }}>{providerIcon(resolvedFor(t.id).provider)} {resolvedFor(t.id).model}</b>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {Object.entries(AI_PROVIDERS).filter(([pid]) => {
                    const f = AI_FEATURES.find(x => x.id === t.id);
                    return !f || !f.prov || f.prov.includes(pid);
                  }).map(([pid, P]) => (
                    <button key={pid} style={S.chip(d.provider === pid)} onClick={() => setDraft(t.id, { provider: pid, model: (P.models[0] || {}).id || "" })}>
                      {P.icon} {P.label}
                    </button>
                  ))}
                </div>
                <select style={S.input} value={prov.models.some(m => m.id === d.model) ? d.model : ""} onChange={e => e.target.value && setDraft(t.id, { model: e.target.value })}>
                  <option value="">{T("— เลือกโมเดลจากชั้นวาง —", "— pick a model from the shelf —", "— 从列表选择模型 —")}</option>
                  {prov.models.map(m => <option key={m.id} value={m.id}>{m.label} ({m.id})</option>)}
                </select>
                <input style={{ ...S.input, marginTop: 6 }} placeholder={T("หรือพิมพ์ model id ใหม่เอง (เช่น GPT-6 อนาคต) แล้วกดบันทึก", "or type a new model id (e.g. a future GPT-6) and save", "或直接输入新模型 id 并保存")} value={d.model || ""} onChange={e => setDraft(t.id, { model: e.target.value })} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <button style={S.btn} onClick={() => save(t.id)} disabled={busyKey === t.id}>{busyKey === t.id ? "…" : T("💾 บันทึก (มีผลทันที)", "💾 Save (applies next request)", "💾 保存（立即生效）")}</button>
                  {overridden && <button style={S.btnGhost} onClick={() => resetToDefault(t.id)} disabled={busyKey === t.id}>{T("↺ ใช้ค่าเริ่มต้น", "↺ Reset to default", "↺ 恢复默认")}</button>}
                  {saved && <span style={{ color: S.good, fontSize: 13, fontWeight: 700 }}>✓ {T("บันทึกแล้ว", "saved", "已保存")}</span>}
                </div>
                {t.id === "chat" && <div style={{ ...S.mono, marginTop: 6 }}>{T("หมายเหตุ: แชททดสอบใน Lab เดินตามค่านี้ — สลับแล้วกดทดสอบใน Lab ได้เลย", "The Lab chat test follows this — switch here, test there.", "实验室聊天测试遵循此项设置。")}</div>}
              </div>
            );
          })}
        </>
      )}

      {/* ══ 2) CHAT TEST HISTORY ══ */}
      {tab === "history" && <ChatHistory T={T} S={S} />}

      {/* ══ 3) EVAL HISTORY ══ */}
      {tab === "evals" && <EvalHistory T={T} S={S} lang={lang} />}
    </div>
  );
}

/* ── Chat history viewer: sessions from the Model Lab, newest first ── */
function ChatHistory({ T, S }) {
  const [sessions, setSessions] = useState([]);
  const [openId, setOpenId] = useState(null);
  useEffect(() => { setSessions(loadChatSessions()); }, []);

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <b style={{ fontSize: 15 }}>💬 {T("ประวัติทดสอบแชทย้อนหลัง", "Past chat test sessions", "聊天测试历史")}</b>
        {sessions.length > 0 && (
          <button style={S.btnGhost} onClick={() => { if (confirm(T("ลบประวัติทั้งหมด?", "Delete all history?", "删除全部历史？"))) { clearChatSessions(); setSessions([]); } }}>
            🗑 {T("ลบทั้งหมด", "Clear all", "全部清除")}
          </button>
        )}
      </div>
      {sessions.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 18 }}>
          {T("ยังไม่มีประวัติ — ไปทดสอบที่แท็บ 💬 ทดสอบแชท ใน TIGA Model Lab แล้วประวัติจะถูกเก็บไว้ที่นี่", "No sessions yet — test in the Model Lab's 💬 tab and history lands here", "暂无历史 — 在实验室聊天页测试后会保存在这里")}
        </div>
      )}
      {sessions.map(s => (
        <div key={s.id} style={{ ...S.inner, marginBottom: 8 }}>
          <button style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--text)", padding: 0 }}
            onClick={() => setOpenId(openId === s.id ? null : s.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 13.5 }}>{s.task_type} · {s.messages.length} {T("ข้อความ", "messages", "条消息")}</b>
              <span style={S.mono}>{new Date(s.ts).toLocaleString()}</span>
            </div>
            <div style={{ ...S.mono, marginTop: 4 }}>
              {s.providers_used && s.providers_used.length > 0 ? s.providers_used.map(p => `${providerIcon(p.provider)} ${p.model || p.provider}`).join(" · ") : "—"}
            </div>
          </button>
          {openId === s.id && (
            <div style={{ marginTop: 10 }}>
              {s.messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: "var(--text2)" }}>{m.role === "user" ? "🧑" : "🤖"} {m.text.slice(0, 500)}{m.text.length > 500 ? "…" : ""}</div>
                  {m.role === "assistant" && (
                    <div style={{ ...S.mono, marginTop: 2 }}>
                      {providerIcon(m.provider)} {m.model || m.provider} · {m.latency}ms · {m.status}
                    </div>
                  )}
                </div>
              ))}
              <button style={{ ...S.btnGhost, marginTop: 4 }} onClick={() => { deleteChatSession(s.id); setSessions(loadChatSessions()); }}>
                🗑 {T("ลบรอบนี้", "Delete session", "删除此记录")}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Eval history: saved runs, so a model switch is judged against numbers ── */
function EvalHistory({ T, S, lang }) {
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { setRuns(loadEvalRuns()); }, []);

  async function runNow() {
    setBusy(true); setErr("");
    try {
      /* ensure, not get — this button may be the first tigamodel touch of the
         session (null here was the reported crash). */
      const tiga = (await ensureTigamodelWeb()) || getTigamodel();
      const results = await evaluateAllProviders(tiga.providers.list());
      setRuns(saveEvalRun({ results }));
    } catch (e) { setErr(String(e?.message || e)); }
    setBusy(false);
  }

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <b style={{ fontSize: 15 }}>📊 {T("ประวัติการประเมินโมเดล", "Eval run history", "评估历史")}</b>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btn} onClick={runNow} disabled={busy}>{busy ? T("กำลังประเมิน…", "Evaluating…", "评估中…") : T("▶ รันใหม่ตอนนี้", "Run new eval", "运行新评估")}</button>
          {runs.length > 0 && <button style={S.btnGhost} onClick={() => { if (confirm(T("ลบประวัติประเมิน?", "Delete eval history?", "删除评估历史？"))) { clearEvalRuns(); setRuns([]); } }}>🗑</button>}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        {T("หลักการข้อ 25: ห้ามเปลี่ยนโมเดลเพราะชื่อใหม่ — ดูคะแนนก่อน/หลังสลับที่นี่", "Rule §25: never switch models on a name — compare before/after scores here", "原则25：不要因名字换模型 — 在此对比前后评分")}
      </div>
      {err && <div style={{ color: S.bad, fontSize: 13, marginBottom: 8 }}>⚠️ {err}</div>}
      {runs.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 18 }}>{T("ยังไม่มีผลประเมิน — กดรันได้เลย", "No eval runs yet — run one", "暂无评估结果 — 点击运行")}</div>}
      {runs.map((r, ri) => (
        <div key={ri} style={{ ...S.inner, marginBottom: 8 }}>
          <div style={{ ...S.mono, marginBottom: 6 }}>{new Date(r.saved_at).toLocaleString()}</div>
          {r.results.map(res => (
            <div key={res.provider} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <b style={{ fontSize: 13.5 }}>{providerLabel(res.provider)}</b>
              <span style={{ fontSize: 15, fontWeight: 800, color: res.overall >= 0.8 ? S.good : res.overall >= 0.6 ? S.warn : S.bad }}>{(res.overall * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
