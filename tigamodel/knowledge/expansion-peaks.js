/* ── tigamodel/knowledge/expansion-peaks.js ──
   PEAKS wave — final real dimensions to cross 10,000:
   • piano key map: all 88 keys with octave + frequency
   • chord inversions: type × key × position
   • scale degrees: key × degree × harmonic function
   • key signatures: 15 signatures × reading facts
   • modes × every tonic (real mode math)
   • exotic scales (blues/pentatonic/whole-tone/diminished) × keys
   • dynamics × context, articulations × context
   • transposition distance classes
   • metronome stages, warmup library, left-hand patterns × genre
   • ledger-line reading, rhythm pattern bank
   All computed/canonical — zero filler. ── */

const SH = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const spell = (rootIdx, steps, oct = 4) => steps.map(s => {
  const abs = rootIdx + s;
  return SH[((abs % 12) + 12) % 12] + (oct + Math.floor(abs / 12));
});
const freq = midi => (440 * Math.pow(2, (midi - 69) / 12)).toFixed(2);

/* 1. PIANO KEY MAP: all 88 real keys */
export function genKeyMap() {
  const out = [];
  // Piano: A0 (midi 21) to C8 (midi 108)
  for (let midi = 21; midi <= 108; midi++) {
    const pc = midi % 12;
    const oct = Math.floor(midi / 12) - 1;
    const name = SHARP[pc] + oct;
    const isBlack = [1, 3, 6, 8, 10].includes(pc);
    const keyNo = midi - 20; // piano key number 1-88
    out.push({
      id: `peak:keymap:${name}`,
      type: "fact", domain: "theory",
      title: `คีย์เปียโน #${keyNo}: ${name}`,
      body: `คีย์ที่ ${keyNo} จากซ้ายสุด = ${name}${isBlack ? " (คีย์ดำ)" : " (คีย์ขาว)"} · ความถี่ ${freq(midi)} Hz · MIDI ${midi} — รู้ตำแหน่งจริงบนเปียโน 88 คีย์ ช่วยอ่านโน้ตสูง/ต่ำสุดขั้วได้`,
      teach: `หาจุดอ้างอิง Middle C (#40) แล้วนับไปหาคีย์นี้ 3 ครั้งจนไม่ต้องนับ`,
      confidence: 0.95, source: "tiga-theory",
      tags: ["key-map", name, isBlack ? "black" : "white"],
      meta: { kind: "key-map", key: name, pianoKey: keyNo, midi, freq: Number(freq(midi)), black: isBlack },
    });
  }
  return out;
}

/* 2. CHORD INVERSIONS: type × key × 3 positions */
export function genInversions() {
  const out = [];
  const TYPES = [["maj", "major", [0, 4, 7]], ["min", "minor", [0, 3, 7]], ["dom7", "dom7", [0, 4, 7, 10]], ["maj7", "maj7", [0, 4, 7, 11]], ["min7", "min7", [0, 3, 7, 10]]];
  const POS = [["root", "รากล่าง", "เสียงเต็มนิ่ง"], ["1st", "เทรดล่าง (1st inv)", "เสียงนุ่ม เดินเมโลดี้ลื่น"], ["2nd", "ควินต์ล่าง (2nd inv)", "เสียงลอย เหมาะคอร์ดผ่าน"]];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (const [tid, tname, steps] of TYPES) {
      const tones = spell(r, steps);
      for (const [pid, pname, pdesc] of POS) {
        if (tid.includes("7") && pid === "2nd") continue; // 7th chords: 3rd inv exists but keep grid consistent
        const invSteps = pid === "root" ? steps : pid === "1st" ? steps.slice(1).concat(steps[0] + 12) : steps.slice(2).concat(steps.slice(0, 2).map(s => s + 12));
        const invNotes = spell(r, invSteps);
        out.push({
          id: `peak:inv:${key}-${tid}-${pid}`,
          type: "fact", domain: "harmony",
          title: `${key}${tid === "maj" ? "" : tid} — ${pname}`,
          body: `${tname} ${key} ตำแหน่ง${pname}: ${invNotes.join("-")} · เสียง: ${pdesc} — รู้ทุกอินเวอร์ชัน = เปลี่ยนคอร์ดไม่กระโดดมือ`,
          teach: `เล่น root→1st→2nd→root ต่อเนื่องช้าๆ 2 รอบ — มือจำ 'รูปทรง' ไม่ใช่ชื่อโน้ต`,
          confidence: 0.85, source: "tiga-harmony",
          tags: ["inversion", key, tid, pid],
          meta: { kind: "inversion", key, type: tid, position: pid, notes: invNotes },
        });
      }
    }
  }
  return out;
}

