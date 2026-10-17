# Plan 35 - Adventure Online, the next phase: ten strategies (plan only, nothing built)

Owner request (2026-10-17): ten strategic plans to make Adventure Mode ONLINE more fun. Standing rules this plan obeys: the owner's main UI is not changed (only
small additions, each shown as a mockup first); no play-time reminders ("the longer they play the better"); no selling of currency; coins only from playing;
nothing needing SQL or an edge-function deploy is done without the owner's approval; the game must load fast and keep a Lite mode for weak phones.
Mockups for the UI additions are in the chat that delivered this plan (lobby, HUD strip and ping, quick chat, team result card).

## Today (facts)
Rooms are Supabase Realtime broadcast + presence channels (`advo:<CODE>`), up to 4 pilots, host picks the map, ghosts, shared monster kills, team goal, revive,
team war, public room list (SQL applied), best-times board (SQL applied). Trust model: every client self-reports. Wave timing is each client's own clock.
Real Realtime and two real phones have never been tested; only fake-channel and two-page tests exist.

## The ten strategies (Hook Model stages in brackets: Trigger, Action, Variable reward, Investment)

1. **Join in one tap (Action).** Quick Play: join an open room with space or open and list one; an invite link / share code that opens straight into the lobby; a
   "recent teammates" list with one-tap invite. Target: from tapping Adventure Online to being in a room under 10 s. (Mockup 1.)
2. **Real roles and synergy (Variable reward).** The seven robot classes already exist; give each a small team role (tank, support, damage, control) with a visible
   synergy bonus when the roles are complementary (for example a shield next to a healer lasts longer). A revive combo and a "chain" bonus when two pilots hit the same
   monster within a second. No new buttons: the effects ride on existing skills.
3. **Co-op goals that bind people (Investment).** Shared daily co-op quest, a team streak (days in a row this team cleared something), a shared progress bar that
   fills with everyone's kills and ores. Rewards are crystals and EXP only. (Mockup 4 shows the result card carrying it.)
4. **Make the netcode feel solid (Action).** Reconnect into the same room, host migration when the host leaves, a shared clock so wave timing and monster ids agree
   on every screen (the known gap), snapshots of room state for late joiners, sync rate that drops on Lite. Measured with a loss/latency simulator in the test rig.
5. **Fairness that needs the owner's approval (Trust).** Today a cheater can put a false time or inflate their own kills. Move reward settlement and the boards to a
   server check (an edge function that validates a run summary: duration floor, kill counts, a signed room id). Needs SQL and a deploy, so it waits for an explicit "yes".
6. **Social bonds (Investment, Trigger).** Friends list, recent teammates, commendations ("great healer", "great leader"), friend invites that push-notify when the
   friend is online (only for players who allowed notifications). Quick chat with presets only, plus pings on the map: kid-safe and language-free. (Mockups 2 and 3.)
7. **Competition with seasons (Variable reward).** A ranked Team War ladder with seasons, a weekly co-op boss everyone attacks asynchronously (a shared HP bar on the
   map page), ghost races on best times. Season rewards are cosmetic (robot skins, titles) and crystals, never coins for money.
8. **Big co-op content (Variable reward).** A raid boss for four with phases that need roles; co-op-only maps; shared base building where each pilot adds a module
   to one colony or ranch (the shared colony grid already exists). The map order stays on the believable timeline.
9. **Moments worth sharing (Trigger).** Auto highlight cards (a boss kill, a clutch revive, a long combo) with a share image; a spectator view for a friend's run;
   an invite link inside the share. Cheap to render because they reuse the game canvas.
10. **A safe, healthy, cheap community (Trust).** Report and block, no free text, region-aware matchmaking, an age-aware default (kid mode keeps presets only),
    bandwidth caps and a Lite sync rate so weak phones and the Realtime bill both stay small. No timers that nag people to stop; the product stays out of the way.

## Mockups (shown in chat, not built)
1. Online lobby: Quick Play, invite link, recent teammates added to the three plain cards (the existing three-card layout stays).
2. In-run: a small teammate strip at the top right and a ping ring with a short name tag that every pilot sees.
3. Quick chat wheel: six preset icons, no typing.
4. Team result card: roles, MVP, revives, best combo, team goal, play again together, thank teammates, add friend.

## Order of work
A. Strategy 4 (solid netcode) + Strategy 1 (join in one tap): the foundation, about 4 days; test with the two-page rig and a loss simulator.
B. Strategy 6 (pings, quick chat, recent teammates) + Strategy 3 (co-op goals, result card): about 4 days.
C. Strategy 2 (roles and synergy): about 3 days.
D. Strategy 5 (server fairness): about 3 days of work plus the owner's approval; do before any ranked season.
E. Strategy 7 (seasons) then 8 (raid and co-op maps) then 9 (share cards): about a week each.
F. Strategy 10 runs through every step (safety, Lite, cost).

## Measures
Time to first room; share of rooms that finish a map; day-7 return of players who played a room versus solo; teammates per session; reconnect success rate; Realtime
messages per pilot per minute (the cost number). Each is read from `usage_events` rows to be added (no migration needed).

## Honest limits
Nothing here has been built or run against real Realtime or two real phones. The Hook Model describes how habits form; it promises nothing. Strategy 5 and the ranked
parts of 7 cannot ship without SQL or a deploy that the owner must approve first.
