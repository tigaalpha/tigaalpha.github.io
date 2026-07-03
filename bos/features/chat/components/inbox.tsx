"use client";

import { useState } from "react";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";
import type { Tables } from "@/types/database";

export function Inbox({ conversations }: { conversations: Tables<"conversations">[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft md:grid-cols-[280px_1fr]">
      <div className="hidden overflow-y-auto border-r border-black/5 md:block">
        <ConversationList conversations={conversations} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <MessageThread conversationId={selectedId} />
    </div>
  );
}
