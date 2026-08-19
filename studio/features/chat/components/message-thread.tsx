"use client";

import { useEffect, useRef, useState } from "react";
import { Send, PenLine, Check, Sparkles, Loader2 } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { MessagesSquare } from "lucide-react";
import { cn, describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

export function MessageThread({ conversationId, conversationName, conversationChannel, onBack }: { conversationId: string | null; conversationName?: string | null; conversationChannel?: string | null; onBack?: () => void }) {
  const [messages, setMessages] = useState<Tables<"messages">[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [correctedIds, setCorrectedIds] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
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
    // send-staff-reply both delivers to the customer (a real LINE push for
    // LINE conversations -- inserting the row alone never reached them) and
    // inserts the message row; the Realtime subscription above then picks
    // up that insert and renders it here, same as any other new message.
    const { error } = await supabase.functions.invoke("send-staff-reply", { body: { conversationId, content: draft.trim() } });
    if (!error) setDraft("");
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

  async function loadSuggestions() {
    if (!conversationId) return;
    setLoadingSuggestions(true);
    setSuggestions(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("chat-suggest-replies", { body: { conversationId } });
      if (error) throw error;
      setSuggestions(data?.suggestions ?? []);
    } catch (err) {
      setSuggestions([]);
      console.error("suggest-replies failed", await describeFunctionError(err));
    } finally {
      setLoadingSuggestions(false);
    }
  }

  const lastMessage = messages[messages.length - 1];
  const canSuggest = conversationId && lastMessage?.sender === "customer" && !loadingSuggestions;

  if (!conversationId) {
    return <EmptyState icon={MessagesSquare} title="เลือกการสนทนา" description="คลิกการสนทนาทางด้านซ้ายเพื่อดูรายละเอียด" className="m-auto" />;
  }

  const CHANNEL_LABELS: Record<string, string> = { line: "LINE", web: "เว็บ", messenger: "Messenger", internal: "ภายใน", phone: "โทรศัพท์", walk_in: "หน้าร้าน" };

  return (
    <div className="flex h-full flex-col">
      {/* Conversation header */}
      <div className="flex items-center gap-3 border-b border-line/5 px-4 py-3">
        {onBack ? (
          <button onClick={onBack} className="rounded-lg p-1.5 text-secondary/60 hover:bg-line/10 hover:text-secondary lg:hidden">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
        ) : null}
        <div className="flex-1">
          <p className="text-sm font-medium text-secondary">{conversationName || "ลูกค้าไม่ทราบชื่อ"}</p>
          <p className="text-xs text-secondary/50">{CHANNEL_LABELS[conversationChannel ?? ""] ?? conversationChannel ?? ""}</p>
        </div>
      </div>
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

      {(suggestions && suggestions.length > 0) || loadingSuggestions ? (
        <div className="border-t border-line/5 p-3">
          <p className="mb-2 flex items-center gap-1 text-xs text-secondary/50">
            <Sparkles className="h-3 w-3 text-primary" /> คำตอบสำเร็จรูปจาก AI (กดเพื่อเติมในช่องพิมพ์)
          </p>
          {loadingSuggestions ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(suggestions ?? []).map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDraft(s);
                    setSuggestions(null);
                  }}
                  className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs text-secondary transition-colors hover:bg-primary/10"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex items-end gap-2 border-t border-line/5 p-3">
        {canSuggest ? (
          <Button variant="outline" size="icon" title="AI ร่างคำตอบสำเร็จรูป 3 แบบ" onClick={() => void loadSuggestions()} disabled={loadingSuggestions}>
            <Sparkles className="h-4 w-4" />
          </Button>
        ) : null}
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
