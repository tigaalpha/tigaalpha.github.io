// Pure slot-finding over an already-known list of busy ranges — no Deno API
// calls, so it's split out of calendar.ts (which is full of them) purely so
// it can be imported straight into a Node/vitest run and get real unit
// tests (lib/availability.test.ts) instead of being untestable interval
// math that only ever gets exercised by hand through the booking flow.
export function computeAvailableSlots(
  busy: { start: string; end: string }[],
  timeMin: string,
  timeMax: string,
  durationMinutes: number
): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  const durationMs = durationMinutes * 60 * 1000;

  let cursor = new Date(timeMin).getTime();
  const end = new Date(timeMax).getTime();

  while (cursor + durationMs <= end) {
    const slotStart = cursor;
    const slotEnd = cursor + durationMs;

    const overlaps = busy.some((event) => {
      const eventStart = new Date(event.start).getTime();
      const eventEnd = new Date(event.end).getTime();
      return slotStart < eventEnd && slotEnd > eventStart;
    });

    if (!overlaps) {
      slots.push({ start: new Date(slotStart).toISOString(), end: new Date(slotEnd).toISOString() });
    }

    cursor += durationMs;
  }

  return slots;
}
