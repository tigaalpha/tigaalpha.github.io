/* ── tigamodel/teaching/joy.js ──
   PLAN v3.8 — ระลอก 12 (12.1) JoyIndex v1 SHADOW — มิติที่ 10: ความสุขของผู้เรียน
   Round 12.1: the 10th multiplication dimension — "เรียนแล้วมีความสุข" —
   becomes measurable, from behaviour the app ALREADY logs. No new schema,
   no new prompts, no dashboard of guilt.

   THE IRON RULES (plan ระลอก 12, §0.11 reject criteria):
   • joy is measured from REAL behaviour already in the logs —
     tg_practice_log (per-day {n, accSum}) and tg_act_log
     (unified journal entries {t, d, k, id, ok, miss, sec}) — plus the
     per-song stars the Play Along store keeps (tg_stars_<id>) and the
     optional one-tap end-of-song mood (12.2, opt-in).
   • NO mandatory self-rating. The only ask in the whole round is the
     optional single-tap mood on the song-result card (no answer = no
     record). This module contains no questionnaire and cannot become one.
   • NO invented numbers: every signal is a plain count over real entries,
     each one carries `source` (the exact log field it came from) so any
     number shown can be traced to the row that produced it. No secret
     weights — the score is the count of signals that fired, out of five.
   • SHADOW: this metric is measured + explainable and wired to NOTHING.
     It does not steer the queue (workOrder) until round 12.6's data rule
     (30 loop rounds) is met, and it never changes coins/exp/stars of a run.
   • honest-null: no evidence → null, never a guessed score; n < 30 →
     "not enough evidence" (the same rule as 7.2).
   • pure/sync, never throws — every function is wrapped; inputs passed in
     are never mutated. Language: every label is {th,en,zh}, per repo rule.

   THE FIVE SIGNALS (each = one behaviour the logs already contain):
     1. came_back_soon  — returned to practice within 2 days of the last
                          session (no long unexplained gap after playing)
     2. played_longer   — today's minutes exceed today's own average-per-
                          session baseline (they stayed past the plan)
     3. off_queue_song  — played a real (non-practice) song run that was
                          neither today's daily song nor their previous song
                          (chose to play for fun, unprompted)
     4. first_full_combo — a full-combo run on a song whose stored star
                          history shows no earlier clean run
     5. shared_card     — shared an achievement card (only present when the
                          app logs a share; absent logs = signal simply
                          cannot fire — it is never guessed)
   ── */

/* Trilingual label helper — every human-readable string in this module. */
function L3(th, en, zh) { return { th, en, zh }; }

/* Signal descriptors (data, not prose) — bench/smoke read this to prove the
   signal list is complete and that nothing here is a survey question. */
export const JOY_SIGNALS = [
  { key: "came_back_soon",   label: L3("กลับมาเร็ว", "Came back soon", "很快回来"),     ask: false },
  { key: "played_longer",    label: L3("เล่นยาวกว่ากำหนด", "Played longer", "练得比计划久"), ask: false },
  { key: "off_queue_song",   label: L3("เลือกเล่นเองนอกคิว", "Played off-queue", "自己选曲加练"), ask: false },
  { key: "first_full_combo", label: L3("คอมโบเต็มครั้งแรก", "First full combo", "首次全连"), ask: false },
  { key: "shared_card",      label: L3("แชร์การ์ด", "Shared a card", "分享成绩卡"),      ask: false },
];

const HONEST_NULL = {
  th: "ยังไม่มีหลักฐานเพียงพอ (ยังไม่มีการซ้อมใน log)",
  en: "Not enough evidence yet (no practice in the log)",
  zh: "证据不足（记录中还没有练习）",
};

/* ── small honest helpers ──────────────────────────────────────────── */
function num(v) { return typeof v === "number" && Number.isFinite(v) ? v : 0; }
function dayKeyOf(date) {
  try {
    const d = date instanceof Date ? date : new Date(num(date) || Date.now());
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  } catch (e) { return null; }
}
function isDayKey(k) { return typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k); }

/* Self-read mode (used by the app wiring, mirrors getCoachDiagnosis in
   web.js): read the same localStorage keys the app already writes. The
   smoke passes everything explicitly, so it never depends on a browser. */
function readLocal(json, fallback) {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(json);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) { return fallback; }
}
function readStarsMap() {
  const out = {};
  try {
    if (typeof localStorage === "undefined") return out;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf("tg_stars_") === 0) {
        const v = Number(localStorage.getItem(k));
        if (Number.isFinite(v)) out[k.slice("tg_stars_".length)] = v;
      }
    }
  } catch (e) {}
  return out;
}

