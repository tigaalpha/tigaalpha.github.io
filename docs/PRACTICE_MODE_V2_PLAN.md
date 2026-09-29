# แผน Practice Mode v4.1 — ยกระดับห้องซ้อมให้เป็นครูส่วนตัวเต็มตัว · **v4 execution-grade + E0 พิสูจน์แล้ว**

> 2026-09-23 · สถานะ: **PLAN (รออนุมัติก่อน implement UI) — E0 pre-flight ผ่านครบ + reference implementation พิสูจน์ด้วย smoke test 36/36 แล้ว** · อ้างอิงโค้ดจริง: `use-practice-mode.ts` (875 บรรทัด), `PracticeOverlay.tsx` (426 บรรทัด), `use-practice-coach.ts` (300 บรรทัด), `mistake-drill.ts` (142 บรรทัด), `use-autoteach.ts`, `SfxMetronomeSettings.tsx`, `App.tsx` (popup/economy layer)
>
> **ลำดับเวอร์ชันของแผนนี้:** v2 = รายการฟีเจอร์ 11 ข้อ · v3 = +audit กับดักโค้ด 5 จุด (T1-T5) + KPI + runbook · v4 = +interface contract + boundary matrix + pre-flight + rollback · **v4.1 = E0 รันจริงครบ 6 ข้อ + `practice-spot.ts` (reference implementation) + `tigamodel/scripts/smoke-practice-spot.mjs` ผ่าน 36/36 + build ผ่าน — สัญญาในแผนนี้ไม่ใช่ข้อเสนอ แต่เป็นโค้ดที่พิสูจน์แล้ว**
>
> **ผล E0 สรุป (หลักฐานอยู่ §8):** ① C3 ตัดสินใจได้ = `CHALLENGE_POOL` เป็น pool ปิด 9 ชิ้น (games/exp/perfect เท่านั้น) แต่ `bumpWeekly` รับ key อะไรก็ได้ → เพิ่ม `spots` เข้า pool 3 ชิ้นใหม่ หรือแมป `games` — ตัดสินตอน implement C3 ② มือซ้ายมี FINGERINGS_LH จริง 24 คีย์ (B1 ทำได้เต็ม) ③ startPractice ขยายเฉพาะ `mode==="scale"` → **§2.2 แก้เป็น emit mode:"seq" — ไม่ต้องแก้ startPractice แม้แต่บรรทัดเดียว** ④ JEV_TASKS รองรับ pattern เดิม ⑤ SafeZone ครอบ practice result อยู่แล้ว (C2 วางได้เลย) ⑥ logUsage/tg_weekly sync พร้อม — ไม่มีข้อใดขัดข้อง แผนต่อจากนี้ implement ได้ทันที

---

## §0 KPI + สมดุลสามทาง

**สมดุลสามทาง (ข้อไหนทำ KPI ตัวใดตก = ล้มข้อนั้น, ไม่ใช่ล้มทั้งแผน):** ① คุณค่าการเรียนรู้เพิ่ม แต่เวลาซ้อมต่อรอบ/ความสนุกตก = ห้าม ② ฟีเจอร์ใหม่เพิ่ม แต่ fallback พัง = ห้าม ③ เศรษฐกิจเหรียญ/EXP/เพชรเปลี่ยน = ห้าม (แผนนี้ไม่แตะเศรษฐกิจเลยทุกข้อ)

| KPI | วิธีวัด (event จริงใน §2.6) | เป้า 30 วัน | ผู้รับผิดข้อ |
|---|---|---|---|
| Spot CTR: รอบพลาด ≥1 จุด → กด 🎯 | `spot:start` ÷ (รอบที่ miss>0) | ≥ 25% | A1 |
| ประสิทธิภาพ Spot: acc รอบเต็มถัดไปของ drill เดิม | เทียบ `tg_practice_log.recent` ก่อน/หลัง | +10 จุดขึ้น | A1 |
| Variation adoption: ใช้มุมใหม่ ≥1 ครั้ง/สัปดาห์ | `var:hand|transpose|tempo` รวมต่อ user | ≥ 15% ของ active | B1 |
| Metronome stickiness: เปิดแล้วซ้อมจบรอบ | `met:off` หลัง `met:on` โดยไม่จบรอบ ÷ ทั้งหมด | ปล่อยกลางคัน ≤ 40% | A3 |
| Rhythm ดีขึ้นเมื่อใช้ metronome | rhythmPct เฉลี่ยเปิด vs ไม่เปิด | ≥ +5 จุด | A3 |
| Guard: D7 retention ของผู้ใช้ spot vs ไม่ spot | learning_observations | ไม่ต่ำกว่า | D1 |

