"use client";

import type { GoogleCalendarConnectionSummary } from "@/services/repositories/google-calendar-connections.repository";
import { cn } from "@/lib/utils";

interface GoogleCalendarFilterProps {
  connections: GoogleCalendarConnectionSummary[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

/** Checkbox filter for viewing 1, 2, or all 3 connected Google Calendar accounts at once. */
export function GoogleCalendarFilter({ connections, selectedIds, onToggle }: GoogleCalendarFilterProps) {
  if (connections.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-card p-3">
      <span className="text-xs font-medium text-secondary/50">ปฏิทิน:</span>
      {connections.map((c) => {
        const active = selectedIds.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active ? "border-transparent text-white" : "border-line/10 text-secondary/50"
            )}
            style={active ? { backgroundColor: c.color } : undefined}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? "#ffffff" : c.color }} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
