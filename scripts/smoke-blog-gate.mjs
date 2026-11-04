#!/usr/bin/env node
/* smoke-blog-gate.mjs — the reading gate on the static blog pages (owner 2026-11-04: anyone may read an article; after one minute of reading a pop-up in the middle of the
   screen invites the reader to log in or sign up free for the TIGA AI app).
   No network and no repo files touched: scripts/build-blog-pages.mjs is run with BLOG_FIXTURE / BLOG_OUT / SITE_URL into a temp folder, served locally and driven in Chromium.
   The real one-minute wait is shortened through the test door (localStorage.tg_test_hook = "1" + ?gate_ms=<ms>).
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
async function open(lang, { ms = 1500, session = false, w = 1000, h = 720, hidden = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([s, hid]) => { try { localStorage.setItem("tg_test_hook", "1"); if (s) localStorage.setItem("sb-abcdefgh-auth-token", JSON.stringify({ access_token: "x" })); } catch (e) {} if (hid) Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); }, [session, hidden]);
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(`${ORIGIN}/blog/${lang}/piano-posture.html?gate_ms=${ms}`);
  return { ctx, page };
}
const vis = (page) => page.evaluate(() => { const e = document.getElementById("tg-gate"); return !!e && !e.hidden && getComputedStyle(e).display !== "none"; });

console.log("generated pages");
const html = fs.readFileSync(path.join(tmp, "blog", "th", "piano-posture.html"), "utf8");
ok(/id="tg-gate"[^>]*data-nosnippet[^>]*hidden/.test(html), "the pop-up is in the page, hidden and marked data-nosnippet");
ok(html.includes("utm_source=blog") && html.includes("utm_campaign=piano-posture") && html.includes("go=google") && html.includes("wall=signup") && html.includes("wall=login"), "links carry the blog attribution, go=google, wall=signup, wall=login");
ok(!fs.readFileSync(path.join(tmp, "blog", "th", "index.html"), "utf8").includes("tg-gate"), "the article index has no pop-up");

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
  await page.waitForTimeout(1600); ok(!(await vis(page)), "it does not nag straight away");
  await page.waitForTimeout(2200); ok(await vis(page), "it returns once after three more 'minutes' of reading");
  await page.keyboard.press("Escape"); ok(!(await vis(page)), "Escape closes it");
  await page.waitForTimeout(4500); ok(!(await vis(page)), "never a third time in the session");
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

ok(errs.length === 0, "no page errors" + (errs.length ? ": " + [...new Set(errs)].slice(0, 3).join(" | ") : ""));
await browser.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
