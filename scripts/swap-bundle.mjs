// Replaces bundle/ with the fresh build but keeps the hashed files of the last KEEP builds.
// Root cause of "Failed to fetch dynamically imported module .../adventure-cine-XXXX.js": every build wiped
// bundle/, so a tab or cached shell from before a deploy (the OTA bot deploys about hourly) 404'd on the
// first lazy chunk it had not loaded yet. An old file that is no longer referenced costs only disk.
import fs from "node:fs";
import path from "node:path";
const KEEP = 8, OLD = "bundle", NEW = "dist/bundle", MAN = path.join(OLD, ".carry.json");
const prev = fs.existsSync(OLD) ? fs.readdirSync(OLD).filter(f => !f.startsWith(".")) : [];
let carry = {};
try { carry = JSON.parse(fs.readFileSync(MAN, "utf8")); } catch { /* first run */ }
const tmp = "bundle.next";
fs.rmSync(tmp, { recursive: true, force: true });
fs.cpSync(NEW, tmp, { recursive: true });
const fresh = new Set(fs.readdirSync(tmp));
const next = {};
let kept = 0;
for (const f of prev) {
  if (fresh.has(f)) continue;
  const age = (carry[f] || 0) + 1;
  if (age > KEEP) continue;
  fs.copyFileSync(path.join(OLD, f), path.join(tmp, f));
  next[f] = age; kept++;
}
fs.writeFileSync(path.join(tmp, ".carry.json"), JSON.stringify(next));
fs.rmSync(OLD, { recursive: true, force: true });
fs.renameSync(tmp, OLD);
console.log(`swap-bundle: ${fresh.size} new, ${kept} older files kept`);
