#!/usr/bin/env node
/* smoke-blog-gate.mjs — the PREVIEW GATE on the blog article pages, in all eleven languages of the blog
   (owner 2026-11-21: "readers may read only 30% of an article; to read the other 70% they log in or sign up, with Google or e-mail; say that it is free and needs no credit card").
   It replaces the 3-second pop-up wall of 2026-11-16 (history in docs/agents-history.md). Rules under test: the page cuts the article at about 30% of its text, at a block boundary, never after a heading; the rest stays in
   the HTML inside .tg-locked; a guest (no Supabase session, no crawler) sees the preview, a fade and the unlock card (free / no credit card / 7-day trial / Google / sign up / log in) and the locked part is hidden; a member, a
   crawler and a browser without JavaScript see the whole article; the gate lifts when a session appears (same tab or another tab); the page also counts and shows the readers (views / reads / card shown / taps).
   No network and no repo files touched: scripts/build-blog-pages.mjs is run with BLOG_FIXTURE / BLOG_OUT / SITE_URL into a temp folder, served locally and driven in Chromium.
   The 3-second reading time of the "read" count is shortened through the test door (localStorage.tg_test_hook = "1" + ?read_ms=<ms>).
     node scripts/smoke-blog-gate.mjs */
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import http from "node:http"; import { execSync, execFileSync } from "node:child_process"; import { pathToFileURL, fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-gate-")); const out = path.join(tmp, "blog");
const G = await import(pathToFileURL(path.join(ROOT, "scripts/blog-gate.mjs")).href);
// th / en / zh are database rows in production; the page code is the same for ja / ko / ru / hi / es / fr / ar, which ship as source files, so the same fixture rows give their pages here (the generator writes their index itself).
// All eleven languages have a row, so every page carries the full hreflang cluster of eleven. de (2026-11-20) has no source file and no feed here: its pages come from rows like th / en / zh, so it joins the page checks but not the feed check.
const LANGS = ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar", "de"], NEWL = ["hi", "es", "fr", "ar"], PAGEL = [...NEWL, "de"];
const TITLES = { th: "ท่านั่งเล่นเปียโน", en: "Piano posture", zh: "钢琴坐姿", ja: "ピアノの姿勢と座り方", ko: "피아노 자세와 앉는 법", ru: "Посадка за фортепиано", hi: "पियानो बजाते समय बैठने का सही तरीका", es: "Postura correcta al sentarse al piano", fr: "La bonne posture au piano", ar: "وضعية الجلوس الصحيحة: 15 دقيقة في TIGA ALPHA", de: "Die richtige Haltung am Klavier" };
const para = (w, n) => (w + " ").repeat(n).trim() + ".";
// an article with headings, paragraphs and two lists: about 3,400 characters
const BODY = ["# Heading one", para("alpha", 60), para("bravo", 80), "## Heading two", para("charlie", 70), "- item one", "- item two", para("delta", 90), "### Heading three", para("echo", 100), para("foxtrot", 60), "1. one", "2. two", para("golf", 80)].join("\n");
const SHORT = ["# Short", para("tiny", 10), para("small", 10)].join("\n");
const BIGFIRST = [para("huge", 900), para("tail", 20), para("tail2", 20)].join("\n");
const mk = (lang, slug, title, body) => ({ id: slug + "-" + lang, lang, slug, category: "tips", title, excerpt: "x", body, cover_url: null, published: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" });
const posts = [...LANGS.map((lang) => mk(lang, "piano-posture", TITLES[lang], BODY)), mk("en", "short-note", "A short note", SHORT), mk("en", "big-first", "One big block", BIGFIRST)];
fs.writeFileSync(path.join(tmp, "posts.json"), JSON.stringify(posts));
const server = http.createServer((q, s) => { let f = path.join(tmp, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { s.writeHead(404); return s.end("nf"); } s.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain" }); s.end(fs.readFileSync(f)); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port;
const gen = (env) => execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_SRC: path.join(tmp, "no-static-sources"), ...env }, stdio: "pipe" });
gen({ BLOG_FIXTURE: path.join(tmp, "posts.json"), BLOG_OUT: out, SITE_URL: ORIGIN });
// Since 43e18595a the generator no longer bakes the th / en / zh index pages (the on-demand function renders them from the database), so this test writes them the same way the function does.
{ process.env.SITE_URL = ORIGIN; const { indexHtml } = await import(pathToFileURL(path.join(ROOT, "scripts/build-blog-pages.mjs")).href + "?idx=" + Date.now());
  for (const lang of ["th", "en", "zh"]) fs.writeFileSync(path.join(out, lang, "index.html"), indexHtml(lang, posts)); }
const pwm = await import("playwright").catch(async () => import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href)); const pw = pwm.chromium ? pwm : pwm.default;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
const errs = [];
// HeadlessChrome is in the page's crawler list on purpose (a prerender or an audit must not inflate the numbers), so every reader here is an ordinary Chrome
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
async function open(lang, { ms = 1500, session = false, w = 1000, h = 720, hidden = false, ua = UA, rpc = null, js = true, slug = "piano-posture", hook = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, userAgent: ua, javaScriptEnabled: js });
  const calls = await stubRpc(ctx, rpc || {});
  if (js) await ctx.addInitScript(([s, hid, hk]) => { try { if (hk) localStorage.setItem("tg_test_hook", "1"); if (s) localStorage.setItem("sb-abcdefgh-auth-token", JSON.stringify({ access_token: "x" })); } catch (e) {} if (hid) Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); }, [session, hidden, hook]);
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(`${ORIGIN}/blog/${lang}/${slug}.html${hook ? "?read_ms=" + ms : ""}`);
  return { ctx, page, calls };
}

