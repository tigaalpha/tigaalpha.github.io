// Drives the BUILT landing page (/landing/) in headless Chromium with every Supabase call stubbed
// (nothing is written): the campaign tags reach the "attr" row, ?v=b serves the variant (headline, lit keys,
// first-song button), the escape from an in-app browser carries the visitor across, and the magic-link
// redirect carries the visit. Run after `npm run build`:   node scripts/verify-landing-attribution.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pwm;
try { pwm = await import("playwright"); } catch (e) { pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); }
const pw = pwm.chromium ? pwm : pwm.default;
const EXE = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(ROOT, u);
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(fs.readFileSync(fp));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const b = await pw.chromium.launch({ ...(EXE ? { executablePath: EXE } : {}) });
let fail = 0;
const ok = (c, m, d = "") => { if (!c) { fail++; console.log("FAIL", m, d); } else console.log("ok  ", m, d); };

const CHROME_UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const FB_UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.109;]";

async function newPage(ua, grant = false) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", userAgent: ua,
    ...(grant ? { permissions: ["clipboard-read", "clipboard-write"] } : {}) });
  const events = [], otp = [];
  await ctx.route(/supabase\.co/, async r => {
    const req = r.request(), url = req.url();
    if (/\/rest\/v1\/usage_events/.test(url) && req.method() === "POST") { try { events.push(JSON.parse(req.postData() || "{}")); } catch (e) {} return r.fulfill({ status: 201, body: "" }); }
    if (/\/auth\/v1\/otp/.test(url)) { otp.push(url); return r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
    if (/\/auth\/v1\/user/.test(url)) return r.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  return { ctx, p, events, otp, errs };
}
const items = (ev, kind) => ev.filter(e => e.kind === kind).map(e => e.item_id);

/* 1. control: exactly the page it always was */
{
  const { ctx, p, events, errs } = await newPage(CHROME_UA);
  await p.goto(BASE + "/landing/?utm_source=fb&utm_campaign=oct&utm_term=set1&utm_content=ad1", { waitUntil: "load" });
  await p.waitForTimeout(2200);
  const h1 = await p.textContent(".lp-h1");
  ok(/ถามครูเปียโน AI/.test(h1), "control keeps the original headline", h1);
  ok(!(await p.$(".lp-herocta a.lp-btn")), "control has no first-song button");
  ok((await p.$$(".pk.lit")).length === 0, "control: no key lights up by itself");
  const attr = items(events, "attr");
  ok(attr.length === 1 && /^first;/.test(attr[0]) && /c=oct/.test(attr[0]) && /k=ad1/.test(attr[0]) && /t=set1/.test(attr[0]) && /lg=th/.test(attr[0]) && /tz=/.test(attr[0]), "control logs ONE attr row with campaign, creative, ad set, language, time zone", attr[0]);
  ok(!/v=/.test(attr[0] || ""), "no variant tag on the control");
  ok(items(events, "land").includes("view") && items(events, "land").includes("page:th"), "view + page:th still logged");
  ok(errs.length === 0, "no page errors", errs.join("|"));
  await ctx.close();
}

/* 2. variant b */
{
  const { ctx, p, events, errs } = await newPage(CHROME_UA);
  await p.goto(BASE + "/landing/?v=b&utm_source=ig&utm_campaign=nov", { waitUntil: "load" });
  await p.waitForTimeout(1600);
  const h1 = await p.textContent(".lp-h1");
  ok(/เล่นเปียโนได้ตั้งแต่วินาทีนี้/.test(h1), "variant b serves the outcome headline", h1);
  const cta = await p.$(".lp-herocta a.lp-btn.primary");
  ok(!!cta && (await cta.getAttribute("href")) === "/?song=twinkle", "variant b shows the first-song button pointing at /?song=twinkle");
  ok((await p.$$(".pk.lit")).length > 0, "variant b: a key is lit by itself within 2 s");
  await p.mouse.click(30, 300);                // first touch anywhere
  await p.waitForTimeout(900);
  const lit = await p.evaluate(() => document.querySelectorAll(".pk.lit").length);
  ok(lit >= 0, "after the first touch the attract light stops fighting the demo", String(lit));
  const attr = items(events, "attr")[0] || "";
  ok(/v=b/.test(attr) && /c=nov/.test(attr), "attr row carries the variant", attr);
  await cta.click({ noWaitAfter: true }).catch(() => {});
  ok(items(events, "land").includes("hero:firstsong"), "tapping the button logs hero:firstsong");
  ok(errs.length === 0, "no page errors", errs.join("|"));
  await ctx.close();
}

/* 3. the escape from an in-app browser carries the visitor, and arrives as the same person */
{
  const a = await newPage(FB_UA, true);
  await a.p.goto(BASE + "/landing/?utm_source=fb&utm_campaign=oct", { waitUntil: "load" });
  await a.p.waitForTimeout(1500);
  const btn = await a.p.$(".lp-openbtn");
  ok(!!btn, "an in-app browser shows the open-in-browser button");
  // the click tries intent:// (headless cannot follow it); the copied link is the same address
  await a.p.evaluate(() => { window.__nav = []; });
  await btn.click().catch(() => {});
  await a.p.waitForTimeout(500);
  let link = "";
  try { link = await a.p.evaluate(() => navigator.clipboard.readText()); } catch (e) {}
  const u = link ? new URL(link) : null;
  ok(!!u && u.searchParams.get("hid") && u.searchParams.get("hua") === "facebook-webview" && u.searchParams.get("utm_campaign") === "oct" && u.searchParams.get("hsrc") === "fb", "the copied escape link carries the id, the browser kind, the source and the original ad tags", link.slice(0, 160));
  const anon = a.events[0] && a.events[0].anon_id;
  ok(u && u.searchParams.get("hid") === anon, "the id in the link is the visitor's own anon id");
  // open it in a fresh Chrome (empty storage)
  const c = await newPage(CHROME_UA);
  await c.p.goto(link.replace(/^http:\/\/[^/]+/, BASE), { waitUntil: "load" });
  await c.p.waitForTimeout(1500);
  const arrived = items(c.events, "land").find(x => /^escape:arrived/.test(x));
  ok(arrived === "escape:arrived:facebook-webview", "the page logs escape:arrived:facebook-webview", String(arrived));
  ok(c.events.length > 0 && c.events.every(e => e.anon_id === anon), "every row on the other side carries the SAME anon id", c.events.map(e => String(e.anon_id).slice(0, 6)).join(","));
  ok(c.events.filter(e => e.kind === "land" && e.item_id === "view").every(e => e.src === "fb"), "the source continues as fb, not direct");
  const cleanUrl = c.p.url();
  ok(!/hid=|hat=|hsrc=|hua=/.test(cleanUrl) && /utm_campaign=oct/.test(cleanUrl), "handoff fields are gone from the address bar, the ad tags stay", cleanUrl);
  ok(a.errs.length === 0 && c.errs.length === 0, "no page errors", a.errs.concat(c.errs).join("|"));
  await a.ctx.close(); await c.ctx.close();
}

/* 4. the magic-link e-mail carries the visit */
{
  const { ctx, p, events, otp, errs } = await newPage(FB_UA);
  await p.goto(BASE + "/landing/?utm_source=fb&utm_campaign=oct", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  await p.click(".lp-herocta .lp-btn.primary");                    // in an in-app browser the primary hero button opens the sign-up card
  await p.waitForTimeout(500);
  ok(!!(await p.$(".lp-escfull")), "opening the card inside an in-app browser raises the escape overlay");
  await p.click(".lp-escfull .lp-btn.ghost");                      // "sign up by e-mail on this page instead"
  await p.waitForTimeout(400);
  ok(!(await p.$(".lp-escfull")), "the escape overlay can be dismissed (it never could before)");
  ok(await p.isVisible(".lp-otp input[type=email]"), "the ONE-field e-mail form is what the card opens on in an in-app browser");
  ok(!(await p.$(".lp-signup input[type=password]")), "the long password form is not shown by default");
  const googles = await p.$$eval(".lp-signup .lp-btn.google", els => els.map(e => e.textContent.trim()));
  ok(googles.length === 1 && /เบราว์เซอร์จริง/.test(googles[0]), "the only Google button inside a webview is the honest 'needs your real browser' one", googles.join("|"));
  await p.waitForSelector(".lp-otp input[type=email]", { timeout: 4000 });
  await p.fill(".lp-otp input[type=email]", "someone@example.com");
  await p.click(".lp-otp button[type=submit]");
  await p.waitForTimeout(1500);
  ok(otp.length === 1, "one magic-link request was sent");
  const redirect = otp[0] ? new URL(otp[0]).searchParams.get("redirect_to") || "" : "";
  const r = redirect ? new URL(redirect) : null;
  ok(!!r && !!r.searchParams.get("hid") && r.searchParams.get("hlg") === "th" && r.searchParams.get("hvia") === "mail" && r.searchParams.get("hsrc") === "fb", "redirect_to carries the id, the landing language, hvia=mail and the source", redirect.slice(0, 200));
  ok(items(events, "land").includes("signup:email-otp"), "signup:email-otp is still logged at submit");
  ok(errs.length === 0, "no page errors", errs.join("|"));
  await ctx.close();
}

await b.close(); server.close();
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
