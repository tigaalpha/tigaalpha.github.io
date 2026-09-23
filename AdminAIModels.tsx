import { useState, useEffect, useCallback } from "react";
import { tigaHub } from "./tigamodel/web"; // Capability Hub: live view of which TIGA engines are registered and what each intent can answer
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

      {/* ── TIGA Capability Hub — live engine/intent status ──
          Every TIGA MODEL engine registers into the hub; surfaces ask the hub
          for intents, so a newly registered (smarter) engine upgrades every
          surface at once. This table is the proof: which domains are live
          right now and which intents they serve. */}
      {(() => {
        const sum = tigaHub.summary();
        const intentNames = { "sight-reading": ["อ่านโน้ตล่วงหน้า", "Sight-reading", "识谱"], "song-result": ["คำแนะนำหลังจบเพลง", "Song-result coach", "曲目点评"], "quest-hint": ["เคล็ดภารกิจรายวัน", "Daily quest hint", "每日任务提示"], "learner-summary": ["สรุปผู้เรียน", "Learner summary", "学员总结"] };
        return (
          <div className="admsum-row tigahub" style={{ marginTop: 10, whiteSpace: "normal", lineHeight: 1.7 }}>
            🧠 <b>TIGA MODEL</b> — {T("เอนจินที่ลงทะเบียนแล้ว:", "registered engines:", "已注册引擎：")}
            {sum.engines.length
              ? sum.engines.map(e => <span key={e.domain} className="tigahub-chip" title={e.note}>{e.domain}</span>)
              : <span className="admsum-def">{T("ยังไม่มี — ใช้ baseline", "none yet — baseline in use", "暂无 — 使用基线")}</span>}
            <br />
            {sum.capabilities.map(c => {
              const nm = intentNames[c.name] || [c.name, c.name, c.name];
              return (
                <span key={c.name} style={{ marginRight: 10 }}>
                  {c.status === "ready" ? "🟢" : c.status === "partial" ? "🟡" : "⚪"} {T(nm[0], nm[1], nm[2])}
                </span>
              );
            })}
          </div>
        );
      })()}
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

/* ── Admin "Jev Tasks" panel: per-task on/off switches for the TypeSafe Jev
   System One model (structured decisions: classify/route/score/filter — never
   text generation). Config lives in app_settings "jev_tasks" as
   { "<task>": { enabled: bool } }; the piano-jev edge function reads it
   server-side (60s cache) and every app-side call site falls back to its
   pre-Jev behavior when a task is off or Jev is unavailable, so toggling is
   zero-risk: nothing breaks, the feature just reverts to the LLM/heuristic
   path. Requires TYPESAFE_API_KEY on the function's secrets to have any
   effect. ── */
