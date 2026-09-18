/* ── tigamodel/teaching/skill-graph.js ──
   SKILL GRAPH (roadmap #62, ⭐⭐⭐): the app's curriculum as a directed
   graph — 80 skill nodes + prerequisite edges — so "what should this
   learner do next" becomes a graph question, not a guess.

   Design rules (repo hard rules, kept):
   - Nodes are REAL curriculum skills the app already teaches (pathway-data/
     songs-data own the authoritative curriculum; this graph names the skills
     behind it — complements, never duplicates).
   - Edges are pedagogical dependencies a human teacher would assert
     ("sixteenth notes need eighth notes first"). Every `requires` edge
     points to an EXISTING node id — smoke-tested, no dangling refs.
   - Mastery is probability+evidence, never a hard claim (philosophy #5):
     `masteryOf` reads a mastery map {skill_id: 0..1} and answers are
     conservative; absent data = unknown, not zero.

   Public API:
     SKILL_GRAPH_NODES / SKILL_GRAPH_EDGES   — the data
     createSkillGraph()                      — instance with:
       .get(id) .count() .roots() .unlocks(id) .requires(id)
       .path(from, to)                  — BFS shortest prerequisite path
       .readySkills(mastery, {max})     — unmastered, prerequisites met
       .nextSkill(mastery)              — single best next skill
       .unlockOrder({target})           — full topological teaching order
       .weakestAncestor(mastery, id)    — root cause of a struggling skill
   ── */

/* ── 80 nodes across 8 tiers ── */

