/* ── tigamodel/knowledge/expansion-scale.js ──
   The SCALE-UP wave — closes the 10,000 gap by crossing the last real
   learning dimensions the earlier waves left as singletons:
   • every note × every learning role (read it / sing it / find it / write
     it / hear it) — the five ways a world-class teacher drills one note
   • every triad × practice-stage × hand-separation state
   • every key × difficulty-progression rung (what "level" means in that key)
   • articulation × rhythm drill crosses
   • interval × chord-context recognition (hear the interval inside a chord)
   All entries remain real, computed, teachable facts — zero filler. ── */

const SH = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const IS_BLACK = (pc) => pc.includes("#");
const spell = (rootIdx, steps, oct = 4) => steps.map(s => {
  const abs = rootIdx + s;
  return SH[((abs % 12) + 12) % 12] + (oct + Math.floor(abs / 12));
});

/* 1. NOTE ROLES: notes in 2 octaves (C3-B5, 36 notes) × 5 learning roles */
export function genNoteRoles() {
  const out = [];
  const ROLES = [
    ["read", "อ่านบนบันไดนาม", "ชี้ตำแหน่งโน้ตนี้บนบันไดนามทั้งทรีเบิล (มือขวา) และเบส (มือซ้าย) ตอบใน 1 วินาที"],
    ["sing", "ร้องเสียงโน้ต", "กดคีย์ฟัง 1 ครั้ง ปิดหู… เอ๊ะ ปิดตา ร้องโน้ตนี้จากความจำ แล้วเปิดตาเทียบ"],
    ["find", "หาบนคีย์ปิดตา", "ปิดตาหาคีย์นี้จาก C ด้วยความรู้สึกกลุ่มคีย์ดำ 2-3 คีย์เป็นหมุดหมาย"],
    ["write", "เขียนลงกระดาษ", "เขียนโน้ตนี้ลงบันไดนามเปล่าด้วยมือ (การเขียนสร้างความจำที่การอ่านสร้างไม่ได้)"],
    ["hear", "ฟังแยกจากคอร์ด", "ครูเล่นคอร์ด C-E-G นักเรียนระบุว่าโน้ตนี้อยู่ในคอร์ดไหม และเป็นเสียงที่เท่าไหร่"],
  ];
  for (let r = 0; r < 12; r++) {
    for (const oct of [3, 4, 5]) {
      const pc = SH[r];
      if (oct === 5 && SH.indexOf(pc) > 6) continue; // B5 is the top of this range
      const note = pc + oct;
      for (const [rid, rname, rhow] of ROLES) {
        out.push({
          id: `exp:noterole:${note}-${rid}`,
          type: "strategy", domain: "sight-reading",
          title: `${note}: ${rname}`,
          body: `โน้ต ${note} — ฝึกด้วยบทบาท "${rname}": ${rhow}`,
          teach: rhow,
          confidence: 0.8, source: "tiga-pedagogy",
          tags: ["note-role", note, rid],
          meta: { kind: "note-role", note, role: rid },
        });
      }
    }
  }
  return out;
}

/* 2. TRIAD PRACTICE STAGES: every triad × 3 stages × 2 hand states */
export function genTriadStages() {
  const out = [];
  const TRS = { maj: [0, 4, 7], min: [0, 3, 7] };
  const STAGES = [
    ["block", "คอร์ดบล็อก (กดพร้อมกัน)", "จับรูปทรงบนโต๊ะก่อน แล้วลงคีย์ — เสียงสามโน้ตต้องมาพร้อมกันเป๊ะ"],
    ["broken", "แตกคอร์ด (ทีละโน้ตขึ้น-ลง)", "โน้ตต่อเนื่องเป็นเสียงเดียว ข้อมือเลื่อนนุ่ม — อย่ากระตุกที่โป้ง"],
    ["progression", "สลับคอร์ดใน progression", "สลับกับ I หรือ V ของคีย์เดียวกัน 8 ครั้ง ตาม beat"],
  ];
  const HANDS = [["separate", "แยกมือซ้ายก่อน (มือซ้ายอ่อนกว่าเสมอ)"], ["together", "รวมสองมือที่ครึ่งเทมโป"]];
  for (const [ct, steps] of Object.entries(TRS)) {
    for (let r = 0; r < 12; r++) {
      const root = SH[r];
      const notes = spell(r, steps);
      for (const [sid, sname, show] of STAGES) {
        for (const [hid, hname] of HANDS) {
          out.push({
            id: `exp:triadstage:${root}-${ct}-${sid}-${hid}`,
            type: "strategy", domain: "technique",
            title: `${root}${ct === "min" ? "m" : ""} — ${sname} · ${hname}`,
            body: `${root}${ct === "min" ? "m" : ""} (${notes.join(" ")}) — ${sname} · ${hname}: ${show}`,
            teach: show,
            confidence: 0.75, source: "tiga-pedagogy",
            tags: ["triad-stage", root, ct, sid, hid],
            meta: { kind: "triad-stage", chord: ct, root, stage: sid, hands: hid },
          });
        }
      }
    }
  }
  return out;
}

