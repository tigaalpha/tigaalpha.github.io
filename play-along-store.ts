/* ── play-along-store.ts ──
   The falling-notes game used to keep its fast-changing numbers (score,
   combo, the lit key, the reading staff, every Perfect/Miss flash, every
   "+300" pop) in React state inside usePlayAlong — and usePlayAlong runs in
   PianoApp, so each of those updates re-rendered the WHOLE app: 129 root
   renders in ten seconds of play, measured, which is what cost the frames
   on a mid-range phone. This is a tiny external store instead: the hook
   writes here, and only the small overlay pieces that subscribe to one
   field re-render when that field changes. PianoApp never hears about it.

   Setters behave like React's (a value, or an updater function), so the
   game code keeps calling setSongHud(...) exactly as before. ── */
import { useSyncExternalStore } from "react";

export function createGameStore(initial) {
  let state = { ...initial };
  const listeners = new Set<() => void>();
  const setters = {};
  function set(key, value) {
    const prev = state[key];
    const next = typeof value === "function" ? value(prev) : value;
    if (Object.is(prev, next)) return;
    state = { ...state, [key]: next };
    listeners.forEach(l => l());
  }
  return {
    get: () => state,
    set,
    setter(key) {
      if (!setters[key]) setters[key] = (v) => set(key, v);
      return setters[key];
    },
    reset(keys) {
      let changed = false;
      const next = { ...state };
      for (const k of keys) if (!Object.is(next[k], initial[k])) { next[k] = initial[k]; changed = true; }
      if (changed) { state = next; listeners.forEach(l => l()); }
    },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

/* One field of the store. Returns the stored reference itself, so an
   unchanged field never re-renders its reader. */
export function useGameField(store, key) {
  return useSyncExternalStore(store.subscribe, () => store.get()[key], () => store.get()[key]);
}
