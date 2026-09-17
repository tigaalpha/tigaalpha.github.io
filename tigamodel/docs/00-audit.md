# 00-audit.md — สิ่งที่ตรวจพบใน repo จริง (ตามข้อ 35 ของสเปค: ตรวจก่อนเขียน)

ตรวจเมื่อ 2026-09-17 บน `main` — ทุกข้ออ้างอิงไฟล์จริงที่อ่านแล้ว

## 1. สิ่งที่มีอยู่แล้ว — frontend (แอปเปียโน)

| ส่วน | ไฟล์ | สถานะ |
|---|---|---|
| LLM call plumbing: stream (SSE `data:{"content":...}`) + non-stream, timeout 3 ชั้น, stall watchdog | `ai-backend.ts` | ✅ ใช้จริง 11 call sites |
| Content-addressed response cache (TTL, hash จาก body) | `ai-cache.ts` | ✅ coach-tip / weekly-report |
| Cross-session learner memory: struggles/mastered/recent + SM-2-lite spaced review + homework | `ai-chat-context.ts` | ✅ localStorage (`tg_memory`) |
| Cloud TTS (cache IndexedDB) + Web Speech STT + native STT (Capacitor) | `speech.ts`, `native-stt.ts` | ✅ Voice Tutor ใช้จริง |
| MediaPipe hand-landmark coach (CDN lazy-load, 21 จุด, finger-curl geometry) | `hand-pose.ts`, `use-camera-coach.ts` | ✅ กล้องหน้า/หลัง + AI analysis |
| Skill tracking (computeSkillScores, weakestSkills), Pathway scheduling, gamification | `App.tsx`, `use-gamification.ts` | ✅ ใช้จริง |
| Practice analysis ระดับโน้ต (mic/MIDI pitch→note, rhythm scoring, dynamics) | `use-practice-mode.ts`, `music-engine.ts` | ✅ แข็งแรงมากฝั่ง signal |
| Pitch detection live, chord identify, rhythm report | `music-engine.ts` | ✅ (startMicListener ฯลฯ) |
| Supabase auth + profiles (plan, exp/coins/gems, admin_tier) + usage_events | `supabase-client.ts`, `shared-infra.ts` | ✅ มี RLS + column-protection |

## 2. สิ่งที่มีอยู่แล้ว — backend (edge functions ใน repo)

**`supabase/functions/piano-chat/index.ts` (909 บรรทัด) — ข้อค้นพบสำคัญที่สุด:**
นี่คือ **Model Router ระดับ production ที่มีอยู่แล้ว**:
- per-feature provider/model จาก `app_settings.ai_models` (แก้ได้จากหน้า admin ไม่ต้อง deploy)
- providers: anthropic / gemini / deepseek / openrouter (+ fallback ladder อัตโนมัติ เช่น free-rung → gemini → deepseek)
- 2 wire paths: "simple" (`{message, conversationHistory, system, stream, feature}`) และ "raw passthrough" (`{model,max_tokens,system,messages,tools}` Anthropic-style, normalized Gemini/OpenRouter ให้เหมือนกัน)
- session-gated (ต้อง signed-in JWT จริง) + rate limit ฝั่ง DB (`ai_rate_limits`)
- error ออกทาง `data:{"error":...}` ไม่เคยปน content

→ **สรุปเชิงสถาปัตยกรรม:** สเปคข้อ 6 (Model Router) กับข้อ 5 (Closed model layer) มีตัวจริงแล้วครึ่งหนึ่ง —
Phase 0 ห้ามสร้าง router คู่ขนาน ต้อง treat piano-chat เป็น provider ตัวแรก

## 3. โมเดลที่ระบบใช้อยู่ตอนนี้

- บัญชี/รุ่น: admin เลือกต่อ feature ผ่าน `app_settings.ai_models` (key: chat, voice, song-style, song-analysis, compose, song-gen, coach-tip, weekly-report, practice-plan, camera, slip-check, admin-chat)
- คีย์ที่อ่านใน function: ANTHROPIC_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY (ตาม comment ในไฟล์ อย่างน้อย Anthropic ยังไม่ set ณ 2026-09-11 → ใช้ fallback ladder)

## 4. deployment / environment

- Frontend: GitHub Pages จาก `main` (single-file bundle, vite-plugin-singlefile) — **ไม่มี server ฝั่งเรา** ทุก API ต้องเป็น edge function
- Native: Capacitor Android (APK อัตโนมัติ) + iOS PWA
- Studio/BOS: Next.js แยกต่างหาก (โปรเจกต์ Supabase อีกตัว) — นอกขอบเขต tigamodel ชั้นนี้
- **ไม่มี GPU/self-host ทุกชนิด** — ตรงกับข้อ 3 ของสเปคอยู่แล้ว (cloud API เท่านั้น)

