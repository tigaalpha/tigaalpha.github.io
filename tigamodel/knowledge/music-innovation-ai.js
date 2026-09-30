/* ── tigamodel/knowledge/music-innovation-ai.js — plan v3.5 6.13 ระลอกขยาย
   (owner directive 2026-09-30: "เติมความรู้ด้าน AI ที่ใช้ในวงการดนตรี ·
   พัฒนาเรื่องนวัตกรรมในอุตสาหกรรมดนตรีและการเรียนการสอนเปียโนเพิ่ม")

   Extends the music-innovation pillar with AI-in-music knowledge, in six
   strands:
     ai-industry    — AI across the music industry (composition, stems,
                      recommendation, catalog search, voice models, A&R)
     ai-learning    — AI for learning piano (score following, error taxonomy,
                      adaptive practice, self-accompaniment, OMR)
     ai-craft       — the craft behind it (what MIDI 2.0/MPE add, separation,
                      transcription, embeddings, MIDI generation)
     ai-integrity   — data/consent/credit rules (training data, watermarking,
                      deepfake voice, royalty metadata) + NO fabricated claims
     ai-frontier    — frontier landmarks (hands-free performance, orchestra
                      completion, "unsupervised sight-reading" duet partner)
     innovation-2   — industry/pedagogy innovation round 2 (MPE, upright
                      silent systems, sight-reading centers, home audio at the
                      piano, hybrid piano labs, instant feedback loops)

   กติกาเหล็กเดิม: สามภาษา (th/en/zh) · มี teach ทุก entry · ศูนย์สถิติ/เปอร์เซ็นต์
   แต่ง · เก็บใน domain "music-innovation" เพื่อให้เป็น "สายที่ 6+" ของขุมเดียวกัน ── */

