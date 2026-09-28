/* One-shot: plan v3.4 — owner command "เน้นองค์ความรู้ธุรกิจในอุตสาหกรรมดนตรีให้เยอะที่สุด
   + ดนตรีบำบัดให้เยอะที่สุด". Expands wave 6 (6.7–6.12) + adds wave 11 (music therapy),
   updates KPI/risks/status/queue/§6 and the SOP. Asserted line-based anchors, atomic,
   deleted after run (repo convention). */
import { readFileSync, writeFileSync } from "node:fs";

const PLAN = 'docs/TIGA_MODEL_DEV_PLAN.md';
const SOP = 'docs/TIGA_FLYWHEEL_SOP.md';

let ok = true;
const editLines = (F, fn) => {
  const lines = readFileSync(F, 'utf8').split('\n');
  const log = fn(lines);
  if (log === false) { console.error('ANCHOR FAIL in ' + F); ok = false; return; }
  writeFileSync(F, lines.join('\n'));
  console.log('OK ' + F + ' — ' + log);
};

const findOnce = (lines, needle) => {
  const hits = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(needle)) hits.push(i);
  if (hits.length !== 1) { console.error('ANCHOR FAIL: "' + needle.slice(0, 50) + '" hits=' + hits.length); ok = false; return -1; }
  return hits[0];
};

