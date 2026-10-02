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
  "(ข้อ 7 มีผลแล้ว 2026-09-29 — docs/07) ห้ามเพิ่มแหล่งความรู้ที่ไม่ผ่านตารางตรวจ: ข้อเท็จจริงสาธารณะ + ถอดความ + ที่มาจดทะเบียนเท่านั้น (kb-compliance smoke บังคับ); ผลงานคุ้มครองลิขสิทธิ์ห้ามเข้า KB โดยไม่มี license; ห้ามใช้ชื่อ/โลโก้สถาบันเชิงพาณิชย์; หมวดสุขภาพต้องมีกรอบ wellbeing ในเนื้อหา",
  "(ข้อ 8 มีผลแล้ว 2026-09-29 — docs/10) ความเร็วห้ามแลกด้วยความถูกต้อง: ทางลัดเดียวที่อนุญาตคือจำคำตอบที่ผ่านการตรวจแล้ว (status ok + confidence ผ่านเกณฑ์ + provenance ครบ) — ห้าม cache คำตอบที่ไม่แน่ใจ, ห้าม cache ข้ามบริบท, ห้ามตัดขั้นตอน eval/ตรวจเพื่อความเร็ว, ห้ามแต่งตัวเลข latency (scorecard ด่าน 8 วัดจริงทุกรอบ)",
];

