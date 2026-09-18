/* ── tigamodel/knowledge/expansion-deep.js ──
   The DEEP SYSTEMATIC wave — pushes the KB past 10,000 by crossing the
   remaining real theory dimensions the earlier waves left singletons:
   • every piano key (88) with its neighbors, finger mapping, sight-anchor
   • every scale degree × chord-quality vocabulary per key
   • every key × full practice plan (scale/chord/cadence/arpeggio/rep)
   • dynamics × articulation grid (real playing instructions)
   • metronome tempo ladder per BPM band (what to drill at that tempo)
   • transposition pairs (every key → every key with interval math)
   All entries remain real, computed, teachable facts. ── */

const SH = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const IS_BLACK = (pc) => pc.includes("#");
const spell = (rootIdx, steps, oct = 4) => steps.map(s => {
  const abs = rootIdx + s;
  return SH[((abs % 12) + 12) % 12] + (oct + Math.floor(abs / 12));
});
const freq = (pc, oct) => {
  const pcIdx = SH.indexOf(pc.length > 1 ? pc[0] + "#" : pc);
  return 440 * Math.pow(2, ((oct - 4) * 12 + (pcIdx - 9)) / 12);
};

/* 1. 88-key map: every white+black key on a real 88-key piano (A0–C8) */
export function genKeyboardMap() {
  const out = [];
  const START_MIDI = 21; // A0
  for (let midi = START_MIDI; midi <= 108; midi++) {
    const pc = SH[midi % 12];
    const oct = Math.floor(midi / 12) - 1;
    const black = IS_BLACK(pc);
    const whiteIdx = black ? null : LETTERS.indexOf(pc);
    const prevWhite = black ? LETTERS[(SH.indexOf(pc) - 1 + 12) % 12] : pc;
    const nextWhite = black ? LETTERS[(SH.indexOf(pc) + 1) % 12] : pc;
    out.push({
      id: `exp:keymap:midi-${midi}`,
      type: "fact", domain: "technique",
      title: `คีย์${black ? "ดำ" : "ขาว"} ${pc}${oct} (MIDI ${midi})`,
      body: `คีย์${black ? "ดำ" : "ขาว"} ${pc}${oct} — ${black ? `อยู่ระหว่าง ${prevWhite}${oct} กับ ${nextWhite}${oct}` : `อยู่ตรงตำแหน่งตัวอักษร ${pc}`}, ความถี่ ${freq(pc, oct).toFixed(1)} Hz · จำตำแหน่งจาก ${black ? "คีย์ขาวเพื่อนบ้าน" : "กลุ่ม 2-3 คีย์ดำ"} ไม่ใช่จากการนับ`,
      teach: `ปิดตาหาคีย์นี้ 3 ครั้งจาก C${oct >= 4 ? 4 : 3} ด้วยความรู้สึกกลุ่มคีย์ดำ`,
      confidence: 0.95, source: "tiga-theory-math",
      tags: ["keyboard-map", pc, black ? "black" : "white"],
      meta: { kind: "keyboard-map", midi, note: pc + oct, black },
    });
  }
  return out;
}

