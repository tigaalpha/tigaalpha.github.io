#!/usr/bin/env node
/* smoke-guest-trial.mjs — the guest-first entry (owner 2026-11-21).
   "Cut the forced log-in pop-up. Everyone who comes in through www.tigaalpha.com sees the Learning Pathway first, without logging in, and can use all the features 3 times; then a pop-up
    invites them to continue free for 7 days and to log in: log in to learn piano with TIGA ALPHA, free for 7 days, no credit card."
   Part 1 (no browser): guest-uses.ts, the counter, run as it is (storage that throws, corrupt values, never below zero).
   Part 2 (headless Chromium on the built app in dist/, the host www.tigaalpha.com mapped to the local server so the app really runs on the owner's domain): no wall and no pop-up on arrival or
   six seconds later, the Pathway is the first page, browsing is free, three song starts are free and the fourth shows the invitation (th / en / zh / ja / ko / ru / hi / es / fr / ar / de, no sideways
   scroll at 320 px), the first-song intro is free, Ear Gym and Reading starts are counted, the invitation closes (button, Escape, backdrop) and comes back at the next start, the AI-only lesson shows it at once and spends nothing, a local lesson is one use and
   its drill is free, ?wall=signup | login still opens the standard card and "Not now" lets the visitor in.
     npm run build && node scripts/smoke-guest-trial.mjs        (DIST=<folder> to test another build; exit 1 and "did NOT run" when Playwright / Chromium are missing) */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");
const require = createRequire(path.join(ROOT, "package.json"));
let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log("  ✓ " + n); } else { fails.push(n); console.log("  ✗ FAIL: " + n); } };
const done = () => { console.log(`\n${pass} passed, ${fails.length} failed`); if (fails.length) console.log("failed:\n - " + fails.join("\n - ")); process.exit(fails.length ? 1 : 0); };

/* ───────── part 1: the counter ───────── */
console.log("the counter (guest-uses.ts)");
const { transformSync } = require("esbuild");
const src = fs.readFileSync(path.join(ROOT, "guest-uses.ts"), "utf8");
ok(!/^\s*import\s/m.test(src), "guest-uses.ts imports nothing (so it can be run on its own)");
const js = transformSync(src, { loader: "ts", format: "esm" }).code;
const load = async (store) => {
  globalThis.localStorage = store;
  return import("data:text/javascript;base64," + Buffer.from(js + "\n// " + Math.random()).toString("base64"));
};
const mem = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
{
  const st = mem(); const U = await load(st);
  ok(U.GUEST_FREE_USES === 3 && U.GUEST_USES_KEY === "tg_guest_uses", "three free uses, kept under tg_guest_uses");
  ok(U.getGuestUses() === 0 && U.guestUsesLeft() === 3, "a new visitor has used nothing and has three left");
  ok(U.addGuestUse() === 1 && U.addGuestUse() === 2 && U.addGuestUse() === 3 && U.guestUsesLeft() === 0, "three uses are written down and nothing is left");
  ok(U.addGuestUse() === 4 && U.guestUsesLeft() === 0 && st.m.get("tg_guest_uses") === "4", "a fourth write never makes 'left' negative");
}
{
  const st = mem(); st.m.set("tg_guest_uses", "2"); const U = await load(st);
  ok(U.getGuestUses() === 2 && U.guestUsesLeft() === 1, "the count is read back from storage (a reload keeps it)");
}
for (const [what, v, left] of [["text", "abc", 3], ["a negative number", "-5", 3], ["an empty value", "", 3], ["a huge number", "99999999", 0], ["a decimal", "1.9", 2]]) {
  const st = mem(); st.m.set("tg_guest_uses", v); const U = await load(st);
  ok(U.guestUsesLeft() === left, "a stored value that is " + what + " (" + JSON.stringify(v) + ") leaves " + left);
}
{
  const U = await load({ getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } });
  let n = 0; try { n = U.addGuestUse(); U.addGuestUse(); U.addGuestUse(); } catch (e) { n = -1; }
  ok(n === 1 && U.guestUsesLeft() === 0 && U.getGuestUses() === 3, "where storage refuses (private mode) the count is kept in memory for the page, and nothing throws");
}

