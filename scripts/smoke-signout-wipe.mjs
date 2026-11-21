#!/usr/bin/env node
/* smoke-signout-wipe.mjs — an explicit Sign out must not leave the account's data readable for the next person (guest-first entry review, 2026-11-21).
   Until that day the log-in wall of the owner's domain hid whatever a member left in the browser; the guest-first entry shows the Learning Pathway to whoever comes next, so signOut() (App.tsx)
   runs wipeAfterSignOut() (cloud-sync.ts: the unflushed changes are stashed first, then every synced key and the owner marker go) and keeps the member's language for the guest that follows.
   A stubbed MEMBER (a Supabase session in localStorage, every Supabase call answered locally) signs out from the drawer in a real Chromium page and the browser is inspected.
   Part 2 checks that the guest's language is written into a NEW account only.
   Needs Playwright + Chromium and a built dist/ (DIST=<dir> tests another build).   Run: node scripts/smoke-signout-wipe.mjs   (npm run verify:guest runs it after smoke-guest-trial) */
import { createRequire } from "module"; import http from "http"; import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
let chromium; for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"]) { try { chromium = require(p).chromium; break; } catch (e) {} }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = process.env.DIST ? path.resolve(process.env.DIST) : path.join(ROOT, "dist");
if (!chromium || !fs.existsSync(path.join(DIST, "index.html"))) { console.error("this check did NOT run: Playwright / Chromium or " + DIST + "/index.html is missing (npm run build first)"); process.exit(1); }
const REF = "gsaqgbracxnucdmtmcxz", UID = "00000000-0000-4000-8000-000000000001";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split("?")[0]); let fp = path.join(DIST, u === "/" ? "/index.html" : u); if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html"); if (!fp.startsWith(DIST) || !fs.existsSync(fp)) { res.writeHead(404); return res.end("nf"); } res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(fp).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const HOST = "www.tigaalpha.com", BASE = `http://${HOST}:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined, args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); };
const profile = { id: UID, name: "Tester", full_name: "Tester", onboarded: true, lang: "en", exp: 400, coins: 50, gems: 0, is_admin: false, admin_tier: 0, banned: false, created_at: "2025-01-01T00:00:00Z", plan: "premium", plan_until: "2099-01-01T00:00:00Z" };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", serviceWorkers: "block" });
const errors = [];
await ctx.route(/supabase\.co/, async (r) => {
  const req = r.request(), url = req.url();
  if (/\/rest\/v1\/profiles/.test(url) && req.method() === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) });
  if (/\/auth\/v1\//.test(url)) return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
});
await ctx.addInitScript(({ ref, uid }) => {
  try {
    if (!localStorage.getItem("__seeded")) {
      localStorage.setItem("__seeded", "1");
      localStorage.setItem("tg_pa_intro", "1"); localStorage.setItem("tg_permprimed", "1"); localStorage.setItem("tg_push_primed", "1"); localStorage.setItem("tg_welcomed", "1");
      localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: "stub.access.token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "stub-refresh", user: { id: uid, aud: "authenticated", role: "authenticated", email: "tester@example.com", app_metadata: {}, user_metadata: {}, created_at: "2025-01-01T00:00:00Z" } }));
      localStorage.setItem("tg_sync_owner", uid);
      localStorage.setItem("tg_chat_idx", JSON.stringify([{ id: "t1", title: "private chat about my lesson" }]));
      localStorage.setItem("tg_chat_t_t1", JSON.stringify({ id: "t1", title: "private chat about my lesson", msgs: [{ r: "u", t: "what is a C major scale" }] }));
      localStorage.setItem("tg_coins", "300"); localStorage.setItem("tg_plan", "premium"); localStorage.setItem("tg_premium", "1"); localStorage.setItem("tg_paid_activated", "1");   // the member's wallet and plan mirrors: they stay on the browser after a Sign out, and must not wake any pop-up for the guest that follows
      localStorage.setItem("tg_path_done", JSON.stringify(["stage-a", "stage-b"]));
      localStorage.setItem("tg_favs", JSON.stringify(["a-favourite-song"]));
    }
  } catch (e) {}
}, { ref: REF, uid: UID });
const page = await ctx.newPage();
page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForSelector(".hdr", { timeout: 45000 }); await page.waitForTimeout(2500);
ok(!(await page.$(".guestloginpill")), "the member is signed in (no corner Login pill)");
const ls = () => page.evaluate(() => { const o = {}; for (const k of ["tg_chat_idx", "tg_chat_t_t1", "tg_path_done", "tg_favs", "tg_sync_owner", "tg_guest_profile", "tg_user_signed_out", "tg_plan", "tg_premium", "tg_paid_activated", "tg_edu_seen"]) o[k] = localStorage.getItem(k); o.chatStash = Object.keys(localStorage).filter(k => k.startsWith("tg_sync_stash_chat_")); return o; });
console.log("before:", JSON.stringify(await ls()).slice(0, 300));
for (let i = 0; i < 4; i++) { const x = await page.$(".atpopup-x, .atpopup button"); if (!x) break; await x.click().catch(() => {}); await page.waitForTimeout(400); }
await page.locator("button.hamb, button.vidfab").first().click({ timeout: 10000 }); await page.waitForTimeout(600);
const so = page.locator(".draweritem.sub", { hasText: /sign out/i }).first();
ok(await so.count() === 1, "the drawer offers Sign out to a member");
await so.click(); await page.waitForTimeout(3800);   // the pop-ups the leftovers used to wake fire at 1 s (activation) and ~3 s (first coins)
const after = await ls();
console.log("after: ", JSON.stringify(after).slice(0, 400));
ok(!!(await page.$(".guestloginpill")), "after Sign out the app is the guest app (the corner Login pill is back)");
ok(!!(await page.$(".pathpage")), "...on the Learning Pathway");
ok(!(await page.$("[data-login-wall]")) && !(await page.$("[data-trial-invite]")), "...with no wall and no invitation");
ok(!(await page.$(".atpopup")), "...and nothing but the Pathway: no \"first coins\" / \"your teacher is ready\" pop-up from the member's leftover wallet and plan");
ok(after.tg_paid_activated === null && after.tg_plan !== "premium", "the member's plan mirror is gone (the guest's own is the free preview, " + after.tg_plan + ") and the guest tree did not re-create the paid-activation flag (" + after.tg_paid_activated + ")");
ok(after.tg_chat_idx === null && after.tg_path_done === null && after.tg_favs === null, "the account's private chat list, Pathway ticks and favourites are gone from the browser");
ok(after.tg_sync_owner === null, "the owner marker is gone");
ok(after.tg_chat_t_t1 === null && after.chatStash.length === 1, "the chat thread left the readable keys but is kept whole in the account's own stash (" + after.chatStash.length + " stash key)");
let gl = null; try { gl = JSON.parse(after.tg_guest_profile || "{}").lang; } catch (e) {}
ok(gl === "en", "the guest keeps the language the member was using (" + gl + ")");
ok(/Login/.test(await page.innerText(".guestloginpill")), "...and the page is in English (the pill says Login)");
ok(after.tg_user_signed_out === "1", "the explicit sign-out marker is set (the stay-signed-in restore must not undo it)");
ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors[0] : ""));

