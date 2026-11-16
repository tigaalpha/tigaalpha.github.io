// Collects every English source string the app shows through the three-language idioms, so a new language can be added as ONE
// English-keyed catalog (i18n-<lang>.ts) instead of editing thousands of call sites.
//   node scripts/extract-i18n.mjs                 -> prints counts
//   node scripts/extract-i18n.mjs --out=FILE.json -> writes { strings: [{en, n, files:[...], dyn}] }
// Sources it reads (real parser, not a regex): T(th, en, zh) / T3(...) calls, { th: "..", en: "..", zh: ".." } objects,
// and the values of _L_RAW.en in i18n.ts. A template literal with ${..} is kept with the holes written as {0} {1} ...
// (the runtime matches the final string against those patterns). Admin-only screens (Thai-only by design) are skipped.
// Script-class detector (2026-11-16, round 2): whatever the container, three consecutive string slots whose first has Thai script,
// whose second is Latin text (an English label or sentence, not a code or a path) and whose third has Han script are one trilingual unit
// and the middle one is the English source string: positional helpers with two triples (sk("passive", "chip", th, en, zh, dth, den, dzh)),
// [th, en, zh] arrays (also nested in objects and arrays of arrays), sibling properties ({ dth, den, dzh }, { items, itemsEn, itemsZh }) and
// JSX attributes. Files that never say `zh` or `T(` (ra-data.ts) are still parsed when they hold both Thai and Han text.
// Output entries found only by it carry the file tag "<file>#triple".
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SKIP = /^(Admin|Tigamodel|tigamodel|bos|studio|dist|node_modules|bundle|landing\/bundle|songs-src|supabase|server|updates|android|public)/;
const CALLEES = new Set(["T", "T3", "HT", "T2"]);
// property names whose string values are identifiers, colours, glyphs or routes: not display text (same list as NOTRANS in lang-extra.ts)
const NOTRANS = /^(id|ids|key|keys|kind|type|color|colour|bg|fg|border|icon|emoji|glyph|group|topic|skill|mode|step|route|page|src|href|url|slug|code|cat|feature|action|tag|cls|className|font|sound|voice|stage|target|nav|tab|view|lang|locale|unit|ref|name_en)$/i;

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
    // "text " + EXPR + " text": the expression becomes a {n} hole, matched at run time like a template literal
    const parts = [];
    const flat = n => { if (n.type === "BinaryExpression" && n.operator === "+") { flat(n.left); flat(n.right); } else parts.push(n); };
    flat(node);
    if (parts.some(p => strOf(p) === null && p.type !== "StringLiteral") && parts.some(p => p.type === "StringLiteral" || p.type === "TemplateLiteral")) {
      let i = 0, s = "";
      for (const p of parts) { const v = strOf(p); if (v && !v.dyn) s += v.s; else if (v) s += v.s.replace(/\{\d+\}/g, () => "{" + i++ + "}"); else s += "{" + i++ + "}"; }
      const fixed = s.replace(/\{\d+\}/g, "").replace(/[^\p{L}]/gu, "");
      if (i > 0 && fixed.length >= 6 && /[A-Za-z]{3,}/.test(fixed)) return { s, dyn: true };
    }
  }
  return null;
}