---

## §0.5 ผล audit โค้ด — กับดักที่ v2 พลาด (T1-T5) + ของเดิมที่ต้อง reuse

ทุกกับดักถูก "แก้เข้าไปใน interface contract" ของ §2 แล้ว ตารางนี้คือเหตุผลอ้างอิง:

| # | ที่เจอจากโค้ดจริง | ผลถ้าทำตาม v2 ตรง ๆ | แก้ที่ |
|---|---|---|---|
| T1 | `mistake-drill.ts` มี tempo ladder สำเร็จรูป (`nextDrillTempo` 0.75→0.85→1, `firstDrillTempo`) ของ Play Along Mistake Loop | เขียน ladder ใหม่ = ระบบเลื่อน 2 จังหวะไม่ตรงกัน | B1 |
| T2 | `replayDrill` ป้อน `practiceAscRef` (**ascending เท่านั้น**) ให้ `startPractice` เพราะ startPractice ขยาย up+down เอง — spot drill ที่หั่นจาก `practiceTargetRef` (ตัวขยายแล้ว) จะถูก**ขยายซ้ำ 2 เท่า** | drill สเกลยาวเป็น 2 เท่า โน้ตโผล่ซ้ำ | §2.2 |
| T3 | `startPractice` อ่าน `seq.stageId`/`seq.bossGroup` ทั้งก้อน — subset drill ที่พา stageId ติดไป จบ subset = `markPathDone` ปลดล็อก Pathway ด้วย drill ที่เล่นไม่ครบ | **ปลดล็อก Pathway ผิด** (ข้อมูลจริงเสียหาย + ผู้เรียนเข้าใจผิดว่าผ่านแล้ว) | §2.2 |
| T4 | โหมด `chord`/`prog`+block มีหน้าต่างคอร์ด (`chordGroupSize`, seed `practiceHitSetRef` ด้วยชุดแรก) — หั่นรายโน้ตทำหน้าต่างเบี้ยว | drill คอร์ด block เกรดผิดตั้งแต่โน้ตแรก | §2.1 |
| T5 | `use-practice-coach.ts` มี STRATEGY_EFFECTS (6 strategy IDs ยืนยันแล้ว: `return-to-prerequisite`, `simplify-on-confusion`, `simplify-on-hard-report`, `ease-off-on-low-engagement`, `raise-challenge`, `continue-current-plan`) กำหนด topic/level แบบฝึกถัดไป — Jev ตอบตรง ๆ โดยไม่ compose = ครูสองคนขัดกันหน้าผู้เรียน | Jev บอกซ้อมจุด A, coach ออกแบบฝึกจุด B | §2.7 |
| T6 | `use-practice-coach.ts` มี `drillBpm(practiceTarget)` + hook `usePracticeCoach` **รับ `metroBpm` param อยู่แล้ว** | A3 ถ้าสร้าง BPM source ใหม่จะมีสองแหล่งขัดกัน | §2.4 |

**Reuse list (ห้ามเขียนใหม่):** tempo ladder (T1→B1) · `drillBpm`/coach BPM (T6→A3) · STRATEGY_EFFECTS แนวคิด (T5→C1) · `fingersForNotes(key,mode,notes,hand)` สองมือ (B1) · `metroBpm/setMetroBpm` state ของ App (A3 — แค่เดินสาย) · `tg_practice_log.recent` {label,acc} (B2, D2) · `tiga:practice-done` event (D1 ต่อยอด) · `logUsage(กลุ่ม,รายละเอียด)` (ยืนยัน pattern จาก App.tsx `logUsage("gem","shortpop:cta")`) · `playUi` (B3) · popup framework `atpopup` (C2)

