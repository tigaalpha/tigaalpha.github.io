# 02-roadmap-100.md — แผนพัฒนา TIGA Piano Model 100 สิ่ง

เขียน 2026-09-18 จากสถานะจริง: Phase 0 เสร็จ (smoke 15/15), KB seed 59 รายการ,
มี provider adapter / router / teaching-loop / student-model / eval-suite พร้อมต่อยอด
เรียงตามกลุ่ม (ก-ญ) แต่ละข้อมีค่าความสำคัญ: ⭐⭐⭐ = ทำก่อน (เพิ่มความฉลาดเร็วสุด)
⭐⭐ = รอบถัดไป · ⭐ = เมื่อพื้นฐานนิ่ง · 🔒 = ต้องอนุมัติ SQL migration ก่อน

## ก. ความรู้ดนตรี (Knowledge Base — สมองส่วนทฤษฎี)
| # | สิ่งที่พัฒนา | ค่า |
|---|---|---|
| 1 | ขยาย KB ทฤษฎี: โหมด 7 โหมด (Dorian, Phrygian…) + การใช้ในเพลงจริง | ⭐⭐⭐ |
| 2 | คอร์ดขั้นสูง: 9th/11th/13th, sus2/sus4, slash chords + ตัวอย่างซ้อม | ⭐⭐⭐ |
| 3 | การจัดคอร์ด (voicing): open/close, drop-2, shell voicing | ⭐⭐⭐ |
| 4 | Jazz theory: ii-V-I ทุกคีย์, tritone sub, bebop scales | ⭐⭐⭐ |
| 5 | Blues form: 12-bar, 8-bar, minor blues + lick พื้นฐาน | ⭐⭐ |
| 6 | Harmonic function: tonic/subdominant/dominant + cadence ทุกชนิด | ⭐⭐ |
| 7 | Modulation ทุกเทคนิค: pivot chord, direct, enharmonic, common-tone | ⭐⭐ |
| 8 | Counterpoint พื้นฐาน (Fux species 1-2) สำหรับผู้เรียนสูง | ⭐ |
| 9 | Form analysis: sonata, rondo, binary, ternary, theme & variation | ⭐⭐ |
| 10 | Harmonic rhythm + reharmonization เบื้องต้น | ⭐⭐ |
| 11 | Figured bass + Roman numerals ครบทุกระบบตัวเลข | ⭐ |
| 12 | สเกลพิเศษ: whole-tone, octatonic, harmonic/melodic minor ครบการใช้ | ⭐⭐ |
| 13 | Chord-tone vs scale approach ต่อคอร์ด (improv roadmap) | ⭐⭐ |
| 14 | Rhythmic vocabulary: syncopation, polyrhythm 2:3, 3:4, hemiola | ⭐⭐ |
| 15 | เครื่องหมาย/ศัพท์ดนตรีอิตาลี-เยอรมัน-ฝรั่งเศส ครบชุดสอบเกรด | ⭐⭐⭐ |
| 16 | Ornamentation: trill, mordent, turn, appoggiatura — วิธีเล่นยุคต่อยุค | ⭐⭐ |
| 17 | Pedaling theory: rhythmic, syncopated, half, una corda | ⭐⭐ |
| 18 | เกรด 1-8 (Trinity/ABRSM): syllabus เทียบกับ Pathway ของเรา | ⭐⭐⭐ |
| 19 | Sight-reading pedagogy: intervallic reading, landmark notes | ⭐⭐ |
| 20 | ประวัติดนตรี 6 ยุค ย่อพร้อมสไตล์การเล่นที่ควรต่างกัน | ⭐⭐ |

