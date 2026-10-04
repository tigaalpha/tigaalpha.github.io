/* ── tigamodel/performance/kb-hot-path.js — docs/10 §1.3 (m34) / docs/14 §2 ──
   Speed AND quality from the same mechanism: today getKBContext() serves EVERY
   entry of every matched domain — measured 2026-09-30 on the real seed, one
   harmony question ships 1,383,891 chars (12,615 entries, 73.6% of the whole
   KB) in ~5.6ms of string-building alone. No model can read a block that
   size, so most of those chars are pure waste — slow AND less useful.

   The hot path keeps the KB's content byte-identical and changes only WHAT
   GETS SERVED: entries are ranked by real relevance to the student's message
   (the same keyword table the domain match used) + a bounded hot-count boost
   (what this app actually serves often), then hard-capped at maxLines and
   maxChars per message. Fewer, more-relevant lines = faster block AND a
   teacher prompt with higher signal density.

   PERFORMANCE CONTRACT (measured, not vibes): full ranking is computed ONCE
   per unique keyword set and cached (bounded); each message then walks the
   cached relevance levels lazily — memoized lowercase haystacks (WeakMap), no
   per-message concat/lowercase of 12k entries, no per-message full sort.
   Measured on the real seed: the harmony path drops from ~5.6ms to
   sub-millisecond per message with the caps on.

   Hard rules (steel rules 5 + 8, docs/10 §2):
   * Kill switch INSIDE the module (tiga_kb_hot_path): disabled → select()
     returns null and the caller serves the legacy block untouched. Nothing
     is recorded, nothing changes, zero risk by construction.
   * Content is never rewritten: lines use the exact legacy template, only
     their selection/order changes. Retrieval gate stays the law (smoke runs
     all 24 probes with the hot path ON — must stay ≥80%, measured 100%).
   * Deterministic: same inputs → same lines, every time (explicit
     comparators, no localeCompare, no clock, no randomness; caches are keyed
     by content, bounded, and eviction is deterministic given the call
     sequence).
   * Bounded: maxLines + maxChars per message, hot counts grow only by real
     serves, base cache bounded at 64 keyword sets — no unbounded growth on a
     learner's device.
   * Pure + sync; malformed input is skipped (never throws).

   Honest label: the caps mean the model sees a SELECTION of the KB, not all
   of it. That is the point — a capped, on-topic block teaches better than a
   1.38 MB dump nobody reads. ── */

export const KB_HOT_PATH_DEFAULTS = {
  maxLines: 24,     // per message, across all matched domains (round-robin so every matched domain is represented)
  maxChars: 8000,   // hard cap on the joined line text (header excluded)
  hotBoostMax: 1.0, // max score added by hot counts (bounded — always below one keyword hit, which is 2)
};

/* Kill switch key (steel rule 5) — app_settings.tiga_kb_hot_path. The module
   itself defaults OFF; wiring reads the switch and calls setEnabled, the same
   convention as the answer cache (m32). */
export const KB_HOT_PATH_SWITCH = "tiga_kb_hot_path";

/* The exact legacy line template from getKBContext (web.js). Entries the
   legacy path could never serve (no `teach`) fall back to `body` — kept
   deterministic, never dropped silently. */
export function hotPathLine(entry, label) {
  const e = entry || {};
  const teach = e.teach != null && String(e.teach).trim() !== "" ? String(e.teach) : String(e.body || "");
  return `• [${label}] ${e.title} — วิธีสอน: ${teach}`;
}

/* Relevance score of one entry against the message's keyword table plus the
   bounded hot-count boost. Pure arithmetic; keywords are lowercase.
   Reference implementation — the instance's select() uses the same math over
   memoized haystacks (identical results, no per-call rebuild). */
export function scoreKBEntry(entry, keywords, hotCount, hotBoostMax) {
  try {
    const e = entry || {};
    const hay = `${e.title || ""} ${e.body || ""} ${e.teach || ""}`.toLowerCase();
    let s = 0;
    if (Array.isArray(keywords)) {
      for (let i = 0; i < keywords.length; i++) {
        const k = keywords[i];
        if (k && hay.includes(k)) s += 2;
      }
    }
    const hot = Number(hotCount) || 0;
    if (hot > 0) s += Math.min(hot, 50) / 50 * (Number(hotBoostMax) || KB_HOT_PATH_DEFAULTS.hotBoostMax);
    return s;
  } catch (err) { return 0; }
}