export const SKILL_GRAPH_NODES = [
  /* Tier 0 — absolute foundations */
  { id: "sg:steady-beat", tier: 0, domain: "rhythm", th: "จังหวะนิ่ง (steady beat)", en: "Steady beat" },
  { id: "sg:key-geography", tier: 0, domain: "technique", th: "รู้จักคีย์ 88 ตัว", en: "Keyboard geography" },
  { id: "sg:posture", tier: 0, domain: "technique", th: "ท่านั่งและรูปมือ", en: "Posture & hand shape" },
  { id: "sg:finger-numbers", tier: 0, domain: "sight-reading", th: "เลขนิ้ว 1-5", en: "Finger numbers" },
  { id: "sg:black-key-groups", tier: 0, domain: "technique", th: "กลุ่มคีย์ดำ 2-3", en: "Black-key groups" },

  /* Tier 1 — first notes & rhythm values */
  { id: "sg:white-key-names", tier: 1, domain: "sight-reading", th: "ชื่อคีย์ขาว C-B", en: "White-key names" },
  { id: "sg:quarter-note", tier: 1, domain: "rhythm", th: "โน้ตตัวดำ (1 จังหวะ)", en: "Quarter note" },
  { id: "sg:half-whole-notes", tier: 1, domain: "rhythm", th: "โน้ตครึ่ง-โน้ตเต็ม", en: "Half & whole notes" },
  { id: "sg:5-note-position", tier: 1, domain: "technique", th: "ตำแหน่งมือ 5 นิ้ว", en: "5-finger position" },
  { id: "sg:non-legato", tier: 1, domain: "technique", th: "เล่นแยกโน้ต (non-legato)", en: "Non-legato touch" },
  { id: "sg:staff-basics", tier: 1, domain: "sight-reading", th: "บันไดพันธุศาสตร์ 5 เส้น", en: "Staff basics" },
  { id: "sg:forte-piano", tier: 1, domain: "expression", th: "ดัง-เบา (f/p)", en: "Forte & piano" },

  /* Tier 2 — elementary reading & coordination */
  { id: "sg:eighth-notes", tier: 2, domain: "rhythm", th: "โน้ตครึ่งชั้น (2 ห้อง)", en: "Eighth notes" },
  { id: "sg:c-major-5finger", tier: 2, domain: "technique", th: "สเกล 5 นิ้ว C major", en: "C-major 5-finger scale" },
  { id: "sg:landmark-notes", tier: 2, domain: "sight-reading", th: "โน้ตหลัก (landmark)", en: "Landmark notes" },
  { id: "sg:intervals-2nd-3rd", tier: 2, domain: "sight-reading", th: "คู่เสียง 2nd-3rd บนบันได", en: "2nd/3rd intervals on staff" },
  { id: "sg:legato", tier: 2, domain: "technique", th: "เล่นเชื่อม (legato)", en: "Legato" },
  { id: "sg:two-hand-together", tier: 2, domain: "coordination", th: "สองมือเหมือนกันพร้อมกัน", en: "Hands together (same)" },
  { id: "sg:repeat-signs", tier: 2, domain: "sight-reading", th: "สัญลักษณ์ทำซ้ำ", en: "Repeat signs" },
  { id: "sg:c-pentatonic-melody", tier: 2, domain: "repertoire", th: "ทำนองเพนทาโทนิก C", en: "C pentatonic melodies" },

  /* Tier 3 — real reading, real chords */
  { id: "sg:quarter-rest", tier: 3, domain: "rhythm", th: "พักตัวดำ", en: "Quarter rest" },
  { id: "sg:c-major-octave-scale", tier: 3, domain: "technique", th: "สเกล C major เต็มออกเทฟ", en: "C major one-octave scale" },
  { id: "sg:staff-note-reading", tier: 3, domain: "sight-reading", th: "อ่านโน้ตทุกเส้น-ช่อง", en: "Full staff reading" },
  { id: "sg:triads-c-f-g", tier: 3, domain: "harmony", th: "คอร์ด C F G", en: "C/F/G triads" },
  { id: "sg:3-4-time", tier: 3, domain: "rhythm", th: "จังหวะ 3/4", en: "3/4 time" },
  { id: "sg:hand-different-roles", tier: 3, domain: "coordination", th: "สองมือคนละบทบาท", en: "Hands, different roles" },
  { id: "sg:dot-quarter", tier: 3, domain: "rhythm", th: "โน้ตดำจุดโท", en: "Dotted quarter" },
  { id: "sg:crescendo-dim", tier: 3, domain: "expression", th: "เดินเสียง cresc/decresc", en: "Crescendo/ diminuendo" },
  { id: "sg:staccato", tier: 3, domain: "technique", th: "สตัคคาโต", en: "Staccato" },
  { id: "sg:aa-form", tier: 3, domain: "repertoire", th: "โครงเพลง A-A", en: "A-A form pieces" },

  /* Tier 4 — elementary fluency */
  { id: "sg:chord-progressions-i-v", tier: 4, domain: "harmony", th: "เดินคอร์ด I-V", en: "I-V progressions" },
  { id: "sg:sharp-flat-accidentals", tier: 4, domain: "theory", th: "เครื่องหมาย sharp/flat", en: "Sharps & flats" },
  { id: "sg:g-major-scale", tier: 4, domain: "technique", th: "สเกล G major", en: "G major scale" },
  { id: "sg:eighth-rest", tier: 4, domain: "rhythm", th: "พักครึ่งชั้น", en: "Eighth rest" },
  { id: "sg:hand-independence-intro", tier: 4, domain: "coordination", th: "มืออิสระเบื้องต้น", en: "Hand independence (intro)" },
  { id: "sg:ab-form", tier: 4, domain: "repertoire", th: "โครงเพลง A-B", en: "A-B form pieces" },
  { id: "sg:key-signatures-1", tier: 4, domain: "theory", th: "คีย์ซิกเนเจอร์ 1-2 เครื่องหมาย", en: "Key signatures (≤2)" },
  { id: "sg:phrasing-2bar", tier: 4, domain: "expression", th: "ถอดวากย 2 ห้อง", en: "2-bar phrasing" },
  { id: "sg:thumb-under", tier: 4, domain: "technique", th: "นิ้วโป้งสอด (thumb-under)", en: "Thumb-under pass" },
  { id: "sg:block-chords-lh", tier: 4, domain: "harmony", th: "คอร์ดบล็อกมือซ้าย", en: "Left-hand block chords" },

  /* Tier 5 — early intermediate */
  { id: "sg:16th-notes", tier: 5, domain: "rhythm", th: "โน้ต 1/16", en: "Sixteenth notes" },
  { id: "sg:d-major-a-major", tier: 5, domain: "technique", th: "สเกล D และ A major", en: "D & A major scales" },
  { id: "sg:triad-inversions", tier: 5, domain: "harmony", th: "คอร์ดกลับ (inversions)", en: "Triad inversions" },
  { id: "sg:alberti-bass", tier: 5, domain: "accompaniment", th: "Alberti bass", en: "Alberti bass" },
  { id: "sg:triplets", tier: 5, domain: "rhythm", th: "ทริปเปิลเล็ต", en: "Triplets" },
  { id: "sg:ii-v-i-basic", tier: 5, domain: "harmony", th: "ii-V-I เบื้องต้น", en: "ii-V-I basics" },
  { id: "sg:damper-pedal", tier: 5, domain: "pedal", th: "แป้น sustain เบื้องต้น", en: "Damper pedal basics" },
  { id: "sg:syncopation", tier: 5, domain: "rhythm", th: "ซิงโคเปชัน", en: "Syncopation" },
  { id: "sg:aba-form", tier: 5, domain: "repertoire", th: "โครงเพลง A-B-A", en: "A-B-A form" },
  { id: "sg:canon-form", tier: 5, domain: "repertoire", th: "คานอน / เลียนแบบ", en: "Canon/imitation pieces" },
  { id: "sg:minors-natural", tier: 5, domain: "theory", th: "ไมเนอร์ธรรมชาติ", en: "Natural minor keys" },

  /* Tier 6 — intermediate craft */
  { id: "sg:dom7-chords", tier: 6, domain: "harmony", th: "คอร์ด dominant 7", en: "Dominant 7th chords" },
  { id: "sg:all-major-scales", tier: 6, domain: "technique", th: "สเกลเมเจอร์ครบ 12 คีย์", en: "All 12 major scales" },
  { id: "sg:arpeggios-2oct", tier: 6, domain: "technique", th: "อาร์เปจโจ้ 2 ออกเทฟ", en: "2-octave arpeggios" },
  { id: "sg:dotted-8th-16th", tier: 6, domain: "rhythm", th: "จังหวะ dotted-8th + 16th", en: "Dotted-8th/16th rhythms" },
  { id: "sg:min7-maj7", tier: 6, domain: "harmony", th: "คอร์ด min7/maj7", en: "min7/maj7 chords" },
  { id: "sg:voicing-melody-above", tier: 6, domain: "expression", th: "เด่นเมโลดี้เหนือคอร์ด", en: "Melody-above-accompaniment voicing" },
  { id: "sg:sonatina-form", tier: 6, domain: "repertoire", th: "โซนาทิน่า", en: "Sonatinas" },
  { id: "sg:sight-read-level1", tier: 6, domain: "sight-reading", th: "อ่านตามสายตาระดับ 1", en: "Sight-reading level 1" },
  { id: "sg:3-against-2", tier: 6, domain: "rhythm", th: "3 ต่อ 2 (polyrhythm)", en: "3-against-2 polyrhythm" },
  { id: "sg:sustain-pedal-refined", tier: 6, domain: "pedal", th: "เหยียบแป้นเชื่อมรอบ", en: "Legato pedal changes" },
  { id: "sg:baroque-dance-styles", tier: 6, domain: "repertoire", th: "บทเต้นยุคบาโรก", en: "Baroque dance movements" },

  /* Tier 7 — advanced-intermediate gateway */
  { id: "sg:sonata-exposition", tier: 7, domain: "repertoire", th: "โซนาตา (exposition)", en: "Sonata exposition" },
  { id: "sg:cadence-types", tier: 7, domain: "harmony", th: "แคเดนซ์ครบชนิด", en: "All cadence types" },
  { id: "sg:inventions-2voice", tier: 7, domain: "repertoire", th: "2-voice invention", en: "2-voice inventions" },
  { id: "sg:rubato", tier: 7, domain: "expression", th: "Rubato อย่างมีเหตุผล", en: "Purposeful rubato" },
  { id: "sg:mini-modulations", tier: 7, domain: "harmony", th: "ย้ายคีย์ใกล้ชิด", en: "Closely-keyed modulation" },
  { id: "sg:chromatic-passing", tier: 7, domain: "technique", th: "โน้ตเครโมติกผ่านทาง", en: "Chromatic passing technique" },
  { id: "sg:jazz-voicings-shell", tier: 7, domain: "harmony", th: "Jazz shell voicing", en: "Jazz shell voicings" },
  { id: "sg:perf-ready-2min", tier: 7, domain: "performance", th: "เล่นต่อหน้าได้ 2 นาที", en: "Performance-ready 2-minute piece" },
  { id: "sg:sight-read-level2", tier: 7, domain: "sight-reading", th: "อ่านตามสายตาระดับ 2", en: "Sight-reading level 2" },
  { id: "sg:memorize-secure", tier: 7, domain: "performance", th: "จำเพลงได้มั่นคง", en: "Secure memorization" },
  { id: "sg:seventh-chords-lh", tier: 7, domain: "harmony", th: "คอร์ด 7 มือซ้ายเต็ม", en: "Full left-hand 7th chords" },
  { id: "sg:romantic-tone", tier: 7, domain: "expression", th: "เสียงโรแมนติก (arm weight)", en: "Romantic tone (arm weight)" },
  { id: "sg:ornament-exec", tier: 7, domain: "technique", th: "ออร์นาเมนต์เบื้องต้น (trill/mordent)", en: "Ornament execution (trill/mordent)" },
  { id: "sg:octaves-secure", tier: 7, domain: "technique", th: "อ็อกเทฟที่มั่นคง ไม่บาดเจ็บ", en: "Secure, injury-safe octaves" },
  { id: "sg:arpeg-lh-patterns", tier: 7, domain: "accompaniment", th: "อาร์เปจโจ้มือซ้ายเป็นประกอบ", en: "Left-hand arpeggio accompaniment" },
  { id: "sg:duet-collab", tier: 7, domain: "performance", th: "เล่นรวมกับผู้อื่น (ensemble)", en: "Playing with others (ensemble)" },
  { id: "sg:scale-thirds-sixths", tier: 7, domain: "technique", th: "สเกลในคู่ 3rd/6th เบื้องต้น", en: "Scales in 3rds/6ths (intro)" },
  { id: "sg:dynamics-layering", tier: 7, domain: "expression", th: "ชั้นเสียง 3 ชั้น (เมโลดี้/ฮาร์มอนี/เบส)", en: "3-layer dynamics (melody/harmony/bass)" },
];