/* 1) AI ในอุตสาหกรรมดนตรี — ทำงานตรงไหนบ้าง */
export function genAiInIndustry(kb) {
  const out = [];
  const IND = [
    ["composition", "AI ช่วยแต่งเพลง — เครื่องมือได้ ผู้แต่งคือคน",
      "AI สร้างแนวทำนอง/คอร์ดประกอบ/เสียงกลองรองได้เร็วมาก แต่ตัวเลือกว่า \"เพลงนี้ใช่\" ยังเป็นหูและหัวใจของคน — วิธีใช้ที่ดี: ให้ AI เสนอทางเลือกหลายแบบ แล้วคนเลือก-แก้-เซ็นชื่อ นวัตกรรมเปลี่ยนจาก \"แต่งจากหน้ากระดาษเปล่า\" เป็น \"คัดจากตัวเลือก\"",
      "AI drafts melodies/chord beds/drum parts fast, but deciding \"this is the song\" stays with human ears — good workflow: let AI offer many options, humans choose/edit/sign. Creation shifts from \"start from a blank page\" to \"curate options\".",
      "AI 能快速生成旋律/和声底/鼓组，但\"是不是这首歌\"仍由人的耳朵决定——好的工作流：AI 给出多方案，人来挑选、修改与署名。创作从\"白纸起步\"变为\"策展选项\"。"],
    ["stems", "แยกเสียง (source separation) — รื้อเพลงเก่าได้เหมือนมีสตูดิโอ",
      "AI แยกเสียงร้อง/กลอง/เบส/อื่น ๆ ออกจากไฟล์เพลงเดียวได้แล้ว — ครูเปียโนใช้เอาทำนองออกจากเพลงที่ผู้เรียนชอบเพื่อทำโน้ตซ้อม มิวสิคแดนซ์ใช้แยกสเต็มเพื่อรีมิกซ์ โดยไม่ต้องมีเทปต้นฉบับหลายแทร็ก",
      "AI splits vocals/drums/bass/other out of a single mixed file — piano teachers can lift a melody from a learner's favorite song for practice sheets; remixers pull stems without multi-track masters.",
      "AI 能从单个混音文件中分离人声/鼓/贝斯——钢琴老师可从学员喜爱的歌中提取旋律做练习谱，混音者无需多轨母带即可取分轨。"],
    ["recommendation", "ระบบแนะนำเพลง — เวทีใหม่ของการ \"ถูกฟัง\"",
      "แพลตฟอร์มสตรีมมิงใช้ AI เลือกว่าเพลงไหนไปอยู่หน้าไหนของผู้ฟัง — สำหรับครู/สตูดิโอ บทเรียนคือ: ชื่อเพลง ปก และวินาทีแรกของเสียง คือ \"ข้อมูล\" ที่ระบบอ่านก่อนหูคน — และผู้เล่นเปียโนที่อัดเดโมเองก็แข่งในสนามเดียวกัน",
      "Streaming platforms use AI to decide which song surfaces for which listener — lesson for teachers/studios: title, cover art, and the first seconds are data the system reads before human ears; self-recorded pianists compete in the same field.",
      "流媒体平台用 AI 决定哪首歌出现在哪位听众面前——对教师/工作室的启示：歌名、封面与开头几秒是系统先于人类耳朵读取的\"数据\"；自录钢琴演奏者也在同一赛场。"],
    ["catalog", "ค้นหาเพลงจากเสียง/ทำนอง — มือใหม่ก็เจอชีทเร็วขึ้น",
      "AI จับเสียงฮัม/ทำนองเล่น ๆ แล้วหาว่าใช่เพลงไหน (audio fingerprinting + melody search) — ใช้สอนผู้เรียน: ลองฮัมทำนองที่แต่งเองแล้วดูว่า \"ใกล้เพลงใดมีอยู่\" เป็นเกมฝึกหูที่ผู้เรียนไทยสนุกได้ทันที",
      "AI matches hummed/played fragments to existing songs (audio fingerprinting + melody search) — turn it into a lesson: hum your own tune and see what it's near; an instant ear-training game.",
      "AI 能把哼唱/弹奏的片段匹配到已有歌曲（音频指纹+旋律搜索）——变成课堂游戏：哼自己编的旋律看看像谁，即时的听力训练。"],
    ["voice-model", "โมเดลเสียงร้อง — สิทธิ์และความยินยอมมาก่อนความวิเศษ",
      "AI เลียนแบบเสียงร้องได้เนียนจนแยกไม่ออก — กติกาวงการที่กำลังเขียนกันอยู่: ต้องได้อนุญาตจากเจ้าของเสียง ระบุต้นทางชัด และจ่ายค่าสิทธิ์ถ้ามีการใช้เชิงพาณิชย์ — สอนผู้เรียนไว้แต่เนิ่น ๆ: พรสวรรค์ทางเทคโนโลยีต้องมีจริยธรรมกำกับ",
      "Voice models can clone a singer convincingly — the emerging rule: explicit consent from the voice's owner, clear attribution, and royalties for commercial use — teach learners early: technological marvel needs ethics attached.",
      "语音模型能以假乱真地克隆歌手——行业正在成形的规则：需声音主人明确同意、注明来源，商业使用需付版税——早些教给学员：技术奇观必须有伦理约束。"],
    ["ar-screening", "A&R และการคัดเพลง — AI ช่วยฟังก่อน คนตัดสิน",
      "ค่ายเพลงใช้ AI คัดกรองเดโมนับพันเพื่อหาสัญญาณ \"น่าฟังต่อ\" แต่การตัดสินใจเซ็นสัญญายังเป็นคน — สำหรับผู้เรียน: เดโมที่ \"เครื่องอ่านออก\" (ไฟล์ชัด ชื่อชัด โครงเพลงชัด) มีโอกาสผ่านประตูแรกมากกว่า",
      "Labels use AI to screen thousands of demos for \"worth a listen\" signals, humans still sign — for learners: a demo the machine can parse (clean audio, clear title, clear song form) gets past the first gate more often.",
      "唱片公司用 AI 初筛成千上万的 Demo 找\"值得一听\"的信号，签约仍由人决定——对学员：机器可读的 Demo（音质清晰、命名规范、曲式清楚）更容易过第一道门。"],
  ];
  for (const [id, th, bodyTh, en, zh] of IND) {
    kb.add({
      id: `inn:ai:industry:${id}`, type: "principle", domain: "music-innovation",
      title: `AI ในวงการดนตรี: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "จบทุกคาบด้วยข้อสรุปเดียวกัน: AI เสนอ คนเลือก — ให้ผู้เรียนลองใช้เครื่องมือหนึ่งอย่างจริง (แยกสเต็ม / หาเพลงจากทำนอง) แล้ววิเคราะห์ว่าอะไรคือส่วนที่ \"ยังต้องเป็นฝีมือคน\"",
      confidence: 0.72, source: "tiga-industry-craft",
      tags: ["innovation", "ai-industry", id], meta: { family: "ai-industry" },
    });
    out.push(`inn:ai:industry:${id}`);
  }
  return out;
}

/* 2) AI กับการเรียนการสอนเปียโน — ทางที่แอปนี้กำลังเดินอยู่ */
export function genAiInLearning(kb) {
  const out = [];
  const LEA = [
    ["score-following", "AI ตามการเล่น (score following) — ครูรู้ว่าเธออยู่ห้องไหน",
      "แอปฟังเสียงเปียโนแล้วระบุว่าผู้เรียนเล่นถึงบรรทัดไหน โน้ตไหนพลาด เร็ว/ช้ากว่าจังหวะแค่ไหน (pitch + timing รายโน้ต) — นี่คือ \"ตา+หูของครู\" ที่อยู่กับผู้เรียนได้ทุกวันระหว่างคาบ และเป็นหัวใจที่แอปนี้ใช้อยู่",
      "Apps hear the piano and locate the learner: which line, which notes missed, rushing or dragging at note-level pitch+timing — the teacher's eyes+ears that stay with the learner between lessons (the core of this very app).",
      "应用聆听钢琴并定位学习者：在哪一行、错哪些音、抢拍还是拖拍（逐音符的音高+节奏）——课间陪伴学习者的\"老师之眼耳\"，也是本应用的核心。"],
    ["error-taxonomy", "แยกชนิดความผิด — วินิจฉัยให้ถูกโรคก่อนสั่งยา",
      "AI วัดได้ทั้ง \"ผิดโน้ต\" (pitch) · \"ผิดจังหวะ\" (timing) · \"หยุดกลางทาง\" (fluency) — ทั้งสามแก้ต่างกันหมด: โน้ตผิดแก้ด้วยช้า+มองชื่อโน้ต จังหวะผิดแก้ด้วยนับ+เมโทรนอม สะดุดแก้ด้วยแบ่งท่อนเล็ก — ครูที่รู้ว่าผิดอะไร จะไม่สั่งผิดทาง",
      "AI separates wrong-note (pitch) from wrong-rhythm (timing) from stopping (fluency) — three different fixes: notes → slow + name them; rhythm → count + metronome; stumbles → smaller chunks; knowing WHICH error prevents the wrong prescription.",
      "AI 区分错音（音高）、错节奏（时值）与中断（流畅度）——三种修法不同：错音靠放慢+认音名，节奏靠数拍+节拍器，中断靠切小段——知道错什么才不会开错药方。"],
    ["adaptive-practice", "แผนซ้อมที่ปรับตามคน (adaptive practice)",
      "AI เลือกท่อนฝึกถัดไปจากประวัติจริง: ท่อนไหนพลาดซ้ำ · ความเร็วที่เล่นผ่านได้ · วันนี้เริ่มต้นดีแค่ไหน — เช่นเดียวกับครูที่จำได้ว่า \"เธอติดตรงไหน\" ทุกครั้ง — หลักการเดียวกับ W×H×Q ของแอปนี้ (แบ่งตามวัย · ตามกลยุทธ์ · ตามคุณภาพ)",
      "AI picks the next drill from real history: which section kept failing, the tempo that passed, how today started — like a teacher who remembers exactly where you got stuck (the same principle as this app's W×H×Q: age × strategy × quality).",
      "AI 根据真实历史选择下一个练习：哪段总错、能通过的速度、今天的状态——像记得\"你卡在哪\"的老师（与本期 W×H×Q：年龄×策略×质量 同一原理）。"],
    ["self-accompany", "มือซ้าย AI — ผู้เรียนเล่นทำนอง AI เล่นคลอ",
      "แอปคลอคอร์ด/เบสให้ตามการเล่นของผู้เรียนแบบสด ๆ ผู้เรียนจึงได้ \"เล่นกับวง\" ตั้งแต่วันแรก แม้ยังเล่นมือเดียว — นวัตกรรมสำคัญเพราะเปลี่ยนความรู้สึกจาก \"ผิดโดด ๆ\" เป็น \"เป็นส่วนหนึ่งของเพลง\"",
      "Apps accompany the learner live (chords/bass following the playing) so day-one learners play \"with a band\" even one-handed — a key innovation: mistakes stop feeling like silence and start feeling like being part of the song.",
      "应用实时为学习者伴奏（和弦/低音跟随演奏），第一天就能\"与乐队合奏\"，哪怕单手——关键创新：错误不再是突兀的空白，而是\"歌曲的一部分\"。"],
    ["omr", "AI อ่านโน้ตจากรูป (OMR) — ชีทกระดาษกลายเป็นดิจิทัล",
      "Optical Music Recognition แปลงภาพแผ่นโน้ตเป็นไฟล์ที่เครื่องเล่น/แก้ได้ — ครูเอาหนังสือเพลงเก่าของบ้านมาทำเป็นชีทซ้อมให้ลูกได้ในไม่กี่นาที (ยังต้องตรวจกันตา — OMR พลาดได้) — ความรู้เก่าจึงเข้าถึงได้ในรูปแบบใหม่",
      "Optical Music Recognition turns sheet photos into playable/editable files — a teacher can digitize the family's old songbook for a child's practice in minutes (still check by eye — OMR errs) — old knowledge made newly reachable.",
      "光学识别（OMR）把乐谱照片变成可播放/可编辑的文件——老师几分钟内就能把家里的旧歌本变成孩子的练习谱（仍需人眼校对，OMR 会错）——旧知识以新形态触手可及。"],
  ];
  for (const [id, th, bodyTh, en, zh] of LEA) {
    kb.add({
      id: `inn:ai:learning:${id}`, type: "principle", domain: "music-innovation",
      title: `AI กับการเรียนเปียโน: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ผูกทุก entry กับของจริงในแอป: score following = ตัวจับโน้ตระหว่างเล่น · error taxonomy = คำวินิจฉัยหลังจบเพลง · adaptive = เพลง/ท่อนซ้อมที่ระบบเลือกให้ — ให้ผู้เรียนรู้ว่าเบื้องหลังคือ AI ช่วยครู ไม่ใช่แทนครู",
      confidence: 0.75, source: "tiga-industry-craft",
      tags: ["innovation", "ai-learning", id], meta: { family: "ai-learning" },
    });
    out.push(`inn:ai:learning:${id}`);
  }
  return out;
}