/* ── SIGNAL EXTRACTION — every value is a count over real rows ────── */
export function readSignals({ practiceLog = null, actLog = null, starsById = null, daily = null, moods = null, now = null } = {}) {
  const today = isDayKey(now) ? now : dayKeyOf(now != null ? now : Date.now());
  const plog = practiceLog && typeof practiceLog === "object" ? practiceLog : {};
  const act = Array.isArray(actLog) ? actLog : [];
  const stars = starsById && typeof starsById === "object" ? starsById : {};

  /* per-day practice days, oldest→newest, real sessions only */
  const days = Object.keys(plog)
    .filter(isDayKey)
    .filter(k => num(plog[k] && plog[k].n) > 0)
    .sort();
  const dayMs = (a, b) => Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);

  const todayEntry = plog[today] || null;
  const todaySessions = todayEntry ? num(todayEntry.n) : 0;
  const todayAcc = todayEntry && todaySessions > 0 ? num(todayEntry.accSum) / todaySessions : null;

  /* 1. came_back_soon — yesterday (or the day before) had a session and
        today has one too. Source: tg_practice_log day keys. */
  let cameBack = false, cameBackFrom = null;
  if (todaySessions > 0) {
    for (const d of days) {
      if (d >= today) continue;
      const gap = dayMs(d, today);
      if (gap >= 1 && gap <= 2) { cameBack = true; cameBackFrom = d; break; }
    }
  }

  /* 2. played_longer — today's minutes (tg_act_log k="game"/"drill" sec,
        the same rows that feed the practice-time charts) exceed today's own
        average minutes per session. Baseline is the day itself, so this can
        only fire when they kept going past their own rhythm today. */
  const DAY_MS = 86400000;
  const todayStart = new Date(today + "T00:00:00").getTime();
  let todayMin = 0;
  for (const a of act) {
    if (!a || typeof a !== "object") continue;
    if (a.k !== "game" && a.k !== "drill") continue;
    const t = num(a.t);
    if (!t || t < todayStart || t >= todayStart + DAY_MS) continue;
    todayMin += Math.max(0, num(a.sec)) / 60;
  }
  const avgPerSession = todaySessions > 0 ? todayMin / todaySessions : 0;
  const playedLonger = todaySessions >= 1 && todayMin >= 10 && todayMin > avgPerSession * 1.25;

  /* 3. off_queue_song — a real (non-practice) song run today whose id is
        not the daily song (the one the queue asked for). Any other song is
        a song they picked themselves from the list — that IS "chose to play
        off-queue". Source: tg_act_log k="game" ids + tg_daily_song. */
  const dailyId = daily && typeof daily === "object" ? String(daily.id || "") : "";
  let offQueue = null;
  for (const a of act) {
    if (!a || typeof a !== "object" || a.k !== "game") continue;
    const t = num(a.t);
    if (!t || t < todayStart || t >= todayStart + DAY_MS) continue;
    const id = String(a.id || "");
    if (!id || (dailyId && id === dailyId)) continue;    // the queue asked for this one
    offQueue = id; break;
  }

  /* 4. first_full_combo — a full-combo run today on a song with no earlier
        clean history. tg_act_log has no combo flag (by design — ok==total on
        the same row is the app's own definition of a clean run), and
        tg_stars_<id> = 3 requires a perfect run. So: ok===total>0 today and
        stored stars < 3 → a first for that song. */
  let firstFc = null;
  for (const a of act) {
    if (!a || typeof a !== "object" || a.k !== "game") continue;
    const t = num(a.t);
    if (!t || t < todayStart || t >= todayStart + DAY_MS) continue;
    const ok = num(a.ok), miss = num(a.miss);
    if (ok <= 0 || miss > 0 || num(a.sec) !== 0) continue; // sec===0: the per-skill sub-rows, skip
    const id = String(a.id || "");
    const best = num(stars[id]);
    if (best < 3) { firstFc = id; break; }
  }

  /* 5. shared_card — the app writes tg_act_log k="share" when a card goes
        out. No share rows yet → the signal simply cannot fire (never
        guessed from anything else). */
  const shares = act.filter(a => a && typeof a === "object" && a.k === "share").length;

  return {
    today,
    came_back_soon: { fired: cameBack, count: cameBack ? 1 : 0, source: cameBackFrom ? `tg_practice_log[${cameBackFrom}] → ${today}` : "tg_practice_log" },
    played_longer: {
      fired: playedLonger,
      count: playedLonger ? 1 : 0,
      source: `tg_act_log k=game/drill sec (${Math.round(todayMin)}m today vs ~${Math.round(avgPerSession)}m/session)`,
    },
    off_queue_song: { fired: !!offQueue, count: offQueue ? 1 : 0, source: offQueue ? `tg_act_log k=game id=${offQueue}` : "tg_act_log k=game" },
    first_full_combo: { fired: !!firstFc, count: firstFc ? 1 : 0, source: firstFc ? `tg_act_log k=game ok=total id=${firstFc} + tg_stars_${firstFc}` : "tg_act_log k=game + tg_stars_<id>" },
    shared_card: { fired: shares > 0, count: shares, source: `tg_act_log k=share (${shares})` },
    /* context channel (12.2, opt-in) — counted separately, never in the score.
       It lives in its own key (tg_song_mood, see play-along-progress) and is
       read here only as context for humans — keeping it out of the score is
       what makes the metric impossible to farm by tapping. */
    mood_taps: Array.isArray(moods) ? moods.length : 0,
    today_sessions: todaySessions,
    today_acc: todayAcc == null ? null : Math.round(todayAcc),
  };
}

