/* ── tigamodel/teaching/joy.js ──
   PLAN v3.8 — ระลอก 12 (12.1) JoyIndex v1 SHADOW — มิติที่ 10: ความสุขของผู้เรียน
   Round 12.1: the 10th multiplication dimension — "เรียนแล้วมีความสุข" —
   becomes measurable, from behaviour the app ALREADY logs. No new schema,
   no new prompts, no dashboard of guilt.
   Round 12.3 adds the counterpart BOREDOM RISK reading (below, classified
   against the four quit causes of KB 6.8) — same rules, same shadow.

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

/* ── 12.3 — BOREDOM RISK (ความเบื่อก่อนเลิกเรียน) ──────────────────────
   The counterpart reading: not "how happy" but "how close to quitting".
   Classified against the four quit causes the education-market KB names
   (plan 6.8, เหตุผลที่คนเลิกเรียน — ids from knowledge/music-education-market.js):
     wall_too_high       — edu:churn:wall-too-high      (กำแพงสูงเกินตัว)
     invisible_progress  — edu:churn:invisible-progress (ซ้อมแล้วไม่เห็นคืบหน้า)
     no_song_love        — edu:churn:no-song-love       (ไม่มีเพลงที่รัก)
     lonely_practice     — edu:churn:lonely-practice    (ซ้อมคนเดียวโดดเดี่ยว)
   Every rule is a plain count over real rows (the same tg_practice_log /
   tg_act_log / tg_song_mood the joy signals read). The only boundaries are
   the DECLARED ones below — a 14-day window, "พลาดเกินครึ่ง" (mean accuracy
   < 50% over ≥2 recent scored runs), "both weeks ≥3 practice days" — no
   invented statistics anywhere. SHADOW like the joy score: displayed in
   Model Lab ONLY (plan 12.3) and wired to no decision until 12.6's
   30-loop-round data rule is met. n < 30 → enough:false + enoughNote;
   no practice at all → honest-null score, never a guessed risk. ── */
export const BOREDOM_WINDOW_DAYS = 14;
export const BOREDOM_RISKS = [
  { key: "wall_too_high",      kb: "edu:churn:wall-too-high",      label: L3("กำแพงสูงเกินตัว", "Wall too high", "关卡太高"),        ask: false },
  { key: "invisible_progress", kb: "edu:churn:invisible-progress", label: L3("ซ้อมแล้วไม่เห็นคืบหน้า", "Invisible progress", "看不见进步"), ask: false },
  { key: "no_song_love",       kb: "edu:churn:no-song-love",       label: L3("ไม่มีเพลงที่รัก", "No loved song", "没有喜欢的歌"),      ask: false },
  { key: "lonely_practice",    kb: "edu:churn:lonely-practice",    label: L3("ซ้อมคนเดียวโดดเดี่ยว", "Lonely practice", "独自练习孤单"), ask: false },
];

const NOTE30 = {
  th: "ยังเก็บข้อมูลไม่ครบ 30 รอบวงล้อ — อ่านเพื่อสังเกตเท่านั้น ยังไม่ใช้ตัดสินใจ",
  en: "Fewer than 30 loop rounds collected — for observation only, not a decision input yet",
  zh: "尚未积累满30轮循环数据——仅供观察，尚未用于决策",
};

