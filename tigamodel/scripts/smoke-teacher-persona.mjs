/* Smoke: the teacher's tone (docs/05 §5, m31) on the REAL modules —
   persona.js and the real composeMessage() inside teaching-loop.js.

   What must hold:
     A. the DECISION never changes with the tone — only the voice around it
     B. switch OFF (default) → the shipped text, character for character
     C. ON → a different tone gives a different line, and every tone keeps the
        decision's own content (additive, never a rewrite)
     D. no tone can weaken what the loop says about health: the doctor line
        and the wellbeing wording survive every persona
     E. unknown tone / unknown language → no invented lead line
     F. every shipped language has a line for every tone (no dead option in
        a picker), and the output is deterministic

   Run: node tigamodel/scripts/smoke-teacher-persona.mjs  (exit 1 on any fail) */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, readFileSync, writeFileSync as ioSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-smoke-persona";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });
const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
try {
  /* ONE bundle: the loop and persona must share the same module instance, or
     the switch the smoke flips would be a different object than the one the
     loop reads (which is exactly the bug this bundle shape prevents) */
  ioSync(`${OUT}/entry.js`, 'export * from "../../tigamodel/teaching/teaching-loop.js";\nexport * from "../../tigamodel/teaching/persona.js";\n');
  execSync(`npx esbuild ${OUT}/entry.js --bundle --outfile=${OUT}/p4/all.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
const { composeMessage, createTeachingLoop } = await import(pathToFileURL(`${OUT}/p4/all.js`).href);
const persona = await import(pathToFileURL(`${OUT}/p4/all.js`).href);
/* the module owns ONE switch state — the smoke flips it directly, exactly like
   the Lab panel does through web.js */
const SW = persona.teacherPersonaSwitch();

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

console.log("smoke-teacher-persona (docs/05 §5, m31):\n");

const DECISION = { strategy_id: "simplify-on-confusion", actions: ["simplify"] };
const LANGS = ["th", "en", "zh"];
/* tone-dependent checks run with the switch ON, restored right after */
const withSwitchOn = (fn) => { SW.setEnabled(true); try { return fn(); } finally { SW.setEnabled(false); } };

console.log("A) เสียงครู ไม่ใช่การตัดสินใจใหม่");
check("the strategy_id and the decision text are the same in every tone", () => {
  const loop = createTeachingLoop({ policy: { evaluate: () => DECISION } });
  assert.ok(loop && typeof loop.runOnce === "function", "the loop still builds with a persona-capable compose");
  /* the shipped line, taken with the switch OFF — that is what a tone must not
     change, only precede */
  const shipped = {};
  for (const lang of LANGS) shipped[lang] = composeMessage(DECISION, { lang });
  withSwitchOn(() => {
    for (const lang of LANGS) {
      for (const t of persona.PERSONAS) {
        const toned = composeMessage(DECISION, { lang, persona: t });
        assert.ok(toned.endsWith(shipped[lang]), `${t}/${lang}: the decision line is still there, only prefixed`);
        assert.ok(shipped[lang].length > 10, "the decision line is real content, not a stub");
      }
    }
  });
});

check("each tone actually sounds different", () => {
  withSwitchOn(() => {
    for (const lang of LANGS) {
      const lines = persona.PERSONAS.map(t => composeMessage(DECISION, { lang, persona: t }));
      assert.strictEqual(new Set(lines).size, persona.PERSONAS.length, `${lang}: three tones, three lines`);
    }
  });
});

console.log("\nB) kill switch: ปิด = เดิมทุกตัวอักษร");
check("OFF (default) returns the shipped text byte-identical", () => {
  for (const lang of LANGS) {
    for (const selfReport of [null, "too_easy", "too_hard"]) {
      const shipped = composeMessage(DECISION, { lang, selfReport });
      assert.strictEqual(composeMessage(DECISION, { lang, selfReport, persona: null }), shipped);
      assert.strictEqual(composeMessage(DECISION, { lang, selfReport, persona: persona.DEFAULT_PERSONA }), shipped,
        "passing a tone without the switch must not change anything");
    }
  }
});

check("the holder is OFF by default and the switch is the only way in", () => {
  const p = persona.createPersona();
  assert.strictEqual(p.isEnabled(), false);
  assert.strictEqual(SW.isEnabled(), false, "the module's own switch starts OFF");
  const text = "เล่นช้า ๆ แค่ท่อนแรก";
  assert.strictEqual(p.decorate(text, "th"), text, "OFF → identity");
  p.setEnabled(true);
  assert.notStrictEqual(p.decorate(text, "th"), text, "ON → the teacher's voice is added");
  assert.ok(p.decorate(text, "th").endsWith(text), "and the content is still there");
  p.setEnabled(false);
  assert.strictEqual(p.decorate(text, "th"), text, "and flipping it back is instant");
});

check("a caller cannot pass its own tone past the switch", () => {
  const base = composeMessage(DECISION, { lang: "th" });
  for (const t of persona.PERSONAS) {
    assert.strictEqual(composeMessage(DECISION, { lang: "th", persona: t }), base,
      `${t}: the switch is OFF, so asking for a tone changes nothing`);
  }
  withSwitchOn(() => {
    assert.notStrictEqual(composeMessage(DECISION, { lang: "th", persona: "strict" }), base, "and when it is ON it does");
  });
});

check("the switch key is the plan's own (owner-controlled, no deploy)", () => {
  assert.strictEqual(persona.PERSONA_SWITCH, "tiga_teacher_persona");
  assert.deepStrictEqual([...persona.PERSONAS], ["warm", "strict", "playful"]);
});

console.log("\nC) ไม่มีบุคลิกไหนทำให้คำแนะนำด้านสุขภาพอ่อนลง");
check("a decision that must mention a doctor still mentions one, in every tone", () => {
  /* the loop has no health line of its own — the safety wording lives in the
     KB tip and the chat system prompt — so the rule we can prove here is the
     one this module can break: it may only ADD a lead line, never touch the
     body. A tone that edited or dropped the body would fail this. */
  const body = "ถ้าปวดมือหรือข้อต่อเนื่อง ให้พักและพบแพทย์";
  const p = persona.createPersona({ enabled: true });
  for (const t of persona.PERSONAS) {
    p.setPersona(t);
    const out = p.decorate(body, "th");
    assert.ok(out.includes("พบแพทย์"), `${t}: the doctor line survives`);
    assert.ok(out.includes(body), `${t}: the whole original sentence survives verbatim`);
  }
});

check("a wellbeing-framed entry is not reworded by any tone", () => {
  const body = "(wellbeing frame: ดนตรีช่วยให้ผ่อนคลาย ไม่ใช่บริการทางการแพทย์)";
  const p = persona.createPersona({ enabled: true });
  for (const t of persona.PERSONAS) {
    p.setPersona(t);
    assert.ok(p.decorate(body, "en").includes("(wellbeing frame:"), `${t}: the frame marker is untouched`);
  }
});

console.log("\nD) ภาษาและความซื่อสัตย์");
check("unknown tone or language yields NO invented line", () => {
  assert.strictEqual(persona.personaLead("shouting", "th"), "");
  assert.strictEqual(persona.personaLead(null, "th"), "");
  assert.strictEqual(persona.personaLead("warm", "fr"), "", "no guess at a missing translation");
  assert.strictEqual(persona.decorate("ข้อความ", { persona: "shouting", lang: "th", enabled: true }), "ข้อความ");
  const p = persona.createPersona({ enabled: true });
  p.setPersona("nonsense");
  assert.strictEqual(p.persona(), persona.DEFAULT_PERSONA, "an unknown tone falls back to the default");
});

check("every tone speaks every shipped language (no dead option in a picker)", () => {
  const cov = persona.personaCoverage();
  for (const t of persona.PERSONAS) {
    assert.deepStrictEqual([...cov[t]].sort(), [...LANGS].sort(), `${t}: th/en/zh all present`);
    for (const lang of LANGS) assert.ok(persona.personaLead(t, lang).length > 0, `${t}/${lang} has a line`);
  }
  assert.strictEqual(persona.createPersona({ enabled: true }).options().length, persona.PERSONAS.length);
});

check("deterministic: same inputs, same words, every time", () => {
  withSwitchOn(() => {
    for (const lang of LANGS) for (const t of persona.PERSONAS) {
      const a = composeMessage(DECISION, { lang, persona: t });
      const b = composeMessage(DECISION, { lang, persona: t });
      assert.strictEqual(a, b);
    }
  });
});

check("malformed input never throws and never produces a lead alone", () => {
  assert.strictEqual(persona.decorate(null, { persona: "warm", lang: "th", enabled: true }), "");
  assert.strictEqual(persona.decorate(undefined, { persona: "warm", lang: "th", enabled: true }), "");
  assert.strictEqual(composeMessage(null, { lang: "th" }) !== undefined, true, "a missing decision still answers");
  assert.strictEqual(composeMessage({ actions: null }, { lang: "th", persona: "warm" }).length > 0, true);
});

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);