/* Byte-deterministic string compare (localeCompare is locale-dependent). */
function cmpStr(a, b) {
  const x = String(a || ""), y = String(b || "");
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

/* Rank one domain's entries: relevance desc → hot desc → title asc → id asc.
   Order-stable and fully deterministic. Reference implementation for small
   arrays (smokes); select() uses the cached-level equivalent below. */
export function rankKBEntries(entries, keywords, hotCounts, hotBoostMax) {
  const list = Array.isArray(entries) ? entries : [];
  const hot = hotCounts || new Map();
  return list
    .map(e => ({ e, s: scoreKBEntry(e, keywords, hot.get(e && e.id) || 0, hotBoostMax) }))
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      const hd = ((hot.get(a.e && a.id) || 0) - (hot.get(b.e && b.id) || 0));
      if (hd !== 0) return -hd;
      const t = cmpStr(a.e && a.e.title, b.e && b.e.title);
      if (t !== 0) return t;
      return cmpStr(a.e && a.e.id, b.e && b.e.id);
    })
    .map(x => x.e);
}

/* createKBHotPath({ maxLines, maxChars, enabled }) — the selection engine.
   select() returns null when the switch is OFF (caller serves legacy) or when
   nothing fits; otherwise { lines, chars, byDomain, picked }. recordServed()
   feeds the hot counts (only meaningful while enabled). */