---

## §1 Work packages — 12 แพ็กเกจ 4 สตรีม

| WP | ชื่อ | P | Effort | ต้องมีก่อน | Risk | fallback เมื่อปิด/ล้ม |
|---|---|---|---|---|---|---|
| **A1** | Spot Drill ("ซ้อมเฉพาะโน้ตที่พลาด") | P0 | 1 วัน | — | กลาง (T2/T3/T4) | ปุ่มซ่อน = ไม่มี spot drill (เหมือนวันนี้) |
| **A2** | แผนที่ผลต่อโน้ต (ชิปสี) | P0 | 0.5 วัน | A1 data | ต่ำ | ชิปสีเดิมทั้งหมด |
| **A3** | เมโทรนอมในห้องซ้อม | P1 | 0.5 วัน | — | ต่ำ | ไม่มีจังหวะ = evenness เดิม 100% |
| **B1** | Variation Row 3 ปุ่ม (มือ/คีย์/เทมโป) | P1 | 1 วัน | A3 (ปุ่มเทมโป) | ต่ำ | ไม่มีปุ่ม = ไม่มีมุมใหม่ (เหมือนวันนี้) |
| **B2** | Sparkline แนวโน้มใน Drill Deck | P2 | 0.25 วัน | — | ต่ำ | ไม่มีเส้น (เหมือนวันนี้) |
| **B3** | Combo FX ที่ 8/15/25 | P2 | 0.25 วัน | — | ต่ำ | badge เดิมเงียบ ๆ |
| **C1** | Jev `practice-spot` task #13 | P1 | 0.5 วัน + deploy | A1 | กลาง (T5) | กฎ fallback "บ่อยสุดก่อน" |
| **C2** | Session Summary การ์ดสรุปวัน | P2 | 0.5 วัน | — | ต่ำ | ไม่มีการ์ด (เหมือนวันนี้) |
| **C3** | Weekly challenge ผูก Spot | P2 | 0.25 วัน | A1 | ต่ำ | challenge เดิมไม่มีประเภท spot |
| **D1** | Events + payload ต่อยอด | P0 | 0.25 วัน | — | ต่ำ | — (เป็นเครื่องมือวัดล้วน) |
| **D2** | Admin: ดู KPI รวม | P2 | 0.5 วัน | D1 | ต่ำ | ดูจาก Supabase ตรง ๆ |
| **E0** | Pre-flight ตรวจสมมติฐาน 6 ข้อ (§8) | P0 | 0.25 วัน | ก่อนเขียนโค้ดทุกอย่าง | — | ค้นพบขัดแย้ง = กลับมาอัปเดตแผนก่อน |

รวม ~5.5-6 วัน implement + buffer ทดสอบ ≈ **7 วันทำงาน** (v3 ประเมิน 3.5-4 วัน — v4 เพิ่ม D2/E0 + QA เต็มรูปแบบ)

---

## §2 Interface contracts — ซิกเนเจอร์ + กฎที่ห้ามเยื้อง

### §2.1 `practice-spot.ts` (ไฟล์ใหม่, pure, dependency-free — สไตล์ mistake-drill.ts)

```js
// คืน null เมื่อหั่นไม่ได้ (พลาด 0 / target ว่าง) — caller ซ่อนปุ่ม
buildSpotTarget({
  target,        // array โน้ตขยายแล้ว (practiceTargetRef.current)
  ascNotes,      // array ascending เท่านั้น (practiceAscRef.current) — สำหรับโหมด scale
  mode,          // "seq" | "chord" | "prog"
  chordGroupSize,// จาก lastSeq.chordGroupSize (0 เมื่อไม่ใช่ block)
  chordSizes,    // จาก lastSeq.chordSizes (โหมด prog)
  wrongByIdx,    // Map<number(number), number(count)> จาก §2.3
  label,         // label เดิม
  bpm,           // drillBpm ของรอบ (คงไว้ให้ coach ใช้ต่อ — T6)
})
// → { notes, mode, key, chordGroupSize, chordSizes, label: label+" · จุดพลาด", bpm, noExpand }
```

