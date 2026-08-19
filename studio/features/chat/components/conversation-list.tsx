"use client";

import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConversationWithCustomer } from "@/services/repositories/conversations.repository";

const CHANNEL_LABELS: Record<string, string> = {
  line: "LINE",
  web: "เว็บ",
  messenger: "Messenger",
  internal: "ภายใน",
  phone: "โทรศัพท์",
  walk_in: "หน้าร้าน",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

interface ConversationListProps {
  sections: { label: string; conversations: ConversationWithCustomer[] }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ sections, selectedId, onSelect }: ConversationListProps) {
  const total = sections.reduce((sum, s) => sum + s.conversations.length, 0);

  if (total === 0) {
    return <EmptyState icon={MessagesSquare} title="ไม่พบการสนทนา" description="ลองปรับตัวกรองลูกค้าหรือช่วงเวลา" className="m-4" />;
  }

  return (
    <div>
      {sections.map((section) => (
        <div key={section.label}>
          <p className="sticky top-0 z-10 border-y border-line/5 bg-card/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-secondary/40 backdrop-blur">
            {section.label} · {section.conversations.length}
          </p>
          <ul className="divide-y divide-black/5">
            {section.conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-line/5",
                    selectedId === conversation.id && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-secondary">
                      {conversation.customerName ?? "ลูกค้าไม่ทราบชื่อ"}
                    </span>
                    <span className="shrink-0 text-[11px] text-secondary/40">{formatTime(conversation.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-secondary/50">
                      {CHANNEL_LABELS[conversation.channel] ?? conversation.channel}
                      {conversation.line_user_id ? ` · ${conversation.line_user_id.slice(0, 10)}` : ""}
                    </span>
                    {conversation.needs_review ? <Badge variant="danger">ต้องตรวจ</Badge> : null}
                  </div>
                  {conversation.summary ? <p className="truncate text-xs text-secondary/50">{conversation.summary}</p> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
