/* ── canary-release.mjs — plan v3.3 8.3: safe releases via Capgo canary
   Flow: package dist/ (same zip the existing OTA updater consumes) → upload to
   the `staging` channel (the 10% canary cohort) → print the exact promote and
   rollback commands. Nothing auto-promotes: 100% rollout stays a human
   decision, per the SOP.

   Requirements: dist/ already built (npm run build) and CAPGO_TOKEN in the
   environment (Settings → Environment in Freebuff, or exported locally).
   No token → clear business-readable failure, no partial state.

   Note: the app's current updater reads updates/manifest.json (self-hosted
   flow). Switching the app to Capgo channel listening is a one-flag change in
   native-updater.ts once the owner's Capgo app is registered — documented in
   docs/TIGA_FLYWHEEL_SOP.md. This script is the operator half and works
   standalone. ── */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CHANNEL = process.env.CAPGO_CHANNEL || "staging";
const token = process.env.CAPGO_TOKEN;

const fail = (msg) => { console.error(`\n❌ ${msg}`); process.exit(1); };

if (!existsSync(path.join(root, "dist"))) {
  fail("ยังไม่มี dist/ — รัน `npm run build` ก่อนแล้วค่อย canary");
}
if (!token) {
  fail("ยังไม่มีกุญแจ CAPGO_TOKEN — เพิ่มใน Freebuff Settings → Environment (หรือ export ในเครื่อง) แล้วรันใหม่");
}

let version = null;
try { version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version; } catch (e) {}
if (!version) fail("อ่านเวอร์ชันจาก package.json ไม่ได้");

const updatesDir = path.join(root, "updates");
if (!existsSync(updatesDir)) mkdirSync(updatesDir);
const zipPath = path.join(updatesDir, `dist-${version}.zip`);
if (existsSync(zipPath)) rmSync(zipPath);
execSync(`cd "${path.join(root, "dist")}" && zip -qr "${zipPath}" .`, { stdio: "inherit" });

const zipKb = (statSync(zipPath).size / 1024).toFixed(0);
console.log(`\nแพ็กเกจพร้อม: updates/dist-${version}.zip (${zipKb} kB)`);

console.log(`อัปโหลดขึ้นช่อง canary "${CHANNEL}" (Capgo)...`);
try {
  execSync(
    `npx --yes @capgo/cli bundle upload "${zipPath}" --channel ${CHANNEL} --api-key ${token}`,
    { stdio: "inherit", cwd: root }
  );
} catch (e) {
  fail("อัปโหลดไม่สำเร็จ — ตรวจ CAPGO_TOKEN/ชื่อแอปใน Capgo แล้วรันใหม่ (ไม่มีอะไรเปลี่ยนในโปรดักชัน)");
}

console.log(`
✅ ขึ้นช่อง canary "${CHANNEL}" แล้ว — กลุ่มทดลอง (10%) จะได้อัปเดตก่อนใคร

ขั้นถัดไป (มนุษย์ตัดสินใจ ตาม SOP):
  • ปล่อยเต็ม 100%:   npx @capgo/cli channel set production --bundle ${version} --api-key $CAPGO_TOKEN
  • ย้อนกลับทันที:    npx @capgo/cli channel set production --bundle <เวอร์ชันเก่า> --api-key $CAPGO_TOKEN
  • ดูสถานะ:         npx @capgo/cli bundle list --api-key $CAPGO_TOKEN

กติกา 8.3: แดงใน canary = ห้าม promote · rollback ใช้คำสั่งเดียวจบ`);
