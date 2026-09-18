/* Smoke test for the self-learning engine + 100-item roadmap (repo convention:
   transpile the REAL source with esbuild and import it — never a mirrored copy).
   The learner is tested with injected in-memory load/save so no Supabase or
   localStorage is touched. Plain node assertions. */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-sl";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execSync(`npx esbuild tigamodel/learning/self-learner.js tigamodel/roadmap-100.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
const learnerM = await import(pathToFileURL(`${OUT}/learning/self-learner.js`).href);
const roadmapM = await import(pathToFileURL(`${OUT}/roadmap-100.js`).href);

let passed = 0;
async function ok(label, fn) { await fn(); passed++; console.log(`  ✓ ${label}`); }

function makeStore(initial = null) {
  let stored = initial;
  const writes = [];
  return {
    writes,
    load: async () => stored,
    save: async (snap) => { stored = snap; writes.push(snap); },
  };
}

async function main() {
  console.log("tigamodel self-learning + roadmap smoke:");

  await ok("switch defaults OFF; nothing learns or injects while OFF", async () => {
    const store = makeStore();
    const L = learnerM.createSelfLearner(store);
    assert.equal(await L.isEnabled(), false);
    const r = await L.learnFromAdmin("สอนเรื่องเปียโนพื้นฐานที่ยาวพอสมควรสำหรับการเรียนรู้");
    assert.equal(r.learned, 0);
    assert.equal(r.skipped, "switch-off");
    assert.equal(await L.getLearnedKBContext("เปียโน"), "");
    assert.equal(store.writes.length, 0); // nothing persisted while off
  });

  await ok("switch ON: admin teaching extracts bounded candidates and stores them", async () => {
    const store = makeStore({ enabled: true, entries: {}, stats: { learned: 0, reinforced: 0 } });
    const L = learnerM.createSelfLearner(store);
    const reply = [
      "เรื่องแรกคือการนั่งที่ถูกต้องต้องเอาหลังตรงและไหล่ระบายความตึงทุกครั้งก่อนเล่น",
      "ok",
      "เรื่องสองคือการอบอุ่นนิ้วด้วยสเกลช้าห้านาทีช่วยลดการบาดเจ็บได้จริงในระยะยาว",
    ].join("\n");
    const r = await L.learnFromAdmin(reply);
    assert.equal(r.learned, 2); // "ok" line filtered, two real lines kept
    const snap = await L.snapshot();
    assert.equal(snap.entries.length, 2);
    for (const e of snap.entries) {
      assert.ok(e.id.startsWith("learn:"));
      assert.equal(e.source, "admin-taught");
      assert.equal(e.type, "expert-opinion");
      assert.ok(e.confidence <= learnerM.CONF_MAX_ADMIN);
    }
    assert.equal(snap.stats.learned, 2);
    assert.ok(store.writes.length >= 1);
  });

  await ok("dedup: teaching the same line twice stores it once", async () => {
    const store = makeStore({ enabled: true, entries: {}, stats: {} });
    const L = learnerM.createSelfLearner(store);
    const line = "การซ้อมช้าๆ ด้วยการนับออกเสียงช่วยให้จังหวะนิ่งกว่าการซ้อมเร็วซ้ำๆ หลายรอบ";
    await L.learnFromAdmin(line);
    const r2 = await L.learnFromAdmin(line);
    assert.equal(r2.learned, 0);
    assert.equal((await L.snapshot()).entries.length, 1);
  });

  await ok("removeEntry + clearLearned wipe exactly what they should", async () => {
    const store = makeStore({ enabled: true, entries: {}, stats: {} });
    const L = learnerM.createSelfLearner(store);
    await L.learnFromAdmin("ข้อความสอนยาวพอที่ระบบจะเก็บเป็นความรู้หนึ่งรายการแน่นอน");
    let snap = await L.snapshot();
    assert.equal(snap.entries.length, 1);
    await L.removeEntry(snap.entries[0].id);
    snap = await L.snapshot();
    assert.equal(snap.entries.length, 0);
    await L.learnFromAdmin("อีกข้อความสอนที่ยาวพอสมควรเพื่อทดสอบการล้างทั้งหมดครั้งเดียว");
    await L.clearLearned();
    snap = await L.snapshot();
    assert.equal(snap.entries.length, 0);
    assert.deepEqual(snap.stats, { learned: 0, reinforced: 0 });
  });

  await ok("reinforceOutcome: switch-off / missing signal are no-ops", async () => {
    const offStore = makeStore({ enabled: false, entries: {}, stats: {} });
    const Loff = learnerM.createSelfLearner(offStore);
    assert.equal((await Loff.reinforceOutcome({ strategyId: "raise-challenge", accuracy: 90 })).applied, false);
    const onStore = makeStore({ enabled: true, entries: {}, stats: {} });
    const Lon = learnerM.createSelfLearner(onStore);
    assert.equal((await Lon.reinforceOutcome({ strategyId: null, accuracy: 90 })).applied, false);
  });

  await ok("reinforceOutcome adjusts a linked strategy's confidence within bounds", async () => {
    const store = makeStore({ enabled: true, entries: {}, stats: {} });
    const L = learnerM.createSelfLearner(store);
    await L.learnFromAdmin("กลยุทธ์ช้าลงแล้วนับออกเสียงช่วยเด็กที่จังหวะไม่นิ่งได้ผลดีจริงตามที่คุณครูสอน");
    const snap0 = await L.snapshot();
    const entry = snap0.entries[0];
    await L.linkStrategy("simplify-on-confusion", entry.id);
    // capture the linked entry's pre-reinforcement confidence (same object
    // reference the cache holds — copy the number, don't hold the object)
    const c0conf = (await L.snapshot()).entries.find(e => e.id === "learn:strat:simplify-on-confusion").confidence;
    // improvement path
    await L.reinforceOutcome({ strategyId: "simplify-on-confusion", accuracy: 90, prevAccuracy: 60 });
    let c = (await L.snapshot()).entries.find(e => e.id === "learn:strat:simplify-on-confusion");
    assert.ok(c.confidence > c0conf && c.up === 1 && c.down === 0, `improve: ${c.confidence} > ${c0conf}, up=${c.up}`);
    // regression path (bigger step down)
    await L.reinforceOutcome({ strategyId: "simplify-on-confusion", accuracy: 55, prevAccuracy: 90 });
    c = (await L.snapshot()).entries.find(e => e.id === "learn:strat:simplify-on-confusion");
    assert.equal(c.down, 1);
    // hard ceiling respected even after many wins
    for (let i = 0; i < 50; i++) await L.reinforceOutcome({ strategyId: "simplify-on-confusion", accuracy: 99, prevAccuracy: 10 });
    c = (await L.snapshot()).entries.find(e => e.id === "learn:strat:simplify-on-confusion");
    assert.ok(c.confidence <= learnerM.CONF_MAX_REINFORCED, `ceiling: ${c.confidence}`);
  });

  await ok("learned knowledge injects ONLY while the switch is ON", async () => {
    const store = makeStore({ enabled: false, entries: {}, stats: {} });
    const L = learnerM.createSelfLearner(store);
    assert.equal(await L.getLearnedKBContext("ทดสอบ"), ""); // off → nothing even with entries
    await L.setEnabled(true);
    await L.learnFromAdmin("ข้อความสอนที่ยาวพอที่ระบบจะเก็บไว้ใช้จริงหลังเปิดสวิตช์");
    const ctx = await L.getLearnedKBContext("ทดสอบ");
    assert.ok(ctx.includes("[TIGA LEARNED KNOWLEDGE"), "on → block present");
    assert.ok(ctx.includes("ข้อความสอน"));
    await L.setEnabled(false);
    assert.equal(await L.getLearnedKBContext("ทดสอบ"), ""); // off again → gone
  });

  await ok("cap: the store never grows past SELF_LEARN_CAP entries", async () => {
    const store = makeStore({ enabled: true, entries: {}, stats: {} });
    const L = learnerM.createSelfLearner(store);
    for (let i = 0; i < learnerM.SELF_LEARN_CAP + 15; i++) {
      await L.learnFromAdmin(`ข้อความสอนหมายเลขที่ ${i} ซึ่งยาวพอที่จะถูกเก็บเป็นความรู้ตามกติกา`);
    }
    assert.equal((await L.snapshot()).entries.length, learnerM.SELF_LEARN_CAP);
  });

  await ok("roadmap: exactly 100 items, counts consistent, statuses valid", () => {
    const all = roadmapM.roadmapAllItems();
    assert.equal(all.length, 100);
    const ns = new Set(all.map(i => i.n));
    assert.equal(ns.size, 100);
    for (const it of all) {
      assert.ok([1, 2, 3].includes(it.stars), `stars on #${it.n}`);
      assert.ok(["done", "partial", "todo"].includes(it.status), `status on #${it.n}`);
      assert.ok(it.th && it.en, `labels on #${it.n}`);
    }
    const p = roadmapM.roadmapProgress();
    assert.equal(p.done + p.partial + p.todo, 100);
    assert.ok(p.nextSprint > 0, "there is still priority work left");
    // the wired teaching loop is real: item 71 must be marked done
    assert.equal(all.find(i => i.n === 71).status, "done");
    // the gated outcome dataset stays gated
    assert.equal(all.find(i => i.n === 89).gated, true);
  });

  console.log(`\\nAll ${passed} self-learning/roadmap smoke checks passed ✅`);
}

main().catch(e => { console.error(e); process.exit(1); });
