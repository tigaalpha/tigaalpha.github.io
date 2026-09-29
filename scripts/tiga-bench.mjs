/* ── tiga-bench.mjs — TIGA Bench v1 (owner plan docs/TIGA_MODEL_DEV_PLAN.md 1.6)
   THE GRID BASELINE. One command measures the model on REAL code and writes
   docs/tiga-bench-latest.json so every release can be compared against the
   last one — "ดีขึ้นล้านเปอร์เซ็นต์" becomes a graph, not a slogan.

   What it measures (all from the REAL bundled tigamodel, never a mirror):
     grid      — plm1mStats(): cells started/open across the 1,000,000-spec grid
     routes    — capabilitySummary(): READY/partial/gaps over the 1,000 t×m×s routes
     sweeps    — allRoutes() cold vs warm (proves the 1.4 memoization is a win)
     hub       — tigaHub.summary(): registered engines/specialists coverage
     bundle    — bundle/index.template-*.js size (the main chunk the phone downloads)
     kb        — kbProbe spot checks (theory/performance depth)
     langs     — one verdict per language through the REAL teaching loop

   Rollback/exit codes: any hard failure → exit 1 and NO snapshot is written
   (never overwrite a good baseline with a broken run).

   Run: npm run bench:tiga   (writes docs/tiga-bench-latest.json)
*/

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");   // this script lives in scripts/ — one level down, not two
const OUT = "node_modules/.tmp-tiga-bench";
const SNAP = "docs/tiga-bench-latest.json";

const files = () => {
  try { return fs.readdirSync("bundle").filter(f => f.startsWith("index.template-") && f.endsWith(".js")); }
  catch (e) { return []; }
};
const bundleFile = files()[0] || null;
const bundleBytes = bundleFile ? fs.statSync(path.join("bundle", bundleFile)).size : null;

/* every lazy chunk with its size (plan v3.3 5.5: per-chunk reporting, so a
   bloated engine chunk is visible, not just the main one) */
const chunkList = (() => {
  try {
    return fs.readdirSync("bundle").filter(f => f.endsWith(".js"))
      .map(f => ({ file: f, bytes: fs.statSync(path.join("bundle", f)).size }))
      .sort((a, b) => b.bytes - a.bytes);
  } catch (e) { return []; }
})();

/* how much of the main chunk is tigamodel? Minified standalone size — the
   realistic upper bound of what plan v3 1.5 (lazy model loading) can shave
   off the main chunk once ALL static import sites are converted. */
let tigaMinBytes = null;
try {
  execSync(
    `npx esbuild tigamodel/web.js --bundle --minify --outfile=${OUT}/tiga-min.js --format=esm --platform=node --loader:.js=js --log-level=error`,
    { stdio: "pipe", cwd: ROOT }
  );
  tigaMinBytes = fs.statSync(path.join(ROOT, OUT, "tiga-min.js")).size;
} catch (e) { /* measurement only — never fails the bench */ }

console.log("TIGA Bench v1 — grid baseline on real code");
console.log(`  bundle: ${bundleFile ? `${bundleFile} (${(bundleBytes / 1024 / 1024).toFixed(2)} MB)` : "bundle/ not built — bundle metrics skipped (run npm run build first)"}`);

/* Build the standalone web.js bundle exactly the way the verify scripts do
   (repo convention: esbuild the real source, import it, never a copy). */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
execSync(
  `npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --log-level=error`,
  { stdio: "pipe", cwd: ROOT }
);
const web = await import(url.pathToFileURL(path.join(ROOT, `${OUT}/web.js`)).href);

/* Plan v3 1.6: a bench run must never reuse a memoized sweep from an earlier
   session of the same bundle — measure cold, then warm. */
web.resetCapabilityEngineForTest();

/* ── 1) cold vs warm sweep (capability engine) ── */
const eng = web.getCapabilityEngine();
const t0 = performance.now();
const routes = eng.allRoutes();
const coldMs = Math.round((performance.now() - t0) * 100) / 100;
const t1 = performance.now();
eng.allRoutes();
const warmMs = Math.round((performance.now() - t1) * 100) / 100;
console.log(`  routes sweep: cold ${coldMs}ms → warm ${warmMs}ms (${routes.length} routes)`);

