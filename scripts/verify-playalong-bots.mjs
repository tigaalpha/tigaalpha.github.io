/* Play Along bot suite — plays real songs in the built app (dist/) with a
   headless phone-sized Chromium and checks what a player would notice:
   mashing every key earns nothing, a clean run earns 3 stars and beats the
   boss before the end, notes pressed 0.3 s early never make 3 stars, the
   "practise the part you missed" loop starts at the part and climbs
   75→85→100%, the daily song pays once, a concert's songs each load their own
   data, "Play again" is on the first screen at 360×640, pause freezes and
   resumes in place, the first-time intro, the song list's stars/length/lock
   notes/search, the staff slides every frame, a medal pays once and run
   coins stop after 3 runs a day, practice mode waits for the right key, the
   band keeps the beat (4/4, 3/4, drums only for a piano on the mic), the
   click track steps aside for the band, the ready screen wears the app's
   theme (light and dark) with its settings open at the top and Start in
   reach, and the other pages still open.

     npm run build && node scripts/verify-playalong-bots.mjs
     ONLY=perfect,drill node scripts/verify-playalong-bots.mjs   # a subset

   It serves dist/ itself (or BASE=http://… to test elsewhere) and blocks
   Supabase, so nothing is written anywhere; screenshots land in
   node_modules/.cache/pa-bots/. The app exposes window.__paTest only when
   localStorage.tg_pa_testhook is "1", which this sets. Needs Playwright +
   Chromium (preinstalled in the cloud containers), like bake-sprites. */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

let pwm;
try { pwm = await import("playwright"); } catch (e) {
  try { pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); }
  catch (e2) { console.error("Playwright is not installed (npm i -g playwright)."); process.exit(1); }
}
const pw = pwm.chromium ? pwm : pwm.default;
const EXE = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

// a static server for dist/, the way GitHub Pages serves it
const ROOT = path.resolve("dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".mp3": "audio/mpeg" };
let server = null, BASE = process.env.BASE;
if (!BASE) {
  if (!fs.existsSync(path.join(ROOT, "index.html"))) { console.error("dist/index.html is missing — run npm run build first."); process.exit(1); }
  server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    let fp = path.join(ROOT, u === "/" ? "/index.html" : u);
    if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); return res.end("nf"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(fp));
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  BASE = `http://127.0.0.1:${server.address().port}/`;
}
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const OUT = process.env.OUT || path.resolve("node_modules/.cache/pa-bots");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (name, ok, detail) => { results.push({ name, ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + " — " + detail); };
const b = await pw.chromium.launch({ ...(EXE ? { executablePath: EXE } : {}), args: ["--autoplay-policy=no-user-gesture-required"] });

async function session({ w = 412, h = 915, kind = false, intro = true, exp = 5000, extraLS = {}, lang = "en", page = "studio" } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const usage = [];
  await ctx.route(/supabase\.co/, async r => {
    const req = r.request();
    if (req.method() === "POST" && req.url().includes("/rest/v1/usage_events")) { try { usage.push(JSON.parse(req.postData() || "{}")); } catch (e) {} }
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await ctx.addInitScript(({ kind, intro, exp, extraLS, lang, page }) => {
    if (page) sessionStorage.setItem("tiga_page", page);
    localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "Tester", lang, age: "adult", level: "beginner", exp }));
    localStorage.setItem("tg_lang", lang); localStorage.setItem("tg_orient_hint_seen", "1"); localStorage.setItem("tg_3d_tier", "0");
    localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
    localStorage.setItem("tg_pa_testhook", "1");
    if (intro && !localStorage.getItem("tg_pa_intro")) localStorage.setItem("tg_pa_intro", "1");
    if (!localStorage.getItem("tg_pa_kind")) localStorage.setItem("tg_pa_kind", kind ? "1" : "0");
    if (!localStorage.getItem("tg_pa_metro")) localStorage.setItem("tg_pa_metro", "0");
    for (const [k, v] of Object.entries(extraLS)) if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    const gi = Storage.prototype.getItem, si = Storage.prototype.setItem;
    Storage.prototype.getItem = function (k) { return k === "tg_guest_ms" ? "0" : gi.call(this, k); };
    Storage.prototype.setItem = function (k, v) { if (k === "tg_guest_ms") return; return si.call(this, k, v); };
    try { navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("no mic")); } catch (e) {}
    try { Object.defineProperty(navigator, "requestMIDIAccess", { value: () => Promise.reject(new Error("no midi")), configurable: true }); } catch (e) {}
  }, { kind, intro, exp, extraLS, lang, page });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto(BASE, { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(400); }
  return { ctx, p, errs, usage };
}
async function openList(p) { await (await p.$$(".songcard"))[0].click(); await p.waitForTimeout(1200); }
async function openSong(p, name) {
  const s = await p.$(".songsearch");
  if (s) { await s.fill(name); await p.waitForTimeout(500); }
  const cards = await p.$$(".songgrid .songcard");
  for (const c of cards) { const t = ((await c.textContent()) || "").toLowerCase(); if (t.includes(name.toLowerCase())) { await c.click(); await p.waitForTimeout(900); return true; } }
  return false;
}
async function start(p) { await p.click(".songready .songbtn.go"); await p.waitForTimeout(300); }
// presses each note at its hit time + offset; skip notes whose t is in [skipFrom, skipTo]
async function bot(p, { offset = 0, skipFrom = null, skipTo = null } = {}) {
  await p.evaluate(({ offset, skipFrom, skipTo }) => {
    const T = window.__paTest;
    if (window.__botStop) window.__botStop();
    const last = {};
    let raf;
    const tick = () => {
      const now = T.now();
      if (now != null) {
        const notes = T.notes();
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i];
          if (n.skip || n.hit || n.missed) continue;
          if (skipFrom != null && n.t >= skipFrom && n.t <= skipTo) continue;
          const due = n.t + T.lead + offset;
          // debounce on the real clock: a practice pass replays the same song times
          const rt = performance.now();
          if (now >= due && now < due + 0.12 && !(last[i] != null && rt - last[i] < 300)) { last[i] = rt; T.press(n.note); }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.__botStop = () => cancelAnimationFrame(raf);
  }, { offset, skipFrom, skipTo });
}
async function mash(p) {
  await p.evaluate(() => {
    if (window.__botStop) window.__botStop();
    const id = setInterval(() => { let pid = 50; for (const k of document.querySelectorAll(".gpw, .gpb")) { k.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: pid, pressure: 0.5 })); window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: pid })); pid++; } }, 140);
    window.__botStop = () => clearInterval(id);
  });
}
async function stopBot(p) { await p.evaluate(() => window.__botStop && window.__botStop()).catch(() => {}); }
async function waitResult(p, ms = 90000) { await p.waitForSelector(".pl-result", { timeout: ms }); await p.waitForTimeout(1200); }
async function starsOf(p) { return p.$$eval(".pl-bigstars span.on", s => s.length); }
async function resultText(p) { return (await p.$eval(".pl-result", e => e.innerText)).replace(/\s+/g, " "); }
// what a run pays into outside the song: the streak (it opens the daily
// chest), the daily quest and the weekly "play N games" challenges
async function counters(p) {
  return p.evaluate(() => {
    const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
    return { games: j("tg_weekly", {}).games || 0, streakDay: j("tg_streak", {}).last || "", quest: j("tg_guest_profile", {}).quest_count || 0 };
  });
}
const want = (n) => !ONLY.length || ONLY.includes(n);
async function done(s) { await s.ctx.close(); }

