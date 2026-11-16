#!/usr/bin/env node
/* smoke-blog-jakoru.mjs — the blog in Japanese, Korean and Russian (owner 2026-11-11) and Hindi, Spanish, French and Arabic (owner 2026-11-13; Arabic is right-to-left), next to Thai, English and Mandarin.
   Articles for the new languages are committed files, blog-src/<ja|ko|ru|hi|es|fr|ar>/<slug>.json; the generator turns them into pages, a real index, a feed and a sitemap file even when the database is
   unreachable, and a database row with the same (lang, slug) wins. This test runs the REAL generator, blog-paths.mjs, blog-live.mjs and the wall in Chromium; it touches no repo file and no network:
   scripts/build-blog-pages.mjs is run with BLOG_FIXTURE / BLOG_OUT / BLOG_SRC / SITE_URL into a temp folder.
     node scripts/smoke-blog-jakoru.mjs */
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import http from "node:http";
import { execSync, execFileSync, spawnSync } from "node:child_process"; import { pathToFileURL, fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-jkr-"));
const SITE = "https://www.tigaalpha.com";
const W = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof s === "string" ? s : JSON.stringify(s)); };
const rd = (f) => fs.readFileSync(f, "utf8");
// "undefined", "[object" and "NaN" are what a lookup that misses a language (map[lang]) or a number that is not one prints into a page. The reader script says `undefined` in its own code, so only what a reader or a
// crawler gets counts: the markup without its <script> and <style> blocks.
const PLACEHOLDER = /undefined|\[object|NaN/, visibleMarkup = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const GEN = path.join(ROOT, "scripts/build-blog-pages.mjs");
function gen(env, { cwd } = {}) {
  const r = spawnSync("node", [env.__script || GEN], { env: { ...process.env, BLOG_SRC: "", BLOG_FIXTURE: "", BLOG_OFFLINE: "", BLOG_OUT: "", SITE_URL: SITE, ...env, __script: undefined }, encoding: "utf8", cwd });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const src = (lang, slug, o = {}) => ({ lang, slug, category: "tips", title: `${lang.toUpperCase()} title ${slug}`, excerpt: `${lang} excerpt for ${slug}, long enough to read like a summary`, body: "## Head\n\nPara **bold** here.\n\n- a\n- b\n\n1. one\n2. two\n" + "word ".repeat(80), created_at: "2026-11-11", published: true, ...o });

// ───────── fixtures ─────────
// the seven languages that ship as source files, and the hreflang tag of each of the ten blog languages
const STAT = ["ja", "ko", "ru", "hi", "es", "fr", "ar"], NEWL = ["hi", "es", "fr", "ar"], ALLL = ["th", "en", "zh", ...STAT];
const HL = { th: "th", en: "en", zh: "zh-Hans", ja: "ja", ko: "ko", ru: "ru", hi: "hi", es: "es", fr: "fr", ar: "ar" };
// titles in each language, so the language-specific checks look at real text (with digits and Latin words in the Arabic one, where right-to-left text goes wrong first)
const TITLE = { ja: "ピアノの姿勢と座り方", ko: "피아노 자세와 앉는 법", ru: "Посадка за фортепиано", hi: "पियानो बजाते समय बैठने का सही तरीका", es: "Postura correcta al sentarse al piano", fr: "La bonne posture au piano", ar: "وضعية الجلوس الصحيحة: 15 دقيقة في TIGA ALPHA" };
const S = path.join(tmp, "blog-src");
for (const l of STAT) W(path.join(S, l, "piano-posture.json"), src(l, "piano-posture", { title: TITLE[l], category: "theory", created_at: "2026-11-11" }));
W(path.join(S, "ja", "second-article.json"), src("ja", "second-article", { created_at: "2026-11-12", category: "news" }));
W(path.join(S, "ar", "second-article.json"), src("ar", "second-article", { created_at: "2026-11-12", category: "news" }));
W(path.join(S, "ja", "db-wins.json"), src("ja", "db-wins", { title: "STATIC TITLE (must lose to the database row)" }));
// malformed files: each one must be skipped with a warning and must not stop the build
W(path.join(S, "ja", "broken.json"), "{ this is not json");
W(path.join(S, "ja", "wrong-lang.json"), src("ko", "wrong-lang"));
W(path.join(S, "ja", "no-title.json"), src("ja", "no-title", { title: "" }));
W(path.join(S, "ja", "bad-date.json"), src("ja", "bad-date", { created_at: "yesterday" }));
W(path.join(S, "ja", "name-mismatch.json"), src("ja", "other-name"));
W(path.join(S, "ko", "Bad_Slug.json"), src("ko", "Bad_Slug"));
W(path.join(S, "ja", "draft.json"), src("ja", "draft", { published: false }));
W(path.join(S, "th", "ignored.json"), src("th", "ignored"));   // blog-src only holds the seven source-file languages: th / en / zh stay in the database
W(path.join(S, "ar", "broken.json"), "{ nope, not json");   // the new languages are validated like ja / ko / ru
W(path.join(S, "hi", "wrong-lang.json"), src("es", "wrong-lang"));
W(path.join(S, "fr", "Bad_Slug.json"), src("fr", "Bad_Slug"));
W(path.join(S, "es", "no-body.json"), src("es", "no-body", { body: "   " }));
const dbPosts = [
  ...["th", "en", "zh"].map(lang => ({ id: "p-" + lang, lang, slug: "piano-posture", category: "tips", title: { th: "ท่านั่งเล่นเปียโน", en: "Piano posture", zh: "钢琴坐姿" }[lang], excerpt: "x", body: "# H\n" + "para ".repeat(200) + "\n\n" + "more ".repeat(400), cover_url: null, published: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" })),
  { id: "p-dbwins", lang: "ja", slug: "db-wins", category: "tips", title: "DB TITLE (wins)", excerpt: "db excerpt", body: "From the database.\n", cover_url: null, published: true, created_at: "2026-11-05T00:00:00Z", updated_at: "2026-11-05T00:00:00Z" },
];
W(path.join(tmp, "posts.json"), dbPosts);
const OUT = path.join(tmp, "out");
const r1 = gen({ BLOG_FIXTURE: path.join(tmp, "posts.json"), BLOG_OUT: OUT, BLOG_SRC: S });

console.log("reading the source files");
ok(r1.code === 0, "the build succeeds although some source files are malformed");
for (const [f, why] of [["ja/broken.json", "not valid JSON"], ["ja/wrong-lang.json", "lang is"], ["ja/no-title.json", "title is empty"], ["ja/bad-date.json", "created_at"], ["ja/name-mismatch.json", "does not match the file name"], ["ko/Bad_Slug.json", "slug"], ["ar/broken.json", "not valid JSON"], ["hi/wrong-lang.json", "lang is"], ["fr/Bad_Slug.json", "slug"], ["es/no-body.json", "body is empty"]])
  ok(r1.err.includes(f) && r1.err.includes(why), "a warning names " + f + " (" + why + ")");
ok(["ar/broken", "hi/wrong-lang", "fr/Bad_Slug", "es/no-body"].every(f => !fs.existsSync(path.join(OUT, f + ".html"))), "no page for a malformed hi / es / fr / ar source file either");
ok(!r1.err.includes("draft.json") && !fs.existsSync(path.join(OUT, "ja", "draft.html")), "a draft (published: false) is skipped quietly and gets no page");
for (const bad of ["broken", "wrong-lang", "no-title", "bad-date", "other-name", "name-mismatch"]) ok(!fs.existsSync(path.join(OUT, "ja", bad + ".html")), "no page for the malformed " + bad);
ok(!fs.existsSync(path.join(OUT, "ko", "Bad_Slug.html")) && !fs.existsSync(path.join(OUT, "th", "ignored.html")), "no page for an invalid slug, and blog-src/th is not read");
ok(/\(\d+ from blog-src\)/.test(r1.out), "the build reports how many posts came from blog-src: " + (r1.out.match(/\(\d+ from blog-src\)/) || [""])[0]);

console.log("article pages in ja / ko / ru / hi / es / fr / ar");
// the wall's four lines per language (title, Google button, sign-up button, log-in line); "\u00a0" is the no-break space of hi / es / fr / ar (a phone never splits "TIGA AI"; es keeps "Inicia sesión" together), compared as a plain space
const wall = { ja: ["続きを読むにはログイン", "Googleで続ける", "無料で会員登録", "ログイン"], ko: ["계속 읽으려면 로그인하세요", "Google로 계속하기", "무료로 가입하기", "로그인"], ru: ["Войдите, чтобы читать дальше", "Продолжить через Google", "Зарегистрироваться бесплатно", "Войти"],
  hi: ["आगे पढ़ने के लिए लॉग इन करें", "Google से जारी रखें", "मुफ़्त में साइन अप करें", "पहले से सदस्य हैं? लॉग इन करें"],
  es: ["Inicia sesión para seguir leyendo", "Continuar con Google", "Regístrate gratis", "¿Ya eres miembro? Inicia sesión"],
  fr: ["Connectez-vous pour continuer à lire", "Continuer avec Google", "S'inscrire gratuitement", "Déjà membre\u00a0? Se connecter"],
  ar: ["سجّل الدخول لمواصلة القراءة", "المتابعة باستخدام Google", "إنشاء حساب مجاني", "لديك حساب بالفعل؟ تسجيل الدخول"] };
const nb = (s) => String(s).replace(/\u00a0/g, " ");
const trialWords = { ja: ["7日間無料", "クレジットカードは不要"], ko: ["7일 동안 무료", "신용카드는 필요 없어요"], ru: ["7 дней бесплатно", "банковская карта не нужна"], hi: ["7 दिन तक पियानो के पाठ मुफ़्त", "क्रेडिट कार्ड की ज़रूरत नहीं"], es: ["gratis durante 7 días", "sin tarjeta de crédito"], fr: ["gratuitement pendant 7 jours", "sans carte bancaire"], ar: ["مجانًا لمدة 7 أيام", "بطاقة ائتمان"] };
const LOC = { ja: "ja_JP", ko: "ko_KR", ru: "ru_RU", hi: "hi_IN", es: "es_ES", fr: "fr_FR", ar: "ar_AR" }, AUM = { ja: "アウム先生", ko: "아움 선생님", ru: "Учитель Aum", hi: "टीचर Aum", es: "Profe Aum", fr: "Prof Aum", ar: "المعلّم Aum" }, CAT = { ja: "音楽理論", ko: "음악 이론", ru: "Теория музыки", hi: "संगीत सिद्धांत", es: "Teoría musical", fr: "Théorie musicale", ar: "نظرية الموسيقى" }, BACK = { ja: "すべての記事", ko: "모든 글", ru: "Все статьи", hi: "सभी लेख", es: "Todos los artículos", fr: "Tous les articles", ar: "كل المقالات" }, CTA = { ja: "TIGA ALPHAで無料で始めよう", ko: "TIGA ALPHA에서 무료로 시작하기", ru: "Начните учиться бесплатно в TIGA ALPHA", hi: "TIGA ALPHA पर मुफ़्त में शुरू करें", es: "Empieza gratis en TIGA ALPHA", fr: "Commencez gratuitement sur TIGA ALPHA", ar: "ابدأ التعلّم مجانًا على TIGA ALPHA" }, WORDS = { ja: "回閲覧", ko: "회 조회", ru: "просмотров", hi: "व्यूज़", es: "visualizaciones", fr: "vues", ar: "مشاهدة" };
for (const lang of STAT) {
  const f = path.join(OUT, lang, "piano-posture.html"); ok(fs.existsSync(f), lang + ": the page is written from blog-src");
  const h = rd(f);
  ok(h.includes(`<html lang="${lang}"${lang === "ar" ? ' dir="rtl"' : ""}>`), lang + ': <html lang="' + lang + '"' + (lang === "ar" ? ' dir="rtl"' : "") + ">" + (lang === "ar" ? " (right-to-left)" : " (no dir attribute: left-to-right)"));
  ok((lang === "ar") === h.includes("[dir=rtl]") && (lang === "ar") === /<html[^>]* dir=/.test(h), lang + (lang === "ar" ? ": carries the right-to-left rules (logical lists, quotes, taller lines, the date as its own island)" : ": carries no right-to-left rule at all"));
  ok(h.includes(`${lang === "ar" ? "→" : "←"} ${BACK[lang]}</a>`), lang + ": the back arrow points " + (lang === "ar" ? "right (→), mirrored" : "left (←)"));
  ok(h.includes(`<link rel="canonical" href="${SITE}/blog/${lang}/piano-posture.html">`), lang + ": canonical is its own address");
  ok(h.includes(`<meta property="og:locale" content="${LOC[lang]}">`), lang + ": og:locale " + LOC[lang]);
  ok(h.includes(`<title>${TITLE[lang]} | TIGA ALPHA</title>`) && h.includes(`<h1>${TITLE[lang]}</h1>`), lang + ": own title and h1");
  const alt = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => m[1] + "=" + m[2]);
  ok([...ALLL.map(l => HL[l]), "x-default"].every(l => alt.some(a => a.startsWith(l + "="))) && alt.length === 11, lang + ": hreflang for all ten languages and x-default (" + alt.length + " links)");
  ok(alt.includes(`x-default=${SITE}/blog/en/piano-posture.html`), lang + ": x-default is the English version when there is one");
  ok(alt.includes(`${lang}=${SITE}/blog/${lang}/piano-posture.html`) && alt.includes(`th=${SITE}/blog/th/piano-posture.html`), lang + ": each alternate points at /blog/<lang>/<slug>.html");
  ok(h.includes(`"inLanguage":"${lang}"`) && h.includes('"@type":"BlogPosting"'), lang + ": BlogPosting JSON-LD with inLanguage " + lang);
  ok(h.includes('"isAccessibleForFree":false') && h.includes('"cssSelector":"article"'), lang + ": gated-content markup");
  ok(h.includes(`"name":"${AUM[lang]}"`), lang + ": the teacher's name in " + lang + " (" + AUM[lang] + ")");
  ok(h.includes(CAT[lang]) && h.includes(BACK[lang]) && h.includes(CTA[lang]), lang + ": category, 'all articles' and call-to-action in " + lang);
  ok(h.includes(`href="${SITE}/blog/${lang}/feed.xml"`), lang + ": the feed is linked from the head");
  ok(wall[lang].slice(0, 3).every(w => nb(h).includes(nb(w))) && nb(h).includes("TIGA AI"), lang + ": the wall copy is in " + lang + " and names the TIGA AI app");
  ok(h.includes("<!--tg-gate:v7-->") && h.includes("<!--/tg-gate-->") && (h.match(/id="tg-gate"/g) || []).length === 1, lang + ": one wall, marker <!--tg-gate:v7-->");
  ok(h.includes(`lg=${lang}`) && h.includes("utm_campaign=piano-posture") && h.includes("go=google") && h.includes("wall=signup") && h.includes("wall=login"), lang + ": wall links carry lg=" + lang + ", the attribution and the three entry points");
  ok(h.includes(`LANG="${lang}"`) && h.includes(`LBL="${WORDS[lang]}"`), lang + ": the reader script knows its language and the unit '" + WORDS[lang] + "'");
  ok(h.includes("MS=3000") && !/data-gate-close|tg-g-x|tg-g-later/.test(h), lang + ": the wall is the same uncloseable 3 second wall");
  ok(trialWords[lang].every(w => nb(h).includes(w)) && h.includes("<!--tg-gate:v7-->"), lang + ": the pop-up says the 7-day trial needs no credit card, in " + lang, trialWords[lang].join(" / "));
  ok(/id="tg-gate"[^>]*data-nosnippet[^>]*hidden/.test(h), lang + ": the pop-up is hidden and marked data-nosnippet");
  ok(h.includes("<time datetime=\"2026-11-11\">2026-11-11</time>"), lang + ": a plain date string in created_at gives a valid date");
  ok(/class="tg-views"|\.tg-views\{/.test(h), lang + ": the view counter styles are in");
}
{
  const P = (l) => rd(path.join(OUT, l, "piano-posture.html"));
  const ja = P("ja"), ko = P("ko"), ru = P("ru"), hi = P("hi"), es = P("es"), fr = P("fr"), ar = P("ar"), en = P("en");
  ok(/"Hiragino Sans","Yu Gothic","Noto Sans JP","Noto Sans SC"/.test(ja) && !/Malgun/.test(ja), "ja: the page font stack names Japanese faces (before the Chinese one)");
  ok(/"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Noto Sans SC"/.test(ko) && !/Hiragino/.test(ko), "ko: the page font stack names Korean faces");
  ok(!/Hiragino|Malgun/.test(ru) && !/Hiragino|Malgun/.test(en), "ru and en keep the old font stack");
  ok((ja.match(/Hiragino Sans/g) || []).length === 2, "ja: the wall card uses the same Japanese faces (page and card)");
  ok(/"Noto Sans Devanagari","Nirmala UI","Mangal","Noto Sans SC"/.test(hi) && (hi.match(/Noto Sans Devanagari/g) || []).length === 2 && !/Hiragino|Malgun|Naskh/.test(hi), "hi: the page and the wall card name the Devanagari faces (Noto Sans Devanagari, Nirmala UI, Mangal)");
  ok(/font:17px\/1\.75 /.test(hi) && /h1\{line-height:1\.5\}/.test(hi) && /\.tg-g-card h2\{line-height:1\.5\}/.test(hi) && /header\.top a:not\(:first-child\)\{letter-spacing:0\}/.test(hi), "hi: body line-height 1.75, taller headings and wall, no letter-spacing on the blog name");
  ok(/font:17px\/1\.75 "Noto Naskh Arabic","Noto Sans Arabic",Tahoma,system-ui/.test(ar) && (ar.match(/"Noto Naskh Arabic","Noto Sans Arabic",Tahoma/g) || []).length === 2 && !/Hiragino|Malgun|Devanagari/.test(ar), "ar: the page and the wall card use Noto Naskh Arabic, Noto Sans Arabic, Tahoma, system-ui");
  ok(/\[dir=rtl\] body\{line-height:1\.85\}/.test(ar) && /\[dir=rtl\] \.tg-g-card p\{line-height:1\.85\}/.test(ar) && /padding-inline-start/.test(ar) && /border-inline-start/.test(ar) && /text-align:start/.test(ar), "ar: line-height 1.85, logical padding / border for lists and quotes, text-align:start");
  const cssOf = (h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n");
  ok(/\[dir=rtl\] time\{direction:ltr;unicode-bidi:isolate\}/.test(ar) && /\[dir=rtl\] \.tg-views,\[dir=rtl\] \.tg-cv\{unicode-bidi:isolate\}/.test(ar) && !/(^|[^-])(left|right)\s*:|margin-left|margin-right|padding-left|padding-right|border-left|border-right/.test(cssOf(ar)), "ar: the date and the reader counter are bidi islands, and no physical left / right property is in its CSS (page and wall)");
  ok(![es, fr].some(h => /Noto Sans Devanagari|Naskh|Hiragino|Malgun/.test(h)) && [es, fr].every(h => h.includes('font:17px/1.75 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Noto Sans SC",sans-serif')), "es and fr keep the old font stack (system-ui, Noto Sans Thai, Noto Sans SC)");
  ok(/toLocaleString\("ja-JP"\)/.test(ja) && /toLocaleString\("ko-KR"\)/.test(ko) && /toLocaleString\("ru-RU"\)/.test(ru), "the reader script formats the number in the page's locale (ja-JP / ko-KR / ru-RU)");
  ok(/toLocaleString\("hi-IN"\)/.test(hi) && /toLocaleString\("es-ES"\)/.test(es) && /toLocaleString\("fr-FR"\)/.test(fr) && /toLocaleString\("ar-u-nu-latn"\)/.test(ar), "...and in hi-IN / es-ES / fr-FR, and Arabic with Western digits (ar-u-nu-latn)");
  ok(/\+""\+LBL/.test(ja) && /\+""\+LBL/.test(ko) && /\+" "\+LBL/.test(ru), "ja and ko put the unit straight after the number, ru with a space");
  ok(/\+" "\+LBL/.test(hi) && /\+" "\+\(n===1\?"visualización":LBL\)/.test(es) && /\+" "\+\(n===1\?"vue":LBL\)/.test(fr) && /\+" "\+\(n===1\?LBL:n===2\?"مشاهدتان":n<=10\?"مشاهدات":LBL\)/.test(ar), "hi puts the unit after a space; es / fr use the singular for one view and Arabic its dual / few / many forms");
  ok(/"wordCount":\d+/.test(ja) && Number(/"wordCount":(\d+)/.exec(ja)[1]) > 100, "ja: the word count counts characters");
  ok(["hi", "es", "fr", "ar"].every(l => { const w = Number((/"wordCount":(\d+)/.exec(P(l)) || [])[1]); return w > 60 && w < 200; }), "hi / es / fr / ar: the word count counts words (about 90 in the fixture)");
  ok(/"keywords":"ピアノ指導/.test(ja) && /"keywords":"피아노 교육/.test(ko) && /"keywords":"обучение игре на фортепиано/.test(ru), "keywords in each language");
  ok(/"keywords":"पियानो सिखाना/.test(hi) && /"keywords":"enseñanza de piano/.test(es) && /"keywords":"enseignement du piano/.test(fr) && /"keywords":"تعليم البيانو/.test(ar), "...and in hi / es / fr / ar");
  ok(/"articleSection":"संगीत सिद्धांत"/.test(hi) && /"articleSection":"Teoría musical"/.test(es) && /"articleSection":"Théorie musicale"/.test(fr) && /"articleSection":"نظرية الموسيقى"/.test(ar), "the JSON-LD articleSection is the category in each new language");
  ok(["ja", "ko", "ru", "hi", "es", "fr", "ar"].every(l => en.includes(`hreflang="${l}" href="${SITE}/blog/${l}/piano-posture.html"`)), "the English page of the same article lists all seven source-file languages as alternates (reciprocal links)");
  ok(["ja", "ko", "ru", "hi", "es", "fr", "ar"].every(l => rd(path.join(OUT, "th", "piano-posture.html")).includes(`hreflang="${l}" href="${SITE}/blog/${l}/piano-posture.html"`)) && rd(path.join(OUT, "zh", "piano-posture.html")).includes(`hreflang="ar" href="${SITE}/blog/ar/piano-posture.html"`), "...and so do the Thai and the Chinese ones");
  // every page of the cluster lists every other page of it: the links are reciprocal, which hreflang needs to be honoured
  const cl = ALLL.map(l => [l, new Set([...P(l).matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => m[1] + "=" + m[2]))]);
  ok(cl.every(([, s]) => s.size === 11) && cl.every(([, s]) => cl[0][1].size === s.size && [...s].every(x => cl[0][1].has(x))), "the ten pages of the cluster carry the same eleven alternate links (ten languages and x-default): reciprocal");
  // the pages of the other six languages: no byte of them depends on the new languages except those hreflang links
  const stripAlt = (h) => h.replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]+">/g, "");
  ok(!/dir="rtl"|\[dir=rtl\]|Devanagari|Naskh|UNIT|n===1/.test(stripAlt(P("th")) + stripAlt(P("en")) + stripAlt(P("zh")) + stripAlt(ja) + stripAlt(ko) + stripAlt(ru)), "th / en / zh / ja / ko / ru pages carry nothing of the new languages' rules (no dir, no Devanagari / Arabic face, no plural code)");
}

console.log("database wins");
{
  const h = rd(path.join(OUT, "ja", "db-wins.html"));
  ok(h.includes("DB TITLE (wins)") && !h.includes("STATIC TITLE"), "a database row beats the source file with the same (lang, slug)");
  ok(rd(path.join(OUT, "ja", "index.html")).includes("DB TITLE (wins)") && !rd(path.join(OUT, "ja", "index.html")).includes("STATIC TITLE"), "...also in the index");
  ok(rd(path.join(OUT, "ja", "feed.xml")).includes("DB TITLE (wins)") && !rd(path.join(OUT, "ja", "feed.xml")).includes("STATIC TITLE"), "...and in the feed");
}

console.log("index and feed are real files for ja / ko / ru / hi / es / fr / ar");
{
  const idx = rd(path.join(OUT, "ja", "index.html"));
  ok(idx.includes('<html lang="ja">') && idx.includes("<h1>ブログ</h1>") && idx.includes("ピアノと音楽の学習に役立つ記事"), "ja/index.html is a real Japanese page");
  ok(idx.includes(`href="${SITE}/blog/ja/piano-posture.html"`) && idx.includes(`href="${SITE}/blog/ja/second-article.html"`) && idx.includes(`href="${SITE}/blog/ja/db-wins.html"`), "...it lists every ja article");
  ok(idx.indexOf("second-article.html") < idx.indexOf("piano-posture.html") && idx.indexOf("piano-posture.html") < idx.indexOf("db-wins.html"), "...newest first (12 Nov, 11 Nov, 5 Nov)");
  ok(idx.includes('<link rel="canonical" href="' + SITE + '/blog/ja/">') && idx.includes('hreflang="x-default" href="' + SITE + '/blog/en/"') && ALLL.every(l => idx.includes(`hreflang="${HL[l]}" href="${SITE}/blog/${l}/"`)), "...canonical, and hreflang for all ten index pages with x-default = English");
  ok(idx.includes("blog_view_counts") && idx.includes("toLocaleString(\"ja-JP\")"), "...the card counter script is in, formatted for Japanese");
  ok(!idx.includes("tg-gate"), "...and the index has no wall");
  ok(rd(path.join(OUT, "ko", "index.html")).includes("<h1>블로그</h1>") && rd(path.join(OUT, "ru", "index.html")).includes("<h1>Блог</h1>"), "ko and ru indexes exist and are in their language");
  ok(rd(path.join(OUT, "ru", "index.html")).includes("Теория музыки"), "the index card shows the category in Russian");
  for (const l of ["th", "en", "zh"]) ok(!fs.existsSync(path.join(OUT, l, "index.html")), l + ": still no baked index (the function renders it from the database, as before)");
  const feed = rd(path.join(OUT, "ko", "feed.xml"));
  ok(feed.startsWith("<?xml") && feed.includes("<language>ko</language>") && feed.includes("<title>TIGA ALPHA 블로그</title>") && feed.includes(`${SITE}/blog/ko/piano-posture.html`), "ko/feed.xml is a real RSS feed with <language>ko</language>");
  ok(rd(path.join(OUT, "ja", "feed.xml")).includes("<language>ja</language>") && rd(path.join(OUT, "ru", "feed.xml")).includes("<language>ru</language>"), "ja and ru feeds carry their language");
  // hi / es / fr / ar: own index page (name, subtitle, category on the card, the card counter script in the page's locale) and an RSS feed with its own language tag, title and description
  const IDX = { hi: ["ब्लॉग", "पियानो और संगीत सीखने पर लेख", "संगीत सिद्धांत", "hi-IN"], es: ["Blog", "Artículos para aprender piano y música", "Teoría musical", "es-ES"], fr: ["Blog", "Articles pour apprendre le piano et la musique", "Théorie musicale", "fr-FR"], ar: ["المدونة", "مقالات عن تعلّم البيانو والموسيقى", "نظرية الموسيقى", "ar-u-nu-latn"] };
  for (const l of NEWL) {
    const x = rd(path.join(OUT, l, "index.html")), [name, sub, cat, loc] = IDX[l];
    ok(x.includes(`<html lang="${l}"${l === "ar" ? ' dir="rtl"' : ""}>`) && x.includes(`<h1>${name}</h1>`) && x.includes(sub) && x.includes(cat), l + "/index.html is a real " + l + " page" + (l === "ar" ? " with dir=\"rtl\"" : "") + " (name, subtitle, category)");
    ok(x.includes(`<link rel="canonical" href="${SITE}/blog/${l}/">`) && ALLL.every(k => x.includes(`hreflang="${HL[k]}" href="${SITE}/blog/${k}/"`)) && x.includes(`hreflang="x-default" href="${SITE}/blog/en/"`), l + ": canonical and hreflang for all ten index pages, x-default = English");
    ok(x.includes("blog_view_counts") && x.includes(`toLocaleString("${loc}")`) && !x.includes("tg-gate") && (l === "ar") === x.includes("[dir=rtl]"), l + ": the card counter script formats for " + loc + ", no wall in the index" + (l === "ar" ? ", right-to-left rules in" : ", no right-to-left rule"));
    const f = rd(path.join(OUT, l, "feed.xml"));
    ok(f.startsWith("<?xml") && f.includes(`<language>${l}</language>`) && f.includes(`<title>TIGA ALPHA ${name}</title>`) && f.includes(`<description>${sub}</description>`) && f.includes(`${SITE}/blog/${l}/piano-posture.html`), l + "/feed.xml is a real RSS feed: <language>" + l + "</language>, its own title and description");
  }
  const ari = rd(path.join(OUT, "ar", "index.html"));
  ok(ari.indexOf("second-article.html") < ari.indexOf("piano-posture.html") && (ari.match(/class="card"/g) || []).length === 2, "ar: two cards, newest first");
  ok(/<link rel="alternate" type="application\/rss\+xml" title="المدونة" href="[^"]*\/blog\/ar\/feed\.xml">/.test(ari), "ar: the feed is linked from the index head under its Arabic name");
}

console.log("sitemap");
{
  const sm = rd(path.join(OUT, "sitemap-static.xml"));
  ok(sm.includes("<urlset") && sm.includes("xmlns:xhtml"), "blog/sitemap-static.xml is a urlset");
  for (const l of STAT) ok(sm.split(`<loc>${SITE}/blog/${l}/piano-posture.html</loc>`).length === 2 && sm.split(`<loc>${SITE}/blog/${l}/</loc>`).length === 2, l + ": the article and the index are in the sitemap, once each");
  ok(sm.includes(`<loc>${SITE}/blog/ja/second-article.html</loc>`) && sm.includes(`<loc>${SITE}/blog/ar/second-article.html</loc>`) && !sm.includes("/blog/ja/broken.html") && !sm.includes("/blog/ja/draft.html") && !/\/blog\/(ar|hi|fr|es)\/(broken|wrong-lang|Bad_Slug|no-body)/.test(sm), "the second ja and ar articles are in; a malformed one and a draft are not");
  for (const l of ["ru", "hi", "ar"]) {
    const entry = sm.split("<url>").find(u => u.includes("<loc>" + SITE + "/blog/" + l + "/piano-posture.html</loc>")) || "";
    ok(ALLL.every(k => entry.includes(`hreflang="${HL[k]}" href="${SITE}/blog/${k}/piano-posture.html"`)) && entry.includes('hreflang="x-default" href="' + SITE + '/blog/en/piano-posture.html"'), l + ": its entry lists the alternates of all ten languages and x-default = English");
  }
  { const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]); ok(new Set(locs).size === locs.length, "no url is listed twice (" + locs.length + " <loc> entries)"); }
  ok(/<lastmod>2026-11-1[12]<\/lastmod>/.test(sm), "lastmod comes from created_at");
  ok(!sm.includes("/blog/th/piano-posture.html</loc>"), "th / en / zh articles are NOT repeated here (the live sitemap-blog.xml has them)");
}

console.log("th / en / zh output is unchanged");
{
  // (1) the same fixture with no source files at all must give exactly the old output; (2) source files for other slugs must not change a single byte of th / en / zh
  const mkOld = () => { const posts = []; let k = 0; const cats = ["tips", "theory", "songs", "news", "story"];
    for (const slug of ["alpha-post", "beta-post", "gamma-post", "delta-post", "eps-post", "zeta-post"]) for (const lang of ["th", "en", "zh"]) { if (slug === "zeta-post" && lang !== "zh") continue; k++;
      posts.push({ id: "p" + k, lang, slug, category: cats[k % 5], title: `${lang} title ${slug} & <b>`, excerpt: `excerpt ${lang} ${slug} "q"`, body: `# Head\n\nPara **bold** [link](https://example.com/x) ![img](https://example.com/i.png)\n\n- a\n- b\n\n1. one\n2. two\n\n### Sub\n` + "word ".repeat(50) + (lang === "zh" ? "汉字内容测试" : ""), cover_url: k % 3 === 0 ? "https://example.com/c.jpg" : null, published: true, created_at: `2026-10-${String(10 + k).padStart(2, "0")}T00:00:00Z`, updated_at: `2026-10-${String(11 + k).padStart(2, "0")}T00:00:00Z` }); }
    return posts; };
  W(path.join(tmp, "old.json"), mkOld());
  const empty = path.join(tmp, "empty-src"); fs.mkdirSync(empty, { recursive: true });
  const A = path.join(tmp, "o-none"), B = path.join(tmp, "o-other");
  ok(gen({ BLOG_FIXTURE: path.join(tmp, "old.json"), BLOG_OUT: A, BLOG_SRC: empty }).code === 0 && gen({ BLOG_FIXTURE: path.join(tmp, "old.json"), BLOG_OUT: B, BLOG_SRC: S }).code === 0, "(both builds ran)");
  const list = (d) => { const o = {}; for (const l of ["th", "en", "zh"]) for (const f of fs.existsSync(path.join(d, l)) ? fs.readdirSync(path.join(d, l)) : []) o[l + "/" + f] = rd(path.join(d, l, f)); return o; };
  const a = list(A), b = list(B);
  ok(Object.keys(a).length === 16 && JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b)), "the same 16 th / en / zh files");
  ok(Object.keys(a).every(k => a[k] === b[k]), "...byte for byte the same with and without source files for other slugs");
  ok(!fs.existsSync(path.join(A, "ja")) && !fs.existsSync(path.join(A, "sitemap-static.xml")), "with no source files nothing is written for ja / ko / ru");
  // against the generator as it was before this change, when git still has it
  let oldSrc = ""; try { oldSrc = execSync("git show HEAD:scripts/build-blog-pages.mjs", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (e) {}
  if (oldSrc && !oldSrc.includes("STATIC_LANGS")) {
    const br = path.join(tmp, "base-root"); W(path.join(br, "scripts", "build-blog-pages.mjs"), oldSrc); fs.copyFileSync(path.join(ROOT, "supabase-client.ts"), path.join(br, "supabase-client.ts"));
    const C = path.join(tmp, "o-base"); const rr = spawnSync("node", [path.join(br, "scripts", "build-blog-pages.mjs")], { env: { ...process.env, BLOG_FIXTURE: path.join(tmp, "old.json"), BLOG_OUT: C, SITE_URL: SITE }, encoding: "utf8" });
    const c = list(C); ok(rr.status === 0 && Object.keys(c).length === 16 && Object.keys(c).every(k => c[k] === a[k]), "...and byte for byte the same as the generator in git HEAD (before this change)");
  } else console.log("  - (git HEAD already holds the new generator: no 'before' copy to compare with)");
}

console.log("the six older languages are not changed by the four new ones");
{
  // The same rows through the generator as it was before hi / es / fr / ar existed (commit a4a7f95da), when git still has that commit: every article page and feed of th / en / zh / ja / ko / ru byte for byte, the index
  // pages and the sitemap file the same but for their hreflang links (they name ten languages now). The wall block (between its markers) is left out of the comparison: it has its own tests, and the owner changes it on its own.
  let old = ""; try { old = execSync("git show a4a7f95da:scripts/build-blog-pages.mjs", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }); } catch (e) {}
  if (!old.includes("STATIC_LANGS")) console.log("  - (git has no commit a4a7f95da: no pre-change generator to compare with)");
  else {
    const six = ["th", "en", "zh", "ja", "ko", "ru"], cats = ["tips", "theory", "songs", "news", "story"], rows = []; let k = 0;
    for (const l of six) for (let i = 0; i < 3; i++) { k++; rows.push({ id: "r" + k, lang: l, slug: "slug-" + i, category: cats[k % 5], title: `${l} title ${i} & <b> "q"`, excerpt: k % 2 ? `${l} excerpt ${i} & more` : "", body: "# Head\n\nPara **bold** [link](https://example.com/a?b=1&c=2) ![img](https://example.com/i.png)\n\n- a\n- b\n\n1. one\n2. two\n\n### Sub\n" + "word ".repeat(60), cover_url: k % 4 ? null : "https://example.com/c.jpg", published: true, created_at: `2026-10-0${1 + (k % 9)}T00:00:00Z`, updated_at: `2026-10-1${k % 9}T00:00:00Z` }); }
    W(path.join(tmp, "six.json"), rows);
    const br = path.join(tmp, "base-root6"); W(path.join(br, "scripts", "build-blog-pages.mjs"), old); fs.copyFileSync(path.join(ROOT, "supabase-client.ts"), path.join(br, "supabase-client.ts"));
    const none = path.join(tmp, "no-src6"), A = path.join(tmp, "six-old"), B = path.join(tmp, "six-new"); fs.mkdirSync(none, { recursive: true });
    const ra = gen({ __script: path.join(br, "scripts", "build-blog-pages.mjs"), BLOG_FIXTURE: path.join(tmp, "six.json"), BLOG_OUT: A, BLOG_SRC: none }), rb = gen({ BLOG_FIXTURE: path.join(tmp, "six.json"), BLOG_OUT: B, BLOG_SRC: none });
    const walk = (d, base = d, o = []) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p, base, o); else o.push(path.relative(base, p)); } return o.sort(); };
    const noWall = (h) => h.replace(/<!--tg-gate:v\d+-->[\s\S]*?<!--\/tg-gate-->/g, "<!--WALL-->"), noAlt = (h) => h.replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]+">/g, "");
    const fa = ra.code === 0 ? walk(A) : [], fb = rb.code === 0 ? walk(B) : [], diff = [];
    for (const f of fa) { if (!fb.includes(f)) { diff.push(f + ": missing"); continue; } const x = noWall(rd(path.join(A, f))), y = noWall(rd(path.join(B, f))), same = /(^|\/)index\.html$/.test(f) ? noAlt(x) === noAlt(y) : x === y; if (!same) diff.push(f); }
    ok(ra.code === 0 && rb.code === 0 && fa.length === 25 && JSON.stringify(fa) === JSON.stringify(fb), "(both generators ran and wrote the same " + fa.length + " files: 18 article pages, the ja / ko / ru indexes and feeds, the static sitemap)");
    ok(diff.length === 0, "...each of them is what the generator wrote before the new languages: articles and feeds byte for byte, indexes but for their hreflang links" + (diff.length ? " (differ: " + diff.slice(0, 3).join(", ") + ")" : ""));
  }
}

