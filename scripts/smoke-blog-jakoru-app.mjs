#!/usr/bin/env node
/* smoke-blog-jakoru-app.mjs — the IN-APP blog (BlogPage.tsx) in six languages (owner 2026-11-11: Japanese, Korean and Russian next to Thai, English and Mandarin).
   The real component is bundled with esbuild (supabase-client stubbed) and rendered in jsdom with React 18; no network. Run by scripts/smoke-blog-jakoru.mjs, or alone:
     node scripts/smoke-blog-jakoru-app.mjs */
import { build } from "esbuild"; import { JSDOM } from "jsdom"; import { pathToFileURL } from "node:url"; import path from "node:path"; import os from "node:os"; import fs from "node:fs";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bja-")); const out = path.join(dir, "t.mjs");
const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "https://x.test/", pretendToBeVisual: true });
for (const k of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent"]) { try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch (e) {} }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__posts = []; globalThis.__calls = [];
const stub = `
export const sb = {
  from() { const q = { select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; }, then(a, b) { return Promise.resolve({ data: globalThis.__posts, error: null }).then(a, b); } }; return q; },
  rpc(name, args) { globalThis.__calls.push({ name, ...args });
    if (name === "blog_view_counts") return Promise.resolve({ data: [{ slug: "piano-posture", views: 1500 }], error: null });
    if (name === "blog_hit") return Promise.resolve({ data: 1234, error: null });
    return Promise.resolve({ data: null, error: null }); }
};`;
await build({ stdin: { contents: `export { BlogPage, viewsText, fmtDate, minsText, catLabel, catName, readMins } from "./BlogPage"; export { createRoot } from "react-dom/client"; export { createElement as h } from "react"; export { act } from "react";`, resolveDir: process.cwd(), loader: "ts" },
  outfile: out, bundle: true, format: "esm", platform: "node", logLevel: "silent", jsx: "automatic",
  plugins: [{ name: "stub", setup(b) { b.onResolve({ filter: /supabase-client$/ }, () => ({ path: "sb-stub", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: stub, loader: "js" })); } }] });
const M = await import(pathToFileURL(out).href);
let fail = 0, n = 0; const ok = (name, c, d = "") => { n++; console.log((c ? "PASS " : "FAIL ") + name + (d ? " — " + d : "")); if (!c) fail++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function mount(el) { const host = document.createElement("div"); document.body.appendChild(host); const root = M.createRoot(host); await M.act(async () => { root.render(el); }); await M.act(async () => { await sleep(60); }); return { host, root }; }
const post = (lang, extra = {}) => ({ id: "p-" + lang, lang, slug: "piano-posture", category: "tips", title: "T-" + lang, excerpt: "x", body: "# Hi\nbody text", cover_url: null, published: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", ...extra });
const norm = (s) => String(s).replace(/[\s  ]+/g, " ");

console.log("helpers: the three old languages read exactly as before");
for (const lang of ["th", "en", "zh"]) {
  const oldViews = "👁 " + (1234).toLocaleString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-US") + " " + (lang === "th" ? "ยอดวิว" : lang === "zh" ? "次浏览" : "views");
  ok(lang + ": views text is the old text (" + oldViews + ")", M.viewsText(1234, lang) === oldViews);
  const oldDate = new Date("2026-10-01T00:00:00Z").toLocaleDateString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-GB", { year: "numeric", month: "short", day: "numeric" });
  ok(lang + ": date text is the old text (" + oldDate + ")", M.fmtDate("2026-10-01T00:00:00Z", lang) === oldDate);
  const oldMin = lang === "th" ? "3 นาที" : lang === "zh" ? "3 分钟" : "3 min";
  ok(lang + ": short read time is the old text", M.minsText(3, lang) === oldMin);
  ok(lang + ": long read time is the old text", M.minsText(3, lang, true) === (lang === "th" ? "3 นาที" : lang === "zh" ? "3 分钟" : "3 min read"));
}
ok("category names th / zh / en unchanged", M.catName("theory", "th") === "🎼 ทฤษฎีดนตรี" && M.catName("theory", "zh") === "🎼 乐理" && M.catName("theory", "en") === "🎼 Music theory");

console.log("helpers: ja / ko / ru");
ok("ja views: 1,234回閲覧 (no space before the unit)", M.viewsText(1234, "ja") === "👁 1,234回閲覧", M.viewsText(1234, "ja"));
ok("ko views: 1,234회 조회", M.viewsText(1234, "ko") === "👁 1,234회 조회", M.viewsText(1234, "ko"));
ok("ru views: 1 234 просмотров (Russian grouping)", norm(M.viewsText(1234, "ru")) === "👁 1 234 просмотров", M.viewsText(1234, "ru"));
ok("ja date is Japanese", /2026年10月1日/.test(M.fmtDate("2026-10-01T00:00:00Z", "ja")), M.fmtDate("2026-10-01T00:00:00Z", "ja"));
ok("ko date is Korean", /2026년 10월 1일/.test(M.fmtDate("2026-10-01T00:00:00Z", "ko")), M.fmtDate("2026-10-01T00:00:00Z", "ko"));
ok("ru date is Russian", /2026/.test(M.fmtDate("2026-10-01T00:00:00Z", "ru")) && /окт/.test(M.fmtDate("2026-10-01T00:00:00Z", "ru")), M.fmtDate("2026-10-01T00:00:00Z", "ru"));
ok("read time in ja / ko / ru", M.minsText(3, "ja") === "3分" && M.minsText(3, "ja", true) === "3分で読めます" && M.minsText(3, "ko") === "3분" && M.minsText(3, "ru") === "3 мин" && M.minsText(3, "ru", true) === "3 мин чтения");
ok("category names in ja / ko / ru", M.catName("tips", "ja") === "💡 練習のコツ" && M.catName("songs", "ko") === "🎵 곡과 연습곡" && M.catName("story", "ru") === "✨ Истории");
const jaText = "ピアノは毎日少しずつ練習するのが大切です。".repeat(60), ruText = "Занимайтесь каждый день понемногу. ".repeat(60);
ok("reading speed: kana / hangul count as characters (450 a minute), Cyrillic as Latin", M.readMins(jaText) === Math.round(jaText.length / 450) && M.readMins("한국어 글입니다. ".repeat(100)) === Math.round(("한국어 글입니다. ".repeat(100)).length / 450) && M.readMins(ruText) === Math.max(1, Math.round(ruText.length / 1100)));

console.log("the page: one flag button with a menu of six languages, the language follows the app, the link to the static pages");
globalThis.__posts = [];
for (const lang of ["ja", "ko", "ru"]) {
  const { host } = await mount(M.h(M.BlogPage, { lang }));
  const flagBtn = host.querySelector("[data-blog-langbtn]");
  ok(lang + ": ONE flag button (no row of tabs), the menu starts closed", !!flagBtn && host.querySelectorAll("[data-blog-langbtn]").length === 1 && !host.querySelector("[data-blog-langmenu]") && host.querySelectorAll("[data-blog-lang]").length === 0, flagBtn && flagBtn.textContent);
  const flagOf = { ja: "🇯🇵", ko: "🇰🇷", ru: "🇷🇺" }[lang];
  ok(lang + ": the button shows the flag of the app language", !!flagBtn && flagBtn.textContent.includes(flagOf) && !/日本語|한국어|Русский/.test(flagBtn.textContent), flagBtn && flagBtn.textContent);
  await M.act(async () => { flagBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await sleep(40); });
  const tabs = [...host.querySelectorAll("[data-blog-lang]")].map(b => b.getAttribute("data-blog-lang") + ":" + b.textContent);
  ok(lang + ": the menu lists six languages with flag and native name", tabs.length === 6 && tabs.some(t => t.startsWith("ja:") && t.includes("🇯🇵") && t.includes("日本語")) && tabs.some(t => t.startsWith("ko:") && t.includes("한국어")) && tabs.some(t => t.startsWith("ru:") && t.includes("Русский")) && tabs.some(t => t.startsWith("th:") && t.includes("ไทย")) && tabs.some(t => t.startsWith("en:") && t.includes("English")) && tabs.some(t => t.startsWith("zh:") && t.includes("中文")), tabs.join(" | "));
  const active = [...host.querySelectorAll("[data-blog-lang]")].find(b => b.getAttribute("aria-selected") === "true");
  ok(lang + ": the menu marks the app language as the current one", !!active && active.getAttribute("data-blog-lang") === lang, active && active.getAttribute("data-blog-lang"));
  await M.act(async () => { dom.window.document.body.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })); await sleep(40); });
  ok(lang + ": a tap outside closes the menu", !host.querySelector("[data-blog-langmenu]"));
  const link = host.querySelector(`[data-blog-static="${lang}"]`);
  ok(lang + ": with no database rows a card links to the static pages /blog/" + lang + "/", !!link && link.getAttribute("href") === `https://www.tigaalpha.com/blog/${lang}/` && link.getAttribute("target") === "_blank" && /rel="?noopener/.test(link.outerHTML) || (!!link && /noopener/.test(link.getAttribute("rel") || "")));
  ok(lang + ": ...and shows no English 'no articles' line", !/No English articles/.test(host.textContent));
}
{
  const { host } = await mount(M.h(M.BlogPage, { lang: "en" }));
  ok("en: opens on English and shows its own empty line, no static card", /No English articles yet/.test(host.textContent) && !host.querySelector("[data-blog-static]"));
  await M.act(async () => { host.querySelector("[data-blog-langbtn]").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await sleep(40); });
  await M.act(async () => { host.querySelector('[data-blog-lang="ru"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await sleep(60); });
  ok("en: choosing Russian in the menu shows the Russian link card and closes the menu", !!host.querySelector('[data-blog-static="ru"]') && !host.querySelector("[data-blog-langmenu]") && host.querySelector("[data-blog-langbtn]").textContent.includes("🇷🇺"));
}
{
  const { host } = await mount(M.h(M.BlogPage, { lang: "fr" }));
  ok("an app language the blog does not have falls back to the English tab", /No English articles yet/.test(host.textContent));
}

console.log("the page: rows from the database in ja / ko / ru");
for (const [lang, views, cat, minutes] of [["ja", "1,500回閲覧", "練習のコツ", "1分"], ["ko", "1,500회 조회", "연습 팁", "1분"], ["ru", "1 500 просмотров", "Советы по занятиям", "1 мин"]]) {
  globalThis.__posts = [post(lang)];
  const { host } = await mount(M.h(M.BlogPage, { lang }));
  const card = host.querySelector("[data-blog-card]");
  const t = card ? norm(card.textContent) : "";
  ok(lang + ": the article card shows title, category, read time and the view number", !!card && t.includes("T-" + lang) && t.includes(cat) && t.includes(minutes) && t.includes(views), t);
  ok(lang + ": the link card is still offered under the list (the database may hold only some of the articles)", !!host.querySelector(`[data-blog-static="${lang}"]`));
  await M.act(async () => { card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await sleep(80); });
  const meta = host.querySelector("[data-blog-post] div");
  const mt = norm(host.querySelector("[data-blog-post]").textContent);
  ok(lang + ": the open article shows the long read time and its view number beside the date", mt.includes({ ja: "1分で読めます", ko: "1분이면 읽어요", ru: "1 мин чтения" }[lang]) && mt.includes({ ja: "1,234回閲覧", ko: "1,234회 조회", ru: "1 234 просмотров" }[lang]), mt);
  ok(lang + ": the language button is hidden while an article is open", !host.querySelector("[data-blog-langs]") && !host.querySelector("[data-blog-static]"));
}
{
  globalThis.__calls.length = 0; globalThis.__posts = [post("ja")];
  await mount(M.h(M.BlogPage, { lang: "ja" }));
  ok("the view counts are asked for the tab's language (p_lang = ja)", globalThis.__calls.some(c => c.name === "blog_view_counts" && c.p_lang === "ja"));
}

console.log(fail ? `\nFAILED ${fail} / ${n}` : `\nall passed (${n})`); fs.rmSync(dir, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
