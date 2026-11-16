/* ── lang-extra.ts ──
   Japanese, Korean and Russian (owner, 2026-11-11), then Hindi, Spanish and French (owner, 2026-11-13). The app was written in three languages through inline idioms:
   T(th, en, zh), { th, en, zh } objects and `lang === "th" ? .. : lang === "zh" ? .. : <English>`. Instead of adding a
   fourth, fifth and sixth argument to thousands of call sites, a new language is ONE English-keyed catalog
   (i18n-ja.ts, i18n-ko.ts, i18n-ru.ts, i18n-hi.ts, i18n-es.ts, i18n-fr.ts: { "English text": "translation" }) and the English argument of every idiom is looked up in it.
   A string with no entry shows its English, so a new or untranslated string is never blank.
   - Keys written with {0} {1} holes stand for template literals (`${n} songs`): the final English string is matched against them.
   - Catalogs are lazy chunks (the React hook that reloads a root lives in use-catalog.ts), loaded when the language is chosen, so Thai, English and Chinese users download none of it.
   - This file imports nothing from the app (i18n.ts and every screen import it), so it can never take part in an import cycle. ── */

export type ExtraLang = "ja" | "ko" | "ru" | "hi" | "es" | "fr" | "ar";
export const EXTRA_LANGS: ExtraLang[] = ["ja", "ko", "ru", "hi", "es", "fr", "ar"];
export const ALL_LANGS = ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar"];
export const isExtraLang = (l: any): l is ExtraLang => l === "ja" || l === "ko" || l === "ru" || l === "hi" || l === "es" || l === "fr" || l === "ar";

/* one row per language: the flag and native name for pickers, the BCP-47 tag speech engines and date formatters want,
   the <html lang>, and the name the AI tutor is told to answer in */
export const LANG_META: Record<string, { flag: string; name: string; locale: string; html: string; ai: string; rtl?: boolean }> = {
  th: { flag: "🇹🇭", name: "ไทย", locale: "th-TH", html: "th", ai: "Thai" },
  en: { flag: "🇬🇧", name: "English", locale: "en-US", html: "en", ai: "English" },
  zh: { flag: "🇨🇳", name: "中文", locale: "zh-CN", html: "zh-CN", ai: "Chinese" },
  ja: { flag: "🇯🇵", name: "日本語", locale: "ja-JP", html: "ja", ai: "Japanese" },
  ko: { flag: "🇰🇷", name: "한국어", locale: "ko-KR", html: "ko", ai: "Korean" },
  ru: { flag: "🇷🇺", name: "Русский", locale: "ru-RU", html: "ru", ai: "Russian" },
  hi: { flag: "🇮🇳", name: "हिन्दी", locale: "hi-IN", html: "hi", ai: "Hindi" },
  es: { flag: "🇪🇸", name: "Español", locale: "es-ES", html: "es", ai: "Spanish" },
  fr: { flag: "🇫🇷", name: "Français", locale: "fr-FR", html: "fr", ai: "French" },
  ar: { flag: "🇸🇦", name: "العربية", locale: "ar", html: "ar", ai: "Arabic", rtl: true },   // locale "ar" (not ar-SA): Western digits 0-9 in Intl and a neutral Modern Standard Arabic voice
};
/* right-to-left languages: the page gets dir="rtl"; pianos, staffs, game canvases and anything drawn with fixed left/right geometry stay direction:ltr (see the RTL block in app-css.ts) */
export const isRtl = (lang: string) => !!(LANG_META[lang] && LANG_META[lang].rtl);
export const dirOf = (lang: string): "rtl" | "ltr" => (isRtl(lang) ? "rtl" : "ltr");
export const localeOf = (lang: string) => (LANG_META[lang] || LANG_META.en).locale;
/* day-month-year order for dates in English is the British one the app already used */
export const dateLocale = (lang: string) => (lang === "en" ? "en-GB" : localeOf(lang));
/* the English the chat and voice tutor prompts get for an extra language (their base prompt stays English) */
export const replyInstruction = (lang: string) => isExtraLang(lang)
  ? `\n\nIMPORTANT: The learner uses ${LANG_META[lang].ai}. Write every reply in natural ${LANG_META[lang].ai} (musical terms such as note names C D E and chord symbols stay as written). Do not answer in English or Thai unless the learner writes in it.`
  : "";

type Cat = Record<string, string>;
type Pat = { re: RegExp; holes: number[]; to: string };
const cats: Record<string, Cat> = {};
const pats: Record<string, Pat[]> = {};
const memo: Record<string, Map<string, string>> = {};
const inflight: Record<string, Promise<void> | undefined> = {};
const subs = new Set<() => void>();
let ver = 0;
export const catalogVersion = () => ver;
export const hasCatalog = (lang: string) => !!cats[lang];

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function setCatalog(lang: string, cat: Cat) {
  cats[lang] = cat || {};
  const list: Pat[] = [];
  for (const key of Object.keys(cats[lang])) {
    if (!/\{\d+\}/.test(key)) continue;
    const fixed = key.replace(/\{\d+\}/g, "");
    if (fixed.replace(/[^\p{L}]/gu, "").length < 3) continue;   // a key that is mostly holes would match everything
    const holes: number[] = [];
    const src = escRe(key).replace(/\\\{(\d+)\\\}/g, (_m, n) => { holes.push(+n); return "([\\s\\S]*?)"; });
    list.push({ re: new RegExp("^" + src + "$"), holes, to: cats[lang][key] });
  }
  list.sort((a, b) => b.re.source.length - a.re.source.length);   // the most specific pattern first
  pats[lang] = list;
  memo[lang] = new Map();
  ver++;
  subs.forEach(f => { try { f(); } catch (e) {} });
}

