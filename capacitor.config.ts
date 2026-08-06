import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tigaalpha.tigaai",
  appName: "TiGA AI",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
    allowNavigation: ["*.supabase.co"],
  },
  plugins: {
    // "No Cloud" mode (see native-updater.ts) — this app checks its own
    // self-hosted updates/manifest.json and calls download()/set() manually,
    // rather than polling a hosted update service.
    CapacitorUpdater: { autoUpdate: false },
  },
};

export default config;
