"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

export function MessageThread({ conversationId }: { conversationId: string | null }) {
  const [messages, setMessages] = useState<Tables<"messages">[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setMessages(data ?? []);
      });

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Tables<"messages">])
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendOwnerReply() {
    if (!conversationId || !draft.trim()) return;
    setSending(true);
    const supabase = createClient();
    await supabase.from("messages").insert({ conversation_id: conversationId, sender: "owner", content: draft.trim() });
    setDraft("");
    setSending(false);
  }

  if (!conversationId) {
    return <EmptyState icon={MessagesSquare} title="Select a conversation" className="m-auto" />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex", message.sender === "customer" ? "justify-start" : "justify-end")}
          >
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                message.sender === "customer"
                  ? "bg-line/5 text-secondary"
                  : message.sender === "ai"
                    ? "bg-primary/10 text-secondary"
                    : "bg-primary-gradient text-white"
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-end gap-2 border-t border-line/5 p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply as owner…"
          className="min-h-10"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendOwnerReply();
            }
          }}
        />
        <Button size="icon" onClick={() => void sendOwnerReply()} disabled={sending || !draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
