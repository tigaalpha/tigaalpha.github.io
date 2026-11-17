#!/usr/bin/env node
/* verify-school-browser.mjs — the School plan card and checkout modal in the REAL built app, in a phone-sized Chromium (owner, 2026-11-17).

   The question it answers with eyes and numbers: for each language, which figure sits next to each payment method, and is it the figure that method
   charges? Complements scripts/verify-school-currency.mjs (which runs the same code in jsdom and the edge functions under stubs).

     NODE_OPTIONS=--max-old-space-size=4096 npx vite build && node scripts/verify-school-browser.mjs
     LANGS=en,zh node scripts/verify-school-browser.mjs        # a subset (default th,en,zh,ja,ar)
     DIST=/path/to/other/dist OUT=/path/to/shots node scripts/verify-school-browser.mjs

   Nothing leaves the machine: dist/ is served from 127.0.0.1, every supabase.co call is answered by this script (a signed-in learner, the
   payment settings, the two RPCs, the two edge functions), the Stripe page is a stub, every other host is refused. The numbers the stubbed
   database returns are the migration's price table, so what is checked is what the PAGE does with them: it must show the price of the method
   next to it, send the right RPC (the original five-argument one for baht, _v2 for dollars / yuan) and never an amount.

   Screenshots and summary.json (the text of every step, for comparing two builds) land in OUT (default node_modules/.cache/school).
   Needs Playwright + Chromium (preinstalled in the cloud containers); exits 1 with a clear message when they are not there, because
   "I could not check" must never be reported as "it passed". It cannot say how a phone, a real Stripe page or Safari renders any of this. */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

let pwm;
try { pwm = await import("playwright"); } catch (e) {
  try { pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); }
  catch (e2) { console.error("Playwright is not installed (npm i -g playwright): this check did NOT run."); process.exit(1); }
}
const pw = pwm.chromium ? pwm : pwm.default;
const EXE = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const DIST = path.resolve(process.env.DIST || "dist");
const OUT = path.resolve(process.env.OUT || "node_modules/.cache/school");
const LANGS = (process.env.LANGS || "th,en,zh,ja,ar").split(",").filter(Boolean);
// a plain `vite build` writes dist/index.template.html; the full `npm run build` copies it to dist/index.html (and rewrites tracked files in the repo root, which this check never needs)
const ROOT_DOC = fs.existsSync(path.join(DIST, "index.html")) ? "/index.html" : "/index.template.html";
if (!fs.existsSync(path.join(DIST, ROOT_DOC))) { console.error(`${DIST}/index.html is missing: run the build first. This check did NOT run.`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(DIST, u === "/" ? ROOT_DOC : u);
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
  if (!fp.startsWith(DIST) || !fs.existsSync(fp)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(fs.readFileSync(fp));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

let pass = 0, fail = 0;
const ok = (c, n, d) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (d ? "  [" + d + "]" : "")); } };
const summary = {};

const REF = "gsaqgbracxnucdmtmcxz", UID = "11111111-1111-1111-1111-111111111111";
const PAYCFG = { promptpay: "0812345678", name: "TIGA", bank: "KBank", bank_account: "123-4-56789-0", bank_swift: "" };
// the migration's price table (per seat); the stubbed database answers with these
const UNIT = { thb: { month: 920, year: 10700 }, usd: { month: 28.99, year: 334.99 }, cny: { month: 210, year: 2360 } };
const cents = (n) => Math.round(n * 100) / 100;

const browser = await pw.chromium.launch({ ...(EXE ? { executablePath: EXE } : {}), args: ["--autoplay-policy=no-user-gesture-required"] });