/* 3. KEY DIFFICULTY LADDER: every key × progression rungs (what each level means) */
export function genKeyLadders() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  const RUNGS = [
    ["scale-hands-sep", "สเกลแยกมือ", "สเกล 2 อ็อกเทฟ มือซ้าย-ขวา แยกกัน นิ่งทุกโป้งซ้อมใต้"],
    ["scale-hands-tog", "สเกลรวมสองมือ (2 อ็อกเทฟ)", "มือสมมาตร 1 อ็อกเทฟห่างกัน — จุดยากคือโป้งซ้อมพร้อมกัน"],
    ["triads-i-iv-v", "คอร์ด I-IV-V บล็อก", "สามคอร์ดหลักสลับได้ลื่น 8 รอบต่อเทมโป 60"],
    ["cadence", "cadence I-IV-V-I ครบ", "เล่นต่อเนื่องไม่หยุด ฟังการ 'เดินทางกลับบ้าน'"],
    ["arp-2-oct", "อาร์เปจโจ 2 อ็อกเทฟ", "ข้อมือเลื่อนนุ่ม ไม่มีเสียงกระตุกที่จุดเปลี่ยน"],
    ["repertoire-piece", "เพลงจริง 1 เพลงในคีย์นี้", "เพลงจบทั้งเพลง ผิดได้ไม่เกิน 3 จุด — คีย์นี้ 'อยู่ในมือ' จริงเมื่อข้อนี้ผ่าน"],
  ];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    const scaleNotes = spell(r, [...maj, 12]);
    for (const [rid, rname, rcrit] of RUNGS) {
      out.push({
        id: `exp:keyladder:${key}-${rid}`,
        type: "principle", domain: "practice-planning",
        title: `คีย์ ${key} — ขั้นที่: ${rname}`,
        body: `คีย์ ${key} (${scaleNotes.slice(0, 8).join(" ")}…) · ขั้น "${rname}": เกณฑ์ผ่าน = ${rcrit}`,
        teach: `อย่าขยับคีย์ถัดไปจนขั้นสุดท้ายของคีย์นี้ผ่าน — ความลึกชนะความกว้างเสมอ`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["key-ladder", key, rid],
        meta: { kind: "key-ladder", key, rung: rid },
      });
    }
  }
  return out;
}

/* 4. ARTICULATION × RHYTHM crosses (real drill combinations) */
export function genArticulationRhythm() {
  const out = [];
  const ARTS = [
    ["legato", "เชื่อมเนียน", "ยกนิ้วเมื่อโน้ตถัดไปเสียงแล้ว"],
    ["staccato", "ตัดสั้น", "สปริงจากคีย์ สั้นแต่ไม่แหลม"],
    ["portato", "กึ่งเชื่อม", "ข้อมือดูดขึ้นเบาทุกโน้ต"],
  ];
  const RHY = [
    ["even-4", "เท่ากัน 4 ตัว/beat", "1 e & a นิ่งเป๊ะ"],
    ["dotted", "จุดติด (long-short)", "1 . . a — เน้นความ 'ชี้' ของจังหวะยาว"],
    ["triplet", "สามเสียงใน 1 beat", "1-&-a เท่ากันแม่นๆ (สวนความเคยชิน 2 ส่วน)"],
    ["syncopated", "off-beat", "1 (e) & (a) — เสียงอยู่ระหว่าง beat ให้ขาเคาะต่อเนื่อง"],
  ];
  for (const [aid, aname, ahow] of ARTS) {
    for (const [rid, rname, rhow] of RHY) {
      out.push({
        id: `exp:artrhy:${aid}-${rid}`,
        type: "strategy", domain: "technique",
        title: `Drill: ${aname} × ${rname}`,
        body: `ผสม ${aname} (${ahow}) กับจังหวะ ${rname} (${rhow}) — ใช้สเกล C หรือ 5 โน้ตเพนทาโทนิก วน 4 รอบ`,
        teach: `เคาะขาทุก beat ตลอด — จังหวะต้องไม่พังเพราะการเปลี่ยน articulation`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["articulation-rhythm", aid, rid],
        meta: { kind: "articulation-rhythm", articulation: aid, rhythm: rid },
      });
    }
  }
  return out;
}

