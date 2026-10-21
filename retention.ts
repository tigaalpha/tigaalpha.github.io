/* ── retention.ts — pure retention logic (Sprint S1 of the retention plan) ──
   Why this file exists: the app shipped TWO independent streaks that never
   agreed. `tg_streak` (localStorage) advances on a FINISHED SESSION and
   carries freezes; `profiles.streak` advances on APP OPEN (welcome-back
   effect in use-gamification). The daily hub displayed the first, while
   badges and the weekly-report push body cited the second — so a learner
   could see "7" on their flame while a badge/push said "12".

   This module is PURE (imports nothing, touches no window/localStorage) so it
   runs in Node under tigamodel/scripts/smoke.mjs against the real thing, and
   so the same rule can later be mirrored server-side by the daily nudge
   sender. Callers pass in what they already have.

   Honesty rules kept from the rest of TIGA MODEL:
   * The SERVER value is the display source of truth; the device value is the
     fallback for guests/offline. Both are always returned, and a mismatch is
     reported as `divergence` so it can be MEASURED instead of silently
     hidden — automating the decision of which writer to retire later.
   * No data → no claim. `resumeHint` returns null rather than inventing a
     "continue where you left off" line, and `dailyPriority` degrades to a
     plain "start" instead of a false urgency. */

export type StreakLike = { count?: number; last?: string | null; freezes?: number } | null | undefined;

export type StreakState = {
  count: number;
  last: string | null;
  freezes: number;
  atRisk: boolean;
  source: "server" | "device" | "none";
  divergence: { server: number; device: number } | null;
};

/* One streak view. `today` must be the SAME local day key the writers use
   (App.tsx writes profiles.last_active with shared-infra's ymd()), which is
   why it is passed in rather than computed here: a UTC-derived day would
   make a learner east of UTC look "at risk" hours before their own midnight. */
export function streakState({ profile, device, today }: { profile?: any; device?: StreakLike; today: string }): StreakState {
  const serverNum = profile && typeof profile.streak === "number" ? profile.streak : null;
  const serverLast = profile && typeof profile.last_active === "string" ? profile.last_active : null;
  const deviceNum = device && typeof device.count === "number" ? device.count : null;
  const deviceLast = device && typeof device.last === "string" && device.last ? device.last : null;

  const count = serverNum != null ? serverNum : (deviceNum || 0);
  const last = serverLast || deviceLast || null;
  const freezes = (device && device.freezes) || 0;

  const divergence = serverNum != null && deviceNum != null && serverNum !== deviceNum
    ? { server: serverNum, device: deviceNum }
    : null;

  return {
    count,
    last,
    freezes,
    // a streak of 0 was never earned, so nothing can be "at risk"
    atRisk: count > 0 && last !== today,
    source: serverNum != null ? "server" : deviceNum != null ? "device" : "none",
    divergence,
  };
}

export type ResumeHint = { label: string; kind: "recent" | "struggle" } | null;

/* What the learner was actually doing last — from cross-session memory that
   already syncs to the server (profiles.progress.memory), so the SAME hint can
   be shown in-app and (later) named in a server-sent nudge. Most recent first
   because "pick up where you left off" should be the thing they touched, not
   the thing they struggle with. */
export function resumeHint(memory: any): ResumeHint {
  try {
    const recent = memory && Array.isArray(memory.recent) ? memory.recent : [];
    const r = recent.find(x => x && typeof x.label === "string" && x.label.trim());
    if (r) return { label: r.label.trim(), kind: "recent" };
    const struggles = memory && Array.isArray(memory.struggles) ? memory.struggles : [];
    const s = struggles.find(x => x && typeof x.label === "string" && x.label.trim() && (x.count || 0) >= 2);
    if (s) return { label: s.label.trim(), kind: "struggle" };
  } catch (e) { /* memory is localStorage-shaped and never trusted */ }
  return null;
}

export type DailyPriority = { kind: "streak" | "chest" | "quest" | "resume" | "start"; ic: string; cta: { th: string; en: string; zh: string } };

/* The one-tap rule: what "today" should lead with, in priority order. Chosen
   so the most PERISHABLE thing wins — a streak about to lapse, then an unopened
   reward, then an unfinished daily quest — because a comeback reason that is
   still true tomorrow is not a comeback reason. */