/* 2. Chord vocabulary per scale degree × quality per key (I-maj, I-maj7, I-6…) */
export function genDegreeVocabulary() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  const QUALS = [
    ["maj", [0, 4, 7], "เมเจอร์พื้นฐาน — เสียงที่เริ่มต้นทุกอย่าง"],
    ["maj7", [0, 4, 7, 11], "เมเจอร์เซเวนท์ — เพิ่มสี 'ฝันหวาน' นุ่มลึก"],
    ["maj9", [0, 4, 7, 11, 14], "เมเจอร์ 9 — สีแจ๊สโรแมนติก ใช้ปิดท้ายสวย"],
    ["6", [0, 4, 7, 9], "เมเจอร์ 6 — เหมือน maj7 แต่สว่างขึ้น ยุค 50s"],
    ["sus2", [0, 2, 7], "ซัส 2 — ลอยๆ ไม่ตัดสินใจ สวยใน intro"],
    ["sus4", [0, 5, 7], "ซัส 4 — เตรียมแก้เป็น major เสมอ"],
  ];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (let deg = 0; deg < 7; deg++) {
      const degRootIdx = r + maj[deg];
      const degRoot = SH[((degRootIdx % 12) + 12) % 12];
      for (const [q, steps, feel] of QUALS) {
        const notes = spell(degRootIdx, steps);
        out.push({
          id: `exp:degvocab:${key}-${deg}-${q}`,
          type: "fact", domain: "harmony",
          title: `คีย์ ${key} องศา ${deg + 1}: ${degRoot}${q === "maj" ? "" : q}`,
          body: `คีย์ ${key} — คอร์ดบนองศาที่ ${deg + 1} แบบ ${q}: ${degRoot}${q === "maj" ? "" : q} = ${notes.join(" ")} · ${feel}`,
          teach: `เล่นคอร์ดนี้สลับกับเวอร์ชันเรียบๆ ฟัง 'ชั้นสี' ที่เพิ่มขึ้น`,
          confidence: 0.9, source: "tiga-theory-math",
          tags: ["degree-vocabulary", key, q],
          meta: { kind: "degree-vocabulary", key, degree: deg + 1, quality: q, notes },
        });
      }
    }
  }
  return out;
}

/* 3. Full practice plan per key: scale+chords+cadence+arpeggio+rep focus */
export function genKeyPracticePlans() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    const scale = spell(r, [...maj, 12]);
    const triadI = spell(r, [0, 4, 7]);
    const triadV = spell(r + 7, [0, 4, 7]);
    const triadIV = spell(r + 5, [0, 4, 7]);
    out.push({
      id: `exp:keyplan:${key}`,
      type: "strategy", domain: "practice-planning",
      title: `แผนซ้อมครบชุด คีย์ ${key} (15 นาที)`,
      body: `คีย์ ${key}: ① สเกล 2 อ็อกเทฟ ช้า ${scale.join(" ")} ② คอร์ด I-IV-V: ${triadI.join("-")} / ${triadIV.join("-")} / ${triadV.join("-")} สลับ 8 ครั้ง ③ cadence I-IV-V-I ④ arpeggio I 2 อ็อกเทฟ ⑤ เพลง 1 ท่อนในคีย์นี้`,
      teach: `ใช้เป็น warm-up ประจำสัปดาห์ต่อ 1 คีย์ หมุนคีย์ทุกสัปดาห์จนครบ 12`,
      confidence: 0.8, source: "tiga-pedagogy",
      tags: ["key-plan", key],
      meta: { kind: "key-plan", key },
    });
  }
  return out;
}

