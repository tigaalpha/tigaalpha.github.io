# 37 — Plan: Adventure Mode graphics on three.js (PLAN ONLY, nothing built)

Owner request, 2026-10-17: "write a plan to make Adventure Mode's graphics prettier, all of it on three.js. Plan first, do not build yet."

## 0. Where we are (measured from the code, not guessed)

| Screen | Renders with today | three.js today |
|---|---|---|
| Ground runs (`adventure.tsx` `Run`) | canvas 2D side-scroller, robot/pet = stored SVG pictures, monsters painted by `adventure-monsters.ts` | none |
| Ship maps (`adventure-ship.tsx`) | canvas 2D, High mode has bloom + nebula sprites | none |
| Films (`adventure-cine.tsx`) | canvas 2D scenes (about 30 `scene*` functions) + `realLook` / `finishLook` / `lensFlare` | none |
| Map menu (`.adv-menu`) | DOM + cached planet pictures (`planet-orb.ts`) | none |
| Colony (`adventure-colony*.ts`) | 2D backdrop + **three.js buildings layer** | buildings only |
| Space Ranch (`adventure-ranch*.ts`) | 2D scenery + **three.js crops/animals/houses/windmill/rocket** | partial |
| Farm decks, Ark yard, Build episodes | DOM / SVG | none |

Shipped pattern to reuse: an orthographic three.js canvas laid over a cached 2D backdrop, camera matched to the 2D projection, hit boxes untouched, `gfxHigh()` (`adv-gfx.ts`) switching High (three.js) / Lite (2D) live, fall back to 2D on any failure. Proven in headless software GL, never on a real phone.

## 1. Goals and non-goals

Goals: every Adventure screen has a High mode that looks clearly better and a Lite mode that costs nothing; one shared 3D toolkit instead of seven copies; no regression for weak phones; load time not worse.

Non-goals (say so honestly): not ROV/console quality (no artist assets, no baked lightmaps); no change to gameplay rules, hit boxes, controls or the owner's main UI (standing rule 2026-10-17); no downloaded models (everything procedural or tiny).

## 2. Foundation (Phase 0, do first, about 3 to 4 days)

1. `adv-3d/` toolkit, one lazy chunk shared by all screens (three is already a shared chunk):
   - `renderer.ts`: one WebGL context manager. Phones lose contexts and cap them at about 8-16, so ONE renderer is reused screen to screen (dispose geometry, not the context); `webglcontextlost` handler falls back to Lite.
   - `quality.ts`: EXACTLY TWO modes (owner, 2026-10-17): **High** (strong phones: three.js with shadows, reflections, post-processing, particles, DPR up to 2) and **Lite** (weak phones: the shipped 2D drawing, no WebGL context at all). Default from `isLowEnd()` / `spaceTier()` plus the frame-time watchdog that already exists on ground runs and ship maps (High drops to Lite for good after 90 frames over 31 ms); the player can switch in the gear pop-up at any time, live, stored in `tg_adv_gfx` (`high` / `standard`, shown as High / Lite). No third tier.
   - `kit.ts`: shared materials (metal, glass, emissive, rock), shared geometry caches, sprite/particle pools (steam, dust, sparks), instancing helpers, canvas-texture noise (reuse the periodic noise from `planet-orb.ts`).
   - `post.ts`: optional EffectComposer (bloom, vignette, film grade) for High only, one fullscreen pass budget.
   - `light.ts`: sun/day-cycle rig, shadow-camera fitting, per-planet palettes.
2. Perf budget per frame on a mid Android phone: 16 ms total, of which three.js <= 8 ms; draw calls <= 150; triangles <= 150k; shadow map 1024 (High only; Lite has no 3D). Every screen reports `adv` usage rows `gfx:<screen>:<tier>:<fps>` so real phones tell us.
3. Test harness: headless software-GL screenshot script per screen (the colony/ranch scripts are the template) plus a `__adv3d.stats()` hook (draw calls, triangles, ms).

