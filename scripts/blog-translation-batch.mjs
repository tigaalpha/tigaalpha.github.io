#!/usr/bin/env node
/* blog-translation-batch.mjs <lang> <n> <outdir> — pick the next <n> English articles that have no translation file yet (order of gap.json), and write one input file per article to <outdir>/<slug>.en.json
   ({slug,title,excerpt,category,body}). Reads only the repo snapshot (data/blog-snapshot/en-bodies.json, data/blog-translation/gap.json): no database call. Prints the slugs, 5 per line group. */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), D = path.join(ROOT, "data/blog-translation");
const [lang, n, out] = [process.argv[2], Number(process.argv[3] || 25), process.argv[4]];
if (!lang || !out) { console.error("usage: blog-translation-batch.mjs <lang> <n> <outdir>"); process.exit(2); }
const gap = JSON.parse(fs.readFileSync(path.join(D, "gap.json"), "utf8")).missing[lang] || [];
const bodies = JSON.parse(fs.readFileSync(path.join(ROOT, "data/blog-snapshot/en-bodies.json"), "utf8"));
const ix = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, "data/blog-snapshot/index.json"), "utf8")).filter((r) => r.lang === "en").map((r) => [r.slug, r]));
const have = (s) => fs.existsSync(path.join(D, lang, s + ".json"));
const skip = new Set(fs.existsSync(path.join(D, "skip-" + lang + ".json")) ? JSON.parse(fs.readFileSync(path.join(D, "skip-" + lang + ".json"), "utf8")) : []);
fs.mkdirSync(out, { recursive: true });
const picked = [];
if (process.env.SRC === "nonen") {
  // topics whose source is NOT English: bodies come from data/blog-snapshot/src-bodies/<srclang>.json (fetched by the blog-source-bodies Action); target slug = topic stem
  const tl = path.join(process.env.TMPDIR || "/tmp", "topics-full.json");
  execFileSync("node", [path.join(ROOT, "scripts/blog-topic-map.mjs")], { env: { ...process.env, TOPIC_LIST: tl, TOPIC_NO_SUMMARY: "1" }, stdio: "ignore" });
  const miss = JSON.parse(fs.readFileSync(tl, "utf8")).missing[lang] || [], stores = {};
  for (const m of miss) {
    if (picked.length >= n) break; if (m.src_lang === "en" || skip.has(m.stem) || have(m.stem)) continue;
    const st = (stores[m.src_lang] = stores[m.src_lang] || (fs.existsSync(path.join(ROOT, "data/blog-snapshot/src-bodies", m.src_lang + ".json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "data/blog-snapshot/src-bodies", m.src_lang + ".json"), "utf8")) : {}));
    const b = st[m.src_slug]; if (!b) continue;
    fs.writeFileSync(path.join(out, m.stem + ".en.json"), JSON.stringify({ slug: m.stem, source_lang: m.src_lang, source_slug: m.src_slug, title: b.title, excerpt: b.excerpt || "", category: m.category, body: b.body }, null, 1)); picked.push(m.stem);
  }
  console.log(picked.join("\n")); console.error(`${picked.length} picked from non-English sources`); process.exit(0);
}
for (const g of gap) { if (picked.length >= n) break; if (have(g.slug) || skip.has(g.slug) || !bodies[g.slug]) continue; const e = ix.get(g.slug) || {}; fs.writeFileSync(path.join(out, g.slug + ".en.json"), JSON.stringify({ slug: g.slug, title: e.title || g.title, excerpt: e.excerpt || "", category: g.category, body: bodies[g.slug].body }, null, 1)); picked.push(g.slug); }
console.log(picked.join("\n")); console.error(`${picked.length} picked; remaining untranslated after this: ${gap.filter((g) => !have(g.slug) && !skip.has(g.slug) && bodies[g.slug]).length - picked.length}`);
