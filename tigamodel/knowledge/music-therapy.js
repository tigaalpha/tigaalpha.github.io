/* ── tigamodel/knowledge/music-therapy.js — plan v3.4 11.1 (KB ดนตรีบำบัด)
   ⚠️ กรอบ wellbeing เหล็ก (กติกาแผน v3.4): entry ทุกชิ้นเป็น "หลักการที่ยอมรับกว้าง
   เชิงคุณภาพ" จากการเรียนดนตรีประยุกต์ — **ไม่มีการอ้างว่ารักษาโรค ไม่วินิจฉัย
   ไม่แทนที่นักดนตรีบำบัดมืออาชีพ** · ไม่มีตัวเลขผลศึกษาใด ๆ (No invented data)
   บทบาทของแอป: ครูดนตรีที่ใช้ความรู้นี้ "อย่างระวัง" เพื่อสุขภาวะของผู้เรียนเท่านั้น ── */

const WELLBEING_NOTE = "กรอบ wellbeing: นี่คือความรู้เชิงหลักการเพื่อการสอนดนตรีที่ดูแลใจ ไม่ใช่บริการทางการแพทย์ (EN: wellbeing frame — a teaching principle, not medical service) (ZH: 健康框架——教学原则，而非医疗服务)";

export function seedMusicTherapy(kb) {
  /* ── หลักการพื้นฐาน ── */
  const CORE = [
    ["receptive-active", "สองทางใหญ่: รับฟัง vs ลงมือเล่น", "การใช้ดนตรีเพื่อสุขภาวะมีสองทางใหญ่: 'รับฟัง' (ฟังเพลงที่ตรงใจอย่างตั้งใจ) และ 'ลงมือเล่น' (ตีกลอง/กดคีย์ตามอารมณ์) — คนละเวลาเหมาะคนละแบบ ไม่มีทางใดดีกว่า",
      "Two broad paths to wellbeing through music: receptive (intentional listening) and active (drumming/playing feelings out) — different moments suit different modes.",
      "通过音乐促进健康有两条路径：接受式（专注聆听）与主动式（敲击/弹奏情绪）——不同时刻适合不同方式。"],
    ["iso-principle", "หลัก ISO: เริ่มที่อารมณ์เดียวกันแล้วเลื่อนทีละน้อย", "หลักที่ยอมรับกว้างของงานดนตรีบำบัด: ดนตรีที่ 'ตรงอารมณ์ปัจจุบัน' ก่อน แล้วค่อยเลื่อนไปอารมณ์ที่ต้องการ — เพลงมืดแสงเปลี่ยนใจคนเศร้าหนักให้เบาได้ยากกว่าเพลงที่เข้ากับอารมณ์เขาก่อน",
      "The widely-accepted ISO principle: start with music matching the current mood, then step gradually toward the desired state — a bright pop song rarely reaches a heavy heart before a matching one does.",
      "广为接受的 ISO 原则：先匹配当下情绪，再逐步过渡——欢快的流行歌很难一开始就触动沉重的心。"],
    ["entrainment", "ร่างกายปรับตามจังหวะ (entrainment)", "ร่างกายเรามีแนวโน้มปรับจังหวะภายในตามจังหวะภายนอก: จังหวะคงที่ช่วยให้ก้าวเดิน/การหายใจ 'จับจังหวะร่วม' ได้ — นี่คือเหตุผลที่เมโทรนอมไม่ใช่แค่เครื่องมือสอนดนตรี",
      "Bodies tend to synchronize with steady external rhythm — gait and breath can entrain — which is why a metronome is more than a teaching tool.",
      "身体倾向于与稳定的外部节奏同步——步伐和呼吸都会——所以节拍器不只是教具。"],
    ["slow-tempo", "จังหวะช้ากับความรู้สึกผ่อนคลาย", "ชุดของเพลงจังหวะช้า/เสียงนุ่มมักสัมพันธ์กับความรู้สึกสงบในผู้ฟังทั่วไป — เหมาะเป็นบรรยากาศของช่วงซ้อมปลายวัน ไม่ต้องมีคำอ้างใดเกินนี้",
      "Slow, soft music is widely associated with calm — a natural fit for end-of-day practice, and claims need go no further.",
      "慢节奏、柔和的音乐普遍与平静感相关——适合一天结束时练习的氛围，无需更多声称。"],
    ["tension-release", "ตึง–คลาย: ภาษาอารมณ์ของดนตรี", "ดนตรีเล่าเรื่องอารมณ์ผ่าน 'ความตึงและการคลาย' (คอร์ดคาดคั้น → คอร์ดแก้) — ผู้เรียนที่ฟังออกคู่นี้จะเข้าใจว่าเพลงทำให้ 'ใจเปลี่ยนอารมณ์' ได้อย่างไร",
      "Music speaks emotion through tension and release (dominant → tonic) — learners who hear this pair understand how music moves a heart.",
      "音乐通过紧张与解决（属→主）表达情感——听懂这对关系的学员就明白音乐如何带动人心。"],
    ["memory-song", "ดนตรีกับความจำ: เพลงที่รักในวัยเยาว์", "เพลงที่เราผูกกับช่วงวัยรุ่น/วัยเยาว์มักถูกจดจำแม่นกว่าเพลงใหม่ และกลับมาเล่นได้ดูง่ายกว่า — ผู้สูงวัยที่กลับมาเรียนจึงมี 'สมบัติเพลง' รออยู่แล้ว",
      "Songs bound to youth tend to be remembered best and easiest to relearn — returning older learners already own a treasury.",
      "与青春绑定的歌记得最牢也最容易重拾——重返学习的长者早已拥有宝藏。"],
  ];
  for (const [id, th, bodyTh, en, zh] of CORE) {
    kb.add({
      id: `thx:core:${id}`, type: "principle", domain: "music-therapy",
      title: `ดนตรีบำบัด (หลักการ): ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh}) — ${WELLBEING_NOTE}`,
      teach: "ใช้เป็น 'กรอบความเข้าใจ' ของครูเท่านั้น — เมื่อพูดกับผู้เรียนให้พูดเรื่องเพลง/จังหวะ/ความรู้สึก ไม่พูดเรื่องการรักษา",
      confidence: 0.65, source: "tiga-wellbeing-frame",
      tags: ["therapy", "principle", id], meta: { family: "core", wellbeing: true },
    });
  }

  /* ── แนวทางปฏิบัติในบริบท 'สอนดนตรี' ── */
  const PRACTICE = [
    ["calm-session", "ช่วงซ้อมปลายวัน: เพลงช้า + หายใจยาว", "รูปแบบที่ปลอดภัยและทำได้ทุกวัน: จบคาบด้วยเพลงจังหวะช้าที่ผู้เรียนเล่นได้ หายใจเข้าออกยาวตามห้องดนตรี — เปลี่ยนคาบสุดท้ายของวันให้เป็นช่วงพักใจ",
      "A safe daily pattern: end sessions with a slow piece the learner can play, breathing long with the bars — turning the last lesson into a mind-rest.",
      "安全的每日模式：以学员能弹的慢曲结束，随小节深呼吸——让最后一课成为心灵休息。"],
    ["kids-emotion", "กับเด็ก: ให้เพลงเป็นทางออกอารมณ์", "เด็กบางวันมาแบบไม่พร้อมซ้อมจริงจัง — ทางเลือกที่ดีคือให้เล่นเพลงที่ชอบเสียงดัง/เบาตามอารมณ์ แล้วค่อยเข้าบทเรียน — เคารพอารมณ์ก่อนวินัย",
      "Some days kids arrive unready for structured practice — letting them play a favorite loud/soft to their mood first respects feelings before discipline.",
      "有的日子孩子没法立刻进入正题——先让他按情绪弹喜欢的歌，再上课——先尊重情绪，再谈纪律。"],
    ["elderly-dignity", "กับผู้สูงวัย: เกียรติก่อนความยาก", "ผู้สูงวัยมาเรียนด้วยประสบการณ์ชีวิตเต็ม — เริ่มจากเพลงที่เขารักในวัยหนุ่มสาว (memory-song) และปรับระดับให้เล่นได้เร็ว ความรู้สึมีคุณค่า (dignity) มาก่อนความยากของบท",
      "Older learners arrive with a full life — start from the songs of their youth (memory-song) and level them to succeed fast; dignity before difficulty.",
      "长者带着完整的人生而来——从他们年轻时的歌开始，调到能快速弹会的难度；尊严优先于难度。"],
    ["boundary", "เส้นแบ่งของครูดนตรี", "ครูดนตรี (และครู AI) ทำได้แค่: สร้างบรรยากาศที่ดี · ใช้หลักการข้างบน · แนะนำผู้เชี่ยวชาญเมื่อผู้เรียนเล่าปัญหาที่ลึกกว่าบทเรียน — **ไม่ทำการแนะนำทางการแพทย์/จิตเวชใด ๆ**",
      "A music teacher (and AI teacher) may: create good atmosphere, apply the principles above, and refer to professionals when a learner shares something beyond lessons — never medical/psychiatric advice.",
      "音乐教师（含 AI 教师）可以做：营造氛围、运用上述原则、遇到超越课程的问题时转介专业人士——绝不提供医疗/精神建议。"],
  ];
  for (const [id, th, bodyTh, en, zh] of PRACTICE) {
    kb.add({
      id: `thx:practice:${id}`, type: "strategy", domain: "music-therapy",
      title: `ดนตรีบำบัด (แนวทาง): ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh}) — ${WELLBEING_NOTE}`,
      teach: id === "boundary"
        ? "entry นี้เป็นข้อบังคับของครู AI ทุกบทสนทนาเรื่องอารมณ์ — เล่าปัญหาลึก → เชิญชวนหาผู้เชี่ยวชาญ พร้อมกลับสู่เพลงอย่างอ่อนโยน"
        : "ทำเป็นโหมดจริงในผลิตภัณฑ์ (11.2–11.5) โดยเนื้อหาอ้าง entry เหล่านี้เท่านั้น",
      confidence: 0.65, source: "tiga-wellbeing-frame",
      tags: ["therapy", "practice", id], meta: { family: "practice", wellbeing: true },
    });
  }
}