## ข. คราฟต์การเล่น (Piano Craft — สมองส่วนเทคนิค)
| # | สิ่งที่พัฒนา | ค่า |
|---|---|---|
| 21 | ฟิงเกอร์ริ่งสเกลทุกคีย์ ครบมือซ้าย/ขวา + เหตุผล (thumb-under vs over) | ⭐⭐⭐ |
| 22 | ฟิงเกอร์ริ่งอาร์เปจโจ้ทุกคีย์ + คอร์ดเต็มทุกตำแหน่ง (root/1st/2nd inv) | ⭐⭐⭐ |
| 23 | Hanon/Czerny/PIs ลำดับเลข 1-60 พร้อมจุดประสงค์แต่ละท่า | ⭐⭐ |
| 24 | Warm-up routines ตามระดับ 5/10/15 นาที | ⭐⭐⭐ |
| 25 | Technique recipes: staccato/legato/portato วิธีซ้อมแยก | ⭐⭐ |
| 26 | Octaves & chords technique: wrist/arm strategy กันบาดเจ็บ | ⭐ |
| 27 | Jump/leap accuracy drills (ก้าวมือ 5 ระดับ) | ⭐⭐ |
| 28 | Trills practice system: rhythm-metronome method | ⭐ |
| 29 | Hand independence roadmap: 20 ขั้นจากเบาไปยาก | ⭐⭐ |
| 30 | Polyrhythm trainer logic (2:3, 3:4 แบบนับจริง) | ⭐ |
| 31 | Voicing มือเดียว: melody ดังกว่า harmony ใน hand ละคอร์ด | ⭐ |
| 32 | Speed development: chunking, burst practice, tempo ladder | ⭐⭐ |
| 33 | Memorization systems: 4-type memory + วิธีซ้อมจำ | ⭐⭐ |
| 34 | Sight-reading drills ตามระดับ 30 ขั้น | ⭐⭐ |
| 35 | Tone production: arm weight, cantabile, ควบคุมเสียงด้วยการฟัง | ⭐⭐ |

## ค. หลักการสอน/คราฟต์ครู (Teacher Craft — สมองส่วนวิธีสอน)
| # | สิ่งที่พัฒนา | ค่า |
|---|---|---|
| 36 | วิเคราะห์ข้อผิดพลาดทั่วไป 50 แบบ (error taxonomy) + วิธีแก้ทีละแบบ | ⭐⭐⭐ |
| 37 | คลังประโยคครู 200 ประโยค: คำชมเจาะจง/คำถามชวนคิด/การให้ภาพจำ | ⭐⭐⭐ |
| 38 | Analogies bank: ภาพจำเทคนิค 60 แบบ (น้ำหนักแขน=น้ำไหล ฯลฯ) | ⭐⭐ |
| 39 | Metaphor per culture: ไทย/จีน/อังกฤษ ใช้ภาพต่างกันอย่างไร | ⭐⭐ |
| 40 | การสอนเด็ก 3-6 ปี: attention span, เกม 30 เกม | ⭐⭐⭐ |
| 41 | การสอนผู้สูงวัย: กลัวผิด, ความจำ, จังหวะช้า | ⭐⭐ |
| 42 | Adult beginners: จูงใจด้วยเพลงที่ชอบเร็วที่สุด | ⭐⭐⭐ |
| 43 | Special needs: ADHD/autism-friendly lesson patterns | ⭐ |
| 44 | Growth-mindset scripts: ตอบ "ผมทำไม่ได้" 12 แบบสถานการณ์ | ⭐⭐⭐ |
| 45 | Lesson arc library: 10 โครงคลาส 20/30/45 นาที | ⭐⭐ |
| 46 | เกณฑ์ "เก่งพอที่จะไปต่อ" ต่อทักษะ (mastery criteria) | ⭐⭐⭐ |
| 47 | การซ้อมแบบ deliberate practice: กฎ 3 ครั้งสมบูรณ์ | ⭐⭐⭐ |
| 48 | Practice-slow system: ตารางเทมโป 80%→100% อัตโนมัติ | ⭐⭐ |
| 49 | การให้การบ้าน: สูตร homework ที่ทำได้จริงใน 15 นาที | ⭐⭐ |
| 50 | การจัดการความเบื่อ/หมดไฟ: re-ignition playbooks 10 แบบ | ⭐⭐ |

