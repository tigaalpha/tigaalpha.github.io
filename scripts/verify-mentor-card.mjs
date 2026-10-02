/* Mentor card suite — opens the REAL built app (dist/) in a headless phone
   Chromium and checks the one thing a learner sees first on AI Daily Mentor
   (plan 18 §P2): ONE card that says what to practise, for how long, and why
   with real numbers — plus one button that lands in the thing it names. It
   also checks the two things that must NOT regress: the page still opens in
   all three languages without React's "objects are not valid as a React child"
   (#31 — the crash the owner reported with a screenshot), and nothing that
   used to be on the page was deleted (it all moved under "See more").

     npm run build && node scripts/verify-mentor-card.mjs
     ONLY=card,nodevice node scripts/verify-mentor-card.mjs   # a subset
     BASE=https://… node scripts/verify-mentor-card.mjs      # elsewhere

   It serves dist/ itself (or BASE) and blocks Supabase, so nothing is written
   anywhere; screenshots land in node_modules/.cache/mentor/. Needs Playwright +
   Chromium (preinstalled in the cloud containers), like bake-sprites — it
   exits 1 with a clear message when they aren't there, because "I couldn't
   check" must never be reported as "it passed".

   The activity log it seeds is the same shape logActivity() writes
   ({t, d, k, id, ok, miss, sec}) — the card is supposed to say what it says
   because those rows exist, and nothing here invents a number the app then
   displays. ── */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

let pwm;
try { pwm = await import("playwright"); } catch (e) {
  try { pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); }
  catch (e2) { console.error("Playwright is not installed (npm i -g playwright) — this check did NOT run."); process.exit(1); }
}
const pw = pwm.chromium ? pwm : pwm.default;
const EXE = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

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
const want = (n) => !ONLY.length || ONLY.includes(n);
const OUT = process.env.OUT || path.resolve("node_modules/.cache/mentor");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (name, ok, detail) => { results.push({ name, ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + " — " + detail); };

const b = await pw.chromium.launch({ ...(EXE ? { executablePath: EXE } : {}), args: ["--autoplay-policy=no-user-gesture-required"] });

/* One real ear-gym round, five times, with a real miss rate. 30 of 60 wrong
   = the "พลาดบ่อยมาก" branch the card is supposed to explain. */
function actLog(kind = "ear", id = "chord") {
  const now = Date.now(), d = new Date(now);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const out = [];
  for (let i = 0; i < 5; i++) out.push({ t: now - i * 60000, d: key, k: kind, id, ok: 6, miss: 4, sec: 180 });
  return out;
}

async function mentor({ lang = "en", log = null, page = "coach" } = {}) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const errs = [];
  await ctx.route(/supabase\.co/, async r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(({ lang, log, page }) => {
    sessionStorage.setItem("tiga_page", page);
    localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "Tester", lang, age: "adult", level: "beginner", exp: 5000 }));
    localStorage.setItem("tg_lang", lang);
    localStorage.setItem("tg_orient_hint_seen", "1");
    localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
    localStorage.setItem("tg_coach_skip_day", "");            // never skip, or the card hides itself
    localStorage.removeItem("tg_coach_skip_day");
    if (log) localStorage.setItem("tg_act_log", JSON.stringify(log));
    else localStorage.removeItem("tg_act_log");
  }, { lang, log, page });
  const p = await ctx.newPage();
  p.on("console", m => { const t = m.text() || ""; if (m.type() === "error") errs.push(t); });
  p.on("pageerror", e => errs.push(String(e && e.message || e)));
  await p.goto(BASE, { waitUntil: "load" });
  await p.waitForTimeout(2200);
  return { ctx, p, errs, done: async () => { await ctx.close(); } };
}

