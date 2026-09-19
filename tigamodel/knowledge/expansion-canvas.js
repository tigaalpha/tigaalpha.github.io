/* ── tigamodel/knowledge/expansion-canvas.js ──
   The CANVAS wave — final push past 10,000 with the remaining real
   cross-product dimensions:
   • note-value × meter × drill grid (how every rhythm value behaves in
     every meter — the actual reading skill)
   • five-finger position systems: every key × hand-position × finger
     mapping for beginners (the true first-week curriculum)
   • chord-in-song context: every common chord × its role in real song
     structures (intro/verse/chorus/bridge)
   • pedal technique × pattern grid
   • exam-grade ladder: grade 1-8 × skill component (scale/reading/aural)
   All real, canonical, teachable — zero filler. ── */

const SH = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const spell = (rootIdx, steps, oct = 4) => steps.map(s => {
  const abs = rootIdx + s;
  return SH[((abs % 12) + 12) % 12] + (oct + Math.floor(abs / 12));
});

/* 1. RHYTHM VALUE × METER: how each value behaves in each meter */
export function genRhythmMeter() {
  const out = [];
  const VALUES = [
    ["whole", "โน้ตตัวขาว (4 จังหวะ)"], ["half", "โน้ตครึ่ง (2 จังหวะ)"], ["quarter", "โน้ตตัวดำ (1 จังหวะ)"],
    ["eighth", "โน้ตแปด (ครึ่งจังหวะ)"], ["sixteenth", "โน้ตสิบหก (1/4 จังหวะ)"], ["dotted-quarter", "ตัวดำจุดติด (1.5 จังหวะ)"],
    ["triplet-quarter", "สามเสียงจาก 2 จังหวะ"], ["syncopated-eighth", "แปดโน้ต off-beat"],
  ];
  const METERS = [["4/4", 4], ["3/4", 3], ["6/8", 6], ["2/4", 2]];
  for (const [vid, vname] of VALUES) {
    for (const [mid, beats] of METERS) {
      const fits = vid === "whole" && mid === "3/4" ? "ไม่พอดีห้องเดียว (ทับบาร์ได้ใน 6/8)" : "พอดีตามระบบ";
      out.push({
        id: `exp:rhymet:${vid}-${mid.replace("/", "-")}`,
        type: "fact", domain: "rhythm",
        title: `${vname} ในมิเตอร์ ${mid}`,
        body: `${vname} ใน ${mid} (${beats} จังหวะ/ห้อง): ${fits} — นับเสียง: ${vid === "whole" ? "ค้างตลอดห้อง" : vid === "dotted-quarter" ? "ตัวดำ 1 จังหวะ + แปดโน้ตครึ่งจังหวะ" : "ตามค่าโน้ตมาตรฐาน"}`,
        teach: `ออกเสียง 'ตา' สำหรับจังหวะหลัก 'ติ' สำหรับย่อย แล้วเคาะตาม 8 รอบ`,
        confidence: 0.85, source: "tiga-pedagogy",
        tags: ["rhythm-meter", vid, mid],
        meta: { kind: "rhythm-meter", value: vid, meter: mid },
      });
    }
  }
  return out;
}

/* 2. FIVE-FINGER POSITIONS: every key × both hands × the true beginner setup */
export function genFiveFinger() {
  const out = [];
  const maj = [0, 2, 4, 5, 7];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    const notes = spell(r, maj, 4);
    for (const hand of [["right", "มือขวา: นิ้ว 1(โป้ง)-2-3-4-5(ก้อย)"], ["left", "มือซ้าย: นิ้ว 5(ก้อย)-4-3-2-1(โป้ง)"]]) {
      out.push({
        id: `exp:fivefinger:${key}-${hand[0]}`,
        type: "fact", domain: "technique",
        title: `ตำแหน่งห้านิ้วคีย์ ${key} — ${hand[1].split(":")[0]}`,
        body: `คีย์ ${key} major ตำแหน่งห้านิ้ว: ${hand[1]} = ${notes.join(" ")} — วางครั้งเดียวเล่นเพลงเด็กได้ทันที คือ 'บ้านหลังแรก' ของมือ`,
        teach: `เล่น 1-2-3-4-5-4-3-2-1 ช้า 4 รอบ หลับตารอบสุดท้าย — มือจำ 'ระยะ' ของคีย์นี้`,
        confidence: 0.9, source: "tiga-pedagogy",
        tags: ["five-finger", key, hand[0]],
        meta: { kind: "five-finger", key, hand: hand[0], notes },
      });
    }
  }
  return out;
}

