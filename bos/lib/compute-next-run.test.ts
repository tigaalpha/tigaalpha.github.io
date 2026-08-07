import { describe, expect, it } from "vitest";
import { computeNextRun, type ScheduleRecurrence } from "./compute-next-run";

function schedule(overrides: Partial<ScheduleRecurrence>): ScheduleRecurrence {
  return {
    recurrenceType: "daily",
    intervalDays: null,
    dayOfWeek: null,
    dayOfMonth: null,
    timeOfDay: "09:00",
    runOnceAt: null,
    ...overrides,
  };
}

describe("computeNextRun", () => {
  it("once: returns the run time when it is still in the future", () => {
    const from = new Date(2026, 0, 1, 8, 0);
    const runOnceAt = new Date(2026, 0, 5, 10, 0).toISOString();
    expect(computeNextRun(schedule({ recurrenceType: "once", runOnceAt }), from)).toEqual(new Date(runOnceAt));
  });

  it("once: returns null once the run time has passed", () => {
    const from = new Date(2026, 0, 10, 8, 0);
    const runOnceAt = new Date(2026, 0, 5, 10, 0).toISOString();
    expect(computeNextRun(schedule({ recurrenceType: "once", runOnceAt }), from)).toBeNull();
  });

  it("once: returns null when runOnceAt is missing", () => {
    expect(computeNextRun(schedule({ recurrenceType: "once", runOnceAt: null }), new Date())).toBeNull();
  });

  it("daily: schedules today if the time hasn't happened yet", () => {
    const from = new Date(2026, 0, 1, 7, 0);
    const next = computeNextRun(schedule({ recurrenceType: "daily", timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 0, 1, 9, 0));
  });

  it("daily: rolls to tomorrow if today's time already passed", () => {
    const from = new Date(2026, 0, 1, 10, 0);
    const next = computeNextRun(schedule({ recurrenceType: "daily", timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 0, 2, 9, 0));
  });

  it("every_n_days: advances by the configured interval, defaulting to 1", () => {
    const from = new Date(2026, 0, 1, 10, 0);
    const next = computeNextRun(schedule({ recurrenceType: "every_n_days", intervalDays: 3, timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 0, 4, 9, 0));
  });

  it("every_n_days: treats a zero/negative interval as 1", () => {
    const from = new Date(2026, 0, 1, 10, 0);
    const next = computeNextRun(schedule({ recurrenceType: "every_n_days", intervalDays: 0, timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 0, 2, 9, 0));
  });

  it("weekly: picks the next matching day of week, including wrap-around", () => {
    // 2026-01-01 is a Thursday (day 4); target Monday (1) should land 2026-01-05.
    const from = new Date(2026, 0, 1, 10, 0);
    const next = computeNextRun(schedule({ recurrenceType: "weekly", dayOfWeek: 1, timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 0, 5, 9, 0));
  });

  it("weekly: schedules later today when today is the target day and time hasn't passed", () => {
    const from = new Date(2026, 0, 1, 7, 0); // Thursday, day 4
    const next = computeNextRun(schedule({ recurrenceType: "weekly", dayOfWeek: 4, timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 0, 1, 9, 0));
  });

  it("weekly: rolls a full week when today is the target day but the time already passed", () => {
    const from = new Date(2026, 0, 1, 10, 0); // Thursday, day 4
    const next = computeNextRun(schedule({ recurrenceType: "weekly", dayOfWeek: 4, timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 0, 8, 9, 0));
  });

  it("monthly: schedules this month if the day/time hasn't passed", () => {
    const from = new Date(2026, 0, 1, 10, 0);
    const next = computeNextRun(schedule({ recurrenceType: "monthly", dayOfMonth: 15, timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 0, 15, 9, 0));
  });

  it("monthly: rolls to next month once this month's occurrence has passed", () => {
    const from = new Date(2026, 0, 20, 10, 0);
    const next = computeNextRun(schedule({ recurrenceType: "monthly", dayOfMonth: 15, timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 1, 15, 9, 0));
  });

  it("monthly: clamps a day-of-month beyond a short month to its last day", () => {
    // February 2026 has 28 days; dayOfMonth 31 should clamp to 2026-02-28.
    const from = new Date(2026, 1, 1, 10, 0);
    const next = computeNextRun(schedule({ recurrenceType: "monthly", dayOfMonth: 31, timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2026, 1, 28, 9, 0));
  });

  it("monthly: rolling past December wraps to January of the next year", () => {
    const from = new Date(2026, 11, 20, 10, 0);
    const next = computeNextRun(schedule({ recurrenceType: "monthly", dayOfMonth: 15, timeOfDay: "09:00" }), from);
    expect(next).toEqual(new Date(2027, 0, 15, 9, 0));
  });
});
