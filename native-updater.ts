import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

/* Self-hosted OTA updates ("No Cloud" mode) — no third-party update service.
   updates/manifest.json is republished by `npm run release` (see package.json
   and scripts/publish-update.mjs) to the same GitHub Pages/Vercel deploy the
   website already uses, so a normal `git push` updates the website instantly
   AND makes a new bundle available here — the native apps pick it up the next
   time they're opened, with no new App Store/Play Store submission needed for
   ordinary content/feature changes (only for native-code/permission changes).
   Since v13.7.2 the check also re-runs every 20 minutes while the app stays
   open, so a release published mid-session is picked up without a relaunch. */
const UPDATE_MANIFEST_URL = "https://tigaalpha.github.io/updates/manifest.json";
const RECHECK_MS = 20 * 60 * 1000; // 20 min — cheap HEAD-less GET against a no-store manifest

/* Self-update is disabled on Play Store / App Store builds: the store owns
   updates there, and sideloading an OTA zip over a store-installed app breaks
   Play's integrity/update guarantees. Build those with VITE_OTA_ENABLED=false
   (see PLAY_STORE_GUIDE.md). The default — web + direct-APK builds — keeps
   the self-update behavior below. */
export const OTA_ENABLED = (import.meta.env.VITE_OTA_ENABLED as string | undefined) !== "false";

export async function initNativeUpdater(currentVersion: string) {
  if (!OTA_ENABLED || !Capacitor.isNativePlatform()) return;

  // REQUIRED: tells the plugin this bundle booted successfully. Skipping this
  // causes the plugin to assume the update failed and roll back automatically.
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (e) {}

  // One check per tick; if an update is found, set() reloads the app on the new
  // bundle and nothing after this line runs (the interval below is only armed
  // when the check finds nothing to install).
  const check = async () => {
    try {
      const res = await fetch(UPDATE_MANIFEST_URL, { cache: "no-store" });
      if (!res.ok) return;
      const manifest = await res.json();
      if (!manifest || !manifest.version || !manifest.url) return;
      if (manifest.version === currentVersion) return;
      const bundle = await CapacitorUpdater.download({ version: manifest.version, url: manifest.url });
      await CapacitorUpdater.set(bundle); // reloads the app on the new bundle — nothing after this line runs
    } catch (e) {
      // offline / bad manifest / download failed — keep running, try again next tick
    }
  };

  await check();
  setInterval(() => { check(); }, RECHECK_MS);
}
