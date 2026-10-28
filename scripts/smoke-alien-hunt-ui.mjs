// Alien Hunt in the real built app (plan 38): lobby button, ready screen, 3D scene, shooting, the 15 s tune-up freeze + question card, results.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
const ROOT = path.resolve("dist"); const SHOT = process.env.SHOT || "";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_gfx", "high"); localStorage.setItem("tg_gp_free", "1"); localStorage.setItem("tg_path_done", JSON.stringify(["scale", "interval", "triad", "seventh"])); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200))); p.on("console", m => { if (m.type() === "error") errs.push("console:" + m.text().slice(0, 160)); });
await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
ok("the lobby has the Alien Hunt button", (await p.locator("[data-alien-hunt]").count()) === 1);
await p.evaluate(() => { const AC = window.AudioContext; window.__peak = 0; const orig = AudioContext.prototype.createDynamicsCompressor; AudioContext.prototype.createDynamicsCompressor = function () { const n = orig.call(this); const an = this.createAnalyser(); an.fftSize = 1024; n.connect(an); window.__an = an; return n; }; });
await p.evaluate(() => document.querySelector("[data-alien-hunt]").click()); await p.waitForSelector("[data-ah=ready]", { timeout: 8000 });
ok("ready screen shows", (await p.locator("[data-start]").count()) === 1);
ok("ready screen says which learned topics the questions come from", (await p.evaluate(() => document.querySelector("[data-learned]").getAttribute("data-learned"))) === "4");
await p.evaluate(() => document.querySelector("[data-start]").click()); await p.waitForSelector(".ah-cv", { timeout: 8000 }); await p.waitForTimeout(1500);
ok("a WebGL canvas is drawing", (await p.evaluate(() => { const c = document.querySelector(".ah-cv"); return !!c && c.width > 100; })));
for (let i = 0; i < 25; i++) { await p.evaluate(() => window.__ah.step(20)); }
await p.waitForTimeout(500); const st = await p.evaluate(() => ({ wave: window.__ah.state.wave, n: window.__ah.state.enemies.length, info: window.__ah.info() }));
ok("wave 1 started with aliens in the scene", st.wave >= 1 && st.n > 0 && st.info.rigs > 0, JSON.stringify(st));
await p.evaluate(() => { const s = window.__ah.state; s.p.hp = 100; const e = s.enemies.find(x => x.dead === 0); e.x = s.p.x + 3; e.z = s.p.z - 6; s.p.yaw = Math.atan2(-(e.x - s.p.x), -(e.z - s.p.z)); s.p.pitch = 0; });
await p.waitForTimeout(400); if (SHOT) await p.screenshot({ path: SHOT + "-fight.png" });
// shoot through the real fire button
await p.evaluate(() => window.__ah.state.p.hp = 100);
const sh0 = await p.evaluate(() => window.__ah.state.shots);
const fb = await p.locator("[data-fire]").boundingBox(); await p.touchscreen.tap(fb.x + 20, fb.y + 20).catch(() => {}); await p.evaluate(() => { document.querySelector("[data-fire]").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 5 })); }); await p.waitForTimeout(500); await p.evaluate(() => document.querySelector("[data-fire]").dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 5 })));
ok("the FIRE button shoots", (await p.evaluate(() => window.__ah.state.shots)) > sh0);
await p.waitForTimeout(1500);
const lvl = async () => p.evaluate(() => { const an = window.__an; if (!an) return -1; const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); return Math.max(...d.map(Math.abs)); });
let pk = 0; for (let i = 0; i < 20; i++) { pk = Math.max(pk, await lvl()); await p.waitForTimeout(100); }
ok("the battle tune is audible and not clipping (peak " + pk.toFixed(3) + ")", pk > 0.02 && pk < 1.0);
ok("a slide button and the weapon chips are on screen", (await p.locator("[data-slide]").count()) === 1 && (await p.locator("[data-wpn]").count()) >= 1);
{ const z0 = await p.evaluate(() => window.__ah.state.p.slideCd); await p.evaluate(() => { document.querySelector("[data-slide]").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7 })); }); await p.waitForTimeout(300); await p.evaluate(() => document.querySelector("[data-slide]").dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7 })));
  ok("the SLIDE button slides", (await p.evaluate(() => window.__ah.state.p.slideCd)) > 0.3); }
{ await p.evaluate(() => { const s = window.__ah.state; s.enemies.length = 0; s.p.hp = 100; window.__ah.__def = window.__ah.state.auto; });
  ok("auto-walk is OFF by default", (await p.evaluate(() => window.__ah.__def)) === false);
  await p.evaluate(() => { window.__ah.state.auto = true; }); await p.waitForTimeout(400); ok("auto-walk can be turned on", (await p.evaluate(() => window.__ah.state.auto)) === true);
  await p.evaluate(() => { const s = window.__ah.state; s.wave = 1; s.between = 99; s.enemies.push({ id: 880, kind: "mantis", x: s.p.x + 3, z: s.p.z - 5, hp: 1e6, max: 1e6, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 }); window.__ah.__p0 = [s.p.x, s.p.z]; }); await p.waitForTimeout(1500);
  ok("with auto-walk on, the player moves with no stick", (await p.evaluate(() => { const s = window.__ah.state; return Math.hypot(s.p.x - window.__ah.__p0[0], s.p.z - window.__ah.__p0[1]); })) > 1);
  await p.evaluate(() => { const s = window.__ah.state; s.auto = false; s.enemies.length = 0; }); }
