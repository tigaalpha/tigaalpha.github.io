/* One-off verification: hidden-surface audit after hiding the whole
   "Marketing for Artists" stage/group. Uses the REAL source:
     - pathway-data.ts + i18n.ts via esbuild (real PATHWAY, BENEFIT_CASES,
       FAQ_TOPICS objects built by real module init code)
     - the App.tsx hidden-filter block is extracted verbatim from App.tsx
       and executed against those real objects (no hand-mirrored copy)
   Asserts: stage gone from PATHWAY + STAGES_BY_GROUP, group gone from
   BENEFIT_CASES, carabao gone, FAQ entries gone, neighbours intact. */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-hide-verify";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execSync(
  `npx esbuild pathway-data.ts i18n.ts --bundle --format=esm --platform=browser ` +
  `--outdir=${OUT}/lib --log-level=error`,
  { stdio: "inherit" }
);

const i18n = await import(pathToFileURL(`${OUT}/lib/i18n.js`).href);
const pd = await import(pathToFileURL(`${OUT}/lib/pathway-data.js`).href);

// --- extract the REAL App.tsx filter block and execute it ---
const appSrc = readFileSync("App.tsx", "utf8");
const m = appSrc.match(/const HIDDEN_STAGE_IDS[\s\S]*?FAQ_TOPICS\.splice\(_fi, 1\);/);
if (!m) { console.error("FAIL  App.tsx filter block not found"); process.exit(1); }
const runAppFilter = new Function(
  "PATHWAY", "STAGES_BY_GROUP", "BENEFIT_CASES", "FAQ_TOPICS", m[0]
);
runAppFilter(pd.PATHWAY, i18n.STAGES_BY_GROUP, i18n.BENEFIT_CASES, i18n.FAQ_TOPICS);

// --- assertions ---
let fails = 0;
const ok = (cond, label) => { console.log((cond ? "PASS" : "FAIL") + "  " + label); if (!cond) fails++; };

ok(!pd.PATHWAY.some(s => s.id === "music-marketing"), "PATHWAY: music-marketing stage removed");
ok(pd.PATHWAY.some(s => s.id === "music-business"), "PATHWAY: music-business stage still present");
ok(pd.PATHWAY.length >= 15, "PATHWAY: stage count sane (" + pd.PATHWAY.length + ")");
ok(i18n.STAGES_BY_GROUP.benefits && !i18n.STAGES_BY_GROUP.benefits.some(s => s.id === "music-marketing"), "STAGES_BY_GROUP: benefits rebuilt without music-marketing");
ok(i18n.STAGES_BY_GROUP.benefits && i18n.STAGES_BY_GROUP.benefits.length === 6, "STAGES_BY_GROUP: benefits has 6 stages left");

ok(!i18n.BENEFIT_CASES["music-marketing"], "BENEFIT_CASES: music-marketing group deleted");
ok(i18n.BENEFIT_CASES["music-business"] && !i18n.BENEFIT_CASES["music-business"].some(c => c.id === "carabao"), "BENEFIT_CASES: carabao removed");
ok(i18n.BENEFIT_CASES["music-business"] && i18n.BENEFIT_CASES["music-business"].length > 0, "BENEFIT_CASES: music-business still has cases");
ok(!!i18n.BENEFIT_CASES["music-therapy"], "BENEFIT_CASES: music-therapy intact");

ok(Array.isArray(i18n.FAQ_TOPICS), "FAQ_TOPICS is an array");
ok(!i18n.FAQ_TOPICS.some(t => t.key === "music-marketing"), "FAQ: music-marketing stage entry gone");
ok(!i18n.FAQ_TOPICS.some(t => t.key === "carabao"), "FAQ: carabao entry gone");
ok(!i18n.FAQ_TOPICS.some(t => ["taylor", "bts-army", "lilnasx", "chance", "milli-mango", "d2f"].includes(t.key)), "FAQ: all music-marketing case entries gone");
ok(i18n.FAQ_TOPICS.some(t => String(t.key).startsWith("intel")), "FAQ: music-business cases still indexed");
ok(i18n.FAQ_TOPICS.some(t => t.key === "why-music"), "FAQ: other stages still indexed");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