**กฎหั่น (ห้ามเยื้อง):**
1. โหมด scale: ใช้ `ascNotes` กรอง index ที่พลาด + `noExpand:true` (T2 — ห้ามส่ง target ขยายแล้วผ่าน expansion อีกรอบ)
2. โหมด chord/prog+block: หั่นเป็น**ทั้งคอร์ดที่มีโน้ตพลาด ≥1** เท่านั้น (T4) — `chordGroupSize` ใหม่ = ขนาดคอร์ดจริงของคอร์ดที่เหลือ (ตรวจว่าเท่ากันทุกคอร์ด ไม่เท่า = ตั้ง `chordSizes` และ `chordGroupSize:0` ให้โค้ดเดิม derive เอง)
3. ลบ `stageId` และ `bossGroup` **ออกเสมอ** (T3) — สร้าง key ใหม่โดยไม่มีฟิลด์นี้เลย ไม่ใช่ตั้ง null เพราะ `startPractice` อ่าน falsy เท่ากัน แต่ไม่ให้ Drill Deck save ทับเคสเดิม
4. cap 12 โน้ต/คอร์ด 4 ชุด: เลือก worst-first ตาม count แล้วเรียงกลับตามลำดับเพลง
5. fallback เมื่อ `wrongByIdx` ว่าง: ใช้ pitch-class จาก `practiceNoteMissesRef` (มีอยู่) กรองก่อน แล้วเติมด้วย index พลาดอื่นจนครบ

### §2.2 `startSpotPractice(seq)` ใน `use-practice-mode.ts` — **ฉบับแก้หลัง E0 (ง่ายกว่าเดิม)**

- **E0 พบ:** `startPractice` ขยาย up+down เฉพาะ `if (seq.mode === "scale")` — spot drill ที่ emit `mode:"seq"` (ซึ่ง `buildSpotTarget` ทำอยู่แล้ว) **ไม่ถูกขยายซ้ำโดยโครงสร้างเดิม** → **ไม่ต้องแก้ startPractice เพิ่ม branch `noExpand` เลย** (v4 เดิมเสนอผิด — แก้แล้ว) `noExpand` คงอยู่ใน output เป็นเอกสารประกอบเท่านั้น
- วิธี: เรียก `buildSpotTarget` ที่ finish ไว้ → ยัด `lastSeq.current = spotSeq` → เรียก `startPractice()` เดิม
- หลังจบ Spot Drill: `finishPractice` เดิมทำงานปกติ **ยกเว้น** — ไม่ markPathDone/markBossDone (T3: output ไม่มี stageId/bossGroup ให้ mark อยู่แล้ว), `bumpWeekly("games",1)` นับ, `bumpWeekly("perfect",…)` **ไม่นับ** (ไม่ใช่รอบเต็ม) — ใช้ flag `practiceIsSpotRef` ตรวจใน finishPractice

### §2.3 นับพลาดต่อ-index: `practiceWrongByIdxRef` (Map)

- นับใน `handlePlayedNote` ตอน miss — **กฎเดียวสองโหมด**: index ที่ "กำลังรอ" = `practiceIdxRef.current` (seq) หรือ index แรกที่ยังไม่ hit ในหน้าต่างคอร์ดปัจจุบัน (block — เดินจาก `practiceChordGrpRef`)
- reset ที่ startPractice/restartPractice พร้อม refs เดิม
- flush ที่ finishPractice → snapshot `{idx: count}` ใส่ result (A2 ใช้ render + A1 ใช้หั่น)

### §2.4 Metronome (A3)