// A stand-in for the Supabase REST calls the page makes (nothing leaves the machine): records what the page sent and answers like public.blog_hit / blog_view_counts.
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "apikey, authorization, content-type", "access-control-allow-methods": "POST, OPTIONS" };
async function stubRpc(ctx, { views = 1234, counts = [], missing = false } = {}) {
  const calls = [];
  await ctx.route("**/rest/v1/rpc/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const name = req.url().split("/rpc/")[1]; let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch (e) {}
    calls.push({ name, ...body });
    if (missing) return route.fulfill({ status: 404, headers: CORS, contentType: "application/json", body: JSON.stringify({ message: "function not found" }) });
    route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(name === "blog_view_counts" ? counts : views) });
  });
  return calls;
}
// what a reader can see right now: is the class on <html>, is the locked part visible, is the card visible
const st = (page) => page.evaluate(() => { const l = document.getElementById("tg-locked"), u = document.getElementById("tg-unlock"); const vis = (e) => !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0; return { gated: document.documentElement.classList.contains("tg-gated"), locked: vis(l), card: vis(u) }; });
const GUEST = (s) => s.gated && !s.locked && s.card, WHOLE = (s) => !s.gated && s.locked && !s.card;
const read = (lang, slug = "piano-posture") => fs.readFileSync(path.join(tmp, "blog", lang, slug + ".html"), "utf8");
const baseOf = (lang, slug = "piano-posture") => `${ORIGIN}/?utm_source=blog&utm_medium=seo&utm_campaign=${slug}&lg=${lang}`;

console.log("the cut (pure functions)");
{
  const blocks = (xs) => xs.map(([tag, n]) => `<${tag}>${"x".repeat(n)}</${tag}>`);
  let c = G.cutPoint(blocks([["p", 300], ["p", 300], ["p", 300], ["p", 300], ["p", 300], ["p", 300], ["p", 300], ["p", 300], ["p", 300], ["p", 300]]));
  ok(c && c.k === 3 && c.pct === 30, "ten equal blocks: the preview is 3 blocks, 30% (" + JSON.stringify(c) + ")");
  c = G.cutPoint(blocks([["h2", 20], ["p", 400], ["h2", 20], ["p", 400], ["p", 400], ["p", 400], ["p", 400], ["p", 400]]));
  ok(c && !/^h/.test(blocks([["h2", 20], ["p", 400], ["h2", 20], ["p", 400], ["p", 400], ["p", 400], ["p", 400], ["p", 400]])[c.k - 1].slice(1, 3)), "the preview never ends on a heading");
  c = G.cutPoint(blocks([["p", 500], ["h2", 20], ["p", 400], ["p", 400], ["p", 400], ["p", 400], ["p", 400]]));
  ok(c && c.k !== 2, "a cut right after a heading is skipped (k=" + (c && c.k) + ")");
  ok(G.cutPoint(blocks([["p", 100], ["p", 100]])) === null, "fewer than three blocks: not gated");
  ok(G.cutPoint(blocks([["p", 100], ["p", 100], ["p", 100]])) === null, "300 characters in all: too short to gate");
  ok(G.cutPoint(blocks([["p", 3000], ["p", 100], ["p", 100]])) === null, "a first block that is most of the article: left whole instead of claiming 30%");
  c = G.cutPoint(blocks([["p", 200], ["p", 200], ["p", 200], ["p", 200], ["p", 200], ["p", 200]]));
  ok(c && c.pct >= 15 && c.pct <= 45, "the preview is near 30% (" + c.pct + "%)");
  ok(G.textLen("<p>ab &amp; c</p>") === 6 && G.textLen("<p>ภาษาไทย</p>") === 7, "characters are counted (an entity is one, Thai counts per character)");
  const plainT = blocks([["p", 300], ["p", 300], ["p", 300], ["p", 300], ["p", 300], ["p", 300]]).join("\n") + '<nav class="rel"><h2>R</h2></nav><p><a class="cta" href="x">go</a></p>';
  const g = G.gateTail(plainT, { lang: "en", base: "https://x.test/?a=b" });
  ok(g.gated && g.html.includes("tg-locked") && g.html.indexOf('<nav class="rel"') > g.html.indexOf('class="tg-locked"') && g.html.endsWith(G.CUT_CLOSE), "the related list and the call-to-action sit inside the locked part");
  ok(G.ungateInner(g.html) === plainT, "un-cutting gives back exactly what was cut");
  const again = G.gateTail(G.ungateInner(g.html), { lang: "en", base: "https://x.test/?a=b" });
  ok(again.html === g.html, "cutting twice gives the same page");
}