console.log("no placeholder text in a page, an index, a feed or the sitemap");
{
  const files = []; for (const l of ALLL) { files.push(path.join(OUT, l, "piano-posture.html")); if (STAT.includes(l)) files.push(path.join(OUT, l, "index.html"), path.join(OUT, l, "feed.xml")); }
  files.push(path.join(OUT, "ja", "second-article.html"), path.join(OUT, "ar", "second-article.html"), path.join(OUT, "sitemap-static.xml"));
  const bad = []; let blocks = 0;
  for (const f of files) {
    const h = rd(f), where = path.relative(OUT, f), t = visibleMarkup(h);
    if (PLACEHOLDER.test(t)) bad.push(where + ": " + (t.match(/.{0,25}(?:undefined|\[object|NaN).{0,25}/) || [""])[0]);
    for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { blocks++; try { if (PLACEHOLDER.test(JSON.stringify(JSON.parse(m[1])))) bad.push(where + ": a JSON-LD value"); } catch (e) { bad.push(where + ": the JSON-LD does not parse"); } }
  }
  ok(bad.length === 0, files.length + " generated files (articles, indexes and feeds of ten languages, the static sitemap) carry no 'undefined', '[object' or 'NaN' outside the reader script, and their " + blocks + " JSON-LD blocks parse" + (bad.length ? ": " + bad.slice(0, 3).join(" | ") : ""));
  ok(PLACEHOLDER.test(visibleMarkup("<p>x undefined</p><script>var a=undefined</script>")) && !PLACEHOLDER.test(visibleMarkup("<p>fine</p><script>var a=undefined</script><style>.a{}</style>")), "(the check itself: it flags such text in the markup and ignores the reader script's own code)");
}

console.log("the real articles in blog-src/ (every source-file language, offline, into a temp folder)");
{
  // What ships: every committed article through the real generator, nothing fetched and nothing written into the repo (BLOG_OUT is a temp folder). A broken source file, a language folder the generator does not read or a
  // table entry that a language lacks shows up here with the real text, not only with the short fixture above.
  const G3 = await import(pathToFileURL(GEN).href + "?real=" + Date.now()), valid = G3.readStaticPosts(path.join(ROOT, "blog-src"));
  const R = path.join(tmp, "real-out"); fs.mkdirSync(R, { recursive: true });
  const rr = gen({ BLOG_OFFLINE: "1", BLOG_OUT: R }), skipped = rr.err.split("\n").filter(x => /skipping blog-src/.test(x));
  const folders = fs.readdirSync(path.join(ROOT, "blog-src"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
  ok(rr.code === 0 && skipped.length === 0 && valid.length > 0, "the generator runs offline over blog-src/ and skips no file (" + valid.length + " published articles)" + (skipped.length ? ": " + skipped.slice(0, 2).join(" | ") : ""));
  ok(JSON.stringify(folders) === JSON.stringify([...STAT].sort()) && STAT.every(l => valid.some(p => p.lang === l)), "blog-src/ has a folder for each of the seven source-file languages and nothing else, each with articles (" + STAT.map(l => l + " " + valid.filter(p => p.lang === l).length).join(", ") + ")");
  const alts = (h) => [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => [m[1], m[2]]), local = (u) => path.join(R, u.replace(SITE + "/blog/", "")), problems = []; let blocks = 0;
  for (const p of valid) {
    const f = path.join(R, p.lang, p.slug + ".html"), me = `${SITE}/blog/${p.lang}/${p.slug}.html`, where = p.lang + "/" + p.slug;
    if (!fs.existsSync(f)) { problems.push(where + ": no page"); continue; }
    const h = rd(f), a = alts(h);
    if (!h.includes(`<html lang="${p.lang}"${p.lang === "ar" ? ' dir="rtl"' : ""}>`) || !h.includes(`<link rel="canonical" href="${me}">`)) problems.push(where + ": <html lang / dir> or canonical");
    if (PLACEHOLDER.test(visibleMarkup(h))) problems.push(where + ": placeholder text");
    if ((h.match(/id="tg-gate"/g) || []).length !== 1) problems.push(where + ": not exactly one wall");
    if (!a.some(([l, u]) => l === HL[p.lang] && u === me) || !a.some(([l]) => l === "x-default") || new Set(a.map(x => x[0])).size !== a.length) problems.push(where + ": hreflang has no self link, no x-default, or a language twice");
    for (const [l, u] of a) { if (l === "x-default") continue; const tf = local(u); if (!fs.existsSync(tf)) problems.push(where + ": hreflang " + l + " points at a file that is not there"); else if (!alts(rd(tf)).some(([, v]) => v === me)) problems.push(where + ": " + l + " does not link back (hreflang has to be reciprocal)"); }
    for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { blocks++; try { JSON.parse(m[1]); } catch (e) { problems.push(where + ": the JSON-LD does not parse"); } }
  }
  for (const l of STAT) {
    const posts = valid.filter(p => p.lang === l), dir = path.join(R, l), ixf = path.join(dir, "index.html"), fdf = path.join(dir, "feed.xml"), ix = fs.existsSync(ixf) ? rd(ixf) : "", fd = fs.existsSync(fdf) ? rd(fdf) : "";
    const pages = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".html") && f !== "index.html").map(f => f.slice(0, -5)).sort() : [];
    if (JSON.stringify(pages) !== JSON.stringify(posts.map(p => p.slug).sort())) problems.push(l + ": the pages written are not exactly the source articles");
    if (!ix.includes(`<html lang="${l}"`) || posts.slice(0, 48).some(p => !ix.includes(`href="${SITE}/blog/${l}/${p.slug}.html"`))) problems.push(l + ": the index is missing or does not list the articles");
    if (!fd.includes(`<language>${l}</language>`) || (fd.match(/<item>/g) || []).length !== Math.min(40, posts.length)) problems.push(l + ": the feed is missing, has the wrong language or the wrong number of items");
  }
  ok(problems.length === 0, valid.length + " real pages: the right <html lang> (and dir=\"rtl\" for ar), canonical, one wall, no placeholder text, " + blocks + " JSON-LD blocks that parse, hreflang that points at real files and is reciprocal; an index and a feed per language" + (problems.length ? " (" + problems.length + " problems: " + problems.slice(0, 3).join(" | ") + ")" : ""));
  const smf = path.join(R, "sitemap-static.xml"), locs = fs.existsSync(smf) ? [...rd(smf).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]) : [];
  ok(locs.length === valid.length + STAT.length && new Set(locs).size === locs.length && valid.every(p => locs.includes(`${SITE}/blog/${p.lang}/${encodeURIComponent(p.slug)}.html`)) && STAT.every(l => locs.includes(`${SITE}/blog/${l}/`)), "blog/sitemap-static.xml lists every source article and every index once (" + locs.length + " urls)");
}