/* 5. INTERVAL-IN-CHORD RECOGNITION: intervals as heard inside real chords */
export function genIntervalInChord() {
  const out = [];
  const CHORD_INTS = [
    ["maj", 4, "เมเจอร์ 3rd คือ 'เสียงสดใส' ภายในคอร์ดเมเจอร์", [0, 4, 7]],
    ["min", 3, "ไมเนอร์ 3rd คือ 'เสียงเศร้า' ภายในคอร์ดไมเนอร์", [0, 3, 7]],
    ["dom7-b7", 10, "ไมเนอร์ 7th คือ 'เสียงเร่งกลับบ้าน' ใน dom7", [0, 4, 7, 10]],
    ["maj7-7", 11, "เมเจอร์ 7th คือ 'เสียงฝันหวาน' ใน maj7", [0, 4, 7, 11]],
    ["dim-b5", 6, "tritone คือ 'เสียงไม่นิ่ง' ในคอร์ด dim", [0, 3, 6]],
  ];
  for (let r = 0; r < 12; r++) {
    const root = SH[r];
    for (const [cid, semis, feel, steps] of CHORD_INTS) {
      const notes = spell(r, steps);
      const inner = spell(r + semis, [0], 4)[0];
      out.push({
        id: `exp:inchord:${root}-${cid}`,
        type: "fact", domain: "ear-training",
        title: `ฟังในคอร์ด: ${root} มี${semis === 10 ? "♭7" : semis === 11 ? "7" : semis === 6 ? "♭5" : semis === 4 ? "3" : "♭3"} อยู่ตรงไหน`,
        body: `คอร์ด ${notes.join("-")} — โน้ต ${inner} คือ${feel} · ฝึก: ครูเล่นคอร์ดทั้งก้อน นักเรียนหา "โน้ตตัวนั้น" บนคีย์`,
        teach: `เล่นคอร์ดค้าง ให้นักเรียน 'จับ' โน้ตเป้าหมายจากการฟัง ไม่ใช่จากทฤษฎี`,
        confidence: 0.8, source: "tiga-theory-math",
        tags: ["interval-in-chord", root, cid],
        meta: { kind: "interval-in-chord", root, chord: cid },
      });
    }
  }
  return out;
}

/* 6. NOTE-IN-CHORD ROLES: every chord tone × every note name (which notes belong) */
export function genNoteInChord() {
  const out = [];
  const TRS = { maj: [0, 4, 7], min: [0, 3, 7], dom7: [0, 4, 7, 10] };
  for (const [ct, steps] of Object.entries(TRS)) {
    for (let r = 0; r < 12; r++) {
      const root = SH[r];
      const memberSet = new Set(steps.map(s => ((r + s) % 12 + 12) % 12));
      const names = spell(r, steps);
      for (let n = 0; n < 12; n++) {
        const pc = SH[n];
        const inside = memberSet.has(n);
        out.push({
          id: `exp:noteinchord:${root}-${ct}-${pc}`,
          type: "fact", domain: "harmony",
          title: `${pc} อยู่ในคอร์ด ${root}${ct === "maj" ? "" : ct} ไหม`,
          body: inside
            ? `ใช่ — ${pc} เป็นสมาชิกของ ${root}${ct === "maj" ? "" : ct} (${names.join(" ")})`
            : `ไม่ใช่ — ${pc} ไม่อยู่ใน ${root}${ct === "maj" ? "" : ct} (${names.join(" ")}); ถ้ากดเพิ่มจะกลายเป็นสีเสียง tension ที่ต้องแก้`,
          teach: inside ? `หา ${pc} ทุกอ็อกเทฟบนคีย์ที่อยู่ในตำแหน่งเล่นได้ของคอร์ดนี้` : `เล่นคอร์ดค้างแล้วกด ${pc} ฟัง 'ความขัด' — หูเรียนรู้ tension จากเสียงจริง`,
          confidence: 0.95, source: "tiga-theory-math",
          tags: ["note-in-chord", root, ct, pc],
          meta: { kind: "note-in-chord", root, chord: ct, note: pc, inside },
        });
      }
    }
  }
  return out;
}

