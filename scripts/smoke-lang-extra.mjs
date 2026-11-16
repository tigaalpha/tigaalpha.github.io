// The runtime behind the seven extra languages (lang-extra.ts): Japanese, Korean, Russian, then Hindi, Spanish, French and Arabic (2026-11-13).
// Catalog lookups, {n} patterns, ordinals (ja ko ru hi es fr ar), the plural-suffix hole, by(), pickT, xl, the AI reply line, the picker order (ten languages),
// the right-to-left flag, Intl digits (Arabic 0-9, Hindi never Devanagari), and the STATIC checks of the app plumbing that need no browser and no dist/. Where a function or a table is
// needed, the REAL source is cut out of the file and run: the speech tables and detectSpeechLang and narrationText (speech.ts), currencyOf (payment.tsx), pickLang (retention.ts), the
// piano-tts language hints, and the Arabic digit rule in a child process whose DEFAULT locale is ar-SA (where a plain toLocaleString() prints Arabic-Indic digits by itself). The rest
// are reads of the source for the things that must stay true: the language lists in local-identity / campaign-funnel / quiz-quest / extract-i18n, every call that hands the language to
// the TIGA model going through modelLang(), the :lang() font rules and the right-to-left block of the stylesheets, the hook-order allowlist, the Android and manifest settings.
//   node scripts/smoke-lang-extra.mjs
// NOT checked here: anything in a browser or on a phone (scripts/smoke-lang-jakoru.mjs does that against a build, after `npm run build` or any vite build with --outDir), a live
// edge function, the live database, or how any of it sounds.
import fs from "node:fs";
import esbuild from "esbuild";

const js = esbuild.transformSync(fs.readFileSync("lang-extra.ts", "utf8"), { loader: "ts", format: "esm" }).code;
const M = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

let pass = 0; const fails = [];
const eq = (a, b, n) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (ok) pass++; else { fails.push(n); console.log(`FAIL ${n}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`); } };

eq(["ja", "ko", "ru", "hi", "es", "fr", "ar"].every(M.isExtraLang), true, "ja, ko, ru, hi, es, fr, ar are extra languages");
eq(M.EXTRA_LANGS, ["ja", "ko", "ru", "hi", "es", "fr", "ar"], "seven extra languages in order");
eq(["th", "en", "zh", "", null, "xx"].some(M.isExtraLang), false, "th, en, zh and junk are not");
eq(M.ALL_LANGS, ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar"], "ten languages in picker order");
eq(new Set(M.ALL_LANGS).size, 10, "no language twice in the picker");
eq(M.ALL_LANGS.every(l => M.LANG_META[l] && M.LANG_META[l].flag && M.LANG_META[l].name && M.LANG_META[l].locale && M.LANG_META[l].html && M.LANG_META[l].ai), true, "every picker language has flag, native name, locale, html lang and AI name");
eq(M.ALL_LANGS.map(l => M.LANG_META[l].name), ["ไทย", "English", "中文", "日本語", "한국어", "Русский", "हिन्दी", "Español", "Français", "العربية"], "native names in picker order");
eq(Object.keys(M.LANG_META).sort(), [...M.ALL_LANGS].sort(), "LANG_META has exactly the picker languages");
eq(M.localeOf("ja"), "ja-JP", "locale ja"); eq(M.localeOf("ko"), "ko-KR", "locale ko"); eq(M.localeOf("ru"), "ru-RU", "locale ru"); eq(M.localeOf("zh"), "zh-CN", "locale zh");
eq(M.dateLocale("en"), "en-GB", "English dates stay day-month-year"); eq(M.dateLocale("ja"), "ja-JP", "Japanese dates use ja-JP");
eq(M.LANG_META.ru.html, "ru", "html lang ru");
eq(M.localeOf("hi"), "hi-IN", "locale hi"); eq(M.localeOf("es"), "es-ES", "locale es"); eq(M.localeOf("fr"), "fr-FR", "locale fr");
eq(M.LANG_META.ar.locale, "ar", "the registry keeps the neutral 'ar' for Arabic (not ar-SA: no country, no Hijri calendar)");
eq(M.localeOf("ar"), "ar-u-nu-latn", "Intl gets Arabic with the Latin numbering system named (Western digits 0-9 in every engine, not only in the ones with CLDR 42)");
eq(M.dateLocale("ar"), "ar-u-nu-latn", "Arabic dates use it too"); eq(M.dateLocale("hi"), "hi-IN", "Hindi dates use hi-IN");
eq(["hi", "es", "fr", "ar"].map(l => M.LANG_META[l].html), ["hi", "es", "fr", "ar"], "html lang hi es fr ar");
eq(new Intl.NumberFormat(M.localeOf("ar")).format(1234567), "1,234,567", "the Arabic locale prints Western digits (Node's ICU)");
// no language prints native digits: every Intl tag the app uses resolves to the Latin numbering system (Hindi must never be Devanagari digits, Arabic never Arabic-Indic)
eq(M.ALL_LANGS.map(l => new Intl.NumberFormat(M.localeOf(l)).resolvedOptions().numberingSystem), M.ALL_LANGS.map(() => "latn"), "every language formats numbers with Latin digits");
eq(M.ALL_LANGS.map(l => new Intl.DateTimeFormat(M.dateLocale(l), { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 16))).replace(/[^0-9٠-٩०-९]/g, "")).every(x => /^[0-9]+$/.test(x)), true, "every language writes the digits of a date with 0-9");
eq(["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr"].map(M.localeOf), ["th-TH", "en-US", "zh-CN", "ja-JP", "ko-KR", "ru-RU", "hi-IN", "es-ES", "fr-FR"], "only Arabic got a numbering-system extension: the other locales are exactly what they were");
// right to left: only Arabic
eq(M.ALL_LANGS.filter(M.isRtl), ["ar"], "only Arabic is right-to-left");
eq(M.ALL_LANGS.map(M.dirOf), ["ltr", "ltr", "ltr", "ltr", "ltr", "ltr", "ltr", "ltr", "ltr", "rtl"], "dirOf per picker language");
eq(M.dirOf("xx"), "ltr", "an unknown language is ltr"); eq(M.isRtl(undefined), false, "isRtl(undefined) does not throw");

