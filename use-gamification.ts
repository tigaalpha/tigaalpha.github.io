import { useState, useRef, useEffect } from "react";
import {
  LEVELS, ALL_LEVELS, EXP, BADGES, levelInfo, prestigeInfo, unlockedBadgeIds, QUEST_GOAL, QUEST_BONUS,
  weekKey, activeChallenges, readWeekly, writeWeekly, CHALLENGE_REWARD,
  getCoins, setCoinsLS, chestAvailable, claimChest, chestSpinAngle, addFreeze, logExpGain,
} from "./App";
import { isMaxPlan, getPlan } from "./payment";
import { getAC, playUi, playMiss } from "./music-engine";
import { sb } from "./supabase-client";
import { ymd, saveGuestProfile, logUsage } from "./shared-infra";
/* ── use-gamification.ts ──
   Owns PianoApp's core progression loop: coins, gems, the daily chest,
   the mascot companion, EXP/level-up/prestige/badge celebrations, weekly
   challenges, and the mystery-chest/lucky-bonus surprise rewards. Extracted
   from PianoApp verbatim as part of the Phase 3 Category B (closure/hook)
   extraction — no logic changes.

   Imports 20 top-level App.tsx helpers (LEVELS/EXP/BADGES/levelInfo/
   prestigeInfo/unlockedBadgeIds/QUEST_GOAL/QUEST_BONUS/weekKey/
   activeChallenges/readWeekly/writeWeekly/CHALLENGE_REWARD/getCoins/
   setCoinsLS/chestAvailable/claimChest/chestSpinAngle/addFreeze/
   logExpGain) that stay physically in App.tsx (module scope, outside
   PianoApp) because other top-level App.tsx components — ProfilePage,
   computeCoachStats, some admin views — read them too and can't receive
   them via prop-threading from PianoApp alone. This is a deliberate,
   one-time exception to this refactor's usual "never mix relocation with
   hook extraction in one step" rule: rather than physically move 20
   declarations (a Category A change) just to unblock this hook, they're
   exported in place, which creates a circular import (App.tsx <->
   use-gamification.ts). Verified safe: every shared binding is a plain
   const/function read only from inside function bodies that run long
   after both modules finish evaluating — never at module top level — so
   ES module circular-reference resolution handles it correctly.

   plan/activeEvent (owned by usePayment()/PianoApp, declared AFTER this
   hook is called — see below) are threaded in via planRef/activeEventRef
   instead of plain params: PianoApp calls useGamification() BEFORE
   usePayment() so that this hook's `mascot` is ready in time to pass INTO
   usePayment({..., mascot, ...}) (mascot used to be a hoisted `function`
   declaration so call order didn't matter; now it's a hook-returned const,
   so it does). That leaves earnCoins/gainExp needing plan/activeEvent
   before they exist — solved the same way this file already solves
   stale-closure risk for expRef/lessonsRef/streakRef/questDateRef/
   questCountRef: a ref PianoApp keeps fresh via a tiny sync effect, read
   only later from event-handler-time code, never during render. ── */
