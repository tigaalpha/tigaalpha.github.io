"use client";

import { useEffect, useState } from "react";
import { CalendarDays, HandCoins, Music, Phone, UserRound } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface PortalMeData {
  customer: { name: string; phone: string | null; parentName: string | null; memberSince: string | null };
  upcomingLessons: { id: string; title: string; startTime: string; endTime: string; status: string; teacher: string | null }[];
  pendingPayments: { id: string; amount: number; referenceCode: string; qrUrl: string | null; qrBase64: string | null; createdAt: string }[];
  paidHistory: { id: string; amount: number; referenceCode: string; paidAt: string }[];
  courses: { id: string; totalHours: number; currentHour: number; remainingHours: number; price: number | null }[];
}

type PortalStatus = "boot" | "need-login" | "loading" | "ready" | "error";

const FUNC_BASE = env.supabase.url().replace(/\/$/, "");

declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      logout: () => void;
      getIDToken: () => string | null;
      isInClient: () => boolean;
    } | null;
  }
}

export default function PortalPage() {
  const [status, setStatus] = useState<PortalStatus>("boot");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalMeData | null>(null);
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const supabase = createClient();
        const { data: config, error: cfgErr } = await supabase.functions.invoke<{ liffAppId: string | null; liffClientId: string | null }>("portal-config");
        if (cancelled) return;
        if (cfgErr || !config?.liffAppId) {
          setStatus("error");
          setError("พอร์ทัลลูกค้ายังไม่ได้ตั้งค่า LIFF — ผู้ดูแลระบบต้องตั้งค่า liff_app_id ในระบบ");
          return;
        }

        // Load the LINE LIFF SDK from LINE's CDN (no npm dependency).
        if (!window.liff) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://static.line-scdn.net/liff/edge/2.1/sdk.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("โหลด LINE SDK ไม่สำเร็จ"));
            document.head.appendChild(script);
          });
        }
        if (!window.liff) throw new Error("LINE SDK ไม่พร้อม");

        await window.liff.init({ liffId: config.liffAppId });
        if (cancelled) return;

        if (!window.liff.isLoggedIn()) {
          setStatus("need-login");
          return;
        }

        const idToken = window.liff.getIDToken();
        if (!idToken) {
          setStatus("error");
          setError("ไม่ได้รับข้อมูลยืนยันตัวตนจาก LINE");
          return;
        }

        setStatus("loading");
        const { data: loginRes, error: loginErr } = await supabase.functions.invoke<{ token: string }>("portal-login", { body: { idToken } });
        if (cancelled) return;
        if (loginErr || !loginRes?.token) {
          setStatus("error");
          setError("เข้าสู่ระบบไม่สำเร็จ — ถ้ายังไม่เคยทักแชทกับร้าน รบกวนทักมาที่ LINE ของร้านก่อนเพื่อผูกบัญชี");
          return;
        }

        const meRes = await fetch(`${FUNC_BASE}/functions/v1/portal-me`, {
          headers: { Authorization: `Bearer ${loginRes.token}` },
        });
        if (cancelled) return;
        if (!meRes.ok) {
          setStatus("error");
          setError("โหลดข้อมูลไม่สำเร็จ");
          return;
        }
        const me = (await meRes.json()) as PortalMeData;
        setData(me);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    window.liff?.logout();
    window.location.reload();
  }

  if (status === "boot" || status === "loading") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (status === "need-login") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <Music className="mb-4 h-12 w-12 text-primary-accent" />
        <h1 className="text-xl font-semibold text-secondary">TIGA Studio</h1>
        <p className="mt-2 text-sm text-secondary/60">เข้าสู่ระบบด้วย LINE เพื่อดูตารางเรียน ยอดชำระ และชั่วโมงเรียนของคุณ</p>
        <Button className="mt-6" onClick={() => window.liff?.login()}>
          เข้าสู่ระบบด้วย LINE
        </Button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-secondary">สวัสดี {data?.customer.name}</h1>
          <p className="text-sm text-secondary/50">
            ยินดีต้อนรับสู่ TIGA Studio{data?.customer.parentName ? ` · ผู้ปกครอง: ${data.customer.parentName}` : ""}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={logout}>
          ออกจากระบบ
        </Button>
      </div>

      {/* Course hours */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(data?.courses ?? []).map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-sm text-secondary/60">ชั่วโมงเรียนคงเหลือ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-secondary">
                {c.remainingHours} <span className="text-base text-secondary/40">/ {c.totalHours} ชม.</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary/10">
                <div
                  className="h-full rounded-full bg-primary-accent"
                  style={{ width: `${Math.min(100, (c.remainingHours / c.totalHours) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming lessons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary-accent" />
            คาบเรียนถัดไป
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.upcomingLessons ?? []).length === 0 ? (
            <p className="text-sm text-secondary/50">ยังไม่มีคาบเรียนที่กำลังจะมาถึง</p>
          ) : (
            (data?.upcomingLessons ?? []).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-secondary">{l.title}</p>
                  <p className="text-xs text-secondary/50">
                    {new Date(l.startTime).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                    {l.teacher ? ` · ครู${l.teacher}` : ""}
                  </p>
                </div>
                <Badge variant={l.status === "confirmed" ? "success" : "warning"}>{l.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Pending payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HandCoins className="h-4 w-4 text-primary-accent" />
            ใบแจ้งชำระ
          </CardTitle>
          <CardDescription>โอนเข้าบัญชีแล้วส่งสลิปในแชท LINE ของร้าน หรือสแกน QR เพื่อชำระ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.pendingPayments ?? []).length === 0 ? (
            <p className="text-sm text-secondary/50">ไม่มีใบแจ้งชำระค้าง</p>
          ) : (
            (data?.pendingPayments ?? []).map((p) => (
              <div key={p.id} className="rounded-xl border border-line/10 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-secondary">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-secondary/50">อ้างอิง {p.referenceCode}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedPayment((prev) => (prev === p.id ? null : p.id))}
                  >
                    {expandedPayment === p.id ? "ปิด" : "ดู QR"}
                  </Button>
                </div>
                {expandedPayment === p.id && (p.qrUrl || p.qrBase64) ? (
                  <div className="mt-3 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.qrUrl ?? p.qrBase64!} alt="QR PromptPay" className="h-48 w-48 rounded-xl bg-white p-2" />
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Paid history */}
      {(data?.paidHistory ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ประวัติการชำระ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.paidHistory ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
                <p className="text-sm text-secondary">{formatCurrency(p.amount)}</p>
                <p className="text-xs text-secondary/50">
                  {p.paidAt ? new Date(p.paidAt).toLocaleDateString("th-TH") : ""} · {p.referenceCode}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="flex items-center justify-center gap-2 text-xs text-secondary/40">
        <Phone className="h-3 w-3" />
        มีคำถาม? ทัก LINE ของร้านได้ตลอดเวลา
        <UserRound className="h-3 w-3" />
      </p>
    </div>
  );
}
