// Computes the next occurrence strictly after `from` for an agent_schedules
// row. Deliberately duplicated (not imported) into
// supabase/functions/_shared/schedule.ts — Edge Functions can't read
// arbitrary repo files at runtime, same reason prompts.ts embeds its
// content instead of importing .md files.

export interface ScheduleRecurrence {
  recurrenceType: "once" | "daily" | "every_n_days" | "weekly" | "monthly";
  intervalDays: number | null;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string; // "HH:mm" or "HH:mm:ss"
  runOnceAt: string | null;
}

function atTime(base: Date, hh: number, mm: number): Date {
  const result = new Date(base);
  result.setHours(hh, mm, 0, 0);
  return result;
}

function clampedMonthlyDate(year: number, month: number, targetDom: number, hh: number, mm: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(targetDom, lastDay);
  return new Date(year, month, day, hh, mm, 0, 0);
}

/** Returns null when the schedule has no future occurrence (a fired "once" schedule). */
export function computeNextRun(schedule: ScheduleRecurrence, from: Date): Date | null {
  if (schedule.recurrenceType === "once") {
    if (!schedule.runOnceAt) return null;
    const at = new Date(schedule.runOnceAt);
    return at > from ? at : null;
  }

  const [hh, mm] = schedule.timeOfDay.split(":").map(Number) as [number, number];

  if (schedule.recurrenceType === "daily") {
    const candidate = atTime(from, hh, mm);
    if (candidate <= from) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }

  if (schedule.recurrenceType === "every_n_days") {
    const days = schedule.intervalDays && schedule.intervalDays > 0 ? schedule.intervalDays : 1;
    const candidate = atTime(from, hh, mm);
    if (candidate <= from) candidate.setDate(candidate.getDate() + days);
    return candidate;
  }

  if (schedule.recurrenceType === "weekly") {
    const targetDow = schedule.dayOfWeek ?? 1;
    const candidate = atTime(from, hh, mm);
    let diff = (targetDow - candidate.getDay() + 7) % 7;
    if (diff === 0 && candidate <= from) diff = 7;
    candidate.setDate(candidate.getDate() + diff);
    return candidate;
  }

  // monthly
  const targetDom = schedule.dayOfMonth ?? 1;
  let year = from.getFullYear();
  let month = from.getMonth();
  let candidate = clampedMonthlyDate(year, month, targetDom, hh, mm);
  if (candidate <= from) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidate = clampedMonthlyDate(year, month, targetDom, hh, mm);
  }
  return candidate;
}
