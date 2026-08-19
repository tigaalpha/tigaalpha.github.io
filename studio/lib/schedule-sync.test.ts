import { describe, expect, it } from "vitest";
import { computeNextRun as computeNextRunFrontend, type ScheduleRecurrence } from "./compute-next-run";
import { computeNextRun as computeNextRunBackend } from "../supabase/functions/_shared/schedule";

// _shared/schedule.ts (used by agent-schedule-runner) is a hand-duplicated
// copy of this file (Deno can't import repo files outside supabase/functions
// at runtime, same reason categories.ts is duplicated) — if someone fixes a
// bug in one copy and forgets the other, the "next run" the Settings UI
// shows would silently stop matching what the cron heartbeat actually does.
// This cross-checks both copies against the same battery of inputs instead
// of trusting the comment that says "keep these in sync."
const CASES: { label: string; schedule: ScheduleRecurrence; from: string }[] = [
  { label: "once, in the future", schedule: { recurrenceType: "once", intervalDays: null, dayOfWeek: null, dayOfMonth: null, timeOfDay: "09:00", runOnceAt: "2026-09-01T09:00:00.000Z" }, from: "2026-08-08T00:00:00.000Z" },
  { label: "once, already passed", schedule: { recurrenceType: "once", intervalDays: null, dayOfWeek: null, dayOfMonth: null, timeOfDay: "09:00", runOnceAt: "2026-01-01T09:00:00.000Z" }, from: "2026-08-08T00:00:00.000Z" },
  { label: "daily, before today's time", schedule: { recurrenceType: "daily", intervalDays: null, dayOfWeek: null, dayOfMonth: null, timeOfDay: "18:00", runOnceAt: null }, from: "2026-08-08T09:00:00.000Z" },
  { label: "daily, after today's time", schedule: { recurrenceType: "daily", intervalDays: null, dayOfWeek: null, dayOfMonth: null, timeOfDay: "06:00", runOnceAt: null }, from: "2026-08-08T09:00:00.000Z" },
  { label: "every_n_days", schedule: { recurrenceType: "every_n_days", intervalDays: 3, dayOfWeek: null, dayOfMonth: null, timeOfDay: "09:00", runOnceAt: null }, from: "2026-08-08T12:00:00.000Z" },
  { label: "weekly", schedule: { recurrenceType: "weekly", intervalDays: null, dayOfWeek: 5, dayOfMonth: null, timeOfDay: "09:00", runOnceAt: null }, from: "2026-08-08T12:00:00.000Z" },
  { label: "monthly, mid-month", schedule: { recurrenceType: "monthly", intervalDays: null, dayOfWeek: null, dayOfMonth: 15, timeOfDay: "09:00", runOnceAt: null }, from: "2026-08-08T12:00:00.000Z" },
  { label: "monthly, clamped at month-end", schedule: { recurrenceType: "monthly", intervalDays: null, dayOfWeek: null, dayOfMonth: 31, timeOfDay: "09:00", runOnceAt: null }, from: "2026-02-15T12:00:00.000Z" },
  { label: "monthly, year rollover", schedule: { recurrenceType: "monthly", intervalDays: null, dayOfWeek: null, dayOfMonth: 1, timeOfDay: "09:00", runOnceAt: null }, from: "2026-12-15T12:00:00.000Z" },
];

describe("_shared/schedule.ts stays behaviorally identical to lib/compute-next-run.ts", () => {
  it.each(CASES)("$label", ({ schedule, from }) => {
    const fromDate = new Date(from);
    const frontendResult = computeNextRunFrontend(schedule, fromDate);
    const backendResult = computeNextRunBackend(schedule, fromDate);
    expect(backendResult?.toISOString() ?? null).toEqual(frontendResult?.toISOString() ?? null);
  });
});
