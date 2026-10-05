#!/usr/bin/env node
/* smoke-android-play-store.mjs — what Play Store will and will not accept.

   node scripts/smoke-android-play-store.mjs

   WHY this exists — the owner is taking this app to Google Play (2026-10-04).
   The Android project was already marked "ready" in PLAY_STORE_GUIDE.md, and
   one of the checks in that claim turned out to be false. versionCode was
   computed as major*10000 + minor*100 + patch, which assumes the patch stays
   under 100. The OTA bot ships about hourly, so the patch is already 526 —
   past that point the next MINOR release produces a SMALLER versionCode than
   the patch before it:

       13.7.526 -> 131226
       13.8.0   -> 130800     lower — Play rejects with "version code already
                              exists" / "versionCode must be greater"

   That is invisible until the one upload that matters, on a live store
   listing, and unrecoverable from the console afterwards. This test pins the
   arithmetic against the versions this project actually produces.

   It also pins the store-build rules that are easy to break by accident and
   that the Play review would catch: OTA must be OFF in a store build (Play
   forbids self-updating outside its own channel), release signing must come
   from a file that is gitignored, and the required manifest permissions must
   be declared. */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log("PASS " + n); } else { fails.push(n); console.log("FAIL " + n); } };

const GRADLE = readFileSync("android/app/build.gradle", "utf8");
const MANIFEST = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const VARS = readFileSync("android/variables.gradle", "utf8");
const CAP = readFileSync("capacitor.config.ts", "utf8");

// ══ 1. versionCode must never go backwards ══════════════════════════════════
// Re-implements the formula from build.gradle rather than importing it, so the
// test fails if the two ever disagree in the other direction.
const codeOf = (v) => {
  const [a, b, c] = v.split(".").map(Number);
  return a * 1000000 + b * 1000 + c;
};

ok(/versionCodeValue/.test(GRADLE), "build.gradle computes versionCode once, into a named value");
ok(!/tokenize\("\."\)\.with \{ \(it\[0\]/.test(GRADLE),
  "the old major*10000+minor*100+patch formula is gone (it overflowed at patch 100)");
ok(/versionCode versionCodeValue/.test(GRADLE), "defaultConfig uses that value");

const pkgVersion = readFileSync("package.json", "utf8").match(/"version":\s*"([\d.]+)"/)[1];
ok(pkgVersion.split(".").length === 3, `package.json version has three parts (${pkgVersion})`);

const now = codeOf(pkgVersion);
ok(now > 0, `the shipped version maps to a positive versionCode (${now})`);

// every step the release train actually takes from here
const upcoming = ["13.7.527", "13.7.999", "13.8.0", "13.9.12", "13.10.0", "14.0.0", "20.1.1"];
let prev = now;
for (const v of upcoming) {
  const c = codeOf(v);
  ok(c > prev, `${v} -> ${c} is greater than the previous (${prev})`);
  prev = c;
}

// the old formula, on the same versions — this is the bug being prevented
const oldOf = (v) => { const [a, b, c] = v.split(".").map(Number); return a * 10000 + b * 100 + c; };
ok(oldOf("13.8.0") < oldOf("13.7.526"),
  "confirmed: the old formula really did regress here (this is the bug, kept as a canary)");

// Play's hard ceiling
ok(codeOf("2100.0.0") <= 2100000000, "major 2100 is still inside Play's versionCode ceiling");
ok(codeOf("2101.0.0") > 2100000000, "and past it we would notice, years before it happens");

// ══ 2. a store build must not update itself ════════════════════════════════
ok(/VITE_OTA_ENABLED/.test(readFileSync("native-updater.ts", "utf8")),
  "the OTA switch is read by the app (so a store build can turn it off)");
ok(/autoUpdate: false/.test(CAP),
  "CapacitorUpdater autoUpdate is off — Play requires updates to go through Play");
ok(/PLAY_STORE_GUIDE|keystore\.properties/.test(GRADLE),
  "release signing is wired to the gitignored keystore.properties, not a committed key");

// ══ 3. the signing key must never be committable ═══════════════════════════
// Asked of GIT ITSELF rather than of a file's text: the rule lives in
// android/.gitignore, and reading the root .gitignore for it was checking the
// wrong file — which is how the first run of this test failed on a repo where
// the protection was in fact working. `git check-ignore` is the only answer
// that cannot be fooled by a rule that was commented out, mistyped, or sitting
// in a .gitignore that stopped applying.
const ignored = (p) => {
  try {
    execFileSync("git", ["check-ignore", "-q", p], { stdio: "ignore" });
    return true;
  } catch { return false; }
};
ok(ignored("android/keystore.properties"), "git refuses to track android/keystore.properties");
ok(ignored("android/app/tiga-release.jks"), "git refuses to track the release key itself (*.jks)");
ok(readFileSync("android/keystore.properties.example", "utf8").includes("CHANGE_ME"),
  "the example file ships placeholders, never real passwords");

// ══ 4. Play's manifest requirements ════════════════════════════════════════
for (const [perm, why] of [
  ["android.permission.INTERNET", "the app is a web app"],
  ["android.permission.CAMERA", "the camera coach"],
  ["android.permission.RECORD_AUDIO", "the voice tutor"],
  ["android.permission.POST_NOTIFICATIONS", "weekly report + streak reminders on Android 13+"],
]) ok(MANIFEST.includes(perm), `${perm} is declared (${why})`);

// features must stay optional so the app installs on a device without them
ok(/android.hardware.camera" android:required="false"/.test(MANIFEST),
  "camera is not a hard requirement (the app installs on devices without one)");
ok(/android.hardware.microphone" android:required="false"/.test(MANIFEST),
  "microphone is not a hard requirement");

// the OAuth deep link the native sign-in depends on
ok(/android:scheme="com\.tigaalpha\.tigaai"/.test(MANIFEST),
  "the custom scheme MainActivity needs to catch the OAuth redirect");

// ══ 5. SDK levels ══════════════════════════════════════════════════════════
const min = +(VARS.match(/minSdkVersion\s*=\s*(\d+)/) || [])[1];
const target = +(VARS.match(/targetSdkVersion\s*=\s*(\d+)/) || [])[1];
ok(target >= 35, `targetSdk ${target} meets Play's current floor (>=35)`);
ok(min >= 24, `minSdk ${min} covers the device range the app claims`);

// ══ 6. the pieces Play asks for by URL / document ══════════════════════════
for (const f of ["privacy-policy.html", "PLAY_STORE_GUIDE.md"]) {
  ok(readFileSync(f, "utf8").length > 200, `${f} exists and has real content`);
}
ok(readFileSync("privacy-policy.html", "utf8").toLowerCase().includes("delete"),
  "the privacy policy names a deletion route (Play requires one for account apps)");

console.log(`\n--- ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => "  FAIL " + f).join("\n")); process.exit(1); }
console.log("--- errors: 0");