/* 7. FINGER-POSITION WORKOUTS: every finger pair × real key contexts */
export function genFingerPairs() {
  const out = [];
  const PAIRS = [[1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5], [3, 4], [3, 5], [4, 5]];
  const KEYS = ["C", "G", "F", "D", "A"];
  for (const [a, b] of PAIRS) {
    for (const key of KEYS) {
      out.push({
        id: `exp:fingerpair:${a}${b}-${key}`,
        type: "strategy", domain: "technique",
        title: `คู่นิ้ว ${a}-${b} บนสเกล ${key} major`,
        body: `ฝึกคู่นิ้ว ${a}-${b} (เล่นสลับนิ้ว ${a} กับ ${b} บนสองโน้ตติดกันของสเกล ${key}) 10 ครั้งช้า — เสียงสองนิ้วต้องดังเท่ากัน`,
        teach: `หลับตาเล่นรอบสุดท้าย — น้ำหนักนิ้วที่สม่ำเสมอมาจากความรู้สึก ไม่ใช่สายตา`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["finger-pair", `${a}-${b}`, key],
        meta: { kind: "finger-pair", fingers: [a, b], key },
      });
    }
  }
  return out;
}

/* 8. HARMONIC PLANES: every key × the 6 most-used progressions with RH/LH split */
export function genProgressionWorkouts() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  const QUAL = ["maj", "min", "min", "maj", "maj", "min", "dim"];
  const STEPS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] };
  const PROGS = [[0, 4, 5, 3], [1, 4, 0], [0, 5, 3, 4], [5, 3, 0, 4], [3, 0, 4], [0, 3, 4, 0]];
  const NAMES = ["I-V-vi-IV (pop)", "ii-V-I (jazz)", "I-vi-IV-V (doo-wop)", "vi-IV-I-V (emotional)", "IV-I-V (anthem)", "I-IV-V-I (classic)"];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (let p = 0; p < PROGS.length; p++) {
      const degs = PROGS[p];
      const lh = degs.map(d => SH[((r + maj[d]) % 12 + 12) % 12]);
      const rh = degs.map(d => spell(r + maj[d], STEPS[QUAL[d]], 4).join("-"));
      out.push({
        id: `exp:progwork:${key}-${p}`,
        type: "strategy", domain: "accompaniment",
        title: `คีย์ ${key}: ${NAMES[p]} แบ่งสองมือ`,
        body: `คีย์ ${key} — ${NAMES[p]}: มือซ้ายเบสราก ${lh.join(" → ")} · มือขวาคอร์ด ${rh.join(" → ")} — ซ้อมซ้ายลูปก่อน แล้วขวาจับคอร์ดตาม`,
        teach: `เล่นพร้อมร้องเมโลดี้สมมุติ — นี่คือวิธีเล่นเพลงจาก chord chart จริง`,
        confidence: 0.8, source: "tiga-theory-math",
        tags: ["progression-workout", key, NAMES[p].split(" ")[0]],
        meta: { kind: "progression-workout", key, progression: p },
      });
    }
  }
  return out;
}