export const OWNER_APPROVALS = [
  { item: "learning-data-migration", label: "supabase-learning-data-migration.sql (7 ตาราง + RLS + RPCs)", approved: true, approvedBy: "owner (this conversation, 2026-09-29: อนุญาต ให้ทำได้ทั้งสองข้อ)" },
  { item: "policy-weights-migration", label: "supabase-policy-weights-migration.sql (RPC + seed switch-off)", approved: true, approvedBy: "owner (this conversation, 2026-09-29: อนุญาต ให้ทำได้ทั้งสองข้อ)" },
  { item: "knowledge-contributions", label: "supabase-knowledge-contributions-migration.sql (ตาราง knowledge_contributions + RLS + RPC อนุมัติโดยผู้ดูแล)", approved: false, approvedBy: "ยังไม่อนุมัติ — ไฟล์เขียนแล้ว รอเจ้าของสั่ง apply ในบทสนทนานี้ (repo hard rule)" },
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
    title: "§1 Strategy Effect Analyzer — โค้ด+smoke+SQL(APPLIED) ครบ รอเปิดสวิตช์เมื่อข้อมูลพอ",
    state: "code",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "smoke-strategy-analyzer ผ่านทุกข้อ รวมพิสูจน์ว่า weights เปลี่ยนการตัดสินของ policy จริง (END-TO-END ผ่าน createTeachingPolicy)",
    evidence: [
      "tigamodel/teaching/strategy-analyzer.js",
      "tigamodel/scripts/smoke-strategy-analyzer.mjs",
      "supabase-policy-weights-migration.sql",
    ],
    activation: "SQL ถูก apply แล้ว (m06) — เหลือ: ข้อมูลจริง ≥50 outcomes → analyzer → top admin เรียก admin_set_policy_weights (enabled:true) — kill switch ปิดกลับได้ทันที",
    needsApproval: "policy-weights-migration",
  },
  {
    id: "m05-apply-learning-data",
    title: "§2 Apply learning-data migration (ปลดล็อก §3/§9) — APPLIED บน live DB แล้ว",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "บันทึกความจริง: ไฟล์ SQL ระบุว่า APPLIED 2026-09-25 ด้วยอนุมัติเจ้าของ (apply รอบ 2026-09-29 จึงเป็น re-run ที่ no-op เพิ่มอะไรไม่ได้) · ยืนยันบน live DB จริง (check-live): ตาราง 7/7 (learning_sessions/observations/diagnoses/interventions/practice_events + learner_skill_state/learner_memory) · RPC learning_* 10 ตัว · verify-learning-data 21/21 · งาน apply ผ่านปุ่ม scripts/apply-migrations.mjs (คำสั่งเดียว ไม่ต้องเปิด SQL Editor)",
    evidence: ["supabase-learning-data-migration.sql", "scripts/verify-learning-data.mjs", "scripts/apply-migrations.mjs", "scripts/check-live.mjs"],
    needsApproval: "learning-data-migration",
  },
  {
    id: "m06-apply-policy-weights",
    title: "§1(ต่อ) Apply policy-weights migration + รอบแรกของ analyzer กับข้อมูลจริง — SQL APPLIED",
    state: "code",
    deps: ["m04-strategy-analyzer"],
    acceptance: "SQL apply แล้ว + ยืนยันบน live DB (check-live): get_policy_weights() = { enabled:false, weights:{} } (seed switch-off ปลอดภัย) + switch row tiga_policy_weights = 1 · งานที่เหลือคือการเปิดสวิตช์: รอ teaching_outcomes จริง ≥50 รายการ → analyzer คำนวณ → top admin เรียก admin_set_policy_weights (enabled:true) → strategy ดีสุดได้ weight ≥1.2 (log ยืนยัน)",
    evidence: ["supabase-policy-weights-migration.sql", "tigamodel/teaching/strategy-analyzer.js", "scripts/check-live.mjs"],
    activation: "SQL ถูก apply แล้ว (2026-09-29 ผ่านปุ่ม apply-migrations) — เหลือเฉพาะการเปิดสวิตช์เมื่อข้อมูลจริงพอ (≥50 outcomes) ซึ่งเป็นการตัดสินของ top admin",
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
    title: "§3 แผนซ้อมเฉพาะบุคคลผ่าน skill_state — แกนคิดส่งมอบแล้ว รอข้อมูลจริง",
    state: "code",
    deps: ["m05-apply-learning-data"],
    acceptance: "smoke-skill-state-plans 10/10: ability ต่ำ→ผ่อนระดับ สูง→เพิ่มระดับ confidence ต่ำ→ไม่ปรับ ไม่มีข้อมูล→null ไม่เดา; kill switch tiga_personalized_plans; pool ไม่มีครบทุกระดับ→เลือกระดับใกล้เป้าไม่แตก",
    evidence: ["tigamodel/teaching/skill-state-plans.js", "tigamodel/scripts/smoke-skill-state-plans.mjs"],
    activation: "เมื่อ learning-data apply แล้ว: adapter อ่าน ability จาก learning_update_skill_state → buildPersonalizedPlan(ability, drills, {switchOn}) — wiring อย่างเดียว ไม่มีตรรกะใหม่",
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
    title: "§5 Jev ตัดสินใจเฉพาะจุดที่กติกาเสมอกัน (ส่งมอบแล้วใน m20)",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "เนื้อหาเดียวกับ m20 ที่ส่งมอบแล้ว — รวมเป็น done ที่นี่แทนการมีสองรายการที่อ้างคำสั่งเดียวกัน: jev-tie-breaker.js (tie จริงเท่านั้นที่ถาม Jev · provenance แนบ · เชื่อเฉพาะตัวเลือกในบริบท) · teaching-loop ใช้ decision ของ policy เป็นฐานเสมอ · kill switch tiga_jev_policy default OFF (cache 60s, fail-closed) · fallback = พฤติกรรมเดิม 100% ไม่มี error โชว์ผู้เรียน · smoke-jev-policy 9/9 + smoke-reasoning 14/14 + e2e 45/45",
    evidence: ["tigamodel/teaching/jev-tie-breaker.js", "tigamodel/scripts/smoke-jev-policy.mjs", "tigamodel/teaching/teaching-loop.js"],
  },
  {
    id: "m12-fusion",
    title: "§7 Multimodal fusion v1 — ถ่วงน้ำหนักตาม confidence",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "fusion.js + smoke-fusion 17/17: 3 สัญญาณขัดกัน deterministic (ทำซ้ำได้เหมือนเดิม ยกเว้น timestamp ของ schema), ฝั่ง weighted-confidence สูงกว่าชนะทุกช่อง, §17 คำตอบตรงจากนักเรียนชนะเสมอ, weight ต่อช่องตั้ง 0 ได้ (DEFAULT_CHANNEL_WEIGHTS kill switch), provenance แนบทุกคำตัดสิน (ผู้ชนะ+ผู้แพ้+น้ำหนัก), vision/audio weight 0 ตาม §16 — ชนะไม่ได้",
    evidence: ["tigamodel/multimodal/fusion.js", "tigamodel/scripts/smoke-fusion.mjs", "tigamodel/multimodal/interfaces.js"],
  },
  {
    id: "m13-cost-governor",
    title: "§8 Cost governor ต่อ session — ส่งมอบ (สมุดบัญชีถ่วงน้ำหนัก + decide ก่อน call + kill switch)",
    state: "code",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "cost-governor.js + smoke 26/26: freeQuota=40 หน่วยถ่วงน้ำหนัก (docs/05 §8) · warn ครั้งเดียวที่ 80% · throttle ก่อนเพดาน 100% เสมอ (call ที่จะทะลุ cap ถูกหยุดก่อนเกิด) · หน่วยจริงบันทึกหลัง call จาก declare().cost ของ provider ที่ตอบ (free=0 low=1 medium=2 high=4 ตัวไม่รู้จัก=low ไม่มีทางได้ฟรี) · คำตอบ throttle เป็น honest uncertain (provider cost-governor, metadata บอกเหตุผล, ห้ามแต่งข้อความ) · ledger LRU 500 · kill switch tiga_cost_governor default OFF — ปิด = allow ทั้งหมด + เส้นทางเดิม 100% · wired web.js (chatThroughCostGovernor/setCostGovernorEnabled) — สถานะ code เพราะเส้นทางผู้เรียนจะผ่าน governor เมื่อ admin เปิดสวิตช์ + เชื่อม chat production",
    evidence: ["tigamodel/performance/cost-governor.js", "tigamodel/scripts/smoke-cost-governor.mjs", "tigamodel/web.js", "tigamodel/docs/15-plan-cost-speed-improve.md"],
  },
  {
    id: "m14-realtime-voice",
    title: "§10 Realtime voice barge-in (ทดสอบบนเครื่องจริงเท่านั้น)",
    state: "planned",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "barge-in บน device จริง ความหน่วง <800ms — เจ้าของทดสอบเองตาม AGENTS.md (native หา headless พิสูจน์ไม่ได้)",
    evidence: ["use-voice-tutor.ts"],
  },
  {
    id: "m16-legal-knowledge-strategy",
    title: "ปิดความเสี่ยงกฎหมาย KB ตาม docs/07 — เครื่องตรวจ + นโยบายสาธารณะ (A/C/D/E/G)",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "kb-compliance.js ตรวจ KB จริง 17,148 entries → 0 flag (ที่มาจดทะเบียน/ไม่ก๊อปยาว/ไม่อ้างเชิงพาณิชย์/หมวดสุขภาพมีกรอบ) พร้อม dirty fixtures พิสูจน์ว่าจับของเน่าได้จริง (smoke 13/13); scorecard ด่าน 6 บังคับถาวร; knowledge-sources.html สาธารณะ + ผูก deploy + ลิงก์จาก privacy-policy; กติกาเหล็กข้อ 7 มีผล",
    evidence: ["tigamodel/compliance/kb-compliance.js", "tigamodel/scripts/smoke-kb-compliance.mjs", "knowledge-sources.html", "tigamodel/docs/07-legal-knowledge-strategy.md"],
  },
  {
    id: "m17-analyzer-first-real-week",
    title: "สัปดาห์แรกของ Strategy Analyzer กับข้อมูลจริง (docs/08 ระลอก 2)",
    state: "planned",
    deps: ["m06-apply-policy-weights"],
    acceptance: "outcomes จริง ≥50 → strategy ดีสุด weight ≥1.2 + teaching-loop ใช้จริง (log ยืนยัน) + kill switch ทดสอบแล้ว",
    evidence: ["tigamodel/teaching/strategy-analyzer.js", "tigamodel/docs/08-plan-ten-millionfold.md"],
  },
  {
    id: "m18-skill-state-real",
    title: "§3 ขยับมาใช้ข้อมูลจริง — เด็ก 20 คนแรกได้แผน ≥3 รูปแบบ",
    state: "planned",
    deps: ["m05-apply-learning-data", "m08-skill-state-plans"],
    acceptance: "adapter อ่าน ability จาก learning_update_skill_state → buildPersonalizedPlan; เด็ก 20 คนแรกมี ≥3 รูปแบบแผนจริง; kill switch ต่อ device",
    evidence: ["tigamodel/teaching/skill-state-plans.js", "tigamodel/docs/08-plan-ten-millionfold.md"],
  },
  {
    id: "m19-kb-from-real-problems",
    title: "§9 wave แรกจาก top_problems จริง — อัตราตอบไม่ได้ −50%",
    state: "planned",
    deps: ["m05-apply-learning-data", "m07-retrieval-eval"],
    acceptance: "top-3 ปัญหาจริงจาก learning_diagnoses มี KB entries ใน wave ถัดไป + ผ่าน retrieval gate + อัตราตอบไม่ได้ลด ≥50% จาก baseline ก่อน wave",
    evidence: ["tigamodel/knowledge", "tigamodel/docs/08-plan-ten-millionfold.md"],
  },
  {
    id: "m20-jev-policy",
    title: "§5 Jev ตัดสินเฉพาะจุดกติกาเสมอกัน — ส่งมอบ (แกน pure + wiring + kill switch)",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "jev-tie-breaker.js 9/9 (หากฎ match ทั้งหมด/tie จริง=actions ต่างกัน/provenance แนบ/ไม่เชื่อคำตอบนอกตัวเลือก/fallback = พฤติกรรมเดิม 100%); teaching-loop: decision ของ policy เป็นฐานเสมอ, Jev override เฉพาะ tie + switch เปิด, tie-check (pure) มาก่อน network — ไม่มี tie = ไม่มี call; kill switch tiga_jev_policy default OFF (cache 60s, fail-closed); e2e 45/45 ผ่าน — วงจรเดิมไม่เปลี่ยนเมื่อปิด",
    evidence: ["tigamodel/teaching/jev-tie-breaker.js", "tigamodel/scripts/smoke-jev-policy.mjs", "tigamodel/teaching/teaching-loop.js"],
  },
  {
    id: "m21-fusion-v1",
    title: "§7 Multimodal fusion — สัญญาณหลายทางชนะด้วย confidence (ส่งมอบร่วมกับ m12 — งานเดียวกัน)",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "เดียวกับ m12: fusion.js deterministic confidence-weighted (smoke-fusion 17/17), §17 self-report dominance, per-channel weight 0 = kill switch (DEFAULT_CHANNEL_WEIGHTS), §16 vision/audio ชนะไม่ได้, provenance แนบทุก estimate; wired ผ่าน web.js (fuseMultimodalStates/confidentMultimodalStates) + จดทะเบียน honest registry (multimodal_fusion) + scorecard ด่าน 7",
    evidence: ["tigamodel/multimodal/fusion.js", "tigamodel/scripts/smoke-fusion.mjs", "tigamodel/web.js", "scripts/tiga-scorecard.mjs"],
  },
  {
    id: "m22-cost-governor",
    title: "§8 Cost governor — ต้นทุน/session p95 −30% โดยคุณภาพไม่ตก (ส่งมอบร่วมกับ m13 — งานเดียวกัน)",
    state: "code",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "เดียวกับ m13: เพดานหน่วยถ่วงน้ำหนักบังคับโดยโค้ด (ห้าม bypass ด้วยหน่วยเสีย/ติดลบ, charge คลแมปที่ cap) · ต้นทุนเซสชันถูกจำกัดตั้งแต่ call แรกโดยไม่ง้อพฤติกรรมผู้ใช้ · คุณภาพเป็นเงื่อนไขร่วม: eval suite/plan-check/scorecard ต้องเขียวครบใน merge เดียวกัน · สถานะ code — เป้า −30% p95 วัดยืนยันเมื่อเปิดใช้กับ provider จริง",
    evidence: ["tigamodel/performance/cost-governor.js", "tigamodel/scripts/smoke-cost-governor.mjs", "tigamodel/docs/15-plan-cost-speed-improve.md"],
  },
  {
    id: "m23-voice-barge-in",
    title: "§10 Realtime voice barge-in (เจ้าของทดสอบบน device จริง)",
    state: "planned",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "barge-in บน device จริง ความหน่วง <800ms — native พิสูจน์ด้วย headless ไม่ได้",
    evidence: ["use-voice-tutor.ts"],
  },
  {
    id: "m24-before-after-dashboard",
    title: "แดชบอร์ดก่อน-หลังต่อเด็ก (หลักฐานผลลัพธ์สำหรับพ่อแม่/ครู)",
    state: "code",
    deps: ["m05-apply-learning-data"],
    acceptance: "before-after.js (pure): เทียบรอบแรกกับรอบล่าสุดของทักษะเดียวกันจาก learning_practice_events จริง · ย้อนแถวไม่มีคะแนน = มีแค่ 'นาทีที่ซ้อม' ไม่กลายเป็นตัวเลข · คนละทักษะไม่เทียบกัน · 1 ครั้งไม่เป็นเทรนด์ (claimable ต้อง ≥3 ครั้ง, cohort ≥10 ครั้ง) · ถดถอยรายงานตรงๆ · ตารางว่าง = 'ยังไม่มีข้อมูล' ไม่ใช่ 0% · smoke-compound-dashboard 19/19 · scripts/compound-dashboard.mjs พิมพ์หลักฐานรายคนจาก live DB (read-only) · สถานะ code เพราะต้องมีแถวซ้อมจริงก่อน (learning_practice_events = 0 แถวตอนนี้ — เกิดเองจากนักเรียนจริง ห้ามปลอม)",
    evidence: ["tigamodel/evaluation/before-after.js", "tigamodel/scripts/smoke-compound-dashboard.mjs", "scripts/compound-dashboard.mjs", "tigamodel/docs/08-plan-ten-millionfold.md"],
  },
  {
    id: "m25-contribution-gate",
    title: "ประตูรับความรู้จากภายนอก (docs/09 ชั้น 1) — ทุกข้อเสนอผ่านด่านกฎหมายเดียวกันเสมอ",
    state: "done",
    deps: ["m16-legal-knowledge-strategy"],
    acceptance: "contribution-gate.js 12/12: รับ own-work/public-fact (license ชัด + excerpt หลักฐาน) ปฏิเสธนิรนาม/ไร้ license/ผลงานคนอื่น/ก๊อปยาว/อ้างพาณิชย์/สุขภาพไร้กรอบ — ปฏิเสธพร้อมเหตุผลเสมอ, batch ไม่ปนเปื้อน, deterministic",
    evidence: ["tigamodel/compliance/contribution-gate.js", "tigamodel/scripts/smoke-contribution-gate.mjs", "tigamodel/docs/09-plan-hundred-millionfold.md"],
  },
  {
    id: "m26-contribution-store",
    title: "ที่เก็บข้อเสนอความรู้ + กติกาหน้าอนุมัติผู้ใหญ่ (SQL เขียนแล้ว รอเจ้าของอนุมัติ apply)",
    state: "code",
    deps: ["m25-contribution-gate", "m05-apply-learning-data"],
    acceptance: "contribution-store.js (pure): แถวที่ผู้ส่งสร้าง status เป็น 'pending' เสมอ (ค่าที่ client ส่งมาถูกทิ้ง) · เหตุผลจากประตูครบทุกข้อ · moderateArgs ต้องมี admin_tier + id จริง + สถานะที่ตัดสินได้ + เหตุผลเขียน (โมเดลอนุมัติเองไม่ได้) · approvalBlockers ห้ามอนุมัติแถวที่ gate ไม่ผ่าน/ไม่มีผู้ส่ง/ไม่มี license · queueStats นับเฉพาะที่มี · supabase-knowledge-contributions-migration.sql: ตาราง + RLS (insert ได้เฉพาะแถวตัวเองสถานะ pending, อ่านเฉพาะแถวตัวเอง, ไม่มี policy UPDATE/DELETE) + RPC admin_moderate_contribution / _queue / _count + trigger stamp ผู้ตัดสิน·เวลา — additive re-runnable · smoke-contribution-store 17/17 · ยังไม่ apply (repo hard rule: รอเจ้าของอนุมัติในบทสนทนานี้)",
    evidence: ["tigamodel/compliance/contribution-store.js", "tigamodel/scripts/smoke-contribution-store.mjs", "supabase-knowledge-contributions-migration.sql", "tigamodel/compliance/contribution-gate.js"],
    needsApproval: "knowledge-contributions",
  },
  {
    id: "m27-contributor-credit",
    title: "เครดิตผู้ร่วมสร้างติดตาวรา (provenance ขยายจากแหล่ง→คน)",
    state: "code",
    deps: ["m26-contribution-store"],
    acceptance: "contribution-store.js: เฉพาะแถวที่ APPROVED เท่านั้นที่ได้เครดิต (pending/rejected → ไม่มี entry) · entry ที่ได้อ้าง source id ตัวเดียวกับที่ประตูเลือก (own-work = tiga-contrib:<id>, public-fact = contrib:<id>:<title>) · registry SOURCES เก็บ contributor_name + license + excerpt ไว้ (ชื่ออยู่ในบันทึกแหล่งที่มา ไม่ใช่คอมเมนต์) · entry ที่มีเครดิตผ่าน scanner ตัวจริง 0 flag และ public-fact ที่ไม่มี registry จะถูก flag attribution จริง (พิสูจน์ว่าเครดิตคือสิ่งที่ทำให้คำอ้างสืบยาวได้) · คอลัมน์ contributor_name ใน SQL + queue ส่งต่อให้ผู้ตรวจ · smoke-contribution-store 23/23 · ด่าน 12 ของ scorecard ตรวจเครดิตซ้ำอีกชั้น — สถานะ code เพราะยังไม่มีแถวจริงจนกว่าเจ้าของอนุมัติ apply (m26)",
    evidence: ["tigamodel/compliance/contribution-store.js", "tigamodel/scripts/smoke-contribution-store.mjs", "supabase-knowledge-contributions-migration.sql", "tigamodel/compliance/kb-compliance.js"],
  },
  {
    id: "m28-teacher-offline",
    title: "โหมดออฟไลน์ของครู AI (KB แกนคำนวณได้ + ผลฝึก sync ภายหลัง)",
    state: "planned",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "ซ้อม/แผน/แบบฝึกพื้นฐานใช้ได้เมื่อเน็ตหลุด; ผลฝึกเก็บ offline-first แล้ว sync ผ่าน Learning Data เมื่อออนไลน์ — ข้อมูลไม่หาย",
    evidence: ["tigamodel/docs/09-plan-hundred-millionfold.md"],
  },
  {
    id: "m29-classroom-tablet",
    title: "เวอร์ชันห้องเรียน — ครูจริง 1 คน + ครู AI ต่อเด็กบนแท็บเล็ตเดียว",
    state: "planned",
    deps: ["m28-teacher-offline"],
    acceptance: "โหมดห้องเรียน: รายชื่อเด็ก + คำแนะนำต่อเด็กจาก student-context จริง — ครูจริงใช้เป็นผู้ช่วยต่อเด็ก",
    evidence: ["tigamodel/docs/09-plan-hundred-millionfold.md"],
  },
  {
    id: "m30-offline-first-memory",
    title: "ความจำผู้เรียนแบบ offline-first (สมองส่วนหน้าฝั่งเรียน)",
    state: "planned",
    deps: ["m28-teacher-offline", "m05-apply-learning-data"],
    acceptance: "เก็บผลฝึก/สถานะบนเครื่องก่อนเสมอ sync เมื่อออนไลน์ — ประสบการณ์ไม่สะดุด ข้อมูลไม่หาย ผ่าน RPC additive เดิม",
    evidence: ["tigamodel/docs/09-plan-hundred-millionfold.md"],
  },
  {
    id: "m31-teacher-persona",
    title: "ครู AI ปรับบุคลิกได้ (เข้มงวด/อบอุ่น/ตลก) — พารามิเตอร์ tone ไม่ใช่โมเดลใหม่",
    state: "planned",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "เด็กเลือกบุคลิกครูได้ composeMessage รองรับ tone — เป้าหมาย: สัดส่วนเด็กที่เลิกเรียนเพราะ 'เข้ากับครูไม่ได้' ลดลง (วัดจาก events)",
    evidence: ["tigamodel/teaching/teaching-loop.js"],
  },
  {
    id: "m32-speed-answer-cache",
    title: "docs/10 §1.1 Answer cache — เร็วโดยจำได้เฉพาะคำตอบที่ผ่านการตรวจ (ไม่หลอน)",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "answer-cache.js + smoke 20/20: จำได้เฉพาะ status ok + confidence ผ่านเกณฑ์ (uncertain/error/ต่ำกว่าเกณฑ์ = คิดใหม่ทุกครั้ง ห้ามแช่แข็งความไม่แน่ใจ) · คีย์รวม history (บริบทต่าง = คำตอบต่าง ไม่มี leak ข้ามบทสนทนา) · kill switch ในตัวโมดูล default OFF (ปิด = ไม่เก็บไม่เสิร์ฟ เส้นทางเดิม 100%) · จำกัดขนาด LRU · hit คืน response ต้นฉบับพร้อม provenance ครบ · wired ผ่าน web.js (chatThroughAnswerCache/setAnswerCacheEnabled) — kill switch tiga_answer_cache",
    evidence: ["tigamodel/performance/answer-cache.js", "tigamodel/scripts/smoke-answer-cache.mjs", "tigamodel/docs/10-plan-speed-hundred-millionfold.md"],
  },
  {
    id: "m33-speed-scorecard",
    title: "docs/10 §1.2 scorecard ด่าน 8 — ความเร็วที่วัดจริงของสมองกฎ/KB ทุกรอบ",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "scorecard วัดจริง 200 รอบ/ด่าน ต่อการรัน: KB context < 100ms · policy ตัดสิน < 20ms · สร้างแบบฝึกหัด < 5ms · คำตอบที่จำได้ < 1ms — ห้ามแต่งตัวเลข (วัดบนเครื่องที่รันเสมอ)",
    evidence: ["scripts/tiga-scorecard.mjs", "tigamodel/docs/10-plan-speed-hundred-millionfold.md"],
  },
  {
    id: "m34-speed-kb-hotset",
    title: "docs/10 §1.3 + docs/14 §2 KB hot-path — จัดอันดับความเกี่ยวข้อง + เพดานแข็งต่อข้อความ (เลือก ไม่เท)",
    state: "done",
    deps: ["m07-retrieval-eval"],
    acceptance: "kb-hot-path.js + smoke 22/22: baseline วัดจริงก่อนออกแบบ (คำถาม harmony 1 คำถามเสิร์ฟ 1,383,891 ตัวอักษร = 12,615 entries = 73.6% ของคลัง) · หลังเปิด: บล็อก ≤24 บรรทัด/≤8,000 ตัวอักษร (~173× เล็กลง) และเร็วขึ้นวัดจริง 5.732ms → 0.041ms (~139×) บนเครื่องที่รัน · เทมเพลตบรรทัด + เนื้อหาไม่ถูกแตะ (เลือกเท่านั้น) · retrieval gate 24 probes ผ่าน 100% ด้วย hot path เปิด · hot boost มีขอบ (1.0 < 2 ต่อ keyword จึงไม่มีวันเอาชนะความเกี่ยวข้อง) · deterministic (แคช haystack WeakMap + แคชกลุ่มความเกี่ยวข้องต่อชุดคำสำคัญ จำกัด 64 ชุด + lazy sequence) · kill switch tiga_kb_hot_path default OFF — ปิด = byte-identical เดิม · wired web.js (getKBContext/kbHotPath/setKbHotPathEnabled)",
    evidence: ["tigamodel/performance/kb-hot-path.js", "tigamodel/scripts/smoke-kb-hot-path.mjs", "tigamodel/web.js", "tigamodel/docs/14-plan-thousandfold-speed-quality.md"],
  },
  {
    id: "m44-hot-path-switch",
    title: "docs/14 §2 ผูก tiga_kb_hot_path เข้า app_settings — kill switch จบวงแบบเดียวกับ jev/answer-cache",
    state: "code",
    deps: ["m34-speed-kb-hotset"],
    acceptance: "สวิตช์ถูกอ่านจาก app_settings.tiga_kb_hot_path (cache 60s, fail-closed แบบ isJevPolicyEnabled — ไม่มีแถว/error/ค่าไม่ใช่ true = ปิด) ก่อนแชทสร้างบล็อก (getFullKBContext รอได้ไม่เกิน ~400ms) + ปุ่ม admin ใน Model Lab แท็บ KB เปิด-ปิดได้ผ่าน admin_set_app_setting ไม่ต้อง deploy ใหม่ — ปิด = ทุกเส้นทางผู้เรียนเหมือนเดิม 100% (byte-identical). smoke-kb-hot-path-switch ครอบคลุมทุกข้อ. สถานะ code: โค้ด+smoke ส่งแล้ว ค่าเริ่มต้น OFF — เปิดใช้จริงรอเจ้าของพลิกสวิตช์หลังอ่านรายงาน m46",
    evidence: ["tigamodel/web.js", "tigamodel/scripts/smoke-kb-hot-path-switch.mjs", "TigamodelLab.tsx", "tigamodel/docs/14-plan-thousandfold-speed-quality.md"],
  },
  {
    id: "m45-hot-counts-persist",
    title: "docs/14 §2 hot counts ข้ามเซสชัน (มีขอบ, ต่อเครื่อง)",
    state: "code",
    deps: ["m34-speed-kb-hotset"],
    acceptance: "เก็บ top hot ids จำกัดขนาด (≤200) ลง storage ต่อเครื่อง (guest-safe) — จำได้เฉพาะลำดับการเสิร์ฟของจริง ไม่ใช่ความเห็น; ข้อมูลเสียก็ไม่ทำอันตราย (validate ทุกแถว); ล้างได้; ไม่เปลี่ยนพฤติกรรมเมื่อปิดสวิตช์ (OFF = ไม่อ่าน ไม่เขียน) · smoke 9/9",
    evidence: ["tigamodel/docs/14-plan-thousandfold-speed-quality.md", "tigamodel/performance/kb-hot-path.js", "tigamodel/scripts/smoke-kb-hot-path-persist.mjs", "tigamodel/web.js"],
  },
  {
    id: "m46-capped-quality-eval",
    title: "docs/14 §2 พิสูจน์ 'เก่งขึ้น' ด้วย eval: คำตอบโดยบล็อก capped ไม่แพ้บล็อกเต็ม",
    state: "code",
    deps: ["m34-speed-kb-hotset"],
    acceptance: "eval ชุดเทียบ capped-vs-legacy: capped ไม่แพ้ (เกณฑ์ผ่าน) + token ต่อคำตอบลดลงวัดได้ — คุณภาพวัดด้วย eval suite ไม่ใช่ความรู้สึก (กติกาเหล็กข้อ 2). ส่วนออฟไลน์ทำแล้ว (eval-kb-capped-vs-legacy.mjs: ขนาดบล็อก + สัดส่วนบรรทัดตรงประเด็น + retrieval ต่อคำถามจริง — วัดสิ่งที่ 'โมเดลได้รับ' ไม่ใช่คำตอบ); ส่วนที่ยังค้าง = A/B คำตอบจริงกับโมเดลจริงใน Model Lab (สวิตช์ปิดแล้วเปิด) ก่อนเปิดให้ทุกคน + gate ที่รันซ้ำได้ (capped-eval.js + smoke-capped-vs-legacy.mjs 6/6: 30 probes จริง capped ไม่แพ้ legacy 100% = 100%, ตัวอักษรที่ส่ง 3,614,295 → 108,168 = −97.0%, token เป็น 'ประมาณการ' ติดป้ายชัด)",
    evidence: ["tigamodel/scripts/eval-kb-capped-vs-legacy.mjs", "tigamodel/docs/14-plan-thousandfold-speed-quality.md", "tigamodel/evaluation/capped-eval.js", "tigamodel/scripts/smoke-capped-vs-legacy.mjs"],
  },
  {
    id: "m47-governor-switch",
    title: "docs/15 §2 ผูก tiga_cost_governor เข้า app_settings + เชื่อมเส้นทางแชทจริง",
    state: "code",
    deps: ["m13-cost-governor"],
    acceptance: "สวิตช์ถูกอ่านจาก app_settings (cache 60s, fail-closed) + เส้นทางแชทผู้เรียนเรียก chatGovernanceGate ด้วย sessionKey จริง (ผู้ล็อกอิน uid + วันนี้; guest ได้ id ต่อเครื่อง; ออกจากระบบ = งบไม่ติดบัญชีเดิม) + ต้นทุนจริงต่อคำตอบอ่านจากแถว ai_models แถวเดียวกับที่ edge ใช้ (free ladder = 0 · anthropic = 2 · provider ไม่รู้จัก = 1 ไม่เคยฟรี) + throttle ตอบด้วย uncertain ซื่อสัตย์ (ไม่แต่งคำตอบ) — ปิด = เส้นทางเดิม 100% (governed:false, ledger ว่าง) · smoke 10/10",
    evidence: ["tigamodel/docs/15-plan-cost-speed-improve.md", "tigamodel/scripts/smoke-cost-governor-switch.mjs", "tigamodel/web.js", "use-chat.ts", "i18n.ts"],
  },
  {
    id: "m48-budget-timeout",
    title: "docs/15 §4 budget/timeout ต่อ provider call — ช้าเกิน = ตอบด้วยกฎ/KB ที่ตรวจแล้ว",
    state: "code",
    deps: ["m13-cost-governor"],
    acceptance: "provider เกิน budget → คำตอบสำรองจาก KB/กฎที่ตรวจแล้ว รูปเดียวกับ governedResponse (มีที่มา ไม่ห้อย ไม่เดา) — learner-facing floor ไม่เปลี่ยน. ทำแล้ว: provider-budget.js (soft 8s / hard 20s, kill switch tiga_provider_budget default OFF) + kbFallbackFor ในเส้นทางแชทจริง (ใช้บรรทัด KB จริงพร้อม label เป็นหลักฐาน, provider 'rule-brain', status uncertain, มีที่มา) — OFF = ทางเดิม 100% (ไม่สร้าง fallback ด้วยซ้ำ) · smoke 9/9",
    evidence: ["tigamodel/providers/model-router.js", "tigamodel/docs/15-plan-cost-speed-improve.md", "tigamodel/performance/provider-budget.js", "tigamodel/scripts/smoke-provider-budget.mjs", "tigamodel/web.js", "use-chat.ts"],
  },
  {
    id: "m49-governor-routing-bridge",
    title: "docs/15 §4 สะพาน governor → router: โซน warn เอนไปผู้ให้ถูกอัตโนมัติ",
    state: "code",
    deps: ["m13-cost-governor", "m35-speed-short-routing"],
    acceptance: "เซสชันเข้าโซน warn (≥80% quota) → prefer_cost free-first อัตโนมัติใน candidatesFor — throttle ห้วนเป็นทางสุดท้ายเท่านั้น · eval เท่าเดิม. ทำแล้ว: router.route รับ preferCost ต่อการเรียก (ค่าเริ่มต้น = เดิม), chatThroughCostGovernor ส่ง 'free-first' เมื่อ governor บอก warn และ routed.reason = 'warn_zone_free_first' (บอกเหตุผลตรง ๆ) · smoke 8/8 (รวมข้อที่พิสูจน์ว่าปุ่มใน Lab อ่านค่าจาก router ตัวจริง)",
    evidence: ["tigamodel/providers/model-router.js", "tigamodel/docs/15-plan-cost-speed-improve.md", "tigamodel/scripts/smoke-routing-bridge.mjs", "tigamodel/index.js", "tigamodel/web.js"],
  },
  {
    id: "m35-speed-short-routing",
    title: "docs/10 §1.4 + docs/15 §4 routing สายสั้นสำหรับงานเล็ก (ต่อยอด cost governor)",
    state: "code",
    deps: ["m13-cost-governor"],
    acceptance: "งานเล็กไม่เข้าคิวโมเดลใหญ่ (ตัดสินจาก declared latency/cost ของ router เดิม) · eval suite ผ่านเท่าเดิม (เงื่อนไขร่วม) + latency/ต้นทุน p95 ลดตามเป้า §8 — คุณภาพห้ามตก. ทำแล้ว: สัญญาณขนาด = นับตัวอักษรจริงของ system+message+history (≤1,500 = งานเล็ก) ไม่เดา · boost เฉพาะผู้ให้ที่ประกาศตัวว่า fast/free · kill switch tiga_short_routing default OFF (OFF = ลำดับเดิมทุกตัวอักษร) · mock floor ยังอยู่ท้ายสุดเสมอ · ปุ่มใน TIGA MODEL LAB (ShortRoutingPanel) อ่านเกณฑ์จาก router.policy ตัวจริง ไม่ใช่ตัวเลขที่พิมพ์ในป้าย · smoke 8/8",
    evidence: ["tigamodel/providers/model-router.js", "tigamodel/docs/15-plan-cost-speed-improve.md", "tigamodel/scripts/smoke-routing-bridge.mjs", "tigamodel/web.js"],
  },
  {
    id: "m36-speed-provider-budget",
    title: "docs/10 §1.5 timeout/budget ต่อ provider call — ช้าเกิน = ตอบด้วยกฎ/KB ของเรา (ส่งมอบแล้วใน m48)",
    state: "done",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "ส่งมอบใน m48 (provider-budget.js + สวิตช์ + wiring + smoke 9/9 + ปุ่มใน Lab) — m36 เป็น milestone เดียวกันเชิงเนื้อหา จึงรวมเป็น done ที่นี่และไม่ต้องมีโค้ดซ้ำ: soft 8s/hard 20s ต่อ provider call · เกินกำหนด → status 'uncertain', provider 'rule-brain', metadata.sources = label ที่ส่งจริง · kill switch tiga_provider_budget default OFF (ปิด = พาธเดิม byte-identical ไม่มี timer) · quality เป็นเงื่อนไขร่วม (บรรทัด KB ที่ส่งผ่านประตูกฎหมายเท่านั้น, จำกัด 6 บรรทัด) · 3 ภาษา",
    evidence: ["tigamodel/performance/provider-budget.js", "tigamodel/scripts/smoke-provider-budget.mjs", "tigamodel/web.js", "TigamodelLab.tsx", "tigamodel/docs/15-plan-cost-speed-improve.md"],
  },
  {
    id: "m37-migration-button",
    title: "docs/11 §1 ปุ่ม apply-migrations — คำสั่งเดียว apply + verify SQL ที่อนุมัติแล้ว",
    state: "code",
    deps: ["m03-plan-v3-self-enforcing"],
    acceptance: "scripts/apply-migrations.mjs: credential-gated (SUPABASE_ACCESS_TOKEN หรือ SUPABASE_DB) · --check ใช้ได้ทันทีไม่แตะ DB · apply แล้ว verify ตามท้ายไฟล์ (ตาราง 7/7 + seed enabled=false + switch row) · re-runnable · ไม่มีทางหลอกสำเร็จ — เมื่อเจ้าของใส่กุญแจใน Settings → Environment คำสั่งเดียวปลดคอขวด",
    evidence: ["scripts/apply-migrations.mjs", "tigamodel/docs/11-plan-plus-hundredfold.md"],
    activation: "เจ้าของเพิ่ม SUPABASE_ACCESS_TOKEN ใน Settings → Environment แล้วสั่งรัน node scripts/apply-migrations.mjs (อนุมัติ 2 migration บันทึกแล้วใน OWNER_APPROVALS)",
  },
  {
    id: "m38-auto-learning-loop",
    title: "docs/11 §2 วงจรเรียนรู้อัตโนมัติ — ผลจริง → น้ำหนัก → แผนถัดไป < 24 ชม.",
    state: "planned",
    deps: ["m04-strategy-analyzer", "m05-apply-learning-data"],
    acceptance: "teaching_outcomes มีข้อมูลจริง + รอบสัปดาห์แรก weights ขยับโดยอัตโนมัติ (ไม่มีมือคนกด) + ตัวเลขเวลาจากซ้อมเสร็จถึงครูปรับตัว < 24 ชม. ถูกวัดจริง",
    evidence: ["tigamodel/docs/11-plan-plus-hundredfold.md"],
  },
  {
    id: "m39-skill-state-wiring",
    title: "docs/12 §1A สายไฟ §3 — อ่าน learner_skill_state จริง → แผนเฉพาะบุคคล (วงจร A พร้อม รอสวิตช์เปิด)",
    state: "code",
    deps: ["m08-skill-state-plans", "m05-apply-learning-data"],
    acceptance: "สายไฟเสร็จ+smoke 16/16 ครบ (fetch ตารางจริง RLS · shape skill_id · แถวเสียข้าม · ไม่มีข้อมูล = null ไม่เดา · switch ปิด = null · plan = buildPersonalizedPlan ตัวจริง byte-identical · kill switch tiga_personalized_plans ในโมดูล · wired web.js) — สถานะ code เพราะวงจร A เริ่มผลิตแผนจริงเมื่อ admin เปิดสวิตช์เท่านั้น (m08 ยังไม่ activation)",
    evidence: ["tigamodel/teaching/skill-state-wiring.js", "tigamodel/scripts/smoke-skill-state-wiring.mjs", "tigamodel/docs/12-plan-thousandfold-compound.md"],
  },
  {
    id: "m40-outcomes-counter",
    title: "docs/13 §1 รายงานเช้า readiness — นับ outcomes จริงบน live DB + verdict อัตโนมัติ (จุดติดวงจร B)",
    state: "done",
    deps: ["m05-apply-learning-data"],
    acceptance: "outcomes-report.mjs (read-only ผ่าน CLI เดียวกับ apply-migrations): นับจริง + ต่อกลยุทธ์ + verdict ตามเกณฑ์ล่วงหน้า (≥50 + กลยุทธ์นำ ≥17) — smoke 9/9 (เกณฑ์ 50 มาจากแผน ไม่ใช่การเดา · 50 แบบนำบาง = ยังไม่เปิด · read-only · CLI หาย = แจ้งชัดไม่ปลอมรายงาน) · ผลจริงรอบแรก: 5 outcomes (ขาดอีก 45 — เกิดเองจากนักเรียนจริง ห้ามปลอม) · npm run morning = คำสั่งเช้าเดียว",
    evidence: ["scripts/outcomes-report.mjs", "tigamodel/scripts/smoke-outcomes-report.mjs", "tigamodel/docs/13-plan-plus-hundred-2.md"],
  },
  {
    id: "m41-compound-dashboard",
    title: "docs/12 §2 แดชบอร์ดวงจร A→B→C — ผลวันนี้เป็นตัวเลขจริง",
    state: "code",
    deps: ["m39-skill-state-wiring", "m40-outcomes-counter"],
    acceptance: "compound-dashboard.js (pure) + scripts/compound-dashboard.mjs (read-only ผ่าน CLI เดียวกับ m40/m43): ทุกช่องคือตัวเลขที่นับได้จริงหรือ 'ยังไม่มีข้อมูลจริง (ไม่ประมาณ)' — ไม่มีช่องไหนเป็น 0 ปลอม · เกณฑ์เปิดสวิตช์เป็นตัวเลขของแผนเอง (A 20 คน m08 / B 50 outcomes m40) · เทรนด์ต้องมี 2 หน้าต่างจริง (สัปดาห์นี้ vs สัปดาห์ก่อน) · อัตรา ตอบไม่ได้ คิดเป็น % ได้ต่อเมื่อมี baseline ก่อน wave · วงจร A พร้อมก็ต่อเมื่อสวิตช์เปิด · smoke-compound-dashboard 19/19 (รวม null/NaN/string เข้าไปก็ไม่พังและไม่กลายเป็นตัวเลข) · ผลจริงรอบแรก: A 0 คน (สวิตช์ปิด), B 5 outcomes (ขาด 45), C 0 diagnosis ที่ระบุทักษะ + % ตอบไม่ได้ = ยังไม่มี baseline → วัดได้ 6/7 ช่อง — สถานะ code เพราะแดชบอร์ดรันได้จริงทุกเช้าแต่วงจร A ยังรอสวิตช์ tiga_personalized_plans (m39) เปิดก่อน",
    evidence: ["tigamodel/evaluation/compound-dashboard.js", "tigamodel/scripts/smoke-compound-dashboard.mjs", "scripts/compound-dashboard.mjs", "tigamodel/docs/12-plan-thousandfold-compound.md"],
  },
  {
    id: "m42-morning-command",
    title: "docs/13 §1 npm run morning — รายงานเช้ารวมทุกวงจรในคำสั่งเดียว",
    state: "code",
    deps: ["m40-outcomes-counter"],
    acceptance: "คำสั่งเดียวจบ: readiness วงจร B (outcomes จริง) + scorecard 8 ด่าน — หน้าเดียวตัวเลขจริงทุกตัว; ขยายครอบวงจร A/C เมื่อ m41/m43 เข้าคิว",
    evidence: ["package.json", "tigamodel/docs/13-plan-plus-hundred-2.md"],
  },
  {
    id: "m43-top-problems-queue",
    title: "docs/13 §1 top_problems จริง → คิว KB wave (วงจร C พร้อม — คิวว่างซื่อสัตย์จนข้อมูลจริงมา)",
    state: "done",
    deps: ["m40-outcomes-counter"],
    acceptance: "problems-to-kb-queue.mjs (read-only): จัดอันดับ learning_diagnoses จริงตามทักษะ → คิว KB wave ต่อ domain (mapping ครบ 7 ทักษะ App SKILLS) · ทักษะไม่รู้จัก = รอ mapping ไม่เดา · DB ว่าง = คิวว่างซื่อสัตย์ (ผลจริงรอบแรก: ยังไม่มี diagnosis ระบุทักษะ) · ทุก entry ใหม่ยังผูกกติกาเหล็กข้อ 7 + retrieval gate เสมอ · smoke 8/8 · npm run morning ครบทุกวงจร",
    evidence: ["scripts/problems-to-kb-queue.mjs", "tigamodel/scripts/smoke-problems-queue.mjs", "tigamodel/docs/13-plan-plus-hundred-2.md"],
  },
  {
    id: "m50-accuracy-audit",
    title: "docs/16 §2 วัดความแม่นยำโมเดล 5 ชั้นใน TIGA MODEL LAB (หน้าเดียวเห็นทุกชั้น + ประวัติ)",
    state: "done",
    deps: ["m07-retrieval-eval", "m34-speed-kb-hotset"],
    acceptance: "lab-accuracy.js: 5 ชั้นวัดจริงจากโมดูลจริง (retrieval 30 probes / policy rules / materials variety / eval suite / compliance flags) — ชั้นไหนข้อมูลไม่พอต้องบอก 'unavailable' อย่างซื่อสัตย์ ห้ามแต่งตัวเลข · ประวัติเก็บใน localStorage จำกัด 30 รอบ ใหม่สุดอยู่บนสุด · UI tab 🎯 ความแม่นยำใน TigamodelLab (state ใน store ไม่ใช่ useState ของ app) · smoke-lab-accuracy 15/15",
    evidence: ["tigamodel/evaluation/lab-accuracy.js", "tigamodel/scripts/smoke-lab-accuracy.mjs", "tigamodel/web.js", "TigamodelLab.tsx", "tigamodel/docs/16-plan-accuracy-coverage.md"],
  },
  {
    id: "m52-global-coverage-wave",
    title: "docs/16 §3 คลัง 5 หมวดจากทั่วโลก — การตลาด/นวัตกรรม/บำบัด เสริมลึก 16 ต่อหมวด + เสิร์ฟได้จริง",
    state: "done",
    deps: ["m07-retrieval-eval", "m25-contribution-gate"],
    acceptance: "global-coverage-wave.js (wave 1 + wave 2): +48 entries (marketing 26→36 · innovation 0→16 · therapy 10→26) — 3 ภาษา (th lead + (EN:) (ZH:) gloss) · แหล่ง tiga-* ทุกตัว · ไม่มีสถิติแต่ง · therapy มีกรอบ wellbeing ใน body (ถ้อยคำไม่เข้า regex ของ compliance ตัวเอง) · domain innovation/marketing/therapy ลงทะเบียนใน KB_DOMAIN_LABEL + KB_DOMAIN_KEYWORDS + SERVED_LABELS จึงเสิร์ฟได้จริง (ไม่ใช่คลังที่ตายเฉย) · retrieval 30 probes 100% (gate 80%) · kb-compliance 0 flag · smoke-coverage-wave 13/13",
    evidence: ["tigamodel/knowledge/global-coverage-wave.js", "tigamodel/evaluation/retrieval-eval.js", "tigamodel/scripts/smoke-coverage-wave.mjs", "tigamodel/web.js", "tigamodel/docs/16-plan-accuracy-coverage.md"],
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
