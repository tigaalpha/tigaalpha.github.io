// High-graphics post pass shared by the three.js shooters (Alien Hunt, Robot Adventure 3D, cockpit).
// Bloom + a light colour grade + vignette + film grain, drawn through one EffectComposer.
// Any failure falls back to a plain renderer.render (the caller keeps working).
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: 0.035 }, uAb: { value: 0.0016 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT, uVig, uGrain, uAb; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - .5; float d = dot(c,c);
      vec2 o = c * uAb * (1.0 + d * 4.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      float l = dot(col, vec3(.299,.587,.114));
      col = mix(vec3(l), col, 1.12);                       // a little more colour
      col = mix(col * vec3(1.03,1.0,.97), col * vec3(.96,1.0,1.05), smoothstep(.2,.8,l)); // warm shadows, cool lights
      col *= 1.0 - uVig * smoothstep(.15,.7,d*2.0);
      col += (h(vUv * 1024.0 + uT) - .5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export type HiFx = { render: (dt?: number) => void; setSize: (w: number, h: number, pr: number) => void; dispose: () => void; ok: () => boolean };

export function createHiFx(renderer: THREE.WebGLRenderer, scene: THREE.Scene, getCam: () => THREE.Camera, opts: { bloom?: number; radius?: number; threshold?: number } = {}): HiFx {
  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null, grade: ShaderPass | null = null, good = true, t = 0, rp: RenderPass | null = null;
  try {
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    rp = new RenderPass(scene, getCam()); composer.addPass(rp);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), opts.bloom ?? 0.55, opts.radius ?? 0.6, opts.threshold ?? 0.82); composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GRADE as any); composer.addPass(grade);
  } catch (e) { good = false; composer = null; }
  return {
    ok: () => good && !!composer,
    render(dt = 0.016) {
      if (!composer || !good) { renderer.render(scene, getCam()); return; }
      try { t += dt; if (rp) rp.camera = getCam(); if (grade) grade.uniforms.uT.value = t % 100; composer.render(dt); }
      catch (e) { good = false; try { console.warn("HIFX " + (e as any).message); } catch (_) {} renderer.render(scene, getCam()); }
    },
    setSize(w, h, pr) { if (!composer) return; try { composer.setPixelRatio(pr); composer.setSize(w, h); if (bloom) bloom.resolution.set(w / 2, h / 2); } catch (e) { good = false; } },
    dispose() { try { composer && composer.dispose(); } catch (e) {} composer = null; },
  };
}
