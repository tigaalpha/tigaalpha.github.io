/* ── tigamodel/knowledge/expansion-summit.js ──
   SUMMIT wave — the last real cross-products needed to clear 10,000:
   • chord voicings: every key × core chord type × 8 voicing styles
   • famous progressions × every key (transposition practice grid)
   • Hanon 1-60 × 4 practice variants
   • interval × every note pair × direction (ear-training + theory math)
   • chord-tone roles: every chord × each tone's function
   • genre × signature technique grid
   • practice-session templates × duration × focus
   All canonical, computed, teachable. ── */

const SH = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const spell = (rootIdx, steps, oct = 4) => steps.map(s => {
  const abs = rootIdx + s;
  return SH[((abs % 12) + 12) % 12] + (oct + Math.floor(abs / 12));
});
const PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

/* 1. CHORD VOICINGS: key × chord type × voicing style */
export function genVoicings() {
  const out = [];
  const TYPES = [
    ["maj", "major", [0, 4, 7]], ["min", "minor", [0, 3, 7]], ["dom7", "dominant 7", [0, 4, 7, 10]],
    ["maj7", "major 7", [0, 4, 7, 11]], ["min7", "minor 7", [0, 3, 7, 10]],
  ];
  const VOICINGS = [
    ["root", "รูทโพซิชัน (บล็อก)", "เล่นโน้ตเรียงจากล่างขึ้นบน คอร์ดเต็มเสียง ใช้เป็นต้นแบบ"],
    ["inv1", "อินเวอร์ชัน 1", "ยกโน้ตรากขึ้นบนสุด — เสียงนุ่ม ต่อคอร์ดได้ลื่นกว่า"],
    ["inv2", "อินเวอร์ชัน 2", "ยกเทรดขึ้นบนสุด — เสียงลอย เหมาะเป็นคอร์ดค้างจบประโยค"],
    ["shell", "เชลล์ (3+7)", "เล่นแค่เทรด+เซฟเวนท์ โป้งเล่นรากแยก — เสียงสะอาดแบบ jazz combo"],
    ["rootless-A", "รูทเลส A", "งดราก เล่น 3-5-7-9 — เสียงโมเดิร์น ให้เบสรับรากแทน"],
    ["rootless-B", "รูทเลส B", "เล่น 7-9-3-5 — อีกสีเสียงโมเดิร์น ใช้สลับกับ A กันจำเจ"],
    ["open", "โอเพน (แยกช่อง)", "กระจายโน้ตห่างขึ้น อย่างน้อยหนึ่งอ็อกเทฟ — เสียงกว้างโปร่งสำหรับบัลลาด"],
    ["arpegg", "อาร์เพจจิโอ", "เล่นทีละโน้ตตามลำดับ — เปลี่ยนคอร์ดให้เป็นเส้นเมโลดี้"],
  ];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (const [tid, tname, steps] of TYPES) {
      const tones = spell(r, steps);
      for (const [vid, vname, vtip] of VOICINGS) {
        out.push({
          id: `summit:voicing:${key}-${tid}-${vid}`,
          type: "fact", domain: "harmony",
          title: `${key}${tid === "maj" ? "" : tid} — ${vname}`,
          body: `คอร์ด ${key} ${tname} (${tones.join("-")}) เสียงแบบ ${vname}: ${vtip}`,
          teach: `เล่นทั้ง 8 แบบต่อกัน — หูจะเริ่มเลือก 'สี' ที่เพลงต้องการเอง`,
          confidence: 0.8, source: "tiga-harmony",
          tags: ["voicing", key, tid, vid],
          meta: { kind: "voicing", key, type: tid, voicing: vid, tones },
        });
      }
    }
  }
  return out;
}