async function open(lang, tag) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const st = { rpc: [], edge: [], errors: [], stripePage: false };
  const profile = { id: UID, name: "Tester", onboarded: true, lang, exp: 400, coins: 50, gems: 0, is_admin: false, admin_tier: 0, banned: false, created_at: "2025-01-01T00:00:00Z", plan: "free", plan_until: null };
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route((u) => !u.href.startsWith(BASE), async (r) => {
    const req = r.request(), url = req.url();
    if (/checkout\.stripe\.test/.test(url)) { st.stripePage = true; return r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><meta name=viewport content='width=device-width'><body style='font:20px sans-serif;padding:40px'>Stripe Checkout (stub): the session was opened." }); }
    if (!/supabase\.co/.test(url)) return r.abort();
    let body = {}; try { body = req.postDataJSON() || {}; } catch (e) {}
    if (/\/rest\/v1\/rpc\/school_submit_payment_request_v2/.test(url)) {
      st.rpc.push({ name: "school_submit_payment_request_v2", args: body });
      const id = "req-" + st.rpc.length;
      return json(r, { id, amount_thb: UNIT.thb[body.p_cycle] * body.p_seats, currency: body.p_currency, charge_amount: cents(UNIT[body.p_currency][body.p_cycle] * body.p_seats) });
    }
    if (/\/rest\/v1\/rpc\/school_submit_payment_request/.test(url)) {
      st.rpc.push({ name: "school_submit_payment_request", args: body });
      return json(r, { id: "req-" + st.rpc.length, amount: UNIT.thb[body.p_cycle] * body.p_seats });
    }
    if (/\/functions\/v1\/school-stripe-checkout/.test(url)) { if (req.method() === "POST") { st.edge.push(body); return json(r, { url: "https://checkout.stripe.test/c/pay_1" }); } return r.fulfill({ status: 204 }); }
    if (/\/functions\/v1\/stripe-checkout/.test(url)) return json(r, { mode: "live" });
    if (/\/functions\//.test(url)) return json(r, {}, 500);
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === "GET") return json(r, profile);
    if (/\/rest\/v1\/app_settings/.test(url) && /key=eq\.payment/.test(url)) return json(r, { value: PAYCFG });
    if (/\/auth\/v1\//.test(url)) return json(r, {});
    return json(r, []);
  });
  await ctx.addInitScript(({ lang, ref, uid }) => {
    localStorage.setItem("tg_lang", lang); localStorage.setItem("tg_orient_hint_seen", "1"); localStorage.setItem("tg_3d_tier", "0");
    localStorage.setItem("tg_permprimed", "1"); localStorage.setItem("tg_push_primed", "1"); localStorage.setItem("tg_welcomed", "1");
    localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: "stub.access.token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "stub-refresh",
      user: { id: uid, aud: "authenticated", role: "authenticated", email: "tester@example.com", app_metadata: {}, user_metadata: {}, created_at: "2025-01-01T00:00:00Z" },
    }));
  }, { lang, ref: REF, uid: UID });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => st.errors.push(String(e.message).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") { const t = m.text(); if (!/Failed to load resource|net::ERR|ERR_FAILED/i.test(t)) st.errors.push(t.slice(0, 200)); } });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(2600);
  for (let i = 0; i < 3; i++) { const x = await page.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await page.waitForTimeout(300); }
  // the Auto Teaching pop-up has nothing to do with the School modal but can appear at any moment and swallow a click: hidden for the whole session
  await page.addStyleTag({ content: ".atpopup{display:none!important;pointer-events:none!important}" });
  const shot =(name) => page.screenshot({ path: path.join(OUT, `${lang}-${tag}-${name}.png`) });
  const txt = async (sel) => ((await page.locator(sel).first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  return { ctx, page, st, shot, txt };
}
// menu -> upgrade item -> the School tab: the real way a buyer gets there
async function toSchoolCard(s) {
  const { page } = s;
  const hamb = page.locator("button.hamb, button.vidfab").first();
  await hamb.click({ timeout: 8000 });
  await page.waitForTimeout(500);
  await page.locator(".draweritem.sub").first().click({ timeout: 8000 });
  await page.waitForTimeout(600);
  await page.locator("button.billtog-b2b").click({ timeout: 8000 });
  await page.waitForTimeout(500);
}
async function toMethods(s, { seats, yearly } = {}) {
  const { page } = s;
  await page.locator(".prtier.max button.songbtn.go").first().click({ timeout: 8000 });     // the top (Plus) card's enrol button
  await page.waitForSelector(".setcard .aicreate-in", { timeout: 8000 });
  await page.fill(".setcard input.aicreate-in", "Test School");
  if (seats) await page.fill(".setcard input[type=number]", String(seats));
  if (yearly) await page.locator(".setcard .billtog").nth(1).click();
  await page.waitForTimeout(300);
}
const next = (s) => s.page.locator(".setcard button.songbtn.go").first().click();
const buttons = (s) => s.page.locator(".setcard button").allInnerTexts().then((a) => a.map((t) => t.replace(/\s+/g, " ").trim()));
const clean = (e) => e.filter((m) => !/#31|#310|objects are not valid|Rendered more hooks|Cannot read properties|is not defined/.test(m) ? false : true);

const EXPECT = {   // 15 seats, monthly: the owner's numbers x 15
  th: { card: /฿920.*เดือน/, headline: "฿13,800", unit: "฿920" },
  en: { card: /US\$28\.99.*mo/, headline: "US$434.85", unit: "US$28.99" },
  zh: { card: /¥210.*月/, headline: "¥3,150", unit: "¥210" },
  ja: { card: /US\$28\.99/, headline: "US$434.85", unit: "US$28.99" },
  ar: { card: /US\$28\.99/, headline: "US$434.85", unit: "US$28.99" },
};

for (const lang of LANGS) {
  const E = EXPECT[lang]; if (!E) { console.log("SKIP unknown language " + lang); continue; }
  summary[lang] = {};
  // 1. the card on the pricing overlay, then the modal's first two screens
  {
    const s = await open(lang, "a");
    await toSchoolCard(s);
    const card = await s.txt(".prtier.max .prtier-top"), yr = await s.txt(".prtier.max .pr-yrsave");
    await s.shot("1-school-card");
    ok(E.card.test(card), `${lang}: the School card shows ${E.unit} per seat per month`, card);
    summary[lang].card = card; summary[lang].cardYearly = yr;
    await toMethods(s);
    const det = await s.txt(".setcard .paysum"); await s.shot("2-details");
    ok(det.includes(E.headline), `${lang}: the details screen totals 15 seats at ${E.headline}`, det);
    summary[lang].details = await s.txt(".setcard");
    await next(s); await s.page.waitForTimeout(500);
    const head = await s.txt(".setcard .paysum"), btns = await buttons(s); await s.shot("3-methods");
    ok(head.includes(E.headline), `${lang}: the method screen's headline is ${E.headline}`, head);
    summary[lang].methods = await s.txt(".setcard"); summary[lang].buttons = btns;
    ok(clean(s.st.errors).length === 0, `${lang}: no page error while opening the card and the modal`, clean(s.st.errors).join(" | "));
    await s.ctx.close();
  }
  // 2. one run per payment method this language shows
  const runs = lang === "th" ? ["promptpay", "card"] : lang === "en" ? ["promptpay", "bank", "card"] : lang === "zh" ? ["alipay", "wechat", "card"] : ["card"];
  for (const method of runs) {
    const s = await open(lang, method);
    await toSchoolCard(s); await toMethods(s); await next(s); await s.page.waitForTimeout(500);
    const label = { promptpay: /PromptPay/, bank: /bank transfer|โอนเข้าบัญชี/, card: /💳/, alipay: /支付宝/, wechat: /微信/ }[method];
    const btns = await buttons(s);
    const btn = s.page.locator(".setcard button", { hasText: label }).first();
    if (!(await btn.count())) { ok(false, `${lang}/${method}: the button exists`, JSON.stringify(btns)); await s.ctx.close(); continue; }
    const btnText = (await btn.innerText()).replace(/\s+/g, " ").trim();
    await btn.click(); await s.page.waitForTimeout(1500);
    if (method === "card") {
      // the card opens the Stripe stub with the row the database made
      await s.page.waitForURL(/checkout\.stripe\.test/, { timeout: 6000 }).catch(() => {});
      await s.shot("4-stripe-stub");
      const rpc = s.st.rpc[0], edge = s.st.edge[0];
      const want = lang === "th" ? { name: "school_submit_payment_request", cur: undefined, expect: 13800, c: "thb" } : lang === "zh" ? { name: "school_submit_payment_request_v2", cur: "cny", expect: 3150, c: "cny" } : { name: "school_submit_payment_request_v2", cur: "usd", expect: 434.85, c: "usd" };
      ok(s.st.stripePage && !!rpc && rpc.name === want.name && rpc.args.p_method === "stripe" && rpc.args.p_currency === want.cur, `${lang}: the card calls ${want.name}${want.cur ? " with " + want.cur : " (no currency)"} and then opens Stripe`, JSON.stringify(rpc) + " stripe " + s.st.stripePage);
      ok(!!edge && edge.requestId === "req-1" && edge.expect === want.expect && edge.cur === want.c && Object.keys(edge).sort().join() === "cur,expect,requestId", `${lang}: school-stripe-checkout gets the row id, the figure shown (${want.expect}) and ${want.c}, nothing else`, JSON.stringify(edge));
      ok(rpc && !Object.keys(rpc.args).some((k) => /amount|price|total/i.test(k)), `${lang}: the RPC arguments carry no amount`, rpc && Object.keys(rpc.args).join());
    } else {
      await s.shot(`4-${method}`);
      const head = await s.txt(".setcard .paysum"), body = await s.txt(".setcard");
      const rpc = s.st.rpc[0];
      const wantHead = { promptpay: "฿13,800", bank: "฿13,800", alipay: "¥3,150", wechat: "¥3,150" }[method];
      ok(head.includes(wantHead), `${lang}/${method}: after choosing it the headline is its own amount, ${wantHead}`, head);
      ok(!!rpc && rpc.name === (method === "alipay" || method === "wechat" ? "school_submit_payment_request_v2" : "school_submit_payment_request") && !("p_currency" in rpc.args && (method === "promptpay" || method === "bank")), `${lang}/${method}: the right RPC (${rpc && rpc.name})`, JSON.stringify(rpc));
      if (method === "alipay" || method === "wechat") ok(/支付 ¥3,150/.test(body) && rpc && rpc.args.p_currency === "cny", `${lang}/${method}: the instruction says pay ¥3,150 (the old screen said ¥13,800), p_currency cny`, body.slice(-80));
      if (method === "bank") ok(/฿13,800/.test(body), `${lang}/bank: the amount to transfer is ฿13,800`, body.slice(0, 160));
      summary[lang][method] = body;
    }
    if (method !== "card") summary[lang][method + "Button"] = btnText;
    ok(clean(s.st.errors).length === 0, `${lang}/${method}: no page error`, clean(s.st.errors).join(" | "));
    await s.ctx.close();
  }
  if (lang === "ar") {
    const s = await open("ar", "rtl"); await toSchoolCard(s); await toMethods(s); await next(s); await s.page.waitForTimeout(500);
    const dir = await s.page.evaluate(() => document.documentElement.dir), box = await s.page.locator(".setcard .paysum").boundingBox(), vw = 412;
    await s.shot("3-methods");
    ok(dir === "rtl" && !!box && box.x >= 0 && box.x + box.width <= vw + 1, "ar: the page is right-to-left and the price row fits inside the 412 px screen", JSON.stringify({ dir, box }));
    await s.ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed  (screenshots and summary.json in ${OUT})`);
process.exit(fail ? 1 : 0);
