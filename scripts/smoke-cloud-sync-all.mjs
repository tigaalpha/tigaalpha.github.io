// No-network test of the REAL cloud-sync.ts (bundled with esbuild) with two (or three) simulated devices and an in-memory model of
// sync_cloud_state. For every key family: device A writes and syncs, an empty device B signs in and must end with the same state;
// both edit and converge without loss; applying the same pull twice changes nothing; a second account on the same device sees
// nothing of the first; the never-sync keys never reach the RPC.   Run: node scripts/smoke-cloud-sync-all.mjs
import { makeClock, makeServer, makeDevice } from "./cloud-sync-harness.mjs";

let fails = 0, passes = 0, CLOCK = null;
const now = () => CLOCK.now;
function ok(name, cond, extra) { if (cond) passes++; else { fails++; console.log("FAIL", name, extra === undefined ? "" : JSON.stringify(extra)); } }
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const eq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const BOOK = (k) => k.startsWith("tg_sync_");
const snapNoBook = (d) => Object.fromEntries(Object.entries(d.snapshot()).filter(([k]) => !BOOK(k)));

async function rig(n = 2) {
  const clock = makeClock(), server = makeServer(clock, { maxBytes: 450000 }); CLOCK = clock;
  const devs = []; for (let i = 0; i < n; i++) devs.push(await makeDevice("ABC"[i], server, clock));
  return { clock, server, devs };
}
async function signIn(dev, uid = "u1") { dev.signIn(uid); for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); await dev.sync(); }

const TODAY = "2026-11-05", YEST = "2026-11-04", TOM = "2026-11-06", FAR = "2026-12-25";

/* ───────── 1. a new device follows the account, for every family; the same pull twice changes nothing ───────── */
const FOLLOW = {
  // sets
  tg_path_done: ["a", "b"], tg_owned: ["skin1", "frame2"], tg_boss_done: ["b1"], tg_cert_claimed: ["c1"], tg_case_read: ["k1"], tg_video_paid: ["v1"],
  tg_adv_done: ["luma", "ferro"], tg_adv_found: ["flame"], tg_adv_built: ["ship"], tg_petroom: ["cat"], tg_ranch_helpers: ["tractor"],
  tg_pvp_colorways_owned: ["red"], tg_pvp_trials: ["t1"], tg_pvp_weekly_badges: ["w1"], tg_plan_in_2026_11_05: undefined,
  tg_key_done: { s1: [1, 2] }, tg_exam: { e1: [0, 1] }, tg_conv_seen: { w: 1 }, tg_edu_seen: { e: 1 }, tg_chat_badges: { b: 1 },
  tg_readcourse: { 1: 3 }, tg_eargym: { rhythm: 8 }, tg_note_miss: { C: 3 }, tg_item_lv: { sword: 2 }, tg_skl_lv: { a: 1 }, tg_skillsp: { a: 4 },
  tg_chat_know: { x: 2 }, tg_sight_best_sprint: { a: 9 }, tg_sight_best_streak: { a: 5 }, tg_teacher_outcome_ts: { a: 1730000000000 }, tg_adv_ship_car: { cell: 3 },
  tg_adv_up: { atk: 2 }, tg_adv_wlv: { flame: 3 }, tg_ark: { ring: 2 },
  tg_note_miss_d: { [TODAY]: { C: 2 } }, tg_pvp_weak: { t: { right: 1, wrong: 3 } },
  tg_read_besttime: { l1: 31 }, tg_adv_best: { luma: 88 },
  tg_sight_total: "12", tg_eargym_ladder: "7", tg_proof_last: "1730000000000", tg_earth_ore: "40", tg_earth_dyson: "8", tg_arena_best: "5",
  tg_plan_tempo: { song1: 0.8 },
  tg_path_acc: { s1: { best: 90, last: 80, lastAt: 1730000000000, interval: 2, nextDue: 1730200000000 } },
  tg_memory: { struggles: [{ label: "C scale", last: 1730000000000, n: 3 }], mastered: ["G"], recent: [{ label: "G", t: TODAY }], sessions: 4, lastSession: 1730000000000 },
  tg_practice_log: { [TODAY]: { n: 3, accSum: 240, exp: 12 }, _recent: [{ d: TODAY, n: 3 }] },
  tg_practice_best: { drill1: { accuracy: 90, bestStreak: 7, at: 1730000000000 } },
  tg_kstats: { correct: 5, answered: 8, bestStreak: 3, streak: 2, lastDay: TODAY, seen: { q1: TODAY } },
  tg_act_log: [{ t: 1730000000000, k: "ear", ok: 1 }, { t: 1730000001000, k: "song" }], tg_song_mood: [{ t: 1730000000000, d: TODAY, songId: "s", v: 1 }],
  tg_game_log: [{ t: 1730000000000, s: "x" }], tg_atip_outcomes: [{ t: 1730000000000, id: "a" }], tg_autoteach_log: [{ t: 1730000000000, id: "z" }],
  tg_camhistory: [{ t: 1730000000000, s: 80 }], tg_learning_traj: [{ t: 1730000000000, v: 1 }], tg_plan_fx: [{ t: 1730000000000, method: "slow" }],
  tg_reportcards: [{ t: 1730000000000, id: "r" }], tg_self_reports: [{ t: 1730000000000, v: 2 }], tg_kdrops: [{ pc: "C", t: 1730000000000 }], tg_chat_days: [TODAY, YEST],
  // day records and day markers
  tg_adv_q: { d: TODAY, done: { crystals: true } }, tg_chat_quest: { d: TODAY, n: 2 }, tg_chat_stats: { d: TODAY, asked: 2, exp: 4 },
  tg_daily_song: { d: TODAY, id: "twinkle" }, tg_adv_coin_day: { d: TODAY, n: 120 }, tg_ah_coin_day: { d: TODAY, n: 50 }, tg_earn_day: { d: TODAY, n: 10 },
  tg_game_day: { d: TODAY, n: 3 }, tg_sell_day: { d: TODAY, n: 1 }, tg_tts_day: { d: TODAY, s: 30 },
  tg_pettrain: { d: TODAY, n: 1 }, tg_trace_state: { day: TODAY, n: 4 }, tg_usage: { d: TODAY, ask: 2 }, tg_pa_runs: { d: TODAY, s1: 2 },
  tg_weekly: { week: TODAY, games: 4, claimed: [1] }, tg_memory_streak: { last: TODAY, n: 3 }, tg_posture_streak: { last: TODAY, n: 2 },
  tg_today_bonus: TODAY, tg_hw_done: TODAY, tg_skill_snap_month: "2026-11",
  // flags
  tg_adv_finale: "1", tg_adv_seen: "1", tg_adv_howto: "1", tg_adv_tip: "1", tg_adv_prologue: "1", tg_charModelSet: "1", tg_pa_intro: "1",
  tg_pvp_tut_seen: "1", tg_paid_activated: "1", tg_song_gift: "1", tg_welcomed: "1",
  // settings and cosmetics (raw strings and objects)
  tg_adv_career: "farmer", tg_adv_diff: "hard", tg_adv_sub: "th", tg_adv_vo: "en", tg_detail: "1", tg_loadouts: { a: { s: 1 } }, tg_skl_eq: { a: ["x"] },
  tg_pa_fx: "high", tg_pa_kind: "kids", tg_pa_band: "1", tg_pa_accomp: "band", tg_pa_view: "sheet", tg_pvp_tier: "3", tg_pvp_squad: "robot",
  tg_pvp_colorway: "red", tg_vidsub_lang: "en", tg_last_song: "twinkle", tg_vmvoice: "algieba", tg_vmpoly: "1", tg_adv_quiz: { a: 1 }, tg_adv_weak: { a: 1 },
  tg_petbag: { food: 3 }, tg_petexped: { sp: "cat", until: 1730000000000 }, tg_coach_skip_day: TODAY, tg_broadcast_seen: "b9", tg_atip_last_delivered: "12345",
  tg_kid: "1", tg_goal: { title: "exam", date: FAR }, tg_event: { name: "x", date: FAR }, tg_homework: { id: "h" }, tg_lessonplan: { id: "p" },
  tg_adv_load: { gun: "pulse" }, tg_adv_energy: "40", tg_kru: [{ name: "Anna", done: false }],
  tg_skin: "neon", tg_theme: "dark", tg_sticker: "star", tg_frame: "gold", tg_keyboard: "wood", tg_charModel: "m3", tg_charHat: "cap", tg_charOutfit: "suit",
  tg_charWeapon: "sword", tg_charAccessory: "glasses",
  tg_ah_camp: { cleared: 3, stars: [3, 2, 1] }, tg_pvp_rpg: { m1: { exp: 500, pts: { str: 2 } } }, tg_petpath: { cat: ["a", null, "b"] },
  tg_favs: ["twinkle", "ode"], tg_mysongs: [{ id: "my_1730000000001", title: "t", notes: [] }], tg_vidfavs: { v1: 1, v2: 1 },
  tg_adv_crystals: "75", tg_pvp_valor: "30",
  tg_chest_date: TODAY, tg_chest_streak: "3",
  tg_pet: { species: "cat", bond: 5, seen: 1730000000000, name: "Mi" }, tg_petbox: [{ species: "dog", bond: 2, seen: 1720000000000 }],
  tg_best_twinkle: "800", tg_stars_twinkle: "3", tg_acc_twinkle: "95", tg_medal_twinkle: "2", tg_count_twinkle: "6",
  tg_ghost_twinkle: [{ t: 0, s: 0 }, { t: 1000, s: 100 }],
};
delete FOLLOW.tg_plan_in_2026_11_05;
FOLLOW["tg_plan_in_" + TODAY] = ["warmup"];