// before any catalog: English comes back, never undefined
eq(M.xlate("ja", "Start"), "Start", "no catalog yet: English");
eq(M.pickT("ja", "เริ่ม", "Start", "开始"), "Start", "pickT without a catalog: English");

M.setCatalog("ja", {
  "Start": "開始", "Songs: {0}": "曲数: {0}", "{0} songs, {1} lessons": "{0}曲、{1}レッスン",
  "What is the {0} note of the {1} major scale?": "{1}メジャースケールの{0}の音は？",
  "{0}": "SHOULD NEVER MATCH", "{0} {1}": "SHOULD NEVER MATCH EITHER",
});
eq(M.xlate("ja", "Start"), "開始", "exact entry");
eq(M.xlate("ja", "Unknown text"), "Unknown text", "a missing entry shows its English");
eq(M.xlate("ja", "Songs: 12"), "曲数: 12", "template literal with one hole");
eq(M.xlate("ja", "12 songs, 3 lessons"), "12曲、3レッスン", "two holes, in order");
eq(M.xlate("ja", "What is the 3rd note of the C major scale?"), "Cメジャースケールの3番目の音は？", "holes reordered by the translation, English ordinal localised");
eq(M.xlate("ja", "x"), "x", "a key that is only holes never matches everything");
eq(M.xlate("ko", "Start"), "Start", "another language without its catalog: English");
eq(M.xlate("th", "Start"), "Start", "th is not translated through a catalog");
eq(M.xlate("ja", undefined), undefined, "non-string passes through");

eq(M.pickT("th", "เริ่ม", "Start", "开始"), "เริ่ม", "pickT th"); eq(M.pickT("zh", "เริ่ม", "Start", "开始"), "开始", "pickT zh");
eq(M.pickT("en", "เริ่ม", "Start", "开始"), "Start", "pickT en"); eq(M.pickT("ja", "เริ่ม", "Start", "开始"), "開始", "pickT ja uses the catalog");
eq(M.xl("ja", "Start"), "開始", "xl ja"); eq(M.xl("en", "Start"), "Start", "xl en"); eq(M.xl("ja", 42), 42, "xl leaves a number alone");
const node = { type: "el" }; eq(M.xl("ja", node), node, "xl leaves a React-like object alone");

// by(): the old MAP[lang]
const tags = { th: { a: "ก" }, en: { a: "Start", b: ["Start", "Songs: 4"] }, zh: { a: "开" } };
eq(M.by(tags, "th"), { a: "ก" }, "by th: own entry"); eq(M.by(tags, "en").a, "Start", "by en");
eq(M.by(tags, "ja"), { a: "開始", b: ["開始", "曲数: 4"] }, "by ja: the English table, translated through the catalog, to any depth");
eq(M.by(tags, "ko"), tags.en, "by ko without a catalog: the English table");
eq(M.by(tags, "ja") === M.by(tags, "ja"), true, "by is memoised (same object twice)");
eq(M.by({ th: 1, en: 2, zh: 3 }, "ru"), 2, "by on numbers falls back to the English number");
eq(M.by({ th: "ก", zh: "开" }, "ru"), "ก", "by with no English entry falls back to Thai");
eq(M.by(undefined, "ja"), undefined, "by(undefined) does not throw");
eq(M.by({ ja: "own" }, "ja"), "own", "an own entry always wins");

