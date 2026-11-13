#!/usr/bin/env node
/* smoke-blog-stats.mjs — the blog reader numbers inside the app (owner 2026-11-07): the in-app article shows its view count and counts one view per device, the list shows the number
   on every card, and the admin card (AdminBlogStats.tsx) shows views / 15-second readers / pop-ups / taps, a table per article, and says so plainly when the migration is missing.
   The real components are bundled with esbuild (supabase-client stubbed) and rendered in jsdom with React 18; no network.
     node scripts/smoke-blog-stats.mjs */
import { build } from "esbuild"; import { JSDOM } from "jsdom"; import { pathToFileURL } from "node:url"; import path from "node:path"; import os from "node:os"; import fs from "node:fs";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bs-")); const out = path.join(dir, "t.mjs");
const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "https://x.test/", pretendToBeVisual: true });
for (const k of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent"]) { try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch (e) {} }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const calls = []; globalThis.__calls = calls; globalThis.__mode = { stats: "ok", counts: [{ slug: "piano-posture", views: 1500 }], hit: 1234 };
const POSTS = [{ id: "1", lang: "en", slug: "piano-posture", category: "tips", title: "Piano posture", excerpt: "x", body: "# Hi\nbody text", cover_url: null, published: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" }];
const stub = `
export const sb = {
  from() { const q = { select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; }, then(a, b) { return Promise.resolve({ data: ${JSON.stringify(POSTS)}, error: null }).then(a, b); } }; return q; },
  rpc(name, args) { globalThis.__calls.push({ name, ...args }); const m = globalThis.__mode;
    if (name === "blog_view_counts") return Promise.resolve({ data: m.counts, error: null });
    if (name === "blog_hit") return Promise.resolve({ data: m.hit, error: null });
    if (name === "blog_stats") { if (m.stats === "missing") return Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function public.blog_stats in the schema cache" } });
      return Promise.resolve({ data: { totals: { views: 120, readers: 60, gates: 40, clicks: 10, devices: 90 }, rows: [{ lang: "th", slug: "a", title: "ท่านั่ง", views: 80, readers: 40, gates: 30, clicks: 8, total: 500 }, { lang: "en", slug: "b", title: "Posture", views: 40, readers: 20, gates: 10, clicks: 2, total: 90 }], daily: [{ day: "2026-11-05", views: 50, readers: 20 }, { day: "2026-11-06", views: 70, readers: 40 }], allTime: 590 }, error: null }); }
    return Promise.resolve({ data: null, error: null }); }
};`;
await build({ stdin: { contents: `export { BlogPage } from "./BlogPage"; export { BlogStatsCard } from "./AdminBlogStats"; export { createRoot } from "react-dom/client"; export { createElement as h } from "react"; export { act } from "react";`, resolveDir: process.cwd(), loader: "ts" },
  outfile: out, bundle: true, format: "esm", platform: "node", logLevel: "silent", jsx: "automatic",
  plugins: [{ name: "stub", setup(b) { b.onResolve({ filter: /supabase-client$/ }, () => ({ path: "sb-stub", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: stub, loader: "js" })); } }] });
const M = await import(pathToFileURL(out).href);
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function mount(el) { const host = document.createElement("div"); document.body.appendChild(host); const root = M.createRoot(host); await M.act(async () => { root.render(el); }); await M.act(async () => { await sleep(60); }); return { host, root }; }

// 1. the admin card
{
  const { host } = await mount(M.h(M.BlogStatsCard, { lang: "en", range: "30" }));
  const t = host.textContent;
  ok("admin card: views, readers, pop-ups and taps are shown", /Views/.test(t) && /120/.test(t) && /Read 5 s/.test(t) && /Pop-up shown/.test(t) && /Tapped sign-up/.test(t), t.slice(0, 120));
  ok("admin card: reader rate and tap rate are worked out (60 of 120 = 50%, 10 of 40 = 25%)", /50% of views/.test(t) && /25% of shown/.test(t));
  ok("admin card: one row per article with its all-time number", host.querySelectorAll("[data-blog-stats-table] tbody tr").length === 2 && /500/.test(t));
  ok("admin card: a bar per day", host.querySelectorAll("[data-blog-daily] > div").length === 2);
  ok("admin card asked for the right period", calls.some(c => c.name === "blog_stats" && c.p_days === 30));
  const th = await mount(M.h(M.BlogStatsCard, { lang: "th", range: "all" }));
  ok("admin card: Thai text and all-time = 0 days", /ผู้อ่านบล็อก/.test(th.host.textContent) && calls.some(c => c.name === "blog_stats" && c.p_days === 0));
}
{
  globalThis.__mode.stats = "missing";
  const { host } = await mount(M.h(M.BlogStatsCard, { lang: "en", range: "7" }));
  ok("admin card: a missing migration is said plainly, no zeros", !!host.querySelector("[data-blog-stats-missing]") && !/Views/.test(host.textContent));
  globalThis.__mode.stats = "ok";
}
// 2. the in-app list and article
{
  localStorage.clear();
  const { host } = await mount(M.h(M.BlogPage, { lang: "en" }));
  const card = host.querySelector("[data-blog-card]");
  ok("list: the card shows the article's view number", !!card && /1,500 views/.test(card.textContent), card && card.textContent.slice(-40));
  await M.act(async () => { card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await sleep(80); });
  const post = host.querySelector("[data-blog-post]");
  ok("article opens", !!post);
  const v = host.querySelector("[data-blog-post] [data-blog-views]");
  ok("article: the number of readers shows beside the date", !!v && /1,234 views/.test(v.textContent), v && v.textContent);
  const hit = calls.find(c => c.name === "blog_hit");
  ok("one view is sent with language, article and a device id", hit && hit.p_lang === "en" && hit.p_slug === "piano-posture" && /^[A-Za-z0-9_-]{8,64}$/.test(hit.p_vid) && hit.p_kind === "view");
  ok("the device id is kept in this browser", localStorage.getItem("tg_blog_vid") === hit.p_vid);
}
{
  globalThis.__mode.hit = -1; globalThis.__mode.counts = [];
  const { host } = await mount(M.h(M.BlogPage, { lang: "en" }));
  const card = host.querySelector("[data-blog-card]");
  await M.act(async () => { card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await sleep(80); });
  ok("a refused call (-1) or no counts shows no number", !host.querySelector("[data-blog-views]"));
}
console.log(fail ? "\nFAILED" : "\nall passed"); process.exit(fail ? 1 : 0);
