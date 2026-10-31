import { memo, useEffect, useMemo, useRef, useState } from "react";
import { L } from "./i18n";
import { extractNotes, getAC } from "./music-engine";
import { stopSpeaking, stopCloudTTS, speakCloud, speakDeviceOrNative, detectSpeechLang, ttsEstSeconds, ttsBudgetSpend, ttsBudgetRefund, CHAT_TTS_RATE } from "./speech";
import { askQuestionOf, splitAskLine, nextActionOf } from "./chat-coach";
import { CATS, CAT_ICON, catLevel, readKnow, catPoints, BADGES, readBadges, QUEST_GOAL, QUEST_EXP, readQuest } from "./chat-store";

/* ── chat-ui.tsx ──
   Chat UI atoms shared by every chat surface (Sensei page, expanded chat
   modal): the message bubble (Msg), typing indicator (Typing), text input
   (Input), and the read-aloud button at the foot of a bubble (BubbleSpeak).
   Extracted from App.tsx as part of the App.tsx modularization. ── */

/* ── The chat's read-aloud (T2S) — OFF (owner, 2026-10-02) ──
   "ปิดระบบ t2s ในฟีเจอร์ tiga chat ทั้งหมด ซ่อนไว้ก่อน เทคโนโลยียังไม่พร้อม".
   One flag, every surface obeys it:
   - Msg below never renders BubbleSpeak, so no speaker appears in the chat (the
     Sensei page or the full-screen chat) whatever plan the learner is on.
   - PricingOverlay hides the "🔊 ปุ่มลำโพงในแชท" bullet on the Max and Max Family
     cards — a plan must never advertise a feature that is switched off.
   - speech.ts, the clip cache, the day's cloud allowance and the piano-tts edge
     function are all untouched, as is Voice Tutor (use-voice-tutor.ts, its own
     TTS_RATE). Turning this back on is one `true`.
   Kept as a const literal so esbuild drops the dead branch from the bundle
   (same pattern as AI_CREATE_SONG_ENABLED / LANG_PICKER_ENABLED). */
export const CHAT_TTS_ENABLED = true;


/* ── The read-aloud button on a chat bubble (owner, 2026-10-01) ──
   A small speaker at the bottom-right end of every message — the learner's and the tutor's — that says it aloud in one soft,
   natural male voice, in the language the message is written in (Thai, English or Mandarin: detectSpeechLang). It is a paid
   feature: Max and Max Family (and the owner's admin account) hear it; everyone else sees the button with a small lock and a
   tap opens the plans (mode "locked").
   The voice is Gemini TTS through the piano-tts function — real money per word — so a clip heard before comes from the local
   cache for nothing (speech.ts), and each device has a day's allowance of cloud speech (ttsBudgetSpend). When the cloud is out
   of reach or the allowance is spent the message is read by the device's own voice instead: a tap is never silent.
   Only one message speaks at a time (activeId is shared by the whole chat); a tap on the one that is speaking stops it. */