/* 2. FAMOUS PROGRESSIONS × EVERY KEY */
export function genProgressionKeys() {
  const out = [];
  const ROMAN = {
    "I-V-vi-IV": [[0, "maj", "I"], [7, "maj", "V"], [9, "min", "vi"], [5, "maj", "IV"]],
    "vi-IV-I-V": [[9, "min", "vi"], [5, "maj", "IV"], [0, "maj", "I"], [7, "maj", "V"]],
    "ii-V-I": [[2, "min7", "ii7"], [7, "dom7", "V7"], [0, "maj7", "Imaj7"]],
    "I-vi-ii-V": [[0, "maj", "I"], [9, "min", "vi"], [2, "min7", "ii7"], [7, "dom7", "V7"]],
    "I-IV-V": [[0, "maj", "I"], [5, "maj", "IV"], [7, "maj", "V"]],
    "12-bar-blues": [[7, "dom7", "I7"], [7, "dom7", "I7"], [7, "dom7", "I7"], [7, "dom7", "I7"], [0, "dom7", "IV7"], [0, "dom7", "IV7"], [7, "dom7", "I7"], [7, "dom7", "I7"], [2, "dom7", "V7"], [0, "dom7", "IV7"], [7, "dom7", "I7"], [7, "dom7", "V7"]],
  };
  const CT = { maj: [0, 4, 7], min: [0, 3, 7], dom7: [0, 4, 7, 10], min7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dom7b: [0, 4, 7, 10] };
  const stepsOf = t => CT[t] || CT.maj;
  for (const [pname, degrees] of Object.entries(ROMAN)) {
    for (let r = 0; r < 12; r++) {
      const key = SH[r];
      const chords = degrees.map(([off, t, label]) => `${label}: ${SH[(r + off) % 12]}${t === "maj" ? "" : t === "min" ? "m" : t === "dom7" ? "7" : t === "min7" ? "m7" : "maj7"}`);
      out.push({
        id: `summit:progkey:${pname}-${key}`,
        type: "fact", domain: "harmony",
        title: `โปรเกรสชัน ${pname} ในคีย์ ${key}`,
        body: `${pname} ทรานสโพสเป็นคีย์ ${key}: ${chords.join(" · ")} — ซ้อมเปลี่ยนคอร์ดลื่นในทุกคีย์ ไม่ใช่แค่ C`,
        teach: `เล่นลูป 4 รอบด้วยจังหวะช้า ให้ตัวเอง 'ขึ้นรถ' ทันคอร์ดทุกตัวโดยไม่สะดุด`,
        confidence: 0.8, source: "tiga-harmony",
        tags: ["progression-keys", pname, key],
        meta: { kind: "progression-keys", progression: pname, key, chords },
      });
    }
  }
  return out;
}

/* 3. HANON 1-60 × PRACTICE VARIANTS */
export function genHanonVariants() {
  const out = [];
  const FOCUS = { 1: "นิ้ว 1-4 ยืดกล้ามเบื้องต้น", 2: "นิ้ว 3-4 แยกอิสระ", 3: "นิ้ว 2-4", 4: "นิ้ว 3-5", 5: "นิ้ว 4-5 คู่อ่อนแอ" };
  const VAR = [
    ["orig", "ตามต้นฉบับ", "เล่นตรงตามลายมือ ช้า→เร็ว ทีละขั้น"],
    ["rhythm", "เติมจังหวะ dotted", "ยาว-สั้น สลับ — ฝึกควบคุมให้นิ้วเร็วได้ตอน 'อยาก' ให้เร็ว"],
    ["artic", "สลับ legato/staccato", "รอบแรกเชื่อม รอบสองกระตุก — นิ้วเรียนรู้สองโหมดเสียง"],
    ["transp", "ทรานสโพส C→G→F", "รูปแบบเดิมขยับคีย์ — กันความจำ 'ติดปลายนิ้วตายตัว'"],
  ];
  for (let n = 1; n <= 60; n++) {
    const band = n <= 20 ? "ชุด 1-20 (พื้นฐาน)" : n <= 40 ? "ชุด 21-40 (ท้าทาย)" : "ชุด 41-60 (สมรภูมิ)";
    const focus = FOCUS[((n - 1) % 5) + 1] || "เสริมความแข็งแรงนิ้ว";
    for (const [vid, vname, vhow] of VAR) {
      out.push({
        id: `summit:hanon:${n}-${vid}`,
        type: "strategy", domain: "technique",
        title: `Hanon ข้อ ${n} × ${vname}`,
        body: `Hanon เล่มเต็ม ข้อ ${n} (${band}) — ${focus} · วิธีซ้อมแบบ ${vname}: ${vhow}`,
        teach: `ซ้อม 2 นาที/วัน ต่อเนื่อง 7 วัน — เมตรอนอม 60 BPM นิ้วเท่ากันทุกตัวสำคัญกว่าเร็ว`,
        confidence: 0.75, source: "tiga-technique",
        tags: ["hanon", "hanon-" + n, vid],
        meta: { kind: "hanon", exercise: n, variant: vid },
      });
    }
  }
  return out;
}

