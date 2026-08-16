"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

const LINKS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "Inbox" },
  { href: "/students", label: "Students / CRM" },
  { href: "/calendar", label: "Calendar" },
  { href: "/booking", label: "Bookings" },
  { href: "/attendance", label: "ยืนยันการมาเรียน" },
  { href: "/sales", label: "Sales Pipeline" },
  { href: "/knowledge", label: "Knowledge Base" },
  { href: "/accounting", label: "Accounting" },
  { href: "/reports", label: "Reports" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" },
];

export function CommandSearch() {
  const router = useRouter();
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

  const results = LINKS.filter((l) => l.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.04] px-3.5 py-2 transition-colors focus-within:border-purple-400/40 focus-within:bg-white/[0.06]">
        <Search className="h-4 w-4 shrink-0 text-secondary/40" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search anything..."
          className="w-full bg-transparent text-sm text-white placeholder:text-secondary/35 focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-secondary/40 sm:block">
          ⌘K
        </kbd>
      </div>
      {open && query.trim() !== "" ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#12141d] shadow-card">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-secondary/45">No matches</p>
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
                className="flex w-full items-center px-4 py-2.5 text-left text-sm text-secondary/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                {r.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