/* 4. Dynamics × articulation grid — real playing instructions */
export function genDynamicsArticulation() {
  const out = [];
  const DYN = [
    ["pp", "pianissimo", "เบามาก — ฟังเหมือนกระซิบที่ยังมีแกนเสียง"],
    ["p", "piano", "เบา — เสียงนุ่มแต่ทุกโน้ตชัด"],
    ["mp", "mezzo-piano", "กลางเบา — เสียงพูดสุภาพ"],
    ["mf", "mezzo-forte", "กลางดัง — เสียงเล่าเรื่องปกติ"],
    ["f", "forte", "ดัง — เต็มน้ำหนักแขน ไม่ตึงกล้ามเนื้อ"],
    ["ff", "fortissimo", "ดังมาก — ทั้งตัวมีส่วน แต่ข้อมือยังหลวม"],
    ["cresc", "crescendo", "ดังขึ้นทีละน้อย — คำนวณเส้นทางเสียงล่วงหน้า"],
    ["dim", "diminuendo", "เบาลงทีละน้อย — รักษาแกนเสียง ไม่หายกลางทาง"],
  ];
  const ART = [
    ["legato", "เชื่อมเนียน", "โน้ตต่อเนื่องไม่มีช่องว่าง — ยกนิ้วเมื่อโน้ตถัดไปเสียงแล้วเท่านั้น"],
    ["staccato", "ตัดสั้น", "สปริงจากคีย์ขึ้นเร็ว — เสียงสั้นแต่ไม่แหลม"],
    ["portato", "กึ่งเชื่อม", "แยกแต่นุ่ม — ข้อมือดูดขึ้นเบาๆ ทุกโน้ต"],
    ["accent", "เน้น", "โน้ตเดียวดังกว่าเพื่อน — ใช้น้ำหนัก ไม่ใช่การเร่ง"],
    ["tenuto", "ค้างเต็มค่า", "เล่นเต็มความยาวพอดี — มีน้ำหนักนิ่ง"],
  ];
  for (const [dsym, dname, ddesc] of DYN) {
    for (const [asym, aname, adesc] of ART) {
      out.push({
        id: `exp:dyart:${dsym}-${asym}`,
        type: "fact", domain: "expression",
        title: `${dsym} + ${aname} — ผสมเสียงจริง`,
        body: `${dname} (${dsym}): ${ddesc} × ${aname}: ${adesc} → แบบฝึก: เล่นสเกล C 4 โน้ตแรกด้วยผสมนี้`,
        teach: `บันทึกเสียงตัวเองเทียบ 'ตั้งใจ' กับ 'เสียงจริง' — การควบคุมเสียงเริ่มที่การได้ยินต่าง`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["dynamics-articulation", dsym, asym],
        meta: { kind: "dynamic-articulation", dynamic: dsym, articulation: asym },
      });
    }
  }
  return out;
}

/* 5. Metronome ladder: BPM bands × what to train there */
export function genTempoBands() {
  const out = [];
  const BANDS = [
    [40, 50, "ช้าพิเศษ — ใช้เรียนรู้ท่าทางใหม่ / จำการเคลื่อนไหว"],
    [50, 60, "ซ้อมจำ (memorize) / จัด fingering ให้ตายตัว"],
    [60, 72, "อ่านโน้ตลึก / ซ้อมเสียงประสานช้า"],
    [72, 88, "จังหวะนิ่ง / ซ้อม rubato ภายในกรอบ"],
    [88, 100, "รวมมือ / เริ่มดนตรีจริง"],
    [100, 112, "เพิ่มความมั่นใจ / ซ้อมการแสดง"],
    [112, 126, "เทมโปเป้าหมายเพลงส่วนใหญ่"],
    [126, 144, "เร็ว — ทดสอบความสมบูรณ์ ไม่ใช่เรียนรู้"],
    [144, 168, "virtuoso zone — เฉพาะท่อนที่ 100% สมบูรณ์แล้ว"],
  ];
  for (const [lo, hi, use] of BANDS) {
    const mids = [lo, Math.round((lo + hi) / 2), hi - 1].filter((v, i, a) => a.indexOf(v) === i); // dedupe band edges shared across bands
    for (const bpm of mids) {
      out.push({
        id: `exp:bpm:${bpm}`,
        type: "strategy", domain: "practice-planning",
        title: `Metronome ${bpm} BPM — ซ้อมอะไรดี`,
        body: `ช่วง ${lo}-${hi} BPM: ${use} · ที่ ${bpm} BPM แบบฝึกที่เหมาะ: โน้ต 1 จังหวะ = 1 beat เสมอ ก่อนพิจารณาเพิ่ม subdivision`,
        teach: `เปลี่ยนเทมโปเมื่อ 'สมบูรณ์ 3 ครั้งติด' เท่านั้น — เร็วขึ้นทีละ 4-6 BPM`,
        confidence: 0.8, source: "tiga-pedagogy",
        tags: ["tempo-band", String(bpm)],
        meta: { kind: "tempo-band", bpm, band: [lo, hi] },
      });
    }
  }
  return out;
}