/* part 2: the language a visitor chose as a guest (the header flag, the blog or landing page they came from) goes into a NEW account only. An old account whose lang is null runs in Thai by default:
   a guest flag flipped to English on the same browser must not switch that member for good on every device (round-2 review, 2026-11-21). */
async function langWrites(over, guestLang) {
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", serviceWorkers: "block" });
  const patches = [], prof = { ...profile, lang: null, plan: "free", plan_until: null, ...over };
  await c2.route(/supabase\.co/, async (r) => {
    const req = r.request(), url = req.url();
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(prof) });
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === "PATCH") { try { patches.push(JSON.parse(req.postData() || "{}")); } catch (e) {} return r.fulfill({ status: 200, contentType: "application/json", body: "[]" }); }
    if (/\/auth\/v1\//.test(url)) return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await c2.addInitScript(({ ref, uid, gl }) => {
    try {
      if (!localStorage.getItem("__seeded")) {
        localStorage.setItem("__seeded", "1");
        localStorage.setItem("tg_pa_intro", "1"); localStorage.setItem("tg_permprimed", "1"); localStorage.setItem("tg_push_primed", "1"); localStorage.setItem("tg_welcomed", "1");
        localStorage.setItem("tg_guest_profile", JSON.stringify({ lang: gl }));
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: "stub.access.token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "stub-refresh", user: { id: uid, aud: "authenticated", role: "authenticated", email: "tester@example.com", app_metadata: {}, user_metadata: {}, created_at: "2025-01-01T00:00:00Z" } }));
      }
    } catch (e) {}
  }, { ref: REF, uid: UID, gl: guestLang });
  const pg = await c2.newPage(); await pg.goto(BASE, { waitUntil: "domcontentloaded" }); await pg.waitForTimeout(4000);
  await c2.close();
  return patches.filter((x) => "lang" in x).map((x) => x.lang);
}
const OLD = { onboarded: true, created_at: "2025-01-01T00:00:00Z" };
ok(JSON.stringify(await langWrites({ ...OLD }, "en")) === "[]", "an OLD account with no language is not switched to the guest's English for good (no profiles.lang write)");
ok(JSON.stringify(await langWrites({ ...OLD, lang: "th" }, "en")) === "[]", "an account that already holds a language keeps it (no write)");
const onlyEn = (w) => w.length >= 1 && w.every((x) => x === "en");   // the sign-up form saves the language again, so more than one write of "en" is fine
ok(onlyEn(await langWrites({ onboarded: false, created_at: "2025-01-01T00:00:00Z" }, "en")), "an account that has not finished its sign-up takes the guest's language (it would flip to Thai the moment they log in)");
ok(onlyEn(await langWrites({ onboarded: true, created_at: new Date(Date.now() - 120000).toISOString() }, "en")), "an account made two minutes ago takes it too");

await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