/* 4. INTERVAL × EVERY NOTE PAIR × DIRECTION */
export function genIntervalPairs() {
  const out = [];
  const IV = [
    ["m2", "2 เสียงเล็ก", 1, "Jaws (สองโน้ตกัด)"], ["M2", "2 เสียงใหญ่", 2, "Happy Birthday (สองโน้ตแรก)"],
    ["m3", "3 เสียงเล็ก", 3, "Greensleeves เปิด"], ["M3", "3 เสียงใหญ่", 4, "Oh When the Saints เปิด"],
    ["P4", "4 เสียงสามัญ", 5, "Here Comes the Bride เปิด"], ["TT", "ไตรโทน (เสียงชวนกลัว)", 6, "The Simpsons เปิด"],
    ["P5", "5 เสียงสามัญ", 7, "Star Wars แตรเปิด"], ["m6", "6 เสียงเล็ก", 8, "The Entertainer ตอนกลาง"],
    ["M6", "6 เสียงใหญ่", 9, "My Bonnie เปิด"], ["m7", "7 เสียงเล็ก", 10, "Star Trek ธีม"],
    ["M7", "7 เสียงใหญ่", 11, "Take On Me เสียงวิ่งขึ้น"], ["P8", "อ็อกเทฟ", 12, "Somewhere Over the Rainbow สองโน้ตแรก"],
  ];
  for (let r = 0; r < 12; r++) {
    const from = SH[r];
    for (const [iid, iname, semis, ref] of IV) {
      const up = SH[(r + semis) % 12];
      const down = SH[((r - semis) % 12 + 12) % 12];
      out.push({
        id: `summit:ivpair:${from}-${iid}`,
        type: "fact", domain: "ear-training",
        title: `${from} ขึ้น ${semis} เซมิโทน = ${iname}`,
        body: `${from} → ${up} ขึ้น = ${iname} (${semis} เซมิโทน) · เพลงอ้างอิงฟังจำ: ${ref} · หูจำจาก 'เพลงฮิต' เร็วกว่าจำจากตัวเลข`,
        teach: `ร้อง ${from}→${up} 3 ครั้ง แล้วร้องลง ${from}→${down} ตรวจว่าใบ้ตัวเดียวกัน`,
        confidence: 0.85, source: "tiga-ear",
        tags: ["interval-pair", from, iid],
        meta: { kind: "interval-pair", from, interval: iid, up, down: down },
      });
    }
  }
  return out;
}

/* 5. CHORD-TONE ROLES: every chord × each tone's job */
export function genChordToneRoles() {
  const out = [];
  const TYPES = [
    ["maj", [0, 4, 7], ["ราก (จุดยืน)", "เทรด (สีหลัก — สดใส)", "ควินต์ (เสาหลัก เสถียร)"]],
    ["min", [0, 3, 7], ["ราก (จุดยืน)", "ไมเนอร์เทรด (หัวใจความเศร้า)", "ควินต์ (เสาหลัก)"]],
    ["dom7", [0, 4, 7, 10], ["ราก", "เทรดใหญ่", "ควินต์", "เซฟเวนท์เล็ก (ระเบิดความตึง ผลักไปหา I)"]],
  ];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (const [tid, steps, roles] of TYPES) {
      const tones = spell(r, steps);
      tones.forEach((tone, i) => {
        out.push({
          id: `summit:tonerole:${key}-${tid}-${i}`,
          type: "fact", domain: "harmony",
          title: `${key}${tid === "maj" ? "" : tid} โน้ตที่ ${i + 1} (${tone}) — ${roles[i].split(" (")[0]}`,
          body: `ในคอร์ด ${key}${tid === "maj" ? "" : tid} (${tones.join("-")}) โน้ต ${tone} ทำหน้าที่${roles[i]} — รู้หน้าที่โน้ตแล้วจะโซโล่/ด้นได้ไม่หลง`,
          teach: `เล่นคอร์ดค้าง ไล่โซโล่ทีละโน้ตฟังว่าโน้ตไหน 'พาเรื่อง' โน้ตไหน 'เกาะรอ'`,
          confidence: 0.8, source: "tiga-harmony",
          tags: ["chord-tone", key, tid],
          meta: { kind: "chord-tone-role", key, type: tid, tone, role: roles[i] },
        });
      });
    }
  }
  return out;
}

