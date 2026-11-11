// Collects every English source string the app shows through the three-language idioms, so a new language can be added as ONE
// English-keyed catalog (i18n-<lang>.ts) instead of editing thousands of call sites.
//   node scripts/extract-i18n.mjs                 -> prints counts
//   node scripts/extract-i18n.mjs --out=FILE.json -> writes { strings: [{en, n, files:[...], dyn}] }
// Sources it reads (real parser, not a regex): T(th, en, zh) / T3(...) calls, { th: "..", en: "..", zh: ".." } objects,
// and the values of _L_RAW.en in i18n.ts. A template literal with ${..} is kept with the holes written as {0} {1} ...
// (the runtime matches the final string against those patterns). Admin-only screens (Thai-only by design) are skipped.
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SKIP = /^(Admin|Tigamodel|tigamodel|bos|studio|dist|node_modules|bundle|landing\/bundle|songs-src|supabase|server|updates|android|public)/;
const CALLEES = new Set(["T", "T3"]);

function strOf(node) {
  if (!node) return null;
  if (node.type === "StringLiteral") return { s: node.value, dyn: false };
  if (node.type === "TemplateLiteral") {
    let s = "";
    node.quasis.forEach((q, i) => { s += q.value.cooked; if (i < node.expressions.length) s += "{" + i + "}"; });
    return { s, dyn: node.expressions.length > 0 };
  }
  if (node.type === "ParenthesizedExpression") return strOf(node.expression);
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const a = strOf(node.left), b = strOf(node.right);
    if (a && b) return { s: a.s + b.s, dyn: a.dyn || b.dyn };
  }
  return null;
}

const found = new Map(); // en -> { n, files:Set, dyn }
function add(en, file, dyn) {
  if (!en || !/[A-Za-z]/.test(en)) return;
  const e = found.get(en) || { n: 0, files: new Set(), dyn: false };
  e.n++; e.files.add(file); e.dyn = e.dyn || dyn; found.set(en, e);
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(ROOT, path.join(dir, name.name));
    if (SKIP.test(rel) || SKIP.test(name.name)) continue;
    if (name.isDirectory()) walk(path.join(dir, name.name), out);
    else if (/\.(ts|tsx)$/.test(name.name) && !/\.d\.ts$/.test(name.name)) out.push(rel);
  }
  return out;
}

const files = walk(ROOT).filter(f => !f.includes("/") || f.startsWith("landing/"));
for (const rel of files) {
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  if (!/\b(zh|T3?\()/.test(text)) continue;
  let ast;
  try { ast = parse(text, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: true }); } catch (e) { console.error("parse failed", rel, e.message); continue; }
  const keyOf = p => (p.key && (p.key.type === "Identifier" ? p.key.name : p.key.type === "StringLiteral" ? p.key.value : null));
  const visit = node => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && CALLEES.has(node.callee.name) && node.arguments.length >= 3) {
      const a = node.arguments;
      const en = a.length >= 4 ? strOf(a[2]) : strOf(a[1]);
      if (en) add(en.s, rel, en.dyn);
    }
    // xl(lang, <English>): the English branch of a hand-written `lang === "th" ? .. : lang === "zh" ? .. : <English>` ternary (scripts/codemod-lang.mjs)
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "xl" && node.arguments.length === 2) {
      const en = strOf(node.arguments[1]);
      if (en && !/^(en|th|zh|ja|ko|ru)([-_][A-Za-z]+)?$/.test(en.s)) add(en.s, rel, en.dyn);
    }
    // { th: {..}, en: {..}, zh: {..} } dictionaries (a whole table per language, read back as MAP[lang]): every string leaf of the English table
    if (node.type === "ObjectExpression" && rel !== "i18n.ts") {
      let hasTh = false, hasZh = false, enNode = null;
      for (const p of node.properties) {
        if (p.type !== "ObjectProperty") continue;
        const k = keyOf(p);
        if (k === "th") hasTh = true; else if (k === "zh") hasZh = true; else if (k === "en") enNode = p.value;
      }
      if (hasTh && hasZh && enNode && (enNode.type === "ObjectExpression" || enNode.type === "ArrayExpression")) {
        const leaves = n => {
          if (!n) return;
          if (n.type === "ObjectExpression") for (const q of n.properties) { if (q.type === "ObjectProperty") leaves(q.value); }
          else if (n.type === "ArrayExpression") for (const el of n.elements) leaves(el);
          else { const v = strOf(n); if (v && v.s.length >= 2) add(v.s, rel + "#table", v.dyn); }
        };
        leaves(enNode);
      }
    }
    if (node.type === "ObjectExpression") {
      let th = null, en = null, zh = null;
      for (const p of node.properties) {
        if (p.type !== "ObjectProperty") continue;
        const k = keyOf(p);
        if (k === "en") en = strOf(p.value); else if (k === "zh") zh = strOf(p.value); else if (k === "th") th = strOf(p.value);
      }
      if (en && zh && th) add(en.s, rel, en.dyn);
    }
    if (rel === "i18n.ts" && node.type === "VariableDeclarator" && node.id.name === "_L_RAW" && node.init && node.init.type === "ObjectExpression") {
      for (const lp of node.init.properties) {
        if (lp.type !== "ObjectProperty" || keyOf(lp) !== "en" || lp.value.type !== "ObjectExpression") continue;
        for (const p of lp.value.properties) {
          if (p.type !== "ObjectProperty") continue;
          const v = strOf(p.value);
          if (v) add(v.s, "i18n.ts#L", v.dyn);
          else if (p.value.type === "ArrayExpression") for (const el of p.value.elements) { const q = strOf(el); if (q) add(q.s, "i18n.ts#L", q.dyn); }
        }
      }
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end" || k === "leadingComments" || k === "trailingComments") continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === "string") visit(v);
    }
  };
  visit(ast.program);
}

const list = [...found.entries()].map(([en, e]) => ({ en, n: e.n, files: [...e.files], dyn: e.dyn }));
list.sort((a, b) => b.n - a.n || a.en.localeCompare(b.en));
const total = list.reduce((s, x) => s + x.en.length, 0);
const longN = list.filter(x => x.en.length > 400).length;
console.log(`files scanned ${files.length}; unique English strings ${list.length}; with holes ${list.filter(x => x.dyn).length}; > 400 chars ${longN}; total chars ${total}`);
const byFile = {};
for (const x of list) for (const f of x.files) byFile[f] = (byFile[f] || 0) + 1;
console.log(Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([f, n]) => `${f}: ${n}`).join("\n"));
const out = (process.argv.find(a => a.startsWith("--out=")) || "").slice(6);
if (out) { fs.writeFileSync(out, JSON.stringify({ strings: list }, null, 1)); console.log("wrote", out); }
