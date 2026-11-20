"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "bos_hide_figures:";
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

function read(id: string): boolean {
  try {
    return window.localStorage.getItem(KEY + id) === "1";
  } catch {
    return false;
  }
}

/** A hide switch per card (its own `id`), remembered on this device. */
export function useHideFigures(id: string): [boolean, () => void] {
  const hidden = useSyncExternalStore(subscribe, () => read(id), () => false);
  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(KEY + id, read(id) ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, [id]);
  return [hidden, toggle];
}

export function EyeToggle({ id, className, small }: { id: string; className?: string; small?: boolean }) {
  const [hidden, toggle] = useHideFigures(id);
  const label = hidden ? "แสดงตัวเลข" : "ซ่อนตัวเลข";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      aria-label={label}
      aria-pressed={hidden}
      title={label}
      className={cn(
        small ? "h-8 w-8" : "h-10 w-10",
        "flex shrink-0 items-center justify-center rounded-full border border-line/10 bg-card text-secondary/60 transition-colors hover:bg-line/[0.05] hover:text-secondary dark:border-white/10 dark:hover:bg-white/[0.06]",
        className,
      )}
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
