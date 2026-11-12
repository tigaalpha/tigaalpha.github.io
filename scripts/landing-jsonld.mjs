/* ── scripts/landing-jsonld.mjs ──
   schema.org JSON-LD for marketing landing page 1, one block per language.
   landing/index.template.html carries the Thai block verbatim (vite leaves
   application/ld+json untouched); landing-locales.mjs swaps it for the
   en/zh/ja/ko/ru block, so url + inLanguage always match the page they ship on.
   Facts only: no ratings or reviews. The public offer is one price:
   7 days free, then 799 THB per month, for everyone.
   The graphs live in scripts/seo/landing-{th,en,zh,ja,ko,ru}.jsonld so the six
   pages cannot drift apart from the approved copy. th / en / zh are the
   original approved graphs; ja / ko / ru (2026-11-11) are the same graph with
   the visible strings in their language, six languages listed wherever the
   app's languages are, and the offer named by its 7 days and its price only
   (no plan tier, the same rule the landing copy follows). */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = { th: "landing-th.jsonld", en: "landing-en.jsonld", zh: "landing-zh.jsonld", ja: "landing-ja.jsonld", ko: "landing-ko.jsonld", ru: "landing-ru.jsonld" };

export function landingJsonLd(lang) {
  const name = FILE[lang];
  if (!name) throw new Error(`landing-jsonld: unknown lang ${lang}`);
  const graph = JSON.parse(readFileSync(path.join(DIR, "seo", name), "utf8"));
  return `<script type="application/ld+json">${JSON.stringify(graph)}</script>`;
}
