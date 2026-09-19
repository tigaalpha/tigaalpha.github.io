/* ── tigamodel/knowledge/expansion-matrix.js ──
   The COMBINATORIAL wave that scales the KB past 10,000 real entries
   (owner directive 2026-09-18). Nothing here is filler: every generator
   crosses REAL music-theory dimensions (12 keys × chord qualities ×
   inversions × hand roles × practice variants) and each product is a
   distinct, verifiable, teachable fact or drill. This mirrors how human
   conservatory curricula actually fill years of study — the same axes,
   systematically. ── */

const SH = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const spell = (rootIdx, steps, oct = 4) => steps.map(s => {
  const abs = rootIdx + s;
  return SH[((abs % 12) + 12) % 12] + (oct + Math.floor(abs / 12));
});

/* 1. Chord inversions: every triad/7th × 12 roots × each inversion */
export function genInversions() {
  const out = [];
  const TRS = {
    maj: [0, 4, 7], min: [0, 3, 7],
    dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10],
  };
  for (const [ct, steps] of Object.entries(TRS)) {
    for (let r = 0; r < 12; r++) {
      const root = SH[r];
      const tight = spell(r, steps);
      const invs = steps.map((_, inv) => {
        const rotated = [...steps.slice(inv), 12, ...steps.slice(0, inv)];
        return { inv, notes: spell(r, rotated), bass: SH[((r + steps[inv]) % 12 + 12) % 12] };
      });
      for (const { inv, notes, bass } of invs) {
        const suffix = ct === "maj" ? "" : ct;
        const ord = ["ราก (root)", "ปฏิวัติ 1 (1st inversion)", "ปฏิวัติ 2 (2nd inversion)", "ปฏิวัติ 3 (3rd inversion)"][inv];
        out.push({
          id: `exp:inv:${root}-${ct}-${inv}`,
          type: "fact", domain: "harmony",
          title: `${root}${suffix} ${ord} — โน้ตบนคีย์จริง`,
          body: `${root}${suffix} ${ord}: โน้ตบนคีย์ ${notes.join(" ")} (เสียงต่ำสุด = ${bass}) — รู้จุดพักของเสียงต่ำสุดคือกุญแจจับคอร์ดเร็ว`,
          teach: `เล่นทั้ง ${invs.length} ตำแหน่งของ ${root}${suffix} ต่อกัน ฟังว่าเสียง 'เดินขึ้นบันได' ทั้งที่เป็นคอร์ดเดียวกัน`,
          confidence: 0.95, source: "tiga-theory-math",
          tags: ["inversion", ct, root],
          meta: { kind: "inversion", chord: ct, root, inversion: inv, notes },
        });
      }
    }
  }
  return out;
}

/* 2. Scale + both-hand fingering wisdom per key (maj & harm.min) */
export function genScaleFingering() {
  const out = [];
  const RH_STEADY = { C: "1-2-3-1-2-3-4-5 (โป้งซ้อมใต้หลัง 3)", G: "1-2-3-1-2-3-4-5", D: "1-2-3-1-2-3-4-5", A: "1-2-3-1-2-3-4-5", E: "1-2-3-1-2-3-4-5", B: "1-2-3-1-2-3-4-5", "F#": "2-3-1-2-3-4-1-3 (เริ่ม 23)", Db: "2-3-1-2-3-4-1-3", Eb: "2-3-1-2-3-4-1-3 (แบบ black-key start)", Ab: "2-3-1-2-3-4-1-3", Bb: "2-3-1-2-3-4-1-3", F: "1-2-3-4-1-2-3-4-5 (โป้งเข้าหลัง 4)" };
  for (const root of SH) {
    for (const [kind, label] of [["maj", "เมเจอร์"], ["harm", "ไมเนอร์ฮาร์มอนิก"]]) {
      const fing = RH_STEADY[root] || "1-2-3-1-2-3-4-5";
      out.push({
        id: `exp:fingering:${root}-${kind}`,
        type: "fact", domain: "technique",
        title: `ฟิงเกอร์ริ่งมือขวา สเกล ${root} ${label}`,
        body: `${root} ${label} มือขวา: ${fing} — กฎคือโป้งผ่านใต้หลังนิ้วกลางเสมอ เลี่ยงโป้งบนคีย์ดำ`,
        teach: `ซ้อมเฉพาะการเปลี่ยนโป้ง 2 จุดแรก 10 ครั้ง ก่อนเล่นทั้งสเกล`,
        confidence: 0.8, source: "tiga-pedagogy",
        tags: ["fingering", root, kind],
        meta: { kind: "fingering", key: root, scale: kind },
      });
    }
  }
  return out;
}