{
  const { server, devs: [A, B] } = await rig();
  await signIn(A);
  for (const [k, v] of Object.entries(FOLLOW)) A.set(k, v);
  await A.sync(); await A.sync();
  await signIn(B);
  await B.sync();
  for (const [k, v] of Object.entries(FOLLOW)) {
    const a = A.get(k), b = B.get(k);
    ok("follow " + k, b !== null && (a === b || eq(A.json(k), B.json(k))), { a, b });
  }
  // idempotent: the same pull twice changes nothing (no storage change, no 'cloud-pulled' event)
  const before = snapNoBook(B), ev = B.pulledEvents(), aBefore = snapNoBook(A);
  await B.sync(); await B.sync(); await A.sync();
  ok("idempotent: B storage unchanged by repeated pulls", eq(before, snapNoBook(B)), Object.keys(before).filter((k) => before[k] !== snapNoBook(B)[k]));
  ok("idempotent: no further 'cloud-pulled' event", B.pulledEvents() === ev, { ev, now: B.pulledEvents() });
  ok("idempotent: A storage unchanged", eq(aBefore, snapNoBook(A)), Object.keys(aBefore).filter((k) => aBefore[k] !== snapNoBook(A)[k]));
  // per-song numbers travel as ONE row per family
  const rowKeys = [...server.rows("u1").keys()];
  ok("packs: one row per family, no per-song rows", rowKeys.includes("tg_pk_best") && !rowKeys.some((k) => /^tg_(best|stars|acc|medal|count)_/.test(k)), rowKeys.filter((k) => /^tg_(best|stars|acc|medal|count)/.test(k)));
  ok("every cloud key is <= 64 characters", rowKeys.every((k) => k.length <= 64));
}

/* ───────── 2. never-sync keys never reach the RPC ───────── */
{
  const NEVER = ["tg_coins", "tg_gems", "tg_exp", "tg_streak", "tg_plan", "tg_premium", "tg_game_power", "tg_gp_seen", "tg_modelCores", "tg_notif_reward_done",
    "tg_pvp_rank", "tg_pvp_season", "tg_pvp_ghost", "tg_pvp_rival", "tg_pvp_daily", "tg_pvp_stage", "tg_guest_profile", "tg_guest_ms", "tg_anon_id",
    "tg_user_signed_out", "tg_auth_bk", "tg_adv_gfx", "tg_adv_music", "tg_gfx_tier", "tg_3d_tier", "tg_pvp_gfx", "tg_pa_gfx", "tg_ah_snd", "tg_mode", "tg_ux2",
    "tg_test_hook", "tg_test_forcelogin", "tg_adv_unlockall", "tg_ah_unlockall", "tg_gp_free", "tg_adv_nocine", "tg_adv_nogate", "tg_msd", "tg_fullscore", "tg_col3d",
    "tg_pa_cal_mic", "tg_pa_cal_midi", "tg_piano_tune_v1", "tg_ai_cache_v1", "tg_attr", "tg_src", "tg_ga", "tg_dev", "tg_bio_cred_3", "tg_stitched_u1",
    "tg_permprimed", "tg_push_primed", "tg_install_banner_seen", "tg_apk_banner_seen", "tg_freeze_month", "tg_adv_raid", "tg_adv_recent", "tg_adv_sector",
    "tg_chat_idx", "tg_chat_t_abc", "tg_chat_history", "tg_learning_queue", "tg_learning_session", "tiga_leads", "tiga_lab_x", "tiga_referral", "tg_admin_pay_seen",
    "tg_tts_aff", "tg_tts_pf", "tg_pa_testhook", "tg_adv_crash", "sb-proj-auth-token"];
  const { server, devs: [A, B] } = await rig();
  await signIn(A);
  for (const k of NEVER) A.set(k, "999");
  A.set("tg_favs", ["real"]);   // something that DOES sync, so a round really happens
  await A.sync(); await A.sync();
  const sent = server.sentKeys((x) => x.device === "A");
  ok("sanity: a synced key was sent", sent.has("tg_favs"));
  for (const k of NEVER) ok("never sent: " + k, !sent.has(k));
  ok("bookkeeping never sent", ![...sent].some(BOOK));
  await signIn(B);
  for (const k of NEVER) ok("never arrives: " + k, B.get(k) === null);
  // and a hostile / buggy cloud row for a never-sync key is ignored
  server.rows("u1").set("tg_coins", { value: 100000, client_ts: now() + 1e9 });
  server.rows("u1").set("tg_game_power", { value: 100, client_ts: now() + 1e9 });
  server.rows("u1").set("tg_test_hook", { value: "1", client_ts: now() + 1e9 });
  server.rows("u1").set("tg_streak", { value: { n: 99 }, client_ts: now() + 1e9 });
  await B.sync();
  ok("a cloud row for tg_coins / game power / test flag / streak is ignored", ["tg_coins", "tg_game_power", "tg_test_hook", "tg_streak"].every((k) => B.get(k) === null));
}

/* ───────── 3. the raw-string codec and tombstones ───────── */
{
  const { server, devs: [A, B] } = await rig();
  // the old build pushed raw strings as JSON null rows (tombstones) and that deleted them on other devices
  const u = server.rows("u1");
  for (const k of ["tg_chest_date", "tg_last_song", "tg_freeze_month", "tg_skill_snap_month", "tg_today_bonus"]) u.set(k, { value: null, client_ts: now() - 86400000 });
  await signIn(A);
  A.set("tg_today_bonus", TODAY); A.set("tg_last_song", "twinkle"); A.set("tg_skin", "neon"); A.set("tg_chest_date", TODAY); A.set("tg_chest_streak", "4");
  await A.sync();
  ok("raw string survives A -> cloud -> B", (await (async () => { await signIn(B); return B.get("tg_today_bonus") === TODAY && B.get("tg_last_song") === "twinkle" && B.get("tg_skin") === "neon"; })()));
  ok("cloud holds the string, not a null", server.cloud("u1", "tg_today_bonus") && server.cloud("u1", "tg_today_bonus").__s === TODAY, server.cloud("u1", "tg_today_bonus"));
  ok("chest date arrives with its streak", B.get("tg_chest_date") === TODAY && B.get("tg_chest_streak") === "4");
  // a stale null row never deletes a local value
  server.rows("u1").set("tg_hw_done", { value: null, client_ts: now() + 5000 });
  B.set("tg_hw_done", TODAY); await B.sync();
  ok("a null row does not delete a merge-mode key", B.get("tg_hw_done") === TODAY);
  ok("...and the local value is pushed back over it", server.cloud("u1", "tg_hw_done") && server.cloud("u1", "tg_hw_done").__s === TODAY, server.cloud("u1", "tg_hw_done"));
  // TOMBSTONE_OK keys: deleting on one device deletes everywhere
  A.set("tg_goal", { title: "x", date: FAR }); await A.sync(); await B.sync();
  ok("goal set on A reaches B", B.json("tg_goal") && B.json("tg_goal").title === "x");
  A.del("tg_goal"); await A.sync(); await B.sync();
  ok("goal removed on A is removed on B (tombstone)", B.get("tg_goal") === null, B.get("tg_goal"));
  // NOT tombstone-ok: favourites emptied -> handled by set3, other keys never deleted by null
  server.rows("u1").set("tg_path_done", { value: null, client_ts: now() + 99999 });
  B.set("tg_path_done", ["p1"]); await B.sync();
  ok("a null row never wipes progress (tg_path_done)", eq(B.json("tg_path_done"), ["p1"]));
}

