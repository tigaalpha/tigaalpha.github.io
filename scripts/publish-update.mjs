// Packages the current `dist/` build as a native-app OTA update bundle (see
// native-updater.ts). Run this AFTER `npm run build`, as part of a normal
// release: bump the version in package.json and App.tsx's APP_VER together,
// build, run this script, then commit+push everything (App.tsx, dist/,
// updates/) as usual — the same `git push` that updates the website also
// publishes the update the native apps will pick up next launch.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;

const updatesDir = path.join(root, "updates");
if (!existsSync(updatesDir)) mkdirSync(updatesDir);

const zipName = `dist-${version}.zip`;
const zipPath = path.join(updatesDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);

execSync(`cd "${path.join(root, "dist")}" && zip -qr "${zipPath}" .`, { stdio: "inherit" });

const manifest = {
  version,
  url: `https://tigaalpha.github.io/updates/${zipName}`,
  publishedAt: new Date().toISOString(),
};
writeFileSync(path.join(updatesDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`Published update ${version} -> updates/${zipName}`);
console.log("Remember: App.tsx's APP_VER must match package.json's version, or the native apps will re-download every launch.");
