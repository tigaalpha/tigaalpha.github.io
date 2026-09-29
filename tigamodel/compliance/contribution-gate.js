/* ── tigamodel/compliance/contribution-gate.js ──
   THE CONTRIBUTION GATE (docs/09 layer 1, m25): when teachers, academics,
   parents or institutions contribute knowledge, EVERY submission passes the
   same gate — legal cleanliness (docs/07) becomes a property of the
   PROCESS, not of our trust in people.

   A contribution = { content: {title, body, teach?, domain}, license,
                      source: {kind, url?, id?}, contributor: {id, name?} }

   Gate stages (all must pass; rejections always carry reasons):
     1. IDENTITY       — contributor must be identifiable (id), content non-empty
     2. LICENSE        — one of the accepted kinds, declared truthfully by the
                         contributor AND backed by a source when the kind
                         requires one
     3. SOURCE         — "own-work" needs no source; "public-fact" needs a
                         public URL; anything else (copyrighted work, unknown)
                         is rejected outright (steel rule 7)
     4. LEGAL SCANNER  — the real kb-compliance auditKB on a mini-KB made of
                         this entry against the registered SOURCES: verbatim
                         copy / endorsement phrasing / therapy-frame rules
     5. DETERMINISM    — same submission → same verdict (no clocks/randomness)

   Pure module: callers own persistence (m26 table), notifications and the
   admin decision UI — the gate never approves by itself; it only says
   "legal+format clean" or "rejected: reasons". Human/owner review remains
   the approval step (steel rule: owner decides what enters the KB). ── */

import { auditKB } from "./kb-compliance.js";

export const ACCEPTED_LICENSES = new Set([
  "contributor-own-work",      // ผู้ส่งเป็นเจ้าของเอง ให้สิทธิ์แก่เรา
  "public-domain",             // ข้อเท็จจริง/ทฤษฎีสาธารณะ
  "cc0",                       // เนื้อหาสาธารณะจริง
  "cc-by",                     // อ้างที่มาได้ = ใช้ได้
  "cc-by-sa",                  // อ้างที่มา + แบ่งปันเงื่อนไขเดียวกัน
]);

export const REJECT_REASONS = {
  IDENTITY: "ผู้ส่งต้องระบุตัวตน (contributor.id) — ระบบไม่รับข้อเสนอนิรนาม",
  EMPTY: "เนื้อหาว่างหรือไม่ครบ (ต้องมี title + body อย่างน้อย)",
  LICENSE: "license ต้องเป็นชนิดที่รับ: contributor-own-work / public-domain / cc0 / cc-by / cc-by-sa",
  LICENSE_SOURCE: "license ชนิดนี้ต้องมีแหล่งอ้างอิงกำกับ (source.url)",
  SOURCE_KIND: "kind ต้องเป็น own-work / public-fact เท่านั้น — ผลงานคุ้มครองลิขสิทธิ์ของผู้อื่นไม่รับ (กติกาเหล็ก 7)",
  SOURCE_URL: "public-fact ต้องแนบ URL สาธารณะที่ตรวจสอบได้",
  SOURCE_EXCERPT: "public-fact ต้องแนบ excerpt สั้น ๆ จากต้นฉบับ (หลักฐานอ้างอิง) เพื่อให้ระบบตรวจการถอดความได้",
  SCANNER: "ไม่ผ่านเครื่องตรวจกฎหมาย (ก๊อปยาว/อ้างเชิงพาณิชย์/หมวดสุขภาพไร้กรอบ)",
};

export function reviewContribution(sub, { sources = {} } = {}) {
  const reasons = [];
  if (!sub || typeof sub !== "object") return { verdict: "rejected", reasons: [REJECT_REASONS.IDENTITY], checks: {} };

  // 1 — identity + content
  const contributor = sub.contributor || {};
  if (!contributor.id) reasons.push(REJECT_REASONS.IDENTITY);
  const c = sub.content || {};
  const title = String(c.title || "").trim();
  const body = String(c.body || "").trim();
  if (!title || !body) reasons.push(REJECT_REASONS.EMPTY);

  // 2 — license kind
  const license = String(sub.license || "");
  if (!ACCEPTED_LICENSES.has(license)) reasons.push(REJECT_REASONS.LICENSE);

  // 3 — source kind + backing
  const src = sub.source || {};
  const kind = String(src.kind || "");
  let sourceId = null;
  if (license && ACCEPTED_LICENSES.has(license)) {
    if (kind === "own-work") {
      if (!license.startsWith("contributor-own-work") && license !== "cc0" && license !== "public-domain") {
        reasons.push(REJECT_REASONS.SOURCE_KIND);
      } else {
        sourceId = `tiga-contrib:${contributor.id}`;
      }
    } else if (kind === "public-fact") {
      const url = String(src.url || "");
      if (!/^https?:\/\//i.test(url)) reasons.push(REJECT_REASONS.SOURCE_URL);
      if ((license === "cc-by" || license === "cc-by-sa") && !url) reasons.push(REJECT_REASONS.LICENSE_SOURCE);
      /* a public-fact claim must attach the source EXCERPT it is based on —
         that excerpt is what the verbatim check runs against (a submission
         that paraphrases its own source passes; one that copies it flags).
         Missing excerpt = unverifiable claim = rejected. */
      const excerpt = String(src.excerpt || "").trim();
      if (!excerpt && reasons.length === 0) reasons.push(REJECT_REASONS.SOURCE_EXCERPT);
      if (reasons.length === 0) {
        sourceId = `contrib:${contributor.id}:${title.slice(0, 24)}`;
        sources = { ...sources, [sourceId]: { title: "contributed source", url, site: "contributed", read_at: "submitted", notes: excerpt } };
      }
    } else {
      reasons.push(REJECT_REASONS.SOURCE_KIND);
    }
  }

  // 4 — legal scanner on the would-be entry
  let checks = { attribution: 0, verbatim: 0, trademark: 0, therapy: 0 };
  if (reasons.length === 0) {
    const entry = {
      id: `contrib:${contributor.id}:${title.slice(0, 24)}`,
      domain: String(c.domain || "pedagogy"),
      title, body,
      teach: c.teach ? String(c.teach) : null,
      source: sourceId,
    };
    const rep = auditKB([entry], sources);
    checks = {
      attribution: rep.byCheck.attribution || 0,
      verbatim: (rep.byCheck["verbatim-en"] || 0) + (rep.byCheck["verbatim-thzh"] || 0),
      trademark: rep.byCheck.trademark || 0,
      therapy: (rep.byCheck["therapy-frame"] || 0) + (rep.byCheck["therapy-claim"] || 0),
    };
    if (!rep.clean) reasons.push(REJECT_REASONS.SCANNER);
  }

  return {
    verdict: reasons.length === 0 ? "clean" : "rejected",
    reasons,
    checks,
    entry: reasons.length === 0 ? { title, body, teach: c.teach || null, domain: c.domain || "pedagogy", source_id: sourceId, contributor: { id: contributor.id, name: contributor.name || null }, license } : null,
  };
}

/* Review a batch; per-item verdicts, never one bad apple poisoning the crate. */
export function reviewBatch(subs, opts = {}) {
  return (Array.isArray(subs) ? subs : []).map(s => reviewContribution(s, opts));
}
