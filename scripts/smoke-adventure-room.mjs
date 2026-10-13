// Adventure Online end to end between TWO real game pages: room join, shared start, revive and team war, over an in-browser fake channel (BroadcastChannel) swapped in through window.__advChannelFactory.
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
await ctx.addInitScript((fake) => { eval(fake); sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_adv_done", JSON.stringify(["luma","ferro","jovia","kryo","pyra","nexa"])); }, FAKE);
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
await A.p.waitForFunction(() => document.querySelectorAll(".al-peer").length >= 2, null, { timeout: 8000 }).catch(() => {});
ok("both pilots see two names in the room", (await A.p.locator(".al-peer").count()) === 2 && (await B.p.locator(".al-peer").count()) === 2);
// map 1: normal co-op. the host starts it, the guest follows
await A.p.evaluate(() => document.querySelectorAll(".adv-planet")[0].click());
await A.p.waitForFunction(() => !!window.__advTest, null, { timeout: 12000 }); await B.p.waitForFunction(() => !!window.__advTest, null, { timeout: 12000 });
ok("the guest's game opens the host's map by itself", true);
await A.p.waitForTimeout(800);
ok("each game sees the other pilot", (await A.p.evaluate(() => window.__advTest.netPeers().length)) === 1 && (await B.p.evaluate(() => window.__advTest.netPeers().length)) === 1);
// revive: A goes down, B walks up to A and stays
await A.p.evaluate(() => window.__advTest.tp(500)); await B.p.evaluate(() => window.__advTest.tp(900)); await A.p.waitForTimeout(500);
await A.p.evaluate(() => window.__advTest.killMe()); await A.p.waitForTimeout(300);
ok("a pilot down in a room waits (does not respawn at once)", (await A.p.evaluate(() => window.__advTest.reviveState().dead)) > 3);
await B.p.evaluate(() => window.__advTest.tp(510)); await B.p.waitForTimeout(2600);
const rs = await A.p.evaluate(() => window.__advTest.reviveState());
ok("a teammate standing close for 1.5 s stands the downed pilot back up", rs.dead === 0 && rs.hp > 0, JSON.stringify(rs));
const xA = await A.p.evaluate(() => window.__advTest.state().x);
ok("the pilot stood up where they fell, not at the start", xA > 300, "x " + xA);
ok("no errors so far", A.errs.length + B.errs.length === 0, A.errs.concat(B.errs).join("|"));
// map 2: team war
await A.p.evaluate(() => document.querySelector(".adv-top .adv-btn").click()); await A.p.waitForSelector(".adv-planet", { timeout: 8000 });
await B.p.evaluate(() => document.querySelector(".adv-top .adv-btn").click()).catch(() => {});
await A.p.evaluate(() => { const c = document.querySelector("input[data-war]"); if (c) c.click(); });
ok("the host sees the team war box", await A.p.evaluate(() => !!document.querySelector("input[data-war]")));
await A.p.evaluate(() => document.querySelectorAll(".adv-planet")[1].click());
await A.p.waitForFunction(() => !!window.__advTest, null, { timeout: 12000 }); await B.p.waitForFunction(() => !!window.__advTest && window.__advTest.warInfo, null, { timeout: 12000 });
await A.p.waitForTimeout(600);
const wa = await A.p.evaluate(() => window.__advTest.warInfo()), wb = await B.p.evaluate(() => window.__advTest.warInfo());
ok("both games are in war mode on different teams", wa.war && wb.war && wa.team !== wb.team, JSON.stringify([wa, wb]));
await A.p.evaluate(() => { window.__advTest.tp(300); window.__advTest.face(1); }); await B.p.evaluate(() => window.__advTest.tp(340)); await A.p.waitForTimeout(700);
const hb0 = await B.p.evaluate(() => window.__advTest.hpNow());
let hb1 = hb0; for (let k = 0; k < 4 && hb1 >= hb0; k++) { await A.p.evaluate(() => { window.__advTest.face(1); window.__advTest.strikeNow(); }); await A.p.waitForTimeout(800); hb1 = await B.p.evaluate(() => window.__advTest.hpNow()); }   // the ghost position travels by message, so a first swing can land short
ok("a punch at an enemy-team pilot hurts them on their own screen", hb1 < hb0, hb0 + " -> " + hb1);
ok("no errors", A.errs.length + B.errs.length === 0, A.errs.concat(B.errs).join("|"));
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