/* ───────── part 2: the built app in Chromium ───────── */
console.log("\nthe built app on the owner's domain (headless Chromium)");
let chromium; for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"]) { try { chromium = require(p).chromium; break; } catch (e) {} }
const DIST = process.env.DIST ? path.resolve(process.env.DIST) : path.join(ROOT, "dist");
if (!chromium || !fs.existsSync(path.join(DIST, "index.html"))) { console.error("this check did NOT run: Playwright / Chromium or " + DIST + "/index.html is missing (npm run build first)"); process.exit(1); }
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".txt": "text/plain", ".woff2": "font/woff2", ".wasm": "application/wasm", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(DIST, u === "/" ? "/index.html" : u);
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
  if (!fp.startsWith(DIST) || !fs.existsSync(fp)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const HOST = "www.tigaalpha.com", BASE = `http://${HOST}:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined, args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n-src", "catalog.json"), "utf8"));

// a fresh visitor: nothing stored, the live backend refused (a guest needs none); `seed` is written before the app starts
async function visitor({ lang = "", uses = null, w = 390, h = 844, seed = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: lang === "th" || !lang ? "th-TH" : "en-US" });
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(String((e && e.stack) || e).slice(0, 240)));
  page.on("console", (m) => { if (m.type() === "error" && /Minified React|Cannot read|is not a function|is not defined/.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await page.route(/supabase\.co|googleapis|google-analytics|googletagmanager|jsdelivr|storage\.googleapis/, (r) => r.abort());
  await ctx.addInitScript(({ lang, uses, seed }) => {
    try {
      if (!localStorage.getItem("__seeded")) {
        localStorage.setItem("__seeded", "1");
        localStorage.setItem("tg_pa_intro", "1");   // the first-song intro is offered once per device: not what is tested here
        if (lang) localStorage.setItem("tg_guest_profile", JSON.stringify({ lang }));
        if (uses != null) localStorage.setItem("tg_guest_uses", String(uses));
        for (const k of Object.keys(seed)) localStorage.setItem(k, seed[k]);
      }
    } catch (e) {}
  }, { lang, uses, seed });
  return { ctx, page, errors };
}
const uses = (page) => page.evaluate(() => { try { return localStorage.getItem("tg_guest_uses"); } catch (e) { return "?"; } });
/* the headline carries a no-break space inside the brand name and word joiners (keepWords in app-shell.tsx): compare the text without them */
const clean = (t) => t.replace(/\u2060/g, "").replace(/\u00a0/g, " ");
const has = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; }, sel);
const boot = async (page, qs = "") => { await page.goto(BASE + qs, { waitUntil: "domcontentloaded" }); await page.waitForSelector(".hdr", { timeout: 45000 }); await page.waitForTimeout(900); };
const startSong = async (page, id) => { await boot(page, "?song=" + id); await page.waitForSelector(".pl-start", { timeout: 30000 }); await page.waitForTimeout(500); await page.click(".pl-start"); await page.waitForTimeout(1100); };

// ── arrival ──
{
  const { ctx, page, errors } = await visitor();
  await boot(page);
  ok(await has(page, ".guestloginpill"), "a visitor with no account is a guest (the corner Login pill is there)");
  ok(await has(page, ".pathpage"), "the Learning Pathway is the first page");
  ok(!(await has(page, "[data-login-wall]")) && !(await has(page, "[data-trial-invite]")), "on www.tigaalpha.com there is no log-in wall and no invitation on arrival");
  await page.waitForTimeout(6500);   // the old wall came at once; a pop-up "after 5 seconds" must not come later either
  ok(!(await has(page, "[data-login-wall]")) && !(await has(page, "[data-trial-invite]")) && !(await has(page, ".gatecard")), "...and none appears six seconds later");
  ok(!(await has(page, ".atpopup")) && !(await has(page, ".permprimer-overlay")) && !(await has(page, ".setov")) && !(await has(page, ".convpop")), "no pop-up of any kind (welcome offer, tip, permission) covers the Pathway on arrival or six seconds later");
  ok(!(await has(page, ".trial-banner")), "a guest is not shown the 'free trial, N days left' banner (the trial starts at sign-up)");
  ok((await uses(page)) === null, "looking at the page spends no use");
  const cards = await page.$$eval(".pathpage .pcard", (e) => e.length);
  ok(cards >= 8, "the Pathway shows its cards (" + cards + ")");
  const before = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  ok(before, "no sideways scroll on arrival");
  ok(errors.length === 0, "no page errors on arrival" + (errors.length ? ": " + errors[0] : ""));
  await ctx.close();
}

// ── browsing is free ──
{
  const { ctx, page, errors } = await visitor({ seed: {} });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem("__s")) { sessionStorage.setItem("__s", "1"); sessionStorage.setItem("tiga_page", "studio"); } } catch (e) {} });
  await boot(page);
  ok(!(await has(page, "[data-trial-invite]")) && !(await has(page, "[data-login-wall]")), "the Studio menu opens as a guest without any pop-up");
  await page.click(".hamb"); await page.waitForTimeout(500);
  ok(await has(page, ".drawer.open"), "the menu drawer opens");
  await page.keyboard.press("Escape").catch(() => {});
  ok((await uses(page)) === null, "browsing pages and menus spends no use");
  ok(errors.length === 0, "no page errors while browsing" + (errors.length ? ": " + errors[0] : ""));
  await ctx.close();
}

// ── three songs are free, the fourth shows the invitation ──
{
  const { ctx, page, errors } = await visitor();
  for (const [i, id] of ["twinkle", "mary", "row"].entries()) {   // level-1 songs: a new guest can open them (the deep link lands on the song list for a locked one)
    await startSong(page, id);
    ok((await uses(page)) === String(i + 1) && !(await has(page, "[data-trial-invite]")), `song ${i + 1} (${id}) starts, use ${i + 1} of 3 is written down, no pop-up`);
  }
  await startSong(page, "hot_cross_buns");
  ok(await has(page, "[data-trial-invite]"), "the fourth start shows the invitation");
  ok((await page.getAttribute("[data-trial-invite]", "data-reason")) === "trial", "...with the reason 'trial'");
  ok((await uses(page)) === "3", "...and a refused start is not counted");
  const t = clean(await page.innerText("[data-trial-invite]"));
  ok(t.includes("ล็อกอินเพื่อเรียนเปียโนกับ TIGA ALPHA") && t.includes("ฟรี 7 วัน") && t.includes("ไม่ต้องใช้บัตรเครดิต"), "the Thai invitation: log in to learn piano with TIGA ALPHA, free 7 days, no credit card");
  ok(await has(page, "[data-trial-invite] .au-g") && await has(page, "[data-trial-invite] .au-cta"), "it offers Google and the e-mail sign-up / log-in");
  // the invitation can be closed: the Pathway stays, the next start asks again
  await page.click("[data-invite-close]"); await page.waitForTimeout(400);
  ok(!(await has(page, "[data-trial-invite]")), "'Not now' closes it");
  ok(await has(page, ".pl-start"), "...and leaves the song's ready screen where it was");
  await page.click(".pl-start"); await page.waitForTimeout(700);
  ok(await has(page, "[data-trial-invite]"), "starting again asks again");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  ok(!(await has(page, "[data-trial-invite]")), "Escape closes it");
  await page.click(".pl-start"); await page.waitForTimeout(700);
  await page.mouse.click(5, 5); await page.waitForTimeout(300);
  ok(!(await has(page, "[data-trial-invite]")), "a tap beside the card closes it");
  ok((await uses(page)) === "3", "closing and asking again never spends a use");
  // the count is the browser's: a reload keeps it
  await startSong(page, "merrily");
  ok(await has(page, "[data-trial-invite]") && (await uses(page)) === "3", "after a reload the preview is still used up");
  ok(errors.length === 0, "no page errors in the whole flow" + (errors.length ? ": " + errors[0] : ""));
  await ctx.close();
}

// ── replays of a chosen song are free ──
{
  const { ctx, page } = await visitor();
  await startSong(page, "twinkle");
  ok((await uses(page)) === "1", "a song's first start is one use");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) if (/restart|เริ่มใหม่|重/i.test(b.textContent || "")) { b.click(); break; } });
  await page.waitForTimeout(600);
  ok((await uses(page)) === "1", "a restart of the same song is not another use");
  await ctx.close();
}

// ── the Pathway: a lesson that only the live AI can answer shows the invitation at once and costs nothing ──
// the game-feature tips ("coins come from every practice ...") are the app's own pop-ups for members and guests alike, raised after a first payout: a learner closes them; so does this script
const closePops = async (page) => { for (let i = 0; i < 4; i++) { const x = await page.$(".atpopup-x"); if (!x) break; await x.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(250); } };
const openCard = async (page, id) => {   await closePops(page); await page.evaluate((i) => { const e = document.getElementById("pcard-" + i); if (e) e.scrollIntoView({ block: "center" }); }, id); await page.waitForTimeout(300); await page.click("#pcard-" + id); await page.waitForSelector(".keypanel", { timeout: 8000 }); };
const pickFirst = async (page) => {   // step 1 the type (when the stage has types), step 2 the key (C): that is the tap that starts the lesson
  await closePops(page);
  if (!(await page.$(".keygrid"))) { await page.locator(".keypanel button").first().click(); await page.waitForTimeout(450); }
  await closePops(page);
  if (await page.$(".keygrid")) { await page.locator(".keygrid .keybtn").first().click(); await page.waitForTimeout(700); }
};
{
  const { ctx, page, errors } = await visitor();
  await boot(page);
  await openCard(page, "tension"); await pickFirst(page); await page.waitForTimeout(600);
  ok(await has(page, "[data-trial-invite]") && (await page.getAttribute("[data-trial-invite]", "data-reason")) === "ai", "an AI-only lesson (Tension) shows the invitation at once, reason 'ai'");
  ok((await uses(page)) === null, "...and spends no use");
  ok(await has(page, ".pathpage"), "...and the Pathway is still there (no half-opened lesson)");
  await page.click("[data-invite-close]"); await page.waitForTimeout(300);
  await ctx.close();
}
// ── a local lesson is one use, and the drill that follows it is part of that use ──
{
  const { ctx, page, errors } = await visitor();
  await boot(page);
  await openCard(page, "scale"); await pickFirst(page); await page.waitForTimeout(1200);
  ok((await uses(page)) === "1" && !(await has(page, "[data-trial-invite]")), "a Scale lesson opens and is one use");
  const pb = await has(page, ".practicebtn");
  ok(pb, "the lesson page offers the Practice button");
  if (pb) {
    await closePops(page); await page.click(".practicebtn"); await page.waitForTimeout(1200);
    ok(await has(page, ".practiceov") && !(await has(page, "[data-trial-invite]")), "the drill opens");
    ok((await uses(page)) === "1", "...and the lesson's own drill is not a second use");
  }
  ok(errors.length === 0, "no page errors in the lesson flow" + (errors.length ? ": " + errors[0] : ""));
  await ctx.close();
}

// ── the first-song intro is a tutorial, not a use (the default path of a brand-new guest: nothing is seeded) ──
{
  const { ctx, page, errors } = await visitor();
  await page.addInitScript(() => { try { localStorage.removeItem("tg_pa_intro"); } catch (e) {} });   // runs after the seeding one: this guest has never seen the intro
  await boot(page, "?song=twinkle");
  await page.waitForSelector(".pl-start", { timeout: 30000 }); await page.waitForTimeout(500);
  const intro = await page.$("button.pl-link");
  ok(!!intro && /Skip|ข้าม|跳过/.test(await page.evaluate(() => (document.querySelector("button.pl-link") || {}).textContent || "")), "a brand-new guest is offered the 8-note intro before the first song");
  await page.click(".pl-start"); await page.waitForTimeout(1200);   // 'Try 8 notes'
  ok((await uses(page)) === null && !(await has(page, "[data-trial-invite]")), "playing the intro spends no use");
  await ctx.close();
}
// ── Ear Gym and Reading: one round / one level is one use, the fourth start shows the invitation ──
for (const [name, pageId, sel] of [["Ear Gym", "eargym", "button.tdgo:not(.vio)"], ["Note Reading", "reading", "button.tdstep"]]) {
  for (const used of [0, 3]) {
    const { ctx, page, errors } = await visitor({ uses: used === 0 ? null : used });
    await page.addInitScript((p) => { try { if (!sessionStorage.getItem("__s")) { sessionStorage.setItem("__s", "1"); sessionStorage.setItem("tiga_page", p); } } catch (e) {} }, pageId);
    await boot(page); await page.waitForSelector(sel, { timeout: 15000 }); await closePops(page);
    await page.locator(sel).first().click(); await page.waitForTimeout(900);
    if (used === 0) ok((await uses(page)) === "1" && !(await has(page, "[data-trial-invite]")), `${name}: the first round / level starts and is one use`);
    else ok((await has(page, "[data-trial-invite]")) && (await uses(page)) === "3", `${name}: with the preview used up the start shows the invitation and spends nothing`);
    ok(errors.length === 0, `${name}: no page errors` + (errors.length ? ": " + errors[0] : ""));
    await ctx.close();
  }
}

// ── the invitation in every language, at 320 px ──
const KEY = { title: "Log in to learn piano with TIGA ALPHA", free7: "Try Pro free for {0} days", nocard: "No credit card needed" };   // free7 carries the day count as {0} (TRIAL_DAYS_STANDARD = 7)
const TH = { title: "ล็อกอินเพื่อเรียนเปียโนกับ TIGA ALPHA", free7: "ทดลอง Pro ฟรี 7 วัน", nocard: "ไม่ต้องใช้บัตรเครดิต" };
const ZH = { title: "登录，和 TIGA ALPHA 一起学钢琴", free7: "免费试用 Pro 7 天", nocard: "无需信用卡" };
for (const lang of ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar", "de"]) {
  const want = lang === "th" ? TH : lang === "en" ? { ...KEY, free7: "Try Pro free for 7 days" } : lang === "zh" ? ZH : { title: catalog[KEY.title][lang], free7: catalog[KEY.free7][lang].split("{0}").join("7"), nocard: catalog[KEY.nocard][lang] };
  const { ctx, page, errors } = await visitor({ lang: lang === "th" ? "" : lang, uses: 3, w: 320, h: 640 });
  await startSong(page, "twinkle");
  const shown = await has(page, "[data-trial-invite]");
  const t = shown ? clean(await page.innerText("[data-trial-invite]")) : "";
  const nb = clean;
  ok(shown && t.includes(nb(want.title)) && t.includes(nb(want.free7)) && t.includes(nb(want.nocard)), `${lang}: the invitation says it (title, free for 7 days, no credit card)`);
  if (lang !== "th") ok(!/[฀-๿]/.test(t), `${lang}: ...and shows no Thai`);
  const dn = await page.getAttribute("[data-trial-invite] .setcard", "aria-label");
  ok(dn === want.title && !/[\u00a0\u2060]/.test(dn || ""), `${lang}: the dialog's accessible name is the clean title (no invisible characters) ${JSON.stringify(dn)}`);
  const sw = await page.evaluate(() => { const c = document.querySelector("[data-trial-invite] .setcard"); const d = document.documentElement; return { page: d.scrollWidth - d.clientWidth, card: c ? c.scrollWidth - c.clientWidth : 0, w: c ? c.getBoundingClientRect().width : 0 }; });
  ok(sw.page <= 1 && sw.card <= 1 && sw.w > 200, `${lang}: no sideways scroll at 320 px (page ${sw.page}, card ${sw.card}, width ${Math.round(sw.w)})`);
  if (lang === "ar") ok(await page.evaluate(() => getComputedStyle(document.querySelector("[data-trial-invite] .setcard")).direction === "rtl"), "ar: the invitation flows right to left");
  ok(errors.length === 0, `${lang}: no page errors` + (errors.length ? ": " + errors[0] : ""));
  await ctx.close();
}

