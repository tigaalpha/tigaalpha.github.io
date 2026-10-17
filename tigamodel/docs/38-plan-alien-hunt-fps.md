# 38 — Plan: "Alien Hunt", a first-person shooter mode on three.js (PLAN ONLY, nothing built)

Owner request, 2026-10-17 (replaces plan 37 for now; plan 37 is PAUSED, not cancelled): a new mode reached from the empty spot the owner circled in red in the PvP lobby (the space above the "Adventure Online" button, under the robot stats, left of the Game Power bar). A first-person, run-and-gun shooter in the spirit of Call of Duty / Counter-Strike: guns, a CoD-style HUD, human-sized alien insects (Independence Day "Harvester" feel, Men in Black bugs, Star Wars creatures), all rendered with three.js. Plan first; the owner will say when to build.

## 0. What already exists we can stand on (checked in the repo)

- three.js 0.173 is a dependency; `space3d-scene.tsx` (964 lines) and `space3d-worker.tsx` already run a 3D scene, with a worker path and low-end detection (`space-stage.tsx`: `isLowEnd()`, `spaceTier()`).
- `fpv.tsx` (144 lines) holds the first-person switch, crosshair, visor and hands pieces used by PvP; Adventure's FPV was removed (owner, 2026-10-12), so this mode must not bring FPV back into Adventure.
- The lobby entry buttons are in `pvp-arena.tsx` (`.pvpadv`, `.pvpadv.online`); the new button joins that column at the red box.
- Game Power (`game-power.ts`): play time drains it, learning refills it; the new mode must use `usePlayDrain` and `enterGame` like Adventure and PvP.
- Fullscreen + landscape helpers `enterFs()` / `exitFsAndUnlock()` exported from `pvp-arena.tsx`.
- Robot classes / skins, pets and the RPG stats (`pvp-rpg.ts`): the player's robot can be the soldier (its head/hand/weapon art is already drawn in 3D elsewhere).
- Realtime rooms pattern (`adv-online.ts`) for later co-op.

## 1. The game in one paragraph

A short mission (3 to 6 minutes) in a first-person view: you move through an abandoned colony street, a hangar or a desert outpost, shoot waves of alien insects with a loadout of guns, and survive to extract. Controls and HUD feel like a console shooter on a phone: left thumb moves, right thumb aims, a fire button on the right, ADS (aim down sights), reload, grenade, sprint, crouch/jump, weapon switch. HUD: crosshair with hit markers, health with a screen-edge damage vignette, ammo/magazine, grenade count, kill feed, a compass/radar showing enemy blips, objective text, wave counter, scoreboard on the end screen.

## 2. Scope decisions (proposed, owner to confirm)

| Topic | Proposal | Why |
|---|---|---|
| Player count | **Solo first** (waves + missions). Co-op rooms (2 to 4) as a later phase; PvP deathmatch NOT in v1 | server authority is not built; shooters are cheat-prone; co-op over the existing Realtime room is tolerable (nothing of value paid) |
| Content rating | Alien-bug violence only: no human enemies, no blood, bugs burst into green goo/sparks and fade; no gore, no real-gun brand names | children can be present (chat safety rule), Play Store rules |
| Names and art | Everything original: our own weapon names, our own alien designs "in the style of" ID4 harvesters / MIB bugs / Star Wars creatures, no copied silhouettes, logos or sounds | legal strategy (07-legal-knowledge-strategy) |
| Tie to the app | Game Power gates it; rewards are EXP, crystals and the daily-capped coins path (same as Adventure); optional "tune-up" music question between waves (ONE question, HANDS OFF gate, never mid-fight) | keeps the learning loop, owner's standing rule "one question at a time" |
| Modes | exactly **High** (three.js full) and **Lite** (cheaper 3D, see 3) and both play the same game | owner's two-mode requirement from plan 37 carries over |
| Selling | nothing sold; no currency purchase (hard rule) | owner rule |

