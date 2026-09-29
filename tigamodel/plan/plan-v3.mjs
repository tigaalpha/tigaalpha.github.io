/* ── tigamodel/plan/plan-v3.mjs ──
   THE PLAN AS CODE (docs/06). docs/04 told the direction, docs/05 made every
   item measurable — v3 makes the plan enforce itself:

   - every milestone carries machine-checkable acceptance + evidence paths
     that really exist in the repo (scripts/plan-check.mjs re-verifies them,
     including by actually RUNNING the smokes)
   - owner approvals live here as data: an item touching the live database
     cannot claim progress past "awaiting-owner" until its approval flips to
     true IN THIS FILE (steel rule: per-item owner approval in the current
     conversation)
   - deterministic: no clocks, no randomness, no env reads — the same commit
     always yields the same plan, so CI can diff it

   Milestone states: done | code | awaiting-owner | planned
     done          verified complete (auditor re-checks the evidence)
     code          shipped as code+smoke+SQL, activation needs something
     awaiting-owner blocked on the human owner's explicit approval
     planned       accepted into the plan, not started ── */

export const STEEL_RULES = [
  "ห้ามผูกโมเดล — ทุก call ผ่าน providers/ + คีย์ฝั่ง server เท่านั้น",
  "ประเมินก่อนเชื่อ — เปลี่ยนอะไรที่โดนคำตอบผู้เรียน ต้องผ่าน eval suite / regression gate ก่อนขึ้น",
  "สังเกต ≠ สรุป — ทุก state เป็น probability + confidence + evidence เท่านั้น",
  "client ห้ามส่งค่า absolute เข้า DB — เดินผ่าน RPC additive/blend ฝั่ง server",
  "ทุก feature ใหม่มี kill switch ใน app_settings — ปิดได้ใน 1 นาทีไม่ต้อง deploy ใหม่",
  "เสร็จ = smoke ใหม่ผ่าน + eval ผ่าน + CI build ผ่าน ใน merge เดียวกัน; SQL แตะของจริงต้องมีอนุมัติเฉพาะรายการจากเจ้าของ",
];

export const OWNER_APPROVALS = [
  { item: "learning-data-migration", label: "supabase-learning-data-migration.sql (7 ตาราง + RLS + RPCs)", approved: true, approvedBy: "owner (this conversation, 2026-09-29: อนุญาต ให้ทำได้ทั้งสองข้อ)" },
  { item: "policy-weights-migration", label: "supabase-policy-weights-migration.sql (RPC + seed switch-off)", approved: true, approvedBy: "owner (this conversation, 2026-09-29: อนุญาต ให้ทำได้ทั้งสองข้อ)" },
];