/* ── PLAN ── */
editLines(PLAN, (lines) => {
  /* 1) header note v3.4 */
  let i = findOnce(lines, 'ตรวจจากโค้ดจริง ณ v13.7.373');
  if (i < 0) return false;
  lines.splice(i + 1, 0,
    '>',
    '> **ฉบับ v3.4 (คำสั่ง owner "มุ่งเน้นองค์ความรู้ธุรกิจในอุตสาหกรรมดนตรีให้เยอะที่สุด + ดนตรีบำบัดให้เยอะที่สุด"):**',
    '> ขยายระลอก 6 เพิ่ม 6.7–6.12 (KB ธุรกิจดนตรี · KB ตลาดการเรียนดนตรี · career pathways · eval business-grounded ·',
    '> Model Lab แท็บธุรกิจ) + **ระลอก 11 ใหม่ — ดนตรีบำบัด** (11.1–11.8: KB หลักการบำบัดเชิงคุณภาพ · โหมดผ่อนคลาย ·',
    '> mood check-in แบบ ISO · โหมดครอบครัว/ผู้สูงวัย · eval therapy-grounded กันเคลมการแพทย์) — สองขุมความรู้นี้ขึ้นหัวคิว',
    '> **ยังไม่เริ่มสร้าง รอ owner ยืนยันฉบับนี้**',
    '');
  /* 2) wave 6: append 6.7–6.12 rows after the 6.6 row */
  i = findOnce(lines, '| 6.6 |');
  if (i < 0) return false;
  lines.splice(i + 1, 0,
    '| 6.7 | **KB ธุรกิจดนตรีก้อนใหญ่:** `tigamodel/knowledge/music-business.js` — กลไกอุตสาหกรรมเชิงคุณภาพ: ระบบสตรีมมิ่งทำงานอย่างไร · ลิขสิทธิ์/ค่าลิขสิทธิ์ (publishing) · sync licensing (เพลงในหนัง/โฆษณา/เกม) · เศรษฐศาสตร์คอนเสิร์ตและงานสด · การจับมือแบรนด์ — ครบ 3 ภาษา ทุก entry มีที่มาในไฟล์ | โครง KB เดิม + รูปแบบ university-sources | smoke ใหม่ ≥ 12 · 0 ตัวเลขไร้ที่มา | เซลล์กริดด้าน KB ใหม่ |',
    '| 6.8 | **KB ตลาดการเรียนดนตรี:** `music-education-market.js` — วงจรผู้เรียน (ทดลอง → ติดหัว → สอบเกรด → ขึ้นเวที) · แรงจูงใจของผู้ปกครอง · เหตุผลที่คนเลิกเรียน · โครงสร้างระบบเกรดซ้อม (เชิงคุณภาพ ไม่อ้างตัวเลขของสถาบันใด) | เชื่อม funnel v3 เดิม | smoke ≥ 10 | เซลล์ M/S ฝั่งธุรกิจ |',
    '| 6.9 | **Career pathways:** ครู AI ตอบ "เรียนเปียโนต่อไปได้อะไร" (สายครูสอน · แต่งเพลง · รับจ้างเล่น · คอนเทนต์) โดยอ้าง KB 6.7/6.8 จริงเท่านั้น | coach + chat เดิม | เคส 3 ภาษา · ไม่มี KB → honest-null | surface rows ใหม่ |',
    '| 6.10 | **คุณค่าระยะยาวใน Report Card:** บทใหม่เล่าให้ผู้ปกครองฟังว่าเส้นทางนี้นำไปอะไร (อ้าง 6.8 · ไม่มีข้อมูล → ซ่อน) | buildParentReport เดิม | เคส 3 ภาษา | surface row ผู้ปกครอง |',
    '| 6.11 | **eval ตระกูล `business-grounded`:** คำตอบด้านธุรกิจต้องอ้าง entry KB จริง ห้ามเหตุผลลอย/ตัวเลขเดา | eval-expanded เดิม | ≥ 8 ผ่าน · รวมใน verify:tiga | กันคุณภาพขุมธุรกิจ |',
    '| 6.12 | **Model Lab แท็บธุรกิจ:** เห็นครอบคลุม KB ธุรกิจ + provenance ทุกชิ้น (อนุมัติเป็นชุดผ่าน 4.5) | AdminAIModels เดิม | แท็บโชว์ coverage + ที่มา | measure |');
  /* 3) wave-6 KPI line → expanded */
  i = findOnce(lines, 'KPI ปลายระลอก: KB marketing');
  if (i < 0) return false;
  lines[i] = 'KPI ปลายระลอก (v3.4 ขยาย): KB marketing ≥ 120 + KB ธุรกิจดนตรี ≥ 80 + KB ตลาดการเรียนดนตรี ≥ 60 entries ครบ 3 ภาษา (ทุกตัวอ้างที่มาในไฟล์) · คำแนะนำและคำตอบธุรกิจอ้าง KB จริง 100% · eval marketing-grounded + business-grounded ≥ 16 ผ่าน';
  if (lines[i + 1] && lines[i + 1].startsWith('eval marketing-grounded')) lines.splice(i + 1, 1);
  /* 4) wave 11 before "## 3. ตาราง KPI รวม" */
  i = findOnce(lines, '## 3. ตาราง KPI รวม');
  if (i < 0) return false;
  let sep = i;
  while (sep > 0 && lines[sep - 1].trim() === '') sep--;
  lines.splice(sep, 0,
    '---',
    '',
    '## ระลอก 11 — ดนตรีบำบัด: ครู AI ที่รู้จัก "เพลงรักษาใจ" (v3.4 ใหม่)',
    '',
    'เหตุผล: ดนตรีบำบัดคือขุมความรู้ที่ทำให้แอปต่างจากคู่แข่ง — "สอนให้เล่นได้" ≠ "สอนให้ชีวิตดีขึ้น" — และเปิดกลุ่มเป้าหมายใหม่',
    '(ผู้สูงวัย · ครอบครัว · กลุ่ม wellness) ต่อยอด KB ตลาดจาก 6.8 โดยตรง',
    '',
    '**กติกาเหล็กของระลอกนี้ (เส้นแบ่งที่ไม่มีข้อยกเว้น):** แอป**ไม่ใช่**บริการทางการแพทย์ — ไม่วินิจฉัย ไม่รักษา',
    'ไม่แทนที่นักดนตรีบำบัดมืออาชีพ · ทุกข้อความใช้กรอบสุขภาวะ (wellbeing) · หลักการใน KB เขียนเชิงคุณภาพเท่านั้น',
    '(ห้ามแต่งตัวเลขผลศึกษา) · จุดสัมผัสที่มีโอกาสเข้าใจผิดต้องมีข้อความเตือนครบ 3 ภาษา · หลักฐานไม่พอ → honest-null',
    '',
    '| # | งาน | กลไก (reuse ล้วน) | เกณฑ์รับ | เซลล์ที่ปลดล็อก |',
    '|---|---|---|---|---|',
    '| 11.1 | **KB ดนตรีบำบัดก้อนแรก:** `tigamodel/knowledge/music-therapy.js` — หลักการที่ยอมรับกว้างเชิงคุณภาพ: receptive vs active methods · ISO principle (จับคู่อารมณ์ผู้ฟังแล้วเลื่อนขึ้นทีละน้อย) · rhythmic entrainment (จังหวะนำการเคลื่อนไหว/การหายใจ) · จังหวะช้ากับการผ่อนคลาย · tension–release · ดนตรีกับความจำ (เพลงที่รักในวัยเยาว์) · แนวทางกับเด็กและผู้สูงอายุ | โครง KB เดิม | smoke ≥ 12 · 0 เคลมการแพทย์ | KB ใหม่ทั้งหมด |',
    '| 11.2 | **โหมดผ่อนคลาย (calming practice):** เส้นทางซ้อมจังหวะช้า + หายใจตามเมโทรนอมที่มีอยู่ + เพลงนุ่มที่ผู้เรียนรู้จัก — คำเรียก/คำโปรยอยู่ในกรอบ wellbeing | practice mode + metronome เดิม | เคส fixture ผ่าน · disclaimer ครบ | เซลล์ M ของเส้นทาง practice |',
    '| 11.3 | **Mood check-in → เพลงแนะนำแบบ ISO:** ถามอารมณ์สั้น ๆ → เลือกเพลงจาก songs-data + KB ตรงอารมณ์ แล้วเลื่อนทีละขั้น | song selection เดิม + KB 11.1 | เคส 3 ภาษา · ไม่มีเพลงตรง → ซ่อน (honest-null) | เซลล์ T/M ของ song |',
    '| 11.4 | **น้ำเสียงอ่อนโยนของครู (therapy tone pack) + disclaimer:** Voice Tutor/chat ใช้ภาษาดูแลใจตาม KB · จุดเสี่ยงทุกจุดมีข้อความ "ไม่ใช่คำแนะนำทางการแพทย์" 3 ภาษา | use-voice-tutor/chat เดิม | red-team จับเคลมได้ 0 ครั้ง | surface rows |',
    '| 11.5 | **โหมดครอบครัว/ผู้สูงวัย:** เพลงคลาสสิกรุ่นคุณปู่ + ปรับระดับง่ายตาม ageBand เดิม · Report Card เล่าผลด้านความสุข/ความจำอย่างระวังคำ (อ้าง KB) | ageBand + 6.8 | เคส 3 ภาษา | เซลล์ W ใหม่ |',
    '| 11.6 | **eval ตระกูล `therapy-grounded`:** ห้ามเคลมการแพทย์ · ต้องอ้าง entry KB จริง · disclaimer ปรากฏในบริบทที่กำหนด | eval-expanded เดิม | ≥ 8 ผ่าน · 0 เคลม | เงื่อนไขรีลิสของระลอกนี้ |',
    '| 11.7 | **ตลาดใหม่ใน KB ธุรกิจ:** กลุ่มผู้สูงวัย/wellness กลายเป็นกลุ่มเป้าหมายใน 6.8 (โครงข้อเสนอคุณค่า — ไม่เดาตัวเลข) | 6.8 | เคสอ้าง KB จริง | เซลล์ธุรกิจ |',
    '| 11.8 | **KB โตผ่านวงล้อ:** domain `therapy` ใน workOrder + อนุมัติเป็นชุดใน Model Lab | 4.1/4.5 | รอบถัดไปเลือกงานนี้ได้ | S evolve |',
    '',
    'KPI ปลายระลอก: KB therapy ≥ 60 entries 3 ภาษา · eval therapy-grounded ≥ 8 ผ่าน · เคลมการแพทย์ = 0 (red-team ยืนยัน) · disclaimer ครบทุกจุดสัมผัสเสี่ยง',
    '');
  /* 5) KPI table: 2 new rows */
  i = findOnce(lines, 'อัตราเรียนรู้ (หลักฐานใหม่/สัปดาห์)');
  if (i < 0) return false;
  lines.splice(i + 1, 0,
    '| ขุมความรู้ธุรกิจ+บำบัด (KB) | 0 (มีแต่ marketing ในแผน) | **≥ 200 entries 3 ภาษา อ้างที่มาครบ** (รวม marketing ≥ 320) | smoke 6.7/6.8/11.1 |',
    '| เคลมการแพทย์ในผลิตภัณฑ์ | — | **0** (red-team 11.6 ยืนยันทุกรีลิส) | eval therapy-grounded |');
  /* 6) risks: 2 new bullets */
  i = findOnce(lines, 'ระลอก 10:');
  if (i < 0) return false;
  lines.splice(i + 1, 0,
    '- **ระลอก 6 ขยาย (6.7–6.12):** กลไกธุรกิจทุกอย่างเขียนเชิงคุณภาพ — ตัวเลขสถิติทุกตัวต้องมีที่มาในไฟล์ KB ห้ามเดาแม้แต่ตัวเดียว (No invented data เต็มรูปแบบ)',
    '- **ระลอก 11 (ดนตรีบำบัด):** กรอบ wellbeing เท่านั้น — ห้ามวินิจฉัย/ห้ามอ้างว่ารักษาโรค · disclaimer 3 ภาษาทุกจุดเสี่ยง · eval therapy-grounded (11.6) เป็นเงื่อนไขรีลิส');
  /* 7) status paragraph */
  i = findOnce(lines, '4.3 A/B + 7.6 หลักฐานข้ามอุปกรณ์ปลดล็อกแล้ว');
  if (i < 0) return false;
  lines.splice(i + 1, 0,
    '',
    '**v3.4 (2026-09-27):** ตามคำสั่ง owner "เน้นองค์ความรู้ธุรกิจในอุตสาหกรรมดนตรีให้เยอะที่สุด + ดนตรีบำบัดให้เยอะที่สุด" —',
    'ขยายระลอก 6 เป็น 6.7–6.12 · เพิ่มระลอก 11 ดนตรีบำบัด (กรอบ wellbeing เหล็ก) — **ยังไม่เริ่มสร้าง รอ owner ยืนยันฉบับนี้**');
  /* 8) §6 decision row */
  i = findOnce(lines, '| ยืนยันแผน v3.3 |');
  if (i < 0) return false;
  lines[i] = '| ยืนยันแผน v3.4 | คำยืนยันในแชท | เริ่มขุมความรู้: 6.7/6.8 (ธุรกิจ) + 11.1/11.6 (บำบัด + eval กันเคลม) ก่อนคิวอื่น | แผนรอ ไม่มีอะไรถูกสร้าง |';
  /* 9) queue note */
  i = findOnce(lines, '**ปรับ v3.3:**');
  if (i < 0) return false;
  lines.splice(i + 1, 0,
    '',
    '**ปรับ v3.4:** ยก **6.7/6.8 (KB ธุรกิจดนตรี) + 11.1/11.6 (KB บำบัด + eval กันเคลม)** ขึ้นหัวคิวตามลำดับความสำคัญของ owner —',
    'สองขุมความรู้นี้คือสิ่งที่คู่แข่งลอกยากที่สุด งานโหลด-ไว (5.2/5.3) เลื่อนไปขั้นถัดไป');
  return 'header · 6.7–6.12 · KPI · ระลอก 11 · KPI rows · risks · status · §6 · queue';
});

