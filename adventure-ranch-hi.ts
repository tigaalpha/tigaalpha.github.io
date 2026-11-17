/* The Space Ranch in High, round 2 (owner 2026-11-17: "make the High graphics prettier and more real, keep Lite as it is").
   The 3D ranch (adventure-ranch-3d.ts) was a clean toy farm: one flat green carpet, a blue disc for the lake, white sphere clouds with a flat dark disc for a shadow, and no finish.
   This module adds, procedurally and with nothing downloaded:
   - `macro`: big soft patches of lighter, darker and drier grass multiplied into the meadow, so the ground is not one repeating tile;
   - `tufts`: about 4,000 instanced grass tufts (crossed alpha-tested quads) that sway in the wind, kept off the field, paths, pen, water and buildings;
   - `water`: a shader for the lake and the pond: depth tint, drifting ripples, sky reflection, a sun glint and a ragged shore foam (the old cylinder is hidden while it runs);
   - `clouds`: soft drifting cloud shadows that really darken the land (and the tufts) and a few feathered clouds instead of the white spheres and the flat shadow disc;
   - `finish`: a vignette and a warm key light drawn last, in the same canvas, so the picture has an edge and a mood.
   Every piece is built in its own try/catch; a piece that throws or whose capability is missing leaves the previous High look. A slow-frame watchdog drops the pieces costliest first
   (tufts, then clouds and water, then the rest) before anything old is touched; dispose() frees every geometry, material and texture. High only: this module is a dynamic chunk of the 3D ranch. */
import * as THREE from "three";
import { Painter, fbm, sm } from "./adv3d-hi-util";

export type Water = { cx: number; cz: number; rx: number; rz: number; rot: number; mesh: THREE.Object3D };
export type RanchHiOpts = { scene: THREE.Scene; world: THREE.Group; ground: THREE.Mesh; groundMat: THREE.MeshStandardMaterial; waters: Water[]; oldClouds: THREE.Object3D | null; oldShadows: THREE.Object3D[]; kind: string; geo: { FX: number; FY: number; COLS: number; PAD: { x: number; y: number }; MILL: { x: number; y: number } } };
export type RanchHi = { update(T: number, rawMs: number, sunDir: THREE.Vector3): void; finish(ren: THREE.WebGLRenderer): void; dispose(): void };