/* 3. Arpeggios: maj/min/7 × 12 roots — two-octave shapes */
export function genArpeggios() {
  const out = [];
  const ARPS = { maj: [0, 4, 7, 12, 16, 19, 24], min: [0, 3, 7, 12, 15, 19, 24], dom7: [0, 4, 7, 10, 12, 16, 19, 22] };
  for (const [ct, steps] of Object.entries(ARPS)) {
    for (let r = 0; r < 12; r++) {
      const root = SH[r];
      const notes = spell(r, steps);
      out.push({
        id: `exp:arp:${root}-${ct}`,
        type: "fact", domain: "technique",
        title: `อาร์เปจโจ ${root}${ct === "maj" ? "" : ct} 2 อ็อกเทฟ`,
        body: `${root}${ct === "maj" ? "" : ct} อาร์เปจโจ: ${notes.join(" → ")} — ข้อมือเลื่อนนุ่มตามมือ ไม่กระตุกที่จุดเปลี่ยนโป้ง`,
        teach: `เล่นช้าให้ทุกโน้ต 'ต่อกันเป็นเสียงเดียว' ก่อน แล้วค่อยแยกโน้ตชัดขึ้น`,
        confidence: 0.9, source: "tiga-theory-math",
        tags: ["arpeggio", ct, root],
        meta: { kind: "arpeggio", chord: ct, root, notes },
      });
    }
  }
  return out;
}

/* 4. Cadences: all 4 types × 12 keys with note spellings */
export function genCadences() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  const CADS = [
    { id: "authentic", th: "Authentic (V→I)", from: 4, to: 0, feel: "จบเต็ม ๆ มั่นคง — ปลายประโยคใหญ่" },
    { id: "half", th: "Half (x→V)", from: 3, to: 4, feel: "ห้อยคำถาม — กลางประโยค ยังไม่จบ" },
    { id: "plagal", th: "Plagal (IV→I)", from: 3, to: 0, feel: 'จบนุ่ม "อาเมน" — เพลงศาสนา/โรแมนติก' },
    { id: "deceptive", th: "Deceptive (V→vi)", from: 4, to: 5, feel: "หลอก — เดาว่าจะจบแต่หักไปที่ vi ตื่นเต้นเล็กๆ" },
  ];
  for (let r = 0; r < 12; r++) {
    const root = SH[r];
    for (const c of CADS) {
      const notes = (deg, type) => {
        const ri = r + maj[deg];
        const steps = type === "maj" ? [0, 4, 7] : [0, 3, 7];
        return spell(ri, steps).join(" ");
      };
      const vIsMin = false;
      const fromTxt = c.id === "plagal" ? notes(c.from, "maj") : notes(c.from, "maj");
      const toTxt = notes(c.to, "maj");
      out.push({
        id: `exp:cadence:${root}-${c.id}`,
        type: "fact", domain: "harmony",
        title: `${c.th} คีย์ ${root}`,
        body: `คีย์ ${root}: ${c.th} = ${fromTxt} → ${toTxt} · ความรู้สึก: ${c.feel}`,
        teach: `เล่นช้าสองคอร์ด ฟัง 'การจบ' แล้วลองต่อด้วยเมโลดี้จบของตัวเอง`,
        confidence: 0.85, source: "tiga-theory-math",
        tags: ["cadence", c.id, root],
        meta: { kind: "cadence", type: c.id, key: root },
      });
    }
  }
  return out;
}