// Script classes for the trilingual-unit detector: "th" = has Thai script (a Thai sentence with an English term in it is still the Thai member),
// "zh" = has Han script (punctuation-only text and Kana do not count), "en" = Latin letters and neither of the two, and not a code.
const THAI = /[\u0E00-\u0E7F]/, HAN = /[\u3400-\u9FFF]/, LATIN = /[A-Za-z]/;
const CODE_LIKE = /^(#[0-9a-fA-F]{3,8}|rgba?\(|https?:|\/|\.\.?\/)|^[a-z][a-z0-9]*(_[a-z0-9]+)+$|\.(js|mjs|ts|tsx|css|json|png|svg|jpe?g|webp|gif|mp3|wav|html)$/i;
const isCode = x => CODE_LIKE.test(x) || /^[a-z]+([A-Z][a-z0-9]*)+$/.test(x);   // a colour, a url or path, a file name, snake_case or camelCase: an identifier, not display text
function scriptOf(node) {
  const v = strOf(node);
  if (!v) return null;   // not a string literal (an empty placeholder "" is a string, but has no script and falls through to null below)
  const th = THAI.test(v.s), zh = HAN.test(v.s);
  if (th && !zh) return "th";
  if (zh && !th) return "zh";
  if (!th && !zh && LATIN.test(v.s) && !isCode(v.s.trim())) return "en";
  return null;
}
const keyOf = p => (p.key && (p.key.type === "Identifier" ? p.key.name : p.key.type === "StringLiteral" ? p.key.value : null));
// the literal text pieces of a "text " + x + " text" chain or of a `cond ? "a" : "b"`: strOf cannot read a Thai or Han line with a number in the middle (it keeps only text with 3+ Latin letters)
function pieces(node, out = []) {
  if (!node) return out;
  if (node.type === "StringLiteral") out.push(node.value);
  else if (node.type === "TemplateLiteral") node.quasis.forEach(q => out.push(q.value.cooked || ""));
  else if (node.type === "BinaryExpression" && node.operator === "+") { pieces(node.left, out); pieces(node.right, out); }
  else if (node.type === "ConditionalExpression") { pieces(node.consequent, out); pieces(node.alternate, out); }
  return out;
}
// scriptOf for the Thai and Han slots, which may be built from parts (t("<Thai> " + n + " <Thai>", "Shipped to Earth: " + n, "<Han>" + n)): any Thai (or Han) text in the chain counts
function scriptOfLoose(node) {
  const k = scriptOf(node);
  if (k || !node || (node.type !== "BinaryExpression" && node.type !== "ConditionalExpression")) return k;
  const ps = pieces(node), th = ps.some(x => THAI.test(x)), zh = ps.some(x => HAN.test(x));
  return th && !zh ? "th" : zh && !th ? "zh" : null;
}
// the English slot may be built from parts too, with a conditional in it: ("Unlocks at pet level " | "Unlocks at rank ") + n
function scriptOfEn(node) {
  const k = scriptOf(node);
  if (k || !node || (node.type !== "BinaryExpression" && node.type !== "ConditionalExpression")) return k;
  const ps = pieces(node);
  return ps.some(x => LATIN.test(x)) && !ps.some(x => THAI.test(x) || HAN.test(x)) ? "en" : null;
}
const hasCond = n => !!n && (n.type === "ConditionalExpression" || (n.type === "BinaryExpression" && n.operator === "+" && (hasCond(n.left) || hasCond(n.right))));
const HOLE = {};
function toks(node) {   // every text a concatenation / conditional can print, as arrays of string | HOLE (at most 8)
  if (!node) return [[HOLE]];
  if (node.type === "StringLiteral") return [[node.value]];
  if (node.type === "TemplateLiteral") { const t = []; node.quasis.forEach((q, i) => { t.push(q.value.cooked || ""); if (i < node.expressions.length) t.push(HOLE); }); return [t]; }
  if (node.type === "ConditionalExpression") return [...toks(node.consequent), ...toks(node.alternate)].slice(0, 8);
  if (node.type === "BinaryExpression" && node.operator === "+") { const out = []; for (const a of toks(node.left)) for (const b of toks(node.right)) out.push([...a, ...b]); return out.slice(0, 8); }
  return [[HOLE]];
}
// ("Unlocks at pet level " | "Unlocks at rank ") + n  ->  "Unlocks at pet level {0}" and "Unlocks at rank {0}" (strOf alone would write one string with a hole where the conditional is)
function variantsOf(node) {
  const out = [];
  for (const t of toks(node)) {
    let i = 0, s = "";
    for (const x of t) s += x === HOLE ? "{" + (i++) + "}" : x;
    const fixed = s.replace(/\{\d+\}/g, "").replace(/[^\p{L}]/gu, "");
    if (!THAI.test(s) && !HAN.test(s) && (i === 0 ? LATIN.test(s) : fixed.length >= 6 && /[A-Za-z]{3,}/.test(fixed))) out.push({ s, dyn: i > 0 });
  }
  return out;
}
// parallel constants: const TH = [...], EN = [...], ZH = [...] (and call arguments of that shape) are classified by their string leaves
const isAgg = n => !!n && (n.type === "ArrayExpression" || n.type === "ObjectExpression");
function leafNodes(n, key, out = []) {
  if (!n) return out;
  if (n.type === "ObjectExpression") { for (const q of n.properties) if (q.type === "ObjectProperty") leafNodes(q.value, keyOf(q), out); }
  else if (n.type === "ArrayExpression") { for (const el of n.elements) leafNodes(el, key, out); }
  else if (strOf(n)) out.push({ node: n, key });
  return out;
}
function aggKind(n) {
  const ls = leafNodes(n).map(l => strOf(l.node).s), th = ls.some(x => THAI.test(x)), zh = ls.some(x => HAN.test(x));
  if (th && !zh) return "th";
  if (zh && !th) return "zh";
  return !th && !zh && ls.some(x => LATIN.test(x)) ? "en" : null;
}
const LANG_TAG = /^(en|th|zh|ja|ko|ru|hi|es|fr|ar)([-_][A-Za-z]+)?$/;   // a language tag is a code, never text (the same list the xl branch below leaves out)
const GENERATED_CATALOG = /^i18n-[a-z]{2}\.ts$/;   // i18n-ja.ts ...: the translations themselves, never a source
const counted = new WeakSet();   // English nodes some detector already took (so the script-class pass does not count them twice)
const inertXl = [];   // file:line of every xl(lang, <object or array>) call: the English inside never reaches the catalog (reported below, not extracted)

const found = new Map(); // en -> { n, files:Set, dyn }
function add(en, file, dyn, node) {
  if (node) counted.add(node);
  if (!en || !/[A-Za-z]/.test(en)) return;
  const e = found.get(en) || { n: 0, files: new Set(), dyn: false };
  e.n++; e.files.add(file); e.dyn = e.dyn || dyn; found.set(en, e);
}

// Thai, Latin, Han in three consecutive slots of a call, array, object, JSX tag or declaration: the middle one is an English source string.
// Parallel constants (const TH = [..], EN = [..], ZH = [..]) and array arguments are classified by their string leaves; rows of a table are not
// (a language list is [["th", "<Thai name>"], ["en", "English"], ...] and its names stay in their own script).
function scanTriples(node, rel) {
  let slots = null;
  if (node.type === "CallExpression" || node.type === "NewExpression") slots = node.arguments;
  else if (node.type === "ArrayExpression") slots = node.elements;
  else if (node.type === "ObjectExpression") slots = node.properties.map(p => (p.type === "ObjectProperty" && !p.computed ? p.value : null));
  else if (node.type === "JSXOpeningElement") slots = node.attributes.map(a => (a.type === "JSXAttribute" ? (a.value && a.value.type === "JSXExpressionContainer" ? a.value.expression : a.value) : null));
  else if (node.type === "VariableDeclaration") slots = node.declarations.map(d => d.init);
  if (!slots) return;
  const allowAgg = node.type === "VariableDeclaration" || node.type === "CallExpression" || node.type === "NewExpression";
  const kind = (n, which) => (allowAgg && isAgg(n) ? aggKind(n) : which === "en" ? scriptOfEn(n) : scriptOfLoose(n));
  for (let i = 0; i + 2 < slots.length; i++) {
    const a = slots[i], e = slots[i + 1], c = slots[i + 2];
    if (!e || kind(a, "th") !== "th" || kind(e, "en") !== "en" || kind(c, "zh") !== "zh") continue;
    for (const l of (allowAgg && isAgg(e) ? leafNodes(e) : [{ node: e }])) {
      if (l.key && NOTRANS.test(l.key)) continue;
      const v = counted.has(l.node) ? null : strOf(l.node);
      if (v && LATIN.test(v.s) && !THAI.test(v.s) && !HAN.test(v.s) && !isCode(v.s.trim()) && !LANG_TAG.test(v.s)) add(v.s, rel + "#triple", v.dyn, l.node);
      // a conditional inside the English text (or text strOf cannot read): every variant is its own string
      if (!l.key && (hasCond(l.node) || (!v && !counted.has(l.node)))) for (const w of variantsOf(l.node)) if (!v || w.s !== v.s) add(w.s, rel + "#triple", w.dyn);
    }
  }
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
  const trilingual = !GENERATED_CATALOG.test(rel) && THAI.test(text) && HAN.test(text);   // the file may hold [th, en, zh] units without ever saying `zh` or `T(`
  if (!/\b(zh|T3?\()/.test(text) && !trilingual) continue;
  let ast;
  try { ast = parse(text, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: true }); } catch (e) { console.error("parse failed", rel, e.message); continue; }
  const visit = node => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && CALLEES.has(node.callee.name) && node.arguments.length >= 3) {
      const a = node.arguments;
      const enN = a.length >= 4 ? a[2] : a[1], en = strOf(enN);
      if (en) add(en.s, rel, en.dyn, enN);
    }
    // Local aliases of the three-language idiom (const t = (th, en, zh) => T3(lang, th, en, zh); const L = ...; tr(lang, th, en, zh); skill-tree's R(a, p, r, cd, th, en, zh) rows):
    // whatever the name, a call whose arguments are Thai text, English text and Han text (in that order, optionally after a lang / 4 numbers) carries one English source string.
    // (2026-11-16: ~300 such strings were never extracted, so they showed English in every extra language.)
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && !CALLEES.has(node.callee.name) && node.callee.name !== "xl") {
      const a = node.arguments;
      const th = n => { const v = n && strOf(n); return !!v && /[\u0E00-\u0E7F]/.test(v.s); }, han = n => { const v = n && strOf(n); return !!v && /[\u3400-\u9FFF]/.test(v.s); }, lat = n => { const v = n && strOf(n); return !!v && /[A-Za-z]/.test(v.s); };
      let enN = null;
      if (a.length === 3 && th(a[0]) && lat(a[1]) && han(a[2])) enN = a[1];
      else if (a.length === 4 && th(a[1]) && lat(a[2]) && han(a[3])) enN = a[2];
      else if (a.length === 7 && th(a[4]) && lat(a[5]) && han(a[6])) enN = a[5];
      const en = enN && strOf(enN);
      if (en) add(en.s, rel + "#alias", en.dyn, enN);
    }
    // xl(lang, <English>): the English branch of a hand-written `lang === "th" ? .. : lang === "zh" ? .. : <English>` ternary (scripts/codemod-lang.mjs)
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "xl" && node.arguments.length === 2) {
      // a ternary between two English strings (xl(lang, n === 1 ? "octave" : "octaves")) holds both
      const pickNodes = n => (n && n.type === "ConditionalExpression") ? [...pickNodes(n.consequent), ...pickNodes(n.alternate)] : (strOf(n) ? [n] : []);
      for (const n of pickNodes(node.arguments[1])) { const en = strOf(n); if (!/^(en|th|zh|ja|ko|ru|hi|es|fr|ar)([-_][A-Za-z]+)?$/.test(en.s)) add(en.s, rel, en.dyn, n); }   // a language tag ("en", "es-ES", "ar-SA") is a code, not text to translate: keep this list in step with ALL_LANGS in lang-extra.ts
      if (isAgg(node.arguments[1])) inertXl.push(rel + ":" + node.loc.start.line);   // xl only translates a STRING: handed an object or an array it returns the English object unchanged
    }
    // { th: {..}, en: {..}, zh: {..} } dictionaries (a whole table per language, read back as MAP[lang]): every string leaf of the English table
    if (node.type === "ObjectExpression") {
      let hasTh = false, hasZh = false, enNode = null;
      for (const p of node.properties) {
        if (p.type !== "ObjectProperty") continue;
        const k = keyOf(p);
        if (k === "th") hasTh = true; else if (k === "zh") hasZh = true; else if (k === "en") enNode = p.value;
      }
      if (hasTh && hasZh && enNode && (enNode.type === "ObjectExpression" || enNode.type === "ArrayExpression")) {
        const leaves = (n, key) => {
          if (!n) return;
          if (n.type === "ObjectExpression") for (const q of n.properties) { if (q.type === "ObjectProperty") leaves(q.value, keyOf(q)); }
          else if (n.type === "ArrayExpression") for (const el of n.elements) leaves(el, key);
          else {
            const v = strOf(n);
            if (v && v.s.length >= 2 && !(key && NOTRANS.test(key)) && !/^(#[0-9a-fA-F]{3,8}|rgba?\(|https?:|\/|[a-z]+_[a-z_]+$)/.test(v.s)) add(v.s, rel + "#table", v.dyn, n);
          }
        };
        leaves(enNode, undefined);
      }
    }
    if (node.type === "ObjectExpression") {
      let th = null, en = null, zh = null, enN = null;
      for (const p of node.properties) {
        if (p.type !== "ObjectProperty") continue;
        const k = keyOf(p);
        if (k === "en") { en = strOf(p.value); enN = p.value; } else if (k === "zh") zh = strOf(p.value); else if (k === "th") th = strOf(p.value);
      }
      if (en && zh && th) add(en.s, rel, en.dyn, enN);
    }
    if (rel === "i18n.ts" && node.type === "VariableDeclarator" && node.id.name === "_L_RAW" && node.init && node.init.type === "ObjectExpression") {
      for (const lp of node.init.properties) {
        if (lp.type !== "ObjectProperty" || keyOf(lp) !== "en" || lp.value.type !== "ObjectExpression") continue;
        for (const p of lp.value.properties) {
          if (p.type !== "ObjectProperty") continue;
          const v = strOf(p.value);
          if (v) add(v.s, "i18n.ts#L", v.dyn, p.value);
          else if (p.value.type === "ArrayExpression") for (const el of p.value.elements) { const q = strOf(el); if (q) add(q.s, "i18n.ts#L", q.dyn, el); }
        }
      }
    }
    // Script-class detector (last, so the idioms above win and nothing is counted twice)
    if (!GENERATED_CATALOG.test(rel)) scanTriples(node, rel);
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
if (inertXl.length) console.log(`inert xl(object | array) calls: ${inertXl.length} (xl only translates a string; split them into one xl(lang, "...") per line of text): ${inertXl.slice(0, 20).join(" ")}${inertXl.length > 20 ? " ..." : ""}`);
const out = (process.argv.find(a => a.startsWith("--out=")) || "").slice(6);
if (out) { fs.writeFileSync(out, JSON.stringify({ strings: list }, null, 1)); console.log("wrote", out); }
