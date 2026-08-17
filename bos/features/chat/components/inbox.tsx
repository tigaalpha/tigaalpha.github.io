"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

const CHANNEL_LABELS: Record<string, string> = {
  line: "LINE",
  web: "เว็บ",
  messenger: "Messenger",
  internal: "ภายใน",
  phone: "โทรศัพท์",
  walk_in: "หน้าร้าน",
};

export function Inbox({ conversations }: { conversations: Tables<"conversations">[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<string>("all");

  const channels = Array.from(new Set(conversations.map((c) => c.channel)));
  const filtered = conversations.filter((c) => {
    if (channel !== "all" && c.channel !== channel) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (c.summary ?? "").toLowerCase().includes(q) ||
      (c.line_user_id ?? "").toLowerCase().includes(q) ||
      c.id.includes(q)
    );
  });

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border border-line/5 bg-card shadow-soft md:grid-cols-[280px_1fr]">
      <div className="flex flex-col border-r border-line/5">
        <div className="space-y-2 border-b border-line/5 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/40" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา…" className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setChannel("all")}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs transition-colors",
                channel === "all" ? "bg-primary text-white" : "bg-line/5 text-secondary/60 hover:text-secondary"
              )}
            >
              ทั้งหมด
            </button>
            {channels.map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs transition-colors",
                  channel === ch ? "bg-primary text-white" : "bg-line/5 text-secondary/60 hover:text-secondary"
                )}
              >
                {CHANNEL_LABELS[ch] ?? ch}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList conversations={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>
      <MessageThread conversationId={selectedId} />
    </div>
  );
}
