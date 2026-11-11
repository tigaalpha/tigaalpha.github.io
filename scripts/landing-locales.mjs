/* ── scripts/landing-locales.mjs ──
   Marketing landing page 1 ships as SIX URLs so each foreign-market campaign
   can be advertised, and measured, on its own link:

     /landing/      Thai      (canonical — built by vite into landing/)
     /landing-en/   English
     /landing-zh/   Chinese
     /landing-ja/   Japanese  (2026-11-11)
     /landing-ko/   Korean    (2026-11-11)
     /landing-ru/   Russian   (2026-11-11)

   They are the same page. This takes the ONE built HTML and rewrites only the
   parts a search result, a shared link preview and a screen reader read — the
   <html lang>, the title, the description, the Open Graph card (og:locale
   included), the canonical, and the line under the boot logo — none of which
   React ever gets to touch, because they
   are read before (and sometimes instead of) the page running at all.

   Everything else, including the bundle, is shared: the variants point back at
   ../landing/bundle/, so there is one copy of the code and the three pages
   cannot drift apart. The page picks its language up from the <html lang>
   written here.

   The six pages reference each other: the template carries one hreflang set
   (th, en, zh-Hans, ja, ko, ru, x-default = /landing-en/) that every variant
   keeps unchanged, so each page lists all six including itself.

   Generating rather than hand-maintaining more HTML files is the whole
   point: an edit to the real template reaches all six on the next build.

   LANDING_SRC / LANDING_OUT (env) point the script at another template and
   another output folder, so it can be run and checked without touching the
   tracked pages; the defaults are what `npm run build` has always used. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { landingJsonLd } from "./landing-jsonld.mjs";

const SRC = process.env.LANDING_SRC || "dist-landing/index.template.html";
const OUT = process.env.LANDING_OUT || ".";
const SITE = "https://www.tigaalpha.com";

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
    html: "en", ogLocale: "en_US",
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
    html: "zh-Hans", ogLocale: "zh_CN",
  },
  /* ja / ko / ru: written as native marketing copy, not translated word for
     word. Japanese and Korean read shorter than English, so their descriptions
     are about 80-100 characters, the same weight as the 110-160 an English or
     Russian one carries. No double quotes, ampersands or dollar signs in any
     of these: they are written into HTML attributes verbatim. */
  ja: {
    dir: "landing-ja",
    title: "AI先生とピアノのレッスンを体験 — TIGA ALPHA",
    desc: "AIピアノ先生に質問すると、答えを本物の鍵盤で弾いて見せてくれます。スケール・コード・三和音を、解説と演奏つきで学べます。登録なしで今すぐ無料体験。",
    ogTitle: "AI先生とピアノのレッスンを体験 — TIGA ALPHA",
    ogDesc: "今すぐ鍵盤を弾いて、AI先生に質問。答えを指づかいまで一本ずつ弾いて見せてくれます。登録もインストールも不要。",
    boot: "ピアノを準備しています",
    bootHeadA: "AIピアノ先生に聞けば、",
    bootHeadB: "弾いて見せてくれる",
    html: "ja", ogLocale: "ja_JP",
  },
  ko: {
    dir: "landing-ko",
    title: "AI 선생님과 피아노 레슨 체험 — TIGA ALPHA",
    desc: "AI 피아노 선생님께 질문하면 답을 진짜 건반으로 직접 쳐서 보여줘요. 스케일, 코드, 3화음을 설명과 연주로 배워 보세요. 가입 없이 바로 무료로 체험할 수 있어요.",
    ogTitle: "AI 선생님과 피아노 레슨 체험 — TIGA ALPHA",
    ogDesc: "지금 바로 건반을 눌러 보고 AI 선생님께 질문해 보세요. 답을 손가락 하나하나 쳐서 보여줘요. 가입도 설치도 필요 없어요.",
    boot: "피아노를 준비하고 있어요",
    bootHeadA: "AI 피아노 선생님께 물어보세요 — ",
    bootHeadB: "답을 쳐서 보여줘요",
    html: "ko", ogLocale: "ko_KR",
  },
  ru: {
    dir: "landing-ru",
    title: "Урок игры на пианино с ИИ-учителем — TIGA ALPHA",
    desc: "Задайте вопрос ИИ-учителю пианино и смотрите, как он играет ответ на настоящей клавиатуре: гаммы, аккорды, трезвучия. Попробуйте без регистрации.",
    ogTitle: "Урок игры на пианино с ИИ-учителем — TIGA ALPHA",
    ogDesc: "Нажимайте клавиши прямо сейчас, задайте вопрос ИИ-учителю и смотрите, как он играет ответ палец за пальцем. Без регистрации и установки.",
    boot: "Готовим ваше пианино",
    bootHeadA: "Спросите ИИ-учителя пианино — ",
    bootHeadB: "он сыграет ответ",
    html: "ru", ogLocale: "ru_RU",
  },
};

const src = readFileSync(SRC, "utf8");

// Fail loudly rather than silently shipping a Thai page on an English URL:
// every one of these must match exactly once, or the template has moved.
function swapOnce(html, find, replace, what) {
  const n = html.split(find).length - 1;
  if (n !== 1) throw new Error(`landing-locales: expected exactly 1 "${what}", found ${n}`);
  return html.replace(find, () => replace);   // a function, so a "$" in copy is never read as a pattern
}

