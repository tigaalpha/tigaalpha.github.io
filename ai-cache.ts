/* ── ai-cache.ts ──
   Content-addressable client-side cache for AI responses that are safe to
   reuse when the exact same request would otherwise be sent again - the
   daily coach tip and the weekly report/practice plan, both regenerated
   from profile/activity stats that only change when the user actually
   does something (practices, logs a session), not on every popup open or
   modal reopen. Keyed by a hash of the request body itself rather than a
   hand-maintained cache key, so any real change to the underlying stats
   (which are baked into the prompt text) naturally produces a different
   hash and busts the cache with no manual invalidation logic anywhere -
   only a genuinely repeat request for the exact same prompt ever hits it.

   Deliberately NOT used for chat, Voice Tutor, play-along composition, or
   camera-coach analysis - those are either inherently unique per call
   (a live conversation turn, a fresh photo) or already have their own
   tier-1 local-match cache (chat's matchFaqTopic). Caching those would
   either do nothing (never a repeat hash) or actively hurt UX (replaying
   a stale conversational reply). */

const CACHE_KEY = "tg_ai_cache_v1";
const MAX_ENTRIES = 20; // small bound - this is a handful of named features, not a general-purpose store

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

function readCache(): Record<string, { text: string; ts: number }> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch (e) { return {}; }
}

function writeCache(cache: Record<string, { text: string; ts: number }>) {
  const entries = Object.entries(cache).sort((a, b) => b[1].ts - a[1].ts).slice(0, MAX_ENTRIES);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries))); } catch (e) {}
}

// Wraps an async fetcher with a TTL'd, content-addressed cache. `namespace`
// prefixes the hash so two different features never collide even on an
// identical prompt. `fetcher` should resolve to a non-empty string on
// success or null/"" on a soft failure - only a truthy result is cached,
// so a failed attempt (or a thrown error, which propagates past this
// function uncaught) never gets replayed for the rest of the TTL window.
export async function withAiCache(namespace: string, keyBody: any, ttlMs: number, fetcher: () => Promise<string | null>): Promise<string | null> {
  const key = namespace + ":" + hashStr(JSON.stringify(keyBody));
  const cache = readCache();
  const hit = cache[key];
  if (hit && Date.now() - hit.ts < ttlMs) return hit.text;
  const text = await fetcher();
  if (text) { cache[key] = { text, ts: Date.now() }; writeCache(cache); }
  return text;
}