// ── the standard card still comes up for a visitor who asked for it (the blog's buttons), and "Not now" lets them in ──
for (const wall of ["signup", "login"]) {
  const { ctx, page, errors } = await visitor();
  await boot(page, "?wall=" + wall);
  await page.waitForSelector("[data-login-wall]", { timeout: 15000 });
  ok(await has(page, "[data-login-wall]") && await has(page, "[data-wall-google]"), `?wall=${wall}: the standard log-in card opens (Google first)`);
  ok(await has(page, "[data-wall-skip]"), `?wall=${wall}: with a 'Not now'`);
  await page.click("[data-wall-skip]"); await page.waitForTimeout(400);
  ok(!(await has(page, "[data-login-wall]")) && await has(page, ".pathpage"), `?wall=${wall}: 'Not now' lets them into the Pathway as a guest`);
  ok((await uses(page)) === null, `?wall=${wall}: and spends nothing`);
  ok(errors.length === 0, `?wall=${wall}: no page errors`);
  await ctx.close();
}
{
  const { ctx, page } = await visitor();
  await boot(page);
  await page.click(".guestloginpill"); await page.waitForTimeout(500);
  ok(await has(page, ".setov") && await has(page, ".setov .au-g"), "the corner Login pill still opens the sign-up / log-in panel");
  await ctx.close();
}