const r31 = (errs) => errs.filter(e => /#31|objects are not valid as a React child|Minified React error #31/i.test(e));
const body = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

// ── 1. the card itself: what / how long / why, and ONE primary button ──
if (want("card")) {
  const s = await mentor({ lang: "en", log: actLog() });
  const txt = await body(s.p);
  await s.p.screenshot({ path: `${OUT}/card-en.png` });
  const hasTopic = /chord/i.test(txt);
  const hasWhy = /\b60 tries\b|\b50 tries\b|\b60 attempts\b/i.test(txt) || /\b30 miss/i.test(txt);
  const hasMinutes = /\b15 min\b/.test(txt);
  const buttons = await s.p.locator("button", { hasText: /Practice now|Skip today/i }).count();
  rec("card-en", hasTopic && hasWhy && hasMinutes && buttons >= 2 && r31(s.errs).length === 0,
    `topic ${hasTopic} · why ${hasWhy} · minutes ${hasMinutes} · buttons ${buttons} · React#31 ${r31(s.errs).length} · errors ${s.errs.length}`);
  await s.done();
}

// ── 2. the button lands where the card said, in ONE tap ──
if (want("goto")) {
  const s = await mentor({ lang: "en", log: actLog() });
  await s.p.locator("button", { hasText: /Practice now/i }).first().click();
  await s.p.waitForTimeout(1800);
  const now = await s.p.evaluate(() => sessionStorage.getItem("tiga_page"));
  const txt = await body(s.p);
  const landed = now !== "coach" && (now === "eargym" || /Ear gym|ear/i.test(txt));
  await s.p.screenshot({ path: `${OUT}/goto.png` });
  rec("one-tap-lands", landed && r31(s.errs).length === 0, `page ${now} · errors ${s.errs.length}`);
  await s.done();
}

// ── 3. not enough practice yet → an honest card with a way forward, never
//      an empty one and never a fake score ──
if (want("nodevice")) {
  const s = await mentor({ lang: "en", log: [] });
  const txt = await body(s.p);
  await s.p.screenshot({ path: `${OUT}/nodata-en.png` });
  const honest = /Not enough practice yet/i.test(txt) && /Go play a song/i.test(txt);
  const noFake = !/\b0%|\b0 \/ 100/.test(txt.split("See more")[0]);
  rec("no-data-card", honest && noFake && r31(s.errs).length === 0,
    `honest ${honest} · no fake 0 ${noFake} · errors ${s.errs.length}`);
  await s.done();
}

// ── 4. three languages (this is the React #31 guard: every label on the card
//      goes through tr(), so an object must never reach a JSX slot) ──
if (want("langs")) {
  for (const [lang, expect] of [["th", /วันนี้ควรฝึก|ยังซ้อมไม่พอ/], ["en", /Today's focus|Not enough practice yet/], ["zh", /今日重点|练习还不够/]]) {
    const s = await mentor({ lang, log: actLog() });
    const txt = await body(s.p);
    await s.p.screenshot({ path: `${OUT}/card-${lang}.png` });
    rec(`lang-${lang}`, expect.test(txt) && r31(s.errs).length === 0, `card text found ${expect} · React#31 ${r31(s.errs).length}`);
    await s.done();
  }
}

// ── 5. nothing was deleted: the old cards moved under "See more", which is
//      closed on arrival so the first screen stays one answer ──
if (want("more")) {
  const s = await mentor({ lang: "en", log: actLog() });
  const before = await body(s.p);
  const collapsed = await s.p.locator("details.coach-more").evaluate(el => !el.open).catch(() => false);
  await s.p.locator("summary", { hasText: /See more/i }).first().click();
  await s.p.waitForTimeout(500);
  const after = await body(s.p);
  await s.p.screenshot({ path: `${OUT}/seemore.png`, fullPage: false });
  const kept = /7-Day Activity|Weekly Report Card/i.test(after) && after.length > before.length;
  rec("see-more-keeps-everything", collapsed && kept && r31(s.errs).length === 0,
    `collapsed on arrival ${collapsed} · old cards still there ${kept} · React#31 ${r31(s.errs).length}`);
  await s.done();
}

await b.close();
if (server) server.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed` + (failed.length ? " · failed: " + failed.map(f => f.name).join(", ") : "") + ` · screenshots in ${OUT}`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
process.exit(failed.length ? 1 : 0);