/* ── tigamodel/hub.js — TIGA Capability Hub ──
   The ONE indirection the app speaks to. App surfaces ask the hub for an
   INTENT ("what clef should this student sight-read?", "explain this song
   result", "what's today's quest hint?") — never for a module by name.
   Engines register themselves under a domain; each intent consults its
   domains in priority order and falls back to a self-contained baseline.
   Consequences:

   * Register a smarter engine (or swap the foundation model) once → every
     surface that asked for that intent gets smarter with ZERO UI changes.
   * A missing engine degrades to the honest baseline — the app never
     breaks because a model piece is absent, and never invents data.
   * Every answer carries `via` (which engine produced it) so the back
     office can prove what is live.

   Nothing here touches the network, window, or localStorage — this file is
   pure JS, testable in Node, and the app singleton lives in web.js. ── */

export function createTigaHub({ kbEntries = null } = {}) {
  const engines = new Map();   // domain → engine object (latest registration wins)
  const engineMeta = new Map(); // domain → { note, at }
  const listeners = [];         // notified on every registration
  let kbIndex = kbEntries;
  let capEngine = null;         // teaching/capability-engine instance when kb known

  /* ── registration ── */
  function registerEngine(domain, engine, meta = {}) {
    if (!domain || !engine || typeof engine !== "object") return api;
    engines.set(domain, engine);
    engineMeta.set(domain, { note: meta.note || "", at: Date.now() });
    for (const fn of listeners) { try { fn(domain, engine); } catch (e) { /* listener bugs never break the hub */ } }
    return api;
  }
  function onEngineRegistered(fn) { if (typeof fn === "function") listeners.push(fn); return api; }
  function engineFor(domain) { return engines.get(domain) || null; }
  function setKnowledgeIndex(map) {
    kbIndex = map || kbIndex;
    try {
      // late import path is the caller's concern — the hub accepts a ready
      // createCapabilityEngine factory result instead when kb probing matters
      capEngine = null;
    } catch (e) { capEngine = null; }
    return api;
  }
  /* attach the real capability engine (web.js builds it with the seeded KB) */
  function attachCapabilityEngine(ce) { capEngine = ce || null; return api; }

  /* ── honest capability view (what the model can do RIGHT NOW) ── */
  function capability(name, route = {}) {
    const t = route.t | 0, m = route.m | 0, s = route.s | 0;
    if (capEngine) {
      try {
        const { score, parts } = capEngine.scoreRoute ? capEngine.scoreRoute(t, m, s) : { score: 0, parts: {} };
        return { name, status: score >= 0.7 ? "ready" : score > 0 ? "partial" : "absent", score: Math.round((score || 0) * 100), parts, via: "capability-engine" };
      } catch (e) { /* fall through */ }
    }
    // without the capability engine: report what actually answers intents
    const domains = INTENT_DOMAINS[name] || [];
    const live = domains.some(d => engines.has(d));
    return { name, status: live ? "ready" : "fallback", score: live ? 60 : 0, parts: {}, via: live ? "registered-engines" : "baseline" };
  }
  function summary() {
    const eng = [...engines.keys()].map(d => ({ domain: d, note: (engineMeta.get(d) || {}).note || "" }));
    const caps = Object.keys(INTENT_DOMAINS).map(n => capability(n));
    return {
      engines: eng,
      capabilities: caps,
      routes: capEngine && capEngine.summary ? capEngine.summary() : null,
    };
  }

  /* ── attempt helper: run fn, null on empty/throw. NEVER throws. ── */
  function attempt(fn) {
    try { const v = fn(); return v == null ? null : v; } catch (e) { return null; }
  }
  /* struggle entries are sometimes objects {label, acc, count} (diagnosis
     shape) and sometimes plain strings — always speak the label */
  function lbl(s) {
    if (s && typeof s === "object") return s.label || s.th || s.en || s.code || "";
    return typeof s === "string" ? s : "";
  }
  /* try each domain's handler until one returns a non-null answer */
  function route(domains, handler) {
    for (const d of domains) {
      const eng = engines.get(d);
      if (!eng) continue;
      const out = attempt(() => handler(eng, d));
      if (out != null) return { ...out, via: d };
    }
    return null;
  }

  /* ── intent 1: sight-reading setup (clef + level + why) ── */
  function recommendSightReading(memory, current = {}) {
    const hit = route(["skill-graph", "coach"], (eng) =>
      eng.recommendSightReading ? eng.recommendSightReading(memory, current) : null);
    if (hit) return hit;
    return baselineSight(memory, current);
  }
  function baselineSight(memory, current) {
    const struggles = ((memory && memory.struggles) || []).map(lbl).filter(Boolean);
    const mastered = (memory && memory.mastered) || [];
    const soft = typeof current.clef === "string" ? current.clef : "treble";
    const msg = struggles.length
      ? { th: `อ่านโน้ตชุดที่พลาดบ่อย (${struggles.slice(0, 2).join(", ")}) ก่อน — ครั้งนี้โฟกัสสายตาให้เร็วขึ้น`,
          en: `Drill the notes you miss most (${struggles.slice(0, 2).join(", ")}) — focus on faster recognition`,
          zh: `先练最容易错的音（${struggles.slice(0, 2).join("、")}）— 练更快识谱` }
      : mastered.length
        ? { th: "อ่านแม่นแล้ว — ลองโหมด sprint ให้จับเวลา 60 วินาที", en: "Reading is solid — try the 60-second sprint mode", zh: "识谱已稳 — 试试60秒冲刺模式" }
        : { th: "เริ่มจากเครื่องหมาย treble ชุดสั้น ๆ ก่อน", en: "Start with a short treble round", zh: "先从高音谱号短轮开始" };
    return { clef: soft, tip: msg, via: "baseline" };
  }

  /* ── intent 2: explain a song/run result (post-game coach line) ── */
  function explainSongResult(result, memory) {
    const hit = route(["coach", "diagnosis"], (eng) =>
      eng.explainSongResult ? eng.explainSongResult(result, memory) : null);
    if (hit) return hit;
    return baselineSong(result);
  }
  function baselineSong(result) {
    if (!result || typeof result !== "object") return null;
    const acc = typeof result.acc === "number" ? result.acc : (typeof result.accuracy === "number" ? result.accuracy : null);
    if (acc == null) return null;
    const stars = result.stars != null ? result.stars : (acc >= 95 ? 3 : acc >= 85 ? 2 : acc >= 70 ? 1 : 0);
    const line = stars >= 3
      ? { th: "🔥 ครบ 3 ดาว! รอบหน้าลองเปิดเมโทรนอมเร็วขึ้น 5 BPM", en: "🔥 3 stars! Next round, try +5 BPM on the metronome", zh: "🔥 三星！下次节拍器加快5" }
      : stars === 2
        ? { th: "👏 เกือบแล้ว — ซ้อมท่อนที่คอมโบหลุดอีก 2 รอบก็ได้ดาว", en: "👏 Almost — drill the combo-break spot twice more for the last star", zh: "👏 就差一点 — 再练两次断连处拿满星" }
        : { th: "🎯 ผ่อนความเร็วลง 15% แล้วซ้อมท่อนสั้น ๆ ที่พลาด กลับมาเต็มความเร็วหลังผ่าน 2 รอบ", en: "🎯 Slow to 85%, drill the missed short section, return to full speed after 2 clean passes", zh: "🎯 放慢15%练错段，两次全对后回原速" };
    return { tip: line, stars, acc, via: "baseline" };
  }

  /* ── intent 3: today's quest/mission hint (skill-graph aware) ── */
  function nextQuestHint(memory, profile) {
    const hit = route(["skill-graph", "teaching-loop"], (eng) =>
      eng.nextQuestHint ? eng.nextQuestHint(memory, profile) : null);
    if (hit) return hit;
    const struggles = ((memory && memory.struggles) || []).map(lbl).filter(Boolean);
    const mastered = (memory && memory.mastered) || [];
    const tip = struggles.length
      ? { th: `ภารกิจวันนี้: ซ้อมท่อนที่มี "${struggles[0]}" ให้ชนะ 1 รอบ`, en: `Today's quest: win one run of a piece containing "${struggles[0]}"`, zh: `今日任务：赢一局含“${struggles[0]}”的曲子` }
      : mastered.length >= 3
        ? { th: "ภารกิจวันนี้: ลองเพลงใหม่ที่ยากขึ้นหนึ่งระดับ", en: "Today's quest: try a song one level harder", zh: "今日任务：挑战难度高一级的新歌" }
        : { th: "ภารกิจวันนี้: จบซ้อม 3 รอบให้ครบ", en: "Today's quest: finish 3 practice rounds", zh: "今日任务：完成3次练习" };
    return { tip, via: "baseline" };
  }

  /* ── intent 4: learner summary (dashboard/profile lines) ── */
  function learnerSummary(memory, practiceLog, profile) {
    const hit = route(["diagnosis", "state-estimator"], (eng) =>
      eng.learnerSummary ? eng.learnerSummary(memory, practiceLog, profile) : null);
    if (hit) return hit;
    const log = practiceLog && typeof practiceLog === "object" ? practiceLog : {};
    const days = Object.values(log).filter(v => v && typeof v === "object");
    const accs = days.map(d => d.acc).filter(a => typeof a === "number");
    const avg = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null;
    const struggles = ((memory && memory.struggles) || []).map(lbl).filter(Boolean);
    const streak = profile && typeof profile.streak === "number" ? profile.streak : null;
    return {
      avgAcc: avg,
      rounds: accs.length,
      topStruggle: struggles[0] || null,
      streak,
      line: avg == null ? null : {
        th: `ความแม่นเฉลี่ย ${avg}% จาก ${accs.length} รอบซ้อม${struggles[0] ? ` · จุดต้องเก็บ: ${struggles[0]}` : ""}`,
        en: `${avg}% average accuracy over ${accs.length} rounds${struggles[0] ? ` · weak spot: ${struggles[0]}` : ""}`,
        zh: `平均准确率 ${avg}%（${accs.length} 次练习）${struggles[0] ? ` · 薄弱点：${struggles[0]}` : ""}`,
      },
      via: "baseline",
    };
  }

  /* ── intent 5: what the model gains when a NEW engine lands ──
     Surfaces can show "you now benefit from X" — makes model upgrades
     visible to users instead of silent. */
  function upgradesUnlocked(newDomain) {
    const unlocked = Object.entries(INTENT_DOMAINS)
      .filter(([, doms]) => doms.includes(newDomain))
      .map(([intent]) => intent);
    return { domain: newDomain, intents: unlocked };
  }

  /* domains each intent consults, in priority order — extend this table
     when a future model adds a domain, nothing else changes */
  const INTENT_DOMAINS = {
    "sight-reading": ["skill-graph", "coach"],
    "song-result": ["coach", "diagnosis"],
    "quest-hint": ["skill-graph", "teaching-loop"],
    "learner-summary": ["diagnosis", "state-estimator"],
  };

  const api = {
    registerEngine, onEngineRegistered, engineFor, setKnowledgeIndex, attachCapabilityEngine,
    capability, summary,
    recommendSightReading, explainSongResult, nextQuestHint, learnerSummary, upgradesUnlocked,
  };
  return api;
}
