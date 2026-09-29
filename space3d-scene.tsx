/* ── space3d-scene.tsx ──
   The real-time room the arena, the pet sanctuary and the shop are staged in.
   This module is the scene itself and nothing else: it never touches the
   page. Everything it needs to know about the page — where the subject's
   feet are on the canvas, how far the page has scrolled, where the pointer
   is, whether the page is busy — arrives in a plain `feed` object, so the
   same scene runs inside a Web Worker on an OffscreenCanvas (the normal
   case: the room then never takes a millisecond from the page's own thread)
   or, where a browser cannot do that, on the page itself.

   The brief it answers: a dark, expensive interior rather than a neon city.
   Obsidian floor that mirrors the room, smoke-glass facade, titanium fins and
   mullions, a few slow floating forms, hologram panels with small technical
   read-outs, dust hanging in soft light shafts, a thin fog to put air
   between the planes. Light is mostly cool white; cyan and electric violet
   appear only as thin lines and rim light, so most of the frame stays dark
   and the contrast does the work. Bloom is set to catch only the brightest
   filaments.

   Everything is procedural — no model or texture downloads — so the scene is
   usable the moment its code has arrived. Repeated parts are instanced, the
   floating crystal carries levels of detail, and the quality tier decides the
   mirror floor, the post-processing and the frame budget; the pacer drops a
   tier by itself if the device falls behind. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial, Detailed } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

const CYAN = "#39d8ff";
const VIOLET = "#7d5bff";
const ICE = "#dfe8ff";
const CHAMPAGNE = "#ffe7cf";
const damp = THREE.MathUtils.damp;
let DBG = "";
/** Debug switches (tg_3d_dbg), handed in by the host: a worker has no localStorage. */
export function setDbg(s) { DBG = s || ""; }
const off = (k) => DBG.indexOf(k) >= 0;
const TAU = Math.PI * 2;

/* ── tone ──
   Each arena keeps an identity of its own, but inside the one palette: where
   it leans between cyan and violet, how warm its key light runs, how much
   air hangs in it. Nothing here is a new hue. */
const STAGE_TONE = {
  grid:    { lean: -0.3, warm: 0.0, fog: 1.0 },
  magma:   { lean: 0.55, warm: 0.8, fog: 1.2 },
  frost:   { lean: -0.8, warm: 0.0, fog: 1.35 },
  ashfall: { lean: 0.8, warm: 0.3, fog: 1.4 },
  void:    { lean: 0.7, warm: 0.0, fog: 0.8 },
  bloom:   { lean: -0.6, warm: 0.2, fog: 1.1 },
  gilt:    { lean: 0.2, warm: 1.0, fog: 1.0 },
  tide:    { lean: -1.0, warm: 0.0, fog: 1.5 },
  requiem: { lean: 0.4, warm: 0.1, fog: 1.15 },
  dojo:    { lean: 0.0, warm: 0.7, fog: 1.1 },
};
/* "shop-pet" and "shop-bot" are two camera shots in the one shop room */
const roomOf = (variant) => String(variant || "lobby").split("-")[0];
function makeTone(stage, variant) {
  variant = roomOf(variant);
  const t = STAGE_TONE[stage] || (variant === "pets" ? { lean: 0.15, warm: 0.25, fog: 1.2 } : variant === "shop" ? { lean: -0.1, warm: 0.15, fog: 0.95 } : { lean: -0.2, warm: 0, fog: 1 });
  const k = (t.lean + 1) / 2;
  const a = new THREE.Color(CYAN).lerp(new THREE.Color(VIOLET), k * 0.85);
  const b = new THREE.Color(VIOLET).lerp(new THREE.Color(CYAN), (1 - k) * 0.35);
  const key = new THREE.Color(ICE).lerp(new THREE.Color(CHAMPAGNE), t.warm);
  return { a, b, key, fog: t.fog, hexA: "#" + a.getHexString(), hexB: "#" + b.getHexString(), hexKey: "#" + key.getHexString() };
}

/* ── materials ── one set per scene, disposed with it */
function useMats(tone) {
  const m = useMemo(() => ({
    titanium: new THREE.MeshStandardMaterial({ color: "#8f959f", metalness: 1, roughness: 0.3, envMapIntensity: 1.15 }),
    titaniumDark: new THREE.MeshStandardMaterial({ color: "#3a3f47", metalness: 1, roughness: 0.38, envMapIntensity: 0.9 }),
    obsidian: new THREE.MeshStandardMaterial({ color: "#07080b", metalness: 0.45, roughness: 0.14, envMapIntensity: 1.0 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#0d141c", metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.3,
      envMapIntensity: 1.7, clearcoat: 1, clearcoatRoughness: 0.04, depthWrite: false,
    }),
    lineA: new THREE.MeshBasicMaterial({ color: tone.a.clone().multiplyScalar(2.1), toneMapped: false }),
    lineB: new THREE.MeshBasicMaterial({ color: tone.b.clone().multiplyScalar(2.0), toneMapped: false }),
    strip: new THREE.MeshBasicMaterial({ color: tone.key.clone().multiplyScalar(2.6), toneMapped: false }),
    blade: new THREE.MeshBasicMaterial({ color: tone.key.clone().multiplyScalar(1.5), toneMapped: false }),
    cove: new THREE.MeshBasicMaterial({ color: tone.key.clone().lerp(tone.a, 0.2).multiplyScalar(1.15), toneMapped: false }),
    edgeA: new THREE.LineBasicMaterial({ color: tone.a, transparent: true, opacity: 0.28, toneMapped: false }),
    shadow: new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.5, depthWrite: false }),
  }), [tone]);
  useEffect(() => () => { Object.values(m).forEach(x => x.dispose && x.dispose()); }, [m]);
  return m;
}