export const MILESTONES = [
  {
    id: "m01-state-audit",
    title: "สถานะ TIGA MODEL ตรวจจริงด้วย smoke ทั้ง 10 ชุด",
    state: "done",
    deps: [],
    acceptance: "smoke suite ครบทุกชุดผ่าน (43/16/9/14/25/11/11/33/9/24) และ KB=17,090",
    evidence: ["tigamodel/docs/04-state-and-millionfold-plan.md"],
  },
  {
    id: "m02-plan-v2-measurable",
    title: "แผน v2 — ทุกโครงการมี baseline/เป้าตัวเลข/kill switch/anchor",
    state: "done",
    deps: ["m01-state-audit"],
    acceptance: "docs/05 มี baseline+เป้า+smoke+kill switch+anchor ครบทั้ง §1–§10 และระบุว่า §1 ปลดล็อกแล้ว",
    evidence: ["tigamodel/docs/05-plan-v2-measurable.md"],
  },
  {
    id: "m03-plan-v3-self-enforcing",
    title: "แผน v3 — แผนเป็นโค้ด + auditor ตรวจตัวเอง (เอกสารนี้)",
    state: "done",
    deps: ["m02-plan-v2-measurable"],
    acceptance: "plan-v3.mjs encode ไมล์สโตนครบ + plan-check.mjs ตรวจ evidence ด้วยการรัน smoke จริง",
    evidence: ["tigamodel/plan/plan-v3.mjs", "scripts/plan-check.mjs", "tigamodel/docs/06-plan-v3-executable.md"],
  },
  {
    id: "m04-strategy-analyzer",
    title: "§1 Strategy Effect Analyzer — โค้ด+smoke+SQL ครบ รอเปิดสวิตช์",
    state: "code",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "smoke-strategy-analyzer ผ่านทุกข้อ รวมพิสูจน์ว่า weights เปลี่ยนการตัดสินของ policy จริง (END-TO-END ผ่าน createTeachingPolicy)",
    evidence: [
      "tigamodel/teaching/strategy-analyzer.js",
      "tigamodel/scripts/smoke-strategy-analyzer.mjs",
      "supabase-policy-weights-migration.sql",
    ],
    activation: "ต้องอนุมัติ policy-weights-migration แล้ว top admin เรียก admin_set_policy_weights (enabled:true) — kill switch ปิดกลับได้ทันที",
    needsApproval: "policy-weights-migration",
  },
  {
    id: "m05-apply-learning-data",
    title: "§2 Apply learning-data migration (ปลดล็อก §3/§9)",
    state: "code",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "dry-run BEGIN/ROLLBACK → apply → verify-learning-data 21/21 → ซ้อมจริง 1 รอบเห็นแถวใน learning_sessions",
    evidence: ["supabase-learning-data-migration.sql", "scripts/verify-learning-data.mjs"],
    activation: "เจ้าของอนุมัติแล้ว (บันทึกใน OWNER_APPROVALS) — เหลือให้เจ้าของกด Run ไฟล์ SQL ใน Supabase SQL Editor (sandbox ไม่มี database credential ตามธรรมเนียม repo) แล้วรัน scripts/verify-learning-data.mjs",
    needsApproval: "learning-data-migration",
  },
  {
    id: "m06-apply-policy-weights",
    title: "§1(ต่อ) Apply policy-weights migration + รอบแรกของ analyzer กับข้อมูลจริง",
    state: "code",
    deps: ["m04-strategy-analyzer"],
    acceptance: "migration apply ตาม VERIFICATION ในไฟล์ SQL แล้ว analyzer รันกับ outcomes จริง ≥50 รายการ → strategy ดีสุดได้ weight ≥1.2 (log ยืนยัน)",
    evidence: ["supabase-policy-weights-migration.sql", "tigamodel/teaching/strategy-analyzer.js"],
    activation: "เจ้าของอนุมัติแล้ว — เหลือให้เจ้าของกด Run ไฟล์ SQL ใน Supabase SQL Editor ตรวจ seed (enabled:false) แล้ว top admin เรียก admin_set_policy_weights เมื่อ outcomes จริงพอ (≥50)",
    needsApproval: "policy-weights-migration",
  },
  {
    id: "m07-retrieval-eval",
    title: "§4 Retrieval eval สำหรับ KB 17,090 — ตัวเลขครั้งแรก",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "24 probe เคส keywords→expected domains ยิงเข้า getKBContext ตัวจริง; accuracy 100% (เป้า ≥85%); gate ไม้กันที่ 80% ตลอดไป (RETRIEVAL_GATE)",
    evidence: ["tigamodel/evaluation/retrieval-eval.js", "tigamodel/scripts/smoke-retrieval.mjs"],
  },
  {
    id: "m08-skill-state-plans",
    title: "§3 แผนซ้อมเฉพาะบุคคลผ่าน skill_state (รอ m05)",
    state: "planned",
    deps: ["m05-apply-learning-data"],
    acceptance: "smoke-skill-state-plans: ability ต่ำ → drill ง่ายลง ≥1 ระดับ ใน ≥80% ของเคส; นักเรียน 20 คนแรกได้แผน ≥3 รูปแบบ; kill switch tiga_personalized_plans",
    evidence: ["tigamodel/teaching/coach.js"],
  },
  {
    id: "m09-golden-answers",
    title: "§6 Golden answers จากนักเรียนจริง (10 เคส/สัปดาห์ เจ้าของอนุมัติ)",
    state: "planned",
    deps: ["m05-apply-learning-data"],
    acceptance: "ภายใน 4 สัปดาห์ suite มี ≥40 เคสจากคำถามจริง + regression gate ปกป้อง",
    evidence: ["tigamodel/evaluation/eval-expanded.js"],
  },
  {
    id: "m10-kb-expansion-real",
    title: "§9 KB expansion ตาม top_problems จริง (รอ m05+m07)",
    state: "planned",
    deps: ["m05-apply-learning-data", "m07-retrieval-eval"],
    acceptance: "top-3 ปัญหาจาก dashboard มี KB entries ใน wave ถัดไป + อัตราตอบไม่ได้ลด ≥50% จาก baseline ก่อน wave",
    evidence: ["tigamodel/knowledge"],
  },
  {
    id: "m11-jev-policy",
    title: "§5 Jev ตัดสินใจเฉพาะจุดที่กติกาเสมอกัน (fallback กติกาเดิมเสมอ)",
    state: "planned",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "smoke-jev-policy: tie → probability แนบใน response; edge ล่ม → คำตอบจากกติกาเดิม ไม่มี error โชว์ผู้เรียน; kill switch tiga_jev_policy",
    evidence: ["tigamodel/teaching/teaching-loop.js", "tigamodel/jev/jev-judgment.js"],
  },
  {
    id: "m12-fusion",
    title: "§7 Multimodal fusion v1 — ถ่วงน้ำหนักตาม confidence",
    state: "planned",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "smoke-fusion: 3 สัญญาณขัดกัน deterministic → ฝั่ง confidence สูงกว่าชนะทุกช่อง; weight ต่อสัญญาณตั้ง 0 ได้ (kill switch)",
    evidence: ["tigamodel/student/state-estimator.js", "tigamodel/multimodal/interfaces.js"],
  },
  {
    id: "m13-cost-governor",
    title: "§8 Cost governor ต่อ session (คุณภาพไม่ตกเป็นเงื่อนไขร่วม)",
    state: "planned",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "session ฟรี 40 คำถาม → throttle ก่อนเพดาน 100% ของกรณี; ต้นทุน/session p95 −30% โดย eval suite ผ่านเท่าเดิม",
    evidence: ["tigamodel/providers/model-router.js"],
  },
  {
    id: "m14-realtime-voice",
    title: "§10 Realtime voice barge-in (ทดสอบบนเครื่องจริงเท่านั้น)",
    state: "planned",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "barge-in บน device จริง ความหน่วง <800ms — เจ้าของทดสอบเองตาม AGENTS.md (native หา headless พิสูจน์ไม่ได้)",
    evidence: ["use-voice-tutor.ts"],
  },
];

