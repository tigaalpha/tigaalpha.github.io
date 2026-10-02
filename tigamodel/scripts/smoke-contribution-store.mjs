/* Smoke: the contribution store + its migration (docs/09 layer 1, m26).
   The migration is WRITTEN but NOT applied, so this smoke proves what can be
   proven without the database: the row-shaping and moderation rules on the
   REAL modules, and the SQL file's own safety invariants read from its text.

   What must hold (and would be the bug if it didn't):
     1. a client's row is ALWAYS status 'pending' — whatever it passed
     2. the gate's verdict and every rejection reason survive into the row
     3. moderation needs an admin tier, a real id, a dec status and a written
        reason — and nothing else passes
     4. a gate-rejected or unattributed row cannot be approved
     5. the SQL: RLS lets a client insert only 'pending' and read only its own
        rows, there is no UPDATE/DELETE policy, and the only status-changing
        path is an admin-gated RPC that demands a note

   Run: node tigamodel/scripts/smoke-contribution-store.mjs  (exit 1 on any fail) */

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-smoke-contrib-store";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });
execSync(`npx esbuild tigamodel/compliance/contribution-store.js --bundle --outfile=${OUT}/p4/store.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
execSync(`npx esbuild tigamodel/compliance/kb-compliance.js --bundle --outfile=${OUT}/p4/gate.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });

const { submissionToRow, moderateArgs, canModerate, queueStats, approvalBlockers, reasonsOf, creditSourceFor, creditedEntryFor, sourceIdFor, CONTRIBUTION_STATUSES, DECIDABLE_STATUSES } =
  await import(pathToFileURL(`${OUT}/p4/store.js`).href);
const { auditKB } = await import(pathToFileURL(`${OUT}/p4/gate.js`).href);

const SQL = readFileSync("supabase-knowledge-contributions-migration.sql", "utf8");

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

console.log("smoke-contribution-store (docs/09 layer 1, m26):\n");

const goodSub = {
  content: { title: "จังหวะซ้อมแบบ 4 จังหวะ", body: "ให้นักเรียนเทียบเสียงกับเมโทรโนนด์วิวต้องครบ 4 จังหวะก่อนเพิ่มความเร็ว แล้วค่อยๆ เพิ่มทีละ 4 BPM", domain: "rhythm" },
  license: "contributor-own-work",
  source: { kind: "own-work" },
  contributor: { id: "11111111-2222-3333-4444-555555555555", name: "ครูเต" },
};
const anonSub = { ...goodSub, contributor: { name: "ไม่บอกชื่อ" } };
const copiedSub = { ...goodSub, license: "unknown-license", source: { kind: "own-work" } };

console.log("A) แถวที่ผู้ส่งสร้างได้");
check("the row is built from the real gate verdict, and is always pending", () => {
  const row = submissionToRow(goodSub);
  assert.strictEqual(row.status, "pending");
  assert.strictEqual(row.gate_verdict, "clean");
  assert.deepStrictEqual(row.gate_reasons, []);
  assert.strictEqual(row.contributor_id, "11111111-2222-3333-4444-555555555555");
  assert.strictEqual(row.license, "contributor-own-work");
  assert.strictEqual(row.title, "จังหวะซ้อมแบบ 4 จังหวะ");
});

check("a caller-supplied status is dropped on the floor — the client cannot approve", () => {
  for (const fake of ["approved", "rejected", "PENDING", 1, { status: "approved" }]) {
    const row = submissionToRow({ ...goodSub, status: fake });
    assert.strictEqual(row.status, "pending", `passed ${JSON.stringify(fake)}`);
  }
});

check("the gate's every reason survives into the row (the audit trail)", () => {
  const row = submissionToRow(anonSub);
  assert.strictEqual(row.gate_verdict, "rejected");
  assert.ok(row.gate_reasons.length >= 1, "at least the identity reason");
  assert.ok(row.gate_reasons.some(r => r.includes("ระบุตัวตน")), "the identity reason is kept verbatim");
  const bad = submissionToRow(copiedSub);
  assert.strictEqual(bad.gate_verdict, "rejected");
  assert.ok(bad.gate_reasons.some(r => r.includes("license")), "the license reason is kept");
  assert.deepStrictEqual(reasonsOf({ reasons: "not an array" }), [], "a malformed verdict yields no invented reasons");
  assert.deepStrictEqual(reasonsOf(null), []);
});

