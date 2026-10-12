// 3D backdrop for the management maps (farm decks and shipyard): a slowly orbiting Three.js scene behind the DOM board (owner, 2026-10-12).
import * as THREE from "three";
export interface Deck3D { render(t: number): void; resize(w: number, h: number, dpr: number): void; dispose(): void; }
export function createDeck3D(host: HTMLElement, kind: "plants" | "herd" | "yard"): Deck3D | null {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" }); } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0); host.appendChild(renderer.domElement); renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 1, 4000), geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const G = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g; };
  const M = (c: number, e = 0, ei = 0, m = 0.1, r = 0.6) => { const x = new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: ei, metalness: m, roughness: r }); mats.push(x); return x; };
  scene.fog = new THREE.Fog(kind === "yard" ? 0x050a18 : 0x04141a, 500, 1800);
  scene.add(new THREE.HemisphereLight(kind === "yard" ? 0x7a9cff : 0x7affc8, 0x10162a, 1.1)); const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(300, 500, 400); scene.add(sun);
  const accent = kind === "yard" ? 0x5aa0ff : kind === "herd" ? 0xffc06a : 0x5affa0, pl = new THREE.PointLight(accent, 2.2, 1400); pl.position.set(0, 180, 160); scene.add(pl);
  const floor = new THREE.Mesh(G(new THREE.PlaneGeometry(3000, 3000)), M(0x0b1a22, 0, 0, 0.4, 0.8)); floor.rotation.x = -Math.PI / 2; floor.position.y = -60; scene.add(floor);
  const grid = new THREE.GridHelper(2400, 48, accent, 0x1a3a4a); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35; grid.position.y = -59; scene.add(grid);
  const spin: THREE.Object3D[] = [], bob: THREE.Object3D[] = [];
  if (kind === "yard") {   // a slipway: gantry towers, a long hull spine with ribs, work lights
    const hull = new THREE.Group(); scene.add(hull); hull.position.set(0, 20, -260);
    hull.add(new THREE.Mesh(G(new THREE.CylinderGeometry(34, 38, 760, 20)), M(0x9aa8c0, 0x203050, 0.3, 0.7, 0.35))).rotation.z = Math.PI / 2;
    for (let i = -7; i <= 7; i++) { const rib = new THREE.Mesh(G(new THREE.TorusGeometry(40, 2.2, 8, 24)), M(0x5aa0ff, 0x3a70ff, 1.2, 0.3, 0.4)); rib.position.x = i * 50; rib.rotation.y = Math.PI / 2; hull.add(rib); }
    const ring = new THREE.Mesh(G(new THREE.TorusGeometry(90, 8, 10, 40)), M(0x7affc8, 0x20a070, 0.8, 0.4, 0.4)); ring.position.x = 0; ring.rotation.y = Math.PI / 2; hull.add(ring); spin.push(ring);
    for (const sx of [-1, 1]) for (const z of [-130, 130]) { const tw = new THREE.Mesh(G(new THREE.BoxGeometry(14, 360, 14)), M(0x34425e, 0x101828, 0.3, 0.6, 0.5)); tw.position.set(sx * 420, 100, -260 + z); scene.add(tw); const lamp = new THREE.Mesh(G(new THREE.SphereGeometry(9, 10, 8)), M(0xffe0a0, 0xffd080, 2, 0, 0.3)); lamp.position.set(sx * 420, 290, -260 + z); scene.add(lamp); bob.push(lamp); }
  } else {   // grow racks: tall columns of glowing trays in rows (plants) or pens with soft domes (herd)
    for (let r = -3; r <= 3; r++) for (let c = 0; c < 3; c++) {
      const g = new THREE.Group(); g.position.set(r * 130, 0, -200 - c * 150); scene.add(g);
      if (kind === "plants") { g.add(new THREE.Mesh(G(new THREE.BoxGeometry(10, 200, 10)), M(0x34425e, 0, 0, 0.6, 0.5))).position.set(-40, 40, 0); g.add(new THREE.Mesh(G(new THREE.BoxGeometry(10, 200, 10)), M(0x34425e, 0, 0, 0.6, 0.5))).position.set(40, 40, 0);
        for (let y = 0; y < 4; y++) { const tray = new THREE.Mesh(G(new THREE.BoxGeometry(96, 6, 46)), M(0x1c6a44, 0x20c070, 0.7, 0.1, 0.7)); tray.position.set(0, -40 + y * 48, 0); g.add(tray); const led = new THREE.Mesh(G(new THREE.BoxGeometry(90, 2, 6)), M(0xe8a0ff, 0xd070ff, 2.2, 0, 0.3)); led.position.set(0, -20 + y * 48, 0); g.add(led); } }
      else { const dome = new THREE.Mesh(G(new THREE.SphereGeometry(64, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), M(0xffd9a0, 0x805020, 0.4, 0.1, 0.5)); dome.position.y = -58; g.add(dome); const fen = new THREE.Mesh(G(new THREE.TorusGeometry(64, 3, 8, 28)), M(0xd0a060, 0x604010, 0.5, 0.3, 0.5)); fen.rotation.x = Math.PI / 2; fen.position.y = -58; g.add(fen); bob.push(dome); }
    }
  }
  const N = 220, pp = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pp[i * 3] = (Math.random() - 0.5) * 1400; pp[i * 3 + 1] = -50 + Math.random() * 360; pp[i * 3 + 2] = -700 + Math.random() * 800; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pp, 3)); geos.push(pg); const pm = new THREE.PointsMaterial({ color: accent, size: 4, transparent: true, opacity: 0.7, depthWrite: false }); mats.push(pm); const pts = new THREE.Points(pg, pm); scene.add(pts);
  return {
    render(t) {
      const a = Math.sin(t * 0.11) * 0.45; cam.position.set(Math.sin(a) * 520, 150 + Math.sin(t * 0.17) * 30, 420 + Math.cos(a) * 60); cam.lookAt(0, 30, -220);
      for (const s of spin) s.rotation.x = t * 0.5; bob.forEach((b, i) => { b.position.y += Math.sin(t * 1.4 + i) * 0.12; }); pts.rotation.y = t * 0.02; renderer.render(scene, cam);
    },
    resize(w, h, dpr) { renderer.setPixelRatio(Math.min(dpr, 1.5)); renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); renderer.dispose(); try { host.removeChild(renderer.domElement); } catch (e) {} },
  };
}
