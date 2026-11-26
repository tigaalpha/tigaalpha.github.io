#!/usr/bin/env node
/* verify-analytics-consent.mjs — Step 2.3 (owner 2026-11-26): the cookie bar, GA4 / Meta / TikTok events and the campaign tags.
     node scripts/verify-analytics-consent.mjs
   It builds the app ONCE into a temp folder with fake pixel ids (VITE_META_PIXEL_ID=1111111111, VITE_TIKTOK_PIXEL_ID=TTTEST) and drives it in Chromium with www.tigaalpha.com mapped to the local server; the pixel hosts are
   stubbed (nothing leaves the machine). It checks: (a) before a choice no pixel script is requested, Consent Mode starts denied and the bar is a short non-modal strip; (b) "Necessary only" loads nothing and
   keeps marketing denied; (c) "Accept all" loads both pixels, and a sign_up / purchase event reaches gtag, fbq and ttq with no e-mail / name in them; (d) the campaign tags (first and last touch) are kept, survive a page
   without tags, and ride on handoffUrl. It proves the wiring on a stub, NOT what Google / Meta / TikTok accept on their side: look at their own test tools (GA4 DebugView, Pixel Helper) after the owner sets the ids. */
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import http from "node:http"; import { execSync } from "node:child_process"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
let pass = 0; const fails = []; const ok = (c, n) => { if (c) { pass++; console.log("  ✓ " + n); } else { fails.push(n); console.log("  ✗ FAIL: " + n); } };

console.log("static: the three copies of the default agree");
const ga = fs.readFileSync(path.join(ROOT, "public/ga.js"), "utf8"), an = fs.readFileSync(path.join(ROOT, "analytics.ts"), "utf8");
ok(/DEFAULT_A = false/.test(ga) && /ANALYTICS_DEFAULT_GRANTED = false/.test(an), "ga.js and analytics.ts both start with analytics NOT granted");
ok(/CONSENT_VERSION = "(\d{4}-\d{2}-\d{2})"/.test(an) && ga.includes('V = "' + an.match(/CONSENT_VERSION = "([^"]+)"/)[1] + '"'), "the consent version is the same in ga.js and analytics.ts");
for (const f of ["index.template.html", "landing/index.template.html"]) ok(!/analytics_storage: __c === "0" \? "denied" : "granted"/.test(fs.readFileSync(path.join(ROOT, f), "utf8")) && /connect\.facebook\.net/.test(fs.readFileSync(path.join(ROOT, f), "utf8")), f + ": default is denied until the choice, and the CSP admits the two pixel hosts");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "an-"));
const env = { ...process.env, VITE_META_PIXEL_ID: "1111111111", VITE_TIKTOK_PIXEL_ID: "TTTEST", NODE_OPTIONS: "--max-old-space-size=4096" };
execSync(`npx vite build --outDir ${path.join(TMP, "app")} --emptyOutDir`, { cwd: ROOT, env, stdio: "ignore" });
fs.copyFileSync(path.join(TMP, "app/index.template.html"), path.join(TMP, "app/index.html"));
ok(fs.existsSync(path.join(TMP, "app/ga.js")), "the build carries public/ga.js");
// the real analytics.ts + local-identity.ts as one browser script (same sources the app bundles)
const esbuild = require("esbuild");
const bundle = esbuild.buildSync({ stdin: { contents: 'export * from "./analytics"; export { handoffUrl, utmForSignup, captureUtm } from "./local-identity";', resolveDir: ROOT, loader: "ts" }, bundle: true, format: "iife", globalName: "TgAn", write: false, define: { "import.meta.env.VITE_META_PIXEL_ID": '"1111111111"', "import.meta.env.VITE_TIKTOK_PIXEL_ID": '"TTTEST"', "import.meta.env": "{}" } }).outputFiles[0].text;
fs.writeFileSync(path.join(TMP, "an.iife.js"), bundle);

