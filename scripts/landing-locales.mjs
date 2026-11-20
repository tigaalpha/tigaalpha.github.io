/* ── scripts/landing-locales.mjs ──
   Marketing landing page 1 ships as TEN URLs so each foreign-market campaign
   can be advertised, and measured, on its own link:

     /landing/      Thai      (canonical — built by vite into landing/)
     /landing-en/   English
     /landing-zh/   Chinese
     /landing-ja/   Japanese  (2026-11-11)
     /landing-ko/   Korean    (2026-11-11)
     /landing-ru/   Russian   (2026-11-11)
     /landing-hi/   Hindi     (2026-11-13)
     /landing-es/   Spanish   (2026-11-13)
     /landing-fr/   French    (2026-11-13)
     /landing-ar/   Arabic    (2026-11-13, right to left: <html lang="ar" dir="rtl">)
     /landing-de/   German    (2026-11-20)

   They are the same page. This takes the ONE built HTML and rewrites only the
   parts a search result, a shared link preview and a screen reader read — the
   <html lang> (and dir, for a right-to-left language), the title, the
   description, the Open Graph card (og:locale included), the canonical, and the
   line under the boot logo — none of which React ever gets to touch, because they
   are read before (and sometimes instead of) the page running at all.

   Everything else, including the bundle, is shared: the variants point back at
   ../landing/bundle/, so there is one copy of the code and the ten pages
   cannot drift apart. The page picks its language up from the <html lang>
   written here (and sets dir from it, see dirOf in landing/landing-copy.ts).

   The ten pages reference each other: the template carries one hreflang set
   (th, en, zh-Hans, ja, ko, ru, hi, es, fr, ar, de, x-default = /landing-en/) that
   every variant keeps unchanged, so each page lists all ten including itself.
   The set lives in landing/index.template.html and is checked against LOCALES
   below, so a language added to one and not the other stops the build.

   Generating rather than hand-maintaining more HTML files is the whole
   point: an edit to the real template reaches all ten on the next build.

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
  /* ja / ko / ru (and hi / es / fr / ar below): written as native marketing copy, not translated word for
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
  /* hi / es / fr / ar (2026-11-13): native marketing copy again, same rules (no double quotes, ampersands or
     dollar signs: these strings are written into HTML attributes verbatim). htmlDir is the optional text direction of
     the page: only Arabic has one, and it makes the generated root <html lang="ar" dir="rtl"> (the folder name is dir,
     so the direction needed another key). */
  hi: {
    dir: "landing-hi",
    title: "AI शिक्षक के साथ पियानो का एक पाठ आज़माएँ — TIGA ALPHA",
    desc: "AI पियानो शिक्षक से कुछ भी पूछिए और देखिए कि वह जवाब असली कीबोर्ड पर बजाकर दिखाता है — स्केल, कॉर्ड, ट्रायड, सब समझाकर और बजाकर। बिना साइन अप आज़माएँ।",
    ogTitle: "AI शिक्षक के साथ पियानो का एक पाठ आज़माएँ — TIGA ALPHA",
    ogDesc: "अभी कीबोर्ड पर टैप करें, AI शिक्षक से पूछें और देखें कि वह जवाब उँगली-दर-उँगली बजाकर दिखाता है। न साइन अप, न इंस्टॉल।",
    boot: "आपका पियानो तैयार हो रहा है",
    bootHeadA: "AI पियानो शिक्षक से पूछिए — ",
    bootHeadB: "वह जवाब बजाकर दिखाएगा",
    html: "hi", ogLocale: "hi_IN",
  },
  /* es: native marketing copy, neutral Latin-American Spanish with "tú". No double
     quotes, ampersands or dollar signs: these strings are written into HTML attributes verbatim. */
  es: {
    dir: "landing-es",
    title: "Prueba una clase de piano con un profesor IA — TIGA ALPHA",
    desc: "Pregunta a un profesor de piano con IA y mira cómo te toca la respuesta en un teclado de verdad: escalas, acordes y tríadas. Pruébalo sin registrarte.",
    ogTitle: "Prueba una clase de piano con un profesor IA — TIGA ALPHA",
    ogDesc: "Toca las teclas ahora mismo, pregunta al profesor IA y mira cómo te toca la respuesta, dedo por dedo. Sin registro y sin instalar nada.",
    boot: "Preparando tu piano",
    bootHeadA: "Pregunta a un profesor de piano con IA — ",
    bootHeadB: "te responde tocando",
    html: "es", ogLocale: "es_ES",
  },
  fr: {
    dir: "landing-fr",
    title: "Essayez une leçon de piano avec un prof IA — TIGA ALPHA",
    desc: "Posez une question à un prof de piano IA et regardez-le jouer la réponse sur un vrai clavier\u00a0: gammes, accords, triades. Essayez sans inscription.",
    ogTitle: "Essayez une leçon de piano avec un prof IA — TIGA ALPHA",
    ogDesc: "Appuyez sur les touches dès maintenant, posez une question au prof IA et regardez-le jouer la réponse, doigt par doigt. Sans inscription ni installation.",
    boot: "Nous préparons votre piano",
    bootHeadA: "Demandez à un prof de piano IA — ",
    bootHeadB: "il vous joue la réponse",
    html: "fr", ogLocale: "fr_FR",
  },
  /* ar: native marketing copy in simple Modern Standard Arabic (right to left). No double quotes,
     ampersands or dollar signs: these strings are written into HTML attributes verbatim. */
  ar: {
    dir: "landing-ar",
    title: "جرّب درس بيانو مع معلّم AI — TIGA ALPHA",
    desc: "اسأل معلّم بيانو بالذكاء الاصطناعي وشاهده يعزف لك الإجابة على لوحة مفاتيح حقيقية: السلالم والأكوردات والأكوردات الثلاثية، بالشرح والعزف. جرّب دون إنشاء حساب.",
    ogTitle: "جرّب درس بيانو مع معلّم AI — TIGA ALPHA",
    ogDesc: "المس المفاتيح الآن، واسأل معلّم AI، وشاهده يعزف لك الإجابة إصبعًا إصبعًا. دون إنشاء حساب ودون تثبيت أي شيء.",
    boot: "نجهّز لك البيانو",
    bootHeadA: "اسأل معلّم بيانو بالذكاء الاصطناعي — ",
    bootHeadB: "يعزف لك الإجابة",
    html: "ar", htmlDir: "rtl", ogLocale: "ar_AR",
  },
  /* de (2026-11-20): native marketing copy, informal "du". No double quotes, ampersands or dollar signs:
     these strings are written into HTML attributes verbatim. */
  de: {
    dir: "landing-de",
    title: "Probiere eine Klavierstunde mit einem KI-Lehrer aus — TIGA ALPHA",
    desc: "Stell einem KI-Klavierlehrer eine Frage und sieh zu, wie er dir die Antwort auf echten Tasten vorspielt: Tonleitern, Akkorde, Dreiklänge. Ohne Anmeldung.",
    ogTitle: "Probiere eine Klavierstunde mit einem KI-Lehrer aus — TIGA ALPHA",
    ogDesc: "Spiele gleich auf den Tasten, stell dem KI-Lehrer eine Frage und sieh zu, wie er dir die Antwort Finger für Finger vorspielt. Ohne Anmeldung, ohne Installation.",
    boot: "Wir machen dein Klavier bereit",
    bootHeadA: "Frag einen KI-Klavierlehrer — ",
    bootHeadB: "er spielt dir die Antwort vor",
    html: "de", ogLocale: "de_DE",
  },
};

