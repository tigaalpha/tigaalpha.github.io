"use client";

import { useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn, describeFunctionError } from "@/lib/utils";

interface TesterMessage {
  role: "customer" | "ai";
  content: string;
}

interface AiChatResponse {
  conversationId: string;
  reply: string;
  needsReview: boolean;
}

export function AiTester({ onReplied }: { onReplied?: () => void }) {
  const [messages, setMessages] = useState<TesterMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "customer", content: text }]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<AiChatResponse>("ai-chat", {
        body: { conversationId: conversationIdRef.current, message: text },
      });
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from ai-chat");

      conversationIdRef.current = data.conversationId;
      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
      onReplied?.();
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary-accent" />
          Try the AI Assistant
        </CardTitle>
        <CardDescription>
          Chat here as if you were a customer — this calls the same AI that answers on LINE and web chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length > 0 ? (
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-line/5 p-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "customer" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "customer" ? "bg-primary-gradient text-white" : "bg-card text-secondary shadow-soft"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}

        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask something a customer might, e.g. 'How much for 20 hours?'"
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
      </CardContent>
    </Card>
  );
}