// ── what the independent reviewers found (2026-11-21), one check each ──
// the headline keeps its words whole: the Thai "เปียโน" is never split across two lines and the brand name is never split, at the widths of real phones
const linesOf = (page, sel = "#tg-invite-t") => page.evaluate((sel) => {
  const el = document.querySelector(sel); if (!el) return [];
  const out = []; let cur = "", top = null;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    for (let i = 0; i < n.length; i++) {
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
      const rc = r.getClientRects()[0];
      if (rc) { if (top !== null && Math.abs(rc.top - top) > 4) { out.push(cur); cur = ""; } top = rc.top; }
      cur += n.data[i];
    }
  }
  if (cur) out.push(cur);
  return out;
}, sel);
for (const [lang, widths] of [["th", [320, 360, 390, 430]], ["en", [320, 390]], ["zh", [320, 360]], ["ja", [320, 390]], ["ko", [320, 360, 390, 430]], ["de", [360, 430]]]) {
  for (const w of widths) {
    const { ctx, page } = await visitor({ lang: lang === "th" ? "" : lang, uses: 3, w, h: 700 });
    await startSong(page, "twinkle");
    const L = (await linesOf(page)).map(clean);
    const endsInHalf = L.filter((x, i) => i < L.length - 1 && /(เปีย|TIGA)\s*$/.test(x));   // a line that stops in the middle of the word / the brand
    const startsInHalf = L.filter((x, i) => i > 0 && /^\s*(โน|ALPHA)/.test(x));
    const particleAlone = L.filter((x, i) => i > 0 && /^\s*(로|で|は|を)\s*$/.test(x));
    const koSplit = lang === "ko" ? L.filter((x, i) => i < L.length - 1 && /[\uAC00-\uD7A3]$/.test(x) && /^[\uAC00-\uD7A3]/.test(L[i + 1])) : [];   // Korean breaks at spaces only: a line that stops on a syllable and the next starts on one is a word cut in two
    ok(L.length >= 1 && endsInHalf.length === 0 && startsInHalf.length === 0 && particleAlone.length === 0 && koSplit.length === 0, `${lang} @${w}px: the headline's words stay whole ${JSON.stringify(L)}`);
    await ctx.close();
  }
}