/* 3) คราฟต์เบื้องหลัง — เข้าใจแค่พอจะใช้เป็น */
export function genAiCraft(kb) {
  const out = [];
  const CRA = [
    ["midi2-mpe", "MIDI 2.0 และ MPE — ภาษากลางก้าวจาก \"กดคีย์\" สู่ \"เล่นสำเนียง\"",
      "MIDI เดิมบอกแค่คีย์/แรง/ความยาว MIDI 2.0 เพิ่มความละเอียดและสองทิศทาง (เครื่องคุยกันได้) ส่วน MPE ให้แต่ละนิ้วมีช่องสัญญาณของตัวเอง เลื่อนเสียง/ดัดสำเนียงรายนิ้วได้ — สำหรับผู้เรียนเปียโน: ต่อไปแม้แต่ \"กดคีย์แนวนอนเบา ๆ\" ก็อาจถูกบันทึกและติวได้",
      "Classic MIDI says key/force/length; MIDI 2.0 adds resolution and two-way talk; MPE gives each finger its own channel for per-note bends — for pianists: even a gentle horizontal press may soon be captured and coached.",
      "传统 MIDI 只记键/力度/时长；MIDI 2.0 提升分辨率并支持双向通信；MPE 给每根手指独立通道，可逐音弯音——对钢琴学习者：连横向轻按都终将被记录并被指导。"],
    ["separation-craft", "AI แยกเสียงทำงานยังไง (พอเข้าใจเพื่อใช้ให้เก่ง)",
      "หัวใจคือโมเดลเรียนรู้ \"หน้าตาคลื่นเสียง\" ของแต่ละชนิดเครื่องดนตรีจนแยกซ้อนกันได้ — จุดอ่อนที่ควรรู้: เสียงเปียโนโดด ๆ แยกยากกว่าวงเต็ม (หู AI งงกับเสียงเดียวในความเงียบ) — ใช้แล้วต้องตรวจหูคนเสมอ",
      "Models learn each instrument's sonic fingerprint and un-stack them — a known weakness: solo piano is harder to separate than a full mix (too few reference textures) — always verify with human ears.",
      "模型学习每种乐器的\"声音指纹\"再把混音拆开——已知弱点：独奏钢琴比全乐队更难分离（参考纹理太少）——务必用耳朵复核。"],
    ["transcription-craft", "AI ถอดเสียงเป็นโน้ต (transcription) — เล่นตามหูก็มีชีท",
      "ให้ AI ฟังการเล่นแล้วเขียนออกมาเป็นโน้ต (pitch + duration + velocity) — ผู้เรียนที่เล่นตามหูได้แต่อ่านโน้ตไม่เก่ง จะเห็นว่า \"สิ่งที่มือเล่น\" กลายเป็นกระดาษได้จริง ใช้เชื่อมสองโลก: เล่นก่อน อ่านทีหลัง",
      "AI listens to a performance and writes it out (pitch + duration + velocity) — learners who play by ear but read poorly can see their hands' work become paper — bridging both worlds: play first, read after.",
      "AI 聆听演奏并写成乐谱（音高+时值+力度）——会\"听弹\"但读谱弱的学员能看到双手的作品变成纸——先弹后读，连接两个世界。"],
    ["embeddings", "เสียงในโลกของ \"เวกเตอร์\" — เพลงคือตำแหน่งบนแผนที่",
      "AI แปลงเสียงเป็นชุดตัวเลข (embedding) ที่เพลงชอบ ๆ กันอยู่ใกล้กัน — ระบบแนะนำ ค้นหา จัดเพลย์ลิสต์ ทำงานบนแผนที่นี้ — เข้าใจเท่านี้ก็อธิบายผู้เรียนได้ว่า \"ทำไมแอปเลือกเพลงนี้ให้เธอ\" อย่างซื่อสัตย์",
      "AI turns audio into numeric vectors (embeddings) where similar songs sit close — recommendations, search, and playlists all navigate this map — enough to honestly explain \"why the app picked this song for you.\"",
      "AI 把声音变成数字向量（embedding），相似歌曲彼此靠近——推荐、搜索、歌单都在这张\"地图\"上运行——足以诚实地解释\"为什么推荐这首歌给你\"。"],
    ["generation-midi", "AI สร้าง MIDI — ตัวอย่างฝึกไม่จำกัด",
      "โมเดลสร้างไฟล์ MIDI ใหม่ ๆ ตามสไตล์ที่กำหนด (สเกล/จังหวะ/ระดับยาก) — ใช้ผลิตแบบฝึกหัดไม่ซ้ำแบบได้ไม่จำกัด เหมือนที่เอนจินของแอปนี้ generate ชีทรายวัน — เงื่อนไขเดียวคือ \"ต้องผ่านเกณฑ์ดนตรีจริง\" ไม่ใช่แค่เสียงออก",
      "Models generate new MIDI in a requested style (scale/groove/difficulty) — unlimited fresh drills, the way this app's engine generates daily sheets — the one condition: output must pass real music criteria, not just make sound.",
      "模型按指定风格（音阶/律动/难度）生成新 MIDI——无限的新练习，正如本应用的引擎每日生成谱面——唯一条件：产物必须通过真实音乐标准，而不仅仅\"出声\"。"],
  ];
  for (const [id, th, bodyTh, en, zh] of CRA) {
    kb.add({
      id: `inn:ai:craft:${id}`, type: "fact", domain: "music-innovation",
      title: `คราฟต์ AI เบื้องหลัง: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "อธิบายเท่าที่จำเป็นต่อการ \"ใช้เป็นและรู้จุดอ่อน\" — จบทุกเรื่องด้วยกติกาเดียว: เครื่องช่วยได้ ตรวจด้วยหู/มือคนเสมอ",
      confidence: 0.7, source: "tiga-industry-craft",
      tags: ["innovation", "ai-craft", id], meta: { family: "ai-craft" },
    });
    out.push(`inn:ai:craft:${id}`);
  }
  return out;
}

/* 4) ข้อมูล สิทธิ์ ความน่าเชื่อถือ — กำแพงที่ต้องมี */
export function genAiIntegrity(kb) {
  const out = [];
  const INT = [
    ["training-data", "ข้อมูลสอน AI — เครดิตและสิทธิ์คือรากฐาน",
      "โมเดล AI ดนตรีเรียนจากบันทึกเสียง/ชีทของคนจริงนับไม่ถ้วน — คำถามที่วงการกำลังตอบ: ใครอนุญาต · ใครได้เครดิต · ใครได้ส่วนแบ่ง — หลักการสอนผู้เรียน: ผลงานของใครก็ตามที่อยู่เบื้องหลังเสียงที่ AI เล่น มีชื่อและสิทธิ์เสมอ",
      "Music AI learns from countless human recordings/scores — the industry is answering: who consented, who gets credit, who gets paid — teach learners: whoever's work sits behind AI-played sound keeps their name and rights.",
      "音乐 AI 从无数真人录音/乐谱中学习——行业正在回答：谁同意了、谁署名、谁分成——教给学员：AI 演奏背后的创作者始终拥有名字与权利。"],
    ["watermark", "ลายน้ำเสียง AI — ฟังไม่ออกก็ยังตรวจได้",
      "การฝังลายน้ำในไฟล์เสียงที่ AI สร้าง (ทั้งแบบหูฟังไม่ออกและแบบมาตรฐานข้อมูล) ช่วยให้รู้ว่า \"ชิ้นนี้มี AI อยู่เบื้องหลัง\" — อนาคตอันใกล้แผ่นเสียงในร้านอาจมีทั้ง \"เล่นโดยคน\" และ \"ช่วยโดย AI\" ระบุกำกับ — ความโปร่งใสกลายเป็นคุณธรรมของงานเสียง",
      "Watermarking AI-made audio (inaudible or in metadata) reveals \"AI was behind this\" — soon records may state both \"performed by\" and \"AI-assisted\" — transparency plus correct attribution (credit where due) becomes a craft virtue.",
      "给 AI 生成的音频加水印（不可听或写在元数据）能标明\"背后有 AI\"——不久的将来唱片或会同时标注\"演奏者\"与\"AI 参与\"——透明与正确署名（该给谁的功劳就给谁）成为声音工艺的新德行。"],
    ["deepfake", "เสียงปลอมแบบเนียน — ฝึก \"ฟังให้รู้ว่ายังไม่รู้\"",
      "เสียงร้อง/เสียงพูดปลอมที่ AI สร้างใช้ได้ทั้งดีและร้าย (สวัสดิการสร้างสรรค์ vs หลอกลวง) — สิ่งที่ครูฝึกได้คือทัศนคติ: เห็นคลิปเสียงเด็ด ๆ อย่าเชื่อทันทีว่า \"เล่นสดจริง\" ถามต้นทางก่อนแชร์ — ให้ผู้เรียนโตเป็นผู้ฟังที่มีวิจารณญาณ",
      "AI-cloned voices serve creativity and deception alike — what teachers can build is stance: don't instantly believe \"live performance\" from a dazzling clip; check the source before sharing — and anyone's voice is used only with their consent — raising critical listeners.",
      "AI 克隆的声音既可创造也可欺骗——教师能培养的是态度：听到惊艳片段先别相信\"现场实弹\"，转发前查来源——且任何人的声音都必须经本人同意才能使用——培养有辨别力的听众。"],
    ["royalty-meta", "ข้อมูลกำกับ (metadata) — เส้นเลือดของเพลงต้องถูกจับเป็นข้อมูล",
      "เมื่อเพลงหมุนผ่าน AI/สตรีมมิง สิทธิ์ผู้แต่ง-ผู้เล่น-ผู้ผลิตต้องติดไปกับไฟล์ (เครดิตถูกต้อง = คนจริงได้เงินจริง) — เบ็นช์มาร์คของนวัตกรรมที่ดี: เทคโนโลยีต้องทำให้การจ่ายค่าตอบแทนถูกคน \"ง่ายขึ้น\" ไม่ใช่ยากขึ้น",
      "As songs flow through AI/streaming, creator-performer-producer rights must travel with the file (correct metadata = real people get paid) — a good innovation benchmark: tech should make paying the right person easier, not harder.",
      "歌曲流经 AI/流媒体时，创作者-演奏者-制作者的权利须随文件走（元数据正确＝真人拿到钱）——好创新的标尺：技术应让\"付对人\"更容易而非更难。"],
  ];
  for (const [id, th, bodyTh, en, zh] of INT) {
    kb.add({
      id: `inn:ai:integrity:${id}`, type: "principle", domain: "music-innovation",
      title: `AI กับความน่าเชื่อถือ: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "สอนเป็น \"กติกาของห้องเรียน\" ไม่ใช่บทเรียนกฎหมาย: อนุญาตก่อนใช้เสียงใคร · ระบุว่าอะไรมาจาก AI · เครดิตคนจริงเสมอ — ผู้เรียนเล็กก็เข้าใจได้ถ้าเล่าเป็นเรื่องความยุติธรรม",
      confidence: 0.75, source: "tiga-industry-craft",
      tags: ["innovation", "ai-integrity", id], meta: { family: "ai-integrity" },
    });
    out.push(`inn:ai:integrity:${id}`);
  }
  return out;
}

