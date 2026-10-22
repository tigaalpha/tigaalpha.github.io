# 39 - Plan: Robot Adventure 3D (first-person, three.js)

Status: PLAN ONLY. Nothing is built until the owner approves it (owner, 2026-10-22).

## 1. What it is
A new lobby button (the slot Adventure Online used, which is now hidden) opens **Robot Adventure 3D**: the Adventure
story and missions rebuilt as a first-person 3D game (Counter-Strike / Call of Duty view) on three.js. The player is the
pioneer robot travelling star to star. Story, map order, briefs and goals come from `adventure.tsx` (`CAMPAIGN`, `SECT_OF`,
`BRIEF`, the cine tables `INTRO/STORY/GOAL/LORE`) and `tigamodel/docs/29-adventure-story-canon.md`: no new story.
Standing rules that apply: realism and a believable timeline (campaign order), no coins sold, music questions teach
(Game Power drains while playing), the owner's main Adventure UI is not touched (this is a separate mode).
Note: AGENTS.md records that the OLD Adventure 3D / first-person layer was removed from 2D Adventure at the owner's
request; this is a NEW, separate mode asked for now, so it does not contradict that line, and 2D Adventure stays as is.

## 2. Reuse (this is what keeps it affordable)
Alien Hunt already solved the hard parts; copy the architecture, not the content:
- `ah-engine.ts` pattern: pure simulation (capsule-vs-box collision, hitscan, projectiles, enemy steering, waves, bosses),
  testable with no browser. New `ra-engine.ts`, same style.
- `ah-render.ts` pattern: three.js scene, procedural meshes, High / Lite switch, frame watchdog, pixel-ratio cap.
- `alien-hunt.tsx` pattern: touch stick + drag-aim + FIRE, gear pause card, auto-walk / auto-shoot toggles, minimap,
  Game Power drain (`usePlayDrain`), HANDS OFF tune-up gate, result card, full screen + landscape (`enterFs`).
- `quiz-quest.ts`: the music question every 20 s of active fighting, from learned topics only (same rule as Alien Hunt).
- `ah-audio.ts` pattern: procedural sound, shared `__tgCineCtx`, created in the Start tap, mic-safe is not needed here.
- Adventure data: planets, colours, monsters list (`MON`), bosses, hazards, mission types, the films (cine plans).
Own lazy chunk (`robot-adventure-3d`), preloaded in idle time like the Adventure chunks to avoid the stale-chunk reload.

## 3. Game shape
- **Hub = the same story map** (Part 1-4, locked one step at a time, `tg_adv_done` shared so progress is one story, not two).
- **A mission = one 3D level** (a few hundred metres wide, one or two zones, not an open world). Level kinds map to the
  existing mission engines, redone in 3D FPS terms:
  - fight (Luma, Ferro, Kryo, Pyra, Nexa, Titan): arena + corridors, waves, end-of-map guardian boss.
  - mine / dyson / build: walk to ore rocks and dig (button), carry cargo to the pad, bolt panels on frames; flare hazard.
  - capture (Helios, Mercury): hold three stations while waves arrive.
  - survival (Mars dome, Jovia): hold out 90 s.
  - strike (Ashfall): aim the orbital warhead from a console, then assault.
  - ship maps (Departure, belt, skim, warp, evade...): NOT first-person on foot; phase 3 gives them a cockpit view or
    keeps them as the existing 2D ship maps launched from the same hub (decision for the owner, section 7).
  - colony / ranch / farm / yard: management games, stay 2D, linked from the hub only.
- **Controls** exactly as Alien Hunt (owner already approved them): stick, drag-aim, FIRE, jump, slide, gun chips, gear
  menu with auto-walk / auto-shoot, hidden aim assist (never announced), minimap.
- **Weapons**: the Adventure arsenal as FPS guns (pulse, scatter, lance, arc, rockets, RPG, grenades, flame, railgun),
  found as crates, levelled by picking up duplicates; the robot's shop weapon works (same `shopWeaponOf`).
- **Robot careers**: the 7 classes keep their identity (skill 1-3 equipped on buttons, crystals upgrade); pet follows and
  casts. Workshop upgrades use the same crystals and stores.
