/* ── verify-strategy-outcomes.mjs — end-to-end check of the strategy_outcomes
   telemetry loop (plan 4.4, now live). Two layers, both honest:

   LAYER A (authoritative — SQL via the management API): the functions work,
   validate input, and aggregate; RLS policies exist. This never lies.
   LAYER B (the app's real path — anon RPC through PostgREST): after a fresh
   migration the API layer's schema cache can take a minute to notice new
   functions, so the anon check RETRIES and reports "cache still warming"
   distinctly from a real failure.

   Re-runnable: inserts one synthetic row under a never-used strategy id,
   then DELETES it so real evidence stays clean. Never prints secrets.

   Run: node scripts/verify-strategy-outcomes.mjs
*/
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/* The app's REAL project comes from supabase-client.ts (hardcoded there, not
   from NEXT_PUBLIC_* env vars — the workspace defaults point elsewhere, which
   made layer B chase the wrong database on the first run). Parse the public
   constants from the app's own source so the test uses the identical target.
   The anon key is public by design (shipped in the frontend bundle). */
function appSupabaseConfig() {
  const src = readFileSync("supabase-client.ts", "utf8");
  const url = src.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1];
  if (!url || !key) fail("อ่าน SUPABASE_URL/ANON_KEY จาก supabase-client.ts ไม่ได้");
  return { url, key };
}

const PROJECT_ID = "gsaqgbracxnucdmtmcxz";
const API = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const { url: APP_URL, key: APP_ANON } = appSupabaseConfig();

const fail = (m) => { console.error(`❌ ${m}`); process.exit(1); };
if (!TOKEN) fail("ต้องมี SUPABASE_ACCESS_TOKEN");