export function boredomRisk(data = {}) {
  try {
    const practiceLog = data.practiceLog != null ? data.practiceLog : readLocal("tg_practice_log", {});
    const actLog = data.actLog != null ? data.actLog : readLocal("tg_act_log", []);
    const daily = data.daily != null ? data.daily : readLocal("tg_daily_song", null);
    const moods = data.moods != null ? data.moods : readLocal("tg_song_mood", []);
    const today = isDayKey(data.now) ? data.now : dayKeyOf(data.now != null ? data.now : Date.now());
    const plog = practiceLog && typeof practiceLog === "object" ? practiceLog : {};
    const act = Array.isArray(actLog) ? actLog : [];
    const W = BOREDOM_WINDOW_DAYS, dayMs = 86400000;
    const todayStart = new Date(today + "T00:00:00").getTime();
    const winStart = todayStart - (W - 1) * dayMs;
    const inWin = (t) => num(t) >= winStart && num(t) < todayStart + dayMs;

    /* per-day practice inside the window (oldest→today) from tg_practice_log */
    const winDays = [];
    for (let i = 0; i < W; i++) {
      const ts = winStart + i * dayMs;
      const d = new Date(ts);
      const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const e = plog[k];
      const n = e ? num(e.n) : 0;
      winDays.push({ k, ts, n, acc: n > 0 ? num(e.accSum) / n : null });
    }
    const practicedDays = winDays.filter(d => d.n > 0);
    const hasData = practicedDays.length > 0 || act.some(a => a && typeof a === "object" && inWin(a.t));

    /* scored runs (game/drill rows that carry ok/miss totals — the sec===0
       per-skill sub-rows are excluded, same rule as first_full_combo) */
    const accOf = (a) => num(a.ok) / Math.max(1, num(a.ok) + num(a.miss));
    const scored = act.filter(a => a && typeof a === "object" && (a.k === "game" || a.k === "drill") && num(a.sec) > 0 && (num(a.ok) + num(a.miss)) > 0 && inWin(a.t));
    const dailyId = daily && typeof daily === "object" ? String(daily.id || "") : "";
    const offQueueRuns = act.filter(a => a && typeof a === "object" && a.k === "game" && inWin(a.t) && String(a.id || "") && (!dailyId || String(a.id) !== dailyId));
    const shares = act.filter(a => a && typeof a === "object" && a.k === "share" && inWin(a.t));
    const goodMoods = Array.isArray(moods) ? moods.filter(x => x && typeof x === "object" && x.v === "good" && inWin(x.t)) : [];

    /* wall_too_high — recent scored runs miss over half while the learner
       still shows up (the KB's fix: smaller steps, not "try harder") */
    const recentScored = scored.filter(a => num(a.t) >= todayStart - 2 * dayMs);
    const recentAcc = recentScored.length ? recentScored.reduce((s, a) => s + accOf(a), 0) / recentScored.length : null;
    const showedUpRecently = practicedDays.some(d => d.ts >= todayStart - 2 * dayMs);
    const wallFired = showedUpRecently && recentScored.length >= 2 && recentAcc < 0.5;

    /* invisible_progress — both weeks real (≥3 practice days each) and the
       mean accuracy did not rise (delta ≤ 0 → "ซ้อมทุกวันแต่ยืนที่เดิม") */
    const mean = (xs) => xs.length ? xs.reduce((s, d) => s + d.acc, 0) / xs.length : null;
    const wkDays = winDays.slice(-7).filter(d => d.n > 0 && d.acc != null);
    const pwDays = winDays.slice(0, W - 7).filter(d => d.n > 0 && d.acc != null);
    const thisAvg = mean(wkDays), prevAvg = mean(pwDays);
    const invisibleFired = wkDays.length >= 3 && pwDays.length >= 3 && thisAvg != null && prevAvg != null && thisAvg - prevAvg <= 0;

    /* no_song_love — two weeks of real practice with zero self-picked song
       runs and zero good-mood taps: the curriculum never showed a loved song
       (good moods are the 12.2 context channel used as counter-evidence only) */
    const noLoveFired = practicedDays.length >= 3 && offQueueRuns.length === 0 && goodMoods.length === 0;

    /* lonely_practice — real steady practice while the one "being seen"
       channel the logs can prove (share rows) stayed silent the whole window;
       a provable absence, stated as one — never a guess about feelings */
    const lonelyFired = practicedDays.length >= 5 && shares.length === 0;

    const firedFlags = { wall_too_high: wallFired, invisible_progress: invisibleFired, no_song_love: noLoveFired, lonely_practice: lonelyFired };
    const sources = {
      wall_too_high: `tg_act_log k=game/drill ${recentScored.length} scored runs in last 3d (mean acc ${recentAcc == null ? "-" : Math.round(recentAcc * 100) + "%"}) + tg_practice_log shows the learner kept showing up`,
      invisible_progress: `tg_practice_log 14d: this week ${wkDays.length}d avg ${thisAvg == null ? "-" : Math.round(thisAvg) + "%"} vs prior week ${pwDays.length}d avg ${prevAvg == null ? "-" : Math.round(prevAvg) + "%"} (delta ≤ 0)`,
      no_song_love: `tg_act_log k=game off-queue runs = ${offQueueRuns.length} + tg_song_mood good taps = ${goodMoods.length} over ${W}d (${practicedDays.length} practice days)`,
      lonely_practice: `tg_act_log k=share rows = ${shares.length} over ${W}d while tg_practice_log shows ${practicedDays.length} practice days`,
    };
    const fired = [];
    const evidence = BOREDOM_RISKS.map(r => {
      const f = !!firedFlags[r.key];
      if (f) fired.push(r.key);
      return { key: r.key, label: r.label, kb: r.kb, fired: f, source: sources[r.key] };
    });

    return {
      shadow: true,
      windowDays: W,
      signals: BOREDOM_RISKS.map(r => r.key),
      kb: BOREDOM_RISKS.map(r => r.kb),
      fired,
      count: fired.length,
      of: BOREDOM_RISKS.length,
      score: hasData ? fired.length : null,   // null = honest "no evidence"
      evidence,
      practicedDays14: practicedDays.length,
      scoredRuns14: scored.length,
      weekAvgAcc: thisAvg == null ? null : Math.round(thisAvg),
      prevWeekAvgAcc: prevAvg == null ? null : Math.round(prevAvg),
      enough: false,                          // 12.6 gate: < 30 loop rounds (the 7.2 rule)
      honestNull: hasData ? null : HONEST_NULL,
      enoughNote: NOTE30,
    };
  } catch (e) { return null; }
}