// ── 1. mashing every key, normal and kind mode ──
for (const kind of [false, true]) {
  const name = kind ? "mash-kind" : "mash";
  if (!want(name)) continue;
  const s = await session({ kind });
  await openList(s.p); await openSong(s.p, "Twinkle");
  const c0 = await counters(s.p);
  await start(s.p); await mash(s.p);
  await waitResult(s.p); await stopBot(s.p);
  const c1 = await counters(s.p);
  const st = await starsOf(s.p);
  await s.p.screenshot({ path: `${OUT}/${name}.png` });
  rec(name, st === 0, `stars ${st} · ${(await resultText(s.p)).slice(0, 120)} · errors ${s.errs.length}`);
  rec(name + "-counts-nothing", JSON.stringify(c0) === JSON.stringify(c1), `before ${JSON.stringify(c0)} · after ${JSON.stringify(c1)}`);
  await done(s);
}
// ── 2. every note on time: 3 stars, boss down before the end, usage rows ──
if (want("perfect")) {
  const s = await session();
  await openList(s.p); await openSong(s.p, "Twinkle");
  const c0 = await counters(s.p);
  await start(s.p); await bot(s.p);
  // watch the boss bar
  const bossSeen = await s.p.evaluate(() => new Promise(res => { let zeroAt = null; const id = setInterval(() => { const T = window.__paTest; const b = T.boss(); const now = T.now(); if (b.on && b.hp <= 0 && zeroAt == null) zeroAt = now; if (document.querySelector(".pl-result")) { clearInterval(id); res({ zeroAt }); } }, 100); }));
  await waitResult(s.p); await stopBot(s.p);
  const c1 = await counters(s.p);
  const st = await starsOf(s.p);
  const txt = await resultText(s.p);
  await s.p.screenshot({ path: `${OUT}/perfect-result.png` });
  const lastT = 28.8; // Twinkle's last note ≈ 27.6 s; a zero before the song ends
  rec("perfect-3stars", st === 3, `stars ${st} · ${txt.slice(0, 140)}`);
  rec("boss-down", bossSeen.zeroAt != null && /Boss down/.test(txt), `boss hp 0 at songTime ${bossSeen.zeroAt && bossSeen.zeroAt.toFixed(1)}s · tag ${/Boss down/.test(txt)}`);
  rec("perfect-counts", c1.games === c0.games + 1 && c1.quest === c0.quest + 1 && !!c1.streakDay && c1.streakDay !== c0.streakDay, `before ${JSON.stringify(c0)} · after ${JSON.stringify(c1)}`);
  await s.p.waitForTimeout(800);
  const items = s.usage.filter(r => r.kind === "pa").map(r => r.item_id);
  rec("usage-rows", items.some(i => i.startsWith("start:twinkle")) && items.some(i => /^end:twinkle:3:\d+:4$/.test(i)) && items.some(i => i.startsWith("fps:")), items.join(" | "));
  // again within a minute
  await s.p.click(".pl-again"); await bot(s.p); await waitResult(s.p); await stopBot(s.p); await s.p.waitForTimeout(600);
  const items2 = s.usage.filter(r => r.kind === "pa").map(r => r.item_id);
  rec("usage-again", items2.some(i => i.startsWith("again:twinkle:same:retry")), items2.slice(-4).join(" | "));
  rec("perfect-errors", s.errs.length === 0, s.errs.join(" / ") || "none");
  await done(s);
}
// ── 2b. the two shortest songs can be beaten ──
for (const song of ["Velvet Glow", "Late Night"]) {
  const name = "short-" + song.replace(/\s/g, "");
  if (!want(name)) continue;
  const s = await session();
  await openList(s.p); await openSong(s.p, song); await start(s.p); await bot(s.p);
  await waitResult(s.p); await stopBot(s.p);
  const st = await starsOf(s.p); const txt = await resultText(s.p);
  rec(name, st === 3 && /Boss down/.test(txt), `stars ${st} · boss ${/Boss down/.test(txt)}`);
  await done(s);
}
// ── 3. every note 0.3 s early: never 3 stars (normal and kind) ──
for (const kind of [false, true]) {
  const name = kind ? "early-kind" : "early";
  if (!want(name)) continue;
  const s = await session({ kind });
  await openList(s.p); await openSong(s.p, "Twinkle"); await start(s.p); await bot(s.p, { offset: -0.3 });
  await waitResult(s.p); await stopBot(s.p);
  const st = await starsOf(s.p);
  rec(name, st < 3, `stars ${st} · ${(await resultText(s.p)).slice(0, 100)}`);
  await done(s);
}
// ── 4. practise the missed part: starts at the part, loops, climbs, clears ──
if (want("drill")) {
  const s = await session();
  await openList(s.p); await openSong(s.p, "Twinkle"); await start(s.p); await bot(s.p, { skipFrom: 10, skipTo: 14 });
  await waitResult(s.p); await stopBot(s.p);
  const btn = await s.p.$(".pl-drillbtn");
  const label = btn ? (await btn.textContent()) : "(none)";
  const missBefore = await s.p.evaluate(() => localStorage.getItem("tg_note_miss"));
  // Tap it and time, in the page, how long until the part's first note
  // reaches the line: within one bar at the drill tempo. (Clicked from the
  // page so a level-up card over the button can't pad the time.)
  const first = await s.p.evaluate(() => new Promise(res => {
    const T = window.__paTest, b = document.querySelector(".pl-drillbtn");
    if (!b) return res(null);
    const t0 = performance.now(); b.click();
    const id = setInterval(() => { const now = T.now(); const d = T.drill(); if (now == null || !d) return; const ns = T.notes().filter(n => !n.skip); const f = Math.min(...ns.map(n => n.t)) + T.lead; if (now >= f) { clearInterval(id); res({ rung: d.rung, ms: Math.round(performance.now() - t0) }); } }, 20);
    setTimeout(() => res(null), 15000);
  }));
  const firstMs = first ? first.ms : 99999;
  await bot(s.p);
  const rungs = await s.p.evaluate(() => new Promise(res => { const T = window.__paTest; const seen = []; const id = setInterval(() => { const d = T.drill(); if (d && seen[seen.length - 1] !== d.rung) seen.push(d.rung); if (!d && seen.length) { clearInterval(id); res(seen); } }, 100); setTimeout(() => { clearInterval(id); res(seen); }, 60000); }));
  await stopBot(s.p);
  await s.p.waitForTimeout(1500);
  const back = !!(await s.p.$(".pl-result"));
  const cleared = !(await s.p.$(".pl-drillbtn"));
  const missAfter = await s.p.evaluate(() => localStorage.getItem("tg_note_miss"));
  await s.p.screenshot({ path: `${OUT}/drill-after.png` });
  // bar at 100 bpm 4/4 = 2.4 s song-time = 3.2 s real at 75%
  rec("drill-starts-at-part", !!first && firstMs < 3200 + 900, `button "${label.trim()}" · first note hit ${firstMs} ms after the tap at ${first && first.rung}`);
  rec("drill-ladder", JSON.stringify(rungs) === "[0.75,0.85,1]", `tempo ladder ${JSON.stringify(rungs)}`);
  rec("drill-clears", back && cleared, `back on result ${back} · button gone ${cleared}`);
  rec("drill-no-weakspots", missBefore === missAfter, `tg_note_miss unchanged ${missBefore === missAfter}`);
  await done(s);
}
// ── 5. the daily song pays once ──
if (want("daily")) {
  const s = await session();
  await openList(s.p);
  const id = await s.p.evaluate(() => { try { return JSON.parse(localStorage.getItem("tg_daily_song")).id; } catch (e) { return null; } });
  const card = await s.p.$(".setlistbtn >> text=Daily Song Quest");
  if (card) await card.click(); await s.p.waitForTimeout(900);
  await start(s.p); await bot(s.p); await waitResult(s.p); await stopBot(s.p);
  const t1 = await resultText(s.p);
  const st1 = await s.p.evaluate(() => JSON.parse(localStorage.getItem("tg_daily_song")));
  await s.p.click(".pl-again"); await bot(s.p); await waitResult(s.p); await stopBot(s.p);
  const t2 = await resultText(s.p);
  const paid1 = /📆 \+30/.test(t1), paid2 = /📆 \+30/.test(t2);
  rec("daily-pays-once", !!id && paid1 && !paid2 && st1.done === true && st1.id === id, `song ${id} · first run paid ${paid1} · second run paid ${paid2} · state ${JSON.stringify(st1)}`);
  const items = s.usage.filter(r => r.kind === "pa").map(r => r.item_id);
  rec("daily-usage", items.filter(i => i.startsWith("daily:")).length === 1, items.filter(i => i.startsWith("daily:") || i.startsWith("start:")).join(" | "));
  await done(s);
}
// ── 6. concert: songs 2 and 3 load their own data ──
if (want("concert")) {
  const ghosts = {};
  for (const id of ["jazz_swing_walk", "jazz_blue_note", "jazz_midnight", "jazz_waltz_swing"]) ghosts["tg_ghost_" + id] = JSON.stringify([{ t: 0, s: 0 }, { t: 60, s: 1 }]);
  const s = await session({ extraLS: ghosts });
  await openList(s.p);
  await s.p.click(".genrechip >> text=Jazz"); await s.p.waitForTimeout(500);
  // by its full name: the daily song's button is "…Piano Concerto…" on some days
  await s.p.click(".setlistbtn >> text=Concert Mode"); await s.p.waitForTimeout(900);
  const pos = await s.p.$eval(".setlistpos", e => e.textContent).catch(() => "(no badge)");
  await start(s.p); await bot(s.p);
  const out = await s.p.evaluate(() => new Promise(res => { const T = window.__paTest; const log = {}, trail = []; let last = ""; const id = setInterval(() => { const m = T.meta(); const now = T.now(); const badge = (document.querySelector(".songsetlist, .pl-setlist") || {}).textContent || ""; const k = m + "|" + (now != null) + "|" + badge + "|" + !!document.querySelector(".pl-result"); if (k !== last) { trail.push(k); last = k; } if (m && now != null) log[m] = log[m] || T.ghost(); if (document.querySelector(".pl-result")) { clearInterval(id); res({ log, trail }); } }, 100); setTimeout(() => { clearInterval(id); res({ log, trail }); }, 150000); }));
  await stopBot(s.p);
  const seen = out.log;
  const ids = Object.keys(seen);
  rec("concert-own-data", ids.length === 3 && ids.every(k => seen[k] === true), pos + " · " + JSON.stringify(seen));
  await done(s);
}
// ── 7. result screen: Play again in the first screen on 360×640 ──
if (want("result-fold")) {
  const s = await session({ w: 360, h: 640 });
  await openList(s.p); await openSong(s.p, "Velvet Glow"); await start(s.p); await bot(s.p, { skipFrom: 3, skipTo: 6 });
  await waitResult(s.p); await stopBot(s.p);
  const box = await s.p.$eval(".pl-again", e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  const nxt = await s.p.$eval(".pl-next", e => e.getBoundingClientRect().bottom).catch(() => null);
  await s.p.screenshot({ path: `${OUT}/result-360.png` });
  rec("result-fold", box.bottom <= 640 && (nxt == null || nxt <= 640), `Play again bottom ${Math.round(box.bottom)} · Next bottom ${nxt && Math.round(nxt)} (screen 640)`);
  await done(s);
}
// ── 8. pause and resume ──
if (want("pause")) {
  const s = await session();
  await openList(s.p); await openSong(s.p, "Twinkle"); await start(s.p); await bot(s.p);
  await s.p.waitForTimeout(6000);
  const before = await s.p.evaluate(() => ({ now: window.__paTest.now(), hud: document.querySelector(".songhud").innerText, missed: window.__paTest.notes().filter(n => n.missed).length }));
  await s.p.click(".pl-pausebtn"); await s.p.waitForTimeout(2500);
  const during = await s.p.evaluate(() => ({ paused: window.__paTest.paused(), missed: window.__paTest.notes().filter(n => n.missed).length, card: !!document.querySelector(".pl-pause-card") }));
  await s.p.screenshot({ path: `${OUT}/pause.png` });
  await s.p.click(".pl-pause .songbtn.go"); await s.p.waitForTimeout(2300);
  const after = await s.p.evaluate(() => ({ now: window.__paTest.now(), hud: document.querySelector(".songhud").innerText }));
  await waitResult(s.p); await stopBot(s.p);
  const st = await starsOf(s.p);
  const drift = after.now != null ? after.now - before.now : null;
  rec("pause-freezes", during.paused && during.card && during.missed === before.missed, `paused ${during.paused} · card ${during.card} · missed ${before.missed}→${during.missed}`);
  rec("pause-resumes-in-place", drift != null && drift >= 0 && drift < 1.2 && st === 3, `song clock moved ${drift && drift.toFixed(2)}s across a 4.8 s pause · final stars ${st}`);
  await done(s);
}
// ── 9. first song intro ──
if (want("intro")) {
  const s = await session({ intro: false });
  await openList(s.p); await openSong(s.p, "Twinkle");
  const card = !!(await s.p.$(".pl-introcard"));
  await s.p.click(".pl-introcard .songbtn.go"); await s.p.waitForTimeout(600);
  const hint = !!(await s.p.$(".pl-intro-hint"));
  await s.p.screenshot({ path: `${OUT}/intro.png` });
  await bot(s.p);
  await s.p.waitForSelector(".pl-ready .pl-title", { timeout: 30000 }); await stopBot(s.p);
  const title = await s.p.$eval(".pl-ready .pl-title", e => e.textContent);
  const flag = await s.p.evaluate(() => localStorage.getItem("tg_pa_intro"));
  rec("intro", card && hint && /Twinkle/.test(title) && flag === "1", `card ${card} · hint ${hint} · then "${title}" · flag ${flag}`);
  await done(s);
}
// ── 10. song list: earned stars, length, locked info, search ──
if (want("list")) {
  const s = await session({ exp: 0 });
  await openList(s.p);
  await s.p.screenshot({ path: `${OUT}/list.png` });
  const meta = await s.p.$$eval(".songgrid .songcard .songcard-meta", ms => ms.slice(0, 3).map(m => m.innerText.replace(/\s+/g, " ")));
  const locked = await s.p.$(".songgrid .songcard.locked");
  if (locked) await locked.click(); await s.p.waitForTimeout(300);
  const msg = await s.p.$eval(".songlockmsg", e => e.innerText).catch(() => null);
  await s.p.fill(".songsearch", "ode to"); await s.p.waitForTimeout(400);
  const found = await s.p.$$eval(".songgrid .songcard .songcard-nm", ns => ns.map(n => n.textContent));
  rec("list-cards", meta.every(m => /☆|★/.test(m) && /⏱ \d:\d\d|Level \d/.test(m)), meta.join(" | "));
  rec("list-locked", !!msg && /opens at level \d/.test(msg), msg || "(no message)");
  rec("list-search", found.length >= 1 && found.every(n => /ode to/i.test(n)), found.join(", "));
  await done(s);
}
// ── 10b. the reading staff slides every frame, and the boss bar stays mounted ──
if (want("staff")) {
  const s = await session();
  await openList(s.p); await openSong(s.p, "Twinkle"); await start(s.p); await bot(s.p);
  await s.p.waitForTimeout(5500);
  const r = await s.p.evaluate(() => new Promise(res => {
    const head = [...document.querySelectorAll(".pastaff-move ellipse")].find(e => { const b = e.getBoundingClientRect(); return b.left > 150 && b.left < 320; });
    const boss = document.querySelector(".bosshud");
    const xs = []; let k = 0;
    const f = () => { xs.push(head ? head.getBoundingClientRect().left : null); if (++k < 24) requestAnimationFrame(f); else res({ xs, bossSame: document.querySelector(".bosshud") === boss && !!boss }); };
    requestAnimationFrame(f);
  }));
  await stopBot(s.p);
  const steps = r.xs.slice(1).map((x, i) => r.xs[i] - x);
  const moved = steps.filter(d => d > 0.01).length, jumps = steps.filter(d => d > 3).length;
  rec("staff-slides", r.xs[0] != null && moved >= steps.length - 3 && jumps === 0, `moved on ${moved}/${steps.length} frames · biggest step ${Math.max(...steps).toFixed(2)}px`);
  rec("boss-bar-kept", r.bossSame, `same boss bar element across hits ${r.bossSame}`);
  await done(s);
}
// ── 13. medals and coins: crown on a clean run, each medal pays once, a 4th run of the day pays no coins, a slow run keeps bronze ──
if (want("medals")) {
  const s = await session();
  await openList(s.p); await openSong(s.p, "Velvet Glow");
  const id = await s.p.evaluate(() => window.__paTest.meta());
  const runs = [];
  for (let i = 0; i < 4; i++) {
    if (i === 0) await start(s.p); else await s.p.click(".pl-again");
    await bot(s.p); await waitResult(s.p); await stopBot(s.p);
    runs.push({ tags: await s.p.$eval(".pl-res-tags", e => e.innerText.replace(/\s+/g, " ")), pay: await s.p.$eval(".pl-res-pay", e => e.innerText.replace(/\s+/g, " ")) });
  }
  const st = await s.p.evaluate((id) => ({ medal: localStorage.getItem("tg_medal_" + id), runs: JSON.parse(localStorage.getItem("tg_pa_runs") || "{}") }), id);
  rec("medal-crown-once", /New Crown medal! \+130 🪙 \+500 EXP/.test(runs[0].tags) && !/medal!/.test(runs[1].tags) && st.medal === "4", `run 1: "${runs[0].tags}" · run 2 new medal: ${/medal!/.test(runs[1].tags)} · stored ${st.medal}`);
  rec("run-coins-3-a-day", runs.slice(0, 3).every(r => /\+20 🪙/.test(r.pay)) && !/🪙/.test(runs[3].pay) && /3 times today/.test(runs[3].pay) && st.runs[id] === 4, runs.map((r, i) => `run ${i + 1}: ${r.pay}`).join(" | "));
  await done(s);
  // at 75% speed, 3 stars keep bronze (silver and up need the real speed)
  const w = await session({ extraLS: { tg_pa_testhook: "1" } });
  await openList(w.p); await openSong(w.p, "Late Night");
  await w.p.click(".songtempobtn >> text=0.75×"); await w.p.waitForTimeout(300);   // the settings are always open
  const id2 = await w.p.evaluate(() => window.__paTest.meta());
  await start(w.p); await bot(w.p); await waitResult(w.p); await stopBot(w.p);
  const st2 = await w.p.evaluate((id) => ({ medal: localStorage.getItem("tg_medal_" + id), stars: localStorage.getItem("tg_stars_" + id) }), id2);
  rec("medal-slow-bronze", st2.medal === "1" && st2.stars === "3", `75% speed, ${st2.stars} stars → medal ${st2.medal}`);
  await done(w);
}
// ── 14. practice mode: the song waits for the right key, then records nothing ──
if (want("practice")) {
  const s = await session();
  await openList(s.p); await openSong(s.p, "Twinkle");
  const before = await s.p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => /^tg_(stars|acc|best|ghost|medal)_|^tg_pa_runs$|^tg_note_miss$/.test(k)).sort().map(k => k + "=" + localStorage.getItem(k))));
  await s.p.click(".pl-practice-btn"); await s.p.waitForTimeout(300);
  // nobody presses anything for 7 s: the first note must wait at the line
  await s.p.waitForTimeout(7000);
  const w = await s.p.evaluate(() => { const T = window.__paTest; const ns = T.notes(); const f = ns[0]; return { now: T.now(), due: f.t + T.lead, missed: ns.filter(n => n.missed).length, hit: ns.filter(n => n.hit).length }; });
  // a wrong key does not move it on
  await s.p.evaluate(() => window.__paTest.press("B5"));
  await s.p.waitForTimeout(400);
  const w2 = await s.p.evaluate(() => ({ hit: window.__paTest.notes().filter(n => n.hit).length, missed: window.__paTest.notes().filter(n => n.missed).length }));
  await s.p.screenshot({ path: `${OUT}/practice-waiting.png` });
  await bot(s.p);
  await waitResult(s.p, 120000); await stopBot(s.p);
  const card = await s.p.$eval(".pl-practice-result", e => e.innerText.replace(/\s+/g, " ")).catch(() => "(no practice card)");
  const after = await s.p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => /^tg_(stars|acc|best|ghost|medal)_|^tg_pa_runs$|^tg_note_miss$/.test(k)).sort().map(k => k + "=" + localStorage.getItem(k))));
  await s.p.screenshot({ path: `${OUT}/practice-result.png` });
  await s.p.waitForTimeout(500);
  const items = s.usage.filter(r => r.kind === "pa").map(r => r.item_id);
  rec("practice-waits", Math.abs(w.now - w.due) < 0.08 && w.missed === 0 && w.hit === 0 && w2.hit === 0 && w2.missed === 0, `after 7 s untouched: song clock ${w.now.toFixed(2)} s at the first note's ${w.due.toFixed(2)} s · missed ${w.missed} · a wrong key hit ${w2.hit}`);
  rec("practice-records-nothing", /\+20 EXP/.test(card) && before === after, `card "${card.slice(0, 80)}" · stored song data unchanged ${before === after}`);
  rec("practice-usage", items.some(i => /^start:twinkle:practice:/.test(i)) && items.includes("practice:twinkle:done") && !items.some(i => i.startsWith("end:")), items.join(" | "));
  await done(s);
}
// ── 12. the band: on the beat through a stalled frame, 3/4 drums for 3/4 songs, drums only for a piano on the mic ──
if (want("band")) {
  const s = await session();
  await openList(s.p); await openSong(s.p, "Twinkle"); await start(s.p); await bot(s.p);
  await s.p.waitForTimeout(6500);
  // a 300 ms stall on the main thread, the kind a busy phone has
  await s.p.evaluate(() => { const t = performance.now(); while (performance.now() - t < 300) {} });
  await s.p.waitForTimeout(8000); // past Fever (30% of the notes) so the arpeggio has come in
  const r = await s.p.evaluate(() => window.__paTest.band());
  await stopBot(s.p);
  const off = r.log.map(e => Math.abs(e.when - (r.clock + (r.lead + e.beat * r.spb) / r.tempo)));
  const worst = Math.max(...off) * 1000;
  const kicks = r.log.filter(e => e.drum === "kick").map(e => e.pos);
  const layers = [...new Set(r.log.map(e => e.parts).join(""))].sort().join("");
  rec("band-on-beat", r.log.length > 20 && worst < 6, `${r.log.length} drum steps booked, furthest from the beat grid ${worst.toFixed(1)} ms (a 300 ms stall in the middle)`);
  rec("band-4-4", kicks.length > 4 && kicks.every(p => p === 0 || p === 2), `4/4 kicks on beats ${[...new Set(kicks)].map(p => p + 1).join(",")}`);
  rec("band-layers", /b/.test(layers) && /c/.test(layers) && /a/.test(layers), `layers heard with a clean combo: ${layers} (b bass, c chords, a Fever arpeggio)`);
  await done(s);
  const w = await session();
  await openList(w.p); await openSong(w.p, "Jazz Waltz"); await start(w.p); await bot(w.p);
  await w.p.waitForTimeout(7000);
  const r3 = await w.p.evaluate(() => window.__paTest.band());
  await stopBot(w.p);
  const k3 = r3.log.filter(e => e.drum === "kick").map(e => e.pos), sn3 = r3.log.filter(e => e.drum === "snare").map(e => e.pos);
  rec("band-3-4", k3.length > 2 && k3.every(p => p === 0) && sn3.every(p => p === 1 || p === 2), `3/4 kicks on ${[...new Set(k3)].map(p => p + 1).join(",")} · snares on ${[...new Set(sn3)].map(p => p + 1).join(",")}`);
  await done(w);
  // a player on a real piano: the mic listens and their presses come from it
  const m = await session();
  await openList(m.p); await openSong(m.p, "Twinkle"); await start(m.p);
  await m.p.evaluate(() => window.__paTest.setSrc("mic"));
  await m.p.evaluate(() => {
    const T = window.__paTest; const last = {};
    const tick = () => { const now = T.now(); if (now != null) { const ns = T.notes(); for (let i = 0; i < ns.length; i++) { const n = ns[i]; if (n.hit || n.missed || n.skip) continue; const due = n.t + T.lead, rt = performance.now(); if (now >= due && now < due + 0.12 && !(last[i] && rt - last[i] < 300)) { last[i] = rt; T.press(n.note, "mic"); } } } window.__micBot = requestAnimationFrame(tick); };
    window.__micBot = requestAnimationFrame(tick);
    window.__botStop = () => cancelAnimationFrame(window.__micBot);
  });
  await m.p.waitForTimeout(9000);
  const rm = await m.p.evaluate(() => window.__paTest.band());
  await stopBot(m.p);
  const pitched = rm.log.filter(e => e.parts).length;
  rec("band-mic-drums-only", rm.log.length > 20 && pitched === 0 && rm.state.soft, `${rm.log.length} drum steps, ${pitched} with bass/chords/arpeggio · soft ${rm.state.soft} · combo reached ${rm.state.combo}`);
  await done(m);
}
// ── 15. the click track steps aside for the band: after the count-in it is
//        silent while the drums play, keeps the beat when the band is off,
//        and never plays in a practice pass (the song stops and waits) ──
if (want("click")) {
  const after = (cl) => cl.filter(c => !c.countIn).length;
  const s = await session();
  await openList(s.p); await openSong(s.p, "Twinkle");
  await s.p.evaluate(() => window.__paTest.setMetro(true));
  await start(s.p); await bot(s.p);
  await s.p.waitForTimeout(7000);
  const c1 = await s.p.evaluate(() => window.__paTest.clicks());
  await s.p.evaluate(() => window.__paTest.setBand(0));
  await s.p.waitForTimeout(3000);
  const c2 = await s.p.evaluate(() => window.__paTest.clicks());
  await s.p.evaluate(() => window.__paTest.setBand(2));
  await s.p.waitForTimeout(2500);
  const c3 = await s.p.evaluate(() => window.__paTest.clicks());
  await stopBot(s.p);
  const countIn = c1.filter(c => c.countIn).length;
  rec("click-quiet-with-band", countIn >= 3 && after(c1) === 0, `count-in ticks ${countIn} · clicks after it with the drums playing ${after(c1)}`);
  rec("click-when-band-off", after(c2) >= 3 && after(c3) - after(c2) <= 1, `band off 3 s: ${after(c2)} clicks · band back on 2.5 s: ${after(c3) - after(c2)} more`);
  await done(s);
  const pr = await session();
  await openList(pr.p); await openSong(pr.p, "Twinkle");
  await pr.p.evaluate(() => window.__paTest.setMetro(true));
  await pr.p.click(".pl-practice-btn"); await pr.p.waitForTimeout(300); await bot(pr.p);
  await pr.p.waitForTimeout(8000);
  const cp = await pr.p.evaluate(() => window.__paTest.clicks());
  await stopBot(pr.p);
  rec("click-none-in-practice", cp.filter(c => c.countIn).length >= 3 && after(cp) === 0, `practice: count-in ticks ${cp.filter(c => c.countIn).length} · clicks after it ${after(cp)}`);
  await done(pr);
}
// ── 16. the ready screen: the app's own theme (white / dark), the settings always open and
//        first on the screen, Start reachable without scrolling; neon only once the song starts ──
if (want("ready-theme")) {
  const lum = (rgb) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || ""); return m ? (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 : -1; };
  for (const [mode, w, h] of [["light", 376, 700], ["dark", 376, 700], ["light", 360, 640], ["light", 412, 915]]) {
    const s = await session({ w, h, extraLS: mode === "dark" ? { tg_mode: "dark" } : {} });
    await openList(s.p); await openSong(s.p, "Mary");
    await s.p.waitForSelector(".songready .pl-settings", { timeout: 8000 });
    await s.p.waitForTimeout(500);
    const r = await s.p.evaluate(() => {
      const q = (sel) => document.querySelector(sel);
      const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) }; };
      const root = q(".songov"), ready = q(".songready"), hdr = q(".songhdr"), st = q(".songready .pl-start");
      const cs = (el, k) => el ? getComputedStyle(el)[k] : "";
      const settings = q(".pl-settings"), title = q(".songready .pl-title"), tempo = q(".songready .songtempo"), hands = q(".songready .songhands");
      return {
        cls: root.className, bg: cs(ready, "backgroundColor"), rootBg: cs(root, "backgroundColor"), hdrBg: cs(hdr, "backgroundColor"),
        titleColor: cs(title, "color"), startBg: cs(st, "backgroundImage") + " " + cs(st, "backgroundColor"),
        hdr: box(hdr), settings: box(settings), title: box(title), start: box(st), tempo: box(tempo), hands: box(hands),
        toggleLink: !!q(".songready [aria-expanded]"), tempoBtns: document.querySelectorAll(".songready .songtempobtn").length, handBtns: document.querySelectorAll(".songready .songhandbtn").length,
        overflowX: document.documentElement.scrollWidth > window.innerWidth, vh: window.innerHeight,
        scrolls: ready.scrollHeight > ready.clientHeight,
      };
    });
    const tag = `${mode} ${w}×${h}`;
    await s.p.screenshot({ path: `${OUT}/ready-${mode}-${w}x${h}.png` });
    const L = lum(r.bg);
    rec(`ready-${tag}-theme`, /pl-themed/.test(r.cls) && !/playal/.test(r.cls) && (mode === "dark" ? L >= 0 && L < 0.2 : L > 0.85) && (mode === "dark" ? lum(r.titleColor) > 0.7 : lum(r.titleColor) < 0.3) && !/255, 60, 210|140, 70, 255/.test(r.startBg), `root "${r.cls}" · ground ${r.bg} (luma ${L.toFixed(2)}) · title ${r.titleColor} · Start ${r.startBg.slice(0, 60)}`);
    rec(`ready-${tag}-settings-first`, !r.toggleLink && r.tempoBtns === 4 && r.handBtns === 3 && r.settings && r.title && r.settings.top >= r.hdr.bottom - 1 && r.settings.top < r.title.top && r.settings.top - r.hdr.bottom < 24, `settings ${JSON.stringify(r.settings)} just under the header (bottom ${r.hdr && r.hdr.bottom}) · above the title (top ${r.title && r.title.top}) · no fold/unfold link ${!r.toggleLink} · ${r.tempoBtns} speeds, ${r.handBtns} hands`);
    rec(`ready-${tag}-start-reachable`, r.start && r.start.bottom <= r.vh && r.start.top >= 0 && !r.overflowX, `Start ${JSON.stringify(r.start)} in a ${r.vh}px screen · sideways scroll ${r.overflowX} · content scrolls ${r.scrolls}`);
    // the settings really work without opening anything: pick 0.75× and Left
    if (mode === "light" && w === 376) {
      await s.p.click(".songready .songtempobtn >> text=0.75×"); await s.p.click(".songready .songhandbtn >> nth=1");
      const on = await s.p.$$eval(".songready .songtempobtn.on, .songready .songhandbtn.on", els => els.map(e => e.textContent.trim()));
      rec("ready-settings-work", on.includes("0.75×") && on.length === 2, `selected: ${on.join(", ")}`);
      await s.p.click(".songready .songhandbtn >> nth=0"); await s.p.click(".songready .songtempobtn >> text=1×");
      // Start: the neon world begins
      await start(s.p); await s.p.waitForTimeout(600);
      const g = await s.p.evaluate(() => ({ cls: document.querySelector(".songov").className, bg: getComputedStyle(document.querySelector(".songov")).backgroundColor }));
      rec("ready-then-neon", /playal/.test(g.cls) && !/pl-themed/.test(g.cls) && lum(g.bg) < 0.05, `once the song starts: "${g.cls}" on ${g.bg}`);
    }
    await done(s);
  }
}
// ── 11. other pages still open ──
if (want("pages")) {
  const s = await session({ page: null });
  const shots = [];
  await s.p.screenshot({ path: `${OUT}/page-home.png` }); shots.push("home");
  for (const pg of ["pathway", "pvp", "profile", "studio"]) {
    await s.p.evaluate((pg) => { sessionStorage.setItem("tiga_page", pg); }, pg);
    await s.p.reload({ waitUntil: "load" }); await s.p.waitForTimeout(2500);
    await s.p.screenshot({ path: `${OUT}/page-${pg}.png` }); shots.push(pg);
  }
  rec("pages-open", s.errs.length === 0, `${shots.join(", ")} · errors: ${s.errs.join(" / ") || "none"}`);
  await done(s);
}

await b.close();
if (server) server.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed` + (failed.length ? " · failed: " + failed.map(f => f.name).join(", ") : "") + ` · screenshots in ${OUT}`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
process.exit(failed.length ? 1 : 0);
