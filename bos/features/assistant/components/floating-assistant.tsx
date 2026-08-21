"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bot, Send, X, Sparkles, Loader2, ClipboardList } from "lucide-react";
import { ExecutionPlan, parsePlanFromText, type PlanStep } from "./execution-plan";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn, describeFunctionError } from "@/lib/utils";
import { CHAT_MODELS, DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models";

interface AssistantMessage {
  role: "user" | "ai";
  content: string;
}

interface AiChatResponse {
  conversationId: string;
  reply: string;
  needsReview: boolean;
}

interface QuickAction {
  label: string;
  text: string;
  sendImmediately: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "🎯 งานวันนี้", text: "แนะนำ 3 งานที่ควรทำวันนี้ เรียงตามคุณค่ามากไปหาน้อย ง่ายไปหายาก", sendImmediately: true },
  { label: "📊 สรุปวันนี้", text: "สรุปภาพรวมธุรกิจวันนี้ให้หน่อย", sendImmediately: true },
  { label: "👥 นักเรียนทั้งหมด", text: "ดูรายชื่อนักเรียนทั้งหมดหน่อย", sendImmediately: true },
  { label: "📅 คาบเรียนวันนี้", text: "ดูคาบเรียนวันนี้มีอะไรบ้าง", sendImmediately: true },
  { label: "💰 รายรับเดือนนี้", text: "ดูสรุปการเงินเดือนนี้หน่อย", sendImmediately: true },
  { label: "📝 สร้าง Content", text: "สร้าง content ใหม่สัก 1 ชิ้น", sendImmediately: true },
  { label: "🧠 วางแผน", text: "วางแผนสร้างนักเรียนใหม่ + จองคาบ + สร้าง content", sendImmediately: true },
  { label: "🎯 Lead ที่ควรติดตาม", text: "มี lead คนไหนที่ควรติดตามตอนนี้บ้าง", sendImmediately: true },
  { label: "🎬 Video Package", text: "สร้าง Video Package ครบชุด: script + voice + images", sendImmediately: true },
  { label: "🔄 Repurpose Content", text: "แปลง content นี้เป็นทุก platform", sendImmediately: false },
  { label: "📈 Marketing Dashboard", text: "ดูสรุปการตลาดสัปดาห์นี้", sendImmediately: true },
  { label: "เพิ่มความรู้", text: "เพิ่มความรู้ใหม่: ", sendImmediately: false },
];

/**
 * TIGA AI AGENT — owner-facing AI assistant, mounted once in AppShell so it
 * floats on every workspace page. Talks to ai-chat with mode:"owner".
 */
