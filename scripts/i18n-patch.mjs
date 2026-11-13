#!/usr/bin/env node
// Merge corrected strings into a translated batch file without rewriting the whole file.
//   node scripts/i18n-patch.mjs <out.json> <lang>      reads { "<k>": "text", ... } from stdin
// Used by translation agents that have a shell but no Edit tool: fix only the strings that fail the verifier.
import fs from "node:fs";
const [, , file, lang] = process.argv;
if (!file || !lang) { console.log("usage: node scripts/i18n-patch.mjs <out.json> <lang> < patch.json"); process.exit(2); }
let out = {};
try { out = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { /* new file */ }
let patch;
try { patch = JSON.parse(fs.readFileSync(0, "utf8")); } catch (e) { console.log("FAIL stdin is not valid JSON: " + e.message); process.exit(1); }
let n = 0;
for (const [k, t] of Object.entries(patch)) { if (typeof t !== "string") continue; (out[k] = out[k] || {})[lang] = t; n++; }
fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log("patched " + n + " strings in " + file);
