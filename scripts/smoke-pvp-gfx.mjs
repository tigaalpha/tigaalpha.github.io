// PvP graphics level (pvp-gfx.ts): the gear in the Games lobby and the fight header, the two-level card in th/en/zh,
// that a choice is stored (tg_pvp_gfx) and changes the fight's classes / canvases live, that the first-person button is gone,
// that the gear does not overlap anything in the lobby header, and that the lobby Fight button is still hit-testable.
// Needs a built app in dist/ (npm run build). Network is stubbed.   node scripts/smoke-pvp-gfx.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
const ROOT = path.resolve(process.env.ROOT || "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; let f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, "index.html"); res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined, args: ["--use-gl=swiftshader"] });
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };

async function open({ w, h, touch = true, lang = "en", kv = {}, cores = 0 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(([kv, lang, cores]) => {
    if (cores) { Object.defineProperty(navigator, "hardwareConcurrency", { get: () => cores }); Object.defineProperty(navigator, "deviceMemory", { get: () => 8 }); }
    sessionStorage.setItem("tiga_page", "pvp");
    localStorage.setItem("tg_test_hook", "1"); localStorage.setItem("tg_gp_free", "1"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_lang", lang);
    localStorage.setItem("tg_3d_tier", "0");
    localStorage.setItem("tg_edu_seen", JSON.stringify({ firstCoins: 1, chest: 1, pet: 1, shop: 1, rich: 1, shopIntro: 1 }));
    localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang, age: "adult", level: "beginner", exp: 5000 }));
    for (const k in kv) localStorage.setItem(k, kv[k]);
  }, [kv, lang, cores]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" });
  await p.waitForSelector("[data-gfx-gear]", { timeout: 25000 }); await p.waitForTimeout(700);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  return { ctx, p, errs };
}
const stored = (p) => p.evaluate(() => localStorage.getItem("tg_pvp_gfx"));

