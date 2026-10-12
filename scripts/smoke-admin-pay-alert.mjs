// Adventure weapons (owner, 2026-10-12): weapons drop from monsters, are picked up and equipped, and each one fires in its own way.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
const ROOT = path.resolve("dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
// Payment alert for the top-tier admin (owner, 2026-10-12): a pending payment pops a card + chip; a lower tier sees nothing.
async function run(tier, rows) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: "application/json", body: /\/rest\/v1\/payments/.test(u) ? JSON.stringify(rows) : "[]" }); });
  await ctx.addInitScript((tr) => { localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "Owner", lang: "en", age: "adult", level: "beginner", exp: 5000, admin_tier: tr })); localStorage.setItem("tg_lang", "en"); localStorage.removeItem("tg_admin_pay_seen"); }, tier);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(4000);
  return { ctx, p, errs };
}
const ROW = [{ id: "p1", full_name: "Somchai", email: "s@x.com", plan: "premium", amount: 1490, created_at: new Date().toISOString(), status: "pending" }];
{ const { ctx, p, errs } = await run(3, ROW);
  ok("a tier-3 admin sees the chip with the number waiting", /1\s*to confirm/.test((await p.locator("[data-payal=chip]").first().textContent().catch(() => "")) || ""), await p.locator("[data-payal=chip]").count() + " chips");
  ok("and a pop-up card naming the customer, the plan and the amount", await p.evaluate(() => { const t = document.querySelector("[data-payal=toast]"); return !!t && /Somchai/.test(t.textContent) && /Premium/.test(t.textContent) && /1,490/.test(t.textContent); }));
  ok("it is remembered as seen (no repeat pop-up for the same payment)", JSON.parse(await p.evaluate(() => localStorage.getItem("tg_admin_pay_seen") || "[]")).includes("p1"));
  await p.locator("[data-payal=toast] .go").click(); await p.waitForTimeout(600);
  ok("Review slip jumps to the payments hash", (await p.evaluate(() => location.hash)) === "#admin-payments");
  ok("no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p } = await run(1, ROW); ok("a lower admin tier is not told", (await p.locator("[data-payal]").count()) === 0); await ctx.close(); }
{ const { ctx, p } = await run(3, []); ok("nothing pending: no chip", (await p.locator("[data-payal]").count()) === 0); await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