- **PracticeOverlay มี ticker ในตัว** (`setInterval` + `getAC()` click ผ่าน `playUi`) — ไม่ยุ่ง metronome กลางของ App (SfxMetronomeSettings เป็นของผู้ใช้ทั้งแอป)
- BPM เริ่ม = coach `tempo.bpm` (T6 — มีอยู่แล้วใน overlay) → fallback `drillBpm(target)` → ไม่มี = ซ่อนปุ่ม
- lifecycle: สร้างเมื่อกดเปิด / ทำลายเมื่อ (กดปิด ‖ ออก overlay ‖ finishPractice ‖ unmount) — 4 จุดเขียนใน useEffect cleanup + เรียกตรง
- `scoreRhythm(times, beatMs?)`: beatMs=null = evenness เดิม (±35% — regression-safe); beatMs=60000/bpm = IOI เทียบ beat ±20% · ผลทั้งสองโหมดเก็บแยก เรนเดอร์ "สม่ำเสมอ X% / ตามจังหวะ Y%"

### §2.5 i18n keys (ครบชุด — เพิ่ม 3 ภาษาพร้อมกัน)

`practiceSpotBtn`, `practiceSpotN` ({n}), `practiceMetOn`, `practiceMetOff`, `practiceVarHand`, `practiceVarTranspose`, `practiceVarTempo`, `practiceTrend`, `practiceSummaryTitle`, `practiceSummaryBody` ({n},{x},{y}), `rhythmEven`, `rhythmBeat`, `practiceSpotDone` (toast เมื่อจบ spot)

### §2.6 Events (D1) — ผ่าน `logUsage` เดิม

```
logUsage("practice", "spot:start" | "spot:clear" | "var:hand" | "var:transpose" | "var:tempo" | "met:on" | "met:off")
tiga:practice-done detail += { spotUsed: boolean }   // ต่อยอด event เดิม ไม่ใช่ event ใหม่
```

### §2.7 Jev task #13 `practice-spot` (C1)

- Input: `{ label, missCount, missedPcs[], wrongTop[], strugglesTop[], strategyId, prefer }` โดย `prefer` = `"easier"|"harder"|null` derive จาก STRATEGY_EFFECTS (T5): simplify/return-to-prerequisite → easier, raise-challenge → harder, อื่น = null
- Answers: `round_misses` (default) | `memory_weak` | `round_plus_memory` | `full_replay` — ทุกคำตอบไปทาง `buildSpotTarget` กลไกเดียว (Jev เลือกกลยุทธ์ ไม่เลือกโน้ต)
- ลงทะเบียน piano-jev + `JEV_TASKS` (AdminAIModels) ตาม pattern 12 ข้อ · **deploy รออนุมัติเจ้าของ (hard rule)**
- timeout 2.5s เดิม · Jev ปิด/ล้ม = fallback กฎ "บ่อยสุดก่อน" ทันที (ปุ่ม A1 ไม่รอ)

---

## §3 ตัดออกตั้งใจ (และเหตุผล)

| ตัดออก | เหตุผล |
|---|---|
| อัดเสียง/เล่นย้อน | buffer ใหญ่ + privacy + A2 ให้ภาพแล้ว |
| Boss ย่อยใน practice | Boss กลุ่มมีอยู่ — ซ้ำซ้อน |
| บังคับจังหวะ auto-run | wait-mode by design (หัวไฟล์) — A3 เปิดเองพอ |
| เก็บ session summary ลง Supabase | tg_practice_log พอ — ไม่ migration |
| Jev เลือกโน้ตรายตัว | T5 — แยกชั้น "กลยุทธ์" (Jev) vs "การหั่น" (buildSpotTarget) |
| chart library สำหรับ sparkline | บ้านนี้ไม่มี dep — SVG 60px พอ |
| แตะ piano-guard / tuning | ไม่เกี่ยวกับปัญหาที่แก้ — อย่าแตะโดยไม่จำเป็น |

---

## §4 ไฟล์ที่จะแก้

