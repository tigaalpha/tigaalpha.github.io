/* ── landing/land-log.ts ──
   The landing page used shared-infra's logUsage() for its funnel events, but
   shared-infra statically imports the Supabase client — ~40 kB gzip of auth
   code that this page cannot use until somebody taps sign-up, bought on every
   ad click before the piano renders. Median dwell here is ~2s, so those
   kilobytes ARE the bounce.

   This module writes the exact same rows — same table, same column values,
   same anon (no-session) auth the landing's events always had — over a plain
   REST POST instead of the supabase-js client. The leave/dwell event also
   gains keepalive:true, which survives unload better than the old fetch.

   anonId/trafficSource/uaKind live in local-identity.ts (imported here and
   re-exported for any caller that still reaches for them from this module);
   nothing in this file may import from the app's supabase client. ── */

import { anonId, trafficSource, uaKind, deviceInfo, deviceWidth } from "../local-identity";
export { anonId, trafficSource, uaKind, deviceInfo, deviceWidth };

/* VERBATIM values from supabase-client.ts — both are PUBLIC by design; the
   anon key ships in every frontend bundle regardless. */
const SUPABASE_URL = "https://gsaqgbracxnucdmtmcxz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYXFnYnJhY3hudWNkbXRtY3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTM1MzAsImV4cCI6MjA5NzM4OTUzMH0.vwhXn9usX4YRJdGEL8VU-E86mYfg6mZQbjkernMNXT4";

/* Same wire shape as shared-infra's logUsage(): one usage_events row, kind
   "land", user_id ABSENT (the anon insert policy only accepts rows that claim
   no user — and everyone on this page is a guest by definition). keepalive so
   the leave/dwell row survives the tab closing under it. */
export function logLand(kind, itemId, durationMs = null) {
  if (!itemId) return;
  try {
    const row = {
      kind, item_id: String(itemId),
      anon_id: anonId(), src: trafficSource(), ua: uaKind(),
      dev: deviceInfo(), dev_w: deviceWidth(),
    };
    if (durationMs != null) row.duration_ms = Math.max(0, Math.round(durationMs));
    fetch(SUPABASE_URL + "/rest/v1/usage_events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}
