#!/usr/bin/env node
/* smoke-blog-gate.mjs — the reading gate on the static blog pages (owner 2026-11-04: anyone may read an article; after 30 seconds of reading (a minute until 2026-11-07) a pop-up in the middle of the
   screen invites the reader to log in or sign up free for the TIGA AI app; the page also counts and shows the readers).
   No network and no repo files touched: scripts/build-blog-pages.mjs is run with BLOG_FIXTURE / BLOG_OUT / SITE_URL into a temp folder, served locally and driven in Chromium.
   The real 30-second wait is shortened through the test door (localStorage.tg_test_hook = "1" + ?gate_ms=<ms>).
     node scripts/smoke-blog-gate.mjs */
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import http from "node:http"; import { execSync, execFileSync } from "node:child_process"; import { pathToFileURL, fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-gate-")); const out = path.join(tmp, "blog");
const posts = ["th", "en", "zh"].map((lang) => ({ id: "p-" + lang, lang, slug: "piano-posture", category: "tips", title: { th: "ท่านั่งเล่นเปียโน", en: "Piano posture", zh: "钢琴坐姿" }[lang], excerpt: "x", body: "# H\n" + "para ".repeat(200) + "\n\n" + "more ".repeat(400), cover_url: null, published: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" }));
fs.writeFileSync(path.join(tmp, "posts.json"), JSON.stringify(posts));
const server = http.createServer((q, s) => { let f = path.join(tmp, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { s.writeHead(404); return s.end("nf"); } s.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain" }); s.end(fs.readFileSync(f)); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port;
execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_FIXTURE: path.join(tmp, "posts.json"), BLOG_OUT: out, SITE_URL: ORIGIN }, stdio: "pipe" });
const pwm = await import("playwright").catch(async () => import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href)); const pw = pwm.chromium ? pwm : pwm.default;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
const errs = [];
async function open(lang, { ms = 1500, session = false, w = 1000, h = 720, hidden = false, ua = null, rpc = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(ua ? { userAgent: ua } : {}) });
  const calls = await stubRpc(ctx, rpc || {});
  await ctx.addInitScript(([s, hid]) => { try { localStorage.setItem("tg_test_hook", "1"); if (s) localStorage.setItem("sb-abcdefgh-auth-token", JSON.stringify({ access_token: "x" })); } catch (e) {} if (hid) Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); }, [session, hidden]);
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(`${ORIGIN}/blog/${lang}/piano-posture.html?gate_ms=${ms}`);
  return { ctx, page, calls };
}

// A stand-in for the Supabase REST calls the page makes (nothing leaves the machine): records what the page sent and answers like public.blog_hit / blog_view_counts.
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "apikey, authorization, content-type", "access-control-allow-methods": "POST, OPTIONS" };
async function stubRpc(ctx, { views = 1234, counts = [], missing = false } = {}) {
  const calls = [];
  await ctx.route("**/rest/v1/rpc/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const name = req.url().split("/rpc/")[1]; let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch (e) {}
    calls.push({ name, ...body });
    if (missing) return route.fulfill({ status: 404, headers: CORS, contentType: "application/json", body: JSON.stringify({ message: "function not found" }) });
    route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(name === "blog_view_counts" ? counts : views) });
  });
  return calls;
}
const vis = (page) => page.evaluate(() => { const e = document.getElementById("tg-gate"); return !!e && !e.hidden && getComputedStyle(e).display !== "none"; });

console.log("generated pages");
const html = fs.readFileSync(path.join(tmp, "blog", "th", "piano-posture.html"), "utf8");
ok(/id="tg-gate"[^>]*data-nosnippet[^>]*hidden/.test(html), "the pop-up is in the page, hidden and marked data-nosnippet");
ok(html.includes("utm_source=blog") && html.includes("utm_campaign=piano-posture") && html.includes("go=google") && html.includes("wall=signup") && html.includes("wall=login"), "links carry the blog attribution, go=google, wall=signup, wall=login");
ok(!fs.readFileSync(path.join(tmp, "blog", "th", "index.html"), "utf8").includes("tg-gate"), "the article index has no pop-up");
ok(/MS=30000/.test(html), "the reading time is 30 seconds");

