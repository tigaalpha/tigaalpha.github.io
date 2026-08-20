"use client";

import { useCallback, useEffect, useState } from "react";
import { BookMarked, Plus, Trash2, Power, PowerOff } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

type Policy = Tables<"company_policies">;

export function PoliciesSection() {
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    createRepositories(createClient())
      .aiOps.listPolicies()
      .then(setPolicies)
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function addPolicy() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createRepositories(createClient()).aiOps.createPolicy({ title: title.trim(), content: content.trim() });
      setTitle("");
      setContent("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(policy: Policy) {
    setBusyId(policy.id);
    try {
      await createRepositories(createClient()).aiOps.updatePolicy(policy.id, { active: !policy.active });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "แก้ไขไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(policy: Policy) {
    setBusyId(policy.id);
    try {
      await createRepositories(createClient()).aiOps.deletePolicy(policy.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  const active = (policies ?? []).filter((p) => p.active);
  const inactive = (policies ?? []).filter((p) => !p.active);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-primary-accent" />
          นโยบายบริษัท — ความจำองค์กร
          <Badge variant={active.length > 0 ? "success" : "outline"}>{active.length} ฉบับ active</Badge>
        </CardTitle>
        <CardDescription>
          นโยบายที่บันทึกที่นี่จะถูกแทรกเข้า prompt ของ AI ทุกครั้งที่ตอบลูกค้า — เช่น เรื่องส่วนลด การรับประกัน วิธีทวงเงิน
          วิธีพูดเรื่องโปรโมชัน การตัดสินใจของเจ้าของร้านที่อยากให้ AI ทำตาม
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p> : null}

        <div className="rounded-xl border border-line/10 p-4">
          <p className="mb-2 text-sm font-medium text-secondary">เพิ่มนโยบายใหม่</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ชื่อนโยบาย เช่น ส่วนลดแนะนำเพื่อน 10%"
            className="mb-2 w-full rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="รายละเอียดที่ AI ต้องปฏิบัติตาม เขียนเป็นประโยคชัดเจน เช่น เมื่อลูกค้าอยากได้ส่วนลดแนะนำเพื่อน ให้เสนอส่วนลด 10% สำหรับคอร์สแรก พร้อมแจ้งว่าเพื่อนได้ส่วนลด 5% เช่นกัน"
            rows={3}
            className="mb-2 w-full rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
          />
          <Button size="sm" onClick={addPolicy} disabled={saving || !title.trim() || !content.trim()}>
            <Plus className="h-4 w-4" />
            บันทึกนโยบาย
          </Button>
        </div>

        {policies === null ? (
          <Skeleton className="h-24" />
        ) : active.length === 0 && inactive.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="ยังไม่มีนโยบาย"
            description="ลองเริ่มจากสิ่งที่ AI เคยทำผิดซ้ำ เช่น เงื่อนไขส่วนลด หรือข้อความต้องห้าม"
          />
        ) : (
          <>
            {[...active, ...inactive].map((p) => (
              <div key={p.id} className={`rounded-xl border p-4 ${p.active ? "border-line/10" : "border-line/5 opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-secondary">{p.title}</p>
                      <Badge variant={p.active ? "success" : "outline"}>{p.active ? "ใช้อยู่" : "ปิดอยู่"}</Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-secondary/70">{p.content}</p>
                    {p.tags.length > 0 ? <p className="mt-1 text-xs text-secondary/40">{p.tags.join(", ")}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => toggle(p)} disabled={busyId === p.id}>
                      {p.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(p)} disabled={busyId === p.id}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
