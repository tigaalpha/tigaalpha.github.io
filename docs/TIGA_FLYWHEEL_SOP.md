# TIGA Flywheel SOP — วงล้อล้าน (แผน v3 ข้อ 4.1)

> หนึ่งหน้า ทำซ้ำได้ไม่รู้จบ · ทุกรอบ "ดีขึ้น" ถูกนับในกริด 1M จริง
> กติกาเหล็กคงเดิม: ไม่มี Java/รันไทม์ใหม่ · SQL ทุกไฟล์รอ owner อนุมัติก่อน apply ·
> เซลล์ปิดเมื่อโมดูลจริงทำงานจริง (No invented progress)

## วงล้อ 6 ก้าว (รอบละ ~1 วันทำงาน)

```
① เลือกงาน        ② ทำ 1 โมดูล      ③ ตรวจ          ④ วัด          ⑤ ปิดเซลล์        ⑥ รีลิส
   workOrder()  →    เล็กที่สุดที่      npm run         npm run         อัปเดตสถานะ       merge → build
   อันดับต้น        เปลี่ยนตัวเลข      verify:tiga      bench:tiga      ในแผน/SOP        → deploy
```

### ① เลือกงานจากคิวจริง (ไม่ใช่ความรู้สึก)
```bash
node -e "import('./tigamodel/web.js').then(async w => { await w.ensureTigamodelWeb(); console.log(w.capabilityWorklist(10)); })"
```
- ทำงานที่ `worstCap` อ่อนสุดและแตะผู้เรียนจริงเร็วที่สุด
- กรณีเลือกจากแผน: ดู §สถานะล่าสุดใน `docs/TIGA_MODEL_DEV_PLAN.md`

### ② ทำโมดูลเล็กที่สุดที่ขยับตัวเลขได้
- 1 โมดูล = 1 ความสามารถ (kb/reasoning/surface/measure/evolve) บน 1 กลุ่มเส้นทาง
- reuse เอนจินเดิมเสมอ (coach/generator/skill-graph/adaptivity) — ห้ามสร้างเอนจินที่สอง
- ทุก feature ใหม่ต้องมี honest-null (ไม่มีข้อมูล → ซ่อน) และ 3 ภาษาครบ

### ③ ตรวจ (ประตูเดียว)
```bash
npm run verify:tiga     # 15 สคริปต์ ~309 checks — แดงตัวเดียว = ห้ามไปต่อ
```

### ④ วัด (ตัวเลขต้องมาจากเอนจิน ไม่ใช่มือ)
```bash
npm run bench:tiga      # เขียน docs/tiga-bench-latest.json + เทียบ release ก่อนอัตโนมัติ
```
- Q-bars 8 ข้อต้องผ่านหมด — แดง = คุณภาพถอย ห้ามรีลิส

### ⑤ ปิดเซลล์ในเอกสาร
- อัปเดตสถานะข้องานใน `docs/TIGA_MODEL_DEV_PLAN.md` (✅ + ตัวเลขจริง)
- เซลล์กริดที่ปลดล็อกเขียนเป็นตัวเลขจาก `plm1mStats()` เท่านั้น

### ⑥ รีลิส
- commit → PR → merge main → `npm run build` ยืนยัน → deploy (GitHub Pages + OTA)
- snapshot bench ถูก commit ไปด้วย = กราฟ "ดีขึ้นล้านเปอร์เซ็นต์" ของจริง

## สถานะปัจจุบันของแผน v3.3 (2026-09-27)