// a catalog arriving later changes the answers and the memo
M.setCatalog("ja", { "Start": "スタート" });
eq(M.xlate("ja", "Start"), "スタート", "a replaced catalog is used"); eq(M.by(tags, "ja").a, "スタート", "by is rebuilt after a catalog change");
let heard = 0; const off = M.subscribeCatalog(() => heard++); M.setCatalog("ko", { "Start": "시작" }); off(); M.setCatalog("ko", { "Start": "시작" });
eq(heard, 1, "subscribers hear a catalog arrive, and stop after unsubscribing"); eq(M.xlate("ko", "Start"), "시작", "ko catalog");
// the most specific pattern wins = the one with the most FIXED text, not the one with the most holes (scripts/extract-i18n.mjs writes a conditional inside a sentence as a hole AND as its variants;
// the hole version used to outrank the variants because every hole adds regex source, so " or ", "Major" and "team goal ✓" stayed English inside a translated sentence)
M.setCatalog("es", { "Clear episode {0}{1} first{2}": "HOLES", "Clear episode {0} or {1} first": "{0} o {1}", "Clear episode {0} first ({1})": "{0} ({1})", "{0}{1} · {2} Chords": "HOLES2", "{0} Major · {1} Chords": "{0} mayor · {1}" });
eq([M.xlate("es", "Clear episode 4 or 5 first"), M.xlate("es", "Clear episode 4 first (Ark)"), M.xlate("es", "C Major · 4 Chords"), M.xlate("es", "Clear episode 4 first")], ["4 o 5", "4 (Ark)", "C mayor · 4", "HOLES"], "a variant with more fixed text beats the sentence with an extra hole where its conditional was, which stays the fallback for a string no variant fits");

// ordinals in a hole: every extra language has its own form of 1st / 2nd / 3rd ...
M.setCatalog("ko", { "The {0} note": "{0} 음" }); M.setCatalog("ru", { "The {0} note": "{0} нота" });
M.setCatalog("hi", { "The {0} note": "{0} स्वर" }); M.setCatalog("es", { "The {0} note": "{0} nota" });
M.setCatalog("fr", { "The {0} note": "{0} note" }); M.setCatalog("ar", { "The {0} note": "النغمة {0}" });
eq(["1st", "2nd", "3rd", "4th", "5th", "11th"].map(o => M.xlate("ko", "The " + o + " note")), ["1번째 음", "2번째 음", "3번째 음", "4번째 음", "5번째 음", "11번째 음"], "ko ordinals");
eq(["1st", "3rd", "5th"].map(o => M.xlate("ru", "The " + o + " note")), ["1-й нота", "3-й нота", "5-й нота"], "ru ordinals");
eq(["1st", "2nd", "3rd", "4th", "5th", "11th"].map(o => M.xlate("hi", "The " + o + " note")), ["पहला स्वर", "दूसरा स्वर", "तीसरा स्वर", "चौथा स्वर", "5वाँ स्वर", "11वाँ स्वर"], "hi ordinals: words for 1-4, number + वाँ after");
eq(["1st", "2nd", "3rd", "5th"].map(o => M.xlate("es", "The " + o + " note")), ["1.º nota", "2.º nota", "3.º nota", "5.º nota"], "es ordinals: number + .º");
eq(["1st", "2nd", "3rd", "5th", "11th"].map(o => M.xlate("fr", "The " + o + " note")), ["1er note", "2e note", "3e note", "5e note", "11e note"], "fr ordinals: 1er, then Ne");
eq(["1st", "2nd", "3rd", "4th", "5th"].map(o => M.xlate("ar", "The " + o + " note")), ["النغمة الأول", "النغمة الثاني", "النغمة الثالث", "النغمة الرابع", "النغمة 5"], "ar ordinals: words for 1-4, the digit after (Western digits)");
// the English plural suffix ("s" / "es") is dropped in a hole: these languages have no such ending, and the translation puts the hole where it would have been
for (const [lg, to] of [["ja", "{0}曲{1}。"], ["hi", "{0} गाने{1}।"], ["es", "{0} canciones{1}."], ["fr", "{0} chansons{1}."], ["ar", "{0} أغنية{1}."]]) {
  M.setCatalog(lg, { "{0} song{1}": to, "{0} box{1}": to });
  const out = [M.xlate(lg, "3 songs"), M.xlate(lg, "1 song"), M.xlate(lg, "2 boxes")];
  eq(out, [to.replace("{0}", "3").replace("{1}", ""), to.replace("{0}", "1").replace("{1}", ""), to.replace("{0}", "2").replace("{1}", "")], lg + ": the plural-suffix hole ('s' / 'es') is an empty string, never printed");
}

// the AI reply line
eq(M.replyInstruction("th"), "", "no extra line for th"); eq(M.replyInstruction("en"), "", "no extra line for en");
for (const [lg, nm] of [["ja", "Japanese"], ["ko", "Korean"], ["ru", "Russian"], ["hi", "Hindi"], ["es", "Spanish"], ["fr", "French"], ["ar", "Arabic"]]) eq(M.replyInstruction(lg).includes(nm), true, "reply line names " + nm);
eq(M.replyInstruction("zh"), "", "no extra line for zh");


