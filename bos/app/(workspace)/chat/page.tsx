"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Inbox } from "@/features/chat/components/inbox";
import { UnansweredQuestions } from "@/features/chat/components/unanswered-questions";
import { AiTester } from "@/features/chat/components/ai-tester";
import { AiOutbox } from "@/features/chat/components/ai-outbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Tab = "all" | "unanswered" | "outbox";

export default function ChatPage() {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "outbox") return "outbox";
    }
    return "all";
  });
  const [conversations, setConversations] = useState<Tables<"conversations">[] | null>(null);
  const [unanswered, setUnanswered] = useState<Tables<"conversations">[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const reload = useCallback(() => {
    const supabase = createClient();
    const repos = createRepositories(supabase);
    repos.conversations.listRecent(50).then(setConversations);
    repos.conversations.listNeedingReview().then((rows) => setUnanswered(rows.filter((c) => c.channel !== "internal")));
    supabase
      .from("ai_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Inbox</h1>
        <p className="text-sm text-secondary/50">AI-handled conversations across LINE and web chat</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab("all")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "all" ? "bg-primary-gradient text-white" : "bg-line/5 text-secondary/70 hover:text-secondary"
          )}
        >
          กล่องข้อความ
        </button>
        <button
          onClick={() => setTab("unanswered")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "unanswered" ? "bg-primary-gradient text-white" : "bg-line/5 text-secondary/70 hover:text-secondary"
          )}
        >
          คำถามที่ตอบไม่ได้
          {unanswered && unanswered.length > 0 ? (
            <Badge variant={tab === "unanswered" ? "outline" : "danger"} className={tab === "unanswered" ? "border-white/40 text-white" : ""}>
              {unanswered.length}
            </Badge>
          ) : null}
        </button>
        <button
          onClick={() => setTab("outbox")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "outbox" ? "bg-primary-gradient text-white" : "bg-line/5 text-secondary/70 hover:text-secondary"
          )}
        >
          AI Outbox (รอตรวจ)
          {pendingCount > 0 ? (
            <Badge variant={tab === "outbox" ? "outline" : "danger"} className={tab === "outbox" ? "border-white/40 text-white" : ""}>
              {pendingCount}
            </Badge>
          ) : null}
        </button>
      </div>

      {tab === "all" ? (
        <>
          <AiTester onReplied={reload} />
          {conversations ? <Inbox conversations={conversations} /> : <Skeleton className="h-[600px]" />}
        </>
      ) : tab === "outbox" ? (
        <AiOutbox />
      ) : unanswered ? (
        <UnansweredQuestions conversations={unanswered} onResolved={reload} />
      ) : (
        <Skeleton className="h-[600px]" />
      )}
    </div>
  );
}