export const SKILL_GRAPH_EDGES = [
  /* Tier 0 → 1 */
  ["sg:key-geography", "sg:white-key-names"], ["sg:finger-numbers", "sg:5-note-position"],
  ["sg:posture", "sg:5-note-position"], ["sg:black-key-groups", "sg:white-key-names"],
  ["sg:steady-beat", "sg:quarter-note"], ["sg:white-key-names", "sg:staff-basics"],
  ["sg:5-note-position", "sg:non-legato"], ["sg:quarter-note", "sg:half-whole-notes"],
  ["sg:5-note-position", "sg:forte-piano"], ["sg:staff-basics", "sg:forte-piano"],

  /* Tier 1 → 2 */
  ["sg:quarter-note", "sg:eighth-notes"], ["sg:half-whole-notes", "sg:eighth-notes"],
  ["sg:5-note-position", "sg:c-major-5finger"], ["sg:staff-basics", "sg:landmark-notes"],
  ["sg:staff-basics", "sg:intervals-2nd-3rd"], ["sg:non-legato", "sg:legato"],
  ["sg:c-major-5finger", "sg:two-hand-together"], ["sg:landmark-notes", "sg:repeat-signs"],
  ["sg:c-major-5finger", "sg:c-pentatonic-melody"], ["sg:white-key-names", "sg:c-pentatonic-melody"],
  ["sg:forte-piano", "sg:two-hand-together"], ["sg:legato", "sg:two-hand-together"],

  /* Tier 2 → 3 */
  ["sg:eighth-notes", "sg:quarter-rest"], ["sg:eighth-notes", "sg:dot-quarter"],
  ["sg:c-major-5finger", "sg:c-major-octave-scale"], ["sg:landmark-notes", "sg:staff-note-reading"],
  ["sg:intervals-2nd-3rd", "sg:staff-note-reading"], ["sg:c-major-5finger", "sg:triads-c-f-g"],
  ["sg:quarter-note", "sg:3-4-time"], ["sg:half-whole-notes", "sg:3-4-time"],
  ["sg:two-hand-together", "sg:hand-different-roles"], ["sg:repeat-signs", "sg:aa-form"],
  ["sg:legato", "sg:staccato"], ["sg:forte-piano", "sg:crescendo-dim"],
  ["sg:c-pentatonic-melody", "sg:aa-form"], ["sg:staff-note-reading", "sg:aa-form"],

  /* Tier 3 → 4 */
  ["sg:triads-c-f-g", "sg:chord-progressions-i-v"], ["sg:staff-note-reading", "sg:sharp-flat-accidentals"],
  ["sg:c-major-octave-scale", "sg:thumb-under"], ["sg:thumb-under", "sg:g-major-scale"],
  ["sg:sharp-flat-accidentals", "sg:key-signatures-1"], ["sg:eighth-notes", "sg:eighth-rest"],
  ["sg:hand-different-roles", "sg:hand-independence-intro"],
  ["sg:aa-form", "sg:ab-form"], ["sg:staff-note-reading", "sg:ab-form"],
  ["sg:key-signatures-1", "sg:phrasing-2bar"], ["sg:crescendo-dim", "sg:phrasing-2bar"],
  ["sg:triads-c-f-g", "sg:block-chords-lh"], ["sg:3-4-time", "sg:ab-form"],
  ["sg:hand-independence-intro", "sg:block-chords-lh"], ["sg:legato", "sg:phrasing-2bar"],

  /* Tier 4 → 5 */
  ["sg:eighth-notes", "sg:16th-notes"], ["sg:dot-quarter", "sg:16th-notes"],
  ["sg:g-major-scale", "sg:d-major-a-major"], ["sg:triads-c-f-g", "sg:triad-inversions"],
  ["sg:block-chords-lh", "sg:alberti-bass"], ["sg:eighth-notes", "sg:triplets"],
  ["sg:chord-progressions-i-v", "sg:ii-v-i-basic"], ["sg:block-chords-lh", "sg:damper-pedal"],
  ["sg:16th-notes", "sg:syncopation"], ["sg:ab-form", "sg:aba-form"],
  ["sg:aba-form", "sg:canon-form"], ["sg:hand-independence-intro", "sg:canon-form"],
  ["sg:key-signatures-1", "sg:minors-natural"], ["sg:sharp-flat-accidentals", "sg:minors-natural"],
  ["sg:phrasing-2bar", "sg:aba-form"], ["sg:thumb-under", "sg:d-major-a-major"],
  ["sg:hand-different-roles", "sg:alberti-bass"], ["sg:dot-quarter", "sg:syncopation"],

  /* Tier 5 → 6 */
  ["sg:16th-notes", "sg:dotted-8th-16th"], ["sg:triplets", "sg:3-against-2"],
  ["sg:d-major-a-major", "sg:all-major-scales"], ["sg:thumb-under", "sg:arpeggios-2oct"],
  ["sg:ii-v-i-basic", "sg:dom7-chords"], ["sg:dom7-chords", "sg:min7-maj7"],
  ["sg:triad-inversions", "sg:voicing-melody-above"], ["sg:alberti-bass", "sg:voicing-melody-above"],
  ["sg:aba-form", "sg:sonatina-form"], ["sg:staff-note-reading", "sg:sight-read-level1"],
  ["sg:damper-pedal", "sg:sustain-pedal-refined"], ["sg:canon-form", "sg:baroque-dance-styles"],
  ["sg:syncopation", "sg:3-against-2"], ["sg:minors-natural", "sg:min7-maj7"],
  ["sg:ii-v-i-basic", "sg:voicing-melody-above"], ["sg:crescendo-dim", "sg:voicing-melody-above"],

  /* Tier 6 → 7 */
  ["sg:sonatina-form", "sg:sonata-exposition"], ["sg:dom7-chords", "sg:cadence-types"],
  ["sg:baroque-dance-styles", "sg:inventions-2voice"], ["sg:phrasing-2bar", "sg:rubato"],
  ["sg:cadence-types", "sg:mini-modulations"], ["sg:all-major-scales", "sg:chromatic-passing"],
  ["sg:min7-maj7", "sg:jazz-voicings-shell"], ["sg:ii-v-i-basic", "sg:jazz-voicings-shell"],
  ["sg:sight-read-level1", "sg:sight-read-level2"], ["sg:voicing-melody-above", "sg:romantic-tone"],
  ["sg:sustain-pedal-refined", "sg:romantic-tone"], ["sg:aba-form", "sg:perf-ready-2min"],
  ["sg:sonatina-form", "sg:memorize-secure"], ["sg:canon-form", "sg:inventions-2voice"],
  ["sg:min7-maj7", "sg:seventh-chords-lh"], ["sg:sight-read-level1", "sg:sonata-exposition"],
  ["sg:hand-independence-intro", "sg:inventions-2voice"], ["sg:3-against-2", "sg:rubato"],
  /* Tier 7 deepening (ornaments/octaves/ensemble/layering) */
  ["sg:baroque-dance-styles", "sg:ornament-exec"], ["sg:all-major-scales", "sg:ornament-exec"],
  ["sg:all-major-scales", "sg:octaves-secure"], ["sg:chromatic-passing", "sg:octaves-secure"],
  ["sg:arpeggios-2oct", "sg:arpeg-lh-patterns"], ["sg:block-chords-lh", "sg:arpeg-lh-patterns"],
  ["sg:perf-ready-2min", "sg:duet-collab"], ["sg:memorize-secure", "sg:duet-collab"],
  ["sg:chromatic-passing", "sg:scale-thirds-sixths"], ["sg:arpeggios-2oct", "sg:scale-thirds-sixths"],
  ["sg:voicing-melody-above", "sg:dynamics-layering"], ["sg:romantic-tone", "sg:dynamics-layering"],
];

