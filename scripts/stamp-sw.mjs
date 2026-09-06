/* ── why this script exists ──
   A service worker is only reinstalled by the browser when its BYTES change.
   The build used to do `cp public/sw.js sw.js`, a verbatim copy, so sw.js was
   identical on every release going back to the day "tiga-v14" was typed by
   hand. No new worker ever installed, so `activate` never fired, so the
   SW_UPDATED message App.tsx listens for in order to reload was never sent —
   and every user with the app already open kept running the build they first
   loaded, no matter how many times we shipped.

   Stamping the hash of the actual built page into sw.js means the file
   changes exactly when the app changes: ship nothing, nothing reinstalls;
   ship anything, everyone picks it up on their next visit. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const page = readFileSync("index.html");
const stamp = createHash("sha256").update(page).digest("hex").slice(0, 12);
const src = readFileSync("public/sw.js", "utf8");
if (!src.includes("__BUILD__")) {
  console.error("stamp-sw: public/sw.js has no __BUILD__ placeholder — refusing to ship a worker that can never update");
  process.exit(1);
}
const out = src.replaceAll("__BUILD__", stamp);
writeFileSync("sw.js", out);
if (existsSync("dist")) writeFileSync("dist/sw.js", out);   // the OTA zip ships this one
console.log(`stamp-sw: sw.js -> tiga-${stamp} (${page.length} bytes of page)`);
