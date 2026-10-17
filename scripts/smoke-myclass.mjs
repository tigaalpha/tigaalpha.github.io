/* My Class (owner, 2026-10-17): the home page. Opens the REAL dist/ build in a headless phone Chromium (Supabase blocked, nothing written).
   Checks: a fresh open lands on My Class for everyone; it tells the SAME thing the Daily Mentor tells (same topic, minutes and why, from the same
   learnerSignal); the drawer lists My Class first and the Pathway second; the finished-day state sends the learner on to the Learning Pathway;
   no page errors and no React #31. The finished state is forced with tg_test_hook + tg_test_myclass_done because a headless run cannot finish a
   whole real plan (production never sets those). */
import fs from "node:fs"; import http from "node:http"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const ROOT = path.resolve("dist"), TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let fp = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]) === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0])); if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end("nf"); } res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" }); res.end(fs.readFileSync(fp)); });
await new Promise(r => server.listen(0, "127.0.0.1", r)); const BASE = `http://127.0.0.1:${server.address().port}/`;
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const log = () => { const now = Date.now(), out = []; for (let i = 0; i < 5; i++) out.push({ t: now - i * 60000, d: dayKey(), k: "ear", id: "chord", ok: 6, miss: 4, sec: 180 }); return out; };
async function open({ page = null, withLog = false, done = false, lang = "en" } = {}) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(({ page, L, done, lang }) => {
    if (page) sessionStorage.setItem("tiga_page", page);
    localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "Tester", lang, age: "adult", level: "beginner", exp: 5000 }));
    localStorage.setItem("tg_lang", lang); localStorage.setItem("tg_orient_hint_seen", "1");
    localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
    localStorage.removeItem("tg_coach_skip_day");
    if (L) localStorage.setItem("tg_act_log", JSON.stringify(L)); else localStorage.removeItem("tg_act_log");
    if (done) { localStorage.setItem("tg_test_hook", "1"); localStorage.setItem("tg_test_myclass_done", "1"); }
  }, { page, L: withLog ? log() : null, done, lang });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e && e.message || e))); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(BASE, { waitUntil: "load" }); await p.waitForTimeout(2200);
  return { ctx, p, errs };
}
const r31 = (e) => e.filter(x => /#31|objects are not valid as a React child/i.test(x));
// 1. a fresh open (nothing remembered) lands on My Class
{ const s = await open({ withLog: true }); const has = await s.p.locator('[data-myclass]').count(); const t = (await s.p.locator("body").innerText()).replace(/\s+/g, " ");
  ok("a fresh open lands on My Class", has === 1 && /My Class/.test(t), "myclass " + has); ok("one big start button", await s.p.locator("[data-start]").count() === 1);
  const mc = (t.match(/(\d+) min · (from \d+ tries · \d+ misses \(\d+%\))/) || []); ok("shows minutes and the real why", mc.length === 3, mc[0] || "none");
  ok("no page errors, no React #31", s.errs.length === 0 && r31(s.errs).length === 0, s.errs.slice(0, 2).join(" | "));
  // 2. the SAME advice as the Daily Mentor
  await s.p.evaluate(() => sessionStorage.setItem("tiga_page", "coach")); await s.p.reload({ waitUntil: "load" }); await s.p.waitForTimeout(2200);
  const t2 = (await s.p.locator("body").innerText()).replace(/\s+/g, " "); const mm = (t2.match(/(\d+) min · (from \d+ tries · \d+ misses \(\d+%\))/) || []);
  ok("Daily Mentor says the same minutes and the same why", mm.length === 3 && mm[1] === mc[1] && mm[2] === mc[2], (mm[0] || "none") + " vs " + (mc[0] || "none"));
  await s.ctx.close(); }
// 3. drawer order: My Class first, Pathway second
{ const s = await open({}); const items = await s.p.evaluate(() => [...document.querySelectorAll(".draweritem")].map(e => e.textContent.trim()));
  ok("drawer: My Class first", /My Class/.test(items[0] || ""), JSON.stringify(items.slice(0, 3))); ok("drawer: Pathway second", items[1] && /เส้นทาง|PATHWAY|Pathway|路径/i.test(items[1]), items[1] || ""); await s.ctx.close(); }
// 4. finished day sends the learner on to the Learning Pathway
{ const s = await open({ done: true }); const has = await s.p.locator("[data-done]").count(); ok("finished state shows the done card", has === 1);
  await s.p.evaluate(() => document.querySelector("[data-to-pathway]").click()); await s.p.waitForTimeout(1200);
  const pg = await s.p.evaluate(() => sessionStorage.getItem("tiga_page")); ok("the done card continues to the Learning Pathway", pg === "pathway", "page " + pg);
  ok("no page errors", s.errs.length === 0, s.errs.slice(0, 2).join(" | ")); await s.ctx.close(); }
// 5. Thai renders without React #31
{ const s = await open({ withLog: true, lang: "th" }); ok("Thai My Class opens without errors", (await s.p.locator("[data-myclass]").count()) === 1 && r31(s.errs).length === 0 && s.errs.length === 0, s.errs.slice(0, 2).join(" | ")); await s.ctx.close(); }
// 6. the teacher (owner, 2026-10-17): a brand-new learner (no log at all) gets a welcome, a seven-step foundation path and a first step with a reason
{ const s = await open({}); const t = (await s.p.locator("body").innerText()).replace(/\s+/g, " ");
  ok("new learner: teacher card welcomes", (await s.p.locator("[data-teacher]").count()) === 1 && /Welcome to class/.test(t));
  ok("new learner: seven-step foundation path, first step current", (await s.p.locator("[data-tstep]").count()) === 7 && (await s.p.locator('[data-tstep="hands"]').getAttribute("data-tcur")) === "1");
  ok("new learner: focus card names the first step and says why", (await s.p.locator("[data-cold]").count()) === 1 && /Hand shape/.test(t));
  ok("no 'Berklee' anywhere on the page", !/berkl/i.test(t));
  await s.p.evaluate(() => document.querySelector('[data-tstep="song"]').click()); await s.p.waitForTimeout(1200);
  const pg = await s.p.evaluate(() => sessionStorage.getItem("tiga_page")); ok("tapping a path step opens that feature", pg === "studio", "page " + pg);
  ok("no page errors", s.errs.length === 0, s.errs.slice(0, 2).join(" | ")); await s.ctx.close(); }
// 7. a stage step opens the real lesson (scale) and Thai renders the teacher
{ const s = await open({ lang: "th" }); const t = (await s.p.locator("body").innerText()).replace(/\s+/g, " ");
  ok("Thai: teacher welcome", /ยินดีต้อนรับสู่คลาส/.test(t)); await s.p.evaluate(() => document.querySelector('[data-tstep="scale"]').click()); await s.p.waitForTimeout(1500);
  ok("scale step opens without errors", s.errs.length === 0, s.errs.slice(0, 2).join(" | ")); await s.ctx.close(); }
await b.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