/* The visible-to-crawlers block inside #root (replaced by React once the page
   runs), the <noscript> line and the FAQ JSON-LD, per language. en and zh are
   the approved originals and still say "Premium"; ja / ko / ru name the offer
   by its 7 days and its price only, the same rule the landing copy follows. */
const faqLd = (qa) => `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
})}</script>`;
const seoBlock = ({ h1, intro, price, cta, faqHead, qa, blog, studio = "TIGA Studio", blogDir }) => ({
  article: `<article id="seo-copy">
      <h1>${h1}</h1>
      <p>${intro}</p>
      <p>${price}</p>
      <p><a href="${SITE}/">${cta}</a></p>
      <h2>${faqHead}</h2>
      ${qa.map(([q, a]) => `<h3>${q}</h3>\n      <p>${a}</p>`).join("\n      ")}
      <p><a href="${SITE}/blog/${blogDir}/">${blog}</a> · <a href="https://www.tigastudio.net/">${studio}</a></p>
    </article>`,
  noscript: `<noscript><p>${h1}. ${price} <a href="${SITE}/blog/${blogDir}/">${blog}</a></p></noscript>`,
  faq: faqLd(qa),
});
const SEO_NEW = {
  ja: seoBlock({
    blogDir: "ja", h1: "TIGA ALPHA AIピアノ学習アプリ",
    intro: "TIGA ALPHAは、タイで作られたピアノ学習アプリです。AI先生と一緒に、日本語・英語・タイ語・中国語・韓国語・ロシア語でピアノを学べます。創業者はAum先生で、20年のキャリアを持つピアノ講師です。",
    price: "7日間無料、その後は月額799タイバーツ。", cta: "無料で始める", faqHead: "よくある質問", blog: "ブログ",
    qa: [
      ["TIGA ALPHAとは", "AIがピアノを教えるアプリです。画面上の鍵盤、マイク、MIDIピアノで練習できます。"],
      ["料金は", "7日間無料、その後は月額799タイバーツです。"],
      ["対応言語は", "日本語、英語、タイ語、中国語、韓国語、ロシア語です。"],
    ],
  }),
  ko: seoBlock({
    blogDir: "ko", h1: "TIGA ALPHA AI 피아노 학습 앱",
    intro: "TIGA ALPHA는 태국에서 만든 피아노 학습 앱이에요. AI 선생님과 함께 한국어, 영어, 태국어, 중국어, 일본어, 러시아어로 피아노를 배울 수 있어요. 창립자는 Aum 선생님으로, 20년 경력의 피아노 강사예요.",
    price: "7일 무료, 이후 월 799바트.", cta: "무료로 시작하기", faqHead: "자주 묻는 질문", blog: "블로그",
    qa: [
      ["TIGA ALPHA는 무엇인가요", "AI로 피아노를 가르치는 앱이에요. 화면 건반, 마이크, MIDI 피아노로 연습할 수 있어요."],
      ["요금은 얼마인가요", "7일 무료, 이후 월 799바트예요."],
      ["어떤 언어를 지원하나요", "한국어, 영어, 태국어, 중국어, 일본어, 러시아어를 지원해요."],
    ],
  }),
  ru: seoBlock({
    blogDir: "ru", h1: "TIGA ALPHA — приложение для обучения игре на пианино с ИИ",
    intro: "TIGA ALPHA — приложение для обучения игре на пианино, созданное в Таиланде. Учитесь с ИИ-учителем на русском, английском, тайском, китайском, японском и корейском. Основатель — преподаватель Аум, педагог-пианист с 20-летним опытом.",
    price: "7 дней бесплатно, затем 799 THB в месяц.", cta: "Начать бесплатно", faqHead: "Частые вопросы", blog: "Блог",
    qa: [
      ["Что такое TIGA ALPHA", "Приложение, в котором ИИ учит играть на пианино. Заниматься можно на экранной клавиатуре, с микрофоном или на MIDI-пианино."],
      ["Сколько это стоит", "7 дней бесплатно, затем 799 THB в месяц."],
      ["На каких языках можно учиться", "На русском, английском, тайском, китайском, японском и корейском."],
    ],
  }),
};

for (const [lang, L] of Object.entries(LOCALES)) {
  let out = src;
  out = swapOnce(out, '<html lang="th">', `<html lang="${L.html}">`, "html lang");
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
  out = swapOnce(out, '<meta property="og:locale" content="th_TH" />',
    `<meta property="og:locale" content="${L.ogLocale}" />`, "og:locale");

  const canon = `${SITE}/${L.dir}/`;
  const SEO = SEO_NEW[lang] ? SEO_NEW[lang] : lang === "zh" ? {
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

  // One bundle for all six. These sit one directory across from /landing/,
  // so the same relative depth with a different folder name.
  const nested = out.replaceAll('"./bundle/', '"../landing/bundle/');
  mkdirSync(path.join(OUT, L.dir), { recursive: true });
  writeFileSync(path.join(OUT, L.dir, "index.html"), nested);

  // ...and a plain root-level file each, mirroring landing.html, so no URL on
  // an ad ever depends on directory-index resolution.
  writeFileSync(path.join(OUT, `${L.dir}.html`), out.replaceAll('"./bundle/', '"./landing/bundle/'));

  console.log(`landing-locales: ${L.dir}/index.html + ${L.dir}.html  (lang=${L.html})`);
}
