"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Sparkles, ThumbsDown } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

type KbDraft = Tables<"kb_drafts">;

export function KbDraftsSection() {
  const [drafts, setDrafts] = useState<KbDraft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    createRepositories(createClient())
      .aiOps.listKbDrafts()
      .then(setDrafts)
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function decide(draft: KbDraft, action: "approve" | "reject") {
    setBusy(draft.id);
    setError(null);
    try {
      const { error: fnError } = await createClient().functions.invoke("kb-draft-action", {
        body: { draftId: draft.id, action },
      });
      if (fnError) {
        setError(await describeFunctionError(fnError));
        return;
      }
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "จัดการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  const pending = (drafts ?? []).filter((d) => d.status === "pending");
  const history = (drafts ?? []).filter((d) => d.status !== "pending");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary-accent" />
          AI เรียนรู้เอง — คำถามที่ตอบไม่ได้/ถามซ้ำ
          <Badge variant={pending.length > 0 ? "warning" : "outline"}>{pending.length ?? "…"}</Badge>
        </CardTitle>
        <CardDescription>
          AI ร่างคำตอบจากแชทจริงที่ติดขัด — อนุมัติ 1 คลิกแล้วคำตอบนั้นเข้าสู่ Knowledge Base ให้ AI ใช้ตอบครั้งต่อไปได้เลย
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p> : null}
        {drafts === null ? (
          <Skeleton className="h-24" />
        ) : pending.length === 0 && history.length === 0 ? (
          <EmptyState icon={Sparkles} title="ยังไม่มี draft" description="เมื่อ AI เจอคำถามที่ตอบไม่ได้ จะมาขึ้นร่างให้อนุมัติที่นี่" />
        ) : (
          <>
            {pending.map((d) => (
              <div key={d.id} className="rounded-xl border border-line/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-secondary">{d.question}</p>
                    <p className="mt-1 text-sm text-secondary/70">{d.draft_answer}</p>
                    <p className="mt-1 text-xs text-secondary/40">{new Date(d.created_at).toLocaleString("th-TH")}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button size="sm" onClick={() => decide(d, "approve")} disabled={busy === d.id}>
                      <Check className="h-4 w-4" />
                      อนุมัติเข้า KB
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decide(d, "reject")} disabled={busy === d.id}>
                      <ThumbsDown className="h-4 w-4" />
                      ปัดทิ้ง
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {history.length > 0 ? (
              <div className="pt-2">
                <p className="mb-2 text-xs text-secondary/50">ประวัติ</p>
                <ul className="space-y-1.5 text-xs text-secondary/60">
                  {history.slice(0, 8).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{d.question}</span>
                      <Badge variant={d.status === "approved" ? "success" : "outline"}>{d.status === "approved" ? "เข้า KB แล้ว" : "ปัดทิ้ง"}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
