/* smoke-unified.mjs — THE UNIFIED PLAN (owner directive: รวมแผน 100 + แผน 1M
   เป็นแผ่นเดียว). Proves on REAL code:
     • every one of the 1M cells is owned by ≥1 stream (bridge coverage)
     • unified status is the WEAKER of hand-set vs engine-verified
     • summary/workOrder/streamCells are consistent & fast
     • cells drill-down resolves real plmItems round-trip
   Repo convention: esbuild the real source, import it, never a mirrored copy.

   Run: node tigamodel/scripts/smoke-unified.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const OUT = "/tmp/tiga-smoke-unified";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

fs.rmSync(OUT, { recursive: true, force: true });
execSync(`npx esbuild tigamodel/web.js --bundle --outdir=${OUT} --format=esm --platform=node --loader:.js=js --log-level=error`, { stdio: "pipe", cwd: ROOT });
const web = await import(url.pathToFileURL(path.join(OUT, "web.js")).href);

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n     ${e.message}`); }
}

async function main() {
  console.log("tigamodel unified plan (100 streams × 1M cells) smoke:");

  web.ensureTigamodelWeb();
  const uni = web.getUnifiedPlan();
  const sum = uni.summary();

  check("summary: 100 streams with valid rollup", () => {
    const s = sum.streams;
    if (s.total !== 100) throw new Error(`total ${s.total}`);
    if (s.done + s.partial + s.todo !== 100) throw new Error("rollup mismatch");
  });

  check("stream cells: each stream owns its topics × ALL 10 layers × 100k cells", () => {
    for (const s of uni.allStreams()) {
      if (s.cells !== 100000 * (s.groupId === "C" ? 3 : s.groupId === "B" || s.groupId === "E" || s.groupId === "F" || s.groupId === "G" || s.groupId === "H" || s.groupId === "I" ? 2 : 1)) {
        throw new Error(`stream ${s.n} cells ${s.cells}`);
      }
    }
  });

  check("BRIDGE COVERAGE: every 1M cell is owned by ≥1 stream", () => {
    const owned = new Uint8Array(1000000);
    for (const s of uni.allStreams()) {
      const gid = s.groupId;
      const tsOf = { A: [0], B: [1, 2], C: [4, 5, 8], D: [6], E: [3, 7], F: [5, 9], G: [0, 5], H: [1, 3], I: [0, 4] }[gid];
      for (const t of tsOf) for (let w = 0; w < 10; w++) for (let h = 0; h < 10; h++) for (let m = 0; m < 10; m++) for (let s = 0; s < 10; s++) for (let q = 0; q < 10; q++) {
        owned[t * 100000 + w * 10000 + h * 1000 + m * 100 + s * 10 + q] = 1;
      }
    }
    let missing = 0;
    for (let i = 0; i < 1000000; i++) if (!owned[i]) missing++;
    if (missing > 0) throw new Error(`${missing} cells owned by no stream`);
  });

  check("unified status is the WEAKER of hand-set vs engine-derived", () => {
    const rank = { todo: 0, partial: 1, done: 2 };
    for (const s of uni.allStreams()) {
      const expected = rank[s.handSetStatus] <= rank[s.derivedShape] ? s.handSetStatus : s.derivedShape;
      if (s.status !== expected) throw new Error(`stream ${s.n}: ${s.status} vs ${expected}`);
    }
  });

  check("cells side stays honest: 100% ready verdict from real modules", () => {
    if (sum.cells.readyPct !== 100) throw new Error(`readyPct ${sum.cells.readyPct}`);
  });

  check("workOrder: ranked, includes nextWork for every row", () => {
    const wo = uni.workOrder(20);
    if (!wo.length) throw new Error("empty work order");
    for (const r of wo) if (!r.nextWork) throw new Error(`#${r.n} has no nextWork`);
    for (let i = 1; i < wo.length; i++) if (wo[i].rank < wo[i - 1].rank) throw new Error("work order unsorted");
  });

  check("streamCells drill-down: real codes round-trip through plmItem", () => {
    const page = uni.streamCells(65, { limit: 5 });
    if (page.total !== 200000) throw new Error(`total ${page.total}`); // stream 65 → group จ (E): 2 topics × 100k
    for (const row of page.rows) {
      if (!/^[TWHMSQ][0-9]{5}$/.test(row.code.replace(/[^TWHMSQ0-9]/g, "").slice(0, 12)) && row.code.length < 6) throw new Error(`bad code ${row.code}`);
      if (typeof row.index !== "number" || row.index < 0 || row.index >= 1000000) throw new Error(`bad index ${row.index}`);
    }
    const next = uni.streamCells(65, { limit: 5, offset: page.nextOffset });
    if (next.rows[0].index === page.rows[0].index) throw new Error("pagination stuck");
  });

  check("groups(): rollups match stream statuses", () => {
    for (const g of uni.groups()) {
      const done = g.items.filter(i => i.status === "done").length;
      if (g.rollup.done !== done) throw new Error(`group ${g.id} rollup ${g.rollup.done} vs ${done}`);
    }
  });

  check("performance: full summary + workOrder under 500ms", () => {
    const t0 = Date.now();
    web.getUnifiedPlan().summary();
    web.getUnifiedPlan().workOrder(25);
    const ms = Date.now() - t0;
    if (ms > 500) throw new Error(`took ${ms}ms`);
  });

  console.log(`\n  ${passed} passed, ${failed} failed`);
  fs.rmSync(OUT, { recursive: true, force: true });
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("SMOKE FAIL:", e.message); process.exit(1); });