/* ── Instance ── */

export function createSkillGraph() {
  const nodes = new Map(SKILL_GRAPH_NODES.map(n => [n.id, n]));
  const reqs = new Map();  // id → [prerequisite ids]
  const unlk = new Map();  // id → [ids it unlocks]

  for (const [from, to] of SKILL_GRAPH_EDGES) {
    if (!reqs.has(to)) reqs.set(to, []);
    if (!unlk.has(from)) unlk.set(from, []);
    reqs.get(to).push(from);
    unlk.get(from).push(to);
  }

  function get(id) { return nodes.get(id) || null; }
  function count() { return nodes.size; }
  function requires(id) { return [...(reqs.get(id) || [])]; }
  function unlocks(id) { return [...(unlk.get(id) || [])]; }
  function roots() { return SKILL_GRAPH_NODES.filter(n => !(reqs.get(n.id) || []).length).map(n => n.id); }

  /* Shortest TEACHING path from → to (BFS over forward `unlocks` edges):
     the sequence of skills between them when `to` lies downstream of `from`.
     Returns [from, ..., to]; null when `to` is NOT downstream of `from`
     (honest — no fake route through unrelated branches). */
  function path(from, to) {
    if (!nodes.has(from) || !nodes.has(to)) return null;
    if (from === to) return [from];
    const prev = new Map([[from, null]]);
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const nxt of unlk.get(cur) || []) {
        if (prev.has(nxt)) continue;
        prev.set(nxt, cur);
        if (nxt === to) {
          const p = [to];
          let walk = cur;
          while (walk != null) { p.push(walk); walk = prev.get(walk); }
          return p.reverse();
        }
        q.push(nxt);
      }
    }
    return null;
  }

  /* Mastery helper: absent = null (unknown), never silently zero. */
  const m = (mastery, id) => {
    const v = mastery ? mastery[id] : undefined;
    return v == null ? null : Math.max(0, Math.min(1, Number(v) || 0));
  };

  /* Ready skills: not mastered (≤ readyAt or unknown-but-not-evidenced) with
     every prerequisite ≥ needPrereq (default 0.7). Unknown prerequisite
     mastery blocks readiness (philosophy: no assumption). */
  function readySkills(mastery, { max = 8, needPrereq = 0.7, readyAt = 0.7 } = {}) {
    const out = [];
    for (const n of SKILL_GRAPH_NODES) {
      const my = m(mastery, n.id);
      if (my != null && my >= readyAt) continue;
      const reqsOf = reqs.get(n.id) || [];
      const okReqs = reqsOf.every(r => { const rm = m(mastery, r); return rm != null && rm >= needPrereq; });
      if (okReqs) out.push({ id: n.id, tier: n.tier, th: n.th, en: n.en, domain: n.domain, prereqCount: reqsOf.length });
      if (out.length >= max) break;
    }
    return out;
  }

  /* The single best next skill: ready with the lowest tier (ties → fewest
     prerequisites → stable id order). */
  function nextSkill(mastery, opts = {}) {
    const ready = readySkills(mastery, { ...opts, max: SKILL_GRAPH_NODES.length });
    if (!ready.length) return null;
    ready.sort((a, b) => a.tier - b.tier || a.prereqCount - b.prereqCount || (a.id < b.id ? -1 : 1));
    return ready[0];
  }

  /* Full teaching order (Kahn topological sort; deterministic by tier). */
  function unlockOrder() {
    const indeg = new Map(SKILL_GRAPH_NODES.map(n => [n.id, (reqs.get(n.id) || []).length]));
    const order = [];
    let frontier = SKILL_GRAPH_NODES.filter(n => indeg.get(n.id) === 0).map(n => n.id);
    while (frontier.length) {
      frontier.sort((a, b) => {
        const ta = nodes.get(a).tier - nodes.get(b).tier;
        return ta !== 0 ? ta : (a < b ? -1 : 1);
      });
      const cur = frontier.shift();
      order.push(cur);
      for (const u of unlk.get(cur) || []) {
        indeg.set(u, indeg.get(u) - 1);
        if (indeg.get(u) === 0) frontier.push(u);
      }
    }
    return order.length === nodes.size ? order : null; // null ⇒ cycle (bug), never shipped
  }

  /* Root cause: walk prerequisite chains of a struggling skill and return
     the weakest UNMASTERED ancestor closest to the root (tier order). */
  function weakestAncestor(mastery, id, { needPrereq = 0.7 } = {}) {
    const seen = new Set();
    const cands = [];
    (function walk(cur) {
      for (const r of reqs.get(cur) || []) {
        if (seen.has(r)) continue;
        seen.add(r);
        const rm = m(mastery, r);
        if (rm == null || rm < needPrereq) cands.push(r);
        walk(r);
      }
    })(id);
    if (!cands.length) return null;
    cands.sort((a, b) => nodes.get(a).tier - nodes.get(b).tier || (a < b ? -1 : 1));
    return get(cands[0]);
  }

  return { get, count, requires, unlocks, roots, path, readySkills, nextSkill, unlockOrder, weakestAncestor };
}

/* Module-level singleton for cheap call sites (web.js/lab); factories above
   remain available for tests wanting a fresh instance. */
let _sg = null;
export function sharedSkillGraph() {
  if (!_sg) _sg = createSkillGraph();
  return _sg;
}
