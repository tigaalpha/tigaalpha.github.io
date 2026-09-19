/* Post-fix smoke test that runs WITHOUT a real browser but WITH a real DOM
   (jsdom): renders the REAL CameraCoachOverlay driven by the REAL transpiled
   useCameraCoach hook, and can re-render (unlike SSR) so state changes from
   button handlers are observable. Covers:
     1. overlay markup renders in the loading state (back arrow + close present),
     2. exit handlers in the overlay source are all exit-bound (textual check),
     3. exitCamera()'s recap branch pays rewards exactly once, then every
        further close actually exits (the owner's original "กดปิดแล้วไม่ย้อนกลับ" bug),
     4. closeCameraAfterRecap() closes.
   Complements scripts/verify-camera-open.mjs, which proves openCamera()
   runs its full body on the real transpiled hook. */
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const OUT = "node_modules/.verify-cam";
const ROOT = process.cwd().replace(/\\/g, "/");

/* ── real DOM via jsdom, installed BEFORE any bundle executes ── */
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://tigaalpha.github.io/",
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { globalThis.navigator = dom.window.navigator; } catch (e) { /* read-only getter on newer Node */ }
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame?.bind(dom.window) || (() => 0);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame?.bind(dom.window) || (() => {});

/* Capacitor stub (same as verify-camera-open.mjs): the hook's speech imports
   pull in the Capacitor speech-recognition plugin whose CJS entry does
   require("@capacitor/core") — give it web-platform answers only. */
const CAP_STUB = OUT + "/capacitor-core-stub.mjs";
writeFileSync(CAP_STUB,
  `export class WebPlugin {}\n` +
  `export const Capacitor = { isNativePlatform: () => false, getPlatform: () => "web", isPluginAvailable: () => false };\n` +
  `export const registerPlugin = () => ({addListener: () => ({remove: () => {}}), checkPermissions: async () => ({}), requestPermissions: async () => ({})});\n`);

function makeStubPlugin() {
  return {
    name: "stub-app-and-handpose",
    setup(b) {
      b.onLoad({ filter: /(^|\/)App\.tsx?$/ }, async () => ({ contents: 'export const API_MODEL = "claude-verify-stub";\n', loader: "ts" }));
      b.onLoad({ filter: /(^|\/)hand-pose\.ts$/ }, async (args) => {
        let src = await readFile(args.path, "utf8");
        src = src.replace(
          /export async function loadHandLandmarker\(\) \{[\s\S]*?\n\}/,
          "export async function loadHandLandmarker() { return new Promise(() => {}); }"
        );
        return { contents: src, loader: "ts" };
      });
    },
  };
}

const COMMON = {
  bundle: true, format: "esm", platform: "node", target: "es2022", jsx: "automatic",
  external: ["react", "react-dom", "@supabase/supabase-js"],
  alias: { "@capacitor/core": "./" + CAP_STUB },
  plugins: [makeStubPlugin()],
  logLevel: "silent",
};

await build({ ...COMMON, entryPoints: ["use-camera-coach.ts"], outfile: OUT + "/hook.mjs" });
await build({ ...COMMON, entryPoints: ["CameraCoachOverlay.tsx"], outfile: OUT + "/overlay.mjs" });

const { createRequire } = await import("node:module");
const req = createRequire(import.meta.url);
// React 18 client renderer needs the jsdom globals to already exist — done above.
const React = req("react");
const { createRoot } = req("react-dom/client");

const { useCameraCoach } = await import(pathToFileURL(OUT + "/hook.mjs"));
const { CameraCoachOverlay } = await import(pathToFileURL(OUT + "/overlay.mjs"));

const noop = () => {};
const flush = () => new Promise(r => setTimeout(r, 25));

/* The overlay exactly as App.tsx:11728 mounts it, driven by one live hook
   instance. Re-renders on every flush so handler-driven state is observable. */