| ไฟล์ | WP | การเปลี่ยนแปลง |
|---|---|---|
| `practice-spot.ts` **ใหม่ — ✅ เขียนแล้ว พิสูจน์ 36/36** | A1, C1 | §2.1 (reference implementation อยู่ใน repo แล้ว) |
| `use-practice-mode.ts` | A1,A2,A3,B1,D1 | §2.2, §2.3, scoreRhythm beat mode, รับ metroBpm, starters, flag `practiceIsSpotRef`, logUsage |
| `PracticeOverlay.tsx` | A1,A2,A3,B1,B2,B3,C2 | ปุ่ม spot + ชิปสี + ticker + Variation Row + sparkline + combo FX + การ์ดสรุป |
| `i18n.ts` | ทุก WP | §2.5 ครบชุด |
| `app-styles.ts` | A2,B2,B3 | ชิป 3 สี (`.pchip--ok/.pchip--retry/.pchip--miss`) + `.ptrain` + combo pop keyframes |
| `App.tsx` | A3 | เดินสาย `metroBpm` เข้า usePracticeMode/PracticeOverlay (state มีอยู่แล้ว) |
| `supabase/functions/piano-jev/index.ts` + `AdminAIModels.tsx` | C1 | task #13 §2.7 — **deploy รออนุมัติ** |
| `tigamodel/scripts/smoke-jev-tasks.mjs` | C1 | ต่อเคส #13 |
| `tigamodel/scripts/smoke-practice-spot.mjs` **ใหม่ — ✅ ผ่าน 36/36** | A1,A3 | §5.2 (S1-S10; S11 ตาม C1) |
| `use-gamification.ts` | C3 | **เฉพาะเมื่อ** challenge enum รองรับ key ใหม่ (E0 ตรวจก่อน) ไม่งั้นแมป `games` ไม่แตะไฟล์ |

---

## §5 การทดสอบ

**§5.1 ทุกครั้ง:** `npm run build` (จำเป็น ไม่พอ — ไม่มี typecheck ต้องอ่าน diff)

**§5.2 Smoke transpile-จริง** (`smoke-practice-spot.mjs`, pattern smoke-jev-tasks.mjs):

| เคส | อินพุต | คาดหวัง |
|---|---|---|
| S1 seq ปกติ | seq 10 โน้ต พลาด idx 3,7 | ได้ 2 โน้ตเรียงตามเพลง มี noExpand=false |
| S2 scale (T2) | scale C ขยายแล้ว 15 โน้ต ascNotes 8, พลาด 2 | ความยาว 2 ไม่ขยายซ้ำ |
| S3 chord/block (T4) | 4 คอร์ด×3 โน้ต พลาดในคอร์ด 2 | ได้ทั้งคอร์ด 2 (3 โน้ต), gs ถูก |
| S4 cap | พลาด 20 index | ≤12 โน้ต worst-first เรียงกลับถูก |
| S5 พลาด 0 | wrongByIdx ว่าง | null (ปุ่มซ่อน) |
| S6 fallback pc | wrongByIdx ว่าง + pcs | ใช้ pc ได้ถูก |
| S7 strip (T3) | target มี stageId/bossGroup | ผลลัพธ์ไม่มีฟิลด์ทั้งคู่ |
| S8 bpm คงไว้ (T6) | target[].bpm | ผลลัพธ์มี bpm เดิม |
| S9 rhythm regression | times เดิม set เดิม | evenness ผลเท่าเดิมทุกตัว |
| S10 rhythm beat | beatMs=500 | IOI ±20% นับถูก |
| S11 Jev #13 | question set | ตรวจ choices 4 ค่า + hint 3 ค่า |

**§5.3 Playwright:** เริ่ม drill → พลาดให้ครบ → ปุ่ม spot + ชิป 3 สีถูก → กด spot ได้ drill ย่อยถูก (seq/chord/prog) → เมโทรนอมเปิด/ปิดกลางรอบไม่กระทบเกรด → ออก overlay แล้วเสียงหยุด → Jev ปิด spot ยังทำงาน

**§5.4 Native-only:** mic/MIDI จริงตรวจไม่ได้ headless — มนุษย์ทดสอบบนเครื่องจริง (mic drift ไม่กระทบ — ไม่แตะ piano-guard)

---

