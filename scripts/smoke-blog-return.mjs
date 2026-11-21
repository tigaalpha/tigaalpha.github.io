#!/usr/bin/env node
/* smoke-blog-return.mjs — the way back to a blog article after a log-in (owner 2026-11-21).
   The unlock card of an article page saves tg_blog_return; blog-return.ts decides whether the app may follow it; App.tsx follows it once the account and the profile are loaded.
   The real blog-return.ts is transpiled with esbuild and run (no browser, no network); the wiring is checked in the sources.
     node scripts/smoke-blog-return.mjs */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json")); const { transformSync } = require("esbuild");
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const js = transformSync(fs.readFileSync(path.join(ROOT, "blog-return.ts"), "utf8"), { loader: "ts", format: "esm" }).code;
const M = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const NOW = 1_800_000_000_000;
const store = (v) => { const m = new Map(v === undefined ? [] : [[M.BLOG_RETURN_KEY, v]]); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => { m.delete(k); } }; };
const val = (p, t = NOW - 5000) => JSON.stringify({ p, t });

console.log("the rule (blog-return.ts)");
ok(M.BLOG_RETURN_KEY === "tg_blog_return", "the key is tg_blog_return");
{ const s = store(val("/blog/en/piano-posture.html")); ok(M.takeBlogReturn(s, NOW) === "/blog/en/piano-posture.html" && !s.m.has("tg_blog_return"), "an article path tapped a few seconds ago is returned, and the key is removed (once)"); ok(M.takeBlogReturn(s, NOW) === null, "...a second call finds nothing"); }
for (const [lang, slug] of [["th", "%E0%B8%97%E0%B9%88%E0%B8%B2"], ["ar", "a-b_c.d~e"], ["de", "klavier-lernen-2"], ["zh", "x"]]) { const p = `/blog/${lang}/${slug}.html`; ok(M.takeBlogReturn(store(val(p)), NOW) === p, "accepted: " + p); }
// what location.pathname gives for a live article: no ".html", and the characters encodeURIComponent leaves alone
for (const p of ["/blog/en/after-work-25-minute-practice", "/blog/de/what-s-new(1)", "/blog/fr/l'amour!", "/blog/th/%E0%B8%97%E0%B9%88%E0%B8%B2*x"]) ok(M.takeBlogReturn(store(val(p)), NOW) === p, "accepted without .html / with ! ' ( ) *: " + p);
ok(M.takeBlogReturn(store(val("/blog/en/x.html", NOW - 14 * 60 * 1000)), NOW) === "/blog/en/x.html", "14 minutes after the tap is still accepted");
{ const s = store(val("/blog/en/x.html", NOW - 16 * 60 * 1000)); ok(M.takeBlogReturn(s, NOW) === null && !s.m.has("tg_blog_return"), "16 minutes after the tap is refused, and the old key is removed too"); }
ok(M.takeBlogReturn(store(val("/blog/en/x.html", NOW + 60000)), NOW) === null, "a time in the future is refused");
for (const bad of ["//evil.example/blog/en/x.html", "https://evil.example/blog/en/x.html", "/blog/en/../../x.html", "/blog/en/x.html?a=1", "/blog/en/x.html#frag", "/blog/EN/x.html", "/blog/en/x.html/", "/blog/en/..", "/blog/en/a..b.html", "/blog/e/x.html", "/blog/eng/x.html", "/songs/en/x.html", "/blog/en/", "/blog/en/index.html/..", "javascript:alert(1)", "/blog/en/a b.html", "/blog/en/a\\b.html", "/blog/en/" + "a".repeat(220) + ".html", "", "blog/en/x.html"]) {
  const s = store(val(bad)); ok(M.takeBlogReturn(s, NOW) === null && !s.m.has("tg_blog_return"), "refused (and removed): " + JSON.stringify(bad).slice(0, 60));
}
for (const [what, v] of [["not JSON", "not json"], ["a number", "5"], ["null", "null"], ["no path", JSON.stringify({ t: NOW })], ["no time", JSON.stringify({ p: "/blog/en/x.html" })], ["a string time", JSON.stringify({ p: "/blog/en/x.html", t: String(NOW) })], ["an array", "[]"]]) { const s = store(v); ok(M.takeBlogReturn(s, NOW) === null && !s.m.has("tg_blog_return"), "refused (and removed): " + what); }
ok(M.takeBlogReturn(null, NOW) === null && M.takeBlogReturn(undefined, NOW) === null, "no storage: nothing, no throw");
ok(M.takeBlogReturn(store(undefined), NOW) === null, "no key: nothing");
ok(M.takeBlogReturn({ getItem() { throw new Error("denied"); }, removeItem() {} }, NOW) === null, "storage that throws on read: nothing, no throw");
{ let removed = false; const s = { getItem: () => val("/blog/en/x.html"), removeItem() { removed = true; throw new Error("denied"); } }; ok(M.takeBlogReturn(s, NOW) === "/blog/en/x.html" && removed, "storage that throws on remove: the path is still returned, no throw"); }

console.log("the wiring");
{
  const app = fs.readFileSync(path.join(ROOT, "App.tsx"), "utf8");
  ok(/import \{ takeBlogReturn \} from "\.\/blog-return";/.test(app), "App.tsx imports takeBlogReturn");
  const i = app.indexOf("takeBlogReturn(window.localStorage, Date.now())"), blk = app.slice(Math.max(0, i - 400), i + 400);
  ok(i > 0 && /useEffect\(\(\) => \{\s*if \(!session \|\| !profileReady\) return;/.test(blk) && /\}, \[session, profileReady\]\);/.test(blk) && /window\.location\.replace\(to\)/.test(blk), "App.tsx follows it in an effect that waits for a session and a loaded profile, and replaces the location (the back button does not return to the app)");
  ok((app.match(/takeBlogReturn\(/g) || []).length === 1, "and in one place only");
  const gen = fs.readFileSync(path.join(ROOT, "scripts/build-blog-pages.mjs"), "utf8");
  ok(gen.includes('LS.setItem("tg_blog_return",JSON.stringify({p:location.pathname,t:Date.now()}))'), "the article page writes {p: pathname, t: now} under the same key");
  const reg = fs.readFileSync(path.join(ROOT, "cloud-sync.ts"), "utf8");
  ok(/tg_blog_return: "/.test(reg), "the key is registered as device-local in cloud-sync.ts");
}

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
