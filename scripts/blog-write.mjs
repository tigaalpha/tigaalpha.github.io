#!/usr/bin/env node
// Write blog-src/<lang>/<slug>.json from a plain-text article, so translators never hand-escape JSON.
//   node scripts/blog-write.mjs <lang> <slug> <english-source.json> < article.txt
// article.txt (stdin):
//   TITLE: the translated title
//   EXCERPT: the translated excerpt (60-200 characters, no markdown)
//   ---BODY---
//   the translated markdown body (headings, bullets, **bold**, links and images exactly as the English has them)
// category comes from the English source; created_at is today's release date unless CREATED_AT is set.
import fs from "node:fs";
import path from "node:path";
const [, , lang, slug, enFile] = process.argv;
if (!lang || !slug || !enFile) { console.log("usage: node scripts/blog-write.mjs <lang> <slug> <english.json> < article.txt"); process.exit(2); }
const en = JSON.parse(fs.readFileSync(enFile, "utf8"));
const txt = fs.readFileSync(0, "utf8").replace(/\r\n/g, "\n");
const i = txt.indexOf("---BODY---");
if (i < 0) { console.log("FAIL no ---BODY--- line"); process.exit(1); }
const head = txt.slice(0, i), body = txt.slice(i + "---BODY---".length).replace(/^\n/, "").replace(/\s+$/, "");
const title = (/^TITLE:\s*(.+)$/m.exec(head) || [])[1], excerpt = (/^EXCERPT:\s*(.+)$/m.exec(head) || [])[1];
if (!title || !excerpt || !body) { console.log("FAIL missing TITLE, EXCERPT or body"); process.exit(1); }
const dir = path.join(path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."), "blog-src", lang);
fs.mkdirSync(dir, { recursive: true });
const obj = { lang, slug, category: en.category, title: title.trim(), excerpt: excerpt.trim(), body, created_at: process.env.CREATED_AT || "2026-11-13", published: true };
fs.writeFileSync(path.join(dir, slug + ".json"), JSON.stringify(obj, null, 2) + "\n");
console.log("wrote blog-src/" + lang + "/" + slug + ".json (" + body.length + " characters of body)");
