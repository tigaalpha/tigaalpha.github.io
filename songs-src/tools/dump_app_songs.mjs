// Every song of the app (id, English title, the notes of its tune) -> $SONGS_WORK/app-songs.json
//
//   SONGS_WORK=/path/to/work node songs-src/tools/dump_app_songs.mjs
//
// assemble.py --os reads it to leave out any tune the app already has, found by the shape of the melody (its intervals), so a copy in
// another key or from another edition is found too. Run it before assemble.py whenever the song list has changed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORK = process.env.SONGS_WORK;
if (!WORK) { console.error("set SONGS_WORK to the work folder (see songs-src/tools/README.md)"); process.exit(1); }
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);
const r = await build({ entryPoints: [path.join(ROOT, "songs-data.ts")], bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent" });
const tmp = path.join(ROOT, "node_modules/.cache", "songs-dump.mjs");
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, r.outputFiles[0].text);
const { SONGS } = await import(pathToFileURL(tmp).href + "?t=" + Date.now());
fs.writeFileSync(path.join(WORK, "app-songs.json"), JSON.stringify(SONGS.map(s => ({ id: s.id, en: s.en, notes: s.seq.filter(x => x[0] !== "R").map(x => x[0]) }))));
console.log(SONGS.length, "songs ->", path.join(WORK, "app-songs.json"));