// ════════════════ STATIC checks of the app plumbing (no browser, no dist/): the real source files are read, and where a function or a table is needed it is cut out and RUN ════════════════
import { spawnSync } from "node:child_process";
const rd = f => fs.readFileSync(f, "utf8");
const rootTs = fs.readdirSync(".").filter(f => /\.(ts|tsx)$/.test(f) && !/^i18n-[a-z]{2}\.ts$/.test(f) && !/\.d\.ts$/.test(f));
// source with its comments blanked (line numbers kept), so a rule written in a comment is not mistaken for code
const code = f => rd(f).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const ts2js = src => esbuild.transformSync(src, { loader: "ts", format: "esm" }).code;
const LANGX_URL = "data:text/javascript;base64," + Buffer.from(js).toString("base64");   // the very URL M was imported from: a module that imports it shares M's catalogs
const evalTs = (src, exportNames, header = "") => import("data:text/javascript;base64," + Buffer.from(ts2js(header + src.replace(/^export /gm, "") + "\nexport { " + exportNames.join(", ") + " };")).toString("base64"));
const ten = M.ALL_LANGS;

// ── speech.ts (a): the tables, and detectSpeechLang cut out of the real file and run ──
{
  const sp = rd("speech.ts");
  const cut = (re, what) => { const m = re.exec(sp); if (!m) { eq(what, "found", what + " not found in speech.ts"); return ""; } return m[0]; };
  const tables = cut(/export const TTS_LOCALES = \{[^}]*\};/, "TTS_LOCALES") + "\n" + cut(/export const TTS_RATE = \{[^}]*\};/, "TTS_RATE") + "\n" + cut(/const TTS_CHARS_PER_SEC = \{[^}]*\};/, "TTS_CHARS_PER_SEC");
  const fnStart = sp.indexOf("export function detectSpeechLang"), fnEnd = sp.indexOf("const TTS_CHARS_PER_SEC");
  const T = await evalTs(tables + "\n" + sp.slice(fnStart, fnEnd), ["TTS_LOCALES", "TTS_RATE", "TTS_CHARS_PER_SEC", "detectSpeechLang"]);
  eq(ten.every(l => T.TTS_LOCALES[l] && T.TTS_RATE[l] > 0.5 && T.TTS_RATE[l] <= 1.2 && T.TTS_CHARS_PER_SEC[l] > 2), true, "speech: every one of the ten languages has a voice locale, a speaking rate and a characters-per-second figure");
  eq(ten.every(l => T.TTS_LOCALES[l].split("-")[0] === l), true, "speech: each voice locale starts with its own language code (bestVoice() matches voices on that prefix)");
  eq(["hi", "es", "fr", "ar"].map(l => T.TTS_LOCALES[l]), ["hi-IN", "es-ES", "fr-FR", "ar-SA"], "speech: voice locales hi-IN, es-ES, fr-FR, ar-SA");
  const d = T.detectSpeechLang;
  eq([d("नमस्ते, आज हम C मेजर स्केल सीखेंगे"), d("مرحبًا، سنتعلم اليوم سلم C ماجور"), d("สวัสดี วันนี้เรียนสเกล C"), d("今天学习 C 大调音阶"), d("こんにちは、Cメジャー"), d("안녕하세요 C 메이저"), d("Привет, учим гамму C")],
     ["hi", "ar", "th", "zh", "ja", "ko", "ru"], "detectSpeechLang tells th / zh / ja / ko / ru / hi / ar by script, with Latin note names mixed in");
  eq([d("Let's learn the C major scale today", "en"), d("Let's learn the C major scale today", "th"), d("Let's learn the C major scale today", "zh")], ["en", "en", "en"], "detectSpeechLang: Latin text is English for every app language except es / fr, exactly as before");
  eq([d("Hoy aprendemos la escala de Do mayor", "es"), d("Aujourd'hui nous apprenons la gamme de do majeur", "fr"), d("Hoy aprendemos la escala de Do mayor", "en")], ["es", "fr", "en"], "detectSpeechLang: Spanish and French share the Latin script, so the APP language decides (es / fr fallback) and nothing else is guessed");
  eq([d("", "ar"), d("", "hi"), d("   ", "es")], ["ar", "hi", "es"], "detectSpeechLang: no text at all returns the fallback");
  eq([d("C D E F G", "es"), d("12345", "fr")], ["es", "fr"], "detectSpeechLang: note names only are read as the app language when it is es / fr");
  // the callers must hand over the app language as the fallback (a one-argument call would never say "es" or "fr")
  const callers = ["chat-ui.tsx", ...rootTs].filter((f, i, a) => a.indexOf(f) === i).flatMap(f => (rd(f).match(/detectSpeechLang\([^)]*\)/g) || []).map(c => f + ": " + c)).filter(c => !c.startsWith("speech.ts"));
  eq(callers.length >= 2 && callers.every(c => /detectSpeechLang\(text, lang\)/.test(c)), true, "speech: every caller of detectSpeechLang passes the app language (" + callers.join(" | ") + ")");
  // speech recognition and the device voice read the same table
  eq(/rec\.lang = TTS_LOCALES\[langRef\.current\]/.test(rd("use-voice-tutor.ts")) && /rec\.lang = TTS_LOCALES\[lang\]/.test(rd("PracticeOverlay.tsx")) && /utt\.lang = TTS_LOCALES\[lang\]/.test(rd("App.tsx")), true, "speech: the voice tutor, the practice recogniser and the speak button take their language tag from TTS_LOCALES");
}

