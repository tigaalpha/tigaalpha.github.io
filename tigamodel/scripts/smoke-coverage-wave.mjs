/* Smoke: global coverage wave (docs/16 §3 / plan-v3 m52) — the owner's 5-category
   coverage directive, checked against the REAL production KB (same harness as
   smoke-knowledge-pillars: bundle the real tigamodel/web.js, seed, read entries)
   plus the REAL retrieval probes for the newly-servable domains.

   What this gate proves:
     • the three thin pillars (music-marketing / innovation / music-therapy)
       are deep — wave 1 + wave 2 = 16 new entries each, ≥16 per domain
     • every wave entry is trilingual (th lead + (EN: …) (ZH: …) gloss),
       carries a teach line, and keeps an honest tiga-* own source
     • every music-therapy entry still carries its wellbeing frame in-body
     • no fabricated statistics in any wave domain (same patterns as pillars)
     • the domains are actually SERVABLE — getKBContext returns their labels
       for a real question (registration in KB_DOMAIN_LABEL/KEYWORDS is real)
     • the new-domain retrieval probes score 1 (production path, not a copy)

   Run: node tigamodel/scripts/smoke-coverage-wave.mjs   (exit 1 on any fail) */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-smoke-coverage-wave";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });

const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  execSync(`npx esbuild tigamodel/evaluation/retrieval-eval.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const web = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const retr = await import(pathToFileURL(`${OUT}/retrieval-eval.js`).href);
await web.ensureTigamodelWeb();
const kb = web.getKnowledgeBaseForTest();
if (!kb) { console.error("FAIL: kb not reachable"); process.exit(1); }

let passed = 0, failed = 0;
const ok = (m) => { console.log(`  ✅ ${m}`); passed++; };
const bad = (m) => { console.log(`  ❌ ${m}`); failed++; };

const all = Array.from(kb._entries.values());
const ofDomain = (d) => all.filter(e => e.domain === d);
const hasThai = (s) => /[ก-๙]/.test(s);
const hasEN = (s) => /\(EN: /.test(s);
const hasZH = (s) => /\(ZH: /.test(s);
/* statistics patterns = same as smoke-knowledge-pillars (fabricated data ban) */
const FABRICATED = [
  /\d+(\.\d+)?\s?%/, /\$\s?\d/, /\d+\s?(ล้าน|พันล้าน|million|billion|baskets)/i,
  /\d+(\.\d+)?\s?(USD|EUR|GBP|THB|CNY|บาท|元|美元)/,
];
const ALLOWED_SMALL = /(1|2|3|4)(-(1|2|3|4))?(\s?(ห้อง|สัปดาห์|เพลง|ครั้ง|รอบ|ขั้น|บรรทัด|นาที|ชิ้น|สาย|ทาง|แบบ|วัน|บท)?|-)([^0-9]|$)/;

console.log("smoke-coverage-wave (docs/16 §3 / m52):\n");

console.log("1) ความลึกของ 3 หมวดบาง (wave 1 + wave 2)");
const DEPTH = [["music-marketing", 16], ["innovation", 16], ["music-therapy", 16]];
for (const [d, min] of DEPTH) {
  const n = ofDomain(d).length;
  n >= min ? ok(`${d}: ${n} entries (≥ ${min})`) : bad(`${d}: ${n} entries < ${min}`);
}

console.log("\n2) รูปแบบ entry ครบ (3 ภาษา · teach · แหล่ง tiga-* · ไม่มีตัวเลขแต่ง)");
let shapeBad = [], teachBad = [], srcBad = [], fabBad = [];
for (const [d] of DEPTH) {
  for (const e of ofDomain(d)) {
    if (!(hasThai(e.body) && hasEN(e.body) && hasZH(e.body))) shapeBad.push(e.id);
    if (!e.teach) teachBad.push(e.id);
    if (!String(e.source || "").startsWith("tiga-")) srcBad.push(`${e.id}:${e.source}`);
    const bodyCore = e.body.replace(/\(EN: [^)]*\)/, "").replace(/\(ZH: [^)]*\)/, "");
    for (const re of FABRICATED) if (re.test(bodyCore) && !ALLOWED_SMALL.test(bodyCore)) { fabBad.push(`${e.id}:${re}`); break; }
  }
}
shapeBad.length === 0 ? ok("trilingual bodies ครบทุก entry ใน 3 หมวด") : bad(`ขาดภาษา ${shapeBad.length} entries (${shapeBad.slice(0, 2)})`);
teachBad.length === 0 ? ok("teach line ครบทุก entry") : bad(`ขาด teach: ${teachBad.slice(0, 3)}`);
srcBad.length === 0 ? ok("แหล่งที่มา tiga-* (own-work) ทุก entry — ผ่าน compliance A1") : bad(`แหล่งไม่ใช่ tiga-*: ${srcBad.slice(0, 3)}`);
fabBad.length === 0 ? ok("ไม่มีสถิติแต่งใน wave ใดเลย") : bad(`พบรูปแบบตัวเลขน่าสงสัย: ${fabBad.slice(0, 3)}`);

console.log("\n3) wave 2 ถึงมือจริง (ids จาก batch ล่าสุด)");
const SAMPLE = [
  "mkt:world:benchmark-not-copy", "mkt:world:know-your-audience",
  "inn:world:light-guided-keys", "inn:world:community-platforms-learning",
  "thx:world:pause-and-silence", "thx:world:song-as-companion",
];
const missingIds = SAMPLE.filter(id => !kb._entries.has(id));
missingIds.length === 0 ? ok(`ids ครบ ${SAMPLE.length}/${SAMPLE.length}`) : bad(`หา ids ไม่เจอ: ${missingIds.join(", ")}`);

console.log("\n4) กรอบ wellbeing ยังอยู่ครบทุก therapy entry");
const thx = ofDomain("music-therapy");
const noFrame = thx.filter(e => !/wellbeing frame|กรอบ wellbeing/.test(e.body));
noFrame.length === 0 ? ok(`กรอบ wellbeing ${thx.length}/${thx.length} (รวม entry เดิม + wave ใหม่)`) : bad(`${noFrame.length} entries ไม่มีกรอบ (${noFrame.slice(0, 2).map(e => e.id)})`);

console.log("\n5) เสิร์ฟได้จริง + retrieval probes ของหมวดใหม่ผ่าน");
const serveCases = [
  { q: "อยากทำคลิปโปรโมทคอร์สให้มีคนรู้จัก", label: "MUSIC MARKETING" },
  { q: "นวัตกรรมช่วยเรียนเปียโนยังไงบ้าง", label: "MUSIC INNOVATION" },
  { q: "ดนตรีบำบัดกับสุขภาวะในการเรียน", label: "MUSIC THERAPY" },
];
for (const c of serveCases) {
  const labels = retr.servedLabels(web.getKBContext(c.q));
  labels.has(c.label) ? ok(`คำถามจริงเสิร์ฟ [${c.label}]`) : bad(`คำถามจริงไม่เสิร์ฟ [${c.label}] (ได้: ${[...labels].join(",") || "none"})`);
}
const NEW_PROBES = ["innovation-th", "innovation-en", "marketing-th", "marketing-en", "therapy-th", "therapy-en"];
const probes = retr.RETRIEVAL_PROBES.filter(p => NEW_PROBES.includes(p.id));
const scored = probes.map(p => retr.scoreRetrieval(p, retr.servedLabels(web.getKBContext(p.q))));
const probeAcc = scored.length ? scored.filter(s => s === 1).length / scored.length : 0;
probeAcc === 1 && probes.length === NEW_PROBES.length
  ? ok(`new-domain probes ${probes.length}/${NEW_PROBES.length} ผ่าน 100% (production path)`)
  : bad(`new-domain probes ${(probeAcc * 100).toFixed(0)}% (${scored.map((s, i) => `${probes[i].id}=${s}`).join(" ")})`);

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
