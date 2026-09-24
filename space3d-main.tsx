/* ── space3d-main.tsx ──
   The fallback: the same room, drawn on the page's own thread, for browsers
   that cannot hand a canvas to a worker (or whose worker was refused WebGL).
   The host feeds it exactly what it would have posted to the worker. */
import { Canvas } from "@react-three/fiber";
import { SceneRoot, setDbg, CAMERA, glOptions } from "./space3d-scene";

export default function MainCanvas({ variant, tier, stage, feed, bus, dpr, dbg = "", onFirst, onSlow, onLost }) {
  setDbg(dbg);
  return (
    <Canvas className="sp3-cv" dpr={dpr} frameloop="never" gl={glOptions(tier)} camera={CAMERA}
      onCreated={({ gl }) => {
        // three checks every program's compile status synchronously in its
        // default debug mode, which is a stall per shader on a phone
        gl.debug.checkShaderErrors = false;
        gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onLost && onLost(); });
      }}>
      <SceneRoot variant={variant} tier={tier} stage={stage} feed={feed} bus={bus} dpr={dpr} onFirst={onFirst} onSlow={onSlow} />
    </Canvas>
  );
}
