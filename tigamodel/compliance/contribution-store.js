/* ── tigamodel/compliance/contribution-store.js — docs/09 layer 1 (m26) ──
   The STORE side of contributed knowledge: turning a reviewed submission into
   the row the table holds, and the rules about who may move that row.

   m25 (contribution-gate.js) decides legality and format. This module never
   re-decides anything: it takes the gate's verdict, shapes the row, and
   refuses the two things the design forbids —
     1. a CLIENT choosing a status. `submissionToRow` always writes
        status 'pending', whatever the caller passed; approval happens only
        through admin_moderate_contribution() on the server.
     2. a MODEL approving. `canModerate` reads the caller's admin tier, not
        anything the caller may assert, and moderation without a written
        reason is refused — the contributor can always read why.

   Pure + deterministic (no clock, no network, no database): the DB calls live
   in supabase-knowledge-contributions-migration.sql, which is written but NOT
   applied — an owner approval is required before it touches the project. ── */

import { reviewContribution } from "./contribution-gate.js";

export const CONTRIBUTION_STATUSES = ["pending", "approved", "rejected"];
export const DECIDABLE_STATUSES = ["approved", "rejected"];
export const MIN_ADMIN_TIER = 1;   // matches every other admin RPC in the project

/* The gate's reasons are the audit trail; keep them as a real array, and never
   lose one to a string coercion. */
export function reasonsOf(review) {
  try {
    const r = review && review.reasons;
    return Array.isArray(r) ? r.filter(x => typeof x === "string" && x.trim()) : [];
  } catch (e) { return []; }
}

/* The row a client insert may produce. `sub` is the reviewContribution input;
   `review` is its verdict (pass the review in when you already have one —
   this function never re-runs the gate). */
export function submissionToRow(sub, review) {
  const c = (sub && sub.content) || {};
  const src = (sub && sub.source) || {};
  const who = (sub && sub.contributor) || {};
  const rev = review && typeof review === "object" ? review : reviewContribution(sub);
  const rejected = rev.verdict !== "clean";
  return {
    contributor_id: who.id || null,
    title: String(c.title || "").trim(),
    body: String(c.body || "").trim(),
    teach: c.teach ? String(c.teach) : null,
    domain: String(c.domain || "pedagogy"),
    license: String((sub && sub.license) || ""),
    source_kind: String(src.kind || ""),
    source_url: src.url ? String(src.url) : null,
    source_excerpt: src.excerpt ? String(src.excerpt) : null,
    gate_verdict: rejected ? "rejected" : "clean",
    gate_reasons: reasonsOf(rev),
    gate_checks: (rev && rev.checks) || {},
    /* the one rule this function exists to enforce: a client row is ALWAYS
       pending. Anything the caller passed is dropped on the floor. */
    status: "pending",
  };
}

/* Human-readable "can this person moderate?" — admin tier only. */
export function canModerate({ adminTier } = {}) {
  const t = typeof adminTier === "number" && Number.isFinite(adminTier) ? adminTier : 0;
  return t >= MIN_ADMIN_TIER;
}

/* The decision a moderator is about to make, validated locally before it costs
   a round-trip: a real status, a written reason, a real id. Returns
   { ok, args } or { ok:false, reason } — the caller shows `reason` verbatim. */
export function moderateArgs(id, status, note, { adminTier } = {}) {
  if (!canModerate({ adminTier })) return { ok: false, reason: "admin only" };
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, reason: "contribution id is required" };
  }
  if (!DECIDABLE_STATUSES.includes(status)) {
    return { ok: false, reason: "status must be approved or rejected" };
  }
  const why = String(note == null ? "" : note).trim();
  if (!why) return { ok: false, reason: "a written reason is required" };
  return { ok: true, args: { p_id: id, p_status: status, p_note: why } };
}

/* Queue health for the admin page, from the rows it can see. Counts only what
   is there: an empty queue is 0 pending, not "everything is fine". */
export function queueStats(rows) {
  const out = { pending: 0, approved: 0, rejected: 0, unknown: 0, total: 0, needsAttention: 0 };
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    out.total++;
    const s = String(r.status || "");
    if (CONTRIBUTION_STATUSES.includes(s)) out[s]++;
    else out.unknown++;
    /* a gate-rejected row sitting in the queue still needs a human to look at
       it — the gate says "not clean", only a person may close it */
    if (s === "pending" && r.gate_verdict === "rejected") out.needsAttention++;
  }
  return out;
}