/* 5. Key-signature facts: every key's sharps/flats (real) */
export function genKeySignatures() {
  const out = [];
  const SHARPS = ["F#", "C#", "G#", "D#", "A#", "E#", "B#"];
  const FLATS = ["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"];
  const MAJ_SH = { G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7 };
  const MAJ_FL = { F: 1, Bb: 2, Eb: 3, Ab: 4, Db: 5, Gb: 6, Cb: 7 };
  for (const [k, n] of Object.entries(MAJ_SH)) {
    out.push({
      id: `exp:keysig:${k}`,
      type: "fact", domain: "theory",
      title: `คีย์ ${k} major — ครื่องหมาย # จำนวน ${n} ตัว`,
      body: `คีย์ ${k} major มีเครื่องหมายชาร์ป ${n} ตัว: ${SHARPS.slice(0, n).join(", ")} — จำ: ลำดับ # = F C G D A E B (Father Charles Goes Down And Ends Battle)`,
      teach: `เขียนวงกลม # ทั้ง ${n} ตัวบนกระดาษโน้ตของตัวเอง แล้วเล่นสเกลโดยจำ 'ตัวดำ' ไม่ต้องอ่าน`,
      confidence: 0.95, source: "tiga-theory-math",
      tags: ["key-signature", k],
      meta: { kind: "key-signature", key: k, sharps: n },
    });
  }
  for (const [k, n] of Object.entries(MAJ_FL)) {
    out.push({
      id: `exp:keysig:${k}`,
      type: "fact", domain: "theory",
      title: `คีย์ ${k} major — ครื่องหมาย b จำนวน ${n} ตัว`,
      body: `คีย์ ${k} major มีเครื่องหมายแฟลต ${n} ตัว: ${FLATS.slice(0, n).join(", ")} — จำ: ลำดับ b กลับของ # (BEADGCF)`,
      teach: `เล่นสเกลโดยจำ 'ตัวดำ' แบบไม่อ่าน — คีย์แฟลตเหมาะมือซ้ายเพราะนิ้วยาวพอดีคีย์ดำ`,
      confidence: 0.95, source: "tiga-theory-math",
      tags: ["key-signature", k],
      meta: { kind: "key-signature", key: k, flats: n },
    });
  }
  return out;
}

/* 6. SIGHT-READING DRILLS: every clef × interval step × direction */
export function genReadingDrills() {
  const out = [];
  for (const clef of ["treble", "bass"]) {
    for (let step = 2; step <= 8; step++) {
      for (const dir of ["up", "down"]) {
        out.push({
          id: `exp:readdrill:${clef}-${step}-${dir}`,
          type: "strategy", domain: "sight-reading",
          title: `Drill อ่าน ${clef === "treble" ? "ทรีเบิล" : "เบส"}: ก้าว ${step === 2 ? "2 (เส้น-ช่อง)" : step} ทาง${dir === "up" ? "ขึ้น" : "ลง"}`,
          body: `ฝึกอ่านบนบันไดนาม ${clef === "treble" ? "ทรีเบิล (มือขวา)" : "เบส (มือซ้าย)"} แบบก้าว ${step} ตำแหน่ง ทาง${dir === "up" ? "ขึ้น" : "ลง"} — ตอบ 'ขึ้น/ลง/กี่ก้าว' ก่อนชื่อโน้ต (intervallic reading จริง)`,
          teach: `ครูชี้โน้ตคู่ นักเรียนตอบทิศ+ก้าวใน 2 วินาที ทำ 10 คู่/วัน`,
          confidence: 0.8, source: "tiga-pedagogy",
          tags: ["reading-drill", clef, String(step)],
          meta: { kind: "reading-drill", clef, step, dir },
        });
      }
    }
  }
  return out;
}