/* An instanced row of identical parts. `list` is [x, y, z, sx, sy, sz, ry]. */
function Instances({ geo, mat, list }) {
  const ref = useRef();
  useEffect(() => {
    const o = new THREE.Object3D();
    list.forEach((p, i) => {
      o.position.set(p[0], p[1], p[2]);
      o.scale.set(p[3] || 1, p[4] || 1, p[5] || 1);
      o.rotation.set(0, p[6] || 0, 0);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [list]);
  return <instancedMesh ref={ref} args={[geo, mat, list.length]} />;
}

/* shared soft-disc shader: a radial falloff used for light pools, contact
   shadows and ripples on the floor */
const UV_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const POOL_FS = `uniform vec3 uC; uniform float uA; varying vec2 vUv;
void main(){ float r = length(vUv - .5) * 2.; float a = smoothstep(1., 0., r); gl_FragColor = vec4(uC * a * a * uA, 1.); }`;
const SHADOW_FS = `uniform float uA; varying vec2 vUv;
void main(){ float r = length(vUv - .5) * 2.; float a = smoothstep(1., .15, r); gl_FragColor = vec4(0., 0., 0., a * a * uA); }`;
/* a soft column of light behind the subject — the backlight a product shot
   uses to lift a dark figure off a dark room */
const HALO_FS = `uniform vec3 uC; uniform float uA; varying vec2 vUv;
void main(){ vec2 d = (vUv - vec2(.5, .38)) * vec2(2.4, 1.35); float a = exp(-dot(d, d) * 3.2); gl_FragColor = vec4(uC * a * uA, 1.); }`;
function poolMaterial(color, a) {
  return new THREE.ShaderMaterial({
    vertexShader: UV_VS, fragmentShader: POOL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: a } },
  });
}

/* ── the floor ── a mirror on the capable tiers, polished stone below them,
   with a fine technical grid laid on top that fades out with distance */
const GRID_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GRID_FS = `uniform vec3 uC; uniform float uA; uniform vec2 uO; varying vec3 vW;
float ln(float v){ float d = abs(fract(v - .5) - .5) / max(fwidth(v), 1e-4); return 1. - min(d, 1.); }
void main(){
  // a fine survey grid, barely there: it gives the floor a scale, not a look
  float g = max(ln(vW.x * .5), ln(vW.z * .5));
  float fade = exp(-length(vW.xz - uO) * .16);
  gl_FragColor = vec4(uC * g * fade * uA, 1.);
}`;
function Floor({ tier, tone, focusZ = 0 }) {
  const grid = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: GRID_VS, fragmentShader: GRID_FS, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, uniforms: { uC: { value: tone.a.clone().lerp(tone.key, 0.5) }, uA: { value: 0.035 }, uO: { value: new THREE.Vector2(0, focusZ - 1) } },
  }), [tone, focusZ]);
  useEffect(() => () => grid.dispose(), [grid]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -6]}>
        <planeGeometry args={[70, 70]} />
        {tier >= 2 ? (
          <MeshReflectorMaterial blur={[260, 70]} resolution={tier >= 3 ? 1024 : 256} mixBlur={0.85} mixStrength={2.4}
            roughness={0.72} depthScale={1.2} minDepthThreshold={0.3} maxDepthThreshold={1.4}
            color="#0e1016" metalness={0.5} mirror={0.82} />
        ) : (
          <meshStandardMaterial color="#0c0e13" metalness={0.8} roughness={0.2} envMapIntensity={1.1} />
        )}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, -6]} material={grid}>
        <planeGeometry args={[70, 70]} />
      </mesh>
    </group>
  );
}

/* ── where a point on the page lands on the floor ── (or, given a height,
   on a level that far above it) */
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const LEVEL = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function floorAt(ray, camera, nx, ny, out, h = 0) {
  ray.setFromCamera({ x: nx, y: ny }, camera);
  if (!h) return ray.ray.intersectPlane(FLOOR, out);
  LEVEL.constant = -h;
  return ray.ray.intersectPlane(LEVEL, out);
}
// the plinth's top face: what the subject's feet actually stand on
const PLINTH_TOP = 0.113;

/* ── the plinth the subject stands on ── obsidian disc, titanium rim, one
   thin filament and a soft pool of light under it. It stands exactly under
   the robot's or the pet's feet as the page measured them, however the camera
   drifts, and fades away when there is nothing to stand under. */
function Plinth({ mats, tone, r = 1.2, feed = null, pulse = null, glow = 1, at = null, backlight = false, portal = 0 }) {
  const g = useRef(), ring = useRef(), prt = useRef();
  const { camera } = useThree();
  const ringMat = useMemo(() => mats.lineA.clone(), [mats]);
  const base = useMemo(() => mats.lineA.color.clone(), [mats]);
  const poolMat = useMemo(() => poolMaterial(tone.key, 0.24 * glow), [tone, glow]);
  const aoMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: UV_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false, uniforms: { uA: { value: 0.85 } },
  }), []);
  const haloMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: UV_VS, fragmentShader: HALO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: tone.key.clone().lerp(tone.b, 0.25) }, uA: { value: 0.16 } },
  }), [tone]);
  useEffect(() => () => { ringMat.dispose(); poolMat.dispose(); aoMat.dispose(); haloMat.dispose(); }, [ringMat, poolMat, aoMat, haloMat]);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const vis = useRef(at ? 1 : 0);
  useFrame((st, dt) => {
    // the pulse a tap or a hit sends through the filament
    const p = pulse && pulse.current ? pulse.current : 0;
    ringMat.color.copy(base).multiplyScalar(1 + p * 1.6);
    if (prt.current) {
      // the portal stands on edge behind the subject and turns a few degrees
      // either way, leaning toward the pointer
      const t = st.clock.elapsedTime, px = feed ? feed.pointer[0] : 0;
      prt.current.rotation.y = Math.sin(t * 0.13) * 0.3 + px * 0.16;
      prt.current.rotation.x = Math.sin(t * 0.21) * 0.035;
      prt.current.position.y = portal * 1.12 + 0.1 + Math.sin(t * 0.5) * 0.02 + p * 0.03;
    }
    if (!g.current) return;
    let want = 1;
    if (at && at.current) {
      g.current.position.x = at.current.x; g.current.position.z = at.current.z;
    } else {
      // the subject's feet, as the page measured them on the canvas — found
      // on the plinth's top face, not the floor under it, so they land in the
      // middle of the disc rather than out at its front edge
      const A = feed && feed.anchor;
      if (!A || A.ny > 0.92 || A.ny < -1.15 || !floorAt(ray, camera, A.nx, A.ny, hit, PLINTH_TOP) || hit.z < -30) want = 0;
      else {
        const snap = vis.current < 0.02;
        g.current.position.x = snap ? hit.x : damp(g.current.position.x, hit.x, 20, dt);
        g.current.position.z = snap ? hit.z : damp(g.current.position.z, hit.z, 20, dt);
      }
    }
    vis.current = damp(vis.current, want, 7, dt);
    g.current.scale.setScalar(0.001 + vis.current * 0.999);
    g.current.visible = vis.current > 0.01;
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.004, 0]} rotation-x={-Math.PI / 2} material={aoMat} renderOrder={1}>
        <planeGeometry args={[r * 2.9, r * 2.9]} />
      </mesh>
      <mesh position={[0, 0.055, 0]} material={mats.obsidian}>
        <cylinderGeometry args={[r, r * 1.035, 0.11, 72]} />
      </mesh>
      <mesh position={[0, 0.111, 0]} rotation-x={-Math.PI / 2} material={mats.titanium}>
        <ringGeometry args={[r * 0.965, r * 1.005, 96]} />
      </mesh>
      <mesh ref={ring} position={[0, 0.113, 0]} rotation-x={-Math.PI / 2} material={ringMat}>
        <ringGeometry args={[r * 0.8, r * 0.806, 128]} />
      </mesh>
      {/* tick marks, the kind a precision instrument has on its bezel */}
      <Ticks r={r * 0.9} mat={mats.titaniumDark} />
      <mesh position={[0, 0.006, 0]} rotation-x={-Math.PI / 2} material={poolMat}>
        <planeGeometry args={[r * 5, r * 5]} />
      </mesh>
      {backlight && (
        <mesh position={[0, r * 1.55, -r * 0.7]} material={haloMat}>
          <planeGeometry args={[r * 2.6, r * 3.6]} />
        </mesh>
      )}
      {portal > 0 && (
        <group ref={prt} position={[0, portal * 1.12 + 0.1, -r * 0.78]}>
          <mesh material={mats.titanium}><torusGeometry args={[portal, portal * 0.014, 12, 200]} /></mesh>
          <mesh material={mats.lineB}><torusGeometry args={[portal * 0.972, portal * 0.0035, 6, 200]} /></mesh>
        </group>
      )}
    </group>
  );
}
function Ticks({ r, mat, n = 60 }) {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const list = useMemo(() => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU, long = i % 5 === 0;
    return [Math.sin(a) * r, 0.114, Math.cos(a) * r, 0.006, 0.002, long ? 0.07 : 0.035, a];
  }), [r, n]);
  return <Instances geo={geo} mat={mat} list={list} />;
}