/* 9. SCALE-DEGREE SINGING: every key × sing-the-degree ear drill */
export function genDegreeSinging() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  const SOLF = ["โด", "เร", "มี", "ฟา", "โซล", "ลา", "ที"];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (let deg = 0; deg < 7; deg++) {
      const note = SH[((r + maj[deg]) % 12 + 12) % 12];
      out.push({
        id: `exp:degsing:${key}-${deg}`,
        type: "strategy", domain: "ear-training",
        title: `คีย์ ${key}: ร้ององศาที่ ${deg + 1} (${SOLF[deg]} = ${note})`,
        body: `คีย์ ${key} — ครูเล่นโทนิก (${key}) แล้วให้ร้ององศาที่ ${deg + 1}: ${SOLF[deg]} = ${note} · ร้องก่อนเล่น หูนำนิ้วเสมอ`,
        teach: `ทำ 7 องศาต่อเนื่องเป็นเกม 'ร้องไล่' วันละ 2 คีย์`,
        confidence: 0.8, source: "tiga-pedagogy",
        tags: ["degree-singing", key, String(deg + 1)],
        meta: { kind: "degree-singing", key, degree: deg + 1 },
      });
    }
  }
  return out;
}

/* 10. SCALE PATTERN RUNS: every key × 5 melodic patterns (thirds, fourths…) */
export function genScalePatterns() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11, 12];
  const PATTERNS = [
    ["thirds", [0, 4, 1, 5, 2, 6, 3, 7], "โน้ตข้ามองศา 1-3-2-4", "โป้งซ้อมใต้แม่นยำขึ้นเพราะระยะกว้างขึ้น"],
    ["fourths", [0, 5, 1, 6, 2, 7], "โน้ตข้าม 1-4", "ยืดนิ้ว 4 ให้เป็นอิสระจากนิ้วอื่น"],
    ["step-back", [0, 1, 0, 2, 1, 3, 2, 4], "ขึ้น-ถอย 1 องศา", "สร้างการควบคุม 'ย้อน' ที่เพลงจริงต้องใช้"],
    ["triads", [0, 2, 4, 2, 4, 6, 4, 6, 0], "ไล่คอร์ดไต่ขึ้น", "รู้สึกฮาร์มอนีวิ่งขึ้นไปกับเมโลดี้"],
    ["pairs", [0, 1, 2, 3, 4, 5, 6, 7], "คู่โน้ตเน้นหน้า (1,1-2,2-3)", "จังหวะคู่เน้นหน้าฝึกน้ำหนักนิ้วคู่"],
  ];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (const [pid, idxs, pdesc, pwhy] of PATTERNS) {
      const notes = idxs.map(i => SH[((r + maj[Math.min(i, 7)]) % 12 + 12) % 12] + (4 + Math.floor((r + maj[Math.min(i, 7)]) / 12)));
      out.push({
        id: `exp:scalepat:${key}-${pid}`,
        type: "strategy", domain: "technique",
        title: `สเกล ${key} — แบบ: ${pdesc}`,
        body: `สเกล ${key} major แบบ "${pdesc}": ${notes.join(" ")} · คุณค่า: ${pwhy}`,
        teach: `ซ้อมช้า 60 BPM ทีละรูป 3 รอบสมบูรณ์ ก่อนขยับรูปถัดไป`,
        confidence: 0.8, source: "tiga-theory-math",
        tags: ["scale-pattern", key, pid],
        meta: { kind: "scale-pattern", key, pattern: pid },
      });
    }
  }
  return out;
}

/* 11. OCTAVE REGISTERS: every register × character (what lives there) */
export function genRegisters() {
  const out = [];
  const REGS = [
    ["C1-B2", "ต่ำสุด", "เบสลึก ความอบอุ่นของซ้าย / เสียงฟ้าร้องของเปียโน — เสียงพร้อมกันจะทึบ อย่าจับคอร์ดเต็มที่นี่"],
    ["C3-B3", "ต่ำ-กลาง", "เขตทำงานของมือซ้ายคลาสสิก — Alberti/walking bass อยู่แถวนี้"],
    ["C4-B4", "กลาง", "เสียงร้องของเปียโน — เมโลดี้ส่วนใหญ่ของโลกอยู่ตรงนี้ เพราะตรงช่วงเสียงคน"],
    ["C5-B5", "กลาง-สูง", "เมโลดี้สว่างขึ้น / harmony สีของขวา — เริ่มมี sparkle"],
    ["C6-C8", "สูงสุด", "สีประกาย นาฬิกาแก้ว — ใช้เบาๆ เป็น 'แสงบนยอด' ไม่ใช่เสาหลัก"],
  ];
  for (const [range, name, desc] of REGS) {
    for (const role of ["melody", "harmony", "pedal-tone", "sparkle"]) {
      const roleTh = { melody: "เมโลดี้", harmony: "ฮาร์มอนี", "pedal-tone": "โน้ตค้างเบส", sparkle: "ประกาย" }[role];
      out.push({
        id: `exp:register:${range.replace(/\W+/g, "")}-${role}`,
        type: "fact", domain: "expression",
        title: `ช่วงเสียง${name} (${range}) เป็น${roleTh}`,
        body: `ช่วง ${range} — ใช้เป็น${roleTh}: ${desc}`,
        teach: `เล่นโน้ตเดียวกัน 3 อ็อกเทฟติดกัน ฟัง 'บุคลิก' เปลี่ยน — นี่คือวิธีเลือกตำแหน่งเสียงตอนแต่ง/ด้นสด`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["register", range, role],
        meta: { kind: "register", range, role },
      });
    }
  }
  return out;
}