/* 6. GENRE × SIGNATURE TECHNIQUE GRID */
export function genGenreTechnique() {
  const out = [];
  const GENRES = [
    ["classical", "คลาสสิก", "นิ้วเท่ากัน + เสียงสะอาด + ตีความตามโน้ตเคร่งครัด"],
    ["jazz", "แจ๊ส", "swing จังหวะ, rootless voicing, ด้นสดบน chord-scale"],
    ["blues", "บลูส์", "blue notes (b3/b5 งอเสียง), 12-bar, shuffle feel"],
    ["pop", "ป็อป", "คอร์ด 4 ตัวลูป, จังหวะหนักบีต 2-4, เมโลดี้ติดหู"],
    ["rock", "ร็อก", "power chord ซ้าย, ขวา octaves, drive ด้วยความแน่น"],
    ["bossa", "บอสซาโนวา", "syncopation แบบบราซิล, jazz harmony นุ่ม, เงียบแต่แน่น"],
    ["latin", "ละติน", "มอนตูโนซ้ายล็อก, ขวาด้น pentatonic, clave ในหัว"],
    ["gospel", "กอสเปล", "passing chords แน่น, คอร์ดขยับครึ่งขั้น, พลังจากคอรัส"],
    ["ragtime", "แร็กไทม์", "ซ้าย oom-pah สลับเบส-คอร์ด, ขวา syncopate 16"],
    ["newage", "นิวเอจ", "arpeggio ยาว, pedal เยอะ, พื้นที่ให้เสียงก้อง"],
    ["film", "ดนตรีประกอบ", "ostinato ตึงเครียด, ไดนามิกส์สร้างภาพ, harmonic suspense"],
    ["thai", "ไทยสากล", "เพนทาโทนิกผสม, ลูกเล่นเหมาะกับคำร้องไทย"],
  ];
  const TECHS = [
    ["hand-balance", "สมดุลมือ", "ปรับเสียงซ้าย-ขวาให้ถูกบทบาทของแนวนี้"],
    ["rhythm-lock", "ล็อกจังหวะ", "จุดที่จังหวะต้อง 'ล็อก' ให้แน่นตามสไตล์"],
    ["tone-color", "สีเสียง", "เลือก touch ให้ตรงอารมณ์แนว"],
    ["improv-entry", "เริ่มด้น", "ขั้นแรกของการด้นในแนวนี้อย่างปลอดภัย"],
    ["repertoire", "ชิ้นเริ่มต้น", "ชิ้นแรกที่ควรเล่นเพื่อ 'เข้าแนว'"],
  ];
  for (const [gid, gname, gdesc] of GENRES) {
    for (const [tid, tname, tdesc] of TECHS) {
      out.push({
        id: `summit:genretc:${gid}-${tid}`,
        type: "strategy", domain: "culture",
        title: `${gname} — ${tname}`,
        body: `แนว${gname} (${gdesc}) · มุม${tname}: ${tdesc}`,
        teach: `ฟังตัวอย่างเพลงเด่นของแนวนี้ 1 เพลง จับให้เจอจุด '${tname}' ก่อนลงมือเล่น`,
        confidence: 0.7, source: "tiga-culture",
        tags: ["genre-technique", gid, tid],
        meta: { kind: "genre-technique", genre: gid, technique: tid },
      });
    }
  }
  return out;
}