// ── the piano-tts repo copy (c): the language codes it hints Gemini with ──
{
  const f = rd("supabase/functions/piano-tts/index.ts");
  const m = /const LANG_CODE: Record<string, string> = (\{[^}]*\});/.exec(f);
  const codes = m ? (0, eval)("(" + m[1] + ")") : {};
  eq(ten.filter(l => l !== "ar").every(l => typeof codes[l] === "string" && codes[l].toLowerCase().startsWith(l === "zh" ? "cmn" : l)), true, "piano-tts: a Gemini language hint for nine languages (" + Object.entries(codes).map(([k, v]) => k + "=" + v).join(" ") + ")");
  eq(codes.ar, undefined, "piano-tts: Arabic is sent with NO hint on purpose (the only Arabic tag the speech docs list is the Egyptian dialect; the model reads Arabic from the text)");
  eq(codes.hi, "hi-IN", "piano-tts: Hindi hint hi-IN"); eq([codes.es, codes.fr], ["es-ES", "fr-FR"], "piano-tts: Spanish and French hints es-ES, fr-FR (a refused tag is retried without it)");
  eq(/status === 400 && withLang && langCode && \/language\/i\.test\(errText\)\) return synthOnce\(text, voice, lang, model, false\)/.test(f), true, "piano-tts: a code the model refuses is spoken again without the hint (a wrong code costs one round trip, not the feature)");
}

// ── the learner-facing edge functions with a language of their own: a language they do not list falls back to English, never throws ──
{
  for (const fn of ["weekly-report", "return-reminders"]) {
    const f = rd("supabase/functions/" + fn + "/index.ts");
    eq(/\? "zh" : \(!(?:u|p)\.lang \|\| (?:u|p)\.lang === "th"\) \? "th" : "en"/.test(f), true, fn + ": zh and th keep their own text, every other language (the seven extra ones) gets the English text");
  }
}

// ── speech.ts narration (the adventure films and the concept clips): the letters of "AI", "He-3" and the percent sign are spoken the way the language says them ──
{
  const sp = rd("speech.ts"), fn = n => (new RegExp("export function " + n + "\\([\\s\\S]*?\\n\\}").exec(sp) || [""])[0];
  const N = await evalTs(fn("cleanForTTS") + "\n" + fn("narrationText"), ["narrationText"], `import { xl, isExtraLang } from ${JSON.stringify(LANGX_URL)};\n`);
  M.setCatalog("es", { "A I": "I A", "helium three": "helio tres", "Teega": "Tiga", "$1 percent": "$1 por ciento" });
  M.setCatalog("hi", { "A I": "ए आई", "helium three": "हीलियम थ्री", "Teega": "टीगा", "$1 percent": "$1 प्रतिशत" });
  const say = lg => N.narrationText("TIGA AI He-3 50%", lg);
  eq([say("th"), say("zh"), say("en")], ["ทีก้า AI He-3 50 เปอร์เซ็นต์", "提加 AI He-3 百分之50", "Teega A I helium three 50 percent"], "narration: th / zh / en say it exactly as before");
  eq([say("es"), say("hi")], ["Tiga I A helio tres 50 por ciento", "टीगा ए आई हीलियम थ्री 50 प्रतिशत"], "narration: Spanish and Hindi take the catalog's way of saying the letters, the isotope and the percent sign (it was only English before)");
}

// ── (d) cloud sync: this work adds no localStorage key; the registry is checked by npm run verify:cloudsync ──
eq(/tg_lang_hint:/.test(rd("cloud-sync.ts")), true, "cloud-sync: tg_lang_hint (the one language key) has a decision");

// ── (e) the three modules that list languages are in step with the registry ──
{
  const alt = (file, what) => { const hits = [...rd(file).matchAll(/\(((?:[a-z]{2}\|){3,}[a-z]{2})\)/g)].map(m => m[1].split("|")); eq(hits.length >= 1 && hits.every(a => ten.every(l => a.includes(l))), true, what + ": every language alternation lists all ten (" + hits.map(a => a.length).join(",") + " entries)"); };
  alt("local-identity.ts", "local-identity.ts (landing origin)"); alt("campaign-funnel.ts", "campaign-funnel.ts (funnel language)"); alt("scripts/extract-i18n.mjs", "extract-i18n.mjs (language tags it leaves out)");
  const qq = /export type Lang = ([^;]*);/.exec(rd("quiz-quest.ts"));
  eq(qq && ten.every(l => qq[1].includes('"' + l + '"')), true, "quiz-quest.ts: the Lang type lists all ten");
  eq(/\(k === "sys" \|\| k === "vmSys"\) \? val \+ replyInstruction\(lang\)/.test(rd("i18n.ts")), true, "i18n.ts: the chat and the voice tutor prompts get the reply-language line for every extra language");
}