/* ── m27: the credit the contributor keeps forever ──
   A contributed entry cites `contrib:<id>:<title>` — which kb-compliance would
   flag as an untraceable source unless that id is REGISTERED. So an approved
   row becomes two things at once: a registered source carrying the author's
   name (the provenance the UI shows) and the KB entry that cites it. The
   author's name is part of the source record, not a comment — that is what
   makes "โดย <ชื่อ>" permanent rather than a promise. */
export function sourceIdFor(row) {
  const id = row && row.contributor_id;
  const title = String((row && row.title) || "").trim().slice(0, 24);
  if (!id || !title) return null;
  /* the gate's own two conventions, mirrored exactly: own-work is our own
     reasoning (tiga-*), a public-fact claim cites the public source and needs
     a registered record. Guessing an id here would orphan the entry. */
  const ownWork = String(row.source_kind || "") === "own-work"
    && ["contributor-own-work", "cc0", "public-domain"].includes(String(row.license || ""));
  return ownWork ? `tiga-contrib:${id}` : `contrib:${id}:${title}`;
}

/* the registry entry (SOURCES shape) — null when the row cannot carry credit */
export function creditSourceFor(row, { site = "tiga contributors", sourceId = null } = {}) {
  const id = sourceId || sourceIdFor(row);
  if (!id || !String((row && row.license) || "").trim()) return null;
  const name = String((row && row.contributor_name) || "").trim();
  const who = name || "ผู้ร่วมสร้างที่ไม่ระบุชื่อ";
  return {
    [id]: {
      title: `${who} — ${String(row.title).trim()}`,
      url: row.source_url ? String(row.source_url) : null,
      site,
      institution: "TIGA contributors",
      read_at: "contributed",
      reliability: "contributed",
      license: String(row.license).trim(),
      contributor_id: String(row.contributor_id),
      contributor_name: name || null,
      /* public-fact: the excerpt the contributor declared is the evidence the
         verbatim check runs against — the same record shape as every
         registered source */
      notes: row.source_excerpt ? String(row.source_excerpt) : null,
    },
  };
}

/* the KB entry an APPROVED row becomes, plus the registry it needs — returns
   null for anything not approved: credit is earned by the decision, not by the
   submission. */
export function creditedEntryFor(row, review) {
  if (!row || row.status !== "approved") return null;
  const rev = review && typeof review === "object" ? review : reviewContribution({ content: row, license: row.license, source: { kind: row.source_kind, url: row.source_url, excerpt: row.source_excerpt }, contributor: { id: row.contributor_id, name: row.contributor_name } });
  if (!rev || rev.verdict !== "clean") return null;
  const entry = rev.entry;
  if (!entry || !entry.source_id) return null;
  /* keyed by the id the GATE chose, never a re-derived one */
  const sources = creditSourceFor(row, { sourceId: entry.source_id }) || {};
  return {
    entry: { id: entry.source_id, domain: entry.domain, title: entry.title, body: entry.body, teach: entry.teach, source: entry.source_id },
    sources,
    label: { th: `โดย ${row.contributor_name || "ผู้ร่วมสร้าง"}`, en: `by ${row.contributor_name || "a contributor"}`, zh: `来自 ${row.contributor_name || "贡献者"}` },
  };
}

/* The one thing a moderator must never do: approve something the gate rejected,
   or approve a row with no contributor attached. Checked client-side so the UI
   cannot even offer the button; the server re-checks what it must. */
export function approvalBlockers(row) {
  const out = [];
  if (!row || typeof row !== "object") return ["no contribution"];
  if (row.gate_verdict === "rejected") out.push("ผ่านประตูรับความรู้ไม่ผ่าน — ต้องแก้ต้นทางก่อนอนุมัติ");
  if (!row.contributor_id) out.push("ไม่มีผู้ส่งระบุ (ต้องรู้ว่าใครเป็นเจ้าของความรู้)");
  if (!String(row.license || "").trim()) out.push("ไม่มี license ที่ผู้ส่งประกาศ");
  if (out.length) out.push("ทั้งหมดนี้ต้องแก้ที่ต้นทาง — ฝั่งผู้ดูแลเลือก 'ปฏิเสธ' พร้อมเหตุผลได้");
  return out;
}