console.log("generated pages");
{
  const html = read("th");
  ok(html.includes("<!--tg-cut:v1-->") && html.includes("<!--/tg-cut-->") && (html.match(/id="tg-unlock"/g) || []).length === 1 && (html.match(/class="tg-locked"/g) || []).length === 1, "th: one cut, one unlock card, one locked part");
  ok(/<aside class="tg-unlock" id="tg-unlock" data-nosnippet/.test(html), "the card is marked data-nosnippet (it never replaces the article's snippet)");
  ok(html.includes("<!--tg-gate:v8-->") && html.includes("<!--/tg-gate-->") && !html.includes('id="tg-gate"') && !html.includes("tg-g-card") && !/MS=3000,READ=0,OPEN/.test(html), "the reader block is tg-gate:v8 and the old pop-up wall is gone");
  ok(html.includes("utm_source=blog") && html.includes("utm_campaign=piano-posture") && html.includes("go=google") && html.includes("wall=signup") && html.includes("wall=login"), "links carry the blog attribution, go=google, wall=signup, wall=login");
  ok(!fs.readFileSync(path.join(tmp, "blog", "th", "index.html"), "utf8").includes("tg-cut") && !fs.readFileSync(path.join(tmp, "blog", "th", "index.html"), "utf8").includes("tg-unlock"), "the article index has no gate");
  ok(html.includes('"isAccessibleForFree":false') && html.includes('"cssSelector":".tg-locked"') && !html.includes('"cssSelector":"article"'), "the article's JSON-LD names the gated part (isAccessibleForFree false, cssSelector .tg-locked)");
  ok(!/data-gate-close|tg-g-x|tg-g-later/.test(html), "no close button of the old wall is left");
  ok(G.BOT_SRC.length > 50 && html.includes(G.BOT_SRC) && (html.match(new RegExp(G.BOT_SRC.replace(/\|/g, "\\|"), "g")) || []).length === 2, "the crawler list is the same in the early script and the reader script (BOT_SRC)");
}
for (const l of LANGS) {
  const h = read(l), T = G.UNLOCK_T[l];
  ok(h.includes("<!--tg-cut:v1-->") && (h.match(/id="tg-unlock"/g) || []).length === 1 && h.includes("<!--tg-gate:v8-->") && !h.includes('id="tg-gate"'), l + ": one cut and one card, reader block v8, no old wall");
  const HL = l === "zh" ? "zh-Hans" : l;   // the page language tag of Chinese is zh-Hans
  ok(h.includes('"isAccessibleForFree":false') && h.includes('"cssSelector":".tg-locked"') && h.includes(`"inLanguage":"${HL}"`), l + ": the JSON-LD names the gated part and its language is " + HL);
  ok(h.includes("utm_source=blog") && h.includes("utm_campaign=piano-posture") && h.includes("lg=" + l) && h.includes("go=google") && h.includes("wall=signup") && h.includes("wall=login"), l + ": links carry the blog attribution and lg=" + l);
  ok(h.includes(`<html lang="${HL}"${l === "ar" ? ' dir="rtl"' : ""}>`) && (l === "ar") === /\[dir=rtl\]/.test(h), l + (l === "ar" ? ': <html lang="ar" dir="rtl"> and the right-to-left rules' : ": no dir attribute, no right-to-left rule"));
  const alts = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => m[1]);
  ok(alts.length === 12 && ["th", "en", "zh-Hans", "ja", "ko", "ru", "hi", "es", "fr", "ar", "de"].every(x => alts.includes(x)) && alts.includes("x-default") && h.includes(`hreflang="x-default" href="${ORIGIN}/blog/en/piano-posture.html"`), l + ": the hreflang cluster lists all eleven languages and x-default (English)");
  // the share the card names is the real share of the article text that sits before the cut
  const art = h.slice(h.indexOf("<article>"), h.lastIndexOf("</article>")), pre = art.slice(art.indexOf("</time></p>") + 11, art.indexOf("<!--tg-cut:v1-->")), lockedPart = art.slice(art.indexOf('<div class="tg-locked"'), art.indexOf('<nav class="rel"') > 0 ? art.indexOf('<nav class="rel"') : art.indexOf('<p><a class="cta"'));
  const real = Math.round(100 * G.textLen(pre) / (G.textLen(pre) + G.textLen(lockedPart))), said = +(/class="tg-u-bar"[^>]*><i style="width:(\d+)%/.exec(h) || [])[1];
  ok(said === real && said >= 15 && said <= 45, l + ": the card names the real share (" + said + "% said, " + real + "% measured)");
  ok(/<\/(p|ul|ol)>\n$/.test(pre) && !/<h[1-6][^>]*>[^<]*<\/h[1-6]>\n$/.test(pre), l + ": the preview ends on a paragraph or a list, never on a heading");
  ok(T.kicker.includes("{n}") && T.title.includes("{m}") && !h.includes("{n}") && !h.includes("{m}"), l + ": the card's {n} and {m} are filled in");
}
{
  const ix = fs.readFileSync(path.join(tmp, "blog", "ar", "index.html"), "utf8");
  ok(ix.includes('<html lang="ar" dir="rtl">') && !ix.includes("tg-cut") && ix.includes("blog_view_counts") && ix.includes('toLocaleString("ar-u-nu-latn")'), "ar: the index is right-to-left, has no gate, and its card counter formats with Western digits (ar-u-nu-latn)");
  ok(NEWL.every(l => fs.existsSync(path.join(tmp, "blog", l, "feed.xml")) && fs.readFileSync(path.join(tmp, "blog", l, "feed.xml"), "utf8").includes(`<language>${l}</language>`)), "hi / es / fr / ar: each has a feed with its own <language> tag");
  const sh = read("en", "short-note"), bf = read("en", "big-first");
  ok(!sh.includes("tg-cut") && !sh.includes("tg-locked") && !sh.includes("isAccessibleForFree") && sh.includes("<!--tg-gate:v8-->"), "a short article is left whole: no cut, no gating markup (it still counts its readers)");
  ok(!bf.includes("tg-cut") && !bf.includes("isAccessibleForFree"), "an article whose first block is most of it is left whole as well");
}

