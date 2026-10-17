# Plan 34 (revision 2, with the Hook Model) - Adventure Mode: more fun, better graphics, more excitement (plan only, nothing built)

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

## Revision 2 - the plan rebuilt on the Hook Model (Nir Eyal, "Hooked", 2014)
The five strategies above stay, but they are now arranged as one loop, because a loop is what makes people come back. The model has four stages that repeat:
**Trigger -> Action -> Variable reward -> Investment**, and each turn of the loop makes the next trigger stronger.

### The loop for Adventure Mode
1. **Trigger (what brings the player in)**
   - External: the push reminder that already exists (day 1/3/7, off unless the player allowed it), the daily-quest line on the map page, the "your pet is waiting" and "next episode" cards, the Continue button as the one big obvious door.
   - Internal (the real goal, built slowly): the player learns to open Adventure when they feel bored, curious or want a quick win. This comes from the reward and investment stages below, not from nagging. No fake urgency, no countdown tricks.
2. **Action (as easy as possible, the Fogg model: motivation x ability x prompt)**
   - Time to first play under 10 s from the Adventure button (Strategy 1, Lite tier, preloaded chunks), one tap to Continue, controls hidden until needed (already done for new players), no film forced twice (Skip stays).
   - Target: a returning player is moving a robot within 3 taps and 10 s.
3. **Variable reward (the three kinds in the model)**
   - **Rewards of the hunt** (social and information): the daily/weekly best-times board, the Online room, "what is on the next planet".
   - **Rewards of the tribe** are not built here; the board and rooms are the closest, and they pay honour only.
   - **Rewards of the self** (mastery and completion): combo meter, stars, better time, clutch second wind, boss phase cleared.
   - **Rewards of the hunt for resources**: rarity drops (common, rare, epic) with a light beam and sound; a boss always drops a weapon; a variable crystal amount. The variability is the point; the odds are fixed, shown in the codex, and never bought. Coins stay playing-and-learning only.
4. **Investment (the player puts something in, which raises the chance they return)**
   - A **collection codex** (weapons found, monsters seen, planets cleared, pets' moods) that fills up and shows what is missing.
   - **Upgrades and skill tree** (already there: crystals, workshop, 130 skills) shown as a visible "next unlock in N crystals".
   - **A named robot and pet with a history** (stats, favourite weapon, longest combo) and a **streak** of days with a Streak Freeze item that already exists.
   - The **colony and the Ark** that the player has built over many episodes (they already persist); show them on the map page as a small living picture that grows, so leaving feels like leaving something unfinished.
   - Investment also loads the next trigger: finishing a map unlocks the next, lights a new codex page and schedules a small goal for tomorrow ("beat 2:10").

### How each strategy plugs into the loop
- Strategy 1 (fast start, tiers) = **Action**: ability goes up when the wait goes down.
- Strategy 2 (hit feel) = **Reward of the self** inside every single action; this is what makes the action itself feel good.
- Strategy 3 (pacing curve) = shapes **when** rewards land (peak, then relief) so each session ends on a high: "peak-end rule" (people judge an experience mostly by its peak and its end).
- Strategy 4 (rewards) = **Variable reward + Investment** (rarity, codex, goals, streak).
- Strategy 5 (visuals) = makes the reward moments worth looking at and supports the **Trigger** (a beautiful map page and a living colony picture).

### Other well-known engagement principles used on purpose
- **Peak-end rule:** design the strongest moment (boss finish, rare drop) and the last 10 seconds (calm celebration card).
- **Flow (Csikszentmihalyi):** the adaptive difficulty keeps challenge just above skill; short clear goals; instant feedback.
- **Goal-gradient effect:** progress bars that are shown already 20 percent filled; "2 of 3 beacons" style counters.
- **Zeigarnik effect:** an unfinished item (a codex page two items short) pulls people back; used lightly, never as a threat.
- **Endowed progress and sunk-cost of investment:** the robot, pet and colony the player built.
- **Self-determination theory (autonomy, competence, relatedness):** let the player choose maps, weapons and difficulty; make competence visible; give the room/board for relatedness.

### Ethical limits (written in because the audience includes children, and the owner already ruled out scarcity tricks)
- Eyal's own "manipulation matrix" test: we build only what we would use ourselves and what helps the player (a piano learner gets music questions inside the fun, which is the product's honest benefit).
- **No** fake scarcity, loss-aversion threats ("you will lose your streak!" is replaced by a gentle "your streak is safe with a freeze"), pay-to-win, loot boxes bought with money, or dark patterns. Odds are shown. No currency is sold.
- A **healthy-play layer:** after about 45 minutes in one session a calm, skippable "good time for a stretch" card; a daily cap on the big streak rewards so more hours do not pay more; kid mode stays simpler and quieter.
- Measure return and satisfaction, not minutes: if sessions get longer but "would recommend" or day-7 return does not rise, the change is a failure.
- Honest limit: the Hook Model is a way of designing habits, not a promise of addiction; real effect must be shown by our own usage rows (next-day and day-7 return, maps per session).

### New measurable targets (added)
- Time from tapping Adventure to moving the robot: under 10 s on a mid phone (from a new `load:` row).
- Day-1 and day-7 return of players who finished one map: up against today's baseline from `usage_events`.
- Share of sessions that end with a clear (the peak-end moment) versus a quit.
- Codex pages opened and the share of players with a streak of 3 days or more.
- A "healthy play" check: median session length stays under 30 minutes while return goes up.

### Changed order of work
1. Strategy 1 (Action) - 2 days.
2. Investment layer first small version: codex page + visible next-unlock counter + map-page pet and colony picture - 3 days (it is the cheapest part of the loop and the weakest today).
3. Strategy 2 + 3 (reward of the self, pacing) - 3 days each.
4. Strategy 4 (variable rewards with rarity, daily goal, streak, healthy-play card) - 3 days.
5. Strategy 5 (visuals) rolling.

## Order of work and size (first version; see the changed order above)
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
