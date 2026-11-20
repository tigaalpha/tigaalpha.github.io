"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "bos_hide_figures";
const EVENT = "bos-hide-figures";
export const MASK = "••••••";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** One switch for every money figure and chart; remembered on this device. */
export function useHideFigures(): [boolean, () => void] {
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(KEY, read() ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [hidden, toggle];
}

export function EyeToggle({ className }: { className?: string }) {
  const [hidden, toggle] = useHideFigures();
  const label = hidden ? "แสดงตัวเลข" : "ซ่อนตัวเลข";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={hidden}
      title={label}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line/10 bg-card text-secondary/60 transition-colors hover:bg-line/[0.05] hover:text-secondary dark:border-white/10 dark:hover:bg-white/[0.06]",
        className,
      )}
    >
      {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}

/** Stands in for a chart or table while figures are hidden. */
export function HiddenPanel({ height = 240 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-xl bg-line/[0.04] text-sm text-secondary/40 dark:bg-white/[0.03]"
      style={{ height }}
    >
      <EyeOff className="h-4 w-4" /> ซ่อนตัวเลขอยู่
    </div>
  );
}
