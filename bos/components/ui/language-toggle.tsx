"use client";

import { Languages } from "lucide-react";
import { useLang } from "@/lib/language-context";

/** Topbar TH⇄EN switch: shows the language you'd switch TO, mirroring ThemeToggle's icon-means-target pattern. */
export function LanguageToggle() {
  const { lang, setLang } = useLang();
  const next = lang === "th" ? "en" : "th";

  return (
    <button
      onClick={() => setLang(next)}
      className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold tracking-wide text-secondary/70 transition-colors hover:bg-line/5 hover:text-secondary dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
      aria-label={lang === "th" ? "Switch to English" : "สลับเป็นภาษาไทย"}
      title={lang === "th" ? "Switch to English" : "สลับเป็นภาษาไทย"}
    >
      <Languages className="h-4 w-4" />
      <span>{lang === "th" ? "EN" : "TH"}</span>
    </button>
  );
}