console.log("what each kind of reader sees (every language)");
// the words of the card, per language: the claim that it is free, the claim that no credit card is needed, the 7-day trial, the three buttons
const WORDS = {
  th: ["คุณอ่านบทความนี้ไปแล้ว", "ล็อกอินฟรีเพื่ออ่านต่ออีก", "ใช้ฟรี", "ไม่ต้องใช้บัตรเครดิต", "ฟรี 7 วัน", "ล็อกอินด้วย Google", "สมัครสมาชิกฟรี", "เข้าสู่ระบบ"],
  en: ["You've read", "Log in free to read the other", "Free to use", "No credit card needed", "free for 7 days", "Continue with Google", "Sign up free", "Log in"],
  zh: ["你已阅读本文", "免费登录，阅读剩余", "免费使用", "无需信用卡", "免费试学钢琴 7 天", "使用 Google 继续", "免费注册", "登录"],
  ja: ["この記事を", "無料ログインで、残りの", "無料で使えます", "クレジットカードは不要", "7日間無料", "Googleで続ける", "無料で会員登録", "ログイン"],
  ko: ["이 글을", "무료로 로그인하고 나머지", "무료로 이용", "신용카드 필요 없음", "7일 동안 무료", "Google로 계속하기", "무료로 가입하기", "로그인"],
  ru: ["Вы прочитали", "Войдите бесплатно, чтобы прочитать остальные", "Бесплатно", "Банковская карта не нужна", "7 дней бесплатно", "Продолжить через Google", "Зарегистрироваться бесплатно", "Войти"],
  hi: ["आप इस लेख का", "पढ़ने के लिए मुफ़्त में लॉग इन करें", "मुफ़्त में इस्तेमाल करें", "क्रेडिट कार्ड की ज़रूरत नहीं", "7 दिन तक पियानो के पाठ मुफ़्त", "Google से जारी रखें", "मुफ़्त में साइन अप करें", "लॉग इन करें"],
  es: ["Has leído el", "Inicia sesión gratis para leer el", "Gratis", "Sin tarjeta de crédito", "gratis durante 7 días", "Continuar con Google", "Regístrate gratis", "Inicia sesión"],
  fr: ["Vous avez lu", "Connectez-vous gratuitement pour lire les", "Gratuit", "Sans carte bancaire", "gratuitement les cours de piano pendant 7 jours", "Continuer avec Google", "S'inscrire gratuitement", "Se connecter"],
  ar: ["لقد قرأت", "سجّل الدخول مجانًا لقراءة بقية المقال", "مجاني", "دون بطاقة ائتمان", "مجانًا لمدة 7 أيام", "المتابعة باستخدام Google", "إنشاء حساب مجاني", "تسجيل الدخول"],
  de: ["Du hast", "Melde dich kostenlos an, um die restlichen", "Kostenlos nutzbar", "Keine Kreditkarte nötig", "7 Tage kostenlos", "Weiter mit Google", "Kostenlos registrieren", "Anmelden"],
};
for (const lang of LANGS) {
  console.log(lang);
  const g = await open(lang);
  await g.page.waitForTimeout(300);
  const s = await st(g.page);
  ok(GUEST(s), "a guest sees the preview and the card, and the locked part is hidden (" + JSON.stringify(s) + ")");
  const txt = (await g.page.evaluate(() => document.getElementById("tg-unlock").innerText)).replace(/\xa0/g, " ");
  ok(WORDS[lang].every(x => txt.includes(x)), "the card speaks " + lang + ": free, no credit card, the 7-day trial, three buttons (" + WORDS[lang].slice(0, 2).join(" / ") + ")");
  ok(/(^|\D)\d{2}(\D|$)/.test(txt) && txt.includes("TIGA") && txt.includes("AI"), "it names the share read and the TIGA AI app");
  const cs = await g.page.evaluate(() => ({ dir: getComputedStyle(document.documentElement).direction, ta: getComputedStyle(document.getElementById("tg-unlock")).textAlign, fade: getComputedStyle(document.querySelector(".tg-fade")).display, prevText: document.querySelector("article h1").textContent.length > 0 }));
  ok(cs.dir === (lang === "ar" ? "rtl" : "ltr") && cs.ta === "center" && cs.fade === "block", "text direction " + (lang === "ar" ? "rtl" : "ltr") + ", the card's text is centred, the fade is drawn");
  const hrefs = await g.page.$$eval("#tg-unlock a[data-gate]", as => as.map(a => [a.dataset.gate, a.getAttribute("href")]));
  ok(hrefs.length === 3 && hrefs.map(h => h[0]).join() === "google,signup,login" && hrefs.every(([, h]) => h.startsWith(ORIGIN + "/?") && h.includes("lg=" + lang) && h.includes("utm_source=blog")), "three links into the app (google, signup, login) with the page language and the attribution");
  ok((await g.page.$$eval("#tg-unlock button", b => b.length)) === 0, "no button in it, only links into the app");
  // the locked part is still in the page (hidden, not removed): that is what makes it a gate and not cloaking
  ok(await g.page.evaluate(() => { const l = document.getElementById("tg-locked"); return !!l && l.textContent.length > 1000 && l.querySelectorAll("p").length >= 3; }), "the locked part is in the page, only hidden");
  await g.ctx.close();
  const m = await open(lang, { session: true }); await m.page.waitForTimeout(300);
  ok(WHOLE(await st(m.page)), "a member (a session in this browser) sees the whole article and no card");
  await m.ctx.close();
  const b = await open(lang, { ua: GOOGLEBOT }); await b.page.waitForTimeout(300);
  ok(WHOLE(await st(b.page)), "a crawler (Googlebot) sees the whole article and no card");
  await b.ctx.close();
  const n = await open(lang, { js: false });
  const sn = await n.page.evaluate(() => { const l = document.getElementById("tg-locked"), u = document.getElementById("tg-unlock"); return { locked: getComputedStyle(l).display !== "none", card: getComputedStyle(u).display !== "none" }; });
  ok(sn.locked && !sn.card, "a browser without JavaScript sees the whole article and no card");
  await n.ctx.close();
}