const src = readFileSync(SRC, "utf8");

/* The hreflang cluster is written once, in the template, and every variant keeps it: th, then each language in
   LOCALES, then x-default = the English page. If the template and LOCALES disagree (a language added to one and
   not the other) say so now, rather than ship a cluster that points at a page that is not there or leaves one out. */
{
  const want = [["th", `${SITE}/landing/`], ...Object.values(LOCALES).map((L) => [L.html, `${SITE}/${L.dir}/`]), ["x-default", `${SITE}/landing-en/`]];
  const have = [...src.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  if (JSON.stringify(have) !== JSON.stringify(want))
    throw new Error("landing-locales: the template's hreflang set is not th + every LOCALES entry + x-default:\n  template: " + have.map((x) => x.join(" ")).join(", ") + "\n  expected: " + want.map((x) => x.join(" ")).join(", "));
}

// Fail loudly rather than silently shipping a Thai page on an English URL:
// every one of these must match exactly once, or the template has moved.
function swapOnce(html, find, replace, what) {
  const n = html.split(find).length - 1;
  if (n !== 1) throw new Error(`landing-locales: expected exactly 1 "${what}", found ${n}`);
  return html.replace(find, () => replace);   // a function, so a "$" in copy is never read as a pattern
}

/* The visible-to-crawlers block inside #root (replaced by React once the page
   runs), the <noscript> line and the FAQ JSON-LD, per language. en and zh are
   the approved originals and still say "Premium"; ja / ko / ru / hi / es / fr / ar
   name the offer by its 7 days and its price only, the same rule the landing copy follows. */
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
    intro: "TIGA ALPHAは、タイで作られたピアノ学習アプリです。AI先生と一緒に、10言語（タイ語・英語・中国語・アラビア語・日本語・ロシア語・スペイン語・フランス語・ヒンディー語・韓国語）でピアノを学べます。創業者はAum先生で、20年のキャリアを持つピアノ講師です。",
    price: "7日間無料、その後は月額US$24.99。", cta: "無料で始める", faqHead: "よくある質問", blog: "ブログ",
    qa: [
      ["TIGA ALPHAとは", "AIがピアノを教えるアプリです。画面上の鍵盤、マイク、MIDIピアノで練習できます。"],
      ["料金は", "7日間無料、その後は月額US$24.99です。"],
      ["対応言語は", "10言語（タイ語・英語・中国語・アラビア語・日本語・ロシア語・スペイン語・フランス語・ヒンディー語・韓国語）です。"],
    ],
  }),
  ko: seoBlock({
    blogDir: "ko", h1: "TIGA ALPHA AI 피아노 학습 앱",
    intro: "TIGA ALPHA는 태국에서 만든 피아노 학습 앱이에요. AI 선생님과 함께 10개 언어(태국어, 영어, 중국어, 아랍어, 일본어, 러시아어, 스페인어, 프랑스어, 힌디어, 한국어)로 피아노를 배울 수 있어요. 창립자는 Aum 선생님으로, 20년 경력의 피아노 강사예요.",
    price: "7일 무료, 이후 월 US$24.99.", cta: "무료로 시작하기", faqHead: "자주 묻는 질문", blog: "블로그",
    qa: [
      ["TIGA ALPHA는 무엇인가요", "AI로 피아노를 가르치는 앱이에요. 화면 건반, 마이크, MIDI 피아노로 연습할 수 있어요."],
      ["요금은 얼마인가요", "7일 무료, 이후 월 US$24.99예요."],
      ["어떤 언어를 지원하나요", "10개 언어(태국어, 영어, 중국어, 아랍어, 일본어, 러시아어, 스페인어, 프랑스어, 힌디어, 한국어)를 지원해요."],
    ],
  }),
  ru: seoBlock({
    blogDir: "ru", h1: "TIGA ALPHA — приложение для обучения игре на пианино с ИИ",
    intro: "TIGA ALPHA — приложение для обучения игре на пианино, созданное в Таиланде. Учитесь с ИИ-учителем на 10 языках: тайском, английском, китайском, арабском, японском, русском, испанском, французском, хинди и корейском. Основатель — преподаватель Aum, педагог-пианист с 20-летним опытом.",
    price: "7 дней бесплатно, затем US$24.99 в месяц.", cta: "Начать бесплатно", faqHead: "Частые вопросы", blog: "Блог",
    qa: [
      ["Что такое TIGA ALPHA", "Приложение, в котором ИИ учит играть на пианино. Заниматься можно на экранной клавиатуре, с микрофоном или на MIDI-пианино."],
      ["Сколько это стоит", "7 дней бесплатно, затем US$24.99 в месяц."],
      ["На каких языках можно учиться", "На 10 языках: тайском, английском, китайском, арабском, японском, русском, испанском, французском, хинди и корейском."],
    ],
  }),
  hi: seoBlock({
    blogDir: "hi", h1: "TIGA ALPHA — AI से पियानो सिखाने वाला ऐप",
    intro: "TIGA ALPHA थाईलैंड में बना पियानो सिखाने वाला ऐप है। AI शिक्षक के साथ आप 10 भाषाओं में पियानो सीख सकते हैं: थाई, अंग्रेज़ी, चीनी, अरबी, जापानी, रूसी, स्पेनिश, फ़्रेंच, हिन्दी और कोरियाई। संस्थापक शिक्षक Aum हैं, जिन्हें पियानो सिखाने का 20 साल का अनुभव है।",
    price: "7 दिन मुफ़्त, फिर US$24.99 प्रति माह।", cta: "मुफ़्त शुरू करें", faqHead: "अक्सर पूछे जाने वाले सवाल", blog: "ब्लॉग",
    qa: [
      ["TIGA ALPHA क्या है?", "ऐसा ऐप जिसमें AI पियानो सिखाता है। आप ऑन-स्क्रीन कीबोर्ड, माइक्रोफ़ोन या MIDI पियानो से अभ्यास कर सकते हैं।"],
      ["इसकी कीमत क्या है?", "7 दिन मुफ़्त, फिर US$24.99 प्रति माह।"],
      ["किन भाषाओं में सीख सकते हैं?", "10 भाषाओं में: थाई, अंग्रेज़ी, चीनी, अरबी, जापानी, रूसी, स्पेनिश, फ़्रेंच, हिन्दी और कोरियाई।"],
    ],
  }),
  es: seoBlock({
    blogDir: "es", h1: "TIGA ALPHA — app para aprender piano con IA",
    intro: "TIGA ALPHA es una app para aprender piano creada en Tailandia. Aprende con un profesor IA en 10 idiomas: tailandés, inglés, chino, árabe, japonés, ruso, español, francés, hindi y coreano. Fue fundada por Aum, docente de piano con 20 años de experiencia.",
    price: "7 días gratis, luego US$24.99 al mes.", cta: "Empezar gratis", faqHead: "Preguntas frecuentes", blog: "Blog",
    qa: [
      ["¿Qué es TIGA ALPHA?", "Una app en la que una IA te enseña piano. Puedes practicar con el teclado en pantalla, con el micrófono o con un piano MIDI."],
      ["¿Cuánto cuesta?", "7 días gratis, luego US$24.99 al mes."],
      ["¿En qué idiomas puedo aprender?", "En 10 idiomas: tailandés, inglés, chino, árabe, japonés, ruso, español, francés, hindi y coreano."],
    ],
  }),
  fr: seoBlock({
    blogDir: "fr", h1: "TIGA ALPHA — l'application pour apprendre le piano avec un prof IA",
    intro: "TIGA ALPHA est une application pour apprendre le piano, conçue en Thaïlande. Apprenez avec un prof IA en 10\u00a0langues\u00a0: thaï, anglais, chinois, arabe, japonais, russe, espagnol, français, hindi et coréen. TIGA ALPHA a été fondée par Aum, professeur de piano avec 20\u00a0ans d'expérience.",
    price: "7\u00a0jours d'essai gratuit, puis US$24.99 par mois.", cta: "Commencer gratuitement", faqHead: "Questions fréquentes", blog: "Blog",
    qa: [
      ["Qu'est-ce que TIGA ALPHA\u00a0?", "Une application où une IA enseigne le piano. Entraînez-vous sur le clavier à l'écran, avec le micro de votre appareil ou sur un piano MIDI."],
      ["Combien ça coûte\u00a0?", "7\u00a0jours d'essai gratuit, puis US$24.99 par mois."],
      ["Dans quelles langues peut-on apprendre\u00a0?", "En 10\u00a0langues\u00a0: thaï, anglais, chinois, arabe, japonais, russe, espagnol, français, hindi et coréen."],
    ],
  }),
  ar: seoBlock({
    blogDir: "ar", h1: "TIGA ALPHA — تطبيق لتعلّم البيانو بالذكاء الاصطناعي",
    intro: "TIGA ALPHA تطبيق لتعلّم البيانو صُنع في تايلاند. يمكنك أن تتعلّم مع معلّم يعمل بالذكاء الاصطناعي بإحدى 10 لغات: التايلاندية والإنجليزية والصينية والعربية واليابانية والروسية والإسبانية والفرنسية والهندية والكورية. تأسس التطبيق على يد Aum، وتمتد خبرة Aum في تدريس البيانو 20 عامًا.",
    price: "7 أيام مجانًا، ثم US$24.99 شهريًا.", cta: "ابدأ مجانًا", faqHead: "الأسئلة الشائعة", blog: "المدوّنة",
    qa: [
      ["ما هو TIGA ALPHA؟", "تطبيق يعلّمك فيه الذكاء الاصطناعي العزف على البيانو. يمكنك التدرّب على المفاتيح التي تظهر على الشاشة، أو باستخدام الميكروفون، أو على بيانو MIDI."],
      ["كم التكلفة؟", "7 أيام مجانًا، ثم US$24.99 شهريًا."],
      ["ما اللغات المتاحة للتعلّم؟", "10 لغات: التايلاندية والإنجليزية والصينية والعربية واليابانية والروسية والإسبانية والفرنسية والهندية والكورية."],
    ],
  }),
  de: seoBlock({
    blogDir: "de", h1: "TIGA ALPHA — die App zum Klavierlernen mit KI-Lehrer",
    intro: "TIGA ALPHA ist eine App zum Klavierlernen, entwickelt in Thailand. Lerne mit einem KI-Lehrer in 10 Sprachen: Thai, Englisch, Chinesisch, Arabisch, Japanisch, Russisch, Spanisch, Französisch, Hindi und Koreanisch. Gegründet wurde TIGA ALPHA von Aum, mit 20 Jahren Erfahrung im Klavierunterricht.",
    price: "7 Tage kostenlos testen, danach US$24.99 pro Monat.", cta: "Kostenlos starten", faqHead: "Häufige Fragen", blog: "Blog",
    qa: [
      ["Was ist TIGA ALPHA?", "Eine App, in der dir eine KI das Klavierspielen beibringt. Du kannst auf der Bildschirmtastatur, mit dem Mikrofon oder an einem MIDI-Klavier üben."],
      ["Was kostet es?", "7 Tage kostenlos testen, danach US$24.99 pro Monat."],
      ["In welchen Sprachen kann ich lernen?", "In 10 Sprachen: Thai, Englisch, Chinesisch, Arabisch, Japanisch, Russisch, Spanisch, Französisch, Hindi und Koreanisch."],
    ],
  }),
};

