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
const HIST = "docs/tiga-bench-history.json";   // 13.6 — one entry per completed bench round (plan 4.8)

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

/* ── 8) plan v3.8 ระลอก 12 (12.6) — JOY SHADOW on the bench. The 10th
   dimension (learner joy) joins the snapshot as its OWN section — never
   folded into any eval score (the plan's rule: ผลรวมแยกชัดจาก eval
   สังเคราะห์). Measured here through the REAL module on a crafted,
   deterministic log dataset (the smoke's own all-5-fire shape), proving
   the full shadow pipeline works end-to-end on every bench run. ── */
const JOY_T = new Date("2026-09-30T12:00:00").getTime();
const JOY_PROBE = () => web.getJoyIndex({
  practiceLog: { "2026-09-28": { n: 1, accSum: 60 }, "2026-09-30": { n: 2, accSum: 170 } },
  actLog: [
    { t: JOY_T, d: "2026-09-30", k: "game", id: "ocean", ok: 30, miss: 10, sec: 60 * 12 },
    { t: JOY_T + 1, d: "2026-09-30", k: "game", id: "twinkle", ok: 40, miss: 0, sec: 0 },
    { t: JOY_T + 2, d: "2026-09-30", k: "share", id: "twinkle", ok: 0, miss: 0, sec: 0 },
  ],
  starsById: { twinkle: 2 }, daily: { id: "minuet" }, moods: [], now: "2026-09-30",
});
const BOREDOM_PROBE = () => web.getBoredomRisk({
  practiceLog: { "2026-09-26": { n: 1, accSum: 70 }, "2026-09-28": { n: 1, accSum: 70 }, "2026-09-30": { n: 1, accSum: 70 } },
  actLog: [{ t: JOY_T, d: "2026-09-30", k: "game", id: "my-song", ok: 30, miss: 5, sec: 90 }],
  daily: { id: "daily-song" }, moods: [], now: "2026-09-30",
});
const joyProbe = JOY_PROBE();
const boredomProbe = BOREDOM_PROBE();
console.log(`  joy shadow: ${joyProbe ? `${joyProbe.score}/${joyProbe.of} signals` : "MODULE BROKEN"} · boredom ${boredomProbe ? `${boredomProbe.count}/${boredomProbe.of}` : "MODULE BROKEN"} (both wired to nothing until 30 loop rounds — plan 12.6)`);

/* ── 6) summary() aggregation time (Model Lab renders it every open) ── */
const t2 = performance.now();
eng.summary();
const summaryMs = Math.round((performance.now() - t2) * 100) / 100;

/* ── plan v3.8 ระลอก 13 (13.5) — KB-SIZE vs LATENCY, measured every snapshot.
   The plan's model-health rule: when the KB outgrows its weight class, the
   ANSWER latency must hold, and the pair (bytes, ms) must be RECORDED each
   round — a trend, not a one-off check. KB bytes = the real knowledge files
   shipped in the lazy chunk; latency = a COLD kbProbe (fresh engine + fresh
   seeded KB — exactly the cost a phone pays on first model load) plus the
   warm read the Lab keeps hitting. ── */
let kbBytes = null;
try {
  const kbFiles = [];
  const walk = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (f.endsWith(".js")) kbFiles.push(p); } };
  walk(path.join(ROOT, "tigamodel", "knowledge"));
  kbBytes = kbFiles.reduce((s, p) => s + fs.statSync(p).size, 0);
} catch (e) { kbBytes = null; }

let _coldEng = null;
try {
  const fresh = await import(url.pathToFileURL(path.join(ROOT, `${OUT}/web.js`)).href + `?cold=${Date.now()}`);
  fresh.__resetTigaForTest();
  _coldEng = fresh.getCapabilityEngine();
} catch (e) { _coldEng = null; }
let kbProbeColdMs = null, kbProbeWarmMs = null, kbProbeEntries = null;
if (_coldEng) {
  const tk0 = performance.now();
  const pr = _coldEng.kbProbe(0);
  kbProbeColdMs = Math.round((performance.now() - tk0) * 100) / 100;
  kbProbeEntries = pr ? pr.entries : null;
  const tk1 = performance.now();
  _coldEng.kbProbe(0);
  kbProbeWarmMs = Math.round((performance.now() - tk1) * 100) / 100;
}

/* ── (13.1) the five owner pillars, weakest first — the bench itself must
   answer "weakest ขุมไหน" every round, not just the smoke. ── */