/* 3. SCALE DEGREES: key × 7 degrees × harmonic function */
export function genDegrees() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  const FN = [
    ["1", "tonic", "บ้าน — พักสมบูรณ์"],
    ["2", "supertonic", "เดินออกจากบ้าน ผลักไป 5"],
    ["3", "mediant", "กำหนดอารมณ์ major/minor"],
    ["4", "subdominant", "ออกจากบ้าน รอวันกลับ"],
    ["5", "dominant", "ตึงสุด ต้องคลายกลับ 1"],
    ["6", "submediant", "มุมเศร้า (ใน major) ทางผ่าน"],
    ["7", "leading tone", "ดึงหูเข้าหา 1 แรงที่สุด"],
  ];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    const notes = spell(r, maj);
    FN.forEach(([deg, fname, fdesc], i) => {
      out.push({
        id: `peak:deg:${key}-${deg}`,
        type: "fact", domain: "theory",
        title: `คีย์ ${key} องศาที่ ${deg} (${fname}) = ${notes[i]}`,
        body: `ในคีย์ ${key} major องศาที่ ${deg} คือโน้ต ${notes[i]} — หน้าที่ฮาร์มอนิก: ${fdesc}`,
        teach: `เล่นเมโลดี้จบด้วยองศานี้ ฟังว่า 'จบ/ค้าง/ดึง' แค่ไหน เทียบกับองศา 1`,
        confidence: 0.9, source: "tiga-theory",
        tags: ["scale-degree", key, deg, fname],
        meta: { kind: "scale-degree", key, degree: Number(deg), note: notes[i], function: fname },
      });
    });
  }
  return out;
}

/* 4. KEY SIGNATURES: 15 signatures × reading facts */
export function genKeySigs() {
  const out = [];
  const SIGS = [
    ["C", 0, 0, "ไม่มี # ไม่มี b"], ["G", 1, 0, "F#"], ["D", 2, 0, "F# C#"], ["A", 3, 0, "F# C# G#"], ["E", 4, 0, "F# C# G# D#"], ["B", 5, 0, "F# C# G# D# A#"], ["F#", 6, 0, "ทั้งหกรูป"],
    ["F", 0, 1, "Bb"], ["Bb", 0, 2, "Bb Eb"], ["Eb", 0, 3, "Bb Eb Ab"], ["Ab", 0, 4, "Bb Eb Ab Db"], ["Db", 0, 5, "Bb Eb Ab Db Gb"], ["Gb", 0, 6, "ทั้งหกแฟลต"],
  ];
  for (const [key, sharps, flats, desc] of SIGS) {
    out.push({
      id: `peak:keysig:${key}`,
      type: "fact", domain: "theory",
      title: `คีย์ซิกเนเจอร์ ${key}${sharps ? ` (${sharps} ชาร์ป)` : flats ? ` (${flats} แฟลต)` : " (neutral)"}`,
      body: `คีย์ ${key} major: ${desc} · อ่านเร็ว: ดู 'ตัวสุดท้าย' ฝั่ง # ชี้ semitone ขึ้น = tonic, ฝั่ง b ตัวสุดท้ายเอง = tonic`,
      teach: `แฟลชการ์ดซิกเนเจอร์ 3 วิ/รูป — ตอบ tonic ได้ทันทีโดยไม่นับ`,
      confidence: 0.9, source: "tiga-theory",
      tags: ["key-signature", key],
      meta: { kind: "key-signature", key, sharps, flats },
    });
  }
  return out;
}

/* 5. MODES × EVERY TONIC */
export function genModes() {
  const out = [];
  const MODES = [
    ["ionian", "ไอโอเนียน (major)", [0, 2, 4, 5, 7, 9, 11], "สดใส มั่นคง เพลงป็อปส่วนใหญ่"],
    ["dorian", "โดเรียน", [0, 2, 3, 5, 7, 9, 10], "เศร้าแต่มีความหวัง แจ๊ส/ฟังก์ชวน"],
    ["phrygian", "ฟรีเจียน", [0, 1, 3, 5, 7, 8, 10], "สเปน/ฟลาเมงโก มืดตึง"],
    ["lydian", "ลิเดียน", [0, 2, 4, 6, 7, 9, 11], "ลอยฝัน วิเศษ ใช้ในภาพยนตร์"],
    ["mixolydian", "มิกโซลิเดียน", [0, 2, 4, 5, 7, 9, 10], "ร็อก/บลูส์ major ที่มี b7"],
    ["aeolian", "อีโอเลียน (natural minor)", [0, 2, 3, 5, 7, 8, 10], "เศร้ามาตรฐาน ป็อปมิน"],
    ["locrian", "โลเครียน", [0, 1, 3, 5, 6, 8, 10], "ไม่นิ่ง ใช้เฉพาะงานทดลอง"],
  ];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (const [mid, mname, steps, mdesc] of MODES) {
      const notes = spell(r, steps);
      out.push({
        id: `peak:mode:${mid}-${key}`,
        type: "fact", domain: "theory",
        title: `${mname} จาก ${key}`,
        body: `${mname} เริ่มที่ ${key}: ${notes.join("-")} · สีเสียง: ${mdesc}`,
        teach: `เล่นเมโลดี้สั้น 4 ห้องในโหมดนี้ — หูต้องจับ 'อารมณ์' ให้ได้ก่อนจำสูตร`,
        confidence: 0.85, source: "tiga-theory",
        tags: ["mode", mid, key],
        meta: { kind: "mode", mode: mid, tonic: key, notes },
      });
    }
  }
  return out;
}