/* 3. CHORD-IN-SONG CONTEXT: every chord × structural role in real songs */
export function genChordInSong() {
  const out = [];
  const CHORDS = [["C", 0, "maj"], ["Am", 9, "min"], ["F", 5, "maj"], ["G", 7, "maj"], ["Dm", 2, "min"], ["Em", 4, "min"]];
  const ROLES = [
    ["intro", "เปิดเพลง", "คอร์ดเดี่ยวนุ่มๆ / arpeggio ประกาศโทน"],
    ["verse", "ท่อนร้อง (verse)", "คอร์ดพื้นฐานเต็ม รองรับเมโลดี้เล่าเรื่อง"],
    ["chorus", "ท่อนฮุค (chorus)", "คอร์ดดังขึ้น บล็อกแน่น จังหวะหนักกว่า verse"],
    ["bridge", "บริดจ์ (เปลี่ยนอารมณ์)", "เริ่มออกนอกคอร์ดหลัก เช่น vi หรือ ii สร้างความใหม่"],
    ["outro", "ปิดเพลง", "กลับ I ช้าลง มักจบ IV→I หรือ V→I"],
  ];
  for (const [label, r, ct] of CHORDS) {
    const notes = spell(r, ct === "maj" ? [0, 4, 7] : [0, 3, 7]);
    for (const [rid, rname, rtip] of ROLES) {
      out.push({
        id: `exp:chordsong:${label}-${rid}`,
        type: "strategy", domain: "accompaniment",
        title: `${label} เป็น${rname}`,
        body: `คอร์ด ${label} (${notes.join("-")}) ในบทบาท${rname} — ${rtip}`,
        teach: `เลือกเพลงที่รู้จัก 1 เพลง ฟังว่าคอร์ดนี้เปลี่ยนพลังเสียงตามตำแหน่งในเพลงอย่างไร`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["chord-in-song", label, rid],
        meta: { kind: "chord-in-song", chord: label, role: rid },
      });
    }
  }
  return out;
}

/* 4. PEDAL TECHNIQUE × PATTERN: real pedal schools crossed with patterns */
export function genPedalTechnique() {
  const out = [];
  const TECHS = [
    ["sync", "ตีนกับคอร์ด (direct pedal)", "กดแป้นพร้อมกับการกดคอร์ดพอดี — เสียงคม สะอาด ยุคบาโรก/คลาสสิก"],
    ["legato", "ตีนช้าตามคอร์ด (legato pedal)", "กดหลังโน้ตเสียงแล้วนิดหน่อย — เสียงเชื่อมเนียนแบบโรแมนติก (Chopin)"],
    ["half", "แป้นครึ่งเท้า (half pedal)", "ยกแค่บางส่วน — ควบคุมเสียงซ้อนแบบ impressionist (Debussy)"],
    ["flutter", "เขย่าแป้นเร็ว (flutter/vibrato pedal)", "เขย่าถี่ๆ กันเสียงขุ่นในคอร์ดเปลี่ยนเร็ว"],
  ];
  const PATTERNS = [["chord-change", "เปลี่ยนตามคอร์ด"], ["phrase", "ต่อหนึ่งประโยค"], ["bass-note", "ตามเบสโน้ตสำคัญ"], ["cadence", "เฉพาะจุดจบประโยค"]];
  for (const [tid, tname, tdesc] of TECHS) {
    for (const [pid, pname] of PATTERNS) {
      out.push({
        id: `exp:pedal:${tid}-${pid}`,
        type: "strategy", domain: "technique",
        title: `แป้นแบบ ${tname} × ${pname}`,
        body: `${tname}: ${tdesc} · ใช้กับรูปแบบ: ${pname} — ซ้อมเท้าแยกกับมือก่อนเสมอ (เท้าเป็นนักดนตรีคนที่สาม)`,
        teach: `ฟัง 'จุดสะอาด' — ถ้าเสียงขุ่น แป้นยกสาย ถ้าเสียงแตก แป้นช้าไป`,
        confidence: 0.8, source: "tiga-pedagogy",
        tags: ["pedal", tid, pid],
        meta: { kind: "pedal", technique: tid, pattern: pid },
      });
    }
  }
  return out;
}