let pillarRows = [];
try { pillarRows = eng.pillars().map(p => ({ domain: p.domain, th: p.th, en: p.en, zh: p.zh, icon: p.icon, entries: p.entries, teach: p.teach, min: p.min, score: Math.round((p.score || 0) * 1000) / 1000, ready: p.ready })); } catch (e) { pillarRows = []; }
const weakestPillar = pillarRows.length ? pillarRows[0].domain : null;
console.log(`  pillars: ${pillarRows.map(p => `${p.domain.split("music-")[1]} ${p.entries}/${p.min}`).join(" · ")}${weakestPillar ? ` → weakest: ${weakestPillar}` : ""}`);

/* ── (13.5 quality bar) the pair is recorded AND latency holds: the cold
   probe must stay under 250 ms every snapshot — if a KB growth pushes the
   first-answer cost past this, the bar fails and the snapshot is not
   written, forcing the 5.2/5.3 lazy-per-domain work. ── */
const kbLatencyOk = kbProbeColdMs == null ? false : (kbProbeColdMs < 250 && (kbProbeWarmMs == null || kbProbeWarmMs < 50));

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
    return !txt.includes("runOnce");
  } },
  { id: "kb-depth", desc: "KB seeded: theory ≥ 500, performance ≥ 120 entries", test: () => kbTheory.entries >= 500 && kbPerf.entries >= 120 },
  { id: "preload-interaction-first", desc: "engine preload waits for the first real interaction (plan v3.3 5.1) — idle is only the fallback", test: () => {
    try {
      const g = fs.readFileSync(path.join(ROOT, "tiga-gateway.ts"), "utf8");
      return g.includes("preloadTigamodelOnInteraction") && g.includes("pointerdown");
    } catch (e) { return false; }
  } },
  { id: "joy-shadow-contract", desc: "JoyIndex stays a shadow: measured + explainable, score === fired count, wired to nothing (enough:false until 12.6's 30 loop rounds)", test: () => {
    const r = JOY_PROBE();
    return !!(r && r.shadow === true && r.enough === false && r.score === r.fired.length && r.score === 5 && r.evidence.length === 5 && r.evidence.every(e => e.source && e.source.length));
  } },
  { id: "boredom-kb-contract", desc: "boredom risk classifies ONLY by the KB 6.8 quit causes (each cites edu:churn:*) and stays a shadow too", test: () => {
    const r = BOREDOM_PROBE();
    const list = web.boredomRiskList();
    return !!(r && r.shadow === true && r.enough === false && list.length === 4 && list.every(x => /^edu:churn:/.test(x.kb)) && r.count === 0);
  } },
  { id: "joy-formula-smoke-guard", desc: "the joy/boredom formulas cannot change silently: both smokes exist, sit in verify:tiga, and the vocab is frozen in source", test: () => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      const chain = (pkg.scripts && pkg.scripts["verify:tiga"]) || "";
      const joySrc = fs.readFileSync(path.join(ROOT, "tigamodel", "teaching", "joy.js"), "utf8");
      return fs.existsSync(path.join(ROOT, "tigamodel", "scripts", "smoke-joy.mjs"))
        && fs.existsSync(path.join(ROOT, "tigamodel", "scripts", "smoke-boredom.mjs"))
        && chain.includes("smoke-joy.mjs") && chain.includes("smoke-boredom.mjs")
        && joySrc.includes("Object.freeze(JOY_SIGNALS)") && joySrc.includes("Object.freeze(BOREDOM_RISKS)");
    } catch (e) { return false; }
  } },
  { id: "pillar-probes-live", desc: "13.1: the five owner pillars are probed every bench run, weakest-first, and the weakest is named", test: () => pillarRows.length === 5 && !!weakestPillar },
  { id: "kb-latency-recorded", desc: "13.5: KB-size vs latency is recorded every snapshot and the cold probe stays fast (<250ms warm <50ms)", test: () => kbLatencyOk },
  { id: "teacher-loop-guard", desc: "13.3: the teacher-outcome smoke exists and sits in verify:tiga (the 4.4 mapping cannot drift silently)", test: () => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      const chain = (pkg.scripts && pkg.scripts["verify:tiga"]) || "";
      return fs.existsSync(path.join(ROOT, "tigamodel", "scripts", "smoke-teacher-loop.mjs")) && chain.includes("smoke-teacher-loop.mjs");
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

/* ── (13.4/13.6) loop round counter: bump on bench ratchets — grid closed a
   NEW set of cells since the last snapshot. The snapshot records when the
   wheel last moved; it never invents rounds. ── */
let loopRound = 1, loopAdvanced = false;
try {
  const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, "utf8")) : [];
  const prev = hist.length ? hist[hist.length - 1] : null;
  if (prev && typeof prev.grid?.started === "number" && grid.started > prev.grid.started) {
    loopRound = (prev.loopRound || 1) + 1;
    loopAdvanced = true;
  } else if (prev && prev.loopRound) {
    loopRound = prev.loopRound;
  }
} catch (e) { /* unreadable history → round 1, honest */ }