check("an unusable submission produces a row a reviewer can still see and close", () => {
  const row = submissionToRow(null);
  assert.strictEqual(row.status, "pending");
  assert.strictEqual(row.gate_verdict, "rejected");
  assert.ok(row.gate_reasons.length >= 1);
  assert.strictEqual(row.title, "");
  assert.strictEqual(row.contributor_id, null);
});

console.log("\nB) ใครมีสิทธิ์ตัดสิน");
check("only an admin may moderate — tier, never a caller-provided flag", () => {
  assert.strictEqual(canModerate({ adminTier: 1 }), true);
  assert.strictEqual(canModerate({ adminTier: 3 }), true);
  for (const t of [0, -1, null, undefined, "3", NaN]) assert.strictEqual(canModerate({ adminTier: t }), false, `tier=${t}`);
  assert.strictEqual(canModerate({ isAdmin: true }), false, "an asserted flag is not a tier");
});

check("a decision needs an admin, a real id, a dec status and a written reason", () => {
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const okArgs = moderateArgs(id, "approved", "ผ่านประตูแล้ว เนื้อหาตรงหลักสูตร ตรวจแหล่งที่มาแล้ว", { adminTier: 1 });
  assert.strictEqual(okArgs.ok, true);
  assert.deepStrictEqual(okArgs.args, { p_id: id, p_status: "approved", p_note: "ผ่านประตูแล้ว เนื้อหาตรงหลักสูตร ตรวจแหล่งที่มาแล้ว" });
  assert.strictEqual(moderateArgs(id, "approved", "ok", { adminTier: 0 }).ok, false, "not an admin");
  assert.strictEqual(moderateArgs("not-a-uuid", "approved", "ok", { adminTier: 1 }).reason, "contribution id is required");
  assert.strictEqual(moderateArgs(null, "approved", "ok", { adminTier: 1 }).reason, "contribution id is required");
  for (const s of ["pending", "", null, "APPROVED", 1]) assert.strictEqual(moderateArgs(id, s, "ok", { adminTier: 1 }).ok, false, `status=${s}`);
  for (const n of ["", "   ", null, undefined]) assert.strictEqual(moderateArgs(id, "rejected", n, { adminTier: 1 }).reason, "a written reason is required");
  assert.deepStrictEqual(DECIDABLE_STATUSES, ["approved", "rejected"]);
});

check("the reason is trimmed, never stored empty", () => {
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const a = moderateArgs(id, "rejected", "  เนื้อหาซ้ำกับแหล่งที่มีอยู่แล้ว  ", { adminTier: 2 });
  assert.strictEqual(a.args.p_note, "เนื้อหาซ้ำกับแหล่งที่มีอยู่แล้ว");
});

check("a gate-rejected or unattributed row cannot be approved", () => {
  assert.ok(approvalBlockers({ gate_verdict: "rejected", contributor_id: "x", license: "cc-by" }).length >= 2);
  assert.ok(approvalBlockers({ gate_verdict: "clean", contributor_id: null, license: "cc-by" }).some(b => b.includes("ผู้ส่ง")));
  assert.ok(approvalBlockers({ gate_verdict: "clean", contributor_id: "x", license: "" }).some(b => b.includes("license")));
  assert.deepStrictEqual(approvalBlockers({ gate_verdict: "clean", contributor_id: "x", license: "cc-by" }), [], "a clean row has no blocker");
  assert.deepStrictEqual(approvalBlockers(null), ["no contribution"]);
});

check("queue stats count only what is there", () => {
  const s = queueStats([
    { status: "pending", gate_verdict: "clean" },
    { status: "pending", gate_verdict: "rejected" },
    { status: "approved", gate_verdict: "clean" },
    { status: "rejected", gate_verdict: "rejected" },
    { status: "weird" },
    null,
  ]);
  assert.strictEqual(s.pending, 2);
  assert.strictEqual(s.approved, 1);
  assert.strictEqual(s.rejected, 1);
  assert.strictEqual(s.unknown, 1, "an unexpected status is counted, never folded into pending");
  assert.strictEqual(s.total, 5);
  assert.strictEqual(s.needsAttention, 1, "only the gate-rejected pending row needs a look");
  assert.deepStrictEqual(queueStats(null), { pending: 0, approved: 0, rejected: 0, unknown: 0, total: 0, needsAttention: 0 });
  assert.strictEqual(queueStats([]).total, 0);
  assert.deepStrictEqual([...CONTRIBUTION_STATUSES], ["pending", "approved", "rejected"]);
});