## ง. วิชาการการเรียนรู้ (Learning Science — สมองส่วนเข้าใจคน)
| # | สิ่งที่พัฒนา | ค่า |
|---|---|---|
| 51 | Spaced repetition ปรับ interval จากผลจริง (มี SM-2-lite อยู่ — ยกระดับ) | ⭐⭐⭐ |
| 52 | Interleaving: สลับบล็อกซ้อม vs ผสม กฎตัดสินใจ | ⭐⭐ |
| 53 | Desirable difficulties: กากับดีไหน ต่อผู้เรียนแบบไหน | ⭐ |
| 54 | Flow theory: ตั้งความยาก ±10% ของความสามารถ | ⭐⭐⭐ |
| 55 | Cognitive load: จำกัดข้อมูลต่อคำสอน (chunking ข้อความ AI) | ⭐⭐⭐ |
| 56 | Self-determination theory: autonomy/competence/relatedness ในเกม | ⭐⭐ |
| 57 | Habit loops: cue-routine-reward ในแอปอยู่แล้ว — เพิ่ม trigger ต่อ persona | ⭐⭐ |
| 58 | Regression handling: กลับไปถอยหลัง ควรพูดยังไง ซ้อมยังไง | ⭐⭐⭐ |
| 59 | Performance anxiety: ลดตื่นเวที 5 เทคนิค + ซ้อมจำลอง | ⭐⭐ |
| 60 | เรียนรู้จากความผิด: errorless → errorful ตารางเวลา | ⭐ |

## จ. ความจำนักเรียน + ประมาณการสถานะ (Student Model)
| # | สิ่งที่พัฒนา | ค่า |
|---|---|---|
| 61 | อัปเกรด student-model: รวม tg_memory+progress+practice history เป็น graph | ⭐⭐⭐ |
| 62 | Skill graph: ทักษะ 80 โหนด + prerequisite edges (ใช้แนะนำเส้นทาง) | ⭐⭐⭐ |
| 63 | สถานะความเหนื่อย/สมาธิจาก pattern การเล่น (ช้าลง/ผิดเยอะ) + ถาม self-report | ⭐⭐ |
| 64 | Emotion estimate จากคำพูด + ผลเล่น (probability+evidence ตามหลัก philosophy) | ⭐⭐ |
| 65 | Persona detection: เด็ก/ผู้ใหญ่/สายเกม/สายสอบ — ปรับโทนอัตโนมัติ | ⭐⭐⭐ |
| 66 | Goal tree: เป้าหมายใหญ่ แตกเป็นสัปดาห์/วัน ติดตาม drift | ⭐⭐ |
| 67 | Long-term memory: เรื่องส่วนตัวที่นักเรียนเล่า (สัตว์เลี้ยง/โรงเรียน) ใช้เชื่อมบทเรียน | ⭐⭐ |
| 68 | Confusion detector: คำถามซ้ำ/ผิดซ้ำ → สรุปว่า "ยังงงอะไร" เป็นคำ | ⭐⭐⭐ |
| 69 | Streak intelligence: รู้จักพัก vs ผลัก (burnout guard) | ⭐⭐ |
| 70 | Confidence calibration: คะแนนตัวเอง vs ผลจริง → ปรับคำชมให้ตรง | ⭐ |

## ฉ. วงจรสอน + นโยบาย (Teaching Loop/Policy)
| # | สิ่งที่พัฒนา | ค่า |
|---|---|---|
| 71 | ต่อ teaching-loop เข้า use-practice-mode จริง (pauses/errors/rhythm เป็น input) | ⭐⭐⭐ |
| 72 | Policy table ขยาย 50 กติกา: confused/frustrated/bored/rushing/stalling | ⭐⭐⭐ |
| 73 | Hint ladder system: 4 ชั้นช่วย (ถามกลับ→ชี้จุด→โชว์→เล่นให้ดู) | ⭐⭐⭐ |
| 74 | Session state machine: warmup→focus→stretch→recap→assign | ⭐⭐ |
| 75 | Adaptive difficulty: เลือกเพลง/บทถัดไปจาก skill graph อัตโนมัติ | ⭐⭐⭐ |
| 76 | Micro-lesson generator: แตกบทใหญ่เป็น 90 วินาที chunks | ⭐⭐ |
| 77 | Demonstration planner: เมื่อไร AI ควรเล่นให้ดู (ไม่ใช่พูด) | ⭐⭐ |
| 78 | Recap generator: สรุปท้ายคลาส 3 ข้อ + การบ้าน + เปิดครั้งหน้า | ⭐⭐⭐ |
| 79 | Safety rules ขยาย: น้ำหนักเทคนิคตามวัย, อาการปวด → หยุดทันที | ⭐⭐ |
| 80 | Multilingual tone pack: สรรพนาม/ความสุภาพ ไทย-อังกฤษ-จีน สอนได้ถูกกันเอง | ⭐⭐⭐ |