for (const lang of ["th", "en", "zh"]) {
  console.log(`${lang}: timing, position, text`);
  const { ctx, page } = await open(lang, { ms: 1500 });
  await page.waitForTimeout(700);
  ok(!(await vis(page)), "not shown before the reading time has passed");
  await page.waitForTimeout(1900);
  ok(await vis(page), "shown after the reading time");
  const r = await page.evaluate(() => { const c = document.querySelector(".tg-g-card").getBoundingClientRect(); return { cx: c.left + c.width / 2, cy: c.top + c.height / 2, w: window.innerWidth, h: window.innerHeight }; });
  ok(Math.abs(r.cx - r.w / 2) < 3 && Math.abs(r.cy - r.h / 2) < 40, "the card is in the middle of the screen");
  const txt = await page.evaluate(() => document.getElementById("tg-gate").innerText);
  const want = { th: ["อยากอ่านต่อใช่ไหม", "ล็อกอินด้วย Google", "สมัครสมาชิกฟรี", "เข้าสู่ระบบ", "ไว้ทีหลัง"], en: ["Want to keep reading", "Continue with Google", "Sign up free", "Log in", "Maybe later"], zh: ["想继续阅读吗", "使用 Google 继续", "免费注册", "登录", "稍后再说"] }[lang];
  ok(want.every(x => txt.includes(x)), "text is in the page's language (" + want[0] + ")");
  ok(txt.includes("TIGA AI"), "it names the TIGA AI app");
  const hrefs = await page.$$eval("#tg-gate a[data-gate]", as => as.map(a => [a.dataset.gate, a.getAttribute("href")]));
  ok(hrefs.length === 3 && hrefs.every(([, h]) => h.startsWith(ORIGIN + "/?") && h.includes("lg=" + lang)), "three links into the app with the page language");
  ok((await page.evaluate(() => document.documentElement.style.overflow)) === "hidden", "the page behind does not scroll while it is open");
  await ctx.close();
}

console.log("closing and coming back");
{
  const { ctx, page } = await open("en", { ms: 1000 });
  await page.waitForTimeout(1700); ok(await vis(page), "first showing");
  await page.click(".tg-g-later"); ok(!(await vis(page)), "'maybe later' closes it");
  ok((await page.evaluate(() => document.documentElement.style.overflow)) !== "hidden", "scrolling is given back");
  await page.waitForTimeout(2000); ok(!(await vis(page)), "it does not nag straight away");
  await page.waitForTimeout(6000); ok(await vis(page), "it returns once after three more 'minutes' of reading (six times the first wait)");
  await page.keyboard.press("Escape"); ok(!(await vis(page)), "Escape closes it");
  await page.waitForTimeout(9000); ok(!(await vis(page)), "never a third time in the session");
  ok((await page.evaluate(() => sessionStorage.getItem("tg_blog_gate"))) === "2", "the session count stops at two");
  await ctx.close();
}
{
  const { ctx, page } = await open("th", { ms: 800 });
  await page.waitForTimeout(1500); ok(await vis(page), "shown (backdrop test)");
  await page.mouse.click(6, 6); await page.waitForTimeout(100); ok(!(await vis(page)), "a tap on the dimmed backdrop closes it");
  await ctx.close();
}

