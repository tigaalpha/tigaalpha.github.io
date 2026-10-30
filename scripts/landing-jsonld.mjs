/* ── scripts/landing-jsonld.mjs ──
   schema.org JSON-LD for marketing landing page 1, one block per language.
   landing/index.template.html carries the Thai block verbatim (vite leaves
   application/ld+json untouched); landing-locales.mjs swaps it for the
   en/zh block, so url + inLanguage always match the page they ship on.
   Facts only: no ratings or reviews. The public offer is one price:
   7 days of Premium free, then 799 THB per month, for everyone.
   The graphs live in scripts/seo/landing-{th,en,zh}.jsonld so the three
   pages cannot drift apart from the approved copy. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = { th: "landing-th.jsonld", en: "landing-en.jsonld", zh: "landing-zh.jsonld" };

export function landingJsonLd(lang) {
  const name = FILE[lang];
  if (!name) throw new Error(`landing-jsonld: unknown lang ${lang}`);
  const graph = JSON.parse(readFileSync(path.join(DIR, "seo", name), "utf8"));
  return `<script type="application/ld+json">${JSON.stringify(graph)}</script>`;
}