for (const [lang, L] of Object.entries(LOCALES)) {
  let out = src;
  out = swapOnce(out, '<html lang="th">', `<html lang="${L.html}"${L.htmlDir ? ` dir="${L.htmlDir}"` : ""}>`, "html lang");
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
      <p>TIGA ALPHA 是泰国团队做的钢琴教学App，可以用 10 种语言跟 AI 老师学钢琴：中文、英文、泰语、阿拉伯语、日语、俄语、西班牙语、法语、印地语和韩语。创始人是 Aum 老师，有 20 年钢琴教学经验。</p>
      <p>高级版免费 7 天，之后每月 ¥176。</p>
      <p><a href="https://www.tigaalpha.com/">免费开始学</a></p>
      <h2>常见问题</h2>
      <h3>TIGA ALPHA 是什么</h3>
      <p>用 AI 教钢琴的应用，可以用屏幕键盘、麦克风或 MIDI 钢琴练习。</p>
      <h3>怎么收费</h3>
      <p>高级版免费 7 天，之后每月 ¥176。</p>
      <h3>有哪些语言</h3>
      <p>10 种语言：中文、英文、泰语、阿拉伯语、日语、俄语、西班牙语、法语、印地语和韩语。</p>
      <p><a href="https://www.tigaalpha.com/blog/zh/">博客</a> · <a href="https://www.tigaalpha.com/faq/zh/">更多问题</a> · <a href="https://www.tigastudio.net/">TIGA Studio</a></p>
    </article>`,
    noscript: `<noscript><p>TIGA ALPHA AI钢琴教学App。高级版免费 7 天，之后每月 ¥176。<a href="https://www.tigaalpha.com/blog/zh/">博客</a></p></noscript>`,
    faq: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"TIGA ALPHA 是什么","acceptedAnswer":{"@type":"Answer","text":"用 AI 教钢琴的应用，可以用屏幕键盘、麦克风或 MIDI 钢琴练习。"}},{"@type":"Question","name":"怎么收费","acceptedAnswer":{"@type":"Answer","text":"高级版免费 7 天，之后每月 ¥176。"}},{"@type":"Question","name":"有哪些语言","acceptedAnswer":{"@type":"Answer","text":"10 种语言：中文、英文、泰语、阿拉伯语、日语、俄语、西班牙语、法语、印地语和韩语。"}}]}</script>`,
  } : {
    article: `<article id="seo-copy">
      <h1>TIGA ALPHA, the AI piano teaching app</h1>
      <p>TIGA ALPHA is a piano-teaching app made in Thailand. Learn piano with an AI teacher in 10 languages: English, Thai, Mandarin, Arabic, Japanese, Russian, Spanish, French, Hindi and Korean. The founder is Teacher Aum, a piano teacher with 20 years of experience.</p>
      <p>Premium is free for 7 days, then US$24.99 a month.</p>
      <p><a href="https://www.tigaalpha.com/">Start free</a></p>
      <h2>Questions</h2>
      <h3>What is TIGA ALPHA</h3>
      <p>An AI piano teaching app. Practise on the on-screen keys, a microphone, or a MIDI piano.</p>
      <h3>What does it cost</h3>
      <p>Premium is free for 7 days, then US$24.99 a month.</p>
      <h3>Which languages</h3>
      <p>10 languages: English, Thai, Mandarin, Arabic, Japanese, Russian, Spanish, French, Hindi and Korean.</p>
      <p><a href="https://www.tigaalpha.com/blog/en/">Blog</a> · <a href="https://www.tigaalpha.com/faq/en/">More questions</a> · <a href="https://www.tigastudio.net/">TIGA Studio</a></p>
    </article>`,
    noscript: `<noscript><p>TIGA ALPHA, the AI piano teaching app. Premium is free for 7 days, then US$24.99 a month. <a href="https://www.tigaalpha.com/blog/en/">Blog</a></p></noscript>`,
    faq: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is TIGA ALPHA","acceptedAnswer":{"@type":"Answer","text":"An AI piano teaching app. Practise on the on-screen keys, a microphone, or a MIDI piano."}},{"@type":"Question","name":"What does it cost","acceptedAnswer":{"@type":"Answer","text":"Premium is free for 7 days, then US$24.99 a month."}},{"@type":"Question","name":"Which languages","acceptedAnswer":{"@type":"Answer","text":"10 languages: English, Thai, Mandarin, Arabic, Japanese, Russian, Spanish, French, Hindi and Korean."}}]}</script>`,
  };
  out = out.replace(/<article id="seo-copy">[\s\S]*?<\/article>/, SEO.article);
  out = out.replace(/<noscript>[\s\S]*?<\/noscript>/, SEO.noscript);
  out = out.replace(/<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"FAQPage"[\s\S]*?<\/script>/, SEO.faq);
  out = swapOnce(out, '<link rel="canonical" href="https://www.tigaalpha.com/landing/" />',
    `<link rel="canonical" href="${canon}" />`, "canonical");
  out = swapOnce(out, '<meta property="og:url" content="https://www.tigaalpha.com/landing/" />',
    `<meta property="og:url" content="${canon}" />`, "og:url");

  // One bundle for all ten. These sit one directory across from /landing/,
  // so the same relative depth with a different folder name.
  const nested = out.replaceAll('"./bundle/', '"../landing/bundle/');
  mkdirSync(path.join(OUT, L.dir), { recursive: true });
  writeFileSync(path.join(OUT, L.dir, "index.html"), nested);

  // ...and a plain root-level file each, mirroring landing.html, so no URL on
  // an ad ever depends on directory-index resolution.
  writeFileSync(path.join(OUT, `${L.dir}.html`), out.replaceAll('"./bundle/', '"./landing/bundle/'));

  console.log(`landing-locales: ${L.dir}/index.html + ${L.dir}.html  (lang=${L.html})`);
}
