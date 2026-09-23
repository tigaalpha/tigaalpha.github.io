/* Verification for the "camera won't open from Studio" bug (owner report:
   "ยังกดเข้าจากหน้า Studio ไม่ได้เลย").
   Root cause: useCameraCoach referenced camLastTRef (openCamera() and the
   game loop) but never declared the ref — every openCamera() call threw
   ReferenceError before setCamOpen(true) ran, so the overlay could never
   open from the Studio card (or any other entry point).

   This test transpiles the REAL hook source with esbuild (not a
   reimplementation) and exercises openCamera() on a real React render, per
   AGENTS.md's "transpile the real source file and import() the actual
   exported function/class" guidance. Two cases:
     1. pre-fix snapshot (hand-injected) — MUST throw ReferenceError, proving
        this test exercises the exact failure mode the owner saw.
     2. the current on-disk source — MUST open cleanly (camOpen=true). */
import { build } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const OUT = "node_modules/.verify-cam";
const BROKEN_ENTRY = OUT + "/broken-entry.tsx";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Minimal @capacitor/core stub: speech.ts → native-stt.ts pulls in the
// Capacitor speech-recognition plugin, whose CJS require("@capacitor/core")
// can't resolve from an externalized ESM bundle. The probe runs on "web"
// semantics only (Capacitor.isNativePlatform() === false), which is exactly
// the browser behavior we're verifying.
const CAP_STUB = OUT + "/capacitor-core-stub.mjs";
writeFileSync(CAP_STUB,
  `export class WebPlugin {}
` +
  `export const Capacitor = { isNativePlatform: () => false, getPlatform: () => "web", isPluginAvailable: () => false };
` +
  `export const registerPlugin = () => ({addListener: () => ({remove: () => {}}), checkPermissions: async () => ({}), requestPermissions: async () => ({})});
`);

// Stub App.tsx in the bundle: the hook only imports API_MODEL from it, and
// bundling all of App.tsx would drag in the whole app (circular import back
// into this hook + module-level side effects) for zero verification value.
const APP_STUB = 'export const API_MODEL = "claude-verify-stub";\n';
function makeStubPlugin() {
  return {
    name: "stub-app-and-handpose",
    setup(b) {
      b.onLoad({ filter: /(^|\/)App\.tsx?$/ }, async () => ({ contents: APP_STUB, loader: "ts" }));
      b.onLoad({ filter: /(^|\/)hand-pose\.ts$/ }, async (args) => {
        // loadHandLandmarker's CDN import uses a dynamic template-literal
        // specifier plain esbuild can't parse; it's never called by the probe
        // (only the camera effect calls it, and effects don't run in
        // renderToString), so substitute a never-resolving stub.
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

// 1) The real on-disk hook.
await build({ ...COMMON, entryPoints: ["use-camera-coach.ts"], outfile: OUT + "/hook.mjs" });

// 2) Pre-fix regression snapshot: same source with the camLastTRef
//    declaration removed, to prove the probe exercises the original bug.
const cur = await readFile("use-camera-coach.ts", "utf8");
const brokenSrc = cur.replace(
  "  const camLastTRef = useRef(0);",
  "  // camLastTRef removed for regression snapshot"
);
assert.notEqual(brokenSrc, cur, "regression snapshot source must differ from fixed source");
// The snapshot lives under node_modules/.verify-cam/, so rewrite the hook's
// relative imports to absolute project paths before writing it there.
const ROOT = process.cwd().replace(/\\/g, "/");
const brokenEntry = brokenSrc.replace(/from "\.\//g, `from "${ROOT}/`);
writeFileSync(BROKEN_ENTRY, brokenEntry);
await build({ ...COMMON, entryPoints: [BROKEN_ENTRY], outfile: OUT + "/broken.mjs" });

// Node-side React + SSR render (useState/useRef work; effects don't fire,
// which is fine — the failing statement is synchronous inside openCamera()).
const { createRequire } = await import("node:module");
const req = createRequire(import.meta.url);
const React = req("react");
const { renderToString } = req("react-dom/server");

const { useCameraCoach } = await import(pathToFileURL(OUT + "/hook.mjs"));
const { useCameraCoach: useCameraCoachBroken } = await import(pathToFileURL(OUT + "/broken.mjs"));

function Probe({ hookFn, onDone }) {
  const h = hookFn({ lang: "en", premium: true, setPricingOpen: () => {}, onReward: () => {} });
  // Do NOT call openCamera() during render: it calls setState, and a
  // render-phase setState makes React restart the render before the rest of
  // openCamera's body can run (masking the very line we're testing). Capture
  // the bound functions instead; the caller invokes them after render.
  onDone(h);
  return null;
}

function renderProbe(hookFn) {
  let captured = null;
  renderToString(React.createElement(Probe, { hookFn, onDone: h => { captured = h; } }));
  assert.ok(captured, "probe never rendered");
  return captured;
}

// ── Case 1: pre-fix snapshot MUST fail with the original ReferenceError ──
const brokenHook = renderProbe(useCameraCoachBroken);
let brokenThrew = null;
try { brokenHook.openCamera(); } catch (e) { brokenThrew = e; }
assert.ok(brokenThrew && /camLastTRef/.test(String(brokenThrew)),
  "pre-fix snapshot should throw ReferenceError on camLastTRef — got: " + brokenThrew);
console.log("PASS  pre-fix snapshot reproduces the bug → " + String(brokenThrew).split("\n")[0]);

// ── Case 2: current source MUST run openCamera() to completion ──
// handRoundFramesRef is returned by the hook and openCamera() resets it as its
// FIRST statement — but the old crash (camLastTRef.current = 0) sat near the
// END of the body, so "reset happened AND no throw" proves every line ran,
// including the previously-fatal one. (setState itself is a no-op on an
// unmounted SSR component, so camOpen can't be observed here — the real
// open-the-overlay click is verified separately against dist/.)
const fixedHook = renderProbe(useCameraCoach);
fixedHook.handRoundFramesRef.current = { good: 5, total: 10 };
let fixedThrew = null;
try { fixedHook.openCamera(); } catch (e) { fixedThrew = e; }
assert.equal(fixedThrew, null, "openCamera() on the fixed source threw: " + fixedThrew);
assert.deepEqual(fixedHook.handRoundFramesRef.current, { good: 0, total: 0 },
  "openCamera() must reset the frame counter (prove the full body ran)");
assert.ok(fixedHook.camGame, "camGame state must exist after openCamera()");
console.log("PASS  fixed source: openCamera() runs to completion, frame counter reset");

// Re-open (the retry path) must keep working too.
let againThrew = null;
try { fixedHook.openCamera(); } catch (e) { againThrew = e; }
assert.equal(againThrew, null, "second openCamera() call threw: " + againThrew);
assert.deepEqual(fixedHook.handRoundFramesRef.current, { good: 0, total: 0 });
console.log("PASS  repeated openCamera() call works");

console.log("\nALL VERIFICATIONS PASSED");
