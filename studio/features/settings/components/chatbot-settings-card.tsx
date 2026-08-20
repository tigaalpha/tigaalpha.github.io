"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Megaphone, Send, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, describeFunctionError } from "@/lib/utils";

const FEATURES: { key: string; label: string; description: string }[] = [
  { key: "chat_feature_outbound_nurture", label: "AI ทักลูกค้าก่อน (ตามลูกค้าที่เงียบไป)", description: "ลูกค้าถามแล้วเงียบเกิน 24 ชม. → AI ร่างข้อความตามไปถามต่อ เข้าคิวให้คุณอนุมัติก่อนส่ง" },
  { key: "chat_feature_lesson_reminder", label: "เตือนคาบเรียนอัตโนมัติ (2 ชม. ก่อน, การ์ด Flex)", description: "ส่งการ์ดเตือนคาบเรียนล่วงหน้า 2 ชม. พร้อมปุ่มยืนยันมา/มาไม่ได้ (การยืนยัน 24 ชม. ยังทำงานตามเดิม)" },
  { key: "chat_feature_rich_menu", label: "LINE Rich Menu + ข้อความต้อนรับ", description: "เมนูปุ่มกดใต้แชท LINE (จองคอร์ส/ดูตาราง/ราคา/คุยกับคน) + ทักทายคนที่แอดไลน์ใหม่" },
  { key: "chat_feature_flex_messages", label: "การ์ด Flex Message", description: "ข้อความเตือน/แจ้งเตือนแสดงเป็นการ์ดสีสวยแทนข้อความเปล่า" },
  { key: "chat_feature_customer_memory", label: "จำลูกค้าระยะยาว", description: "ทุกคืน AI สรุปข้อมูลลูกค้าจากบทสนทนา (ชื่อลูก ระดับ ความชอบ) ลง notes ให้คุณเห็นและแก้ได้" },
  { key: "chat_feature_owner_mode", label: "โหมดเจ้าของดูแล + คำตอบสำเร็จรูป", description: "พอคุณตอบลูกค้าเอง ระบบหยุด AI แทรกในคุยนั้น + ปุ่ม 'คำตอบสำเร็จรูป' ให้ AI ร่าง 3 แบบ" },
  { key: "chat_feature_broadcast", label: "ส่ง Broadcast ถึงลูกค้า", description: "ส่งข้อความโปรโมชันถึงลูกค้า LINE ทุกคน (ยกเว้นคนขอเลิกแจ้ง) ผ่านคิวอนุมัติเสมอ" },
  { key: "chat_feature_owner_notify", label: "แจ้งเจ้าของเมื่อลูกค้าใหม่ทัก", description: "ลูกค้าใหม่ทัก LINE ครั้งแรก → แจ้งเตือนในแอป + LINE ส่วนตัวทันที" },
  { key: "chat_feature_multilang", label: "ตอบลูกค้าตามภาษา (ไทย/อังกฤษ/จีน)", description: "ลูกค้าพิมพ์อังกฤษ/จีน → AI ตอบเป็นภาษานั้น (ปกติตอบไทย)" },
];

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        on ? "bg-primary" : "bg-line/20"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function ChatbotSettingsCard() {
  const [flags, setFlags] = useState<Record<string, string> | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const [broadcastText, setBroadcastText] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [settingRichMenu, setSettingRichMenu] = useState(false);
  const [richMenuResult, setRichMenuResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    Promise.all([
      repos.integrations.get("chat_review_mode"),
      ...FEATURES.map((f) => repos.integrations.get(f.key)),
    ]).then((values) => {
      const next: Record<string, string> = {};
      next["chat_review_mode"] = values[0] ?? "always";
      FEATURES.forEach((f, i) => (next[f.key] = values[i + 1] ?? "off"));
      setFlags(next);
    });
    createClient()
      .from("ai_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function setFeature(key: string, value: string) {
    setSavingKey(key);
    const repos = createRepositories(createClient());
    await repos.integrations.set(key, value);
    setFlags((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavingKey(null);
  }

  async function sendBroadcast(sendNow: boolean) {
    if (!broadcastText.trim()) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("chat-broadcast", {
        body: { message: broadcastText.trim(), sendNow },
      });
      if (error) throw error;
      setBroadcastResult({ type: "success", text: `${data.preview}… — ถึง ${data.recipients} คน (${data.status === "pending_review" ? "รออนุมัติใน Inbox" : "ส่งแล้ว"})` });
      setBroadcastText("");
      reload();
    } catch (err) {
      setBroadcastResult({ type: "error", text: await describeFunctionError(err) });
    } finally {
      setBroadcasting(false);
    }
  }

  async function setupRichMenu() {
    setSettingRichMenu(true);
    setRichMenuResult(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("chat-line-setup", { body: {} });
      if (error) throw error;
      setRichMenuResult({ type: "success", text: `Rich Menu ตั้งค่าแล้ว (ปุ่ม: ${data.areas?.join(", ") ?? "4 ปุ่ม"})` });
    } catch (err) {
      setRichMenuResult({ type: "error", text: await describeFunctionError(err) });
    } finally {
      setSettingRichMenu(false);
    }
  }

  const reviewMode = flags?.["chat_review_mode"] ?? "always";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          ระบบแชทบอท (AI Receptionist)
        </CardTitle>
        <CardDescription>เปิด/ปิดแต่ละฟีเจอร์ได้อิสระ — ทุกข้อความที่ AI จะส่งออกไปหาลูกค้า ผ่านคิวอนุมัติก่อนเสมอ (ยกเว้นโหมด Auto)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!flags ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            {/* Global review mode */}
            <div className="rounded-xl border border-line/10 p-4">
              <p className="mb-2 text-sm font-medium text-secondary">โหมดการทำงานของ AI (ใช้กับทุกฟีเจอร์)</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={reviewMode === "always" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setFeature("chat_review_mode", "always")}
                  disabled={savingKey === "chat_review_mode"}
                >
                  👀 ให้คนตรวจก่อน (แนะนำช่วงแรก — สอน AI)
                </Button>
                <Button
                  variant={reviewMode === "auto" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setFeature("chat_review_mode", "auto")}
                  disabled={savingKey === "chat_review_mode"}
                >
                  🤖 AI ส่งเองอัตโนมัติ (วงเงิน + เวลาทำการยังบังคับ)
                </Button>
              </div>
          <p className="mt-2 text-xs text-secondary/50">
            {reviewMode === "always"
              ? "ตอนนี้: AI ร่างข้อความ → ขึ้นคิวรอคุณตรวจใน Inbox → อนุมัติ/แก้/ปฏิเสธ (เหตุผลที่ปฏิเสธ = สอน AI)"
              : "ตอนนี้: AI ส่ง LINE เองทันทีตามวงเงิน — ข้อความทุกฉบับยังถูกบันทึกใน Inbox → AI Outbox ให้คุณเห็น"}
          </p>
            </div>

            {/* Per-feature toggles */}
            <div className="space-y-3">
              {FEATURES.map((f) => {
                const on = flags[f.key] === "on";
                return (
                  <div key={f.key} className="flex items-start justify-between gap-4 rounded-xl border border-line/10 p-3">
                    <div>
                      <p className="text-sm font-medium text-secondary">{f.label}</p>
                      <p className="mt-0.5 text-xs text-secondary/50">{f.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {savingKey === f.key && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      <Toggle on={on} onChange={(v) => setFeature(f.key, v ? "on" : "off")} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Outbox status */}
            <a href="/chat?tab=outbox" className="flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10">
              <span className="text-sm font-medium text-secondary">📥 คิวข้อความรอตรวจ (AI Outbox)</span>
              <Badge variant={pendingCount > 0 ? "danger" : "outline"}>{pendingCount > 0 ? `${pendingCount} รอตรวจ` : "ไม่มีค้าง"}</Badge>
            </a>

            {/* Rich menu */}
            <div className="rounded-xl border border-line/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-secondary">🖼️ LINE Rich Menu</p>
                  <p className="mt-0.5 text-xs text-secondary/50">สร้าง/อัปเดตเมนูปุ่มกดใต้แชท LINE (จองคอร์ส / ดูตาราง / ราคา / คุยกับคน)</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void setupRichMenu()} disabled={settingRichMenu || flags["chat_feature_rich_menu"] !== "on"}>
                  {settingRichMenu ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  {settingRichMenu ? "กำลังตั้ง…" : "ตั้งค่า Rich Menu"}
                </Button>
              </div>
              {richMenuResult ? (
                <p className={cn("mt-2 text-xs", richMenuResult.type === "success" ? "text-success" : "text-danger")}>
                  {richMenuResult.type === "success" ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : null}
                  {richMenuResult.text}
                </p>
              ) : null}
            </div>

            {/* Broadcast */}
            <div className="rounded-xl border border-line/10 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-secondary">
                <Megaphone className="h-4 w-4 text-primary" /> Broadcast ถึงลูกค้า LINE
              </p>
              <p className="mt-0.5 text-xs text-secondary/50">ส่งข้อความโปรโมชันถึงลูกค้าทุกคน (ยกเว้นคนขอเลิกแจ้ง) — สูงสุด 1 ครั้ง/วัน</p>
              <Textarea
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="พิมพ์ข้อความโปรโมชัน… เช่น 'โปรโมชันเดือนนี้ คอร์ส 20 ชม. ลด 10% สนใจทักเลยค่ะ 🎹'"
                className="mt-3 min-h-[96px]"
                maxLength={2000}
                disabled={flags["chat_feature_broadcast"] !== "on"}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => void sendBroadcast(true)} disabled={broadcasting || !broadcastText.trim() || flags["chat_feature_broadcast"] !== "on"}>
                  <Send className="mr-1 h-3.5 w-3.5" /> ส่งเลย
                </Button>
                <Button variant="outline" size="sm" onClick={() => void sendBroadcast(false)} disabled={broadcasting || !broadcastText.trim() || flags["chat_feature_broadcast"] !== "on"}>
                  บันทึกเป็นฉบับร่าง (ตรวจใน Outbox)
                </Button>
                {broadcasting && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              {broadcastResult ? (
                <p className={cn("mt-2 text-xs", broadcastResult.type === "success" ? "text-success" : "text-danger")}>{broadcastResult.text}</p>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
