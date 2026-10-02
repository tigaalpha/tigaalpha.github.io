/* Play Along bot suite — plays real songs in the built app (dist/) with a
   headless phone-sized Chromium and checks what a player would notice:
   mashing every key earns nothing, a clean run earns 3 stars and beats the
   boss before the end, notes pressed 0.3 s early never make 3 stars, the
   "practise the part you missed" loop starts at the part and climbs
   75→85→100%, the daily song pays once, a concert's songs each load their own
   data (started through __paTest.setlist: its button is gone from the song
   list), "Play again" is on the first screen at 360×640, pause freezes and
   resumes in place, the first-time intro, the song list's stars/length/lock
   notes and its songs starting high on the screen, the staff slides every frame, a medal pays once and run
   coins stop after 3 runs a day, practice mode waits for the right key, the
   band keeps the beat (4/4, 3/4, drums only for a piano on the mic), the
   game's own sounds switching to their mic-safe voice for a pianist and a
   tapping player's mic being put aside, the
   backing track / metronome choice at the top right, the ready screen wears the app's
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
// the list has no search box: the whole list is on the page, so a song is found by
// its name, an exact name first (one song's name can sit inside another's)
async function openSong(p, name) {
  const cards = await p.$$(".songgrid .songcard");
  const want = name.toLowerCase();
  let pick = null;
  for (const c of cards) { const nm = await c.$(".songcard-nm"); if (nm && ((await nm.textContent()) || "").trim().toLowerCase() === want) { pick = c; break; } }
  if (!pick) for (const c of cards) { const t = ((await c.textContent()) || "").toLowerCase(); if (t.includes(want)) { pick = c; break; } }
  if (!pick) return false;
  await pick.click(); await p.waitForTimeout(900); return true;
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
  // the song list has no Daily Song Quest card any more, but it still picks the day's
  // song once and writes it down; the ready screen says which song it is
  const id = await s.p.evaluate(() => { try { return JSON.parse(localStorage.getItem("tg_daily_song")).id; } catch (e) { return null; } });
  const nm = id ? await s.p.evaluate((i) => window.__paTest.songName(i), id) : null;
  const opened = !!nm && await openSong(s.p, nm);
  const line = await s.p.$eval(".pl-daily", e => e.textContent).catch(() => null);
  rec("daily-ready-line", opened && /Today's song/.test(line || ""), `song ${id} "${nm}" opened ${opened} · line ${JSON.stringify(line)}`);
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
  // the song list no longer has a Concert Mode button; the engine is still there
  await s.p.evaluate(() => window.__paTest.setlist(["jazz_swing_walk", "jazz_blue_note", "jazz_midnight"])); await s.p.waitForTimeout(900);
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
  const firstTop = await s.p.$eval(".songgrid .songcard", e => Math.round(e.getBoundingClientRect().top));
  const gone = await s.p.evaluate(() => ({ search: !!document.querySelector(".songsearch"), banners: document.querySelectorAll(".setlistbtn").length, hero: !!document.querySelector(".songpage .pathhero") }));
  const locked = await s.p.$(".songgrid .songcard.locked");
  if (locked) await locked.click(); await s.p.waitForTimeout(300);
  const msg = await s.p.$eval(".songlockmsg", e => e.innerText).catch(() => null);
  rec("list-cards", meta.every(m => /☆|★/.test(m) && /⏱ \d:\d\d|Level \d/.test(m)), meta.join(" | "));
  rec("list-locked", !!msg && /opens at level \d/.test(msg), msg || "(no message)");
  // owner, 2026-10-01: no title block, no Daily/Concert cards, no search box — the songs start high
  rec("list-straight-to-songs", !gone.search && gone.banners === 0 && !gone.hero && firstTop < 450, `first song card top ${firstTop}px of 915 · search ${gone.search} · banners ${gone.banners}`);
  await done(s);
}
// ── 10a. the library and its eras (owner, 2026-10-01: more than 500 songs, then more than 1,000, divided by era) ──
if (want("eras")) {
  const s = await session({ exp: 0 });
  await openList(s.p);
  const all = await s.p.evaluate(() => ({ cards: document.querySelectorAll(".songgrid .songcard").length, chips: [...document.querySelectorAll(".genrechip")].map(c => c.textContent.trim()) }));
  rec("eras-1000", all.cards > 1000, `${all.cards} songs in "All"`);
  rec("eras-chips", ["Baroque", "Classical", "Romantic", "Impressionism"].every((n, i) => all.chips[i + 1] && all.chips[i + 1].includes(n)) && all.chips[0].includes("All"), all.chips.join(" | "));
  const chips = await s.p.$$(".genrechip");
  const seen = {}; let total = 0;
  for (let i = 1; i <= 4; i++) {
    await chips[i].click(); await s.p.waitForTimeout(250);
    const r = await s.p.evaluate(() => ({ cards: document.querySelectorAll(".songgrid .songcard").length, note: (document.querySelector(".erainfo") || {}).innerText || "" }));
    seen[all.chips[i]] = r.cards; total += r.cards;
    rec("era-" + i, r.cards >= 40 && new RegExp(String(r.cards)).test(r.note) && /\d{4}[–-]\d{4}/.test(r.note), `${all.chips[i]}: ${r.cards} songs · note "${r.note.replace(/\s+/g, " ")}"`);
  }
  // an era is not a level: each has songs a level-1 player can open
  const open1 = await s.p.evaluate(() => document.querySelectorAll(".songgrid .songcard:not(.locked)").length);
  rec("era-open-for-level-1", open1 > 0, `Impressionism, level 1 player: ${open1} songs open`);
  await chips[0].click(); await s.p.waitForTimeout(250);
  rec("eras-all-again", !(await s.p.$(".erainfo")) && (await s.p.$$(".songgrid .songcard")).length === all.cards, `back to ${all.cards} songs, note gone`);
  rec("eras-errors", s.errs.length === 0, s.errs.join(" / ") || "none");
  await done(s);
}
// ── 10a'. real scores play and score like any song: a slow 3/4, a pickup, fast sixteenths, a song, and three art songs from the OpenScore Lieder (2/4, a fast 3/4, a slow 3/4) ──
if (want("classical")) {
  for (const name of ["Gymnopédie No. 2 (Satie)", "Chanson du chat – The Cat's Song (Satie)", "Two-Part Invention No. 4 in D minor, BWV 775 (Bach)", "Heidenröslein (Wild Rose), D. 257 (Schubert)", "Die Forelle – The Trout (Schubert)", "Ständchen, Op. 14 No. 7 (Brahms)", "Mondnacht – Moonlit Night, Op. 39 No. 5 (Schumann)"]) {
    const s = await session({ exp: 50000 });
    await openList(s.p);
    const found = await openSong(s.p, name);
    if (!found) { rec("classical " + name, false, "not in the list"); await done(s); continue; }
    await start(s.p); await bot(s.p);
    await waitResult(s.p, 150000); await stopBot(s.p);
    const st = await starsOf(s.p);
    rec("classical " + name, st === 3 && s.errs.length === 0, `stars ${st} · ${(await resultText(s.p)).slice(0, 90)} · errors ${s.errs.length}`);
    await done(s);
  }
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
    const f = () => { xs.push(head ? head.getBoundingClientRect().left : null); if (++k < 24) requestAnimationFrame(f); else res({ xs, bossSame: document.querySelector(".bosshud") === boss && !!boss, faces: document.querySelectorAll(".bosshud-face").length, sparks: document.querySelectorAll(".bosshud-spark").length }); };
    requestAnimationFrame(f);
  }));
  await stopBot(s.p);
  const steps = r.xs.slice(1).map((x, i) => r.xs[i] - x);
  const moved = steps.filter(d => d > 0.01).length, jumps = steps.filter(d => d > 3).length;
  rec("staff-slides", r.xs[0] != null && moved >= steps.length - 3 && jumps === 0, `moved on ${moved}/${steps.length} frames · biggest step ${Math.max(...steps).toFixed(2)}px`);
  rec("boss-bar-kept", r.bossSame, `same boss bar element across hits ${r.bossSame}`);
  // the face and the hit spark once shared a key, so React kept every old face: a row of them grew across the bar
  rec("boss-one-face", r.faces === 1 && r.sparks <= 1, `${r.faces} face(s) and ${r.sparks} spark(s) on the boss bar after ~9 s of hits`);
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
  const layers = [...new Set(r.log.map(e => e.parts).join(""))].sort().join(""), extras = [...new Set(r.log.map(e => e.extras || "").join(""))].sort().join("");
  rec("band-on-beat", r.log.length > 20 && worst < 6, `${r.log.length} drum steps booked, furthest from the beat grid ${worst.toFixed(1)} ms (a 300 ms stall in the middle)`);
  rec("band-4-4", kicks.length > 4 && kicks.every(p => p === 0 || p === 2), `4/4 kicks on beats ${[...new Set(kicks)].map(p => p + 1).join(",")}`);
  rec("band-layers", /b/.test(layers) && /c/.test(layers) && /a/.test(layers), `layers heard with a clean combo: ${layers} (b bass, c strings, a Fever arpeggio)`);
  rec("band-grand", /d/.test(layers) && /x/.test(layers) && /o/.test(extras) && /f/.test(extras), `the rest of the arrangement: ${layers} + ${extras} (d drone, x brass stabs in Fever, o the opening crash, f the tom fill at the end of a fourth bar)`);
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
// ── 14b. the microphone and the game's own sounds: a player on a real piano (the mic listens and no key was
//         tapped) is taken for a pianist — the band plays drums only and the game's sounds go to their mic-safe
//         voice, noise far above the piano instead of chimes inside it; a player who taps the screen gets the full
//         band and the mic put aside: what it hears counts only when it lands on a note the music asks for ──
if (want("micsafe")) {
  const s = await session();
  await openList(s.p); await openSong(s.p, "Twinkle"); await start(s.p);
  await s.p.evaluate(() => window.__paTest.setSrc("mic"));                  // the mic is open (there is none in a headless browser)
  await s.p.waitForTimeout(400);
  const before = await s.p.evaluate(() => ({ safe: window.__paTest.micSafe(), soft: (window.__paTest.band() || { state: {} }).state.soft }));
  // the first note, tapped: from here on the player is taken for a tapper
  const t = await s.p.evaluate(async () => {
    const T = window.__paTest, ns = T.notes(), lead = T.lead;
    const waitFor = (x) => new Promise(res => { const id = setInterval(() => { const n = T.now(); if (n != null && n >= x) { clearInterval(id); res(); } }, 8); });
    await waitFor(ns[0].t + lead + 0.02); T.press(ns[0].note, "tap");
    await new Promise(r => setTimeout(r, 150));
    const afterTap = { safe: T.micSafe(), soft: T.band().state.soft, combo: T.combo() };
    // a false reading from the mic while the second note is due (a C# is nowhere in Twinkle's first bars): it must cost nothing
    await waitFor(ns[1].t + lead - 0.08); T.press("C#4", "mic");
    const w1 = T.grades().wrong, c1 = T.combo();
    T.press(ns[1].note, "tap");
    // a real piano next to the phone: the mic reading that lands on the third note counts, and then the player is a pianist
    await waitFor(ns[2].t + lead - 0.02); T.press(ns[2].note, "mic");
    await new Promise(r => setTimeout(r, 300));
    return { afterTap, wrongAfterFalse: w1, comboAfterFalse: c1, combo: T.combo(), wrong: T.grades().wrong, safeNow: T.micSafe(), softNow: T.band().state.soft };
  });
  rec("mic-safe-for-a-pianist", before.safe === true && before.soft === true, `before any key: the game's sounds in their mic-safe voice ${before.safe} · the band soft ${before.soft}`);
  rec("mic-safe-off-for-a-tapper", t.afterTap.safe === false && t.afterTap.soft === false && t.afterTap.combo === 1, `after a tap: mic-safe ${t.afterTap.safe} · soft ${t.afterTap.soft} · combo ${t.afterTap.combo}`);
  rec("tapper-mic-put-aside", t.wrongAfterFalse === 0 && t.comboAfterFalse === 1 && t.combo >= 3 && t.wrong === 0, `a C# heard by the mic while a note was due: wrong keys ${t.wrongAfterFalse}, combo kept ${t.comboAfterFalse} · then the piano beside the phone hit the next note: combo ${t.combo}, wrong ${t.wrong}`);
  rec("pianist-again-after-a-mic-hit", t.safeNow === true && t.softNow === true, `after a note that came through the mic: mic-safe ${t.safeNow} · soft ${t.softNow}`);
  await s.p.click(".songhdr .cbtn");
  await s.p.waitForTimeout(500);
  const off = await s.p.evaluate(() => window.__paTest ? window.__paTest.micSafe() : null);
  rec("mic-safe-off-after-the-run", off === false, `after leaving the song: mic-safe ${off}`);
  await done(s);
}
// ── 15. what plays with the song is the player's choice, top right: a backing track (the band) or
//        a metronome — both buttons always in view, one at a time; the count-in ticks either way, and
//        a practice pass (the song stops and waits) has no beat to keep ──
if (want("accomp")) {
  const after = (cl) => cl.filter(c => !c.countIn).length;
  const lastBeat = async (p) => p.evaluate(() => { const b = window.__paTest.band(); return b && b.log.length ? b.log[b.log.length - 1].beat : -1; });
  const s = await session({ w: 376, h: 700 });
  await openList(s.p); await openSong(s.p, "Twinkle");
  // both choices are in the header, at the right, already on the ready screen
  const hdr = await s.p.evaluate(() => {
    const m = document.querySelector(".songhdr .pl-mode"); if (!m) return null;
    const r = m.getBoundingClientRect(), cb = document.querySelector(".songhdr .cbtn").getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth, closeRight: Math.round(cb.right), overflow: document.documentElement.scrollWidth > innerWidth,
      bs: [...m.querySelectorAll("button")].map(b => { const q = b.getBoundingClientRect(); return { label: b.getAttribute("aria-label"), on: b.getAttribute("aria-pressed"), w: Math.round(q.width), h: Math.round(q.height) }; }) };
  });
  rec("accomp-both-in-header", !!hdr && hdr.bs.length === 2 && hdr.bs.every(b => b.w >= 40 && b.h >= 32) && hdr.right > hdr.vw * 0.6 && hdr.closeRight <= hdr.vw && !hdr.overflow && hdr.bs[0].on === "true" && hdr.bs[1].on === "false" && /Backing/.test(hdr.bs[0].label) && /Metronome/.test(hdr.bs[1].label), JSON.stringify(hdr));
  await start(s.p); await bot(s.p);
  await s.p.waitForTimeout(7000);
  const c1 = await s.p.evaluate(() => window.__paTest.clicks());
  const b1 = await lastBeat(s.p);
  rec("accomp-track-is-default", (await s.p.evaluate(() => window.__paTest.accomp())) === "track" && c1.filter(c => c.countIn).length >= 3 && after(c1) === 0 && b1 > 4, `count-in ticks ${c1.filter(c => c.countIn).length} · clicks after it ${after(c1)} · the band has reached beat ${b1}`);
  // playing: the pair is still in the header, still both in view
  const hp = await s.p.evaluate(() => { const m = document.querySelector(".songhdr .pl-mode"); const bs = m ? [...m.querySelectorAll("button")].map(b => b.getBoundingClientRect()) : []; return { n: bs.length, ok: bs.every(q => q.width >= 40 && q.right <= innerWidth), pause: !!document.querySelector(".songhdr .pl-pausebtn"), close: document.querySelector(".songhdr .cbtn").textContent.trim(), overflow: document.documentElement.scrollWidth > innerWidth }; });
  rec("accomp-header-while-playing", hp.n === 2 && hp.ok && hp.pause && !hp.overflow, JSON.stringify(hp));
  await s.p.screenshot({ path: `${OUT}/accomp-playing.png` });
  // switch to the metronome in the header: the click takes over, the band stops booking
  await s.p.click(".songhdr .pl-mode button >> nth=1");
  const bAt = await lastBeat(s.p);
  await s.p.waitForTimeout(3200);
  const c2 = await s.p.evaluate(() => window.__paTest.clicks());
  const b2 = await lastBeat(s.p);
  const pressed = await s.p.$$eval(".songhdr .pl-mode button", els => els.map(e => e.getAttribute("aria-pressed")));
  rec("accomp-metronome", after(c2) >= 3 && b2 - bAt <= 1 && pressed.join() === "false,true" && (await s.p.evaluate(() => window.__paTest.accomp())) === "metro", `clicks ${after(c2)} in 3 s · band moved ${b2 - bAt} beats since the switch · pressed ${pressed.join("/")}`);
  // and back
  await s.p.click(".songhdr .pl-mode button >> nth=0");
  const cAt = after(await s.p.evaluate(() => window.__paTest.clicks()));
  await s.p.waitForTimeout(2600);
  const c3 = after(await s.p.evaluate(() => window.__paTest.clicks())), b3 = await lastBeat(s.p);
  rec("accomp-back-to-track", c3 - cAt <= 1 && b3 - b2 >= 2 && (await s.p.evaluate(() => localStorage.getItem("tg_pa_accomp"))) === "track", `clicks since ${c3 - cAt} · band moved ${b3 - b2} beats · stored ${await s.p.evaluate(() => localStorage.getItem("tg_pa_accomp"))}`);
  // the pause card shows both, and the band's volume only while the band is the choice
  await s.p.click(".pl-pausebtn"); await s.p.waitForTimeout(500);
  const pz = await s.p.evaluate(() => ({ mode: document.querySelectorAll(".pl-pause .pl-mode button").length, vol: !!document.querySelector('.pl-pause [aria-label="Backing track volume"]') }));
  await s.p.click(".pl-pause .pl-mode button >> nth=1"); await s.p.waitForTimeout(300);
  const pz2 = await s.p.evaluate(() => ({ vol: !!document.querySelector('.pl-pause [aria-label="Backing track volume"]') }));
  rec("accomp-in-pause", pz.mode === 2 && pz.vol && !pz2.vol, `pause card: ${pz.mode} mode buttons, volume shown with the band ${pz.vol}, with the metronome ${pz2.vol}`);
  await stopBot(s.p); await done(s);
  const pr = await session();
  await openList(pr.p); await openSong(pr.p, "Twinkle");
  await pr.p.evaluate(() => window.__paTest.setAccomp("metro"));
  await pr.p.click(".pl-practice-btn"); await pr.p.waitForTimeout(300); await bot(pr.p);
  await pr.p.waitForTimeout(8000);
  const cp = await pr.p.evaluate(() => window.__paTest.clicks());
  await stopBot(pr.p);
  rec("accomp-none-in-practice", cp.filter(c => c.countIn).length >= 3 && after(cp) === 0, `practice with the metronome chosen: count-in ticks ${cp.filter(c => c.countIn).length} · clicks after it ${after(cp)}`);
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
// ── 17. the stage behind the notes: the world (sky, city, floor) is painted once and kept, the ready screen paints it while
//        it waits, a song only adds its lanes, and its motion is cheap; at the top graphics level it moves (and Fever
//        brings the beams), at the lowest it is the still picture, and the first frames of a run are not a stall ──
if (want("stage")) {
  for (const [mode, w, h] of [["high", 376, 700], ["low", 376, 700]]) {
    const s = await session({ w, h, extraLS: { tg_pa_gfx_mode: mode } });
    await openList(s.p); await openSong(s.p, "Twinkle");
    await start(s.p);
    // frame intervals over the first 3.5 s (the count-in, where the backdrop is baked)
    const fr = await s.p.evaluate(() => new Promise(res => { const ts = []; const t0 = performance.now(); const f = (t) => { ts.push(t); if (t - t0 < 3500) requestAnimationFrame(f); else res(ts); }; requestAnimationFrame(f); }));
    const gaps = fr.slice(1).map((t, i) => t - fr[i]);
    const worst = Math.max(...gaps);
    await bot(s.p);
    await s.p.waitForTimeout(6500);   // into Fever
    const info = await s.p.evaluate(() => ({ bake: window.__paTest.bake(), gfx: window.__paTest.gfx(), fever: !!document.querySelector(".feverbadge, .songstage.fever") }));
    await s.p.screenshot({ path: `${OUT}/stage-${mode}.png` });
    await stopBot(s.p);
    rec(`stage-${mode}`, info.bake && info.bake.fx === (mode === "high") && worst < 500 && s.errs.length === 0, `Start's bake ran ${info.bake && info.bake.ms.toFixed(0)} ms (world ${info.bake && info.bake.world.toFixed(0)} ms, ${info.bake && info.bake.prebaked ? "painted on the ready screen" : "painted at Start"}) · moving parts ${info.bake && info.bake.fx} · canvas step ${info.gfx} · slowest frame in the first 3.5 s ${worst.toFixed(0)} ms · errors ${s.errs.length}${s.errs.length ? " " + s.errs[0] : ""}`);
    await done(s);
  }
  // the ready screen paints the world in the browser's idle time, for the size the stage had when a run last began on
  // this screen — the ready canvas is taller than the playing one — so Start only adds the song's lanes to a copy of it
  {
    const s = await session({ w: 376, h: 700, extraLS: { tg_pa_gfx_mode: "high" } });
    await openList(s.p); await openSong(s.p, "Twinkle");
    await start(s.p); await s.p.waitForTimeout(600);
    const first = await s.p.evaluate(() => ({ b: window.__paTest.bake(), ls: localStorage.getItem("tg_pa_stage") }));
    let remembered = null; try { remembered = Object.values(JSON.parse(first.ls || "{}"))[0]; } catch (e) {}
    rec("stage-size-remembered", !!first.b && !first.b.prebaked && Array.isArray(remembered) && remembered[0] === 376 && remembered[1] > 100, `first run on this screen: painted at Start (${first.b && first.b.world.toFixed(0)} ms), remembered ${JSON.stringify(remembered)}`);
    await s.p.reload({ waitUntil: "load" }); await s.p.waitForTimeout(2500);             // a new visit: nothing painted yet
    await openList(s.p); await openSong(s.p, "Twinkle");
    await s.p.waitForTimeout(2500);                                                     // the ready screen waits
    await start(s.p); await s.p.waitForTimeout(600);
    const b = await s.p.evaluate(() => window.__paTest.bake());
    rec("stage-prebaked", !!b && b.prebaked === true && b.ms < Math.max(12, b.world * 0.6) && s.errs.length === 0, `on the ready screen the world took ${b && b.world.toFixed(0)} ms of idle time; at Start the bake took ${b && b.ms.toFixed(0)} ms · prebaked ${b && b.prebaked} · errors ${s.errs.length}${s.errs.length ? " " + s.errs[0] : ""}`);
    await done(s);
  }
}
// ── 18. the sheet view (owner, 2026-09-30): no falling notes, the staff big and on the keys — and (owner, 2026-10-01) the next
//        key lit neon blue with a light running along the keys to it, no finger numbers —
//        chosen in the header, top right, beside Backing / Metronome ──
if (want("sheet")) {
  const box = `const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };`;
  // the switch sits in the header beside the accompaniment pair, on the phones people have, in the three languages
  for (const [w, h, lang] of [[360, 740, "en"], [412, 915, "th"], [390, 844, "zh"]]) {
    const s = await session({ w, h, lang });
    await openList(s.p);
    if (lang === "en") await openSong(s.p, "Twinkle");
    else { await (await s.p.$$(".songgrid .songcard:not(.locked)"))[0].click(); await s.p.waitForTimeout(900); }      // the names are translated: take the first open song
    await s.p.waitForSelector(".songhdr", { timeout: 8000 });
    const r = await s.p.evaluate((boxSrc) => {
      const box = new Function(boxSrc + "return box;")();
      const hdr = document.querySelector(".songhdr"), view = hdr.querySelector(".pl-view"), acc = hdr.querySelector(".pl-mode"), title = hdr.querySelector(".songhtitle"), close = hdr.querySelector(".cbtn");
      return { hdr: box(hdr), view: box(view), acc: box(acc), title: box(title), close: box(close), btns: [...hdr.querySelectorAll(".pl-view button")].map(b => ({ txt: b.textContent.trim(), on: b.classList.contains("on"), pressed: b.getAttribute("aria-pressed"), w: Math.round(b.getBoundingClientRect().width) })), overflow: hdr.scrollWidth > hdr.clientWidth + 1, vw: window.innerWidth, accBtns: hdr.querySelectorAll(".pl-mode button").length };
    }, box);
    const tag = `${lang} ${w}×${h}`;
    await s.p.screenshot({ path: `${OUT}/sheet-header-${lang}-${w}.png`, clip: { x: 0, y: 0, width: w, height: 120 } });
    const beside = r.view && r.acc && r.view.r <= r.acc.l + 2 && r.acc.l - r.view.r <= 14 && Math.abs(r.view.t - r.acc.t) <= 4 && Math.abs(r.view.b - r.acc.b) <= 4;
    rec(`sheet-switch-${tag}`, !!r.view && r.btns.length === 2 && r.btns[0].on && !r.btns[1].on && r.btns.every(b => b.txt.length >= 2 && b.w >= 34) && beside && r.title.r <= r.view.l + 1 && r.close.r <= r.vw && !r.overflow && r.accBtns === 2, `switch ${JSON.stringify(r.btns.map(b => b.txt + (b.on ? "*" : "") + " " + b.w + "px"))} at ${r.view && r.view.l}–${r.view && r.view.r}, the accompaniment pair at ${r.acc && r.acc.l}–${r.acc && r.acc.r} · the song's name keeps ${r.title.w}px · header overflow ${r.overflow}`);
    await done(s);
  }
  // in a run: falling → the sheet → falling again, one session
  {
    const s = await session({ w: 412, h: 915 });
    await openList(s.p); await openSong(s.p, "Twinkle");
    await start(s.p); await s.p.waitForTimeout(1800);
    const snap = () => s.p.evaluate((boxSrc) => {
      const box = new Function(boxSrc + "return box;")(), T = window.__paTest;
      return { cls: document.querySelector(".songov").className, gems: T.gems(), lit: document.querySelectorAll(".gpw.lit, .gpb.lit").length, litKeys: [...document.querySelectorAll(".gpw.lit, .gpb.lit")].map(k => ({ ...box(k), kc: getComputedStyle(k).getPropertyValue("--kc").trim() })), runners: [...document.querySelectorAll(".gprun")].map(r => box(r)), fingers: document.querySelectorAll(".gpfinger").length, staff: box(document.querySelector(".songstaffwrap")), pastaff: box(document.querySelector(".pastaff")), stage: box(document.querySelector(".songstage")), piano: box(document.querySelector(".gpwrap")), view: T.view(), bake: T.bake(), pressed: [...document.querySelectorAll(".songhdr .pl-view button")].map(b => b.getAttribute("aria-pressed")) };
    }, box);
    // a note may have just changed, and the light then takes a moment to arrive: look again until it sits on its key
    const sameKey = (r, k) => Math.abs((r.l + r.r) / 2 - (k.l + k.r) / 2) <= 2 && Math.abs(r.w - k.w) <= 3;
    const lightOn = (x) => x.litKeys.length >= 1 && x.runners.length === x.litKeys.length && x.runners.every(r => x.litKeys.some(k => sameKey(r, k)));
    const settled = async () => { let x = await snap(); for (let i = 0; i < 8 && !lightOn(x); i++) { await s.p.waitForTimeout(150); x = await snap(); } return x; };
    const fall = await settled();
    await s.p.screenshot({ path: `${OUT}/sheet-1-falling.png` });
    await s.p.click(".songhdr .pl-view button >> nth=1"); await s.p.waitForTimeout(1200);
    const sheet = await settled();
    await s.p.screenshot({ path: `${OUT}/sheet-2-sheet.png` });
    await s.p.click(".songhdr .pl-view button >> nth=0"); await s.p.waitForTimeout(1200);
    const back = await settled();
    rec("sheet-falling-first", !/pl-sheet/.test(fall.cls) && fall.gems > 0 && fall.lit >= 1 && fall.staff.b <= fall.stage.t + 3 && fall.pastaff.h < 120 && fall.view.sheet === false && fall.bake && fall.bake.sheet === false && fall.pressed.join() === "true,false", `class "${fall.cls}" · ${fall.gems} gems drawn · ${fall.lit} key lit · staff ${fall.staff.t}–${fall.staff.b} above the stage ${fall.stage.t}–${fall.stage.b} · staff ${fall.pastaff.h}px`);
    rec("sheet-no-falling-notes", /pl-sheet/.test(sheet.cls) && sheet.gems === 0 && sheet.view.sheet === true && sheet.bake && sheet.bake.sheet === true && sheet.pressed.join() === "false,true", `class "${sheet.cls}" · ${sheet.gems} gems drawn (falling: ${fall.gems}) · stage is the plain world ${sheet.bake && sheet.bake.sheet}`);
    // the next key is lit neon blue in the sheet view (one colour; the falling view gives each lane its own), with no finger numbers,
    // and a light sits on it — the same width and the same place as the key — while the falling view has no such light
    rec("sheet-key-lit-blue", sheet.litKeys.length >= 1 && sheet.litKeys.every(k => /^#2cc6ff$/i.test(k.kc)) && sheet.fingers === 0 && fall.litKeys.length >= 1 && fall.litKeys.every(k => /^hsl\(/.test(k.kc)) && fall.fingers >= 1, `sheet: ${sheet.litKeys.length} key lit, colour ${sheet.litKeys.map(k => k.kc).join("/")}, ${sheet.fingers} finger numbers · falling: ${fall.litKeys.length} lit in ${fall.litKeys.map(k => k.kc).join("/")}, ${fall.fingers} finger numbers`);
    rec("sheet-light-on-the-key", lightOn(sheet) && lightOn(fall) && lightOn(back), `sheet: ${sheet.runners.length} running light at ${JSON.stringify(sheet.runners.map(r => [r.l, r.w]))} on the lit key ${JSON.stringify(sheet.litKeys.map(k => [k.l, k.w]))} · falling: ${fall.runners.length} light on ${fall.litKeys.length} lit key (${lightOn(fall)}) · back to falling: ${lightOn(back)}`);
    rec("sheet-staff-on-the-keys", sheet.staff.t >= sheet.stage.b - 3 && Math.abs(sheet.piano.t - sheet.staff.b) <= 3 && sheet.pastaff.h >= 125 && sheet.stage.h >= 60, `staff ${sheet.staff.t}–${sheet.staff.b}, ${sheet.pastaff.h}px tall (falling: ${fall.pastaff.h}px) · keys start at ${sheet.piano.t} · stage strip ${sheet.stage.t}–${sheet.stage.b} (${sheet.stage.h}px)`);
    rec("sheet-switch-back", !/pl-sheet/.test(back.cls) && back.gems > 0 && back.lit >= 1 && back.staff.b <= back.stage.t + 3 && back.pastaff.h < 120 && s.errs.length === 0, `back to falling: ${back.gems} gems · ${back.lit} key lit · staff ${back.pastaff.h}px · errors ${s.errs.length}${s.errs.length ? " " + s.errs[0] : ""}`);
    await stopBot(s.p);
    await done(s);
  }
  // the light runs: as the song goes it travels from key to key — stretching across the keys between them, not jumping — and settles
  // on the key that is due; the key itself is lit blue in step with it
  {
    const s = await session({ w: 412, h: 915, extraLS: { tg_pa_view: "sheet" } });
    await openList(s.p); await openSong(s.p, "Twinkle");
    await start(s.p); await bot(s.p);
    const tr = await s.p.evaluate(() => new Promise(res => {
      const t0 = performance.now(), seen = [];
      const tick = () => {
        const r = document.querySelector(".gprun"), lit = document.querySelector(".gpw.lit, .gpb.lit");
        if (r) { const b = r.getBoundingClientRect(), lb = lit && lit.getBoundingClientRect(); seen.push({ t: Math.round(performance.now() - t0), l: b.left, w: b.width, litL: lb ? lb.left : null, litW: lb ? lb.width : null, cls: r.className }); }
        if (performance.now() - t0 > 7000) return res(seen);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    await stopBot(s.p);
    const settled = tr.filter(f => f.litL != null && Math.abs(f.l - f.litL) <= 2 && Math.abs(f.w - f.litW) <= 3);
    const stops = [...new Set(settled.map(f => Math.round(f.litL)))];
    const stretched = tr.filter(f => f.litW != null && f.w > f.litW + 12);          // wider than the key it is bound for: it is stretching across
    const between = tr.filter(f => f.litL != null && Math.abs(f.l - f.litL) > 6 && Math.abs(f.l + f.w - (f.litL + f.litW)) > 6);
    const dirs = [...new Set(tr.map(f => /fwd/.test(f.cls) ? "fwd" : /back/.test(f.cls) ? "back" : "none"))];
    const last = tr[tr.length - 1];
    rec("sheet-light-runs", tr.length > 60 && stops.length >= 3 && stretched.length >= 2 && dirs.includes("fwd") && last && Math.abs(last.l - last.litL) <= 2 && s.errs.length === 0, `${tr.length} frames over 7 s · it came to rest on ${stops.length} different keys · ${stretched.length} frames stretched across the keys, ${between.length} wholly between · directions ${dirs.join("/")} · at the end it sits ${last ? Math.round(last.l - last.litL) : "?"} px from the lit key · errors ${s.errs.length}${s.errs.length ? " " + s.errs[0] : ""}`);
    await done(s);
  }
  // a still of the light mid-run: its transitions are slowed for the picture only, so the frame can be caught
  {
    const s = await session({ w: 412, h: 915, extraLS: { tg_pa_view: "sheet" } });
    await openList(s.p); await openSong(s.p, "Twinkle");
    await start(s.p); await bot(s.p);
    await s.p.addStyleTag({ content: ".gprun.fwd{transition:right .6s ease-out,left 2.4s cubic-bezier(.2,.8,.25,1) .1s !important}.gprun.back{transition:left .6s ease-out,right 2.4s cubic-bezier(.2,.8,.25,1) .1s !important}" });
    let shot = false;
    for (let i = 0; i < 400 && !shot; i++) {
      const w = await s.p.evaluate(() => { const r = document.querySelector(".gprun"), l = document.querySelector(".gpw.lit, .gpb.lit"); return r && l ? [r.getBoundingClientRect().width, l.getBoundingClientRect().width] : null; });
      if (w && w[0] > w[1] * 2.2) { await s.p.screenshot({ path: `${OUT}/sheet-run-midway.png`, clip: { x: 0, y: 500, width: 412, height: 415 } }); shot = true; }
      else await s.p.waitForTimeout(30);
    }
    await stopBot(s.p);
    rec("sheet-run-picture", shot, shot ? "caught the light stretched across the keys (sheet-run-midway.png)" : "never caught the light mid-run");
    await done(s);
  }
  // the layout holds on a small phone, with both hands (a grand staff), on a phone turned sideways and on a tablet
  for (const [w, h, hand, tag] of [[360, 640, "right", "small phone"], [412, 915, "both", "both hands"], [740, 360, "right", "landscape"], [820, 1180, "left", "tablet"]]) {
    const s = await session({ w, h, extraLS: { tg_pa_view: "sheet" } });
    await openList(s.p); await openSong(s.p, "Twinkle");
    if (hand !== "right") { await s.p.click(`.songready .songhandbtn >> nth=${hand === "left" ? 1 : 2}`); await s.p.waitForTimeout(300); }
    await start(s.p); await s.p.waitForTimeout(1500);
    const r = await s.p.evaluate((boxSrc) => {
      const box = new Function(boxSrc + "return box;")();
      const q = (x) => document.querySelector(x);
      return { cls: q(".songov").className, staff: box(q(".songstaffwrap")), pastaff: box(q(".pastaff")), stage: box(q(".songstage")), piano: box(q(".gpwrap")), hdr: box(q(".songhdr")), hud: box(q(".songhud")), overflowX: document.documentElement.scrollWidth > window.innerWidth, vh: window.innerHeight, gems: window.__paTest.gems(), notes: q(".pastaff-move") ? q(".pastaff-move").querySelectorAll("ellipse").length : 0, litKeys: [...document.querySelectorAll(".gpw.lit, .gpb.lit")].map(x => box(x)), runners: [...document.querySelectorAll(".gprun")].map(x => box(x)) };
    }, box);
    // the running light is on the key it is for, on every keyboard (its own arithmetic: the right hand's two octaves from C4, the left's from C2, both hands' four from C3);
    // a note may have just changed, so look again for a moment until it has settled
    const onKey = (r) => r.litKeys.length >= 1 && r.runners.length >= 1 && r.runners.every(x => r.litKeys.some(k => Math.abs((x.l + x.r) / 2 - (k.l + k.r) / 2) <= 2 && Math.abs(x.w - k.w) <= 3));
    for (let i = 0; i < 8 && !onKey(r); i++) {
      await s.p.waitForTimeout(150);
      Object.assign(r, await s.p.evaluate((boxSrc) => { const box = new Function(boxSrc + "return box;")(); return { litKeys: [...document.querySelectorAll(".gpw.lit, .gpb.lit")].map(x => box(x)), runners: [...document.querySelectorAll(".gprun")].map(x => box(x)) }; }, box));
    }
    await s.p.screenshot({ path: `${OUT}/sheet-${tag.replace(/\s/g, "-")}.png` });
    rec(`sheet-layout-${tag.replace(/\s/g, "-")}`, /pl-sheet/.test(r.cls) && r.gems === 0 && Math.abs(r.piano.t - r.staff.b) <= 3 && r.staff.t >= r.stage.b - 3 && r.stage.h >= 40 && !r.overflowX && r.piano.b <= r.vh + 1 && r.notes >= 3 && onKey(r), `${tag} ${w}×${h} (${hand} hand): staff ${r.staff.t}–${r.staff.b} (${r.pastaff.h}px) on the keys at ${r.piano.t} · stage strip ${r.stage.h}px · ${r.notes} note heads on the page · sideways scroll ${r.overflowX} · ${r.litKeys.length} key lit, ${r.runners.length} light on ${r.runners.length ? "it" : "nothing"}${onKey(r) ? "" : " — NOT on the lit key " + JSON.stringify(r.runners.map(x => [x.l, x.w])) + " vs " + JSON.stringify(r.litKeys.map(x => [x.l, x.w]))}`);
    await done(s);
  }
  // the choice is kept, and the ready screen says what the sheet view is
  {
    const s = await session({ w: 390, h: 800 });
    await openList(s.p); await openSong(s.p, "Twinkle");
    await s.p.click(".songhdr .pl-view button >> nth=1"); await s.p.waitForTimeout(300);
    const note = await s.p.evaluate(() => [...document.querySelectorAll(".songready .pl-kindnote")].map(e => e.textContent).join(" | "));
    await s.p.screenshot({ path: `${OUT}/sheet-ready.png` });
    await s.p.reload({ waitUntil: "load" }); await s.p.waitForTimeout(2500);
    await openList(s.p); await openSong(s.p, "Twinkle");
    const after = await s.p.evaluate(() => ({ ls: localStorage.getItem("tg_pa_view"), pressed: [...document.querySelectorAll(".songhdr .pl-view button")].map(b => b.getAttribute("aria-pressed")), cls: document.querySelector(".songov").className }));
    rec("sheet-kept", after.ls === "sheet" && after.pressed.join() === "false,true" && /Sheet mode/.test(note), `after a reload: saved "${after.ls}", buttons ${after.pressed.join("/")} · ready screen says "${note.slice(0, 80)}"`);
    await done(s);
  }
  // the staff keeps the verdict: a note you hit turns green, one you missed red, and they slide away in those colours
  {
    const s = await session({ w: 412, h: 915, extraLS: { tg_pa_view: "sheet" } });
    await openList(s.p); await openSong(s.p, "Twinkle");
    await start(s.p); await bot(s.p, { skipFrom: 3, skipTo: 4.5 });
    const seen = await s.p.evaluate(() => new Promise(res => {
      const t0 = performance.now(); let both = null, hit = false, miss = false;
      const id = setInterval(() => {
        const el = document.querySelector(".pastaff-move"); const html = el ? el.innerHTML : "";
        if (html.includes("rgba(92,242,200")) hit = true; if (html.includes("rgba(255,107,138")) miss = true;
        if ((hit && miss) || performance.now() - t0 > 20000) { clearInterval(id); res({ hit, miss, at: Math.round(performance.now() - t0), missed: window.__paTest.notes().filter(n => n.missed).length, hits: window.__paTest.notes().filter(n => n.hit).length }); }
      }, 250);
    }));
    await s.p.screenshot({ path: `${OUT}/sheet-verdicts.png` });
    await stopBot(s.p);
    rec("sheet-verdicts-on-the-staff", seen.hit && seen.miss, `on the page after ${seen.at} ms: a hit note in green ${seen.hit}, a missed note in red ${seen.miss} (${seen.hits} hit, ${seen.missed} missed so far)`);
    await done(s);
  }
  // the scoring is the same: a clean run is 3 stars and the boss falls, and usage says the run was read from the sheet
  {
    const s = await session({ w: 412, h: 915, extraLS: { tg_pa_view: "sheet" } });
    await openList(s.p); await openSong(s.p, "Velvet Glow"); await start(s.p); await bot(s.p);
    await waitResult(s.p); await stopBot(s.p);
    const st = await starsOf(s.p), txt = await resultText(s.p);
    await s.p.waitForTimeout(600);
    const items = s.usage.filter(r => r.kind === "pa").map(r => r.item_id);
    rec("sheet-scores-the-same", st === 3 && /Boss down/.test(txt) && items.some(i => /^start:.*velvet.*:sheet$/.test(i)) && s.errs.length === 0, `stars ${st} · boss ${/Boss down/.test(txt)} · usage ${items.filter(i => i.startsWith("start:")).join(" | ")} · errors ${s.errs.length}`);
    await done(s);
  }
  // the first-song intro teaches the falling gems, so it is always shown falling, whatever was chosen
  {
    const s = await session({ intro: false, extraLS: { tg_pa_view: "sheet" } });
    await openList(s.p); await openSong(s.p, "Twinkle");
    await s.p.click(".pl-introcard .songbtn.go"); await s.p.waitForTimeout(1500);
    const r = await s.p.evaluate(() => ({ cls: document.querySelector(".songov").className, view: window.__paTest.view(), gems: window.__paTest.gems(), hint: !!document.querySelector(".pl-intro-hint") }));
    rec("sheet-intro-falls", !/pl-sheet/.test(r.cls) && r.view.pref === "sheet" && r.view.sheet === false && r.gems > 0 && r.hint, `intro run: class "${r.cls}" · chosen ${r.view.pref}, shown as sheet ${r.view.sheet} · ${r.gems} gems · hint ${r.hint}`);
    await done(s);
  }
  // practice mode reads from the sheet too: the song waits at the first note, the right key moves it on
  {
    const s = await session({ w: 412, h: 915, extraLS: { tg_pa_view: "sheet" } });
    await openList(s.p); await openSong(s.p, "Twinkle");
    await s.p.click(".pl-practice-btn"); await s.p.waitForTimeout(2500);
    const w = await s.p.evaluate(() => { const T = window.__paTest; const n = T.notes()[0]; return { hud: !!document.querySelector(".pl-practicehud"), gems: T.gems(), staff: !!document.querySelector(".pastaff"), cls: document.querySelector(".songov").className, note: n.note, hit: n.hit, now: T.now(), due: n.t + T.lead }; });
    await s.p.evaluate((note) => window.__paTest.press(note), w.note); await s.p.waitForTimeout(500);
    const h = await s.p.evaluate(() => window.__paTest.notes()[0].hit);
    rec("sheet-practice", w.hud && w.gems === 0 && w.staff && /pl-sheet/.test(w.cls) && !w.hit && Math.abs(w.now - w.due) < 0.1 && h === true && s.errs.length === 0, `practice from the sheet: waiting at ${w.now && w.now.toFixed(2)} s for the note due at ${w.due.toFixed(2)} s · ${w.gems} gems · then ${w.note} pressed → hit ${h} · errors ${s.errs.length}`);
    await done(s);
  }
  // the pause card has the switch too
  {
    const s = await session({ w: 412, h: 915 });
    await openList(s.p); await openSong(s.p, "Twinkle"); await start(s.p); await s.p.waitForTimeout(1200);
    await s.p.click(".pl-pausebtn"); await s.p.waitForTimeout(600);
    const n = await s.p.evaluate(() => document.querySelectorAll(".pl-pause .pl-view button").length);
    await s.p.click(".pl-pause .pl-view button >> nth=1"); await s.p.waitForTimeout(300);
    const v = await s.p.evaluate(() => window.__paTest.view());
    await s.p.click(".pl-pause .songbtn.go"); await s.p.waitForTimeout(3500);
    const after = await s.p.evaluate(() => ({ gems: window.__paTest.gems(), cls: document.querySelector(".songov").className }));
    rec("sheet-in-the-pause-card", n === 2 && v.pref === "sheet" && after.gems === 0 && /pl-sheet/.test(after.cls) && s.errs.length === 0, `${n} buttons on the pause card · chosen ${v.pref} · after resuming ${after.gems} gems, class "${after.cls}" · errors ${s.errs.length}`);
    await done(s);
  }
}
// ── 19. the running light is on the keys in every mode (owner, 2026-10-01: "in Metronome mode too — the light must be in every mode on the
//        piano keys"): falling or sheet, backing track or metronome, practice, each hand ──
if (want("light")) {
  const box = `const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };`;
  const probe = (p) => p.evaluate((boxSrc) => {
    const box = new Function(boxSrc + "return box;")(), T = window.__paTest;
    return { view: T.view(), accomp: T.accomp(), litKeys: [...document.querySelectorAll(".gpw.lit, .gpb.lit")].map(k => ({ ...box(k), kc: getComputedStyle(k).getPropertyValue("--kc").trim() })), runners: [...document.querySelectorAll(".gprun")].map(r => ({ ...box(r), bg: getComputedStyle(r).boxShadow })), fingers: document.querySelectorAll(".gpfinger").length };
  }, box);
  const same = (r, k) => Math.abs((r.l + r.r) / 2 - (k.l + k.r) / 2) <= 2 && Math.abs(r.w - k.w) <= 3;
  const on = (x) => x.litKeys.length >= 1 && x.runners.length === x.litKeys.length && x.runners.every(r => x.litKeys.some(k => same(r, k)));
  const combos = [
    { tag: "falling+backing", view: "fall", accomp: "track" },
    { tag: "falling+metronome", view: "fall", accomp: "metro" },
    { tag: "sheet+backing", view: "sheet", accomp: "track" },
    { tag: "sheet+metronome", view: "sheet", accomp: "metro" },
    { tag: "falling+metronome+left", view: "fall", accomp: "metro", hand: 1 },
    { tag: "sheet+metronome+both", view: "sheet", accomp: "metro", hand: 2 },
    { tag: "falling+backing+both", view: "fall", accomp: "track", hand: 2 },
    { tag: "falling+metronome+practice", view: "fall", accomp: "metro", practice: true },
    { tag: "sheet+metronome+practice", view: "sheet", accomp: "metro", practice: true },
  ];
  for (const c of combos) {
    const s = await session({ w: 412, h: 915, extraLS: { tg_pa_view: c.view, tg_pa_accomp: c.accomp } });
    await openList(s.p); await openSong(s.p, "Mary Had a Little Lamb");
    if (c.hand) { await s.p.click(`.songready .songhandbtn >> nth=${c.hand}`); await s.p.waitForTimeout(300); }
    if (c.practice) await s.p.click(".pl-practice-btn"); else await start(s.p);
    await s.p.waitForTimeout(c.practice ? 2500 : 1800);
    let x = await probe(s.p);
    for (let i = 0; i < 8 && !on(x); i++) { await s.p.waitForTimeout(150); x = await probe(s.p); }
    const modeOk = x.view.sheet === (c.view === "sheet") && x.accomp === c.accomp;
    const colourOk = c.view === "sheet" ? x.litKeys.every(k => /^#2cc6ff$/i.test(k.kc)) : x.litKeys.every(k => /^hsl\(/.test(k.kc));
    // it follows the song: a practice run moves it when the right key is pressed; a timed run moves it by itself
    let moved = 0, stops = 1;
    if (c.practice) {
      const before = x.runners.map(r => r.l);
      await s.p.evaluate(() => { const T = window.__paTest; const n = T.notes().find(q => !q.hit && !q.missed && !q.skip); if (n) T.press(n.note); });
      await s.p.waitForTimeout(700);
      let y = await probe(s.p); for (let i = 0; i < 8 && !on(y); i++) { await s.p.waitForTimeout(150); y = await probe(s.p); }
      moved = y.runners.some((r, i) => before[i] == null || Math.abs(r.l - before[i]) > 4) ? 1 : 0;
      stops = on(y) ? 2 : 1;
    } else {
      await bot(s.p);
      const seenAt = await s.p.evaluate(() => new Promise(res => { const t0 = performance.now(), seen = []; const tick = () => { const r = document.querySelector(".gprun"); if (r) seen.push(Math.round(r.getBoundingClientRect().left)); if (performance.now() - t0 > 4500) return res(seen); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
      stops = new Set(seenAt).size; moved = stops >= 3 ? 1 : 0;
      await stopBot(s.p);
    }
    await s.p.screenshot({ path: `${OUT}/light-${c.tag.replace(/\+/g, "-")}.png`, clip: { x: 0, y: 560, width: 412, height: 355 } });
    rec(`light-${c.tag}`, modeOk && on(x) && colourOk && moved === 1 && (c.view !== "sheet" || x.fingers === 0) && s.errs.length === 0, `view ${x.view.sheet ? "sheet" : "falling"} · ${x.accomp} · ${x.litKeys.length} key lit (${x.litKeys.map(k => k.kc).join("/")}) with ${x.runners.length} light on it (${on(x)}) · fingers ${x.fingers} · it ${c.practice ? "moved after the right key: " + moved : "visited " + stops + " positions in 4.5 s"} · errors ${s.errs.length}${s.errs.length ? " " + s.errs[0] : ""}`);
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