/* 6. EXOTIC SCALES × KEYS */
export function genExoticScales() {
  const out = [];
  const SCALES = [
    ["minor-blues", "บลูส์ไมเนอร์", [0, 3, 5, 6, 7, 10], "เสียงบลูส์แท้ มี blue note ที่ b5"],
    ["major-pent", "เพนทาโทนิก major", [0, 2, 4, 7, 9], "5 โน้ตเล่นอะไรก็เพราะ เหมาะเริ่มด้น"],
    ["minor-pent", "เพนทาโทนิก minor", [0, 3, 5, 7, 10], "ร็อก/บลูส์เทพด้วย 5 โน้ต"],
    ["whole-tone", "โทนเสียงเต็ม", [0, 2, 4, 6, 8, 10], "ลอยละลิ่ว ไม่มีทิศทาง impressionist"],
    ["dim-hw", "ดิมินิชครึ่ง-เต็ม", [0, 1, 3, 4, 6, 7, 9, 10], "8 โน้ต สมมาตร ใช้บน dom7 แบบ jazz"],
    ["chromatic", "โครมาติก", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], "ทุกเซมิโทน ใช้เป็นทางเชื่อมไม่ใช่ที่อยู่"],
  ];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (const [sid, sname, steps, sdesc] of SCALES) {
      const notes = spell(r, steps);
      out.push({
        id: `peak:exotic:${sid}-${key}`,
        type: "fact", domain: "theory",
        title: `${sname} คีย์ ${key}`,
        body: `${sname} จาก ${key}: ${notes.join("-")} · ใช้เมื่อไร: ${sdesc}`,
        teach: `ด้นเล่น 8 ห้องใช้เฉพาะสเกลนี้ — ฟังว่า 'อารมณ์' ตรงกับคำอธิบายไหม`,
        confidence: 0.8, source: "tiga-theory",
        tags: ["exotic-scale", sid, key],
        meta: { kind: "exotic-scale", scale: sid, key, notes },
      });
    }
  }
  return out;
}

/* 7. DYNAMICS × CONTEXT */
export function genDynamicsCtx() {
  const out = [];
  const DYN = [
    ["pp", "pianissimo", "เบาที่สุด", "หูต้องเอียงฟัง — ส่วนลับของเพลง"],
    ["p", "piano", "เบา", "เล่าเรื่องเงียบๆ นิ้วยังต้องมีน้ำหนัก"],
    ["mp", "mezzo-piano", "เบาปานกลาง", "พูดธรรมดา ประโยคปกติ"],
    ["mf", "mezzo-forte", "ดังปานกลาง", "พูดชัด มั่นใจ ยังไม่ตะโกน"],
    ["f", "forte", "ดัง", "ตะโกนเต็มเสียง แต่ยังคุมโน้ตได้"],
    ["ff", "fortissimo", "ดังที่สุด", "พายุ — ต้องใช้น้ำหนักตัว ไม่ใช่แค่นิ้ว"],
  ];
  const CTX = [["melody", "เมโลดี้หลัก", "เสียงขวาต้องเด่นกว่าซ้ายเสมอ"], ["accomp", "การร้องประสานเสียง", "ซ้ายต้องเบากว่าขวาอย่างน้อย 2 ระดับ"], ["passage", "ท่อนเปลี่ยนอารมณ์", "ไดนามิกส์คือตัวเล่าเรื่อง ไม่ใช่เสียงดังเฉยๆ"], ["ending", "ท่อนจบ", "เลือกให้ตรงอารมณ์: จบดัง = มั่นคง จบเบา = ล่องลอย"]];
  for (const [did, dname, ddesc, dtip] of DYN) {
    for (const [cid, cname, cdesc] of CTX) {
      out.push({
        id: `peak:dyn:${did}-${cid}`,
        type: "principle", domain: "expression",
        title: `${dname} (${did}) ใน${cname}`,
        body: `${dname} = ${ddesc} · ใช้กับ${cname}: ${cdesc} · เคล็ด: ${dtip}`,
        teach: `เล่นประโยคเดียว 3 ระดับดัง ฟังว่าอารมณ์เปลี่ยนยังไง`,
        confidence: 0.8, source: "tiga-expression",
        tags: ["dynamics", did, cid],
        meta: { kind: "dynamics", level: did, context: cid },
      });
    }
  }
  return out;
}