## ช. การประเมินผล (Evaluation — ระบบวัดว่าโมเดลเก่งขึ้นจริง)
| # | สิ่งที่พัฒนา | ค่า |
|---|---|---|
| 81 | Eval cases ขยาย 30→120 เคส (ทฤษฎี/เทคนิค/จิตวิทยา/ความปลอดภัยเด็ก) | ⭐⭐⭐ |
| 82 | Golden answers: เฉลยมาตรฐานโดยครูจริง 20 ข้อก่อน | ⭐⭐⭐ |
| 83 | Auto-grader: ตรวจคำตอบทฤษฎีอัตโนมัติ (chord/scale เชิงตรวจได้) | ⭐⭐⭐ |
| 84 | A/B สองโมเดลใน eval-suite ดู diff คำตอบข้างกัน | ⭐⭐ |
| 85 | Regression alarm: เปลี่ยนโมเดลแล้วคะแนนตก = ห้ามเปิดใช้ | ⭐⭐⭐ |
| 86 | Rubric คุณภาพการสอน 6 มิติ (ถูกต้อง/เหมาะระดับ/จูงใจ/สั้น/ปลอดภัย/มีขั้นถัดไป) | ⭐⭐⭐ |
| 87 | LLM-as-judge สำหรับเคสสอนเชิงบทสนทนา | ⭐⭐ |
| 88 | Latency/cost per task tracking ใน eval report | ⭐⭐ |
| 89 | 🔒 Outcome dataset: ตาราง teaching_outcomes (strategy→before/after) — migration รออนุมัติ | ⭐⭐⭐ |
| 90 | Dashboard ผล eval ใน Model Lab (คะแนนต่อ task/โมเดล) | ⭐⭐ |

## ซ. การเชื่อมสัญญาณ (Signals & Multimodal — ระยะถัดไป)
| # | สิ่งที่พัฒนา | ค่า |
|---|---|---|
| 91 | Practice-signal pack: pauses/repeated-errors/rhythm-var → TIGARequest | ⭐⭐⭐ |
| 92 | Camera posture verdict ป้อนเข้า loop (มี MediaPipe อยู่แล้ว — แค่เชื่อม) | ⭐⭐ |
| 93 | Rhythm report → คำแนะนำ metronome อัตโนมัติจาก policy | ⭐⭐ |
| 94 | Dynamics curve → คำแนะนำ phrasing | ⭐ |
| 95 | MIDI vs acoustic detection: เลือกเส้นทางวิเคราะห์ต่างกัน | ⭐⭐ |

## ฌ. โครงสร้าง/ความจำ (Memory & RAG)
| # | สิ่งที่พัฒนา | ค่า |
|---|---|---|
| 96 | RAG บน KB: ค้นความรู้ก่อนตอบ (keyword → embedding ภายหลัง) | ⭐⭐⭐ |
| 97 | Lesson memory compression: สรุปคลาสยาวเป็นบันทึกสั้นใส่บริบทรอบถัดไป | ⭐⭐⭐ |
| 98 | Prompt composer กลาง: รวม philosophy+policy+KB+student เป็น system prompt เดียว | ⭐⭐⭐ |
| 99 | KB versioning + provenance: ทุก fact มีแหล่งอ้างอิง+วันที่ (แก้ "โมเดลพูดผิด" ได้) | ⭐⭐ |
| 100 | Cost governor: จำกัด token/บาท ต่อ session ตามแพ็กเกจ (เชื่อม plan ใหม่ที่เพิ่งตั้ง) | ⭐⭐ |

## เส้นทางแนะนำ (สรุปผู้บริหาร)
**Sprint ถัดไป (⭐⭐⭐ รวม ~28 ข้อ):** 71+72+73 (ต่อ loop จริง) → 96+97+98 (สมองคิดก่อนตอบ)
→ 36+37+46+47 (คราฟต์ครู) → 81-83+85-86 (ระบบวัดผล) → 61+62 (student graph)
→ 1-4+15+18 (ทฤษฎีแกน) → 21-22 (ฟิงเกอร์ริ่ง) → 🔒89 (outcome dataset — รออนุมัติ SQL)
เหตุผล: สิ่งเหล่านี้คือ "กลไก" ที่ทำให้ทุกความรู้ที่เติมต่อไปถูกใช้แบบถูกที่ ไม่ใช่แค่จำไปเล่า