export function useGamification({ session, profile, setProfile }) {
  // derived locally, mirroring PianoApp's own uid/isGuest (which stay in
  // PianoApp untouched — used far beyond gamification) — cheap 1-line re-derivation
  // beats threading two more params for something this trivial.
  const uid = session && session.user && session.user.id;
  const isGuest = !session;
  // plan (usePayment) and activeEvent (PianoApp) don't exist yet at this hook's
  // call site — see the file header. PianoApp mirrors both into these refs via
  // small sync effects once they're available; only read here from event-handler
  // code (earnCoins/gainExp), never during render, so this is safe.
  const planRef = useRef(getPlan());
  const activeEventRef = useRef(null);

  const [coins, setCoins] = useState(getCoins());
  const [gems, setGems] = useState(0); // server-authoritative only — no localStorage, unlike coins
  const [chestAvail, setChestAvail] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const [chestOpening, setChestOpening] = useState(false);
  const [chestReward, setChestReward] = useState(null);
  const [chestSpinDeg, setChestSpinDeg] = useState(0);
  const [mascotMood, setMascotMood] = useState("idle");
  const mascotT = useRef(null);

  // ── gamification: floating EXP toast + level-up celebration ──
  const [expToast, setExpToast] = useState(null); // {amount, id} or null
  const [levelUp, setLevelUp] = useState(null);   // {level, tier} or null
  const [badgeUp, setBadgeUp] = useState(null);   // BADGES entry or null

  // Gamification: mystery chest + lucky bonus
  const [mysteryChest, setMysteryChest] = useState<any>(null); // {xp, coins, label} | null
  const [luckyToast, setLuckyToast] = useState<any>(null); // {xp, label} | null
  const luckyToastTimer = useRef<any>(null);

  const expRef = useRef((profile && profile.exp) || 0);
  const lessonsRef = useRef((profile && profile.lessons_done) || 0);
  const streakRef = useRef((profile && profile.streak) || 0);
  const questDateRef = useRef((profile && profile.quest_date) || null);
  const questCountRef = useRef((profile && profile.quest_count) || 0);
  const expToastTimer = useRef(null);
  const lvUpTimer = useRef(null);
  const badgeTimer = useRef(null);

  useEffect(() => { expRef.current = (profile && profile.exp) || 0; }, [profile]);
  useEffect(() => { lessonsRef.current = (profile && profile.lessons_done) || 0; }, [profile]);
  useEffect(() => { streakRef.current = (profile && profile.streak) || 0; }, [profile]);
  useEffect(() => {
    questDateRef.current = (profile && profile.quest_date) || null;
    questCountRef.current = (profile && profile.quest_count) || 0;
  }, [profile]);

  // sync coins from Supabase on login — take max so offline-earned coins are never lost
  useEffect(() => {
    if (!profile || profile.coins == null) return;
    const local = getCoins();
    const merged = Math.max(profile.coins, local);
    if (merged !== local) setCoinsLS(merged);
    setCoins(merged);
    if (merged !== profile.coins && uid) sb.from("profiles").update({ coins: merged }).eq("id", uid).then(() => {}, () => {});
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // gems have no client write path at all (see supabase-gamification-gems-migration.sql)
  // so this just mirrors whatever the server RPCs have already granted/spent
  useEffect(() => { setGems((profile && profile.gems) || 0); }, [profile && profile.gems]);

  // celebrate the first newly-unlocked achievement between two stat snapshots
  function celebrateNewBadges(before, after) {
    const had = unlockedBadgeIds(before);
    const got = unlockedBadgeIds(after).find(id => !had.includes(id));
    if (got) {
      setBadgeUp(BADGES.find(b => b.id === got));
      playUi("badge");
      clearTimeout(badgeTimer.current);
      badgeTimer.current = setTimeout(() => setBadgeUp(null), 3600);
    }
  }

  // show a floating "+N EXP" toast that auto-dismisses
  function showExpToast(amount) {
    setExpToast({ amount, id: Date.now() });
    clearTimeout(expToastTimer.current);
    expToastTimer.current = setTimeout(() => setExpToast(null), 2200);
  }

  // award EXP for an action, persist to Supabase, and celebrate level-ups.
  // opts.lesson=true also increments the lessons-completed counter.
  function gainExp(amount, opts = {}) {
    // Guests (no real uid) still get the full local experience — optimistic
    // update, toast, level-up, badges — just none of the server-side RPCs
    // below, which are SECURITY DEFINER / auth.uid()-gated and structurally
    // can't succeed without a real session regardless of what id is passed.
    if (!amount || (!uid && !isGuest)) return;
    if (activeEventRef.current && activeEventRef.current.expMult > 1) amount = Math.round(amount * activeEventRef.current.expMult);
    mascot("happy", 1400);
    bumpWeekly("exp", amount);
    /* Learning EXP and Skill EXP are two separate currencies, and this
       function only ever mints the first of them. What you learn raises your
       account level, your league standing and your daily quest; what you FIGHT
       raises your chassis' class rank and unlocks its skills, and the PvP
       arena pays that itself. gainExp used to quietly do both, which made the
       whole class system a passive by-product of practising rather than
       something you go and earn. */
    if (uid) {
      sb.rpc("league_bump_exp", { p_week_key: weekKey(), p_amount: amount }).then(() => {}, () => {});
      sb.rpc("school_quest_bump", { p_amount: amount }).then(() => {}, () => {}); // no-ops silently if not in a school / no active quest
    }
    const beforeExp = expRef.current;
    const beforeLessons = lessonsRef.current;

    // daily-quest progress (counts learning activities; resets each calendar day)
    let questFields = null, bonus = 0;
    if (opts.quest) {
      const today = ymd(new Date());
      const cnt = (questDateRef.current === today ? questCountRef.current : 0) + 1;
      questDateRef.current = today;
      questCountRef.current = cnt;
      questFields = { quest_date: today, quest_count: cnt };
      if (cnt === QUEST_GOAL) bonus = QUEST_BONUS; // quest just completed → bonus
    }

    const after = beforeExp + amount + bonus;
    const newLessons = beforeLessons + (opts.lesson ? 1 : 0);
    expRef.current = after;
    lessonsRef.current = newLessons;
    logExpGain(amount + bonus);   // daily EXP for the progress dashboard
    logUsage("score", (opts.reason || "exp") + ":" + (amount + bonus)); // admin analytics: score flow

    if (setProfile) setProfile(p => {
      const next = { ...(p || {}), exp: after, lessons_done: newLessons, ...(questFields || {}) };
      if (isGuest) saveGuestProfile(next);
      return next;
    });
    showExpToast(amount + bonus);

    // level-up celebration
    let leveled = false;
    if (levelInfo(after).level > levelInfo(beforeExp).level) {
      leveled = true;
      setLevelUp({ level: levelInfo(after).level, tier: levelInfo(after).tier });
      playUi("levelup"); mascot("celebrate", 3200);
      clearTimeout(lvUpTimer.current);
      lvUpTimer.current = setTimeout(() => setLevelUp(null), 3400);
    } else if (prestigeInfo(after).tier > prestigeInfo(beforeExp).tier) {
      // past the level-99 cap (Legend X): celebrate each new Legend Star the
      // same way a level-up is celebrated, so the loyalest players still get feedback
      leveled = true;
      const pTier = prestigeInfo(after).tier;
      setLevelUp({ level: 99, tier: ALL_LEVELS[ALL_LEVELS.length - 1], prestige: pTier });
      playUi("levelup"); mascot("celebrate", 3200);
      clearTimeout(lvUpTimer.current);
      lvUpTimer.current = setTimeout(() => setLevelUp(null), 3400);
      earnCoins(150);
      // gems are granted server-side (re-derived from real exp, idempotent) —
      // this app.tsx client never decides or sends a gem amount itself. Guests
      // structurally can't reach this (auth.uid()-gated RPC, no real session).
      if (uid) {
        sb.rpc("grant_gems_for_prestige").then(({ data: r }) => {
          if (r && r.granted > 0 && setProfile) setProfile(p => ({ ...(p || {}), gems: ((p && p.gems) || 0) + r.granted }));
        }, () => {});
      }
    }
    // achievement unlock (skip the toast if a level-up already shows this tick)
    if (!leveled) {
      celebrateNewBadges(
        { exp: beforeExp, lessons_done: beforeLessons, streak: streakRef.current },
        { exp: after, lessons_done: newLessons, streak: streakRef.current }
      );
    }

    // persist (fire-and-forget; UI already updated optimistically) — guests
    // already persisted above, via saveGuestProfile() inside setProfile()
    if (uid) {
      const upd = { exp: after, lessons_done: newLessons, updated_at: new Date().toISOString() };
      if (questFields) Object.assign(upd, questFields);
      sb.from("profiles").update(upd).eq("id", uid).then(() => {}, () => {});
    }
  }

  // daily streak + welcome-back bonus — runs once per calendar day on app open
  useEffect(() => {
    if (!uid) return;
    const today = ymd(new Date());
    if (profile && profile.last_active === today) return; // already counted today
    const beforeExp = expRef.current;
    const beforeStreak = streakRef.current;
    const yesterday = ymd(new Date(Date.now() - 86400000));
    const newStreak = profile && profile.last_active === yesterday ? (beforeStreak || 0) + 1 : 1;
    const after = beforeExp + EXP.daily;
    expRef.current = after;
    streakRef.current = newStreak;
    if (setProfile) setProfile(p => ({ ...(p || {}), exp: after, streak: newStreak, last_active: today }));
    sb.from("profiles")
      .update({ exp: after, streak: newStreak, last_active: today, updated_at: new Date().toISOString() })
      .eq("id", uid)
      .then(() => {}, () => {});
    const t = setTimeout(() => {
      showExpToast(EXP.daily); // brief welcome-back reward
      celebrateNewBadges(
        { exp: beforeExp, lessons_done: lessonsRef.current, streak: beforeStreak },
        { exp: after, lessons_done: lessonsRef.current, streak: newStreak }
      );
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // coins + mascot + daily chest
  function earnCoins(n) {
    const mult = (isMaxPlan(planRef.current) ? 2 : 1) * (activeEventRef.current && activeEventRef.current.coinMult > 1 ? activeEventRef.current.coinMult : 1);
    const v = getCoins() + n * mult;
    setCoinsLS(v); setCoins(v);
    if (n > 0) logUsage("score", "coins:+" + (n * mult)); // admin analytics
    if (uid) sb.from("profiles").update({ coins: v }).eq("id", uid).then(() => {}, () => {});
    // guests have no uid to write to — mirror into the synthetic guest profile
    // too (not just the separate tg_coins cache) so profile.coins stays
    // accurate for reads elsewhere and the eventual login-time merge sees it.
    else if (isGuest && setProfile) setProfile(p => { const next = { ...(p || {}), coins: v }; saveGuestProfile(next); return next; });
  }

  // gems -> coins conversion. The RPC itself already updates profiles.coins
  // server-side (see supabase-gamification-gems-migration.sql) — this only
  // mirrors that result into local state, it never writes coins again itself.
  async function exchangeGems(n) {
    const { data: r, error } = await sb.rpc("spend_gems_for_coins", { p_gems: n });
    if (error || !r) { mascot("sad", 1200); return false; }
    setProfile(p => ({ ...(p || {}), gems: Math.max(0, ((p && p.gems) || 0) - r.spent) }));
    const v = getCoins() + r.coins; setCoinsLS(v); setCoins(v);
    playUi("reward"); mascot("celebrate", 1600);
    return true;
  }

  /* Ask the server for a practice gem. Gems are protected by a database
     trigger precisely so a client cannot mint them, so this asks and the
     server decides — how many a day, and whether any are left. A failure
     (including the RPC not being deployed yet) is silent and grants nothing;
     coins from the same drill are unaffected either way. */
  async function grantPracticeGem() {
    if (!uid) return false;
    const { data: r, error } = await sb.rpc("grant_practice_gem");
    if (error || !r || !r.granted) return false;
    setProfile(p => ({ ...(p || {}), gems: r.gems }));
    playUi("levelup"); mascot("celebrate", 1800);
    setLuckyToast && setLuckyToast({ kind: "gem", n: r.granted, left: r.remaining });
    setTimeout(() => setLuckyToast && setLuckyToast(null), 3200);
    return true;
  }

  function buyFreeze() {
    const cost = 120;
    if (getCoins() < cost) { mascot("sad", 1200); playMiss(); return; }
    const v = getCoins() - cost; setCoinsLS(v); setCoins(v); if (uid) sb.from("profiles").update({ coins: v }).eq("id", uid).then(() => {}, () => {});
    addFreeze(1); playUi("reward"); mascot("celebrate", 1600);
  }

  function bumpWeekly(type, n = 1) {
    const w = readWeekly();
    w[type] = (w[type] || 0) + n;
    if (!Array.isArray(w.claimed)) w.claimed = [];
    for (const ch of activeChallenges()) {
      if ((w[ch.type] || 0) >= ch.goal && !w.claimed.includes(ch.id)) { w.claimed.push(ch.id); earnCoins(CHALLENGE_REWARD); playUi("reward"); }
    }
    writeWeekly(w);
  }

  function mascot(mood, ms = 2200) { setMascotMood(mood); clearTimeout(mascotT.current); mascotT.current = setTimeout(() => setMascotMood("idle"), ms); }

  useEffect(() => { setChestAvail(chestAvailable()); }, []);

  function openChestNow() {
    if (chestOpening) return;
    getAC();
    // resolve the real reward FIRST — the wheel only ever plays back a result
    // that's already locked in, it never decides the outcome itself
    const r = claimChest();
    setChestOpen(true); setChestOpening(true); setChestReward(r); setChestSpinDeg(0);
    playUi("reward");
    setTimeout(() => setChestSpinDeg(chestSpinAngle(r.kind)), 30); // next tick so the CSS transition animates from 0°
    setTimeout(() => {
      earnCoins(r.coins); gainExp(r.exp);
      setChestAvail(false); setChestOpening(false);
      playUi("levelup"); mascot("celebrate", 3200);
    }, 2500);
  }

  // on unmount: cancel these 3 timers so we never setState after PianoApp is
  // gone. Split out of PianoApp's larger shared unmount-cleanup effect (which
  // still clears its own, not-yet-extracted timers) so this hook fully owns
  // the refs it declares.
  useEffect(() => {
    return () => {
      if (expToastTimer.current) clearTimeout(expToastTimer.current);
      if (lvUpTimer.current) clearTimeout(lvUpTimer.current);
      if (badgeTimer.current) clearTimeout(badgeTimer.current);
    };
  }, []);

  return { coins, setCoins, gems, setGems, chestAvail, setChestAvail, chestOpen, setChestOpen, chestOpening, setChestOpening, chestReward, setChestReward, chestSpinDeg, setChestSpinDeg, mascotMood, setMascotMood, mascotT, expToast, setExpToast, levelUp, setLevelUp, badgeUp, setBadgeUp, mysteryChest, setMysteryChest, luckyToast, setLuckyToast, luckyToastTimer, expRef, lessonsRef, streakRef, questDateRef, questCountRef, expToastTimer, lvUpTimer, badgeTimer, planRef, activeEventRef, celebrateNewBadges, showExpToast, gainExp, earnCoins, exchangeGems, grantPracticeGem, buyFreeze, bumpWeekly, mascot, openChestNow };
}
