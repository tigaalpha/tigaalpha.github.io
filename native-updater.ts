import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

/* Self-hosted OTA updates ("No Cloud" mode) — no third-party update service.
   updates/manifest.json is republished by `npm run release` (see package.json
   and scripts/publish-update.mjs) to the same GitHub Pages/Vercel deploy the
   website already uses, so a normal `git push` updates the website instantly
   AND makes a new bundle available here — the native apps pick it up the next
   time they're opened, with no new App Store/Play Store submission needed for
   ordinary content/feature changes (only for native-code/permission changes). */
const UPDATE_MANIFEST_URL = "https://tigaalpha.github.io/updates/manifest.json";

export async function initNativeUpdater(currentVersion: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // REQUIRED: tells the plugin this bundle booted successfully. Skipping this
    // causes the plugin to assume the update failed and roll back automatically.
    await CapacitorUpdater.notifyAppReady();
  } catch (e) {}

  try {
    const res = await fetch(UPDATE_MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return;
    const manifest = await res.json();
    if (!manifest || !manifest.version || !manifest.url) return;
    if (manifest.version === currentVersion) return;
    const bundle = await CapacitorUpdater.download({ version: manifest.version, url: manifest.url });
    await CapacitorUpdater.set(bundle); // reloads the app on the new bundle — nothing after this line runs
  } catch (e) {
    // offline / bad manifest / download failed — keep running the current bundle, try again next launch
  }
}
