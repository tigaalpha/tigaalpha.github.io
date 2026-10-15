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
// Adventure cinematics: a film before every map (CG, subtitles, score, sound effects), skippable; the objective card; the audio renders.
async function open(pre0) {
  const pre = Object.assign({ tg_adv_prologue: "skip", tg_adv_unlockall: "1" }, pre0);   // "skip": no opening film, and the map films stay long
  const wantPro = pre0 && pre0.tg_adv_prologue === "__none__"; if (wantPro) delete pre.tg_adv_prologue;
  const wantFin = pre0 && pre0.__fin; delete pre.__fin;
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en");  localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(wantPro || wantFin ? ".adv-cine" : ".adv-planet");
  return { ctx, p, errs };
}


const sub = (a, b) => { let j = 0; for (const x of b) if (x === a[j]) j++; return j === a.length; };
const D = (...ids) => ({ tg_adv_done: JSON.stringify(ids) });
const ALLD = D("luma", "ferro", "kryo", "pyra");
async function pick(pre, idx, lang) { const o = await open(Object.assign({}, pre, lang ? { tg_lang: lang, tg_guest_profile: JSON.stringify({ name: "T", lang, age: "adult", level: "beginner", exp: 5000 }) } : {})); await o.p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await o.p.waitForSelector(".adv-cine canvas", { timeout: 8000 }); await o.p.waitForTimeout(500); return o; }
const painted = (p) => p.evaluate(() => { const c = document.querySelector(".adv-cine canvas"); const t = document.createElement("canvas"); t.width = 48; t.height = 27; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 48, 27); const d = x.getImageData(0, 0, 48, 27).data; let mn = 255, mx = 0, s = 0; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; mn = Math.min(mn, v); mx = Math.max(mx, v); s += v; } return { range: mx - mn, mean: s / (d.length / 4) }; });
for (const [name, idx, expectKinds] of [["luma", 0, ["earth", "factory", "launch", "approach", "descent", "landing", "crew", "surface", "warning", "lore", "boss", "objective"]], ["cobalt", 6, ["earth", "factory", "launch", "approach", "survey", "descent", "landing", "work", "storm", "signal", "lore", "dawn", "objective"]], ["ashfall", 9, ["earth", "factory", "launch", "approach", "descent", "landing", "crew", "strike", "warning", "lore", "boss", "objective"]]]) {
  const o = await pick(ALLD.tg_adv_done ? Object.assign({}, ALLD) : {}, idx);
  ok(name + ": a film plays before the map", await o.p.locator(".adv-cine").count() > 0);
  const kinds = await o.p.evaluate(() => window.__advCine.kinds()); const inOrder = (a, b) => { let j = 0; for (const k of b) if (k === a[j]) j++; return j === a.length; };   // the original beats stay in their order; the film now also has the extra story shots between them
  ok(name + ": the shots run earth > factory > launch > then this map's own sequence (landing / harvest / ship) > objective, 20 to 30 of them", inOrder(expectKinds, kinds) && kinds.length >= 20 && kinds.length <= 30 && kinds[kinds.length - 1] === "objective", kinds.length + ": " + kinds.join());
  let caps = []; const blank = [];
  for (let i = 0; i < kinds.length; i++) { await o.p.evaluate((n) => window.__advCine.jump(n), i); await o.p.waitForTimeout(700); const px = await painted(o.p); if (px.range < 25) blank.push(kinds[i] + ":" + px.range.toFixed(0)); const c = await o.p.locator(".ac-cap").first().innerText().catch(() => ""); caps.push(c);
    if (process.env.SHOT && i >= 3) await o.p.screenshot({ path: process.env.SHOT + "-" + name + "-" + kinds[i] + ".png" }); }
  ok(name + ": every shot is painted (not a blank frame)", blank.length === 0, blank.join());
  ok(name + ": each story shot has its own subtitle", caps.slice(0, -1).every(c => c.length > 20) && new Set(caps).size >= caps.length - 1, caps.map(c => c.slice(0, 28)).join(" | "));
  ok(name + ": the objective card shows the robot and three goals", (await o.p.locator(".ac-hero svg").count()) >= 1 && (await o.p.locator(".ac-goal li").count()) === 3);
  await o.p.locator(".ac-goal .go").click(); await o.p.waitForTimeout(1500);
  ok(name + ": START begins the map (or Ashfall's orbital strike)", name === "ashfall" ? (await o.p.locator(".adv-strike").count()) === 1 : (await o.p.evaluate(() => !!window.__advTest)));
  ok(name + " no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close();
}
{ const o = await pick({}, 0, "th"); await o.p.evaluate(() => window.__advCine.jump(1)); await o.p.waitForTimeout(600); const c = await o.p.locator(".ac-cap").first().innerText(); ok("subtitles follow the language (Thai)", /หุ่นยนต์/.test(c), c); await o.ctx.close(); }
{ const o = await pick({}, 0, "zh"); await o.p.evaluate(() => window.__advCine.jump(1)); await o.p.waitForTimeout(600); const c = await o.p.locator(".ac-cap").first().innerText(); ok("subtitles follow the language (Chinese)", /机器人/.test(c), c); await o.ctx.close(); }
{ const o = await pick({}, 0); await o.p.locator(".ac-skip").click(); await o.p.waitForTimeout(1200); ok("Skip goes straight into the map", await o.p.evaluate(() => !!window.__advTest)); ok("the film is gone", (await o.p.locator(".adv-cine").count()) === 0); await o.ctx.close(); }
{ const o = await pick({}, 0); const t1 = await o.p.evaluate(() => window.__advCine.shot()); await o.p.locator(".adv-cine").click({ position: { x: 300, y: 200 } }); await o.p.waitForTimeout(500); const t2 = await o.p.evaluate(() => window.__advCine.shot()); ok("a tap moves on to the next shot", t2 === t1 + 1, t1 + " -> " + t2); await o.ctx.close(); }
{ const o = await open({ tg_adv_nocine: "1" }); await o.p.evaluate(() => document.querySelector(".adv-planet").click()); await o.p.waitForSelector(".adv canvas"); await o.p.waitForTimeout(600); ok("with 'skip the film' ticked the map starts at once", (await o.p.locator(".adv-cine").count()) === 0 && (await o.p.evaluate(() => !!window.__advTest))); await o.ctx.close(); }
{ const o = await open({}); ok("the menu has a 'skip the film' tick box", (await o.p.locator(".adv-nocine input").count()) === 1); await o.ctx.close(); }
{ const o = await pick(ALLD, 0);
  const maps = [["luma", "jungle", true], ["ferro", "x", true], ["jovia", "survival", false], ["kryo", "x", true], ["pyra", "x", true], ["nexa", "x", true], ["cobalt", "mine", false], ["helios", "capture", false], ["ashfall", "strike", true]];
  for (const [id, mission, boss] of maps) { const r = await o.p.evaluate(([a, m, b]) => window.__advCine.render(a, m, b, 9), [id, mission, boss]); ok("score " + id + ": rich, audible, finite, not clipping", r.peak <= 0.98 && r.peak > 0.02 && r.rms > 0.004 && r.bad === 0 && r.events > 60, "peak " + r.peak.toFixed(2) + " rms " + r.rms.toFixed(3) + " notes " + r.events + " " + r.secs.toFixed(0) + "s"); }
  await o.ctx.close(); }
// Opening film: shown once before the first menu, then the map films are the short cut with a chapter number.
{ const o = await open({ tg_adv_prologue: "__none__" });
  const k = await o.p.evaluate(() => window.__advCine.kinds()); ok("prologue: earth > factory > launch > the Harvesters > TIGA > how to play, then the menu", sub(["earth", "factory", "launch", "contact", "mind", "howto"], k) && k.length >= 20 && k.length <= 30, k.join());
  await o.p.locator(".ac-skip").click(); await o.p.waitForSelector(".adv-planet");
  ok("prologue: remembered after it ends", await o.p.evaluate(() => localStorage.getItem("tg_adv_prologue") === "1"));
  await o.p.evaluate(() => document.querySelector(".adv-planet").click()); await o.p.waitForSelector(".adv-cine");
  const k2 = await o.p.evaluate(() => window.__advCine.kinds()); ok("short film after the prologue: starts at the approach", k2[0] === "approach" && k2[k2.length - 1] === "objective" && !k2.includes("earth"), k2.join());
  const ttl = await o.p.locator(".ac-title small").first().innerText(); ok("chapter number is shown", /CHAPTER 1/i.test(ttl), ttl);
  ok("prologue: no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close(); }
// Act 2 epilogue: shown once, after Kindred Haven, the Dark Forge and the Harvesters' Eye are all cleared
{ const o = await open({ __fin: 1, tg_adv_prologue: "1", tg_adv_done: JSON.stringify(["luma", "kindred", "darkforge", "shadow"]) });
  const k = await o.p.evaluate(() => window.__advCine.kinds()); ok("epilogue: friend > dark matter > the Harvesters > TIGA", sub(["lore", "lore", "lore", "mind"], k) && k.length >= 12, k.join());
  await o.p.locator(".ac-skip").click(); await o.p.waitForSelector(".adv-planet");
  ok("epilogue: remembered, so it plays once", await o.p.evaluate(() => localStorage.getItem("tg_adv_finale") === "1"));
  ok("epilogue: no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close(); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
