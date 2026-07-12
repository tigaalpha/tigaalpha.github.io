"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, RefreshCw } from "lucide-react";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

interface StatusCheck {
  connected: boolean;
  detail: string;
}

interface StatusResponse {
  line: StatusCheck;
  googleCalendar: StatusCheck;
  gemini: StatusCheck;
}

function StatusBadge({ status }: { status: StatusCheck | null }) {
  if (!status) return <Badge variant="outline">Checking…</Badge>;
  return <Badge variant={status.connected ? "success" : "danger"}>{status.connected ? "Connected" : "Not connected"}</Badge>;
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg bg-line/5 px-2 py-1.5 text-xs text-secondary/80">{value}</code>
      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function IntegrationsCard() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [clientId, setClientId] = useState("");
  const [savingClientId, setSavingClientId] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabaseUrl = env.supabase.url();
  const lineWebhookUrl = `${supabaseUrl}/functions/v1/line-webhook`;
  const googleRedirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;

  async function refreshStatus() {
    setChecking(true);
    const supabase = createClient();
    const { data } = await supabase.functions.invoke<StatusResponse>("integrations-status");
    if (data) setStatus(data);
    setChecking(false);
  }

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.integrations.get("google_client_id").then((v) => setClientId(v ?? ""));
    refreshStatus();

    const params = new URLSearchParams(window.location.search);
    const googleCalendar = params.get("googleCalendar");
    if (googleCalendar === "connected") {
      setBanner({ type: "success", text: "เชื่อมต่อ Google Calendar สำเร็จแล้ว!" });
    } else if (googleCalendar === "error") {
      setBanner({ type: "error", text: `เชื่อมต่อไม่สำเร็จ: ${params.get("googleCalendarError") ?? "ไม่ทราบสาเหตุ"}` });
    }
    if (googleCalendar) {
      params.delete("googleCalendar");
      params.delete("googleCalendarError");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveClientId() {
    if (!clientId.trim()) return;
    setSavingClientId(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("google_client_id", clientId.trim());
    setSavingClientId(false);
  }

  async function connectGoogle() {
    setConnecting(true);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<{ url: string }>("google-oauth-start");
    setConnecting(false);
    if (error || !data) {
      setBanner({ type: "error", text: "เริ่มเชื่อมต่อไม่สำเร็จ ลองบันทึก Client ID อีกครั้งก่อน" });
      return;
    }
    window.location.href = data.url;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>เชื่อมต่อ LINE Official Account, Google Calendar, และ AI</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {banner ? (
          <p
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              banner.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            )}
          >
            {banner.text}
          </p>
        ) : null}

        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={() => void refreshStatus()} disabled={checking}>
            <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
            ตรวจสอบสถานะ
          </Button>
        </div>

        <div className="space-y-2 rounded-xl border border-line/10 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-secondary">LINE Official Account</p>
            <StatusBadge status={status?.line ?? null} />
          </div>
          {status?.line ? <p className="text-xs text-secondary/50">{status.line.detail}</p> : null}
          <div className="space-y-1 pt-2 text-sm text-secondary/70">
            <p>1. เข้า LINE Developers Console → เลือก Channel ของร้าน → คัดลอก <b>Channel secret</b> และสร้าง <b>Channel access token</b></p>
            <p>
              2. นำค่าทั้งสองไปวางใน Supabase Dashboard → Edge Functions → Secrets เป็น{" "}
              <code className="rounded bg-line/5 px-1">LINE_CHANNEL_SECRET</code> และ{" "}
              <code className="rounded bg-line/5 px-1">LINE_CHANNEL_ACCESS_TOKEN</code>
            </p>
            <p>3. นำ URL นี้ไปวางใน LINE Developers Console → Messaging API → Webhook URL:</p>
          </div>
          <CopyField value={lineWebhookUrl} />
        </div>

        <div className="space-y-2 rounded-xl border border-line/10 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-secondary">Google Calendar</p>
            <StatusBadge status={status?.googleCalendar ?? null} />
          </div>
          {status?.googleCalendar ? <p className="text-xs text-secondary/50">{status.googleCalendar.detail}</p> : null}
          <div className="space-y-1 pt-2 text-sm text-secondary/70">
            <p>1. เข้า Google Cloud Console → สร้าง OAuth Client (Web application) → คัดลอก <b>Client ID</b> วางด้านล่าง</p>
            <p>
              2. นำ <b>Client secret</b> ไปวางใน Supabase Dashboard → Edge Functions → Secrets เป็น{" "}
              <code className="rounded bg-line/5 px-1">GOOGLE_CLIENT_SECRET</code>
            </p>
            <p>3. เพิ่ม Redirect URI นี้ใน Google Cloud Console → Authorized redirect URIs:</p>
          </div>
          <CopyField value={googleRedirectUri} />
          <div className="flex items-end gap-2 pt-2">
            <Input placeholder="Google Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} />
            <Button variant="outline" onClick={() => void saveClientId()} disabled={savingClientId || !clientId.trim()}>
              {savingClientId ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
          <Button className="w-full" onClick={() => void connectGoogle()} disabled={connecting || !clientId.trim()}>
            {connecting ? "กำลังเชื่อมต่อ…" : "Connect Google Calendar"}
          </Button>
        </div>

        <div className="space-y-2 rounded-xl border border-line/10 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-secondary">Gemini AI</p>
            <StatusBadge status={status?.gemini ?? null} />
          </div>
          {status?.gemini ? <p className="text-xs text-secondary/50">{status.gemini.detail}</p> : null}
          <div className="space-y-1 pt-2 text-sm text-secondary/70">
            <p>1. เข้า Google AI Studio → สร้าง API Key ฟรี</p>
            <p>
              2. นำไปวางใน Supabase Dashboard → Edge Functions → Secrets เป็น{" "}
              <code className="rounded bg-line/5 px-1">GEMINI_API_KEY</code>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
