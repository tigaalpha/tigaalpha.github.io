/* ── tigamodel/roadmap-unified.js ──
   THE UNIFIED PLAN (owner directive: "รวมแผน 100 กับแผน 1,000,000 เป็น
   แผนเดียวกัน แผ่นใหญ่ไปเลย และทำให้ดีขึ้น").

   ONE SHEET, TWO GRAINS:
   • แผน 100 = 100 development STREAMS (world-class-teacher capabilities,
     each owned by a real module family in this repo)
   • แผน 1M = 1,000,000 deepening CELLS (T×W×H×M×S×Q spec-combinations)
   The bridge is mechanical and auditable: every stream declares which
   (t, m) route families it owns (routeFamilies), so:
     streamCells(n)  = all 1M cells the stream deepens (100 each)
     streamStatus(n) = derived from ITS OWN cells (done/partial/todo),
                       blended with the hand-set stream status — never a
                       bare tickbox
     workOrder()     = ONE ranked queue across both grains: done streams
                       contribute their deepest open cells; partial/todo
                       streams contribute the top cell of their weakest
                       capability (from the real capability engine)
   Every number traces back to real module state (capability engine +
   coverage modules + stream status). No invented progress. ── */

import { ROADMAP_GROUPS, roadmapAllItems, roadmapProgress } from "./roadmap-100.js";
import { PLM_DIMENSIONS, PLM_TOTAL, plmItem } from "./roadmap-1m.js";
import { createCapabilityEngine } from "./teaching/capability-engine.js";

/* ── Stream → route families it owns.
   t = WHAT topic (PLM_DIMENSIONS[0]). A stream owns ALL of its topic's cells
   across EVERY model layer (m 0-9) — e.g. "ความรู้ดนตรี" deepens theory cells
   in the KB layer, the reasoning layer, the prediction layer, … So:
     stream cells = |ts| × 100,000 (10 layers × 10 surfaces × 1,000 W×H×Q)
   and every cell of the 1M grid is owned by ≥1 stream (audited by smoke).
   Streams overlap by design (theory cells are also psychology cells) — the
   overlap IS the interdisciplinary depth. ── */
const ALL_M = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const STREAM_BRIDGE = {
  // ก ความรู้ดนตรี (KB): theory
  A: { ts: [0] },
  // ข คราฟต์การเล่น: technique + sight-reading craft
  B: { ts: [1, 2] },
  // ค คราฟต์ครู: expression/practice + performance stagecraft + generation layer
  C: { ts: [4, 5, 8] },
  // ง วิชาการเรียนรู้: learner psychology
  D: { ts: [6] },
  // จ โมเดลนักเรียน: aural + Thai/cultural music (the model knows the learner's ears AND their musical culture)
  E: { ts: [3, 7] },
  // ฉ วงจรสอน + นโยบาย: practice management + composition/improv (the loop owns creative work too)
  F: { ts: [5, 9] },
  // ช การประเมินผล: theory + practice (assessment needs both)
  G: { ts: [0, 5] },
  // ซ สัญญาณการเล่น: technique + aural (practice/play-along/camera/voice signals)
  H: { ts: [1, 3] },
  // ฌ ความจำระบบ (Memory & RAG): expression + theory memory
  I: { ts: [0, 4] },
};

/* ── internals ── */

let _engine = null;
function engine({ kbEntries } = {}) {
  if (!_engine || kbEntries) _engine = createCapabilityEngine({ kbEntries });
  return _engine;
}

function bridgeOf(id) {
  const b = STREAM_BRIDGE[id];
  if (!b) throw new Error(`unmapped stream group: ${id}`);
  return b;
}

/* roadmap-100 streams carry group = the Thai letter ("ก", "ข"…); the
   STREAM_BRIDGE keys use the group id ("A", "B"…) — map once, here. */
const GROUP_LETTER_TO_ID = Object.fromEntries(ROADMAP_GROUPS.map(g => [g.letter, g.id]));

function groupIdOf(stream) {
  const id = GROUP_LETTER_TO_ID[stream.group] || stream.group;
  if (!STREAM_BRIDGE[id]) throw new Error(`unmapped stream group: ${stream.group}`);
  return id;
}