export function getPlan() {
  return {
    version: "v3",
    doc: "tigamodel/docs/06-plan-v3-executable.md",
    steelRules: [...STEEL_RULES],
    ownerApprovals: OWNER_APPROVALS.map(a => ({ ...a })),
    milestones: MILESTONES.map(m => ({ ...m, deps: [...m.deps], evidence: [...m.evidence] })),
  };
}

export function findMilestone(id) {
  return MILESTONES.find(m => m.id === id) || null;
}

export function approvalFor(itemId) {
  return OWNER_APPROVALS.find(a => a.item === itemId) || null;
}

/* Honest status: an awaiting-owner milestone may not report progress past
   its gate even if code exists — the auditor reads this function, so a
   premature approval flip shows up as a contradiction between file state
   and plan state instead of passing silently. */
export function milestoneStatus(m) {
  if (m.needsApproval) {
    const a = approvalFor(m.needsApproval);
    if (!a) return "blocked: unknown approval item";
    if (!a.approved && (m.state === "done" || m.state === "code-activated")) {
      return "VIOLATION: claimed done without owner approval";
    }
  }
  return m.state;
}

/* What to do next, ordered: owner decisions first (cheap, unblocks the most),
   then ready work, then blocked work. Deterministic by array order. */
export function nextActions() {
  const owner = MILESTONES.filter(m => m.state === "awaiting-owner" && m.needsApproval && !approvalFor(m.needsApproval)?.approved);
  const ready = MILESTONES.filter(m => m.state === "planned" && m.deps.every(d => {
    const dep = findMilestone(d);
    return dep && (dep.state === "done" || dep.state === "code");
  }));
  const blocked = MILESTONES.filter(m => m.state === "planned" && !ready.includes(m));
  return [
    ...owner.map(m => ({ kind: "รอการตัดสินใจของเจ้าของ", milestone: m })),
    ...ready.map(m => ({ kind: "พร้อมลงมือ", milestone: m })),
    ...blocked.map(m => ({ kind: "ยังบล็อก", milestone: m })),
  ];
}