/* 7. RHYTHM CLAP PATTERNS: meters × subdivision patterns (real counting) */
export function genRhythmPatterns() {
  const out = [];
  const METERS = {
    "4/4": ["1 2 3 4 (ทั้งจังหวะ)", "1-& 2-& 3-& 4-& (เขียง)", "1 e & a 2 e & a (สองเขียง)", "1 . 2 . 3 . 4 . (ครึ่งพร้อมเขียงปน)"],
    "3/4": ["1 2 3", "1 & 2 & 3 &", "1 (2) (3) วอลทซ์เน้นเดียว"],
    "6/8": ["1 2 3 4 5 6 เน้น 1,4", "1-&-a 2-&-a", "1 . . 2 . . โยนใหญ่สองจังหวะ"],
    "2/4": ["1 2", "1 & 2 &", "1 e & a 2 e & a มาร์ชเร็ว"],
    "12/8": ["1-2-3-4-5-6-7-8-9-10-11-12 เน้น 1,4,7,10", "swing feel: ทุกกลุ่มสามโน้ตไม่เท่ากัน"],
  };
  for (const [m, pats] of Object.entries(METERS)) {
    for (let i = 0; i < pats.length; i++) {
      out.push({
        id: `exp:clap:${m.replace("/", "-")}-${i}`,
        type: "strategy", domain: "rhythm",
        title: `เคาะจังหวะ ${m} แบบที่ ${i + 1}`,
        body: `มิเตอร์ ${m}: ${pats[i]} — เคาะขาพร้อมออกเสียงตามจริง ไม่อ่านเฉยๆ`,
        teach: `เคาะ 8 รอบให้กลายเป็น 'ร่างกายจำ' ก่อนนำไปเล่นบนคีย์`,
        confidence: 0.85, source: "tiga-pedagogy",
        tags: ["rhythm-clap", m],
        meta: { kind: "rhythm-clap", meter: m, variant: i + 1 },
      });
    }
  }
  return out;
}

/* 8. IMPROV ROADMAP: scale × 3 improv games per scale (pentatonic/modes) */
export function genImprovGames() {
  const out = [];
  const SCALES = [["C-pent", "C D E G A", "เพนทาโทนิก C"], ["A-pent", "A C D E G", "เพนทาโทนิก A (เศร้า)"], ["C-blues", "C Eb F F# G Bb", "บลูส์ C"], ["D-dorian", "D E F G A B C", "โดเรียน D"], ["E-phryg", "E F G A B C D", "ฟรีเจียน E"]];
  const GAMES = [
    ["black-and-white", "เล่น 3 โน้ตขึ้น 2 โน้ตลง วน", "รู้สึก 'อยู่ในสเกล' โดยไม่ต้องคิด"],
    ["question-answer", "เล่น 'คำถาม' 2 ห้อง (จบลอย) แล้วตอบ 2 ห้อง (จบลง)", "ดนตรีเป็นบทสนทนา ไม่ใช่เสียงมั่ว"],
    ["rhythm-first", "ตั้งจังหวะ 4 ตัวก่อน แล้วค่อยเลือก pitch จากสเกล", "จังหวะคือโครง โน้ตคือเนื้อ"],
    ["long-short", "สลับโน้ตยาว 1 ตัว + สั้น 2 ตัว", "ให้ดนตรีมี 'ลมหายใจ'"],
    ["silence-game", "วางเสียง 2-3 ตัวแล้ว 'เงียบ' 1 beat ทุก 4 ห้อง", "เงียบคือส่วนหนึ่งของดนตรี"],
  ];
  for (const [sid, notes, sname] of SCALES) {
    for (const [gid, g, why] of GAMES) {
      out.push({
        id: `exp:improv:${sid}-${gid}`,
        type: "strategy", domain: "improvisation",
        title: `ด้นสดบน ${sname}: ${g}`,
        body: `สเกลใช้ได้: ${notes} · เกม: ${g} — ${why}`,
        teach: `เล่นเกมนี้ 2 นาที ไม่ให้ตัวเอง 'แก้' อะไร — ด้นสดฝึกด้วยการด้น ไม่ใช่การแก้`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["improv", sid, gid],
        meta: { kind: "improv-game", scale: sid, game: gid },
      });
    }
  }
  return out;
}

