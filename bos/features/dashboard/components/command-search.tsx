"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useT, useLang } from "@/lib/language-context";
import { translate, DICT, type DictKey } from "@/lib/i18n";

// Labels are dictionary keys so the picker matches the user's language.
// Matching runs against BOTH languages at once — typing "students" or "นักเรียน"
// finds the same destination regardless of which language is active.
const LINKS: { href: string; labelKey: DictKey }[] = [
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/chat", labelKey: "nav.inbox" },
  { href: "/students", labelKey: "nav.students" },
  { href: "/calendar", labelKey: "nav.calendar" },
  { href: "/booking", labelKey: "nav.bookings" },
  { href: "/attendance", labelKey: "nav.attendance" },
  { href: "/sales", labelKey: "nav.salesPipeline" },
  { href: "/knowledge", labelKey: "nav.knowledgeBase" },
  { href: "/accounting", labelKey: "nav.accounting" },
  { href: "/reports", labelKey: "nav.reports" },
  { href: "/notifications", labelKey: "nav.notifications" },
  { href: "/settings", labelKey: "nav.settings" },
];

function matchesBothLanguages(labelKey: DictKey, query: string): boolean {
  const entry = DICT[labelKey];
  if (!entry) return false;
  return entry.th.toLowerCase().includes(query) || entry.en.toLowerCase().includes(query);
}

export function CommandSearch() {
  const router = useRouter();
  const t = useT();
  const { lang } = useLang();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const queryLower = query.toLowerCase();
  const results = LINKS.filter((l) => matchesBothLanguages(l.labelKey, queryLower));

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-full border border-line/10 bg-line/5 px-3.5 py-2 transition-colors focus-within:border-purple-400/40 focus-within:bg-line/10">
        <Search className="h-4 w-4 shrink-0 text-secondary/40" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("search.placeholder")}
          className="w-full bg-transparent text-sm text-secondary placeholder:text-secondary/35 focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded-md border border-line/15 bg-line/5 px-1.5 py-0.5 text-[10px] font-medium text-secondary/40 sm:block">
          ⌘K
        </kbd>
      </div>
      {open && query.trim() !== "" ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line/10 bg-card shadow-card">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-secondary/45">{t("search.noMatches")}</p>
          ) : (
            results.map((r) => (
              <button
                key={r.href}
                type="button"
                onClick={() => {
                  router.push(r.href);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center px-4 py-2.5 text-left text-sm text-secondary/80 transition-colors hover:bg-line/5 hover:text-secondary"
              >
                {translate(lang, r.labelKey)}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
