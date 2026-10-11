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
// Adventure phase 3.2: crystal upgrades (capped, geometric cost), daily quests (EXP only), difficulty.
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
{
  const { ctx, p, errs } = await open({ tg_adv_crystals: "100" });
  const crys = () => p.evaluate(() => Number(localStorage.getItem("tg_adv_crystals") || 0));
  const ups = () => p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_up") || "{}"));
  ok("workshop lists 4 upgrade lines and 3 quests", (await p.locator(".adv-up").count()) === 4 && (await p.locator(".adv-q").count()) === 3);
  await p.locator('.adv-up[data-up="atk"]').click(); await p.waitForTimeout(150);
  ok("buying level 1 costs 12 and sets the level", (await crys()) === 88 && (await ups()).atk === 1, "crys " + (await crys()));
  await p.locator('.adv-up[data-up="atk"]').click(); await p.waitForTimeout(150);
  ok("level 2 costs 24 (cost doubles)", (await crys()) === 64 && (await ups()).atk === 2, "crys " + (await crys()));
  await p.evaluate(() => localStorage.setItem("tg_adv_crystals", "5")); await p.evaluate(() => { const b = document.querySelector('.adv-up[data-up="hp"]'); b.dispatchEvent(new Event("x")); });
  await p.locator('.adv-up[data-up="atk"]').click({ force: true }).catch(() => {}); await p.waitForTimeout(150);
  ok("not enough crystals: no purchase", (await ups()).atk === 2 && (await crys()) === 5);
  await p.evaluate(() => localStorage.setItem("tg_adv_up", JSON.stringify({ atk: 5, hp: 0, skl: 0 })));
  await p.evaluate(() => localStorage.setItem("tg_adv_crystals", "9999")); await p.evaluate(() => document.querySelectorAll(".adv-gfx")[0].querySelector("button").click()); await p.waitForTimeout(150);
  ok("a maxed line cannot be bought again (cap at +25%)", await p.evaluate(() => document.querySelector('.adv-up[data-up="atk"]').disabled && /MAX/.test(document.querySelector('.adv-up[data-up="atk"]').innerText)));
  await p.evaluate(() => localStorage.setItem("tg_adv_up", JSON.stringify({ atk: 0, hp: 5, skl: 0 })));
  // difficulty
  await p.locator('.adv-gfx[aria-label="Difficulty"] button').nth(1).click(); await p.waitForTimeout(150);
  ok("difficulty choice is saved", (await p.evaluate(() => localStorage.getItem("tg_adv_diff"))) === "hard");
  await p.evaluate(() => document.querySelector(".adv-planet").click()); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(700);
  ok("Hard scales monster/boss health (x1.5)", Math.abs((await p.evaluate(() => window.__advTest.diffHp())) - 1.5) < 0.01);
  ok("a health upgrade of +25% raises max HP", (await p.evaluate(() => window.__advTest.hpMax())) >= Math.round(131 * 1.25) - 1, String(await p.evaluate(() => window.__advTest.hpMax())));
  const before = await crys();
  await p.evaluate(() => window.__advTest.gainCry(15)); await p.waitForTimeout(200);
  ok("crystals gained are saved", (await crys()) === before + 15);
  const q = await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_q") || "{}"));
  ok("the crystal quest completed and was marked done once", q.p.cry >= 15 && q.done.cry === 1, JSON.stringify(q));
  await p.evaluate(() => window.__advTest.gainCry(15)); await p.waitForTimeout(100);
  const q2 = await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_q") || "{}"));
  ok("it does not pay twice in a day", q2.done.cry === 1);
  ok("no errors", errs.length === 0, errs.join("|"));
  await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
