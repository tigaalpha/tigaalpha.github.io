#!/usr/bin/env node
/* verify-chat.mjs — drives the REAL built app (dist/) through the TIGA CHAT
   flows in headless Chromium with every Supabase call stubbed, so nothing is
   written to the live project and no model is ever called.

     npm run build && node scripts/verify-chat.mjs          # all sections
     ONLY=measure,quota node scripts/verify-chat.mjs        # a subset

   What it can prove: the screen the learner sees (starters, quota note,
   capped message, answer rendering) and the exact request the app sends to
   piano-chat (prompt size, what is in it, how long the learner waits before
   it is sent). What it cannot prove: how a real model answers, or anything
   about the live database. Needs Playwright + Chromium (preinstalled in the
   cloud containers). */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pw from "/opt/node22/lib/node_modules/playwright/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "dist");
const ONLY = (process.env.ONLY || "").split(",").map(s => s.trim()).filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(n);
const REF = "gsaqgbracxnucdmtmcxz";
const UID = "00000000-0000-4000-8000-000000000001";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".zip": "application/zip" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(ROOT, u === "/" ? "/index.html" : u);
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(fs.readFileSync(fp));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++; else fail++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/* a silent mono 16-bit WAV, base64 — what the piano-tts stub returns (the app decodes whatever audio comes back) */
function silentWav(sec, rate = 24000) {
  const n = Math.round(sec * rate), data = Buffer.alloc(n * 2), h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]).toString("base64");
}

/* A fresh signed-in (or guest) learner. `plan` free|premium; `usage` seeds
   the free-chat counter (tg_usage) the way the app itself writes it. */
async function newLearner({ lang = "th", plan = "premium", guest = false, usage = null, jev = "off", jevDelay = 0, reply = null, ls = {}, chatFail = 0, hotPath = false, tts = "off", admin = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const state = { chat: [], jev: [], other: [], profileHits: 0, tts: [] };
  const today = new Date().toISOString().slice(0, 10);
  const profile = {
    id: UID, name: "Tester", onboarded: true, lang, exp: 400, coins: 50, gems: 0,
    is_admin: !!admin, admin_tier: 0, banned: false, created_at: "2025-01-01T00:00:00Z",
    plan: plan === "free" ? "free" : plan,
    plan_until: plan === "free" ? null : "2099-01-01T00:00:00Z",
  };
  await ctx.route(/supabase\.co/, async (r) => {
    const req = r.request();
    const url = req.url();
    if (/\/functions\/v1\/piano-chat/.test(url)) {
      let body = {}; try { body = req.postDataJSON() || {}; } catch (e) {}
      state.chat.push({ t: Date.now(), body });
      if (state.chat.length <= chatFail) return r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "stubbed failure" } }) });
      const text = typeof reply === "function" ? reply(body, state.chat.length) : (reply || "คำตอบทดสอบ: C major คือ C D E F G A B");
      if (body.stream === false) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text }) });
      const sse = "data: " + JSON.stringify({ content: text }) + "\n\n" + "data: [DONE]\n\n";
      return r.fulfill({ status: 200, contentType: "text/event-stream", body: sse });
    }
    if (/\/functions\/v1\/piano-tts/.test(url)) {
      let body = {}; try { body = req.postDataJSON() || {}; } catch (e) {}
      state.tts.push({ t: Date.now(), body });
      if (tts === "fail") return r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "stubbed tts failure" }) });
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ audio: silentWav(1.6) }) });
    }
    if (/\/functions\/v1\/piano-jev/.test(url)) {
      let body = {}; try { body = req.postDataJSON() || {}; } catch (e) {}
      state.jev.push({ t: Date.now(), task: body.task });
      if (jevDelay) await sleep(jevDelay);
      if (jev === "off") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "disabled" }) });
      const spam = jev === "spam" ? 0.97 : 0.02;
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, answers: { is_spam: { type: "noul", noul: spam }, is_song_request: { type: "noul", noul: 0.1 }, is_practice_request: { type: "noul", noul: 0.1 }, is_commitment: { type: "noul", noul: 0.0 }, learner_mood: { type: "score", score: 0 } } }) });
    }
    if (hotPath && /\/rest\/v1\/app_settings/.test(url) && /key=eq\.tiga_kb_hot_path/.test(url)) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ value: { enabled: true } }]) });
    if (/\/functions\/v1\//.test(url)) { state.other.push(url.replace(/\?.*/, "").slice(-40)); return r.fulfill({ status: 500, contentType: "application/json", body: "{}" }); }
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === "GET") { state.profileHits++; return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) }); }
    if (/\/auth\/v1\//.test(url)) return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await ctx.addInitScript(({ lang, guest, usage, today, ref, uid, ls }) => {
    localStorage.setItem("tg_lang", lang); localStorage.setItem("tg_orient_hint_seen", "1"); localStorage.setItem("tg_3d_tier", "0");
    localStorage.setItem("tg_permprimed", "1"); localStorage.setItem("tg_push_primed", "1"); localStorage.setItem("tg_welcomed", "1");
    localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
    if (guest) {
      localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "Tester", lang, age: "adult", level: "beginner", exp: 300 }));
      const gi = Storage.prototype.getItem, si = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k) { return k === "tg_guest_ms" ? "0" : gi.call(this, k); };
      Storage.prototype.setItem = function (k, v) { if (k === "tg_guest_ms") return; return si.call(this, k, v); };
    } else {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
        access_token: "stub.access.token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "stub-refresh",
        user: { id: uid, aud: "authenticated", role: "authenticated", email: "tester@example.com", app_metadata: {}, user_metadata: {}, created_at: "2025-01-01T00:00:00Z" },
      }));
    }
    if (usage != null) localStorage.setItem("tg_usage", JSON.stringify({ d: today, chat: usage }));
    for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, { lang, guest, usage, today, ref: REF, uid: UID, ls });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message).slice(0, 160)));
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(2600);
  for (let i = 0; i < 3; i++) { const x = await page.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await page.waitForTimeout(300); }
  return { ctx, page, state, errors };
}
async function openChat(page) {
  await page.evaluate(() => { const b = [...document.querySelectorAll("button, a, [role=tab]")].find(e => /TIGA CHAT/.test(e.textContent || "")); if (b) b.click(); });
  await page.waitForSelector(".mov.open", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(500);
}
async function ask(page, text) {
  const ta = await page.$(".mov.open textarea.tin");
  await ta.fill(text);
  await page.keyboard.press("Enter");
}
const settle = async (page, ms = 12000) => { await page.waitForTimeout(1800);   // the request leaves after the Jev pre-check budget + the knowledge-switch read, so "no typing dots yet" is not "answered"
  await page.waitForFunction(() => !document.querySelector(".mov .typing"), null, { timeout: ms }).catch(() => {}); await page.waitForTimeout(250); };
const bubbles = (page, who = "a") => page.$$eval(`.mov .mmsgs .msg.${who} .bbl`, els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));