// ── (f) numbers and dates ──
{
  // no source forces a native-digit numbering system or a country-specific Arabic tag into an Intl / toLocale call
  const bad = rootTs.flatMap(f => code(f).split("\n").map((ln, i) => [f, i + 1, ln])).filter(([f, i, ln]) => /-u-[a-z-]*nu-(deva|arab|arabext)/.test(ln) || /(toLocale\w*String|Intl\.\w+)\(\s*["'`]ar-(SA|EG|AE)/.test(ln)).map(([f, i]) => f + ":" + i);
  eq(bad, [], "no source forces Devanagari / Arabic-Indic digits or ar-SA into an Intl call");
  eq(rootTs.filter(f => /\.toLocale\w*String\(\s*(lang|lg)\s*[,)]/.test(rd(f))), [], "no Intl call takes the raw app language as its locale (en would become 'en', ja 'ja': always through localeOf / dateLocale)");
  // currencyOf: cut from payment.tsx and run; by(CURRENCY_BY_LANG, ...) is the bug it replaced
  const pay = rd("payment.tsx");
  const cm = /export const CURRENCY_BY_LANG[^\n]*\n(?:\/\*[\s\S]*?\*\/\n)?export const currencyOf[^\n]*/.exec(pay);
  eq(!!cm, true, "payment.tsx: currencyOf sits right after CURRENCY_BY_LANG");
  if (cm) {
    const C = await evalTs(cm[0].replace(/export const/g, "const"), ["currencyOf"]);
    eq(ten.map(C.currencyOf), ["thb", "usd", "cny", "usd", "usd", "usd", "usd", "usd", "usd", "usd"], "currencyOf: baht, dollars, yuan, and DOLLARS for every extra language (never a translated word)");
    eq([C.currencyOf(undefined), C.currencyOf("xx")], ["usd", "usd"], "currencyOf: an unknown language is priced as English");
  }
  eq(rootTs.filter(f => /by\(\s*CURRENCY_BY_LANG/.test(code(f))), [], "nothing reads the currency through by() any more");
  // why: the catalogs translate the word "usd", so by() on the table is not a currency code for an extra language
  M.setCatalog("hi", { "usd": "अमेरिकी डॉलर" });
  eq(M.by({ th: "thb", en: "usd", zh: "cny" }, "hi"), "अमेरिकी डॉलर", "by() on a code table returns the translated word (this is the bug currencyOf avoids)");
}

// ── Arabic digits for the plain n.toLocaleString() calls: the shim, run in a child process whose DEFAULT locale is ar-SA (where the engine prints Arabic-Indic digits on its own) ──
{
  const script = `
    const M = await import("data:text/javascript;base64," + process.env.LANGX_B64);
    const day = new Date(Date.UTC(2026, 10, 16, 12));
    const o = { loc: Intl.DateTimeFormat().resolvedOptions().locale };
    o.before = (1234567).toLocaleString(); o.dayBefore = day.toLocaleDateString(undefined, { timeZone: "UTC" });
    const nat = Number.prototype.toLocaleString;
    o.on = M.applyDigitRule("ar"); o.after = (1234567).toLocaleString(); o.afterUndef = (1234567).toLocaleString(undefined); o.dayAfter = day.toLocaleDateString(undefined, { timeZone: "UTC" });
    o.opts = (1234.5).toLocaleString(undefined, { minimumFractionDigits: 2 });
    o.explicitEn = (1234567).toLocaleString("en-US"); o.explicitArSA = (1234567).toLocaleString("ar-SA");
    M.applyDigitRule("ar"); o.twice = (1234567).toLocaleString();
    o.off = M.applyDigitRule("en"); o.restored = Number.prototype.toLocaleString === nat; o.afterOff = (1234567).toLocaleString();
    M.applyDigitRule("hi"); o.hiUntouched = Number.prototype.toLocaleString === nat;
    M.applyDigitRule("ar"); M.applyDigitRule("th"); o.thUntouched = Number.prototype.toLocaleString === nat && (1234567).toLocaleString() === o.before;
    console.log(JSON.stringify(o));`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, LC_ALL: "ar_SA.UTF-8", LANG: "ar_SA.UTF-8", LANGX_B64: Buffer.from(js).toString("base64") }, encoding: "utf8" });
  let o = null; try { o = JSON.parse(r.stdout.trim().split("\n").pop()); } catch (e) { eq(String(r.stderr).slice(0, 200), "", "the digit-rule child process ran"); }
  if (o && !/[٠-٩]/.test(o.before)) console.log("SKIP digit rule: this Node's ICU prints Latin digits even with LC_ALL=ar_SA (default locale " + o.loc + "), so the before / after difference cannot be shown here");
  else if (o) {
    eq(/[٠-٩]/.test(o.before) && /[٠-٩]/.test(o.dayBefore), true, "digit rule, precondition: with an ar-SA device a plain toLocaleString() / toLocaleDateString() prints Arabic-Indic digits (" + o.loc + ": " + o.before + ")");
    eq([o.after, o.afterUndef, o.twice], ["1,234,567", "1,234,567", "1,234,567"], "digit rule: while the language is Arabic a plain toLocaleString() prints 1,234,567 (also with undefined, and after applying the rule twice)");
    eq(/^[0-9‏\/]+$/.test(o.dayAfter.replace(/‏/g, "")), true, "digit rule: a plain toLocaleDateString() prints 0-9 as well (" + o.dayAfter + ")");
    eq(o.opts, "1,234.50", "digit rule: options still apply (two decimals)");
    eq([o.explicitEn, /[٠-٩]/.test(o.explicitArSA)], ["1,234,567", true], "digit rule: a call that names its own locale is left alone");
    eq([o.off, o.restored, o.afterOff === o.before], [false, true, true], "digit rule: another language puts the engine's own functions back (identical, not a copy)");
    eq([o.hiUntouched, o.thUntouched], [true, true], "digit rule: Hindi and Thai never replace anything (Hindi digits stay what the device prints: Latin)");
  }
}

// ── (b)/(c) the model-language mapping, song-analysis, retention ──
{
  eq([M.modelLang("th"), M.modelLang("en"), M.modelLang("zh"), M.modelLang(undefined)], ["th", "en", "zh", undefined], "modelLang leaves th / en / zh (and nothing) alone");
  eq(M.EXTRA_LANGS.map(M.modelLang), M.EXTRA_LANGS.map(() => "en"), "modelLang reads every extra language as English (the model's own tables are th / en / zh and fell back to Thai)");
  const sites = { "use-practice-mode.ts": /\{ lang: modelLang\(lang\) \}/, "PracticeOverlay.tsx": /choice, modelLang\(lang\)\)/, "use-practice-coach.ts": /lang: modelLang\(lang\) \}\)/, "use-chat.ts": /kbFallbackFor\(q, modelLang\(lang\)\)/ };
  eq(Object.entries(sites).filter(([f, re]) => !re.test(rd(f))).map(([f]) => f), [], "every call that hands the app language to the TIGA model goes through modelLang()");
  const sa = code("song-analysis.ts");
  eq(/const L3 = lang === "th" \|\| lang === "zh" \? lang : "en";/.test(sa) && /by\(buildSys\(stratLine\), lang\)/.test(sa) && /by\(buildMsg\(stratLine\), lang\)/.test(sa) && !/xl\(lang, "en"\)/.test(sa), true, "song-analysis.ts: the model language is a code (never the catalog's word for 'en', which Spanish translated as 'es'), and the prompts are read through by()");
  // retention.pickLang: cut out and run
  const rt = rd("retention.ts"), pm = /export function pickLang[\s\S]*?\n\}/.exec(rt);
  const R = await evalTs(pm ? pm[0] : "", ["pickLang"]);
  M.setCatalog("es", { "Start": "Inicio" });
  const o = { th: "ก", en: "Start", zh: "开" };
  eq([R.pickLang(o, "th"), R.pickLang(o, "zh"), R.pickLang(o, "en"), R.pickLang(o, "ja"), R.pickLang(o, "es")], ["ก", "开", "Start", "Start", "Start"], "pickLang without a translator is what it always was");
  eq([R.pickLang(o, "th", s => M.xl("th", s)), R.pickLang(o, "en", s => M.xl("en", s)), R.pickLang(o, "es", s => M.xl("es", s)), R.pickLang({ th: "ก" }, "es", s => M.xl("es", s))], ["ก", "Start", "Inicio", "ก"], "pickLang with xl: th / en unchanged, an extra language reads its catalog, a missing English falls to Thai");
}

