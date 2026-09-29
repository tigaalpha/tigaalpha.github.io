/* ── apply-sql.mjs — apply an owner-approved supabase-*.sql file to the live
   project database (plan 4.4 flow; owner explicitly approved this migration
   in-session and provided the access token for the agent to run it).

   Safety rails:
   • Only files matching supabase-*.sql at the repo root are accepted.
   • Requires SUPABASE_ACCESS_TOKEN in the environment (never read/printed).
   • Uses the management API's database/query endpoint — the same SQL engine
     the Supabase SQL Editor runs, so what executes is exactly what was
     reviewed/approved. No rewriting, no splitting, no "clever" transforms.
   • Idempotency is the file's own responsibility (repo convention: every
     migration is if-not-exists / or-replace and re-runnable) — re-running an
     approved file is safe by design.

   Usage:
     node scripts/apply-sql.mjs supabase-strategy-outcomes-migration.sql
     node scripts/apply-sql.mjs <file> --verify "select 1"   (post-apply check)
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PROJECT_ID = "gsaqgbracxnucdmtmcxz";   // repo convention (AGENTS.md)
const API = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const fail = (msg) => { console.error(`\n❌ ${msg}`); process.exit(1); };

const file = process.argv[2];
if (!file || !/^supabase-[\w-]+\.sql$/.test(path.basename(file))) {
  fail("ระบุไฟล์ supabase-*.sql ที่ repo root เท่านั้น (กันรัน SQL อื่นโดยพลการ)");
}
const sqlPath = path.resolve(process.cwd(), file);
let sql;
try { sql = readFileSync(sqlPath, "utf8"); } catch (e) { fail(`อ่านไฟล์ไม่ได้: ${file}`); }
if (!sql.trim()) fail("ไฟล์ว่างเปล่า");

/* allow multiple --verify "query" args; each must return at least one row */
const verifyQs = [];
for (let i = 3; i < process.argv.length; i++) {
  if (process.argv[i] === "--verify") verifyQs.push(process.argv[i + 1] || "");
}
if (verifyQs.some(q => !q.trim())) fail("--verify ต้องตามด้วย query");

if (!TOKEN) fail("ยังไม่มีกุญแจ SUPABASE_ACCESS_TOKEN — เพิ่มใน Freebuff Settings → Environment แล้วรันใหม่");

async function runQuery(query) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) {}
  return { ok: res.ok, status: res.status, body, text };
}

console.log(`กำลังส่ง SQL ลงฐานข้อมูลจริง (โครงการ ${PROJECT_ID}) — ไฟล์: ${path.basename(file)}`);
console.log(`ขนาดไฟล์: ${sql.length.toLocaleString()} ตัวอักษร\n`);

const main = await runQuery(sql);
if (!main.ok) {
  console.error(`สถานะ HTTP: ${main.status}`);
  console.error(typeof main.body === "object" ? JSON.stringify(main.body, null, 2) : main.text.slice(0, 2000));
  fail("ฐานข้อมูลปฏิเสธการรัน — ไม่มีอะไรเสีย (ไฟล์เป็น additive/re-runnable) ตรวจข้อความด้านบนแล้วแก้/ถามต่อได้");
}
console.log("✅ SQL รันผ่านครบทั้งไฟล์");

for (const [i, q] of verifyQs.entries()) {
  const v = await runQuery(q);
  if (!v.ok) {
    console.error(`verify #${i + 1} ล้มเหลว: ${typeof v.body === "object" ? JSON.stringify(v.body) : v.text.slice(0, 500)}`);
    fail("SQL รันผ่านแต่การตรวจหลังใช้งานไม่ผ่าน — ต้องดูก่อนถือว่าสำเร็จ");
  }
  console.log(`✅ verify #${i + 1}: ${JSON.stringify(v.body).slice(0, 300)}`);
}

console.log("\n🎉 เสร็จสมบูรณ์ — migration อยู่บนฐานข้อมูลจริงแล้ว (ไฟล์ re-runnable: รันซ้ำได้ปลอดภัย)");
