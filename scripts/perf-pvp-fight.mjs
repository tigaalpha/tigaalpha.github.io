#!/usr/bin/env node
/* perf-pvp-fight.mjs — how smooth is a PvP fight? Drives the BUILT app (dist/) in headless Chromium, starts a real fight from the Games lobby, and for each configuration
   samples requestAnimationFrame for a few seconds while the player taps FIRE, under an optional CPU slowdown (CDP Emulation.setCPUThrottlingRate, how a phone is simulated).
   Prints one row per configuration: frames per second, frame-time p50 / p95 / p99, janky frames (> 50 ms), long tasks (> 50 ms) and their total, DOM / SVG node counts, and
   whether a WebGL canvas is running. Compare rows from the same machine and the same run: the absolute numbers are NOT a phone (software GL, a server CPU); the DIFFERENCES
   between configurations are what this is for.
     node scripts/perf-pvp-fight.mjs [--root dist] [--secs 8] [--throttle 1,4] [--vp 800x420] [--touch 1] [--cfg name=k:v,k:v;name2=...] [--shot PREFIX]
   --cfg sets localStorage keys before the page loads, one named configuration per ';' (default: "default=" with nothing set), e.g.
     --cfg "default=;lite=tg_pvp_gfx:low;tier0=tg_3d_tier:0;tier3=tg_3d_tier:3"
   --touch 0 uses a mouse-and-keyboard desktop profile (the shape of a strong device); 1 (default) a phone (hasTouch, isMobile, pointer: coarse). */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith("--") ? [...a, [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "1"]] : a), []));
const ROOT = path.resolve(A.root || "dist"), SECS = +(A.secs || 8), THR = String(A.throttle || "1,4").split(",").map(Number), TOUCH = A.touch !== "0";
const [VW, VH] = String(A.vp || (TOUCH ? "800x420" : "1280x720")).split("x").map(Number);
const CFGS = String(A.cfg || "default=").split(";").filter(Boolean).map(s => { const [n, kv = ""] = s.split("="); return { name: n, kv: Object.fromEntries(kv.split(",").filter(Boolean).map(p => p.split(":"))) }; });
const pwm = await import("playwright").catch(async () => import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href)); const pw = pwm.chromium ? pwm : pwm.default;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".mp3": "audio/mpeg", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; let f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, "index.html"); res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = [];
for (const cfg of CFGS) for (const thr of THR) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, isMobile: TOUCH, hasTouch: TOUCH, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((kv) => {
    sessionStorage.setItem("tiga_page", "pvp");
    localStorage.setItem("tg_test_hook", "1"); localStorage.setItem("tg_gp_free", "1"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_lang", "en");
    localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 }));
    for (const k in kv) localStorage.setItem(k, kv[k]);
  }, cfg.kv);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  const cdp = await ctx.newCDPSession(p); if (thr > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: thr });
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => { const b = document.querySelector(".pvpgo-hero") && getComputedStyle(document.querySelector(".pvpgo-hero")).display !== "none" ? document.querySelector(".pvpgo-hero") : document.querySelector(".pvpgo"); if (b) b.click(); });
  let inFight = true; await p.waitForSelector(".pvppage.fight", { timeout: 30000 }).catch(() => { inFight = false; });
  if (!inFight) { rows.push({ cfg: cfg.name, thr, err: "never reached the fight", errs }); await ctx.close(); continue; }
  await p.waitForTimeout(7000 * Math.min(2, thr / 2 + 0.5));   // the round intro (it runs in game time, a throttled CPU is slower to finish it)
  await p.evaluate(() => {
    const d = []; let last = performance.now(), on = true;
    const tick = (t) => { if (!on) return; d.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => lt.push(e.duration))).observe({ entryTypes: ["longtask"] }); } catch (e) {}
    window.__perf = { d, lt, stop() { on = false; } };
  });
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < SECS * 1000) {
    await p.evaluate((k) => { const f = document.querySelector(".pvpact.fire"); if (f) f.dispatchEvent(new PointerEvent(k ? "pointerdown" : "pointerup", { bubbles: true, pointerId: 7 })); else document.dispatchEvent(new KeyboardEvent(k ? "keydown" : "keyup", { key: "j", bubbles: true })); }, n++ % 2 === 0);
    await p.waitForTimeout(450);
  }
  const r = await p.evaluate(() => {
    window.__perf.stop(); const d = window.__perf.d.slice(2).sort((a, b) => a - b), lt = window.__perf.lt, q = (x) => d.length ? d[Math.min(d.length - 1, Math.floor(d.length * x))] : 0, sum = d.reduce((a, b) => a + b, 0);
    const gl = [...document.querySelectorAll("canvas")].some(c => { try { return !!(c.getContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; } });
    return { frames: d.length, fps: d.length ? +(1000 * d.length / sum).toFixed(1) : 0, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), jank: d.filter(x => x > 50).length, longTasks: lt.length, longMs: Math.round(lt.reduce((a, b) => a + b, 0)),
      dom: document.querySelectorAll("*").length, svg: document.querySelectorAll("svg *").length, canvases: document.querySelectorAll("canvas").length, gl, cls: (document.querySelector(".pvppage") || {}).className || "" };
  });
  if (A.shot) await p.screenshot({ path: `${A.shot}-${cfg.name}-x${thr}.png` });
  rows.push({ cfg: cfg.name, thr, ...r, errs: [...new Set(errs)].slice(0, 2) }); await ctx.close();
}
await browser.close(); server.close();
const pad = (v, n) => String(v).padEnd(n);
console.log(`\nPvP fight smoothness — ${TOUCH ? "phone" : "desktop"} ${VW}x${VH}, ${SECS} s per row, root ${ROOT}`);
console.log(pad("config", 14) + pad("cpu", 5) + pad("fps", 7) + pad("p50", 7) + pad("p95", 7) + pad("p99", 8) + pad("jank", 6) + pad("longTasks", 11) + pad("dom", 7) + pad("svg", 7) + pad("cvs", 5) + "gl");
for (const r of rows) console.log(r.err ? `${pad(r.cfg, 14)}${pad(r.thr + "x", 5)}${r.err}` : pad(r.cfg, 14) + pad(r.thr + "x", 5) + pad(r.fps, 7) + pad(r.p50, 7) + pad(r.p95, 7) + pad(r.p99, 8) + pad(r.jank, 6) + pad(r.longTasks + "/" + r.longMs + "ms", 11) + pad(r.dom, 7) + pad(r.svg, 7) + pad(r.canvases, 5) + r.gl + (r.errs.length ? "  ERR " + r.errs.join("|") : ""));
console.log("classes: " + [...new Set(rows.filter(r => r.cls).map(r => r.cfg + ": " + r.cls))].join(" || "));
process.exit(0);
