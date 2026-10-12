// HANDS OFF gate before every Adventure question, the lightning bolt, the energy taps and the mining markers.
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
async function open(re, sector) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((sec) => { sessionStorage.setItem("tiga_page", "pvp"); if (sec) localStorage.setItem("tg_adv_sector", sec); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_unlockall", "1"); localStorage.setItem("tg_adv_nogate", "1");
    window.__spoken = []; try { window.speechSynthesis.speak = (u) => { window.__spoken.push({ lang: u.lang, text: u.text }); }; } catch (e) {} }, sector || "");
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => new RegExp(src).test(b.textContent)), re);
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx);
  return { ctx, p, errs };
}
// 1) films: voice-over and subtitles in the player's language, two buttons top-left to change them
{ const { ctx, p, errs } = await open("Luma");
  await p.waitForSelector(".adv-cine", { timeout: 8000 }); await p.waitForTimeout(1500);
  ok("two buttons in the top-left corner: voice and subtitles", (await p.locator(".ac-lang button").count()) === 2);
  const box = await p.evaluate(() => { const r = document.querySelector(".ac-lang").getBoundingClientRect(); return { l: r.left, t: r.top }; });
  ok("they sit at the top left", box.l < 60 && box.t < 60, JSON.stringify(box));
  ok("both start in the player's language (EN)", (await p.getAttribute("[data-vo]", "data-vo")) === "en" && (await p.getAttribute("[data-sub]", "data-sub")) === "en");
  await p.waitForTimeout(4500);   // the mock never fires onend, so each sentence waits for the engine's guard timer
  let sp = await p.evaluate(() => window.__spoken.slice());
  ok("the film is narrated in English, a sentence at a time", sp.length > 0 && /en/i.test(sp[sp.length - 1].lang) && sp.map(x => x.text).join(" ").length > 20, JSON.stringify(sp.slice(-1)).slice(0, 160));
  const capEn = await p.locator(".ac-cap").first().innerText().catch(() => "");
  ok("English subtitles", /[A-Za-z]{4}/.test(capEn) && !/[\u0E00-\u0E7F]/.test(capEn), capEn.slice(0, 60));
  await p.click("[data-vo]"); await p.waitForTimeout(700);
  sp = await p.evaluate(() => window.__spoken.slice());
  ok("the voice button switches the narration to Chinese", /zh/i.test(sp[sp.length - 1].lang) && /[\u4e00-\u9fff]/.test(sp[sp.length - 1].text), JSON.stringify(sp.slice(-1)).slice(0, 120));
  ok("...without changing the subtitles", /[A-Za-z]{4}/.test(await p.locator(".ac-cap").first().innerText().catch(() => "")));
  await p.click("[data-sub]"); await p.click("[data-sub]"); await p.waitForTimeout(400);
  ok("the subtitle button changes them (EN > ZH > OFF)", (await p.getAttribute("[data-sub]", "data-sub")) === "off" && (await p.locator(".ac-cap").count()) === 0);
  await p.click("[data-sub]"); await p.waitForTimeout(300);
  ok("then Thai", (await p.getAttribute("[data-sub]", "data-sub")) === "th" && /[\u0E00-\u0E7F]/.test(await p.locator(".ac-cap").first().innerText().catch(() => "")));
  await p.click("[data-vo]"); await p.waitForTimeout(300); const n0 = await p.evaluate(() => window.__spoken.length);
  await p.evaluate(() => window.__advCine.jump(2)); await p.waitForTimeout(1200);
  ok("voice off: nothing more is spoken", (await p.getAttribute("[data-vo]", "data-vo")) === "off" && (await p.evaluate(() => window.__spoken.length)) === n0);
  ok("no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
// 2) the light-speed button on a ship map
{ const { ctx, p, errs } = await open("Void Gate", "space");
  await p.waitForSelector(".adv-cine", { timeout: 8000 }).catch(() => {});
  await p.evaluate(() => { const b = [...document.querySelectorAll(".ac-skip")][0]; if (b) b.click(); }); await p.waitForSelector(".adv-ship canvas", { timeout: 8000 }); await p.waitForTimeout(700);
  ok("a light-speed button in the right pad", (await p.locator(".adv-ship .pvppad-r [data-light]").count()) === 1);
  const a = await p.evaluate(() => window.__advShip.lsNow());
  await p.evaluate(() => { const b = document.querySelector("[data-light]"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 5 })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 5 })); });
  await p.waitForTimeout(600); const b2 = await p.evaluate(() => window.__advShip.lsNow());
  ok("pressing it engages light speed (the world rushes past)", b2.on && b2.ls > 0.5 && b2.vt > a.vt + 1.5, JSON.stringify([a, b2]));
  await p.waitForTimeout(2600); const c2 = await p.evaluate(() => window.__advShip.lsNow());
  ok("it ends and recharges", !c2.on && c2.cd > 0, JSON.stringify(c2));
  ok("no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
// 3) the OPENING film (first time in Adventure Mode) has the score and the narration too, in each language
for (const lg of ["en", "th", "zh"]) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((L) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_lang", L); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: L, age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1}));
    window.__spoken = []; window.__ctxs = 0; const AC = window.AudioContext; if (AC) { window.AudioContext = function (...a) { window.__ctxs++; return new AC(...a); }; window.AudioContext.prototype = AC.prototype; }
    try { window.speechSynthesis.speak = (u) => { window.__spoken.push({ lang: u.lang, text: u.text }); }; } catch (e) {} }, lg);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-cine", { timeout: 10000 }); await p.waitForTimeout(1800);
  const kinds = await p.evaluate(() => window.__advCine.kinds());
  ok("opening film (" + lg + "): it is the opening film", kinds[0] === "earth" && kinds.includes("contact"), kinds.join());
  ok("opening film (" + lg + "): the score starts", (await p.evaluate(() => window.__ctxs)) >= 1);
  const sp = await p.evaluate(() => window.__spoken.slice()); const want = { en: /en/i, th: /th/i, zh: /zh/i }[lg];
  ok("opening film (" + lg + "): it is narrated in " + lg, sp.length > 0 && want.test(sp[0].lang), JSON.stringify(sp.slice(0, 1)).slice(0, 120));
  ok("opening film (" + lg + "): no page errors", errs.length === 0, errs.join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);