console.log("\nB2) เครดิตผู้ร่วมสร้าง (m27)");
check("only an APPROVED row earns credit — a pending row yields no entry", () => {
  const row = { ...submissionToRow(goodSub), contributor_name: "ครูเต" };
  assert.strictEqual(creditedEntryFor({ ...row, status: "pending" }), null, "pending = no credit yet");
  assert.strictEqual(creditedEntryFor({ ...row, status: "rejected" }), null, "rejected = no credit");
  assert.strictEqual(creditedEntryFor(null), null);
});

check("an approved row becomes a REGISTERED source carrying the author's name", () => {
  const row = { ...submissionToRow(goodSub), status: "approved", contributor_name: "ครูเต" };
  const id = sourceIdFor(row);
  assert.strictEqual(id, "tiga-contrib:11111111-2222-3333-4444-555555555555", "own-work keeps the gate's own-work id");
  const reg = creditSourceFor(row);
  assert.strictEqual(Object.keys(reg).length, 1);
  const src = reg[id];
  assert.strictEqual(src.contributor_name, "ครูเต", "the name lives in the registry, not a comment");
  assert.strictEqual(src.contributor_id, "11111111-2222-3333-4444-555555555555");
  assert.strictEqual(src.license, "contributor-own-work");
  assert.ok(src.title.includes("ครูเต"), "and in the human-readable title");
  assert.strictEqual(creditSourceFor({ ...row, license: "" }), null, "no declared license = no source record");
  assert.strictEqual(sourceIdFor({ contributor_id: "", title: "x" }), null);
});

check("a public-fact contribution gets a contrib: id that REQUIRES the registry", () => {
  const factSub = {
    content: { title: "จังหวะช้าแบบมือขวา", body: "ฝึกจังหวะช้าด้วยมือขวาเดี่ยวก่อน แล้วค่อยเพิ่มมือซ้ายทีละจังหวะ", domain: "accompaniment" },
    license: "cc-by",
    source: { kind: "public-fact", url: "https://example.edu/beat", excerpt: "practice the slow beat with the right hand first before adding the left" },
    contributor: { id: "11111111-2222-3333-4444-555555555555", name: "อาจารย์ใหญ่" },
  };
  const row = { ...submissionToRow(factSub), status: "approved", contributor_name: "อาจารย์ใหญ่" };
  const id = sourceIdFor(row);
  assert.ok(id.startsWith("contrib:"), `public-fact id: ${id}`);
  const built = creditedEntryFor(row);
  assert.strictEqual(built.entry.source, id, "the entry cites the id the gate gave it");
  assert.ok(built.sources[id], "and the registry holds that exact id");
  assert.strictEqual(built.sources[id].notes, factSub.source.excerpt, "the declared excerpt is the stored evidence");
  assert.strictEqual(built.sources[id].url, "https://example.edu/beat");
});

check("the credited entry passes the REAL legal scanner (attribution included)", () => {
  const row = { ...submissionToRow(goodSub), status: "approved", contributor_name: "ครูเต" };
  const built = creditedEntryFor(row);
  assert.ok(built && built.entry && built.sources, "the approved row becomes an entry + its registry");
  assert.strictEqual(built.entry.source, sourceIdFor(row), "the entry cites its own registry id");
  const rep = auditKB([built.entry], built.sources);
  assert.strictEqual(rep.flags.length, 0, `no flags: ${JSON.stringify(rep.flags)}`);
  assert.strictEqual(rep.byCheck.attribution || 0, 0, "an unregistered citation would flag here");
  assert.strictEqual(built.label.th, "โดย ครูเต");
  assert.strictEqual(built.label.en, "by ครูเต");
});