/* every 1M cell (index) the stream deepens: its topics × ALL layers.
   Index layout: t*100000 + w*10000 + h*1000 + m*100 + s*10 + q — with (t, m)
   fixed, (w, h, s, q) vary over a STRIDED set (m is the 100s digit), so we
   enumerate w/h/s/q explicitly instead of slicing a contiguous block. */
function streamCellIndices(id) {
  const { ts } = bridgeOf(id);
  const idx = [];
  for (const t of ts) for (let w = 0; w < 10; w++) for (let h = 0; h < 10; h++) for (let m = 0; m < 10; m++) for (let s = 0; s < 10; s++) for (let q = 0; q < 10; q++) {
    idx.push(t * 100000 + w * 10000 + h * 1000 + m * 100 + s * 10 + q);
  }
  return idx; // ts.length × 100,000 cells
}

/* derive stream status from its cells' route readiness (capability engine):
   share of cells whose (t,m,s-route) readiness ≥ READY →
     ≥0.9 → done-shaped, ≥0.5 → partial-shaped, else todo-shaped */
function derivedShape(id, scoreRoute) {
  const { ts } = bridgeOf(id);
  let ready = 0, total = 0;
  const routeScores = [];
  for (const t of ts) for (const m of ALL_M) for (let s = 0; s < 10; s++) {
    const r = scoreRoute(t, m, s);
    routeScores.push(r.score);
    total++;
    if (r.score >= 0.7) ready++;
  }
  const share = total ? ready / total : 0;
  const shape = share >= 0.9 ? "done" : share >= 0.5 ? "partial" : "todo";
  return { shape, routeShare: Math.round(share * 1000) / 1000, avgRoute: routeScores.reduce((a, b) => a + b, 0) / (routeScores.length || 1) };
}

/* blend: the hand-set status (what humans shipped) with the derived shape
   (what the engine verifies) — the unified status is the WEAKER of the two,
   so a "done" tick without real capability never shows as done */
function unifiedStatus(handSet, derivedShape_) {
  const rank = { todo: 0, partial: 1, done: 2 };
  return rank[handSet] <= rank[derivedShape_] ? handSet : derivedShape_;
}

/* the weakest capability across a stream's routes → the NEXT deepening work */
function weakestCapability(id, scoreRoute) {
  const { ts } = bridgeOf(id);
  const totals = {};
  for (const t of ts) for (const m of ALL_M) for (let s = 0; s < 10; s++) {
    const { parts } = scoreRoute(t, m, s);
    for (const [c, v] of Object.entries(parts)) {
      totals[c] = totals[c] || { sum: 0, n: 0 };
      totals[c].sum += v; totals[c].n++;
    }
  }
  const avg = Object.entries(totals).map(([c, { sum, n }]) => [c, sum / n]);
  avg.sort((a, b) => a[1] - b[1]);
  return avg[0] ? { cap: avg[0][0], score: Math.round(avg[0][1] * 1000) / 1000 } : null;
}

/* ── public API ── */