console.log("the gate lifts when a session appears");
{
  const { ctx, page } = await open("en");
  await page.waitForTimeout(300); ok(GUEST(await st(page)), "(first: a guest)");
  await page.evaluate(() => localStorage.setItem("sb-abcdefgh-auth-token", JSON.stringify({ access_token: "x" })));
  await page.waitForTimeout(700);
  ok(WHOLE(await st(page)), "a session appears in this tab: the whole article opens by itself");
  await ctx.close();
}
{
  // the reader logs in in ANOTHER tab of the same browser: the storage event opens this one too
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA }); await stubRpc(ctx, {});
  const a = await ctx.newPage(); a.on("pageerror", e => errs.push(e.message)); await a.goto(`${ORIGIN}/blog/de/piano-posture.html`); await a.waitForTimeout(300);
  ok(GUEST(await st(a)), "de: (first: a guest)");
  const b = await ctx.newPage(); await b.goto(`${ORIGIN}/blog/en/piano-posture.html`);
  await b.evaluate(() => localStorage.setItem("sb-abcdefgh-auth-token", JSON.stringify({ access_token: "x" }))); await a.waitForTimeout(500);
  ok(WHOLE(await st(a)), "a log-in in another tab opens this article at once (storage event)");
  const c = await ctx.newPage(); await c.goto(`${ORIGIN}/blog/th/piano-posture.html`); await c.waitForTimeout(300);
  ok(WHOLE(await st(c)), "and a new article in the same browser is whole from the start");
  await ctx.close();
}
{
  // the early script is what decides, before the locked part is parsed: no session blocks flash. A broken session key (empty) is not a session.
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA }); await stubRpc(ctx, {});
  await ctx.addInitScript(() => { try { localStorage.setItem("sb-abcdefgh-auth-token", ""); localStorage.setItem("something-else-auth-token", "x"); } catch (e) {} });
  const p = await ctx.newPage(); await p.goto(`${ORIGIN}/blog/en/piano-posture.html`); await p.waitForTimeout(300);
  ok(GUEST(await st(p)), "an empty session key, or a key that only looks alike, is not a session");
  await ctx.close();
}
{
  // localStorage blocked (private mode): the reader is a guest, nothing throws
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA }); await stubRpc(ctx, {});
  await ctx.addInitScript(() => { const bad = { get() { throw new Error("denied"); } }; try { Object.defineProperty(window, "localStorage", bad); } catch (e) {} });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); await p.goto(`${ORIGIN}/blog/en/piano-posture.html`); await p.waitForTimeout(300);
  ok(GUEST(await st(p)), "with local storage blocked the reader is a guest, the gate still works and nothing throws");
  await ctx.close();
}

console.log("no flash of the locked text");
{
  // the class is set while the page is still being parsed, before the locked part exists: sample the DOM at every mutation
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA }); await stubRpc(ctx, {});
  await ctx.addInitScript(() => { window.__flash = []; new MutationObserver(() => { const l = document.getElementById("tg-locked"); if (l) window.__flash.push([document.documentElement.classList.contains("tg-gated"), getComputedStyle(l).display]); }).observe(document, { childList: true, subtree: true }); });
  const p = await ctx.newPage(); await p.goto(`${ORIGIN}/blog/en/piano-posture.html`); await p.waitForTimeout(300);
  const f = await p.evaluate(() => window.__flash);
  ok(f.length > 0 && f.every(([g, d]) => g && d === "none"), "from the moment the locked part exists, the page is already gated and the part is display:none (" + f.length + " samples)");
  await ctx.close();
}

console.log("clicking through");
for (const lgx of LANGS) {
  const { ctx, page } = await open(lgx);
  await page.waitForTimeout(300);
  let target = "";
  await page.route("**/*", route => { const u = route.request().url(); if (route.request().isNavigationRequest() && !u.includes("/blog/")) { target = u; return route.fulfill({ status: 200, contentType: "text/html", body: "<title>app</title>" }); } route.continue(); });
  await page.click("#tg-unlock [data-gate=signup]"); await page.waitForTimeout(500);
  ok(target.includes("wall=signup") && target.includes("utm_source=blog") && target.includes("lg=" + lgx), lgx + ": sign up opens the app on its sign-up tab with the attribution");
  const lang = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("tg_guest_profile") || "{}").lang; } catch (e) { return null; } });
  ok(lang === lgx, lgx + ": the app is told to open in the page's language (guest profile lang = " + lang + ")");
  const ret = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("tg_blog_return") || "null"); } catch (e) { return null; } });
  ok(ret && ret.p === `/blog/${lgx}/piano-posture.html` && Math.abs(Date.now() - ret.t) < 60000, lgx + ": the article is remembered for the way back after the log-in (" + (ret && ret.p) + ")");
  await ctx.close();
}

console.log("a phone");
for (const [w, h] of [[390, 844], [320, 568]]) for (const lang of LANGS) {
  const { ctx, page } = await open(lang, { w, h });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => { const card = document.getElementById("tg-unlock"), c = card.getBoundingClientRect(), links = [...card.querySelectorAll("a.tg-u-btn")]; return { l: c.left, r: c.right, w: innerWidth, hs: links.map(b => Math.round(b.getBoundingClientRect().height)), cut: [...card.querySelectorAll("a, li, p")].filter(b => b.scrollWidth > b.clientWidth + 1).length, sx: document.documentElement.scrollWidth > innerWidth, cardH: Math.round(c.height) }; });
  ok(GUEST(await st(page)) && m.l >= 0 && m.r <= m.w && !m.sx && m.cut === 0, lang + " at " + w + " px: the card fits the width, no sideways scroll, no cut-off label (card " + m.cardH + " px high)");
  ok(m.hs.every(x => x >= 44), lang + " at " + w + " px: the Google and sign-up buttons are at least 44 px tall (" + m.hs.join("/") + ")");
  if (process.env.SHOT && w === 390) { await page.evaluate(() => document.getElementById("tg-unlock").scrollIntoView({ block: "center" })); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOT + "-" + lang + "-" + w + ".png" }); }
  await ctx.close();
}