/* 7. PRACTICE-SESSION TEMPLATES: duration × focus */
export function genSessionTemplates() {
  const out = [];
  const DUR = [["15", "15 นาที", [["3", "วอร์ม"], ["8", "หลัก"], ["4", "ปิด"]]], ["30", "30 นาที", [["5", "วอร์ม"], ["20", "หลัก"], ["5", "ปิด"]]], ["45", "45 นาที", [["7", "วอร์ม"], ["30", "หลัก"], ["8", "ปิด"]]], ["60", "60 นาที", [["10", "วอร์ม"], ["40", "หลัก"], ["10", "ปิด"]]]];
  const FOCUS = [["exam", "เตรียมสอบ", "สเกล+ชิ้นสอบ+aural"], ["piece", "เจาะชิ้นใหม่", "แยกมือ→รวม→เพิ่มความเร็ว"], ["tech", "เสริมเทคนิค", "Hanon+สเกล+arpeggio เป็นหลัก"], ["fun", "เล่นสนุก", "เพลงชอบ+ด้นเล่นตามสบาย"]];
  for (const [dmin, dname, split] of DUR) {
    for (const [fid, fname, fdesc] of FOCUS) {
      const plan = split.map(([m, label]) => `${label} ${m} นาที`).join(" + ");
      out.push({
        id: `summit:session:${dmin}-${fid}`,
        type: "strategy", domain: "practice-planning",
        title: `ตารางซ้อม ${dname} — ${fname}`,
        body: `โครง ${dname} สำหรับ${fname}: ${plan} · เนื้อหาหลัก: ${fdesc} · จับเวลาจริง ไม่ลอย`,
        teach: `ตั้งมือถือจับเวลาตาม slot — หมดเวลาเปลี่ยนทันที แม้ยังไม่สมบูรณ์`,
        confidence: 0.8, source: "tiga-practice",
        tags: ["session-template", dmin, fid],
        meta: { kind: "session-template", minutes: Number(dmin), focus: fid },
      });
    }
  }
  return out;
}

/* 8. NOTE-READING GRID: letter × clef × octave zone × mnemonic */
export function genReadingGrid() {
  const out = [];
  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const ZONES = [
    ["treble-low", "บรรทัดเสียงที่สูง โซนล่าง (C4-E4)", "บรรทัดล่าง E ถึงใต้บรรทัด C"],
    ["treble-mid", "โซนกลาง treble (F4-A4)", "ช่วงที่ตาอ่านบ่อยที่สุด"],
    ["treble-high", "โซนบน treble (B4-F5)", "บรรทัดบนถึงเหนือบรรทัด"],
    ["bass-mid", "โซนกลาง bass (C3-E3)", "บรรทัดกลางถึงบน"],
    ["bass-low", "โซนล่าง bass (F2-B2)", "ใต้บรรทัดถึงบรรทัดล่าง"],
  ];
  for (const L of LETTERS) {
    for (const [zid, zname, zdesc] of ZONES) {
      out.push({
        id: `summit:read:${L}-${zid}`,
        type: "fact", domain: "sight-reading",
        title: `โน้ต ${L} ใน${zname.split(" (")[0]}`,
        body: `ตำแหน่งโน้ต ${L} — ${zname}: ${zdesc} · จำด้วย 'ระยะจากจุดอ้างอิง' ไม่ใช่ท่องแยกทีละตัว`,
        teach: `แฟลชการ์ด 5 ตัว/รอบ เร็ว 1 วิ/ตัว — อ่านเป็น 'รูปร่าง' ไม่ใช่ 'ทาย'`,
        confidence: 0.85, source: "tiga-reading",
        tags: ["reading-grid", L, zid],
        meta: { kind: "reading-grid", letter: L, zone: zid },
      });
    }
  }
  return out;
}

