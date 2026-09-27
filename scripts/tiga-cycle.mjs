/* ── tiga-cycle.mjs — plan v3.3 8.1 (cycle:tiga) + 8.4 (report:tiga, --digest)
   8.1 `npm run cycle:tiga`  — opens a flywheel cycle in one command: prints the
       #1 workOrder task, the SOP checklist, and a pre-cycle bench baseline.
       Target: cycle prep from ~30 min of manual steps → ≤ 2 min.
   8.4 `npm run report:tiga` — the one page the owner reads (30 s): grid,
       READY routes, what improved since last release, next queue, decisions
       pending. `--digest` = the 30-second weekly version.

   All numbers come from the REAL engine (esbuild the real web.js, import it,
   never a copy — repo convention). Exit 1 on engine failure; never invents data. ── */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SNAP = path.join(ROOT, "docs", "tiga-bench-latest.json");
const OUT = "node_modules/.tmp-tiga-cycle";
const mode = process.argv[2] || "report";
const digest = process.argv.includes("--digest");

/* boot the real engine exactly like tiga-bench does */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
execSync(
  `npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --log-level=error`,
  { stdio: "pipe", cwd: ROOT }
);
const web = await import(url.pathToFileURL(path.join(ROOT, `${OUT}/web.js`)).href);
web.resetCapabilityEngineForTest();
const eng = web.getCapabilityEngine();
const grid = web.plm1mStats();
const cap = web.capabilitySummary();
const queue = web.unifiedWorkOrder(3) || [];
fs.rmSync(OUT, { recursive: true, force: true });

let prev = null;
try { prev = JSON.parse(fs.readFileSync(SNAP, "utf8")); } catch (e) {}

const kb = (x) => (typeof x === "number" ? `${(x / 1024).toFixed(1)} kB` : "-");
const pct = (v) => (typeof v === "number" ? `${v}%` : "-");

/* ── 8.1: open the cycle ── */
if (mode === "cycle") {
  const dirty = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf8" }).trim();
  console.log("วงล้อ TIGA — เปิดรอบใหม่ (8.1)");
  console.log("=".repeat(46));
  if (dirty) {
    console.error("\n❌ working tree ยังไม่สะอาด — commit/เก็บงานรอบก่อนก่อนเปิดรอบใหม่ (SOP ขั้น ⑥)");
    console.error("   ดู: git status --short");
    process.exit(1);
  }
  const top = queue[0];
  console.log("\nงานอันดับ 1 จากคิวจริงของเอนจิน:");
  if (top) {
    console.log(`  หัวข้อ: ${top.th} / ${top.en}`);
    console.log(`  สถานะสตรีม: ${top.status} · เซลล์ที่แตะ: ${(top.cells || 0).toLocaleString()} · คะแนนเฉลี่ยเส้นทาง: ${top.avgRouteScore ?? "-"}`);
    console.log(`  ก้าวถัดไป: ${top.nextWork || "-"}`);
  } else {
    console.log("  (คิวว่าง — ดูคิวแผนใน docs/TIGA_MODEL_DEV_PLAN.md §5 แทน)");
  }
  console.log("\nเช็กลิสต์รอบนี้ (จาก SOP docs/TIGA_FLYWHEEL_SOP.md):");
  console.log("  ① งานเลือกแล้ว (ด้านบน) — ย่อให้เล็กที่สุดที่ขยับตัวเลขได้");
  console.log("  ② ทำ 1 โมดูลจริง (reuse เอนจินเดิม · honest-null · 3 ภาษาครบ)");
  console.log("  ③ npm run verify:tiga        ← แดงตัวเดียว = ห้ามไปต่อ");
  console.log("  ④ npm run bench:tiga         ← ตัวเลขต้องมาจากเอนจิน ไม่ใช่มือ");
  console.log("  ⑤ อัปเดตสถานะข้องานใน docs/TIGA_MODEL_DEV_PLAN.md (✅ + ตัวเลขจริง)");
  console.log("  ⑥ commit → push (ระบบรีลิสเดิมจัดการต่อ)");
  if (prev) {
    console.log(`\nเส้นฐานก่อนเริ่มรอบ: กริด ${pct(prev.grid && prev.grid.startedPct)} · READY ${prev.routes && prev.routes.ready}/${prev.routes && prev.routes.total} · ก้อนหลัก ${kb(prev.bundle && prev.bundle.bytes)}`);
  }
  console.log("\nพร้อมลงมือ — เปิดรอบใช้เวลาเตรียม < 2 นาที (เป้า 8.1: จาก ~30 นาที)");
  process.exit(0);
}

/* ── 8.4: the owner's one page ── */
if (mode !== "report") {
  console.error("ใช้: node scripts/tiga-cycle.mjs [report|cycle] [--digest]");
  process.exit(1);
}