export const BubbleSpeak = memo(function BubbleSpeak({ text, lang, id, activeId, setActiveId, mode, onLocked }) {
  const lc = L[lang];
  const isOn = activeId === id;
  const [busy, setBusy] = useState(false);          // asked for, no sound yet
  const [note, setNote] = useState("");             // a few words beside the button: today's AI voice is used up
  const ticket = useRef(0);                         // a stop, a new tap or another message taking over makes an older run's callbacks stale
  useEffect(() => { if (!isOn) { ticket.current++; setBusy(false); } }, [isOn]);
  useEffect(() => () => { ticket.current++; }, []);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(""), 5000);
    return () => clearTimeout(t);
  }, [note]);

  function stop() {
    ticket.current++;
    stopSpeaking(); stopCloudTTS();
    setBusy(false); setActiveId(null);
  }
  function tap() {
    if (mode === "locked") { if (onLocked) onLocked(); return; }
    if (isOn) { stop(); return; }
    getAC();                                        // unlock audio inside the tap (iOS Safari)
    const said = detectSpeechLang(text, lang);
    const t = ++ticket.current;
    const live = () => t === ticket.current;
    const done = () => { if (live()) { setBusy(false); setActiveId(null); } };
    setNote(""); setActiveId(id); setBusy(true);
    const device = (budget, rest) => {
      if (!live()) return;                          // stopped, or another message took over, while the cloud was answering
      if (budget) setNote(lc.spkLimit);
      setBusy(false);
      // `rest` is what the cloud did not get to: the cloud voice already read the
      // first part, so the device voice continues from there instead of repeating
      // the whole message. Without it (first chunk failed, or the day's allowance
      // was short) `rest` is empty and the device reads everything, as before.
      speakDeviceOrNative(rest || text, said, done, done).catch(done);
    };
    speakCloud(text, said,
      () => { if (live()) setBusy(false); },
      done,
      (e) => device(!!(e && e.budget), e && e.rest),
      CHAT_TTS_RATE,
      { src: "chat", spend: (s) => ttsBudgetSpend(ttsEstSeconds(s, said)), refund: (s) => ttsBudgetRefund(ttsEstSeconds(s, said)) });
  }

  const locked = mode === "locked";
  const label = locked ? lc.spkMax : isOn ? lc.spkStop : lc.spkAria;
  return (
    <>
      {note && <span className="bspk-note" role="status">{note}</span>}
      <button type="button" className={`bspk${isOn ? " on" : ""}${locked ? " lock" : ""}`} onClick={tap}
        title={label} aria-label={label} aria-pressed={locked ? undefined : isOn} aria-busy={isOn && busy ? true : undefined}>
        {isOn && busy
          ? <span className="bspk-spin" aria-hidden="true" />
          : isOn
            ? <span className="bspk-bars" aria-hidden="true"><i /><i /><i /></span>
            : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path d="M4 9.4v5.2h3.7l4.6 4V5.4l-4.6 4H4z" fill="currentColor" />
                <path d="M15.6 8.6a4.8 4.8 0 0 1 0 6.8M18.1 6a8.4 8.4 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
        {locked && (
          <span className="bspk-lock" aria-hidden="true">
            <svg viewBox="0 0 12 12" width="7" height="7" focusable="false">
              <rect x="2" y="5.2" width="8" height="5.6" rx="1.2" fill="currentColor" />
              <path d="M3.9 5.4V4a2.1 2.1 0 0 1 4.2 0v1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </span>
        )}
      </button>
    </>
  );
});

/* ── Light formatting for the tutor's answers ──
   **bold**, "- " bullets, "1." steps and "#" headings (shown as bold) — and
   nothing else. The tutor is asked to write plain text with a little of this,
   and without it the learner sees stray asterisks. It builds React elements,
   never HTML, so nothing the model writes can inject markup; a line it does not
   recognise is kept exactly as typed. A message with none of these markers
   keeps the plain pre-wrap paragraph it always had (see Msg). */