## 3. Two graphics modes for this mode (strong phones and weak phones both play)

A 3D shooter cannot fall back to "2D" the way the colony does, so Lite means "same 3D game, much cheaper":

- **High**: shadows (one cascade, 1024-2048), environment reflections, bloom/vignette/film grade post pass, DPR up to 2, 60 fps target, more enemies on screen (up to about 24), richer particles, dynamic muzzle-flash lights (max 3), animated decals (acid scorch), fog and dust volumes.
- **Lite**: no shadow map (blob shadows), no post, DPR 1, 30 fps cap, enemy cap about 10 on screen, instanced/billboarded far enemies, baked-looking vertex lighting, fewer particles, lower-poly aliens (LOD1 only), texture size halved, simpler HUD effects.
- Identical gameplay: same damage, health, spawn schedule (seeded), hit boxes (simple capsules independent of mesh), aim assist and score. The renderer is read-only over the simulation, so a High and a Lite player in the same co-op room see the same fight.
- Choice: default from `isLowEnd()` / `spaceTier()` plus a frame-time watchdog that drops High to Lite mid-mission; switchable in the pause menu; stored in the existing `tg_adv_gfx` style key (separate key `tg_fps_gfx`).
- A third, smaller guard: if WebGL is missing or the context is lost, the mode shows "needs a newer phone" and returns to the lobby (a shooter has no sensible 2D fallback; this is the one place we say no).

## 4. Technical design

### 4.1 Architecture (new files, one lazy chunk `alien-hunt`, never loaded until the button is tapped)
- `alien-hunt.tsx`: React shell (lobby card, loading, pause, results, settings), mounts the canvas, owns Game Power drain and fullscreen.
- `ah-engine.ts`: fixed-step simulation at 60 Hz (movement, collision, weapons, AI, waves, damage), pure and testable with no three.js import; the renderer reads its state.
- `ah-render.ts`: three.js scene, camera, viewmodel (weapon in hand, arms), enemies, level, effects, post, LOD and quality switches.
- `ah-levels.ts`: level data (modular kit pieces + spawn points + cover + extraction), 3 to 4 levels.
- `ah-weapons.ts`: weapon table (damage, rate, spread, recoil pattern, reload, ADS zoom, ammo, range, falloff).
- `ah-aliens.ts`: alien table (health, speed, attack, size, behaviour), plus procedural mesh builders.
- `ah-input.ts`: touch dual-stick + buttons, gyro aim (optional), keyboard/mouse with pointer lock for desktop testing, gamepad later.
- `ah-hud.tsx`: CoD-style DOM HUD (DOM, not canvas, so text stays crisp and tests can read it).
- `ah-audio.ts`: procedural gun, impact, alien and ambience sounds in the same style as `adventure-sfx.ts` (mic-safe rule does not apply here).
- Test hooks: `window.__ah` (state, spawn, kill-all, teleport, set seed) like the other `__advXxx` hooks.

### 4.2 Movement and camera
Capsule collider vs axis-aligned boxes (kit pieces) with sliding; walk, sprint, crouch, jump; head bob and weapon sway scaled for comfort and reduced-motion; FOV 75 (ADS 55 with scope variants); vertical aim clamp; mobile aim sensitivity curve with dead zone and acceleration; optional gyro with calibration.

### 4.3 Weapons (original names, CoD/CS feel)
v1 loadout: **sidearm pistol**, **assault rifle** (auto, recoil pattern), **SMG**, **pump shotgun**, **marksman rifle** (scoped), **plasma launcher** (grenade-like AoE), **frag/stun grenades**, **melee knife**. Hitscan with spread and recoil for rifles/SMG, projectiles for the launcher, pellets for the shotgun, headshot/weak-point multipliers, falloff by range, penetration none. Viewmodel animations: idle sway, fire kick, reload (magazine out/in), switch, sprint pose, ADS. Muzzle flash sprite + light, brass casings (High), tracers, impact sparks, scorch decals. Upgrades bought with crystals (never coins, never sold): damage, magazine, reload speed, recoil, plus attachments (red dot, extended mag) as cosmetic-plus-stat.