// the invitation is a real dialog: the focus goes in, Tab stays inside, Escape closes (not while a half-typed e-mail waits), a drag from a field to the backdrop does not close it, Enter logs in
{
  const { ctx, page } = await visitor({ uses: 3 });
  const reqs = []; page.on("request", (r) => { if (/supabase\.co\/auth\/v1\/(token|signup)/.test(r.url())) reqs.push(r.url()); });
  await startSong(page, "twinkle");
  ok(await has(page, "[data-trial-invite]"), "dialog: the invitation is up");
  const inside = () => page.evaluate(() => { const c = document.querySelector("[data-trial-invite] .setcard"); return !!c && c.contains(document.activeElement); });
  ok(await inside(), "dialog: the focus moved into the card (a screen reader announces it; Enter / Space do not reach the page behind)");
  let stayed = true; for (let i = 0; i < 26; i++) { await page.keyboard.press("Tab"); if (!(await inside())) { stayed = false; break; } }
  ok(stayed, "dialog: Tab never leaves the card (26 presses)");
  let back = true; for (let i = 0; i < 8; i++) { await page.keyboard.press("Shift+Tab"); if (!(await inside())) { back = false; break; } }
  ok(back, "dialog: Shift+Tab never leaves it either");
  await page.click("[data-trial-invite] .au-segb:nth-child(2)").catch(() => {}); await page.waitForTimeout(200);   // the Log in tab
  await page.click("[data-trial-invite] [data-pw-toggle]"); await page.waitForTimeout(200);   // the e-mail link is the way in; the password fields open from the small link under it
  await page.fill("[data-trial-invite] input[type=email]", "a@b.c"); await page.fill("[data-trial-invite] input[type=password]", "secret1");
  const box = await page.locator("[data-trial-invite] input[type=email]").boundingBox();
  await page.mouse.move(box.x + 12, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(4, 4, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(300);
  ok(await has(page, "[data-trial-invite]") && (await page.inputValue("[data-trial-invite] input[type=email]")) === "a@b.c", "dialog: a press that starts in a field and ends on the backdrop (a text selection) does not close it, and the typed e-mail stays");
  await page.focus("[data-trial-invite] input[type=password]"); await page.keyboard.press("Enter"); await page.waitForTimeout(900);
  ok(reqs.length >= 1, "dialog: Enter in the password field logs in (a request to the auth service was made)");
  await page.focus("[data-trial-invite] input[type=email]");
  await page.keyboard.press("Escape"); await page.waitForTimeout(250);
  ok(await has(page, "[data-trial-invite]"), "dialog: the first Escape only leaves a field that holds text");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  ok(!(await has(page, "[data-trial-invite]")), "dialog: the second Escape closes it");
  await ctx.close();
}

// Escape closes the invitation even while a consent CHECKBOX has the focus (a checkbox's value is the constant "on": it used to count as a text field with text in it and the first Escape only blurred it)
{
  const { ctx, page } = await visitor({ lang: "en", uses: 3 });
  await startSong(page, "twinkle");
  await page.click("[data-trial-invite] [data-pw-toggle]"); await page.waitForTimeout(200);   // the consent tick belongs to the password form, folded under the e-mail link
  await page.focus("[data-trial-invite] .au-ck input[type=checkbox]");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  ok(!(await has(page, "[data-trial-invite]")), "dialog: Escape with the consent checkbox focused closes the invitation at once");
  await ctx.close();
}
// the corner Login pill's modal (the log-in entry every guest sees; the drawer item opens the same card) is a dialog like the invitation
{
  const { ctx, page, errors } = await visitor({ lang: "en", w: 1000, h: 800 });
  await boot(page);
  await page.click(".guestloginpill"); await page.waitForTimeout(500);
  const info = await page.evaluate(() => { const c = document.querySelector(".setov .setcard"); return c ? { role: c.getAttribute("role"), modal: c.getAttribute("aria-modal"), name: c.getAttribute("aria-label"), focusIn: c.contains(document.activeElement) } : null; });
  ok(!!info && info.role === "dialog" && info.modal === "true" && !!info.name && info.focusIn, `corner Login modal: a dialog with a name and the focus inside ${JSON.stringify(info)}`);
  const inside = () => page.evaluate(() => { const c = document.querySelector(".setov .setcard"); return !!c && c.contains(document.activeElement); });
  let stayed = true; for (let i = 0; i < 20; i++) { await page.keyboard.press("Tab"); if (!(await inside())) { stayed = false; break; } }
  ok(stayed, "corner Login modal: Tab never leaves the card (20 presses)");
  await page.fill(".setov input[type=email]", "a@b.c");
  const box = await page.locator(".setov input[type=email]").boundingBox();
  await page.mouse.move(box.x + 12, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(4, 4, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(300);
  ok(await has(page, ".setov .setcard") && (await page.inputValue(".setov input[type=email]")) === "a@b.c", "corner Login modal: a press that starts in a field and ends on the backdrop does not close it (the typed e-mail stays)");
  await page.focus(".setov input[type=email]"); await page.keyboard.press("Escape"); await page.waitForTimeout(250);
  ok(await has(page, ".setov .setcard"), "corner Login modal: the first Escape only leaves a field that holds text");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  ok(!(await has(page, ".setov .setcard")), "corner Login modal: the second Escape closes it");
  ok(errors.length === 0, "corner Login modal: no page errors");
  await ctx.close();
}

// the standard card has its way out at the top too
{
  const { ctx, page } = await visitor();
  await boot(page, "?wall=login");
  await page.waitForSelector("[data-login-wall]", { timeout: 15000 });
  ok(await has(page, "[data-wall-close]"), "?wall=login: the card has a close button at the top (the link at the bottom can be below the fold)");
  await page.click("[data-wall-close]"); await page.waitForTimeout(300);
  ok(!(await has(page, "[data-login-wall]")) && await has(page, ".pathpage") && !(await page.evaluate(() => location.search.includes("wall="))), "?wall=login: it lets the visitor into the Pathway and the ?wall= leaves the address");
  await ctx.close();
}

// the standard card is a dialog like the invitation: a name, the focus inside, Tab stays inside, Escape is a way out, a drawn close cross, the brand name whole
for (const [lang, w] of [["en", 320], ["th", 320], ["ko", 360], ["fr", 360]]) {
  const { ctx, page, errors } = await visitor({ lang: lang === "th" ? "" : lang, w, h: 640 });
  await boot(page, "?wall=signup");
  await page.waitForSelector("[data-login-wall]", { timeout: 15000 });
  const d = await page.evaluate(() => { const c = document.querySelector("[data-login-wall] [role=dialog]"); return c ? { modal: c.getAttribute("aria-modal"), name: c.getAttribute("aria-label") } : null; });
  ok(!!d && d.modal === "true" && !!d.name && !/[\u00a0\u2060]/.test(d.name), `?wall= ${lang} @${w}px: the standard card is an aria-modal dialog with a clean name ${JSON.stringify(d)}`);
  const inside = () => page.evaluate(() => { const c = document.querySelector("[data-login-wall] [role=dialog]"); return !!c && c.contains(document.activeElement); });
  ok(await inside(), `?wall= ${lang}: the focus moved into the card`);
  let stayed = true; for (let i = 0; i < 30; i++) { await page.keyboard.press("Tab"); if (!(await inside())) { stayed = false; break; } }
  ok(stayed, `?wall= ${lang}: Tab never leaves the card (30 presses): the app behind it is not reachable`);
  const cross = await page.evaluate(() => { const b = document.querySelector("[data-wall-close]"), s = b && b.querySelector("svg"); if (!b || !s) return null; const r = s.getBoundingClientRect(), t = b.getBoundingClientRect(); return { cross: Math.round(r.width), target: Math.round(t.width) }; });
  ok(!!cross && cross.cross >= 16 && cross.target >= 44, `?wall= ${lang}: the close cross is a drawn 16+ px cross in a 44 px target ${JSON.stringify(cross)}`);
  const L = (await linesOf(page, "[data-login-wall] h1")).map(clean);
  ok(L.length >= 1 && !L.some((x, i) => i < L.length - 1 && /TIGA\s*$/.test(x)) && !L.some((x, i) => i > 0 && /^\s*ALPHA/.test(x)) && (lang !== "ko" || !L.some((x, i) => i < L.length - 1 && /[\uAC00-\uD7A3]$/.test(x) && /^[\uAC00-\uD7A3]/.test(L[i + 1]))), `?wall= ${lang} @${w}px: the title keeps the brand name and its words whole ${JSON.stringify(L)}`);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  ok(!(await has(page, "[data-login-wall]")) && await has(page, ".pathpage"), `?wall= ${lang}: Escape closes it and lets the visitor into the Pathway`);
  ok(errors.length === 0, `?wall= ${lang}: no page errors`);
  await ctx.close();
}

// Enter in the sign-up form walks to the first empty field and answers where the answer can be seen (the card scrolls and the messages are drawn under the privacy block: at 360x640 they used to be 345 px below the visible part)
for (const [w, h] of [[390, 844], [360, 640], [320, 568]]) {
  const { ctx, page, errors } = await visitor({ lang: "en", uses: 3, w, h });
  const reqs = []; page.on("request", (r) => { if (/supabase\.co\/auth\/v1\/(token|signup)/.test(r.url())) reqs.push(r.url()); });
  await startSong(page, "twinkle");
  const inv = "[data-trial-invite] ";
  const inCard = (sel) => page.evaluate((s) => { const e = document.querySelector(s), c = document.querySelector("[data-trial-invite] .setcard"); if (!e || !c) return false; const a = e.getBoundingClientRect(), b = c.getBoundingClientRect(); return a.height > 0 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1; }, sel);
  const focusedKind = () => page.evaluate(() => { const a = document.activeElement; if (!a || a.tagName !== "INPUT") return a ? a.tagName : "none"; return a.type === "email" ? "email" : a.type === "password" ? "password:" + [...document.querySelectorAll("[data-trial-invite] input[type=password]")].indexOf(a) : a.type === "checkbox" ? "checkbox" : "name"; });
  await page.click(inv + "[data-pw-toggle]"); await page.waitForTimeout(200);   // the sign-up form with a password opens from the small link under the e-mail link field
  await page.fill(inv + "input[autocomplete=name]", "Anna");
  await page.focus(inv + "input[type=email]"); await page.keyboard.type("anna@example.com"); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  ok((await focusedKind()) === "password:0" && !(await has(page, inv + ".au-err")) && reqs.length === 0, `Enter @${w}x${h}: with the password still empty it moves to that field (no error nobody can see, no request)`);
  await page.keyboard.type("secret12"); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  ok((await focusedKind()) === "password:1" && !(await has(page, inv + ".au-err")), `Enter @${w}x${h}: ...then to the confirmation`);
  await page.keyboard.type("secret12"); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  ok((await has(page, inv + ".au-err")) && (await inCard(inv + ".au-err")) && (await page.getAttribute(inv + ".au-err", "role")) === "alert" && reqs.length === 0, `Enter @${w}x${h}: a complete form without the privacy tick shows that error INSIDE the visible card (role=alert) and sends nothing`);
  await page.check(inv + ".au-ck input[type=checkbox]"); await page.waitForTimeout(250);
  ok(!(await has(page, inv + ".au-err")), `Enter @${w}x${h}: ticking it retires the error`);
  await page.focus(inv + "input[type=email]");
  await page.evaluate(() => { const i = document.querySelector("[data-trial-invite] input[type=email]"); i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true })); });   // Safari: the Enter that commits an IME word arrives with isComposing false and keyCode 229
  await page.waitForTimeout(500);
  ok(reqs.length === 0, `Enter @${w}x${h}: an Enter that only commits an IME word (keyCode 229) submits nothing`);
  await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
  ok(reqs.length === 1 && ((await inCard(inv + ".au-err")) || (await inCard(inv + ".au-ok"))), `Enter @${w}x${h}: a complete form signs up, and the answer (here the refused request) is on screen, not below the fold`);
  await page.fill(inv + "input[type=email]", "anna2@example.com"); await page.waitForTimeout(200);
  ok(!(await has(page, inv + ".au-err")), `Enter @${w}x${h}: typing again retires the old message`);
  ok(errors.length === 0, `Enter @${w}x${h}: no page errors`);
  await ctx.close();
}

// Step 1.1 (owner 2026-11-26): the one-field e-mail link is the way in; the password form opens from a small link under it
for (const [w, h] of [[390, 844], [360, 640]]) {
  const { ctx, page, errors } = await visitor({ lang: "en", uses: 3, w, h });
  const sent = []; await page.route(/supabase\.co\/auth\/v1\/otp/, (r) => { sent.push(r.request().postData() || ""); r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
  await startSong(page, "twinkle");
  const inv = "[data-trial-invite] ";
  ok(await has(page, inv + "[data-magic-email]") && await has(page, inv + "[data-magic-send]"), `magic @${w}x${h}: the invitation opens on the one-field e-mail link (field + button)`);
  ok(!(await has(page, inv + "input[type=password]")) && !(await has(page, inv + "input[autocomplete=name]")) && !(await has(page, inv + ".au-ck")), `magic @${w}x${h}: no password / name / consent-tick field is shown by default`);
  const pos = await page.evaluate(() => { const f = document.querySelector("[data-trial-invite] [data-magic-email]").getBoundingClientRect(), b = document.querySelector("[data-trial-invite] [data-magic-send]").getBoundingClientRect(); return { fieldBottom: Math.round(f.bottom), sendBottom: Math.round(b.bottom), vh: innerHeight }; });
  ok(pos.fieldBottom <= pos.vh && (w !== 390 || pos.sendBottom <= pos.vh), `magic @${w}x${h}: the e-mail field is on screen without scrolling (field bottom ${pos.fieldBottom}, send button bottom ${pos.sendBottom}, screen ${pos.vh})`);
  const offer = clean(await page.innerText(inv + "[data-invite-offer]")), price = clean(await page.innerText(inv + "[data-invite-price]"));
  ok(/Try Pro free for 7 days/.test(offer) && /No credit card needed/.test(offer), `magic @${w}x${h}: the offer chips say 'Try Pro free for 7 days' and 'No credit card needed' (${JSON.stringify(offer)})`);
  ok(/Then .*24\.99.* per month, cancel anytime/.test(price), `magic @${w}x${h}: the price line comes from the price table (${JSON.stringify(price)})`);
  await page.fill(inv + "[data-magic-email]", "anna@example.com");
  await page.evaluate(() => { const i = document.querySelector("[data-trial-invite] [data-magic-email]"); i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true })); });   // Safari: the Enter that commits an IME word arrives with isComposing false and keyCode 229
  await page.waitForTimeout(500);
  ok(sent.length === 0, `magic @${w}x${h}: an Enter that only commits an IME word (keyCode 229) sends no link`);
  await page.focus(inv + "[data-magic-email]"); await page.keyboard.press("Enter"); await page.waitForTimeout(900);
  let body = {}; try { body = JSON.parse(sent[0] || "{}"); } catch (e) {}
  ok(sent.length === 1 && body.email === "anna@example.com" && body.data && body.data.via === "invite-otp" && body.data.marketing_consent === false && !!body.data.pdpa_version, `magic @${w}x${h}: Enter sends ONE link request with the e-mail, via=invite-otp, the privacy version and no marketing consent ${JSON.stringify(body.data || null)}`);
  const done = clean(await page.innerText(inv + "[data-magic-done]").catch(() => ""));
  ok(/Link sent/.test(done) && /Spam/.test(done) && /No password/.test(done), `magic @${w}x${h}: after sending it says the link is sent, no password, and to check Spam / Promotions`);
  ok(await page.isDisabled(inv + "[data-magic-resend]") && /Send again \(\d+\)/.test(clean(await page.innerText(inv + "[data-magic-resend]"))), `magic @${w}x${h}: 'Send again' waits out a 30 second cooldown (it cannot be tapped twice)`);
  await page.click(inv + "[data-pw-toggle]"); await page.waitForTimeout(250);
  ok(await has(page, inv + "input[type=password]") && (await page.inputValue(inv + "input[type=email]")) === "anna@example.com", `magic @${w}x${h}: the small link opens the password form and keeps the typed e-mail`);
  await page.click(inv + "[data-pw-back]"); await page.waitForTimeout(250);
  ok(await has(page, inv + "[data-magic-email]") && !(await has(page, inv + "input[type=password]")), `magic @${w}x${h}: ...and the link under it brings the e-mail link back`);
  await page.click(inv + ".au-segb:nth-child(2)"); await page.waitForTimeout(250);
  ok(await has(page, inv + "[data-magic-email]") && !(await has(page, inv + "input[type=password]")) && !(await has(page, "[data-invite-offer]")), `magic @${w}x${h}: the Log-in tab is the e-mail link as well, without the free-trial offer`);
  ok(errors.length === 0, `magic @${w}x${h}: no page errors` + (errors.length ? ": " + errors[0] : ""));
  await ctx.close();
}
{
  // the Thai invitation says the owner's offer; the corner pill and the ?wall= card send their own via
  const { ctx, page, errors } = await visitor({ uses: 3 });
  const sent = []; await page.route(/supabase\.co\/auth\/v1\/otp/, (r) => { sent.push(r.request().postData() || ""); r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
  await startSong(page, "twinkle");
  const offer = clean(await page.innerText("[data-trial-invite] [data-invite-offer]")), price = clean(await page.innerText("[data-trial-invite] [data-invite-price]"));
  ok(offer.includes("ทดลอง Pro ฟรี 7 วัน") && offer.includes("ไม่ต้องใช้บัตรเครดิต") && price.includes("จากนั้น 799 บาท/เดือน ยกเลิกได้"), "th: 'ทดลอง Pro ฟรี 7 วัน' and 'จากนั้น 799 บาท/เดือน ยกเลิกได้' (" + JSON.stringify(offer + " | " + price) + ")");
  await boot(page);   // back on the Pathway (the song screen covers the corner pill)
  await page.click(".guestloginpill"); await page.waitForTimeout(500);
  await page.fill(".setcard [data-magic-email]", "pill@example.com"); await page.click(".setcard [data-magic-send]"); await page.waitForTimeout(900);
  let b1 = {}; try { b1 = JSON.parse(sent[0] || "{}"); } catch (e) {}
  ok(sent.length === 1 && b1.data && b1.data.via === "login-pill-otp", "the corner Login pill sends via=login-pill-otp");
  ok(errors.length === 0, "th pill: no page errors" + (errors.length ? ": " + errors[0] : ""));
  await ctx.close();
}
for (const wall of ["signup", "login"]) {
  const { ctx, page, errors } = await visitor({ lang: "en", w: 390, h: 844 });
  const sent = []; await page.route(/supabase\.co\/auth\/v1\/otp/, (r) => { sent.push(r.request().postData() || ""); r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
  await boot(page, "?wall=" + wall); await page.waitForSelector("[data-login-wall]", { timeout: 15000 });
  const lw = "[data-login-wall] ";
  ok(await has(page, lw + "[data-wall-google]") && await has(page, lw + "[data-magic-email]") && !(await has(page, lw + "input[type=password]")) && !(await has(page, lw + "[data-wall-submit]")), `?wall=${wall}: Google, then the one-field e-mail link; the password form is folded away`);
  const y = await page.evaluate(() => { const f = document.querySelector("[data-login-wall] [data-magic-send]").getBoundingClientRect(); return { b: Math.round(f.bottom), vh: innerHeight }; });
  ok(y.b <= y.vh, `?wall=${wall}: the send button is on screen without scrolling (${y.b} of ${y.vh})`);
  await page.fill(lw + "[data-magic-email]", "wall@example.com"); await page.click(lw + "[data-magic-send]"); await page.waitForTimeout(900);
  let b2 = {}; try { b2 = JSON.parse(sent[0] || "{}"); } catch (e) {}
  ok(sent.length === 1 && b2.data && b2.data.via === "wall-otp" && (await has(page, lw + "[data-magic-done]")), `?wall=${wall}: the link goes out with via=wall-otp and the card says it was sent`);
  await page.click(lw + "[data-pw-toggle]"); await page.waitForTimeout(250);
  ok(await has(page, lw + "input[type=password]") && await has(page, lw + "[data-wall-submit]") && (await page.inputValue(lw + "input[type=email]")) === "wall@example.com", `?wall=${wall}: the small link opens the password form (same e-mail)`);
  ok(errors.length === 0, `?wall=${wall}: no page errors` + (errors.length ? ": " + errors[0] : ""));
  await ctx.close();
}

// Exam Prep: a task pays its 5 coins once ever, also for a tick made before the rule existed (stored with no paid list)
{
  const { ctx, page, errors } = await visitor({ lang: "en", seed: { tg_edu_seen: '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}' } });   // the first-coins tip is a real pop-up that comes after the first payout: marked seen so it does not sit on top of the next tap
  await page.addInitScript(() => { try { sessionStorage.setItem("tiga_page", "studio"); } catch (e) {} });   // every load of this test starts on the Studio menu, where the Exam Prep card is
  const openExam = async () => {
    await boot(page);
    const clicked = await page.evaluate(() => { const els = [...document.querySelectorAll("button, .stcard, .studiocard, [class*=card]")]; const e = els.find((x) => /exam/i.test(x.innerText || "") && x.getBoundingClientRect().height > 20); if (!e) return false; e.scrollIntoView(); e.click(); return true; });
    if (!clicked) return false;
    try { await page.waitForSelector(".extask", { timeout: 8000 }); return true; } catch (e) { return false; }
  };
  const coins = () => page.evaluate(() => { let a = +(localStorage.getItem("tg_coins") || 0), b = 0; try { b = +(JSON.parse(localStorage.getItem("tg_guest_profile") || "{}").coins || 0); } catch (e) {} return Math.max(a, b); });
  ok(await openExam(), "Exam Prep opens for a guest");
  const c0 = await coins();
  let task = (await page.$$(".extask"))[0];
  await task.click(); await page.waitForTimeout(400);
  const c1 = await coins();
  ok(c1 - c0 === 5, `Exam Prep: the first tick pays 5 coins (${c0} -> ${c1})`);
  await task.click(); await page.waitForTimeout(300); await task.click(); await page.waitForTimeout(400);
  ok((await coins()) === c1, "Exam Prep: unticking and ticking the same task again pays nothing more");
  await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("tg_exam") || "{}"); delete e._paid; localStorage.setItem("tg_exam", JSON.stringify(e)); });   // what a browser that ticked before the rule holds: ticks, no paid list
  ok(await openExam(), "Exam Prep opens again (the stored ticks have no paid list)");
  const c2 = await coins();
  task = (await page.$$(".extask"))[0];
  await task.click(); await page.waitForTimeout(300); await task.click(); await page.waitForTimeout(400);
  ok((await coins()) === c2, `Exam Prep: a tick made before the rule existed cannot be paid a second time (${c2} -> ${await coins()})`);
  const t2 = (await page.$$(".extask"))[1]; await t2.click(); await page.waitForTimeout(400);
  ok((await coins()) - c2 === 5, "Exam Prep: a task that was never ticked still pays its 5 coins");
  // a paid list that came from ANOTHER device (the cloud merge unions tg_exam) does not know the ticks this browser made under the old rule: every tick on screen counts as paid
  await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("tg_exam") || "{}"); e._paid = ["zzz:9"]; localStorage.setItem("tg_exam", JSON.stringify(e)); });
  ok(await openExam(), "Exam Prep opens again (the stored paid list is another device's)");
  const c3 = await coins();
  task = (await page.$$(".extask"))[0];
  await task.click(); await page.waitForTimeout(300); await task.click(); await page.waitForTimeout(400);
  ok((await coins()) === c3, `Exam Prep: with a paid list from another device an old tick is still not paid twice (${c3} -> ${await coins()})`);
  ok(errors.length === 0, "Exam Prep: no page errors");
  await ctx.close();
}