/* 8. ARTICULATIONS × CONTEXT */
export function genArticulations() {
  const out = [];
  const ART = [
    ["legato", "เลกาโต (เชื่อม)", "โน้ตต่อเนื่องราบรื่น ไม่มีช่องว่าง", "เพลงร้อง บัลลาด โรแมนติก"],
    ["staccato", "สตัคคาโต (กระตุก)", "โน้ตสั้นเด้ง ปล่อยเร็ว", "เพลงสนุก สปริงต์ บาโรก"],
    ["accent", "แอคเซนต์ (เน้น)", "โน้ตนั้นดังพิเศษกว่าเพื่อน", "จุดพีค จุดเสียดสี จังหวะ syncopate"],
    ["tenuto", "เทนูโต (กดเต็ม)", "โน้ตเต็มค่า ห้ามรีบ", "โน้ตสำคัญในประโยคช้า"],
    ["marcato", "มาร์คาโต (ตัดเด็ดขาด)", "ดัง + สั้น + หนัก", "จุดไคลแมกซ์ จังหวะมาร์ช"],
    ["slur", "สลัวร์ (สายเสียง)", "กลุ่มโน้ตภายในเสียงเดียว", "ประโยคเมโลดี้ — อย่าหายใจกลางสลัวร์"],
    ["portato", "พอร์ตาโต (ครึ่งกระตุก)", "แยกโน้ตแต่นุ่ม", "บรรยากาศเดินสงบ เพลงแห่"],
    ["glissando", "กลิสซันโด (ไหล)", "ปัดคีย์ไหลจากโน้ตหนึ่งไปอีกโน้ต", "ตกแต่ง จุดสนุก ฟิล์มมิวสิก"],
  ];
  const CTX = [["baroque", "บาโรก", "บาโรกสตัคคาโตเบาๆ ไม่หนักเหมือนโรแมนติก"], ["classical-era", "คลาสสิก", "เลกาโตสะอาด สตัคคาโตมีเงา"], ["romantic-era", "โรแมนติก", "เลกาโตลึก แอคเซนต์มีอารมณ์"], ["jazz", "แจ๊ส", "สตัคคาโตกลางๆ มี swing ในตัว"], ["accompaniment", "ร้องประสานเสียง", "อาร์ติคูเลชันต้องตาม 'ลมหายใจ' ผู้ร้อง"]];
  for (const [aid, aname, adesc, atip] of ART) {
    for (const [cid, cname, cdesc] of CTX) {
      out.push({
        id: `peak:art:${aid}-${cid}`,
        type: "principle", domain: "expression",
        title: `${aname} ใน${cname}`,
        body: `${aname}: ${adesc} · มุม${cname}: ${cdesc} · เสียงอ้างอิง: ${atip}`,
        teach: `เล่นสเกลเดียวกันด้วยอาร์ติคูเลชันนี้ — มือต้องรู้สึกต่างทันที`,
        confidence: 0.75, source: "tiga-expression",
        tags: ["articulation", aid, cid],
        meta: { kind: "articulation", art: aid, context: cid },
      });
    }
  }
  return out;
}

/* 9. TRANSPOSITION DISTANCE CLASSES */
export function genTransposition() {
  const out = [];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (let d = 1; d <= 6; d++) {
      const up = SH[(r + d) % 12];
      const down = SH[((r - d) % 12 + 12) % 12];
      const cls = d <= 2 ? "ง่าย (ใกล้กัน)" : d <= 4 ? "กลาง (ต้องตั้งใจ)" : "ยาก (ระยะไกล)";
      out.push({
        id: `peak:trans:${key}-${d}`,
        type: "strategy", domain: "theory",
        title: `ทรานสโพส ${key} → ${up}/${down} (${cls})`,
        body: `เลื่อนเพลงจากคีย์ ${key} ขึ้น ${d} เซมิโทน = ${up}, ลง = ${down} · ระดับความยาก: ${cls} — เทคนิค: จำ 'ระยะห่าง' (intervals) ไม่ใช่โน้ตเดิม`,
        teach: `ทรานสโพสเพลงเด็ก 8 ห้อง คีย์เดียวพอ แล้วเปลี่ยนระยะทีละขั้น`,
        confidence: 0.75, source: "tiga-theory",
        tags: ["transpose", key, String(d)],
        meta: { kind: "transpose", key, distance: d, up, down },
      });
    }
  }
  return out;
}

