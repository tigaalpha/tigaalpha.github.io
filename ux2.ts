/* ── ux2.ts ──
   The premium interface (the "AX" series, owner 2026-09-24: "I want the premium
   feeling of this brand — using this app should feel like Apple or Tesla"):
   a tab bar under the pages, one family of line icons, motion and touch that
   feel physical, large left-aligned titles, native-looking controls.

   It is a live revenue-generating app, so it ships behind one switch, the
   class `ux2` on the app root. Until the owner says it is for everyone it is on
   for the admin account (the owner opens the app and simply sees it) and for
   anyone who opens `/?ux=2` (remembered on that device); `/?ux=0` turns it off
   again, even for the admin, so the two can be compared side by side.
   Everything the series adds is written under `.ux2` (ux2-styles.ts) or guarded
   by this flag, so with it off the app is exactly what it was.

   To make it the default for everyone, change the last line of `uxEnabled`. */

export const UX_KEY = "tg_ux2";

export function uxEnabled(isAdmin: boolean): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("ux");
    if (q === "2" || q === "0") {
      localStorage.setItem(UX_KEY, q === "2" ? "1" : "0");
      // keep the address tidy: the choice is remembered, the parameter is not needed again
      const u = new URL(window.location.href);
      u.searchParams.delete("ux");
      window.history.replaceState({}, "", u.pathname + (u.search || "") + u.hash);
    }
    const v = localStorage.getItem(UX_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch (e) { /* private mode: fall through to the default */ }
  return !!isAdmin;
}
