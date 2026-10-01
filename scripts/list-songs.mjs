/* Prints every song in the app — id, level, English name — so a new piece is not a copy of one that is already there.
     node scripts/list-songs.mjs            # all
     node scripts/list-songs.mjs bach       # names/ids containing "bach" (case-insensitive) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);
const r = await build({ entryPoints: [path.join(ROOT, "songs-data.ts")], bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent" });
const tmp = path.join(ROOT, "node_modules/.cache", "songs-data-list.mjs");
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, r.outputFiles[0].text);
const { SONGS, SONG_GENRES } = await import(pathToFileURL(tmp).href + "?t=" + Date.now());
const q = (process.argv[2] || "").toLowerCase();
let n = 0;
for (const s of SONGS) {
  const line = `${s.id}\t${SONG_GENRES[s.id] || "-"}\td${s.diff}\t${s.en}`;
  if (!q || line.toLowerCase().includes(q)) { console.log(line); n++; }
}
console.error(`${n} of ${SONGS.length} songs`);
