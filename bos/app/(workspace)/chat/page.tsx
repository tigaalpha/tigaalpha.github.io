"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Inbox } from "@/features/chat/components/inbox";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Tables<"conversations">[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.conversations.listRecent(50).then(setConversations);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Inbox</h1>
        <p className="text-sm text-secondary/50">AI-handled conversations across LINE and web chat</p>
      </div>
      {conversations ? <Inbox conversations={conversations} /> : <Skeleton className="h-[600px]" />}
    </div>
  );
}