const stubVideos = (page) => page.route(/rest\/v1\/lesson_videos/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "c1", title: "Test series", description: "", published: true, youtube_playlist_id: null, drive_folder_id: null, drive_file_id: null, created_at: "2026-01-01T00:00:00Z" }]) }));   // the page waits for the lesson_videos rows (the test blocks the live backend)
// Video Lessons: the narrated clips are PAID text-to-speech requested with the project's public key (the server does not ask who is calling), so for a guest opening the clip feed is a counted use;
// once the preview is used up no narration is requested and the invitation comes instead (found by the second honesty review: a guest used to get the feed for free, 20 paid lines in 25 seconds)
for (const lang of ["en", "ja", "zh"]) {
  const run = async (usesSeed) => {
    const { ctx, page, errors } = await visitor({ lang, uses: usesSeed }); await stubVideos(page);
    const tts = []; page.on("request", (r) => { if (/functions\/v1\/piano-tts/.test(r.url()) && r.method() === "POST") tts.push(r.url()); });
    await page.addInitScript(() => { try { sessionStorage.setItem("tiga_page", "videos"); } catch (e) {} });
    await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForSelector(".vidwrap", { timeout: 45000 }); await page.waitForTimeout(5500);
    const r = { reel: await has(page, ".cc-reel"), invite: await has(page, "[data-trial-invite]"), uses: await uses(page), tts: tts.length, errors: errors.length };
    await ctx.close(); return r;
  };
  const fresh = await run(0);
  ok(fresh.reel && !fresh.invite && fresh.uses === "1" && fresh.tts >= 1 && fresh.errors === 0, `${lang}: a guest with free uses left gets the clip feed, it costs ONE use and the narration is requested ${JSON.stringify(fresh)}`);
  const spent = await run(3);
  ok(!spent.reel && spent.invite && spent.uses === "3" && spent.tts === 0 && spent.errors === 0, `${lang}: with the preview used up the feed does not open, the invitation does, and NO narration is requested ${JSON.stringify(spent)}`);
}
{
  const { ctx, page } = await visitor({ uses: 3 }); await stubVideos(page);   // Thai: the series is a YouTube frame (free): never counted, never the invitation
  const tts = []; page.on("request", (r) => { if (/functions\/v1\/piano-tts/.test(r.url()) && r.method() === "POST") tts.push(1); });   // a POST is a paid synthesis (a warm-up OPTIONS / HEAD is not)
  await page.addInitScript(() => { try { sessionStorage.setItem("tiga_page", "videos"); } catch (e) {} });
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForSelector(".vidwrap", { timeout: 45000 }); await page.waitForTimeout(3000);
  const th = { invite: await has(page, "[data-trial-invite]"), reel: await has(page, ".cc-reel"), tts: tts.length, uses: await uses(page) };
  ok(!th.invite && !th.reel && th.tts === 0 && th.uses === "3", "th: the Thai series is not counted, shows no invitation and requests no narration " + JSON.stringify(th));
  await ctx.close();
}
{
  // the invitation's offer ("free for 7 days, no credit card") belongs to the Sign-up tab: a returning member on the Log-in tab is not told they are free for 7 days
  const { ctx, page } = await visitor({ lang: "en", uses: 3 });
  await startSong(page, "twinkle");
  ok(await has(page, "[data-invite-offer]"), "the invitation opens on the Sign-up tab with the offer (free for 7 days, no credit card)");
  await page.click("[data-trial-invite] .au-segb:nth-child(2)"); await page.waitForTimeout(250);
  ok(!(await has(page, "[data-invite-offer]")), "...and the Log-in tab does not repeat it");
  await page.click("[data-trial-invite] .au-segb:nth-child(1)"); await page.waitForTimeout(250);
  ok(await has(page, "[data-invite-offer]"), "...it is back on the Sign-up tab");
  await ctx.close();
}

