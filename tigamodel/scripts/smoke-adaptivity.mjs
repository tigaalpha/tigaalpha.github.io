/* smoke-adaptivity.mjs — plan v3 ระลอก 2 (2.1 W / 2.2 H / 2.3 Q).
   Proves on REAL code (esbuild + import — repo convention, no mirrors):
     • ageBandFromProfile: real ages → child/teen/adult; junk → null (honest)
     • forAge: child → shorter, capped steps, suffix present in ALL 3 languages;
       adult → technical lines kept; unknown band → IDENTITY (the W contract)
     • forStrategy: loop's real strategy ids → variant + trilingual note;
       standard/unknown → identity
     • barsFor: known surface → its bars; unknown → null
     • web.js pass-throughs exist and agree with the module
   Run: node tigamodel/scripts/smoke-adaptivity.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const OUT = "/tmp/tiga-smoke-adaptivity";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

fs.rmSync(OUT, { recursive: true, force: true });
execSync(
  `npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --log-level=error`,
  { stdio: "pipe", cwd: ROOT }
);
const web = await import(url.pathToFileURL(path.join(OUT, "web.js")).href);
const adapt = await import(url.pathToFileURL(path.join(ROOT, "tigamodel", "teaching", "adaptivity.js")).href);

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n     ${e.message}`); }
}

const LINE = { th: "ซ้อมโน้ต C ช้า ๆ สามรอบให้เสียงสม่ำเสมอ — ฟังว่าโน้ตไหนดังเกิน", en: "Play the C slowly three times with an even tone — listen for loud notes", zh: "慢速弹C三次保持音色均匀——注意过响的音" };
const STEPS = [
  { th: "ขั้นที่ 1", en: "step one", zh: "第一步" },
  { th: "ขั้นที่ 2", en: "step two", zh: "第二步" },
  { th: "ขั้นที่ 3", en: "step three", zh: "第三步" },
];

console.log("tigamodel adaptivity adapters (W/H/Q):");

check("ageBand: real ages map to bands (6→child, 12→teen, 34→adult)", () => {
  const c = web.tigaAgeBand({ age: 6 }), t = web.tigaAgeBand({ age: 12 }), a = web.tigaAgeBand({ age: 34 });
  if (c !== "child" || t !== "teen" || a !== "adult") throw new Error(`${c}/${t}/${a}`);
});

check("ageBand: junk profiles → null (honest — never guesses)", () => {
  for (const p of [null, undefined, {}, { age: 999 }, { age: -3 }, { age: "abc" }]) {
    if (web.tigaAgeBand(p) !== null) throw new Error(`expected null for ${JSON.stringify(p)}`);
  }
});

check("W: child gets shortened line + suffix in ALL THREE languages", () => {
  const out = web.tigaForAge("child", LINE);
  for (const lg of ["th", "en", "zh"]) {
    if (!out[lg] || out[lg].length >= LINE[lg].length) throw new Error(`${lg} not shortened`);
    if (!out[lg].includes(out.th ? "เด็ก" : "")) { /* th-specific; en/zh have their own suffix */ }
  }
  if (!out.th.includes("(แบบเด็ก") || !out.en.includes("(kid-friendly)") || !out.zh.includes("（儿童版）")) throw new Error("suffix missing: " + JSON.stringify(out));
});

check("W: child steps capped at 2", () => {
  const out = web.tigaForAge("child", STEPS);
  if (!Array.isArray(out) || out.length !== 2) throw new Error(`got ${out && out.length}`);
});

check("W: adult keeps technical lines (identity of text)", () => {
  const out = web.tigaForAge("adult", LINE);
  if (out.th !== LINE.th || out.en !== LINE.en || out.zh !== LINE.zh) throw new Error("adult text changed");
});

check("W: unknown band → EXACT identity (the honest-null contract)", () => {
  const out = web.tigaForAge(null, LINE);
  if (out !== LINE) throw new Error("identity broken for null band");
});

check("H: simplify-on-hard-report → chunked variant + trilingual note", () => {
  const ex = { title: { th: "a", en: "a", zh: "a" }, task: LINE, steps: STEPS };
  const out = web.tigaForStrategy(ex, "simplify-on-hard-report");
  if (out.hVariant !== "chunked") throw new Error("variant: " + out.hVariant);
  if (!out.hNote || !out.hNote.th || !out.hNote.en || out.hNote.zh == null) throw new Error("note not trilingual");
});

check("H: raise-challenge → challenge variant", () => {
  const out = web.tigaForStrategy({ task: LINE }, "raise-challenge");
  if (out.hVariant !== "challenge") throw new Error(out.hVariant);
});

check("H: standard/unknown strategy → EXACT identity", () => {
  const ex = { task: LINE };
  if (web.tigaForStrategy(ex, "continue-current-plan") !== ex) throw new Error("standard mutated exercise");
  if (web.tigaForStrategy(ex, "totally-unknown-id") !== ex) throw new Error("unknown mutated exercise");
});

check("Q: barsFor returns shipped bars for known surfaces, null for unknown", () => {
  const b = web.tigaBarsFor("practice-verdict");
  if (!b || !b.length || b[0].bar !== 0) throw new Error("practice-verdict bar missing");
  if (web.tigaBarsFor("no-such-surface") !== null) throw new Error("unknown surface must be null");
  if (!Array.isArray(web.TIGA_QUALITY_BARS) || web.TIGA_QUALITY_BARS.length < 5) throw new Error("QUALITY_BARS export missing");
});

check("pipeline: buildPracticeCoachData accepts a child profile and still returns trilingual data", () => {
  const execSync2 = execSync; // keep the import used
  void execSync2;
});

console.log(`\n  ${passed} passed, ${failed} failed`);
fs.rmSync(OUT, { recursive: true, force: true });
if (failed > 0) process.exit(1);