console.log("who does not see it");
{
  const { ctx, page } = await open("th", { ms: 600, session: true });
  await page.waitForTimeout(2000); ok(!(await vis(page)), "a member (a session in this browser) never sees it");
  await ctx.close();
}
{
  const { ctx, page } = await open("th", { ms: 600, hidden: true });
  await page.waitForTimeout(2000); ok(!(await vis(page)), "time in a background tab does not count as reading");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 } });
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/blog/en/piano-posture.html`); await page.waitForTimeout(1800);
  ok(!(await vis(page)), "without the test door the wait is not shortened (still hidden at 1.8 s)");
  await ctx.close();
}

console.log("clicking through");
{
  const { ctx, page } = await open("zh", { ms: 600 });
  await page.waitForTimeout(1300);
  let target = "";
  await page.route("**/*", route => { const u = route.request().url(); if (route.request().isNavigationRequest() && !u.includes("/blog/")) { target = u; return route.fulfill({ status: 200, contentType: "text/html", body: "<title>app</title>" }); } route.continue(); });
  await page.click("[data-gate=signup]"); await page.waitForTimeout(500);
  ok(target.includes("wall=signup") && target.includes("utm_source=blog") && target.includes("lg=zh"), "sign up opens the app on its sign-up tab with the attribution");
  const lang = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("tg_guest_profile") || "{}").lang; } catch (e) { return null; } });
  ok(lang === "zh", "the app is told to open in the page's language (guest profile lang = zh)");
  await ctx.close();
}

console.log("a phone");
{
  const { ctx, page } = await open("th", { ms: 600, w: 360, h: 640 });
  await page.waitForTimeout(1400); ok(await vis(page), "shown on a 360x640 phone");
  const m = await page.evaluate(() => { const c = document.querySelector(".tg-g-card").getBoundingClientRect(); const bs = [...document.querySelectorAll("#tg-gate a.tg-g-btn")].map(b => b.getBoundingClientRect().height); return { l: c.left, r: c.right, t: c.top, b: c.bottom, w: innerWidth, h: innerHeight, bs, sx: document.documentElement.scrollWidth > innerWidth }; });
  ok(m.l >= 0 && m.r <= m.w && m.t >= 0 && m.b <= m.h, "the card fits the screen");
  ok(m.bs.every(x => x >= 44), "buttons are at least 44 px tall");
  ok(!m.sx, "no sideways scroll");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "-phone.png" });
  await ctx.close();
}
if (process.env.SHOT) { const { ctx, page } = await open("th", { ms: 600 }); await page.waitForTimeout(1400); await page.screenshot({ path: process.env.SHOT + "-desktop.png" }); await ctx.close(); }

console.log("reader count (owner 2026-11-07)");
for (const [lang, unit] of [["th", "ยอดวิว"], ["en", "views"], ["zh", "次浏览"]]) {
  const { ctx, page, calls } = await open(lang, { ms: 1200, rpc: { views: 1234 } });
  await page.waitForTimeout(500);
  const b = await page.evaluate(() => { const e = document.querySelector(".tg-views"); return e ? { text: e.textContent, hidden: e.hidden, inMeta: !!e.closest("article .meta") } : null; });
  ok(b && !b.hidden && /1,234/.test(b.text) && b.text.includes(unit) && b.inMeta, lang + ": the number of readers shows beside the date (" + (b && b.text.trim()) + ")");
  const v = calls.find(c => c.name === "blog_hit" && c.p_kind === "view");
  ok(v && v.p_lang === lang && v.p_slug === "piano-posture" && /^[A-Za-z0-9_-]{8,64}$/.test(v.p_vid), lang + ": one view is sent with the language, the article and a device id");
  ok(!JSON.stringify(calls).match(/email|user_id|@/), lang + ": nothing personal is sent");
  await ctx.close();
}
{
  const { ctx, page, calls } = await open("en", { ms: 1000 });
  await page.waitForTimeout(600); ok(!calls.some(c => c.p_kind === "read" || c.p_kind === "gate"), "no 'read' or 'gate' before the reading time");
  await page.waitForTimeout(1200);
  ok(calls.some(c => c.p_kind === "read"), "a 'read' is sent when the reader stays the reading time (30 s in production)");
  ok(calls.some(c => c.p_kind === "gate"), "a 'gate' is sent when the pop-up opens");
  await page.route("**/*", route => { const u = route.request().url(); if (route.request().isNavigationRequest() && !u.includes("/blog/")) return route.fulfill({ status: 200, contentType: "text/html", body: "<title>app</title>" }); route.fallback(); });
  await page.click("[data-gate=google]"); await page.waitForTimeout(500);
  ok(calls.some(c => c.p_kind === "click"), "a 'click' is sent when a log-in button is tapped");
  ok(new Set(calls.map(c => c.p_vid)).size === 1, "every call of one page carries the same device id");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 } }); const calls = await stubRpc(ctx);
  const a = await ctx.newPage(); await a.goto(`${ORIGIN}/blog/en/piano-posture.html`); await a.waitForTimeout(400);
  const vid1 = await a.evaluate(() => localStorage.getItem("tg_blog_vid"));
  const b = await ctx.newPage(); await b.goto(`${ORIGIN}/blog/en/piano-posture.html`); await b.waitForTimeout(400);
  const vids = calls.filter(c => c.p_kind === "view").map(c => c.p_vid);
  ok(vid1 && vids.length === 2 && vids[0] === vids[1] && vids[0] === vid1, "the same browser keeps one device id between visits (the server counts it once a day)");
  await ctx.close();
}
{
  const { ctx, page, calls } = await open("th", { ms: 700, session: true, rpc: { views: 9 } });
  await page.waitForTimeout(1600);
  ok(!(await vis(page)), "a member still never sees the pop-up");
  ok(calls.some(c => c.p_kind === "view") && calls.some(c => c.p_kind === "read") && !calls.some(c => c.p_kind === "gate"), "but a member's visit and reading are counted (no 'gate')");
  ok(await page.evaluate(() => !!document.querySelector(".tg-views") && !document.querySelector(".tg-views").hidden), "and sees the number too");
  await ctx.close();
}
{
  const { ctx, page, calls } = await open("en", { ms: 600, ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
  await page.waitForTimeout(1200);
  ok(calls.length === 0, "a crawler is not counted and sends nothing");
  await ctx.close();
}
{
  const { ctx, page, calls } = await open("en", { ms: 600, rpc: { missing: true } });
  await page.waitForTimeout(1300);
  ok(calls.length >= 1, "the migration is missing: the page still asks");
  ok(await page.evaluate(() => { const e = document.querySelector(".tg-views"); return !e || e.hidden; }), "...and shows no number (fails soft)");
  ok(await vis(page), "...and the pop-up still works");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 } });
  const calls = await stubRpc(ctx, { counts: [{ slug: "piano-posture", views: 55 }, { slug: "other", views: 7 }] });
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/blog/zh/`); await page.waitForTimeout(500);
  const t = await page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent));
  ok(t.length === 1 && t[0].includes("55") && t[0].includes("次浏览"), "the list page shows the number on the article's card (" + t[0] + ")");
  ok(calls.some(c => c.name === "blog_view_counts" && c.p_lang === "zh"), "one call per list");
  await ctx.close();
}
console.log("pages kept from an earlier build are brought up to date");
{
  const keep = path.join(tmp, "keep"); fs.mkdirSync(path.join(keep, "th"), { recursive: true });
  const cur = fs.readFileSync(path.join(tmp, "blog", "th", "piano-posture.html"), "utf8");
  const oldGate = '<style>#tg-gate{position:fixed}</style><div id="tg-gate" hidden><div class="tg-g-card"><a data-gate="google">x</a></div></div><script>var OLD_ONE_MINUTE=60000;</script>';
  fs.writeFileSync(path.join(keep, "th", "piano-posture.html"), cur.replace(/<!--tg-gate:v3-->[\s\S]*<!--\/tg-gate-->/, oldGate));
  fs.writeFileSync(path.join(keep, "th", "index.html"), fs.readFileSync(path.join(tmp, "blog", "th", "index.html"), "utf8").replace(/<!--tg-idx:v1-->[\s\S]*<!--\/tg-idx-->/, ""));
  ok(fs.readFileSync(path.join(keep, "th", "piano-posture.html"), "utf8").includes("OLD_ONE_MINUTE"), "(fixture: a page with the one-minute gate and no counter)");
  execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_OFFLINE: "1", BLOG_OUT: keep, SITE_URL: ORIGIN }, stdio: "pipe" });
  const k = fs.readFileSync(path.join(keep, "th", "piano-posture.html"), "utf8");
  ok(!k.includes("OLD_ONE_MINUTE") && k.includes("MS=30000") && k.includes("blog_hit") && (k.match(/id="tg-gate"/g) || []).length === 1, "the old gate is replaced by the current one (30 s, view counter), once");
  ok(fs.readFileSync(path.join(keep, "th", "index.html"), "utf8").includes("blog_view_counts"), "the list page gets the counter script");
  execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_OFFLINE: "1", BLOG_OUT: keep, SITE_URL: ORIGIN }, stdio: "pipe" });
  ok(fs.readFileSync(path.join(keep, "th", "piano-posture.html"), "utf8") === k, "running it again changes nothing");
}

ok(errs.length === 0, "no page errors" + (errs.length ? ": " + [...new Set(errs)].slice(0, 3).join(" | ") : ""));
await browser.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