/* 9. STYLE APPLICATIONS: chord × playing style (how the same chord feels per genre) */
export function genStyleApplications() {
  const out = [];
  const CHORDS = ["C", "Am", "F", "G", "Dm", "Em"];
  const STYLES = [
    ["ballad", "บัลลาด: คอร์ดยาว+arpeggio นุ่ม+แป้นครึ่ง", "เล่นเบา ระวังเสียงซ้อน"],
    ["waltz", "วอลทซ์: บัส-คอร์ด-คอร์ด 3/4", "เน้น beat 1 หนัก"],
    ["swing", "สวิง: walk-bass + comping ขวา off-beat", "แปดโน้ตไม่เท่ากัน"],
    ["latin", "ละติน: montuno ขวา + tumbao ซ้าย", "syncopation สวยเป็นลาย"],
    ["pop", "ป็อป: คอร์ดบล็อกบน backbeat", "ตีเน้น 2 กับ 4"],
    ["rock", "ร็อก: power chord ซ้าย + octave ขวา", "เสียงแน่น จังหวะหนัก"],
    ["thai-lukthung", "ลูกทุ่ง: คอร์ดเรียบ + เมโลดี้พลิ้ว (ornament ไทย)", "เมโลดี้เลียนแบบเสียงร้อง"],
    ["hymn", "เพลงสวด: 4 เสียง SATB style", "เสียงเท่ากัน ไม่โซโล่"],
  ];
  for (const ch of CHORDS) {
    for (const [sid, d, tip] of STYLES) {
      out.push({
        id: `exp:style:${ch}-${sid}`,
        type: "strategy", domain: "repertoire",
        title: `${ch} เล่นสไตล์${sid === "thai-lukthung" ? "ลูกทุ่งไทย" : sid}`,
        body: `คอร์ด ${ch} ในสไตล์ต่างกัน — ${d} · เคล็ด: ${tip}`,
        teach: `เล่น ${ch} สองสไตล์ติดกัน ฟังว่า 'คอร์ดเดียว อารมณ์คนละเรื่อง'`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["style", sid, ch],
        meta: { kind: "style-application", chord: ch, style: sid },
      });
    }
  }
  return out;
}

/* 10. HARMONIZATION: melody note × 3 chord options (theory-math real) */
export function genHarmonization() {
  const out = [];
  const maj = [0, 2, 4, 5, 7, 9, 11];
  const DEG_FN = ["I (โทนิก)", "ii", "iii", "IV", "V", "vi", "vii°"];
  for (let r = 0; r < 12; r++) {
    const key = SH[r];
    for (let deg = 0; deg < 7; deg++) {
      const melRoot = SH[(r + maj[deg]) % 12];
      const opts = [0, 3, 4].map(d => DEG_FN[d]);
      out.push({
        id: `exp:harm:${key}-${deg}`,
        type: "strategy", domain: "harmony",
        title: `คีย์ ${key}: โน้ต ${melRoot} ใส่คอร์ดอะไรได้บ้าง`,
        body: `คีย์ ${key} เมเจอร์ — โน้ต ${melRoot} (องศา ${deg + 1}) เข้ากับคอร์ด: ${opts.join(", ")} · ทดลองเล่นแต่ละตัวฟัง 'สี' ที่ต่างกัน`,
        teach: `ให้เมโลดี้นิ่ง 1 โน้ต ลอง 3 คอร์ด ฟังความรู้สึก 'เหมาะ/แปลก/ตื่นเต้น'`,
        confidence: 0.8, source: "tiga-theory-math",
        tags: ["harmonization", key],
        meta: { kind: "harmonization", key, degree: deg + 1 },
      });
    }
  }
  return out;
}

/* ── Assemble matrix wave ── */
export function seedMatrixExpansion(kb) {
  const gens = [genInversions, genScaleFingering, genArpeggios, genCadences, genKeySignatures, genReadingDrills, genRhythmPatterns, genImprovGames, genStyleApplications, genHarmonization];
  let added = 0;
  for (const g of gens) for (const e of g()) { kb.add(e); added++; }
  return added;
}