export function dailyPriority({ atRisk, chestAvail, questDone, hasResume }: { atRisk?: boolean; chestAvail?: boolean; questDone?: boolean; hasResume?: boolean }): DailyPriority {
  if (atRisk) return { kind: "streak", ic: "🔥", cta: {
    th: "ฝึกวันนี้ก่อนสตรีคขาด", en: "Practice today to keep your streak", zh: "今天练一下，保住连胜" } };
  if (chestAvail) return { kind: "chest", ic: "🎁", cta: {
    th: "ของขวัญวันนี้ยังไม่ได้เปิด", en: "Today's gift is still unopened", zh: "今天的礼物还没打开" } };
  if (!questDone) return { kind: "quest", ic: "🎯", cta: {
    th: "ภารกิจวันนี้ยังไม่ครบ", en: "Today's mission isn't finished yet", zh: "今天的任务还没完成" } };
  if (hasResume) return { kind: "resume", ic: "▶️", cta: {
    th: "ไปต่อจากจุดที่ค้างไว้", en: "Pick up where you left off", zh: "从上次停下的地方继续" } };
  return { kind: "start", ic: "🎹", cta: {
    th: "เริ่มซ้อมรอบใหม่ได้เลย", en: "Start a new practice round", zh: "开始新一轮练习" } };
}

/* ── A2: the session-close bridge ──
   A comeback reason only works if it is SPECIFIC and still true tomorrow, so
   the promise carries the learner's real sticking point (resumeHint) and the
   model's own shortest session length — the engine clamps a plan to a 5-minute
   floor and drops to warmup+problem there (coach/diagnosis practiceTimeBudget),
   which is why `minutes` is passed IN rather than hard-coded here: if the floor
   ever changes, the copy follows the engine instead of quietly lying. */
export function tomorrowPromise({ memory, minutes = 5 }: { memory?: any; minutes?: number }) {
  const r = resumeHint(memory);
  if (!r) return null;
  const m = Math.max(1, Math.round(minutes || 5));
  return {
    label: r.label,
    kind: r.kind,
    minutes: m,
    text: {
      th: `พรุ่งนี้กลับมาสั้น ๆ ${m} นาที — วอร์ม แล้วซ้อม "${r.label}" ต่อ`,
      en: `Come back tomorrow for just ${m} minutes — warm up, then drill "${r.label}"`,
      zh: `明天回来练 ${m} 分钟 —— 先热身，再练“${r.label}”`,
    },
  };
}

/* Localized names for the engine's fixed plan blocks, so a 5-minute plan renders
   as real words instead of leaking raw keys ("warmup"/"problem") into the UI.
   An unknown block is DROPPED rather than shown unnamed. */
const BLOCK_LABELS: Record<string, { th: string; en: string; zh: string }> = {
  warmup: { th: "วอร์ม", en: "Warm up", zh: "热身" },
  problem: { th: "จุดติดขัด", en: "Sticking point", zh: "卡点" },
  review: { th: "ทบทวน", en: "Review", zh: "复习" },
  reading: { th: "อ่านโน้ต", en: "Reading", zh: "视谱" },
  performance: { th: "เล่นเต็มเพลง", en: "Play through", zh: "完整演奏" },
};

export type PlanBlock = { key: string; minutes: number; label: { th: string; en: string; zh: string } };

export function warmReturnBlocks(budget: any): PlanBlock[] {
  try {
    const parts = budget && Array.isArray(budget.parts) ? budget.parts : [];
    return parts
      .filter(p => p && BLOCK_LABELS[p.key] && typeof p.minutes === "number")
      .map(p => ({ key: p.key, minutes: p.minutes, label: BLOCK_LABELS[p.key] }));
  } catch (e) { return []; }
}

/* Copy picker shared by the surfaces that render the above (the app has three
   languages everywhere; a missing one falls back to English, never to blank). */
export function pickLang(obj: { th?: string; en?: string; zh?: string } | null, lang: string): string {
  if (!obj) return "";
  if (lang === "th") return obj.th || obj.en || "";
  if (lang === "zh") return obj.zh || obj.en || "";
  return obj.en || obj.th || "";
}