// Practice Today: a start the preview turns away is not "going in" (it used to finish the plan and pay the bonus without starting anything)
{
  const { ctx, page, errors } = await visitor({ lang: "en", uses: 3 });
  await page.addInitScript(() => { try { sessionStorage.setItem("tiga_page", "today"); } catch (e) {} });
  await boot(page);
  const n = await page.$$eval(".tdgo", (e) => e.length);
  let refused = 0, entered = 0;
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => { try { sessionStorage.setItem("tiga_page", "today"); } catch (e) {} });
    await boot(page);
    const btn = (await page.$$(".tdgo"))[i]; if (!btn) continue;
    const before = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("tg_plan_in_")); return k ? JSON.parse(localStorage.getItem(k) || "[]").length : 0; });
    await btn.click(); await page.waitForTimeout(900);
    const invited = await has(page, "[data-trial-invite]");
    const after = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("tg_plan_in_")); return k ? JSON.parse(localStorage.getItem(k) || "[]").length : 0; });
    if (invited) { refused++; ok(after === before, `Practice Today: item ${i + 1} was turned away by the preview and is NOT marked as entered`); } else entered++;
  }
  ok(n === 3 && refused >= 1, `Practice Today: at least one of the ${n} items needs a start the used-up preview refuses (${refused} refused, ${entered} opened)`);
  ok(errors.length === 0, "Practice Today: no page errors");
  await ctx.close();
}