/* what goes into a {n} hole: a value the code wrote in English that has a fixed local form (1st, 2nd, 3rd ... -> 1番目 / 1번째 / 1-й) */
function holeText(lang: string, v: string): string {
  const m = /^(\d+)(st|nd|rd|th)$/.exec(v);
  if (m) {
    const n = +m[1];
    if (lang === "ja") return m[1] + "番目";
    if (lang === "ko") return m[1] + "번째";
    if (lang === "hi") return n === 1 ? "पहला" : n === 2 ? "दूसरा" : n === 3 ? "तीसरा" : n === 4 ? "चौथा" : m[1] + "वाँ";
    if (lang === "ar") return n === 1 ? "الأول" : n === 2 ? "الثاني" : n === 3 ? "الثالث" : n === 4 ? "الرابع" : m[1];
    if (lang === "es") return m[1] + ".º";
    if (lang === "fr") return n === 1 ? "1er" : m[1] + "e";
    return m[1] + "-й";
  }
  if (v === "s" || v === "es") return "";   // the English plural suffix: these languages have no such ending, and their translation puts the hole where it would have been
  return v;
}

/* the English text -> the text in `lang`, or the English itself when the catalog has no entry */
export function xlate(lang: string, en: string): string {
  if (typeof en !== "string" || !isExtraLang(lang)) return en;
  const cat = cats[lang];
  if (!cat) return en;
  const hit = cat[en];
  if (hit !== undefined) return hit;
  let m = memo[lang];
  if (!m) m = memo[lang] = new Map();
  const seen = m.get(en);
  if (seen !== undefined) return seen;
  let out = en;
  const list = pats[lang] || [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i], r = p.re.exec(en);
    if (!r) continue;
    const byHole: Record<number, string> = {};
    p.holes.forEach((h, j) => { byHole[h] = holeText(lang, r[j + 1]); });
    out = p.to.replace(/\{(\d+)\}/g, (_x, n) => (byHole[+n] !== undefined ? byHole[+n] : "{" + n + "}"));
    break;
  }
  if (m.size > 4000) m.clear();
  m.set(en, out);
  return out;
}

/* T(th, en, zh) for any language */
export const pickT = (lang: string, th: any, en: any, zh: any) =>
  lang === "th" ? th : lang === "zh" ? zh : isExtraLang(lang) ? xlate(lang, en) : en;
/* the English branch of a hand-written `lang === "th" ? .. : lang === "zh" ? .. : <English>` ternary */
export const xl = (lang: string, en: any) => (typeof en === "string" && isExtraLang(lang) ? xlate(lang, en) : en);

/* A value in a { th, en, zh } map for `lang`: its own entry when it has one, else the catalog's translation of the English entry
   (a string, an array of strings or an object of strings, to any depth), else the English entry. Replaces `map[lang]`, which was
   undefined for a language the map does not list and threw on the first property read. */
const deepMemo: Record<string, WeakMap<object, { v: number; o: any }>> = {};
/* property names whose string values are identifiers, colours, glyphs or routes, never display text: a table's { id: "foundation" } must stay "foundation"
   (keep in step with NOTRANS in scripts/extract-i18n.mjs, which leaves the same values out of the catalog) */
const NOTRANS = /^(id|ids|key|keys|kind|type|color|colour|bg|fg|border|icon|emoji|glyph|group|topic|skill|mode|step|route|page|src|href|url|slug|code|cat|feature|action|tag|cls|className|font|sound|voice|stage|target|nav|tab|view|lang|locale|unit|ref|name_en)$/i;
function xdeep(lang: string, v: any, key?: string): any {
  if (typeof v === "string") return key && NOTRANS.test(key) ? v : xlate(lang, v);
  if (!v || typeof v !== "object") return v;
  let wm = deepMemo[lang];
  if (!wm) wm = deepMemo[lang] = new WeakMap();
  const hit = wm.get(v);
  if (hit && hit.v === ver) return hit.o;
  let out: any;
  if (Array.isArray(v)) out = v.map(x => xdeep(lang, x, key));
  else if (Object.getPrototypeOf(v) === Object.prototype) { out = {}; for (const k of Object.keys(v)) out[k] = xdeep(lang, v[k], k); }
  else return v;   // React elements, class instances, functions inside: untouched
  wm.set(v, { v: ver, o: out });
  return out;
}
export function by(map: any, lang: string): any {
  if (!map || typeof map !== "object") return map;
  const own = map[lang];
  if (own !== undefined) return own;
  if (isExtraLang(lang)) return map.en !== undefined ? xdeep(lang, map.en) : map.th;
  return map.en !== undefined ? map.en : map.th;
}

const loaders: Record<string, () => Promise<{ default: Cat }>> = {
  ja: () => import("./i18n-ja"),
  ko: () => import("./i18n-ko"),
  ru: () => import("./i18n-ru"),
  hi: () => import("./i18n-hi"),
  es: () => import("./i18n-es"),
  fr: () => import("./i18n-fr"),
  ar: () => import("./i18n-ar"),
};
export function loadCatalog(lang: string): Promise<void> {
  if (!isExtraLang(lang) || cats[lang]) return Promise.resolve();
  return inflight[lang] || (inflight[lang] = loaders[lang]().then(m => { setCatalog(lang, m.default); }, () => { inflight[lang] = undefined; }));
}
export function subscribeCatalog(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
