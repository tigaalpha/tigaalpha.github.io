// One-off codemod (kept so the same run can be repeated on code added later):
//   node scripts/codemod-lang.mjs [--dry]
// 1. `lang === "th" ? A : lang === "zh" ? B : C`  ->  the English branch C is wrapped: xl(lang, C), so ja / ko / ru look it up in their catalog.
// 2. `MAP[lang]` (a { th, en, zh } object indexed by the language)  ->  by(MAP, lang), which falls back to the English entry (translated) instead of undefined.
// Both are the identity for th, en and zh. Source text is spliced, not reprinted, so nothing else in a file moves.
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DRY = process.argv.includes("--dry");
const SKIP_FILE = /^(Admin|Tigamodel|tigamodel|i18n-|lang-extra|use-catalog)/;
const LANGISH = /^(lang|lg|language|uiLang|langRef\.current|props\.lang|[A-Za-z]+\.lang)$/;
const EXCLUDE_OBJ = new Set(["L", "FLAGS", "FLAG_NAMES", "LANG_META", "TTS_LOCALES", "cats", "memo", "inflight", "pats", "loaders", "_extraL", "deepMemo", "subs"]);

const files = fs.readdirSync(ROOT).filter(f => /\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f) && !SKIP_FILE.test(f));

// One pass over a source text: returns the edits it found (ranges refer to `text`).
function findEdits(text) {
  let ast;
  try { ast = parse(text, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: true }); } catch (e) { return null; }
  const edits = [];
  const src = n => text.slice(n.start, n.end);
  const squash = n => src(n).replace(/\s+/g, "");
  const isLangTest = t => t && t.type === "BinaryExpression" && t.operator === "===" && /^(['"])(th|zh|en|ja|ko|ru)\1$/.test(src(t.right)) && LANGISH.test(squash(t.left));
  const isXl = n => n && n.type === "CallExpression" && n.callee.type === "Identifier" && n.callee.name === "xl";
  const claimed = new Set();
  const walk = (n, parent, key) => {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "ConditionalExpression" && !claimed.has(n) && isLangTest(n.test)) {
      const who = squash(n.test.left);
      const codes = []; let cur = n; let enBranch = null;
      while (cur.type === "ConditionalExpression" && isLangTest(cur.test) && squash(cur.test.left) === who) {
        claimed.add(cur);
        const code = src(cur.test.right).slice(1, -1);
        codes.push(code);
        if (code === "en") enBranch = cur.consequent;
        cur = cur.alternate;
      }
      const target = enBranch || (codes.includes("th") || codes.includes("zh") ? cur : null);
      if (target && !(enBranch == null && codes.includes("en")) && !isXl(target)) {
        edits.push({ start: target.start, end: target.end, text: `xl(${who}, ${src(target)})`, kind: "t" });
      }
    }
    if (n.type === "MemberExpression" && n.computed && n.property && LANGISH.test(squash(n.property)) && !(parent && ((parent.type === "AssignmentExpression" && key === "left") || parent.type === "UpdateExpression" || (parent.type === "UnaryExpression" && parent.operator === "delete") || parent.type === "AssignmentPattern"))) {
      const objText = src(n.object);
      if (!EXCLUDE_OBJ.has(objText) && n.object.type !== "ThisExpression" && !n.optional) {
        edits.push({ start: n.start, end: n.end, text: `by(${objText}, ${src(n.property)})`, kind: "m" });
      }
    }
    for (const k of Object.keys(n)) {
      if (k === "loc" || k === "start" || k === "end" || k === "leadingComments" || k === "trailingComments") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => walk(c, n, k)); else if (v && typeof v.type === "string") walk(v, n, k);
    }
  };
  walk(ast.program, null, "");
  return edits;
}

let totalT = 0, totalM = 0;
const report = [];
for (const f of files) {
  const orig = fs.readFileSync(path.join(ROOT, f), "utf8");
  if (!/\blang\b|\blg\b|\blanguage\b/.test(orig)) continue;
  let out = orig, nT = 0, nM = 0;
  for (let pass = 0; pass < 8; pass++) {
    const edits = findEdits(out);
    if (edits === null) { report.push("parse failed " + f); break; }
    if (!edits.length) break;
    // keep only edits that contain no other edit (the innermost ones); the outer ones are found again on the next pass
    const keep = edits.filter(e => !edits.some(o => o !== e && e.start <= o.start && o.end <= e.end));
    keep.sort((a, b) => b.start - a.start);
    for (const e of keep) { out = out.slice(0, e.start) + e.text + out.slice(e.end); if (e.kind === "t") nT++; else nM++; }
  }
  if (out === orig) continue;
  const need = [];
  if (/\bxl\(/.test(out) && !/import \{[^}]*\bxl\b[^}]*\} from "\.\/lang-extra"/.test(out)) need.push("xl");
  if (/\bby\(/.test(out) && !/import \{[^}]*\bby\b[^}]*\} from "\.\/lang-extra"/.test(out)) need.push("by");
  if (need.length) {
    const m = out.match(/import \{([^}]*)\} from "\.\/lang-extra";/);
    if (m) out = out.replace(m[0], `import {${m[1].replace(/\s+$/, "")}, ${need.join(", ")} } from "./lang-extra";`);
    else {
      const all = [...out.matchAll(/^import[^;]*;\s*$/gm)];
      const e = all.length ? all[all.length - 1].end : 0;
      out = out.slice(0, e) + `\nimport { ${need.join(", ")} } from "./lang-extra";` + out.slice(e);
    }
  }
  report.push(`${f}: ${nT} ternaries, ${nM} lookups`);
  totalT += nT; totalM += nM;
  if (!DRY) fs.writeFileSync(path.join(ROOT, f), out);
}
console.log(report.join("\n"));
console.log(`ternaries ${totalT}, lookups ${totalM}${DRY ? " (dry run)" : ""}`);
