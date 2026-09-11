import { useState, useEffect, useCallback } from "react";
import { sb } from "./supabase-client";
import { playUi } from "./music-engine";

/* ── Admin: per-feature AI model manager + grouped admin nav ──
   Every product surface that calls an LLM/TTS is listed in AI_FEATURES with
   the providers it can run on. The config lives in the app_settings
   "ai_models" key as { "<feature>": {provider, model, voice?}, "default": {...} }
   — the piano-chat / piano-tts edge functions resolve per request:
   ai_models[feature] → ai_models["default"] → legacy "ai_model" → built-in.
   DeepSeek V4 Flash/Pro are OpenAI-compatible chat models (no vision), so the
   camera coach / slip-check features offer only the providers that can read an
   image, and their shelf is filtered through VISION_MODELS below so a rung that
   cannot see is never offered; the admin "Teach AI" tab stays on Anthropic
   because its web-search tool only exists there. "voice-tts" is the
   speech-synthesis engine (Gemini TTS vs ElevenLabs) and is used only by the
   AI Voice Tutor. ── */

export const AI_PROVIDERS = {
  anthropic: { icon: "🟠", label: "Anthropic", models: [{ id: "claude-sonnet-4-6", label: "Claude Sonnet" }] },
  gemini: { icon: "🔵", label: "Google Gemini", models: [
    { id: "gemini-2.5-flash", label: "Gemini Flash" },
    { id: "gemini-2.5-flash-lite", label: "Gemini Flash-Lite" },
  ]},
  deepseek: { icon: "🟣", label: "DeepSeek (ตรง)", models: [
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  ]},
  /* ── the free shelf, ranked ──
     Ordered #1..#5 by a live bake-off on 2026-09-10: every free route in
     OpenRouter's catalogue was sent the SAME real task from this app — a Thai
     child asking why her right hand loses the beat once the left hand joins,
     under the TIGA tutor system prompt — and judged on Thai that reads like a
     teacher, obeying "exactly 3 numbered steps", context, and whether it can
     emit schema-clean JSON (eight code paths here parse JSON out of a reply).
     Rank #1 sits FIRST on purpose: picking the OpenRouter provider button
     auto-selects models[0], so the best free option is the one you land on.
     NOTE the previous entry here, "deepseek/deepseek-chat-v3-0324:free", was
     RETIRED by OpenRouter and 404'd every request — it took every AI feature
     in the app down. As of that date OpenRouter lists no free DeepSeek route
     at all, so there is nothing to put back. Paid DeepSeek stays below. */
  openrouter: { icon: "🌐", label: "OpenRouter", models: [
    { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "① Nemotron 3 Super · ฟรี (ฉลาดสุด)" },
    { id: "nex-agi/nex-n2.5-pro:free", label: "② Nex N2.5 Pro · ฟรี (ดูรูปได้)" },
    { id: "google/gemma-4-26b-a4b-it:free", label: "③ Gemma 4 26B · ฟรี (เร็วสุด)" },
    { id: "openrouter/free", label: "④ Free Router · ฟรี (ไม่มีวันหาย)" },
    { id: "nvidia/nemotron-3.5-lightning:free", label: "⑤ Nemotron Lightning · ฟรี (ctx 1M)" },
    { id: "deepseek/deepseek-v4-flash", label: "💰 DeepSeek V4 Flash (เสียเงิน)" },
    { id: "deepseek/deepseek-v4-pro", label: "💰 DeepSeek V4 Pro (เสียเงิน)" },
  ]},
  elevenlabs: { icon: "🎙️", label: "ElevenLabs", models: [
    { id: "eleven_v3", label: "Eleven v3 (ภาษาไทยดีที่สุด)" },
    { id: "eleven_multilingual_v2", label: "Multilingual v2" },
    { id: "eleven_flash_v2_5", label: "Flash v2.5" },
  ]},
};

