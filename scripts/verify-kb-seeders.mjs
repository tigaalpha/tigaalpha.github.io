/* Run EVERY knowledge seeder the way initTigamodelWeb does, against a stub KB.
   The real init wraps all seeding in ONE try/catch that swallows the error and
   keeps the base seed — so a generator that throws silently costs the app
   thousands of entries and nothing anywhere says so. This prints the real count.
   Run: node scripts/verify-kb-seeders.mjs */
const MODS = [
  "expansion-matrix", "expansion-deep", "expansion-final", "expansion-scale",
  "expansion-canvas", "expansion-summit", "expansion-core",
  "expansion-learner", "expansion-repertoire", "expansion-pedagogy",
  "expansion-peaks",
];
const stubKb = () => ({ _entries: new Map(), add(e) { this._entries.set(e.id, e); }, count() { return this._entries.size; } });

let fail = 0;
let total = 0;
for (const name of MODS) {
  let mod;
  try {
    mod = await import(`../tigamodel/knowledge/${name}.js`);
  } catch (e) {
    console.log(`FAIL  ${name}: cannot import — ${e.message}`);
    fail++;
    continue;
  }
  const seeders = Object.entries(mod).filter(([k, v]) => k.startsWith("seed") && typeof v === "function");
  if (!seeders.length) { console.log(`SKIP  ${name}: no seed* export`); continue; }
  for (const [sname, fn] of seeders) {
    const kb = stubKb();
    try {
      fn(kb);
      const n = kb.count();
      total += n;
      console.log(`${n > 0 ? "PASS " : "FAIL "}  ${name}.${sname} → ${n} entries`);
      if (n === 0) fail++;
    } catch (e) {
      console.log(`FAIL  ${name}.${sname} throws — ${e.message}`);
      fail++;
    }
  }
}
console.log(`\ntotal generated entries: ${total}`);
console.log(fail ? `${fail} SEEDER(S) FAILED` : "ALL SEEDERS OK");
process.exit(fail ? 1 : 0);