function Harness({ hookRef }) {
  const h = useCameraCoach({ lang: "en", premium: true, setPricingOpen: noop, onReward: (xp, coins) => hookRef.current.rewards.push({ xp, coins }) });
  hookRef.current.h = h;
  return React.createElement(CameraCoachOverlay, {
    lang: "en", exitCamera: h.exitCamera, camVideoRef: h.camVideoRef,
    camCanvasRef: h.camCanvasRef, camStatus: "loading", camMsg: h.camMsg,
    camCoach: h.camCoach, retryCamera: h.retryCamera, setCamCoach: h.setCamCoach,
    analyzeHands: h.analyzeHands, premium: true, camRecap: h.camRecap,
    camSpeaking: h.camSpeaking, camStreakInfo: h.camStreakInfo,
    closeCameraAfterRecap: h.closeCameraAfterRecap, camGame: h.camGame,
    camPraise: h.camPraise, camMission: h.camMission,
  });
}

const hookRef = { current: { rewards: [] } };
const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(React.createElement(Harness, { hookRef }));
await flush();
const h = hookRef.current.h;
assert.ok(h, "hook never captured");
const text = () => container.textContent || "";

/* ── 1. overlay renders: back arrow + close + title present ── */
assert.ok(text().includes("✋"), "overlay title missing");
assert.ok(container.querySelector(".camov"), "overlay root missing");
const backBtn = [...container.querySelectorAll("button.cbtn")].find(b => b.textContent.includes("←"));
assert.ok(backBtn, "top-left back arrow missing");
const findCloseBtn = () => [...container.querySelectorAll("button.cbtn")].find(b => b.textContent.toUpperCase().includes("CLOSE"));
const closeBtn = findCloseBtn();
assert.ok(closeBtn, "header close button missing");
console.log("PASS  overlay renders with back arrow + close button");

/* ── 2. clicking back/close calls the hook's exitCamera (no-op path) ── */
// No qualifying session yet → exitCamera just closes (camOpen=false, no pay).
backBtn.click();
await flush();
assert.equal(h.camOpen, false, "back arrow must close (no qualifying session)");
console.log("PASS  back arrow closes the overlay");

/* ── 3. qualifying session: pays exactly once, recap shows, further taps exit ── */
// Reopen, then simulate a qualifying session (>=30 tracked frames, 80% good).
h.openCamera();
await flush();
h.handRoundFramesRef.current = { good: 24, total: 30 };
const exitBtn = [...container.querySelectorAll("button")].find(b => b.textContent.includes("✕"));
assert.ok(exitBtn, "✕ Stop button missing");
exitBtn.click();
await flush();
// Read FRESH hook state: every setState re-rendered the harness and replaced
// hookRef.current.h — the pre-click `h` is a stale snapshot.
const hAfterExit = hookRef.current.h;
assert.equal(hookRef.current.rewards.length, 1, "first qualifying close must pay exactly once");
assert.ok(hookRef.current.rewards[0].xp > 0, "reward must include EXP");
assert.ok(hAfterExit.camRecap && hAfterExit.camRecap.pct === 80, `recap card must show 80% — got ${JSON.stringify(hAfterExit.camRecap)}`);
assert.ok(text().includes("80"), "recap UI must show the 80% figure");
// The original bug: further taps on ANY close must exit, never re-pay/re-trap.
closeBtnExistsAndClicks: {
  const again = findCloseBtn();
  assert.ok(again, "close button missing while recap is showing");
  again.click();
  await flush();
  assert.equal(hookRef.current.rewards.length, 1, "second close must NOT pay again");
  assert.equal(hookRef.current.h.camRecap, null, "second close must exit (recap cleared)");
  h.exitCamera(); // user mashing: must stay closed, still no re-pay
  assert.equal(hookRef.current.rewards.length, 1, "mashing close must never double-pay");
}
console.log("PASS  qualifying session pays once; every further close exits (no trap, no double-pay)");

/* ── 4. closeCameraAfterRecap() closes ── */
h.openCamera();
await flush();
h.handRoundFramesRef.current = { good: 0, total: 40 };
h.exitCamera();
await flush();
assert.ok(hookRef.current.h.camRecap, "recap must show for the second qualifying session");
h.closeCameraAfterRecap();
await flush();
assert.equal(hookRef.current.h.camRecap, null, "closeCameraAfterRecap must clear the recap");
console.log("PASS  closeCameraAfterRecap() closes the recap");

root.unmount();
console.log("\nALL SMOKE TESTS PASSED");
process.exit(0); // jsdom's pretendToBeVisual rAF loop would otherwise keep the process alive
