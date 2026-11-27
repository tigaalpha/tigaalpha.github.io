#!/usr/bin/env node
/* blog-translation-finalize.mjs <lang> — put the STORED promo block (data/blog-translation/cta.json, a copy of public.blog_translation_cta) into every translation file of that language.
   The promo block of a translation = the paragraph in front of the last bullet list that holds the tigastudio.net link, plus that list. It is replaced by cta.paragraph + blank line + cta.bullets, so the
   database validator (blog_check_staged: cta_paragraph_missing / cta_links_missing) finds it verbatim. Idempotent. Files without such a block are reported and left alone. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), D = path.join(ROOT, "data/blog-translation");
const lang = process.argv[2]; const cta = JSON.parse(fs.readFileSync(path.join(D, "cta.json"), "utf8"))[lang];
if (!lang || !cta) { console.error("usage: blog-translation-finalize.mjs <lang> (needs a cta.json entry)"); process.exit(2); }
const dir = path.join(D, lang); let done = 0, kept = 0, bad = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const p = path.join(dir, f), t = JSON.parse(fs.readFileSync(p, "utf8"));
  if (t.body.includes(cta.paragraph) && t.body.includes(cta.bullets)) { kept++; continue; }
  const lines = t.body.split("\n"); let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (/^[-*] .*tigastudio\.net/.test(lines[i])) { end = i; break; }
  if (end < 0) { console.log("no promo block:", f); bad++; continue; }
  let s = end; while (s > 0 && /^[-*] /.test(lines[s - 1])) s--; let e = end; while (e + 1 < lines.length && /^[-*] /.test(lines[e + 1])) e++;
  let ps = s - 1; while (ps >= 0 && lines[ps].trim() === "") ps--;           // the paragraph before the list
  if (ps < 0) { console.log("no paragraph before the list:", f); bad++; continue; }
  let pb = ps; while (pb > 0 && lines[pb - 1].trim() !== "") pb--;
  t.body = [...lines.slice(0, pb), cta.paragraph, "", cta.bullets, ...lines.slice(e + 1)].join("\n");
  fs.writeFileSync(p, JSON.stringify(t, null, 1)); done++;
}
console.log(`${lang}: ${done} replaced, ${kept} already had it, ${bad} without a recognisable block`);
process.exit(bad ? 1 : 0);