export const AI_FEATURES = [
  { id: "chat", icon: "💬", th: "แชทครู AI (หน้าแรก)", en: "AI Chat (home)", zh: "AI 聊天（首页）", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "voice", icon: "🎙️", th: "เสียงครู AI — บทสนทนา", en: "Voice Tutor — conversation", zh: "语音老师 — 对话", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "voice-tts", icon: "🔊", th: "เสียงครู AI — สังเคราะห์เสียง", en: "Voice Tutor — speech engine", zh: "语音老师 — 语音引擎", prov: ["gemini", "elevenlabs"], tts: true,
    noteTh: "ใช้เฉพาะโหมดเสียง — ภาษาไทยต้องใช้ Eleven v3 (v2/flash v2.5 ไม่รองรับไทย) เปลี่ยนเสียงได้ที่ ElevenLabs > Voices",
    noteEn: "Voice mode only — Thai needs Eleven v3 (v2/flash v2.5 don't cover Thai); pick a Voice ID at ElevenLabs → Voices",
    noteZh: "仅语音模式使用 — 泰语需用 Eleven v3（v2/flash v2.5 不支持泰语）；可在 ElevenLabs → Voices 选择音色" },
  { id: "song-style", icon: "🎨", th: "แปลงสไตล์เพลง", en: "Song style transform", zh: "歌曲风格转换", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "song-analysis", icon: "📊", th: "วิเคราะห์การเล่นเพลง", en: "Song run analysis", zh: "弹奏分析", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "compose", icon: "🎼", th: "แต่งทำนอง", en: "Melody composer", zh: "旋律创作", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "song-gen", icon: "✨", th: "สร้างเพลงจากข้อความ", en: "AI song generator", zh: "AI 生成歌曲", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "coach-tip", icon: "🎯", th: "คำแนะนำหน้า Coach", en: "Coach page tips", zh: "教练建议", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "practice-tip", icon: "🎯", th: "คำชมท้ายฝึกซ้อม", en: "Practice Mode result praise", zh: "练习结果点评", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "weekly-report", icon: "📋", th: "รายงานพัฒนาการ AI", en: "AI weekly report", zh: "AI 周报", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "practice-plan", icon: "🗓️", th: "แผนซ้อมส่วนตัว AI", en: "AI practice plan", zh: "AI 练习计划", prov: ["anthropic", "gemini", "deepseek", "openrouter"] },
  { id: "camera", icon: "✋", th: "กล้องจับท่ามือ", en: "Hand-posture coach", zh: "手型教练", prov: ["anthropic", "gemini", "openrouter"], vision: true,
    noteTh: "ต้องใช้โมเดลที่ดูรูปได้ — มีตัวเลือกฟรีคือ ② Nex N2.5 Pro (DeepSeek ยังไม่มีฟีเจอร์รูปภาพ)", noteEn: "Needs a vision model — the free option is ② Nex N2.5 Pro (DeepSeek has no image support yet)", noteZh: "需要视觉模型 — 免费选项为 ② Nex N2.5 Pro（DeepSeek 暂不支持图片）" },
  { id: "slip-check", icon: "🧾", th: "ตรวจสลิปโอนเงิน (แอดมิน)", en: "Slip verification (admin)", zh: "转账凭证核验（管理员）", prov: ["anthropic", "gemini", "openrouter"], vision: true,
    noteTh: "ต้องใช้โมเดลที่ดูรูปได้ — มีตัวเลือกฟรีคือ ② Nex N2.5 Pro (DeepSeek ยังไม่มีฟีเจอร์รูปภาพ)", noteEn: "Needs a vision model — the free option is ② Nex N2.5 Pro (DeepSeek has no image support yet)", noteZh: "需要视觉模型 — 免费选项为 ② Nex N2.5 Pro（DeepSeek 暂不支持图片）" },
  { id: "admin-chat", icon: "🤖", th: "แท็บสอน AI (แอดมิน)", en: "Teach AI tab (admin)", zh: "训练 AI（管理员）", prov: ["anthropic"],
    noteTh: "ต้องใช้ Claude — ฟีเจอร์ค้นเน็ต/รูปภาพมีเฉพาะ Anthropic", noteEn: "Locked to Claude — its web-search/vision tools only exist there", noteZh: "锁定 Claude — 联网/图片功能仅 Anthropic 提供" },
];

/* Which models can actually SEE an image. Vision features (camera coach, slip
   reader) filter their shelf through this. Every Anthropic and Gemini model on
   the shelf is a vision model, so only OpenRouter needs narrowing — exactly one
   free rung reads images, and offering the other four would look like a free
   camera coach that quietly answers about a picture it never received. */
const VISION_MODELS = { openrouter: ["nex-agi/nex-n2.5-pro:free"] };
const shelfFor = (provider, models, visionOnly) =>
  visionOnly && VISION_MODELS[provider] ? (models || []).filter(m => VISION_MODELS[provider].includes(m.id)) : (models || []);

