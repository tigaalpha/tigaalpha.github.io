"use client";

import { useEffect, useRef, useState } from "react";
import { Send, PenLine, Check } from "lucide-react";
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
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [correctedIds, setCorrectedIds] = useState<Set<string>>(new Set());
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

  function startCorrection(messageId: string) {
    setCorrectingId(messageId);
    setCorrectionDraft("");
  }

  async function saveCorrection(aiMessage: Tables<"messages">) {
    if (!correctionDraft.trim()) return;
    setSavingCorrection(true);

    const index = messages.findIndex((m) => m.id === aiMessage.id);
    const precedingCustomerMessage = [...messages.slice(0, index)].reverse().find((m) => m.sender === "customer");

    const content = [
      precedingCustomerMessage ? `Customer asked: ${precedingCustomerMessage.content}` : null,
      `AI previously replied (incorrect or incomplete): ${aiMessage.content}`,
      `Correct answer: ${correctionDraft.trim()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const supabase = createClient();
    const { error } = await supabase.functions.invoke("knowledge-upload", {
      body: {
        title: `Correction: ${(precedingCustomerMessage?.content ?? aiMessage.content).slice(0, 60)}`,
        sourceType: "correction",
        content,
      },
    });

    setSavingCorrection(false);
    if (!error) {
      setCorrectedIds((prev) => new Set(prev).add(aiMessage.id));
      setCorrectingId(null);
    }
  }

  if (!conversationId) {
    return <EmptyState icon={MessagesSquare} title="Select a conversation" className="m-auto" />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className={cn("flex flex-col", message.sender === "customer" ? "items-start" : "items-end")}>
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

            {message.sender === "ai" ? (
              correctedIds.has(message.id) ? (
                <span className="mt-1 flex items-center gap-1 text-xs text-success">
                  <Check className="h-3 w-3" /> Saved as a correction — the AI will use this going forward
                </span>
              ) : correctingId === message.id ? (
                <div className="mt-1 w-full max-w-[75%] space-y-2 rounded-xl border border-line/10 bg-card p-2">
                  <Textarea
                    value={correctionDraft}
                    onChange={(e) => setCorrectionDraft(e.target.value)}
                    placeholder="What should the AI have said instead?"
                    className="min-h-16 text-sm"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setCorrectingId(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => void saveCorrection(message)} disabled={savingCorrection || !correctionDraft.trim()}>
                      {savingCorrection ? "Saving…" : "Teach AI this correction"}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startCorrection(message.id)}
                  className="mt-1 flex items-center gap-1 text-xs text-secondary/40 hover:text-secondary"
                >
                  <PenLine className="h-3 w-3" /> Correct this reply
                </button>
              )
            ) : null}
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