const cap = web.capabilitySummary();

/* ── 2) grid (1,000,000-spec plan) ── */
const grid = web.plm1mStats();

/* ── 3) hub coverage ── */
const hub = web.tigaHub && typeof web.tigaHub.summary === "function" ? web.tigaHub.summary() : null;

/* ── 4) KB spot probes ── */
const kbTheory = eng.kbProbe(0);
const kbPerf = eng.kbProbe(8);

/* ── 5) language spot check through the REAL loop (cheap: 1 call/lang) ── */
const langs = {};
for (const [lang, re] of [["th", /[ก-๙]/], ["en", /[a-z]/], ["zh", /[一-龥]/]]) {
  try {
    const r = await web.runTeachingLoopForPractice({ accuracy: 90, repeatedErrors: 1, pauses: 0, rhythmScore: 90 }, { lang });
    langs[lang] = !!(r && r.response && re.test(r.response.text) && (lang === "th" || !/[ก-๙]/.test(r.response.text)));
  } catch (e) { langs[lang] = false; }
}
const langsOk = Object.values(langs).every(Boolean);

/* ── 6) summary() aggregation time (Model Lab renders it every open) ── */
const t2 = performance.now();
eng.summary();
const summaryMs = Math.round((performance.now() - t2) * 100) / 100;

/* ── 7) QUALITY BARS as code (plan v3 2.3): the Q-matrix's live assertions.
   Each bar is the shipped quality contract for a surface; the bench FAILS
   (exit 1, no snapshot) when one is violated — quality regressions can't
   silently merge. ── */
const BARS = [
  { id: "grid-measured", desc: "1M grid measured from the real engine (never hand-filled)", test: () => grid.total === 1000000 && typeof grid.started === "number" },
  { id: "routes-ready", desc: "capability map: every t×m×s route ≥ READY (0.7)", test: () => cap.ready === cap.total && cap.readyPct === 100 },
  { id: "verdict-multilingual", desc: "verdict speaks th/en/zh through the REAL loop", test: () => langsOk },
  { id: "sweep-warm-fast", desc: "capability sweep warm read < 50ms (memoized)", test: () => warmMs < 50 },
  { id: "summary-fast", desc: "capability summary() < 100ms (Lab render bar)", test: () => summaryMs < 100 },
  { id: "main-chunk-budget", desc: "main bundle ≤ 3.0 MB (was 3.48 MB pre-lazy; plan v3 3.5 perf budget)", test: () => bundleBytes == null || bundleBytes <= 3.0 * 1024 * 1024 },
  { id: "engine-out-of-main", desc: "main chunk contains no engine internals (runOnce symbol lives only in the lazy chunk)", test: () => {
    if (!bundleFile) return true;
    const txt = fs.readFileSync(path.join(ROOT, "bundle", bundleFile), "utf8");
    return !txt.includes("runOnce");   // engine-internal method name — survives minification as a property name
  } },
  { id: "kb-depth", desc: "KB seeded: theory ≥ 500, performance ≥ 120 entries", test: () => kbTheory.entries >= 500 && kbPerf.entries >= 120 },
  { id: "preload-interaction-first", desc: "engine preload waits for the first real interaction (plan v3.3 5.1) — idle is only the fallback", test: () => {
    try {
      const g = fs.readFileSync(path.join(ROOT, "tiga-gateway.ts"), "utf8");
      return g.includes("preloadTigamodelOnInteraction") && g.includes("pointerdown");
    } catch (e) { return false; }
  } },
];

const barResults = BARS.map(b => {
  let pass = false;
  try { pass = !!b.test(); } catch (e) {}
  console.log(`    ${pass ? "✅" : "❌"} ${b.id} — ${b.desc}`);
  return { id: b.id, pass };
});
const barsOk = barResults.every(b => b.pass);