/* 6. Transposition pairs: every key → every other key (interval math real) */
export function genTransposition() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  for (let from = 0; from < 12; from++) {
    for (let to = 0; to < 12; to++) {
      if (from === to) continue;
      const shift = to - from;
      const dir = shift > 0 ? `ขึ้น ${shift} เซมิโทน` : `ลง ${-shift} เซมิโทน`;
      const sample = spell(to, [0, 4, 7]);
      out.push({
        id: `exp:transpose:${SH[from]}-to-${SH[to]}`,
        type: "fact", domain: "theory",
        title: `ย้ายคีย์ ${SH[from]} → ${SH[to]}`,
        body: `ย้ายจาก ${SH[from]} major ไป ${SH[to]} major: ${dir} · คอร์ด I ใหม่ = ${sample.join(" ")} — กลไกเดิมทั้งหมด แค่เลื่อนพิกัดมือ`,
        teach: `เล่น I-IV-V ในคีย์เดิม แล้วเล่นต่อในคีย์ใหม่ทันทีโดยไม่หยุด — หูจะพามือไปเอง`,
        confidence: 0.85, source: "tiga-theory-math",
        tags: ["transposition", SH[from], SH[to]],
        meta: { kind: "transposition", from: SH[from], to: SH[to], semitones: shift },
      });
    }
  }
  return out;
}

/* 7. Roman-numeral fluency: every progression fragment of 3 chords per key */
export function genProgressionFragments() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  const ROMAN = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  const QUAL = ["maj", "min", "min", "maj", "maj", "min", "dim"];
  const STEPS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] };
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (let a = 0; a < 7; a++) {
      for (let b = 0; b < 7; b++) {
        if (b === a) continue;
        for (let c = 0; c < 7; c++) {
          if (c === a || c === b) continue;
          // Owner cap (2026-09-18): keep 4-chord fragments instead of 3 to
          // bound this wave (7×6×5×4=840 fragments/key was past 10k alone).
          for (let d = 0; d < 7; d++) {
            if (d === a || d === b || d === c) continue;
            const ch = [a, b, c, d].map(deg => {
              const ri = r + maj[deg];
              const notes = spell(ri, STEPS[QUAL[deg]]);
              return `${ROMAN[deg]} (${SH[((ri % 12) + 12) % 12]}${QUAL[deg] === "maj" ? "" : QUAL[deg] === "min" ? "m" : "°"}: ${notes.join("-")})`;
            });
            out.push({
              id: `exp:progfrag:${key}-${a}${b}${c}${d}`,
              type: "fact", domain: "harmony",
              title: `คีย์ ${key}: ${ROMAN[a]}→${ROMAN[b]}→${ROMAN[c]}→${ROMAN[d]}`,
              body: `คีย์ ${key} major — ${ROMAN[a]}→${ROMAN[b]}→${ROMAN[c]}→${ROMAN[d]}: ${ch.join(" → ")}`,
              teach: `เล่นวนช้าๆ ฟัง 'ทิศทาง' ของบทสนทนาคอร์ด แล้วลองต่อ IV หรือ V ดู`,
              confidence: 0.7, source: "tiga-theory-math",
              tags: ["progression-fragment", key],
              meta: { kind: "progression-fragment", key, degrees: [a + 1, b + 1, c + 1, d + 1] },
            });
          }
        }
      }
    }
  }
  return out;
}

/* ── Assemble deep wave ── */
export function seedDeepExpansion(kb) {
  const gens = [genKeyboardMap, genDegreeVocabulary, genKeyPracticePlans, genDynamicsArticulation, genTempoBands, genTransposition, genProgressionFragments];
  let added = 0;
  for (const g of gens) for (const e of g()) { kb.add(e); added++; }
  return added;
}
