// auto-release.mjs — called by .github/workflows/auto-update.yml on every
// app-code push to main. Makes "every push = the app updates itself" true:
//   1. bumps the patch version (package.json, App.tsx APP_VER, version.json)
//   2. builds the web bundle
//   3. publishes the OTA bundle (updates/dist-<v>.zip + manifest.json)
//   4. if the push touched native code (android/…), also bumps version.json's
//      apkVersion so installed apps show the in-app "new APK available" banner
//      (the APK itself is then rebuilt by the android-debug-build workflow,
//      which the auto-update workflow triggers by pushing main → the dev branch)
//
// Run manually the same way CI does:  node scripts/auto-release.mjs [native]
// (pass "native" as argv[2] to also flag apkVersion — normally CI decides).
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeChanged = process.argv[2] === "native";

const read = (rel) => JSON.parse(readFileSync(path.join(root, rel), "utf8"));
const write = (rel, obj) => writeFileSync(path.join(root, rel), JSON.stringify(obj, null, 2) + "\n");

// ── 1. bump the patch version ────────────────────────────────────────────────
const pkg = read("package.json");
const [maj, min, pat] = pkg.version.split(".").map((n) => parseInt(n, 10));
if (!Number.isFinite(maj) || !Number.isFinite(min) || !Number.isFinite(pat)) {
  throw new Error("unparseable version: " + pkg.version);
}
const next = `${maj}.${min}.${pat + 1}`;
pkg.version = next;
write("package.json", pkg);

let app = readFileSync(path.join(root, "App.tsx"), "utf8");
const re = /const APP_VER = "([^"]+)";/;
if (!re.test(app)) throw new Error("APP_VER not found in App.tsx");
app = app.replace(re, `const APP_VER = "${next}";`);
writeFileSync(path.join(root, "App.tsx"), app);

const ver = read("version.json");
ver.version = next;
if (nativeChanged) ver.apkVersion = next; // a new APK will be built with this versionName
write("version.json", ver);

console.log(`Bumped to ${next}${nativeChanged ? " (native change → apkVersion flagged)" : ""}`);

// ── 2. build ─────────────────────────────────────────────────────────────────
execSync("npm run build", { stdio: "inherit", cwd: root });

// ── 3. publish the OTA bundle (updates/dist-<v>.zip + manifest.json) ─────────
execSync("node scripts/publish-update.mjs", { stdio: "inherit", cwd: root });

/* ── 4. prune the OTA archive ────────────────────────────────────────────────
   Every release dropped a ~1.4 MB zip into updates/ and nothing ever removed
   one, so 229 of them had piled up: 237 MB of a 266 MB repo, all of it served
   by GitHub Pages on every deploy. The deploy step went past its ten-minute
   limit and started failing, which froze the live site — while manifest.json,
   the only thing the mobile updater actually reads, pointed at exactly ONE of
   those files. Keep a short rollback window and drop the rest, every release,
   so this cannot silently grow back into an outage. */
const KEEP = 3;
const upd = path.join(root, "updates");
const verOf = (f) => {
  const m = /^dist-(\d+)\.(\d+)\.(\d+)\.zip$/.exec(f);
  return m ? Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3]) : -1;
};
const zips = readdirSync(upd).filter((f) => verOf(f) >= 0).sort((a, b) => verOf(b) - verOf(a));
const drop = zips.slice(KEEP);
for (const f of drop) rmSync(path.join(upd, f));
console.log(`OTA archive: kept ${Math.min(KEEP, zips.length)}, removed ${drop.length}`);

console.log(`Auto-release ${next} ready.`);
