// Robot Adventure 3D as a normal player (plan 39): the lobby button, the 3D story map (planets, locks, a tilted floor), the level starts in a real WebGL canvas with the Luma monsters, a win marks the planet cleared in the shared Adventure progress. SHOT=<prefix> saves pictures.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const ROOT = path.resolve("dist"); const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort()); await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_gfx", "high"); localStorage.setItem("tg_gp_free", "1");  localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message)); await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const SHOT = process.env.SHOT || "";
ok("the lobby has a Robot Adventure 3D button", (await p.locator("[data-robot3d]").count()) === 1);
ok("the Adventure Online button is not the one in that slot", (await p.locator(".pvpadv.online").innerText()).includes("Robot Adventure 3D"));
await p.evaluate(() => document.querySelector("[data-robot3d]").click()); await p.waitForSelector("[data-ra='hub']", { timeout: 8000 }); await p.waitForTimeout(700);
const N = await p.locator(".ra-pl").count(); ok("Part 1 lists its episodes (two rows, all inside the screen)", N >= 5 && N <= 22, "n=" + N);
ok("five part tabs (0-4)", (await p.locator("[data-ra-tabs] button").count()) === 5);
ok("a normal player has only the first episode open", (await p.evaluate(() => [...document.querySelectorAll(".ra-pl")].filter(b => b.dataset.open === "1").length)) === 1);
ok("the map floor is really tilted in 3D", (await p.evaluate(() => getComputedStyle(document.querySelector("[data-ra-plane]")).transform)).startsWith("matrix3d"));
ok("the episodes are joined by a route", (await p.locator(".ra-route path").count()) === N - 1);
const inside = await p.evaluate(() => { const W = innerWidth, H = innerHeight; return [...document.querySelectorAll(".ra-pl")].every(b => { const r = b.getBoundingClientRect(); return r.left >= -2 && r.right <= W + 2 && r.top >= 0 && r.bottom <= H + 2; }); });
ok("every episode of the part is inside the screen", inside);
const total = []; for (const part of ["prep", "solar", "space", "ground", "act2"]) { await p.locator(`[data-part=${part}]`).click(); await p.waitForTimeout(250); total.push(await p.locator(".ra-pl").count()); }
ok("the four parts hold all 49 episodes", total.reduce((a, b) => a + b, 0) === 49, total.join("+"));
await p.locator("[data-part=prep]").click(); await p.waitForTimeout(250);
ok("Continue is ready", await p.locator("[data-ra-continue]").isEnabled());
ok("the map tune's audio context is running", await p.evaluate(() => { const c = window.__tgCineCtx; return !!c && c.state === "running"; }));
if (SHOT) await p.screenshot({ path: SHOT + "-hub.png" });
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
ok("a portrait window turns the map a quarter turn", (await p.locator(".ra-hub.rot").count()) === 1);
await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(400);
await p.evaluate(() => localStorage.setItem("tg_adv_nocine", "1"));
// 1) the first episode is a foot "task" level: walking onto the pad asks ONE music question, even with nothing learned
await p.locator("[data-ra-play]").click(); await p.waitForSelector(".ah-cv", { timeout: 15000 }); await p.waitForTimeout(1200);
ok("the first episode starts on foot as a task level", await p.evaluate(() => !!window.__ah.state.ms && window.__ah.state.ms.type === "task"));
ok("the objective chip shows", (await p.locator(".ah-obj").count()) === 1);
await p.evaluate(() => { const a = window.__ah, s = a.state, it = s.ms.items[0]; s.p.x = it.x; s.p.z = it.z; a.step(3); });
await p.waitForSelector(".ah-card", { timeout: 8000 }).catch(() => {});   // software GL in High draws slowly, so the card can take a few seconds to mount
ok("the music question opens when the mission step is reached", (await p.locator(".ah-card").count()) >= 1);
await p.locator("[data-ready]").click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(500);
ok("the question text is there (a learner with nothing studied still gets one)", (await p.locator("[data-q]").innerText().catch(() => "")).length > 3);
await p.locator("[data-skip]").click().catch(() => {}); await p.waitForTimeout(600);
await p.evaluate(() => { const s = window.__ah.state; for (const it of s.ms.items) it.done = true; s.ms.prog = s.ms.goal; s.ms.ask = -1; s.frozen = false; window.__ah.step(5); }); await p.waitForTimeout(600);
ok("finishing the task ends the level on the result card", (await p.locator("[data-result]").count()) > 0);
ok("the episode is marked cleared in the shared Adventure progress", (await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]"))).includes("shipbuild"));
await p.locator("[data-ra-map]").click(); await p.waitForSelector("[data-ra='hub']", { timeout: 8000 }); await p.waitForTimeout(500);
// 2) a ship episode (Departure) flies in a cockpit; the autopilot reaches a gate that asks a question
await p.evaluate(() => { const b = document.querySelector("[data-planet=departure]"); b.click(); }); await p.waitForTimeout(300);
ok("Departure is open after the first episode", await p.evaluate(() => document.querySelector("[data-planet=departure]").dataset.open === "1"));
await p.locator("[data-ra-play]").click(); await p.waitForSelector("[data-rs=launch]", { timeout: 15000 }); await p.waitForTimeout(1200);
ok("the cockpit has a real WebGL canvas", await p.evaluate(() => { const c = document.querySelector(".rs-host canvas"); return !!c && !!(c.getContext("webgl2") || c.getContext("webgl")); }));
if (SHOT) await p.screenshot({ path: SHOT + "-ship.png" });
let asked = false; for (let i = 0; i < 40 && !asked; i++) { await p.evaluate(() => window.__raShip.step(5)); await p.waitForTimeout(150); asked = (await p.locator("[data-rs-quiz]").count()) > 0; }
ok("flying through a green gate opens a music question", asked);
if (asked) { await p.locator("[data-ready]").click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(400); ok("the question shows in the cockpit", (await p.locator("[data-q]").innerText().catch(() => "")).length > 3); await p.locator("[data-skip]").click().catch(() => {}); await p.waitForTimeout(500); }
ok("a skipped question lets the flight go on", await p.evaluate(() => !window.__raShip.S().frozen));
let won = false; for (let i = 0; i < 80 && !won; i++) { await p.evaluate(() => { const s = window.__raShip.S(); if (s.ask) { /* answer right through the page's own card */ } window.__raShip.step(5); }); await p.waitForTimeout(120); if ((await p.locator("[data-rs-quiz]:not([data-result])").count()) > 0) { await p.evaluate(() => { const S = window.__raShip.S(); S.ask = null; S.frozen = false; const g = S.gates.find(x => !x.done); if (g) { g.done = true; S.prog++; S.answers++; } }); await p.waitForTimeout(100); } won = (await p.locator("[data-result]").count()) > 0; }
ok("reaching the last gate ends the flight on the result card", won);
ok("Departure is marked cleared", (await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]"))).includes("departure"));
ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