### 4.4 Aliens (human-sized insects; designs original)
Built procedurally in three.js (segmented bodies, lathe/capsule limbs, emissive eyes and bio-lights, instanced where possible), animated by skeletal-lite rigs (bone groups driven by sine/IK-lite) so no downloaded models.
1. **Skitter** (swarmer, fast, small, melee) — low health, comes in groups.
2. **Drone Mantis** (human-sized mantis, leaps, claw strikes) — the basic enemy.
3. **Spitter** (ranged, arcing acid blob, leaves a damaging pool) — keeps distance.
4. **Walker Harvester** (large armoured biomechanical walker, ID4-inspired, plasma beam with a charge-up telegraph, weak point on the underbelly/core) — mid boss.
5. **Burrower** (erupts from the floor, delayed telegraph ring) — ambush.
6. **Wraith Moth** (flying, erratic) — anti-camping.
7. **Hive Queen / Harvester Mothership turret** — final boss: phases, adds, destructible armour plates.
Optional MIB-style "bug in a suit" gag variants and a Star-Wars-style creature (big beast) as flavour later. All telegraphs readable in both quality modes.
AI: simple state machines + steering (chase, strafe, flank, retreat) on a nav grid per level (no nav-mesh dependency), line-of-sight checks, aggro/hearing, pack coordination (limit attackers at once), difficulty scaling by wave.

### 4.5 Levels (modular, procedural-assembled, 3 to 4)
Reusable kit: floor/wall/crate/pillar/container/ramp/door pieces as instanced boxes with trimmed textures generated in canvas (rust, concrete, hazard stripes). 1) Colony street at dusk, 2) Landing hangar, 3) Desert outpost under a huge alien ship (skybox with the Harvester hovering), 4) Hive interior (organic walls, emissive). Per level: spawn points, cover, ammo/health pickups, extraction zone, scripted waves. Baked lighting is faked with vertex colours + a few real lights (High adds shadows).

### 4.6 HUD / UX (CoD-style, our own look)
Crosshair that expands with spread; hit markers (white) and kill markers (red); damage direction indicators; health regenerates after a delay (arcade-friendly); ammo `mag / reserve`; grenade icon; weapon wheel or quick switch; minimap radar with blips; kill feed and score popups ("+100 Skitter", streak bonuses, headshot); objective banner; wave countdown; low-health heartbeat + vignette; scoreboard/results with stars, accuracy, headshot %, time, crystals/EXP earned. Pause menu: resume, settings (sensitivity, gyro, FOV, graphics High/Lite, sound), quit. Buttons sized for thumbs (44 px+), layout editable (left/right-handed, button size) in settings.

### 4.7 Game rules and economy
Waves with brief intermissions (reload, pick upgrades from drops, optional music question); score from kills, headshots, streaks and speed; objective variants (survive N waves, defend a beacon, escort a supply truck, destroy the hive); difficulty Normal/Hard/Nightmare like Adventure. Rewards: EXP and crystals (never sold); coins only through the same daily-capped Adventure loot path (`ADV_COIN_DAY_CAP` style cap, new cap key); Game Power drains while playing (12 s per point as elsewhere) and ends the mission at 0 with the learn pop-up; a "pause" does not drain.

### 4.8 Online co-op (later phase, NOT v1)
Reuse the `advo:<CODE>` room pattern: each client simulates its own enemies from a shared seed, peers send position/aim/fire, damage on numbered enemies is reported (same trust model as Adventure Online: no server authority, nothing valuable paid). PvP deathmatch is deliberately out until server authority exists (`36-plan-adventure-server-authority.md`).

