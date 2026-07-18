"use client";

import { useRef, useState } from "react";
import { Bot, Send, X, Sparkles } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn, describeFunctionError } from "@/lib/utils";

interface AssistantMessage {
  role: "user" | "ai";
  content: string;
}

interface AiChatResponse {
  conversationId: string;
  reply: string;
  needsReview: boolean;
}

/**
 * Owner-facing AI assistant, mounted once in AppShell so it floats on every
 * workspace page. Talks to ai-chat with mode:"owner" — same tools as the
 * customer-facing AI (booking, CRM updates, sales pipeline, knowledge
 * search), just addressed as the studio owner giving direct commands rather
 * than a customer mid-conversation, and on its own conversation channel so
 * it never shows up in the customer Inbox.
 */
export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<AiChatResponse>("ai-chat", {
        body: { conversationId: conversationIdRef.current, message: text, mode: "owner" },
      });
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from ai-chat");

      conversationIdRef.current = data.conversationId;
      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-24 right-6 z-50 flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-line/10 bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-line/5 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-secondary">
              <Sparkles className="h-4 w-4 text-primary-accent" />
              AI ผู้ช่วยเจ้าของร้าน
            </span>
            <button onClick={() => setOpen(false)} aria-label="ปิด">
              <X className="h-4 w-4 text-secondary/60" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <p className="rounded-xl bg-line/5 p-3 text-xs text-secondary/60">
                สั่งงานได้เลย เช่น &quot;เพิ่มลูกค้าใหม่ชื่อ...&quot;, &quot;จองคาบเรียนให้...&quot;,
                &quot;เปลี่ยนสถานะการขายของ...&quot;, หรือถามข้อมูลในคลังความรู้
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user" ? "bg-primary-gradient text-white" : "bg-line/5 text-secondary shadow-soft"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
          </div>

          <div className="flex items-end gap-2 border-t border-line/5 p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="สั่งงาน AI…"
              className="min-h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button size="icon" onClick={() => void send()} disabled={sending || !draft.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="เปิด AI ผู้ช่วย"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-gradient text-white shadow-card transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  );
}