/* ── the architecture ── a titanium colonnade receding on both sides, long
   linear lights in the ceiling (their reflections run the length of the
   floor), and a smoke-glass facade across the back with a faint horizon of
   light behind it. The sanctuary closes into an apse of fins behind the pet;
   the shop lines its aisle with display plinths. */
const HORIZON_FS = `uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
void main(){
  float y = vUv.y;
  // linear light: these are the values AFTER the sRGB curve lifts them, so
  // "near black" really is near black
  vec3 c = mix(vec3(.0012,.0014,.0026), vec3(.0026,.0026,.0055), smoothstep(0., .6, y));
  c += uB * .012 * exp(-pow((y - .3) * 4., 2.));
  c += uA * .16 * exp(-pow((y - .305) * 170., 2.)) * smoothstep(.0, .6, 1. - abs(vUv.x - .5) * 2.);
  gl_FragColor = vec4(c, 1.);
}`;
function Architecture({ mats, tier, tone, variant }) {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => box.dispose(), [box]);
  const n = tier >= 2 ? 13 : 9;
  // the arena is shot wide; the other rooms are a narrower gallery
  const X = variant === "arena" ? 5.4 : 3.3;
  const fins = useMemo(() => {
    const l = [];
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) l.push([s * X, 3.6, 3 - i * 1.9, 0.14, 7.2, 0.95]);
    return l;
  }, [n, X]);
  const finLights = useMemo(() => {
    const l = [];
    for (const s of [-1, 1]) for (let i = 0; i < n; i += 3) l.push([s * (X - 0.09), 3.2, 3 - i * 1.9, 0.018, 5.6, 0.018]);
    return l;
  }, [n, X]);
  // light blades set into every other fin, and the cove lines running the
  // length of the floor at the colonnade's foot — at eye level they are what
  // the mirror floor doubles, and they draw the perspective into the room
  const blades = useMemo(() => {
    const l = [];
    for (const s of [-1, 1]) for (let i = 1; i < n; i += 2) l.push([s * (X - 0.075), 3.4, 3 - i * 1.9 + 0.3, 0.012, 6.2, 0.012]);
    return l;
  }, [n, X]);
  const coves = useMemo(() => [[-(X - 0.42), 0.012, -9, 0.03, 0.01, 24], [X - 0.42, 0.012, -9, 0.03, 0.01, 24], [0, 0.03, -15.84, 13.8, 0.018, 0.03]], [X]);
  const strips = useMemo(() => (X > 4 ? [-3.2, -1.1, 1.1, 3.2] : [-2, -0.68, 0.68, 2]).map(x => [x, 7.35, -9, 0.07, 0.03, 24]), [X]);
  const panes = useMemo(() => {
    const l = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) l.push([-5.75 + c * 2.3, 1.62 + r * 3.1, -16, 2.24, 3.02, 0.04]);
    return l;
  }, []);
  const mullions = useMemo(() => {
    const l = [];
    for (let c = 0; c <= 6; c++) l.push([-6.9 + c * 2.3, 3.2, -15.95, 0.05, 6.4, 0.08]);
    for (let r = 0; r <= 2; r++) l.push([0, 0.1 + r * 3.1, -15.95, 13.9, 0.05, 0.08]);
    return l;
  }, []);
  // the base line where each fin meets the floor: a thin dark bevel, so the
  // columns sit IN the floor instead of standing on a reflection
  const plinths = useMemo(() => fins.map(f => [f[0], 0.04, f[2], 0.3, 0.08, 1.1]), [fins]);
  const apse = useMemo(() => {
    if (variant !== "pets") return null;
    const l = [];
    for (let i = 0; i < 15; i++) {
      const a = -1.25 + (i / 14) * 2.5;
      l.push([Math.sin(a) * 4.2, 2.4, -1.6 - Math.cos(a) * 4.2, 0.06, 4.8, 0.3, a]);
    }
    return l;
  }, [variant]);
  const apseLights = useMemo(() => apse ? apse.filter((_, i) => i % 2 === 0).map(p => [p[0] * 0.985, 2.1, p[2] + Math.cos(p[6]) * 0.07, 0.012, 3.2, 0.012, p[6]]) : null, [apse]);
  const displays = useMemo(() => {
    if (variant !== "shop") return null;
    const l = [];
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) l.push([s * 2.9, 0.45, -1.5 - i * 2.6, 0.9, 0.9, 0.9]);
    return l;
  }, [variant]);
  const horizon = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: UV_VS, fragmentShader: HORIZON_FS,
    uniforms: { uA: { value: tone.a.clone() }, uB: { value: tone.b.clone() } },
  }), [tone]);
  useEffect(() => () => horizon.dispose(), [horizon]);
  const cyl = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 40), []);
  useEffect(() => () => cyl.dispose(), [cyl]);
  return (
    <group>
      <Instances geo={box} mat={mats.titanium} list={fins} />
      <Instances geo={box} mat={mats.titaniumDark} list={plinths} />
      <Instances geo={box} mat={mats.lineA} list={finLights} />
      <Instances geo={box} mat={mats.blade} list={blades} />
      <Instances geo={box} mat={mats.cove} list={coves} />
      <Instances geo={box} mat={mats.strip} list={strips} />
      {!off("glass") && <Instances geo={box} mat={mats.glass} list={panes} />}
      {!off("mull") && <Instances geo={box} mat={mats.titaniumDark} list={mullions} />}
      {apse && <Instances geo={box} mat={mats.titanium} list={apse} />}
      {apseLights && <Instances geo={box} mat={mats.lineB} list={apseLights} />}
      {displays && <Instances geo={cyl} mat={mats.obsidian} list={displays} />}
      {displays && <Instances geo={cyl} mat={mats.lineA} list={displays.map(d => [d[0], 0.905, d[2], 0.93, 0.004, 0.93])} />}
      {displays && <DisplayPieces mats={mats} list={displays} />}
      <mesh position={[0, 7.5, -6]} rotation-x={Math.PI / 2} material={mats.obsidian}>
        <planeGeometry args={[14, 34]} />
      </mesh>
      {!off("hz") && <mesh position={[0, 6, -24]} material={horizon}>
        <planeGeometry args={[60, 20]} />
      </mesh>}
    </group>
  );
}
/* the shop's aisle: every display carries a slowly turning form — the room
   itself is a showroom before a single card has been read */
