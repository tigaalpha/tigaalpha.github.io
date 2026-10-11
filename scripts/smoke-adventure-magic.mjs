// Adventure phase 3.4 + music: a map-by-map soundtrack and the chord spell. (old header) a knowledge beacon asks questions from what THIS learner has studied, climbs, and a wrong answer teaches on the piano.
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

async function boot(done, planetIdx = 0) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block", permissions: [] });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); for (const k in d) localStorage.setItem(k, d[k]); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); }, done);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), planetIdx); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(900);
  return { ctx, p, errs };
}
const ALL = { tg_adv_done: JSON.stringify(["luma", "ferro"]), tg_path_done: JSON.stringify(["triad", "scale"]) };
{
  const { ctx, p, errs } = await boot(ALL, 0);
  for (const id of ["luma", "ferro", "jovia", "kryo", "pyra", "nexa"]) {
    const R = (boss, inten, bars, sb) => p.evaluate(([a, bb, ii, bs, st]) => window.__advTest.renderMusic(a, bb, ii, bs, st), [id, boss, inten, bars, sb]);
    const A1 = await R(false, 1, 4, 0), A3 = await R(false, 3, 4, 0), C1 = await R(false, 1, 4, 12), BO = await R(true, 3, 4, 12);
    for (const [nm, r] of [["calm hook", A1], ["peak hook", A3], ["last chorus", C1], ["boss peak", BO]]) ok("music " + id + " (" + nm + "): no clipping, audible, finite", r.peak <= 0.98 && r.peak > 0.02 && r.rms > 0.004 && r.bad === 0, "peak " + r.peak.toFixed(2) + " rms " + r.rms.toFixed(3));
    ok("music " + id + ": the peak arrangement plays more notes than the calm one and is not quieter", A3.events > A1.events * 1.15 && A3.rms >= A1.rms * 0.97, A1.events + " -> " + A3.events + " notes");
    ok("music " + id + ": the last chorus has more going on than the opening hook", C1.events > A1.events * 1.15, A1.events + " -> " + C1.events + " notes");
  }
  const m0 = await p.evaluate(() => window.__advTest.music());
  ok("Luma's music is running on the audio clock", m0 && m0.running && m0.id === "luma" && m0.bpm === 112, JSON.stringify(m0));
  await p.waitForTimeout(1500); const m1 = await p.evaluate(() => window.__advTest.music());
  ok("it keeps scheduling steps as time passes", m1.steps > m0.steps, m0.steps + " -> " + m1.steps);
  await p.evaluate(() => document.querySelector('[aria-label="music"]').click()); await p.waitForTimeout(200);
  ok("the music button mutes it and remembers the choice", (await p.evaluate(() => window.__advTest.music().on)) === false && (await p.evaluate(() => localStorage.getItem("tg_adv_music"))) === "0");
  await p.evaluate(() => document.querySelector('[aria-label="music"]').click()); await p.waitForTimeout(200);
  await p.evaluate(() => window.__advTest.tp(5200 - 900 + 120)); await p.waitForTimeout(700);
  ok("a boss fight switches to the boss arrangement", (await p.evaluate(() => window.__advTest.music().boss)) === true);
  { const e0 = await p.evaluate(() => window.__advTest.music()); ok("the music reports its section and energy", typeof e0.section === "number" && typeof e0.energy === "number" && e0.intensity >= 1, JSON.stringify(e0)); }
  await p.evaluate(() => window.__advTest.tp(5200 - 900 - 600)); await p.evaluate(() => window.__advTest.tp(480)); await p.waitForTimeout(900);
  ok("fighting raises the music's intensity", (await p.evaluate(() => window.__advTest.music().intensity)) >= 2, JSON.stringify(await p.evaluate(() => window.__advTest.music())));
  ok("no errors (Luma)", errs.length === 0, errs.join("|")); await ctx.close();
}
for (const [idx, id, bpm] of [[1, "ferro", 126], [2, "jovia", 142], [3, "kryo", 84]]) {
  const { ctx, p, errs } = await boot(ALL, idx);
  const m = await p.evaluate(() => window.__advTest.music());
  ok(id + " plays its own tune (" + bpm + " bpm)", m && m.id === id && m.bpm === bpm && m.running, JSON.stringify(m));
  ok(id + " no errors", errs.length === 0, errs.join("|")); await ctx.close();
}
const WH = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 }, BL = { 1: 0, 3: 1, 6: 2, 8: 3, 10: 4 };
async function tapPc(p, pc) { const idx = pc in WH ? WH[pc] : 14 + BL[pc]; await p.evaluate((i) => { const el = document.querySelectorAll(".adv-quiz .pk")[i]; el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 })); el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 })); }, idx); await p.waitForTimeout(80); }
for (const right of [true, false]) {
  const { ctx, p, errs } = await boot(ALL, 0);
  ok("spell gauge starts empty and the button shows 0%", (await p.evaluate(() => window.__advTest.spellG())) === 0 && /0%/.test(await p.locator('[aria-label="spell"]').innerText()));
  await p.locator('[aria-label="spell"]').dispatchEvent("pointerdown"); await p.waitForTimeout(150); await p.locator('[aria-label="spell"]').dispatchEvent("pointerup");
  ok("pressing it before it is full does nothing", (await p.locator(".adv-quiz").count()) === 0);
  const mx = await p.evaluate(() => window.__advTest.monX()); await p.evaluate((x) => window.__advTest.tp(x - 150), mx);
  const hp0 = await p.evaluate(() => window.__advTest.monHp());
  await p.evaluate(() => window.__advTest.setSpell(100)); await p.waitForTimeout(250);
  await p.locator('[aria-label="spell"]').dispatchEvent("pointerdown"); await p.waitForSelector(".adv-quiz", { timeout: 3000 }); await p.locator('[aria-label="spell"]').dispatchEvent("pointerup");
  const info = await p.evaluate(() => { const z = window.__advQuiz; const c = z.qs[z.i].q; return { n: z.qs.length, kind: c.kind, topic: c.topic, ans: c.ans, spell: z.spell }; });
  ok("a full gauge opens ONE chord question to play on the piano", info.n === 1 && info.kind === "keys" && info.topic === "triad" && info.spell === true, JSON.stringify(info));
  ok("the music ducks while the question is open", (await p.evaluate(() => window.__advTest.music().ducked)) === true);
  const set = right ? info.ans : [info.ans[0]]; for (const pc of set) await tapPc(p, pc);
  await p.locator(".adv-qgo").click({ force: true }); await p.waitForSelector(".adv-qres", { timeout: 3000 }); await p.locator(".adv-qgo").last().click({ force: true }); await p.waitForTimeout(500);
  const g = await p.evaluate(() => window.__advTest.spellG()), hp1 = await p.evaluate(() => window.__advTest.monHp());
  if (right) ok("the right chord casts the spell: gauge empties, monsters take big damage", g === 0 && hp1 < hp0, "gauge " + g + " hp " + hp0 + "->" + hp1);
  else ok("a wrong chord teaches and keeps half the gauge (no damage)", g === 50 && hp1 >= hp0 - 2, "gauge " + g + " hp " + hp0 + "->" + hp1);
  ok("the game goes on and the music un-ducks", (await p.locator(".adv-quiz").count()) === 0 && (await p.evaluate(() => window.__advTest.music().ducked)) === false);
  ok("no errors (spell " + right + ")", errs.length === 0, errs.join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
