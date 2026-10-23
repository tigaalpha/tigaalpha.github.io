# 40 · Plan: raise High graphics everywhere except PvP

Owner request (2026-10-23): write a plan to push the **High** graphics level higher in every game except PvP (Lobby 3D, Robot Adventure 3D, Alien Hunt, Adventure 2D and ship maps, Colony, Space Ranch, films, Play Along). Plan only; nothing below is built yet.

## 0. Rules this plan must obey
1. **Lite never changes.** Every addition is behind `gfxHigh()` / `HI()` (the stored `tg_adv_gfx = high`). A weak phone keeps today's look and load time.
2. **Loads as fast as today.** No new downloaded art in the first load: everything is procedural or painted once into a cached canvas / texture, as the code does now. Heavy High-only modules are dynamic imports fetched only when High is on.
3. **One watchdog for all.** Every High layer is stepped down in order when the frame time stays over budget (the ground run and ship maps already drop to Lite at about 31 ms over 90 frames). New layers join a ladder: first drop the costliest pass, then the next, then Lite, so a mid phone loses one effect, not everything.
4. **Measured, not guessed.** Each game logs `perf:<map>:<hd|sd>:<fps>fps` (Adventure, Robot Adventure 3D already do). Add the same row to Alien Hunt, Colony, Ranch, Play Along, and add the active High tier to the row. Ship a tier only after a CPU-throttled headless run (4x) holds the frame budget; real phones are checked from the usage rows after release.
5. **No flashing.** Anything bright keeps the existing limit (under about three flashes a second).
6. **PvP is untouched** (DOM / SVG; the older pet and arena 3D scenes are also left alone).
7. Standing owner rule: the main Adventure UI (menu, pad, HUD, pop-ups) is not changed; this plan only touches the picture behind it.

## 1. Where High stands today
| Game | What High already has |
|---|---|
| Alien Hunt, Robot Adventure 3D levels | three.js, shadows, pixel ratio up to 2, `hi-fx.ts` (4x MSAA target, UnrealBloom, tone mapping, grade: fringe, colour, vignette, grain), `RoomEnvironment` reflections, muzzle flash rings, hit flares |
| Robot Adventure 3D cockpit | same `hi-fx` pass |
| Adventure 2D ground runs | dpr up to 2, 60 fps, fog / glow / vignette, one cached grade layer (Lite too), hit-stop, shake |
| Adventure ship maps | nebula layers, glowing stars, heat trail, lit rocks, soft glows, dust, bloom blur, watchdog |
| Colony, Space Ranch | three.js layer: shadows, reflections, day cycle, instanced rocks / ice / ore, steam, fireflies; Ranch is a full 3D world |
| Films | `realLook`, `finishLook`, lens flare, bloom, grain |
| Play Along stage | top graphics level: cached world, moving flares, beams, cars |

## 2. Workstreams (in the order I would build them)

### A. Shared 3D post chain (`hi-fx.ts`) , Alien Hunt, Robot Adventure 3D, cockpit
Biggest gain for the least new code, because one file feeds three games.
1. **Ambient occlusion** (GTAO or SAO, half resolution, depth-aware blur). Grounds crates, aliens and the gun against the floor. Cost: about one extra half-res pass; first to drop on the watchdog ladder.
2. **SMAA / FXAA after tone mapping** for the parts MSAA misses (bloom edges, thin tracers), so the 4x MSAA target can fall to 2x on mid phones.
3. **Depth of field (very light)** and **per-object motion blur** only on the gun swap, the dash and the boss rush, never always on (keeps aim readable).
4. **Better bloom**: separate thresholds for emissive (neon edges, plasma) and sky; a soft lens dirt / streak only on the brightest source.
5. **Colour grade per level kit** (jungle, ice, lava, ruins, gas, belt, sun): one LUT-style matrix per kit instead of one global grade.
6. **HDR sky and image-based light per kit** (a generated gradient cube map, painted once) so metal reflects the level's own sky, not only `RoomEnvironment`.

### B. Scene quality , Alien Hunt and Robot Adventure 3D levels
1. **Shadows**: 2048 maps with PCF-soft on High (1024 elsewhere), cascade or tight-fit to the arena, contact shadows under every alien (cheap projected blob stays on Lite).
2. **Ground**: tiling normal + roughness maps generated procedurally (canvas noise) per kit, so wet asphalt, moss, ice and lava crust catch the lights; screen-space reflection only on the Cryo and Reactor floors if the budget allows.
3. **Volumetric fog and light shafts** (cheap raymarched sprite stack or a fog plane with depth fade) for the Hive, Cryo and Mothership levels; **god rays** behind the key light.
4. **Dynamic lights**: a small pool (6 to 8 point lights) reused by muzzle flashes, plasma, explosions, lava and neon, instead of one-off lights.
5. **Decals**: acid scorch, bullet holes, goo splats that stay for the level (instanced, capped).
6. **Alien materials**: subsurface-style fake (wrap lighting + thickness from a gradient) on the Spitter, Veilmaw and Bloater; wet / glossy clear-coat already on the chitin, add anisotropic highlights on armour plates.
7. **Particles**: GPU-style instanced sprites with soft depth fade (no hard edges on smoke and goo), heat distortion on rocket exhaust and lava.
8. **Vegetation / props** (Luma, Hydroponics): instanced grass and leaf cards swaying with a vertex shader; more rocks and debris with an LOD ring (far ones become billboards).
9. **Pixel ratio**: allow up to 2.5 on a strong device (`spaceTier()` top tier) when the watchdog has headroom; keep 2 as the cap otherwise.