console.log("reader count (owner 2026-11-07)");
// the number is formatted in the page's own locale (hi-IN / es-ES / fr-FR / de-DE / ar with Western digits): es-ES does not group four digits, fr-FR groups with a narrow no-break space
const NUMRE = { th: /1,234/, en: /1,234/, zh: /1,234/, ja: /1,234/, ko: /1,234/, ru: /1\s234/, hi: /1,234/, es: /(^|[^\d.,])1234(?!\d)/, fr: /1\s234/, ar: /1,234/, de: /1\.234/ };
for (const [lang, unit] of [["th", "ยอดวิว"], ["en", "views"], ["zh", "次浏览"], ["hi", "व्यूज़"], ["es", "visualizaciones"], ["fr", "vues"], ["ar", "مشاهدة"], ["de", "Aufrufe"]]) {
  const { ctx, page, calls } = await open(lang, { ms: 1200, rpc: { views: 1234 } });
  await page.waitForFunction(() => { const e = document.querySelector(".tg-views"); return !!e && !e.hidden; }, null, { timeout: 4000 }).catch(() => {});
  const b = await page.evaluate(() => { const e = document.querySelector(".tg-views"); return e ? { text: e.textContent, hidden: e.hidden, inMeta: !!e.closest("article .meta") } : null; });
  ok(b && !b.hidden && NUMRE[lang].test(b.text) && b.text.includes(unit) && b.inMeta, lang + ": the number of readers shows beside the date (" + (b && b.text.trim()) + ")");
  const v = calls.find(c => c.name === "blog_hit" && c.p_kind === "view");
  ok(v && v.p_lang === lang && v.p_slug === "piano-posture" && /^[A-Za-z0-9_-]{8,64}$/.test(v.p_vid), lang + ": one view is sent with the language, the article and a device id");
  ok(!JSON.stringify(calls).match(/email|user_id|@/), lang + ": nothing personal is sent");
  await ctx.close();
}
{
  // a guest: 'view' at once, 'read' after the reading time, 'gate' when half of the card has been on screen, 'click' when a button is tapped
  const { ctx, page, calls } = await open("en", { ms: 1000 });
  await page.waitForTimeout(500); ok(calls.some(c => c.p_kind === "view") && !calls.some(c => c.p_kind === "read"), "no 'read' before the reading time");
  ok(!calls.some(c => c.p_kind === "gate"), "no 'gate' while the card is far below the screen");
  await page.waitForTimeout(1300);
  ok(calls.some(c => c.p_kind === "read"), "a 'read' is sent when the reader stays the reading time (3 s in production)");
  await page.evaluate(() => document.getElementById("tg-unlock").scrollIntoView({ block: "center" })); await page.waitForTimeout(600);
  ok(calls.filter(c => c.p_kind === "gate").length === 1, "a 'gate' is sent once the card is half on screen");
  await page.evaluate(() => { window.scrollTo(0, 0); document.getElementById("tg-unlock").scrollIntoView({ block: "center" }); }); await page.waitForTimeout(400);
  ok(calls.filter(c => c.p_kind === "gate").length === 1, "...and only once");
  await page.route("**/*", route => { const u = route.request().url(); if (route.request().isNavigationRequest() && !u.includes("/blog/")) return route.fulfill({ status: 200, contentType: "text/html", body: "<title>app</title>" }); route.fallback(); });
  await page.click("#tg-unlock [data-gate=google]"); await page.waitForTimeout(500);
  ok(calls.some(c => c.p_kind === "click"), "a 'click' is sent when a log-in button is tapped");
  ok(new Set(calls.map(c => c.p_vid)).size === 1, "every call of one page carries the same device id");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA }); const calls = await stubRpc(ctx);
  const a = await ctx.newPage(); await a.goto(`${ORIGIN}/blog/en/piano-posture.html`); await a.waitForTimeout(400);
  const vid1 = await a.evaluate(() => localStorage.getItem("tg_blog_vid"));
  const b = await ctx.newPage(); await b.goto(`${ORIGIN}/blog/en/piano-posture.html`); await b.waitForTimeout(400);
  const vids = calls.filter(c => c.p_kind === "view").map(c => c.p_vid);
  ok(vid1 && vids.length === 2 && vids[0] === vids[1] && vids[0] === vid1, "the same browser keeps one device id between visits (the server counts it once a day)");
  await ctx.close();
}
{
  const { ctx, page, calls } = await open("th", { ms: 700, session: true, rpc: { views: 9 } });
  await page.waitForTimeout(1600);
  ok(WHOLE(await st(page)), "a member sees the whole article");
  ok(calls.some(c => c.p_kind === "view") && calls.some(c => c.p_kind === "read") && !calls.some(c => c.p_kind === "gate"), "but a member's visit and reading are counted (no 'gate')");
  ok(await page.evaluate(() => !!document.querySelector(".tg-views") && !document.querySelector(".tg-views").hidden), "and sees the number too");
  await ctx.close();
}
{
  const { ctx, page, calls } = await open("en", { ms: 600, ua: GOOGLEBOT });
  await page.waitForTimeout(1200);
  ok(calls.length === 0, "a crawler is not counted and sends nothing");
  await ctx.close();
}
{
  const { ctx, page, calls } = await open("en", { ms: 600, rpc: { missing: true } });
  await page.waitForTimeout(1300);
  ok(calls.length >= 1, "the migration is missing: the page still asks");
  ok(await page.evaluate(() => { const e = document.querySelector(".tg-views"); return !e || e.hidden; }), "...and shows no number (fails soft)");
  ok(GUEST(await st(page)), "...and the gate still works");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA });
  const calls = await stubRpc(ctx, { counts: [{ slug: "piano-posture", views: 55 }, { slug: "other", views: 7 }] });
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/blog/zh/`); await page.waitForTimeout(500);
  const t = await page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent));
  ok(t.length === 1 && t[0].includes("55") && t[0].includes("次浏览"), "the list page shows the number on the article's card (" + t[0] + ")");
  ok(calls.some(c => c.name === "blog_view_counts" && c.p_lang === "zh"), "one call per list");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA });
  const calls = await stubRpc(ctx, { counts: [{ slug: "piano-posture", views: 55 }, { slug: "other", views: 7 }] });
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/blog/ar/`); await page.waitForFunction(() => document.querySelectorAll("a.card .tg-cv").length > 0, null, { timeout: 4000 }).catch(() => {});
  const t = await page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent));
  ok(t.length === 1 && t[0].includes("55") && t[0].includes("مشاهدة") && !t[0].includes("مشاهدات"), "ar: the list page shows the number on the article's card (" + t[0] + ")");
  ok(calls.some(c => c.name === "blog_view_counts" && c.p_lang === "ar") && (await page.evaluate(() => getComputedStyle(document.documentElement).direction)) === "rtl", "ar: one call per list, for ar, in a right-to-left page");
  await ctx.close();
}
console.log("what is and is not counted");
{
  // a tab opened in the background and never looked at is not a view; the view is sent once, when the tab becomes visible
  const { ctx, page, calls } = await open("en", { ms: 5000, hidden: true });
  await page.waitForTimeout(700);
  ok(!calls.some(c => c.p_kind === "view"), "a page loaded in a hidden tab sends no view");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { get: () => false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(500);
  ok(calls.filter(c => c.p_kind === "view").length === 1, "...and exactly one view when the tab is looked at");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await page.waitForTimeout(300);
  ok(calls.filter(c => c.p_kind === "view").length === 1, "...switching tabs again does not count it again");
  await ctx.close();
}
{
  // time in a background tab is not reading: no 'read' however long the tab stays hidden
  const { ctx, page, calls } = await open("th", { ms: 600, hidden: true });
  await page.waitForTimeout(2000); ok(!calls.some(c => c.p_kind === "read"), "time in a background tab does not count as reading");
  await ctx.close();
}
{
  // a 404 from the database (migration not applied) is remembered: the next article in the tab makes no calls at all
  const { ctx, page, calls } = await open("en", { ms: 5000, rpc: { missing: true } });
  await page.waitForTimeout(700); const first = calls.length;
  ok(first >= 1 && (await page.evaluate(() => sessionStorage.getItem("tg_blog_rpc_off"))) === "1", "the first page asks once and notes that the function is missing");
  await page.goto(`${ORIGIN}/blog/th/piano-posture.html?read_ms=5000`); await page.waitForTimeout(700);
  ok(calls.length === first, "the next article in the same tab sends nothing");
  await ctx.close();
}
for (const [name, ua, counted] of [
  ["Googlebot", GOOGLEBOT, false],
  ["HeadlessChrome (audits, prerender)", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36", false],
  ["a phone called Cubot (not a crawler)", "Mozilla/5.0 (Linux; Android 12; CUBOT KINGKONG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36", true],
]) {
  const { ctx, page, calls } = await open("en", { ms: 600, ua });
  await page.waitForTimeout(1000);
  ok((calls.length > 0) === counted, name + (counted ? ": is counted" : ": is not counted and sends nothing"));
  if (!counted) ok(WHOLE(await st(page)), name + ": and reads the whole article");
  else ok(GUEST(await st(page)), name + ": and is gated like any reader");
  await ctx.close();
}
{
  // without any storage (private mode, blocked cookies) one tab is still one device, not one per article
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, userAgent: UA }); const calls = await stubRpc(ctx);
  await ctx.addInitScript(() => { const bad = { get() { throw new Error("denied"); } }; try { Object.defineProperty(window, "localStorage", bad); } catch (e) {} });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(`${ORIGIN}/blog/en/piano-posture.html`); await page.waitForTimeout(500);
  const v = calls.filter(c => c.p_kind === "view");
  ok(v.length === 1 && /^[A-Za-z0-9_-]{8,64}$/.test(v[0].p_vid), "with local storage blocked the page still counts, with a valid id, and does not throw");
  await ctx.close();
}
{
  // the sitemap: running the generator again must not add the blog urls a second time
  const root = path.join(tmp, "root"); fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  for (const f of ["build-blog-pages.mjs", "blog-paths.mjs", "blog-gate.mjs"]) fs.copyFileSync(path.join(ROOT, "scripts", f), path.join(root, "scripts", f));   // the generator imports the language list from blog-paths.mjs and the gate from blog-gate.mjs
  fs.copyFileSync(path.join(ROOT, "supabase-client.ts"), path.join(root, "supabase-client.ts"));
  fs.writeFileSync(path.join(root, "sitemap.xml"), '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n<url><loc>https://x.test/songs/th/a.html</loc></url>\n</urlset>\n');
  const run = () => execFileSync("node", [path.join(root, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_FIXTURE: path.join(tmp, "posts.json"), SITE_URL: "https://x.test" }, stdio: "pipe" });
  run(); const n1 = (fs.readFileSync(path.join(root, "sitemap.xml"), "utf8").match(/\/blog\//g) || []).length; run();
  const sm2 = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8"); const n2 = (sm2.match(/\/blog\//g) || []).length;
  ok(n1 > 0 && n1 === n2, "the sitemap holds the blog urls once after two runs (" + n1 + " then " + n2 + ")");
  ok(sm2.includes("/songs/th/a.html") && sm2.trim().endsWith("</urlset>"), "...and keeps the other urls and a closed file");
}

console.log("pages kept from an earlier build are brought up to date");
{
  // a kept th page: the 3-second wall of the last version (an old reader block, an old pop-up, no cut, old JSON-LD) becomes the current page, once
  const keep = path.join(tmp, "keep"); fs.mkdirSync(path.join(keep, "th"), { recursive: true });
  const cur = read("th");
  const art0 = cur.slice(cur.indexOf("<article>") + 9, cur.lastIndexOf("</article>"));
  const plainInner = G.ungateInner(art0);
  const oldGate = '<!--tg-gate:v7--><style>#tg-gate{position:fixed}</style><div id="tg-gate" hidden><div class="tg-g-card"><a data-gate="google">x</a></div></div><script>var OLD_THREE_SECONDS=3000,MS=3000,OPEN=false;</script><!--/tg-gate-->';
  const old = cur.replace(art0, plainInner).replace(/<!--tg-gate:v\d+-->[\s\S]*<!--\/tg-gate-->/, oldGate).replace('"isAccessibleForFree":false,"hasPart":{"@type":"WebPageElement","isAccessibleForFree":false,"cssSelector":".tg-locked"},', '"isAccessibleForFree":false,"hasPart":{"@type":"WebPageElement","isAccessibleForFree":false,"cssSelector":"article"},');
  fs.writeFileSync(path.join(keep, "th", "piano-posture.html"), old);
  fs.writeFileSync(path.join(keep, "th", "index.html"), fs.readFileSync(path.join(tmp, "blog", "th", "index.html"), "utf8").replace(/<!--tg-idx:v1-->[\s\S]*<!--\/tg-idx-->/, ""));
  ok(old.includes("OLD_THREE_SECONDS") && !old.includes("tg-cut") && old.includes('"cssSelector":"article"'), "(fixture: a page with the 3-second wall, no cut, the old JSON-LD)");
  const offline = () => execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_OFFLINE: "1", BLOG_OUT: keep, SITE_URL: ORIGIN, BLOG_SRC: path.join(tmp, "no-static-sources") }, stdio: "pipe" }).toString();
  const log = offline();
  const k = fs.readFileSync(path.join(keep, "th", "piano-posture.html"), "utf8");
  ok(!k.includes("OLD_THREE_SECONDS") && k.includes("<!--tg-gate:v8-->") && k.includes("blog_hit") && (k.match(/id="tg-unlock"/g) || []).length === 1 && !k.includes('id="tg-gate"'), "the old wall is replaced by the current reader block, and the article is cut once");
  ok(k === cur, "...byte for byte the page the generator writes");
  ok(k.includes('"cssSelector":".tg-locked"') && (k.match(/"isAccessibleForFree"/g) || []).length === 2, "the JSON-LD names the gated part (once, not twice)");
  ok(/kept pages \{"gated":1\}/.test(log), "the build says how many kept pages it cut (" + (log.match(/kept pages \{[^}]*\}/) || [""])[0] + ")");
  ok(fs.readFileSync(path.join(keep, "th", "index.html"), "utf8").includes("blog_view_counts"), "the list page gets the counter script");
  offline();
  ok(fs.readFileSync(path.join(keep, "th", "piano-posture.html"), "utf8") === k, "running it again changes nothing");
}
{
  // a kept Arabic page (right-to-left) gets the current gate in Arabic too, and stays right-to-left; a page with a cover image is cut after the cover
  const keep = path.join(tmp, "keep-ar"); fs.mkdirSync(path.join(keep, "ar"), { recursive: true });
  const cur = read("ar");
  const art0 = cur.slice(cur.indexOf("<article>") + 9, cur.lastIndexOf("</article>"));
  const withCover = cur.replace(art0, G.ungateInner(art0).replace("</time></p>", '</time></p><img src="https://x.test/c.png" alt="c">'));
  fs.writeFileSync(path.join(keep, "ar", "piano-posture.html"), withCover.replace(/<!--tg-gate:v\d+-->[\s\S]*<!--\/tg-gate-->/, "<!--tg-gate:v6--><script>var OLD=1</script><!--/tg-gate-->"));
  execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_OFFLINE: "1", BLOG_OUT: keep, SITE_URL: ORIGIN, BLOG_SRC: path.join(tmp, "no-static-sources") }, stdio: "pipe" });
  const k = fs.readFileSync(path.join(keep, "ar", "piano-posture.html"), "utf8");
  ok(!k.includes("var OLD=1") && k.includes("<!--tg-gate:v8-->") && (k.match(/id="tg-unlock"/g) || []).length === 1 && k.includes('<html lang="ar" dir="rtl">') && k.includes("سجّل الدخول مجانًا"), "ar: the old gate is replaced by the current Arabic one, once, and the page stays right-to-left");
  ok(k.indexOf('<img src="https://x.test/c.png" alt="c">') < k.indexOf("<!--tg-cut:v1-->") && k.indexOf('<img src="https://x.test/c.png" alt="c">') > k.indexOf("</time></p>"), "a cover image stays above the cut (it is not counted as text)");
}
{
  // a kept page that does not look like an article page is left alone (and reported), not broken
  const keep = path.join(tmp, "keep-odd"); fs.mkdirSync(path.join(keep, "th"), { recursive: true });
  fs.writeFileSync(path.join(keep, "th", "odd.html"), "<!doctype html><html><head><title>x</title></head><body><main><p>no article element here</p></main></body></html>");
  const log = execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_OFFLINE: "1", BLOG_OUT: keep, SITE_URL: ORIGIN, BLOG_SRC: path.join(tmp, "no-static-sources") }, stdio: "pipe" }).toString();
  const k = fs.readFileSync(path.join(keep, "th", "odd.html"), "utf8");
  ok(!k.includes("tg-cut") && /could not cut th\/odd\.html/.test(log) && /"skipped":1/.test(log), "an unknown page shape is left whole and named in the build log");
}
{
  // a kept short page is left whole and carries no gating markup
  const keep = path.join(tmp, "keep-short"); fs.mkdirSync(path.join(keep, "en"), { recursive: true });
  const cur = read("en", "short-note");
  fs.writeFileSync(path.join(keep, "en", "short-note.html"), cur.replace(/<!--tg-gate:v\d+-->[\s\S]*<!--\/tg-gate-->/, "<!--tg-gate:v7--><script>var OLD=1</script><!--/tg-gate-->").replace('"@type":"BlogPosting","@id"', '"@type":"BlogPosting","isAccessibleForFree":false,"hasPart":{"@type":"WebPageElement","isAccessibleForFree":false,"cssSelector":"article"},"@id"'));
  const log = execFileSync("node", [path.join(ROOT, "scripts/build-blog-pages.mjs")], { env: { ...process.env, BLOG_OFFLINE: "1", BLOG_OUT: keep, SITE_URL: ORIGIN, BLOG_SRC: path.join(tmp, "no-static-sources") }, stdio: "pipe" }).toString();
  const k = fs.readFileSync(path.join(keep, "en", "short-note.html"), "utf8");
  ok(k === cur && /"free":1/.test(log), "a short kept page becomes exactly the page the generator writes (no cut, no gating markup)");
}

ok(errs.length === 0, "no page errors" + (errs.length ? ": " + [...new Set(errs)].slice(0, 3).join(" | ") : ""));
await browser.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