Exit gate: colony and ranch moved onto the toolkit with no visual regression, their smoke tests green in BOTH High and Lite, and the same-seed High-vs-Lite state comparison passing.

## 2b. Two modes, one game: strong and weak phones play together (hard requirement)

Both groups must be able to play the same map, in the same online room, at the same time, with no advantage or disadvantage from the mode. Rules that make that true:

1. **Rendering is read-only.** Gameplay (positions, hit boxes, damage, timers, spawns, drops, scoring, quizzes, rewards) lives in the existing simulation and never reads anything from the renderer. High and Lite draw the SAME state; switching mode changes pixels only. A test asserts it: run a scripted map in High and in Lite from the same seed and compare the final state (kills, crystals, time, drops).
2. **Same fairness in rooms.** Nothing about the mode goes on the wire (no new message, no field in presence); another pilot's ghost, ping, emote, revive and team-war hit are positioned by the same messages and drawn by each client in its own mode. A Lite phone must never see less information than a High phone (no thing visible only in 3D: every enemy attack telegraph, pickup beam, hazard and objective marker exists in both modes, drawn with the same size and colour contrast).
3. **Same difficulty and same frame budget for logic.** The High render must not steal time from the simulation: render at most every other frame when the frame budget is tight, fixed-step simulation as today; the watchdog drops to Lite before the game feels slower. A weak phone on Lite runs exactly today's code path, so it is no slower than now.
4. **Lite is a first-class mode, not a leftover.** It keeps its own tests, its own screenshots in every phase's exit gate, and any new gameplay feature must ship working in Lite first. No phase is "done" until its Lite path is unchanged and green.
5. **Live switching and mixed sessions.** The gear pop-up flips High/Lite instantly mid-run (create or dispose the 3D layer, as colony and ranch already do); a room can contain any mix; if a High phone downgrades itself mid-run nothing else in the room changes.
6. **Same content, same data cost.** No mode downloads assets the other lacks beyond the shared lazy 3D chunk (loaded only in High); Lite never fetches three.js.
7. **Share cards, replays and screenshots** are drawn from the 2D state, so a Lite player and a High player produce the same card.

## 3. Phases per screen (order = value / risk)

### Phase 1 — Ground runs (the game players spend most time in), about 2 weeks
Biggest screen, biggest payoff, highest risk. Keep the side-scrolling 2D gameplay and hit boxes (they are tuned); change what is drawn.
- Perspective camera with a shallow angle and parallax in real depth: 3 scenery layers (far mountains, mid structures, near foliage) as instanced meshes with fog; planet-specific kits (`MID_STYLE` / `NEAR_STYLE` become mesh sets: Luma mushrooms, Ferro mesas, Kryo ice spires, Pyra volcanoes with lava glow, Nexa ruined towers).
- Ground strip as a displaced mesh with a tiling normal map and per-planet shader tint; hazards (lava, shock plates) as emissive decals.
- Monsters: start with billboard sprites lit by the scene (cheap, keeps the existing paintings), then low-poly meshes for the 8 most common types; bosses as segmented meshes with per-part animation.
- Robot and pet: the cached pose pictures stay in Lite; High uses a skinned low-poly robot driven by `heroPoseOf` joint angles (the pose data is already joint-based, so the walk/run/strike cycles map directly).
- Effects: bolts, rockets, explosions, lightning as additive meshes + point lights (capped at 4 lights), screen shake and hit-stop stay as they are.
- Day/atmosphere per planet (dust, ember, snow, spores) as one particle system each.
Risks: input latency (keep gameplay on the existing loop; render is read-only), draw-call blow-up with many monsters (instancing + pool), the 2D hit boxes must match the 3D positions (single world-to-screen function shared by both).

### Phase 2 — Ship maps, about 1 week
Real 3D space: planets as lit spheres with the procedural textures already written (`planetSprite` -> meshes with atmosphere shells and rings), asteroid field as instanced rocks that actually tumble and cast shadows, the player ship and enemy ships as low-poly meshes (the Starship hull is a lathe), engine trails as ribbon meshes, warp/light-speed as a tunnel shader, black hole as a lensing shader (screen-space distortion), mothership/Battle Station as large meshes with lit window rows. Camera stays a fixed side view (gameplay unchanged) with slight perspective.