export const JEV_TASKS = [
  { id: "teach-rank", icon: "🎯", th: "จัดอันดับคำแนะนำ Auto Teaching", en: "Rank Auto-Teaching tips", zh: "自动教学建议排序",
    howTh: "ให้ Jev ให้คะแนนว่าคำแนะนำที่ AI สร้าง เหมาะกับผู้เรียนคนนี้ตอนนี้จริงหรือไม่ ก่อนเด้งป็อปอัป",
    howEn: "Jev scores whether the AI-generated coaching tip actually fits this learner right now, before the popup shows.",
    howZh: "Jev 评估 AI 生成的建议是否适合该学员，然后才弹出提示" },
  { id: "song-rec", icon: "🎵", th: "เลือกเพลงแนะนำถัดไป", en: "Pick the next recommended song", zh: "选择下一首推荐歌曲",
    howTh: "Jev เลือก 1 เพลงจากคลังจริงของแอปให้เข้ากับระดับและจุดอ่อนของผู้เรียน (เลือกได้เฉพาะเพลงที่มีอยู่ หลอกไม่ได้)",
    howEn: "Jev picks ONE song from the app's real catalog matching the learner's level + weakest skill (answer must be a real song id).",
    howZh: "Jev 从真实曲库中挑选一首匹配学员水平的歌曲" },
  { id: "chat-precheck", icon: "🛡️", th: "คัดกรองแชทก่อนส่งให้ AI หลัก", en: "Pre-check chat before the main AI", zh: "聊天预检",
    howTh: "จำแนกสแปม/คำถามเรื่องเพลง/อยากซ้อม/อารมณ์ผู้เรียนใน 1 ครั้ง (~0.1-0.5 วิ) — สแปมถูกตอบเองโดยไม่เปลืองโมเดลหลัก อารมณ์ใช้ปรับโทนคำตอบ",
    howEn: "One parallel call classifies spam / song-intent / practice-intent / mood per message. Spam is answered locally (no LLM spend); mood steers the reply's tone.",
    howZh: "一次调用并行识别垃圾信息/意图/情绪；垃圾信息本地回复，情绪引导语气" },
  { id: "voice-intent", icon: "🎙️", th: "จับคำสั่งเสียง → แอ็กชัน", en: "Voice command → app action", zh: "语音指令识别",
    howTh: "จับว่าประโยคที่พูดต้องการเปิดเพลง/ซ้อม/ฝึกหู/กล้อง/เมโทรนอม ตัวไหน พร้อมเดาเพลงที่ต้องการ แล้วใบ้ให้โมเดลหลัก",
    howEn: "Classifies which app action a spoken utterance wants (open song / practice / ear / camera / metronome) and hints the main model.",
    howZh: "识别语音要执行的操作并提示主模型" },
  { id: "run-classify", icon: "📊", th: "จำแนกรูปแบบความผิดพลาดการเล่น", en: "Classify song-run mistakes", zh: "弹奏错误分类",
    howTh: "ให้คะแนนโน้ตผิด/จังหวะเพี้ยน/ไดนามิกอ่อน + เลือกว่าควรแก้อะไรก่อน แล้วส่งให้โมเดลหลักเขียนสรุปจากข้อมูลจริง",
    howEn: "Scores wrong-notes/rhythm/dynamics dimensions + picks the highest-impact fix, grounding the LLM's written summary.",
    howZh: "为错误维度打分并选择最优先修正点" },
  { id: "ear-adaptive", icon: "👂", th: "ปรับระดับยิมหูอัตโนมัติ", en: "Adaptive Ear Gym difficulty", zh: "听力房自适应难度",
    howTh: "หลังจบแต่ละรอบ Jev ให้คะแนนว่ารอบต่อไปควร ง่ายลง/เท่าเดิม/ยากขึ้น — เกมปรับตามฝีมือจริง",
    howEn: "After each round Jev scores step-down / stay / step-up so the next round matches the learner's real level.",
    howZh: "每轮结束后 Jev 评估下一轮难度（降/保持/升）" },
  { id: "slip-prefilter", icon: "🧾", th: "คัดรายการสลิปที่ไม่สมเหตุสมผล (แอดมิน)", en: "Prefilter implausible slips (admin)", zh: "凭证预检（管理员）",
    howTh: "เช็คความสมเหตุสมผลของรายการ (ยอด/แพ็กเกจ) ก่อนเสียค่าเรียก vision model อ่านสลิปจริง",
    howEn: "Checks record plausibility (amount/package) BEFORE spending a vision-model call reading the slip image.",
    howZh: "在调用视觉模型读凭证前先检查合理性" },
  { id: "feedback-classify", icon: "🗂️", th: "จัดหมวดสถานการณ์นักเรียน (แอดมิน)", en: "Bucket learner situations (admin)", zh: "学员情况分类（管理员）",
    howTh: "จัดนักเรียนแต่ละคนเข้าหมวด ก้าวหน้า/ติดขัด/การเงิน/มีส่วนร่วม/เทคนิค + ความเร่งด่วน ให้เจ้าของคนเดียวไล่อ่านได้เร็ว",
    howEn: "Buckets each learner into progress/struggling/billing/engagement/technical + urgency so a solo owner can triage fast.",
    howZh: "将学员分类并标注紧急度，便于独立运营者快速处理" },
  { id: "sight-adaptive", icon: "🎼", th: "ปรับระดับอ่านโน้ตฉับพลันอัตโนมัติ", en: "Adaptive Sight-Reading difficulty", zh: "视奏自适应难度",
    howTh: "หลังจบรอบ Jev ให้คะแนนว่ารอบถัดไปควร ง่ายลง/เท่าเดิม/ยากขึ้น (เปลี่ยนกุญแจ/รอบยาวขึ้น) — เกมอ่านโน้ตปรับตามฝีมือจริง",
    howEn: "After each round Jev scores step-down / stay / step-up (easier clef, longer round) so the next sight-reading round matches the learner.",
    howZh: "每轮结束后 Jev 评估下一轮视奏难度（降/保持/升）" },
  { id: "coach-focus", icon: "✋", th: "เลือกจุดโฟกัสครูมือกล้อง", en: "Pick the camera coach's lead cue", zh: "镜头指导焦点",
    howTh: "Jev เลือกว่าคำแนะนำครูมือควรเริ่มที่อะไร: นิ้วแบน / ข้อมือตก / นิ้วโป้งหุบ / ชม — แก้จุดที่ใหญ่ที่สุดก่อน",
    howEn: "Jev picks which signal the AI hand critique leads with: flat fingers / dropping wrist / tucked thumb / praise — fixing the biggest issue first.",
    howZh: "Jev 选择手部指导的首要纠正点" },
  { id: "practice-next", icon: "🧭", th: "แนะนำก้าวถัดไปหลังจบ drill", en: "Suggest the next step after a drill", zh: "练习后下一步建议",
    howTh: "หลังจบ drill Jev เลือกว่าควร ซ้ำ drill เดิม / ไปขั้นถัดไป / ลองบอส / เปิดโค้ช — ตามสัญญาณจริงของรอบนั้น",
    howEn: "After a drill Jev picks replay-the-same / next stage / group boss / open-the-coach, grounded in that round's real signals.",
    howZh: "Jev 根据本轮表现建议重练/下一关/挑战Boss/找教练" },
  { id: "shop-headline", icon: "💎", th: "เลือกแพ็กเกจที่แสดงเด่น (ร้านค้า)", en: "Pick the headline gem package (shop)", zh: "商店推荐套餐",
    howTh: "Jev เลือกว่าร้านค้าควรโชว์แพ็กไหนก่อนสำหรับผู้เรียนคนนี้ — เล็กสำหรับมือใหม่ / กลางสำหรับคนประจำ / ใหญ่สำหรับผู้ใช้หนัก",
    howEn: "Jev picks which top-up pack the shop headlines for THIS learner — small for newcomers, mid for regulars, large for heavy engaged users.",
    howZh: "Jev 为不同学员选择优先展示的充值套餐" },
];

