/* ── scripts/landing-locales.mjs ──
   Marketing landing page 1 ships as THREE URLs so each foreign-market campaign
   can be advertised, and measured, on its own link:

     /landing/      Thai      (canonical — built by vite into landing/)
     /landing-en/   English
     /landing-zh/   Chinese

   They are the same page. This takes the ONE built HTML and rewrites only the
   parts a search result, a shared link preview and a screen reader read — the
   <html lang>, the title, the description, the Open Graph card, and the line
   under the boot logo — none of which React ever gets to touch, because they
   are read before (and sometimes instead of) the page running at all.

   Everything else, including the bundle, is shared: the variants point back at
   ../landing/bundle/, so there is one copy of the code and the three pages
   cannot drift apart. The page picks its language up from the <html lang>
   written here.

   Generating rather than hand-maintaining two more HTML files is the whole
   point: an edit to the real template reaches all three on the next build. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { landingJsonLd } from "./landing-jsonld.mjs";

const SRC = "dist-landing/index.template.html";

const LOCALES = {
  en: {
    dir: "landing-en",
    title: "Try a piano lesson with an AI teacher — TIGA ALPHA",
    desc: "Ask an AI piano teacher and watch it play the answer on a real keyboard — scales, chords, triads, explained and played for you. No sign-up to try.",
    ogTitle: "Try a piano lesson with an AI teacher — TIGA ALPHA",
    ogDesc: "Play the keys right now, ask the AI teacher, and watch it play the answer finger by finger. No sign-up, nothing to install.",
    boot: "Getting your piano ready",
    bootHeadA: "Ask an AI piano teacher — ",
    bootHeadB: "it plays the answer",
  },
  zh: {
    dir: "landing-zh",
    title: "和 AI 钢琴老师试上一课 — TIGA ALPHA",
    desc: "问 AI 钢琴老师，看它在真实键盘上弹给你看——音阶、和弦、三和弦，边讲边弹。无需注册即可试用。",
    ogTitle: "和 AI 钢琴老师试上一课 — TIGA ALPHA",
    ogDesc: "琴键现在就能弹，问 AI 老师，看它一个音一个音弹给你看。不用注册，不用下载。",
    boot: "正在为你准备钢琴",
    bootHeadA: "问 AI 钢琴老师 — ",
    bootHeadB: "它弹给你看",
  },
};

const src = readFileSync(SRC, "utf8");

// Fail loudly rather than silently shipping a Thai page on an English URL:
// every one of these must match exactly once, or the template has moved.
function swapOnce(html, find, replace, what) {
  const n = html.split(find).length - 1;
  if (n !== 1) throw new Error(`landing-locales: expected exactly 1 "${what}", found ${n}`);
  return html.replace(find, replace);
}

for (const [lang, L] of Object.entries(LOCALES)) {
  let out = src;
  out = swapOnce(out, '<html lang="th">', `<html lang="${lang === "zh" ? "zh-Hans" : lang}">`, "html lang");
  out = swapOnce(out, "<title>ลองเรียนเปียโนกับครู AI — TIGA ALPHA</title>", `<title>${L.title}</title>`, "title");
  out = swapOnce(out,
    'content="ถามครูเปียโน AI แล้วดูมันเล่นให้ดูบนคีย์บอร์ดจริง — สเกล คอร์ด ทรัยแอด อธิบายพร้อมเล่นให้ฟัง ลองได้ทันทีไม่ต้องสมัคร"',
    `content="${L.desc}"`, "description");
  out = swapOnce(out, 'property="og:title" content="ลองเรียนเปียโนกับครู AI — TIGA ALPHA"',
    `property="og:title" content="${L.ogTitle}"`, "og:title");
  out = swapOnce(out,
    'property="og:description" content="กดคีย์เล่นได้เลย ถามครู AI แล้วดูมันเล่นให้ดูทีละนิ้ว ไม่ต้องสมัคร ไม่ต้องโหลดแอป"',
    `property="og:description" content="${L.ogDesc}"`, "og:description");
  out = swapOnce(out, '<div class="say">กำลังเตรียมเปียโนให้คุณ</div>',
    `<div class="say">${L.boot}</div>`, "boot line");
  out = swapOnce(out,
    '<h1>ถามครูเปียโน AI — <em>เล่นให้ดูทีละนิ้ว</em></h1>',
    `<h1>${L.bootHeadA}<em>${L.bootHeadB}</em></h1>`, "boot headline");

  out = swapOnce(out, landingJsonLd("th"), landingJsonLd(lang), "JSON-LD");

  const canon = lang === "zh" ? "https://www.tigaalpha.com/landing-zh/" : "https://www.tigaalpha.com/landing-en/";
  const SEO = lang === "zh" ? {
    article: `<article id="seo-copy">
      <h1>TIGA ALPHA AI钢琴教学App</h1>
      <p>TIGA ALPHA 是泰国团队做的钢琴教学App，可以用中文、英文和泰语跟 AI 老师学钢琴。创始人是 Aum 老师，有 20 年钢琴教学经验。</p>
      <p>高级版免费 7 天，之后每月 799 泰铢。</p>
      <p><a href="https://www.tigaalpha.com/">免费开始学</a></p>
      <h2>常见问题</h2>
      <h3>TIGA ALPHA 是什么</h3>
      <p>用 AI 教钢琴的应用，可以用屏幕键盘、麦克风或 MIDI 钢琴练习。</p>
      <h3>怎么收费</h3>
      <p>高级版免费 7 天，之后每月 799 泰铢。</p>
      <h3>有哪些语言</h3>
      <p>中文、英文和泰语。</p>
      <p><a href="https://www.tigaalpha.com/blog/zh/">博客</a> · <a href="https://www.tigaalpha.com/faq/zh/">更多问题</a> · <a href="https://www.tigastudio.net/">TIGA Studio</a></p>
    </article>`,
    noscript: `<noscript><p>TIGA ALPHA AI钢琴教学App。高级版免费 7 天，之后每月 799 泰铢。<a href="https://www.tigaalpha.com/blog/zh/">博客</a></p></noscript>`,
    faq: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"TIGA ALPHA 是什么","acceptedAnswer":{"@type":"Answer","text":"用 AI 教钢琴的应用，可以用屏幕键盘、麦克风或 MIDI 钢琴练习。"}},{"@type":"Question","name":"怎么收费","acceptedAnswer":{"@type":"Answer","text":"高级版免费 7 天，之后每月 799 泰铢。"}},{"@type":"Question","name":"有哪些语言","acceptedAnswer":{"@type":"Answer","text":"中文、英文和泰语。"}}]}</script>`,
  } : {
    article: `<article id="seo-copy">
      <h1>TIGA ALPHA, the AI piano teaching app</h1>
      <p>TIGA ALPHA is a piano-teaching app made in Thailand. Learn piano with an AI teacher in English, Thai and Mandarin. The founder is Teacher Aum, a piano teacher with 20 years of experience.</p>
      <p>Premium is free for 7 days, then 799 THB a month.</p>
      <p><a href="https://www.tigaalpha.com/">Start free</a></p>
      <h2>Questions</h2>
      <h3>What is TIGA ALPHA</h3>
      <p>An AI piano teaching app. Practise on the on-screen keys, a microphone, or a MIDI piano.</p>
      <h3>What does it cost</h3>
      <p>Premium is free for 7 days, then 799 THB a month.</p>
      <h3>Which languages</h3>
      <p>English, Thai and Mandarin.</p>
      <p><a href="https://www.tigaalpha.com/blog/en/">Blog</a> · <a href="https://www.tigaalpha.com/faq/en/">More questions</a> · <a href="https://www.tigastudio.net/">TIGA Studio</a></p>
    </article>`,
    noscript: `<noscript><p>TIGA ALPHA, the AI piano teaching app. Premium is free for 7 days, then 799 THB a month. <a href="https://www.tigaalpha.com/blog/en/">Blog</a></p></noscript>`,
    faq: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is TIGA ALPHA","acceptedAnswer":{"@type":"Answer","text":"An AI piano teaching app. Practise on the on-screen keys, a microphone, or a MIDI piano."}},{"@type":"Question","name":"What does it cost","acceptedAnswer":{"@type":"Answer","text":"Premium is free for 7 days, then 799 THB a month."}},{"@type":"Question","name":"Which languages","acceptedAnswer":{"@type":"Answer","text":"English, Thai and Mandarin."}}]}</script>`,
  };
  out = out.replace(/<article id="seo-copy">[\s\S]*?<\/article>/, SEO.article);
  out = out.replace(/<noscript>[\s\S]*?<\/noscript>/, SEO.noscript);
  out = out.replace(/<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"FAQPage"[\s\S]*?<\/script>/, SEO.faq);
  out = swapOnce(out, '<link rel="canonical" href="https://www.tigaalpha.com/landing/" />',
    `<link rel="canonical" href="${canon}" />`, "canonical");
  out = swapOnce(out, '<meta property="og:url" content="https://www.tigaalpha.com/landing/" />',
    `<meta property="og:url" content="${canon}" />`, "og:url");

  // One bundle for all three. These sit one directory across from /landing/,
  // so the same relative depth with a different folder name.
  const nested = out.replaceAll('"./bundle/', '"../landing/bundle/');
  mkdirSync(L.dir, { recursive: true });
  writeFileSync(`${L.dir}/index.html`, nested);

  // ...and a plain root-level file each, mirroring landing.html, so no URL on
  // an ad ever depends on directory-index resolution.
  writeFileSync(`${L.dir}.html`, out.replaceAll('"./bundle/', '"./landing/bundle/'));

  console.log(`landing-locales: ${L.dir}/index.html + ${L.dir}.html  (lang=${lang})`);
}