### C. Cockpit (ship episodes)
Engine glow with a real additive volumetric plume, planet atmosphere shell with a rim scatter shader, nebula volume (layered noise cards with parallax), lens-space dust streaks at speed, a cockpit glass layer (subtle reflection and rain-like scan lines), warp tunnel shader for the warp episodes.

### D. Adventure 2D ground runs (canvas)
1. **Parallax in depth**: 4 to 5 baked layers with per-layer fog tint and a slow wind sway on the near layer.
2. **Light pass**: an additive light buffer (small canvas, blurred) where muzzle flashes, bolts, lava, crystals and the hero's glow write light; composited once per frame. This gives the "neon in the dark" look without per-sprite gradients.
3. **Normal-lit sprites** for monsters and the hero: bake a flat normal map beside each cached sprite and shade with the light buffer's direction (a tiny 2D shader through a WebGL overlay canvas, only if WebGL is present).
4. **Weather and atmosphere per planet**: ash, snow, spores, dust storms as capped particle layers.
5. **Screen-space effects**: bloom from a half-res copy (same blur pass used by the ship maps), heat distortion on lava, chromatic edge on hits.
6. Keep the existing watchdog: the light buffer and sprite shading go first when frames slow.

### E. Adventure ship maps
Reuse D's light buffer; add engine light that actually tints nearby rocks and enemies, planet atmosphere glow, volumetric nebula, shield bubbles with fresnel rim, beam weapons with real glow and heat shimmer, explosions with a lit smoke tail. The Battle Station and Black Hole get a gravitational-lens warp around the horizon.

### F. Colony and Space Ranch (three.js layers)
1. **Shadows and AO**: contact AO under buildings, soft sun shadows with a higher map when the camera is zoomed in.
2. **3D terrain** with relief (the colony ground and the ranch hills are still flat): displaced mesh with procedural normals, tinted per site.
3. **Finish the 3D scene**: Ranch barn, silo, trees, fences and pond detail (noted as simplified or still 2D); Colony Starbase landmark and the big dome in 3D; helper vehicles.
4. **Water shader** (Ranch lake and pond: reflection of the sky, shore foam), **real clouds** with shadows drifting over the land, **grass instancing** with wind.
5. **Night mode**: the colony day cycle already dims windows; add emissive bloom on lit windows and street lines, a starry sky shader.
6. **Animals**: a walk cycle for the cow, pig and sheep (bone-less leg swing exists, make it a proper gait) and fur-like shading on the sheep.
7. **Camera polish**: a light depth of field when zoomed to a building or an animal.

### G. Films (`adventure-cine.tsx`)
Render the film canvas at device pixel ratio 2 on High, replace the 1/8-size bloom read-back with a proper half-res separable blur (no CPU read-back), add film-grade LUT per shot mood, depth-of-field blend on close-ups (crew, signal), better planet atmospheres (the procedural planet textures are painted at 512 x 256, raise to 1024 x 512 on High), and soft shadows on the robot and ship models. Cost control: the film runs one shot at a time, so a heavier frame is affordable.

### H. Play Along stage
The world is cached and the top level already animates. Add a higher-resolution cached world (2x on High), a soft bloom on the note gems and the hit line (small blurred copy, once per beat, not per frame), reflective floor with a real mirror fade, and light rays that pulse with the beat. Keep the rule from AGENTS: nothing built per frame, never over about three flashes a second.

### I. Lobby 3D and menus
The Games lobby is DOM with a 3D robot. If "Lobby 3D" means the Robot Adventure 3D story map floor: add a real depth-of-field, planet atmosphere glows, a starfield with parallax and a lit planet sphere (shader sphere instead of a billboard picture) on High. PvP's own arena stays as it is.

## 3. Device tiers and switches
- Keep the user-facing choice **Lite / High**. Add an internal **High tier 1 to 3** chosen by `spaceTier()` and the watchdog result of the last run (stored as `tg_gfx_tier`), so a strong phone gets tier 3 (all effects, pixel ratio 2.5), a mid phone tier 2, and a phone that struggled falls back one tier without asking.
- A hidden test door `tg_gfx_tier` (like the other `tg_*` doors) for headless screenshots.
- The Settings text stays "High"; no new menu rows (owner rule: do not change the main UI).

## 4. Build order and size
| Step | Work | Games touched | Rough effort |
|---|---|---|---|
| 1 | Tier plumbing, watchdog ladder, perf rows everywhere | all | small |
| 2 | A: SMAA, AO, per-kit grade, HDR sky | AH, RA3D, cockpit | medium |
| 3 | B: shadows, ground normals, fog, decals, light pool | AH, RA3D | medium-large |
| 4 | F: Colony/Ranch relief, water, clouds, finish 3D scene | Colony, Ranch | large |
| 5 | D + E: 2D light buffer, normal-lit sprites, weather | Adventure | large |
| 6 | G, H, I, C: films, Play Along, story map, cockpit | films, PA, hub | medium |

## 5. What I cannot verify here
No phone and no GPU: only headless Chromium with software GL and a CPU slowdown. That proves the code runs, the layers switch off on Lite, and relative cost, not how it looks or how fast it is on a real device. The release notes for each step must say so, and the `perf:` usage rows plus the owner's own phone are the real test. Heavy ideas (SSR, volumetrics, normal-lit 2D sprites) are the ones most likely to be dropped by the watchdog on mid phones, so they come after the cheap wins.

## 6. Decisions I need from the owner
1. Is "Lobby 3D" the Robot Adventure 3D story map (section I) or something else?
2. Should a strong phone be allowed pixel ratio 2.5 (sharper, more battery and heat)?
3. Which game first? My suggestion: Alien Hunt / Robot Adventure 3D (workstreams A and B), because one shared file lifts three games.