const snapshot = {
  version: 2,
  generatedAt: new Date().toISOString(),
  appVersion: null,
  loopRound, loopAdvanced,
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
  /* 13.1 — per-pillar readiness, weakest first (the snapshot answers
     "weakest ขุมไหน" on its own) */
  pillars: pillarRows,
  weakestPillar,
  perf: {
    allRoutesColdMs: coldMs, allRoutesWarmMs: warmMs, summaryMs,
    memoSpeedup: warmMs > 0 ? Math.max(1, Math.round((coldMs / Math.max(warmMs, 0.01)) * 10) / 10) : null,
    /* 13.5 — the model-health pair, every snapshot: KB weight (real source
       bytes + minified engine chunk) vs answer latency (cold/warm kbProbe) */
    kbBytes, kbProbeColdMs, kbProbeWarmMs,
  },
  kb: { theoryEntries: kbTheory.entries, performanceEntries: kbPerf.entries, kbProbeEntries },
  langs,
  langsOk,
  /* plan v3.8 12.6 — the joy/boredom SHADOW read. Deliberately its own
     section, separate from every eval score: shadow metrics are reported,
     not graded. enough stays false until the 30-loop-round rule opens the
     gate (then workOrder weighting joins here, plan 7.3). */
  joyShadow: {
    signals: joyProbe ? joyProbe.signals : null,
    fired: joyProbe ? joyProbe.fired : null,
    score: joyProbe ? joyProbe.score : null,
    of: joyProbe ? joyProbe.of : null,
    boredom: boredomProbe ? { signals: boredomProbe.signals, kb: boredomProbe.kb, score: boredomProbe.score, of: boredomProbe.of } : null,
    enough: false,
    note: "shadow until 30 loop rounds (plan 12.6) — never part of eval scores",
  },
  bars: barResults,
  barsOk,
};

/* best-effort app version from package.json */
try { snapshot.appVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version || null; } catch (e) {}

console.log("");
console.log(`  grid: ${snapshot.grid.startedPct ?? "?"}% started (${snapshot.grid.started ?? "?"}/${snapshot.grid.total ?? "?"} cells) · loop round ${loopRound}${loopAdvanced ? " ▲" : ""}`);
console.log(`  routes READY: ${cap.ready}/${cap.total} (${cap.readyPct}%)  weakest: ${snapshot.routes.weakestCap ?? "-"}`);
console.log(`  langs th/en/zh pass: ${langs.th}/${langs.en}/${langs.zh}`);
console.log(`  bundle main: ${bundleBytes ? `${(bundleBytes / 1024 / 1024).toFixed(2)} MB` : "n/a"}${tigaMinBytes ? ` (tigamodel ≈ ${(tigaMinBytes / 1024 / 1024).toFixed(2)} MB, lazy chunk)` : ""}`);
const lazyLargest = chunkList.find(c => c.file !== bundleFile);
if (lazyLargest) console.log(`  lazy chunks: ${chunkList.length} files · largest non-main: ${lazyLargest.file} (${(lazyLargest.bytes / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  KB health: ${kbBytes != null ? `${(kbBytes / 1024).toFixed(0)} kB source` : "size n/a"} · probe cold ${kbProbeColdMs ?? "?"} ms / warm ${kbProbeWarmMs ?? "?"} ms${kbLatencyOk ? " ✓" : " ⚠️"}`);
console.log(`  quality bars: ${barResults.filter(b => b.pass).length}/${barResults.length} pass`);