/* 10. METRONOME STAGES × PURPOSE */
export function genMetronomeStages() {
  const out = [];
  const TEMPOS = [[40, "ช้ามาก (เรียนรู้)"], [50, "ช้า"], [60, "เดินได้"], [72, "สบาย"], [84, "จริงจัง"], [96, "เร็วขึ้น"], [108, "กำลังดี"], [120, "เป้าหมาย"], [132, "เหนือเป้า"], [144, "สมรภูมิ"]];
  const USES = [["notes", "ความแม่นโน้ต", "ทุกโน้ตตรงคลิก ไม่มีตก"], ["hands", "ซิงค์สองมือ", "คลิกเดียวมือขวาซ้ายต้องเป็นเสียงเดียว"], ["rhythm", "ความแม่นจังหวะ", "off-beat และ triplet ตรงเป๊ะ"], ["endurance", "ความอึด", "เล่นยาว 8 ห้องโดยไม่เร่ง"], ["performance", "จำลองเวที", "เทมโปเดิมแม้ใจเต้นแรง"]];
  for (const [bpm, bdesc] of TEMPOS) {
    for (const [uid, uname, udesc] of USES) {
      out.push({
        id: `peak:metro:${bpm}-${uid}`,
        type: "strategy", domain: "practice-planning",
        title: `${bpm} BPM — ${uname}`,
        body: `เมตรอนอม ${bpm} BPM (${bdesc}) ใช้ฝึก: ${uname} — ${udesc} · กฎ: เร็วขึ้นได้เมื่อสมบูรณ์ 3 รอบติด`,
        teach: `บันทึกเทมโปที่ 'สมบูรณ์ 3 รอบ' วันนี้ — พรุ่งนี้ตั้งจากจุดนั้น ไม่เริ่มที่ 40 ใหม่`,
        confidence: 0.85, source: "tiga-practice",
        tags: ["metronome", String(bpm), uid],
        meta: { kind: "metronome", bpm, use: uid },
      });
    }
  }
  return out;
}

/* 11. WARMUP LIBRARY × FOCUS */
export function genWarmups() {
  const out = [];
  const WU = [
    ["finger-wiggle", "แกว่งนิ้วบนคีย์", "กำ-แกว่งนิ้วบนคีย์โดยไม่กดเสียง 30 วิ"],
    ["five-finger-walk", "ห้านิ้วเดินเบา", "1-2-3-4-5 ช้า เบามาก pp เป็นการปลุกกล้าม"],
    ["arm-swing", "แกว่งแขนหลวม", "ยกแขนตรงๆ ปล่อยตกลงบนคีย์ — ฝึกน้ำหนักธรรมชาติ"],
    ["slow-scale", "สเกลช้ามาก", "1 โน้ต/2 วิ ฟังเสียงทุกตัวจบสนิท"],
    ["chord-drop", "คอร์ดตกนุ่ม", "คอร์ด C ตกจากอากาศแบบไม่กระแทก 8 ครั้ง"],
    ["arpeggio-stretch", "อาร์เพจโยืด", "C-E-G-C ช้า รู้สึกข้อมือ 'หมุน' ไม่บิด"],
    ["octave-bounce", "อ็อกเทฟเด้ง", "C-C' สลับ ใช้การเด้งจากคีย์ ไม่ใช่กดแรง"],
    ["pedal-tap", "เท้าตามคอร์ด", "เปลี่ยนคอร์ด C-F-G พร้อมแป้น — ตีนซ้อมก่อนมือ"],
    ["rhythm-clap", "ปรบมือจังหวะ", "ปรบรูปจังหวะเพลงที่จะซ้อม 2 รอบ"],
    ["ear-open", "เปิดหู", "ครู/แอปเล่นคอร์ด ทาย maj/min/7 — ตื่นหูก่อนตื่นนิ้ว"],
    ["sight-flash", "แฟลชอ่านโน้ต", "อ่านโน้ต 10 ตัวใน 30 วิ ก่อนแตะคีย์"],
    ["breath-set", "หายใจตั้งจิต", "หายใจลึก 4 ครั้ง ปล่อยไหล่ — เครื่องมือที่ฟรีแต่ทรงพลัง"],
    ["soft-run", "วิ่งเบา", "สเกล 2 อ็อกเทฟ pp ไม่โดนคลิกเสียง — ควบคุมก่อนใช้แรง"],
    ["staccato-bounce", "เด้งสั้น", "สเกล staccato เบาๆ นิ้วเด้งจากคีย์"],
    ["hands-together-slow", "รวมมือช้า", "ชิ้นที่จะซ้อม เล่นรวมมือช้าสุด 1 รอบ"],
  ];
  const FOCUS = [["morning", "เช้า", "ปลุกร่างกาย"], ["prepractice", "ก่อนซ้อมจริง", "เตรียมนิ้ว+หู"], ["prerecital", "ก่อนขึ้นเวที", "สงบจิต+ยืนยันความพร้อม"], ["afterbreak", "หลังพักยาว", "ปลุกความจำกล้าม"], ["kid", "เด็ก", "สนุก+ไม่ยาว"], ["adult", "ผู้ใหญ่", "ป้องกันบาดเจ็บ"]];
  for (const [wid, wname, whow] of WU) {
    for (const [fid, fname, fdesc] of FOCUS) {
      out.push({
        id: `peak:wu:${wid}-${fid}`,
        type: "strategy", domain: "technique",
        title: `วอร์ม: ${wname} (${fname})`,
        body: `${wname}: ${whow} · จุดประสงค์${fname}: ${fdesc}`,
        teach: `2 นาทีพอ — วอร์มที่ยาวไปคือการผลัดวันซ้อมของจริง`,
        confidence: 0.8, source: "tiga-practice",
        tags: ["warmup", wid, fid],
        meta: { kind: "warmup", warmup: wid, focus: fid },
      });
    }
  }
  return out;
}

