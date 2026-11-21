/* guest-uses.ts — the free preview of a guest: a number of USES, not a clock (owner 2026-11-21).
   "Everyone who opens the app lands on the Learning Pathway without logging in and can use every feature 3 times; after that a pop-up invites them to log in (free for 7 days, no credit card)."
   A use = the guest STARTS one learning / play activity (a lesson, a drill, a song, a reading round ...): PianoApp's guestStart() (App.tsx) asks here before the activity opens. Looking around
   (menus, pages, lists) is free and unlimited. The count lives in this browser (localStorage, like the guest's profile), so clearing the site's data starts a new preview: it is a funnel, not a
   lock. Where storage is refused the count is kept in memory for the page. It is NOT cleared by a log-in or a sign-out (3 per browser, honestly). It replaces the 10-second clock
   (GUEST_TRIAL_MS in shared-infra.ts stays exported: only the admin activity dashboard still reads it). No imports on purpose: scripts/smoke-guest-trial.mjs runs this file as it is. */
export const GUEST_FREE_USES = 3;
export const GUEST_USES_KEY = "tg_guest_uses";
let guestUsesMem = 0;
export function getGuestUses(): number {
  let n = 0;
  try { n = parseInt(localStorage.getItem(GUEST_USES_KEY) || "0", 10) || 0; } catch (e) {}
  return Math.max(Math.min(Math.max(n, 0), 1000), guestUsesMem);
}
/* test door: tg_guest_unlimited = "1" lifts the preview for the scripts that are not about it (the Play Along bots, the practice / sight-reading / ear smokes run as guests and start dozens of activities);
   scripts/smoke-guest-trial.mjs never sets it, so the gate itself is always tested on the default path. */
export const GUEST_TEST_DOOR = "tg_guest_unlimited";
const doorOpen = (): boolean => { try { return localStorage.getItem(GUEST_TEST_DOOR) === "1"; } catch (e) { return false; } };
export function guestUsesLeft(): number { return doorOpen() ? 99 : Math.max(0, GUEST_FREE_USES - getGuestUses()); }
/* How many starts the preview has turned away in this page (the invitation was raised instead of the activity): a caller that wraps a start - the Practice Today list marks an item "entered" -
   reads the number before and after the start and counts the item only when it did not move, so a refused start is not "done". Never persisted. */
let guestRefusals = 0;
export function markGuestRefusal(): number { guestRefusals += 1; return guestRefusals; }
export function guestRefusalCount(): number { return guestRefusals; }
/* Writes down one more use and returns the new total (never goes down, never throws). */
export function addGuestUse(): number {
  const next = getGuestUses() + 1;
  guestUsesMem = next;
  try { localStorage.setItem(GUEST_USES_KEY, String(next)); } catch (e) {}
  return next;
}