export function createUnifiedPlan({ kbEntries = null } = {}) {
  const eng = engine({ kbEntries });
  /* route cache: scoreRoute is pure per (t,m,s) but NOT cheap (gen probe runs
     the generator) — memoize so 100 streams × their routes stays instant */
  const routeCache = new Map();
  const scoreRoute = (t, m, s) => {
    const key = t + ":" + m + ":" + s;
    if (!routeCache.has(key)) routeCache.set(key, eng.scoreRoute(t, m, s));
    return routeCache.get(key);
  };
  const streams = roadmapAllItems().map(it => ({ ...it, groupId: groupIdOf(it) }));
  const byN = new Map(streams.map(s => [s.n, s]));
  const groupStreams = (id) => streams.filter(s => s.groupId === id);

  /* one stream, fully resolved: unified status + its cells + next action */
  function stream(n) {
    const s = byN.get(Number(n));
    if (!s) return null;
    const derived = derivedShape(s.groupId, scoreRoute);
    const status = unifiedStatus(s.status, derived.shape);
    const weak = status === "done" ? null : weakestCapability(s.groupId, scoreRoute);
    // when every capability of the stream's routes is already ≥0.95 the next
    // work is NOT a capability fix — it is deepening the stream's own cells
    // (content/data depth per WHO/HOW/QUALITY), so say that honestly.
    const nextWork = !weak
      ? null
      : weak.score >= 0.95
        ? `เจาะลึกเนื้อหาของสตรีมนี้ (ครบทุกความสามารถแล้ว)`
        : `${weak.cap} (${weak.score})`;
    const cellCount = (() => { const { ts } = bridgeOf(s.groupId); return ts.length * 100000; })();
    return {
      ...s,
      status,
      handSetStatus: s.status,
      derivedShape: derived.shape,
      routeShare: derived.routeShare,
      avgRouteScore: Math.round(derived.avgRoute * 1000) / 1000,
      cells: cellCount,
      cellsOf: (depth) => streamCellIndices(s.groupId).slice(0, depth),
      nextWork,
    };
  }

  /* all streams resolved + per-group rollup */
  function allStreams() {
    return streams.map(s => stream(s.n));
  }

  function summary() {
    const all = allStreams();
    const by = (st) => all.filter(s => s.status === st).length;
    const cellsOwned = all.reduce((a, s) => a + s.cells, 0); // ≥ PLM_TOTAL (overlaps by design)
    return {
      streams: { total: all.length, done: by("done"), partial: by("partial"), todo: by("todo") },
      cells: { total: PLM_TOTAL, readyPct: eng.summary().readyPct, avgScore: eng.summary().avgScore, ownedByStreams: cellsOwned },
      streamsDonePct: Math.round((by("done") / all.length) * 1000) / 10,
      legacy: roadmapProgress(),
    };
  }

  /* THE ONE WORK ORDER: streams first (todo ⭐⭐⭐ → partial ⭐⭐⭐ → todo ⭐⭐ …),
     then done streams fall through to their deepest open cells. Merges the
     old "nextSprint" idea with the 1M rank order into one queue. */
  function workOrder(limit = 25) {
    const rankOf = (s) => {
      const statusW = s.status === "todo" ? 0 : s.status === "partial" ? 100 : 200;
      const starW = (4 - (s.stars || 1)) * 10;
      const weakW = s.avgRouteScore != null ? Math.round((1 - s.avgRouteScore) * 9) : 9;
      return statusW + starW + weakW;
    };
    return allStreams()
      .filter(s => s.status !== "done" || s.routeShare < 1)
      .map(s => ({ n: s.n, th: s.th, en: s.en, group: s.group, stars: s.stars, status: s.status, cells: s.cells, nextWork: s.nextWork, avgRouteScore: s.avgRouteScore, rank: rankOf(s) }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);
  }

  /* drill: the 1M cells behind one stream (resolved via plmItem) */
  function streamCells(n, { limit = 12, offset = 0 } = {}) {
    const s = byN.get(Number(n));
    if (!s) return { rows: [], total: 0, nextOffset: null };
    const all = streamCellIndices(s.groupId);
    const rows = all.slice(offset, offset + limit).map(i => {
      const it = plmItem(i);
      return it && { index: it.index, code: it.code, title: it.title, dims: it.dims, priority: it.priority, covered: it.covered };
    }).filter(Boolean);
    const next = offset + limit < all.length ? offset + limit : null;
    return { rows, total: all.length, nextOffset: next };
  }

  /* groups with per-stream unified statuses (renders exactly like the old
     roadmap tab, but each status now blends hand-set + engine-verified) */
  function groups() {
    return ROADMAP_GROUPS.map(g => ({
      ...g,
      items: groupStreams(g.id).map(s => stream(s.n)),
      rollup: {
        done: groupStreams(g.id).filter(s => stream(s.n).status === "done").length,
        partial: groupStreams(g.id).filter(s => stream(s.n).status === "partial").length,
        todo: groupStreams(g.id).filter(s => stream(s.n).status === "todo").length,
      },
    }));
  }

  return { stream, allStreams, summary, workOrder, streamCells, groups, engine: eng };
}
