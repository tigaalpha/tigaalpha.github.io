#!/usr/bin/env node
/* smoke-admin-blog-list.mjs — the admin blog list pages on the server and searches slug/title there.
   Editors used to receive one limit(300) over every language, so a language past that window could not be opened.
   The real AdminBlog is bundled (supabase stubbed) and driven in jsdom. No network.
     node scripts/smoke-admin-blog-list.mjs */
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "abl-"));
const out = path.join(dir, "t.mjs");
const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "https://x.test/", pretendToBeVisual: true });
for (const k of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent", "HTMLInputElement"]) {
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch (e) {}
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__qs = [];
globalThis.__counts = { th: 10, en: 12, zh: 8, ja: 80, ko: 3, ru: 4, hi: 1, es: 2, fr: 0, de: 0 };
const posts = [];
for (let i = 0; i < 80; i++) {
  posts.push({
    id: "ja-" + String(i).padStart(3, "0"), lang: "ja",
    slug: i === 0 ? "ja-old-000" : "ja-post-" + i,
    category: "tips", title: i === 0 ? "Oldest JA" : "JA " + i,
    excerpt: "", body: "body ".repeat(8), cover_url: null, published: true,
    created_at: new Date(Date.UTC(2024, 0, 1) + i * 86400000).toISOString(),
    updated_at: new Date(Date.UTC(2024, 0, 1) + i * 86400000).toISOString(),
  });
}
posts.push({
  id: "en-twin", lang: "en", slug: "ja-old-000", category: "tips", title: "EN twin of the old slug",
  excerpt: "", body: "body ".repeat(8), cover_url: null, published: true,
  created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z",
});
globalThis.__posts = posts;

const stub = `
export const sb = {
  from(table) {
    const calls = [];
    const q = {
      select(cols, opts) { calls.push({ m: "select", cols, opts: opts || null }); return q; },
      eq(k, v) { calls.push({ m: "eq", k, v }); return q; },
      order(k, opts) { calls.push({ m: "order", k, opts: opts || null }); return q; },
      or(s) { calls.push({ m: "or", s }); return q; },
      range(a, b) { calls.push({ m: "range", a, b }); return q; },
      limit(n) { calls.push({ m: "limit", n }); return q; },
      then(ok, bad) {
        const rec = { table, calls };
        globalThis.__qs.push(rec);
        return Promise.resolve(answer(rec)).then(ok, bad);
      },
    };
    return q;
  },
  rpc() { return Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function" } }); },
};
function answer(rec) {
  const head = rec.calls.some(c => c.m === "select" && c.opts && c.opts.head);
  const langEq = rec.calls.find(c => c.m === "eq" && c.k === "lang");
  if (head) {
    const lang = langEq ? langEq.v : "";
    return { data: null, error: null, count: Object.prototype.hasOwnProperty.call(globalThis.__counts, lang) ? globalThis.__counts[lang] : 0 };
  }
  let rows = globalThis.__posts.slice();
  rows.sort((a, b) => a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  if (langEq) rows = rows.filter(r => r.lang === langEq.v);
  const or = rec.calls.find(c => c.m === "or");
  if (or) {
    const m = /%([^%]+)%/.exec(or.s);
    const needle = (m ? m[1] : "").toLowerCase();
    rows = rows.filter(r => String(r.slug).toLowerCase().includes(needle) || String(r.title).toLowerCase().includes(needle));
  }
  const range = rec.calls.find(c => c.m === "range");
  const from = range ? range.a : 0;
  const to = range ? range.b : rows.length - 1;
  return { data: rows.slice(from, to + 1), error: null, count: rows.length };
}
`;

await build({
  stdin: { contents: `export { AdminBlog, blogSearchOr, BLOG_ADMIN_PAGE } from "./AdminBlog"; export { createRoot } from "react-dom/client"; export { createElement as h } from "react"; export { act } from "react";`, resolveDir: process.cwd(), loader: "ts" },
  outfile: out, bundle: true, format: "esm", platform: "node", logLevel: "silent", jsx: "automatic",
  plugins: [{ name: "stub", setup(b) { b.onResolve({ filter: /supabase-client$/ }, () => ({ path: "sb-stub", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: stub, loader: "js" })); } }],
});
const M = await import(pathToFileURL(out).href);
let fail = 0, n = 0;
const ok = (name, c, d = "") => { n++; console.log((c ? "PASS " : "FAIL ") + name + (d ? " — " + d : "")); if (!c) fail++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lists = () => globalThis.__qs.filter(q => q.table === "blog_posts" && q.calls.some(c => c.m === "range"));
const heads = () => globalThis.__qs.filter(q => q.table === "blog_posts" && q.calls.some(c => c.m === "select" && c.opts && c.opts.head));
const call = (rec, m) => rec.calls.find(c => c.m === m);

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = M.createRoot(host);
  await M.act(async () => { root.render(M.h(M.AdminBlog, { lang: "en" })); await sleep(40); });
  return host;
}
function setVal(el, v) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const src = fs.readFileSync(path.join(process.cwd(), "AdminBlog.tsx"), "utf8");
ok("the old limit(300) over every language is gone", !src.includes(".limit(300)") && !src.includes("limit(300)"));
ok("search filter matches slug and title, and is empty for a blank box", M.blogSearchOr("  ") === null && M.blogSearchOr("old-ja") === "slug.ilike.%old-ja%,title.ilike.%old-ja%");
ok("commas, dots and LIKE wildcards cannot break the or() grammar", M.blogSearchOr('a,b%_c(d).e:f"') === "slug.ilike.%a b c d e f%,title.ilike.%a b c d e f%");
ok("page size is 50", M.BLOG_ADMIN_PAGE === 50);

const host = await mount();
const first = lists()[0];
ok("the first page is a counted range of 50, not a hard limit", !!first && call(first, "range").a === 0 && call(first, "range").b === 49 && call(first, "select").opts && call(first, "select").opts.count === "exact" && !first.calls.some(c => c.m === "limit") && !call(first, "eq"), JSON.stringify(first && first.calls));
ok("rows are ordered newest first, with id as the tie-break", !!first && first.calls.filter(c => c.m === "order").map(c => c.k + ":" + c.opts.ascending).join(",") === "created_at:false,id:false");
const counted = heads().map(h => call(h, "eq") && call(h, "eq").v);
for (const l of ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar", "de"]) ok("head count for " + l, counted.includes(l));
const allChip = host.querySelector('[data-blog-filter="all"]');
const jaChip = host.querySelector('[data-blog-filter="ja"]');
ok("each language chip shows its server total, and All shows the sum", allChip && allChip.getAttribute("data-blog-n") === "120" && jaChip && jaChip.getAttribute("data-blog-n") === "80" && host.querySelector('[data-blog-filter="fr"]').getAttribute("data-blog-n") === "0", allChip && allChip.getAttribute("data-blog-n"));
ok("the first page shows 50 rows and offers a next page", host.querySelectorAll("[data-blog-row]").length === 50 && !host.querySelector("[data-blog-next]").disabled && host.querySelector("[data-blog-prev]").disabled);

await M.act(async () => { jaChip.dispatchEvent(new MouseEvent("click", { bubbles: true })); await sleep(40); });
const jaQ = lists().filter(q => call(q, "eq") && call(q, "eq").v === "ja" && !(call(q, "or")));
ok("choosing JA asks the server for that language only, page 0", jaQ.length >= 1 && call(jaQ[jaQ.length - 1], "range").a === 0 && call(jaQ[jaQ.length - 1], "range").b === 49);
ok("the JA page is only Japanese, and the search box says it is scoped to this language", [...host.querySelectorAll("[data-blog-row]")].every(r => r.textContent.includes("JA")) && /this language/i.test(host.querySelector("[data-blog-search]").getAttribute("placeholder")));
ok("JA still knows there are 80, so Next is on", host.querySelector("[data-blog-range]").textContent.includes("of 80") && !host.querySelector("[data-blog-next]").disabled);

const box = host.querySelector("[data-blog-search]");
const beforeType = lists().length;
await M.act(async () => { setVal(box, "j"); await sleep(40); setVal(box, "ja-OLD"); await sleep(40); });
ok("keystrokes inside the debounce do not query", lists().length === beforeType, String(lists().length - beforeType));
await M.act(async () => { await sleep(360); });
const searchQ = lists().filter(q => call(q, "or"));
ok("one debounced search, scoped to JA, on slug and title, back on page 0", searchQ.length === 1 && call(searchQ[0], "eq").v === "ja" && call(searchQ[0], "or").s === "slug.ilike.%ja-OLD%,title.ilike.%ja-OLD%" && call(searchQ[0], "range").a === 0, searchQ.map(q => call(q, "or") && call(q, "or").s).join(" | "));
const found = [...host.querySelectorAll("[data-blog-row]")];
ok("the old JA slug is found and the English twin with the same slug is not", found.length === 1 && found[0].getAttribute("data-blog-slug") === "ja-old-000" && found[0].textContent.includes("Oldest JA") && !found[0].textContent.includes("EN twin"));
ok("a one-row search has no next page", host.querySelector("[data-blog-next]").disabled && host.querySelector("[data-blog-range]").textContent.includes("of 1"));

await M.act(async () => { setVal(box, ""); await sleep(360); });
ok("clearing the search returns the first JA page", host.querySelector('[data-blog-slug="ja-post-79"]') && !host.querySelector('[data-blog-slug="ja-old-000"]'));
await M.act(async () => { host.querySelector("[data-blog-next]").dispatchEvent(new MouseEvent("click", { bubbles: true })); await sleep(40); });
const page2 = lists().filter(q => call(q, "eq") && call(q, "eq").v === "ja" && call(q, "range") && call(q, "range").a === 50);
ok("Next asks for rows 51–100 of JA", page2.length === 1 && call(page2[0], "range").b === 99 && !page2[0].calls.some(c => c.m === "or"));
ok("the post past the first 50 is on screen and the newest JA post is not", !!host.querySelector('[data-blog-slug="ja-old-000"]') && !host.querySelector('[data-blog-slug="ja-post-79"]') && host.querySelector("[data-blog-range]").textContent.includes("of 80"));
await M.act(async () => { host.querySelector('[data-blog-slug="ja-old-000"] button').dispatchEvent(new MouseEvent("click", { bubbles: true })); await sleep(30); });
const titles = [...host.querySelectorAll("input")].map(i => i.value);
ok("Edit opens that old post, not a newer one", titles.includes("Oldest JA") && titles.includes("ja-old-000"), titles.filter(Boolean).slice(0, 6).join(" | "));
for (const l of ["hi", "es", "fr", "ar", "de"]) ok("the editor can set the article language to " + l, !!host.querySelector(`[data-blog-setlang="${l}"]`));

console.log(fail ? `\nFAILED ${fail} / ${n}` : `\nall passed (${n})`);
fs.rmSync(dir, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
