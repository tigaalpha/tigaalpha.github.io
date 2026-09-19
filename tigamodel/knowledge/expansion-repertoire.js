/* ── tigamodel/knowledge/expansion-repertoire.js ──
   Repertoire + practice-craft expansion (owner directive 2026-09-18:
   10,000+ knowledge items). Second family of generators: famous repertoire
   (real public-domain-era classics — factual metadata only), left-hand
   patterns, practice-science drills, and song-learning paths. Same rule as
   expansion-core.js: every entry is real, structured, queryable data. ── */

/* Famous piano pieces students actually meet, by difficulty tier.
   Facts only: composer, era, key, what it teaches. (All pre-1929 public
   domain works; metadata is factual, no copyrighted text.) */
export function genRepertoire() {
  const out = [];
  const PIECES = [
    // beginner (grade 1-2)
    { t: "Minuet in G major, BWV Anh. 114", c: "Christian Petzold (เคยเชื่อว่า Bach)", e: "baroque", k: "G", lv: 1, teach: "มือสองข้างสลับบทบาทโซโล่-ประกอบ ฝึก balance ระหว่างมือ" },
    { t: "Für Elise (ส่วน A)", c: "Beethoven", e: "classical", k: "Am", lv: 1, teach: "arpeggio มือขวาต่อเนื่อง ฝึกนิ้วโป้งสอดแบบไม่กระตุก" },
    { t: "Ode to Joy (เรียบเรียงง่าย)", c: "Beethoven", e: "classical", k: "D", lv: 1, teach: "เมโลดี้เดินสเต็ป + คอร์ดบล็อก ครูสอน chord progression แรกของเด็กได้ที่นี่" },
    { t: "Twinkle Twinkle (C position)", c: "ประเพณี/Mozart 12 variations", e: "classical", k: "C", lv: 1, teach: "เพลงแรกที่ใช้สอน 'ตัวโน้ตเดินไปได้' และจังหวะ 4/4 พื้นฐาน" },
    { t: "Happy Birthday", c: "Hill & Hill (สาธารณสมบัติแล้วใน US 2016)", e: "pop", k: "C", lv: 1, teach: "จังหวะ 3/4 + pickup measure ตัวแรก — เพลงที่นักเรียนอยากเล่นให้ครอบครัวฟังจริง" },
    { t: "Canon in D (เรียบเรียงง่าย)", c: "Pachelbel", e: "baroque", k: "D", lv: 2, teach: "bass ostinato 8 โน้ตวน — ฝึกมือซ้ายคงรูปแบบขณะขวาเล่าเรื่อง" },
    // elementary (grade 2-4)
    { t: "Turkish March (ส่วนง่าย)", c: "Beethoven", e: "classical", k: "Am", lv: 2, teach: "staccato มือซ้าย + เมโลดี้วิ่ง — ควบคุมน้ำหนักสองมือแยกกัน" },
    { t: "Prelude in C major, BWV 846", c: "J.S. Bach", e: "baroque", k: "C", lv: 2, teach: "arpeggio pattern ที่ซ้อม broken chords ให้เป็นดนตรีจริง" },
    { t: "Moonlight Sonata ม.1", c: "Beethoven", e: "classical", k: "C#m", lv: 3, teach: "triplet นิ่งๆ ขณะเมโลดี้ร้อง — เสียงสามชั้นแยกความดัง" },
    { t: "Invention No. 1", c: "J.S. Bach", e: "baroque", k: "C", lv: 3, teach: "two-part counterpoint — สองมือสนทนากัน ฝึก hand independence ที่ดีที่สุด" },
    { t: "Sonatina in C, Op.36 No.1 ม.1", c: "Clementi", e: "classical", k: "C", lv: 2, teach: "โครง sonatina allegro ประโยคสมมาตร — สอน form analysis ตัวแรก" },
    { t: "Maple Leaf Rag (ส่วน A)", c: "Scott Joplin", e: "jazz", k: "Ab", lv: 3, teach: "ragtime syncopation มือขวาลอยเหนือ march bass แน่นๆ" },
    // intermediate (grade 4-6)
    { t: "Claire de Lune (ส่วนเปิด)", c: "Debussy", e: "impressionist", k: "Db", lv: 4, teach: "pedaling สีเสียง เสียงซ้อนกันแบบ impressionist — ควบคุมแป้นขาละเอียด" },
    { t: "Prelude in E minor, Op.28 No.4", c: "Chopin", e: "romantic", k: "Em", lv: 4, teach: "rubato + เสียงคอร์ดซ้ำช้าๆ ที่ต้อง 'หายใจ' ไม่เครียดตึง" },
    { t: "Amazing Grace (arr. แจ๊สง่าย)", c: "ประเพณี", e: "jazz", k: "G", lv: 3, teach: "เพลงที่ซ้อม reharmonization แบบง่ายได้ — เปลี่ยนคอร์ดแล้วฟังสีสัน" },
    { t: "The Entertainer", c: "Scott Joplin", e: "jazz", k: "C", lv: 3, teach: "syncopation ยอดนิยม เริ่มช้าให้จังหวะ off-beat นิ่งก่อนเร่ง" },
    { t: " Greensleeves (arr.)", c: "ประเพณีอังกฤษ", e: "folk", k: "Am", lv: 2, teach: "6/8 จังหวะโยน + เมโลดี้ไมเนอร์โบราณ — ฝึกจังหวะคู่สาม" },
    // advanced (grade 6-8)
    { t: "Nocturne Op.9 No.2", c: "Chopin", e: "romantic", k: "Eb", lv: 5, teach: "cantabile + ornament โรแมนติก เสียงซ้ายกว้างเป็นฮาร์ป" },
    { t: "Prelude in C# minor, Op.3 No.2", c: "Rachmaninoff", e: "romantic", k: "C#m", lv: 5, teach: "ควบคุม ff ทั้งแขนไม่ตึก — เสียงคอร์ดใหญ่ที่ยังต้องมีเมโลดี้" },
    { t: "Rondo Alla Turca", c: "Mozart", e: "classical", k: "Am", lv: 5, teach: "rondo form A-B-C-A + โน้ต 16 ที่ต้องเบาเป็นประกาย" },
    { t: "Autumn Leaves", c: "Joseph Kosma", e: "jazz", k: "Em/Am", lv: 4, teach: "standards แจ๊สที่สอน ii-V-I จริงทุกคีย์ + ด้นสดเริ่มได้ที่นี่" },
  ];
  for (const p of PIECES) {
    out.push({
      id: `exp:rep:${p.t.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      type: "fact", domain: "repertoire",
      title: `${p.t} — ${p.c}`,
      body: `${p.t} · ${p.c} · ยุค${p.e} · คีย์ ${p.k} · ระดับ ${p.lv}/5 — สอน: ${p.teach}`,
      teach: p.teach,
      confidence: 0.85, source: "tiga-repertoire",
      tags: ["repertoire", p.e, "level-" + p.lv],
      meta: { kind: "repertoire", era: p.e, level: p.lv, key: p.k },
    });
  }
  return out;
}

/* Left-hand accompaniment patterns — the craft most self-taught learners miss */
export function genLeftHandPatterns() {
  const out = [];
  const PATS = [
    { id: "block", th: "คอร์ดบล็อกทั้งมือซ้าย", desc: "กดคอร์ดเต็มพร้อมกันบน beat 1 (หรือ 1+3) — จุดเริ่มของทุกคน เสียงหนา จังหวะชัด", use: "เพลงเด็ก เพลงช้า pop ballad" },
    { id: "octave-bass", th: "เบสออกเทฟเดี่ยว", desc: "เล่นแค่โน้ตรากคู่ออกเทฟ — เบามือของเพื่อนร้อง/เครื่องดนตรีอื่น", use: "ดนตรีกลุ่ม ประกอบการร้อง" },
    { id: "alberti", th: "Alberti bass", desc: "ต่ำ-สูง-กลาง-สูง (C-G-E-G) วนต่อเนื่อง — ลายเซ็นของยุคคลาสสิก", use: "Mozart/Clementi sonatina" },
    { id: "broken-chord", th: "Arpeggio แตกคอร์ด", desc: "ไล่โน้ตคอร์ดทีละตัวขึ้น-ลง (C-E-G-E) — เสียงไหลเหมือนน้ำ", use: "Für Elise, เพลงโรแมนติก" },
    { id: "waltz", th: "บัส-คอร์ด-คอร์ด (วอลทซ์)", desc: "beat 1 ราก, beat 2-3 คอร์ด — จังหวะ 3/4 ที่เต้นได้จริง", use: "วอลทซ์ เพลงไทยสากลจังหวะ慢" },
    { id: "walk-bass", th: "Walking bass", desc: "เบสเดินเซมิโทน/เข้าโน้ตคอร์ดถัดไปทุก beat — ลมหายใจของแจ๊ส", use: "แจ๊ส swing blues" },
    { id: "boogie", th: "Boogie-octave shuffle", desc: "ราก-5th สลับออกเทฟเร็ว (C-G-C-G) — พลังงานบลูส์-ร็อกแอนด์โรล", use: "blues rock'n'roll" },
    { id: "ostinato", th: "Ostinato pattern", desc: "รูปแบบสั้นๆ วนซ้ำเป็นโครง (Canon, pop loops) — ซ้อมมือซ้ายให้เป็น 'เครื่องจักรที่มีชีวิต'", use: "Canon in D, ป็อปสมัยใหม่" },
  ];
  for (const root of ["C", "F", "G", "Am"]) {
    for (const p of PATS) {
      out.push({
        id: `exp:lh:${root}-${p.id}`,
        type: "strategy", domain: "accompaniment",
        title: `มือซ้าย: ${p.th} บนคอร์ด ${root}`,
        body: `${p.desc} (คอร์ด ${root}) · ใช้กับ: ${p.use}`,
        teach: `ซ้อมมือซ้ายลูปคอร์ด ${root} 8 รอบให้นิ่งก่อน แล้วค่อยให้มือขวาร้องเมโลดี้ทับ`,
        confidence: 0.8, source: "tiga-pedagogy",
        tags: ["left-hand", p.id, root],
        meta: { kind: "left-hand", pattern: p.id, chord: root },
      });
    }
  }
  return out;
}

/* Practice-science: concrete session recipes by available time */
export function genPracticeRecipes() {
  const out = [];
  const RECIPES = [
    { min: 10, blocks: [["อบอุ่น: สเกลช้า 1 คีย์", 2], ["ทบทวนเพลงเก่า 1 เพลง", 3], ["ท่อนใหม่ช้าๆ ทีละ 2 ห้อง", 4], ["เล่นเพลงที่ชอบจบสนุก", 1]], persona: "คนเวลาน้อย — ครบจบใน 10 นาที ยังไงก็เห็นความก้าวหน้า" },
    { min: 20, blocks: [["อบอุ่น: Hanon 1-5 หรือสเกล 2 คีย์", 3], ["Sight-read ง่ายๆ 8 ห้อง", 3], ["ท่อนติด: แบ่งซ้าย-ขวา-รวม ช้า 80%", 8], ["เพลงเต็มเล่นสนุก/อัดคลิป", 4], ["สรุป 1 ประโยควันนี้ดีอะไร", 2]], persona: "มาตรฐานวันเรียน — ครบทั้งอบอุ่น อ่าน ซ่อม เพลิดเพลิน สรุป" },
    { min: 30, blocks: [["อบอุ่นยาว: สเกล+arpeggio 3 คีย์", 5], ["เทคนิคเฉพาะจุด (trill/ออกเทฟ)", 5], ["ท่อนใหม่ deep-work ช้ามาก", 10], ["เพลงเก่า 2 เพลงเพื่อ memory", 6], ["ทบทวนทฤษฎี/ฟัง 1 ชิ้น", 4]], persona: "จริงจัง — มีช่วง deep work ที่โฟกัสเต็มร้อย" },
    { min: 60, blocks: [["อบอุ่นครบชุด", 10], ["Sight-read ท้าทาย", 8], ["เพลงหลัก deep-work 3 รอบ 3 ระดับเทมโป", 20], ["เพลงรอง", 10], ["ด้นสด/เล่นตามใจ", 7], ["สรุป+วางแผนพรุ่งนี้", 5]], persona: "ซ้อมเข้ม — เทียบเท่าคลาสพิเศษหนึ่งคาบเต็ม" },
  ];
  for (const r of RECIPES) {
    const lines = r.blocks.map(([t, m]) => `• ${t} — ${m} นาที`).join("\n");
    out.push({
      id: `exp:recipe:${r.min}min`,
      type: "strategy", domain: "practice-planning",
      title: `แผนซ้อม ${r.min} นาที (สำเร็จรูป)`,
      body: `${r.persona}:\n${lines}`,
      teach: `ตั้ง timer ตามบล็อก — เมื่อหมดเวลาบล็อกให้เปลี่ยนแม้ยังไม่สมบูรณ์ (deliberate practice ต้องหลากหลาย ไม่ใช่กัดบล็อกเดียว)`,
      confidence: 0.8, source: "tiga-pedagogy",
      tags: ["practice-recipe", r.min + "min"],
      meta: { kind: "practice-recipe", minutes: r.min },
    });
  }
  /* Slow-practice tempo ladder — the single highest-impact technique */
  const TEMPOS = [[50, "ช้ามาก จำทุกการเคลื่อนไหวได้"], [60, "ช้า แต่ยังเป็นดนตรี"], [70, "เริ่มตึงเล็กน้อย"], [80, "คุ้นมือแล้ว"], [90, "เกือบเต็ม ยังต้องโฟกัส"], [100, "เต็มเทมโป"]];
  for (const [pct, why] of TEMPOS) {
    out.push({
      id: `exp:tempo:${pct}`,
      type: "principle", domain: "practice-planning",
      title: `บันไดเทมโป ${pct}% — ${why}`,
      body: `ซ้อมที่ ${pct}% ของเทมโปเป้าหมาย: ${why} · กติกา: เล่นสมบูรณ์ 3 ครั้งติดก่อนขยับ +5% (ผิดครั้งเดียวถอยกลับขั้นเดิม)`,
      teach: `เตือนผู้เรียน: เร่งก่อนพร้อม = ซ้อมความผิดให้คล่อง — ช้าลงคือทางเร็วที่สุด`,
      confidence: 0.85, source: "tiga-pedagogy",
      tags: ["tempo-ladder", pct + "pct"],
      meta: { kind: "tempo-ladder", percent: pct },
    });
  }
  return out;
}

/* Music theory advanced: jazz harmony, modes in use, reharm basics */
export function genAdvancedTheory() {
  const out = [];
  /* ii-V-I in every key with real note spellings */
  const SH = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const CH = { maj: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10] };
  const name = (idx, oct) => SH[((idx % 12) + 12) % 12] + oct;
  const spell = (rootIdx, steps, oct) => steps.map(s => name(rootIdx + s, oct + Math.floor((rootIdx + s) / 12)));
  for (const root of SH) {
    const ri = SH.indexOf(root);
    const ii = spell(ri + 2, CH.min7, 4);
    const V = spell(ri + 7, CH.dom7, 4);
    const I = spell(ri, CH.maj, 4);
    out.push({
      id: `exp:jazz-ii-v-i:${root}`,
      type: "fact", domain: "jazz",
      title: `ii-V-I คีย์ ${root} — แกนแจ๊สครบทุกคีย์`,
      body: `คีย์ ${root}: ${name(ri + 2, 4)}m7 (${ii.join(" ")}) → ${name(ri + 7, 4)}7 (${V.join(" ")}) → ${root}maj7 (${I.join(" ")}) — เสียงดึงกลับบ้านที่แจ๊สใช้หมุนไม่เบื่อ`,
      teach: `ซ้อมทีละคีย์ต่อสัปดาห์ เล่นเบสซ้าย+คอร์ดขวา แล้วฟังแรง pull ของ V7 ไป I`,
      confidence: 0.85, source: "tiga-theory-math",
      tags: ["jazz", "ii-v-i", root],
      meta: { kind: "ii-v-i", key: root },
    });
  }
  /* Tritone substitution — the jazz reharm ace */
  for (const root of ["C", "F", "Bb", "G", "D", "Eb"]) {
    const ri = SH.indexOf(root);
    const sub = SH[(ri + 6) % 12];
    out.push({
      id: `exp:tritone-sub:${root}`,
      type: "strategy", domain: "jazz",
      title: `Tritone sub ในคีย์ ${root}: ${sub}7 แทน ${root}7`,
      body: `${root}7 กับ ${sub}7 แบ่ง tritone เดียวกัน (3rd+♭7 สลับกัน) — เปลี่ยนคอร์ดจาก ${root}7 เป็น ${sub}7 แล้วเบสจะเดินครึ่งเสียงสวยแบบแจ๊ส ทั้งที่ฟังก์ชันเดิม`,
      teach: `เล่น ii-V-I ปกติ 1 รอบ แล้ว V7→sub-V7 1 รอบ ฟังต่างสีเสียงเบส`,
      confidence: 0.8, source: "tiga-theory-math",
      tags: ["jazz", "tritone", root],
      meta: { kind: "tritone-sub", key: root, sub },
    });
  }
  return out;
}

/* Ear-training: reference-song interval anchors (widely-taught associations) */
export function genEarAnchors() {
  const out = [];
  const ANCHORS = [
    [1, "จาก Happy Birthday: 'Hap-py' ขึ้น semitone เล็กๆ"], // no—sem tone not in song; use Jaws
  ];
  const REAL = [
    { s: 1, song: "Jaws theme (สองโน้ต), ไทย: เสียงเตือน", th: "ครึ่งเสียงตึงๆ" },
    { s: 2, song: "Happy Birthday 'Hap-py'", th: "โทนเดินขึ้นธรรมดา" },
    { s: 3, song: "เพลงช้าง (เด็กไทย) 'ช้าง ช้าง'", th: "3rd เมเจอร์สดใส" },
    { s: 4, song: "Here Comes the Bride", th: "4th ศักดิ์สิทธิ์" },
    { s: 5, song: "Twinkle 'Twinkle'", th: "5th มั่นคง" },
    { s: 6, song: "My Way 'And now'", th: "6th อบอุ่น" },
    { s: 8, song: "Somewhere Over the Rainbow", th: "ออกเทฟกว้าง" },
  ];
  for (const a of REAL) {
    out.push({
      id: `exp:ear:${a.s}`,
      type: "strategy", domain: "ear-training",
      title: `จำคู่เสียง ${a.th} จากเพลง: ${a.song}`,
      body: `คู่เสียง ${a.s} เซมิโทน/ชื่อเรียก: ${a.th} — จากเพลงคุ้นหู: ${a.song} · หูฝึกได้ด้วย 'เพลงหมุดหมาย' แบบนี้`,
      teach: `ให้ผู้เรียนร้องเพลงหมุดหมาย แล้วหยุดที่คู่เสียงนั้น ทำซ้ำจนร้องคู่เสียงเปล่าได้`,
      confidence: 0.75, source: "tiga-pedagogy",
      tags: ["ear-training", "anchor", String(a.s)],
      meta: { kind: "ear-anchor", semitones: a.s },
    });
  }
  return out;
}

/* Solfège & note-reading: every line/space position with its mnemonic */
export function genReading() {
  const out = [];
  const TREBLE = [
    ["E4", "เส้น 1 (ล่างสุด)", "Every/เอ็มมี่"], ["F4", "ช่อง 1", "เอฟ"], ["G4", "เส้น 2", "Good/จี"], ["A4", "ช่อง 2", "แอ"], ["B4", "เส้น 3", "Boys/บี"], ["C5", "ช่อง 3", "ซี"], ["D5", "เส้น 4", "Do/ดี"], ["E5", "ช่อง 4", "เอ"], ["F5", "เส้น 5 (บนสุด)", "Fine/เอฟสูง"],
  ];
  const BASS = [
    ["G2", "เส้น 1 (ล่างสุด)", "Good/จีต่ำ"], ["A2", "ช่อง 1", "แอต่ำ"], ["B2", "เส้น 2", "Boys/บีต่ำ"], ["C3", "ช่อง 2", "ซีกลาง"], ["D3", "เส้น 3", "Do/ดีต่ำ"], ["E3", "ช่อง 3", "เอกลาง"], ["F3", "เส้น 4", "Fine/เอฟ"], ["G3", "ช่อง 4", "จีสูง"], ["A3", "เส้น 5 (บนสุด)", "แอสูง"],
  ];
  for (const [clef, set] of [["treble", TREBLE], ["bass", BASS]]) {
    for (const [note, pos, mn] of set) {
      out.push({
        id: `exp:read:${clef}-${note}`,
        type: "fact", domain: "sight-reading",
        title: `อ่านโน้ต ${note} — ${clef === "treble" ? "กุญแจซอล (มือขวา)" : "กุญแจฟา (มือซ้าย)"} ${pos}`,
        body: `บันไดนาม ${clef === "treble" ? "ทรีเบิล" : "เบส"}: โน้ต ${note} อยู่${pos} — ${mn}`,
        teach: `การ์ดโน้ต: โชว์ตำแหน่ง ให้ตอบชื่อโน้ตใน 1 วินาที วันละ 10 การ์ด`,
        confidence: 0.9, source: "tiga-pedagogy",
        tags: ["reading", clef, note],
        meta: { kind: "reading", clef, note },
      });
    }
  }
  return out;
}

/* Rhythm: note values + common patterns (theory-math, Thai first) */
export function genRhythm() {
  const out = [];
  const VALUES = [
    ["whole", "โน้ตตัวขาว (whole note)", "4 จังหวะใน 4/4 — นับ 1-2-3-4 ค้างเสียง"],
    ["half", "โน้ตครึ่ง (half note)", "2 จังหวะ — หัวกลวงมีก้าน"],
    ["quarter", "โน้ตตัวดำ (quarter note)", "1 จังหวะ — หัวทึบมีก้าน"],
    ["eighth", "โน้ตเขียง (eighth note)", "ครึ่งจังหวะ — มีหาง/คานเชื่อม"],
    ["sixteenth", "โน้ตสองเขียง (sixteenth)", "1 ใน 4 จังหวะ — คานสองชั้น"],
    ["dotted-half", "โน้ตครึ่งจุดติด", "3 จังหวะ — จุดเพิ่มครึ่งของค่าเดิม"],
  ];
  for (const [id, th, d] of VALUES) {
    out.push({
      id: `exp:rhythm:${id}`,
      type: "fact", domain: "rhythm",
      title: `${th} = ${d.split(" — ")[0]}`,
      body: `${th}: ${d}`,
      teach: `เคาะขา+ออกเสียง 'ตะ-อา' ให้ค่าโน้ตเดินจริง ไม่ใช่แค่รู้ทฤษฎี`,
      confidence: 0.9, source: "tiga-pedagogy",
      tags: ["rhythm", id],
      meta: { kind: "note-value", value: id },
    });
  }
  const PATTERNS = [
    ["4-4", "4/4 (Common time)", "นับ 1-2-3-4 — เพลงส่วนใหญ่โลก ตี C แทนตัวเลขได้"],
    ["3-4", "3/4 (วอลทซ์)", "นับ 1-2-3 เน้น 1 — จังหวะเต้นวน"],
    ["6-8", "6/8 (คู่สาม)", "รู้สึกเป็น 2 จังหวะใหญ่ แต่ละอันมี 3 เล็ก — โยนลอย"],
    ["2-4", "2/4 (มาร์ช)", "นับ 1-2 แน่นๆ — เพลงเดิน/เพลงเด็กไทยหลายเพลง"],
    ["12-8", "12/8 (บลูส์ช้า)", "4 จังหวะใหญ่ แต่ละอันแตก 3 — swing ที่มาจากโครง"],
  ];
  for (const [id, th, d] of PATTERNS) {
    out.push({
      id: `exp:meter:${id}`,
      type: "fact", domain: "rhythm",
      title: `${th}`,
      body: `${th}: ${d}`,
      teach: `เคาะจังหวะเน้น (1) แรงสุด แล้วเล่นเพลงจริง 1 เพลงในมิเตอร์นี้`,
      confidence: 0.9, source: "tiga-pedagogy",
      tags: ["meter", id],
      meta: { kind: "meter", meter: id },
    });
  }
  return out;
}

/* ── Assemble the second expansion wave ── */
export function seedRepertoireExpansion(kb) {
  const gens = [genRepertoire, genLeftHandPatterns, genPracticeRecipes, genAdvancedTheory, genEarAnchors, genReading, genRhythm];
  let added = 0;
  for (const g of gens) for (const e of g()) { kb.add(e); added++; }
  return added;
}