// ── (i) things in the code that must stay true for Arabic and for the pickers ──
{
  eq(["App.tsx", "LanguageSettings.tsx", "app-shell.tsx", "BlogPage.tsx"].filter(f => !/ALL_LANGS/.test(rd(f))), [], "every language picker is built from ALL_LANGS (ten rows), none from a hand-written list");
  eq(/ALL_LANGS\.includes\(p\)/.test(rd("app-shell.tsx")) && /useCatalog\(lg\)/.test(rd("app-shell.tsx")), true, "app-shell.tsx: the login card honours any of the ten languages the learner chose and loads its catalog");
  const lc = rd("app-css.ts"), mark = lc.lastIndexOf("RIGHT-TO-LEFT: Arabic");
  const after = lc.slice(mark).split("\n").slice(1).filter(ln => ln.length && !/^\s/.test(ln) && !/^(html\[dir="rtl"\]|\/\*|\)\{|`;)/.test(ln));
  eq([mark > 0, after], [true, []], "app-css.ts: the right-to-left block is the last thing in the stylesheet and holds only html[dir=\"rtl\"] rules");
  const pinned = /html\[dir="rtl"\] :is\(([\s\S]*?)\)\{direction:ltr;unicode-bidi:isolate\}/.exec(lc);
  eq(!!pinned && [".kr", ".staffwrap", ".songlanes", ".ah-piano", ".pvppage", "svg" ].every(c => pinned[1].includes(c) || lc.includes('html[dir="rtl"] :is(svg,canvas')), true, "app-css.ts: pianos, staves, note lanes and game screens are pinned direction:ltr under dir=rtl");
  const cream = rd("cream-styles.ts");
  eq([/:root:lang\(hi\)\{--f-app:"Noto Sans Devanagari"/.test(cream), /:root:lang\(ar\)\{--f-app:"Noto Naskh Arabic"/.test(cream), /\[lang="hi"\],\[lang="ar"\]\) \.tg \*\{letter-spacing:normal!important\}/.test(cream)], [true, true, true], "cream-styles.ts: Hindi and Arabic have a font stack of their own and no letter-spacing");
  eq(["landing-hi", "landing-es", "landing-fr", "landing-ar"].filter(n => !rd("scripts/check-hook-order.mjs").includes('"' + n + '"')), [], "check-hook-order.mjs: the four new landing folders are on its skip list");
  eq(/supportsRtl="true"/.test(rd("android/app/src/main/AndroidManifest.xml")), true, "android: supportsRtl is on");
  eq(/"lang": "en"/.test(rd("public/manifest.webmanifest")) && rd("public/manifest.webmanifest") === rd("manifest.webmanifest"), true, "manifest.webmanifest: one neutral manifest (lang en), the root copy equals public/");
}

// ── (j) the early screens (app-shell.tsx) in English and Chinese (round 3, 2026-11-16) ──
// en and zh read their own language there (they used to get the "Thai · English" pair); only th keeps it. Chinese comes from early-zh.ts, a table keyed by the English literal, so
// every English literal app-shell.tsx sends through xl() must have its Chinese, or a Chinese learner reads English where the table has a gap.
{
  const shell = rd("app-shell.tsx");
  eq([/const ownLang = \(lg: string\) => lg === "en" \|\| lg === "zh" \|\| isExtraLang\(lg\);/.test(shell), /const pair = \([^)]*\) => \(ownLang\(lg\) \? en : th \+ sep \+ en\);/.test(shell)], [true, true], "app-shell.tsx: en, zh and the extras read their own language, th keeps the pair");
  // deviceLang() (the language of a screen that has no profile yet): index.html ships <html lang="en"> before any language is known, so a bare "en" there must NOT count as the visitor's English
  // (a Thai first-time visitor would read the sign-up / crash screen in English only); only the hint PianoApp writes, or the profile, can say "English"
  const dl = /function deviceLang\(\): string \{[\s\S]*?\n\}/.exec(shell);
  const dlCode = dl ? esbuild.transformSync(dl[0], { loader: "ts" }).code : "";
  const dlRun = (hint, html) => new Function("localStorage", "document", "ALL_LANGS", dlCode + "\nreturn deviceLang();")({ getItem: () => { if (hint === "THROW") throw new Error("blocked"); return hint; } }, { documentElement: { getAttribute: () => html } }, M.ALL_LANGS);
  eq(dl ? [dlRun(null, "en"), dlRun(null, "th"), dlRun(null, "zh-CN"), dlRun(null, "ja"), dlRun("en", "en"), dlRun("ja", "en"), dlRun("THROW", "ko"), dlRun("THROW", "en"), dlRun("xx", "")] : null,
     ["", "th", "zh", "ja", "en", "ja", "ko", "", ""], "app-shell.tsx deviceLang(): the static <html lang=\"en\"> is not the visitor's English; the hint and any other app-set lang are");
  const zjs = esbuild.transformSync(rd("early-zh.ts"), { loader: "ts", format: "esm" }).code;
  const Z = await import("data:text/javascript;base64," + Buffer.from(zjs).toString("base64"));
  const lits = new Set();
  for (const m of shell.matchAll(/\bxl\((?:lg|lang), ("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)\)/g)) {
    let t = m[1];
    t = t[0] === "`" ? t.slice(1, -1).replace(/\$\{PDPA_VERSION\}/g, "{0}") : JSON.parse(t);
    if (/[A-Za-z]{2}/.test(t)) lits.add(t);   // the doc comments of app-shell.tsx write xl(lg, "...")
  }
  const missing = [...lits].filter(t => Z.default[t] === undefined);
  eq([lits.size > 80, missing], [true, []], "early-zh.ts has the Chinese of every English literal app-shell.tsx sends through xl() (" + lits.size + " literals)");
  const THAI = /[฀-๿]/, HAN = /[㐀-鿿]/;
  const bad = Object.entries(Z.default).filter(([k, v]) => THAI.test(v) || (/[A-Za-z]{3,}/.test(k) && !HAN.test(v)) || (k.match(/\[\[/g) || []).length !== (v.match(/\[\[/g) || []).length || (k.match(/\{\d\}/g) || []).join() !== (v.match(/\{\d\}/g) || []).join()).map(([k]) => k);
  eq(bad, [], "early-zh.ts: every value is Chinese, none is Thai, [[ ]] and {0} are kept");
  const ver = Z.zhEarly("By signing up you accept the [[Privacy Policy]] (version 2026-09-11)");
  eq([HAN.test(ver), ver.includes("2026-09-11"), (ver.match(/\[\[/g) || []).length], [true, true, 1], "zhEarly fills the privacy-policy version into the Chinese sentence");
  eq(Z.zhEarly("A sentence the table does not have"), "A sentence the table does not have", "zhEarly shows the English, never Thai, for a gap");
}

console.log(`${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
