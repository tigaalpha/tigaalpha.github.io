"use client";

import { useEffect, useState } from "react";
import { HelpCircle, GraduationCap, Send } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface UnansweredQuestionsProps {
  conversations: Tables<"conversations">[];
  onResolved: () => void;
}

/**
 * Distinct from the per-message "Correct this reply" flow in MessageThread
 * (which fixes one specific bad reply inside a conversation) -- this is a
 * triage view: every conversation the AI flagged needs_review (escalated,
 * or exhausted its tool-call budget without a confident answer), so the
 * owner can teach the AI without hunting through the full Inbox one
 * conversation at a time.
 */
export function UnansweredQuestions({ conversations, onResolved }: UnansweredQuestionsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [question, setQuestion] = useState<string | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setQuestion(null);
      return;
    }
    setLoadingQuestion(true);
    setAnswer("");
    setError(null);
    const repos = createRepositories(createClient());
    repos.conversations.listMessages(selectedId).then((messages) => {
      const lastCustomerMessage = [...messages].reverse().find((m) => m.sender === "customer");
      setQuestion(lastCustomerMessage?.content ?? null);
      setLoadingQuestion(false);
    });
  }, [selectedId]);

  async function handleTeach() {
    if (!selectedId || !answer.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const repos = createRepositories(supabase);
      const content = [question ? `Customer asked: ${question}` : null, `Correct answer: ${answer.trim()}`].filter(Boolean).join("\n");
      const { error: fnError } = await supabase.functions.invoke("knowledge-upload", {
        body: { title: `Correction: ${(question ?? "Unanswered question").slice(0, 60)}`, sourceType: "correction", content },
      });
      if (fnError) throw fnError;

      await repos.conversations.setNeedsReview(selectedId, false);
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (conversations.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-2xl border border-line/5 bg-card shadow-soft">
        <EmptyState icon={HelpCircle} title="ไม่มีคำถามที่ตอบไม่ได้" description="ตอนนี้ AI ตอบคำถามลูกค้าได้ครบทุกรายการแล้ว" />
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border border-line/5 bg-card shadow-soft md:grid-cols-[280px_1fr]">
      <div className="overflow-y-auto border-r border-line/5">
        <ul className="divide-y divide-black/5">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                onClick={() => setSelectedId(conversation.id)}
                className={cn(
                  "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-line/5",
                  selectedId === conversation.id && "bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-secondary">
                    {conversation.channel.toUpperCase()} · {conversation.line_user_id?.slice(0, 10) ?? conversation.id.slice(0, 8)}
                  </span>
                  <Badge variant="danger">ตอบไม่ได้</Badge>
                </div>
                {conversation.summary ? <p className="truncate text-xs text-secondary/50">{conversation.summary}</p> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col p-4">
        <div className="flex items-center gap-2 border-b border-line/5 pb-3">
          <GraduationCap className="h-4 w-4 text-primary-accent" />
          <p className="text-sm font-semibold text-secondary">สอนคำตอบให้ AI</p>
        </div>

        {loadingQuestion ? (
          <p className="pt-4 text-sm text-secondary/50">กำลังโหลด…</p>
        ) : (
          <div className="flex-1 space-y-4 pt-4">
            <div>
              <label className="text-xs font-medium text-secondary/60">คำถามจากลูกค้า</label>
              <p className="mt-1 rounded-xl bg-line/5 p-3 text-sm text-secondary">{question ?? "ไม่พบคำถามในบทสนทนานี้"}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-secondary/60">คำตอบที่ถูกต้อง</label>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="พิมพ์คำตอบที่ถูกต้อง — จะถูกบันทึกเข้า Knowledge Base ให้ AI ใช้ตอบครั้งต่อไป"
                className="mt-1 min-h-32"
              />
            </div>
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <Button onClick={() => void handleTeach()} disabled={saving || !answer.trim()}>
              <Send className="h-4 w-4" />
              {saving ? "กำลังบันทึก…" : "บันทึกคำตอบและทำเครื่องหมายว่าแก้ไขแล้ว"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
