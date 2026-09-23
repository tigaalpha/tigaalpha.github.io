"use client";

import { Languages } from "lucide-react";
import { useLang } from "@/lib/language-context";

/**
 * Topbar TH⇄EN switch. Shows the CURRENT language (the label is what you're
 * reading now, not what you'd switch to — the old target-label behaviour read
 * backwards next to English page content). Tap to swap.
 */
export function LanguageToggle() {
  const { lang, setLang } = useLang();

  return (
    <button
      onClick={() => setLang(lang === "th" ? "en" : "th")}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-[11px] font-bold tracking-wide text-secondary/70 transition-colors hover:bg-line/5 hover:text-secondary sm:px-2 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
      aria-label={lang === "th" ? "Switch to English" : "สลับเป็นภาษาไทย"}
      title={lang === "th" ? "Switch to English" : "สลับเป็นภาษาไทย"}
    >
      <Languages className="h-4 w-4" />
      <span>{lang === "th" ? "TH" : "EN"}</span>
    </button>
  );
}