/* ───────── 4. two devices both edit, converge with no loss ───────── */
async function both(setupKey, setupVal, editA, editB, check, name) {
  const { devs: [A, B], server } = await rig();
  await signIn(A); if (setupKey) A.set(setupKey, setupVal);
  await A.sync(); await signIn(B); await B.sync();
  editA(A); editB(B);                    // offline edits on both
  await A.sync(); await B.sync(); await A.sync(); await B.sync();
  const asSet = (v) => (Array.isArray(v) && v.every((x) => typeof x !== 'object') ? [...v].sort() : v);
  const conv = [...new Set([...Object.keys(snapNoBook(A)), ...Object.keys(snapNoBook(B))])].filter((k) => !/^tg_(plan_in|sync)/.test(k)).filter((k) => !eq(asSet(A.json(k)), asSet(B.json(k))));
  ok(name + ": converge", conv.length === 0, conv.map((k) => [k, A.get(k), B.get(k)]));
  await check(A, B, server);
}
await both("tg_favs", ["a", "b", "c"], (A) => { A.set("tg_favs", ["a", "b", "c", "fromA"]); }, (B) => { B.set("tg_favs", ["a", "b", "c", "fromB"]); },
  (A) => ok("favs: both additions survive", eq(new Set(A.json("tg_favs")), new Set(["a", "b", "c", "fromA", "fromB"])) || ["fromA", "fromB"].every((x) => A.json("tg_favs").includes(x))), "favs add");
await both("tg_favs", ["a", "b", "c"], (A) => { A.set("tg_favs", ["a", "c"]); }, (B) => { B.set("tg_favs", ["a", "b", "c", "n"]); },
  (A) => ok("favs: a deletion sticks, an addition survives", !A.json("tg_favs").includes("b") && A.json("tg_favs").includes("n") && A.json("tg_favs").includes("a"), A.json("tg_favs")), "favs delete");
await both("tg_mysongs", [{ id: "my_1", t: 1 }, { id: "my_2", t: 2 }], (A) => { A.set("tg_mysongs", [{ id: "my_2", t: 2 }]); }, (B) => { B.set("tg_mysongs", [{ id: "my_3", t: 3 }, { id: "my_1", t: 1 }, { id: "my_2", t: 2 }]); },
  (A) => { const ids = A.json("tg_mysongs").map((s) => s.id); ok("mysongs: my_1 deleted stays deleted, my_3 added", !ids.includes("my_1") && ids.includes("my_3") && ids.includes("my_2"), ids); }, "mysongs");
await both("tg_vidfavs", { v1: 1, v2: 1 }, (A) => { A.set("tg_vidfavs", { v1: 1 }); }, (B) => { B.set("tg_vidfavs", { v1: 1, v2: 1, v3: 1 }); },
  (A) => ok("vidfavs: v2 deleted, v3 added", !("v2" in A.json("tg_vidfavs")) && "v3" in A.json("tg_vidfavs"), A.json("tg_vidfavs")), "vidfavs");
await both("tg_path_done", ["a"], (A) => A.set("tg_path_done", ["a", "x"]), (B) => B.set("tg_path_done", ["a", "y"]), (A) => ok("path_done union", eq(new Set(A.json("tg_path_done")), new Set(["a", "x", "y"])) || (A.json("tg_path_done").length === 3)), "union");
await both("tg_eargym", { r: 3 }, (A) => A.set("tg_eargym", { r: 9, p: 1 }), (B) => B.set("tg_eargym", { r: 5, q: 4 }), (A) => ok("objmax per field", eq(A.json("tg_eargym"), { r: 9, p: 1, q: 4 })), "objmax");
await both("tg_adv_best", { luma: 100 }, (A) => A.set("tg_adv_best", { luma: 90 }), (B) => B.set("tg_adv_best", { luma: 95, ferro: 70 }), (A) => ok("objmin: the smaller time wins, nothing lost", eq(A.json("tg_adv_best"), { luma: 90, ferro: 70 })), "objmin");
await both("tg_arena_best", "5", (A) => A.set("tg_arena_best", "9"), (B) => B.set("tg_arena_best", "7"), (A) => ok("max", A.get("tg_arena_best") === "9"), "max");
await both("tg_ah_camp", { cleared: 1, stars: [1] }, (A) => A.set("tg_ah_camp", { cleared: 3, stars: [3, 2, 1] }), (B) => B.set("tg_ah_camp", { cleared: 2, stars: [1, 3] }), (A) => ok("ahcamp", eq(A.json("tg_ah_camp"), { cleared: 3, stars: [3, 3, 1] }), A.json("tg_ah_camp")), "ahcamp");
// time-ordered capped list: the NEWEST are kept, in time order
{
  const mk = (from, n) => Array.from({ length: n }, (_, i) => ({ t: 1730000000000 + (from + i) * 1000, k: "x" + (from + i) }));
  await both("tg_act_log", mk(0, 900), (A) => A.set("tg_act_log", [...mk(0, 900), ...mk(900, 400)]), (B) => B.set("tg_act_log", [...mk(0, 900), ...mk(1300, 400)]),
    (A) => { const l = A.json("tg_act_log"); ok("act_log: capped at 1500", l.length === 1500, l.length); ok("act_log: newest kept (the last entry of B's burst)", l[l.length - 1].k === "x1699", l[l.length - 1]);
      ok("act_log: in time order", l.every((e, i) => i === 0 || e.t >= l[i - 1].t)); ok("act_log: the oldest 200 were cut, not the newest", !l.some((e) => e.k === "x100") && l.some((e) => e.k === "x200")); }, "act_log");
}
await both("tg_kdrops", [{ pc: "C", t: 100 }], (A) => A.set("tg_kdrops", [{ pc: "C", t: 100 }, { pc: "D", t: 300 }]), (B) => B.set("tg_kdrops", [{ pc: "C", t: 100 }, { pc: "E", t: 200 }]),
  (A) => ok("kdrops by pc", A.json("tg_kdrops").length === 3), "kdrops");
// memory: struggles, mastered, noteMisses survive; a mastered label removes an older struggle
await both("tg_memory", { struggles: [{ label: "C", last: 1730000000000 }], mastered: [], recent: [], sessions: 1, lastSession: 1730000000000 },
  (A) => A.set("tg_memory", { struggles: [{ label: "C", last: 1730000000000 }, { label: "D", last: 1730100000000 }], mastered: [], recent: [], sessions: 2, lastSession: 1730100000000, noteMisses: [{ label: "F#", count: 3, last: 1730100000000 }] }),
  (B) => B.set("tg_memory", { struggles: [], mastered: ["C"], recent: [{ label: "C", t: "2026-11-05" }], sessions: 3, lastSession: 1793000000000 }),
  (A) => { const m = A.json("tg_memory"); ok("memory: noteMisses kept", m.noteMisses && m.noteMisses[0].label === "F#", m); ok("memory: mastered C removes the older C struggle, D stays", !m.struggles.some((s) => s.label === "C") && m.struggles.some((s) => s.label === "D") && m.mastered.includes("C"), m); ok("memory: sessions max", m.sessions === 3); }, "memory");
