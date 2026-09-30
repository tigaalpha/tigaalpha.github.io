/* ── tigamodel/teaching/skill-state-wiring.js — docs/12 §1A (m39) ──
   THE WIRE for loop A of the compound plan: real per-skill ability states →
   the already-shipped personalized-plan brain (skill-state-plans.js).

   Responsibilities (and nothing more):
   * fetchSkillStates(sb) — read the signed-in learner's rows from
     learner_skill_state via a plain select (RLS scopes rows to the caller;
     the client never sees anyone else's). Never throws: any error → null.
   * toAbilities(rows) — pure shape conversion DB row → the ability array
     buildPersonalizedPlan already consumes. Bad rows are skipped, never guessed.
   * planForLearner(...) — the end-to-end call a UI surface makes:
     switch on? real data? → plan; ANYTHING missing (switch off, no rows,
     low confidence everywhere, error) → null = the caller keeps doing
     exactly what it does today. The wire can only ADD a plan on top of a
     good state — it can never degrade the existing experience.

   Kill switch: tiga_personalized_plans (skill-state-plans.js SWITCH_KEY)
   is checked INSIDE planForLearner — callers can't forget to gate.
   Pure + sync except the fetch itself; no writes anywhere. ── */

import { buildPersonalizedPlan, SWITCH_KEY } from "./skill-state-plans.js";

/* fetchSkillStates(sb) → [{ skill, ability, confidence, ... }] | null
   sb = the app's supabase client. Reads only the signed-in learner's own
   rows (RLS enforced server-side). Any error/odd shape → null (never a
   fabricated row, never a throw into the caller's render path). */
export async function fetchSkillStates(sb) {
  try {
    if (!sb || typeof sb.from !== "function") return null;
    const r = await sb.from("learner_skill_state").select("skill,ability,confidence,evidence_count,trend,difficulty_current,difficulty_recommended");
    if (!r || r.error) return null;
    if (!Array.isArray(r.data)) return null;
    return r.data;
  } catch (e) { return null; }
}

/* toAbilities(rows) → [{ skill_id, ability, confidence }] — the exact shape
   buildPersonalizedPlan consumes (its convention is skill_id). Rows that are
   not usable (missing skill, non-numeric ability) are SKIPPED, never coerced
   into fake data. */
export function toAbilities(rows) {
  try {
    if (!Array.isArray(rows)) return null;
    const out = [];
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      const skill = typeof r.skill === "string" ? r.skill.trim() : "";
      if (!skill) continue;
      const a = r.ability;
      if (typeof a !== "number" || !Number.isFinite(a)) continue;
      out.push({
        skill_id: skill,
        ability: Math.max(0, Math.min(1, a)),
        confidence: typeof r.confidence === "number" && Number.isFinite(r.confidence) ? Math.max(0, Math.min(1, r.confidence)) : 0,
      });
    }
    return out.length ? out : null; // no usable rows → null (no data ≠ zero ability)
  } catch (e) { return null; }
}

/* planForLearner({ sb, drills, switchOn, minutes }) → plan | null
   - sb: supabase client (or null) — used only for the read
   - drills: the drill pool (unchanged shape from skill-state-plans.js)
   - switchOn: the tiga_personalized_plans app_settings value (default false)
   Returns null (keep today's behavior) unless EVERYTHING lines up:
   switch on + real rows + at least one usable ability. Then the real brain
   builds the plan — this module adds no logic of its own. */
export async function planForLearner({ sb = null, drills = null, switchOn = false, minutes = 20 } = {}) {
  try {
    if (switchOn !== true) return null;              // kill switch, checked here too
    if (!drills || !Array.isArray(drills) || !drills.length) return null;
    const rows = await fetchSkillStates(sb);
    if (!rows) return null;                          // no data → no guess
    const abilities = toAbilities(rows);
    if (!abilities) return null;
    return buildPersonalizedPlan(abilities, drills, { switchOn: true, minutes });
  } catch (e) { return null; }
}

export const SKILL_STATE_WIRING_SWITCH = SWITCH_KEY; // single source of truth