const WATER_FS = `uniform float uT; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSkyH; uniform vec3 uSkyZ; varying vec2 vP; varying vec3 vW;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float hgt(vec2 p, float t){ return vn(p * 2.1 + vec2(t * 0.35, t * 0.22)) * 0.6 + vn(p * 4.3 - vec2(t * 0.28, -t * 0.31)) * 0.4; }
void main(){
  float r = length(vP); vec2 p = vW.xz; float t = uT; float e = 0.05;
  float h0 = hgt(p, t), hx = hgt(p + vec2(e, 0.0), t), hz = hgt(p + vec2(0.0, e), t);
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.05, 1.0, -(hz - h0) / e * 0.05));
  vec3 V = vec3(0.6124, 0.5, 0.6124); float ndv = max(dot(n, V), 0.0);
  float fres = 0.14 + 0.5 * pow(1.0 - ndv, 2.2); vec3 R = reflect(-V, n);
  vec3 sky = mix(uSkyH, uSkyZ, clamp(R.y * 1.3, 0.0, 1.0)); sky += vec3(0.12) * smoothstep(0.55, 0.85, vn(R.xz * 3.5 + t * 0.03));
  vec3 body = mix(uDeep, uShallow, smoothstep(0.05, 0.95, r)); body = mix(body, uShallow * 1.25, 0.22 * h0);
  vec3 col = mix(body, sky, fres);
  vec3 L = normalize(uSun); float sd = max(dot(R, L), 0.0); col += vec3(1.0, 0.95, 0.82) * (pow(sd, 160.0) * 2.4 + pow(sd, 20.0) * 0.1);
  float edge = smoothstep(0.78, 0.97, r + (vn(p * 3.0 + t * 0.3) - 0.5) * 0.1); float lines = 0.55 + 0.45 * sin(r * 72.0 - t * 1.5 + vn(p * 5.0) * 6.0);
  col = mix(col, vec3(0.92, 0.97, 1.0), clamp(edge * lines, 0.0, 1.0) * 0.78);
  gl_FragColor = vec4(col, 0.97 * (1.0 - smoothstep(0.96, 1.0, r)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const CLOUD_GLSL = `float cHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cVn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), f.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float cloudShadow(vec2 w, float t){ vec2 p = w * 0.04 + vec2(t * 0.011, t * 0.006); float c = cVn(p * 2.0) * 0.6 + cVn(p * 4.1 + 7.0) * 0.28 + cVn(p * 8.3 + 3.0) * 0.12; return smoothstep(0.46, 0.7, c); }`;
const WATER_VS = `varying vec2 vP; varying vec3 vW; void main(){ vP = position.xy; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const VIG_FS = `uniform float uK; varying vec2 vUv; void main(){ vec2 c = vUv - 0.5; c.x *= 1.15; float d = dot(c, c); float v = smoothstep(0.12, 0.62, d); float warm = smoothstep(0.55, 0.0, length(vUv - vec2(0.25, 0.92)));
  gl_FragColor = vec4(mix(vec3(0.05, 0.09, 0.02), vec3(1.0, 0.88, 0.55), warm * 0.5), (v * 0.34 + warm * 0.07) * uK); }`;

export function createRanchHi(o: RanchHiOpts): RanchHi | null {
  const { scene, world } = o, owned: Array<{ dispose(): void }> = [], added: THREE.Object3D[] = [], pieces: Array<{ name: string; cost: number; on: boolean; off: () => void }> = [];
  const painters: Painter[] = [], tmpC = new THREE.Color(); let t0 = -1;
  const piece = (name: string, cost: number, off: () => void) => { pieces.push({ name, cost, on: true, off }); }, on = (name: string) => { const q = pieces.find(z => z.name === name); return !q || q.on; };
  const ups: Array<(T: number, sunDir: THREE.Vector3) => void> = [];
  const add = (m: THREE.Object3D) => { world.add(m); added.push(m); return m; };
  const R0 = (() => { let s = 4242; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

  /* 1. the meadow's own shading: macro patches of lighter / darker / drier grass, and the shadows of the clouds (one shader hook, two uniforms that the pieces fade in) */
  const gU: any = { uMacro: { value: null as any }, uMacroK: { value: 0 }, uCloudT: { value: 0 }, uCloudK: { value: 0 } }, tuftCloud = { value: 0 };
  try {
    const p = new Painter(512, 512, (u, v, c) => {
      const a = fbm(u, v * 2, 3, 601, 3) - 0.5, b = fbm(u + 0.3, v * 2, 7, 611, 3) - 0.5, d = fbm(u + 0.6, v * 2, 15, 621, 2) - 0.5, dry = sm(0.58, 0.8, fbm(u + 0.1, v * 2, 4, 631, 3)), wet = sm(0.6, 0.82, fbm(u + 0.8, v * 2, 5, 641, 3)), k = 0.5 + 0.26 * a + 0.16 * b + 0.08 * d;
      c[0] = Math.max(0, Math.min(255, (k + 0.1 * dry - 0.05 * wet) * 255)); c[1] = Math.max(0, Math.min(255, (k + 0.02 * dry + 0.04 * wet) * 255)); c[2] = Math.max(0, Math.min(255, (k - 0.13 * dry) * 255)); c[3] = 255;
    }, false);
    painters.push(p); owned.push(p.tex); gU.uMacro.value = p.tex; let ready = false; p.onDone = () => { ready = true; };
    ups.push(() => { if (ready && gU.uMacroK.value < 1) gU.uMacroK.value = Math.min(1, gU.uMacroK.value + 0.02); });
    piece("macro", 1, () => { gU.uMacroK.value = 0; ready = false; });
  } catch (e) { /* the plain meadow stays */ }
  try {
    o.groundMat.onBeforeCompile = (sh: any) => {
      sh.uniforms.uMacro = gU.uMacro; sh.uniforms.uMacroK = gU.uMacroK; sh.uniforms.uCloudT = gU.uCloudT; sh.uniforms.uCloudK = gU.uCloudK;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp; uniform sampler2D uMacro; uniform float uMacroK; uniform float uCloudT; uniform float uCloudK;\n" + CLOUD_GLSL)
        .replace("#include <map_fragment>", "#include <map_fragment>\n  if (uMacroK > 0.0) diffuseColor.rgb *= mix(vec3(1.0), texture2D(uMacro, (vWp.xz + 32.0) / 90.0).rgb * 2.0, uMacroK);\n  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.56, 0.66, 0.84), cloudShadow(vWp.xz, uCloudT) * uCloudK);");
    };
    o.groundMat.customProgramCacheKey = () => "ranch-hi-ground"; o.groundMat.needsUpdate = true;
  } catch (e) { /* no ground hook */ }

  /* 2. grass tufts that sway in the wind */
  try {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!, cols = ["#2f7d2a", "#3f9a36", "#58b744", "#76cf55", "#9be06a"];
    for (let i = 0; i < 11; i++) { const x0 = 64 + (i - 5) * 6.5 + (R0() - 0.5) * 4, h = 60 + R0() * 60, bend = (R0() - 0.5) * 38; g.fillStyle = cols[Math.floor(R0() * 5)]; g.beginPath(); g.moveTo(x0 - 4.2, 128); g.quadraticCurveTo(x0 + bend * 0.35, 128 - h * 0.55, x0 + bend, 128 - h); g.quadraticCurveTo(x0 + bend * 0.45 + 3, 128 - h * 0.45, x0 + 4.2, 128); g.fill(); }
    g.globalCompositeOperation = "source-atop"; const sg = g.createLinearGradient(0, 128, 0, 0); sg.addColorStop(0, "rgba(10,40,10,.55)"); sg.addColorStop(0.5, "rgba(0,0,0,0)"); sg.addColorStop(1, "rgba(255,255,170,.22)"); g.fillStyle = sg; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 2; owned.push(tex);
    const geo = new THREE.BufferGeometry(), P = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0, 0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5]), UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]), NR = new Float32Array(24); for (let i = 0; i < 8; i++) NR[i * 3 + 1] = 1;
    geo.setAttribute("position", new THREE.BufferAttribute(P, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(UV, 2)); geo.setAttribute("normal", new THREE.BufferAttribute(NR, 3)); geo.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 4, 6, 5, 4, 7, 6]); owned.push(geo);   // both faces of both quads are front faces, so the up-pointing normals light them the same from every side
    const uT = { value: 0 }, mat: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, roughness: 1, metalness: 0, color: 0xffffff }); owned.push(mat);
    mat.onBeforeCompile = (sh: any) => { sh.uniforms.uTime = uT; sh.uniforms.uCloudK = gU.uCloudK; sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime; uniform float uCloudK; varying float vCs;\n" + CLOUD_GLSL).replace("#include <begin_vertex>", `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]); float hh = uv.y * uv.y; vCs = cloudShadow(ip.xz, uTime) * uCloudK;
      transformed.x += (sin(uTime * 1.6 + ip.x * 0.8 + ip.z * 0.55) * 0.08 + sin(uTime * 2.4 + ip.x * 1.7 - ip.z * 1.3) * 0.03) * hh;
      transformed.z += cos(uTime * 1.2 + ip.z * 0.7 + ip.x * 0.4) * 0.05 * hh;`);
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vCs;").replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.56, 0.66, 0.84), vCs);"); };
    mat.customProgramCacheKey = () => "ranch-hi-tuft";
    const F = o.geo.FX, Y = o.geo.FY, CW = o.geo.COLS * 2, bad = (x: number, z: number) =>
      (x > F - 0.9 && x < F + CW + 0.9 && z > Y - 0.9 && z < Y + 8 + 0.9) || (x > -1.3 && x < 13.9 && z > 12.4 && z < 22.8) || (x > -1.6 && x < 8.8 && z > -1.4 && z < 4.2)
      || (z > 1.9 && z < 3.1 && x > 0.9 && x < 23.1) || (x > 3.9 && x < 5.1 && z > 2.9 && z < 13.1) || (z > 11.9 && z < 13.1 && x > 4.9 && x < 18.1) || (x > 16.9 && x < 18.1 && z > 12.9 && z < 17.1)
      || Math.hypot(x - 17, z - 17) < 2.4 || Math.hypot((x - 21) / 7.4, (z + 1.5) / 4.2) < 1.08 || Math.hypot((x - 21) / 2.9, (z - 15.6) / 2.0) < 1.1 || Math.hypot(x - 21, z - 1) < 1.8;
    const N = 4600, inst = new THREE.InstancedMesh(geo, mat, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3(); let n = 0, tries = 0;
    while (n < N && tries++ < 60000) { const x = -5 + R0() * 41, z = -5 + R0() * 41; if (bad(x, z)) continue; const clump = fbm((x + 8) / 52, (z + 8) / 26, 9, 651, 3); if (R0() > 0.25 + clump * 1.2) continue;
      const s = 0.21 + R0() * 0.17; e.set(0, R0() * 6.283, 0); q.setFromEuler(e); pv.set(x, 0.005, z); sv.set(s * 1.15, s * (0.8 + R0() * 0.5), s * 1.15); m4.compose(pv, q, sv); inst.setMatrixAt(n, m4);
      tmpC.setHSL((R0() < 0.3 ? 0.19 : 0.255) + (R0() - 0.5) * 0.05 - clump * 0.02, 0.42 + R0() * 0.2, 0.36 + R0() * 0.18 + clump * 0.06); inst.setColorAt(n, tmpC); n++; }
    inst.count = n; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; inst.receiveShadow = true; inst.castShadow = false; inst.frustumCulled = false; add(inst); owned.push(inst as any);
    ups.push((T) => { uT.value = T % 1000; });
    piece("tufts", 3, () => { inst.visible = false; });
  } catch (e) { /* no tufts */ }

  /* 3. water */
  try {
    if (o.waters.length) {
      const g = new THREE.CircleGeometry(1, 56); owned.push(g); const L = (h: number) => new THREE.Color(h);
      const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uDeep: { value: L(0x0c4f8e) }, uShallow: { value: L(0x34b6c8) }, uSkyH: { value: L(0xcfe6f6) }, uSkyZ: { value: L(0x5a9ee6) } }, vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }); owned.push(mat);
      const metas: THREE.Object3D[] = [];
      for (const w of o.waters) { const grp = new THREE.Group(), m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; grp.add(m); grp.position.set(w.cx, 0.064, w.cz); grp.rotation.y = w.rot; grp.scale.set(w.rx, 1, w.rz); m.renderOrder = 3; add(grp); metas.push(grp); w.mesh.visible = false; }
      ups.push((T, sun) => { mat.uniforms.uT.value = T % 1000; mat.uniforms.uSun.value.copy(sun); });
      piece("water", 2, () => { for (const w of o.waters) w.mesh.visible = true; for (const m of metas) m.visible = false; });
    }
  } catch (e) { for (const w of o.waters) w.mesh.visible = true; }

  /* 4. cloud shadows (in the ground and tuft shaders, drifting with the wind) and a few soft clouds instead of the white spheres and the flat dark disc */
  try {
    const cc = document.createElement("canvas"); cc.width = 128; cc.height = 64; const cg = cc.getContext("2d")!; for (let i = 0; i < 9; i++) { const x = 22 + R0() * 84, y = 22 + R0() * 22, r = 16 + R0() * 14, gr = cg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,.55)"); gr.addColorStop(0.55, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)"); cg.fillStyle = gr; cg.fillRect(x - r, y - r, r * 2, r * 2); }
    const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace; owned.push(ct); const sprites: THREE.Sprite[] = [];
    for (let i = 0; i < 5; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, opacity: 0.5, depthWrite: false, fog: false })); owned.push(sp.material); sp.scale.set(11 + (i % 3) * 3, 5.5 + (i % 3) * 1.5, 1); sp.position.set(0, 14 + (i % 2) * 2, 4 + i * 6); sp.userData.x0 = i * 14; add(sp); sprites.push(sp); }
    if (o.oldClouds) o.oldClouds.visible = false; for (const s of o.oldShadows) s.visible = false;
    ups.push((T) => { if (!gU.off) gU.uCloudK.value = Math.min(1, gU.uCloudK.value + 0.02); gU.uCloudT.value = T % 1000; sprites.forEach((sp, i) => { const spd = 0.25 + (i % 3) * 0.12; sp.position.x = ((sp.userData.x0 + T * spd) % 70) - 18; }); });
    piece("clouds", 2, () => { gU.uCloudK.value = 0; gU.off = true; for (const s of sprites) s.visible = false; if (o.oldClouds) o.oldClouds.visible = true; for (const s of o.oldShadows) s.visible = true; });
  } catch (e) { if (o.oldClouds) o.oldClouds.visible = true; for (const s of o.oldShadows) s.visible = true; }

  /* 5. the finish: vignette and a warm key light, drawn last in the same canvas */
  let vigScene: THREE.Scene | null = null, vigCam: THREE.OrthographicCamera | null = null; const vigK = { value: 0 };
  try {
    vigScene = new THREE.Scene(); vigCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const g = new THREE.PlaneGeometry(2, 2), m = new THREE.ShaderMaterial({ uniforms: { uK: vigK }, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }", fragmentShader: VIG_FS, transparent: true, depthTest: false, depthWrite: false }); owned.push(g, m); const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; vigScene.add(mesh);
    piece("finish", 1, () => { vigScene = null; });
  } catch (e) { vigScene = null; }

  if (!pieces.length) return null;
  let fr = 0, slow = 0;
  const ladder = () => { const live = pieces.filter(q => q.on).sort((a, b) => b.cost - a.cost); const q = live[0]; if (q) { q.on = false; try { q.off(); } catch (e) { /* */ } try { console.warn("HIFX ranch-hi dropped " + q.name); } catch (e) { /* */ } } };
  void on;
  return {
    update(T, rawMs, sunDir) {
      if (t0 < 0) t0 = T; for (const p of painters) { if (!p.done) { p.step(3); break; } }
      for (const f of ups) f(T, sunDir); if (vigK.value < 1) vigK.value = Math.min(1, vigK.value + 0.03);
      fr++; if (rawMs > 70) slow++; if (fr >= 90) { if (slow > 45) ladder(); fr = 0; slow = 0; }   // the ranch draws at 25 fps by design (40 ms): a frame over 70 ms is a slow one
    },
    finish(ren) { if (!vigScene || !vigCam || !(ren instanceof THREE.WebGLRenderer)) return; const ac = ren.autoClear; ren.autoClear = false; try { ren.render(vigScene, vigCam); } finally { ren.autoClear = ac; } },
    dispose() {
      for (const q of pieces) { if (q.on) { q.on = false; try { q.off(); } catch (e) { /* */ } } }
      for (const m of added) { try { world.remove(m); } catch (e) { /* */ } } added.length = 0;
      try { o.groundMat.onBeforeCompile = () => {}; o.groundMat.customProgramCacheKey = () => ""; o.groundMat.needsUpdate = true; } catch (e) { /* */ }
      for (const x of owned) { try { x.dispose(); } catch (e) { /* */ } }
    },
  };
}
