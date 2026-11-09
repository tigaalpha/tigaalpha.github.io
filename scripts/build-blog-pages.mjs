// Static, crawlable blog: one HTML page per published article (th / en / zh), an index per language, and the article URLs appended to sitemap.xml.
// Reads public.blog_posts through the public REST API with the anon key (RLS only returns published rows). Fails soft: no table / no network = no blog pages, build continues.
// Run by `npm run build` after build-song-pages.mjs (it appends to that script's sitemap.xml). SITE_URL overrides the domain.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE_URL || "https://www.tigaalpha.com").replace(/\/+$/, "");
const OUT = path.resolve(process.env.BLOG_OUT || path.join(ROOT, "blog"));   // BLOG_OUT / BLOG_FIXTURE exist for scripts/smoke-blog-gate.mjs (no network, no repo files touched)
const src = fs.readFileSync(path.join(ROOT, "supabase-client.ts"), "utf8");
const URL_ = (/SUPABASE_URL = "([^"]+)"/.exec(src) || [])[1], KEY = (/SUPABASE_ANON_KEY = "([^"]+)"/.exec(src) || [])[1];
// Importing this file (the on-demand page does) must not fetch or delete blog/. Only `node scripts/build-blog-pages.mjs` writes pages.
const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
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
   Anyone may read an article without an account — that is what lets search send people here. After THIRTY SECONDS of actual reading (it was one minute until 2026-11-07, owner) (time the tab is
   visible; a tab in the background does not count) a pop-up opens in the middle of the screen and invites the reader to log in or sign up free for
   the TIGA AI app. It is a plain link into the app, because the app's login card (Google, e-mail link, password) is the one place accounts are
   made: "Google" goes to /?go=google, which starts the Google sign-in at once (App.tsx), "sign up" and "log in" open that card on its own tab
   (?wall=signup | ?wall=login, app-shell.tsx). Every link carries utm_source=blog&utm_campaign=<article> so the admin funnel can say how many
   members this channel brings.
   Rules it keeps (owner 2026-11-07, third version: "the pop-up must not be closable, to read on you have to log in"): it never shows to someone who already has a
   session in this browser; it has NO close button, no Esc and no tap-outside; the page behind is inert and locked, and the wall lifts only when a session appears
   (the reader logged in, even in another tab). A reader who met it is walled again at once for 24 hours (localStorage tg_blog_walled), so a reload or another article is
   no way round. Crawlers are never walled (BOT) and the article's JSON-LD says isAccessibleForFree false with the article as the gated part, which is Google's
   way of telling a login wall from cloaking. The SEO cost of an uncloseable wall (Google's intrusive-interstitial rule) is the owner's accepted trade-off;
   the text is data-nosnippet so it never replaces the article's snippet. The test door: with
   localStorage.tg_test_hook = "1" the page reads ?gate_ms=<ms> instead of 30000. */
const GATE_T = {
  th: { title: "ล็อกอินเพื่ออ่านต่อ", sub: "ล็อกอินหรือสมัครสมาชิกฟรีเพื่ออ่านบทความนี้ต่อ แล้วเริ่มเรียนเปียโนฟรีผ่านแอป TIGA AI ได้ทันที", google: "ล็อกอินด้วย Google", signup: "สมัครสมาชิกฟรี", login: "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" },
  en: { title: "Log in to keep reading", sub: "Log in or sign up free to read the rest of this article, then start learning piano for free with the TIGA AI app.", google: "Continue with Google", signup: "Sign up free", login: "Already a member? Log in" },
  zh: { title: "登录后继续阅读", sub: "免费登录或注册即可继续阅读本文，并通过 TIGA AI 应用免费学习钢琴。", google: "使用 Google 继续", signup: "免费注册", login: "已有账号？登录" },
};
const GATE_CSS = `#tg-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(34,26,21,.95);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);overscroll-behavior:contain;animation:tgGf .22s ease-out}#tg-gate[hidden]{display:none}
.tg-g-card{position:relative;box-sizing:border-box;width:100%;max-width:400px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#2a211b;border:1px solid #eee3d8;border-radius:18px;padding:28px 22px 14px;text-align:center;box-shadow:0 18px 60px rgba(60,30,10,.35);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Noto Sans SC",sans-serif;animation:tgGu .28s cubic-bezier(.2,.8,.2,1)}
.tg-g-badge{display:inline-block;border:2px solid #d97757;color:#d97757;border-radius:12px;padding:5px 14px;font-weight:800;font-size:19px;letter-spacing:1px}
.tg-g-card h2{margin:14px 0 6px;font-size:22px;line-height:1.3;font-weight:800}.tg-g-card p{margin:0 0 16px;color:#6f5f53;font-size:15px;line-height:1.55}
.tg-g-card a.tg-g-btn{display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;width:100%;min-height:48px;padding:12px 14px;margin:0 0 10px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;cursor:pointer}
.tg-g-google{background:#fff;color:#3c4043;border:1.5px solid #dadce0}.tg-g-signup{background:#d97757;color:#fff;border:1.5px solid #d97757}
.tg-g-card a.tg-g-login{display:block;margin:2px 0 4px;padding:8px;color:#b85a3a;font-size:15px;font-weight:700;text-decoration:none}
.tg-g-card a:focus-visible,.tg-g-card button:focus-visible{outline:3px solid #d9775799;outline-offset:2px}
@keyframes tgGf{from{opacity:0}to{opacity:1}}@keyframes tgGu{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#tg-gate,.tg-g-card{animation:none}}`;
const GMARK = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>`;
const J = (v) => JSON.stringify(v).replace(/</g, "\\u003c");   // JSON inside an inline <script>: never let a slug close it
const VIEWS_CSS = `.tg-views{color:#7a6a5e;white-space:nowrap}.tg-cv{display:block;margin-top:6px;color:#8a7a6e;font-size:13px}`;
const VIEWS_LBL = { th: "ยอดวิว", en: "views", zh: "次浏览" };
/* The reader script of an article page (owner 2026-11-07): one shared reading clock does three jobs. (1) It counts the visit and shows the number of readers beside the date
   ("👁 1,234 views"): public.blog_hit() (supabase-blog-views-migration.sql) counts one view per device per article per day and returns the all-time number. (2) After 30 seconds of
   reading it records a "read" and, for someone with no session in this browser, opens the log-in pop-up (it was one minute until 2026-11-07). (3) It records when the pop-up was shown and
   tapped. Every call fails soft: before the migration is applied the page shows no number and nothing else changes. Crawlers are not counted. A page kept from an earlier build is re-patched
   between the two markers, so the committed pages follow the generator. */
const GATE_MARK = "<!--tg-gate:v4-->", GATE_END = "<!--/tg-gate-->";
function gateHtml(lang, slug) {
  const T = GATE_T[lang] || GATE_T.en;
  const base = `${SITE}/?utm_source=blog&utm_medium=seo&utm_campaign=${encodeURIComponent(slug)}&lg=${lang}`;
  const L = (x) => esc(`${base}&${x}`);
  const js = `(function(){var D=document,W=window,LS=null,SS=null,MS=30000,READ=0,OPEN=false,GOAL,SENT=0,API=${J(URL_)},KEY=${J(KEY)},LANG=${J(lang)},SLUG=${J(slug)},VID="",BOT=false,OFF=false,LBL=${J(VIEWS_LBL[lang] || VIEWS_LBL.en)},badge=null,MEM=null;
try{LS=W.localStorage}catch(e){}try{SS=W.sessionStorage}catch(e){}
try{BOT=/googlebot|bingbot|baiduspider|yandex|duckduckbot|applebot|slurp|crawler|spider|lighthouse|headlesschrome|prerender|facebookexternalhit|ahrefsbot|semrushbot|gptbot|claudebot|petalbot|bytespider/i.test(navigator.userAgent||"")}catch(e){}
function isAuth(){try{if(LS)for(var i=0;i<LS.length;i++){var k=LS.key(i);if(k&&/^sb-.*-auth-token$/.test(k)&&LS.getItem(k))return true}}catch(e){}return false}
try{if(LS&&LS.getItem("tg_test_hook")==="1"){var q=/[?&]gate_ms=(\\d+)/.exec(location.search);if(q){MS=+q[1]}}}catch(e){}
GOAL=MS;
/* a reader who already met the wall (within the last 24 hours, in this browser) meets it again at once on any article: reloading or opening another one is not a way round */
try{var wt=+(LS&&LS.getItem("tg_blog_walled"))||0;if(wt&&Date.now()-wt<86400000)GOAL=0}catch(e){}
try{OFF=!!(SS&&SS.getItem("tg_blog_rpc_off"))}catch(e){}
function rnd(){var s="",c="abcdefghijklmnopqrstuvwxyz0123456789",n=20,j;try{var a=new Uint8Array(n);W.crypto.getRandomValues(a);for(j=0;j<n;j++)s+=c.charAt(a[j]%36)}catch(e){s="";for(j=0;j<n;j++)s+=c.charAt(Math.floor(Math.random()*36))}return s}
function okId(v){return /^[A-Za-z0-9_-]{8,64}$/.test(v||"")}
try{VID=(LS&&LS.getItem("tg_blog_vid"))||""}catch(e){}
if(!okId(VID)){try{VID=(SS&&SS.getItem("tg_blog_vid"))||""}catch(e){}}
if(!okId(VID)){VID=rnd();try{LS&&LS.setItem("tg_blog_vid",VID)}catch(e){try{SS&&SS.setItem("tg_blog_vid",VID)}catch(e2){}}}
function ev(n,p){try{if(W.gtag)W.gtag("event",n,p)}catch(e){}}
function rpc(name,body,cb,ka){if(BOT||OFF)return;var o={method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},body:JSON.stringify(body)};if(ka)o.keepalive=true;try{W.fetch(API+"/rest/v1/rpc/"+name,o).then(function(r){if(r.status===404){OFF=true;try{SS&&SS.setItem("tg_blog_rpc_off","1")}catch(e){}}return r.ok?r.json():null}).then(function(j){if(cb)cb(j)},function(){})}catch(e){}}
function hit(kind,cb,ka){rpc("blog_hit",{p_lang:LANG,p_slug:SLUG,p_vid:VID,p_kind:kind},cb,ka)}
function badgeEl(){if(badge)return badge;var t=D.querySelector("article time");if(!t||!t.parentNode)return null;badge=D.createElement("span");badge.className="tg-views";badge.setAttribute("data-nosnippet","");badge.hidden=true;t.parentNode.appendChild(badge);return badge}
function show(n){if(typeof n!=="number"||!(n>=1))return;var b=badgeEl();if(!b)return;var s;try{s=n.toLocaleString(LANG==="th"?"th-TH":LANG==="zh"?"zh-CN":"en-US")}catch(e){s=String(n)}b.textContent=" \\u00b7 \\ud83d\\udc41 "+s+" "+LBL;b.hidden=false}
/* the view is counted once the page is really in front of the reader: not while it is only prerendered, not in a tab that was opened in the background and never looked at */
var VIEWED=0;function view(){if(VIEWED)return;if(D.prerendering||D.hidden)return;VIEWED=1;hit("view",show)}
if(D.prerendering)D.addEventListener("prerenderingchange",view);D.addEventListener("visibilitychange",function(){last=Date.now();view()});view();
var el=D.getElementById("tg-gate");
/* the wall has no close control, no Esc, no tap-outside: it lifts only when a session appears in this browser (the reader logged in, even in another tab) */
function lock(on){try{D.documentElement.style.overflow=on?"hidden":(el._ov||"");var c=D.body.children;for(var i=0;i<c.length;i++){var n=c[i];if(n===el||n.tagName==="SCRIPT"||n.tagName==="STYLE")continue;if(on){if(!n.hasAttribute("inert")){n.setAttribute("inert","");n.setAttribute("data-tg-inert","1")}}else if(n.getAttribute("data-tg-inert")){n.removeAttribute("inert");n.removeAttribute("data-tg-inert")}}}catch(e){}}
function closeIt(){if(!OPEN)return;OPEN=false;el.hidden=true;lock(false)}
function openIt(){OPEN=true;try{LS&&LS.setItem("tg_blog_walled",String(Date.now()))}catch(e){}el._ov=D.documentElement.style.overflow;lock(true);el.hidden=false;ev("blog_gate_shown",{slug:SLUG});hit("gate");var b=el.querySelector("[data-gate=google]");if(b&&b.focus)try{b.focus({preventScroll:true})}catch(e){}}
/* the reading clock: a gap of more than 1.5 s between two 500 ms ticks means the page was frozen or throttled (another app, a locked phone), and that time is not reading */
var last=Date.now();setInterval(function(){var n=Date.now(),d=n-last;last=n;if(D.hidden||d>1500||d<0)return;if(OPEN){if(isAuth())closeIt();return}READ+=d;if(!SENT&&READ>=MS){SENT=1;hit("read");ev("blog_read",{slug:SLUG,seconds:Math.round(READ/1000)})}if(el&&!BOT&&READ>=GOAL&&!isAuth())openIt()},500);
W.addEventListener("pageshow",function(e){last=Date.now();if(e&&e.persisted&&OPEN&&isAuth())closeIt()});
if(!el)return;
el.addEventListener("click",function(e){var t=e.target;while(t&&t!==el){if(t.getAttribute&&t.getAttribute("data-gate")){ev("blog_gate_click",{method:t.getAttribute("data-gate"),slug:SLUG});hit("click",null,true);try{if(LS){var p=JSON.parse(LS.getItem("tg_guest_profile")||"{}")||{};p.lang=LANG;LS.setItem("tg_guest_profile",JSON.stringify(p))}}catch(e){}return}t=t.parentNode}});
if(W.__tgGate===undefined)W.__tgGate={open:function(){if(!OPEN&&!isAuth())openIt()},state:function(){return{open:OPEN,read:READ,auth:isAuth()}}};})();`;
  return `${GATE_MARK}<style>${GATE_CSS}${VIEWS_CSS}</style><div id="tg-gate" role="dialog" aria-modal="true" aria-labelledby="tg-gate-t" data-nosnippet hidden><div class="tg-g-card"><div class="tg-g-badge">TIGA ALPHA</div><h2 id="tg-gate-t">${esc(T.title)}</h2><p>${esc(T.sub)}</p><a class="tg-g-btn tg-g-google" data-gate="google" rel="nofollow" href="${L("go=google")}">${GMARK}${esc(T.google)}</a><a class="tg-g-btn tg-g-signup" data-gate="signup" rel="nofollow" href="${L("wall=signup")}">${esc(T.signup)}</a><a class="tg-g-login" data-gate="login" rel="nofollow" href="${L("wall=login")}">${esc(T.login)}</a></div></div><script>${js}</script>${GATE_END}`;
}
/* The article lists show the same number on every card (one call per list). Patched into kept pages like the gate. */
const IDX_MARK = "<!--tg-idx:v1-->", IDX_END = "<!--/tg-idx-->";
function idxHtml(lang) {
  const js = `(function(){var W=window,D=document,API=${J(URL_)},KEY=${J(KEY)},LANG=${J(lang)},LBL=${J(VIEWS_LBL[lang] || VIEWS_LBL.en)};try{if(/googlebot|bingbot|baiduspider|yandex|duckduckbot|applebot|slurp|crawler|spider|lighthouse|headlesschrome|prerender|facebookexternalhit|ahrefsbot|semrushbot|gptbot|claudebot|petalbot|bytespider/i.test(navigator.userAgent||""))return}catch(e){}
var cards=D.querySelectorAll("a.card");if(!cards.length)return;
try{W.fetch(API+"/rest/v1/rpc/blog_view_counts",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},body:JSON.stringify({p_lang:LANG})}).then(function(r){return r.ok?r.json():null}).then(function(rows){if(!rows||!rows.length)return;var m={},i;for(i=0;i<rows.length;i++)m[rows[i].slug]=rows[i].views;for(i=0;i<cards.length;i++){var h=cards[i].getAttribute("href")||"",s;try{s=decodeURIComponent(h.replace(/^.*\\/blog\\/[a-z]+\\//,"").replace(/\\.html$/,""))}catch(e){continue}var n=m[s];if(typeof n==="number"&&n>=1){var sp=D.createElement("span");sp.className="tg-cv";sp.setAttribute("data-nosnippet","");var t;try{t=n.toLocaleString(LANG==="th"?"th-TH":LANG==="zh"?"zh-CN":"en-US")}catch(e){t=String(n)}sp.textContent="\\ud83d\\udc41 "+t+" "+LBL;cards[i].appendChild(sp)}}},function(){})}catch(e){}})();`;
  return `${IDX_MARK}<style>${VIEWS_CSS}</style><script>${js}</script>${IDX_END}`;
}
// strip a gate / list-script block written by any earlier version of this generator (v1 pages carry no markers)
const OLD_GATE = /<!--tg-gate:v\d+-->[\s\S]*?<!--\/tg-gate-->|<style>#tg-gate\{[\s\S]*?<\/style><div id="tg-gate"[\s\S]*?<\/div><\/div><script>[\s\S]*?<\/script>/g;
const OLD_IDX = /<!--tg-idx:v\d+-->[\s\S]*?<!--\/tg-idx-->/g;
const lastBody = /<\/body>(?![\s\S]*<\/body>)/;
// One article page. `set` is the same slug in every language that exists ({ th, en, zh }). Used by the static build and by the on-demand page, so both emit the same raw HTML.
export function articleHtml(p, set) {
  const L = LG[p.lang], canon = `${SITE}/blog/${p.lang}/${encodeURIComponent(p.slug)}.html`;
  const alts = Object.keys(set).map(l => `<link rel="alternate" hreflang="${LG[l].html}" href="${SITE}/blog/${l}/${encodeURIComponent(p.slug)}.html">`).join("") + `<link rel="alternate" hreflang="x-default" href="${SITE}/blog/${set.en ? "en" : p.lang}/${encodeURIComponent(p.slug)}.html">\n`;
  const desc = p.excerpt || String(p.body || "").replace(/[#*\[\]()!>-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "BlogPosting", "@id": canon + "#article", isAccessibleForFree: false, hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: "article" }, headline: p.title, keywords: KW[p.lang], isPartOf: { "@id": `${SITE}/blog/${p.lang}/#blog` }, about: { "@id": SITE + "/#app" }, articleSection: (CATN[p.category || "tips"] || {})[p.lang] || undefined, description: desc, inLanguage: L.html, datePublished: p.created_at, dateModified: p.updated_at || p.created_at, mainEntityOfPage: { "@type": "WebPage", "@id": canon }, url: canon, image: { "@type": "ImageObject", url: safeUrl(p.cover_url || "") || `${SITE}/og-card.png` }, author: { "@id": SITE + "/#org" }, publisher: { "@id": SITE + "/#org" } },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "TIGA ALPHA", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: L.name, item: `${SITE}/blog/${p.lang}/` }, { "@type": "ListItem", position: 3, name: p.title, item: canon }] }, ORG] };
  const d = new Date(p.created_at).toISOString().slice(0, 10);
  return head(p.lang, `${p.title} | TIGA ALPHA`, desc, canon, alts, ld) + `<body>${topbar(p.lang)}<main><article><p class="meta"><a href="${SITE}/blog/${p.lang}/">← ${L.back}</a></p><h1>${esc(p.title)}</h1><p class="meta">${esc(CATN[p.category || "tips"] ? CATN[p.category || "tips"][p.lang] : "")} · <time datetime="${d}">${d}</time></p>${safeUrl(p.cover_url || "") ? `<img src="${safeUrl(p.cover_url)}" alt="${esc(p.title)}">` : ""}${body(p.body)}<p><a class="cta" href="${SITE}/">${L.cta}</a></p></article></main>${gateHtml(p.lang, p.slug)}</body></html>\n`;
}
async function writeBlog() {
let posts = [];
let fetched = false;
if (process.env.BLOG_OFFLINE) console.log("build-blog-pages: offline (BLOG_OFFLINE), keeping the pages in " + OUT);
else if (process.env.BLOG_FIXTURE) { posts = JSON.parse(fs.readFileSync(process.env.BLOG_FIXTURE, "utf8")); fetched = true; }
else try {
  // page through the API (the old single request was capped at 500 rows, so past 500 published rows the oldest articles would have been deleted from the deploy)
  const PAGE = 500; let off = 0, all = [], okAll = true;
  for (let guard = 0; guard < 40; guard++) {
    const r = await fetch(`${URL_}/rest/v1/blog_posts?select=*&published=eq.true&order=created_at.desc,id.asc&limit=${PAGE}&offset=${off}`, { headers: { apikey: KEY, Authorization: "Bearer " + KEY }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) { console.log("build-blog-pages: no posts (" + r.status + ")"); okAll = false; break; }
    const data = await r.json(); if (!Array.isArray(data)) { okAll = false; break; }
    all = all.concat(data); if (data.length < PAGE) break; off += PAGE;
  }
  if (okAll) { posts = all; fetched = true; }
} catch (e) { console.log("build-blog-pages: skipped (" + (e && e.message) + ")"); }
if (fetched) fs.rmSync(OUT, { recursive: true, force: true });
else console.log("build-blog-pages: fetch failed, leaving the existing blog pages in place");
const urls = [], bySlug = {};
for (const p of posts) { (bySlug[p.slug] = bySlug[p.slug] || {})[p.lang] = p; }
for (const p of posts) {
  if (!LG[p.lang] || !p.slug) continue;
  const canon = `${SITE}/blog/${p.lang}/${encodeURIComponent(p.slug)}.html`, set = bySlug[p.slug];
  const d = new Date(p.created_at).toISOString().slice(0, 10);
  fs.mkdirSync(path.join(OUT, p.lang), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.lang, p.slug + ".html"), articleHtml(p, set));
  urls.push([canon, Object.keys(set).map(l => [LG[l].html, `${SITE}/blog/${l}/${encodeURIComponent(p.slug)}.html`]), d]);
}
for (const lang of Object.keys(LG)) {
  const L = LG[lang], list = posts.filter(p => p.lang === lang && p.slug), canon = `${SITE}/blog/${lang}/`;
  if (!list.length) continue;
  const ld = { "@context": "https://schema.org", "@type": "Blog", "@id": canon + "#blog", name: "TIGA ALPHA " + L.name, inLanguage: L.html, url: canon, publisher: ORG, blogPost: list.map(p => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE}/blog/${lang}/${encodeURIComponent(p.slug)}.html`, datePublished: p.created_at })) };
  fs.writeFileSync(path.join(OUT, lang, "index.html"), head(lang, `${L.name} | TIGA ALPHA`, L.sub, canon, INDEX_ALTS, ld) + `<body>${topbar(lang)}<main><h1>${L.name}</h1><p class="meta">${L.sub}</p>${list.map(p => `<a class="card" href="${SITE}/blog/${lang}/${encodeURIComponent(p.slug)}.html"><b>${esc(p.title)}</b>${p.excerpt ? `<span>${esc(p.excerpt)}</span>` : ""}<span style="font-size:13px;color:#a39486">${esc((CATN[p.category || "tips"] || {})[lang] || "")}</span></a>`).join("")}</main>${idxHtml(lang)}</body></html>\n`);
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
      // the pages kept from an earlier build are brought up to the current reader script (gate after 30 s, view count) in place
      const fp = path.join(dir, f), h0 = fs.readFileSync(fp, "utf8");
      if (h0.includes("</body>")) {
        let h1 = h0.replace(OLD_GATE, "").replace(lastBody, () => gateHtml(lang, f.slice(0, -5)) + "</body>");
        if (!h1.includes('"isAccessibleForFree"')) h1 = h1.replace('"@type":"BlogPosting","@id"', '"@type":"BlogPosting","isAccessibleForFree":false,"hasPart":{"@type":"WebPageElement","isAccessibleForFree":false,"cssSelector":"article"},"@id"');
        if (h1 !== h0) fs.writeFileSync(fp, h1);
      }
    }
    // the list page of this language: same view numbers on its cards
    const ip = path.join(dir, "index.html");
    if (fs.existsSync(ip)) { const i0 = fs.readFileSync(ip, "utf8"); const i1 = i0.replace(OLD_IDX, "").replace(lastBody, () => idxHtml(lang) + "</body>"); if (i1 !== i0) fs.writeFileSync(ip, i1); }
  }
}
const sm = path.join(ROOT, "sitemap.xml");
if (urls.length && fs.existsSync(sm) && !process.env.BLOG_OUT && !process.env.BLOG_OFFLINE) {   // an offline patch run only knows the pages on disk (no dates, no alternates): it must not rewrite the sitemap
  const add = urls.map(([u, alts, d]) => `<url><loc>${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}${alts.map(([l, h]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${h}"/>`).join("")}</url>`).join("\n");
  // blog entries already in the file (a second run without build-song-pages.mjs in front of it) are dropped first, so the append never duplicates them
  fs.writeFileSync(sm, fs.readFileSync(sm, "utf8").replace(/<url><loc>[^<]*\/blog\/[^<]*<\/loc>[\s\S]*?<\/url>\n?/g, "").replace("</urlset>", add + "\n</urlset>"));
}
console.log(`build-blog-pages: ${posts.length} posts, ${urls.length} urls  (${SITE})`);
}
if (IS_MAIN) await writeBlog();
