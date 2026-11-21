/* blog-return.ts — the way back to a blog article after a log-in (owner 2026-11-21: "to read the other 70% they log in or sign up").
   The unlock card of a blog article (scripts/blog-gate.mjs, written into every article page) saves tg_blog_return = {"p": "/blog/<lang>/<slug>.html", "t": <ms>} in this browser when the
   reader taps Google / sign up / log in. When that reader has a session and the profile is loaded, App.tsx takes the key ONCE and goes back to the article, where the whole text is theirs now.
   Only a blog article of this site is ever followed (a path, no other origin, no "//", no query or hash, ".html"), and only within an hour of the tap, so an old key can never send someone
   away from the app later. The key is removed whatever it holds. It is device-local (cloud-sync.ts): it never belongs to an account. */
export const BLOG_RETURN_KEY = "tg_blog_return";
export const BLOG_RETURN_MAX_AGE_MS = 60 * 60 * 1000;
const PATH = /^\/blog\/[a-z]{2}\/[A-Za-z0-9_%.~-]{1,200}\.html$/;

type Store = { getItem(k: string): string | null; removeItem(k: string): void };

/* The article path to go back to, or null. Removes the key in every case (a bad value must not stay). `now` is passed in so the rule is testable. */
export function takeBlogReturn(ls: Store | null | undefined, now: number): string | null {
  if (!ls) return null;
  let raw: string | null = null;
  try { raw = ls.getItem(BLOG_RETURN_KEY); } catch (e) { return null; }
  if (raw == null) return null;
  try { ls.removeItem(BLOG_RETURN_KEY); } catch (e) { /* storage refused: nothing more to do */ }
  try {
    const r = JSON.parse(raw);
    if (!r || typeof r.p !== "string" || typeof r.t !== "number") return null;
    const age = now - r.t;
    if (!(age >= 0 && age <= BLOG_RETURN_MAX_AGE_MS)) return null;
    if (!PATH.test(r.p) || r.p.includes("..")) return null;
    return r.p;
  } catch (e) { return null; }
}
