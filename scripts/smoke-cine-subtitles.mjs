// Every subtitle of every film (and every map title, boss name, objective goal) exists in Thai, English and Chinese, in the right script.
import fs from "node:fs";
const cine = fs.readFileSync("adventure-cine.tsx", "utf8"), adv = fs.readFileSync("adventure.tsx", "utf8");
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const grab = (name) => { const i = cine.indexOf("const " + name); const j = cine.indexOf("\n};", i); const body = cine.slice(cine.indexOf("{", cine.indexOf("=", i)), j + 3); return new Function("return " + body.replace(/;$/, ""))(); };
const TH = /[฀-๿]/, ZH = /[一-鿿]/, LAT = /[A-Za-z]{3}/;
const triple = (a) => Array.isArray(a) && a.length === 3 && TH.test(a[0]) && LAT.test(a[1]) && !TH.test(a[1]) && ZH.test(a[2]);
const DEPART = grab("DEPART"), COMMON = grab("COMMON"), INTRO = grab("INTRO"), STORY = grab("STORY"), GOAL = grab("GOAL");
ok("the shared opening captions (earth, factory, launch) are in 3 languages", ["earth", "factory", "launch"].every(k => triple(COMMON[k])));
ok("the send-off film (pad, liftoff, earth fade) is in 3 languages", ["pad", "liftoff", "earthfade"].every(k => triple(DEPART[k])));
const ids = [...adv.matchAll(/\{ id: "([a-z]+)",\s+th:/g)].map(m => m[1]).filter(x => x !== "prologue"); ok("found the maps", ids.length >= 10, ids.join());
for (const id of ids) { ok(id + ": approach caption in th/en/zh", triple(INTRO[id])); ok(id + ": surface caption in th/en/zh", triple(STORY[id])); ok(id + ": three goals, each in th/en/zh", Array.isArray(GOAL[id]) && GOAL[id].length === 3 && GOAL[id].every(triple)); }
const titles = [...adv.matchAll(/\{ id: "([a-z]+)",\s+th: "([^"]+)",\s+en: "([^"]+)",\s+zh: "([^"]+)"/g)];
ok("every map has a title in th/en/zh", titles.length >= 10 && titles.every(m => TH.test(m[2]) && LAT.test(m[3]) && ZH.test(m[4])));
const bosses = [...adv.matchAll(/boss: \["([^"]+)", "([^"]+)", "([^"]+)"\]/g)].filter(m => m[1] !== "-"); ok("every boss is named in th/en/zh", bosses.length >= 6 && bosses.every(m => TH.test(m[1]) && LAT.test(m[2]) && ZH.test(m[3])), bosses.length + " bosses");
ok("the objective card, destination and chapter labels are in 3 languages", /MISSION", "任务"/.test(cine) && /DESTINATION", "目的地"/.test(cine) && /CHAPTER ", "第"/.test(cine));
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