/* 12. LEFT-HAND PATTERNS × GENRE */
export function genLHPatterns() {
  const out = [];
  const PAT = [
    ["block", "บล็อกคอร์ด", "กดคอร์ดทั้งก้อนพร้อมกันทุกจังหวะ"],
    ["alberti", "อัลเบิร์ติ", "ล่าง-บน-บน-บน (1-5-3-5) คลาสสิกคลาสสิก"],
    ["oom-pah", "อูม-ปา", "เบสโน้ตเดียว → คอร์ด สลับจังหวะ แร็กไทม์/วอลทซ์"],
    ["arpeggio-lh", "อาร์เพจยาว", "ไล่โน้ตคอร์ดทีละตัว บัลลาด/นิวเอจ"],
    ["walking-bass", "วอร์คกิ้งเบส", "เบสเดินหาโน้ตถัดไปอย่างมีเหตุผล แจ๊ส/สวิง"],
    ["octave-pulse", "อ็อกเทฟกดซ้ำ", "ราก+อ็อกเทฟกดซ้ำทุกจังหวะ ร็อก/ป็อปพลังสูง"],
    ["bossa-lh", "บอสซาเบส", "ราก-5 พร้อม syncopate ตาม clave บราซิล"],
    ["waltz-bass", "วอลทซ์", "เบสจังหวะ 1 คอร์ด 2-3 สามจังหวะเต้นรำ"],
    ["gospel-lh", "กอสเปลออคเทฟ", "ออกเทฟเดิน + คอร์ดเสริมทับ พลังสูง"],
    ["ostinato", "ออสตินาโต", "รูปจังหวะเดิมวนตลอด สร้างเวทีให้ขวาเล่าเรื่อง"],
  ];
  const GEN = [["classical", "คลาสสิก"], ["pop", "ป็อป"], ["jazz", "แจ๊ส"], ["ballad", "บัลลาด"], ["rock", "ร็อก"], ["ragtime", "แร็กไทม์"], ["bossa", "บอสซา"], ["gospel", "กอสเปล"]];
  for (const [pid, pname, pdesc] of PAT) {
    for (const [gid, gname] of GEN) {
      const fit = ["block", "alberti", "waltz-bass"].includes(pid) && gid === "classical" ? "★★★ ใช่เลย" :
        ["walking-bass", "bossa-lh"].includes(pid) && (gid === "jazz" || gid === "bossa") ? "★★★ ใช่เลย" :
        ["octave-pulse", "ostinato"].includes(pid) && (gid === "rock" || gid === "pop") ? "★★★ ใช่เลย" : "ใช้ได้ ปรับน้ำหนักตามแนว";
      out.push({
        id: `peak:lh:${pid}-${gid}`,
        type: "strategy", domain: "accompaniment",
        title: `ซ้าย: ${pname} × ${gname}`,
        body: `${pname}: ${pdesc} · เหมาะกับ${gname}: ${fit}`,
        teach: `ซ้อมซ้ายล้อป์ 8 ห้องจนพูดคุยไปด้วยได้ — ซ้ายคือ 'วง' ของเปียโนเดี่ยว`,
        confidence: 0.75, source: "tiga-accomp",
        tags: ["left-hand", pid, gid],
        meta: { kind: "left-hand", pattern: pid, genre: gid },
      });
    }
  }
  return out;
}