## 5. สิ่งที่ยังขาด (ต่อข้อ 35.12)

| ขาด | รายละเอียด | Phase ที่ควรทำ |
|---|---|---|
| Teaching loop เป็นระบบ | ตอนนี้กระจายเป็น call sites อิสระ ไม่มีวงจร OBSERVE→…→ADAPT ร่วม | P0 วางโครง `teaching/teaching-loop.js` |
| Teaching Philosophy เป็น artifact | หลักการสอนฝังใน prompt strings กระจาย (memoryContext, curriculumContext, vm prompts) ไม่มีที่เดียว | P0 `teaching/philosophy.js` |
| Teaching Policy configurable | กติกา if-confused-then-simplify ยัง hard-code ใน prompts ไม่ใช่ config | P0 `teaching/policy.js` (rule table) |
| Student Model สคีมากลาง | มีข้อมูลดีแต่แบบ localStorage blobs ต่างไฟล์ต่างรูป (tg_memory, progress, profile) | P0 `student/student-model.js` รวม view |
| Structured Knowledge Base | ความรู้เปียโนอยู่ใน prompt text / FINGERING_REF / THEORY_REF เท่านั้น | P0 โครง + seed ชุดเล็ก |
| Evaluation harness | ไม่มี benchmark เทียบโมเดลเลย — เปลี่ยนโมเดลใน admin ได้แต่วัดผลไม่ได้ | P0 `evaluation/eval-suite.js` (จุดเริ่มข้อ 25) |
| Outcome dataset (ข้อ 24) | ไม่มีตารางเก็บ strategy→response→performance_before/after | P1 (ต้อง SQL migration ใหม่) |
| Student-state estimation | ไม่มี (มีแค่ signal ดิบ: pauses, repeated errors, self-report ใน voice flow) | P1+ (ต้องเป็น probability+evidence เท่านั้น) |
| Multimodal fusion | มี modalities แยกกัน (มือ/เสียง/คำพูด) แต่ไม่มีชั้น fusion | P3+ |
| Realtime voice loop latency | Voice Tutor เป็น turn-based (กดพูด→รอ) ยังไม่ realtime | P4 |

## 6. จุดที่ต้องแก้ / ความเสี่ยงที่ตรวจพบ (ต่อข้อ 35.13)

1. **`curriculumContext` / `songRecommendationHint` ยังอยู่ใน App.tsx** (ตาม comment ใน ai-chat-context.ts) — เมื่อย้ายมา tigamodel ต้องระวัง circular import กับ gamification layer — **ไม่ยุ่งใน P0**
2. **`app_settings.ai_models` อ่านด้วย JWT ผู้เรียน** — anon caller ได้ default เสมอ → การวัดผล eval-suite ต้องมี signed-in context หรือเทียบที่ client ที่มี session
3. **คีย์ Anthropic ยังไม่ set** ตาม comment ใน function → ระบบกำลังพึ่ง fallback ladder จริง ๆ — eval-suite จะบอกได้ว่าคุณภาพจริงตอนนี้มาจากไหน
4. **ไม่มี TypeScript check ทั้ง repo** — โค้ด tigamodel ต้องพึ่งการทดสอบจริง (smoke script) ไม่ใช่ typecheck
5. **ขนาด bundle** — แอปเป็น single-file build; tigamodel ต้อง lazy-load ได้ (ตอนนี้ยังไม่ import เข้า App เลย จึงไม่มีผลต่อ bundle — จงใจ)

## 7. สรุป: สิ่งที่ tigamodel Phase 0 ทำ / ไม่ทำ

**ทำ:** สคีมากลาง, provider interface + registry, adapter ตัวแรก = ห่อ piano-chat (มีจริง), mock provider,
model router เลือกโมเดลตาม task, teaching philosophy/policy เป็น data + engine, student model รวม view,
KB โครง + seed, eval harness + ชุดทดสอบแรก — ทั้งหมดยังไม่ถูก import เข้าแอป (zero user-facing change)

**ไม่ทำ:** สร้าง router ใหม่ชนของเดิม, fine-tuning, GPU, vision/audio fusion จริง, แตะ schema DB,
แตะ App.tsx, ใส่คีย์ฝั่ง client, อ้างวิเคราะห์สิ่งที่ยังไม่มีโมดูล
