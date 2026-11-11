// The runtime behind Japanese / Korean / Russian (lang-extra.ts): catalog lookups, {n} patterns, ordinals, by(), pickT, xl, the AI reply line.
//   node scripts/smoke-lang-extra.mjs
import fs from "node:fs";
import esbuild from "esbuild";

const js = esbuild.transformSync(fs.readFileSync("lang-extra.ts", "utf8"), { loader: "ts", format: "esm" }).code;
const M = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

let pass = 0; const fails = [];
const eq = (a, b, n) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (ok) pass++; else { fails.push(n); console.log(`FAIL ${n}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`); } };

eq(M.isExtraLang("ja") && M.isExtraLang("ko") && M.isExtraLang("ru"), true, "ja, ko, ru are extra languages");
eq(["th", "en", "zh", "", null, "xx"].some(M.isExtraLang), false, "th, en, zh and junk are not");
eq(M.ALL_LANGS, ["th", "en", "zh", "ja", "ko", "ru"], "six languages in picker order");
eq(M.localeOf("ja"), "ja-JP", "locale ja"); eq(M.localeOf("ko"), "ko-KR", "locale ko"); eq(M.localeOf("ru"), "ru-RU", "locale ru"); eq(M.localeOf("zh"), "zh-CN", "locale zh");
eq(M.dateLocale("en"), "en-GB", "English dates stay day-month-year"); eq(M.dateLocale("ja"), "ja-JP", "Japanese dates use ja-JP");
eq(M.LANG_META.ru.html, "ru", "html lang ru");

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

// the AI reply line
eq(M.replyInstruction("th"), "", "no extra line for th"); eq(M.replyInstruction("en"), "", "no extra line for en");
for (const [lg, nm] of [["ja", "Japanese"], ["ko", "Korean"], ["ru", "Russian"]]) eq(M.replyInstruction(lg).includes(nm), true, "reply line names " + nm);

console.log(`${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