const bars = (prev && prev.bars) || [];
const barsPass = bars.filter((b) => b.pass).length;
const langs = (prev && prev.langs) || {};

if (digest) {
  console.log("สรุปสัปดาห์นี้ (อ่าน 30 วินาที)");
  console.log("=".repeat(46));
  console.log(`• ความคืบหน้าโมเดล: เดินความรู้ไปแล้ว ${pct(grid.startedPct)} ของแผนล้านชิ้น (${(grid.started || 0).toLocaleString()}/1,000,000)`);
  console.log(`• คุณภาพเส้นทางสอน: ผ่านเกณฑ์ ${cap.ready}/${cap.total} เส้นทาง (${cap.readyPct}%)`);
  console.log(`• ด่านคุณภาพอัตโนมัติ: ${barsPass}/${bars.length} ผ่าน · ภาษาไทย/อังกฤษ/จีน ${langs.th === true ? "✓" : "?"}/${langs.en === true ? "✓" : "?"}/${langs.zh === true ? "✓" : "?"}`);
  console.log(`• ขนาดแอปส่วนหน้า: ${kb(prev && prev.bundle && prev.bundle.bytes)} (ยิ่งเบายิ่งโหลดไว)`);
  if (prev && prev.perf && prev.perf.memoSpeedup) console.log(`• ความเร็วเอนจิน: อ่านซ้ำเร็วขึ้น ${prev.perf.memoSpeedup}×`);
  console.log("\nงานถัดไปที่ระบบแนะนำ:");
  for (const q of queue.slice(0, digest ? 1 : 3)) console.log(`  • ${q.th} (${q.status})`);
  console.log("\nรอการตัดสินใจ: ดู §6 ใน docs/TIGA_MODEL_DEV_PLAN.md (SQL/เทสเครื่องจริง)");
  process.exit(0);
}

console.log("รายงาน TIGA — หน้าเดียวจบ (8.4)");
console.log("=".repeat(46));
console.log(`\n▸ โมเดลเดินความรู้ถึงไหน: ${pct(grid.startedPct)} ของแผน 1,000,000 ชิ้น (${(grid.started || 0).toLocaleString()} ชิ้นเริ่มแล้ว)`);
console.log(`▸ คุณภาพเส้นทางสอน: READY ${cap.ready}/${cap.total} (${cap.readyPct}%) · จุดอ่อนสุด: ${(cap.weakestCap && cap.weakestCap.cap) || "-"}`);
console.log(`▸ ด่านคุณภาพอัตโนมัติ (Q-bars): ${barsPass}/${bars.length} ผ่าน`);
console.log(`▸ ภาษาผ่านครบ: ไทย ${langs.th === true ? "✓" : "✗"} · อังกฤษ ${langs.en === true ? "✓" : "✗"} · จีน ${langs.zh === true ? "✓" : "✗"}`);
if (prev && prev.bundle) console.log(`▸ แอปโหลดเร็วแค่ไหน: ก้อนหลัก ${kb(prev.bundle.bytes)} · ส่วนเอนจินแยก lazy ${kb(prev.bundle.tigamodelMinifiedBytes)}`);
if (prev && prev.perf) console.log(`▸ ความเร็วเอนจิน: sweep เย็น ${prev.perf.allRoutesColdMs}ms → ซ้ำ ${prev.perf.allRoutesWarmMs}ms (เร็วขึ้น ${prev.perf.memoSpeedup}×)`);

if (prev && prev.generatedAt) {
  console.log(`\n▸ เทียบรอบก่อน (snapshot ${String(prev.generatedAt).slice(0, 10)}): กริด ${pct(prev.grid && prev.grid.startedPct)} · READY ${prev.routes && prev.routes.ready} · ก้อนหลัก ${kb(prev.bundle && prev.bundle.bytes)}`);
  console.log("  (รัน npm run bench:tiga หลังงานใหม่ทุกรอบ เพื่อเห็น delta ตรงนี้)");
}

console.log("\n▸ คิวงานถัดไป (จากตัวเลขจริง ไม่ใช่ความรู้สึก):");
queue.forEach((q, i) => console.log(`  ${i + 1}. ${q.th} / ${q.en} — ${q.status} (${(q.cells || 0).toLocaleString()} เซลล์)`));

console.log("\n▸ รอการตัดสินใจจากคุณ:");
console.log("  • SQL 4.4 (ตารางหลักฐานกลยุทธ์): ไฟล์พร้อม — วางใน Supabase SQL Editor แล้ว Run");
console.log("  • เทสบนเครื่องจริง Android/PWA: ดาวน์โหลด APK debug ล่าสุดจาก GitHub Release ลองเล่น");
console.log("\nรายงานเต็ม: docs/TIGA_MODEL_DEV_PLAN.md §6 · SOP: docs/TIGA_FLYWHEEL_SOP.md");