function DisplayPieces({ mats, list }) {
  const ref = useRef();
  const geo = useMemo(() => new THREE.OctahedronGeometry(0.2, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((st) => {
    if (!ref.current) return;
    const t = st.clock.elapsedTime;
    list.forEach((d, i) => {
      o.position.set(d[0], 1.35 + Math.sin(t * 0.6 + i) * 0.05, d[2]);
      o.rotation.set(0.3, t * 0.35 + i, 0);
      o.scale.setScalar(1);
      o.updateMatrix(); ref.current.setMatrixAt(i, o.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mats.titanium, list.length]} frustumCulled={false} />;
}

/* ── things that float ── a slow titanium ring over the subject, two obsidian
   monoliths out in the room, a faceted crystal with levels of detail, and a
   drift of small titanium cubes. They lean a little toward the pointer and
   answer a tap with a pulse — enough to feel alive, not enough to distract. */
function Floaters({ mats, tier, feed, pulse, variant }) {
  const ring = useRef(), m1 = useRef(), m2 = useRef(), cr = useRef(), cubes = useRef();
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 2.8, 0.12)), []);
  const cubeGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const N = tier >= 2 ? 26 : 12;
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({
    x: (Math.sin(i * 12.9898) * 0.5) * 10, y: 2.2 + ((i * 0.618) % 1) * 4.4, z: -5 - ((i * 0.377) % 1) * 10,
    s: 0.03 + ((i * 0.713) % 1) * 0.05, p: i * 1.7,
  })), [N]);
  // the crystal is glass on a desktop GPU (real refraction), obsidian below it
  const crystalMat = useMemo(() => tier >= 3 ? new THREE.MeshPhysicalMaterial({
    color: "#b9c8ff", metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.7, ior: 1.52,
    envMapIntensity: 1.4, clearcoat: 1, attenuationColor: new THREE.Color(VIOLET), attenuationDistance: 1.6,
  }) : null, [tier]);
  useEffect(() => () => { edges.dispose(); cubeGeo.dispose(); crystalMat && crystalMat.dispose(); }, [edges, cubeGeo, crystalMat]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const hover = useRef(false);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime, px = feed.pointer[0], py = feed.pointer[1];
    const k = pulse.current || 0;
    if (ring.current) {
      if (variant === "arena" || variant === "shop") {
        ring.current.rotation.y = t * 0.06 + px * 0.1;
        ring.current.rotation.x = Math.PI / 2 + 0.2 + Math.sin(t * 0.3) * 0.03 - py * 0.05;
        ring.current.position.y = (variant === "arena" ? 3.95 : 4.2) + Math.sin(t * 0.5) * 0.06 + k * 0.1;
      } else {
        // stood on edge behind the subject, turning a few degrees either way
        ring.current.rotation.y = Math.sin(t * 0.13) * 0.32 + px * 0.14;
        ring.current.rotation.x = Math.sin(t * 0.21) * 0.04 - py * 0.05;
        ring.current.position.y = (variant === "pets" ? 1.35 : 2.05) + Math.sin(t * 0.5) * 0.04 + k * 0.06;
      }
    }
    if (m1.current) { m1.current.position.y = 2.9 + Math.sin(t * 0.42) * 0.12; m1.current.rotation.y = -0.4 + Math.sin(t * 0.2) * 0.1 + px * 0.08; }
    if (m2.current) { m2.current.position.y = 3.4 + Math.sin(t * 0.37 + 2) * 0.14; m2.current.rotation.y = 0.5 + Math.sin(t * 0.17) * 0.1 + px * 0.08; }
    if (cr.current) {
      cr.current.rotation.y += dt * (0.25 + k * 2.4);
      cr.current.rotation.x = Math.sin(t * 0.3) * 0.2;
      cr.current.scale.setScalar(damp(cr.current.scale.x, hover.current ? 1.08 : 1, 6, dt));
    }
    if (cubes.current) {
      for (let i = 0; i < seeds.length; i++) {
        const q = seeds[i];
        o.position.set(q.x + Math.sin(t * 0.1 + q.p) * 0.3, q.y + Math.sin(t * 0.23 + q.p) * 0.25, q.z);
        o.rotation.set(t * 0.1 + q.p, t * 0.13 + q.p, 0);
        o.scale.setScalar(q.s);
        o.updateMatrix(); cubes.current.setMatrixAt(i, o.matrix);
      }
      cubes.current.instanceMatrix.needsUpdate = true;
    }
    if (pulse.current) pulse.current = Math.max(0, pulse.current - dt * 1.6);
  });
  const tap = (e) => { e.stopPropagation(); pulse.current = 1; };
  const crystal = (detail) => (
    <mesh material={crystalMat || mats.obsidian}><icosahedronGeometry args={[0.55, detail]} /></mesh>
  );
  const arena = variant === "arena";
  const ringR = arena ? 3.1 : variant === "shop" ? 2.6 : variant === "pets" ? 1.05 : 1.75;
  return (
    <group>
      {variant === "shop" && (
        <group ref={ring} position={[0, 3.3, -6]}>
          <mesh material={mats.titanium}><torusGeometry args={[ringR, 0.02, 12, 200]} /></mesh>
          <mesh material={mats.lineB}><torusGeometry args={[ringR * 0.972, 0.0045, 6, 200]} /></mesh>
        </group>
      )}
      {!arena && <>
      <group ref={m1} position={[-3.3, 2.9, -7]} rotation={[0, -0.4, 0.04]}>
        <mesh material={mats.obsidian}><boxGeometry args={[0.5, 2.8, 0.12]} /></mesh>
        <lineSegments geometry={edges} material={mats.edgeA} />
      </group>
      <group ref={m2} position={[3.6, 3.4, -9]} rotation={[0, 0.5, -0.03]}>
        <mesh material={mats.obsidian}><boxGeometry args={[0.5, 2.8, 0.12]} /></mesh>
        <lineSegments geometry={edges} material={mats.edgeA} />
      </group>
      <group ref={cr} position={arena ? [3.1, 4.9, -6.5] : [2.4, 4.3, -5]} onClick={tap}
        onPointerOver={() => { hover.current = true; }} onPointerOut={() => { hover.current = false; }}>
        <Detailed distances={[0, 9, 18]}>{crystal(2)}{crystal(1)}{crystal(0)}</Detailed>
        <mesh material={mats.edgeA} scale={1.004}><icosahedronGeometry args={[0.55, 1]} /></mesh>
      </group>
      </>}
      <instancedMesh ref={cubes} args={[cubeGeo, mats.titanium, N]} frustumCulled={false} />
    </group>
  );
}

/* ── air ── dust in the light, and the light shafts it hangs in */
const DUST_VS = `uniform float uT; uniform float uS; attribute float aP; varying float vA;
void main(){
  vec3 p = position;
  p.y += sin(uT * .12 + aP) * .35; p.x += sin(uT * .07 + aP * 1.7) * .25;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_PointSize = min(uS * (1. + fract(aP) * 1.4) / max(-mv.z, 1.), 7.);
  vA = .35 + .65 * fract(aP * 3.1);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FS = `uniform vec3 uC; varying float vA;