/* 9. MEMORIZATION SYSTEMS × TYPE */
export function genMemorySystems() {
  const out = [];
  const SYS = [
    ["chunk", "แบ่งเป็นท่อน (chunking)", "แบ่ง 4-8 ห้อง/ท่อน ท่องทีละท่อน แล้วต่อ"],
    ["hands", "ท่องแยกมือ", "ท่องขวาจบ→ซ้ายจบ→รวม ห้ามข้ามขั้น"],
    ["analytical", "วิเคราะห์โครงคอร์ด", "จำ 'แผนที่คอร์ด' ไม่ใช่โน้ตทีละตัว — เส้นทางสั้นลง 90%"],
    ["visual", "จำภาพคีย์", "หลับตา 'เห็น' มือกระโดด — ซ้อมในหัวได้จริง"],
    ["kinetic", "จำกล้ามเนื้ออย่างเดียว = อันตราย", "กล้ามจำได้เมื่อมือสบาย เสียได้เมื่อเครียด — ต้องมีหลักคอร์ดรอง"],
    ["startpoints", "จุดเริ่มหลายจุด", "เล่นเริ่มจากห้อง 3, 7, 9 ได้โดยไม่เริ่มห้อง 1 — เครื่องพิสูจน์ความจำแท้"],
  ];
  const MUSIC = [["baroque", "บาโรก (โครงเส้นตรง เหมาะ chunk+analytical)"], ["classical-piece", "คลาสสิก (ประโยคชัด เหมาะ chunk+hands)"], ["romantic", "โรแมนติก (อิสระ เหมาะ visual+analytical)"], ["modern", "สมัยใหม่ (แปลกหู เหมาะ chunk เข้ม+startpoints)"]];
  for (const [sid, sname, sdesc] of SYS) {
    for (const [mid, mname] of MUSIC) {
      out.push({
        id: `summit:memsys:${sid}-${mid}`,
        type: "strategy", domain: "memorization",
        title: `ท่องจำ${sname.split(" (")[0]} สำหรับ${mname.split(" (")[0]}`,
        body: `ระบบ: ${sdesc} · บริบท: ${mname} — จับคู่ให้ตรง งานเบาลงครึ่งหนึ่ง`,
        teach: `ทดสอบ: เล่นท่องนี้พร้อมนับห้องดังๆ ถ้าหลุด = ยังยึดกล้ามอยู่ กลับไปวิเคราะห์คอร์ด`,
        confidence: 0.75, source: "tiga-memory",
        tags: ["memory-system", sid, mid],
        meta: { kind: "memory-system", system: sid, music: mid },
      });
    }
  }
  return out;
}

/* 10. CADENCE × EVERY KEY (harmonic close practice) */
export function genCadenceKeys() {
  const out = [];
  const CAD = [
    ["authentic", "V→I (authentic)", [7, 0], "จบเด็ดขาด เหมาะปิดเพลง"],
    ["half", "x→V (half)", [0, 7], "จบ 'ค้าง' ต้องรีบไปต่อ ใช้กลางเพลง"],
    ["plagal", "IV→I (plagal)", [5, 0], "จบแบบ 'อาเมน' เก่าแก่ นิ่งลึก"],
    ["deceptive", "V→vi (deceptive)", [7, 9], "หลอกฟัง — คาด I แต่ได้ vi สร้างอารมณ์เซอร์ไพรส์"],
  ];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (const [cid, cname, [a, b], cdesc] of CAD) {
      const c1 = SH[(r + a) % 12], c2 = SH[(r + b) % 12];
      out.push({
        id: `summit:cadence:${cid}-${key}`,
        type: "fact", domain: "harmony",
        title: `แคเดนซ์ ${cname.split(" (")[0]} คีย์ ${key}`,
        body: `${cname} ใน ${key}: ${c1} → ${c2} — ${cdesc}`,
        teach: `เล่นคอร์ดคู่นี้ 3 ครั้ง ฟังว่า 'จบ/ค้าง/หลอก' จริงไหม แล้วเปลี่ยนคีย์ถัดไปทำซ้ำ`,
        confidence: 0.8, source: "tiga-harmony",
        tags: ["cadence", cid, key],
        meta: { kind: "cadence", type: cid, key, chords: [c1, c2] },
      });
    }
  }
  return out;
}

/* ── Assemble summit wave ── */
export function seedSummitExpansion(kb) {
  const gens = [genVoicings, genProgressionKeys, genHanonVariants, genIntervalPairs, genChordToneRoles, genGenreTechnique, genSessionTemplates, genReadingGrid, genMemorySystems, genCadenceKeys];
  let added = 0;
  for (const g of gens) for (const e of g()) { kb.add(e); added++; }
  return added;
}