/* previous snapshot → delta line (the graph starts here) */
if (fs.existsSync(SNAP)) {
  try {
    const prev = JSON.parse(fs.readFileSync(SNAP, "utf8"));
    const d = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : null);
    const dp = d(snapshot.grid.startedPct, prev.grid && prev.grid.startedPct);
    const dr = d(snapshot.routes.ready, prev.routes && prev.routes.ready);
    const db = d(snapshot.bundle.bytes, prev.bundle && prev.bundle.bytes);
    const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);   // clean owner-facing deltas, no float tails
    const dp1 = r1(dp), dr1 = r1(dr), db1 = db == null ? null : Math.round((db / 102.4)) / 10;   // bytes → kB
    console.log("");
    console.log(`  vs previous (${prev.generatedAt || "?"}): grid ${dp1 === null ? "-" : (dp1 > 0 ? "+" : "") + dp1 + "pp"}, ready ${dr1 === null ? "-" : (dr1 > 0 ? "+" : "") + dr1}, bundle ${db1 === null ? "-" : (db1 > 0 ? "+" : "") + db1.toFixed(1) + " kB"}`);
  } catch (e) { /* unreadable previous snapshot is not fatal */ }
}

/* ── (13.6) HISTORY + THE OWNER'S ONE-NUMBER ROUND REPORT. Every completed
   bench appends to docs/tiga-bench-history.json (plan 4.8's file), and the
   round is summarized in ONE line a human reads in 30 seconds — the same
   numbers the snapshot and the Lab's 13.4 card show. History grows only on
   real bench rounds — the file never invents entries. ── */
function benchOneLine(s, prev) {
  const gridStr = s.grid && s.grid.startedPct != null ? `${s.grid.startedPct}%` : "?";
  const weakest = s.weakestPillar || (s.routes && s.routes.weakestCap) || "-";
  const kbLat = s.perf && s.perf.kbProbeColdMs != null ? `${s.perf.kbProbeColdMs}ms` : "-";
  const prevGrid = prev && prev.grid && prev.grid.startedPct != null ? prev.grid.startedPct : null;
  const delta = prevGrid != null && s.grid && s.grid.startedPct != null ? ` (${s.grid.startedPct - prevGrid >= 0 ? "+" : ""}${(s.grid.startedPct - prevGrid).toFixed(1)}pp)` : "";
  const bundleStr = s.bundle && s.bundle.bytes != null ? `${(s.bundle.bytes / 1024 / 1024).toFixed(2)}MB` : "-";
  return `round ${s.loopRound} · grid ${gridStr}${delta} · weakest ${weakest} · KB ${kbLat} · bundle ${bundleStr}`;
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
console.log(`\n✅ snapshot written → ${SNAP}`);

/* 13.6 — history AFTER every gate passed (a failed bench never writes) */
try {
  const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, "utf8")) : [];
  const prev = hist.length ? hist[hist.length - 1] : null;
  const entry = {
    ts: snapshot.generatedAt,
    loopRound: snapshot.loopRound,
    loopAdvanced: snapshot.loopAdvanced,
    grid: { started: snapshot.grid.started, startedPct: snapshot.grid.startedPct, total: snapshot.grid.total },
    routes: { ready: snapshot.routes.ready, total: snapshot.routes.total, avgScore: snapshot.routes.avgScore, weakestCap: snapshot.routes.weakestCap },
    weakestPillar: snapshot.weakestPillar,
    pillars: (snapshot.pillars || []).map(p => ({ domain: p.domain, entries: p.entries, min: p.min, score: p.score })),
    perf: { allRoutesWarmMs: snapshot.perf.allRoutesWarmMs, summaryMs: snapshot.perf.summaryMs, kbBytes: snapshot.perf.kbBytes, kbProbeColdMs: snapshot.perf.kbProbeColdMs, kbProbeWarmMs: snapshot.perf.kbProbeWarmMs },
    bundle: { bytes: snapshot.bundle.bytes, tigamodelMinifiedBytes: snapshot.bundle.tigamodelMinifiedBytes },
    barsOk: snapshot.barsOk,
    appVersion: snapshot.appVersion,
  };
  hist.push(entry);
  fs.writeFileSync(HIST, JSON.stringify(hist, null, 2) + "\n");
  console.log(`✅ history appended (round ${snapshot.loopRound}, ${hist.length} rounds) → ${HIST}`);
  console.log(`\n${snapshot.generatedAt} — ${benchOneLine(snapshot, prev)}`);
} catch (e) {
  console.error(`⚠️ history append failed (snapshot itself is safe): ${e.message}`);
}