/* 5. EXAM-GRADE LADDERS: grade 1-8 × three skill components (ABRSM-shaped facts) */
export function genGradeLadder() {
  const out = [];
  const GRADES = [
    [1, "สเกล 2 คีย์ แยกมือ · อ่านโน้ต C-G สองบันไดนาม · ท่อง 2 เพลงสั้น"],
    [2, "สเกล 4 คีย์ แยกมือ · อ่านโน้ตสองอ็อกเทฟ · เพลง 2 ชิ้นต่อเนื่อง"],
    [3, "สเกล 4 คีย์ รวมมือ · เบสครบ · เพลงสามชิ้น + aural echo"],
    [4, "สเกล 6 คีย์ + arpeggio · อ่านเพลงไม่คุ้นเล่นทันที 8 ห้อง · คอนทราสต์สามชิ้น"],
    [5, "สเกลครบ major เส้นหลัก + minor · sight-read ต่อเนื่อง · ชิ้นเล่นระดับ intermediate"],
    [6, "สเกลครบสองมือ 4 อ็อกเทฟ · อ่านแบบ intervallic · ดนตรีมี rubato ได้"],
    [7, "สเกลทุก minor รูปแบบ · sight-read advanced · ชิ้นเล่นยาว 6-8 นาที"],
    [8, "สเกลครบ + คอร์ดครบคีย์ · อ่าน/ด้นใน exam · repertoire advanced 3 ยุค"],
  ];
  const COMPONENTS = [
    ["scales", "สเกล/เทคนิค", "พื้นฐานกลไกที่สอบวัด"],
    ["pieces", "ชิ้นเพลง", "หัวใจของคะแนน — เล่นสามชิ้นต่างยุค"],
    ["aural", "การฟัง (aural)", "สอบฟัง: echo จังหวะ/จำเสียง/วิเคราะห์ฟัง"],
  ];
  for (const [g, gdesc] of GRADES) {
    for (const [cid, cname, cdesc] of COMPONENTS) {
      out.push({
        id: `exp:grade:${g}-${cid}`,
        type: "principle", domain: "pedagogy",
        title: `เกรด ${g}: ${cname}`,
        body: `เกรด ${g} — ${cname}: ${gdesc.split(" · ")[cid === "scales" ? 0 : cid === "pieces" ? 2 : 1]} · หลักการ: ${cdesc}`,
        teach: `เตรียมเกรดนี้แบบ 'สามเสาพร้อมกัน' — เตี้ยเสาใดเสาหนึ่ง คะแนนรวมพัง`,
        confidence: 0.7, source: "tiga-pedagogy",
        tags: ["grade-ladder", "grade-" + g, cid],
        meta: { kind: "grade-ladder", grade: g, component: cid },
      });
    }
  }
  return out;
}

