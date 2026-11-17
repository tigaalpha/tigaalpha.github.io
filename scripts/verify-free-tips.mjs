/* verify-free-tips.mjs — the free learner's Auto Teaching allowance (owner, 2026-10-02: 2 tips a day free, then a line that points
   at the plan) really reaches a tip. Reported 2026-11-17: "AI TIPs bug" — free learners never got a tip. Cause: App.tsx called
   `adviceQuota()` without importing it, `autoTeachAllowed()` caught the ReferenceError and answered "no", for every free learner,
   since the file was first written. No type check exists here, so nothing could have told us.

   What this runs (no browser, no network; the REAL modules):
     1. use-autoteach.ts through esbuild + jsdom localStorage: adviceQuota() / adviceDeliveredToday() — nothing today → 2 left, one
        today → 1 left, two today → spent, tips of YESTERDAY never count, the allowance argument is honoured.
     2. the REAL `autoTeachAllowed()` function text cut out of App.tsx and run with the real adviceQuota: premium / admin → always
        ok, free with nothing today → ok (why "free"), free with two today → refused with why "quota", a thrown quota read → refused
        with why "error".
     3. the wiring that no function test can see: App.tsx imports adviceQuota from ./use-autoteach, `fetchAutoTeachTip` shows the
        "used today's free tips" line ONLY for why === "quota" (a failed read must not tell a learner who used none that they used two),
        and use-camera-coach.ts calls visionObservationsFromWindow on the tigamodel module, never bare.
   Run: node scripts/verify-free-tips.mjs   (needs jsdom, which is a devDependency of the repo) */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://www.tigaalpha.com/" });
global.window = dom.window; global.document = dom.window.document; global.localStorage = dom.window.localStorage;
global.CustomEvent = dom.window.CustomEvent;

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log("PASS  " + label); } else { fail++; console.log("FAIL  " + label); } };

// ── 1. the real use-autoteach.ts ──────────────────────────────────────────────────────────────
const OUT = path.join(ROOT, "node_modules/.tmp-free-tips");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
execFileSync(path.join(ROOT, "node_modules/.bin/esbuild"), ["use-autoteach.ts", "--bundle", "--format=esm", `--outfile=${OUT}/use-autoteach.mjs`, "--log-level=silent"], { stdio: "inherit" });
const AT = await import(pathToFileURL(`${OUT}/use-autoteach.mjs`).href);
ok(typeof AT.adviceQuota === "function", "use-autoteach.ts exports adviceQuota");
ok(typeof AT.adviceDeliveredToday === "function", "use-autoteach.ts exports adviceDeliveredToday");

const OUTCOME_KEY = (/const LS_OUT\s*=\s*"([^"]+)"/.exec(fs.readFileSync("use-autoteach.ts", "utf8")) || [])[1];
ok(!!OUTCOME_KEY, "found the outcomes key in use-autoteach.ts (" + OUTCOME_KEY + ")");
const now = Date.now(), DAY = 86400000;
const startOfToday = (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); })();
const seed = rows => localStorage.setItem(OUTCOME_KEY, JSON.stringify(rows));
const row = (t, i) => ({ t, topic: "t" + i, weakness: "w", decisionId: "d" + i });

localStorage.clear();
let q = AT.adviceQuota(2, now);
ok(q.used === 0 && q.cap === 2 && q.left === 2 && q.spent === false, "free learner, nothing delivered today: 0 of 2 used, not spent  " + JSON.stringify(q));
seed([row(now - 1000, 1)]);
q = AT.adviceQuota(2, now);
ok(q.used === 1 && q.left === 1 && q.spent === false, "one tip today: 1 left, not spent  " + JSON.stringify(q));
seed([row(now - 2000, 1), row(now - 1000, 2)]);
q = AT.adviceQuota(2, now);
ok(q.used === 2 && q.left === 0 && q.spent === true, "two tips today: spent  " + JSON.stringify(q));
seed([row(startOfToday - 1000, 1), row(startOfToday - 5000, 2), row(startOfToday - DAY, 3)]);
q = AT.adviceQuota(2, now);
ok(q.used === 0 && q.spent === false, "three tips YESTERDAY do not count toward today  " + JSON.stringify(q));
seed([row(startOfToday + 1, 1), row(startOfToday - 1, 2)]);
ok(AT.adviceDeliveredToday(now) === 1, "the day starts at local midnight (one second after counts, one second before does not)");
seed([row(now - 1, 1), row(now - 2, 2)]);
ok(AT.adviceQuota(3, now).spent === false && AT.adviceQuota(1, now).spent === true, "the allowance argument is honoured (3 → not spent, 1 → spent)");