// the corner Login pill is never cut by the language flag, and from 360 px up its label is whole in every language (the common phones: 360, 375, 390, 412, 430); the guest's profile button next to it (a half circle under the flag
// before) is dropped up to 430 px and is back above it
for (const lang of ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "de", "ar"]) {
  for (const w of [320, 340, 360, 375, 390, 412, 430]) {
    const { ctx, page } = await visitor({ lang: lang === "th" ? "" : lang, w, h: 700 });
    await boot(page);
    const g = await page.evaluate(() => { const p = document.querySelector(".guestloginpill"), f = document.querySelector(".hdr .flagwrap"), t = document.querySelector(".guestloginpill-tx"), h = document.querySelector(".hdr-r .hdrgo"); if (!p || !f || !t) return null; const a = p.getBoundingClientRect(), b = f.getBoundingClientRect(), tr = t.getBoundingClientRect(); const rtl = document.documentElement.dir === "rtl" || getComputedStyle(document.body).direction === "rtl"; return { clearOfFlag: rtl ? a.left >= b.right - 1 : a.right <= b.left + 1, inView: a.left >= -0.5 && a.right <= window.innerWidth + 0.5, labelW: Math.round(tr.width), clipped: t.scrollWidth - t.clientWidth, goShown: h ? getComputedStyle(h).display !== "none" : null }; });
    const longOnTiny = w < 360 && ["fr", "de", "ja", "es", "hi", "ru"].includes(lang);   // a 320 / 340 px phone: the long words may still end in an ellipsis (at least 28 px of them)
    ok(!!g && g.clearOfFlag && g.inView && (g.clipped === 0 || (longOnTiny && g.labelW >= 28)) && g.goShown === false, `${lang} @${w}px: the Login pill is whole and clear of the flag, its label whole (an ellipsis only on a phone under 360 px), no half-cut profile button beside it ${JSON.stringify(g)}`);
    await ctx.close();
  }
}

{
  // a big phone / small tablet / narrow window (521-699 px): the language flag stays on screen (the guest's Login pill and profile button pushed it completely off from 521 px and partly up to ~640 px) and the profile button is back
  for (const lang of ["en", "fr", "de", "zh", "ja"]) {
    for (const w of [521, 560, 600, 640, 699]) {
      const { ctx, page } = await visitor({ lang, w, h: 800 });
      await boot(page);
      const g = await page.evaluate(() => { const f = document.querySelector(".hdr .flagwrap"), h = document.querySelector(".hdr-r .hdrgo"), p = document.querySelector(".guestloginpill"), fr = f && f.getBoundingClientRect(); return { pill: !!p, flagIn: !!fr && fr.left >= 0 && fr.right <= window.innerWidth + 0.5, go: h ? Math.round(h.getBoundingClientRect().width) : 0, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      ok(g.pill && g.flagIn && g.go >= 30 && g.over <= 1, `${lang} @${w}px: the language flag is on screen and the profile button is back (the rule drops it only up to 520 px) ${JSON.stringify(g)}`);
      await ctx.close();
    }
  }
}

await browser.close(); server.close();
done();