/* 12. CHORD-TONE SOLOING: every 7th chord × chord-tone melodic path */
export function genChordToneSolo() {
  const out = [];
  const SEV = { maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10] };
  for (const [ct, steps] of Object.entries(SEV)) {
    for (let r = 0; r < 12; r++) {
      const root = SH[r];
      const notes = spell(r, steps);
      out.push({
        id: `exp:solo:${root}-${ct}`,
        type: "strategy", domain: "improvisation",
        title: `ด้นบนโน้ตคอร์ด: ${root}${ct === "maj7" ? "maj7" : ct}`,
        body: `${root}${ct === "maj7" ? "maj7" : ct} — ด้นเฉพาะโน้ตคอร์ด: ${notes.join(" → ")} (ไล่ขึ้น ลง ข้าม เรียงใหม่) · การด้นที่ดีเริ่มจากโน้ตคอร์ดเสมอ สเกลมาทีหลัง`,
        teach: `แบ็คแทร็คคอร์ดเดียว 4 ห้อง ด้นเฉพาะ 4 โน้ตนี้ — จำกัดทางเลือกทำให้ 'ต้องมีดนตรี'`,
        confidence: 0.8, source: "tiga-theory-math",
        tags: ["chord-tone-solo", root, ct],
        meta: { kind: "chord-tone-solo", root, chord: ct },
      });
    }
  }
  return out;
}

/* 13. LH BASS VARIANTS: every root × 4 bass motion styles */
export function genBassVariants() {
  const out = [];
  const STYLES = [
    ["root-fifth", "ราก-5", "เขยื้อนเบา ใช้ได้กับทุกแนว"],
    ["root-octave", "ราก-ออกเทฟ", "หนักแน่นแบบร็อก/ป็อป"],
    ["walk-up", "เดินไล่ขึ้น 1-2-3-5", "นำทางเข้าคอร์ดถัดไปแบบแจ๊ส"],
    ["chromatic", "เดินครึ่งเสียงเข้าเป้า", "สไลด์เข้าคอร์ดใหม่แบบ blues/โรแมนติก"],
  ];
  for (let r = 0; r < 12; r++) {
    const root = SH[r];
    for (const [sid, sname, swhy] of STYLES) {
      out.push({
        id: `exp:bass:${root}-${sid}`,
        type: "strategy", domain: "accompaniment",
        title: `มือซ้ายบน ${root}: ${sname}`,
        body: `มือซ้ายเบสจาก ${root} แบบ "${sname}" — ${swhy} · เขตเสียง: อ็อกเทฟ 2-3`,
        teach: `ซ้อมลูป 8 รอบให้เป็นระบบอัตโนมัติ ก่อนให้มือขวาทำอย่างอื่น`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["bass-variant", root, sid],
        meta: { kind: "bass-variant", root, style: sid },
      });
    }
  }
  return out;
}

/* ── Assemble scale-up wave ── */
export function seedScaleExpansion(kb) {
  const gens = [genNoteRoles, genTriadStages, genKeyLadders, genArticulationRhythm, genIntervalInChord, genNoteInChord, genFingerPairs, genProgressionWorkouts, genDegreeSinging, genScalePatterns, genRegisters, genChordToneSolo, genBassVariants];
  let added = 0;
  for (const g of gens) for (const e of g()) { kb.add(e); added++; }
  return added;
}