## §6 Runbook — ลำดับ + จุดขออนุมัติ + rollback

| Step | งาน | commit | ตรวจ | rollback ถ้าพัง |
|---|---|---|---|---|
| 0 | **E0 pre-flight (§8)** | — | ✅ **เสร็จแล้ว** — ผ่านครบ + reference impl พิสูจน์ 36/36 | — |
| 1 | D1 + A1 + A2 (ผูกกัน) — เหลือแค่ wiring UI เข้า hook/overlay | 1 | build + smoke S1-S8 (✅ ผ่านแล้ว) | revert commit — ระบบเดิมไม่โดน (มีแต่เพิ่ม) |
| 2 | A3 metronome | 2 | build + smoke S9-S10 + Playwright | revert — evenness เดิมคือ default |
| 3 | B1 → B2 → B3 | 3/4/5 | build + Playwright ทีละอัน | revert รายอัน (ปุ่มหาย = ย้อนพฤติกรรมเดิม) |
| 4 | C1 เขียน + smoke S11 | 6 | build + smoke | revert — toggle ปิดอยู่แล้วฝั่ง server ไม่มี task ก็ fallback |
| 5 | ⛔ **หยุดรออนุมัติ deploy `piano-jev`** (hard rule — แม้ถูกบอก "ทำทั้งหมด" ก็หยุดตรงนี้) | — | — | — |
| 6 | C2 + C3 | 7 | build + Playwright | revert |
| 7 | D2 admin tile | 8 | build | revert |
| 8 | Push เมื่อเจ้าของสั่งเท่านั้น (push จาก main = deploy production + OTA ทันที) | — | — | OTA rollback ผ่าน native-updater เดิม |

---

## §7 Risk register

| เสี่ยง | โอกาส | ผล | กันไว้ |
|---|---|---|---|
| Spot drill บน target ที่มี bpm ต่อโน้ต (song/drum track) หั่นแล้ว bpm เพี้ยน | กลาง | กลาง | §2.1 กฎ 8 (S8) |
| ticker เมโทรนอมค้างหลังออก overlay กลางรอบ | ต่ำ | กลาง | 4 จุดทำลาย (§2.4) + Playwright ตรวจเสียงหยุด |
| Jev #13 ตอบช้า หน้าผลค้างรอ | ต่ำ | ต่ำ | timeout 2.5s + ปุ่มไม่รอ Jev |
| นับ wrong-by-index ผิดโหมด block | กลาง | กลาง | กฎเดียวสองโหมด (§2.3) + S3 + Playwright |
| ผู้เรียนวน spot ไม่ออกจากจุดเดิม | กลาง | ต่ำ | Jev `round_plus_memory` + strategy ผลัก + KPI guard |
| startPractice branch noExpand ไปกระทบ replayDrill เดิม | ต่ำ | สูง | branch อ่านเฉพาะ `seq.noExpand` ที่ replay ไม่เคยตั้ง + S2 + regression S9 |
| C2 การ์ดสรุปชน proof/conv popup | ต่ำ | ต่ำ | เรียงลำดับ proof > summary + ไม่แตะ tg_sell_day |

---

## §8 E0 — Pre-flight: ✅ รันจริงแล้ว 2026-09-23 (หลักฐานทั้งหมดจากซอร์สจริง)