const snapshot = {
  version: 1,
  generatedAt: new Date().toISOString(),
  appVersion: null,
  bundle: { file: bundleFile, bytes: bundleBytes, includesTigamodel: true, tigamodelMinifiedBytes: tigaMinBytes, chunks: chunkList },
  grid: {
    total: grid.total ?? null,
    started: grid.started ?? null,
    open: grid.open ?? null,
    startedPct: grid.startedPct ?? null,
  },
  routes: {
    total: cap.total, ready: cap.ready, partial: cap.partial, gaps: cap.gaps,
    readyPct: cap.readyPct, avgScore: cap.avgScore,
    weakestCap: cap.weakestCap ? cap.weakestCap.cap : null,
  },
  perf: {
    allRoutesColdMs: coldMs, allRoutesWarmMs: warmMs, summaryMs,
    memoSpeedup: warmMs > 0 ? Math.max(1, Math.round((coldMs / Math.max(warmMs, 0.01)) * 10) / 10) : null,
  },
  kb: { theoryEntries: kbTheory.entries, performanceEntries: kbPerf.entries },
  langs,
  langsOk,
  bars: barResults,
  barsOk,
};

/* best-effort app version from package.json */
try { snapshot.appVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version || null; } catch (e) {}

console.log("");
console.log(`  grid: ${snapshot.grid.startedPct ?? "?"}% started (${snapshot.grid.started ?? "?"}/${snapshot.grid.total ?? "?"} cells)`);
console.log(`  routes READY: ${cap.ready}/${cap.total} (${cap.readyPct}%)  weakest: ${snapshot.routes.weakestCap ?? "-"}`);
console.log(`  langs th/en/zh pass: ${langs.th}/${langs.en}/${langs.zh}`);
console.log(`  bundle main: ${bundleBytes ? `${(bundleBytes / 1024 / 1024).toFixed(2)} MB` : "n/a"}${tigaMinBytes ? ` (tigamodel ≈ ${(tigaMinBytes / 1024 / 1024).toFixed(2)} MB, lazy chunk)` : ""}`);
const lazyLargest = chunkList.find(c => c.file !== bundleFile);
if (lazyLargest) console.log(`  lazy chunks: ${chunkList.length} files · largest non-main: ${lazyLargest.file} (${(lazyLargest.bytes / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  quality bars: ${barResults.filter(b => b.pass).length}/${barResults.length} pass`);

/* previous snapshot → delta line (the graph starts here) */
if (fs.existsSync(SNAP)) {
  try {
    const prev = JSON.parse(fs.readFileSync(SNAP, "utf8"));
    const d = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : null);
    const dp = d(snapshot.grid.startedPct, prev.grid && prev.grid.startedPct);
    const dr = d(snapshot.routes.ready, prev.routes && prev.routes.ready);
    const db = d(snapshot.bundle.bytes, prev.bundle && prev.bundle.bytes);
    console.log("");
    console.log(`  vs previous (${prev.generatedAt || "?"}): grid ${dp === null ? "-" : (dp > 0 ? "+" : "") + dp + "pp"}, ready ${dr === null ? "-" : (dr > 0 ? "+" : "") + dr}, bundle ${db === null ? "-" : (db > 0 ? "+" : "") + (db / 1024).toFixed(1) + " kB"}`);
  } catch (e) { /* unreadable previous snapshot is not fatal */ }
}

fs.rmSync(OUT, { recursive: true, force: true });

if (!langsOk) { console.error("\nBENCH FAIL: language spot check failed — no snapshot written"); process.exit(1); }
if (!cap.total) { console.error("\nBENCH FAIL: capability summary empty — no snapshot written"); process.exit(1); }
if (!barsOk) {
  const bad = barResults.filter(b => !b.pass).map(b => b.id).join(", ");
  console.error(`\nBENCH FAIL: quality bar(s) violated: ${bad} — no snapshot written`);
  process.exit(1);
}

fs.writeFileSync(SNAP, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`\n✅ snapshot written → docs/tiga-bench-latest.json`);
