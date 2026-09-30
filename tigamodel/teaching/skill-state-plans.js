/* ── tigamodel/teaching/skill-state-plans.js ──
   docs/05 §3 (plan-v3 m08): personalized practice plans from per-skill
   ability — the thinking core is shipped NOW and testable against fixtures,
   so when the learning-data tables start filling (owner runs the approved
   SQL) the only remaining work is a thin data adapter, not new thinking.

   Contract with the data layer (arrives via learning_update_skill_state,
   server-blended — the client NEVER writes absolute ability):
     ability = [{ skill_id, ability (0..1), confidence (0..1), updated_at }]
     drills  = [{ id, skill_id, level (1..5), title }]   (coach's own pool)

   Honest rules (docs/05 steel rules):
   - switch off / no data / no confidence → null → callers keep current plan
   - weakest skill picks the drill; ability <0.4 eases a level, >0.7 steps up
   - low confidence (<0.5) never drives a level change (observe, don't act)
   - deterministic: same inputs → same plan ── */

export const SWITCH_KEY = "tiga_personalized_plans";
export const EASE_BELOW = 0.4;
export const STEPUP_ABOVE = 0.7;
export const MIN_CONFIDENCE = 0.5;

/* The one decision the whole §3 hangs on: which skill to train, and at what
   level. Returns null when it would be guessing. */
export function pickDrillPlan(ability, drills, { e = EASE_BELOW, s = STEPUP_ABOVE, minConf = MIN_CONFIDENCE } = {}) {
  if (!Array.isArray(ability) || ability.length === 0) return null;
  if (!Array.isArray(drills) || drills.length === 0) return null;
  const scored = ability
    .filter(a => a && a.skill_id && Number.isFinite(a.ability))
    .map(a => ({ ...a, ability: Math.max(0, Math.min(1, a.ability)) }));
  if (scored.length === 0) return null;

  // weakest skill first; tie → lower confidence wins (needs attention more)
  const weakest = [...scored].sort((a, b) =>
    (a.ability - b.ability) || ((a.confidence ?? 0) - (b.confidence ?? 0))
  )[0];

  const pool = drills.filter(d => d && d.skill_id === weakest.skill_id && Number.isFinite(d.level));
  if (pool.length === 0) return null;

  const base = pool.reduce((m, d) => (Math.abs(d.level - 3) < Math.abs(m.level - 3) ? d : m), pool[0]);
  let level = base.level;
  const confident = (weakest.confidence ?? 0) >= minConf;
  if (confident && weakest.ability < e) level = Math.max(1, base.level - 1);       // ease
  else if (confident && weakest.ability > s) level = Math.min(5, base.level + 1);  // step up
  /* the pool doesn't carry every level — serve the CLOSEST level to the
     target (deterministic tie → lowest id), never crash, never null out a
     plan that had a servable drill */
  const drill = [...pool].sort((a, b) =>
    (Math.abs(a.level - level) - Math.abs(b.level - level)) || (a.id < b.id ? -1 : 1)
  )[0];
  return {
    skill_id: weakest.skill_id,
    ability: weakest.ability,
    confidence: weakest.confidence ?? 0,
    drill_id: drill.id,
    level: drill.level,
    adjust: level === base.level ? "hold" : (level < base.level ? "ease" : "step-up"),
    reason: confident
      ? (weakest.ability < e ? "ability ต่ำและมั่นใจพอ — ผ่อนระดับลง" : weakest.ability > s ? "ability สูงและมั่นใจพอ — ขยับระดับขึ้น" : "อยู่ช่วงเป้า — คงระดับ")
      : "confidence ต่ำ — สังเกตต่อ ไม่ปรับระดับ (สังเกต ≠ สรุป)",
  };
}

/* Full plan for a practice session: the drill plan + honest nulls when the
   switch or the data says "not yet". switchOn comes from the kill switch
   store (app_settings / localStorage adapter — data layer's choice). */
export function buildPersonalizedPlan(ability, drills, { switchOn = true, minutes = 20 } = {}) {
  if (!switchOn) return null;
  const plan = pickDrillPlan(ability, drills);
  if (!plan) return null;
  return { ...plan, minutes, generated_for: "practice-plan" };
}