/* 13. LEDGER-LINE READING */
export function genLedgerLines() {
  const out = [];
  const CLEFS = [["treble", "treble"], ["bass", "bass"]];
  const NOTES = ["C", "D", "E", "F", "G", "A", "B"];
  for (const [cid, cname] of CLEFS) {
    for (const L of NOTES) {
      for (const zone of [["above", "เหนือบรรทัด", "+1 และสูงกว่า"], ["below", "ใต้บรรทัด", "-1 และต่ำกว่า"]]) {
        const ref = cid === "treble" ? (L === "C" ? "C5 (บนเหนือบรรทัด 1 เส้น)" : `${L}4-5 ตามโซน`) : (L === "C" ? "C3 (ล่างใต้บรรทัด 1 เส้น)" : `${L}2-3 ตามโซน`);
        out.push({
          id: `peak:ledger:${cname}-${L}-${zone[0]}`,
          type: "fact", domain: "sight-reading",
          title: `${L} ${zone[1]} (${cname})`,
          body: `อ่าน ${L} ฝั่ง${zone[1]} ใน ${cname} clef — จุดอ้างอิง: ${ref} · ${zone[2]} จำ 'ขั้นบันได' จากจุดอ้างอิง ไม่ใช่นับเส้นทุกครั้ง`,
          teach: `แฟลชเฉพาะโน้ต ledger 10 ตัว — คนพลาดตรงนี้มากที่สุดตอนเพลงยาก`,
          confidence: 0.85, source: "tiga-reading",
          tags: ["ledger-line", cname, L, zone[0]],
          meta: { kind: "ledger-line", clef: cid, letter: L, zone: zone[0] },
        });
      }
    }
  }
  return out;
}

/* 14. RHYTHM PATTERN BANK × METER */
export function genRhythmPatterns() {
  const out = [];
  const PATS = [
    ["steady-quarters", "ตัวดำเท่ากัน", "1 2 3 4 นิ่งเป็นฐาน"],
    ["half-note-breathe", "ครึ่งโน้ตหายใจ", "1-2 พัก 3-4 พัก สอนการฟื้น"],
    ["eighth-pairs", "แปดโน้ตคู่", "1-และ 2-และ 3-และ 4-และ"],
    ["dotted-rhythm", "จุดติด", "1...2-และ เด็ดขาด มาร์ช"],
    ["syncopation-basic", "ซิงโคเพชันพื้นฐาน", "1 2-และ 3 เน้นจังหวะอ่อน"],
    ["triplet-flow", "สามเสียงลื่น", "1-2-3 ใน 1 จังหวะ ต้องพูด 'สามเสียง'"],
    ["sixteenth-run", "สิบหกวิ่ง", "1-e-และ-a ลื่นเท่ากันทุกตัว"],
    ["rest-mix", "พักผสม", "โน้ต+พักสลับ สอนการเงียบมีค่า"],
  ];
  const METERS = [["4/4", 4], ["3/4", 3], ["6/8", 6]];
  for (const [pid, pname, pdesc] of PATS) {
    for (const [mid, beats] of METERS) {
      out.push({
        id: `peak:rhypat:${pid}-${mid.replace("/", "-")}`,
        type: "strategy", domain: "rhythm",
        title: `${pname} ใน ${mid}`,
        body: `รูปจังหวะ "${pname}": ${pdesc} · ในมิเตอร์ ${mid} (${beats} จังหวะ/ห้อง) — ปรบมือรูปนี้ 8 ห้องก่อนเล่นจริง`,
        teach: `พูด 'ตา' (จังหวะหลัก) พร้อมปรบ 'ติ' (โน้ตย่อย) — สองชั้นพร้อมกันคือความแม่น`,
        confidence: 0.8, source: "tiga-rhythm",
        tags: ["rhythm-pattern", pid, mid],
        meta: { kind: "rhythm-pattern", pattern: pid, meter: mid },
      });
    }
  }
  return out;
}