// ── 2. the real autoTeachAllowed() out of App.tsx ─────────────────────────────────────────────
const app = fs.readFileSync("App.tsx", "utf8");
const fnStart = app.indexOf("function autoTeachAllowed() {");
ok(fnStart > 0, "App.tsx still has autoTeachAllowed()");
let fnText = "";
if (fnStart > 0) {
  let depth = 0, i = app.indexOf("{", fnStart);
  for (let j = i; j < app.length; j++) { const c = app[j]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { fnText = app.slice(fnStart, j + 1); break; } } }
}
ok(/adviceQuota\(\s*ATIP_FREE_PER_DAY\s*\)/.test(fnText), "autoTeachAllowed() reads the allowance through adviceQuota(ATIP_FREE_PER_DAY)");
const mk = (premium, profile, adviceQuota) => new Function("premium", "profile", "adviceQuota", "ATIP_FREE_PER_DAY", fnText + "\nreturn autoTeachAllowed();")(premium, profile, adviceQuota, 2);
seed([]);
let r = mk(false, { is_admin: false }, AT.adviceQuota);
ok(r.ok === true && r.why === "free" && r.quota && r.quota.left === 2, "FREE learner with nothing today is allowed (why \"free\")  " + JSON.stringify(r));
seed([row(now - 2000, 1), row(now - 1000, 2)]);
r = mk(false, null, AT.adviceQuota);
ok(r.ok === false && r.why === "quota" && r.quota.spent === true, "FREE learner who got two tips today is refused with why \"quota\"  " + JSON.stringify(r));
r = mk(true, null, AT.adviceQuota);
ok(r.ok === true && r.why === "plan", "a Premium learner is always allowed, even after two tips");
r = mk(false, { is_admin: true }, AT.adviceQuota);
ok(r.ok === true && r.why === "plan", "an admin is always allowed");
r = mk(false, null, () => { throw new Error("boom"); });
ok(r.ok === false && r.why === "error", "a quota read that throws is refused with why \"error\" (and the next check makes sure that shows no \"used your tips\" line)");
let notDefined = false;
try { new Function("premium", "profile", "ATIP_FREE_PER_DAY", fnText + "\nreturn autoTeachAllowed();")(false, null, 2); } catch (e) { notDefined = true; }
ok(notDefined === false, "(the bug itself) with NO adviceQuota in scope the function swallows the ReferenceError and answers refused/error — the import line below is what keeps it from ever running that way");

// ── 3. the wiring ─────────────────────────────────────────────────────────────────────────────
const importLine = (/import \{[^}]*\} from "\.\/use-autoteach";/.exec(app) || [""])[0];
ok(/\badviceQuota\b/.test(importLine), "App.tsx imports adviceQuota from ./use-autoteach");
ok(/if \(!allow\.ok\) \{ if \(allow\.why === "quota"\) setAutoTeachUpsellHint\(allow\); return; \}/.test(app), "fetchAutoTeachTip shows the \"used today's free tips\" line only for why === \"quota\"");
ok(!/if \(!allow\.ok\) \{ setAutoTeachUpsellHint\(allow\); return; \}/.test(app), "the old unconditional upsell on any refusal is gone");
const cam = fs.readFileSync("use-camera-coach.ts", "utf8");
ok(/m\.visionObservationsFromWindow\(/.test(cam), "use-camera-coach.ts calls visionObservationsFromWindow on the tigamodel module");
ok(!/[^.\w]visionObservationsFromWindow\(/.test(cam.replace(/\/\/[^\n]*/g, "")), "use-camera-coach.ts has no BARE visionObservationsFromWindow call (it was never imported)");
const web = fs.readFileSync("tigamodel/web.js", "utf8");
ok(/export function visionObservationsFromWindow\(/.test(web), "tigamodel/web.js exports visionObservationsFromWindow");

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