console.log("offline: the database cannot be reached");
{
  const keep = path.join(tmp, "keep"); fs.mkdirSync(path.join(keep, "th"), { recursive: true }); fs.mkdirSync(path.join(keep, "en"), { recursive: true });
  fs.copyFileSync(path.join(OUT, "th", "piano-posture.html"), path.join(keep, "th", "piano-posture.html")); fs.copyFileSync(path.join(OUT, "en", "piano-posture.html"), path.join(keep, "en", "piano-posture.html"));
  const th0 = rd(path.join(keep, "th", "piano-posture.html")), en0 = rd(path.join(keep, "en", "piano-posture.html"));
  const r = gen({ BLOG_OFFLINE: "1", BLOG_OUT: keep, BLOG_SRC: S });
  ok(r.code === 0 && /fetch failed, leaving the existing blog pages in place/.test(r.out), "the 'fetch failed, leaving existing pages' path runs");
  for (const l of STAT) ok(fs.existsSync(path.join(keep, l, "piano-posture.html")) && fs.existsSync(path.join(keep, l, "index.html")) && fs.existsSync(path.join(keep, l, "feed.xml")), l + ": page, index and feed are still written offline");
  ok(rd(path.join(keep, "ja", "db-wins.html")).includes("STATIC TITLE"), "offline there is no database row, so the source file is the page");
  ok(rd(path.join(keep, "th", "piano-posture.html")) === th0 && rd(path.join(keep, "en", "piano-posture.html")) === en0, "the kept th / en pages are not rewritten (they are already current)");
  const ja = rd(path.join(keep, "ja", "piano-posture.html"));
  ok(ja.includes(`hreflang="x-default" href="${SITE}/blog/en/piano-posture.html"`) && ja.includes(`hreflang="th" href="${SITE}/blog/th/piano-posture.html"`) && !ja.includes('hreflang="zh-Hans"'), "an English / Thai page already on disk counts as a language of the article (x-default = English; zh is not on disk so it is not claimed)");
  ok(fs.existsSync(path.join(keep, "sitemap-static.xml")), "the static sitemap is written offline too");
  const before = rd(path.join(keep, "ja", "index.html")); gen({ BLOG_OFFLINE: "1", BLOG_OUT: keep, BLOG_SRC: S });
  ok(rd(path.join(keep, "ja", "index.html")) === before && rd(path.join(keep, "ja", "piano-posture.html")) === ja, "running it again changes nothing");
  // the sources vanish (a checkout without blog-src): the pages already on disk are kept and patched like any kept page, never deleted
  const r2 = gen({ BLOG_OFFLINE: "1", BLOG_OUT: keep, BLOG_SRC: path.join(tmp, "nowhere") });
  ok(r2.code === 0 && fs.existsSync(path.join(keep, "ja", "piano-posture.html")) && fs.existsSync(path.join(keep, "ja", "index.html")), "no blog-src: the ja pages and index already on disk stay");
  ok(rd(path.join(keep, "ja", "piano-posture.html")) === ja, "...and are not changed either (already current)");
}

