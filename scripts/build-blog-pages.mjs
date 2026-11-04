// Static, crawlable blog: one HTML page per published article (th / en / zh), an index per language, and the article URLs appended to sitemap.xml.
// Reads public.blog_posts through the public REST API with the anon key (RLS only returns published rows). Fails soft: no table / no network = no blog pages, build continues.
// Run by `npm run build` after build-song-pages.mjs (it appends to that script's sitemap.xml). SITE_URL overrides the domain.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE_URL || "https://www.tigaalpha.com").replace(/\/+$/, "");
const OUT = path.resolve(process.env.BLOG_OUT || path.join(ROOT, "blog"));   // BLOG_OUT / BLOG_FIXTURE exist for scripts/smoke-blog-gate.mjs (no network, no repo files touched)
const src = fs.readFileSync(path.join(ROOT, "supabase-client.ts"), "utf8");
const URL_ = (/SUPABASE_URL = "([^"]+)"/.exec(src) || [])[1], KEY = (/SUPABASE_ANON_KEY = "([^"]+)"/.exec(src) || [])[1];
let posts = [];
let fetched = false;
if (process.env.BLOG_FIXTURE) { posts = JSON.parse(fs.readFileSync(process.env.BLOG_FIXTURE, "utf8")); fetched = true; }
else try {
  const r = await fetch(`${URL_}/rest/v1/blog_posts?select=*&published=eq.true&order=created_at.desc&limit=500`, { headers: { apikey: KEY, Authorization: "Bearer " + KEY }, signal: AbortSignal.timeout(20000) });
  if (r.ok) { const data = await r.json(); if (Array.isArray(data)) { posts = data; fetched = true; } }
  else console.log("build-blog-pages: no posts (" + r.status + ")");
} catch (e) { console.log("build-blog-pages: skipped (" + (e && e.message) + ")"); }
if (fetched) fs.rmSync(OUT, { recursive: true, force: true });
else console.log("build-blog-pages: fetch failed, leaving the existing blog pages in place");
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeUrl = (u) => /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : "";
const LG = { th: { name: "บล็อก", sub: "บทความเรื่องการเรียนเปียโนและดนตรี", cta: "เริ่มเรียนฟรีที่ TIGA ALPHA", back: "ทุกบทความ", loc: "th_TH", html: "th" }, en: { name: "Blog", sub: "Articles on learning piano and music", cta: "Start learning free on TIGA ALPHA", back: "All articles", loc: "en_US", html: "en" }, zh: { name: "博客", sub: "钢琴与音乐学习文章", cta: "在 TIGA ALPHA 免费开始学习", back: "全部文章", loc: "zh_CN", html: "zh-Hans" } };
function inline(s) {
  return esc(s).replace(/!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/g, (_, a, u) => `<img src="${u}" alt="${a}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" rel="noopener">${t}</a>`).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function body(text) {
  const out = []; let ul = [], ol = [];
  const fl = () => { if (ul.length) { out.push("<ul>" + ul.map(x => "<li>" + inline(x) + "</li>").join("") + "</ul>"); ul = []; } if (ol.length) { out.push("<ol>" + ol.map(x => "<li>" + inline(x) + "</li>").join("") + "</ol>"); ol = []; } };
  for (const ln of String(text || "").replace(/\r/g, "").split("\n")) {
    if (/^\s*[-*] /.test(ln)) { if (ol.length) fl(); ul.push(ln.replace(/^\s*[-*] /, "")); continue; }
    if (/^\s*\d+[.)] /.test(ln)) { if (ul.length) fl(); ol.push(ln.replace(/^\s*\d+[.)] /, "")); continue; } fl();
    if (/^### /.test(ln)) out.push("<h3>" + inline(ln.slice(4)) + "</h3>"); else if (/^## /.test(ln)) out.push("<h2>" + inline(ln.slice(3)) + "</h2>"); else if (/^# /.test(ln)) out.push("<h2>" + inline(ln.slice(2)) + "</h2>"); else if (ln.trim()) out.push("<p>" + inline(ln) + "</p>");
  } fl(); return out.join("\n");
}
const CSS = `body{margin:0;background:#faf6f1;color:#2a211b;font:17px/1.75 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Noto Sans SC",sans-serif}main{max-width:720px;margin:0 auto;padding:24px 18px 60px}header.top{border-bottom:1px solid #eadfd4;background:#fff}header.top div{max-width:720px;margin:0 auto;padding:12px 18px;display:flex;justify-content:space-between;align-items:center}header.top a{color:#d97757;font-weight:800;text-decoration:none;letter-spacing:.05em}h1{font-size:30px;line-height:1.3;margin:.3em 0}h2{font-size:23px;margin:1.6em 0 .4em}h3{font-size:19px;margin:1.4em 0 .3em}img{max-width:100%;border-radius:12px}a{color:#c2552d}.meta{color:#7a6a5e;font-size:14px}.card{display:block;background:#fff;border:1px solid #eadfd4;border-radius:14px;padding:14px 16px;margin:0 0 12px;text-decoration:none;color:inherit}.card b{font-size:18px}.card span{display:block;color:#6b5d52;font-size:15px;margin-top:4px}.cta{display:inline-block;background:#d97757;color:#fff!important;padding:12px 22px;border-radius:10px;font-weight:800;text-decoration:none;margin-top:28px}`;
const head = (lang, title, desc, canon, extra, ld) => `<!doctype html>
<html lang="${LG[lang].html}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}">
${extra}<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article"><meta property="og:url" content="${canon}"><meta property="og:image" content="${SITE}/og-card.png"><meta property="og:locale" content="${LG[lang].loc}">
<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/icon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script><style>${CSS}</style><script src="/ga.js" defer></script></head>
`;
const topbar = (lang) => `<header class="top"><div><a href="${SITE}/">TIGA ALPHA</a><a href="${SITE}/blog/${lang}/" style="font-weight:600">${LG[lang].name}</a></div></header>`;
const KW = { th: "สอนเปียโน, เรียนเปียโน, คอร์สเรียนเปียโน, เล่นเปียโน, เล่นดนตรี, สอนดนตรี, คอร์สเปียโน, เรียนเปียโนออนไลน์, เรียนดนตรี, แอปพลิเคชันสอนเปียโนออนไลน์, สอนเปียโนด้วยเอไอ, แอปสอนเปียโน, แอปสอนเปียโนออนไลน์, แอปสอนเปียโน AI, คอร์สเรียนเปียโนออนไลน์ AI", en: "piano teaching, learn piano, piano learning course, play piano, play music, music teaching, piano course, learn piano online, learn music, online piano teaching application, piano teaching with AI, piano teaching app, online piano lessons app, AI piano teaching app, AI online piano course", zh: "钢琴教学, 学钢琴, 钢琴学习课程, 弹钢琴, 演奏音乐, 音乐教学, 钢琴课程, 在线学钢琴, 学音乐, 在线钢琴教学应用, 用AI教钢琴, 钢琴教学App, 在线钢琴教学App, AI钢琴教学App, AI在线钢琴课程" };
const ORG = { "@type": "Organization", "@id": SITE + "/#org", name: "TIGA ALPHA", url: SITE + "/", logo: { "@type": "ImageObject", url: SITE + "/og-card.png" }, founder: { "@id": SITE + "/#teacher-aum" }, sameAs: ["https://www.tigastudio.net/"] };
const INDEX_ALTS = Object.keys(LG).map(l => `<link rel="alternate" hreflang="${LG[l].html}" href="${SITE}/blog/${l}/">`).join("") + `<link rel="alternate" hreflang="x-default" href="${SITE}/blog/th/">\n`;
const INDEX_SM = Object.keys(LG).map(l => [LG[l].html, `${SITE}/blog/${l}/`]).concat([["x-default", `${SITE}/blog/th/`]]);
const CATN = { tips: { th: "เทคนิคการฝึก", en: "Practice tips", zh: "练习技巧" }, theory: { th: "ทฤษฎีดนตรี", en: "Music theory", zh: "乐理" }, songs: { th: "เพลงและเพลงฝึก", en: "Songs", zh: "曲目" }, news: { th: "ข่าวและประกาศ", en: "News", zh: "新闻公告" }, story: { th: "เรื่องราว", en: "Stories", zh: "故事" } };
/* ── the reading gate (owner 2026-11-04) ──
   Anyone may read an article without an account — that is what lets search send people here. After ONE MINUTE of actual reading (time the tab is
   visible; a tab in the background does not count) a pop-up opens in the middle of the screen and invites the reader to log in or sign up free for
   the TIGA AI app. It is a plain link into the app, because the app's login card (Google, e-mail link, password) is the one place accounts are
   made: "Google" goes to /?go=google, which starts the Google sign-in at once (App.tsx), "sign up" and "log in" open that card on its own tab
   (?wall=signup | ?wall=login, app-shell.tsx). Every link carries utm_source=blog&utm_campaign=<article> so the admin funnel can say how many
   members this channel brings.
   Rules it keeps: it never shows to someone who already has a session in this browser; it can be closed ("maybe later" / Esc / the backdrop), comes
   back once after three more minutes of reading, and at most twice in a browser session (sessionStorage) — Google treats a pop-up that cannot be
   dismissed as an intrusive interstitial; the text is data-nosnippet so it never replaces the article's snippet. The test door: with
   localStorage.tg_test_hook = "1" the page reads ?gate_ms=<ms> instead of 60000. */
const GATE_T = {
  th: { title: "อยากอ่านต่อใช่ไหม?", sub: "ล็อกอินหรือสมัครสมาชิกฟรี แล้วเริ่มเรียนเปียโนฟรีผ่านแอป TIGA AI ได้ทันที", google: "ล็อกอินด้วย Google", signup: "สมัครสมาชิกฟรี", login: "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ", later: "ไว้ทีหลัง", close: "ปิด" },
  en: { title: "Want to keep reading?", sub: "Log in or sign up free, then start learning piano for free with the TIGA AI app.", google: "Continue with Google", signup: "Sign up free", login: "Already a member? Log in", later: "Maybe later", close: "Close" },
  zh: { title: "想继续阅读吗？", sub: "免费登录或注册，即可通过 TIGA AI 应用免费学习钢琴。", google: "使用 Google 继续", signup: "免费注册", login: "已有账号？登录", later: "稍后再说", close: "关闭" },
};
const GATE_CSS = `#tg-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(42,33,27,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:tgGf .22s ease-out}#tg-gate[hidden]{display:none}
.tg-g-card{position:relative;box-sizing:border-box;width:100%;max-width:400px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#2a211b;border:1px solid #eee3d8;border-radius:18px;padding:28px 22px 16px;text-align:center;box-shadow:0 18px 60px rgba(60,30,10,.35);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Noto Sans SC",sans-serif;animation:tgGu .28s cubic-bezier(.2,.8,.2,1)}
.tg-g-badge{display:inline-block;border:2px solid #d97757;color:#d97757;border-radius:12px;padding:5px 14px;font-weight:800;font-size:19px;letter-spacing:1px}
.tg-g-card h2{margin:14px 0 6px;font-size:22px;line-height:1.3;font-weight:800}.tg-g-card p{margin:0 0 16px;color:#6f5f53;font-size:15px;line-height:1.55}
.tg-g-card a.tg-g-btn{display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;width:100%;min-height:48px;padding:12px 14px;margin:0 0 10px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;cursor:pointer}
.tg-g-google{background:#fff;color:#3c4043;border:1.5px solid #dadce0}.tg-g-signup{background:#d97757;color:#fff;border:1.5px solid #d97757}
.tg-g-card a.tg-g-login{display:block;margin:2px 0 4px;padding:8px;color:#b85a3a;font-size:15px;font-weight:700;text-decoration:none}
.tg-g-later{display:block;width:100%;margin:2px 0 0;padding:10px;background:none;border:0;color:#8a7a6e;font:inherit;font-size:14px;cursor:pointer}
.tg-g-x{position:absolute;top:8px;right:8px;width:36px;height:36px;border:0;border-radius:50%;background:none;color:#8a7a6e;font-size:24px;line-height:1;cursor:pointer}
.tg-g-card a:focus-visible,.tg-g-card button:focus-visible{outline:3px solid #d9775799;outline-offset:2px}
@keyframes tgGf{from{opacity:0}to{opacity:1}}@keyframes tgGu{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#tg-gate,.tg-g-card{animation:none}}`;
const GMARK = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>`;
const J = (v) => JSON.stringify(v).replace(/</g, "\\u003c");   // JSON inside an inline <script>: never let a slug close it
function gateHtml(lang, slug) {
  const T = GATE_T[lang] || GATE_T.en;
  const base = `${SITE}/?utm_source=blog&utm_medium=seo&utm_campaign=${encodeURIComponent(slug)}&lg=${lang}`;
  const L = (x) => esc(`${base}&${x}`);
  const js = `(function(){var D=document,LS=null,SS=null,MS=60000,SHOW=0,READ=0,OPEN=false,GOAL;try{LS=window.localStorage}catch(e){}try{SS=window.sessionStorage}catch(e){}
try{if(LS)for(var i=0;i<LS.length;i++){var k=LS.key(i);if(k&&/^sb-.*-auth-token$/.test(k)&&LS.getItem(k))return}}catch(e){}
try{if(LS&&LS.getItem("tg_test_hook")==="1"){var q=/[?&]gate_ms=(\\d+)/.exec(location.search);if(q)MS=+q[1]}}catch(e){}
try{SHOW=+(SS&&SS.getItem("tg_blog_gate"))||0}catch(e){}if(SHOW>=2)return;GOAL=MS;
var el=D.getElementById("tg-gate");if(!el)return;
function ev(n,p){try{if(window.gtag)window.gtag("event",n,p)}catch(e){}}
function closeIt(){if(!OPEN)return;OPEN=false;el.hidden=true;D.documentElement.style.overflow=el._ov||"";if(SHOW<2)GOAL=READ+MS*3}
function openIt(){OPEN=true;SHOW++;try{SS&&SS.setItem("tg_blog_gate",String(SHOW))}catch(e){}el._ov=D.documentElement.style.overflow;D.documentElement.style.overflow="hidden";el.hidden=false;ev("blog_gate_shown",{slug:${J(slug)},n:SHOW});var b=el.querySelector("[data-gate=google]");if(b&&b.focus)try{b.focus({preventScroll:true})}catch(e){}}
var last=Date.now();setInterval(function(){var n=Date.now(),d=n-last;last=n;if(D.hidden||OPEN||d>5000)return;READ+=d;if(SHOW<2&&READ>=GOAL)openIt()},500);
el.addEventListener("click",function(e){var t=e.target;if(t===el){closeIt();return}while(t&&t!==el){if(t.getAttribute&&t.getAttribute("data-gate-close")!==null){closeIt();return}if(t.getAttribute&&t.getAttribute("data-gate")){ev("blog_gate_click",{method:t.getAttribute("data-gate"),slug:${J(slug)}});try{if(LS){var p=JSON.parse(LS.getItem("tg_guest_profile")||"{}")||{};p.lang=${J(lang)};LS.setItem("tg_guest_profile",JSON.stringify(p))}}catch(e){}return}t=t.parentNode}});
D.addEventListener("keydown",function(e){if(e.key==="Escape")closeIt()});
if(window.__tgGate===undefined)window.__tgGate={open:function(){if(!OPEN)openIt()},state:function(){return{open:OPEN,read:READ,shown:SHOW}}};})();`;
  return `<style>${GATE_CSS}</style><div id="tg-gate" role="dialog" aria-modal="true" aria-labelledby="tg-gate-t" data-nosnippet hidden><div class="tg-g-card"><button type="button" class="tg-g-x" aria-label="${esc(T.close)}" data-gate-close>&times;</button><div class="tg-g-badge">TIGA ALPHA</div><h2 id="tg-gate-t">${esc(T.title)}</h2><p>${esc(T.sub)}</p><a class="tg-g-btn tg-g-google" data-gate="google" rel="nofollow" href="${L("go=google")}">${GMARK}${esc(T.google)}</a><a class="tg-g-btn tg-g-signup" data-gate="signup" rel="nofollow" href="${L("wall=signup")}">${esc(T.signup)}</a><a class="tg-g-login" data-gate="login" rel="nofollow" href="${L("wall=login")}">${esc(T.login)}</a><button type="button" class="tg-g-later" data-gate-close>${esc(T.later)}</button></div></div><script>${js}</script>`;
}
const urls = [], bySlug = {};
for (const p of posts) { (bySlug[p.slug] = bySlug[p.slug] || {})[p.lang] = p; }
for (const p of posts) {
  if (!LG[p.lang] || !p.slug) continue;
  const L = LG[p.lang], canon = `${SITE}/blog/${p.lang}/${encodeURIComponent(p.slug)}.html`, set = bySlug[p.slug];
  const alts = Object.keys(set).map(l => `<link rel="alternate" hreflang="${LG[l].html}" href="${SITE}/blog/${l}/${encodeURIComponent(p.slug)}.html">`).join("") + `<link rel="alternate" hreflang="x-default" href="${SITE}/blog/${set.en ? "en" : p.lang}/${encodeURIComponent(p.slug)}.html">\n`;
  const desc = p.excerpt || String(p.body || "").replace(/[#*\[\]()!>-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "BlogPosting", "@id": canon + "#article", headline: p.title, keywords: KW[p.lang], isPartOf: { "@id": `${SITE}/blog/${p.lang}/#blog` }, about: { "@id": SITE + "/#app" }, articleSection: (CATN[p.category || "tips"] || {})[p.lang] || undefined, description: desc, inLanguage: L.html, datePublished: p.created_at, dateModified: p.updated_at || p.created_at, mainEntityOfPage: { "@type": "WebPage", "@id": canon }, url: canon, image: { "@type": "ImageObject", url: safeUrl(p.cover_url || "") || `${SITE}/og-card.png` }, author: { "@id": SITE + "/#org" }, publisher: { "@id": SITE + "/#org" } },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "TIGA ALPHA", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: L.name, item: `${SITE}/blog/${p.lang}/` }, { "@type": "ListItem", position: 3, name: p.title, item: canon }] }, ORG] };
  const d = new Date(p.created_at).toISOString().slice(0, 10);
  fs.mkdirSync(path.join(OUT, p.lang), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.lang, p.slug + ".html"), head(p.lang, `${p.title} | TIGA ALPHA`, desc, canon, alts, ld) + `<body>${topbar(p.lang)}<main><article><p class="meta"><a href="${SITE}/blog/${p.lang}/">← ${L.back}</a></p><h1>${esc(p.title)}</h1><p class="meta">${esc(CATN[p.category || "tips"] ? CATN[p.category || "tips"][p.lang] : "")} · <time datetime="${d}">${d}</time></p>${safeUrl(p.cover_url || "") ? `<img src="${safeUrl(p.cover_url)}" alt="${esc(p.title)}">` : ""}${body(p.body)}<p><a class="cta" href="${SITE}/">${L.cta}</a></p></article></main>${gateHtml(p.lang, p.slug)}</body></html>\n`);
  urls.push([canon, Object.keys(set).map(l => [LG[l].html, `${SITE}/blog/${l}/${encodeURIComponent(p.slug)}.html`]), d]);
}
for (const lang of Object.keys(LG)) {
  const L = LG[lang], list = posts.filter(p => p.lang === lang && p.slug), canon = `${SITE}/blog/${lang}/`;
  if (!list.length) continue;
  const ld = { "@context": "https://schema.org", "@type": "Blog", "@id": canon + "#blog", name: "TIGA ALPHA " + L.name, inLanguage: L.html, url: canon, publisher: ORG, blogPost: list.map(p => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE}/blog/${lang}/${encodeURIComponent(p.slug)}.html`, datePublished: p.created_at })) };
  fs.writeFileSync(path.join(OUT, lang, "index.html"), head(lang, `${L.name} | TIGA ALPHA`, L.sub, canon, INDEX_ALTS, ld) + `<body>${topbar(lang)}<main><h1>${L.name}</h1><p class="meta">${L.sub}</p>${list.map(p => `<a class="card" href="${SITE}/blog/${lang}/${encodeURIComponent(p.slug)}.html"><b>${esc(p.title)}</b>${p.excerpt ? `<span>${esc(p.excerpt)}</span>` : ""}<span style="font-size:13px;color:#a39486">${esc((CATN[p.category || "tips"] || {})[lang] || "")}</span></a>`).join("")}</main></body></html>\n`);
  const newest = list.map(p => String(p.updated_at || p.created_at || "").slice(0, 10)).filter(Boolean).sort().pop() || null;
  urls.push([canon, INDEX_SM, newest]);
}
if (!fetched) {
  for (const lang of Object.keys(LG)) {
    const dir = path.join(OUT, lang);
    if (!fs.existsSync(dir)) continue;
    if (fs.existsSync(path.join(dir, "index.html"))) urls.push([`${SITE}/blog/${lang}/`, INDEX_SM, new Date().toISOString().slice(0, 10)]);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".html") || f === "index.html") continue;
      urls.push([`${SITE}/blog/${lang}/${encodeURIComponent(f.slice(0, -5))}.html`, [], null]);
      // the pages kept from an earlier build get the reading gate too (a build that cannot reach the database must not leave the articles without it)
      const fp = path.join(dir, f), h0 = fs.readFileSync(fp, "utf8");
      if (!h0.includes('id="tg-gate"') && h0.includes("</body>")) fs.writeFileSync(fp, h0.replace(/<\/body>(?![\s\S]*<\/body>)/, () => gateHtml(lang, f.slice(0, -5)) + "</body>"));
    }
  }
}
const sm = path.join(ROOT, "sitemap.xml");
if (urls.length && fs.existsSync(sm) && !process.env.BLOG_OUT) {
  const add = urls.map(([u, alts, d]) => `<url><loc>${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}${alts.map(([l, h]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${h}"/>`).join("")}</url>`).join("\n");
  fs.writeFileSync(sm, fs.readFileSync(sm, "utf8").replace("</urlset>", add + "\n</urlset>"));
}
console.log(`build-blog-pages: ${posts.length} posts, ${urls.length} urls  (${SITE})`);
