// High-graphics post pass shared by the three.js shooters (Alien Hunt, Robot Adventure 3D, cockpit).
// Bloom + a light colour grade + vignette + film grain, drawn through one EffectComposer.
// Any failure falls back to a plain renderer.render (the caller keeps working).
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { spaceTier, isLowEnd } from "./space-stage";

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: 0.035 }, uAb: { value: 0.0016 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1.12 }, uCon: { value: 1.0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT, uVig, uGrain, uAb, uSat, uCon; uniform vec3 uTint; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - .5; float d = dot(c,c);
      vec2 o = c * uAb * (1.0 + d * 4.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      float l = dot(col, vec3(.299,.587,.114));
      col = mix(vec3(l), col, uSat) * uTint;                 // colour, then the level's own tint
      col = (col - .5) * uCon + .5;
      col = mix(col * vec3(1.03,1.0,.97), col * vec3(.96,1.0,1.05), smoothstep(.2,.8,l)); // warm shadows, cool lights
      col *= 1.0 - uVig * smoothstep(.15,.7,d*2.0);
      col += (h(vUv * 1024.0 + uT) - .5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/* a grade per level kit (colour tint, saturation, contrast), so each world has its own look */
const KIT_GRADE: Record<string, [number, number, number, number, number]> = {
  jungle: [0.96, 1.06, 0.95, 1.22, 1.04], desert: [1.08, 1.0, 0.9, 1.1, 1.06], ice: [0.93, 1.02, 1.1, 1.08, 1.05], lava: [1.1, 0.95, 0.88, 1.18, 1.1],
  ruins: [1.0, 1.0, 1.04, 1.0, 1.08], gas: [1.04, 0.98, 1.06, 1.15, 1.03], belt: [0.98, 1.0, 1.05, 1.0, 1.1], sun: [1.12, 1.0, 0.86, 1.2, 1.06],
};
/** High tier 1..3: stored `tg_gfx_tier` wins (a test door and the watchdog's memory); else from the device. 3 = everything (AO, SMAA, 4x MSAA). */
export function hiTier(): number {
  try { const v = parseInt(localStorage.getItem("tg_gfx_tier") || "", 10); if (v >= 1 && v <= 3) return v; } catch (e) { /* */ }
  try { return isLowEnd() ? 1 : spaceTier() >= 3 ? 3 : 2; } catch (e) { return 2; }
}
export type HiFx = { render: (dt?: number) => void; setSize: (w: number, h: number, pr: number) => void; dispose: () => void; ok: () => boolean; tier: () => number; setKit: (k: string) => void };

export function createHiFx(renderer: THREE.WebGLRenderer, scene: THREE.Scene, getCam: () => THREE.Camera, opts: { bloom?: number; radius?: number; threshold?: number; kit?: string } = {}): HiFx {
  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null, grade: ShaderPass | null = null, good = true, t = 0, rp: RenderPass | null = null, ao: GTAOPass | null = null, smaa: SMAAPass | null = null, tr = hiTier(), slow = 0, fr = 0;
  try {
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: tr >= 3 ? 4 : 2 });
    composer = new EffectComposer(renderer, rt);
    rp = new RenderPass(scene, getCam()); composer.addPass(rp);
    if (tr >= 3) { try { ao = new GTAOPass(scene, getCam(), 256, 256); (ao as any).blendIntensity = 0.85; composer.addPass(ao); } catch (e) { ao = null; } }
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), opts.bloom ?? 0.55, opts.radius ?? 0.6, opts.threshold ?? 0.82); composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GRADE as any); composer.addPass(grade);
    if (tr >= 3) { try { smaa = new SMAAPass(); composer.addPass(smaa); } catch (e) { smaa = null; } }
    if (grade && opts.kit) setKitGrade(opts.kit);
  } catch (e) { good = false; composer = null; }
  function setKitGrade(k: string) { const g = KIT_GRADE[k]; if (!g || !grade) return; grade.uniforms.uTint.value.set(g[0], g[1], g[2]); grade.uniforms.uSat.value = g[3]; grade.uniforms.uCon.value = g[4]; }
  return {
    tier: () => tr, setKit: setKitGrade,
    ok: () => good && !!composer,
    render(dt = 0.016) {
      if (!composer || !good) { renderer.render(scene, getCam()); return; }
      try { t += dt; if (rp) rp.camera = getCam(); if (ao) (ao as any).camera = getCam();
        /* the ladder: when frames stay slow (over ~34 ms for 90 frames) drop AO first, then SMAA, then lower bloom; never the whole chain */
        fr++; if (dt > 0.034) slow++; if (fr >= 90) { if (slow > 60) { if (ao && ao.enabled) { ao.enabled = false; tr = 2; } else if (smaa && smaa.enabled) { smaa.enabled = false; } else if (bloom && bloom.strength > 0.3) bloom.strength *= 0.6; try { if (tr < 3) localStorage.setItem("tg_gfx_tier", String(Math.max(1, tr))); } catch (e) { /* */ } } fr = 0; slow = 0; } if (grade) grade.uniforms.uT.value = t % 100; composer.render(dt); }
      catch (e) { good = false; try { console.warn("HIFX " + (e as any).message); } catch (_) {} renderer.render(scene, getCam()); }
    },
    setSize(w, h, pr) { if (!composer) return; try { composer.setPixelRatio(pr); composer.setSize(w, h); if (bloom) bloom.resolution.set(w / 2, h / 2); if (ao) (ao as any).setSize(w * pr, h * pr); if (smaa) smaa.setSize(w * pr, h * pr); } catch (e) { good = false; } },
    dispose() { try { composer && composer.dispose(); } catch (e) {} composer = null; },
  };
}