await both("tg_practice_best", { d1: { accuracy: 80, bestStreak: 3, at: 100 } }, (A) => A.set("tg_practice_best", { d1: { accuracy: 95, bestStreak: 3, at: 200 } }), (B) => B.set("tg_practice_best", { d1: { accuracy: 70, bestStreak: 9, at: 300 }, d2: { accuracy: 50, bestStreak: 1, at: 1 } }),
  (A) => ok("practice_best: accuracy and streak never regress", A.json("tg_practice_best").d1.accuracy === 95 && A.json("tg_practice_best").d1.bestStreak === 9 && A.json("tg_practice_best").d2, A.json("tg_practice_best")), "practicebest");
await both("tg_ghost_s", [{ t: 0, s: 0 }, { t: 1, s: 50 }], (A) => A.set("tg_ghost_s", [{ t: 0, s: 0 }, { t: 9, s: 90 }]), (B) => B.set("tg_ghost_s", [{ t: 0, s: 0 }, { t: 5, s: 70 }, { t: 6, s: 75 }]),
  (A) => ok("ghost: the higher run is kept whole, never interleaved", eq(A.json("tg_ghost_s"), [{ t: 0, s: 0 }, { t: 9, s: 90 }]), A.json("tg_ghost_s")), "ghost");
await both("tg_kstats", { correct: 2, answered: 3, bestStreak: 2, streak: 1, lastDay: YEST, seen: { a: YEST } }, (A) => A.set("tg_kstats", { correct: 5, answered: 6, bestStreak: 2, streak: 4, lastDay: TODAY, seen: { a: YEST, b: TODAY } }), (B) => B.set("tg_kstats", { correct: 4, answered: 9, bestStreak: 6, streak: 1, lastDay: YEST, seen: { a: YEST, c: YEST } }),
  (A) => { const k = A.json("tg_kstats"); ok("kstats: counters max, streak from the later day", k.correct === 5 && k.answered === 9 && k.bestStreak === 6 && k.streak === 4 && k.lastDay === TODAY && k.seen.b && k.seen.c, k); }, "kstats");
await both("tg_pvp_rpg", { m1: { exp: 100, pts: { str: 1 } } }, (A) => A.set("tg_pvp_rpg", { m1: { exp: 300, pts: { str: 3 } } }), (B) => B.set("tg_pvp_rpg", { m1: { exp: 200, pts: { dex: 2 } }, m2: { exp: 5 } }),
  (A) => ok("recbest: the whole record with the larger exp, no field mixing", eq(A.json("tg_pvp_rpg").m1, { exp: 300, pts: { str: 3 } }) && A.json("tg_pvp_rpg").m2, A.json("tg_pvp_rpg")), "recbest");
await both("tg_petpath", { cat: ["a", null] }, (A) => A.set("tg_petpath", { cat: ["a", "x"] }), (B) => B.set("tg_petpath", { cat: ["a", null, "w"] }), (A) => ok("petpath: a chosen slot is permanent, holes filled from the other side", eq(A.json("tg_petpath").cat, ["a", "x", "w"]), A.json("tg_petpath")), "petpath");
await both("tg_petpath", { cat: [null] }, (A) => A.set("tg_petpath", { cat: ["a"] }), (B) => B.set("tg_petpath", { cat: ["z"] }), () => {}, "petpath conflict (both pick the same winner)");
await both("tg_note_miss_d", { [TODAY]: { C: 1 } }, (A) => A.set("tg_note_miss_d", { [TODAY]: { C: 4, D: 1 } }), (B) => B.set("tg_note_miss_d", { [TODAY]: { C: 2, E: 7 } }), (A) => ok("nestmax", eq(A.json("tg_note_miss_d"), { [TODAY]: { C: 4, D: 1, E: 7 } })), "nestmax");
await both("tg_plan_tempo", { s: 1 }, (A) => A.set("tg_plan_tempo", { s: 0.9 }), (B) => { }, (A) => ok("objmerge: newer edit wins", A.json("tg_plan_tempo").s === 0.9), "objmerge");