// ── 1. lobby, landscape phone: gear, card, two options, three languages, persistence, close ways ──
{
  const { ctx, p, errs } = await open({ w: 844, h: 390 });
  const g = await p.evaluate(() => { const e = document.querySelector("[data-gfx-gear]"); const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { r: [r.left, r.top, r.width, r.height], radius: cs.borderRadius, svg: !!e.querySelector("svg"), fs: document.querySelector(".pvpfs") && document.querySelector(".pvpfs").getBoundingClientRect().right, vw: innerWidth }; });
  ok("lobby: a gear exists, at least 44 px, round, an SVG", g.r[2] >= 44 && g.r[3] >= 44 && /50%|22px|9999|999/.test(g.radius) && g.svg, JSON.stringify(g));
  ok("lobby: the gear is the far right of the header and fully on screen", g.fs != null && g.r[0] >= g.fs - 1 && g.r[0] + g.r[2] <= g.vw + 0.5, `fs right ${g.fs} gear ${g.r[0]}..${g.r[0] + g.r[2]} of ${g.vw}`);
  const ov = await p.evaluate(() => { const hdr = document.querySelector(".pvpstage-none, .pvplobby3 .pvphdr"); const kids = [...hdr.children].filter(c => c.getClientRects().length).map(c => c.getBoundingClientRect()); let bad = 0; for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const a = kids[i], b = kids[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad++; } return { n: kids.length, bad, overflow: hdr.scrollWidth > hdr.clientWidth + 1 }; });
  ok("lobby: no header item overlaps another and the header does not overflow", ov.bad === 0 && !ov.overflow, JSON.stringify(ov));
  ok("nothing stored: the game picks (a 4-core sandbox is a weak device -> Low)", (await stored(p)) == null);
  await p.click("[data-gfx-gear]"); await p.waitForSelector("[data-gfx-card]");
  const opts = await p.$$eval("[data-gfx-opt]", els => els.map(e => ({ k: e.dataset.gfxOpt, on: e.getAttribute("aria-checked"), t: e.textContent })));
  ok("the card lists exactly two levels, Low and High", opts.length === 2 && opts[0].k === "low" && opts[1].k === "high", JSON.stringify(opts));
  ok("the level in effect (Low here) is already marked", opts[0].on === "true" && opts[1].on === "false");
  ok("English wording", /Graphics quality/.test(await p.textContent(".pvpgfx-h")) && /smoothest/.test(opts[0].t) && /strong phones/.test(opts[1].t), opts.map(o => o.t).join(" | "));
  const card = await p.evaluate(() => { const c = document.querySelector(".pvpgfx-card").getBoundingClientRect(); return { l: c.left, t: c.top, w: c.width, h: c.height, vw: innerWidth, vh: innerHeight, br: getComputedStyle(document.querySelector(".pvpgfx-card")).borderRadius, row: getComputedStyle(document.querySelector(".pvpgfx-row")).borderRadius }; });
  ok("the card is small, centred and fits a landscape phone", card.w < card.vw * 0.6 && card.t >= 0 && card.t + card.h <= card.vh && Math.abs(card.l + card.w / 2 - card.vw / 2) < 2, JSON.stringify(card));
  ok("round shapes (card and rows)", parseFloat(card.br) >= 20 && parseFloat(card.row) >= 20, card.br + " / " + card.row);
  await p.click('[data-gfx-opt="high"]');
  ok("choosing High stores tg_pvp_gfx=high", (await stored(p)) === "high");
  ok("the card shows High as in use now", (await p.getAttribute('[data-gfx-opt="high"]', "aria-checked")) === "true");
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  ok("Escape closes the card", !(await p.$("[data-gfx-card]")));
  await p.click("[data-gfx-gear]"); await p.waitForSelector("[data-gfx-card]"); await p.mouse.click(5, 5); await p.waitForTimeout(100);
  ok("tapping outside closes the card", !(await p.$("[data-gfx-card]")));
  await p.click("[data-gfx-gear]"); await p.waitForSelector("[data-gfx-card]"); await p.click(".pvpgfx-x"); await p.waitForTimeout(100);
  ok("the close button closes the card", !(await p.$("[data-gfx-card]")));
  await p.click("[data-gfx-gear]"); await p.waitForSelector("[data-gfx-card]"); await p.click('[data-gfx-opt="low"]');
  ok("choosing Low stores tg_pvp_gfx=low", (await stored(p)) === "low"); await p.keyboard.press("Escape");
  const hit = await p.evaluate(() => { const e = document.querySelector(".pvpgo-hero"); if (!e) return null; const b = e.getBoundingClientRect(); return [[.5, .5], [.15, .3], [.85, .3], [.15, .7], [.85, .7]].map(([x, y]) => { const t = document.elementFromPoint(b.left + b.width * x, b.top + b.height * y); return !!t && !!t.closest(".pvpgo-hero"); }); });
  ok("the lobby Fight button is still hit-testable", hit && hit.every(Boolean), JSON.stringify(hit));
  ok("no page errors (lobby)", errs.length === 0, errs.join("|")); await ctx.close();
}
// ── 2. Thai and Chinese ──
for (const [lang, title, low, high] of [["th", "คุณภาพกราฟิก", "ต่ำ", "สูง"], ["zh", "画质", "低", "高"]]) {
  const { ctx, p, errs } = await open({ w: 844, h: 390, lang });
  await p.click("[data-gfx-gear]"); await p.waitForSelector("[data-gfx-card]");
  const t = await p.textContent(".pvpgfx-h"); const rows = await p.$$eval("[data-gfx-opt]", els => els.map(e => e.textContent));
  ok(lang + ": title and two rows", t === title && rows.length === 2 && rows[0].includes(low) && rows[1].includes(high), t + " | " + rows.join(" | "));
  ok(lang + ": no page errors", errs.length === 0, errs.join("|")); await ctx.close();
}
// ── 3. other lobby sizes: the gear fits and nothing overlaps ──
for (const [w, h] of [[740, 340], [915, 412], [390, 844]]) {
  const { ctx, p, errs } = await open({ w, h });
  const r = await p.evaluate(() => { const hdr = document.querySelector(".pvplobby3 .pvphdr"); const g = document.querySelector("[data-gfx-gear]").getBoundingClientRect(); const kids = [...hdr.children].filter(c => c.getClientRects().length).map(c => c.getBoundingClientRect()); let bad = 0; for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const a = kids[i], b = kids[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad++; } return { gr: g.right, vw: innerWidth, bad, over: hdr.scrollWidth > hdr.clientWidth + 1, hh: hdr.getBoundingClientRect().height }; });
  ok(`${w}x${h}: gear on screen, no overlap, no overflow`, r.gr <= r.vw + 0.5 && r.bad === 0 && !r.over, JSON.stringify(r));
  ok(`${w}x${h}: no page errors`, errs.length === 0, errs.join("|")); await ctx.close();
}
// ── 4. the fight: gear where the first-person button was, level changes the fight live ──
{ // a strong desktop (8 cores, mouse): High = live fighters; Low = lite
  const { ctx, p, errs } = await open({ w: 1000, h: 560, touch: false, cores: 8, kv: { tg_pvp_gfx: "low" } });
  await p.evaluate(() => document.querySelector(".pvpgo").click());
  await p.waitForSelector(".pvppage.fight", { timeout: 20000 }); await p.waitForTimeout(1200);
  const f = await p.evaluate(() => ({ cls: document.querySelector(".pvppage.fight").className, gfx: document.querySelector(".pvppage.fight").dataset.gfx, fpv: !!document.querySelector(".fpv-btn, [class*='fpvbtn']"), gear: !!document.querySelector(".pvppage.fight [data-gfx-gear]"), tone: !!document.querySelector(".pvpstage .pvptone"), room: !!document.querySelector(".pvppage.fight .sp3[data-tier]:not([data-tier='0'])") }));
  ok("fight (Low): gear in the header, no first-person button, root says low and is lite", f.gear && !f.fpv && f.gfx === "low" && /\blite\b/.test(f.cls), JSON.stringify(f));
  ok("fight (Low): no 3D room, the tone overlay exists", !f.room && f.tone);
  const g = await p.evaluate(() => { const g = document.querySelector(".pvppage.fight [data-gfx-gear]").getBoundingClientRect(), fs = document.querySelector(".pvppage.fight .pvpfs"); return { w: g.width, h: g.height, right: g.right, vw: innerWidth, fsRight: fs ? fs.getBoundingClientRect().right : null }; });
  ok("fight: gear >= 44 px, far right after the full-screen button", g.w >= 44 && g.h >= 44 && g.right <= g.vw + 0.5 && (g.fsRight == null || g.right > g.fsRight), JSON.stringify(g));
  const px = await p.evaluate(() => { const c = document.querySelector(".pvpfx"); return c.width / c.getBoundingClientRect().width; });
  await p.click(".pvppage.fight [data-gfx-gear]"); await p.waitForSelector("[data-gfx-card]");
  ok("the fight's card marks Low", (await p.getAttribute('[data-gfx-opt="low"]', "aria-checked")) === "true");
  await p.click('[data-gfx-opt="high"]'); await p.waitForTimeout(300);
  ok("choosing High in the fight is stored at once", (await stored(p)) === "high");
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  const f2 = await p.evaluate(() => ({ cls: document.querySelector(".pvppage.fight").className, gfx: document.querySelector(".pvppage.fight").dataset.gfx, px: document.querySelector(".pvpfx").width / document.querySelector(".pvpfx").getBoundingClientRect().width }));
  ok("fight: the change applies live (High: not lite on a mouse device, root says high)", f2.gfx === "high" && !/\blite\b/.test(f2.cls), JSON.stringify(f2));
  ok("fight: canvas pixel ratio follows the level (Low 1x; High up to 1.5x on a >1 dpr screen)", px <= 1.01 && f2.px >= px - 0.01, `low ${px} high ${f2.px}`);
  await p.click(".pvppage.fight [data-gfx-gear]"); await p.waitForSelector("[data-gfx-card]"); await p.click('[data-gfx-opt="low"]'); await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  const f3 = await p.evaluate(() => document.querySelector(".pvppage.fight").className);
  ok("fight: back to Low is lite again", /\blite\b/.test(f3), f3);
  ok("no page errors (fight)", errs.length === 0, errs.join("|")); await ctx.close();
}
{ // a phone, never chosen: the game picks Low here (4 cores); the fight is lite and the gear is there
  const { ctx, p, errs } = await open({ w: 800, h: 420 });
  await p.evaluate(() => (document.querySelector(".pvpgo-hero") && getComputedStyle(document.querySelector(".pvpgo-hero")).display !== "none" ? document.querySelector(".pvpgo-hero") : document.querySelector(".pvpgo")).click());
  await p.waitForSelector(".pvppage.fight", { timeout: 20000 }); await p.waitForTimeout(800);
  const f = await p.evaluate(() => ({ cls: document.querySelector(".pvppage.fight").className, gfx: document.querySelector(".pvppage.fight").dataset.gfx, gear: !!document.querySelector(".pvppage.fight [data-gfx-gear]") }));
  ok("phone fight, nothing chosen: Low, lite, gear present", f.gfx === "low" && /\blite\b/.test(f.cls) && f.gear, JSON.stringify(f));
  ok("nothing was written by merely opening the fight", (await stored(p)) == null);
  ok("no page errors (phone fight)", errs.length === 0, errs.join("|")); await ctx.close();
}

