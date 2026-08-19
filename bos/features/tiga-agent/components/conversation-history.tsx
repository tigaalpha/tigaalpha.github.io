"use client";

import { useEffect, useState } from "react";
import { MessageSquare, ArrowLeft, Clock, User, Bot, ChevronRight } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

/* ── Conversation List View ── */

interface ConversationWithMeta extends Tables<"conversations"> {
  messageCount: number;
  lastMessage: string | null;
}

function ConversationListItem({
  convo,
  onClick,
}: {
  convo: ConversationWithMeta;
  onClick: () => void;
}) {
  const timeDiff = Date.now() - new Date(convo.updated_at).getTime();
  const isRecent = timeDiff < 3600_000;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-line/10 bg-card p-4 hover:bg-line/5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 shrink-0 text-primary-accent" />
            <p className="font-medium text-sm text-secondary truncate">
              {convo.summary || "แชทกับ TIGA AI Agent"}
            </p>
          </div>
          {convo.lastMessage && (
            <p className="mt-1 text-xs text-secondary/50 line-clamp-2">
              {convo.lastMessage}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant={isRecent ? "success" : "outline"} className="text-[10px]">
            {convo.messageCount} ข้อความ
          </Badge>
          <span className="text-[10px] text-secondary/40">
            {new Date(convo.updated_at).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary/20 hidden md:block" />
    </button>
  );
}

/* ── Conversation Detail View ── */

function ConversationDetail({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Tables<"messages">[]>([]);
  const [loading, setLoading] = useState(true);
  const [convo, setConvo] = useState<Tables<"conversations"> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const repos = createRepositories(supabase);

    Promise.all([
      repos.conversations.listMessages(conversationId, 200),
      supabase.from("conversations").select("*").eq("id", conversationId).single(),
    ]).then(([msgs, convoRes]) => {
      setMessages(msgs);
      setConvo(convoRes.data);
      setLoading(false);
    });
  }, [conversationId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-secondary break-words">
            {convo?.summary || "แชทกับ TIGA AI Agent"}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary/40">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {convo && new Date(convo.created_at).toLocaleString("th-TH")}
            </span>
            <span>· {messages.length} ข้อความ</span>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-secondary/40 py-8">ยังไม่มีข้อความ</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    (msg.sender === "customer" || msg.sender === "owner") ? "justify-end" : "justify-start"
                  )}
                >
                  {(msg.sender === "ai") && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-gradient text-white text-xs">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                      (msg.sender === "customer" || msg.sender === "owner")
                        ? "bg-primary-gradient text-white"
                        : "bg-line/5 text-secondary shadow-soft"
                    )}
                  >
                    {msg.content}
                  </div>
                  {(msg.sender === "customer" || msg.sender === "owner") && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-line/10 text-secondary text-xs">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main Component ── */

export function ConversationHistory() {
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const repos = createRepositories(supabase);

    repos.conversations.listInternalConversations(50).then(async (rows) => {
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const msgs = await repos.conversations.listMessages(row.id, 200);
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
          return {
            ...row,
            messageCount: msgs.length,
            lastMessage: lastMsg?.content ?? null,
          };
        })
      );
      setConversations(enriched);
      setLoading(false);
    });
  }, []);

  if (selectedId) {
    return (
      <ConversationDetail
        conversationId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary-accent" />
          ประวัติแชทกับ TIGA AI Agent
        </CardTitle>
        <p className="text-xs text-secondary/50">
          ทุกข้อความที่คุณคุยกับ TIGA AI Agent ผ่าน Floating Assistant จะถูกบันทึกไว้ที่นี่
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="ยังไม่มีประวัติแชท"
            description="เริ่มคุยกับ TIGA AI Agent ผ่านปุ่ม Floating Assistant มุมขวาล่าง แล้วประวัติจะปรากฏที่นี่"
          />
        ) : (
          <div className="space-y-2">
            {conversations.map((convo) => (
              <ConversationListItem
                key={convo.id}
                convo={convo}
                onClick={() => setSelectedId(convo.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