console.log("offline: a th / en page rendered before hi / es / fr / ar existed is given its new alternates (hreflang has to be reciprocal)");
{
  // The database is not reachable here, so a th / en page kept from an earlier build cannot be rendered again: its hreflang cluster is brought up to date in place, in front of x-default,
  // and the result is byte for byte the page the generator renders when it can read the database (the fixture OUT pages).
  const keep = path.join(tmp, "keep-old"), altOf = (h) => [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href=/g)].map(m => m[1]);
  const sixOnly = (l) => rd(path.join(OUT, l, "piano-posture.html")).replace(/<link rel="alternate" hreflang="(?:hi|es|fr|ar)" href="[^"]*">/g, "");   // the page as it was when only six languages existed
  for (const l of ["th", "en", "zh"]) { fs.mkdirSync(path.join(keep, l), { recursive: true }); fs.writeFileSync(path.join(keep, l, "piano-posture.html"), sixOnly(l)); }
  fs.writeFileSync(path.join(keep, "th", "no-translation.html"), sixOnly("th").replace(/piano-posture/g, "no-translation"));   // a Thai article that has no translation at all: nothing to add
  const lone0 = rd(path.join(keep, "th", "no-translation.html"));
  ok(altOf(rd(path.join(keep, "th", "piano-posture.html"))).join() === "th,en,zh-Hans,ja,ko,ru,x-default", "(fixture: the th page lists six languages and x-default)");
  const r = gen({ BLOG_OFFLINE: "1", BLOG_OUT: keep, BLOG_SRC: S });
  ok(r.code === 0, "the offline run succeeds");
  for (const l of ["th", "en", "zh"]) {
    const h = rd(path.join(keep, l, "piano-posture.html"));
    ok(altOf(h).join() === "th,en,zh-Hans,ja,ko,ru,hi,es,fr,ar,x-default" && h === rd(path.join(OUT, l, "piano-posture.html")), l + ": the kept page lists hi, es, fr, ar before x-default and is byte for byte the page a networked build renders");
  }
  ok(rd(path.join(keep, "th", "no-translation.html")) === lone0, "a kept page of an article with no translation is not touched");
  const th1 = rd(path.join(keep, "th", "piano-posture.html")); gen({ BLOG_OFFLINE: "1", BLOG_OUT: keep, BLOG_SRC: S });
  ok(rd(path.join(keep, "th", "piano-posture.html")) === th1, "running it again changes nothing (nothing is added twice)");
  // an alternate that is already there is never rewritten or dropped, whatever it points at; only the missing languages are added
  const keep2 = path.join(tmp, "keep-custom"); fs.mkdirSync(path.join(keep2, "en"), { recursive: true });
  fs.writeFileSync(path.join(keep2, "en", "piano-posture.html"), sixOnly("en").replace(`<link rel="alternate" hreflang="ja" href="${SITE}/blog/ja/piano-posture.html">`, `<link rel="alternate" hreflang="ja" href="${SITE}/blog/ja/custom-address.html">`));
  gen({ BLOG_OFFLINE: "1", BLOG_OUT: keep2, BLOG_SRC: S });
  const c = rd(path.join(keep2, "en", "piano-posture.html"));
  ok(c.includes(`hreflang="ja" href="${SITE}/blog/ja/custom-address.html"`) && !c.includes(`hreflang="ja" href="${SITE}/blog/ja/piano-posture.html"`) && altOf(c).join() === "th,en,zh-Hans,ja,ko,ru,hi,es,fr,ar,x-default", "an alternate already in the page is kept as it is; hi, es, fr, ar are added in front of x-default");
}