- **Monsters**: the Adventure roster as 3D creatures (procedural, like Alien Hunt's bugs): Glowbug, Thornback,
  Sporecaster, Hound, Mantis, Warbrute, Burrower, Swarmer, Wraith, Watcher, Spitter + per-planet bosses.
- **Story delivery**: each level opens with the existing film (reused `adventure-cine.tsx`, skippable), plus an in-level
  radio line (th/en/zh caption + device narration) at the briefing, midpoint and boss. No new writing.
- **Music questions**: beacons (the Kindred elders on Kindred Haven, knowledge beacons elsewhere) become 3D props you walk
  up to; plus the 20 s tune-up as in Alien Hunt. Right answers charge the Chord spell (big blast).
- **Rewards**: EXP, SP, crystals, loot sold at map clear under the existing daily coin cap and `onReward` path
  (`adventure:true`). Never sells currency. Best times may reuse `submitAdvTime`.

## 4. Graphics (the "prettier" goal, within phone limits)
- High: shadows, reflection env map, fog, bloom-style grade, particles, day/night where the planet has it; Lite: no
  shadows, low pixel ratio, fewer particles; frame watchdog drops High to Lite (as in Alien Hunt).
- Each planet gets its own sky, ground texture (procedural canvas textures like the planet orbs), props (mushrooms, mesas,
  ice spires, lava, wreck towers: the existing `MID_STYLE` / `NEAR_STYLE` ideas in 3D) and lighting colour.
- Budgets to hold: under about 150 draw calls, instanced props, textures generated once, no per-frame allocations.

## 5. Phases (each ends shippable and tested)
- **P0 (about 1 session)**: lobby button (replaces the hidden Online slot, `.pvpadv` style), empty chunk with the ready
  screen, map hub reading `CAMPAIGN`, enter-level plumbing, Game Power, full screen. Smoke test: button, hub, locks.
- **P1**: engine + renderer for ONE fight level (Luma): FPS movement, 3 guns, 3 monsters, the boss, beacon question,
  clear card, rewards, film + radio lines. This is the vertical slice to judge feel and frame rate.
- **P2**: all ground fight maps by data (planet table: sky, ground, props, roster, boss, hazard), weapons drops, skills,
  pet, workshop link.
- **P3**: mission levels: dig/dyson/build, capture, survival, strike; then the owner's decision on ship maps.
- **P4**: polish and measure: perf probes (`adv` usage rows for fps / load), Lite tuning, audio mix, sound per planet.
- **P5 (optional, owner decides)**: co-op through the existing Adventure Online channel (needs server fairness thinking).

## 6. Tests (same discipline as Alien Hunt)
`scripts/smoke-ra-engine.mjs` (pure engine: movement, collision, hits, waves, boss, mission rules, a bot clears each level),
`scripts/smoke-ra-ui.mjs` (button, hub locks as a fresh player, real WebGL canvas, FIRE, question gate freezes the sim, pause,
result, no page errors, both default and test-door paths), plus `shot-ra.mjs` for screenshots. Honest limits will be
written in AGENTS.md: headless only, never on a phone, balance guesses.

## 7. Risks and decisions for the owner
1. **Scope**: 30+ maps in 3D is months of work if each is hand-built; the plan builds one engine and makes maps data
   (sky/ground/props/roster), so a map costs hours, not days. Mission levels (P3) are the real cost.
2. **Ship maps**: do them as a first-person cockpit, keep them as 2D ship maps launched from the hub, or skip? Recommended: keep 2D for now.
3. **Management maps** (colony, ranch, farm, yard, build): recommended to leave as they are and link them from the hub.
4. **Phone performance**: three.js FPS on weak phones is the biggest unknown; Lite mode and the watchdog are mandatory, and
   P1 is where we find out. Alien Hunt's real-phone result is the best predictor; has anyone played it on a phone yet?
5. **Shared progress**: one `tg_adv_done` for both modes (recommended) or separate? Shared avoids double grinding.
6. **Name and art**: "Robot Adventure 3D" on the button (th/en/zh), with the robot icon.
7. **Co-op**: out of scope until P5.
