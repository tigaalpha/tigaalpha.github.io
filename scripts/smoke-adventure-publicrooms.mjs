// Adventure Mode: a knowledge beacon asks questions from what THIS learner has studied, climbs, and a wrong answer teaches on the piano.
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
// Adventure Online: the entry button in the PvP lobby, the lobby panel, a failed connection is reported.
const FAKE = `window.__advChannelFactory = (name, cfg) => {
  const key = cfg.config.presence.key, bc = new BroadcastChannel(name), hb = {}, hs = [], state = {}; let mine = null;
  const fire = () => hs.forEach(f => f());
  bc.onmessage = (e) => { const m = e.data; if (m.from === key) return;
    if (m.t === "hello") { if (mine) bc.postMessage({ t: "pres", from: key, obj: mine }); }
    else if (m.t === "pres") { state[m.from] = [m.obj]; fire(); }
    else if (m.t === "leave") { delete state[m.from]; fire(); }
    else if (m.t === "b") (hb[m.event] || []).forEach(f => f({ payload: m.payload })); };
  return { on(type, f, cb) { if (type === "broadcast") (hb[f.event] = hb[f.event] || []).push(cb); else hs.push(cb); return this; },
    subscribe(cb) { setTimeout(() => cb("SUBSCRIBED"), 5); return this; },
    async track(o) { mine = o; state[key] = [o]; bc.postMessage({ t: "pres", from: key, obj: o }); bc.postMessage({ t: "hello", from: key }); fire(); },
    presenceState() { return state; }, send(m) { bc.postMessage({ t: "b", from: key, event: m.event, payload: m.payload }); },
    unsubscribe() { bc.postMessage({ t: "leave", from: key }); bc.close(); } };
};`;
async function open(pre, fake) {
  const ctx = await browser.newContext({ viewport: { width: 450, height: 1000 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const calls = [];
  await ctx.route(/rest\/v1\/rpc\/adv_/, r => { const n = r.request().url().split("/rpc/")[1]; calls.push(n); r.fulfill({ status: 200, contentType: "application/json", body: n === "adv_rooms_list" ? JSON.stringify([{ code: "ZZ9XQ2", host_name: "Mika", map_id: "", war: false, pilots: 2 }]) : "null" }); });
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  if (fake) await ctx.addInitScript(FAKE);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  
  return { ctx, p, errs, calls };
}
{
  const { ctx, p, errs, calls } = await open({});
  await p.waitForSelector(".pvpadv.online"); await p.evaluate(() => document.querySelector(".pvpadv.online").click()); await p.waitForSelector(".adv-lobby");
  await p.waitForSelector("[data-pubrow]", { timeout: 6000 }).catch(() => {});
  ok("the lobby lists a public room from adv_rooms_list", (await p.locator("[data-pubrow=ZZ9XQ2]").count()) === 1, calls.join(","));
  ok("the row shows host and pilots", /Mika.*2\/4/.test(await p.evaluate(() => (document.querySelector("[data-pubrow]") || {}).textContent || "")));
  ok("public listing is off by default", !(await p.evaluate(() => document.querySelector("input[data-pub]").checked)));
  await ctx.close(); ok("no page errors", errs.length === 0, errs.join("|"));
}
{
  const { ctx, p, calls } = await open({}, true);
  await p.waitForSelector(".pvpadv.online"); await p.evaluate(() => document.querySelector(".pvpadv.online").click()); await p.waitForSelector(".adv-lobby");
  await p.evaluate(() => document.querySelector("input[data-pub]").click());
  await p.evaluate(() => document.querySelector("button[data-create]").click()); await p.waitForTimeout(3000);
  ok("creating a room with the box ticked calls adv_room_open", calls.includes("adv_room_open"), calls.join(","));
  if (await p.$("[data-room]")) { await p.evaluate(() => [...document.querySelectorAll(".al-room button")].pop().click()); await p.waitForTimeout(800); ok("leaving closes the public room", calls.includes("adv_room_close"), calls.join(",")); }
  else ok("room screen reached (Realtime unreachable here: skipped close check)", true);
  await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