/* ── 12.4 — THE COACH'S RESPONSE TO BOREDOM (model side) ─────────────
   A HIGH risk → the coach calmly swaps the plan for today, and ALWAYS says
   why by citing the KB entry the action follows (plan 12.3–12.4: เหตุผล
  อ้าง KB เสมอ). Routing per quit cause:
     no_song_love   → hook-first song pick (plan 6.2, KB mkt:hook:chorus-first)
                      — the loved song is fuel, not a reward
     wall_too_high / invisible_progress → the relax mode intro (11.2, KB
                      thx:practice:calm-session) — slower, winnable, kind
     lonely_practice → relax mode as well (11.2) plus an explicit invitation
                      to share today's playing — the being-seen fix
   NOT enough data (null risk, or enough:false with score null) → null:
   the caller does exactly what it did before (plan 12.4: ข้อมูลไม่พอ =
   ทำเหมือนเดิม). Pure + sync, never throws, never mutates the risk. ── */
export function boredomResponse(kb, risk, lang) {
  try {
    const l = lang === "th" ? "th" : lang === "zh" ? "zh" : "en";
    if (!risk || typeof risk !== "object") return null;
    if (risk.score == null || !Array.isArray(risk.fired) || risk.fired.length === 0) return null;
    const get = (id) => { try { return kb && typeof kb.get === "function" ? (kb.get(id) || null) : null; } catch (e) { return null; } };
    const order = ["no_song_love", "wall_too_high", "invisible_progress", "lonely_practice"];
    const primary = order.find(k => risk.fired.includes(k)) || risk.fired[0];
    if (primary === "no_song_love") {
      const e = get("mkt:hook:chorus-first");
      if (!e) return null;
      return {
        change: true,
        mode: "hook-first",
        kb: e.id,
        sources: ["edu:churn:no-song-love", e.id],
        via: "music-marketing-kb",
        reason: L3(
          "วันนี้เปลี่ยนแผน: เริ่มจากเพลงที่ชอบก่อน — เพลงที่รักคือเชื้อเพลิงของการซ้อม ไม่ใช่ของรางวัล",
          "Plan swapped for today: start from a song you love — the loved song is fuel, not a reward",
          "今天换个计划：先从喜欢的歌开始——喜欢的歌是练习的燃料，不是奖励",
        ),
      };
    }
    const e = get("thx:practice:calm-session");
    if (!e) return null;
    const lonely = primary === "lonely_practice";
    return {
      change: true,
      mode: "relax",
      kb: e.id,
      sources: ["edu:churn:" + primary.replace(/_/g, "-"), e.id],
      via: "music-therapy-kb",
      reason: lonely
        ? L3(
            "วันนี้พักแบบผ่อนคลาย: เพลงช้าที่เล่นได้ จบด้วยการโชว์เพลงที่เพิ่งเล่นให้ใครสักคนฟัง — การซ้อมที่มีคนเห็นไปได้ไกลกว่า",
            "Today is a relax session: a slow piece you can play, then show what you just played to someone — practice someone sees goes further",
            "今天是放松练习：弹一首能弹的慢曲，再把刚弹的分享给别人——有人看见的练习走得更远",
          )
        : L3(
            "วันนี้ผ่อนจังหวะ: เล่นเพลงช้าที่ชนะได้แน่ ไม่มีการวัดอะไรทั้งวัน — ขั้นเล็กที่ชนะได้คือทางออกของวันที่ติด",
            "Today we ease off: play a slow piece you can win at, nothing is measured — small winnable steps are the way through a stuck day",
            "今天放慢节奏：弹一首稳赢的慢曲，今天什么都不测——能赢的小步是卡关日的出路",
          ),
    };
  } catch (e) { return null; }
}

Object.freeze(BOREDOM_RISKS);

/* Frozen at module load so the smoke can prove the vocabulary cannot drift
   silently (the 12.6 bench bar: "the formula never changes without a smoke"). */
Object.freeze(JOY_SIGNALS);