void main(){ vec2 d = gl_PointCoord - .5; float a = smoothstep(.5, 0., length(d)); gl_FragColor = vec4(uC * a * vA * .5, 1.); }`;
function Dust({ tier, tone, dpr, zMax = 3 }) {
  const N = tier >= 2 ? 520 : 200;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry(), p = new Float32Array(N * 3), a = new Float32Array(N);
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < N; i++) {
      p[i * 3] = (rnd() - 0.5) * 12; p[i * 3 + 1] = rnd() * 6.5; p[i * 3 + 2] = zMax - rnd() * (zMax + 14);
      a[i] = rnd() * 100;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("aP", new THREE.BufferAttribute(a, 1));
    return g;
  }, [N, zMax]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uS: { value: 8.5 * dpr }, uC: { value: tone.key.clone() } },
  }), [tone, dpr]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((st) => { mat.uniforms.uT.value = st.clock.elapsedTime; });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
const SHAFT_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const SHAFT_FS = `uniform vec3 uC; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(abs(dot(vN, vV)), 1.6); float fall = pow(vUv.y, 1.4); gl_FragColor = vec4(uC * f * fall * uA, 1.); }`;
function Shafts({ tier, tone, variant }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, uniforms: { uC: { value: tone.key.clone() }, uA: { value: tier >= 2 ? 0.065 : 0.05 } },
  }), [tier, tone]);
  useEffect(() => () => mat.dispose(), [mat]);
  const list = variant === "arena" ? [[-2.8, -3, 1.6], [0, 0.2, 2.4], [2.9, -6, 1.7]]
    : variant === "pets" ? [[0, -0.1, 1.6], [-2.6, -5, 1.4], [2.8, -7.5, 1.5]]
    : [[-2.2, -4.5, 1.5], [0, -1.2, 2.1], [2.6, -8, 1.7]];
  return (
    <group>
      {list.map(([x, z, r], i) => (
        <mesh key={i} position={[x, 3.7, z]} material={mat}>
          <coneGeometry args={[r, 7.4, 40, 1, true]} />
        </mesh>
      ))}
    </group>
  );
}

/* ── hologram panels ── thin read-outs drawn to a small canvas and shown on
   a scanlined, slightly flickering plane that fades at its edges. The data
   is real where the page has some (the fight's round and clock, the pet's
   vitals) and quiet telemetry where it does not. */
const HOLO_FS = `uniform sampler2D uTex; uniform float uT; uniform float uA; uniform vec3 uTint; varying vec2 vUv;
void main(){
  vec4 c = texture2D(uTex, vUv);
  float scan = .8 + .2 * sin(vUv.y * 420. + uT * 2.);
  float edge = smoothstep(0., .06, vUv.x) * smoothstep(0., .06, 1. - vUv.x) * smoothstep(0., .08, vUv.y) * smoothstep(0., .08, 1. - vUv.y);
  float flick = .95 + .05 * sin(uT * 13. + sin(uT * 3.7) * 4.);
  vec3 col = c.rgb * scan * flick * uA * edge + uTint * .03 * edge;
  gl_FragColor = vec4(col, 1.);
}`;
function drawHolo(cv, kind, data, t, tone) {
  const g = cv.getContext("2d"), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const A = tone.a, B = tone.b;
  const ca = (al) => `rgba(${Math.round(A.r * 255)},${Math.round(A.g * 255)},${Math.round(A.b * 255)},${al})`;
  const cb = (al) => `rgba(${Math.round(B.r * 255)},${Math.round(B.g * 255)},${Math.round(B.b * 255)},${al})`;
  // corner brackets rather than a box: the panel is implied, not drawn
  g.strokeStyle = ca(0.55); g.lineWidth = 1.5;
  const c = 18;
  g.beginPath();
  g.moveTo(6, 6 + c); g.lineTo(6, 6); g.lineTo(6 + c, 6);
  g.moveTo(W - 6 - c, 6); g.lineTo(W - 6, 6); g.lineTo(W - 6, 6 + c);
  g.moveTo(W - 6, H - 6 - c); g.lineTo(W - 6, H - 6); g.lineTo(W - 6 - c, H - 6);
  g.moveTo(6 + c, H - 6); g.lineTo(6, H - 6); g.lineTo(6, H - 6 - c);
  g.stroke();
  const lines = (data && data[kind]) || null;
  const title = lines ? lines.title : kind === "a" ? "SYNC · 07" : "CORE TELEMETRY";
  g.fillStyle = "rgba(225,235,255,.92)"; g.font = "300 24px Prompt, 'Noto Sans Thai', system-ui, sans-serif"; g.textBaseline = "top";
  g.fillText(title, 24, 22);
  g.fillStyle = ca(0.5); g.fillRect(24, 56, 44, 1.5);
  g.font = "300 15px 'IBM Plex Mono', ui-monospace, monospace";
  const rows = lines ? lines.rows : [["LATENCY", (11 + Math.sin(t) * 2).toFixed(1) + " ms"], ["FIELD", (97.2 + Math.sin(t * .7)).toFixed(1) + " %"], ["NODE", "07 / 12"]];
  rows.forEach((r, i) => {
    g.fillStyle = "rgba(160,180,210,.7)"; g.fillText(String(r[0]), 24, 72 + i * 26);
    g.fillStyle = "rgba(225,235,255,.9)"; const v = String(r[1]); g.fillText(v, W - 26 - g.measureText(v).width, 72 + i * 26);
  });
  // a sparkline with its endpoint marked
  g.beginPath();
  let lx = 0, ly = 0;
  for (let i = 0; i < 60; i++) {
    const x = 24 + i * ((W - 48) / 59);
    const v = lines && lines.series ? lines.series[i % lines.series.length] : 0.5 + 0.3 * Math.sin(i * 0.35 + t * 1.3) * Math.sin(i * 0.11 + t * 0.4);
    const y = H - 28 - v * 52;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
    lx = x; ly = y;
  }
  g.strokeStyle = cb(0.9); g.lineWidth = 1.6; g.stroke();
  g.fillStyle = "rgba(235,242,255,.95)"; g.beginPath(); g.arc(lx, ly, 3, 0, TAU); g.fill();
}
const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
};
function Holo({ kind, position, rotation, scale = 1, feed, tone }) {
  const cv = useMemo(() => makeCanvas(512, 288), []);
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t; }, [cv]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: UV_VS, fragmentShader: HOLO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, uniforms: { uTex: { value: tex }, uT: { value: 0 }, uA: { value: 1.05 }, uTint: { value: tone.a.clone() } },
  }), [tex, tone]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  const last = useRef(-9);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    mat.uniforms.uT.value = t;
    if (t - last.current > 0.5) { last.current = t; drawHolo(cv, kind, feed.data, t, tone); tex.needsUpdate = true; }
  });
  return (
    <mesh position={position} rotation={rotation} scale={scale} material={mat}>
      <planeGeometry args={[1.6, 0.9]} />
    </mesh>
  );
}

/* ── the camera ── slow, weighted, and it never snaps. It drifts on its own,
   leans with the pointer, travels with the page's scroll, and settles with a
   critically damped follow so every move eases in and out. Each room opens
   on a short dolly, and the arena answers a knockout by leaning in. */
/* Each shot is solved from where the page actually puts its subject, so a
   figure drawn in the DOM and the plinth drawn here agree on its size.
   lobby — the hero canvas holds the robot from 9% to 91% of its height; a
   2 m figure framed like that is a 40° lens 3.35 m out at waist height
   (0.96 m), level, which puts the horizon at the robot's belt and shows the
   plinth at a 16° rake. pets — feet at 82%, head at 32% of the room, a
   0.9 m creature: 40° at 2.46 m, 0.7 m up, 2.7° down. arena — feet on the
   stage's floor line (91% portrait / 79% landscape) with 58-69% tall
   figures: 40° at 4.4 m, eye height 1.45, pitched 2°, holds both. shop —
   the inspection stage: the subject stands 2.9 m out on a 38° lens. */
const SHOTS = {
  arena: { pos: [0, 1.45, 4.4], look: [0, 1.3, 0], fov: 40, par: 0.08, scroll: [0, 0, 0], from: [0, 2.2, 7.4] },
  lobby: { pos: [0.25, 0.96, 3.35], look: [0, 0.995, 0], fov: 40, par: 0.14, scroll: [0, 0.34, 0.5], from: [0.8, 1.5, 5.4] },
  pets:  { pos: [0, 0.704, 2.46], look: [0, 0.588, 0], fov: 40, par: 0.12, scroll: [0, 0.28, 0.4], from: [0.45, 1.1, 3.9] },
  shop:  { pos: [0, 0.82, 2.9], look: [0, 0.72, 0], fov: 38, par: 0.12, scroll: [0, 0, 0], from: [0.5, 1.3, 4.4] },
  /* the shop's inspection stage: subject's feet at 86%, a 0.9 m pet reaching
     26% (38° at 2.18 m, 0.54 up) or a 2 m chassis reaching 10% (3.82 m out,
     0.95 up), both shot level so the plinth shows its 14° rake */
  "shop-pet": { pos: [0, 0.543, 2.18], look: [0, 0.54, 0], fov: 38, par: 0.1, scroll: [0, 0, 0], from: [0.4, 0.95, 3.4] },
  "shop-bot": { pos: [0, 0.946, 3.82], look: [0, 0.946, 0], fov: 38, par: 0.1, scroll: [0, 0, 0], from: [0.6, 1.45, 5.3] },
};
function Rig({ variant, feed, bus }) {
  const reduced = !!feed.reduced;
  const { camera } = useThree();
  const S = SHOTS[variant] || SHOTS[roomOf(variant)] || SHOTS.lobby;
  const look = useMemo(() => new THREE.Vector3(...S.look), [S]);
  const cur = useMemo(() => new THREE.Vector3(...S.look), [S]);
  const push = useRef(0);
  useEffect(() => {
    camera.fov = S.fov;
    camera.position.set(...(reduced ? S.pos : S.from));
    camera.updateProjectionMatrix();
  }, [camera, S, reduced]);
  useEffect(() => {
    if (!bus) return undefined;
    return bus.on((e) => {
      if (!e) return;
      if (e.type === "ko") push.current = 1;
      if (e.type === "round") { push.current = 0; if (!reduced) camera.position.z += 1.2; }
    });
  }, [bus, camera, reduced]);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime, m = reduced || variant === "arena" ? 0 : 1;
    const sc = Math.max(0, Math.min(1, feed.scroll || 0));
    const px = feed.pointer[0] * m, py = feed.pointer[1] * m;
    const k = push.current * (reduced ? 0 : 1);
    const tx = S.pos[0] + S.scroll[0] * sc + px * S.par + Math.sin(t * 0.11) * 0.08 * m;
    const ty = S.pos[1] + S.scroll[1] * sc - py * S.par * 0.45 + Math.sin(t * 0.07) * 0.05 * m - k * 0.25;
    const tz = S.pos[2] + S.scroll[2] * sc - k * 1.6;
    const ease = variant === "arena" ? 2.0 : 2.4;
    camera.position.x = damp(camera.position.x, tx, ease, dt);
    camera.position.y = damp(camera.position.y, ty, ease, dt);
    camera.position.z = damp(camera.position.z, tz, ease * 0.8, dt);
    look.set(S.look[0] + px * S.par * 0.3, S.look[1] + sc * S.scroll[1] * 0.35 - k * 0.1, S.look[2] - sc * 0.6);
    cur.x = damp(cur.x, look.x, 3, dt); cur.y = damp(cur.y, look.y, 3, dt); cur.z = damp(cur.z, look.z, 3, dt);
    camera.lookAt(cur);
  });
  return null;
}

/* ── the arena's set ──
   The fight camera never moves far, so the arena is designed for that one
   frame: a wall of frosted glass lit from behind a few metres back, with
   titanium mullions standing in front of it, so both fighters play as
   silhouettes against haze — the oldest trick in the cinematographer's book
   for making two figures read. Two light columns frame the stage; the floor
   doubles all of it. */
const HAZE_FS = `uniform vec3 uA; uniform vec3 uB; uniform vec3 uK; uniform float uI; varying vec2 vUv;
void main(){
  vec2 p = (vUv - vec2(.5, .16)) * vec2(1.5, 2.3);
  float core = exp(-dot(p, p) * 2.4);
  float wash = exp(-pow((vUv.x - .12) * 5., 2.)) + exp(-pow((vUv.x - .88) * 5., 2.));
  vec3 c = uK * core * .05 + mix(uA, uB, vUv.x) * (core * .02 + wash * .007);
  c *= smoothstep(0., .05, vUv.y) * (1. - smoothstep(.6, 1., vUv.y) * .85);
  gl_FragColor = vec4(c * uI, 1.);
}`;
function ArenaSet({ mats, tone }) {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const haze = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: UV_VS, fragmentShader: HAZE_FS,
    uniforms: { uA: { value: tone.a.clone() }, uB: { value: tone.b.clone() }, uK: { value: tone.key.clone() }, uI: { value: 1 } },
  }), [tone]);
  useEffect(() => () => { box.dispose(); haze.dispose(); }, [box, haze]);
  const mull = useMemo(() => {
    const l = [];
    for (let i = -7; i <= 7; i++) l.push([i * 1.25, 3.5, -8.25, 0.045, 7, 0.06]);
    l.push([0, 2.75, -8.22, 18, 0.035, 0.05], [0, 0.02, -8.2, 18, 0.04, 0.08]);
    return l;
  }, []);
  const cols = useMemo(() => [[-4.3, 2.9, -4.6, 0.035, 5.8, 0.035], [4.3, 2.9, -4.6, 0.035, 5.8, 0.035]], []);
  const caps = useMemo(() => [[-4.3, 0.06, -4.6, 0.22, 0.12, 0.22], [4.3, 0.06, -4.6, 0.22, 0.12, 0.22], [-4.3, 5.84, -4.6, 0.16, 0.08, 0.16], [4.3, 5.84, -4.6, 0.16, 0.08, 0.16]], []);
  return (
    <group>
      <mesh position={[0, 3.5, -8.4]} material={haze}><planeGeometry args={[20, 7]} /></mesh>
      <Instances geo={box} mat={mats.titaniumDark} list={mull} />
      <Instances geo={box} mat={mats.blade} list={cols} />
      <Instances geo={box} mat={mats.titanium} list={caps} />
    </group>
  );
}

/* ── the arena's frame ──
   During a fight the room holds perfectly still: the camera is locked off,
   so every frame of the room would be the same frame. It renders while the
   camera is moving — the opening dolly, a new round, the push-in on a KO —
   and then stops, costing nothing at all while the fight is on. What does
   move every frame (the light pooled under each fighter, the contact
   shadow, the ripple of a hit) is drawn by the fight's own FX canvas, in
   front of this room and behind the fighters, which it was already
   painting at 60 fps anyway.

   This component keeps the arena disc under the fighters' floor line (the
   page measures it), and wakes the room when the fight says the camera is
   about to move. */
function ArenaFrame({ bus, center, feed }) {
  const { camera, size } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  // a resize is a new frame to settle into
  useEffect(() => { feed.wake = Math.max(feed.wake, performance.now() + 700); }, [size.width, size.height, feed]);
  useEffect(() => {
    if (!bus) return undefined;
    return bus.on((e) => {
      if (e && (e.type === "round" || e.type === "ko")) feed.wake = Math.max(feed.wake, performance.now() + 3600);
    });
  }, [bus, feed]);
  useFrame((st, dt) => {
    const gy = Math.max(0.5, Math.min(0.995, feed.ground || 0.95));
    if (center && floorAt(ray, camera, 0, -(gy * 2 - 1), hit)) {
      center.current.x = 0; center.current.z = damp(center.current.z, hit.z - 0.9, 6, dt);
    }
  });
  return null;
}

/* The environment the metal and glass reflect: a handful of light cards
   rendered once into a prefiltered (PMREM) map — no HDR download, one
   render, and nothing in it that needs a document, so it builds in a worker
   the same as on the page. */
function Env({ tone }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const s = new THREE.Scene();
    s.background = new THREE.Color("#020306");
    const plane = new THREE.PlaneGeometry(1, 1);
    const card = (w, h, hex, k, pos, rot) => {
      const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide, toneMapped: false }));
      m.scale.set(w, h, 1); m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      s.add(m);
    };
    [-3.2, -1.1, 1.1, 3.2].forEach((x) => card(0.3, 26, tone.hexKey, 3, [x, 6, -6], [Math.PI / 2, 0, 0]));
    card(8, 3, tone.hexA, 0.9, [-7, 2.5, -2], [0, Math.PI / 2, 0]);
    card(8, 3, tone.hexB, 0.9, [7, 2.5, -4], [0, -Math.PI / 2, 0]);
    card(14, 1.2, tone.hexKey, 0.5, [0, 2, -14]);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(tone.hexKey).multiplyScalar(0.8), side: THREE.DoubleSide, toneMapped: false }));
    ring.position.set(0, 3, 6); s.add(ring);
    const rt = pm.fromScene(s, 0.02, 0.1, 60);
    scene.environment = rt.texture;
    s.traverse((o) => { if (o.material) o.material.dispose(); });
    plane.dispose(); ring.geometry.dispose(); pm.dispose();
    return () => { if (scene.environment === rt.texture) scene.environment = null; rt.dispose(); };
  }, [gl, scene, tone]);
  return null;
}

function Scene({ variant: shot, tier, tone, feed, bus, dpr }) {
  const variant = roomOf(shot);
  const mats = useMats(tone);
  const pulse = useRef(0);
  const arena = variant === "arena";
  const center = useRef({ x: 0, z: 2.2 });
  return (
    <>
      <color attach="background" args={["#030407"]} />
      <fogExp2 attach="fog" args={["#05070b", (arena ? 0.03 : 0.05) * tone.fog]} />
      <ambientLight intensity={0.05} />
      <hemisphereLight args={["#9fb6ff", "#050608", 0.16]} />
      <spotLight position={[1.5, 7, 3.5]} angle={0.55} penumbra={1} intensity={140} distance={22} decay={2} color={tone.hexKey} />
      {tier >= 2 && <pointLight position={[-4.5, 2.6, -3]} intensity={5} distance={11} decay={2} color={tone.hexA} />}
      {tier >= 2 && <pointLight position={[4.5, 2.6, -3.5]} intensity={5} distance={11} decay={2} color={tone.hexB} />}
      {!off("env") && <Env tone={tone} />}
      {!off("floor") && <Floor tier={tier} tone={tone} focusZ={arena ? 2 : 0} />}
      {!off("arch") && <Architecture mats={mats} tier={tier} tone={tone} variant={variant} />}
      {!off("float") && <Floaters mats={mats} tier={tier} feed={feed} pulse={pulse} variant={variant} />}
      {!off("dust") && <Dust tier={tier} tone={tone} dpr={dpr} zMax={arena ? -2.5 : 1.5} />}
      {!off("shaft") && <Shafts tier={tier} tone={tone} variant={variant} />}
      {!arena && <Plinth mats={mats} tone={tone} r={variant === "pets" || shot === "shop-pet" ? 0.42 : shot === "shop-bot" ? 0.55 : 0.6} feed={feed} pulse={pulse} backlight
        portal={variant === "pets" || shot === "shop-pet" ? 0.5 : shot === "shop-bot" ? 0.8 : 0.74} />}
      {arena && <Plinth mats={mats} tone={tone} r={3.2} pulse={pulse} glow={0.55} at={center} />}
      {arena && <ArenaFrame bus={bus} center={center} feed={feed} />}
      {arena && <pointLight position={[0, 4.5, 3]} intensity={26} distance={16} decay={2} color={tone.hexKey} />}
      {arena && !off("set") && <ArenaSet mats={mats} tone={tone} />}
      {!off("holo") && <Holo kind="a" feed={feed} tone={tone} position={arena ? [-4.7, 2.7, -7.6] : [2.5, 2.35, -5.4]} rotation={[0, arena ? 0.3 : -0.36, 0]} scale={arena ? 1.1 : 0.9} />}
      {!off("holo") && <Holo kind="b" feed={feed} tone={tone} position={arena ? [4.7, 2.7, -7.6] : [3.3, 1.2, -6.8]} rotation={[0, arena ? -0.3 : -0.46, 0]} scale={arena ? 1.1 : 0.8} />}
      <Rig variant={shot} feed={feed} bus={bus} />
    </>
  );
}

function Post({ tier, variant }) {
  if (tier < 2) return null;
  return (
    <EffectComposer multisampling={tier >= 3 ? 4 : 0} disableNormalPass>
      {tier >= 3 && variant !== "arena" ? <DepthOfField focusDistance={0.012} focalLength={0.03} bokehScale={2.2} /> : null}
      <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.92} luminanceSmoothing={0.2} radius={0.72} />
      <Vignette offset={0.28} darkness={0.78} />
      <Noise opacity={0.028} premultiply />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

/* The renderer's own tone mapping is used only when there is no
   post-processing chain to do it (tier 1); it follows the tier if the
   monitor steps one down. */
function ToneFix({ tier }) {
  const { gl } = useThree();
  useEffect(() => { gl.toneMapping = tier >= 2 ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1; }, [gl, tier]);
  return null;
}

/* ── the frame pacer ──
   Shaders are compiled off the main thread first (KHR_parallel_shader_compile
   where the driver has it), so the page never freezes while the room is
   being built; only then does the first frame draw, and the canvas fades in
   over the CSS backdrop that was already there. After that, frames are
   issued by hand at the tier's budget.

   It is also the performance monitor. It knows how many frames it meant to
   draw and how many the device actually managed, and it only counts while
   the page is active (an idle page is deliberately slowed, and must not read
   as a slow device). Three bad seconds in a row step the quality down a tier;
   a device that cannot hold even the lightest tier gets the still backdrop
   instead of a stuttering one. */
const raf = (f) => (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(f) : setTimeout(() => f(performance.now()), 16));
const caf = (id) => (typeof cancelAnimationFrame !== "undefined" ? cancelAnimationFrame(id) : clearTimeout(id));
function Pacer({ fps: fps0, feed, calm: calm0, settle = false, onFirst, onSlow }) {
  const { gl, scene, camera, advance } = useThree();
  const cb = useRef({ onFirst, onSlow }); cb.current = { onFirst, onSlow };
  const cfg = useRef({ fps: fps0, calm: calm0 }); cfg.current = { fps: fps0, calm: calm0 };
  useEffect(() => {
    let id = 0, last = -1, owed = 0, dead = false, ready = false, t0 = -1, first = true;
    let win = 0, winT = 0, drawn = 0, bad = 0, grace = 0;
    const tick = (t) => {
      id = raf(tick);
      const dt = last < 0 ? 1000 : t - last; last = t;
      if (!ready || feed.hidden) { win = 0; owed = 0; return; }
      // settle mode: nothing to draw until something moves the camera
      if (settle && !first && performance.now() > feed.wake) { win = 0; owed = 0; return; }
      const { fps, calm } = cfg.current;
      const idle = calm && performance.now() - feed.busy > 2600;
      // the page needs every frame for itself (a pet being turned): the room
      // holds its last frame until it is done — nothing behind the creature
      // moves while you are looking at the creature anyway
      if (feed.quiet) { win = 0; owed = 0; return; }
      const target = idle ? Math.min(fps, 30) : fps, step = 1000 / target;
      /* frames are owed by the clock, not by the time since the last one: a
         90 or 75 Hz screen still gets its 60 a second instead of 45 or 37,
         and a stall is never paid back as a burst */
      owed += dt;
      if (owed < step - 1.5) return;
      owed -= step; if (owed > step) owed = 0;
      if (t0 < 0) { t0 = t - 16; grace = t + 2200; }
      const a0 = performance.now();
      advance((t - t0) / 1000);
      if (DBG) {
        const I = (globalThis.__sp3 = globalThis.__sp3 || { n: 0, ms: 0, calls: 0, tris: 0 });
        I.n++; I.ms += performance.now() - a0; I.calls = gl.info.render.calls; I.tris = gl.info.render.triangles; I.progs = gl.info.programs ? gl.info.programs.length : 0;
      }
      if (first) { first = false; cb.current.onFirst && cb.current.onFirst(); }
      if (t < grace) { win = 0; return; }
      // every second is judged against the pace it was asked to keep
      if (!win || winT !== target) { win = t; winT = target; drawn = 0; return; }
      drawn++;
      if (t - win >= 1000) {
        const got = (drawn * 1000) / (t - win);
        // a little behind for three seconds running: one tier down. Hopelessly
        // behind (under 40% of the pace): down at once, before it is felt
        bad = got < target * 0.72 ? bad + (got < target * 0.4 ? 3 : 1) : 0;
        win = 0;
        if (bad >= 3) { bad = 0; grace = t + 3000; if (!off("noslow")) cb.current.onSlow && cb.current.onSlow(got); }
      }
    };
    id = raf(tick);
    /* let the scene graph mount, then compile everything it needs. This is
       three's compileAsync, written out so the wait can be cancelled: the
       library's own poll keeps running after an unmount and throws on the
       programs the disposed renderer has already thrown away. */
    let poll = 0;
    const warm = raf(() => {
      let mats = null;
      try { mats = gl.compile(scene, camera); } catch (e) { mats = null; }
      const check = () => {
        if (dead) return;
        let pending = 0;
        try {
          if (mats) mats.forEach((m) => { const pr = gl.properties.get(m).currentProgram; if (pr && !pr.isReady()) pending++; });
        } catch (e) { pending = 0; }
        if (!pending) ready = true; else poll = setTimeout(check, 12);
      };
      check();
    });
    return () => { dead = true; caf(id); caf(warm); clearTimeout(poll); };
  }, [advance, gl, scene, camera, feed, settle]);
  return null;
}


/* A tiny emitter for the moments the room answers (a new round, a KO). */
export function createBus() {
  const subs = new Set();
  return { on(f) { subs.add(f); return () => subs.delete(f); }, emit(e) { subs.forEach((f) => { try { f(e); } catch (err) {} }); } };
}

/* What the page tells the room. Mutated in place, read every frame. */
export function createFeed() {
  const now = performance.now();
  return { anchor: null, ground: 0.95, scroll: 0, pointer: [0, 0], busy: now, quiet: false, hidden: false, wake: now + 4200, data: null, reduced: false };
}

/* The room, whole: pacing, scene and post-processing for one quality tier. */
export function SceneRoot({ variant = "lobby", tier = 2, stage = null, feed, bus, dpr = 1, onFirst, onSlow }) {
  const tone = useMemo(() => makeTone(stage, variant), [stage, variant]);
  // the arena room only renders while its camera moves, and 30 is plenty for
  // a slow dolly; everywhere else the capable tiers get 60
  const fps = variant === "arena" ? 30 : tier >= 2 ? 60 : 30;
  useEffect(() => { feed.wake = Math.max(feed.wake || 0, performance.now() + 1200); }, [tier, feed]);
  return (
    <>
      <ToneFix tier={tier} />
      <Pacer fps={fps} feed={feed} calm={variant !== "arena"} settle={variant === "arena"} onFirst={onFirst} onSlow={onSlow} />
      <Scene variant={variant} tier={tier} tone={tone} feed={feed} bus={bus} dpr={dpr} />
      <Post tier={tier} variant={variant} />
    </>
  );
}

export const CAMERA = { fov: 32, near: 0.1, far: 80, position: [0, 1.5, 6] };
export const glOptions = (tier) => ({ antialias: tier <= 1, alpha: false, stencil: false, depth: true, powerPreference: "high-performance" });
