#!/usr/bin/env node
/* check-undefined-names.mjs — fail the build when a source file READS a name it never declares or imports.

   There is no TypeScript check in this repo (see AGENTS.md), so a missing import compiles, bundles and ships:
   the first read of the name throws `ReferenceError` at run time, and when that read sits inside a
   `try { … } catch (e) {}` (most of this code base is written that way, on purpose) the error is swallowed and the
   feature is simply dead. Two real ones were found this way on 2026-11-17:
     • App.tsx called `adviceQuota()` (Auto Teaching free allowance) without importing it, so `autoTeachAllowed()`
       always caught the ReferenceError and answered "no" — free learners never got a tip, for a month;
     • use-camera-coach.ts called `visionObservationsFromWindow()` (it lives in the lazily loaded tigamodel) with no
       import at all, so the camera → teaching-loop bridge never ran.

   How: esbuild strips the types (a type name is not a value read), Babel parses the plain JS + JSX and its scope
   analysis lists every identifier that resolves to no binding (`Program` scope `globals`). Names the browser, JS
   or Deno provide, and the names vite injects with `define`, are known; everything else fails.
     node scripts/check-undefined-names.mjs          → exit 1 on a finding (npm run build runs this before vite)
     node scripts/check-undefined-names.mjs --list   → print every finding, never fail
   A name that is truly provided by the page (a script tag, a native bridge) belongs in EXTRA_GLOBALS below, with a
   comment saying who provides it. `@babel/parser`, `@babel/traverse` and `esbuild` come with vite and its React plugin;
   when they are not installed this script says so and exits 0 (it must never be the reason a build cannot start). */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const LIST_ONLY = process.argv.includes("--list");

let parse, traverse, esbuild, helperGlobals;
try {
  ({ parse } = require("@babel/parser"));
  traverse = require("@babel/traverse").default || require("@babel/traverse");
  esbuild = require("esbuild");
  const G = f => JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/@babel/helper-globals/data", f), "utf8"));
  helperGlobals = [...G("builtin-lower.json"), ...G("builtin-upper.json"), ...G("browser-upper.json")];
} catch (e) {
  console.log("check-undefined-names: SKIPPED — " + String(e && e.message).split("\n")[0] + " (needs @babel/parser, @babel/traverse, @babel/helper-globals and esbuild in node_modules)");
  process.exit(0);
}

/* Names that exist at run time without a declaration in the file. Keep this list SHORT and explained. */
const EXTRA_GLOBALS = [
  // the browser (the Babel lists carry the constructors, not these members of `window`)
  "window", "document", "navigator", "localStorage", "sessionStorage", "location", "history", "screen", "performance", "console",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame",
  "requestIdleCallback", "cancelIdleCallback", "fetch", "alert", "confirm", "prompt", "atob", "btoa", "structuredClone",
  "queueMicrotask", "crypto", "indexedDB", "caches", "self", "globalThis", "matchMedia", "getComputedStyle", "innerWidth",
  "innerHeight", "devicePixelRatio", "scrollTo", "scrollY", "scrollX", "open", "close", "print", "name", "event", "top", "parent",
  "opener", "createImageBitmap", "speechSynthesis", "origin", "isSecureContext",
  // Node / Deno (scripts bundled for tests, the edge functions)
  "process", "Buffer", "require", "module", "exports", "__dirname", "__filename", "Deno",
  // the page and the native shells
  "Capacitor", "gtag", "fbq", "dataLayer", "ttq",
  "React", "JSX",
];
const KNOWN = new Set([...helperGlobals, ...EXTRA_GLOBALS]);
// vite `define` (vite.config.ts / vite.landing.config.ts): __APP_BUILD__, __ART__ …
for (const f of ["vite.config.ts", "vite.landing.config.ts"]) {
  try { for (const m of fs.readFileSync(path.join(ROOT, f), "utf8").matchAll(/\b(__[A-Za-z0-9_]+__)\s*:/g)) KNOWN.add(m[1]); } catch (e) {}
}

/* what is scanned: the app (repo root and landing/) and the edge functions; not generated output or other apps */
const SKIP = /(^|\/)(node_modules|dist|dist-landing|bundle|android|ios|studio|bos|backups|updates|blog|blog-src|blog-data|\.git|public|assets|scripts|docs|server|api|app|type|songs|songs-src|store-assets|i18n-src|tigamodel)(\/|$)/;
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name), rel = path.relative(ROOT, p);
    if (e.isDirectory()) { if (!SKIP.test(rel + "/")) walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
  }
}
const files = []; walk(ROOT, files);

const findings = [];
let failed = 0;
for (const f of files.sort()) {
  const rel = path.relative(ROOT, f);
  let code;
  try { code = esbuild.transformSync(fs.readFileSync(f, "utf8"), { loader: f.endsWith(".tsx") ? "tsx" : "ts", jsx: "preserve", target: "esnext", logLevel: "silent" }).code; }
  catch (e) { failed++; console.log("check-undefined-names: cannot read " + rel + ": " + String(e && e.message).split("\n")[0]); continue; }
  let ast;
  try { ast = parse(code, { sourceType: "module", errorRecovery: true, plugins: ["jsx"] }); }
  catch (e) { failed++; console.log("check-undefined-names: cannot parse " + rel + ": " + String(e && e.message).split("\n")[0]); continue; }
  traverse(ast, {
    Program(p) {
      for (const [name, id] of Object.entries(p.scope.globals)) {
        if (!KNOWN.has(name)) findings.push({ rel, name, line: id && id.loc ? id.loc.start.line : 0 });
      }
    },
  });
}

if (LIST_ONLY) {
  for (const x of findings) console.log(`${x.rel}  ${x.name}  (line ${x.line} of the type-stripped file)`);
  console.log(`check-undefined-names: ${files.length} files, ${findings.length} undeclared name(s)`);
  process.exit(0);
}
if (findings.length || failed) {
  console.log(`check-undefined-names: FAILED — ${findings.length} name(s) are read but never declared or imported (a ReferenceError the first time that line runs):`);
  for (const x of findings) console.log(`  ${x.rel}: ${x.name}   (search the file for "${x.name}"; the line number below is in the type-stripped copy: ${x.line})`);
  console.log("Fix: import it, declare it, or — only when the page really provides it — add it to EXTRA_GLOBALS in scripts/check-undefined-names.mjs with a comment.");
  process.exit(1);
}
console.log(`check-undefined-names: OK — ${files.length} files, every name that is read is declared or imported`);
