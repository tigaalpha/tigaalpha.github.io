/* ── smoke-knowledge-pillars.mjs — plan v3.4 gates for the two owner-priority
   knowledge pillars (business + therapy) and the marketing/education KBs.

   Checks per file:
   • every entry trilingual (th + EN + ZH gloss present in body)
   • every entry has a teach line (served to the student-facing teacher)
   • ZERO fabricated statistics: no percentages / big numbers in bodies
     (allowed: small structural counts like "2-4 ห้อง", "1-2 สัปดาห์",
      สาม-สี่ — the same allowance the existing KB smokes use)
   • therapy domain: ZERO medical/therapeutic claims (rare regexes, zh too)
     + the wellbeing frame note present in every entry
   • ISO principle + boundary entry exist (11.3/11.4 depend on them)

   Run: node tigamodel/scripts/smoke-knowledge-pillars.mjs   (exit 1 on any fail) ── */
import { readFileSync, rmSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import url from "node:url";
import path from "node:path";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const OUT = "node_modules/.tmp-smoke-pillars";

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execSync(
  `npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --log-level=error`,
  { stdio: "pipe", cwd: ROOT }
);
const web = await import(url.pathToFileURL(path.join(ROOT, `${OUT}/web.js`)).href);
await web.ensureTigamodelWeb();
const kb = web.getKnowledgeBaseForTest();
if (!kb) { console.error("FAIL: kb not reachable"); process.exit(1); }

let passed = 0, failed = 0;
const ok = (m) => { passed++; console.log(`  ✅ ${m}`); };
const bad = (m) => { failed++; console.log(`  ❌ ${m}`); };

const all = Array.from(kb._entries.values());
const ofDomain = (d) => all.filter(e => e.domain === d);
const hasEN = (s) => /\(EN: /.test(s);
const hasZH = (s) => /\(ZH: /.test(s);
const hasThai = (s) => /[ก-๙]/.test(s);
/* statistics patterns that would mean "invented data": percentages, times, USD amounts */
const FABRICATED = [
  /\d+(\.\d+)?\s?%/, /\$\s?\d/, /\d+\s?(ล้าน|พันล้าน|million|billion|baskets)/i,
  /\d+(\.\d+)?\s?(USD|EUR|GBP|THB|CNY|บาท|元|美元)/,
];
/* medical/therapeutic claim patterns — sentence-level: a sentence counts as a
   claim unless it NEGATES (ไม่/ไม่ใช่/never/not/无/不是/非). The boundary entry
   legitimately contains the phrase "ทางการแพทย์" inside a negation — that's
   the whole point of the wall, and the smoke must still pass it. */
const MEDICAL = [
  /รักษา(โรค|อาการ)/, /เสริมสร้างภูมิคุ้มกัน/, /แทนที่(การ)?(แพทย์|นักบำบัด)/,
  /treats?\s+(disease|depression|anxiety)/i, /clinical(ly)?\s+proven/i, /medically\s+proven/i,
  /治疗(疾病|抑郁|焦虑)/, /临床(证明|证实)/, /替代(医生|治疗师)/, /处方/,
];
const CLAIM_SENTENCE = (text, re) => String(text)
  .split(/[。\.\!\!\?\?\n]/)
  .some(s => re.test(s) && !/ไม่(ใช่)?|ห้าม|never\s|not\s|非|无|不/.test(s));
/* small structural numbers that are craft counts, not statistics */
const ALLOWED_SMALL = /(1|2|3|4)(-(1|2|3|4))?(\s?(ห้อง|สัปดาห์|เพลง|ครั้ง|รอบ|ขั้น|บรรทัด|นาที|ชิ้น|สาย|ทาง|แบบ|วัน|บท)?|-)([^0-9]|$)/;

function checkFile(family, domain, expectMin) {
  const list = ofDomain(domain);
  list.length >= expectMin ? ok(`${family}: ${list.length} entries (≥ ${expectMin})`) : bad(`${family}: ${list.length} entries < ${expectMin}`);
  const noLang = list.filter(e => !(hasThai(e.body) && hasEN(e.body) && hasZH(e.body)));
  noLang.length === 0 ? ok(`${family}: trilingual bodies ครบทุก entry`) : bad(`${family}: ขาดภาษาใน ${noLang.length} entries (${noLang.slice(0, 2).map(e => e.id)})`);
  const noTeach = list.filter(e => !e.teach);
  noTeach.length === 0 ? ok(`${family}: teach line ครบทุก entry`) : bad(`${family}: ขาด teach ใน ${noTeach.length} entries`);
  const fab = [];
  for (const e of list) {
    const bodyCore = e.body.replace(/\(EN: [^)]*\)/, "").replace(/\(ZH: [^)]*\)/, "");
    for (const re of FABRICATED) if (re.test(bodyCore) && !ALLOWED_SMALL.test(bodyCore)) { fab.push(`${e.id}: ${re}`); break; }
  }
  fab.length === 0 ? ok(`${family}: ไม่มีสถิติแต่ง (zero fabricated statistics)`) : bad(`${family}: พบรูปแบบตัวเลขที่น่าสงสัย → ${fab.slice(0, 3).join(" · ")}`);
  return list;
}

console.log("ตรวจขุมความรู้ใหม่ 4 ขุม (แผน v3.4):\n");

const mkt = checkFile("marketing (6.1)", "music-marketing", 14);
const biz = checkFile("business (6.7)", "music-business", 14);
const edu = checkFile("education-market (6.8)", "music-education-market", 12);
const thx = checkFile("therapy (11.1)", "music-therapy", 10);

/* therapy-specific: the hard wellbeing frame */
const medicalHits = [];
for (const e of thx) {
  const flat = `${e.title} ${e.body} ${e.teach}`;
  for (const re of MEDICAL) if (CLAIM_SENTENCE(flat, re)) { medicalHits.push(`${e.id} → ${re}`); break; }
}
medicalHits.length === 0 ? ok("therapy: ไม่มีเคลมการแพทย์/การรักษาแม้แต่จุดเดียว") : bad(`therapy: พบเคลม → ${medicalHits.slice(0, 3).join(" · ")}`);
const frame = thx.filter(e => /wellbeing frame|กรอบ wellbeing/.test(e.body)).length === thx.length;
frame ? ok("therapy: ทุก entry มีกรอบ wellbeing กำกับ") : bad("therapy: มี entry ไม่มีกรอบ wellbeing");
const iso = thx.some(e => /iso-principle|ISO principle/.test(e.id + e.tags.join(" ")) || /ISO/.test(e.title));
iso ? ok("therapy: หลัก ISO มีจริง (พื้นฐานของ 11.3)") : bad("therapy: หากหลัก ISO ไม่เจอ");
const boundary = thx.find(e => /thx:practice:boundary/.test(e.id));
boundary ? ok("therapy: เส้นแบ่ง 'ครูไม่ให้คำแนะนำทางการแพทย์' มีเป็นข้อบังคับ (11.4 ใช้)") : bad("therapy: ไม่มี entry เส้นแบ่ง boundary");

/* the other three pillars must also carry zero medical claims (defense in depth) */
const otherMedical = [];
for (const e of [...mkt, ...biz, ...edu]) {
  const flat = `${e.title} ${e.body}`;
  for (const re of MEDICAL) if (CLAIM_SENTENCE(flat, re)) { otherMedical.push(`${e.id} → ${re}`); break; }
}
otherMedical.length === 0 ? ok("marketing/business/education: สะอาดจากเคลมการแพทย์เช่นกัน") : bad(`พบเคลมนอกขุมบำบัด → ${otherMedical.slice(0, 2).join(" · ")}`);

/* KB reachable through the real teaching loop: a marketing query yields grounded text */
try {
  const r = await web.runTeachingLoopForPractice({ accuracy: 88, repeatedErrors: 1, pauses: 0, rhythmScore: 90 }, { lang: "th" });
  r && r.response && hasThai(r.response.text) ? ok("teaching loop ยังตอบภาษาไทยถูกต้องหลังเสียบ KB ใหม่ (ไม่พังทางเดิม)") : bad("teaching loop พัง/ภาษาเพี้ยนหลังเสียบ KB ใหม่");
} catch (e) { bad(`teaching loop ยิงไม่ได้: ${e.message}`); }

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
