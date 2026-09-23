"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { useLang } from "@/lib/language-context";
import { translate } from "@/lib/i18n";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const { lang } = useLang();

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored ?? (document.documentElement.classList.contains("dark") ? "dark" : "light"));
  }, []);

  if (theme === null) {
    return <div className="h-9 w-9" aria-hidden />;
  }

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary/70 hover:bg-line/5 dark:text-white/70 dark:hover:bg-white/5"
      aria-label={translate(lang, theme === "dark" ? "theme.toLight" : "theme.toDark")}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