| # | คำถามเดิม | คำตอบจากโค้ดจริง | ผลต่อแผน |
|---|---|---|---|
| 1 | challenge types เป็น enum ปิดหรือเปิด? | **ผสม** — `bumpWeekly` (use-gamification.ts:304) รับ key อะไรก็ได้ (`w[type]=(w[type]||0)+n`) แต่ `CHALLENGE_POOL` (App.tsx:5346) เป็น pool ปิด 9 ชิ้น: games×3, exp×3, perfect×3 · `tg_weekly` sync แบบ lww ทั้ง object → key ใหม่ sync อัตโนมัติ | C3: เพิ่ม entry `{id:"spots_s/m/l", type:"spots", goal:3/8/15}` เข้า pool = challenge ประเภทใหม่เต็มรูปแบบ; ถ้าไม่แตะ App.tsx ให้แมป `games` (pool ไม่ขยาย แต่ counter นับ) — ตัดสินตอน implement |
| 2 | FINGERINGS_LH มีของจริงไหม? | **มี 24 คีย์จริง** (music-engine.tsx:250) — major/minor/pentatonic/blues ครบ + TRIAD_FINGER_LH + PROG_FINGER_LH | B1 ปุ่มสลับมือใช้ได้เต็มที่ ไม่ต้องซ่อนบ่อย |
| 3 | `practiceHeard` พอสำหรับ A2? | ไม่พอเอง — render จาก `practiceWrongByIdxRef` (A1 เก็บ) + hit set เดิม (แน่นอนกว่า) | A2 ออกแบบจาก wrongByIdx ตาม §2.3 |
| 4 | startPractice รับ noExpand ได้ไหม? | **ไม่จำเป็นแล้ว** — expansion มีเฉพาะ `seq.mode==="scale"` (use-practice-mode.ts:408); emit mode:"seq" ไม่มีทางโดนขยาย | §2.2 แก้แล้ว: ไม่แตะ startPractice เลย |
| 5 | JEV_TASKS รองรับ #13? | ใช่ — pattern เดิม (12 task ปัจจุบันทำงานจริงบน server แล้ว) | C1 เพิ่มตาม §2.7 ตรง ๆ |
| 6 | atpopup วาง C2 ได้ไหม? | ได้ — และ **SafeZone ครอบ practice result อยู่แล้ว** (app-shell.tsx:38, สร้างหลัง crash จริงบนหน้าผลวันที่ 2026-09-21) การ์ด C2 อยู่ในเขตกันพังฟรี | C2 วางได้ทันที ไม่ต้องเพิ่ม boundary |

**พิสูจน์สัญญาด้วยโค้ดจริง (เกิน E0 เดิม):** `practice-spot.ts` = reference implementation ของ §2.1+§2.4 · `tigamodel/scripts/smoke-practice-spot.mjs` = เคส S1-S10 จากแผน **ผ่าน 36/36** · ระหว่างเขียน smoke พบและแก้ 2 สมมติฐานที่ prose เขียนผิดเอง: (1) ความหมายจริงของ scoreRhythm evenness — ช่องว่างสั้น ๆ 100ms นับ **miss** เพราะ metric วัดระยะจากค่าเฉลี่ย ไม่ใช่ความเท่ากัน (ยืนยัน in-code กับ use-practice-mode.ts:56-71) (2) ขนาดคอร์ดที่คงเหลือเรียงตามเพลงจาก chordSizes จริง [4,3] ไม่ใช่เรียงตามลำดับความพลาด — ทั้งคู่ถูกล็อกเป็น assertion แล้ว

---

## §9 ขอบเขตเทียบฟีเจอร์อื่น (boundary matrix — กัน role confusion)

| ฟีเจอร์ | หน้าที่ | ไม่ทำอะไรในแผนนี้ |
|---|---|---|
| Play Along Mistake Loop (mistake-drill.ts) | หั่น segment เพลงจริงตามเวลา | ไม่แตะ ไม่ share code กับ spot drill (คนละชั้นเวลา: song timeline vs drill sequence) |
| Practice Coach (use-practice-coach.ts) | แนะนำ tempo/recap/แบบฝึก | ไม่แทนที่ — C1 compose ตาม T5 เท่านั้น |
| Parent Report | รายงานผู้ปกครองจาก snapshot | C2 คือ in-session ของผู้เรียน คนละผู้ชม |
| Pathway/Boss | ปลดล็อกด้วยรอบเต็ม | spot/var drill ไม่ผูก stageId/bossGroup เด็ดขาด (T3) |
| เศรษฐกิจ (coins/exp/gems) | จ่ายตาม finishPractice เดิม | ไม่เพิ่ม/ลด/แก้ทุนใด ๆ ทุก WP |
| piano-guard | tuning drift learner | ไม่แตะ |