export function createKBHotPath(opts = {}) {
  const clampPos = (v, dflt) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : dflt);
  const cfg = {
    maxLines: clampPos(opts.maxLines, KB_HOT_PATH_DEFAULTS.maxLines),
    maxChars: clampPos(opts.maxChars, KB_HOT_PATH_DEFAULTS.maxChars),
    hotBoostMax: Number.isFinite(opts.hotBoostMax) && opts.hotBoostMax >= 0 ? opts.hotBoostMax : KB_HOT_PATH_DEFAULTS.hotBoostMax,
  };
  const hot = new Map();  // entry id → serve count (grows only by real serves while enabled)
  const HOT_PERSIST_MAX = 200; // m45: bounded on-disk hot list (ids + counts only)
  const hayMemo = new WeakMap(); // entry object → memoized lowercase haystack (performance contract)
  const baseCache = new Map();   // cacheKey → { levels: [{ s, entries[] }] } — one full ranking per keyword set
  const BASE_CACHE_MAX = 64;

  let enabled = opts.enabled === true; // DEFAULT OFF — zero-risk by construction

  function setEnabled(v) { enabled = v === true; }
  function isEnabled() { return enabled; }
  function clearHot() { hot.clear(); }
  function hotCount(id) { return hot.get(id) || 0; }
  function recordServed(ids) {
    try {
      if (!enabled || !Array.isArray(ids)) return false;
      for (const id of ids) { if (id != null) hot.set(id, (hot.get(id) || 0) + 1); }
      return true;
    } catch (e) { return false; }
  }

  function hayOf(e) {
    let h = hayMemo.get(e);
    if (h === undefined) {
      h = `${e.title || ""} ${e.body || ""} ${e.teach || ""}`.toLowerCase();
      hayMemo.set(e, h);
    }
    return h;
  }

  /* plan 21 §V1 follow-up — this score is why the capped block was less on-topic
     than the whole-domain one, and the cause is not the cap. Every entry
     carries a `teach` field, and the KB contains whole families of
     knowledge-CHECK entries ("A อยู่ในคอร์ด C ไหม", "…อยู่ในคอร์ด Bbmin ไหม")
     whose teach text mentions the very keyword the question fired. Twenty of
     those scored exactly like a real teaching line, filled all 24 slots, and
     pushed out the lines that answer "what is a 7th chord inversion".

     Dropping `teach` from the score entirely was tried first and is wrong the
     other way: on sight-th it demoted every legitimate "อ่านโน้ต ระดับ N"
     entry (the level number IS the teaching) and the block fell to 50%.

     So a check entry scores from its TITLE only. That is the field that says
     what the entry is: "อยู่ในคอร์ด … ไหม" is a question the tutor asks, and
     asking is not teaching. "อ่านโน้ต ระดับ 10" is a topic the tutor covers,
     and keeps its score from the teach field as before. Weight 2 is unchanged
     because the hot boost's documented contract is "below one keyword hit". */
  function relScoreOf(e, keywords) {
    const title = String(e.title || "").toLowerCase();
    const teach = String(e.teach || "").toLowerCase();
    const isCheck = /[?？]\s*$/.test(title) || /ไหม\s*$/.test(title);
    let s = 0;
    for (let i = 0; i < keywords.length; i++) {
      const k = keywords[i];
      if (!k) continue;
      if (title.includes(k)) s += 2;
      else if (!isCheck && teach.includes(k)) s += 2;
    }
    return s;
  }

  /* One full ranking per unique keyword set: entries grouped by relevance
     score, each group pre-sorted title asc → id asc (deterministic). */
  function baseFor(cacheKey, entries, keywords) {
    let base = baseCache.get(cacheKey);
    if (base) return base;
    const groups = new Map(); // s → entries[]
    for (const e of entries) {
      const s = relScoreOf(e, keywords);
      let arr = groups.get(s);
      if (!arr) { arr = []; groups.set(s, arr); }
      arr.push(e);
    }
    const levels = [...groups.entries()]
      .map(([s, arr]) => ({ s, entries: arr.sort((a, b) => cmpStr(a.title, b.title) || cmpStr(a.id, b.id)) }))
      .sort((a, b) => b.s - a.s);
    if (baseCache.size >= BASE_CACHE_MAX) baseCache.clear(); // bounded, deterministic eviction
    baseCache.set(cacheKey, { levels });
    return baseCache.get(cacheKey);
  }

  /* Hot boost applied per level: hot entries first (hot desc → title → id),
     then the rest in cached order. Boost max (1.0) is always below one
     keyword hit (2), so ordering ACROSS levels never changes — the boost
     only reorders within a relevance level, exactly like the reference
     comparator. No full re-sort of the domain per message. */
  function levelOrder(level) {
    if (!hot.size) return level.entries;
    const hots = [];
    for (const e of level.entries) if (hot.has(e.id)) hots.push(e);
    if (!hots.length) return level.entries;
    hots.sort((a, b) => ((hot.get(b.id) || 0) - (hot.get(a.id) || 0)) || cmpStr(a.title, b.title) || cmpStr(a.id, b.id));
    return hots.concat(level.entries); // deduped by the seq cursor below
  }

  /* Lazy ordered sequence over one domain's levels — the round-robin walker
     pulls only what it serves, so untouched levels cost nothing. */
  function makeSeq(base) {
    let li = 0, ei = 0, cur = null, seen = new Set();
    return function next() {
      while (li < base.levels.length) {
        if (!cur) { cur = levelOrder(base.levels[li]); ei = 0; }
        while (ei < cur.length) {
          const e = cur[ei++];
          if (seen.has(e)) continue;
          seen.add(e);
          return e;
        }
        li++; cur = null;
      }
      return null;
    };
  }

  /* select({ domains, index, keywords, labelOf }) — ranked + capped lines.
     domains: ordered domain ids (caller's match order); index: Map(domain →
     entries[]); keywords: lowercase keywords of the matched domains;
     labelOf: domain → display label. Round-robin across domains so a huge
     domain can never crowd out the others; the char cap skips an entry that
     would not fit and tries the next one. */
  function select(args) {
    try {
      const { domains, index, keywords, labelOf } = args || {}; // destructure inside try — a null call is skipped, never thrown
      if (!enabled) return null;
      if (!Array.isArray(domains) || !domains.length || !(index instanceof Map)) return null;
      const kw = Array.isArray(keywords) ? keywords.map(k => String(k || "").toLowerCase()).filter(Boolean) : [];
      const cacheKey = domains.join("\u0000") + "\u0001" + kw.join("\u0002");
      const seqs = [];
      for (const d of domains) {
        const entries = index.get(d);
        if (!entries || !entries.length) continue;
        const label = labelOf ? String(labelOf(d) || d) : String(d);
        const base = baseFor(cacheKey + "\u0003" + d, entries, kw);
        // which entries the question actually matched, by the same score the
        // ranking used — pass 1 of the fill below serves only these
        /* "Matched" for the FILL decision is deliberately NOT "scored positive".
           relScoreOf credits title and teach, and a teaching note legitimately
           mentions เวที without answering anything about it: for "ขึ้นเล่นบนเวที
           แล้วใจสั่นมาก", 58 of 126 PERFORMANCE entries scored positive while only
           37 of those lines actually contain a fired keyword. Serving the other
           21 first is what left that block at 42% on-topic against 63% for the
           uncapped block.

           So this asks the question that decides service order: would this line
           READ as relevant — does a fired keyword appear in the line the tutor
           receives? Relevance SCORE still orders the matched ones among
           themselves; this only decides who is allowed in before the budget
           runs out, and a domain whose lines all miss is still served (never
           starved) because pass 2 and pass 3 are unconditional. */
        const hitIds = new Set();
        for (const lv of base.levels) for (const e of lv.entries) {
          if (!kw.length) { if (lv.s > 0) hitIds.add(e.id); continue; }
          if (kw.some(k => hotPathLine(e, label).toLowerCase().includes(k))) hitIds.add(e.id);
        }
        seqs.push({ domain: d, label, next: makeSeq(base), hitIds, unmatched: [] });
      }
      if (!seqs.length) return null;

      /* Two passes over the same domain sequences (plan 21 §V1 follow-up).
         The single-pass version filled the budget in relevance-level order per
         domain, but the round-robin then walked on into the level that has NO
         keyword at all while lines that DID match were still queued behind it —
         on performance-th that spent 14 of 24 slots on "2 สัปดาห์ก่อน…" and
         "การปรวด…" and left the block at 42% on-topic against 63% for the
         uncapped block it replaced.

         So: pass 1 serves only what the question actually matched (any entry
         with a keyword hit, in the existing relevance order). Pass 2 fills
         whatever room is left from the rest. A domain with fewer matches than
         the budget still gets topped up, so no domain starves — but a line the
         question had evidence for can never be crowded out by one it did not.
         The budget itself (maxLines/maxChars) is unchanged; this only decides
         what fills it first. */
      const picked = [];
      const byDomain = {};
      let chars = 0;
      const room = () => cfg.maxLines - picked.length && cfg.maxChars - chars > 0;
      const take = (c, wantMatch) => {
        while (room()) {
          const e = c.next();
          if (e == null) return false;
          const line = hotPathLine(e, c.label);
          const n = line.length + 1;
          if (chars + n > cfg.maxChars) continue;
          if (wantMatch && !c.hitIds.has(e.id)) { c.unmatched.push(e); continue; } // hold for pass 2
          picked.push({ entry: e, domain: c.domain, label: c.label, line });
          byDomain[c.domain] = (byDomain[c.domain] || 0) + 1;
          chars += n;
          return true;
        }
        return false;
      };
      /* pass 1 — every domain the question fired on gets served FIRST, one
         matched line each, before any domain may take a second. The original
         loop was round-robin, but only while each domain still had a matched
         line, so a domain with more matches than the whole budget (HARMONY
         served 40 lines uncapped) filled all 24 slots by itself and the second
         domain the question hit — ACCOMPANIMENT, from "เบส" — never appeared
         at all. One line each is the guarantee; the surplus is round-robin. */
      for (const c of seqs) {
        if (!room()) break;
        take(c, true);          // this domain's guaranteed first matched line
      }
      for (const c of seqs) {   // surplus, round-robin
        while (room()) { if (!take(c, true)) break; }
      }
      /* pass 2 — the budget is not full yet, so the question ran out of MATCHED
         lines before it ran out of room. Fill the rest from everything left,
         still round-robin, because a domain the question fired on must still
         appear: the earlier version of this guarded pass 2 with "skip a domain
         that already has a line", which silenced a second domain entirely and
         broke the multi-domain check in smoke-kb-hot-path.mjs. */
      for (const c of seqs) {
        for (const e of c.unmatched) {
          if (!room()) break;
          const line = hotPathLine(e, c.label);
          const n = line.length + 1;
          if (chars + n > cfg.maxChars) continue;
          picked.push({ entry: e, domain: c.domain, label: c.label, line });
          byDomain[c.domain] = (byDomain[c.domain] || 0) + 1;
          chars += n;
          break;
        }
      }
      for (const c of seqs) {
        while (room()) { if (!take(c, false)) break; }
      }
      if (!picked.length) return null;
      return {
        lines: picked.map(p => p.line),
        chars,
        byDomain,
        picked: picked.map(p => p.entry),
      };
    } catch (e) { return null; }
  }

  /* m45 (docs/14 §2): hot counts that survive a page reload. snapshotHot()
     exports the REAL serving order (highest count first, ties by id) capped at
     `max` entries; restoreHot() takes that list back. Nothing is invented —
     a count is only ever what recordServed() saw a real serve — and the input
     is validated (numbers only, positive, de-duplicated, bounded) so a
     corrupted store can never poison the ranking. */
  function snapshotHot(max = HOT_PERSIST_MAX) {
    try {
      const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : HOT_PERSIST_MAX;
      return [...hot.entries()]
        .map(([id, n]) => [String(id), n])
        .sort((a, b) => (b[1] - a[1]) || cmpStr(a[0], b[0]))
        .slice(0, cap);
    } catch (e) { return []; }
  }
  function restoreHot(list) {
    try {
      if (!enabled || !Array.isArray(list)) return 0;
      const cap = HOT_PERSIST_MAX;
      let restored = 0;
      for (const row of list.slice(0, cap)) {
        if (!Array.isArray(row) || row.length !== 2) continue;
        const id = String(row[0] == null ? "" : row[0]);
        const n = Number(row[1]);
        if (!id || !Number.isFinite(n) || n <= 0) continue;
        hot.set(id, Math.floor(n));
        restored++;
      }
      return restored;
    } catch (e) { return 0; }
  }

  function stats() {
    const top = [...hot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { enabled, hotEntries: hot.size, hotTop: top, cachedKeywordSets: baseCache.size, config: { ...cfg } };
  }

  return { select, recordServed, setEnabled, isEnabled, clearHot, hotCount, snapshotHot, restoreHot, stats, config: cfg };
}
