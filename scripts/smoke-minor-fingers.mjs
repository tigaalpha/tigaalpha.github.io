// Every minor key, both spellings, both hands must have fingers (so the Teacher page shows the hand and the staff).
import fs from "node:fs";
const src = fs.readFileSync(new URL("../music-engine.tsx", import.meta.url), "utf8");
const grab = (name) => { const i = src.indexOf(`export const ${name} = {`); const j = src.indexOf("\n};", i); return eval("(" + src.slice(src.indexOf("{", i), j + 2) + ")"); };
const RH = grab("FINGERINGS_RH"), LH = grab("FINGERINGS_LH");
const fn = src.slice(src.indexOf("export function getFingers"), src.indexOf("// finger numbers aligned"));
const getFingers = eval("(" + fn.replace("export function getFingers", "function").replace(/FINGERINGS_LH/g, "LH").replace(/FINGERINGS_RH/g, "RH").replace(/TRIAD_FINGER_LH|TRIAD_FINGER_RH/g, "null") + ")");
let bad = 0;
for (const r of ["c","c#","db","d","d#","eb","e","f","f#","gb","g","g#","ab","a","a#","bb","b"]) for (const q of ["minor"]) for (const h of ["right","left"]) {
  const f = getFingers(`${r} ${q} scale`, "scale", h);
  if (!f || f.length !== 8) { bad++; console.log("FAIL", r, q, h); }
}
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
for (const k of ["c# minor scale","db minor scale"]) { if (!eq(getFingers(k,"scale","right"),[2,1,2,3,1,2,3,4]) || !eq(getFingers(k,"scale","left"),[3,1,3,2,1,4,3,2])) { bad++; console.log("FAIL owner fingering for", k); } }
console.log(bad ? "FAILED" : "PASS every minor key has fingers in both hands and both spellings");
process.exit(bad ? 1 : 0);