let chromium; for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { chromium = require(p).chromium; break; } catch (e) {} }
if (!chromium) { console.error("this check did NOT run its browser half: Playwright is missing"); process.exit(1); }
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };
const dir = path.join(TMP, "app");
const srv = await new Promise((res) => { const s = http.createServer((req, rs) => { const u = decodeURIComponent(req.url.split("?")[0]); let fp = path.join(dir, u === "/" ? "/index.html" : u); if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html"); if (!fp.startsWith(dir) || !fs.existsSync(fp)) { rs.writeHead(404); return rs.end(); } rs.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" }); fs.createReadStream(fp).pipe(rs); }); s.listen(0, "127.0.0.1", () => res(s)); });
const HOST = "www.tigaalpha.com", base = `http://${HOST}:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined, args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
async function fresh(url, seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
  const reqs = [];
  await ctx.addInitScript((s) => { try { if (s) Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); localStorage.setItem("tg_pa_intro", "1"); } catch (e) {} }, seed || null);
  await ctx.route(/^https?:\/\/([^\/]*\.)?(supabase\.co|googletagmanager\.com|google-analytics\.com|facebook\.net|facebook\.com|tiktok\.com|stripe\.com|googleapis\.com|gstatic\.com)(\/|:|$)/, (r) => { reqs.push(r.request().url()); if (/connect\.facebook\.net|analytics\.tiktok\.com/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: "" }); return r.abort(); });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(base + url, { waitUntil: "domcontentloaded" }); await p.waitForSelector("[data-cookie-bar]", { timeout: 30000, state: "attached" }).catch(() => {}); await p.waitForTimeout(800);
  return { ctx, p, reqs, errs };
}
const pix = (r) => r.filter((u) => /connect\.facebook\.net|analytics\.tiktok\.com/.test(u));

console.log("(a) before any choice");
{
  const { ctx, p, reqs, errs } = await fresh("/");
  const bar = await p.evaluate(() => { const b = document.querySelector("[data-cookie-bar]"); if (!b) return null; const r = b.getBoundingClientRect(); return { h: r.height, vh: innerHeight, bottom: Math.round(r.bottom) === innerHeight, pos: getComputedStyle(b).position, btns: ["all", "necessary", "settings"].filter((k) => b.querySelector("[data-cookie-" + k + "]")) }; });
  ok(!!bar, "the cookie bar is shown to a visitor who has not chosen");
  ok(bar && bar.h <= bar.vh * 0.25 + 1 && bar.bottom && bar.pos === "fixed", "it sits on the bottom edge and is at most 25% of a 390x844 screen (" + (bar ? Math.round(bar.h) + "px" : "-") + ")");
  ok(bar && bar.btns.length === 3, "three buttons: accept all / necessary only / settings");
  ok(pix(reqs).length === 0, "no Meta / TikTok script was requested before a choice");
  const def = await p.evaluate(() => { const d = (window.dataLayer || []).map((a) => Array.prototype.slice.call(a)).find((a) => a[0] === "consent" && a[1] === "default"); return d && d[2]; });
  ok(def && def.analytics_storage === "denied" && def.ad_storage === "denied" && def.ad_user_data === "denied" && def.ad_personalization === "denied", "Consent Mode v2 default: analytics_storage and all ad signals denied");
  ok(errs.length === 0, "no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
}
console.log("(b) Necessary only");
{
  const { ctx, p, reqs } = await fresh("/");
  await p.evaluate(() => document.querySelector("[data-cookie-necessary]").click()); await p.waitForTimeout(800);
  const st = await p.evaluate(() => ({ c: JSON.parse(localStorage.getItem("tg_consent")), ga: localStorage.getItem("tg_ga"), bar: !!document.querySelector("[data-cookie-bar]"), upd: (window.dataLayer || []).map((a) => Array.prototype.slice.call(a)).filter((a) => a[0] === "consent" && a[1] === "update").map((a) => a[2]) }));
  ok(st.c && st.c.a === 0 && st.c.m === 0 && st.ga === "0" && !st.bar, "the choice is stored (a=0, m=0) and the bar goes away");
  ok(st.upd.length === 1 && st.upd[0].ad_storage === "denied" && st.upd[0].analytics_storage === "denied", "gtag consent update keeps everything denied");
  ok(pix(reqs).length === 0, "still no pixel script"); await ctx.close();
}
console.log("(c) Accept all, then events");
{
  const { ctx, p, reqs } = await fresh("/?utm_source=fb&utm_medium=paid&utm_campaign=camp1&fbclid=zzz");
  await p.evaluate(() => document.querySelector("[data-cookie-all]").click()); await p.waitForTimeout(1200);
  ok(pix(reqs).some((u) => /connect\.facebook\.net/.test(u)) && pix(reqs).some((u) => /analytics\.tiktok\.com/.test(u)), "after Accept all both pixel scripts are requested (async)");
  await p.addScriptTag({ path: path.join(TMP, "an.iife.js") });
  const r = await p.evaluate(() => {
    const ut = TgAn.utmForSignup();
    TgAn.track("sign_up", { method: "google", email: "a@b.com", full_name: "Somchai", note: "me@x.org", ...ut });
    TgAn.track("purchase", { transaction_id: "cs_test_1", value: 24.99, currency: "USD", plan: "premium" });
    const g = (window.dataLayer || []).map((a) => Array.prototype.slice.call(a));
    return { ut, ev: g.filter((a) => a[0] === "event").map((a) => ({ n: a[1], p: a[2] })), fb: (window.fbq && window.fbq.queue || []).map((a) => Array.prototype.slice.call(a)), tt: (window.ttq || []).map((a) => Array.prototype.slice.call(a)) };
  });
  const su = r.ev.find((e) => e.n === "sign_up"), pu = r.ev.find((e) => e.n === "purchase");
  ok(su && su.p.method === "google" && su.p.utm_source === "fb" && su.p.utm_medium === "paid" && su.p.utm_campaign === "camp1", "sign_up reaches GA4 with method and the campaign tags");
  ok(su && !("email" in su.p) && !("full_name" in su.p) && !JSON.stringify(su.p).includes("@"), "no e-mail / name travels with it");
  ok(pu && pu.p.transaction_id === "cs_test_1" && pu.p.value === 24.99 && pu.p.currency === "USD", "purchase carries transaction id, value and currency");
  ok(r.fb.some((a) => a[0] === "init" && a[1] === "1111111111") && r.fb.some((a) => a[0] === "track" && a[1] === "CompleteRegistration") && r.fb.some((a) => a[0] === "track" && a[1] === "Purchase"), "Meta receives init, CompleteRegistration and Purchase");
  ok(r.tt.some((a) => a[0] === "track" && a[1] === "CompleteRegistration") && r.tt.some((a) => a[0] === "track" && a[1] === "CompletePayment"), "TikTok receives CompleteRegistration and CompletePayment");
  ok(!JSON.stringify(r.fb).includes("@") && !JSON.stringify(r.tt).includes("@"), "nothing personal in the pixel queues"); await ctx.close();
}
console.log("(d) campaign tags");
{
  const { ctx, p } = await fresh("/?utm_source=tiktok&utm_medium=video&utm_campaign=launch&ttclid=abc&utm_content=ad7");
  const u1 = await p.evaluate(() => JSON.parse(localStorage.getItem("tg_utm")));
  ok(u1 && u1.first && u1.first.s === "tiktok" && u1.last.c === "launch" && u1.first.ck === "ttclid" && !JSON.stringify(u1).includes("abc"), "first and last touch stored on arrival; the click id is kept as presence only");
  await p.goto(base + "/?utm_source=fb&utm_campaign=second", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1500);
  const u2 = await p.evaluate(() => JSON.parse(localStorage.getItem("tg_utm")));
  ok(u2 && u2.first.s === "tiktok" && u2.last.s === "fb" && u2.last.c === "second", "a later tagged visit moves the last touch, never the first");
  await p.goto(base + "/", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1200);
  await p.addScriptTag({ path: path.join(TMP, "an.iife.js") });
  const r = await p.evaluate(() => ({ ut: TgAn.utmForSignup(), link: TgAn.handoffUrl(location.origin + "/", { lg: "en", via: "mail" }) }));
  ok(r.ut.utm_source === "fb" && r.ut.utm_campaign === "second", "a visit with no tags still knows the campaign (kept up to 90 days)");
  ok(/utm_source=fb/.test(r.link) && /utm_campaign=second/.test(r.link), "the magic-link / handoff address carries the tags");
  await p.evaluate(() => { const j = JSON.parse(localStorage.getItem("tg_utm")); j.first.at = Date.now() - 91 * 864e5; j.last.at = Date.now() - 91 * 864e5; localStorage.setItem("tg_utm", JSON.stringify(j)); });
  const r2 = await p.evaluate(() => TgAn.utmForSignup());
  ok(!r2.utm_source && !r2.utm_campaign, "tags older than 90 days are ignored"); await ctx.close();
}
await browser.close(); srv.close();
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
console.log(`\n${pass} passed, ${fails.length} failed`); if (fails.length) console.log("failed:\n - " + fails.join("\n - "));
process.exit(fails.length ? 1 : 0);