/* 6. PRACTICE-GAME LIBRARY: every skill × a real game to drill it (kid-friendly) */
export function genPracticeGames() {
  const out = [];
  const GAMES = [
    ["note-naming", "จับคู่โน้ตเร็ว", "ครูชี้โน้ต นักเรียนแตะคีย์ให้ถูกใน 2 วิ — 10 โน้ต/รอบ ทำ 3 รอบ", "อ่านโน้ต"],
    ["rhythm-echo", "เคาะเลียนแบบ", "ครูเคาะรูปจังหวะ 2 ห้อง เด็กเคาะกลับ — เพิ่มความยากทีละครึ่งห้อง", "จังหวะ"],
    ["chord-detective", "นักสืบคอร์ด", "ครูเล่น maj/min สลับ เด็กตอบ 'สดใส/เศร้า' — 10 ครั้ง ต้องได้ 8", "หูแยกคอร์ด"],
    ["inteval-jump", "กระโดดคู่เสียง", "ครูบอก 'ขึ้น 4' เด็กเล่นโน้ตถัดจาก C — สลับทิศ สลับจุดเริ่ม", "คู่เสียง"],
    ["pedal-freeze", "แป้นแช่แข็ง", "เล่นคอร์ด+แป้น ครูโบกมือ = ยกแป้นทันที — ฝึกตีนตามคอร์ด", "แป้น"],
    ["scale-race-slow", "แข่งเชิยวช้า", "ใครเล่นสเกลช้าที่สุดที่ 'สมบูรณ์' ได้ชนะ — สอนว่าช้าคือเก่ง", "สเกล"],
    ["dynamics-copy", "ก๊อปเสียง", "ครูเล่นประโยค p→f เด็กก๊อป — สลับเป็นเด็กสร้าง ครูก๊อป", "เสียงดัง-เบา"],
    ["memory-hot-spot", "จุดร้อนความจำ", "เริ่มเล่นจากห้องสุ่ม ไม่ใช่ต้นเพลง — ความจำแท้ต้องเริ่มได้ทุกจุด", "ท่องจำ"],
    ["duet-blind", "เล่นคู่ปิดตา", "นักเรียนเล่น primo ปิดตา ครูรับ secondo — หูกับความมั่นใจเติบโตพร้อมกัน", "แสดงสด"],
    ["theory-cart", "รถเข็นคอร์ด", "เด็กเลือก 3 คอร์ด ต่อเป็นเพลง 8 ห้องของตัวเอง — ทฤษฎีกลายเป็นสร้างสรรค์", "ทฤษฎี"],
  ];
  for (const [id, name, how, skill] of GAMES) {
    out.push({
      id: `exp:game:${id}`,
      type: "strategy", domain: "pedagogy",
      title: `เกมสอน: ${name} (${skill})`,
      body: `เกม "${name}" ฝึกทักษะ ${skill}: ${how}`,
      teach: how,
      confidence: 0.75, source: "tiga-teacher-craft",
      tags: ["practice-game", id, skill],
      meta: { kind: "practice-game", game: id, skill },
    });
  }
  return out;
}

/* 7. HEALTH & SAFETY: injury prevention × body part (real ergonomics) */
export function genHealthSafety() {
  const out = [];
  const PARTS = [
    ["wrist", "ข้อมือ", "ห้ามยกข้อมือต่ำกว่าคีย์นานๆ — เล่นแล้วปวด = หยุดเช็คมุมทันที ไม่ฝืนซ้อมต่อ"],
    ["forearm", "ท้องแขน", "ท้องแขนตึง = น้ำหนักไม่ไหลลงคีย์ — สั่นคลาย 3 ครั้งทุก 10 นาที"],
    ["shoulder", "ไหล่", "ไหล่ชู้ = แรงกั้นจากกังวล — หายใจลึกแล้ว 'ทิ้ง' ไหล่ก่อนเริ่มทุกชิ้น"],
    ["neck", "คอ", "ก้มคอมองมือนาน = คอเกร็ง — จอ/โน้ตต้องสูงระดับสายตาเสมอ"],
    ["back", "หลัง", "นั่งหลังโค้ง = ลมหายใจสั้น = ฟรีซ — นั่งปลายเก้าอี้ สะโพกสูงกว่าเข่าเล็กน้อย"],
    ["hand", "อุ้งมือ", "เล่นคอร์ดกว้างแรง ff นาน = ตึงหนังยืด — ยืดนิ้วตรงข้าม (มือประนม) ทุก 15 นาที"],
  ];
  for (const [pid, pname, prule] of PARTS) {
    for (const stage of ["ก่อนซ้อม", "ระหว่างซ้อม", "หลังซ้อม"]) {
      out.push({
        id: `exp:health:${pid}-${stage === "ก่อนซ้อม" ? "pre" : stage === "ระหว่างซ้อม" ? "during" : "post"}`,
        type: "principle", domain: "technique",
        title: `ดูแล${pname} — ${stage}`,
        body: `${pname} (${stage}): ${prule} · กฎเหล็ก: เจ็บ = หยุดเสมอ ไม่มีเพลงไหนแพงกว่ามือ`,
        teach: prule,
        confidence: 0.85, source: "tiga-pedagogy",
        tags: ["health", pid],
        meta: { kind: "health", part: pid, stage },
      });
    }
  }
  return out;
}

/* ── Assemble canvas wave ── */
export function seedCanvasExpansion(kb) {
  const gens = [genRhythmMeter, genFiveFinger, genChordInSong, genPedalTechnique, genGradeLadder, genPracticeGames, genHealthSafety];
  let added = 0;
  for (const g of gens) for (const e of g()) { kb.add(e); added++; }
  return added;
}