check("a public-fact entry WITHOUT its registry is flagged — the credit is what makes it traceable", () => {
  const factSub = {
    content: { title: "จังหวะช้าแบบมือขวา", body: "ฝึกจังหวะช้าด้วยมือขวาเดี่ยวก่อน แล้วค่อยเพิ่มมือซ้ายทีละจังหวะ", domain: "accompaniment" },
    license: "cc-by",
    source: { kind: "public-fact", url: "https://example.edu/beat", excerpt: "practice the slow beat with the right hand first before adding the left" },
    contributor: { id: "11111111-2222-3333-4444-555555555555", name: "อาจารย์ใหญ่" },
  };
  const built = creditedEntryFor({ ...submissionToRow(factSub), status: "approved", contributor_name: "อาจารย์ใหญ่" });
  const orphan = auditKB([built.entry], {});
  assert.ok((orphan.byCheck.attribution || 0) > 0, "an uncredited source is an untraceable citation");
});

console.log("\nC) ไฟล์ SQL (เขียนแล้ว ยังไม่ apply)");
check("the file says it is NOT applied and needs owner approval", () => {
  assert.ok(/NOT APPLIED/.test(SQL), "the header must say it has not been applied");
  assert.ok(/owner approves/i.test(SQL), "and that an owner approval is required first");
});

check("a client may insert ONLY its own pending row", () => {
  const policy = SQL.slice(SQL.indexOf("knowledge_contributions insert own pending"), SQL.indexOf("knowledge_contributions select own"));
  assert.ok(policy.includes("contributor_id = auth.uid()"), "own row only");
  assert.ok(policy.includes("status = 'pending'"), "pending only");
  assert.ok(policy.includes("length(trim(title)") && policy.includes("length(trim(body)"), "content must be non-empty");
});

check("there is no client UPDATE or DELETE policy on the table", () => {
  assert.ok(!/for update to/i.test(SQL), "no UPDATE policy");
  assert.ok(!/for delete to/i.test(SQL), "no DELETE policy");
  assert.ok(/no UPDATE and no DELETE policy on purpose/i.test(SQL), "and the reason is written down");
});

check("statuses are constrained to the three the plan names", () => {
  assert.ok(/check \(status in \('pending', 'approved', 'rejected'\)\)/.test(SQL));
});

check("the only status-changing path is an admin-gated RPC that demands a note", () => {
  assert.ok(/create or replace function public\.admin_moderate_contribution/.test(SQL));
  const at = SQL.indexOf("create or replace function public.admin_moderate_contribution");
  const fn = SQL.slice(at, at + 1800);
  assert.ok(/if not public|admin only/.test(fn), "admin gate");
  assert.ok(/a written reason is required/.test(fn), "note required");
  assert.ok(/security definer/.test(fn) && /set search_path = public/.test(fn), "the standard security-definer shape");
  assert.ok(/and status = 'pending'/.test(fn), "already-reviewed rows cannot be re-decided");
});

check("an approval is stamped with who decided and when", () => {
  assert.ok(/stamp_contribution_review/.test(SQL));
  const trig = SQL.slice(SQL.indexOf("create trigger knowledge_contributions_review_stamp"));
  assert.ok(trig.includes("before update"), "stamped on every status move");
});

check("read paths are admin-gated, bounded and additive", () => {
  assert.ok(/admin_contributions_queue/.test(SQL) && /admin_contributions_count/.test(SQL));
  assert.ok(/order by c\.created_at asc/.test(SQL), "oldest first — nobody starves in the queue");
  assert.ok(/limit greatest\(1, least\(coalesce\(p_limit, 50\), 200\)\)/.test(SQL), "the limit is bounded server-side");
  assert.ok(/create table if not exists/.test(SQL) && /create or replace function/.test(SQL), "re-runnable throughout");
  assert.ok(/create policy "knowledge_contributions insert own pending"/.test(SQL), "policies are dropped first → idempotent");
});

check("the contributor's name is stored, so the credit outlives the session (m27)", () => {
  assert.ok(/contributor_name\s+text,/.test(SQL), "the column exists on the table");
  const queue = SQL.slice(SQL.indexOf("admin_contributions_queue"));
  assert.ok(/c\.contributor_name/.test(queue), "and the queue hands it to the reviewer");
});

check("the file carries its own verification queries", () => {
  assert.ok(/VERIFICATION after applying/.test(SQL));
  assert.ok(/violates row-level security/.test(SQL), "the proof a client cannot pre-approve");
  assert.ok(/admin only/.test(SQL), "and that a non-admin cannot read the queue");
});

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);