## 5. Performance budget (mid Android phone)
Frame 16 ms (High) / 33 ms (Lite). Draw calls <= 120 (High) / 70 (Lite); triangles <= 120k / 50k; enemies on screen 24 / 10; particles 400 / 120; textures <= 512 px, total GPU memory <= 200 MB; shadow map 1024 High only; one renderer context; dispose everything on exit; `adv`-style usage rows `ah:<level>:<tier>:<fps>` so real phones report. The simulation never waits on rendering; the watchdog drops High to Lite after 90 frames over 31 ms.

## 6. Phases and estimates (one developer-agent, owner reviews each)

| Phase | Deliverable | Est. |
|---|---|---|
| A. Foundation | button in the lobby, fullscreen/landscape shell, Game Power, pause/results, renderer + camera + input (touch and mouse), a test room with the kit, `__ah` hooks, High/Lite switch | 4 to 5 days |
| B. Weapons | pistol + rifle + shotgun with viewmodel, recoil, reload, ADS, hit markers, sounds, HUD ammo | 4 days |
| C. Aliens v1 | Skitter, Drone Mantis, Spitter with procedural meshes, animation, AI, hit reactions, death goo, kill feed | 5 days |
| D. Level 1 + waves | colony street, 5 waves, pickups, extraction, score, stars, rewards | 4 days |
| E. Boss + more weapons | Walker Harvester, grenades, SMG, marksman, launcher, upgrades screen | 5 days |
| F. Levels 2 to 4 | hangar, desert outpost, hive, Burrower/Moth/Queen, difficulty tiers | 7 days |
| G. Polish | post FX, decals, audio mix, accessibility (reduced motion, colour-blind markers, aim assist level), settings, tutorial in the first mission | 4 days |
| H. Co-op | rooms for 2 to 4, shared seed, ghosts, revive | 5 days |
About 5 to 6 weeks to H; a playable slice (A to D) in about 2.5 weeks.

## 7. Risks and honest limits
- Touch shooters are hard to make feel good: aim assist, a dead zone, and sensitivity options are in scope, but only a real phone tells; plan for owner feedback rounds after B.
- Procedural insects will look stylised, not film-quality; the plan gets "great for a web game", not ID4 CGI.
- Everything so far has been tested in headless software GL only: the frame-rate claims here are budgets, not measurements; Phase A includes a phone fps probe screen.
- Heavier battery and heat than other modes; Game Power already limits session length.
- Violence perception: bug-only enemies, no gore, no human targets, no real brands (keep it so).
- App size: the chunk is lazy; no downloaded models/audio, so repo size barely grows.

## 8. Test strategy
Pure engine tests with no browser (movement/collision, weapon damage tables, AI state machines, wave seeds, scoring) like `smoke-adv-room-core.mjs`; headless software-GL screenshot of every level/alien/weapon in High and Lite; a scripted bot that plays a wave from the same seed in both modes and compares kills/score/health (read-only renderer proof); touch-input test through CDP touch; fps/memory probes with CPU throttle; Game Power drain and the learn pop-up; Play Store build (`verify:android`) still green.

## 9. Questions for the owner before building
1. Solo and waves first (recommended), co-op later, no PvP deathmatch yet: OK?
2. Gore level: bug goo only (recommended) or none at all for under-13 accounts?
3. Is the optional "tune-up" music question between waves wanted, or keep the shooter pure and tie learning only through Game Power?
4. Which alien flavour first: Harvester walkers (ID4), small swarm bugs (MIB), or a mix (recommended: swarm + mantis first, Walker as the first boss)?
5. Does the player's own robot appear (first-person hands/weapon use its skin colours) and can pets help (a pet drone)?
6. Desktop mouse/keyboard support as well as phone touch (recommended for testing and for tablets)?
7. Should this plan replace plan 37's ordering of work, with plan 37 resumed afterwards (assumed yes, "paused")?
