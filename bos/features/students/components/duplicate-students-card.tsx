"use client";

import { useEffect, useState } from "react";
import { CopyX, Merge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DuplicatePair {
  keepId: string;
  keepName: string;
  dupId: string;
  dupName: string;
  matchField: "phone" | "name";
}

async function withAuth(): Promise<string> {
  const { createClient } = await import("@/services/supabase/client");
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.access_token;
}

export function DuplicateStudentsCard({ onMerged }: { onMerged: () => void }) {
  const [pairs, setPairs] = useState<DuplicatePair[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const token = await withAuth();
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/merge-customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setPairs([]);
        return;
      }
      const data = await response.json();
      setPairs(data.pairs ?? []);
    } catch {
      setPairs([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (pairs === null || pairs.length === 0) return null;

  async function merge(pair: DuplicatePair) {
    if (!window.confirm(`รวม "${pair.dupName}" เข้ากับ "${pair.keepName}"? ข้อมูลของ ${pair.dupName} (คอร์ส, การจอง, ประวัติ) จะย้ายไปอยู่กับ ${pair.keepName} แล้วลบรายการซ้ำ`)) return;
    setBusy(pair.dupId);
    setError(null);
    try {
      const token = await withAuth();
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/merge-customers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ keepId: pair.keepId, duplicateId: pair.dupId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "รวมไม่สำเร็จ");
        return;
      }
      setPairs((prev) => (prev ?? []).filter((p) => p.dupId !== pair.dupId && p.keepId !== pair.dupId));
      onMerged();
    } catch {
      setError("รวมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-warning/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <CopyX className="h-4 w-4" />
          พบนักเรียนซ้ำ
        </CardTitle>
        <CardDescription>คนเดียวกันลงทะเบียน 2 ครั้ง — รวมเข้าด้วยกันเพื่อให้ตัวเลข CRM ไม่เพี้ยน (ข้อมูลเก่าที่สุดจะถูกเก็บไว้)</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <div className="space-y-2">
          {pairs.map((pair) => (
            <div key={`${pair.keepId}:${pair.dupId}`} className="flex flex-col gap-2 rounded-xl border border-line/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-secondary">
                <span className="font-semibold">{pair.keepName}</span>
                <span className="mx-2 text-secondary/40">↔</span>
                <span>{pair.dupName}</span>
                <Badge variant="outline" className="ml-2 normal-case">
                  {pair.matchField === "phone" ? "เบอร์โทรซ้ำ" : "ชื่อซ้ำ"}
                </Badge>
              </div>
              <Button size="sm" variant="outline" onClick={() => merge(pair)} disabled={busy === pair.dupId}>
                <Merge className="h-3 w-3" />
                {busy === pair.dupId ? "กำลังรวม…" : "รวมเข้าด้วยกัน"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