// ── 5. the clock is held while the card is open (the card is modal; the fight must not run behind it) ──
{
  const { ctx, p, errs } = await open({ w: 1000, h: 560, touch: false, cores: 8, kv: { tg_pvp_gfx: "low" } });
  await p.evaluate(() => document.querySelector(".pvpgo").click());
  await p.waitForSelector(".pvppage.fight", { timeout: 20000 }); await p.waitForTimeout(9500);   // intro, FIGHT!
  const bar = () => p.evaluate(() => { const e = document.querySelector(".pvpwave i"); return e ? e.style.width || getComputedStyle(e).width : null; });
  const hp = () => p.evaluate(() => [...document.querySelectorAll(".pvphp i")].map(e => e.style.width).join("/"));
  await p.click(".pvppage.fight [data-gfx-gear]"); await p.waitForSelector("[data-gfx-card]");
  const b0 = await bar(), h0 = await hp(); await p.waitForTimeout(3000); const b1 = await bar(), h1 = await hp();
  ok("while the card is open the round clock and the health bars stand still", b0 === b1 && h0 === h1, `bar ${b0} -> ${b1}, hp ${h0} -> ${h1}`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(3000); const b2 = await bar();
  ok("the clock runs again after it closes", b2 !== b1 || b1 == null, `bar ${b1} -> ${b2}`);
  ok("no page errors (hold)", errs.length === 0, errs.join("|")); await ctx.close();
}
// ── 6. a device left on High that cannot keep up steps itself down, once, and says so; a level chosen by hand is never touched ──
{
  const cpu = await pw.chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined, args: ["--disable-gpu"] });
  async function slow(kv) {
    const ctx = await cpu.newContext({ viewport: { width: 800, height: 450 }, serviceWorkers: "block" });
    await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
    await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await ctx.addInitScript((kv) => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 }); Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
      sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_test_hook", "1"); localStorage.setItem("tg_gp_free", "1"); localStorage.setItem("tg_lang", "en");
      localStorage.setItem("tg_edu_seen", JSON.stringify({ firstCoins: 1, chest: 1, pet: 1, shop: 1, rich: 1, shopIntro: 1 }));
      localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 }));
      for (const k in kv) localStorage.setItem(k, kv[k]);
    }, kv);
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
    const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 8 });
    await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" });
    await p.waitForSelector("[data-gfx-gear]", { timeout: 40000 }); await p.waitForTimeout(800);
    for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
    await p.evaluate(() => document.querySelector(".pvpgo").click());
    await p.waitForSelector(".pvppage.fight", { timeout: 40000 });
    return { ctx, p, errs };
  }
  // tg_3d_tier forces a strong GPU tier, so nothing chosen = High on this 8-core mouse device; there is no GL here, the room simply does not come up
  const a = await slow({ tg_3d_tier: "3" });
  ok("a strong device with nothing chosen starts on High", (await a.p.getAttribute(".pvppage.fight", "data-gfx")) === "high");
  let t = 0; while (t < 120000 && (await stored(a.p)) !== "low") { await a.p.waitForTimeout(1500); t += 1500; }
  ok("it stepped down to Low by itself", (await stored(a.p)) === "low", `after ${Math.round(t / 1000)} s`);
  ok("and remembered that the GAME did it", (await a.p.evaluate(() => localStorage.getItem("tg_pvp_gfx_auto"))) === "1");
  ok("the fight shows a one-line notice", !!(await a.p.$("[data-gfx-toast]")));
  await a.p.click(".pvppage.fight [data-gfx-gear]"); await a.p.waitForSelector("[data-gfx-card]");
  ok("the card says the game lowered the quality", !!(await a.p.$("[data-gfx-auto]")));
  await a.p.click('[data-gfx-opt="high"]');
  ok("choosing High by hand clears that note and is never overridden afterwards", !(await a.p.$("[data-gfx-auto]")) && (await a.p.evaluate(() => localStorage.getItem("tg_pvp_gfx_auto"))) == null);
  await a.p.keyboard.press("Escape"); await a.p.waitForTimeout(25000);
  ok("a level picked by hand stays even when frames are slow", (await stored(a.p)) === "high");
  ok("no page errors (watchdog)", a.errs.length === 0, a.errs.join("|")); await a.ctx.close(); await cpu.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