/* 5) เส้นฟรอนเทียร — จุดหมายที่นักวิจัยกำลังวิ่งไป */
export function genAiFrontier(kb) {
  const out = [];
  const FRO = [
    ["eyegaze", "เล่นเปียโนด้วยสายตา — เส้นฟรอนเทียรของการเข้าถึง",
      "นักวิจัยสร้างระบบที่ผู้พิการทางการเคลื่อนไหวเลือกโน้ตด้วยการมองและ \"ปรบมือ/กะพริบ\" เป็นจังหวะ เล่นเพลงเต็มได้บนเวทีจริง — ความหมายต่อการสอน: เทคโนโลยีที่ดีทำให้ \"ใครก็ได้มีเครื่องดนตรี\" ไม่ใช่แค่ \"คนที่มือพร้อม\"",
      "Researchers built systems letting people with movement disabilities choose notes by gaze and keep beat with blinks/claps, performing full songs on real stages — the teaching meaning: great tech gives \"anyone an instrument,\" not just \"those with ready hands.\"",
      "研究者已能让行动障碍者用目光选音、以眨眼/拍击保持节拍，在真实舞台演奏整曲——教学意义：好的技术让\"人人都有乐器\"，而不只属于\"双手健全者\"。"],
    ["orchestra-completion", "AI สมบทบาทสมบูรณ์ — โน้ตยังไม่เขียนจบก็ฟังได้",
      "โครงการวิจัยให้ AI เรียนสไตล์คีตกวีแล้วเติมท่อนที่ค้างอยู่ให้จบเป็นผลงานเล่นจริงได้ — วงการยอมรับร่วมกันว่า \"ผลงานยังเป็นของคีตกวีเดิม + ผู้เติมระบุชัด\" — สอนผู้เรียนว่าเส้นแบ่ง \"ความจริง/ความคิดสร้างสรรค์\" ต้องระบุที่มาเสมอ",
      "Research projects let AI learn a composer's style and complete unfinished works, performed live — the field's shared rule: the work stays credited to the original composer + completion clearly attributed — teach learners: creative boundaries need named sources.",
      "研究项目让 AI 学习作曲家风格并补完未竟之作、真实上演——行业共识：署名仍归原作者＋补完者明确标注——教给学员：创造性边界必须标明来源。"],
    ["unsupervised-duet", "หุ่นยนต์ \"อ่านโน้ตจากการฟัง\" แล้วคลอเปียโนได้",
      "หุ่นยนต์ที่ฟังผู้เล่น (ที่ยังไม่เคยเจอกัน) แล้วปรับจังหวะ/แรงตีคีย์ให้คลอเปียโนโดยไม่มีโน้ตนำ ถือเป็นจุดแข็งฟรอนเทียรของ AI เชิงกายภาพ — บทเรียนสอน: \"การฟังเพื่อนร่วมวง\" คือทักษะที่แม้ AI ยังต้องฝึก — ผู้เรียนคนจึงต้องฝึกเช่นกัน",
      "Robots that listen to an unseen player and adapt their keystrokes to accompany without a synced score mark the frontier of embodied AI — the teaching lesson: \"listening to your ensemble\" is a skill even AI must train — so must learners.",
      "能聆听素未谋面的演奏者并实时调整击键、无需同步总谱即可伴奏的机器人，是具身智能的前沿——教学启示：\"聆听伙伴\"是连 AI 都要训练的能力，学习者更是。"],
  ];
  for (const [id, th, bodyTh, en, zh] of FRO) {
    kb.add({
      id: `inn:ai:frontier:${id}`, type: "fact", domain: "music-innovation",
      title: `ฟรอนเทียร AI ดนตรี: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ใช้เป็นเรื่องเล่า \"ปลายทางของเทคโนโลยี\" ที่ผูกกลับมาที่ผู้เรียน: ถ้าหุ่นยนต์ยังต้องฝึกฟัง เราก็ต้องฝึกฟัง — จบด้วยคำถาม \"อยากให้เทคโนโลยีแบบนี้ช่วยอะไรเราในคาบเรียน\"",
      confidence: 0.65, source: "tiga-industry-craft",
      tags: ["innovation", "ai-frontier", id], meta: { family: "ai-frontier" },
    });
    out.push(`inn:ai:frontier:${id}`);
  }
  return out;
}

/* 6) นวัตกรรมอุตสาหกรรม/การสอน รอบ 2 — เสริมความลึกให้ขุมเดิม */
export function genInnovationRoundTwo(kb) {
  const out = [];
  const R2 = [
    ["hybrid-lab", "ห้องแล็บเปียโนผสม — คาบเรียนที่เทคโนโลยีเงียบให้ครูดัง",
      "รูปแบบห้องเรียนยุคใหม่: เปียโนดิจิทัลหูฟังรายคน + จอส่งต่อครู ครูเข้าไปฟัง/สอนรายคนได้โดยไม่รบกวนห้อง — นวัตกรรมนี้ทำให้คาบเรียนเดียวมี \"เวลาเรียนรายคน\" จริง ไม่ใช่แค่เวลารวม",
      "Modern classroom: headphones-on digital pianos + a teacher console — the teacher listens/teaches one student without disturbing the room — real per-student time inside a single group lesson, not just group time.",
      "现代课堂：每台电钢琴配耳机＋教师控制台——教师可单独听/教某个学生而不打扰全班——一节集体课里有了真正的\"个人时间\"。"],
    ["silent-grand", "ระบบไซเลนต์บนเปียโนจริง — ฝึกดึกได้ ครอบครัวหลับสบาย",
      "กลไกติดตั้งบนเปียโนจริงที่ตัดเสียงสายแล้วส่งสัญญาณเข้าหูฟัง (แตะคีย์จริง ได้สัมผัสจริง) — ทำให้ \"ฝึกทุกวัน\" เป็นไปได้ในคอนโด/ทาวน์เฮาส์ — นวัตกรรมที่แก้เป้าหมายเดียว: เอาข้ออ้าง \"เสียงรบกวนคนอื่น\" ออกจากการซ้อม",
      "Retrofit systems mute the strings and route touch-true sound to headphones (real keys, real feel) — daily practice becomes possible in condos/apartments — removing the \"we'll disturb the neighbors\" excuse from practice.",
      "静音系统让真钢琴消音并把真实触感的声音送入耳机（真琴键、真手感）——公寓也能天天练琴——把\"吵到邻居\"从练琴借口里拿掉。"],
    ["sight-reading-center", "ห้องอ่านโน้ตเชิงรุก — อ่านแปลกหน้าทุกวันเป็นกิจวัตร",
      "สตูดิโอชั้นนำจัด \"ช่วงอ่านโน้ตเพลงใหม่\" ทุกคาบ: เปิดชีทที่ไม่เคยเห็น 3-5 นาที ไม่หยุดแก้ที่ผิด — อ่านแปลกหน้าทุกวันคือวิธีเดียวที่พิสูจน์แล้วว่าทำให้ \"อ่านโน้ตไว\" จริง (AI ในแอปนี้ทำหน้าที่ป้อนชีทใหม่ให้พอดีระดับได้ตลอด)",
      "Leading studios run a daily \"new-score window\": unseen sheet, a few minutes, keep going through mistakes — daily unfamiliar reading is the proven way to fluent sight-reading (this app's AI can feed level-right new sheets endlessly).",
      "顶尖工作室每天安排\"新谱窗口\"：从未见过的谱、几分钟、错也不停——每天读陌生谱是练出流利视奏的已被证明的方法（本应用的 AI 能持续供给难度合适的新谱）。"],
    ["home-audio-at-piano", "ลำโพงข้างเปียโน — หูที่เทียบเสียงให้ทุกวัน",
      "ครูยุคใหม่วาง \"ระบบเสียงดี ๆ คู่เปียโน\" ให้ผู้เรียนฟังงานอ้างอิงก่อน/หลังเล่น (ระดับเสียงพอดี ไม่ทำหูชา) — หูที่ได้ยิน \"เสียงที่ดี\" ทุกวันจะปรับมือตามเอง — เทคโนโลยีเสียงในบ้านจึงเป็นส่วนของการสอน ไม่ใช่ของฟุ่มเฟือย",
      "Teachers keep a good speaker by the piano for before/after reference listening (safe levels) — ears that hear \"good sound\" daily adjust the hands themselves — home audio becomes teaching equipment, not decoration.",
      "老师在钢琴旁放置优质音箱，供弹前/后聆听参考（音量安全）——每天听到\"好声音\"的耳朵会自己调整双手——家用音响成为教学设备而非摆设。"],
    ["instant-feedback-loop", "วงจรฟีดแบ็กสั้นสุด — จาก \"ซ้อมเป็นสัปดาห์\" เป็น \"รู้ตัวทันที\"",
      "นวัตกรรมสอนที่ทรงพลังที่สุดในรอบนี้คือการทำให้วงจร \"เล่น → รู้ผล → แก้\" สั้นลง: ก่อนหน้านี้ต้องรอคาบหน้าครูบอก ตอนนี้รู้ทันทีจากจอ — หลักจิตวิทยาการเรียนรู้สนับสนุนเต็มที่: ฟีดแบ็กยิ่งเร็ว การแก้ยิ่งติด — AI ที่ตอบรู้เรื่องทันทีคือการต่อยอดหลักนี้",
      "The most powerful teaching innovation of this era is shrinking the loop play → result → fix: waiting a week for the next lesson is now instant on-screen feedback — learning science agrees: faster feedback sticks better — responsive AI extends this principle.",
      "这个时代最有力的教学创新是缩短\"弹→知→改\"循环：从等下周上课变成屏幕即时反馈——学习科学也支持：反馈越快，纠正越牢——即时响应的 AI 正是这一原理的延伸。"],
    ["catalog-ai-kpis", "สตูดิโอยุค AI — จัดการด้วยตัวเลขที่เคยจับไม่ได้",
      "ระบบบริหารสตูดิโอใช้ AI สรุปสิ่งที่เคยต้องจำในหัว: นักเรียนคนไหนห่างหาย · ท่อนไหนติดทั้งชุด · ครูท่านไหนปิดคลาสเต็ม — ครูผู้เป็นเจ้าของสตูดิโอจึงตัดสินใจด้วยข้อมูลจริง (แอปนี้มีทั้ง Backoffice และรายงานผู้ปกครองที่ทำงานหลักนี้อยู่แล้ว)",
      "Studio-management AI surfaces what used to live in the owner's head: who drifted away, which section stumps whole cohorts, whose classes fill — studio-owning teachers decide with real data (this app's Backoffice + parent reports already do this work).",
      "工作室管理系统把过去靠脑子记的变成数据：谁流失了、哪段全班卡壳、哪位老师课满——兼任经营者的教师用真实数据决策（本应用的 Backoffice 与家长报告已在做这件事）。"],
  ];
  for (const [id, th, bodyTh, en, zh] of R2) {
    kb.add({
      id: `inn:r2:${id}`, type: "strategy", domain: "music-innovation",
      title: `นวัตกรรมรอบสอง: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ทุก entry เขียนเพื่อ \"ครูที่เป็นเจ้าของสตูดิโอ/ผู้ปกครอง\" ใช้ได้จริง — จบด้วยข้อเสนอทดลองหนึ่งอย่างที่เริ่มได้ในคาบหน้า",
      confidence: 0.72, source: "tiga-industry-craft",
      tags: ["innovation", "industry-2", id], meta: { family: "industry-2" },
    });
    out.push(`inn:r2:${id}`);
  }
  return out;
}

/* Seed entry point — called from web.js right after the base innovation pillar */
export function seedMusicInnovationAI(kb) {
  genAiInIndustry(kb);
  genAiInLearning(kb);
  genAiCraft(kb);
  genAiIntegrity(kb);
  genAiFrontier(kb);
  genInnovationRoundTwo(kb);
}