await p.evaluate(() => { const s = window.__ah.state; s.pk.push({ id: 777, x: s.p.x, z: s.p.z, w: "rail" }); }); await p.waitForTimeout(400);
ok("picking up a gun adds a chip and equips it", (await p.locator("[data-wpn=rail]").count()) === 1 && (await p.evaluate(() => window.__ah.state.weapon)) === "rail");
for (const k of ["skitter", "mantis", "spitter", "flarecaster", "charger", "skyeye"]) { let pk2 = 0; await p.evaluate(([k]) => window.__ah.creature(k, "spawn"), [k]); for (let i = 0; i < 12; i++) { pk2 = Math.max(pk2, await lvl()); await p.waitForTimeout(60); } ok("the " + k + " has a voice (peak " + pk2.toFixed(2) + ")", pk2 > 0.02 && pk2 < 1.0); }
// launcher
await p.evaluate(() => { const s = window.__ah.state; s.weapon = "launcher"; s.cd = 0; s.p.inv = 5; });
const b0 = await p.evaluate(() => (window.__boom = 0, window.__ah.state.rk.length));
await p.evaluate(() => { document.querySelector("[data-fire]").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 6 })); }); await p.waitForTimeout(300); await p.evaluate(() => document.querySelector("[data-fire]").dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 6 })));
await p.waitForTimeout(1500); ok("the plasma launcher fired (ammo used)", (await p.evaluate(() => window.__ah.state.ammo.launcher.mag)) < 4);
// the tune-up
await p.evaluate(() => { const s = window.__ah.state; s.wave = Math.max(1, s.wave); s.between = 99; s.p.hp = 100; if (!s.enemies.some(e => e.dead === 0)) s.enemies.push({ id: 990, kind: "mantis", x: s.p.x + 12, z: s.p.z - 12, hp: 1e6, max: 1e6, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 }); window.__ah.tune(); }); await p.evaluate(() => window.__ah.step(2));
await p.waitForSelector("[data-tuneup]", { timeout: 4000 });
ok("the game froze for a question", await p.evaluate(() => window.__ah.state.frozen));
ok("HANDS OFF gate first", (await p.locator("[data-ready]").count()) === 1);
await p.waitForFunction(() => { const b = document.querySelector("[data-ready]"); return b && !b.disabled; }, null, { timeout: 8000 }); await p.evaluate(() => document.querySelector("[data-ready]").click()); await p.waitForSelector("[data-q]", { timeout: 5000 }).catch(async () => { console.log("ERRS", errs.join("|"), await p.evaluate(() => document.querySelector("[data-tuneup]")?.innerText)); });
const qtxt = await p.evaluate(() => document.querySelector("[data-q]").textContent); ok("the question card shows a two-octave keyboard (24 keys) when keys are asked", (await p.evaluate(() => { const k = document.querySelectorAll("[data-piano] [data-k]").length; return k === 0 || k === 24; })));
ok("the question card has a five-line staff when keys are asked", (await p.evaluate(() => !document.querySelector("[data-piano]") || (!!document.querySelector("[data-staff]") && document.querySelectorAll("[data-staff] line").length >= 5))));
ok("a music question is asked: " + qtxt.slice(0, 50), qtxt.length > 5);
const pos0 = await p.evaluate(() => JSON.stringify(window.__ah.state.enemies.map(e => [e.x, e.z])));
if (SHOT) await p.screenshot({ path: SHOT + "-quiz.png" });
await p.waitForTimeout(600); ok("aliens do not move while the card is open", pos0 === await p.evaluate(() => JSON.stringify(window.__ah.state.enemies.map(e => [e.x, e.z]))));
const isChoice = await p.locator("[data-opt]").count();
if (isChoice) await p.evaluate(() => document.querySelector("[data-opt=ok]").click()); else { await p.evaluate(() => { const q = window.__ah.quizQ(); }); await p.evaluate(() => document.querySelector("[data-skip]").click()); }
if (isChoice) { await p.waitForSelector("[data-verdict=good]"); ok("a right answer shows the reward verdict", true); await p.evaluate(() => document.querySelector("[data-continue]").click()); ok("a right answer gives the shield", (await p.evaluate(() => window.__ah.state.p.shield)) >= 25); }
await p.waitForTimeout(300); ok("the fight resumes (unfrozen, with a grace)", await p.evaluate(() => !window.__ah.state.frozen && window.__ah.state.grace > 0));
// pause
await p.evaluate(() => document.querySelector("[data-pause-btn]").click()); await p.waitForSelector("[data-pause]"); const t0 = await p.evaluate(() => window.__ah.state.t); await p.waitForTimeout(500);
ok("pause stops the simulation", Math.abs((await p.evaluate(() => window.__ah.state.t)) - t0) < 0.02);
await p.evaluate(() => document.querySelector("[data-resume]").click());
// win the game fast
await p.evaluate(() => { const s = window.__ah.state; s.wave = 5; s.spawnQ = []; s.waveLeft = 0; window.__ah.killAll(); s.between = 0; s.tuneEvery = 0; });
await p.evaluate(() => window.__ah.step(200)); await p.waitForSelector("[data-result]", { timeout: 6000 });
ok("results screen after the last wave", (await p.locator("[data-result]").count()) === 1);
ok("no page errors", errs.length === 0, errs.join(" | ")); console.log(fail ? fail + " FAILED" : "all passed");
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
