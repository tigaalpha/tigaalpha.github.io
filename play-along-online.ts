// Play Along online extras: other players' best runs as ghosts and the song of the week with its board.
// Server side: supabase-playalong-ghosts-migration.sql and supabase-playalong-weekly-migration.sql (applied 2026-10-13).
// Every call fails soft: a signed-out player, a missing RPC or a network error just means no ghost and no board.
// The weekly board pays nothing (no coins, gems or EXP): it is an honour badge only.
import { useSyncExternalStore } from "react";
import { sb } from "./supabase-client";

type Sample = { t: number; s: number };
export type WeeklyInfo = { songId: string; endsAt: string; rows: { rank: number; name: string; score: number; stars: number; isMe: boolean }[] } | null;

let weekly: WeeklyInfo = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => { try { f(); } catch (e) {} });
const otherGhosts = new Map<string, Sample[] | null>();

export function useWeekly(): WeeklyInfo {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => weekly, () => null);
}

async function signedIn(): Promise<boolean> {
  try { const r = await (sb as any).auth.getSession(); return !!(r && r.data && r.data.session); } catch (e) { return false; }
}

/** This week's song and the top of its board. Called when a song is chosen; cheap and cached for a minute. */
let lastWeekly = 0;
export async function refreshWeekly(force = false): Promise<void> {
  if (!force && Date.now() - lastWeekly < 60000) return;
  lastWeekly = Date.now();
  try {
    const r = await (sb as any).rpc("pa_weekly_song");
    const row = r && r.data && (Array.isArray(r.data) ? r.data[0] : r.data);
    if (!row || !row.song_id) return;
    let rows: any[] = [];
    if (await signedIn()) { const b = await (sb as any).rpc("pa_weekly_board", { p_limit: 5 }); rows = (b && b.data) || []; }
    weekly = { songId: row.song_id, endsAt: row.ends_at, rows: rows.map((x: any) => ({ rank: x.rank, name: x.name, score: x.score, stars: x.stars, isMe: !!x.is_me })) };
    emit();
  } catch (e) {}
}

/** Record a finished run for the board. The server checks it against the song and keeps only the best. */
export async function submitWeekly(songId: string, score: number, acc: number, stars: number, maxCombo: number, durationMs: number): Promise<void> {
  try {
    if (!weekly || weekly.songId !== songId || !(await signedIn())) return;
    await (sb as any).rpc("pa_submit_weekly", { p_song_id: songId, p_score: Math.round(score), p_acc: Math.round(acc), p_stars: stars, p_max_combo: maxCombo, p_duration_ms: Math.round(durationMs) });
    await refreshWeekly(true);
  } catch (e) {}
}

/** Store this player's best run on a song so someone else can race it. */
export async function submitGhost(songId: string, level: number, score: number, acc: number, stars: number, samples: Sample[]): Promise<void> {
  try {
    if (!/^[a-z0-9_]{1,64}$/.test(songId) || !(await signedIn())) return;
    await (sb as any).rpc("pa_submit_ghost", { p_song_id: songId, p_level: level, p_score: Math.round(score), p_acc: Math.round(acc), p_stars: stars, p_samples: samples.map(p => ({ t: Math.round(p.t * 100) / 100, s: Math.round(p.s) })) });
  } catch (e) {}
}

/** Fetch another player's best run on this song ahead of time; ghostFor() reads it later without waiting. */
export async function prefetchGhost(songId: string, level: number): Promise<void> {
  try {
    if (otherGhosts.has(songId) || !(await signedIn())) return;
    otherGhosts.set(songId, null);
    const r = await (sb as any).rpc("pa_pick_ghost", { p_song_id: songId, p_level: level });
    const row = r && r.data && (Array.isArray(r.data) ? r.data[0] : r.data);
    if (row && Array.isArray(row.samples) && row.samples.length > 1) otherGhosts.set(songId, row.samples as Sample[]);
  } catch (e) {}
}
export const ghostFor = (songId: string): Sample[] | null => otherGhosts.get(songId) || null;