const RICH_MARKS = /\*\*|^\s*(?:[-•*]|\d+[.)])\s|^#{1,6}\s/m;
function inlineBold(text: string, keyBase: string) {
  const parts = text.split(/\*\*([^*\n]+)\*\*/g);
  return parts.map((t, i) => (i % 2 === 1 ? <strong key={keyBase + i}>{t}</strong> : t));
}
function RichText({ text }: { text: string }) {
  const lines = String(text).split("\n");
  return (
    <div className="rt">
      {lines.map((raw, i) => {
        if (!raw.trim()) return <div key={i} className="rt-gap" />;
        const h = raw.match(/^#{1,6}\s+(.*)$/);
        if (h) return <div key={i}><strong>{inlineBold(h[1], i + "h")}</strong></div>;
        const b = raw.match(/^\s*(?:[-•*])\s+(.*)$/);
        if (b) return <div key={i} className="rt-li"><span className="rt-dot" aria-hidden="true">•</span><span>{inlineBold(b[1], i + "b")}</span></div>;
        const n = raw.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (n) return <div key={i} className="rt-li"><span className="rt-dot rt-num" aria-hidden="true">{n[1]}.</span><span>{inlineBold(n[2], i + "n")}</span></div>;
        return <div key={i}>{inlineBold(raw, i + "p")}</div>;
      })}
    </div>
  );
}

/* ── The question back (plan 19 §5-C) ──
   The tutor closes an explanation with one checkable question; this renders it
   as three buttons. Tapping is the whole interaction — no typing, no second
   round-trip — because the point is to make the chat something you PLAY rather
   than something you read. The answer comes from chat-coach.ts, which either
   read the tutor's own [? … ] line or built the check from note names the
   tutor wrote, so it is always a fact the tutor can stand behind. */
export const AskRow = memo(function AskRow({ ask, lang, onAnswer, onMark }) {
  const lc = L[lang];
  const [picked, setPicked] = useState(null);
  if (!ask) return null;
  const right = picked === ask.answer;
  const done = picked !== null;
  return (
    <div className="askbox">
      <div className="askq">{ask.q}</div>
      <div className="askopts">
        {ask.opts.map((o, i) => {
          const isRight = i === ask.answer;
          // after an answer, the right one is marked and the wrong one that was
          // chosen is marked too — never leave the learner guessing which one
          // the app thought was right.
          const cls = !done ? "" : isRight ? " ok" : (i === picked ? " no" : "");
          return (
            <button key={i} type="button" className={`askopt${cls}`} disabled={done} onClick={() => { setPicked(i); if (onAnswer) onAnswer(i === ask.answer); }}>
              <span>{o}</span>
              {done && isRight && <b aria-hidden="true">✓</b>}
            </button>
          );
        })}
      </div>
      {done && (
        <>
          <div className={"askverdict" + (right ? " ok pop" : " no")} role="status">{right ? "✨ " : ""}{right ? lc.chkGot : lc.chkNo}</div>
          {!right && (
            <button type="button" className="askagain" onClick={() => setPicked(null)}>{lc.chkTry}</button>
          )}
          {/* Marking it is what makes the loop measurable: the learner's own
              answer (not the model's guess about it) goes into the same memory
              the tutor reads next session. */}
          <div className="askmark">
            <button type="button" className="markbtn yes" onClick={() => onMark && onMark(right ? 100 : 70)}>
              <span aria-hidden="true">✓</span><span>{lc.chkDone}</span>
            </button>
            <button type="button" className="markbtn no" onClick={() => onMark && onMark(50)}>
              <span aria-hidden="true">↺</span><span>{lc.chkNotYet}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
});

/* ── Progress strip under the input (plan 19 §5-A) ──
   Zero cost: every number here already exists (profile.streak, today's chat
   count, the daily quest). The chat was the only page with no visible progress
   at all, which is most of why reading it felt like homework rather than a
   session you are part of. */
export function ChatProgress({ lang, streak, askedToday, questCount, questGoal, expToday, always = false }) {
  const lc = L[lang];
  /* `always` (plan 26 · P2): used where this bar is the page's goal line rather
     than a footnote — a learner whose streak is still 0 is exactly the one who
     most needs to see what they are working towards, so there the bar renders
     even at zero. The default keeps the old behaviour everywhere else. */
  if (!always && !streak && !askedToday && !questCount) return null;
  const questDone = Math.min(questCount || 0, questGoal || 0);
  return (
    <div className={"chatprog" + (always ? " chatprog-top" : "")} role="status">
      {always
        ? <span className="cp-i">🔥 {streak || 0} {lc.chkDay}</span>
        : streak > 0 && <span className="cp-i">🔥 {streak} {lc.chkDay}</span>}
      {askedToday > 0 && <span className="cp-i">💬 {askedToday} {lc.chkStreak}</span>}
      {always
        ? <span className="cp-i">🎯 {questDone}/{questGoal} {lc.chkQuest}</span>
        : questCount > 0 && (
          <span className="cp-i">
            🎯 {questDone}/{questGoal} {lc.chkQuest}
          </span>
        )}
      {expToday > 0 && <span className="cp-i cp-exp">+{expToday} EXP</span>}
    </div>
  );
}

/* ── Message (memoized: only re-renders when its own props change) ── */
export const Msg = memo(function Msg({ m, idx, lang, activeSpk, setActiveSpk, onPlay, onRetry, onMore = null, speakMode = "off", onSpeakLocked = null, onMark = null, onGoStep = null }) {
  // parse notes only when the message text or language actually changes
  const parsed = useMemo(
    () => (m.role === "ai" && m.text && !m.noSeq ? (m.seq && Array.isArray(m.seq.notes) && m.seq.notes.length ? m.seq : extractNotes(m.text)) : null),
    [m.role, m.text, m.seq, m.noSeq]
  );
  const lc = L[lang];
  /* An answer is placed in the thread the moment it is asked for and filled in
     when it arrives, so between those two moments this rendered a bubble with
     an empty paragraph in it — a labelled box with nothing inside, which reads
     as the app having hung rather than as it working. It gets the same three
     bouncing dots the standalone Typing indicator uses; three because that is
     already this app's sign for "thinking" and a second, different count would
     be a second sign for the same thing. */
  const waiting = m.role === "ai" && !m.text && !m.img;
  /* The tutor's [? … ] check line is markup, not prose: it is split out here so
     the bubble shows the explanation and the buttons show the question. Pure
     and cheap (a regex over the last lines), so it costs nothing per token
     while the answer streams in. */
  const split = useMemo(() => (m.role === "ai" && m.text && !m.error ? splitAskLine(m.text) : null), [m.role, m.text, m.error]);
  const bodyText = split ? split.text : (m.text || "");
  const ask = useMemo(() => (split && split.had && m.live !== false && !m.error ? askQuestionOf(m.text, lang) : null), [m, m.text, split, lang]);
  const act = useMemo(() => (m.role === "ai" && !m.error && !waiting && onGoStep ? nextActionOf(String(m.text || ""), lang) : null), [m.role, m.text, m.error, waiting, onGoStep, lang]);
  /* The tutor now answers short on purpose; under the newest live answer a
     tap asks for the long version. Not on errors, chapters or local replies. */
  const showMore = !!onMore && m.role === "ai" && !!m.live && !m.error && !waiting && String(m.text || "").length >= 60;
  /* The speaker sits inside the bubble, at its bottom-right end — on both the tutor's and the learner's messages, but not on an
     answer that is still coming, a failed one, or one with no words in it. */
  const canSpeak = CHAT_TTS_ENABLED && speakMode !== "off" && !waiting && !m.error && String(m.text || "").trim().length > 0;
  return (
    <div className={`msg ${m.role === "user" ? "u" : "a"}`}>
      <div className="bbl">
        {m.role === "ai" && <div className="atag">◈ TIGA CHAT</div>}
        {m.img && <img src={m.img} alt="" className="adminimg" />}
        {waiting
          ? <div className="typing" role="status" aria-live="polite"
                 aria-label={lang === "th" ? "กำลังคิดคำตอบ" : lang === "zh" ? "正在思考" : "Thinking"}>
              <div className="tdd" /><div className="tdd" /><div className="tdd" />
            </div>
          : (m.role === "ai" && RICH_MARKS.test(bodyText))
            ? <RichText text={bodyText} />
            : <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{bodyText}</p>}
        {canSpeak && (
          <div className="bblf">
            <BubbleSpeak text={String(m.role === "ai" ? bodyText : m.text)} lang={lang} id={idx} activeId={activeSpk} setActiveId={setActiveSpk}
              mode={speakMode} onLocked={onSpeakLocked} />
          </div>
        )}
      </div>
      {/* the row is skipped entirely when it would be empty, so a message with nothing to offer leaves no stray gap under it */}
      {/* One-tap retry on a failed answer — the question is still in the thread
          right above, so ↻ resends it verbatim instead of making the learner
          retype it (the #1 most-requested recovery after a dropped reply). */}
      {m.role === "ai" && m.error && onRetry && (
        <div className="mact">
          <button className="retrybtn" onClick={onRetry}>
            <span>↻</span><span>{lang === "th" ? "ลองส่งใหม่" : lang === "zh" ? "重试" : "Retry"}</span>
          </button>
        </div>
      )}
      {m.role === "ai" && ask && !waiting && (
        <AskRow ask={ask} lang={lang}
          onAnswer={(ok) => { if (onMark) onMark(ok ? 100 : 55, ask); }}
          onMark={(acc, a) => { if (onMark) onMark(acc, a || ask); }} />
      )}
      {/* One next action, and only when the answer is actually about doing
          something — a button on every reply is a button nobody reads. The
          destination is resolved by PianoApp's own resolveCoachStep, so there
          is exactly one routing table in the app. */}
      {m.role === "ai" && act && !waiting && !m.error && onGoStep && (
        <div className="mact">
          <button className="actbtn" onClick={() => onGoStep(act.step)}>
            <span aria-hidden="true">{act.icon}</span><span>{act.label}</span>
          </button>
        </div>
      )}
      {m.role === "ai" && !waiting && (parsed || showMore) && (
        <div className="mact">
          {parsed && (
            <button className="playbtn" onClick={() => onPlay(parsed)}>
              <span>▶</span><span>{lang === "th" ? "เล่นโน้ต" : lang === "zh" ? "演奏" : "PLAY"}</span>
            </button>
          )}
          {parsed && <span className="nlbl">{parsed.label}</span>}
          {showMore && (
            <button className="morebtn" onClick={onMore}>
              <span aria-hidden="true">＋</span><span>{lc.chatMore}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export const Typing = memo(function Typing({ slow, lang }) {
  const slowText = lang === "th"
    ? "ยังเชื่อมต่ออยู่ — กำลังลองใหม่อัตโนมัติ…"
    : lang === "zh"
    ? "仍在连接中 — 正在自动重试…"
    : "Still connecting — retrying automatically…";
  return (
    <div className="msg a">
      <div className="bbl">
        <div className="atag">◈ TIGA CHAT</div>
        <div className="typing"><div className="tdd"/><div className="tdd"/><div className="tdd"/></div>
        {slow && <div className="slowhint">{slowText}</div>}
      </div>
    </div>
  );
});

export function Input({ val, onChange, onSend, loading, ph, note = null, noteOut = false }) {
  function onKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }
  function onInput(e) {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px";
    onChange(e.target.value);
  }
  return (
    <>
      <div className="ir">
        <textarea className="tin" value={val} placeholder={ph} aria-label={ph}
          onChange={onInput} onKeyDown={onKey} rows={1} />
        <button className="snd" disabled={loading || !val.trim()} onClick={onSend}
          aria-label={ph}>➤</button>
      </div>
      {/* free messages left today — only for a free account, only when given one */}
      {note && <div className={"qnote" + (noteOut ? " out" : "")} role="status">{note}</div>}
    </>
  );
}


/* ── conversation history ──
   Two small buttons for the chat header (history · new chat) and the sheet they open: every saved
   conversation as a card, filed under six categories that each level up as questions are asked in
   them, with search, pin and delete. The categories and levels are computed on the device from what
   the learner asked: nothing here costs a model call, an EXP point or a coin. */
const HT = (lang, th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
const CAT_NAME = { theory: ["ทฤษฎี", "Theory", "乐理"], technique: ["เทคนิค", "Technique", "技巧"], ear: ["ฝึกหู", "Ear", "听力"], reading: ["อ่านโน้ต", "Reading", "读谱"], songs: ["เพลง", "Songs", "歌曲"], other: ["อื่น ๆ", "Other", "其他"] };
const catName = (c, lang) => { const n = CAT_NAME[c] || CAT_NAME.other; return HT(lang, n[0], n[1], n[2]); };
function whenOf(ts, lang) {
  const d = Date.now() - ts, m = 60000;
  if (d < m * 2) return HT(lang, "เมื่อครู่", "just now", "刚刚");
  if (d < m * 60) return Math.round(d / m) + HT(lang, " นาทีที่แล้ว", " min ago", " 分钟前");
  if (d < m * 60 * 24) return Math.round(d / (m * 60)) + HT(lang, " ชม.ที่แล้ว", " h ago", " 小时前");
  if (d < m * 60 * 24 * 7) return Math.round(d / (m * 60 * 24)) + HT(lang, " วันที่แล้ว", " d ago", " 天前");
  try { return new Date(ts).toLocaleDateString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short" }); } catch (e) { return ""; }
}
export function ChatHistoryButtons({ lang, onHistory, onNew, count = 0 }) {
  return (
    <span className="chhbtns">
      <button type="button" className="chhbtn" onClick={onHistory} aria-label={HT(lang, "ประวัติแชต", "Chat history", "聊天记录")} title={HT(lang, "ประวัติแชต", "Chat history", "聊天记录")}>
        <span aria-hidden="true">🗂</span>{count > 0 && <i className="chhbtn-n">{count > 99 ? "99+" : count}</i>}
      </button>
      <button type="button" className="chhbtn" onClick={onNew} aria-label={HT(lang, "แชตใหม่", "New chat", "新对话")} title={HT(lang, "แชตใหม่", "New chat", "新对话")}><span aria-hidden="true">＋</span></button>
    </span>
  );
}
export function ChatHistorySheet({ open, lang, threads, activeId, onClose, onOpen, onNew, onDelete, onPin, onMove }) {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [undo, setUndo] = useState(null);
  const [menu, setMenu] = useState(null);
  const undoTimer = useRef(null);
  const [hidden, setHidden] = useState([]);   // deleted a moment ago: hidden now, really removed after 5 s unless undone
  useEffect(() => { if (!open) { setQ(""); setMenu(null); } }, [open]);
  // each category's level: how many threads are filed in it (a thread is a question asked and kept)
  const know = useMemo(() => (open ? readKnow() : {}), [open, threads]);
  const pts = useMemo(() => catPoints(threads, know), [threads, know]);
  const badges = useMemo(() => (open ? readBadges() : {}), [open, threads]);
  const understood = useMemo(() => CATS.reduce((a, c) => a + (know[c] || 0), 0), [know]);
  const counts = useMemo(() => { const c = { all: threads.length }; for (const k of CATS) c[k] = 0; for (const t of threads) c[t.cat] = (c[t.cat] || 0) + 1; return c; }, [threads]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return threads.filter(t => !hidden.includes(t.id) && (cat === "all" || t.cat === cat) && (!s || (t.title + " " + t.last).toLowerCase().includes(s)));
  }, [threads, cat, q, hidden]);
  if (!open) return null;
  const del = (t) => {
    // a delete that is really removed only after the undo window; a second delete settles the first one
    if (undo) { clearTimeout(undoTimer.current); onDelete(undo.id); setHidden(h => h.filter(x => x !== undo.id)); }
    setHidden(h => h.concat(t.id)); setUndo(t);
    undoTimer.current = setTimeout(() => { onDelete(t.id); setHidden(h => h.filter(x => x !== t.id)); setUndo(null); }, 5000);
  };
  const undoDel = () => { clearTimeout(undoTimer.current); if (undo) setHidden(h => h.filter(x => x !== undo.id)); setUndo(null); };
  return (
    <div className="chhov" role="dialog" aria-modal="true" aria-label={HT(lang, "ประวัติแชต", "Chat history", "聊天记录")} onClick={onClose}>
      <div className="chhsheet" onClick={e => e.stopPropagation()}>
        <div className="chhhead">
          <b>{HT(lang, "ประวัติแชต", "Chat history", "聊天记录")}</b>
          <button type="button" className="chhnew" onClick={onNew}>＋ {HT(lang, "แชตใหม่", "New chat", "新对话")}</button>
          <button type="button" className="chhx" onClick={onClose} aria-label={HT(lang, "ปิด", "Close", "关闭")}>×</button>
        </div>
        <input className="chhsearch" value={q} onChange={e => setQ(e.target.value)} placeholder={HT(lang, "ค้นหาแชต…", "Search chats…", "搜索对话…")} aria-label={HT(lang, "ค้นหา", "Search", "搜索")} />
        <div className="chhcats" role="tablist">
          <button type="button" role="tab" aria-selected={cat === "all"} className={"chhcat" + (cat === "all" ? " on" : "")} onClick={() => setCat("all")}>
            {HT(lang, "ทั้งหมด", "All", "全部")} <i>{counts.all}</i>
          </button>
          {CATS.map(k => { const lv = catLevel(pts[k] || 0); return (
            <button type="button" role="tab" aria-selected={cat === k} key={k} className={"chhcat" + (cat === k ? " on" : "")} onClick={() => setCat(k)}>
              <span aria-hidden="true">{CAT_ICON[k]}</span> {catName(k, lang)} <i>Lv {lv.lv}</i>
              <span className="chhcat-bar"><span style={{ width: Math.round(lv.pct * 100) + "%" }} /></span>
            </button>); })}
        </div>
        <div className="chhbadges" aria-label={HT(lang, "ตราสะสม", "Badges", "徽章")}>
          {BADGES.map(b => { const got = !!badges[b.id]; return (
            <span key={b.id} className={"chhbadge" + (got ? " got" : "")} title={HT(lang, b.dth, b.den, b.dzh)}>
              <i aria-hidden="true">{got ? b.icon : "🔒"}</i><em>{HT(lang, b.th, b.en, b.zh)}</em>
            </span>); })}
        </div>
        <div className="chhknow" aria-label={HT(lang, "สมุดความรู้", "Knowledge log", "知识记录")}>
          <span>💡 {HT(lang, "เข้าใจแล้ว", "Understood", "已理解")} <b>{understood}</b></span>
          <span>💬 {HT(lang, "แชต", "Chats", "对话")} <b>{counts.all}</b></span>
          <span>⭐ {HT(lang, "ปักหมุด", "Pinned", "置顶")} <b>{threads.filter(t => t.pinned).length}</b></span>
        </div>
        <div className="chhlist">
          {list.length === 0 && (
            <div className="chhempty">{threads.length === 0
              ? HT(lang, "ยังไม่มีแชต — ถามอะไรสักอย่างแล้วมันจะมาอยู่ที่นี่", "No chats yet — ask something and it will be kept here", "还没有对话，提问后会保存在这里")
              : HT(lang, "ไม่พบแชตที่ตรงกัน", "No matching chats", "没有匹配的对话")}</div>
          )}
          {list.map(t => (
            <div key={t.id} className={"chhcard" + (t.id === activeId ? " cur" : "")}>
              <button type="button" className="chhcard-main" onClick={() => onOpen(t.id)}>
                <span className="chhcard-ic" aria-hidden="true">{CAT_ICON[t.cat] || "💬"}</span>
                <span className="chhcard-tx">
                  <b>{t.pinned ? "⭐ " : ""}{t.title}</b>
                  <i>{t.last}</i>
                  <em>{catName(t.cat, lang)} · {whenOf(t.updated, lang)}</em>
                </span>
              </button>
              <button type="button" className="chhcard-b" onClick={() => onPin(t.id, !t.pinned)} aria-label={t.pinned ? HT(lang, "เลิกปักหมุด", "Unpin", "取消置顶") : HT(lang, "ปักหมุด", "Pin", "置顶")}>{t.pinned ? "★" : "☆"}</button>
              <button type="button" className="chhcard-b" onClick={() => setMenu(menu === t.id ? null : t.id)} aria-label={HT(lang, "ย้ายหมวด", "Move to category", "移动分类")}>⋯</button>
              <button type="button" className="chhcard-b" onClick={() => del(t)} aria-label={HT(lang, "ลบ", "Delete", "删除")}>🗑</button>
              {menu === t.id && (
                <div className="chhmove">
                  {CATS.map(k => <button type="button" key={k} className={k === t.cat ? "on" : ""} onClick={() => { onMove(t.id, k); setMenu(null); }}>{CAT_ICON[k]} {catName(k, lang)}</button>)}
                </div>
              )}
            </div>
          ))}
        </div>
        {undo && (
          <div className="chhundo" role="status">{HT(lang, "ลบแล้ว", "Deleted", "已删除")}: {undo.title}
            <button type="button" onClick={undoDel}>{HT(lang, "เลิกทำ", "Undo", "撤销")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── today's chat quest + the badge toast (the game layer of the chat) ── */
export function ChatQuest({ lang, tick = 0 }) {
  const q = readQuest(); const n = Math.min(q.n, QUEST_GOAL); void tick;
  return (
    <div className={"chquest" + (n >= QUEST_GOAL ? " done" : "")} role="status">
      <span className="chquest-ic" aria-hidden="true">{n >= QUEST_GOAL ? "🏅" : "🎯"}</span>
      <span className="chquest-tx">{HT(lang, "เควสต์วันนี้: เข้าใจให้ได้ " + QUEST_GOAL + " เรื่อง", "Today's quest: understand " + QUEST_GOAL + " things", "今日任务：理解 " + QUEST_GOAL + " 件事")}</span>
      <span className="chquest-bar" aria-hidden="true"><span style={{ width: Math.round((n / QUEST_GOAL) * 100) + "%" }} /></span>
      <b className="chquest-n">{n}/{QUEST_GOAL}</b>
      {n >= QUEST_GOAL && <em>{HT(lang, "สำเร็จ! +" + QUEST_EXP + " EXP", "Done! +" + QUEST_EXP + " EXP", "完成！+" + QUEST_EXP + " EXP")}</em>}
    </div>
  );
}
export function BadgeToast({ badge, lang, onDone }) {
  useEffect(() => { if (!badge) return undefined; const t = setTimeout(onDone, 3800); return () => clearTimeout(t); }, [badge]);
  if (!badge) return null;
  return (
    <div className="chbadgetoast" role="status" onClick={onDone}>
      <span className="chbadgetoast-ic" aria-hidden="true">{badge.icon}</span>
      <span><small>{HT(lang, "ปลดล็อกตราใหม่!", "New badge!", "解锁新徽章！")}</small><b>{HT(lang, badge.th, badge.en, badge.zh)}</b><i>{HT(lang, badge.dth, badge.den, badge.dzh)}</i></span>
    </div>
  );
}
