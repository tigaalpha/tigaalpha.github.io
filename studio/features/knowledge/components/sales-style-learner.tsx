"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, Check, Sparkles, MessageSquareText } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { describeFunctionError } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/types/database";

interface ChatTurn {
  speaker: "customer" | "owner";
  text: string;
}

interface Draft {
  id: string;
  fileName: string;
  status: "extracting" | "ready" | "error" | "saving";
  turns: ChatTurn[];
  error?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface SalesStyleLearnerProps {
  examples: Tables<"sales_chat_examples">[];
  onChanged: () => void;
}

export function SalesStyleLearner({ examples, onChanged }: SalesStyleLearnerProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [playbook, setPlaybook] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);

    for (const file of files) {
      const draftId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setDrafts((prev) => [...prev, { id: draftId, fileName: file.name, status: "extracting", turns: [] }]);

      try {
        const imageBase64 = await blobToBase64(file);
        const supabase = createClient();
        const { data, error: fnError } = await supabase.functions.invoke<{ turns: ChatTurn[] } | { error: string }>(
          "extract-chat-screenshot",
          { body: { imageBase64, mimeType: file.type || "image/png" } }
        );
        if (fnError || !data || "error" in data) {
          const message = data && "error" in data ? data.error : await describeFunctionError(fnError);
          setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, status: "error", error: message } : d)));
          continue;
        }
        setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, status: "ready", turns: data.turns } : d)));
      } catch (err) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? { ...d, status: "error", error: err instanceof Error ? err.message : "ล้มเหลว" } : d))
        );
      }
    }
  }

  function updateTurn(draftId: string, index: number, patch: Partial<ChatTurn>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === draftId ? { ...d, turns: d.turns.map((t, i) => (i === index ? { ...t, ...patch } : t)) } : d))
    );
  }

  function removeTurn(draftId: string, index: number) {
    setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, turns: d.turns.filter((_, i) => i !== index) } : d)));
  }

  function discardDraft(draftId: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  }

  async function confirmDraft(draft: Draft) {
    if (draft.turns.length === 0) return;
    setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, status: "saving" } : d)));
    try {
      const repos = createRepositories(createClient());
      await repos.salesChatExamples.confirm(draft.turns);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      onChanged();
    } catch (err) {
      setDrafts((prev) =>
        prev.map((d) => (d.id === draft.id ? { ...d, status: "ready", error: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ" } : d))
      );
    }
  }

  async function deleteExample(id: string) {
    const repos = createRepositories(createClient());
    await repos.salesChatExamples.delete(id);
    onChanged();
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    setPlaybook(null);
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ playbook: string; exampleCount: number } | { error: string }>(
        "analyze-sales-style"
      );
      if (fnError || !data || "error" in data) {
        throw new Error(data && "error" in data ? data.error : await describeFunctionError(fnError));
      }
      setPlaybook(data.playbook);
    } catch (err) {
      setError(err instanceof Error ? err.message : "วิเคราะห์ไม่สำเร็จ");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI เรียนรู้สไตล์การขายจากแชทเก่า</CardTitle>
        <CardDescription>
          แคปแชทที่คุยกับลูกค้าเก่าที่ปิดการขายสำเร็จ อัปโหลดเข้ามา AI จะแกะบทสนทนาให้ตรวจสอบก่อนบันทึก แล้วสรุปเป็น &quot;สไตล์การขายของคุณ&quot;
          ให้ AI ฝ่ายขายใช้ทุกครั้งที่คุยกับลูกค้า — ชื่อ/เบอร์โทรลูกค้าเก่าจะถูกลบออกก่อนบันทึกเสมอ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          อัปโหลดภาพแคปแชท (เลือกหลายภาพพร้อมกันได้)
        </Button>

        {drafts.length > 0 ? (
          <div className="space-y-3">
            {drafts.map((draft) => (
              <div key={draft.id} className="rounded-xl border border-line/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-secondary">{draft.fileName}</p>
                  <Badge variant={draft.status === "error" ? "danger" : draft.status === "ready" ? "outline" : "outline"}>
                    {draft.status === "extracting"
                      ? "กำลังอ่านภาพ…"
                      : draft.status === "saving"
                        ? "กำลังบันทึก…"
                        : draft.status === "error"
                          ? "ผิดพลาด"
                          : `${draft.turns.length} ข้อความ`}
                  </Badge>
                </div>
                {draft.error ? <p className="mb-2 text-xs text-danger">{draft.error}</p> : null}
                {draft.status === "ready" || draft.status === "saving" ? (
                  <div className="space-y-2">
                    {draft.turns.map((turn, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <select
                          value={turn.speaker}
                          onChange={(e) => updateTurn(draft.id, i, { speaker: e.target.value as ChatTurn["speaker"] })}
                          className="h-9 shrink-0 rounded-lg border border-line/10 bg-card px-2 text-xs text-secondary"
                        >
                          <option value="customer">ลูกค้า</option>
                          <option value="owner">เจ้าของ</option>
                        </select>
                        <Input value={turn.text} onChange={(e) => updateTurn(draft.id, i, { text: e.target.value })} className="flex-1" />
                        <Button variant="ghost" size="icon" onClick={() => removeTurn(draft.id, i)}>
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => discardDraft(draft.id)}>
                        ลบทิ้ง
                      </Button>
                      <Button size="sm" onClick={() => void confirmDraft(draft)} disabled={draft.status === "saving"}>
                        <Check className="h-3.5 w-3.5" />
                        ยืนยันและบันทึก
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="border-t border-line/10 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-secondary">ตัวอย่างที่ยืนยันแล้ว ({examples.length})</p>
            <Button size="sm" onClick={() => void analyze()} disabled={analyzing || examples.length === 0}>
              <Sparkles className="h-3.5 w-3.5" />
              {analyzing ? "กำลังวิเคราะห์…" : "วิเคราะห์อีกครั้ง"}
            </Button>
          </div>
          {examples.length === 0 ? (
            <EmptyState icon={MessageSquareText} title="ยังไม่มีตัวอย่างที่ยืนยัน" description="อัปโหลดและยืนยันภาพแชทด้านบนก่อน" />
          ) : (
            <ul className="space-y-1">
              {examples.map((example) => (
                <li key={example.id} className="flex items-center justify-between gap-2 rounded-lg bg-line/5 px-3 py-2 text-sm">
                  <span className="text-secondary/70">{(example.extracted_turns as ChatTurn[]).length} ข้อความ</span>
                  <Button variant="ghost" size="icon" onClick={() => void deleteExample(example.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {playbook ? (
            <div className="mt-3 rounded-xl bg-success/10 p-3 text-sm text-secondary">
              <p className="mb-1 font-medium text-success">วิเคราะห์เสร็จแล้ว — AI ฝ่ายขายจะใช้สไตล์นี้ตั้งแต่ตอนนี้</p>
              <p className="whitespace-pre-wrap text-xs text-secondary/70">{playbook}</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