| ระลอก | สถานะ |
|---|---|
| 1 — รากฐานวัดได้ (1.1–1.6) | ✅ ครบ 6 ข้อ · เอนจินแยก lazy (main −25.6%) · memoize 407× · bench + Q-bars |
| 2 — W/H/Q + ครบ 9/9 + StudentContext | 🟡 W/H/Q ✅ (smoke 11) · 9/9 ✅ · eval 130 ✅ · 2.5 (cloud context) ⏳ |
| 3 — เร็วถึง BAR (3.1–3.5) | 🟡 3.1 tiered ✅ · 3.2 cache ✅ · 3.5 budget ✅(ใน Q-bars) · 3.3 router ⏳ · 3.4 ย้ายไป 5.2–5.3 |
| 4 — วงล้อล้าน | 🟡 SOP นี้ ✅ · **4.4 SQL applied + ตรวจ 8/8 ✅** · 4.2/4.3/4.5 ⏳ (4.3 ปลดล็อกแล้ว) |
| **5 — โหลดไว (v3.1 ใหม่)** | 🟡 5.1 interaction-first preload ✅ (Q-bar ที่ 9) · 5.5 bench รายงาน chunk ครบ ✅ · 5.2/5.3/5.4 ⏳ คิวถัดไป |
| **6 — KB การตลาด+ธุรกิจดนตรี (v3.1 · v3.4 ขยาย 6.7–6.12)** | ⏳ 6.1 KB hook/เลือกเพลง/sequencing/positioning · 6.2–6.4 เสียบ selection/next-song/Report Card · 6.5 eval marketing-grounded · 6.6 โตผ่านวงล้อ |
| **7 — หลักฐานผู้เรียนจริง (v3.2 ใหม่)** | ⏳ 7.1–7.5 ทำได้ไม่ต้องมี SQL · **7.6 ปลดล็อกแล้ว (4.4 applied + ตรวจ 8/8)** |
| **8 — คูณความเร็ววงล้อ ×30 (v3.3 ใหม่)** | ✅ 8.1 `cycle:tiga` · 8.2 CI block-merge (`tiga-verify.yml`) · 8.3 `canary-release.mjs` พร้อม (รอ CAPGO_TOKEN) · 8.4 `report:tiga` + digest |
| **9 — คูณความแม่นการพิสูจน์ ×3 (v3.3 ใหม่)** | ⏳ 9.1 fuzz · 9.2 red-team eval · 9.3 เทสเครื่องจริงบังคับ · 9.4 provenance — คิวต่อเนื่อง (แผน v3.3 ยืนยันแล้ว) |
| **10 — คูณอัตราเรียนรู้ ×3 (v3.3 ใหม่)** | ⏳ 10.1 micro-evidence ทุกเซสชัน · 10.2 policy version · 10.3 KB เรียนจากคำถามจริง — คิวต่อเนื่อง (แผน v3.3 ยืนยันแล้ว) |
| **11 — ดนตรีบำบัด (v3.4 ใหม่)** | ⏳ 11.1 KB หลักการบำบัด (เชิงคุณภาพ) · 11.2–11.5 โหมดผ่อนคลาย/mood ISO/ผู้สูงวัย/tone pack · 11.6 eval กันเคลมการแพทย์ · 11.8 โตผ่านวงล้อ — **รอ owner ยืนยันแผน v3.4** |

**ก้าวถัดไปที่คิวแนะนำ (v3.4):** 6.1/6.5 KB การตลาดก้อนแรก + eval → 6.7/6.8 KB ธุรกิจดนตรี + ตลาดการเรียนดนตรี →
11.1/11.6 KB ดนตรีบำบัด + eval กันเคลม → 6.9–6.12 + 11.2–11.7 เสียบผลิตภัณฑ์ 3 ภาษา →
5.2/5.3 ย่อเอนจิน + KB lazy → 5.4 prefetch ตาม intent → 7.1/7.2 หลักฐานผู้เรียนจริง →
2.5 StudentContext ข้ามอุปกรณ์ (ใช้ `user_cloud_state`) → 3.3+4.2 adaptive router

## กันพลาด (อ่านก่อนข้ามขั้น)
- **ห้ามข้าม ③** — verify:tiga เป็นประตูเดียวที่กัน regression ทั้ง 3 ภาษา/บั๊กอะซิงก์/grid ล้ม
- **ห้ามแต่ง bench** — ถ้า bench แดง ให้แก้โค้ด ไม่ใช่แก้เกณฑ์ (ยกเว้น owner สั่งเองพร้อมเหตุผล)
- **SQL ใหม่ทุกไฟล์** ต้อง: additive, re-runnable, ไม่เก็บ user_id, อ่านผ่าน RPC aggregate เท่านั้น — แล้วรออนุมัติ