const DEFAULT_ENTRY = { provider: "anthropic", model: "claude-sonnet-4-6" };

function nameOf(f, lang) { return f.th && f.en && f.zh ? (lang === "th" ? f.th : lang === "zh" ? f.zh : f.en) : f.en; }
function providerLabel(p, lang) {
  return p === "anthropic" ? "Anthropic" : p === "gemini" ? "Google Gemini" : p === "deepseek" ? "DeepSeek (ตรง)" : p === "openrouter" ? "OpenRouter" : "ElevenLabs";
}

/* ── Admin "AI Models" panel: shows which AI every feature uses and lets each
   one be switched independently (provider + model, free-text model ID allowed,
   per-feature voice id for the TTS engine, reset-to-default per feature). ── */
export function AdminAIModels({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [cfg, setCfg] = useState(null);          // null = loading; { default: {provider,model}, "<feature>": {...} }
  const [drafts, setDrafts] = useState({});       // feature -> { provider, model, voice }
  const [busyKey, setBusyKey] = useState("");     // feature currently saving
  const [savedKey, setSavedKey] = useState("");   // feature just saved (shows ✓)

  const load = useCallback(() => {
    Promise.all([
      sb.from("app_settings").select("value").eq("key", "ai_models").maybeSingle(),
      sb.from("app_settings").select("value").eq("key", "ai_model").maybeSingle(),
    ]).then(([r1, r2]) => {
      const map = (r1 && r1.data && r1.data.value && typeof r1.data.value === "object") ? r1.data.value : {};
      const legacy = (r2 && r2.data && r2.data.value && r2.data.value.provider && r2.data.value.model) ? r2.data.value : null;
      const merged = { ...map };
      if (!merged.default && legacy) merged.default = legacy;
      if (!merged.default) merged.default = DEFAULT_ENTRY;
      setCfg(merged);
      setDrafts(prev => {
        const next = {};
        for (const f of AI_FEATURES) next[f.id] = merged[f.id] || merged.default;
        next.default = merged.default;
        return next;
      });
    }, () => { setCfg({ default: DEFAULT_ENTRY }); setDrafts({ default: DEFAULT_ENTRY }); });
  }, []);
  useEffect(() => { load(); }, [load]);

  function setDraft(fid, patch) {
    setDrafts(prev => ({ ...prev, [fid]: { ...(prev[fid] || cfg.default), ...patch } }));
  }

  async function save(fid) {
    const d = drafts[fid];
    if (!d || !d.model || !d.model.trim()) return;
    setBusyKey(fid); setSavedKey("");
    const next = { ...cfg, [fid]: { provider: d.provider, model: d.model.trim(), ...(d.voice && d.voice.trim() ? { voice: d.voice.trim() } : {}) } };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "ai_models", p_value: next });
    setBusyKey("");
    if (error) { alert(error.message || "error"); return; }
    // keep the legacy single-model key in sync when the default changes, so the
    // old behavior stays intact even if ai_models is ever cleared
    if (fid === "default") {
      await sb.rpc("admin_set_app_setting", { p_key: "ai_model", p_value: { provider: d.provider, model: d.model.trim() } }).then(() => {}, () => {});
    }
    setCfg(next); setSavedKey(fid); playUi("levelup");
    setTimeout(() => setSavedKey(""), 2500);
  }

  async function resetToDefault(fid) {
    if (fid === "default") return;
    setBusyKey(fid); setSavedKey("");
    const next = { ...cfg };
    delete next[fid];
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "ai_models", p_value: next });
    setBusyKey("");
    if (error) { alert(error.message || "error"); return; }
    setCfg(next);
    setDrafts(prev => ({ ...prev, [fid]: next.default }));
    setSavedKey(fid); playUi("click");
    setTimeout(() => setSavedKey(""), 2500);
  }

  function entryLabel(e) {
    if (!e) return "—";
    const prov = providerLabel(e.provider, lang);
    return `${prov} · ${e.model}`;
  }

  if (cfg === null) return <div className="admstu"><div className="admstu-msg">⏳</div></div>;

  // At-a-glance table: every feature → the model actually in use right now
  // (saved config, not the unsaved draft). Falls back to the default entry.
  const renderSummary = () => (
    <div className="admsum" style={{ margin: "0 2px 14px" }}>
      <div className="admmg-h" style={{ margin: 0, paddingBottom: 8 }}>
        📋 {T("สรุป — แต่ละฟีเจอร์ใช้โมเดลอะไรตอนนี้", "Summary — which model each feature uses right now", "总览 — 每个功能当前使用的模型")}
      </div>
      {AI_FEATURES.map(f => {
        const eff = cfg[f.id] || cfg.default;
        const inherited = !cfg[f.id];
        return (
          <div key={f.id} className="admsum-row">
            <span className="admsum-ic">{f.icon}</span>
            <span className="admsum-name">{nameOf(f, lang)}</span>
            <span className="admsum-m">{entryLabel(eff)}</span>
            {inherited && <span className="admsum-def">{T("ค่าเริ่มต้น", "default", "默认")}</span>}
          </div>
        );
      })}
      <div className="admstu-row-sub" style={{ marginTop: 10, whiteSpace: "normal", lineHeight: 1.7 }}>
        🧭 {T("แต่ละตัวเลือกเหมาะกับอะไร:", "What each option is for:", "各选项用途：")}
        <br />🟣 {T("DeepSeek (ตรง) — API ของ DeepSeek โดยตรง ถูก แต่มีค่า peak ช่วงกลางวัน", "DeepSeek (direct) — cheap direct API, but peak pricing during Thai daytime", "DeepSeek（直连）— 直连 API 价格低，但泰国白天有高峰价")}
        <br />🌐 {T("OpenRouter — ทางเดียวที่มีรุ่นฟรีจริง (ดูอันดับด้านล่าง)", "OpenRouter — the only route with genuinely free models (ranked below)", "OpenRouter — 唯一有真正免费模型的通道（排名见下）")}
        <br />🔵 {T("Google Gemini — key ฟรี (จำกัด quota) ใช้กับกล้อง/สลิปที่ต้องดูรูป", "Google Gemini — free key (rate-limited), used by camera/slip which need vision", "Google Gemini — 免费密钥（有限额），用于需要视觉的手型/凭证")}
        <br />🟠 {T("Anthropic — คุณภาพสูงสุด ต้องตั้ง ANTHROPIC_API_KEY (ยังไม่ได้ตั้ง)", "Anthropic — highest quality, requires ANTHROPIC_API_KEY (not set yet)", "Anthropic — 质量最高，需要设置 ANTHROPIC_API_KEY（尚未设置）")}
        <br />🎙️ {T("ElevenLabs — เสียงภาษาไทย (เฉพาะโหมดเสียง) ~$0.10 ต่อ 1,000 ตัวอักษร", "ElevenLabs — Thai voice (voice mode only) ~$0.10 per 1K chars", "ElevenLabs — 泰语语音（仅语音模式）约 $0.10/千字符")}
        <br />👁️ {T("กล้อง/สลิป ยังบังคับใช้ Claude/Gemini เสมอ แม้ตั้งเป็น OpenRouter ก็ตาม", "Camera/slip always run on Claude/Gemini, even if set to OpenRouter", "手型/凭证始终使用 Claude/Gemini，即使设为 OpenRouter")}
      </div>

      {/* ── the free shelf, ranked ──
          The owner picks the model, so the reasoning behind the order has to
          live HERE, next to the buttons, not in a commit message they will
          never read. Ranked by a live bake-off (see AI_PROVIDERS above). */}
      <div className="admstu-row-sub" style={{ marginTop: 10, whiteSpace: "normal", lineHeight: 1.75 }}>
        🏆 {T("อันดับรุ่นฟรีที่เหมาะกับแอปนี้ (ทดสอบจริงด้วยคำถามครูสอนเปียโนภาษาไทย 10 ก.ย. 2026)",
              "Free models ranked for this app (live-tested with a real Thai piano-teaching prompt, 10 Sep 2026)",
              "适合本应用的免费模型排名（2026-09-10 用真实泰语钢琴教学提问实测）")}
        <br />① <b>Nemotron 3 Super</b> — {T("ฉลาดที่สุด 120B · ตัวเดียวที่รับบุคลิก “ครูตีก้า” มาใช้เอง · เขียน JSON ตาม schema ได้ · ไม่ดูรูป",
              "smartest at 120B · the only one that picked up the “ครูตีก้า” persona unprompted · schema-clean JSON · no vision",
              "最聪明的 120B · 唯一自动沿用「ครูตีก้า」人设 · 可输出规范 JSON · 无视觉")}
        <br />② <b>Nex N2.5 Pro</b> — {T("ไทยดี อบอุ่น · JSON ได้ · ดูรูปได้ (อนาคตอาจย้ายกล้อง/สลิปมาที่นี่ได้) · ค่ายใหม่ ยังไม่มีประวัติยาว",
              "warm Thai · JSON · vision, so camera/slip could move here later · new vendor, short track record",
              "泰语温暖自然 · 支持 JSON · 有视觉（将来手型/凭证可迁移）· 新厂商，履历尚短")}
        <br />③ <b>Gemma 4 26B</b> — {T("เร็วที่สุดในสามอันดับแรก · จัดรูปแบบเป๊ะสุด · ไทยไว้ใจได้ · ไม่มี JSON schema",
              "fastest of the top three · cleanest formatting · dependable Thai · no JSON schema mode",
              "前三名中最快 · 排版最干净 · 泰语可靠 · 无 JSON schema")}
        <br />④ <b>Free Router</b> — {T("ไม่มีวันหาย (OpenRouter เลือกรุ่นฟรีที่ยังอยู่ให้เอง) · แต่สุ่มรุ่นทุกครั้ง น้ำเสียงครูจะไม่คงที่ — เหมาะเป็นตัวสำรอง ไม่ใช่ตัวหลัก",
              "can never go missing (OpenRouter picks whatever is free today) · but random each call, so the teacher's voice drifts — a backup, not a primary",
              "永不失效（OpenRouter 自动挑选当日免费模型）· 但每次随机，老师语气不一致 — 适合做备用而非主力")}
        <br />⑤ <b>Nemotron Lightning</b> — {T("context 1 ล้าน token · เร็ว · ไทยดี · ไม่มี JSON schema, ไม่ดูรูป",
              "1M-token context · fast · good Thai · no JSON schema, no vision",
              "100 万 token 上下文 · 快速 · 泰语良好 · 无 JSON schema、无视觉")}
        <br />⚠️ {T("รุ่นฟรีมีเพดานการใช้งาน — ถ้ามีคนใช้พร้อมกันเยอะจะโดน rate limit ระบบจะไล่ไปตัวถัดไปในอันดับให้เอง แล้วค่อยไปรุ่นเสียเงินเป็นทางสุดท้าย",
              "Free routes are rate-limited — under load the system walks down this ranking automatically, and only then reaches a paid route",
              "免费通道有速率上限 — 高并发时系统会按此排名自动下移，最后才使用付费通道")}
      </div>
    </div>
  );

  const renderCard = (fid, f, isDefault) => {
    const d = drafts[fid] || cfg.default;
    const providers = isDefault ? ["anthropic", "gemini", "deepseek", "openrouter"] : f.prov;
    const provMeta = AI_PROVIDERS[d.provider] || AI_PROVIDERS.anthropic;
    const shelf = shelfFor(d.provider, provMeta.models, !isDefault && f.vision);
    const isCustom = !shelf.some(m => m.id === d.model);
    return (
      <div className="admmg" key={fid}>
        <div className="admmg-h">{f.icon} {isDefault ? T("ค่าเริ่มต้น (ทุกฟีเจอร์)", "Default (all features)", "默认（所有功能）") : nameOf(f, lang)}</div>
        <div className="admstu-row-sub" style={{ marginBottom: 8, whiteSpace: "normal" }}>
          {!isDefault && f.noteTh && (<span>{lang === "th" ? f.noteTh : lang === "zh" ? f.noteZh : f.noteEn} </span>)}
          {T("ใช้อยู่:", "Currently:", "当前使用：")} <b style={{ color: "#d97757" }}>{entryLabel(cfg[fid] || cfg.default)}</b>
          {!isDefault && !cfg[fid] && <span style={{ opacity: .75 }}> ({T("ตามค่าเริ่มต้น", "from default", "沿用默认")})</span>}
        </div>
        <div className="setlangs">
          {providers.map(p => (
            <button key={p} className={`setlangbtn${d.provider === p ? " on" : ""}`} disabled={busyKey === fid}
              onClick={() => {
                const picks = shelfFor(p, AI_PROVIDERS[p].models, !isDefault && f.vision);
                setDraft(fid, { provider: p, model: picks[0] ? picks[0].id : d.model });
              }}>
              {AI_PROVIDERS[p].icon} {AI_PROVIDERS[p].label}
            </button>
          ))}
        </div>
        {shelf.length > 0 && (
          <div className="setlangs" style={{ marginTop: 7 }}>
            {shelf.map(m => (
              <button key={m.id} className={`setlangbtn${d.model === m.id ? " on" : ""}`} disabled={busyKey === fid}
                onClick={() => setDraft(fid, { model: m.id })}>{m.label}</button>
            ))}
          </div>
        )}
        <div className="admmg-row" style={{ marginTop: 8 }}>
          <input className="aicreate-in" value={d.model || ""} disabled={busyKey === fid}
            onChange={e => setDraft(fid, { model: e.target.value })} placeholder="model id" style={{ flex: 1 }} />
          {f.tts && d.provider === "elevenlabs" && (
            <input className="aicreate-in" value={d.voice || ""} disabled={busyKey === fid}
              onChange={e => setDraft(fid, { voice: e.target.value })} placeholder={T("Voice ID (ElevenLabs)", "Voice ID (ElevenLabs)", "Voice ID（ElevenLabs）")} style={{ flex: 1 }} />
          )}
          <button className="songbtn go" disabled={busyKey === fid || !d.model || !d.model.trim()}
            onClick={() => save(fid)}>{busyKey === fid ? "⏳" : T("บันทึก", "Save", "保存")}</button>
        </div>
        <div className="admmg-row" style={{ marginTop: 8 }}>
          {!isDefault && (
            <button className="songbtn ghost" disabled={busyKey === fid} onClick={() => resetToDefault(fid)}
              style={{ padding: "6px 12px", fontSize: 12 }}>{T("คืนค่าเริ่มต้น", "Reset to default", "恢复默认")}</button>
          )}
          {savedKey === fid && <span className="admstu-row-sub" style={{ color: "#d97757", margin: "auto 0" }}>✓ {T("บันทึกแล้ว — มีผลทันที", "Saved — takes effect immediately", "已保存 — 立即生效")}</span>}
          {isCustom && d.provider !== "elevenlabs" && <span className="admstu-row-sub" style={{ margin: "auto 0 0 auto", opacity: .8 }}>{T("รหัสโมเดลกำหนดเอง", "Custom model ID", "自定义模型 ID")}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="admstu">
      <div className="admmg-h" style={{ margin: "2px 2px 10px", lineHeight: 1.5 }}>
        {T("🧠 โมเดล AI ของแต่ละฟีเจอร์", "🧠 AI model per feature", "🧠 各功能的 AI 模型")}
      </div>
      <div className="admstu-row-sub" style={{ margin: "0 2px 12px", whiteSpace: "normal" }}>
        {T("เปลี่ยนได้ทันที ไม่ต้อง deploy ใหม่ — แต่ละฟีเจอร์ใช้โมเดลคนละตัวได้อิสระ เลือก DeepSeek V4 Flash/Pro เพื่อลดต้นทุน หรือ Gemini/Claude เพื่อคุณภาพ ฟีเจอร์ที่ต้องดูรูปภาพ (กล้อง/สลิป) ใช้ได้เฉพาะ Claude/Gemini และแท็บสอน AI ใช้ Claude เสมอ",
          "Switches instantly, no redeploy — every feature can run on a different model independently. Pick DeepSeek V4 Flash/Pro to cut cost, or Gemini/Claude for quality. Vision features (camera / slip-check) are limited to Claude/Gemini, and the Teach AI tab always uses Claude.",
          "立即切换，无需重新部署 — 每个功能可独立使用不同模型。选择 DeepSeek V4 Flash/Pro 降低成本，或用 Gemini/Claude 保证质量。需要图像的功能（手型/凭证）仅限 Claude/Gemini，训练 AI 始终使用 Claude。")}
      </div>
      {renderSummary()}
      {renderCard("default", { icon: "⚙️", th: "", en: "", zh: "" }, true)}
      {AI_FEATURES.map(f => renderCard(f.id, f, false))}
    </div>
  );
}

/* ── Admin nav: one button that expands into business-category groups ── */
const ADMIN_NAV_GROUPS = [
  { id: "ai", icon: "🤖", th: "AI และคอนเทนต์", en: "AI & Content", zh: "AI 与内容", items: [
    { id: "ai", icon: "🤖", tier: 3, th: "สอน AI", en: "Teach AI", zh: "训练 AI" },
    { id: "aimodel", icon: "🧠", tier: 3, th: "โมเดล AI", en: "AI Models", zh: "AI 模型" },
    { id: "videos", icon: "🎬", tier: 3, th: "วิดีโอ", en: "Videos", zh: "视频" },
    { id: "autoteach", icon: "⏱️", tier: 2, th: "ตั้งเวลาสอน", en: "Auto Teaching", zh: "自动教学" },
  ]},
  { id: "people", icon: "👥", th: "ผู้เรียนและโรงเรียน", en: "Learners & Schools", zh: "学员与学校", items: [
    { id: "students", icon: "👥", tier: 0, th: "นักเรียน", en: "Students", zh: "学生" },
    { id: "schools", icon: "🏫", tier: 0, th: "โรงเรียน", en: "Schools", zh: "学校" },
  ]},
  { id: "business", icon: "💰", th: "ธุรกิจ", en: "Business", zh: "业务", items: [
    { id: "payments", icon: "💳", tier: 3, th: "ชำระเงิน", en: "Payments", zh: "付款" },
    { id: "analytics", icon: "📊", tier: 3, th: "สถิติ", en: "Analytics", zh: "统计" },
    { id: "activity", icon: "📈", tier: 3, th: "กิจกรรมผู้ใช้", en: "User Activity", zh: "用户活动" },
    { id: "anonvisit", icon: "👁️", tier: 3, th: "ผู้เข้าชม (ยังไม่ล็อกอิน)", en: "Visitors (not logged in)", zh: "未登录访客" },
    { id: "simbots", icon: "🤖", tier: 3, th: "ข้อมูลจำลอง", en: "Demo Bots", zh: "模拟数据" },
  ]},
  { id: "leadsale", icon: "🎯", th: "Lead Sale", en: "Lead Sale", zh: "获客与销售", items: [
    { id: "leadsale", icon: "📊", tier: 0, th: "แดชบอร์ด Lead", en: "Lead Dashboard", zh: "线索仪表板" },
    { id: "leadlanding", icon: "🌐", tier: 0, th: "Landing Page", en: "Landing Page", zh: "落地页" },
    { id: "leadreferral", icon: "🎁", tier: 0, th: "แนะนำเพื่อน", en: "Referral", zh: "推荐奖励" },
    { id: "leadquiz", icon: "🎵", tier: 0, th: "Quiz ระดับเปียโน", en: "Piano Level Quiz", zh: "钢琴等级测试" },
  ]},
  { id: "engage", icon: "📣", th: "การตลาดและกิจกรรม", en: "Marketing & Events", zh: "营销与活动", items: [
    { id: "broadcast", icon: "📢", tier: 3, th: "ประกาศ", en: "Broadcast", zh: "公告" },
    { id: "weeklyreport", icon: "📊", tier: 3, th: "รายงานรายสัปดาห์", en: "Weekly Report", zh: "周报告" },
    { id: "event", icon: "🎉", tier: 3, th: "อีเว้นท์", en: "Event", zh: "活动" },
    { id: "games", icon: "🎮", tier: 3, th: "เกม", en: "Games", zh: "游戏" },
  ]},
];

export function AdminNav({ lang, tier, adminTab, setAdminTab }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [open, setOpen] = useState(false);
  const flat = ADMIN_NAV_GROUPS.flatMap(g => g.items);
  const cur = flat.find(i => i.id === adminTab) || flat[0];
  return (
    <div className="adminnav">
      <button className="adminnav-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}
        aria-label={T("เมนูแอดมิน", "Admin menu", "管理菜单")}>
        <span className="adminnav-burger">☰</span>
        <span className="adminnav-cur">{cur.icon} {T(cur.th, cur.en, cur.zh)}</span>
        <span className="adminnav-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          <div className="adminnav-scrim" onClick={() => setOpen(false)} />
          <div className="adminnav-pop">
            {ADMIN_NAV_GROUPS.map(g => (
              <div className="adminnav-group" key={g.id}>
                <div className="adminnav-gh">{g.icon} {T(g.th, g.en, g.zh)}</div>
                <div className="adminnav-items">
                  {g.items.filter(it => tier >= it.tier).map(it => (
                    <button key={it.id} className={`adminnav-item${adminTab === it.id ? " on" : ""}`}
                      onClick={() => { setAdminTab(it.id); setOpen(false); }}>
                      <span className="adminnav-ic">{it.icon}</span>
                      <span className="adminnav-lb">{T(it.th, it.en, it.zh)}</span>
                      {adminTab === it.id && <span className="adminnav-dot" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