/* best-score packs: max per song, both devices' songs survive */
{
  const { devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  A.set("tg_best_a", "100"); A.set("tg_stars_a", "2"); B.set("tg_best_a", "150"); B.set("tg_best_b", "40"); B.set("tg_stars_a", "3");
  await A.sync(); await B.sync(); await A.sync(); await B.sync();
  ok("packs: max per song on both", A.get("tg_best_a") === "150" && B.get("tg_best_a") === "150" && A.get("tg_best_b") === "40" && A.get("tg_stars_a") === "3" && B.get("tg_stars_a") === "3");
}

/* flags and markers */
{
  const { devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  A.set("tg_welcomed", "1"); A.set("tg_song_gift", "1"); A.set("tg_adv_prologue", "skip"); A.set("tg_today_bonus", TODAY); A.set("tg_skill_snap_month", "2026-11");
  await A.sync(); await B.sync();
  ok("flag: welcome popup and free-song flags follow", B.get("tg_welcomed") === "1" && B.get("tg_song_gift") === "1");
  ok("flag: tg_adv_prologue = skip (a test value) never travels", B.get("tg_adv_prologue") === null);
  ok("maxstr: second device sees today's bonus already claimed", B.get("tg_today_bonus") === TODAY);
  B.set("tg_today_bonus", YEST); await B.sync(); await A.sync();
  ok("maxstr: an older day from another device never replaces the later one", A.get("tg_today_bonus") === TODAY && B.get("tg_today_bonus") === TODAY, [A.get("tg_today_bonus"), B.get("tg_today_bonus")]);
  // a future day in the cloud (clock error / tampering) is ignored
  const { server, devs: [C, D] } = await rig();
  await signIn(C); C.set("tg_today_bonus", YEST); await C.sync();
  server.rows("u1").set("tg_today_bonus", { value: { __s: FAR }, client_ts: now() + 100000 });
  server.rows("u1").set("tg_earn_day", { value: { d: FAR, n: 0 }, client_ts: now() + 100000 });
  C.set("tg_earn_day", { d: TODAY, n: 5 });
  await C.sync();
  ok("maxstr: a day far in the future is ignored", C.get("tg_today_bonus") !== FAR, C.get("tg_today_bonus"));
  ok("dayrec: a record from the far future does not replace today's counters", eq(C.json("tg_earn_day"), { d: TODAY, n: 5 }), C.json("tg_earn_day"));
}

/* reward limits only ever tighten */
{
  const keys = { tg_adv_coin_day: ["d", "n"], tg_ah_coin_day: ["d", "n"], tg_earn_day: ["d", "n"], tg_sell_day: ["d", "n"], tg_game_day: ["d", "n"], tg_tts_day: ["d", "s"], tg_usage: ["d", "ask"] };
  for (const [k, [df, nf]] of Object.entries(keys)) {
    const { server, devs: [A] } = await rig();
    // same day: local 5 / cloud 3 -> stays 5; local 2 / cloud 9 -> 9 ; older cloud day never replaces; newer day (tomorrow) is taken whole
    await signIn(A);
    A.set(k, { [df]: TODAY, [nf]: 5 }); server.rows("u1").set(k, { value: { [df]: TODAY, [nf]: 3 }, client_ts: now() + 500 });
    await A.sync(); ok(k + ": cloud 3 never lowers local 5", A.json(k)[nf] === 5, A.json(k));
    server.rows("u1").set(k, { value: { [df]: TODAY, [nf]: 9 }, client_ts: now() + 100000 }); await A.sync();
    ok(k + ": cloud 9 raises local 5 (the shared cap)", A.json(k)[nf] === 9, A.json(k));
    server.rows("u1").set(k, { value: { [df]: YEST, [nf]: 0 }, client_ts: now() + 200000 }); await A.sync();
    ok(k + ": an older day cannot reset today", A.json(k)[df] === TODAY && A.json(k)[nf] === 9, A.json(k));
    // 'claimed' style booleans and arrays: OR / union
  }
  const { server, devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  A.set("tg_adv_q", { d: TODAY, done: { crystals: true } }); B.set("tg_adv_q", { d: TODAY, done: { quiz: true }, n: 2 });
  await A.sync(); await B.sync(); await A.sync();
  ok("tg_adv_q: a quest claimed on either device is claimed on both", A.json("tg_adv_q").done.crystals && A.json("tg_adv_q").done.quiz && B.json("tg_adv_q").done.crystals, A.json("tg_adv_q"));
  A.set("tg_weekly", { week: "2026-11-02", games: 4, claimed: [1] }); B.set("tg_weekly", { week: "2026-11-02", games: 2, claimed: [2] });
  await A.sync(); await B.sync(); await A.sync();
  ok("tg_weekly: same week, claims union and counters max", eq(A.json("tg_weekly").claimed.slice().sort(), [1, 2]) && A.json("tg_weekly").games === 4, A.json("tg_weekly"));
  A.set("tg_chat_stats", { d: TODAY, asked: 3, exp: 6 }); await A.sync(); B.set("tg_chat_stats", { d: TODAY, asked: 1, exp: 2 }); await B.sync(); await A.sync();
  ok("chat_stats: the free daily questions are counted per account (max)", A.json("tg_chat_stats").asked === 3 && B.json("tg_chat_stats").asked === 3, [A.json("tg_chat_stats"), B.json("tg_chat_stats")]);
}

/* chest */
{
  const { devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  A.set("tg_chest_date", TODAY); A.set("tg_chest_streak", "5");
  B.set("tg_chest_date", YEST); B.set("tg_chest_streak", "9");   // B is stale and has a bigger old streak
  await A.sync(); await B.sync(); await A.sync();
  ok("chest: the later date wins WITH its own streak (cannot be re-claimed today)", B.get("tg_chest_date") === TODAY && B.get("tg_chest_streak") === "5" && A.get("tg_chest_date") === TODAY, [B.get("tg_chest_date"), B.get("tg_chest_streak")]);
  const { devs: [C, D], server } = await rig();
  await signIn(C); C.set("tg_chest_date", TODAY); C.set("tg_chest_streak", "2"); await C.sync();
  D.signIn("u1"); await D.sync(); D.set("tg_chest_date", TODAY); D.set("tg_chest_streak", "3"); await D.sync(); await C.sync();
  ok("chest: same date -> larger streak", C.get("tg_chest_streak") === "3" && D.get("tg_chest_streak") === "3");
  server.rows("u1").set("tg_chest_date", { value: { __s: FAR }, client_ts: now() + 50000 }); server.rows("u1").set("tg_chest_streak", { value: 50, client_ts: now() + 50000 });
  await C.sync(); ok("chest: a future date is ignored", C.get("tg_chest_date") === TODAY && C.get("tg_chest_streak") === "3");
}

/* pets: one active pet, no species in both slots */
{
  const { devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  A.set("tg_pet", { species: "cat", bond: 5, seen: 1000, name: "Mi" }); A.set("tg_petbox", [{ species: "dog", bond: 2, seen: 500 }]);
  B.set("tg_pet", { species: "dog", bond: 7, seen: 2000, name: "Rex" }); B.set("tg_petbox", []);
  await A.sync(); await B.sync(); await A.sync(); await B.sync();
  const pa = A.json("tg_pet"), ba = A.json("tg_petbox");
  ok("pets: both devices agree", eq(pa, B.json("tg_pet")) && eq(ba, B.json("tg_petbox")), [pa, ba, B.json("tg_pet"), B.json("tg_petbox")]);
  ok("pets: newest 'seen' is the active pet, bond is the max, the other species is in the box exactly once", pa.species === "dog" && pa.bond === 7 && ba.length === 1 && ba[0].species === "cat" && ba[0].bond === 5, [pa, ba]);
}

/* soft currency ledger */
{
  const { devs: [A, B] } = await rig();
  await signIn(A); A.set("tg_adv_crystals", "100"); await A.sync();
  await signIn(B); await B.sync();
  ok("crystals: a new device starts from the shared balance", B.get("tg_adv_crystals") === "100", B.get("tg_adv_crystals"));
  A.set("tg_adv_crystals", "120"); B.set("tg_adv_crystals", "130");   // +20 on A, +30 on B, offline
  await A.sync(); await B.sync(); await A.sync(); await B.sync();
  ok("crystals: earnings on both devices both survive (150)", A.get("tg_adv_crystals") === "150" && B.get("tg_adv_crystals") === "150", [A.get("tg_adv_crystals"), B.get("tg_adv_crystals")]);
  B.set("tg_adv_crystals", "110"); await B.sync(); await A.sync();
  ok("crystals: a spend on one device shows on the other (110)", A.get("tg_adv_crystals") === "110" && B.get("tg_adv_crystals") === "110", [A.get("tg_adv_crystals"), B.get("tg_adv_crystals")]);
  A.set("tg_adv_crystals", "0"); await A.sync(); await B.sync();
  ok("crystals: never negative", A.get("tg_adv_crystals") === "0" && B.get("tg_adv_crystals") === "0");
  // migration: a legacy plain number in the cloud becomes the starting balance
  const r = await rig(); const E = r.devs[0];
  r.server.rows("u1").set("tg_pvp_valor", { value: 40, client_ts: now() - 1000 });
  await signIn(E); ok("valor: a legacy plain number in the cloud is adopted", E.get("tg_pvp_valor") === "40", E.get("tg_pvp_valor"));
}

/* ───────── 5. pull before push: a long-open tab never overwrites another device ───────── */
{
  const { devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  A.set("tg_path_done", ["a1"]); await A.sync();
  // B has NOT pulled since; it adds its own item and syncs
  B.set("tg_path_done", ["b1"]); await B.sync();
  ok("stale tab: B's push keeps A's earlier addition", eq(new Set(B.json("tg_path_done")), new Set(["a1", "b1"])), B.json("tg_path_done"));
  await A.sync(); ok("...and A receives B's", A.json("tg_path_done").includes("b1") && A.json("tg_path_done").includes("a1"));
}

/* ───────── 6. a different account on the same device never sees or merges the previous account's data ───────── */
{
  const { server, devs: [A, B] } = await rig();
  await signIn(A, "u1");
  A.set("tg_favs", ["secret-song"]); A.set("tg_adv_crystals", "500"); A.set("tg_path_done", ["u1-stage"]); A.set("tg_best_s", "999"); A.set("tg_act_log", [{ t: 1730000000000, k: "u1" }]);
  await A.sync();
  A.signOut();
  A.set("tg_favs", ["guest-after-signout"]);   // whatever is on the screen after a sign-out stays local until the next sign-in
  await signIn(A, "u2");
  ok("account switch: nothing of u1 is on the device", ["tg_adv_crystals", "tg_path_done", "tg_best_s", "tg_act_log"].every((k) => A.get(k) === null) && !(A.json("tg_favs") || []).includes("secret-song"), A.snapshot());
  const u2 = [...server.rows("u2").keys()];
  ok("account switch: u2's cloud has no u1 data", !u2.includes("tg_path_done") && !u2.includes("tg_act_log") && !u2.includes("tg_pk_best"), u2);
  ok("account switch: u1's cloud rows are untouched", eq(server.cloud("u1", "tg_path_done"), ["u1-stage"]) && server.rows("u1").has("tg_pk_best"));
  // the same account signing back in on this device keeps its data
  const { devs: [C] } = await rig();
  await signIn(C, "u1"); C.set("tg_path_done", ["p"]); await C.sync(); C.signOut(); await signIn(C, "u1");
  ok("same account signing in again keeps its data", eq(C.json("tg_path_done"), ["p"]));
  // guest progress on a brand-new device is inherited by the FIRST account that signs in (intended), not wiped
  const { devs: [G] } = await rig();
  G.set("tg_path_done", ["guest-stage"]); await signIn(G, "u9");
  ok("first sign-in adopts the guest's local progress", eq(G.json("tg_path_done"), ["guest-stage"]));
  // an in-flight response for the old account must not be applied to the new one
  const { server: s2, devs: [H] } = await rig();
  await signIn(H, "u1"); s2.rows("u1").set("tg_path_done", { value: ["late-u1"], client_ts: now() }); 
  let release; s2.hold = new Promise((r) => (release = r));
  H.set("tg_favs", ["x"]); const p = H.mod.cloudSyncNow(); H.signOut(); H.signIn("u2");
  release(); s2.hold = null; await p; await signIn(H, "u2"); for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
  ok("account switch mid-flight: u1's late response is not applied to u2", H.get("tg_path_done") === null, H.get("tg_path_done"));
}

/* ───────── 7. failures stay silent, retry later, never lose data ───────── */
{
  const { server, devs: [A, B] } = await rig();
  await signIn(A);
  server.down = true;
  A.set("tg_favs", ["offline-fav"]); A.set("tg_path_done", ["off1"]);
  let threw = false; try { await A.sync(); await A.sync(); } catch (e) { threw = true; }
  ok("offline: no exception reaches the app", !threw);
  server.down = false; await A.sync(); await A.sync();
  ok("after reconnecting the offline edits reach the cloud", eq(server.cloud("u1", "tg_path_done"), ["off1"]) && server.rows("u1").has("tg_favs"));
  await signIn(B); ok("...and another device receives them", eq(B.json("tg_path_done"), ["off1"]));
  // the RPC missing entirely (migration not applied): nothing throws
  const { devs: [C], server: s3 } = await rig();
  s3.rpc = async () => ({ data: null, error: { message: "function does not exist" } });
  let t2 = false; try { await signIn(C); C.set("tg_favs", ["x"]); await C.sync(); } catch (e) { t2 = true; }
  ok("RPC missing: sync stays off without a crash", !t2 && eq(C.json("tg_favs"), ["x"]));
  // a device that was offline at launch must not stamp stale values over newer cloud values
  const { server: s4, devs: [D, E] } = await rig();
  await signIn(D); D.set("tg_skin", "old"); await D.sync();
  await signIn(E); await E.sync(); E.set("tg_skin", "new"); await E.sync(); 
  s4.down = true; const { devs: [F] } = await rig(); void F;
  D.signOut(); D.set("tg_skin", "old"); s4.down = true; D.signIn("u1"); for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  s4.down = false; await D.sync();
  ok("launch offline then online: the newer cloud value wins over the stale local one", D.get("tg_skin") === "new", D.get("tg_skin"));
}

/* ───────── 8. size and key limits ───────── */
{
  const { server, devs: [A] } = await rig();
  await signIn(A);
  A.set("tg_act_log", Array.from({ length: 1500 }, (_, i) => ({ t: 1730000000000 + i * 1000, k: "event-" + i, note: "x".repeat(150) })));
  A.set("tg_best_" + "z".repeat(60), "5");   // would make a 70-character key if sent per song; packed it travels inside tg_pk_best
  A.set("tg_favs", ["ok"]);
  let threw = false; try { await A.sync(); await A.sync(); } catch (e) { threw = true; }
  ok("a very big list is split or skipped, never an exception, and small keys still go", !threw && server.rows("u1").has("tg_favs"));
  ok("no row above the size guard reached the server", [...server.rows("u1").values()].every((r) => JSON.stringify(r.value).length <= 400000));
}

/* ───────── 9. the background timer: retry with back-off, no ping-pong when nothing changed ───────── */
{
  const { server, clock, devs: [A, B] } = await rig();
  await signIn(A);
  server.down = true;
  A.set("tg_path_done", ["retry-me"]);
  await A.tick();                                  // fails
  const callsDown = server.calls;
  server.down = false;
  await A.tick();                                  // inside the back-off window: no call at all
  ok("back-off: no hammering while the last attempt failed", server.calls === callsDown, [server.calls, callsDown]);
  clock.tick(25000); await A.tick(); clock.tick(1000); await A.tick();
  ok("retry: the failed push is retried by the timer with no further edit", eq(server.cloud("u1", "tg_path_done"), ["retry-me"]), server.cloud("u1", "tg_path_done"));
  // a device that stays open picks up what another device did (the timer pulls every third tick)
  await signIn(B); B.set("tg_favs", ["from-B"]); await B.sync();
  for (let i = 0; i < 4; i++) { clock.tick(21000); await A.tick(); }
  ok("timer: an open tab receives the other device's change without a reload", (A.json("tg_favs") || []).includes("from-B"), A.json("tg_favs"));
  ok("timer: A is told so (event for the screens)", A.pulledEvents() >= 1);
}
{
  // after convergence, extra rounds on both devices send nothing (no ping-pong of equal-but-differently-ordered data)
  const { server, devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  A.set("tg_favs", ["a", "b"]); A.set("tg_path_done", ["x", "y"]); A.set("tg_eargym", { r: 3 }); A.set("tg_adv_q", { d: TODAY, done: { a: true } }); A.set("tg_act_log", [{ t: 1730000000000, k: 1 }]);
  A.set("tg_mysongs", [{ id: "my_1730000000001", title: "x" }]); A.set("tg_ark", { ring: 1 }); A.set("tg_kstats", { correct: 1, answered: 2, bestStreak: 1, streak: 1, lastDay: TODAY, seen: {} });
  B.set("tg_favs", ["b", "c"]); B.set("tg_path_done", ["y", "z"]); B.set("tg_eargym", { r: 5, p: 1 }); B.set("tg_adv_q", { d: TODAY, done: { b: true } }); B.set("tg_act_log", [{ t: 1730000005000, k: 2 }]);
  B.set("tg_mysongs", [{ id: "my_1730000000002", title: "y" }]); B.set("tg_ark", { ring: 2, farm: 1 }); B.set("tg_kstats", { correct: 3, answered: 3, bestStreak: 3, streak: 2, lastDay: TODAY, seen: { q: TODAY } });
  for (let i = 0; i < 4; i++) { await A.sync(); await B.sync(); }
  const n0 = server.sent.length;
  for (let i = 0; i < 3; i++) { await A.sync(); await B.sync(); }
  ok("stability: three more rounds on both devices push nothing", server.sent.length === n0, server.sent.slice(n0).map((x) => x.device + ":" + x.key));
}
{
  // the whole FOLLOW set, edited on both devices, then quiet
  const { server, devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  for (const [k, v] of Object.entries(FOLLOW)) A.set(k, v);
  for (let i = 0; i < 4; i++) { await A.sync(); await B.sync(); }
  const n0 = server.sent.length;
  for (let i = 0; i < 3; i++) { await A.sync(); await B.sync(); }
  ok("stability: with every family populated, nothing keeps being re-sent", server.sent.length === n0, [...new Set(server.sent.slice(n0).map((x) => x.device + ":" + x.key))]);
}

/* ───────── 10. big list is shortened for the cloud, legacy rows of the first version are still read ───────── */
{
  const { server, devs: [A, B] } = await rig();
  await signIn(A);
  A.set("tg_act_log", Array.from({ length: 1500 }, (_, i) => ({ t: 1730000000000 + i * 1000, k: "e" + i, note: "y".repeat(600) })));
  await A.sync(); await A.sync();
  const cloud = server.cloud("u1", "tg_act_log");
  ok("a 900 KB activity log is pushed shortened (oldest dropped) under the row limit", Array.isArray(cloud) && JSON.stringify(cloud).length <= 400000 && cloud[cloud.length - 1].k === "e1499", cloud && cloud.length);
  ok("the local copy keeps all 1500", A.json("tg_act_log").length === 1500);
  await signIn(B); ok("another device gets the newest part", B.json("tg_act_log") && B.json("tg_act_log")[B.json("tg_act_log").length - 1].k === "e1499");
}
{
  // rows written by the first version of the sync (per-song rows, lww numbers, union ghosts) are still understood
  const { server, devs: [A] } = await rig();
  const u = server.rows("u1"), t = clock0();
  function clock0() { return CLOCK.now - 86400000; }
  u.set("tg_best_oldsong", { value: 420, client_ts: t }); u.set("tg_stars_oldsong", { value: 3, client_ts: t }); u.set("tg_medal_oldsong", { value: 2, client_ts: t });
  u.set("tg_ghost_oldsong", { value: [{ t: 0, s: 0 }, { t: 1, s: 10 }], client_ts: t });
  u.set("tg_adv_crystals", { value: 60, client_ts: t }); u.set("tg_favs", { value: ["f1"], client_ts: t }); u.set("tg_kru", { value: [{ name: "s", done: true }], client_ts: t });
  await signIn(A);
  ok("legacy per-song rows are read (max rule)", A.get("tg_best_oldsong") === "420" && A.get("tg_stars_oldsong") === "3" && A.get("tg_medal_oldsong") === "2");
  ok("legacy ghost row is read", A.json("tg_ghost_oldsong") && A.json("tg_ghost_oldsong").length === 2);
  ok("legacy crystals number becomes the balance", A.get("tg_adv_crystals") === "60");
  ok("legacy favs and kru arrive", eq(A.json("tg_favs"), ["f1"]) && A.json("tg_kru")[0].name === "s");
  // and the song numbers are re-published packed
  await A.sync(); ok("legacy song numbers are re-published as one packed row", server.rows("u1").has("tg_pk_best") && server.cloud("u1", "tg_pk_best").oldsong === 420, server.cloud("u1", "tg_pk_best"));
}

/* ───────── 11. chat threads and per-person leftovers do not pass to the next account; a device without the owner marker ───────── */
{
  const { server: server0, devs: [A, B] } = await rig();
  await signIn(A, "u1");
  A.set("tg_chat_idx", [{ id: "abc", title: "my private question" }]); A.set("tg_chat_t_abc", [{ r: "user", text: "secret" }]); A.set("tg_learning_queue", [{ x: 1 }]); A.set("tg_adv_recent", ["Kid Name"]);
  A.signOut(); await signIn(A, "u2");
  ok("account switch: chat threads, learning queue and recent-teammates list are removed", ["tg_chat_idx", "tg_chat_t_abc", "tg_learning_queue", "tg_adv_recent"].every((k) => A.get(k) === null), A.snapshot());
  // a browser from before the owner marker (tg_stitched_<uid> of another account): the owner is UNKNOWN, so nothing is wiped. Wiping on a guess lost real progress
  B.set("tg_stitched_old-user", "1"); B.set("tg_favs", ["old-users-fav"]); B.set("tg_path_done", ["unknown-owner-stage"]);
  await signIn(B, "new-user");
  ok("unknown owner: local data is adopted, not wiped", eq(B.json("tg_favs"), ["old-users-fav"]) && eq(B.json("tg_path_done"), ["unknown-owner-stage"]), B.snapshot());
  ok("unknown owner: the adopted data reaches the new account's cloud", eq(server0.cloud("new-user", "tg_path_done"), ["unknown-owner-stage"]));
  // while a browser that only ever had a guest keeps the guest's progress for the first account
  const { devs: [C] } = await rig(); C.set("tg_favs", ["guest-fav"]); await signIn(C, "first-user");
  ok("a guest-only browser keeps the guest's progress for the first account", eq(C.json("tg_favs"), ["guest-fav"]));
}


/* ───────── 12. review round: owner, stash, flush, futures, joins, shapes, ledger ───────── */
const tick = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
{
  // 12a. a KNOWN different owner is wiped, but an unflushed change of the old account is stashed and comes back when it signs in again
  const { server, devs: [A] } = await rig();
  await signIn(A, "user-one-uid");
  A.set("tg_favs", ["synced-fav"]); await A.sync();
  server.down = true;
  A.set("tg_path_done", ["offline-stage"]); A.set("tg_best_offsong", "777");
  A.signOut();
  ok("stash: the old account's unflushed change is kept outside the sync", Object.keys(A.snapshot()).some((k) => k.startsWith("tg_sync_stash_user-one")), Object.keys(A.snapshot()));
  server.down = false;
  await signIn(A, "user-two-uid");
  ok("stash: the second account does not see the first one's data", A.get("tg_path_done") === null && A.get("tg_favs") === null && A.get("tg_best_offsong") === null);
  ok("stash: the stash itself is never sent to the cloud", ![...server.sentKeys()].some((k) => k.startsWith("tg_sync_")), [...server.sentKeys()]);
  A.signOut();
  await signIn(A, "user-one-uid");
  ok("stash: the first account gets its offline change back", eq(A.json("tg_path_done"), ["offline-stage"]) && A.get("tg_best_offsong") === "777", A.snapshot());
  ok("stash: and it reaches the cloud", eq(server.cloud("user-one-uid", "tg_path_done"), ["offline-stage"]) && server.cloud("user-one-uid", "tg_pk_best").offsong === 777, server.cloud("user-one-uid", "tg_path_done"));
  ok("stash: replayed once, then gone", !Object.keys(A.snapshot()).some((k) => k.startsWith("tg_sync_stash_")), Object.keys(A.snapshot()));
  // a change whose push was acknowledged after the sign-out is not left in the stash
  const { server: s2, devs: [H] } = await rig();
  await signIn(H, "u-aaaaaaaa1"); H.set("tg_path_done", ["x"]);
  H.signOut(); await tick();
  ok("stash: an acknowledged flush drops its entry", s2.cloud("u-aaaaaaaa1", "tg_path_done") && !Object.keys(H.snapshot()).some((k) => k.startsWith("tg_sync_stash_")), Object.keys(H.snapshot()));
}
{
  // 12b. a flush while a round is in flight is not dropped
  const { server, devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  A.set("tg_path_done", ["first"]);
  let release; server.hold = new Promise((r) => (release = r));
  const f1 = A.mod.flushCloudSync(); await tick(5);   // the push of "first" is on the wire
  A.set("tg_favs", ["changed-during-round"]);
  const f2 = A.mod.flushCloudSync();                  // asked while a round runs: must not be dropped
  release(); server.hold = null; await f1; await f2; await tick();
  ok("flush during an in-flight round still pushes", eq(server.cloud("u1", "tg_path_done"), ["first"]) && eq(server.cloud("u1", "tg_favs"), ["changed-during-round"]), server.cloud("u1", "tg_favs"));
}
{
  // 12c. a cloud day after the device's own day is never accepted (tomorrow too), for every equality-compared day key
  const { server, devs: [A, B] } = await rig();
  await signIn(A);
  A.set("tg_earn_day", { d: TODAY, n: 5 }); A.set("tg_today_bonus", TODAY); A.set("tg_chest_date", TODAY); A.set("tg_chest_streak", "2"); A.set("tg_daily_song", { d: TODAY, id: "a" });
  A.set("tg_usage", { d: TODAY, ask: 1 }); A.set("tg_adv_coin_day", { d: TODAY, n: 1 }); A.set("tg_chat_stats", { d: TODAY, asked: 1, exp: 1 }); A.set("tg_weekly", { week: TODAY, games: 1 });
  await A.sync();
  const t = now() + 100000, u = server.rows("u1");
  u.set("tg_earn_day", { value: { d: TOM, n: 0 }, client_ts: t }); u.set("tg_today_bonus", { value: { __s: TOM }, client_ts: t }); u.set("tg_chest_date", { value: { __s: TOM }, client_ts: t });
  u.set("tg_chest_streak", { value: 99, client_ts: t }); u.set("tg_daily_song", { value: { d: TOM, id: "future" }, client_ts: t }); u.set("tg_usage", { value: { d: TOM, ask: 0 }, client_ts: t });
  u.set("tg_adv_coin_day", { value: { d: TOM, n: 0 }, client_ts: t }); u.set("tg_chat_stats", { value: { d: TOM, asked: 0, exp: 0 }, client_ts: t }); u.set("tg_weekly", { value: { week: TOM, games: 0 }, client_ts: t });
  await A.sync();
  ok("tomorrow in the cloud: day records are not taken", eq(A.json("tg_earn_day"), { d: TODAY, n: 5 }) && eq(A.json("tg_daily_song"), { d: TODAY, id: "a" }) && eq(A.json("tg_usage"), { d: TODAY, ask: 1 }) && eq(A.json("tg_adv_coin_day"), { d: TODAY, n: 1 }) && eq(A.json("tg_chat_stats"), { d: TODAY, asked: 1, exp: 1 }) && eq(A.json("tg_weekly"), { week: TODAY, games: 1 }), A.snapshot());
  ok("tomorrow in the cloud: day markers and the chest are not taken", A.get("tg_today_bonus") === TODAY && A.get("tg_chest_date") === TODAY && A.get("tg_chest_streak") === "2", A.snapshot());
  // the app's own toDateString format is the DEVICE's day
  u.set("tg_hw_done", { value: { __s: "Fri Nov 06 2026" }, client_ts: t + 1 });
  await A.sync(); ok("tomorrow in toDateString form is not taken", A.get("tg_hw_done") === null, A.get("tg_hw_done"));
  u.set("tg_hw_done", { value: { __s: "Thu Nov 05 2026" }, client_ts: t + 2 });
  await A.sync(); ok("today in toDateString form is taken", A.get("tg_hw_done") === "Thu Nov 05 2026", A.get("tg_hw_done"));
}
{
  // 12d. a trip claimed here does not come back from the cloud copy
  const { server, devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  const trip = { id: "park", until: now() - 1000 };
  A.set("tg_petexped", trip); await A.sync(); await B.sync();
  ok("exped: the trip arrives on the second device", eq(B.json("tg_petexped"), trip));
  A.del("tg_petexped");   // claimed on A; no poll has seen it yet
  server.rows("u1").set("tg_petexped", { value: trip, client_ts: now() + 200000 });   // a newer copy of the same trip (the other device re-pushed it)
  await A.sync(); await A.sync();
  ok("exped: a claimed trip is not resurrected", A.get("tg_petexped") === null, A.get("tg_petexped"));
  // a NEW trip (other until) is accepted
  server.rows("u1").set("tg_petexped", { value: { id: "park", until: now() + 99999 }, client_ts: now() + 300000 });
  await A.sync(); ok("exped: a different trip is accepted", A.json("tg_petexped") && A.json("tg_petexped").until > now(), A.get("tg_petexped"));
  // an edit made while a pull is on the wire has not been polled when the answer is applied: applyPull polls first
  const { server: s3, devs: [C] } = await rig();
  await signIn(C); const trip2 = { id: "ruins", until: now() - 1000 };
  C.set("tg_petexped", trip2); await C.sync();
  let rel; s3.hold = new Promise((r) => (rel = r));
  const pull = C.mod.cloudSyncNow(); await tick(5);
  C.del("tg_petexped");
  s3.rows("u1").set("tg_petexped", { value: trip2, client_ts: now() + 400000 });
  rel(); s3.hold = null; await pull; await tick();
  ok("exped: a claim made while the pull was on the wire survives it", C.get("tg_petexped") === null, C.get("tg_petexped"));
}
{
  // 12e. join-type merges: a device that holds MORE than the cloud row makes the cloud catch up, even when the cloud row is stamped newer
  const { server, devs: [A, B] } = await rig();
  await signIn(A);
  const hi = { m1: { exp: 500, pts: { str: 2 } } }, lo = { m1: { exp: 100, pts: { str: 1 } } };
  A.set("tg_pvp_rpg", hi); A.set("tg_kstats", { correct: 9, answered: 12, bestStreak: 4, streak: 1, lastDay: TODAY, seen: {} });
  A.set("tg_adv_prologue", "1"); A.set("tg_today_bonus", TODAY);
  const t = now() + 120000;
  server.rows("u1").set("tg_pvp_rpg", { value: lo, client_ts: t }); server.rows("u1").set("tg_kstats", { value: { correct: 3, answered: 5, bestStreak: 1, streak: 1, lastDay: YEST, seen: {} }, client_ts: t });
  server.rows("u1").set("tg_today_bonus", { value: { __s: YEST }, client_ts: t });
  await A.sync(); await A.sync();
  ok("join merge: recbest the cloud row catches up", eq(server.cloud("u1", "tg_pvp_rpg"), hi), server.cloud("u1", "tg_pvp_rpg"));
  ok("join merge: kstats the cloud row catches up", server.cloud("u1", "tg_kstats").correct === 9, server.cloud("u1", "tg_kstats"));
  ok("join merge: maxstr the cloud row catches up", scalOf(server.cloud("u1", "tg_today_bonus")) === TODAY, server.cloud("u1", "tg_today_bonus"));
  // and once equal nothing is pushed again
  const before = server.sent.length; await A.sync(); await A.sync(); await B.sync(); await B.sync();
  const extra = server.sent.slice(before).filter((x) => x.device === "A").map((x) => x.key);
  ok("join merge: converged, A pushes nothing more", extra.length === 0, extra);
  // clock skew: this device's clock is BEHIND the cloud row's stamp
  A.set("tg_arena_best", "9"); server.rows("u1").set("tg_arena_best", { value: 3, client_ts: now() + 250000 });
  await A.sync(); await A.sync();
  ok("re-push after a merge is stamped newer than the cloud row (clock skew)", server.cloud("u1", "tg_arena_best") === 9, server.cloud("u1", "tg_arena_best"));
}
function scalOf(v) { return v && typeof v === "object" && "__s" in v ? v.__s : v; }
{
  // 12f. shapes: a non-JSON string where a record belongs is never pushed and never accepted
  const { server, devs: [A, B] } = await rig();
  await signIn(A);
  A.set("tg_kstats", "garbage not json"); A.set("tg_memory", "also garbage"); A.set("tg_act_log", "nope"); A.set("tg_adv_career", "farmer");
  await A.sync();
  const sentKeys = server.sentKeys((x) => x.device === "A");
  ok("shape: garbage for record keys is not pushed", !sentKeys.has("tg_kstats") && !sentKeys.has("tg_memory") && !sentKeys.has("tg_act_log"), [...sentKeys]);
  ok("shape: a raw-string setting still travels", server.cloud("u1", "tg_adv_career") && scalOf(server.cloud("u1", "tg_adv_career")) === "farmer");
  server.rows("u1").set("tg_exam", { value: { __s: "junk" }, client_ts: now() + 100000 }); server.rows("u1").set("tg_path_done", { value: { __s: "junk" }, client_ts: now() + 100000 });
  B.set("tg_exam", { e1: [1] }); await signIn(B); await B.sync();
  ok("shape: a garbage cloud row is not accepted, the real value replaces it", eq(B.json("tg_exam"), { e1: [1] }) && B.get("tg_path_done") === null && eq(server.cloud("u1", "tg_exam"), { e1: [1] }), { exam: B.get("tg_exam"), cloud: server.cloud("u1", "tg_exam") });
}
{
  // 12g. read-aloud rounds stay on the device; the device id lives in the ledger blob; a guest's crystals are kept on first sign-in
  const { server, devs: [A, B] } = await rig();
  A.set("tg_tts_round", { d: TODAY, n: 2 }); await signIn(A);
  ok("tg_tts_round is never sent", !server.sentKeys().has("tg_tts_round"));
  A.set("tg_adv_crystals", "50"); await A.sync();
  const pn = A.json("tg_sync_pn");
  ok("device id is stored inside tg_sync_pn", pn && typeof pn.__dev === "string" && A.get("tg_sync_dev") === null, A.snapshot());
  B.set("tg_adv_crystals", "30"); await signIn(B);   // a guest's balance, no owner marker
  ok("guest crystals: base 50 + the guest's own 30", B.get("tg_adv_crystals") === "80", B.get("tg_adv_crystals"));
  await A.sync(); ok("guest crystals reach the other device once", A.get("tg_adv_crystals") === "80", A.get("tg_adv_crystals"));
  await B.sync(); await A.sync(); ok("guest crystals do not grow on later syncs", A.get("tg_adv_crystals") === "80" && B.get("tg_adv_crystals") === "80");
}
{
  // 12h. practice log: the same day on both sides takes the larger numbers
  const { server, devs: [A, B] } = await rig();
  await signIn(A); await signIn(B);
  A.set("tg_practice_log", { _recent: [{ d: TODAY, n: 3, ok: 10 }] }); B.set("tg_practice_log", { _recent: [{ d: TODAY, n: 5, ok: 4 }] });
  await A.sync(); await B.sync(); await A.sync();
  const r = A.json("tg_practice_log")._recent;
  ok("practice log: same-day _recent takes max per field", r.length === 1 && r[0].n === 5 && r[0].ok === 10, r);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
