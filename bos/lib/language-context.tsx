"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getStoredLang, setStoredLang, translate, type DictKey, type Lang } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Client-side language state for the static-exported BOS app. Mirrors the
 * theme system: localStorage-backed, read once on mount, no DB round-trip.
 * Defaults to Thai (the studio's working language); English is the explicit
 * opt-in persisted under LANG_STORAGE_KEY.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");

  useEffect(() => {
    const stored = getStoredLang();
    if (stored) setLangState(stored);
    // Reveal the body now that translated text is in its final language — see
    // LANG_INIT_SCRIPT for why the attribute exists. Also covers the case where
    // the script's own 250ms fallback hasn't fired yet.
    document.documentElement.removeAttribute("data-lang-pending");
  }, []);

  const setLang = useCallback((next: Lang) => {
    setStoredLang(next);
    setLangState(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
  }, []);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Never crash the app over missing context (e.g. a page mounted outside
    // the provider) — fall back to Thai and a no-op setter.
    return { lang: "th", setLang: () => {} };
  }
  return ctx;
}

/** Convenience hook: translate a dictionary key in the current language. */
export function useT() {
  const { lang } = useLang();
  return useCallback((key: DictKey) => translate(lang, key), [lang]);
}