console.log("pagination of the static index");
{
  const S2 = path.join(tmp, "src-many");
  for (const l of ["ru", ...NEWL]) for (let i = 1; i <= 50; i++) W(path.join(S2, l, `post-${i}.json`), src(l, `post-${i}`, { created_at: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}` }));
  W(path.join(tmp, "none.json"), []);
  const O2 = path.join(tmp, "out-many"); const r = gen({ BLOG_FIXTURE: path.join(tmp, "none.json"), BLOG_OUT: O2, BLOG_SRC: S2 });
  const p1 = rd(path.join(O2, "ru", "index.html")), p2f = path.join(O2, "ru", "page", "2", "index.html");
  ok(r.code === 0 && (p1.match(/class="card"/g) || []).length === 48, "page 1 lists 48 cards");
  ok(p1.includes(`<link rel="next" href="${SITE}/blog/ru/page/2">`) && !p1.includes('rel="prev"'), "...and links to page 2");
  ok(fs.existsSync(p2f), "ru/page/2/index.html is written");
  const p2 = fs.existsSync(p2f) ? rd(p2f) : "";
  ok((p2.match(/class="card"/g) || []).length === 2 && p2.includes(`<link rel="prev" href="${SITE}/blog/ru/">`) && p2.includes(`<link rel="canonical" href="${SITE}/blog/ru/page/2">`), "page 2 has the last 2 cards, prev = the index, canonical = /page/2");
  ok(p2.includes("Предыдущая страница") && p1.includes("Следующая страница"), "the pager text is Russian");
  ok((rd(path.join(O2, "ru", "feed.xml")).match(/<item>/g) || []).length === 40, "the feed keeps its 40 newest");
  // hi / es / fr / ar: the same 50 articles page by page, with the pager words of each language (the Arabic pages carry dir="rtl")
  const PG = { hi: ["अगला पृष्ठ", "पिछला पृष्ठ"], es: ["Página siguiente", "Página anterior"], fr: ["Page suivante", "Page précédente"], ar: ["الصفحة التالية", "الصفحة السابقة"] };
  for (const l of NEWL) {
    const a = rd(path.join(O2, l, "index.html")), bf = path.join(O2, l, "page", "2", "index.html"), b = fs.existsSync(bf) ? rd(bf) : "";
    ok((a.match(/class="card"/g) || []).length === 48 && a.includes(`<link rel="next" href="${SITE}/blog/${l}/page/2">`) && !a.includes('rel="prev"') && a.includes(PG[l][0]) && !a.includes(PG[l][1]), l + ": page 1 lists 48 cards, links to page 2 and says '" + PG[l][0] + "'");
    ok((b.match(/class="card"/g) || []).length === 2 && b.includes(`<link rel="prev" href="${SITE}/blog/${l}/">`) && b.includes(`<link rel="canonical" href="${SITE}/blog/${l}/page/2">`) && b.includes(PG[l][1]) && !b.includes(PG[l][0]), l + ": page 2 has the last 2 cards, prev = the index, canonical = /page/2, and says '" + PG[l][1] + "'");
    ok(b.includes(`<html lang="${l}"${l === "ar" ? ' dir="rtl"' : ""}>`) && (l === "ar") === b.includes("[dir=rtl]"), l + ": page 2 is " + (l === "ar" ? "right-to-left too (dir=\"rtl\" and the rules)" : "left-to-right (no dir attribute)"));
    ok((rd(path.join(O2, l, "feed.xml")).match(/<item>/g) || []).length === 40 && rd(path.join(O2, l, "feed.xml")).includes(`<language>${l}</language>`), l + ": the feed keeps its 40 newest and says <language>" + l + "</language>");
  }
  const O3 = path.join(tmp, "out-many2"); fs.cpSync(O2, O3, { recursive: true });
  gen({ BLOG_OFFLINE: "1", BLOG_OUT: O3, BLOG_SRC: S });
  ok(!fs.existsSync(path.join(O3, "ru", "page")), "when the language shrinks, the old page/N folder is removed");
  ok(NEWL.every(l => !fs.existsSync(path.join(O3, l, "page"))), "...also for hi / es / fr / ar");
}

console.log("sitemap index gets one more entry (what build-song-pages.mjs writes), once");
{
  const root = path.join(tmp, "root"); fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.copyFileSync(GEN, path.join(root, "scripts/build-blog-pages.mjs")); fs.copyFileSync(path.join(ROOT, "supabase-client.ts"), path.join(root, "supabase-client.ts")); fs.cpSync(S, path.join(root, "blog-src"), { recursive: true });
  const idx = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap><loc>${SITE}/sitemap-pages.xml</loc><lastmod>2026-11-10</lastmod></sitemap>\n<sitemap><loc>${SITE}/sitemap-blog.xml</loc><lastmod>2026-11-10</lastmod></sitemap>\n</sitemapindex>\n`;
  W(path.join(root, "sitemap.xml"), idx);
  const run = () => gen({ __script: path.join(root, "scripts/build-blog-pages.mjs"), BLOG_FIXTURE: path.join(tmp, "posts.json") }, { cwd: root });
  const a = run(); const s1 = rd(path.join(root, "sitemap.xml")); run(); const s2 = rd(path.join(root, "sitemap.xml"));
  ok(a.code === 0 && s1.includes(`<sitemap><loc>${SITE}/blog/sitemap-static.xml</loc><lastmod>2026-11-12</lastmod></sitemap>`), "the index lists blog/sitemap-static.xml with the newest date");
  ok(s1 === s2 && (s2.match(/sitemap-static\.xml/g) || []).length === 1, "...once, also after a second run");
  ok(s2.includes("sitemap-pages.xml") && s2.includes("sitemap-blog.xml") && s2.trim().endsWith("</sitemapindex>"), "...and the other entries and a closed file are kept");
  ok(fs.existsSync(path.join(root, "blog", "sitemap-static.xml")) && fs.existsSync(path.join(root, "blog", "ja", "index.html")), "(the files were written under the root's blog/)");
}

console.log("blog-paths.mjs and blog-live.mjs");
{
  const P = await import(pathToFileURL(path.join(ROOT, "scripts/blog-paths.mjs")).href + "?t=" + Date.now());
  const L = await import(pathToFileURL(path.join(ROOT, "scripts/blog-live.mjs")).href + "?t=" + Date.now());
  ok(JSON.stringify(P.BLOG_LANGS) === JSON.stringify(ALLL) && JSON.stringify(P.STATIC_BLOG_LANGS) === JSON.stringify(STAT), "blog-paths.mjs knows the ten blog languages and the seven that ship as source files");
  for (const l of ALLL) {
    ok(P.parseBlogPath(`/blog/${l}/`).kind === "index" && P.parseBlogPath(`/blog/${l}`).lang === l, l + ": the index path is recognised");
    ok(P.parseBlogPath(`/blog/${l}/feed.xml`).kind === "feed" && P.parseBlogPath(`/blog/${l}/page/3`).page === 3, l + ": feed and page/N are recognised");
    const a = P.parseBlogPath(`/blog/${l}/practice-15-minutes-5-methods.html`);
    ok(a.kind === "article" && a.lang === l && a.hint === false, l + ": an article address is recognised");
  }
  ok(P.parseBlogPath("/blog/xx/foo.html").kind === "bad" && P.parseBlogPath("/blog/de/").kind !== "index" && P.parseBlogPath("/blog/pt/foo.html").kind === "bad" && P.parseBlogPath("/blog/de/feed.xml").kind !== "feed", "an unknown language (xx, de, pt) is still refused");
  const h = P.parseBlogPath("/blog/piano-posture-ja"); ok(h.kind === "article" && h.lang === "ja" && h.hint === true && h.slug === "piano-posture-ja", "the short address with a -ja hint keeps the whole slug and hints Japanese");
  ok(P.parseBlogPath("/blog/piano-posture-ru").lang === "ru" && P.parseBlogPath("/blog/piano-posture-ko").lang === "ko" && P.parseBlogPath("/blog/piano-posture-zh").lang === "zh", "-ru / -ko / -zh hints");
  ok(["hi", "es", "fr", "ar"].every(l => { const x = P.parseBlogPath(`/blog/piano-posture-${l}`); return x.kind === "article" && x.lang === l && x.hint === true && x.slug === `piano-posture-${l}`; }), "-hi / -es / -fr / -ar hints keep the whole slug and hint their language");
  ok(P.fromQuery({ lang: "ko", rest: "feed.xml" }).kind === "feed" && P.fromQuery({ lang: "ru", rest: "page/2" }).page === 2 && P.fromQuery({ slug: "ja" }).lang === "ja", "fromQuery handles the new languages (what the Vercel rewrite hands over)");
  ok(P.fromQuery({ lang: "ar", rest: "feed.xml" }).kind === "feed" && P.fromQuery({ lang: "hi", rest: "page/2" }).page === 2 && P.fromQuery({ slug: "fr" }).lang === "fr" && P.fromQuery({ lang: "es", rest: ["live-one.html"] }).lang === "es" && P.fromQuery({ lang: "ar" }).kind === "index", "...and hi / es / fr / ar (feed, page/N, the one-segment address, the index)");
  ok(P.pickPost([{ lang: "ja", slug: "a-b", published: true }], "ja", false).lang === "ja" && P.pickPost([{ lang: "ru", slug: "a-b" }], "ko", false) === null, "pickPost accepts and separates the new languages");
  ok(P.pickPost([{ lang: "ar", slug: "a-b" }, { lang: "es", slug: "a-b" }], "es", false).lang === "es" && P.pickPost([{ lang: "hi", slug: "a-b" }], "fr", false) === null && P.pickPost([{ lang: "fr", slug: "a-b" }], "fr", true).lang === "fr", "...also hi / es / fr / ar");
  const nf = P.notFoundHtml(); ok(["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar"].every(l => nf.includes(`/blog/${l}/`)) && !nf.includes('id="root"'), "the 404 page links to all ten blogs");
  ok(nf.includes('<html lang="zh-Hans">') && !/<html[^>]* dir=/.test(nf) && P.notFoundHtml("hi").includes('<html lang="hi">') && P.notFoundHtml("es").includes('<html lang="es">') && P.notFoundHtml("fr").includes('<html lang="fr">') && !/<html[^>]* dir=/.test(P.notFoundHtml("hi") + P.notFoundHtml("es") + P.notFoundHtml("fr") + P.notFoundHtml("ja")), "the 404 page of hi / es / fr says its own language and is left-to-right (so does ja; zh is still the default)");
  { const ar = P.notFoundHtml("ar"); ok(ar.includes('<html lang="ar" dir="rtl">') && ar.includes("لم يتم العثور على هذا المقال") && ar.includes("<bdi>This article is not published.</bdi>") && !ar.includes('lang="zh-Hans"') && ar.includes("/blog/ar/") && ar.includes('<meta name="robots" content="noindex">'), "the Arabic 404 page is lang=\"ar\" dir=\"rtl\", in Arabic, noindex, and its one fixed English line is its own bidi island"); }
  const rows = [{ slug: "p", lang: "en", published: true, created_at: "2026-10-01" }, { slug: "p", lang: "ja", published: true, created_at: "2026-11-11" }, { slug: "p", lang: "ru", published: true, created_at: "2026-11-11" }];
  const xml = P.sitemapBlogXml(rows, SITE);
  ok(xml.includes(`<loc>${SITE}/blog/ja/p.html</loc>`) && xml.includes('hreflang="ja"') && xml.includes('hreflang="ru"') && xml.includes(`hreflang="x-default" href="${SITE}/blog/en/p.html"`), "the live sitemap lists ja / ru articles with their alternates");
  ok(xml.includes(`<loc>${SITE}/blog/ja/</loc>`) && xml.includes(`<loc>${SITE}/blog/ru/</loc>`) && !xml.includes(`<loc>${SITE}/blog/ko/</loc>`), "...and an index line only for a language that has an article");
  { const rows2 = ["en", "hi", "es", "fr", "ar"].map(l => ({ slug: "p", lang: l, published: true, created_at: "2026-11-13" })), x2 = P.sitemapBlogXml(rows2, SITE);
    ok(["hi", "es", "fr", "ar"].every(l => x2.includes(`<loc>${SITE}/blog/${l}/p.html</loc>`) && x2.includes(`hreflang="${l}" href="${SITE}/blog/${l}/p.html"`) && x2.includes(`<loc>${SITE}/blog/${l}/</loc>`)) && x2.includes(`hreflang="x-default" href="${SITE}/blog/en/p.html"`) && !x2.includes(`<loc>${SITE}/blog/ja/</loc>`), "the live sitemap lists hi / es / fr / ar articles, their indexes and the cluster of five with x-default = English"); }
  // the function: it never replaces a good static index with an empty list
  const mk = (data) => async () => ({ ok: true, json: async () => data });
  for (const l of STAT) {
    const idx = await L.serveBlog({ lang: l }, mk([])), feed = await L.serveBlog({ lang: l, rest: "feed.xml" }, mk([]));
    ok(idx.status === 404 && idx.headers["x-robots-tag"] === "noindex" && !idx.body.includes('class="card"'), l + ": asked for an index with no database rows the function answers 404 + noindex, not an empty 200 list");
    ok(feed.status === 404, l + ": ...and the same for the feed");
  }
  const th = await L.serveBlog({ lang: "th" }, mk([])); ok(th.status === 200, "th: an empty list still answers 200 (old behaviour kept)");
  const row = { lang: "ja", slug: "live-one", title: "ライブ記事", excerpt: "e", body: "本文\n", category: "tips", published: true, created_at: "2026-11-12T00:00:00Z", updated_at: "2026-11-12T00:00:00Z" };
  const li = await L.serveBlog({ lang: "ja" }, mk([row])); ok(li.status === 200 && li.headers["content-language"] === "ja" && li.body.includes("/blog/ja/live-one.html"), "ja: with database rows the index is rendered live");
  const la = await L.serveBlog({ lang: "ja", rest: "live-one.html" }, mk([row])); ok(la.status === 200 && la.body.includes('<html lang="ja">') && la.headers["content-language"] === "ja", "ja: an article published after the build is served live");
  const lr = await L.serveBlog({ lang: "ru", rest: "live-ru.html" }, mk([{ ...row, lang: "ru", slug: "live-ru" }, { ...row, lang: "en", slug: "live-ru" }])); ok(lr.status === 200 && lr.body.includes('hreflang="en"') && lr.body.includes('hreflang="ru"'), "ru: the live page lists the English row as an alternate (the language whitelist covers all ten)");
  const sm = await L.serveBlogSitemap(mk(rows)); ok(sm.status === 200 && sm.body.includes("/blog/ja/p.html"), "the live sitemap function includes ja");
  // hi / es / fr / ar through the function: an index, a feed and an article published after the build, each in its own language (Arabic right-to-left), and the catalog of the committed articles
  for (const l of NEWL) {
    const r = { ...row, lang: l, slug: "live-" + l, title: TITLE[l], body: "Para one.\n\nPara two.\n" };
    const idx = await L.serveBlog({ lang: l }, mk([r])), feed = await L.serveBlog({ lang: l, rest: "feed.xml" }, mk([r])), art = await L.serveBlog({ lang: l, rest: `live-${l}.html` }, mk([r, { ...r, lang: "en", title: "EN twin" }]));
    ok(idx.status === 200 && idx.headers["content-language"] === l && idx.body.includes(`<html lang="${l}"${l === "ar" ? ' dir="rtl"' : ""}>`) && idx.body.includes(`/blog/${l}/live-${l}.html`) && idx.body.includes(TITLE[l]), l + ": with a database row the index is rendered live in " + l + (l === "ar" ? " (dir=\"rtl\")" : ""));
    ok(feed.status === 200 && feed.headers["content-type"].includes("rss") && feed.body.includes(`<language>${l}</language>`), l + ": the live feed is RSS with <language>" + l + "</language>");
    ok(art.status === 200 && art.headers["content-language"] === l && art.body.includes(`<html lang="${l}"${l === "ar" ? ' dir="rtl"' : ""}>`) && art.body.includes(`og:locale" content="${LOC[l]}"`) && art.body.includes('hreflang="en"') && art.body.includes(`hreflang="${l}"`) && art.body.includes(`hreflang="x-default" href="${SITE}/blog/en/live-${l}.html"`) && nb(art.body).includes(nb(wall[l][0])) && (l === "ar") === art.body.includes("[dir=rtl]"), l + ": an article published after the build is served live, in " + l + ", with its English twin as an alternate and the wall in " + l);
    const cat = [{ lang: l, slug: "catalog-only", title: "Catalog " + l, excerpt: "e", category: "tips", published: true, created_at: "2026-11-13T00:00:00Z", updated_at: "2026-11-13T00:00:00Z" }];
    const down = await L.serveBlog({ lang: l }, async () => { throw new Error("offline"); }, { catalog: cat }), red = await L.serveBlog({ lang: l, rest: "catalog-only" }, mk([]), { catalog: cat });
    ok(down.status === 200 && down.body.includes("Catalog " + l) && red.status === 301 && red.headers.location === `${SITE}/blog/${l}/catalog-only.html`, l + ": with the database down the catalog still fills the index, and the address without .html goes to the file");
    const miss = await L.serveBlog({ lang: l, rest: "no-such.html" }, mk([]), { catalog: [] });
    ok(miss.status === 404 && miss.headers["content-language"] === l && miss.body.includes(`<html lang="${l}"${l === "ar" ? ' dir="rtl"' : ""}>`) && !miss.body.includes('lang="zh-Hans"'), l + ": an unknown article is a 404 in " + l + ", not in Chinese");
  }
  { const cat = await import(pathToFileURL(GEN).href + "?cat=" + Date.now()); const rowsC = cat.liveCatalogRows(cat.readStaticPosts(S)); ok(["ja", "ko", "ru", "hi", "es", "fr", "ar"].every(l => rowsC.some(p => p.lang === l && p.slug === "piano-posture")) && rowsC.every(p => STAT.includes(p.lang)), "the live catalog is built from every source-file language (ja ko ru hi es fr ar)"); }
  { const smx = await L.serveBlogSitemap(mk([{ slug: "q", lang: "en", published: true, created_at: "2026-11-01" }]), { catalog: [{ lang: "ar", slug: "q", published: true, created_at: "2026-11-13" }, { lang: "hi", slug: "q", published: true, created_at: "2026-11-13" }] });
    ok(smx.status === 200 && smx.body.includes(`<loc>${SITE}/blog/ar/q.html</loc>`) && smx.body.includes(`hreflang="ar" href="${SITE}/blog/ar/q.html"`) && smx.body.includes(`hreflang="hi" href="${SITE}/blog/hi/q.html"`) && smx.body.includes(`<loc>${SITE}/blog/ar/</loc>`), "the live sitemap merges the catalog rows of hi / ar with the database rows"); }
}

console.log("vercel.json and the redirect rules");
{
  const v = JSON.parse(rd(path.join(ROOT, "vercel.json")));
  ok(v.rewrites.some(r => r.source === "/blog/:lang/" && r.destination.includes("api/blog-page")) && v.rewrites.some(r => r.source === "/blog/:lang/:rest*"), "the generic /blog/:lang rewrites (any language, after the filesystem) are still there");
  ok(v.redirects.some(r => r.source === "/blog/" && r.destination === "/blog/th/") && v.redirects.some(r => r.source === "/th"), "old redirects unchanged");
  const feedRule = v.headers.find(h => /^\/blog\/\([a-z|]+\)\/feed\.xml$/.test(h.source)), feedLangs = feedRule ? feedRule.source.match(/\(([a-z|]+)\)/)[1].split("|") : [];
  ok(feedRule && /application\/rss\+xml/.test(JSON.stringify(feedRule.headers)) && JSON.stringify(feedLangs) === JSON.stringify(STAT), "the static ja / ko / ru / hi / es / fr / ar feeds are served as RSS (one rule, the same seven languages as STATIC_BLOG_LANGS: " + feedLangs.join("|") + ")");
  ok(!v.headers.some(h => /feed\.xml/.test(h.source) && /\b(th|en|zh)\b/.test(h.source)), "th / en / zh feeds keep the function's own content type (no static header rule for them)");
  ok(v.rewrites.filter(r => /^\/blog\//.test(r.source)).every(r => /^\/blog\/(:lang|:slug)/.test(r.source)), "no blog rewrite names a language: the generic rules serve all ten");
  ok(v.functions["api/blog-page.js"].includeFiles === "{supabase-client.ts,api/blog-live-catalog.json}" && v.functions["api/blog-sitemap.js"].includeFiles === v.functions["api/blog-page.js"].includeFiles, "the function bundle includes the title catalog, not blog-src");
  {
    // what Vercel serves is dist/: the baked index, feed and page/N of every source-file language are dropped there (so a function renders them from the database and the catalog), the article files stay
    const C = await import(pathToFileURL(path.join(ROOT, "scripts/copy-seo-to-dist.mjs")).href + "?t=" + Date.now()), d = path.join(tmp, "dist-blog");
    for (const l of ALLL) { fs.mkdirSync(path.join(d, l, "page", "2"), { recursive: true }); for (const f of ["index.html", "feed.xml", "article.html", "page/2/index.html"]) fs.writeFileSync(path.join(d, l, f), "x"); }
    C.stripLiveBlogShell(d);
    ok(STAT.every(l => !fs.existsSync(path.join(d, l, "index.html")) && !fs.existsSync(path.join(d, l, "feed.xml")) && !fs.existsSync(path.join(d, l, "page")) && fs.existsSync(path.join(d, l, "article.html"))), "dist/: the index, feed and page/N of ja / ko / ru / hi / es / fr / ar are dropped and their article files stay");
    ok(["th", "en", "zh"].every(l => fs.existsSync(path.join(d, l, "index.html")) && fs.existsSync(path.join(d, l, "feed.xml")) && fs.existsSync(path.join(d, l, "page", "2", "index.html")) && fs.existsSync(path.join(d, l, "article.html"))), "...and th / en / zh are not touched");
  }
  const E = await import(pathToFileURL(path.join(ROOT, "scripts/edge-redirect.mjs")).href);
  ok(E.redirectTarget("https://www.tigaalpha.com/blog/ja/", "www.tigaalpha.com", "https") === null && E.redirectTarget("https://www.tigaalpha.com/blog/ru/x.html", "www.tigaalpha.com", "https") === null, "edge redirects leave /blog/ja|ru/ alone");
  ok(E.redirectTarget("http://www.tigaalpha.com/blog/ko/", "www.tigaalpha.com", "http") === "https://www.tigaalpha.com/blog/ko/", "http -> https works for the new blogs too");
  ok(["hi", "es", "fr", "ar"].every(l => E.redirectTarget(`https://www.tigaalpha.com/blog/${l}/`, "www.tigaalpha.com", "https") === null && E.redirectTarget(`https://www.tigaalpha.com/blog/${l}/x.html`, "www.tigaalpha.com", "https") === null && E.redirectTarget(`http://www.tigaalpha.com/blog/${l}/feed.xml`, "www.tigaalpha.com", "http") === `https://www.tigaalpha.com/blog/${l}/feed.xml`), "edge redirects leave /blog/hi|es|fr|ar/ alone, and http -> https works for them too");
}

console.log("the blog's languages follow the language registry (lang-extra.ts)");
{
  // build-blog-pages.mjs is plain node and imports no TypeScript, so its right-to-left set and language codes are a copy of LANG_META: this keeps the two from drifting apart (a language added to the registry as rtl must be rendered rtl here too)
  const reg = rd(path.join(ROOT, "lang-extra.ts")), G2 = await import(pathToFileURL(GEN).href + "?reg=" + Date.now());
  const rtlReg = [...reg.matchAll(/^\s*(\w{2,3}): \{[^}\n]*\brtl: true/gm)].map(m => m[1]).sort(), rtlMine = ALLL.filter(l => G2.dirOf(l) === "rtl").sort();
  ok(rtlReg.join() === "ar" && rtlMine.join() === rtlReg.join(), "the languages lang-extra.ts marks right-to-left (" + rtlReg.join(",") + ") are exactly the ones the generator renders dir=\"rtl\" (" + rtlMine.join(",") + ")");
  const PP = await import(pathToFileURL(path.join(ROOT, "scripts/blog-paths.mjs")).href + "?reg=" + Date.now());
  ok(JSON.stringify(G2.STATIC_LANGS) === JSON.stringify(PP.STATIC_BLOG_LANGS) && JSON.stringify(G2.STATIC_LANGS) === JSON.stringify(STAT), "build-blog-pages.mjs (STATIC_LANGS) and blog-paths.mjs (STATIC_BLOG_LANGS) name the same source-file languages, in the same order (" + G2.STATIC_LANGS.join(",") + "): two copies of one fact");
  const meta = (l) => (new RegExp(`^\\s*${l}: \\{[^}\\n]*\\}`, "m").exec(reg) || [""])[0];
  ok(ALLL.every(l => meta(l)) && STAT.every(l => meta(l).includes(`html: "${l}"`)), "every blog language is in the registry, and the source-file languages use the same <html lang> code");
  const LOCALE = { ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", hi: "hi-IN", es: "es-ES", fr: "fr-FR" };
  ok(Object.entries(LOCALE).every(([l, loc]) => meta(l).includes(`locale: "${loc}"`) && rd(GEN).includes(`${l}: "${loc}"`)), "the reader counter formats in the registry's locale (ja-JP, ko-KR, ru-RU, hi-IN, es-ES, fr-FR); Arabic asks for Western digits explicitly (ar-u-nu-latn)");
}

console.log("SQL");
{
  const mig = rd(path.join(ROOT, "supabase-blog-ja-ko-ru-migration.sql"));
  ok(mig.includes("WRITTEN, NOT APPLIED") && mig.includes("blog_posts_lang_check") && mig.includes("drop constraint if exists blog_posts_lang_check") && mig.includes("'th','en','zh','ja','ko','ru'"), "the migration says NOT APPLIED and swaps the language check for six languages");
  const chk = spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs"), "--check"], { encoding: "utf8" });
  ok(chk.status === 0, "gen-blog-seed-sql.mjs --check: the committed migration is current with blog-src (" + (chk.stdout || chk.stderr).trim().slice(0, 90) + ")");
  // this migration is the six-language one (th en zh ja ko ru): it seeds the ja / ko / ru articles. Hindi, Spanish, French and Arabic have a migration of their own (supabase-blog-hi-es-fr-ar-migration.sql, written by the SQL job and checked
  // by gen-blog-seed-sql.mjs --check above); this test only says whether it is in the repo yet.
  const G = await import(pathToFileURL(GEN).href + "?sql=" + Date.now()); const valid = G.readStaticPosts(path.join(ROOT, "blog-src")).filter(p => ["ja", "ko", "ru"].includes(p.lang));
  const inserts = (mig.match(/^insert into public\.blog_posts/gm) || []).length;
  const perLang = (l) => (mig.match(new RegExp(`values \\('${l}', '`, "g")) || []).length;   // counted per language, so the check holds whether the file seeds only ja / ko / ru or every source-file language
  ok(valid.length > 0 && ["ja", "ko", "ru"].every(l => perLang(l) === valid.filter(p => p.lang === l).length) && valid.every(p => mig.includes(`values ('${p.lang}', '${p.slug}',`)), "one insert per valid ja / ko / ru source article in blog-src (" + valid.length + "), each with its lang and slug");
  console.log(fs.existsSync(path.join(ROOT, "supabase-blog-hi-es-fr-ar-migration.sql")) ? "  - supabase-blog-hi-es-fr-ar-migration.sql is in the repo (its content is the SQL job's to check)" : "  - supabase-blog-hi-es-fr-ar-migration.sql is NOT in the repo yet: the hi / es / fr / ar rows cannot be seeded into the database until it is written (the static pages do not need it)");
  ok((mig.match(/on conflict \(lang, slug\) do nothing;/g) || []).length === inserts, "every insert is 'on conflict (lang, slug) do nothing'");
  // stale detection and quoting, on a throw-away output
  const S3 = path.join(tmp, "src-sql"); W(path.join(S3, "ja", "quote-test.json"), src("ja", "quote-test", { title: "It's a \"test\" with $b1$ and \\ backslash", body: "line 1\n$b1\n'single' \\n literal $$ dollars\n" }));
  const sqlOut = path.join(tmp, "seed.sql"); const env = { ...process.env, BLOG_SRC: S3, BLOG_SEED_OUT: sqlOut };
  ok(spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs"), "--check"], { env, encoding: "utf8" }).status === 1, "--check fails when the file is missing");
  spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs")], { env, encoding: "utf8" });
  const q = rd(sqlOut);
  ok(spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs"), "--check"], { env, encoding: "utf8" }).status === 0, "--check passes right after writing");
  // a small SQL tokenizer (comments, 'strings', $tag$ strings): what a server would read out of the file must be exactly the article text
  const dollarStrings = (sql) => { const out = []; let i = 0; while (i < sql.length) { const c = sql[i];
    if (c === "-" && sql[i + 1] === "-") { i = sql.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "'") { i++; while (i < sql.length) { if (sql[i] === "'" && sql[i + 1] === "'") i += 2; else if (sql[i] === "'") { i++; break; } else i++; } continue; }
    if (c === "$") { const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 40)); if (m) { const end = sql.indexOf(m[0], i + m[0].length); out.push(sql.slice(i + m[0].length, end)); i = end + m[0].length; continue; } }
    i++; } return out; };
  const ds = dollarStrings(q);
  ok(ds.length === 3 && ds[0] === "It's a \"test\" with $b1$ and \\ backslash" && ds[1] === src("ja", "quote-test").excerpt && ds[2] === "line 1\n$b1\n'single' \\n literal $$ dollars\n", "read back by a SQL tokenizer, title / excerpt / body come out exactly as written (quotes, backslashes, $b1$ and $$ inside the text get their own tags)");
  W(path.join(S3, "ja", "added.json"), src("ja", "added"));
  ok(spawnSync("node", [path.join(ROOT, "scripts/gen-blog-seed-sql.mjs"), "--check"], { env, encoding: "utf8" }).status === 1, "--check fails again once an article is added (stale)");
  const views = rd(path.join(ROOT, "supabase-blog-views-migration.sql"));
  ok(!/in \('th','en','zh'\)/.test(views) && (views.match(/'th','en','zh','ja','ko','ru'/g) || []).length >= 6, "the reader-count migration allows six languages everywhere (no three-language check left)");
  ok(/create or replace function public\.blog_hit/.test(views) && /create or replace function public\.blog_view_counts/.test(views) && /create or replace function public\.blog_stats/.test(views) && /blog_purge/.test(views), "...and is otherwise intact (four functions)");
}

// ───────── the pages in a real browser: the wall copy and the counter, per language ─────────
console.log("the wall and the reader counter in Chromium");
const server = http.createServer((q, s) => { let f = path.join(tmp, "serve", decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { s.writeHead(404); return s.end("nf"); } s.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain" }); s.end(fs.readFileSync(f)); });
await new Promise(r => server.listen(0, "127.0.0.1", r)); const ORIGIN = "http://127.0.0.1:" + server.address().port;
gen({ BLOG_FIXTURE: path.join(tmp, "posts.json"), BLOG_OUT: path.join(tmp, "serve", "blog"), BLOG_SRC: S, SITE_URL: ORIGIN });
const pwm = await import("playwright").catch(async () => import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href)); const pw = pwm.chromium ? pwm : pwm.default;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const errs = []; const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "apikey, authorization, content-type", "access-control-allow-methods": "POST, OPTIONS" };
async function open(lang, { ms = 1200, w = 1000, h = 720, url = null, views = 1234 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, userAgent: UA }); const calls = [];
  await ctx.route("**/rest/v1/rpc/**", async (route) => { const req = route.request(); if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS }); const name = req.url().split("/rpc/")[1]; let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch (e) {} calls.push({ name, ...body }); route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(name === "blog_view_counts" ? [{ slug: "piano-posture", views }, { slug: "second-article", views: 7 }] : views) }); });
  await ctx.addInitScript(() => { try { localStorage.setItem("tg_test_hook", "1"); } catch (e) {} });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(url || `${ORIGIN}/blog/${lang}/piano-posture.html?gate_ms=${ms}`);
  return { ctx, page, calls };
}
const vis = (page) => page.evaluate(() => { const e = document.getElementById("tg-gate"); return !!e && !e.hidden && getComputedStyle(e).display !== "none"; });
const waitFor = (page, fn, ms = 6000) => page.waitForFunction(fn, null, { timeout: ms }).catch(() => {});
const badgeShown = () => { const e = document.querySelector(".tg-views"); return !!e && !e.hidden; }, gateShown = () => { const e = document.getElementById("tg-gate"); return !!e && !e.hidden; };
for (const lang of STAT) {
  const { ctx, page, calls } = await open(lang, { ms: 2000 });
  await waitFor(page, badgeShown, 5000);
  const b = await page.evaluate(() => { const e = document.querySelector(".tg-views"); return e ? { text: e.textContent, hidden: e.hidden, inMeta: !!e.closest("article .meta") } : null; });
  const want = { ja: "1,234回閲覧", ko: "1,234회 조회", ru: "1 234 просмотров", hi: "1,234 व्यूज़", es: "1234 visualizaciones", fr: "1 234 vues", ar: "1,234 مشاهدة" }[lang];
  ok(b && !b.hidden && b.inMeta && b.text.replace(/[\s\u00a0\u202f]+/g, " ").includes(want), lang + ": the reader count shows beside the date as '" + want + "' (" + (b && b.text.trim()) + ")");
  const v = calls.find(c => c.name === "blog_hit" && c.p_kind === "view");
  ok(v && v.p_lang === lang && v.p_slug === "piano-posture", lang + ": one view is sent with p_lang = " + lang);
  ok(!(await vis(page)), lang + ": the wall is not shown before the reading time");
  await waitFor(page, gateShown, 8000);
  ok(await vis(page), lang + ": the wall opens after the reading time");
  const txt = await page.evaluate(() => document.getElementById("tg-gate").innerText);
  ok(wall[lang].every(x => nb(txt).includes(nb(x))), lang + ": the card text is in " + lang + " (" + wall[lang][0] + ")");
  const r = await page.evaluate(() => { const c = document.querySelector(".tg-g-card").getBoundingClientRect(); return { cx: c.left + c.width / 2, cy: c.top + c.height / 2, w: innerWidth, h: innerHeight }; });
  ok(Math.abs(r.cx - r.w / 2) < 3 && Math.abs(r.cy - r.h / 2) < 40, lang + ": the card is in the middle of the screen");
  // direction: only Arabic is right-to-left; the wall stays centred either way, and in Arabic the Google mark sits on the right of its label (the start of the line)
  const dr = await page.evaluate(() => { const g = document.querySelector("[data-gate=google]"), s = g.querySelector("svg").getBoundingClientRect(), tn = [...g.childNodes].find(n => n.nodeType === 3), rg = document.createRange(); rg.selectNodeContents(tn); const t = rg.getBoundingClientRect(); const de = document.documentElement; return { dir: getComputedStyle(de).direction, attr: de.getAttribute("dir"), iconRightOfText: s.left > t.left, align: getComputedStyle(document.querySelector(".tg-g-card")).textAlign, sx: de.scrollWidth > innerWidth }; });
  ok(dr.dir === (lang === "ar" ? "rtl" : "ltr") && dr.attr === (lang === "ar" ? "rtl" : null) && dr.iconRightOfText === (lang === "ar") && dr.align === "center" && !dr.sx, lang + ": computed direction " + dr.dir + (lang === "ar" ? " (dir=\"rtl\", the Google mark on the right of its label)" : ", the mark on the left") + ", text centred, no sideways scroll");
  await page.keyboard.press("Escape"); ok(await vis(page), lang + ": Escape does not close it");
  ok((await page.$$eval("#tg-gate button", b => b.length)) === 0, lang + ": no button in it, only the three links");
  const hrefs = await page.$$eval("#tg-gate a[data-gate]", as => as.map(a => a.getAttribute("href")));
  ok(hrefs.length === 3 && hrefs.every(h => h.startsWith(ORIGIN + "/?") && h.includes("lg=" + lang)), lang + ": three links into the app with lg=" + lang);
  await page.route("**/*", route => { const u = route.request().url(); if (route.request().isNavigationRequest() && !u.includes("/blog/")) return route.fulfill({ status: 200, contentType: "text/html", body: "<title>app</title>" }); route.fallback(); });
  await page.click("[data-gate=signup]"); await page.waitForTimeout(400);
  const gl = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("tg_guest_profile") || "{}").lang; } catch (e) { return null; } });
  ok(gl === lang, lang + ": the app is told to open in " + lang + " (guest profile lang = " + gl + ")");
  ok(calls.some(c => c.p_kind === "click"), lang + ": a tap on a log-in button is recorded");
  await ctx.close();
}
{
  // the index page: counter on the card, formatted per language
  const { ctx, page, calls } = await open("ja", { url: `${ORIGIN}/blog/ja/` });
  await page.waitForTimeout(600);
  const t = await page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent));
  ok(t.length === 2 && t.some(x => x.includes("1,234回閲覧")) && t.some(x => x.includes("7回閲覧")), "ja index: the number shows on each card as 回閲覧 (" + t.join(" | ") + ")");
  ok(calls.some(c => c.name === "blog_view_counts" && c.p_lang === "ja"), "ja index: one call per list, for ja");
  const cards = await page.$$eval("a.card", a => a.map(x => x.getAttribute("href")));
  ok(cards.length === 3 && cards.every(h => h.startsWith(ORIGIN + "/blog/ja/")), "ja index: three cards link to the ja articles");
  await ctx.close();
  const k = await open("ko", { url: `${ORIGIN}/blog/ko/` }); await k.page.waitForTimeout(600);
  const kt = await k.page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent)); ok(kt.length === 1 && kt[0].includes("1,234회 조회"), "ko index: '1,234회 조회' on the card (" + kt.join("|") + ")"); await k.ctx.close();
  const ru = await open("ru", { url: `${ORIGIN}/blog/ru/` }); await ru.page.waitForTimeout(600);
  const rt = await ru.page.$$eval("a.card .tg-cv", n => n.map(x => x.textContent.replace(/[\s\u00a0\u202f]+/g, " "))); ok(rt.length === 1 && rt[0].includes("1 234 просмотров"), "ru index: '1 234 просмотров' on the card (" + rt.join("|") + ")"); await ru.ctx.close();
  // hi / es / fr / ar: the same counter on the cards (one call per list, for its own language), formatted in the page's locale; the Arabic index has two cards (1,234 and 7: the unit follows the number)
  const IDXW = { hi: ["1,234 व्यूज़"], es: ["1234 visualizaciones"], fr: ["1 234 vues"], ar: ["1,234 مشاهدة", "7 مشاهدات"] };
  for (const l of NEWL) {
    const x = await open(l, { url: `${ORIGIN}/blog/${l}/` }); await waitFor(x.page, () => document.querySelectorAll("a.card .tg-cv").length > 0, 5000);
    const ct = await x.page.$$eval("a.card .tg-cv", n => n.map(e => e.textContent.replace(/[\s\u00a0\u202f]+/g, " ")));
    ok(ct.length === IDXW[l].length && IDXW[l].every(w => ct.some(c => c.includes(w))), l + " index: " + IDXW[l].join(" and ") + " on the cards (" + ct.join(" | ") + ")");
    ok(x.calls.some(c => c.name === "blog_view_counts" && c.p_lang === l) && x.calls.filter(c => c.name === "blog_view_counts").length === 1, l + " index: one call per list, for " + l);
    const cs = await x.page.$$eval("a.card", a => a.map(e => e.getAttribute("href"))); ok(cs.length === (l === "ar" ? 2 : 1) && cs.every(h => h.startsWith(`${ORIGIN}/blog/${l}/`)), l + " index: the cards link to the " + l + " articles");
    await x.ctx.close();
  }
  {
    // the cards of a right-to-left index start at the right edge, a left-to-right one at the left edge (compared with Japanese)
    const edge = async (l) => { const x = await open(l, { url: `${ORIGIN}/blog/${l}/` }); await x.page.waitForTimeout(300); const m = await x.page.evaluate(() => { const c = document.querySelector("a.card"), bb = c.querySelector("b").getBoundingClientRect(), cb = c.getBoundingClientRect(); return { fromLeft: bb.left - cb.left, fromRight: cb.right - bb.right, dir: getComputedStyle(c).direction, sx: document.documentElement.scrollWidth > innerWidth }; }); await x.ctx.close(); return m; };
    const a = await edge("ar"), j = await edge("ja");
    ok(a.dir === "rtl" && a.fromRight > 8 && a.fromRight < 24 && !a.sx && j.dir === "ltr" && j.fromLeft > 8 && j.fromLeft < 24 && !j.sx, "the index card's title starts at the right edge in Arabic (" + Math.round(a.fromRight) + " px from it) and at the left edge in Japanese (" + Math.round(j.fromLeft) + " px)");
  }
}
{
  // a phone: the new fonts and long Russian / Korean / French copy still fit
  for (const lang of ["ru", "ko", "ja", ...NEWL]) {
    const { ctx, page } = await open(lang, { ms: 600, w: 360, h: 640 }); await waitFor(page, gateShown, 8000);
    const m = await page.evaluate(() => { const c = document.querySelector(".tg-g-card").getBoundingClientRect(); const bs = [...document.querySelectorAll("#tg-gate a.tg-g-btn")].map(b => b.getBoundingClientRect().height); return { l: c.left, r: c.right, t: c.top, b: c.bottom, w: innerWidth, h: innerHeight, bs, sx: document.documentElement.scrollWidth > innerWidth }; });
    ok(await vis(page) && m.l >= 0 && m.r <= m.w && m.t >= 0 && m.b <= m.h && m.bs.every(x => x >= 44) && !m.sx, lang + ": the card fits a 360x640 phone, buttons >= 44 px, no sideways scroll");
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${lang}-phone.png` });
    await ctx.close();
  }
  // the smallest phone (320 x 568): the new languages' wall needs no scrolling of its own, and no button label is cut off or wider than its button
  for (const lang of NEWL) {
    const { ctx, page } = await open(lang, { ms: 600, w: 320, h: 568 }); await waitFor(page, gateShown, 8000);
    const m = await page.evaluate(() => { const card = document.querySelector(".tg-g-card"), c = card.getBoundingClientRect(), links = [...document.querySelectorAll("#tg-gate a.tg-g-btn, #tg-gate a.tg-g-login")]; return { l: c.left, r: c.right, t: c.top, b: c.bottom, w: innerWidth, h: innerHeight, hs: links.map(b => Math.round(b.getBoundingClientRect().height)), cut: links.filter(b => b.scrollWidth > b.clientWidth + 1).length, inner: card.scrollHeight - card.clientHeight, sx: document.documentElement.scrollWidth > innerWidth }; });
    ok(await vis(page) && m.l >= 0 && m.r <= m.w && m.t >= 0 && m.b <= m.h && !m.sx && m.cut === 0 && m.inner <= 1, lang + ": the card fits a 320x568 phone with no scrolling of its own and no cut-off label (card " + Math.round(m.b - m.t) + " px high, buttons " + m.hs.join("/") + " px)");
    ok(m.hs.slice(0, 2).every(x => x >= 44), lang + ": the Google and sign-up buttons are at least 44 px tall at 320 px");
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${lang}-320.png` });
    await ctx.close();
  }
}
{
  // the meta line under the title keeps the reading order in both directions: category, then date, then the counter (first on the right in Arabic, first on the left otherwise), and the Arabic date stays 2026-11-12, not 12-11-2026
  const order = async (lang, slug = "second-article") => { const { ctx, page } = await open(lang, { url: `${ORIGIN}/blog/${lang}/${slug}.html` }); await waitFor(page, badgeShown, 5000);
    const m = await page.evaluate(() => { const meta = document.querySelectorAll("article .meta")[1], tm = meta.querySelector("time"), badge = meta.querySelector(".tg-views"); const first = [...meta.childNodes].find(n => n.nodeType === 3), rg = document.createRange(); rg.selectNodeContents(first); const cat = rg.getBoundingClientRect(), t = tm.getBoundingClientRect(), b = badge.getBoundingClientRect();
      const part = (s, e) => { const r = document.createRange(); r.setStart(tm.firstChild, s); r.setEnd(tm.firstChild, e); return r.getBoundingClientRect().left; };
      return { cat: cat.left, time: t.left, badge: b.left, y: part(0, 4), mo: part(5, 7), d: part(8, 10), text: tm.textContent, dir: getComputedStyle(tm).direction }; });
    await ctx.close(); return m; };
  const a = await order("ar"), h = await order("hi", "piano-posture"), j = await order("ja");   // only ar and ja have a second article in the fixture
  ok(a.cat > a.time && a.time > a.badge, "ar: category, date and counter run right to left (x = " + Math.round(a.cat) + " > " + Math.round(a.time) + " > " + Math.round(a.badge) + ")");
  ok(a.text === "2026-11-12" && a.y < a.mo && a.mo < a.d && a.dir === "ltr", "ar: the date reads 2026-11-12 from left to right as one island (year at " + Math.round(a.y) + ", month " + Math.round(a.mo) + ", day " + Math.round(a.d) + ")");
  ok(h.cat < h.time && h.time < h.badge && j.cat < j.time && j.time < j.badge && h.y < h.mo && h.mo < h.d && j.y < j.mo && j.mo < j.d, "hi and ja: category, date and counter run left to right, the date in order");
}
{
  // the unit follows the number where the language needs it (one view, two views, a few, many) in the page script and in the list script
  const cases = { es: [[1, "1 visualización"], [2, "2 visualizaciones"]], fr: [[1, "1 vue"], [2, "2 vues"]], hi: [[1, "1 व्यूज़"], [5, "5 व्यूज़"]], ar: [[1, "1 مشاهدة"], [2, "2 مشاهدتان"], [3, "3 مشاهدات"], [10, "10 مشاهدات"], [11, "11 مشاهدة"], [100, "100 مشاهدة"]] };
  for (const [lang, list] of Object.entries(cases)) {
    const got = [];
    for (const [n, text] of list) { const { ctx, page } = await open(lang, { views: n, ms: 60000 }); await waitFor(page, badgeShown, 5000); got.push([text, await page.evaluate(() => (document.querySelector(".tg-views") || {}).textContent || "")]); await ctx.close(); }
    const norm = (s) => s.replace(/[\s\u00a0\u202f]+/g, " ").trim();
    ok(got.every(([w, g]) => norm(g).endsWith(w) && norm(g).startsWith("\u00b7")), lang + ": the page counter says " + list.map(([, w]) => "'" + w + "'").join(", ") + (got.every(([w, g]) => norm(g).endsWith(w)) ? "" : " (got: " + got.map(x => norm(x[1])).join(" | ") + ")"));
  }
  const x1 = await open("es", { url: `${ORIGIN}/blog/es/`, views: 1 }); await waitFor(x1.page, () => document.querySelectorAll("a.card .tg-cv").length > 0, 5000);
  const e1 = await x1.page.$$eval("a.card .tg-cv", n => n.map(e => e.textContent)); await x1.ctx.close();
  const x2 = await open("ar", { url: `${ORIGIN}/blog/ar/`, views: 2 }); await waitFor(x2.page, () => document.querySelectorAll("a.card .tg-cv").length > 1, 5000);
  const e2 = await x2.page.$$eval("a.card .tg-cv", n => n.map(e => e.textContent)); await x2.ctx.close();
  ok(e1.length === 1 && e1[0].includes("1 visualización") && !e1[0].includes("visualizaciones") && e2.length === 2 && e2.some(c => c.includes("2 مشاهدتان")) && e2.some(c => c.includes("7 مشاهدات")), "the card counter of the list script follows the number too (es '" + e1.join("|") + "', ar '" + e2.join("|") + "')");
}
ok(errs.length === 0, "no page errors" + (errs.length ? ": " + [...new Set(errs)].slice(0, 3).join(" | ") : ""));
await browser.close(); server.close();

console.log("the in-app blog (BlogPage.tsx)");
{
  // That test drives React with short fixed waits (40 / 80 ms after a click), so on a busy machine one wait can be too short and one check fails ("en app: back to Thai ..." was seen red under CPU load and green on the
  // same code when the machine was quiet). A real regression fails every time, so a failing run is shown and run once more; only two failing runs in a row count.
  const runApp = () => { const r = spawnSync("node", [path.join(ROOT, "scripts/smoke-blog-jakoru-app.mjs")], { encoding: "utf8" }), lines = (r.stdout || "").split("\n"); return { status: r.status, p: lines.filter(l => l.startsWith("PASS ")).length, fails: lines.filter(l => l.startsWith("FAIL ")) }; };
  let r = runApp();
  if (r.status !== 0 || r.fails.length) { console.log("  - the in-app test failed once (" + r.fails.length + " check(s): " + r.fails.join(" | ").slice(0, 200) + "); running it once more, a real regression fails again"); r = runApp(); }
  for (const l of r.fails) console.log("  ✗ " + l);
  ok(r.status === 0 && r.fails.length === 0 && r.p > 40, "scripts/smoke-blog-jakoru-app.mjs: " + r.p + " checks pass, " + r.fails.length + " fail");
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
