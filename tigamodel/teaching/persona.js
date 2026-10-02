/* ── tigamodel/teaching/persona.js — docs/05 §5 (m31) ──
   THE TEACHER'S TONE is a parameter, not a new model.

   A learner who stops practising because "the teacher isn't for me" is the
   failure this milestone targets. The fix is deliberately small: the decision
   (which strategy to teach) stays EXACTLY where it was — the policy still
   decides, in the same order, with the same evidence. Only the voice around
   that decision changes, via a short lead line chosen per tone and language.

   Three tones, all teacher-voice, none of them a different model:
     warm    — acknowledges the effort first, then the step
     strict  — direct, no praise padding, the requirement stated plainly
     playful — light humour where it fits, never at the learner's expense

   Hard rules (steel rules 1/2/5/8):
     * Kill switch INSIDE the module (tiga_teacher_persona), DEFAULT OFF: with
       it off, decorate() returns the text byte-identical — the shipped path.
     * Additive only. The decoration never rewrites, trims or reorders the
       decision line, and never removes a sentence the safety rules rely on —
       so no tone can weaken "go and see a doctor" or the wellbeing frame.
     * Unknown tone / unknown language → the safe default (no lead line at all),
       never a guess at a missing translation.
     * Pure + deterministic: no clock, no randomness, no network. ── */

export const PERSONA_SWITCH = "tiga_teacher_persona";
export const PERSONAS = ["warm", "strict", "playful"];
export const DEFAULT_PERSONA = "warm";

/* The lead line per tone × language. Short on purpose: this is voice, not a
   second copy of the teaching content (which stays in teaching-loop's table). */
const LEAD = {
  warm: {
    th: "เห็นว่าตั้งใจมากเลยนะ",
    en: "I can see you're putting the work in.",
    zh: "看得出你很用心。",
  },
  strict: {
    th: "พูดตรง ๆ นะ:",
    en: "Straight talk:",
    zh: "直说：",
  },
  playful: {
    th: "มาลองกันเลย!",
    en: "Let's try this!",
    zh: "来试试！",
  },
};

export const LEAD_LINES = LEAD;

/* The line itself, or "" when there is honestly nothing to say (switch off,
   unknown tone, unknown language). Never a fallback translation. */
export function personaLead(persona, lang) {
  const p = PERSONAS.includes(persona) ? persona : null;
  if (!p) return "";
  const l = LEAD[p] && LEAD[p][lang];
  return typeof l === "string" ? l : "";
}

/* decorate(text, { persona, lang, enabled }) → the learner's line, in the
   teacher's chosen voice. OFF → the input, unchanged, character for character. */
export function decorate(text, { persona = DEFAULT_PERSONA, lang = "th", enabled = false } = {}) {
  const base = typeof text === "string" ? text : "";
  if (!enabled) return base;
  const lead = personaLead(persona, lang);
  if (!lead) return base;
  const body = base.trim();
  /* nothing to say → nothing said. A lead line on its own would be a
     sentence about tone with no teaching in it. */
  return body ? `${lead} ${body}` : base;
}

/* the one place that combines "is the switch on" with "which voice": every
   holder goes through here, so a caller can never apply a tone by accident */
function decorateWith(holder, text, persona, lang) {
  const base = typeof text === "string" ? text : "";
  if (!holder.isEnabled()) return base;
  const tone = PERSONAS.includes(persona) ? persona : holder.persona();
  return decorate(base, { persona: tone, lang, enabled: true });
}

/* A small holder so a caller can flip the switch at runtime (the Lab panel
   and any settings surface) without threading state through the loop. */
export function createPersona({ enabled = false, persona = DEFAULT_PERSONA } = {}) {
  let on = enabled === true;
  let p = PERSONAS.includes(persona) ? persona : DEFAULT_PERSONA;
  return {
    setEnabled(v) { on = v === true; return on; },
    isEnabled() { return on; },
    setPersona(v) { p = PERSONAS.includes(v) ? v : DEFAULT_PERSONA; return p; },
    persona() { return p; },
    decorate(text, lang = "th") { return decorateWith(this, text, p, lang); },
    /* what the UI should offer — never a persona outside the three, never one
       without a lead line in every shipped language */
    options() { return PERSONAS.map(id => ({ id, lead: LEAD[id] })); },
  };
}

/* The ONE switch state this module owns. Callers (the teaching loop, the Lab
   panel, settings) read and flip THIS holder — they cannot pass their own tone
   past it: applyPersona() below gates on it, so a caller who forgets to check
   still gets the shipped behaviour. That is the same "kill switch inside the
   module" rule the rest of the plan follows. */
const _shared = createPersona({ enabled: false });
export function teacherPersonaSwitch() { return _shared; }

/* What composeMessage calls: the switch decides whether the teacher speaks in
   a chosen voice; `persona` only picks WHICH voice, never whether. */
export function applyPersona(text, { persona = null, lang = "th" } = {}) {
  return decorateWith(_shared, text, persona, lang);
}

/* every tone must speak every shipped language, or the picker would show a
   dead option — used by the smoke and cheap enough to call at startup. */
export function personaCoverage() {
  const out = {};
  for (const id of PERSONAS) out[id] = Object.keys(LEAD[id] || {});
  return out;
}