/* ── THE SHADOW INDEX — count of fired signals, 0..5, or null ──────── */
export function joyIndex(data = {}) {
  try {
    const practiceLog = data.practiceLog != null ? data.practiceLog : readLocal("tg_practice_log", {});
    const actLog = data.actLog != null ? data.actLog : readLocal("tg_act_log", []);
    const starsById = data.starsById != null ? data.starsById : readStarsMap();
    const daily = data.daily != null ? data.daily : readLocal("tg_daily_song", null);
    const moods = data.moods != null ? data.moods : readLocal("tg_song_mood", []);
    const sig = readSignals({ practiceLog, actLog, starsById, daily, moods, now: data.now != null ? data.now : undefined });

    const fired = JOY_SIGNALS.filter(s => sig[s.key] && sig[s.key].fired).map(s => s.key);
    const evidenceRows = JOY_SIGNALS.map(s => ({
      key: s.key,
      label: s.label,
      fired: !!sig[s.key].fired,
      count: num(sig[s.key].count),
      source: sig[s.key].source,
    }));

    /* honest-null: with no session in the log today there is no behaviour to
       read — the metric stays silent rather than guessing. */
    const hasAny = sig.today_sessions > 0 || actLog.length > 0;
    return {
      shadow: true,
      signals: JOY_SIGNALS.map(s => s.key),          // the fixed vocabulary
      fired,
      count: fired.length,
      of: JOY_SIGNALS.length,
      score: hasAny ? fired.length : null,           // null = honest "no evidence"
      evidence: evidenceRows,
      today_sessions: sig.today_sessions,
      today_acc: sig.today_acc,
      mood_taps: sig.mood_taps,                      // context only — NOT in score
      sample: actLog.length,
      enough: false,                                 // 12.6 gate: n < 30 loop rounds
      honestNull: hasAny ? null : HONEST_NULL,
      note: null,                                    // filled by joyNote(lang)
    };
  } catch (e) { return null; }
}

/* One-line honest reading for humans. n<30 → "not enough evidence" — the
   single rule shared with 7.2, so no other branch can sneak a claim in. */
export function joyNote(lang) {
  const l = lang === "th" ? "th" : lang === "zh" ? "zh" : "en";
  return L3(
    `ตัววัดเงา: สัญญาณจาก log จริงเท่านั้น · ยังไม่ผูกการตัดสินใจ (รอข้อมูล 30 รอบวงล้อ) · หลักฐานไม่พอ = ไม่แสดง`,
    "Shadow metric: real log signals only · not wired to any decision yet (waits for 30 loop rounds) · not enough evidence = hidden",
    "影子指标：仅用真实记录信号 · 尚未接入任何决策（等待30轮循环数据）· 证据不足则隐藏"
  )[l];
}

/* Trilingual "no data yet" object for UI surfaces that show the metric —
   the same honest-null the smoke asserts on. */
export function joyEmpty(lang) {
  const l = lang === "th" ? "th" : lang === "zh" ? "zh" : "en";
  return { score: null, line: HONEST_NULL[l], trilingual: HONEST_NULL, shadow: true };
}

/* Frozen at module load so the smoke can prove the vocabulary cannot drift
   silently (the 12.6 bench bar: "the formula never changes without a smoke"). */
Object.freeze(JOY_SIGNALS);
