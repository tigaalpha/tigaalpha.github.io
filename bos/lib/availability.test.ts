import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "../supabase/functions/_shared/availability";

// check_calendar_availability (the AI tool that finds open lesson slots for
// a teacher) is built entirely on this function — a bug here means the AI
// either books lessons on top of existing ones or refuses to offer slots
// that are genuinely free.
describe("computeAvailableSlots", () => {
  it("splits an open window into back-to-back slots of the requested duration", () => {
    const slots = computeAvailableSlots([], "2026-08-10T10:00:00.000Z", "2026-08-10T12:00:00.000Z", 60);
    expect(slots).toEqual([
      { start: "2026-08-10T10:00:00.000Z", end: "2026-08-10T11:00:00.000Z" },
      { start: "2026-08-10T11:00:00.000Z", end: "2026-08-10T12:00:00.000Z" },
    ]);
  });

  it("drops a slot that overlaps a busy range", () => {
    const busy = [{ start: "2026-08-10T10:30:00.000Z", end: "2026-08-10T11:30:00.000Z" }];
    const slots = computeAvailableSlots(busy, "2026-08-10T10:00:00.000Z", "2026-08-10T12:00:00.000Z", 60);
    expect(slots).toEqual([]);
  });

  it("keeps a slot that only touches a busy range's boundary (no real overlap)", () => {
    const busy = [{ start: "2026-08-10T11:00:00.000Z", end: "2026-08-10T12:00:00.000Z" }];
    const slots = computeAvailableSlots(busy, "2026-08-10T10:00:00.000Z", "2026-08-10T12:00:00.000Z", 60);
    expect(slots).toEqual([{ start: "2026-08-10T10:00:00.000Z", end: "2026-08-10T11:00:00.000Z" }]);
  });

  it("does not offer a trailing slot shorter than the requested duration", () => {
    const slots = computeAvailableSlots([], "2026-08-10T10:00:00.000Z", "2026-08-10T11:30:00.000Z", 60);
    expect(slots).toEqual([{ start: "2026-08-10T10:00:00.000Z", end: "2026-08-10T11:00:00.000Z" }]);
  });

  it("returns no slots when the window is entirely covered by busy ranges", () => {
    const busy = [{ start: "2026-08-10T09:00:00.000Z", end: "2026-08-10T13:00:00.000Z" }];
    const slots = computeAvailableSlots(busy, "2026-08-10T10:00:00.000Z", "2026-08-10T12:00:00.000Z", 60);
    expect(slots).toEqual([]);
  });

  it("returns no slots when the window is shorter than the requested duration", () => {
    const slots = computeAvailableSlots([], "2026-08-10T10:00:00.000Z", "2026-08-10T10:30:00.000Z", 60);
    expect(slots).toEqual([]);
  });

  it("skips only the busy slots and offers the free ones around them", () => {
    const busy = [{ start: "2026-08-10T11:00:00.000Z", end: "2026-08-10T12:00:00.000Z" }];
    const slots = computeAvailableSlots(busy, "2026-08-10T10:00:00.000Z", "2026-08-10T13:00:00.000Z", 60);
    expect(slots).toEqual([
      { start: "2026-08-10T10:00:00.000Z", end: "2026-08-10T11:00:00.000Z" },
      { start: "2026-08-10T12:00:00.000Z", end: "2026-08-10T13:00:00.000Z" },
    ]);
  });
});
