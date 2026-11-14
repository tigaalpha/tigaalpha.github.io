// The runtime behind the seven extra languages (lang-extra.ts): Japanese, Korean, Russian, then Hindi, Spanish, French and Arabic (2026-11-13).
// Catalog lookups, {n} patterns, ordinals (ja ko ru hi es fr ar), the plural-suffix hole, by(), pickT, xl, the AI reply line, the picker order (ten languages),
// the right-to-left flag, and a few STATIC checks of the app plumbing that need no browser and no dist/: the speech tables and detectSpeechLang (extracted from speech.ts
// and run for real), the piano-tts language codes, the :lang() / RTL rules in the stylesheets, the hook-order allowlist.
//   node scripts/smoke-lang-extra.mjs
// NOT checked here: anything in a browser or on a phone (scripts/smoke-lang-jakoru.mjs does that against dist/, after a build).
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
eq(M.localeOf("ar"), "ar", "locale ar is the neutral 'ar' (Western digits 0-9 in Intl, no country-specific numerals)");
eq(M.dateLocale("ar"), "ar", "Arabic dates use ar"); eq(M.dateLocale("hi"), "hi-IN", "Hindi dates use hi-IN");
eq(["hi", "es", "fr", "ar"].map(l => M.LANG_META[l].html), ["hi", "es", "fr", "ar"], "html lang hi es fr ar");
eq(new Intl.NumberFormat(M.localeOf("ar")).format(1234567), "1,234,567", "the Arabic locale prints Western digits (Node's ICU)");
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

console.log(`${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