/* ── SOP ── */
editLines(SOP, (lines) => {
  /* wave 11 row after wave 10 */
  let i = findOnce(lines, '| **10 — คูณอัตราเรียนรู้ ×3 (v3.3 ใหม่)** |');
  if (i < 0) return false;
  lines.splice(i + 1, 0,
    '| **11 — ดนตรีบำบัด (v3.4 ใหม่)** | ⏳ 11.1 KB หลักการบำบัด (เชิงคุณภาพ) · 11.2–11.5 โหมดผ่อนคลาย/mood ISO/ผู้สูงวัย/tone pack · 11.6 eval กันเคลมการแพทย์ · 11.8 โตผ่านวงล้อ — **รอ owner ยืนยันแผน v3.4** |');
  /* wave 9/10 rows: owner already confirmed v3.3 — refresh stale tags */
  let stale = 0;
  for (let k = 0; k < lines.length; k++) {
    if (lines[k].includes(' — **รอ owner ยืนยันแผน** |')) { lines[k] = lines[k].replace(' — **รอ owner ยืนยันแผน** |', ' — คิวต่อเนื่อง (แผน v3.3 ยืนยันแล้ว) |'); stale++; }
  }
  /* wave 6 label: reflect expansion */
  i = findOnce(lines, '| **6 — KB การตลาดดนตรี (v3.1 ใหม่)** |');
  if (i < 0) return false;
  lines[i] = lines[i].replace('| **6 — KB การตลาดดนตรี (v3.1 ใหม่)** |', '| **6 — KB การตลาด+ธุรกิจดนตรี (v3.1 · v3.4 ขยาย 6.7–6.12)** |');
  /* next-step queue → v3.4 order */
  i = findOnce(lines, 'ก้าวถัดไปที่คิวแนะนำ (v3.3');
  if (i < 0) return false;
  const j = Math.min(i + 3, lines.length);
  lines.splice(i, j - i,
    '**ก้าวถัดไปที่คิวแนะนำ (v3.4):** 6.1/6.5 KB การตลาดก้อนแรก + eval → 6.7/6.8 KB ธุรกิจดนตรี + ตลาดการเรียนดนตรี →',
    '11.1/11.6 KB ดนตรีบำบัด + eval กันเคลม → 6.9–6.12 + 11.2–11.7 เสียบผลิตภัณฑ์ 3 ภาษา →',
    '5.2/5.3 ย่อเอนจิน + KB lazy → 5.4 prefetch ตาม intent → 7.1/7.2 หลักฐานผู้เรียนจริง →',
    '2.5 StudentContext ข้ามอุปกรณ์ (ใช้ `user_cloud_state`) → 3.3+4.2 adaptive router');
  return 'wave 11 row · ' + stale + ' stale tags refreshed · wave 6 label · v3.4 queue';
});

if (!ok) { console.error('ABORT — nothing meaningful changed beyond partial writes; check FAILs'); process.exit(1); }
console.log('ALL OK');
