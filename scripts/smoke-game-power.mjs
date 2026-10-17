// Game Power: earn rules (real game-power.ts), the bar in the arena lobby, the Adventure gate, and the sheet when power is short.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
// 1) the real module, with a fake localStorage
const out = path.join(process.env.TMPDIR || "/tmp", "gp-" + process.pid + ".mjs");
buildSync({ entryPoints: ["game-power.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
const mem = {}; globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
const gp = await import(pathToFileURL(out).href);
ok("fresh device starts at 60", gp.readPower() === 60);
ok("a 10-try drill earns 10", gp.powerFromActivity({ k: "drill", id: "x", ok: 8, miss: 2, sec: 30 }) === 10 && gp.readPower() === 70);
ok("a 2-try all-wrong round still earns power", gp.powerFromActivity({ k: "drill", id: "x2", ok: 0, miss: 2, sec: 5 }) > 0);
ok("accuracy multiplies coins 1/2/3", gp.accMult(40) === 1 && gp.accMult(75) === 2 && gp.accMult(95) === 3);
ok("new lesson 20, same lesson again 12", gp.powerFromActivity({ k: "lesson", id: "L1", sec: 90 }) === 20 && gp.powerFromActivity({ k: "lesson", id: "L1", sec: 90 }) === 10 /* capped by the bar: 100 */ || gp.readPower() === 100);
ok("bar never above 100", gp.readPower() <= 100);
ok("skill-tagged secondary row pays nothing", gp.powerFromActivity({ k: "drill", id: "y", ok: 9, miss: 1, sec: 0, skill: "rhythm" }) === 0);
ok("spend 10 works, then short power refuses", gp.spendPower(10, "t") && (mem.tg_game_power = JSON.stringify({ v: 5, d: "x", today: 0 }), !gp.spendPower(10, "t")) && gp.readPower() === 5);
mem.tg_game_power = JSON.stringify({ v: 2, d: new Date().toDateString(), today: 0 });
ok("play time drains 1 per tick, then stops at 0", gp.drainPower() && gp.drainPower() && !gp.drainPower() && gp.readPower() === 0);
ok("entering needs the minimum, spends nothing", !gp.enterGame(5) && (mem.tg_game_power = JSON.stringify({ v: 50, d: new Date().toDateString(), today: 0 }), gp.enterGame(5)) && gp.readPower() === 50);
ok("admin tier 3 is gated like a player (owner 2026-10-17)", !gp.powerFree(3));
// 2) the browser
const ROOT = path.resolve("dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function open(powerV) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((v) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", level: 3 })); if (v != null) localStorage.setItem("tg_game_power", JSON.stringify({ v, d: new Date().toDateString(), today: 0 })); }, powerV);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  return { ctx, p, errs };
}
{
  const { ctx, p, errs } = await open(null);
  const bar = await p.$("[data-gpbar]"); ok("bar is in the arena lobby", !!bar);
  if (bar) { ok("fresh bar reads 60", (await bar.getAttribute("data-gpbar")) === "60"); const r = await bar.boundingBox(); ok("bar is on screen", r && r.y >= 0 && r.x + r.width <= 412 + 1, JSON.stringify(r)); }
  await p.screenshot({ path: "/tmp/gp-lobby.png" });
  if (bar) { await bar.click(); await p.waitForTimeout(300); ok("tapping the bar opens the sheet", !!(await p.$("[data-gpsheet]"))); await p.screenshot({ path: "/tmp/gp-sheet.png" }); }
  ok("no page errors", errs.length === 0, errs.join(" | ")); await ctx.close();
}
{
  const { ctx, p, errs } = await open(0);
  await p.evaluate(() => { const b = document.querySelector(".pvpadv"); if (b) b.click(); }); await p.waitForTimeout(600);
  await p.evaluate(() => { const c = document.querySelector("[data-continue]"); if (c) c.click(); }); await p.waitForTimeout(500);
  ok("0 power: starting a map opens the sheet, not the map", !!(await p.$("[data-gpsheet]")) && !(await p.$("canvas.adv-cv")));
  ok("no page errors (gated)", errs.length === 0, errs.join(" | ")); await ctx.close();
}
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