const TEST_ID = "smoke/test-strategy-outcome-e2e";   // never a real strategy id
let passed = 0, failed = 0;
const ok = (m) => { passed++; console.log(`  ✅ ${m}`); };
const bad = (m) => { failed++; console.log(`  ❌ ${m}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function mgmtQuery(query) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch (e) {}
  return { ok: res.ok, body, text };
}

const sb = createClient(APP_URL, APP_ANON);

console.log("ตรวจระบบสมุดบันทึกผลลัพธ์การสอน (strategy_outcomes) — 2 ชั้น:\n");
console.log("ชั้น A — พิสูจน์ที่ฐานข้อมูลโดยตรง (เชื่อถือได้แน่นอน):");

/* A1. submit works (the SECURITY DEFINER RPC, called as SQL).
   NOTE: smallint params need explicit casts — bare numeric literals are int4
   and int4→int2 is assignment-only, so an uncast call can't resolve the
   function (that was this script's own first-run bug, not the migration's). */
const a1 = await mgmtQuery(`select public.submit_strategy_outcome('${TEST_ID}', 'practice', 'th', 2::smallint, 'great', 1::smallint);`);
a1.ok ? ok("บันทึกผลลัพธ์ผ่านฟังก์ชันได้ (submit_strategy_outcome)") : bad(`submit ล้ม: ${a1.text.slice(0, 200)}`);

/* A2. aggregate read-back returns the counts we just wrote */
let agg = null;
if (a1.ok) {
  const a2 = await mgmtQuery(`select public.strategy_evidence('${TEST_ID}') as ev;`);
  agg = a2.ok && a2.body && a2.body[0] ? a2.body[0].ev : null;
  (agg && agg.total >= 1 && agg.improved >= 1)
    ? ok(`สรุปผลถูกนับจริง: total=${agg.total} improved=${agg.improved} same=${agg.same} worse=${agg.worse}`)
    : bad(`ตัวเลขไม่ตรงที่บันทึก: ${a2.ok ? JSON.stringify(agg) : a2.text.slice(0, 200)}`);
}

/* A3. invalid input is rejected BY THE FUNCTION (not by a cache accident) */
const a3 = await mgmtQuery(`select public.submit_strategy_outcome('${TEST_ID}', 'hacker_surface', 'th', 2::smallint, null, 1::smallint);`);
(a3.ok === false && /invalid surface/i.test(a3.text))
  ? ok("ค่าผิดกฎถูกปฏิเสธที่ตัวฟังก์ชัน (invalid surface)")
  : bad(a3.ok ? "⚠️ ค่าผิดกฎผ่าน! ฟังก์ชันควรปฏิเสธ" : `ปฏิเสธแล้วแต่ข้อความไม่ตรง: ${a3.text.slice(0, 120)}`);

/* A4. outcome clamping: |outcome| > 1 must be rejected */
const a4 = await mgmtQuery(`select public.submit_strategy_outcome('${TEST_ID}', 'practice', 'th', 2::smallint, null, 99::smallint);`);
(a4.ok === false && /invalid outcome/i.test(a4.text))
  ? ok("ผลลัพธ์นอกช่วง {-1,0,1} ถูกปฏิเสธ (กันโกงตัวเลข)")
  : bad(a4.ok ? "⚠️ outcome=99 ผ่าน! ตรวจ check constraint/RPC" : "ปฏิเสธแต่ข้อความไม่ตรง");

/* A5. RLS: INSERT-only for clients, no SELECT/UPDATE/DELETE policy */
const a5 = await mgmtQuery(`select policyname, cmd from pg_policies where schemaname='public' and tablename='strategy_outcomes' order by policyname;`);
const policies = a5.ok && Array.isArray(a5.body) ? a5.body : [];
(policies.length === 1 && policies[0].cmd === "INSERT")
  ? ok(`นโยบายฐานข้อมูลถูกต้อง: มีเพียง ${policies[0].policyname} (INSERT เท่านั้น — อ่านแถวดิบไม่ได้ตามออกแบบ)`)
  : bad(`นโยบายไม่ตรงแบบ: ${JSON.stringify(policies)}`);

/* A6. cleanup the synthetic row */
const a6 = await mgmtQuery(`delete from public.strategy_outcomes where strategy_id = '${TEST_ID}';`);
const a6b = await mgmtQuery(`select count(*)::int as n from public.strategy_outcomes where strategy_id = '${TEST_ID}';`);
(a6.ok && a6b.ok && a6b.body && a6b.body[0].n === 0)
  ? ok("แถวทดสอบถูกลบหมด — ฐานข้อมูลสะอาดเหมือนก่อนทดสอบ")
  : bad(`ลบแถวทดสอบไม่หมด (ตรวจด้วยมือ: strategy_id = '${TEST_ID}')`);

console.log("\nชั้น B — เส้นทางจริงของแอป (anon RPC ผ่านชั้น API):");

/* B0. ask the API layer to reload its schema cache — two documented channels:
   the management reload-schema endpoint, then the pgrst notify as fallback */
let rlOk = false;
try {
  const ep = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/reload-schema`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  rlOk = ep.ok;
  if (!ep.ok) console.log(`  (reload-schema endpoint: ${ep.status} — ใช้ notify แทน)`);
} catch (e) { /* network shape varies; notify still below */ }
const rl = await mgmtQuery("notify pgrst, 'reload schema';");
if (!rl.ok && !rlOk) fail(`รีโหลดสคีมาไม่ได้ทั้งสองช่องทาง: ${rl.text.slice(0, 200)}`);
/* a harmless metadata touch (DDL) — Supabase auto-reloads PostgREST on DDL,
   which usually un-sticks the cache faster than notify alone */
await mgmtQuery(`comment on function public.strategy_evidence(text) is 'aggregate-only evidence read for the TIGA policy engine (plan 4.4)';`);
await sleep(3000);

/* B1. submit through the app's exact path, retrying while the cache warms */
let submitErr = null;
for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    const { error } = await sb.rpc("submit_strategy_outcome", {
      p_strategy_id: TEST_ID, p_surface: "practice", p_lang: "th",
      p_accuracy_bucket: 2, p_self_report: "great", p_outcome: 1,
    });
    submitErr = error || null;
  } catch (e) { submitErr = e; }
  if (!submitErr || !/schema cache/i.test(submitErr.message || "")) break;
  if (attempt < 6) await sleep(5000);
}
if (!submitErr) ok("แอปส่งข้อมูลผ่านชั้น API ได้จริง (เส้นทางเดียวกับที่ผู้เรียนใช้)");
else if (/schema cache/i.test(submitErr.message || "")) {
  failed++; console.log(`  ⏳ ชั้น API ยังแคชสคีมาเก่า (ฟังก์ชันใหม่เพิ่งสร้าง) — ฐานข้อมูลระดับ SQL พิสูจน์แล้วชั้น A ครบ; รันสคริปต์นี้ซ้ำใน 2-3 นาที จะเขียวเต็ม`);
} else bad(`ส่งผ่านชั้น API ล้มด้วยเหตุผลอื่น: ${submitErr.message}`);

/* B2. aggregate through the app's read path (same retry semantics) */
if (!submitErr) {
  let evErr = null, ev = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error } = await sb.rpc("strategy_evidence", { p_strategy_id: TEST_ID });
    evErr = error || null;
    if (!evErr) { ev = Array.isArray(data) ? data[0] : data; break; }
    if (!/schema cache/i.test(evErr.message || "")) break;
    await sleep(4000);
  }
  if (!evErr && ev) ok(`อ่านสรุปผ่านชั้น API ได้: total=${ev.total} improved=${ev.improved}`);
  else if (evErr && /schema cache/i.test(evErr.message || "")) { failed++; console.log("  ⏳ อ่านสรุปยังโดนแคชเดิม — รันซ้ำภายหลัง"); }
  else bad(`อ่านสรุปล้ม: ${evErr && evErr.message}`);
  /* remove the row this B-layer run added */
  await mgmtQuery(`delete from public.strategy_outcomes where strategy_id = '${TEST_ID}';`);
}

console.log(`\nผลตรวจ: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
process.exit(failed ? 1 : 0);
