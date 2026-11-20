#!/usr/bin/env node
/* edge-deploy-copy.mjs — the copy of an edge function that is pasted into the Supabase connector's deploy call.
 *
 *   node scripts/edge-deploy-copy.mjs <function> [--out FILE]          write (or print) the deploy copy of supabase/functions/<function>/index.ts
 *   node scripts/edge-deploy-copy.mjs <function> --check LIVE_FILE     compare a decoded copy of the LIVE source with the deploy copy, exactly or (failing that) modulo the connector's own normalisation, see below; exit 1 on the first real difference
 *
 * Why: a deploy through the connector is a RE-TYPED copy (2026-11-17: a Korean 딱 became 딸, the no-break spaces before the French colons became plain spaces; both were only found by
 * reading the live source back). So the deployed copy is made small and boring on purpose: esbuild strips the types and drops every comment (the repo file keeps the full comments), and every
 * no-break / zero-width / look-alike space is spelled as an escape (a plain-ASCII " ", the same string at run time), so nothing that a person or a model cannot see can differ between
 * what was meant and what is live. The source of truth stays supabase/functions/<function>/index.ts; this copy is derived from it. The same step ran for the German release (2026-11-20).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const esbuild = require("esbuild");

const args = process.argv.slice(2);
const fn = args.find(a => !a.startsWith("--"));
const opt = n => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };
if (!fn) { console.error("usage: edge-deploy-copy.mjs <function> [--out FILE | --check LIVE_FILE]"); process.exit(2); }
const SRC = path.join(ROOT, "supabase", "functions", fn, "index.ts");
if (!fs.existsSync(SRC)) { console.error("no such function: " + SRC); process.exit(2); }

/* characters a reader cannot tell from a space (or cannot see): written as escapes in the deploy copy */
const INVISIBLE = new Map([
  [" ", "\\u00a0"], [" ", "\\u202f"], [" ", "\\u2007"], [" ", "\\u2009"], [" ", "\\u200a"], ["​", "\\u200b"], ["‌", "\\u200c"], ["‍", "\\u200d"],
  ["‎", "\\u200e"], ["‏", "\\u200f"], ["⁠", "\\u2060"], ["﻿", "\\ufeff"],
]);
export function deployCopy(src) {
  let out = esbuild.transformSync(src, { loader: "ts", charset: "utf8", legalComments: "none", target: "esnext" }).code;
  for (const [ch, esc] of INVISIBLE) out = out.split(ch).join(esc);
  return out;
}

const copy = deployCopy(fs.readFileSync(SRC, "utf8"));
const stray = [...copy].filter(ch => INVISIBLE.has(ch) || (ch.charCodeAt(0) < 32 && ch !== "\n" && ch !== "\t"));
if (stray.length) { console.error("the deploy copy still holds invisible characters: " + stray.map(c => "U+" + c.charCodeAt(0).toString(16)).join(" ")); process.exit(1); }

const check = opt("check");
if (check) {
  const live = fs.readFileSync(check, "utf8");
  if (live === copy) { console.log(`${fn}: the live source equals the deploy copy exactly (${copy.length} chars, ${Buffer.byteLength(copy)} bytes)`); process.exit(0); }
  /* The connector does not hand back exactly what was sent (found 2026-11-20): it stores a unicode escape as the character it spells (a no-break space inside a string, a Thai / CJK
     range inside a regex), which is the same string or regex at run time; and a copy of the live source that a person or a model re-typed cannot show a no-break space at all (it comes
     back as a plain space, although a transport test showed the tools themselves deliver U+00A0 intact). So when the exact comparison fails, compare again after decoding the escapes on
     both sides and folding the space-like characters to a plain space (the zero-width ones are dropped); a match there is reported as "modulo" and exits 0, and it says that exact
     equality is NOT shown. */
  const decode = t => t.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  const fold = t => { let o = decode(t); for (const ch of INVISIBLE.keys()) o = o.split(ch).join(/\s/.test(ch) ? " " : ""); return o; };
  const lf = fold(live), cf = fold(copy);
  if (lf === cf) { console.log(`${fn}: the live source equals the deploy copy modulo the connector's own normalisation (unicode escapes stored as the characters they spell; no-break spaces cannot be told from plain ones in a re-typed copy), ${copy.length} chars; exact equality is NOT shown`); process.exit(0); }
  const a = lf.split("\n"), b = cf.split("\n");
  let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  console.log(`${fn}: DIFFERENT (after folding). live ${lf.length} chars / ${a.length} lines, deploy copy ${cf.length} chars / ${b.length} lines; first difference at line ${i + 1}:`);
  console.log("  live  : " + JSON.stringify((a[i] || "").slice(0, 300)));
  console.log("  deploy: " + JSON.stringify((b[i] || "").slice(0, 300)));
  process.exit(1);
}
const out = opt("out");
if (out) { fs.writeFileSync(out, copy); console.log(`${fn}: wrote ${out} (${copy.length} chars, ${Buffer.byteLength(copy)} bytes, ${copy.split("\n").length} lines)`); }
else process.stdout.write(copy);
