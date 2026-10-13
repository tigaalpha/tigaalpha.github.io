// Adventure Online colony: two real pages share one city and hold different careers (fake in-browser channel).
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
const ctx = await browser.newContext({ viewport: { width: 900, height: 420 }, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript((fake) => { eval(fake); sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_sector","colony"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_adv_done", JSON.stringify(["luma","ferro","jovia","kryo","pyra","nexa"])); }, FAKE);
async function mkPage(name) {
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.addInitScript((n) => { localStorage.setItem("tg_guest_profile", JSON.stringify({ name: n, lang: "en", age: "adult", level: "beginner", exp: 5000 })); }, name);
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.waitForSelector(".pvpadv.online"); await p.evaluate(() => document.querySelector(".pvpadv.online").click()); await p.waitForSelector(".adv-lobby");
  return { p, errs };
}
const A = await mkPage("Ann"), B = await mkPage("Bob");
await A.p.evaluate(() => document.querySelector("button[data-create]").click()); await A.p.waitForSelector("[data-room]");
const code = await A.p.evaluate(() => document.querySelector("[data-room]").textContent.trim());
ok("the host got a 6-letter room code", /^[A-Z0-9]{6}$/.test(code), code);
await B.p.fill(".al-code", code); await B.p.evaluate(() => document.querySelector("button[data-join]").click());
await B.p.waitForFunction(() => document.querySelectorAll(".al-peer").length >= 2, null, { timeout: 8000 }).catch(() => {});
await A.p.evaluate(() => document.querySelector("[data-sector=colony]").click()); await A.p.waitForTimeout(300);
await A.p.evaluate(() => [...document.querySelectorAll(".adv-planet")].find(e => /Moon Colony/.test(e.textContent)).click());
await A.p.waitForSelector("[data-colony]", { timeout: 12000 }); await B.p.waitForSelector("[data-colony]", { timeout: 12000 });
ok("the guest follows the host into the colony", true);
await A.p.evaluate(() => { localStorage.setItem("tg_adv_career", ""); }); 
await A.p.click("[data-career=eng]"); await A.p.waitForTimeout(400);
ok("the other pilot cannot take the same career", await B.p.evaluate(() => document.querySelector("[data-career=eng]").disabled));
await B.p.click("[data-career=farm]"); await B.p.waitForTimeout(300);
ok("both see a team strip", (await A.p.locator("[data-team]").count()) === 1);
await A.p.evaluate(() => window.__advColony.give("ma", 500));
const cell = await A.p.evaluate(() => window.__advColony.state().grid.findIndex(b => !b));
await A.p.click("[data-build=solar]"); await A.p.click(`[data-cell="${cell}"]`); await B.p.waitForTimeout(500);
ok("a building placed by one pilot appears on the other screen", (await B.p.evaluate((i) => window.__advColony.state().grid[i], cell)) === "solar");
await B.p.click(`[data-cell="${cell}"]`); await A.p.waitForTimeout(500);
ok("a demolition by the other pilot removes it for both", (await A.p.evaluate((i) => window.__advColony.state().grid[i], cell)) === null);
ok("no page errors", A.errs.length + B.errs.length === 0, JSON.stringify([...A.errs, ...B.errs]));
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