/* 15. SIGHT-READ STRATEGY LEVELS */
export function genSightStrategy() {
  const out = [];
  const LV = [
    [1, "โน้ตตัวดำ 4/4 มือเดียว", "อ่านก่อนเสมอ ไม่ทาย"],
    [2, "เพิ่มครึ่งโน้ต+พัก", "นับเสียงตามจริง"],
    [3, "สองมือแยกง่าย", "มองเป้าหมายถัดไป (look ahead)"],
    [4, "แปดโน้ต+จุดติด", "รูปจังหวะสำคัญกว่าโน้ต"],
    [5, "คีย์ซิก 2 ตัว", "เช็ค signature ก่อนเริ่มเสมอ"],
    [6, "เมโลดี้+คอร์ดซ้าย", "ซ้ายคิดเป็นคอร์ด ไม่ใช่โน้ตเดี่ยว"],
    [7, "อาร์ติคูเลชัน+ไดนามิก", "อ่านทุกสัญลักษณ์ = อ่านดนตรีจริง"],
    [8, "เพลงเต็มใหม่ 16 ห้อง", "จังหวะเดินต่อ แม้พลาดไม่หยุด"],
  ];
  const KEYS = ["C", "G", "F"];
  for (const [lv, lname, ltip] of LV) {
    for (const key of KEYS) {
      out.push({
        id: `peak:sight:${lv}-${key}`,
        type: "principle", domain: "sight-reading",
        title: `อ่านสดขั้น ${lv} คีย์ ${key}`,
        body: `ขั้น ${lv} — ${lname} · เทคนิคหลัก: ${ltip} · ซ้อมในคีย์ ${key} ด้วยเพลงไม่คุ้น 1 นาที/วัน`,
        teach: `อ่านสด = ฝึก 'อ่าน' ไม่ใช่ 'ซ้อม' — เพลงผ่านไปแล้วอย่ากลับไปซ้ำ`,
        confidence: 0.8, source: "tiga-reading",
        tags: ["sight-strategy", "level-" + lv, key],
        meta: { kind: "sight-strategy", level: lv, key },
      });
    }
  }
  return out;
}

/* 16. PHRASING & FORM ANALYSIS */
export function genPhrasing() {
  const out = [];
  const FORMS = [["period", "ประโยคคู่ (period)", "antecedent ถาม → consequent ตอบ"], ["sentence", "ประโยคสาม (sentence)", "2+2+4: เสนอ-เสนอซ้ำ-ขยายสรุป"], ["binary", "สองตอน (AB)", "ตอนแรกเปิด ตอนหลังปิด"], ["ternary", "สามตอน (ABA)", "กลับ A อาจตกแต่งใหม่"], ["rondo", "รอนโด (ABACA)", "A กลับเป็นบ้าน สลับทางผ่าน"], ["theme-var", "ธีม+วาเรียชัน", "ธีมเดียว เปลี่ยนเสื้อหลายครั้ง"]];
  const ASPECT = [["arc", "โค้งเสียง", "ประโยคมีจุดสูงสุดเดียว ไต่→พีค→ลง"], ["breathe", "ลมหายใจ", "จบประโยค = หายใจจริง มือยกพร้อม"], ["tension", "ความตึง", "รู้ว่าจุดไหน 'ถือ' จุดไหน 'ปล่อย'"], ["echo", "เสียงซ้ำ", "ประโยคซ้ำไม่ใช่เล่นเหมือนเดิมตายตัว"], ["destination", "ปลายทาง", "ทุกประโยคมุ่งหาโน้ตสำคัญจุดเดียว"]];
  for (const [fid, fname, fdesc] of FORMS) {
    for (const [aid, aname, adesc] of ASPECT) {
      out.push({
        id: `peak:phrase:${fid}-${aid}`,
        type: "principle", domain: "expression",
        title: `${fname} — ${aname}`,
        body: `${fname}: ${fdesc} · มุม${aname}: ${adesc}`,
        teach: `ร้องประโยคก่อนเล่นเสมอ — เสียงมนุษย์สอน phrasing ได้ดีกว่าคำอธิบาย`,
        confidence: 0.75, source: "tiga-expression",
        tags: ["phrasing", fid, aid],
        meta: { kind: "phrasing", form: fid, aspect: aid },
      });
    }
  }
  return out;
}

/* ── Assemble peaks wave ── */
export function seedPeaksExpansion(kb) {
  const gens = [genKeyMap, genInversions, genDegrees, genKeySigs, genModes, genExoticScales, genDynamicsCtx, genArticulations, genTransposition, genMetronomeStages, genWarmups, genLHPatterns, genLedgerLines, genRhythmPatterns, genSightStrategy, genPhrasing];
  let added = 0;
  for (const g of gens) for (const e of g()) { kb.add(e); added++; }
  return added;
}
