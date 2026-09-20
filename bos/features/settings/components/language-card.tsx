"use client";

import { Check, Languages } from "lucide-react";
import { useLang } from "@/lib/language-context";
import { translate, type DictKey } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const OPTIONS: { code: "th" | "en"; icon: string; key: DictKey }[] = [
  { code: "th", icon: "🇹🇭", key: "lang.thName" },
  { code: "en", icon: "🇬🇧", key: "lang.enName" },
];

export function LanguageCard() {
  const { lang, setLang } = useLang();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-4 w-4" />
          {translate(lang, "lang.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-secondary/60">{translate(lang, "lang.desc")}</p>
        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map((option) => {
            const active = lang === option.code;
            return (
              <button
                key={option.code}
                onClick={() => setLang(option.code)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                  active
                    ? "border-primary/40 bg-primary/5 text-secondary shadow-soft dark:text-white"
                    : "border-line/10 text-secondary/60 hover:border-line/25 hover:text-secondary dark:border-white/10 dark:text-white/60 dark:hover:border-white/25 dark:hover:text-white"
                )}
              >
                <span className="text-lg" aria-hidden>
                  {option.icon}
                </span>
                <span className="flex-1 text-left">{translate(lang, option.key)}</span>
                {active ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
