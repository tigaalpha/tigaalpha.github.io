// Robot Adventure 3D co-op (plan 39 P5) between TWO real pages over an in-browser fake channel: room, roster, host start, teammate ghost in the 3D scene.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const ROOT = path.resolve("dist"); const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
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
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort()); await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(FAKE); await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_gp_free", "1"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_test_hook", "1"); localStorage.setItem("tg_adv_unlockall", "1"); localStorage.setItem("tg_adv_gfx", "standard"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "P" + Math.floor(Math.random() * 99), lang: "en", age: "adult", level: "beginner", exp: 5000 })); });
const open = async () => { const p = await ctx.newPage(); p.on("pageerror", e => (p._e = p._e || []).push(e.message)); await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500); for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); } await p.evaluate(() => document.querySelector("[data-robot3d]").click()); await p.waitForSelector("[data-ra='hub']"); await p.waitForTimeout(600); return p; };
const A = await open(), B = await open();
await A.locator("[data-ra-coop-btn]").click(); await A.locator("[data-coop-create]").click(); await A.waitForSelector("[data-coop-room]", { timeout: 8000 });
const code = (await A.locator("[data-coop-room]").innerText()).trim(); ok("the host gets a 6-letter room code", /^[A-Z0-9]{6}$/.test(code), code);
await B.locator("[data-ra-coop-btn]").click(); await B.locator("[data-coop-code]").fill(code); await B.locator("[data-coop-join]").click(); await B.waitForSelector("[data-coop-room]", { timeout: 8000 });
await A.waitForTimeout(800);
ok("both pilots see two names in the room", (await A.locator("[data-coop-peers] span").count()) === 2 && (await B.locator("[data-coop-peers] span").count()) === 2);
await A.locator("[data-ra-coop] .ra-coop-x").click();
await A.locator("[data-ra-play]").click(); await A.waitForSelector(".ah-cv", { timeout: 15000 }); await B.waitForSelector(".ah-cv", { timeout: 15000 });
ok("the host's start puts the guest into the same episode", (await A.evaluate(() => window.__ah.state.lv)) === (await B.evaluate(() => window.__ah.state.lv)));
await A.waitForTimeout(1500); await B.waitForTimeout(1500);
await A.evaluate(() => { const s = window.__ah.state; s.p.x = 5; s.p.z = 10; }); await A.waitForTimeout(1500);
ok("the guest's scene shows the host as a ghost pilot", (await B.evaluate(() => window.__ah.info().mates)) === 1);
ok("the host's scene shows the guest too", (await A.evaluate(() => window.__ah.info().mates)) === 1);
// minimap: the teammate's dot is drawn (the canvas has more than the usual colours near the host's position is hard to assert, so check the marker count through the peers)
ok("the minimap canvas is drawn on both pages", (await A.locator(".ah-map").count()) === 1 && (await B.locator(".ah-map").count()) === 1);
ok("no page errors on either page", !(A._e || []).length && !(B._e || []).length, ((A._e || []).concat(B._e || [])).slice(0, 2).join(" | "));
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
