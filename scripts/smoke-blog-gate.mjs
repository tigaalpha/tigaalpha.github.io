#!/usr/bin/env node
/* smoke-blog-gate.mjs — the reading wall on the static blog pages (owner 2026-11-04: anyone may read an article; after 30 seconds of reading (a minute until 2026-11-07) a pop-up in the middle of the
   screen asks the reader to log in or sign up free for the TIGA AI app; since 2026-11-07 (third version) it CANNOT be closed: to read on you have to log in; the page also counts and shows the readers).
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
execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_FIXTURE: path.join(tmp, "posts.json"), BLOG_OUT: out, SITE_URL: ORIGIN, BLOG_SRC: path.join(tmp, "no-static-sources") }, stdio: "pipe" });
// Since 43e18595a the generator no longer bakes the th / en / zh index pages (the on-demand function renders them from the database), so this test writes them the same way the function does.
{ process.env.SITE_URL = ORIGIN; const { indexHtml } = await import(pathToFileURL(path.join(ROOT, "scripts/build-blog-pages.mjs")).href + "?idx=" + Date.now());
  for (const lang of ["th", "en", "zh"]) fs.writeFileSync(path.join(out, lang, "index.html"), indexHtml(lang, posts)); }
const pwm = await import("playwright").catch(async () => import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href)); const pw = pwm.chromium ? pwm : pwm.default;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
const errs = [];
// HeadlessChrome is in the page's crawler list on purpose (a prerender or an audit must not inflate the numbers), so every reader here is an ordinary Chrome
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
async function open(lang, { ms = 1500, session = false, w = 1000, h = 720, hidden = false, ua = UA, rpc = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, userAgent: ua });
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
ok(!/data-gate-close|tg-g-x|tg-g-later/.test(html) && !/Escape/.test(html), "the wall has no close button, no 'maybe later' and no Esc handler");
ok(html.includes('"isAccessibleForFree":false') && html.includes('"cssSelector":"article"'), "the article's JSON-LD says the article is gated (isAccessibleForFree false, cssSelector article)");

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
  const want = { th: ["ล็อกอินเพื่ออ่านต่อ", "ล็อกอินด้วย Google", "สมัครสมาชิกฟรี", "เข้าสู่ระบบ"], en: ["Log in to keep reading", "Continue with Google", "Sign up free", "Log in"], zh: ["登录后继续阅读", "使用 Google 继续", "免费注册", "登录"] }[lang];
  ok(want.every(x => txt.includes(x)), "text is in the page's language (" + want[0] + ")");
  ok(txt.includes("TIGA AI"), "it names the TIGA AI app");
  const hrefs = await page.$$eval("#tg-gate a[data-gate]", as => as.map(a => [a.dataset.gate, a.getAttribute("href")]));
  ok(hrefs.length === 3 && hrefs.every(([, h]) => h.startsWith(ORIGIN + "/?") && h.includes("lg=" + lang)), "three links into the app with the page language");
  ok((await page.evaluate(() => document.documentElement.style.overflow)) === "hidden", "the page behind does not scroll while it is open");
  ok((await page.$$eval("#tg-gate button", b => b.length)) === 0, "there is no button in it at all, only the three links into the app");
  await ctx.close();
}

console.log("the wall cannot be closed");
{
  const { ctx, page } = await open("en", { ms: 1000 });
  await page.waitForTimeout(1700); ok(await vis(page), "shown after the reading time");
  await page.keyboard.press("Escape"); ok(await vis(page), "Escape does not close it");
  await page.mouse.click(6, 6); await page.waitForTimeout(100); ok(await vis(page), "a tap on the dimmed backdrop does not close it");
  await page.click(".tg-g-card h2"); ok(await vis(page), "a tap on the card's own text does not close it");
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  ok(await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest("#tg-gate")), "the keyboard cannot leave the wall (the page behind is inert)");
  ok(await page.evaluate(() => document.querySelector("main").hasAttribute("inert") && document.querySelector("header.top").hasAttribute("inert")), "the article and the header behind it are inert");
  ok((await page.evaluate(() => document.documentElement.style.overflow)) === "hidden", "scrolling is locked");
  await page.waitForTimeout(6000); ok(await vis(page), "still there after many more seconds");
  // the only way out: a session appears in this browser (the reader logged in, even in another tab)
  await page.evaluate(() => localStorage.setItem("sb-abcdefgh-auth-token", JSON.stringify({ access_token: "x" })));
  await page.waitForTimeout(900);
  ok(!(await vis(page)), "it lifts by itself once a session appears");
  ok((await page.evaluate(() => document.documentElement.style.overflow)) !== "hidden" && (await page.evaluate(() => !document.querySelector("main").hasAttribute("inert"))), "...scrolling and the page behind are given back");
  await ctx.close();
}
{
  // met the wall once: a reload or another article is no way round (24 hours, this browser)
  const { ctx, page } = await open("en", { ms: 600 });
  await page.waitForTimeout(1500); ok(await vis(page), "(first time: shown after the reading time)");
  await page.goto(`${ORIGIN}/blog/th/piano-posture.html?gate_ms=60000`);
  await page.waitForTimeout(1500); ok(await vis(page), "another article in the same browser meets the wall at once");
  await page.reload(); await page.waitForTimeout(1500); ok(await vis(page), "a reload meets it at once too");
  await ctx.close();
  const fresh = await open("en", { ms: 60000 });
  await fresh.page.waitForTimeout(1500); ok(!(await vis(fresh.page)), "a browser that never met it still gets the free reading time first");
  await fresh.ctx.close();
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
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA });
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/blog/en/piano-posture.html`); await page.waitForTimeout(1800);
  ok(!(await vis(page)), "without the test door the wait is not shortened (still hidden at 1.8 s)");
  await ctx.close();
}

{
  const { ctx, page } = await open("en", { ms: 600, ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
  await page.waitForTimeout(2000); ok(!(await vis(page)), "a crawler is never walled (it reads the whole article)");
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
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA }); const calls = await stubRpc(ctx);
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
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA });
  const calls = await stubRpc(ctx, { counts: [{ slug: "piano-posture", views: 55 }, { slug: "other", views: 7 }] });
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/blog/zh/`); await page.waitForTimeout(500);
  const t = await page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent));
  ok(t.length === 1 && t[0].includes("55") && t[0].includes("次浏览"), "the list page shows the number on the article's card (" + t[0] + ")");
  ok(calls.some(c => c.name === "blog_view_counts" && c.p_lang === "zh"), "one call per list");
  await ctx.close();
}
console.log("review fixes (2026-11-07): what is and is not counted");
{
  // a tab opened in the background and never looked at is not a view; the view is sent once, when the tab becomes visible
  const { ctx, page, calls } = await open("en", { ms: 5000, hidden: true });
  await page.waitForTimeout(700);
  ok(!calls.some(c => c.p_kind === "view"), "a page loaded in a hidden tab sends no view");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { get: () => false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(500);
  ok(calls.filter(c => c.p_kind === "view").length === 1, "...and exactly one view when the tab is looked at");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await page.waitForTimeout(300);
  ok(calls.filter(c => c.p_kind === "view").length === 1, "...switching tabs again does not count it again");
  await ctx.close();
}
{
  // a 404 from the database (migration not applied) is remembered: the next article in the tab makes no calls at all
  const { ctx, page, calls } = await open("en", { ms: 5000, rpc: { missing: true } });
  await page.waitForTimeout(700); const first = calls.length;
  ok(first >= 1 && (await page.evaluate(() => sessionStorage.getItem("tg_blog_rpc_off"))) === "1", "the first page asks once and notes that the function is missing");
  await page.goto(`${ORIGIN}/blog/th/piano-posture.html?gate_ms=5000`); await page.waitForTimeout(700);
  ok(calls.length === first, "the next article in the same tab sends nothing");
  await ctx.close();
}
for (const [name, ua, counted] of [
  ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", false],
  ["HeadlessChrome (audits, prerender)", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36", false],
  ["a phone called Cubot (not a crawler)", "Mozilla/5.0 (Linux; Android 12; CUBOT KINGKONG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36", true],
]) {
  const { ctx, page, calls } = await open("en", { ms: 600, ua });
  await page.waitForTimeout(1000);
  ok((calls.length > 0) === counted, name + (counted ? ": is counted" : ": is not counted and sends nothing"));
  await ctx.close();
}
{
  // without any storage (private mode, blocked cookies) one tab is still one device, not one per article
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA }); const calls = await stubRpc(ctx);
  await ctx.addInitScript(() => { const bad = { get() { throw new Error("denied"); } }; try { Object.defineProperty(window, "localStorage", bad); } catch (e) {} });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(`${ORIGIN}/blog/en/piano-posture.html`); await page.waitForTimeout(500);
  const v = calls.filter(c => c.p_kind === "view");
  ok(v.length === 1 && /^[A-Za-z0-9_-]{8,64}$/.test(v[0].p_vid), "with local storage blocked the page still counts, with a valid id, and does not throw");
  await ctx.close();
}
{
  // the sitemap: running the generator again must not add the blog urls a second time
  const root = path.join(tmp, "root"); fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "scripts/build-blog-pages.mjs"), path.join(root, "scripts/build-blog-pages.mjs")); fs.copyFileSync(path.join(ROOT, "supabase-client.ts"), path.join(root, "supabase-client.ts"));
  fs.writeFileSync(path.join(root, "sitemap.xml"), '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n<url><loc>https://x.test/songs/th/a.html</loc></url>\n</urlset>\n');
  const run = () => execFileSync("node", [path.join(root, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_FIXTURE: path.join(tmp, "posts.json"), SITE_URL: "https://x.test" }, stdio: "pipe" });
  run(); const n1 = (fs.readFileSync(path.join(root, "sitemap.xml"), "utf8").match(/\/blog\//g) || []).length; run();
  const sm2 = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8"); const n2 = (sm2.match(/\/blog\//g) || []).length;
  ok(n1 > 0 && n1 === n2, "the sitemap holds the blog urls once after two runs (" + n1 + " then " + n2 + ")");
  ok(sm2.includes("/songs/th/a.html") && sm2.trim().endsWith("</urlset>"), "...and keeps the other urls and a closed file");
}
console.log("pages kept from an earlier build are brought up to date");
{
  const keep = path.join(tmp, "keep"); fs.mkdirSync(path.join(keep, "th"), { recursive: true });
  const cur = fs.readFileSync(path.join(tmp, "blog", "th", "piano-posture.html"), "utf8");
  const oldGate = '<style>#tg-gate{position:fixed}</style><div id="tg-gate" hidden><div class="tg-g-card"><a data-gate="google">x</a></div></div><script>var OLD_ONE_MINUTE=60000;</script>';
  fs.writeFileSync(path.join(keep, "th", "piano-posture.html"), cur.replace(/<!--tg-gate:v\d+-->[\s\S]*<!--\/tg-gate-->/, oldGate).replace(/"isAccessibleForFree":false,"hasPart":\{"@type":"WebPageElement","isAccessibleForFree":false,"cssSelector":"article"\},/, ""));
  fs.writeFileSync(path.join(keep, "th", "index.html"), fs.readFileSync(path.join(tmp, "blog", "th", "index.html"), "utf8").replace(/<!--tg-idx:v1-->[\s\S]*<!--\/tg-idx-->/, ""));
  ok(fs.readFileSync(path.join(keep, "th", "piano-posture.html"), "utf8").includes("OLD_ONE_MINUTE"), "(fixture: a page with the one-minute gate and no counter)");
  execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_OFFLINE: "1", BLOG_OUT: keep, SITE_URL: ORIGIN, BLOG_SRC: path.join(tmp, "no-static-sources") }, stdio: "pipe" });
  const k = fs.readFileSync(path.join(keep, "th", "piano-posture.html"), "utf8");
  ok(!k.includes("OLD_ONE_MINUTE") && k.includes("MS=30000") && k.includes("blog_hit") && (k.match(/id="tg-gate"/g) || []).length === 1, "the old gate is replaced by the current one (30 s, view counter), once");
  ok(!k.includes("data-gate-close") && (k.match(/"isAccessibleForFree"/g) || []).length === 2, "the kept page is also made uncloseable and gets the gated-content markup (once, not twice)");
  ok(fs.readFileSync(path.join(keep, "th", "index.html"), "utf8").includes("blog_view_counts"), "the list page gets the counter script");
  execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_OFFLINE: "1", BLOG_OUT: keep, SITE_URL: ORIGIN, BLOG_SRC: path.join(tmp, "no-static-sources") }, stdio: "pipe" });
  ok(fs.readFileSync(path.join(keep, "th", "piano-posture.html"), "utf8") === k, "running it again changes nothing");
}

ok(errs.length === 0, "no page errors" + (errs.length ? ": " + [...new Set(errs)].slice(0, 3).join(" | ") : ""));
await browser.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
