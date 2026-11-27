#!/usr/bin/env node
/* verify-line-login.mjs — LINE Login stays OFF until the owner turns it on (Step 2.2, owner 2026-11-26).
     node scripts/verify-line-login.mjs      (needs a normal `npm run build` first for the "off" half; builds the "on" variants itself into a temp folder)
   OFF (the committed build, no env): the LINE button code is not in the app bundle nor in the landing bundle, and the build env is read through VITE_LINE_LOGIN_ENABLED only.
   ON (VITE_LINE_LOGIN_ENABLED=1, VITE_LINE_PROVIDER_ID=custom:line-test): the app's ?wall= card and the corner log-in card draw the green LINE button, inside LINE's own browser it is the FIRST button, a tap asks Supabase's
   authorize endpoint for provider "custom:line-test" (the request is stubbed, nothing is sent), and the landing's sign-up card draws it too. It cannot tell whether LINE's real login page, the Supabase custom provider or the callback work: that needs the owner's setup. */
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import http from "node:http"; import { execSync } from "node:child_process"; import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
let pass = 0; const fails = []; const ok = (c, n) => { if (c) { pass++; console.log("  ✓ " + n); } else { fails.push(n); console.log("  ✗ FAIL: " + n); } };
const jsIn = (d) => fs.readdirSync(d).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(d, f), "utf8")).join("\n");

console.log("OFF: the committed build without the variable");
// only the files the CURRENT page loads: the bundle folders keep the last 8 builds on purpose, and an older build may differ
const cur = (html, dir) => { const t = fs.readFileSync(path.join(ROOT, html), "utf8"); return [...t.matchAll(/(?:src|href)="\.?\/?(?:\.\/)?bundle\/([^"]+\.js)"/g)].map((m) => fs.readFileSync(path.join(ROOT, dir, m[1]), "utf8")).join("\n"); };
const appOff = cur("dist/index.html", "dist/bundle"), landOff = cur("landing/index.html", "landing/bundle");
ok(!/data-line-login/.test(appOff), "the app bundle has no LINE button (VITE_LINE_LOGIN_ENABLED unset)");
ok(!/data-line-login/.test(landOff), "the landing bundle has no LINE button");

console.log("ON: a temporary build with VITE_LINE_LOGIN_ENABLED=1");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "line-on-"));
const env = { ...process.env, VITE_LINE_LOGIN_ENABLED: "1", VITE_LINE_PROVIDER_ID: "custom:line-test", NODE_OPTIONS: "--max-old-space-size=4096" };
execSync(`npx vite build --outDir ${path.join(TMP, "app")} --emptyOutDir`, { cwd: ROOT, env, stdio: "ignore" });
execSync(`npx vite build -c vite.landing.config.ts --outDir ${path.join(TMP, "landing")} --emptyOutDir`, { cwd: ROOT, env, stdio: "ignore" });
fs.copyFileSync(path.join(TMP, "app/index.template.html"), path.join(TMP, "app/index.html"));
fs.copyFileSync(path.join(TMP, "landing/index.template.html"), path.join(TMP, "landing/index.html"));
ok(/data-line-login/.test(jsIn(path.join(TMP, "app/bundle"))) && /data-line-login/.test(jsIn(path.join(TMP, "landing/bundle"))), "both bundles carry the LINE button when the variable is 1");

