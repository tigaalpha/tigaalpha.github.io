# 36 · Adventure Online: server fairness, levels B and C

**A (shipped 2026-10-17):** the server refuses reports that cannot be true (rate, per-player weekly cap). Applied.

**B (written, NOT applied):** `supabase-adv-raid-b-migration.sql`. Each pilot's clear report (room, map, kills, seconds) is stored; a report is
capped by what the other pilots of the same room and map reported (1.25 x the highest + 3); a lone report is capped by the clock
(2 kills a second, at most 40-60). Room kills are shared, so honest pilots of one room agree. It lowers cheating on the raid counter, it
does not stop a group of friends agreeing on a false number. The client (`raidAdd` in `adv-online.ts`) already calls `adv_raid_add2`;
until the SQL is applied that call fails soft and the raid line falls back to showing the weekly total.

**C (NOT built, and why):** an authoritative server means the SERVER runs the fight (monsters, hits, damage, drops) and phones only send
inputs. Supabase Edge Functions are stateless and short-lived, so they cannot hold a running room at 10-20 ticks a second. It needs a
long-running process (a small Node/WebSocket game server on Fly.io, Railway or a VPS) that: owns room state, runs the monster AI and
damage rules that today live inside `adventure.tsx` `Run` (about 2,000 lines, written for a browser frame loop), validates every input
(speed, cooldowns, range), and talks to Supabase to pay rewards. Costs: a server that is always on (monthly bill), a second copy of the
game rules to keep in step with the client, and prediction/reconciliation on the phone so it does not feel laggy. Estimated as weeks of
work, not a session, and it should start from ONE map type (the ground run), not all 60. Only worth it if rooms ever pay something
valuable; today every Adventure reward is local EXP / crystals and a daily-capped coin sale, so the honest answer is that C is not needed yet.