export function AdminJevTasks({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [cfg, setCfg] = useState(null);   // null = loading; { "<task>": { enabled } }
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(() => {
    sb.from("app_settings").select("value").eq("key", "jev_tasks").maybeSingle()
      .then(r => setCfg((r && r.data && r.data.value && typeof r.data.value === "object") ? r.data.value : {}), () => setCfg({}));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(taskId) {
    if (!cfg || busy) return;
    setBusy(taskId); setSaved("");
    const cur = cfg[taskId] || {};
    const next = { ...cfg, [taskId]: { ...cur, enabled: cur.enabled !== true } };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "jev_tasks", p_value: next });
    setBusy("");
    if (error) { alert(error.message || "error"); return; }
    setCfg(next); setSaved(taskId); playUi("click");
    setTimeout(() => setSaved(""), 2500);
  }

  if (cfg === null) return <div className="admstu"><div className="admstu-msg">⏳</div></div>;

  return (
    <div className="admstu">
      <div className="admmg-h" style={{ margin: "2px 2px 10px", lineHeight: 1.5 }}>
        ⚡ {T("งานตัดสินใจด้วย Jev (TypeSafe AI)", "Jev decision tasks (TypeSafe AI)", "Jev 决策任务（TypeSafe AI）")}
      </div>
      <div className="admstu-row-sub" style={{ margin: "0 2px 12px", whiteSpace: "normal", lineHeight: 1.7 }}>
        {T("Jev เป็นโมเดล 'ตัดสินใจ' ไม่ใช่โมเดลแชท — เร็วกว่า ~200 เท่า ถูกกว่า ~400 เท่า ใช้กับงานจำแนก/ให้คะแนน/คัดกรอง ส่วนงานสร้างข้อความยังใช้โมเดลหลักเหมือนเดิม (แท็บ 🧠 โมเดล AI)",
          "Jev is a decision model, not a chat model — ~200x faster, ~400x cheaper for classify/score/filter work. Text generation still runs on the main models (see the 🧠 AI Models tab).",
          "Jev 是决策模型而非聊天模型 — 分类/评分/过滤快约200倍、省约400倍；文本生成仍由主模型完成（见 🧠 AI 模型）")}
        <br />🔐 {T("ต้องมี TYPESAFE_API_KEY ใน Supabase secrets ของฟังก์ชัน piano-jev ก่อนจึงจะทำงานจริง — ปิดอยู่ = แอปใช้วิธีเดิมทันที ไม่มีอะไรพัง",
          "Requires TYPESAFE_API_KEY in the piano-jev function's Supabase secrets to take effect — a disabled task simply falls back to the previous behavior, nothing breaks.",
          "需在 piano-jev 函数的 Supabase secrets 中配置 TYPESAFE_API_KEY — 关闭的任务回退到原有行为")}
      </div>
      {JEV_TASKS.map(t => {
        const on = cfg[t.id] && cfg[t.id].enabled === true;
        return (
          <div className="admmg" key={t.id}>
            <div className="admmg-h">{t.icon} {T(t.th, t.en, t.zh)}</div>
            <div className="admstu-row-sub" style={{ marginBottom: 8, whiteSpace: "normal", lineHeight: 1.6 }}>
              {lang === "th" ? t.howTh : lang === "zh" ? t.howZh : t.howEn}
            </div>
            <div className="admmg-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className={`songbtn ${on ? "go" : "ghost"}`} disabled={busy === t.id} onClick={() => toggle(t.id)}
                style={{ padding: "8px 16px" }}>
                {busy === t.id ? "⏳" : on ? "✅ " + T("เปิดอยู่", "ON", "已开启") : "⛔ " + T("ปิดอยู่", "OFF", "已关闭")}
              </button>
              <span className="admstu-row-sub" style={{ margin: "auto 0 auto auto" }}>
                {saved === t.id ? <span style={{ color: "#d97757" }}>✓ {T("บันทึกแล้ว — มีผลภายใน ~1 นาที", "Saved — effective within ~1 min", "已保存 — 约1分钟内生效")}</span>
                  : on ? T("Jev กำลังทำงานนี้", "Jev is handling this", "Jev 正在处理") : T("ใช้วิธีเดิม (ไม่มี Jev)", "Legacy path (no Jev)", "原有路径（无 Jev）")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Admin nav: one button that expands into business-category groups ── */
const ADMIN_NAV_GROUPS = [
  { id: "ai", icon: "🤖", th: "AI และคอนเทนต์", en: "AI & Content", zh: "AI 与内容", items: [
    { id: "ai", icon: "🤖", tier: 3, th: "สอน AI", en: "Teach AI", zh: "训练 AI" },
    { id: "aimodel", icon: "🧠", tier: 3, th: "โมเดล AI", en: "AI Models", zh: "AI 模型" },
    { id: "jev", icon: "⚡", tier: 3, th: "งาน Jev", en: "Jev Tasks", zh: "Jev 任务" },
    { id: "tigamodel", icon: "🧪", tier: 3, th: "TIGA Model Lab", en: "TIGA Model Lab", zh: "TIGA 模型实验室" },
    { id: "tigabackoffice", icon: "🧠", tier: 3, th: "หลังบ้าน TIGA", en: "TIGA Back Office", zh: "TIGA 后台" },
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