export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL_ID);
  const [savingModel, setSavingModel] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Plan mode state
  const [currentPlan, setCurrentPlan] = useState<PlanStep[] | null>(null);
  const [executingPlan, setExecutingPlan] = useState(false);
  const [currentPlanStep, setCurrentPlanStep] = useState<number | undefined>(undefined);
  const [showPlanHint, setShowPlanHint] = useState(false);

  // Restore conversationId from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tiga-fab-conversation-id");
      if (saved) conversationIdRef.current = saved;
    } catch {}
  }, []);

  // Load previous messages when opened
  useEffect(() => {
    if (!open) return;
    const repos = createRepositories(createClient());
    repos.integrations.get("ai_chat_model").then((v) => setChatModel(v ?? DEFAULT_CHAT_MODEL_ID));

    if (conversationIdRef.current && messages.length === 0) {
      setLoadingHistory(true);
      repos.conversations
        .listMessages(conversationIdRef.current, 50)
        .then((dbMsgs) => {
          if (dbMsgs.length > 0) {
            setMessages(
              dbMsgs.map((m) => ({
                role: (m.sender === "customer" || m.sender === "owner") ? "user" as const : "ai" as const,
                content: m.content,
              }))
            );
          }
        })
        .finally(() => setLoadingHistory(false));
    }
  }, [open]);

  function handleQuickAction(action: QuickAction) {
    if (action.sendImmediately) {
      void send(action.text);
      return;
    }
    setDraft(action.text);
    textareaRef.current?.focus();
  }

  function startNewConversation() {
    setMessages([]);
    conversationIdRef.current = null;
    setCurrentPlan(null);
    setExecutingPlan(false);
    setCurrentPlanStep(undefined);
    try { localStorage.removeItem("tiga-fab-conversation-id"); } catch {}
  }

  function handleApprovePlan() {
    if (!currentPlan) return;
    setExecutingPlan(true);
    setShowPlanHint(false);
    // Execute plan by sending approval message
    void send("ทำเลย อนุมัติแผนทั้งหมด");
  }

  function handleRejectPlan() {
    setCurrentPlan(null);
    setShowPlanHint(false);
    setMessages((prev) => [...prev, { role: "user", content: "ยกเลิกแผน" }, { role: "ai", content: "ยกเลิกแผนแล้วครับ 🔄 พิมพ์คำสั่งใหม่ได้เลย" }]);
  }

  async function changeChatModel(value: string) {
    setChatModel(value);
    setSavingModel(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("ai_chat_model", value);
    setSavingModel(false);
  }

  const send = useCallback(async (override?: string) => {
    const text = (override ?? draft).trim();
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
      try { localStorage.setItem("tiga-fab-conversation-id", data.conversationId); } catch {}

      // Check if the reply contains a plan
      const planSteps = parsePlanFromText(data.reply);
      if (planSteps && planSteps.length > 0) {
        setCurrentPlan(planSteps);
        setShowPlanHint(true);
        // Show the reply text but also the plan card
        setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
      }
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setSending(false);
    }
  }, [draft, sending]);

  return (
    <>
      {open ? (
        <div className="fixed bottom-24 right-6 z-50 flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-line/10 bg-card shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-line/5 px-4 py-3">
            <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-secondary">
              <Sparkles className="h-4 w-4 text-primary-accent" />
              TIGA AI AGENT
            </span>
            <select
              value={chatModel}
              onChange={(e) => void changeChatModel(e.target.value)}
              disabled={savingModel}
              aria-label="เลือกโมเดล AI"
              title="กำลังคุยกับโมเดล AI นี้อยู่ — เปลี่ยนได้ที่นี่"
              className="min-w-0 flex-1 truncate rounded-lg border border-line/10 bg-line/5 px-2 py-1 text-xs text-secondary/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {CHAT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              onClick={startNewConversation}
              aria-label="แชทใหม่"
              className="shrink-0 rounded-lg bg-line/10 px-2 py-1 text-[10px] text-secondary/60 hover:bg-line/20 transition-colors"
            >
              ใหม่
            </button>
            <button onClick={() => setOpen(false)} aria-label="ปิด TIGA AI Agent" className="shrink-0">
              <X className="h-4 w-4 text-secondary/60" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary-accent" />
              </div>
            ) : null}
            {messages.length === 0 && !loadingHistory ? (
              <div className="space-y-2">
                <p className="rounded-xl bg-line/5 p-3 text-xs text-secondary/60">
                  🎯 กด &quot;งานวันนี้&quot; เพื่อดู 3 งานสำคัญสุด หรือสั่งงานได้เลย เช่น &quot;สร้าง TikTok Script&quot;, &quot;สร้าง Video Package&quot;,
                  &quot;วิเคราะห์เทรนด์&quot;, &quot;repurpose content&quot; หรือถามข้อมูลในคลังความรู้
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action)}
                      className="rounded-full border border-line/10 bg-line/5 px-3 py-1 text-xs text-secondary/70 hover:bg-line/10"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
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
            {/* Execution Plan Card */}
            {currentPlan && showPlanHint && !executingPlan && (
              <ExecutionPlan
                steps={currentPlan}
                onApprove={handleApprovePlan}
                onReject={handleRejectPlan}
                executing={false}
              />
            )}
            {currentPlan && executingPlan && (
              <ExecutionPlan
                steps={currentPlan}
                onApprove={() => {}}
                onReject={() => {}}
                executing={true}
                currentStep={currentPlanStep}
              />
            )}
            {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
          </div>

          <div className="flex items-end gap-2 border-t border-line/5 p-3">
            <Textarea
              ref={textareaRef}
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
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="เปิด TIGA AI Agent"
        className={cn(
          "fixed right-6 z-50 h-14 w-14 items-center justify-center rounded-full bg-primary-gradient text-white shadow-card transition-transform hover:scale-105",
          "bottom-[4.75rem] md:bottom-6",
          open ? "hidden md:flex" : "flex"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  );
}