let chromium; for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { chromium = require(p).chromium; break; } catch (e) {} }
if (!chromium) { console.error("this check did NOT run its browser half: Playwright is missing"); process.exit(1); }
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };
const serve = (dir) => new Promise((res) => { const s = http.createServer((req, rs) => { const u = decodeURIComponent(req.url.split("?")[0]); let fp = path.join(dir, u === "/" ? "/index.html" : u); if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html"); if (!fp.startsWith(dir) || !fs.existsSync(fp)) { rs.writeHead(404); return rs.end(); } rs.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" }); fs.createReadStream(fp).pipe(rs); }); s.listen(0, "127.0.0.1", () => res(s)); });
const HOST = "www.tigaalpha.com";
const appSrv = await serve(path.join(TMP, "app")), landSrv = await serve(path.join(TMP, "landing"));
const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined, args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
const LINE_UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 Line/13.9.0/IAB";
async function page(port, ua) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "th-TH", ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage(), errs = [], auth = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await ctx.addInitScript(() => { try { localStorage.setItem("tg_pa_intro", "1"); } catch (e) {} });
  await ctx.route(/supabase\.co/, (r) => { const u = r.request().url(); if (/auth\/v1\/authorize/.test(u)) { auth.push(u); return r.abort(); } return r.abort(); });
  return { ctx, p, errs, auth, base: `http://${HOST}:${port}` };
}
{
  const { ctx, p, errs, auth, base } = await page(appSrv.address().port);
  await p.goto(base + "/?wall=signup", { waitUntil: "domcontentloaded" }); await p.waitForSelector("[data-login-wall]", { timeout: 30000 });
  ok(await p.locator("[data-login-wall] [data-line-login]").count() === 1, "app ?wall=signup card: the LINE button is drawn");
  const order = await p.evaluate(() => { const g = document.querySelector("[data-wall-google]"), l = document.querySelector("[data-line-login]"); return g && l ? !!(g.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING) : null; });
  ok(order === true, "outside LINE it follows the Google button");
  await p.click("[data-login-wall] [data-line-login]"); await p.waitForTimeout(1500);
  ok(auth.some((u) => /provider=custom(%3A|:)line-test/.test(u)), "a tap asks Supabase to authorize provider custom:line-test (" + (auth[0] || "no request").slice(0, 110) + ")");
  ok(errs.length === 0, "app wall: no page errors" + (errs.length ? ": " + errs[0] : "")); await ctx.close();
}
{
  const { ctx, p, errs, base } = await page(appSrv.address().port, LINE_UA);
  await p.goto(base + "/?wall=signup", { waitUntil: "domcontentloaded" }); await p.waitForSelector("[data-login-wall]", { timeout: 30000 });
  const first = await p.evaluate(() => { const l = document.querySelector("[data-line-login]"), g = document.querySelector("[data-login-wall] button[data-wall-tab]"); const card = document.querySelector("[data-login-wall] [role=dialog]"); const btns = [...card.querySelectorAll("button")].filter((b) => !b.hasAttribute("data-wall-tab") && !b.hasAttribute("data-wall-close")); return btns[0] === l; });
  ok(first, "inside LINE's own browser the LINE button is the first button of the card (Google cannot work there)");
  ok(errs.length === 0, "app wall in LINE: no page errors"); await ctx.close();
}
{
  const { ctx, p, errs, base } = await page(appSrv.address().port);
  await p.goto(base + "/", { waitUntil: "domcontentloaded" }); await p.waitForSelector(".guestloginpill", { timeout: 30000 }); await p.waitForTimeout(800);
  await p.click(".guestloginpill"); await p.waitForTimeout(500);
  ok(await p.locator(".setov [data-line-login]").count() === 1 && (await p.locator(".setov .au-line").count()) === 1, "the corner log-in card (LoginOptions): the LINE button is drawn");
  ok(errs.length === 0, "corner card: no page errors"); await ctx.close();
}
{
  const { ctx, p, errs, auth, base } = await page(landSrv.address().port, LINE_UA);
  await p.goto(base + "/", { waitUntil: "load" }); await p.waitForTimeout(1500);
  await p.click(".lp-herocta .lp-btn.primary").catch(() => {}); await p.waitForTimeout(500);
  const stay = await p.$(".lp-escfull .lp-btn.ghost"); if (stay) { await stay.click(); await p.waitForTimeout(400); }
  ok(await p.locator(".lp-signup [data-line-login]").count() === 1, "landing sign-up card: the LINE button is drawn");
  const top = await p.evaluate(() => { const c = document.querySelector(".lp-signup"); const btns = [...c.querySelectorAll("button, input")]; return btns[0] && btns[0].hasAttribute("data-line-login"); });
  ok(top, "inside LINE it is the first control of the card");
  await p.click(".lp-signup [data-line-login]"); await p.waitForTimeout(1500);
  ok(auth.some((u) => /provider=custom(%3A|:)line-test/.test(u)), "landing: a tap asks Supabase to authorize custom:line-test");
  ok(errs.length === 0, "landing: no page errors" + (errs.length ? ": " + errs[0] : "")); await ctx.close();
}
await browser.close(); appSrv.close(); landSrv.close();
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
console.log(`\n${pass} passed, ${fails.length} failed`); if (fails.length) console.log("failed:\n - " + fails.join("\n - "));
process.exit(fails.length ? 1 : 0);