### Phase 3 — Films, about 1.5 weeks
Replace the highest-impact scenes first (approach, descent, landing, surface, launch, boss reveal) with real 3D shots: a camera rig per shot (dolly, orbit, rack focus), planets/ships/robots as meshes, volumetric light shafts and bloom in High, the existing letterbox / grain / lens flare overlays stay as 2D post. Narration and score timing unchanged. The other 20+ scenes keep the 2D drawing until measured worth it. Lite = today's films.

### Phase 4 — Map menu and clear/loot cards, about 3 days
The map page becomes a slowly rotating star field with real lit planet spheres (`orbPic` textures on meshes, atmosphere rim, clouds on Earth/Venus, rings on Saturn), the route as glowing curves. DOM labels stay (owner's UI is not to change; only the picture behind it).

### Phase 5 — Colony and ranch completion, about 1 week
Colony: 3D terrain with relief (heightmap + the existing regolith texture), 3D sky and horizon, Starbase landmark and big dome as meshes, roads/tubes as geometry, post (bloom on lit windows at night). Ranch: barn, silo, trees (instanced, wind sway), fences, pond with a water shader, grass blades, clouds with moving shadows, tractor/robot/truck/roadster as meshes, a real walk cycle (leg and body animation) for the animals.

### Phase 6 — Management screens (farm decks, Ark yard, build episodes), about 1 week
Today DOM/SVG. Give each a 3D stage behind the DOM controls: hydroponic rows and livestock pens as meshes, the Ark yard as a 3D hull being assembled module by module, the construction episodes (starship, Dyson sphere, gas base, mining base) as 3D build sequences. Controls and hit areas stay DOM.

## 4. Cross-cutting rules
- Every screen must degrade: High -> Lite (2D) automatically on the watchdog, never the other way without the player.
- Lite stays the shipped 2D code, kept and tested; we do not delete it.
- Assets: procedural only; textures generated once into small canvases (<= 512 px), cached; no network.
- Memory: dispose on screen exit; cap textures at 256 MB-equivalent total; one shadow map reused.
- Audio unchanged. Accessibility: reduced-motion turns off camera sway, bloom pulse and flashes (<= 3 per second rule from the film notes still applies).
- Online rooms: ghosts of other pilots render as 3D proxies from the same position messages; nothing new on the wire.
- Never blocks play: first frame must show the 2D scene, the 3D layer fades in when ready (the pattern already used).

## 5. Verification
Per phase: every screenshot and smoke test in BOTH modes, the same-seed High-vs-Lite state comparison, a two-page room test with one High page and one Lite page (the BroadcastChannel room harness already exists), headless software-GL screenshots of each map/planet (light and dark), existing smoke tests for that screen all green, fps rows (`gfx:*`) collected from real phones for a week before the next phase is called done, and a side-by-side Lite vs High screenshot set for the owner. Honest limit repeated: headless proves it draws and the logic holds, not that it is smooth on a real phone.

## 6. Total estimate
About 6 to 7 weeks of focused work for everything, delivered phase by phase so the owner can see each one. Fastest visible gains: Phase 0 + Phase 4 (about a week), then Phase 1.

## 7. Decisions needed from the owner before building
1. Ground runs: keep the side-scroll with 3D art (recommended, gameplay stays exactly as tuned) or a true 3D behind-the-shoulder view (much bigger change, retunes every number).
2. DECIDED by the owner (2026-10-17): exactly two modes, High and Lite, and both must play together (section 2b).
3. Phase order: recommended 0, 4, 1, 2, 5, 3, 6. Films last because they are watched once; ground runs first because they are played most.
4. Weak-phone default: auto by the existing `isLowEnd()` guess plus the watchdog, or always start on Lite and let the player opt in.
5. Budget for real-phone testing: the plan assumes the owner reports fps/feel on at least one mid and one weak phone per phase.
