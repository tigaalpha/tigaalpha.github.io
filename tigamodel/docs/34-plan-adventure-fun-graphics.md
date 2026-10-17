# Plan 34 - Adventure Mode: more fun, better graphics, more excitement (plan only, nothing built)

Owner request (2026-10-17): five main strategies; focus on graphics quality and on stimulating excitement (adrenaline, dopamine, endorphin);
the game must load fast; a HIGH quality mode and a LITE mode that is just good enough to play on weak phones.
Honest note on the words: nobody can promise a hormone. What we can design is pacing, feedback, reward timing and calm-after-peak, which are the
known levers of excitement and satisfaction. Every target below is a number we can measure, not a feeling we claim.

## Today (facts from the code)
- Two graphics levels exist, Standard and High (`tg_adv_gfx`, `HI()`), default from `isLowEnd()` / `spaceTier()`. Only the ship maps have a frame-time watchdog.
- Every mode is a lazy chunk and everything is drawn from code (no downloads). The ground run draws at 30 fps in Standard and 60 fps in High.
- Juice that exists: hit-stop and shake (High only), combo finisher, fever-like music intensity, loot, weapon drops, boss telegraphs.
- Missing: a clear LITE tier, a watchdog on ground runs, a combo/streak system the player can SEE, rarity on drops, slow-motion moments, adaptive difficulty.

## Strategy 1 - Fast to start, two clear graphics modes (the foundation; ship first)
- Name the tiers **High** and **Lite** in the gear pop-up (Standard stays as the automatic middle, hidden unless the device sits between). First choice comes from a 2-second measured probe on the menu, not from guessing the model.
- **Lite** (target: 30 fps on a 2018 budget phone): dpr 1, 24-30 fps, particles capped at about 20, no bloom or grade layer, one parallax layer less, sprites only (no per-frame gradients), screen shake off, shorter film (fewer shots, same story).
- **High** (60 fps on mid and strong phones): dpr up to 2, full particles, grade layer, bloom, hit-stop, dynamic light on blasts.
- One shared **watchdog** for every mode (the one the ship maps already use): if the average frame stays slow for about 60 frames, drop a tier for the rest of the run and remember it; never go up by itself during a run.
- **Loading budget:** menu interactive under 2 s on a mid phone; each map chunk under about 60 kB gzipped, preloaded while the player is on the menu; first frame of a map before the film's voice finishes; the film loads its extras after its first shot. Measure with the existing `perf:` and `start:` usage rows plus a new `load:<map>:<ms>` row.
- Done when: a low-end test profile (CPU slowed 6x in headless) holds 30 fps in Lite on every map, and High never drops below 50 fps on the desktop reference.

## Strategy 2 - Hit feel ("juice") that scales with the tier
- A hit has five parts, each with a Lite version: freeze frame (3-5 frames), a short camera punch-in, sparks in the planet's colour, a sound with a low thump, and a damage number that pops and floats. Lite keeps sound, number and sparks; High adds freeze, punch-in and chromatic edge.
- Kill moments: the last monster of a wave gets 0.25 s of slow motion and a crisp "finisher" sound; the boss's last hit gets 0.6 s slow motion, a zoom and a shockwave.
- A visible **combo meter** that fills, changes colour at x5, x10, x20 and pays a small visible bonus; the music intensity already follows combos, so the screen and the sound rise together.
- Safety rule stays: no full-screen flash more than about three a second, always a reduced-motion switch.
- Done when: a blind test of two clips (before and after) is rated "more satisfying" by most of five testers, and frame time stays inside the tier budget.

## Strategy 3 - A pacing curve built for adrenaline and then relief
- Every map becomes a curve, not a flat stream: calm start (explore, pick up), rising waves, one **ambush spike**, a short breather with a pickup, then the boss, then a clear calm celebration. Tension without release tires people; release after a peak is the "endorphin" part.
- Elite monsters (a marked, tougher variant) with a guaranteed good drop; boss in two or three phases with clear telegraphs and one dramatic phase change.
- A **clutch moment**: under 25 % health the screen edges pulse (soft, under the flash rule), the music strips to a heartbeat and bass, and a kill in this state gives a brief invulnerable "second wind" once per run.
- **Adaptive difficulty:** if a player dies twice in a row the next wave is a little easier (shown as nothing, never as an insult); if they clear without damage the next one is a little harder. Numbers come from the existing `die:` and `end:` usage rows.
- Done when: median time between "spikes" is under 40 s and the share of players who finish a map they started rises (measured from `start:` versus `end:` rows).

## Strategy 4 - Reward loops that keep paying (dopamine) and a satisfying end (endorphin)
- **Variable rewards with rarity:** drops get a rarity (common, rare, epic) shown by a light beam and a sound; the surprise is the point. Weapons already drop; add rarity to crystals and loot, never to anything bought with money.
- **Always one more goal in sight:** after each clear, the card shows the next map and a single small goal ("beat it under 2 minutes", "no damage"), with stars; the best-times board already exists.
- **Streak and daily:** a visible streak of maps in a day with a small bonus; the daily quests already exist and should show on the map page as one line.
- **The ending:** the clear card is a short, warm moment (music resolves to the home chord, a calm glow, a stat tally that counts up), because the good feeling after effort is what makes people come back.
- Hard rules stay: coins only from playing and learning, crystals never sold, no scarcity or fear tricks aimed at children.
- Done when: next-day return and "second map in the same session" rates (from usage rows) go up against the current baseline.

## Strategy 5 - Visual quality on the things the player stares at, within budget
- Put the effort where eyes are: the hero, the monsters, the boss, the ground. Each gets one baked lighting pass (rim light, soft shadow, glow) drawn once into a sprite, so High looks richer at almost no per-frame cost.
- A **per-planet look**: terrain shapes and sky per world (today only colours and the mid and near layers differ), baked once per map.
- **Particles from a small sprite atlas** instead of per-particle paths; one draw call batch. Lite uses the same atlas with fewer particles.
- Light that reacts: blasts and lightning briefly light the ground and monsters around them (a cached radial sprite, additive), High only.
- Films: a few shots redrawn with real shading (robot, ship, planets already textured); more shots reuse the same scenes from new angles, so the film stays light.
- Done when: side-by-side screenshots in High show clearly richer lighting on hero, monsters and ground, and Lite screenshots are still readable, with the draw cost in High under 6 ms per frame on the reference machine.

## Order of work and size
1. Strategy 1 (tiers, probe, watchdog, load budget): about 2 days. Do first, everything else is judged against it.
2. Strategy 2 (juice) and Strategy 3 (pacing): about 3 days each, can overlap.
3. Strategy 4 (rewards): about 2 days.
4. Strategy 5 (visual): rolling work, one item per release.
Each step ships on its own, with tests (frame-time test per tier, the existing smoke tests, a new load-time check).

## Risks
- Photosensitivity: keep the three-flashes-a-second rule, keep reduced motion.
- Over-tuning for the desktop: headless numbers are not a phone; real `perf:` rows decide.
- Balance numbers are guesses until real players produce `end:` and `die:` rows.
- Nothing here has been built or tested; every "done when" is a target.