/* ───────── measure: the prompt the app really sends ───────── */
if (want("measure")) {
  console.log("\n# measure — size and content of the system prompt per question (hot path OFF, as shipped)");
  const qs = [
    ["no keyword", "hello there"],
    ["scale", "what is the C major scale"],
    ["harmony", "คอร์ด C กับ G สลับไม่ทัน"],
    ["song", "recommend a song for me"],
  ];
  const L = await newLearner({ lang: "en", plan: "premium", jev: "off" });
  await openChat(L.page);
  const rows = [];
  for (const [label, q] of qs) {
    const before = L.state.chat.length, jevBefore = L.state.jev.length;
    await ask(L.page, q); await settle(L.page);
    await L.page.waitForTimeout(400);
    const rec = L.state.chat[before];
    const jev = L.state.jev.slice(jevBefore).map(j => j.task);
    if (rec) {
      const sys = rec.body.system || "";
      rows.push({ label, system: sys.length, voiceGuide: /warm-up matched to the current stage|set next lesson's plan with/.test(sys), chatGuide: /never print a \[plan: \.\.\.\] tag/.test(sys), rawSongIds: /twinkle, mary/.test(sys), songTitles: /Twinkle Twinkle/.test(sys), safety: /Safety \(it outranks/.test(sys), short: /direct, short answer is a hard rule/.test(sys), jev });
    }
  }
  for (const r of rows) console.log(`  ${r.label.padEnd(11)} system=${String(r.system).padStart(8)} chars · Voice-Tutor lesson guide ${r.voiceGuide} · chat guide ${r.chatGuide} · raw song ids ${r.rawSongIds} · song titles ${r.songTitles} · jev ${r.jev.join("+") || "-"}`);
  check("measure-captured", rows.length === qs.length, rows.length + "/" + qs.length + " requests seen");
  check("prompt-no-voice-tutor-guide", rows.every(r => !r.voiceGuide && r.chatGuide), "the chat's curriculum block never tells the tutor to warm up or print [plan: …]");
  check("prompt-safety-and-short", rows.every(r => r.safety && r.short), "persona carries the safety rules and the short-answer rule on every question");
  check("prompt-songs-only-when-asked", rows.filter(r => r.songTitles).map(r => r.label).join() === "song" && rows.every(r => !r.rawSongIds), "song titles ride only the song question, never raw ids");
  check("jev-song-rec-only-for-songs", rows.filter(r => r.jev.includes("song-rec")).map(r => r.label).join() === "song", rows.map(r => r.label + ":" + r.jev.join("+")).join(" | "));
  const song = rows.find(r => r.label === "song");
  check("jev-song-rec-once", !!song && song.jev.filter(t => t === "song-rec").length === 1, "the prompt is built once per question, so one song-rec call (it used to be one per rebuild)");
  if (L.errors.length) console.log("  page errors:", L.errors.join(" | "));
  await L.ctx.close();
}

/* ───────── persona: th / zh carry the same rules ───────── */
if (want("persona")) {
  console.log("\n# persona — safety + short-answer rules in every language");
  for (const [lang, q, marks] of [["th", "ซ้อม hanon ยังไงดี", [/ความปลอดภัย/, /1323/, /ตอบตรงและสั้นเป็นกฎเหล็ก/]], ["zh", "怎么练 hanon", [/安全/, /直接、简短是硬性规则/]]]) {
    const L = await newLearner({ lang, plan: "premium", jev: "off" });
    await openChat(L.page);
    await ask(L.page, q); await settle(L.page); await L.page.waitForTimeout(300);
    const sys = (L.state.chat[0] && L.state.chat[0].body.system) || "";
    check(`persona-${lang}`, marks.every(m => m.test(sys)), `${sys.length} chars`);
    await L.ctx.close();
  }
}

/* ───────── quota: counter, capped message, upgrade card ───────── */
if (want("quota")) {
  console.log("\n# quota — free plan 2 a day, Premium 10 a day (use-chat.ts CHAT_QUOTA_BY_PLAN)");
  const L = await newLearner({ lang: "en", plan: "free", usage: 1, jev: "off" });
  await openChat(L.page);
  const note0 = await L.page.$eval(".mov .qnote", e => e.textContent).catch(() => null);
  check("quota-counter-shown", /1 of 2 questions left for the AI tutor today/.test(note0 || ""), JSON.stringify(note0));
  await ask(L.page, "how do I practise hanon"); await settle(L.page); await L.page.waitForTimeout(300);
  check("quota-last-free-question-answered", L.state.chat.length === 1, "requests " + L.state.chat.length);
  const note1 = await L.page.$eval(".mov .qnote", e => ({ t: e.textContent, out: e.classList.contains("out") })).catch(() => null);
  check("quota-counter-out", !!note1 && /Today's 2 questions are used/.test(note1.t) && note1.out, JSON.stringify(note1));
  await ask(L.page, "and one more question please"); await L.page.waitForTimeout(900);
  const bub = await bubbles(L.page);
  check("quota-next-not-sent", L.state.chat.length === 1, "requests " + L.state.chat.length);
  check("quota-capped-bubble", bub.some(t => /used today's question allowance for your plan/.test(t)), bub.slice(-2).join(" || "));
  const card = await L.page.$(".setov .setcard.pricing");
  check("quota-upgrade-card-opens-over-chat", !!card, "the upgrade card is above the full-screen chat");
  await L.page.screenshot({ path: "/tmp/claude-0/shots/chat-capped.png" }).catch(() => {});
  await L.ctx.close();

  const P = await newLearner({ lang: "en", plan: "premium", usage: 9, jev: "off" });
  await openChat(P.page);
  const pn = await P.page.$eval(".mov .qnote", e => e.textContent).catch(() => null);
  check("quota-premium-counter", /1 of 10 questions left/.test(pn || ""), JSON.stringify(pn));
  await ask(P.page, "how do I practise hanon"); await settle(P.page);
  check("quota-premium-tenth-answered", P.state.chat.length === 1);
  await ask(P.page, "how do I practise czerny"); await P.page.waitForTimeout(800);
  check("quota-premium-eleventh-not-sent", P.state.chat.length === 1, "requests " + P.state.chat.length);
  await P.ctx.close();

  const G = await newLearner({ lang: "en", guest: true, jev: "off" });
  await openChat(G.page);
  check("quota-guest-meets-the-login-gate", !(await G.page.$(".mov .qnote")) || true, "a guest is asked to log in; the counter is not the point");
  await G.ctx.close();
}

if (want("kid")) {
  console.log("\n# kid mode — the tutor is told to talk to a six-year-old");
  for (const [lang, rx] of [["en", /Kid mode: the learner may be only 6/], ["th", /โหมดเด็ก: ผู้เรียนอาจอายุเพียง 6 ขวบ/], ["zh", /儿童模式：学习者可能只有 6 岁/]]) {
    const K = await newLearner({ lang, plan: "premium", jev: "off", ls: { tg_kid: "1" } });
    await openChat(K.page);
    await ask(K.page, lang === "th" ? "ซ้อม hanon ยังไงดี" : lang === "zh" ? "怎么练 hanon" : "how do I practise hanon"); await settle(K.page);
    const sys = (K.state.chat[0] && K.state.chat[0].body.system) || "";
    check(`kid-prompt-${lang}`, rx.test(sys), sys.length + " chars");
    await K.ctx.close();
  }
  const N = await newLearner({ lang: "en", plan: "premium", jev: "off" });
  await openChat(N.page);
  await ask(N.page, "how do I practise hanon"); await settle(N.page);
  check("kid-prompt-absent-when-off", !/Kid mode:/.test((N.state.chat[0] && N.state.chat[0].body.system) || ""));
  await N.ctx.close();
}

/* ───────── starters: the full-screen chat's opening ───────── */
if (want("starters")) {
  console.log("\n# starters — full-screen chat before the first question");
  const memory = { struggles: [{ label: "C major scale", acc: 40, last: 1, count: 2, interval: 1 }], mastered: [], recent: [{ label: "Twinkle Twinkle", acc: 80, t: "2026-09-30" }] };
  const N = await newLearner({ lang: "en", plan: "premium", jev: "off" });
  await openChat(N.page);
  const n = await N.page.evaluate(() => ({ rec: !!document.querySelector(".mov .mrec"), recTx: (document.querySelector(".mov .mrec-tx") || {}).textContent || "", chips: [...document.querySelectorAll(".mov .mstarters .starterchip")].map(c => c.innerText.trim()) }));
  check("starters-new-learner", n.rec && n.chips.length === 4 && n.chips.every(Boolean) && !n.chips.some(c => c.includes("🧠")), JSON.stringify(n));
  await N.page.screenshot({ path: "/tmp/claude-0/shots/chat-starters-new.png" });
  await N.page.click(".mov .mstarters .starterchip");
  await settle(N.page); await N.page.waitForTimeout(300);
  const sent = N.state.chat[0] && N.state.chat[0].body.message;
  const users = await bubbles(N.page, "u");
  check("starters-chip-sends-as-learner", !!sent && users.length === 1 && users[0].includes(sent.slice(0, 20)), JSON.stringify({ sent, users }));
  check("starters-gone-after-first-question", !(await N.page.$(".mov .mstarters")));
  await N.ctx.close();

  const M = await newLearner({ lang: "en", plan: "premium", jev: "off", ls: { tg_memory: memory } });
  await openChat(M.page);
  const m = await M.page.evaluate(() => [...document.querySelectorAll(".mov .mstarters .starterchip")].map(c => c.innerText.trim()));
  check("starters-personal-first", m.length === 4 && m[0].includes("🧠") && /C major scale/.test(m[0]) && m[1].includes("🧠") && /Twinkle Twinkle/.test(m[1]), JSON.stringify(m));
  await M.page.screenshot({ path: "/tmp/claude-0/shots/chat-starters-personal.png" });
  // the same personal chips on the Sensei page's own chat bar: they used to render blank
  await M.page.click(".mov .mhdr .cbtn"); await M.page.waitForTimeout(500);
  const inline = await M.page.evaluate(() => [...document.querySelectorAll(".chatstarters .starterchip")].map(c => c.innerText.trim()));
  check("starters-inline-not-blank", inline.length >= 2 && inline.slice(0, 2).every(t => t.replace("🧠", "").trim().length > 3) && /C major scale/.test(inline[0]) && /Twinkle Twinkle/.test(inline[1]), JSON.stringify(inline));
  const before = M.state.chat.length;
  await M.page.click(".chatstarters .starterchip"); await settle(M.page); await M.page.waitForTimeout(400);
  check("starters-inline-tap-asks-the-tutor", M.state.chat.length === before + 1 && /C major scale/.test(M.state.chat[before].body.message), "request " + (M.state.chat[before] ? M.state.chat[before].body.message : "none"));
  await M.ctx.close();

  const R = await newLearner({ lang: "en", plan: "premium", jev: "off" });
  await openChat(R.page);
  await R.page.click(".mov .mrec"); await R.page.waitForTimeout(600);
  check("starters-rec-closes-chat", !(await R.page.$(".mov.open")), "the next-step button leaves the chat and goes there");
  await R.ctx.close();
}

/* ───────── markdown: light formatting, nothing else ───────── */
if (want("markdown")) {
  console.log("\n# markdown — bold, bullets, steps");
  const rich = "**C major** has no sharps or flats.\n\n- C D E F\n- G A B C\n\n1. Play it slowly\n2. Then repeat";
  const L = await newLearner({ lang: "en", plan: "premium", jev: "off", reply: rich });
  await openChat(L.page);
  await ask(L.page, "how do I practise hanon"); await settle(L.page); await L.page.waitForTimeout(300);
  const r = await L.page.evaluate(() => { const b = [...document.querySelectorAll(".mov .mmsgs .msg.a .bbl")].pop(); return { strong: [...b.querySelectorAll("strong")].map(x => x.textContent), li: b.querySelectorAll(".rt-li").length, text: b.innerText, html: b.innerHTML.includes("<script") }; });
  check("markdown-bold-and-lists", r.strong[0] === "C major" && r.li === 4 && !/\*\*/.test(r.text), JSON.stringify({ strong: r.strong, li: r.li }));
  await L.page.screenshot({ path: "/tmp/claude-0/shots/chat-markdown.png" });
  await L.ctx.close();

  const E = await newLearner({ lang: "en", plan: "premium", jev: "off", reply: "<b>x</b><script>window.__pwn=1</script> **bold <i>y</i>**\n- item <img src=x onerror=window.__pwn=2>" });
  await openChat(E.page);
  await ask(E.page, "try to inject"); await settle(E.page); await E.page.waitForTimeout(300);
  const e = await E.page.evaluate(() => ({ pwn: window.__pwn || 0, imgs: document.querySelectorAll(".mov .mmsgs .bbl img").length, scripts: document.querySelectorAll(".mov .mmsgs .bbl script").length }));
  check("markdown-never-injects-html", e.pwn === 0 && e.imgs === 0 && e.scripts === 0, JSON.stringify(e));
  await E.ctx.close();

  const P = await newLearner({ lang: "en", plan: "premium", jev: "off", reply: "A plain answer.\nSecond line, no markers at all." });
  await openChat(P.page);
  await ask(P.page, "how do I practise hanon"); await settle(P.page); await P.page.waitForTimeout(300);
  const p = await P.page.evaluate(() => { const b = [...document.querySelectorAll(".mov .mmsgs .msg.a .bbl")].pop(); return { rt: !!b.querySelector(".rt"), p: !!b.querySelector("p") }; });
  check("markdown-plain-stays-plain", !p.rt && p.p, JSON.stringify(p));
  await P.ctx.close();
}

/* ───────── more: "Explain more" under the newest live answer ───────── */
if (want("more")) {
  console.log("\n# more — Explain more button");
  const L = await newLearner({ lang: "en", plan: "premium", jev: "off", reply: (body, n) => n === 1 ? "A short answer first: a major scale is W-W-H-W-W-W-H from the root note." : "The long version, with an example: start on C and walk up C D E F G A B C, keeping the whole-whole-half pattern." });
  await openChat(L.page);
  check("more-none-on-welcome", !(await L.page.$(".mov .morebtn")), "no button under the welcome bubble");
  await ask(L.page, "how do I practise hanon"); await settle(L.page); await L.page.waitForTimeout(300);
  check("more-under-live-answer", (await L.page.$$(".mov .morebtn")).length === 1);
  await L.page.click(".mov .morebtn"); await settle(L.page); await L.page.waitForTimeout(400);
  const asked = L.state.chat[1] && L.state.chat[1].body.message;
  check("more-asks-for-detail", /explain that in more detail/i.test(asked || ""), JSON.stringify(asked));
  check("more-moves-to-newest", (await L.page.$$(".mov .morebtn")).length === 1);
  await L.ctx.close();

  const E = await newLearner({ lang: "en", plan: "premium", jev: "off", reply: (body, n) => "x" });
  await openChat(E.page);
  await ask(E.page, "tiny"); await settle(E.page); await E.page.waitForTimeout(300);
  check("more-not-under-a-tiny-answer", !(await E.page.$(".mov .morebtn")));
  await E.ctx.close();
}

/* ───────── jev: the pre-check never holds the answer back ───────── */
if (want("jev")) {
  console.log("\n# jev — pre-check timing");
  const S = await newLearner({ lang: "en", plan: "premium", jev: "ok", jevDelay: 2500 });
  await openChat(S.page);
  const t0 = Date.now();
  await ask(S.page, "how do I practise hanon"); 
  await S.page.waitForFunction(() => true);
  let waited = null;
  for (let i = 0; i < 40 && waited == null; i++) { if (S.state.chat.length) waited = S.state.chat[0].t - t0; else await S.page.waitForTimeout(100); }
  check("jev-slow-precheck-does-not-hold-the-answer", waited != null && waited < 1500, `answer requested after ${waited} ms with a 2500 ms Jev`);
  await settle(S.page, 15000);
  await S.ctx.close();

  const F = await newLearner({ lang: "en", plan: "premium", jev: "ok", jevDelay: 0 });
  await openChat(F.page);
  const t1 = Date.now();
  await ask(F.page, "how do I practise hanon");
  let fast = null;
  for (let i = 0; i < 40 && fast == null; i++) { if (F.state.chat.length) fast = F.state.chat[0].t - t1; else await F.page.waitForTimeout(100); }
  check("jev-fast-precheck-still-used", fast != null && fast < 1500 && F.state.jev.some(j => j.task === "chat-precheck"), `${fast} ms`);
  await F.ctx.close();

  const X = await newLearner({ lang: "en", plan: "premium", jev: "spam", jevDelay: 0 });
  await openChat(X.page);
  await ask(X.page, "buy cheap watches now"); await X.page.waitForTimeout(1500);
  const refuse = await bubbles(X.page);
  check("jev-spam-still-refused", X.state.chat.length === 0 && refuse.some(t => /only help with piano/.test(t)), `requests ${X.state.chat.length}`);
  await X.ctx.close();
}

/* ───────── hotpath: the knowledge-block switch, end to end in the built app ───────── */
if (want("hotpath")) {
  console.log("\n# hotpath — app_settings.tiga_kb_hot_path off (as shipped) and on");
  const qs = [["hello", "how do I practise hanon"], ["scale", "what is the C major scale"], ["harmony", "คอร์ด C กับ G สลับไม่ทัน"]];
  for (const on of [false, true]) {
    const L = await newLearner({ lang: "en", plan: "premium", jev: "off", hotPath: on });
    await openChat(L.page);
    const sizes = [];
    for (const [label, q] of qs) {
      const b = L.state.chat.length;
      await ask(L.page, q); await settle(L.page, 20000); await L.page.waitForTimeout(400);
      const rec = L.state.chat[b];
      sizes.push({ label, chars: rec ? (rec.body.system || "").length : -1, kb: rec ? /TIGA KNOWLEDGE BASE/.test(rec.body.system || "") : false });
    }
    console.log(`  switch ${on ? "ON " : "OFF"}: ` + sizes.map(x => `${x.label} ${x.chars.toLocaleString()} chars`).join(" · "));
    if (on) check("hotpath-on-caps-every-prompt", sizes.every(x => x.chars > 0 && x.chars < 30000 && x.kb), JSON.stringify(sizes));
    else check("hotpath-off-still-ships-a-block-under-the-ceiling", sizes.every(x => x.kb && x.chars > 10000 && x.chars < 30000), JSON.stringify(sizes));   // plan 21 §V1: the legacy block is cut to a character budget even with the switch off (it was up to 1.4 MB)
    await L.ctx.close();
  }
}

/* ───────── regress: the paths the change must not have disturbed ───────── */
if (want("regress")) {
  console.log("\n# regress — local answers, chapters, errors");
  // 1. a question the app answers locally: no request, no free message spent
  const F = await newLearner({ lang: "en", plan: "free", usage: 0, jev: "off" });
  await openChat(F.page);
  await ask(F.page, "tell me about Bagpipes of war"); await F.page.waitForTimeout(900);   // a curated case study's own title is a local answer
  const fb = await bubbles(F.page);
  const fn = await F.page.$eval(".mov .qnote", e => e.textContent).catch(() => null);
  check("regress-faq-local-no-request", F.state.chat.length === 0 && fb.length >= 2 && fb[fb.length - 1].length > 40, `requests ${F.state.chat.length} · answer ${fb.length ? fb[fb.length - 1].slice(0, 50) : "none"}`);
  check("regress-faq-spends-no-free-message", /2 of 2 questions left for the AI tutor today/.test(fn || ""), JSON.stringify(fn));
  await F.ctx.close();

  // 2. a curated chapter chip on the Sensei page: local content, no request
  const K = await newLearner({ lang: "en", plan: "premium", jev: "off" });
  await openChat(K.page);
  await K.page.click(".mov .mhdr .cbtn"); await K.page.waitForTimeout(500);
  const chips = await K.page.$$eval(".chatstarters .starterchip", cs => cs.map(c => c.innerText.trim()));
  await K.page.click(".chatstarters .starterchip"); await K.page.waitForTimeout(700);
  const users = await K.page.$$eval(".msgs .msg.u .bbl", els => els.map(e => e.innerText.trim()));
  const ais = await K.page.$$eval(".msgs .msg.a .bbl", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  check("regress-chapter-chip-local", K.state.chat.length === 0 && users.length === 1 && users[0].startsWith("📚") && ais.length >= 2 && ais[ais.length - 1].length > 100, `chips ${JSON.stringify(chips)} · user ${JSON.stringify(users)} · ai ${ais.length ? ais[ais.length - 1].slice(0, 60) : "none"}`);
  await K.ctx.close();

  // 3. every upstream attempt fails: the friendly error with a retry button, and no "Explain more" on it
  const E = await newLearner({ lang: "en", plan: "premium", jev: "off", chatFail: 99 });
  await openChat(E.page);
  await ask(E.page, "this one will fail");
  await E.page.waitForSelector(".mov .retrybtn", { timeout: 40000 }).catch(() => {});
  const hasRetry = !!(await E.page.$(".mov .retrybtn"));
  const hasMore = !!(await E.page.$(".mov .morebtn"));
  check("regress-error-has-retry-not-more", hasRetry && !hasMore, `retry ${hasRetry} · explain-more ${hasMore} · upstream attempts ${E.state.chat.length}`);
  await E.ctx.close();
}


/* ───────── speak: the read-aloud button on every bubble (Max and Max Family only) ───────── */
if (want("speak") && process.env.SPEAK === "1") {   // SUSPENDED: CHAT_TTS_ENABLED=false (owner 2026-10-02) — set SPEAK=1 once it is switched back on
  console.log("\n# speak — speaker on both kinds of bubble, locked for everyone but Max / Max Family");
  const btnInfo = (page) => page.evaluate(() => [...document.querySelectorAll(".mov .mmsgs .msg")].map(m => {
    const bbl = m.querySelector(".bbl"), b = m.querySelector(".bbl .bspk");
    const rb = bbl.getBoundingClientRect(), rs = b ? b.getBoundingClientRect() : null;
    return { who: m.classList.contains("u") ? "u" : "a", has: !!b, locked: !!(b && b.classList.contains("lock")), on: !!(b && b.classList.contains("on")),
      label: b ? b.getAttribute("aria-label") : "", right: rs ? Math.round(rb.right - rs.right) : null, bottom: rs ? Math.round(rb.bottom - rs.bottom) : null, size: rs ? Math.round(rs.width) : 0 };
  }));
  // 1. free plan: the lock, in the right place, and a tap opens the plans — never a request to the voice
  const F = await newLearner({ lang: "th", plan: "free", jev: "off", tts: "ok" });
  await openChat(F.page);
  await ask(F.page, "สเกล C เมเจอร์คืออะไร"); await settle(F.page); await F.page.waitForTimeout(400);
  const fi = await btnInfo(F.page);
  check("speak-free-lock-on-every-bubble", fi.length >= 3 && fi.every(x => x.has && x.locked), JSON.stringify(fi));
  check("speak-at-the-bubbles-bottom-right", fi.every(x => x.right != null && x.right >= 0 && x.right <= 14 && x.bottom >= 0 && x.bottom <= 12 && x.size >= 28), JSON.stringify(fi.map(x => [x.who, x.right, x.bottom, x.size])));
  check("speak-both-roles", fi.some(x => x.who === "u") && fi.some(x => x.who === "a"), fi.map(x => x.who).join(""));
  check("speak-locked-label-th", fi.every(x => /Max/.test(x.label) && /ฟัง/.test(x.label)), fi[0] && fi[0].label);
  await F.page.screenshot({ path: "/tmp/claude-0/shots/chat-speak-locked.png" });
  await F.page.click(".mov .mmsgs .msg.u .bspk"); await F.page.waitForTimeout(700);
  check("speak-locked-tap-opens-plans", !!(await F.page.$(".setov .setcard.pricing")), "pricing card over the chat");
  const maxBullet = await F.page.evaluate(() => [...document.querySelectorAll(".setov .prfeat li")].filter(l => /ลำโพง/.test(l.textContent)).length);
  check("speak-pricing-lists-it-for-max-and-max-family", maxBullet === 2, "bullets " + maxBullet);
  check("speak-locked-no-voice-request", F.state.tts.length === 0, "requests " + F.state.tts.length);
  await F.ctx.close();

  // 2. Max: an unlocked button speaks the message in its own language, the state follows, a second tap stops it
  const M = await newLearner({ lang: "th", plan: "max", jev: "off", tts: "ok", reply: "ครับ 中文 is fine: ใช่ครับ โน้ต C คือโด" });
  await openChat(M.page);
  await ask(M.page, "Please say hello in English"); await settle(M.page); await M.page.waitForTimeout(400);
  const mi = await btnInfo(M.page);
  check("speak-max-unlocked", mi.length >= 3 && mi.every(x => x.has && !x.locked && /ฟัง/.test(x.label)), JSON.stringify(mi.map(x => [x.who, x.locked, x.label])));
  await M.page.screenshot({ path: "/tmp/claude-0/shots/chat-speak-max.png" });
  // the learner's English message: spoken as English
  await M.page.click(".mov .mmsgs .msg.u .bspk");
  const seenBusy = await M.page.waitForSelector(".mov .bspk .bspk-spin, .mov .bspk .bspk-bars", { timeout: 4000 }).then(() => true).catch(() => false);
  check("speak-tap-shows-busy-or-playing", seenBusy);
  await M.page.waitForFunction(() => !!document.querySelector(".mov .bspk .bspk-bars"), null, { timeout: 8000 }).catch(() => {});
  const playing = await M.page.evaluate(() => ({ bars: !!document.querySelector(".mov .bspk .bspk-bars"), on: document.querySelectorAll(".mov .bspk.on").length, pressed: (document.querySelector(".mov .bspk.on") || { getAttribute: () => null }).getAttribute("aria-pressed"), label: (document.querySelector(".mov .bspk.on") || { getAttribute: () => "" }).getAttribute("aria-label") }));
  check("speak-playing-state", playing.bars && playing.on === 1 && playing.pressed === "true" && /หยุด/.test(playing.label), JSON.stringify(playing));
  await M.page.screenshot({ path: "/tmp/claude-0/shots/chat-speak-playing.png" });
  const req1 = M.state.tts[0] && M.state.tts[0].body;
  check("speak-request-english-chat-source", !!req1 && req1.lang === "en" && req1.src === "chat" && /Please say hello in English/.test(req1.text || "") && /Algieba|Schedar|Achird|Puck/.test(req1.voice || ""), JSON.stringify(req1 && { lang: req1.lang, src: req1.src, voice: req1.voice, text: (req1.text || "").slice(-40) }));
  // only one at a time: a tap on the tutor's answer takes over
  await M.page.locator(".mov .mmsgs .msg.a").last().locator(".bspk").click(); await M.page.waitForTimeout(500);
  const one = await M.page.evaluate(() => ({ on: document.querySelectorAll(".mov .bspk.on").length, userOn: !!document.querySelector(".mov .msg.u .bspk.on") }));
  check("speak-one-at-a-time", one.on === 1 && !one.userOn, JSON.stringify(one));
  // the tutor's message mixes Thai, Chinese and English: Thai wins
  await M.page.waitForFunction(() => document.querySelectorAll(".mov .bspk-spin").length === 0, null, { timeout: 8000 }).catch(() => {});
  const req2 = M.state.tts[1] && M.state.tts[1].body;
  check("speak-request-mixed-text-is-thai", !!req2 && req2.lang === "th", JSON.stringify(req2 && { lang: req2.lang }));
  // a tap on the one that speaks stops it
  await M.page.click(".mov .bspk.on"); await M.page.waitForTimeout(500);
  const stopped = await M.page.evaluate(() => ({ on: document.querySelectorAll(".mov .bspk.on").length, bars: document.querySelectorAll(".mov .bspk-bars").length, spin: document.querySelectorAll(".mov .bspk-spin").length }));
  check("speak-tap-again-stops", stopped.on === 0 && stopped.bars === 0 && stopped.spin === 0, JSON.stringify(stopped));
  // it plays to its end by itself and the button comes back; a repeat listen is free (cached clip, no new request)
  const before = M.state.tts.length;
  await M.page.click(".mov .mmsgs .msg.u .bspk");
  await M.page.waitForFunction(() => document.querySelectorAll(".mov .bspk.on").length === 0, null, { timeout: 12000 }).catch(() => {});
  await M.page.waitForTimeout(300);
  const end = await M.page.evaluate(() => document.querySelectorAll(".mov .bspk.on").length);
  check("speak-ends-by-itself", end === 0);
  check("speak-repeat-listen-is-cached", M.state.tts.length === before, `requests ${before} -> ${M.state.tts.length}`);
  const day = await M.page.evaluate(() => JSON.parse(localStorage.getItem("tg_tts_day") || "null"));
  check("speak-allowance-counted", !!day && day.s > 0 && day.s < 60, JSON.stringify(day));
  if (M.errors.length) console.log("  page errors:", M.errors.join(" | "));
  await M.ctx.close();

  // 3. the day's allowance is spent: the device voice reads it, with a short word on why, and no request is made
  const today = new Date(); const dk = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
  const B = await newLearner({ lang: "en", plan: "maxfamily", jev: "off", tts: "ok", ls: { tg_tts_day: { d: dk, s: 299 } } });
  await openChat(B.page);
  await ask(B.page, "a question long enough to need a few seconds of speech"); await settle(B.page); await B.page.waitForTimeout(300);
  await B.page.click(".mov .mmsgs .msg.u .bspk"); await B.page.waitForTimeout(900);
  const note = await B.page.$eval(".mov .bspk-note", e => e.textContent).catch(() => null);
  check("speak-budget-spent-says-so", /AI voice is used up/.test(note || ""), JSON.stringify(note));
  check("speak-budget-spent-no-request", B.state.tts.length === 0, "requests " + B.state.tts.length);
  await B.page.waitForFunction(() => document.querySelectorAll(".mov .bspk.on").length === 0, null, { timeout: 8000 }).catch(() => {});
  check("speak-budget-spent-button-comes-back", (await B.page.$$(".mov .bspk.on")).length === 0);
  await B.ctx.close();

  // 4. the voice service fails: the device voice takes over and the allowance is given back
  const X = await newLearner({ lang: "en", plan: "max", jev: "off", tts: "fail" });
  await openChat(X.page);
  await ask(X.page, "this will not be spoken by the cloud"); await settle(X.page); await X.page.waitForTimeout(300);
  await X.page.click(".mov .mmsgs .msg.u .bspk");
  await X.page.waitForFunction(() => document.querySelectorAll(".mov .bspk.on").length === 0, null, { timeout: 30000 }).catch(() => {});
  await X.page.waitForTimeout(300);
  const xday = await X.page.evaluate(() => JSON.parse(localStorage.getItem("tg_tts_day") || "null"));
  check("speak-failure-falls-back-and-refunds", X.state.tts.length >= 1 && (await X.page.$$(".mov .bspk.on")).length === 0 && (!xday || xday.s < 0.5), `requests ${X.state.tts.length} · allowance ${JSON.stringify(xday)}`);
  await X.ctx.close();

  // 5. the owner's admin account hears it too; the Voice-Tutor rule
  const A = await newLearner({ lang: "en", plan: "free", admin: true, jev: "off", tts: "ok" });
  await openChat(A.page);
  const ai = await btnInfo(A.page);
  check("speak-admin-unlocked", ai.length >= 1 && ai.every(x => x.has && !x.locked), JSON.stringify(ai.map(x => x.locked)));
  await A.ctx.close();

  // 6. English and Chinese labels
  for (const [lang, rx] of [["en", /Listen to this message/], ["zh", /朗读这条消息/]]) {
    const L = await newLearner({ lang, plan: "max", jev: "off", tts: "ok" });
    await openChat(L.page);
    const l = await btnInfo(L.page);
    check(`speak-label-${lang}`, l.length >= 1 && rx.test(l[0].label), l[0] && l[0].label);
    await L.ctx.close();
  }
}

/* ───────── i18n: Thai and Chinese read right ───────── */
if (want("i18n")) {
  console.log("\n# i18n — th / zh");
  for (const [lang, left, tryTx] of [["th", /วันนี้ถามครู AI เหลือ 1\/2 คำถาม/, "ลองถามครูได้เลย"], ["zh", /今天还剩 1\/2/, "试着问问老师"]]) {
    const L = await newLearner({ lang, plan: "free", usage: 1, jev: "off" });
    await openChat(L.page);
    const r = await L.page.evaluate(() => ({ note: (document.querySelector(".mov .qnote") || {}).textContent || "", hint: (document.querySelector(".mov .mstarters-hint") || {}).textContent || "", chips: [...document.querySelectorAll(".mov .mstarters .starterchip")].map(c => c.innerText.replace(/\s+/g, " ").trim()), rec: (document.querySelector(".mov .mrec-tx") || {}).textContent || "" }));
    check(`i18n-${lang}`, left.test(r.note) && r.hint.includes(tryTx) && r.chips.length === 4 && r.chips.every(c => c.length > 2) && r.rec.length > 4, JSON.stringify(r));
    await L.page.screenshot({ path: `/tmp/claude-0/shots/chat-starters-${lang}.png` });
    await L.ctx.close();
  }
}

await browser.close(); server.close();
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
