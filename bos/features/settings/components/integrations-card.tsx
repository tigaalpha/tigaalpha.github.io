"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, RefreshCw, Trash2 } from "lucide-react";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { CHAT_MODELS } from "@/lib/chat-models";
import type { GoogleCalendarConnectionSummary } from "@/services/repositories/google-calendar-connections.repository";

interface StatusCheck {
  connected: boolean;
  detail: string;
}

interface StatusResponse {
  line: StatusCheck;
  googleCalendar: StatusCheck;
  gemini: StatusCheck;
  youtube: StatusCheck;
  openrouter: StatusCheck;
}

function StatusBadge({ status }: { status: StatusCheck | null }) {
  if (!status) return <Badge variant="outline">Checking…</Badge>;
  return <Badge variant={status.connected ? "success" : "danger"}>{status.connected ? "Connected" : "Not connected"}</Badge>;
}

// Per-tier model picker: empty value = fall back to the master model
// (ai_chat_model) set in the cost-control card below.
function TierModelSelect({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <option value="">ใช้ค่าเริ่มต้น (ตามโมเดลหลักด้านบน)</option>
      {CHAT_MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
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
  const [ownerLineId, setOwnerLineId] = useState("");
  const [savingOwnerLineId, setSavingOwnerLineId] = useState(false);
  const [metaAppId, setMetaAppId] = useState("");
  const [savingMetaAppId, setSavingMetaAppId] = useState(false);
  const [metaConfigId, setMetaConfigId] = useState("");
  const [savingMetaConfigId, setSavingMetaConfigId] = useState(false);
  const [metaTargetPageName, setMetaTargetPageName] = useState("");
  const [savingMetaTargetPageName, setSavingMetaTargetPageName] = useState(false);
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [manualPageToken, setManualPageToken] = useState("");
  const [connectingManualToken, setConnectingManualToken] = useState(false);
  const [manualTokenResult, setManualTokenResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [facebookAccount, setFacebookAccount] = useState<{ account_name: string } | null | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [gcalConnections, setGcalConnections] = useState<GoogleCalendarConnectionSummary[] | null>(null);
  const [gcalLabel, setGcalLabel] = useState("");
  const [connectingGcal, setConnectingGcal] = useState(false);
  const [chatModel, setChatModel] = useState("gemini");
  const [savingChatModel, setSavingChatModel] = useState(false);
  const [tierChatModel, setTierChatModel] = useState("");
  const [tierAgentModel, setTierAgentModel] = useState("");
  const [tierContentModel, setTierContentModel] = useState("");
  const [savingTierModel, setSavingTierModel] = useState(false);
  const [aiBudget, setAiBudget] = useState("");
  const [savingAiBudget, setSavingAiBudget] = useState(false);
  const [videoLimit, setVideoLimit] = useState("");
  const [savingVideoLimit, setSavingVideoLimit] = useState(false);

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

  function reloadGcalConnections() {
    const repos = createRepositories(createClient());
    repos.googleCalendarConnections.list().then(setGcalConnections);
  }

  useEffect(() => {
    const supabase = createClient();
    const repos = createRepositories(supabase);
    repos.integrations.get("google_client_id").then((v) => setClientId(v ?? ""));
    repos.integrations.get("owner_line_user_id").then((v) => setOwnerLineId(v ?? ""));
    repos.integrations.get("meta_app_id").then((v) => setMetaAppId(v ?? ""));
    repos.integrations.get("meta_login_config_id").then((v) => setMetaConfigId(v ?? ""));
    repos.integrations.get("meta_target_page_name").then((v) => setMetaTargetPageName(v ?? ""));
    repos.integrations.get("ai_chat_model").then((v) => setChatModel(v ?? "gemini"));
    repos.integrations.get("ai_model_chat").then((v) => setTierChatModel(v ?? ""));
    repos.integrations.get("ai_model_agent").then((v) => setTierAgentModel(v ?? ""));
    repos.integrations.get("ai_model_content").then((v) => setTierContentModel(v ?? ""));
    repos.integrations.get("ai_budget_daily_tokens").then((v) => setAiBudget(v ?? ""));
    repos.integrations.get("ai_video_daily_limit").then((v) => setVideoLimit(v ?? ""));
    supabase
      .from("social_accounts")
      .select("account_name")
      .eq("platform", "facebook")
      .maybeSingle()
      .then(({ data }) => setFacebookAccount(data ?? null));
    refreshStatus();
    reloadGcalConnections();

    const params = new URLSearchParams(window.location.search);
    const googleCalendar = params.get("googleCalendar");
    if (googleCalendar === "connected") {
      setBanner({ type: "success", text: "เชื่อมต่อ Google Calendar สำเร็จแล้ว!" });
    } else if (googleCalendar === "error") {
      setBanner({ type: "error", text: `เชื่อมต่อไม่สำเร็จ: ${params.get("googleCalendarError") ?? "ไม่ทราบสาเหตุ"}` });
    }
    const meta = params.get("meta");
    if (meta === "connected") {
      setBanner({ type: "success", text: "เชื่อมต่อ Facebook Page สำเร็จแล้ว!" });
    } else if (meta === "error") {
      setBanner({ type: "error", text: `เชื่อมต่อ Facebook ไม่สำเร็จ: ${params.get("metaError") ?? "ไม่ทราบสาเหตุ"}` });
    }
    const gcalConnect = params.get("gcalConnect");
    if (gcalConnect === "connected") {
      setBanner({ type: "success", text: "เชื่อมต่อบัญชี Google Calendar เพิ่มสำเร็จแล้ว!" });
      reloadGcalConnections();
    } else if (gcalConnect === "error") {
      setBanner({ type: "error", text: `เชื่อมต่อไม่สำเร็จ: ${params.get("gcalConnectError") ?? "ไม่ทราบสาเหตุ"}` });
    }
    if (googleCalendar || meta || gcalConnect) {
      params.delete("googleCalendar");
      params.delete("googleCalendarError");
      params.delete("meta");
      params.delete("metaError");
      params.delete("gcalConnect");
      params.delete("gcalConnectError");
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

  async function saveOwnerLineId() {
    if (!ownerLineId.trim()) return;
    setSavingOwnerLineId(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("owner_line_user_id", ownerLineId.trim());
    setSavingOwnerLineId(false);
  }

  async function saveMetaAppId() {
    if (!metaAppId.trim()) return;
    setSavingMetaAppId(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("meta_app_id", metaAppId.trim());
    setSavingMetaAppId(false);
  }

  async function saveMetaConfigId() {
    if (!metaConfigId.trim()) return;
    setSavingMetaConfigId(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("meta_login_config_id", metaConfigId.trim());
    setSavingMetaConfigId(false);
  }

  async function saveMetaTargetPageName() {
    if (!metaTargetPageName.trim()) return;
    setSavingMetaTargetPageName(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("meta_target_page_name", metaTargetPageName.trim());
    setSavingMetaTargetPageName(false);
  }

  async function connectMeta() {
    setConnectingMeta(true);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<{ url: string }>("meta-oauth-start");
    setConnectingMeta(false);
    if (error || !data) {
      setBanner({ type: "error", text: "เริ่มเชื่อมต่อไม่สำเร็จ ลองบันทึก Meta App ID อีกครั้งก่อน" });
      return;
    }
    window.location.href = data.url;
  }

  async function connectMetaManual() {
    if (!manualPageToken.trim()) return;
    setConnectingManualToken(true);
    setManualTokenResult(null);
    const supabase = createClient();
    let data: { connected: boolean; pageName: string } | { error: string } | null = null;
    let invokeError: unknown = null;
    try {
      const res = await supabase.functions.invoke<{ connected: boolean; pageName: string } | { error: string }>(
        "meta-manual-connect",
        { body: { pageAccessToken: manualPageToken.trim() } }
      );
      data = res.data;
      invokeError = res.error;
      // supabase-js throws away the response body on non-2xx by default —
      // the actual { error: "..." } message we return lives on the raw
      // Response the FunctionsHttpError wraps, not in `data`.
      if (invokeError && typeof invokeError === "object" && "context" in invokeError) {
        const context = (invokeError as { context?: Response }).context;
        if (context) {
          const body = await context.clone().json().catch(() => null);
          if (body && typeof body === "object" && "error" in body) data = body as { error: string };
        }
      }
    } catch (err) {
      invokeError = err;
    }
    setConnectingManualToken(false);
    if (invokeError || !data || "error" in data) {
      const message = data && "error" in data ? data.error : "เชื่อมต่อไม่สำเร็จ ลองตรวจสอบ Token อีกครั้ง (ดูข้อความ error ด้านบนปุ่มนี้)";
      setManualTokenResult({ type: "error", text: message });
      return;
    }
    setManualPageToken("");
    setFacebookAccount({ account_name: data.pageName });
    setManualTokenResult({ type: "success", text: `เชื่อมต่อสำเร็จแล้ว! (${data.pageName})` });
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

  async function connectGcal() {
    setConnectingGcal(true);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<{ url: string }>("gcal-connect-start", {
      body: { label: gcalLabel.trim() || undefined },
    });
    setConnectingGcal(false);
    if (error || !data) {
      setBanner({ type: "error", text: "เริ่มเชื่อมต่อไม่สำเร็จ — ตรวจสอบว่าตั้งค่า Google Client ID ไว้แล้วและยังไม่ครบ 3 บัญชี" });
      return;
    }
    window.location.href = data.url;
  }

  async function removeGcalConnection(id: string) {
    const repos = createRepositories(createClient());
    await repos.googleCalendarConnections.remove(id);
    reloadGcalConnections();
  }

  async function saveChatModel(value: string) {
    setChatModel(value);
    setSavingChatModel(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("ai_chat_model", value);
    setSavingChatModel(false);
  }

  async function saveTierModel(tierKey: "ai_model_chat" | "ai_model_agent" | "ai_model_content", value: string) {
    setSavingTierModel(true);
    const repos = createRepositories(createClient());
    if (value) await repos.integrations.set(tierKey, value);
    else await repos.integrations.remove(tierKey); // reset to "ใช้ค่าเริ่มต้น"
    if (tierKey === "ai_model_chat") setTierChatModel(value);
    else if (tierKey === "ai_model_agent") setTierAgentModel(value);
    else setTierContentModel(value);
    setSavingTierModel(false);
  }

  async function saveAiBudget() {
    setSavingAiBudget(true);
    const repos = createRepositories(createClient());
    const value = aiBudget.trim();
    if (value && (Number.isNaN(Number(value)) || Number(value) < 0)) {
      setAiBudget("");
      setSavingAiBudget(false);
      return;
    }
    if (value) await repos.integrations.set("ai_budget_daily_tokens", value);
    else await repos.integrations.remove("ai_budget_daily_tokens");
    setSavingAiBudget(false);
  }

  async function saveVideoLimit() {
    setSavingVideoLimit(true);
    const repos = createRepositories(createClient());
    const value = videoLimit.trim();
    if (value && (Number.isNaN(Number(value)) || Number(value) < 0)) {
      setVideoLimit("");
      setSavingVideoLimit(false);
      return;
    }
    if (value) await repos.integrations.set("ai_video_daily_limit", value);
    else await repos.integrations.remove("ai_video_daily_limit");
    setSavingVideoLimit(false);
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
            <p>
              1. เข้า Google Cloud Console → เปิดใช้งาน &quot;Google Search Console API&quot; (ฟรี) → สร้าง OAuth Client (Web
              application) → คัดลอก <b>Client ID</b> วางด้านล่าง
            </p>
            <p>
              2. นำ <b>Client secret</b> ไปวางใน Supabase Dashboard → Edge Functions → Secrets เป็น{" "}
              <code className="rounded bg-line/5 px-1">GOOGLE_CLIENT_SECRET</code>
            </p>
            <p>3. เพิ่ม Redirect URI นี้ใน Google Cloud Console → Authorized redirect URIs:</p>
          </div>
          <p className="text-xs text-secondary/50">
            การเชื่อมต่อนี้ตอนนี้ขอสิทธิ์ Google Drive (เฉพาะไฟล์ที่แอปสร้างเอง) สำหรับบันทึกภาพจาก Image Studio และสิทธิ์อ่าน Google Search
            Console (สำหรับหน้า Marketing Channels) เพิ่มด้วย — ถ้าเคยเชื่อมต่อไว้ก่อนหน้านี้แล้ว ต้องกด Connect ใหม่อีกครั้งเพื่อขอสิทธิ์ที่เพิ่มมา
          </p>
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
            <p className="font-medium text-secondary">ปฏิทินเพิ่มเติมสำหรับดูในหน้า Calendar (สูงสุด 3 บัญชี)</p>
            <Badge variant="outline">{gcalConnections?.length ?? 0}/3</Badge>
          </div>
          <p className="text-xs text-secondary/50">
            เชื่อมต่อบัญชี Gmail แยกกันได้สูงสุด 3 บัญชี เพื่อดูปฏิทินของแต่ละคนพร้อมกันในหน้า Calendar แล้วเลือกกรองทีหลังได้ —
            เป็นการเชื่อมต่อแบบดูอย่างเดียว ไม่เกี่ยวกับการจองคาบเรียนอัตโนมัติด้านบน
          </p>

          {gcalConnections === null ? null : gcalConnections.length > 0 ? (
            <ul className="space-y-1">
              {gcalConnections.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-line/5 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="truncate text-secondary">{c.label}</span>
                    {c.google_account_email ? <span className="truncate text-xs text-secondary/50">({c.google_account_email})</span> : null}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => void removeGcalConnection(c.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {(gcalConnections?.length ?? 0) < 3 ? (
            <div className="flex items-end gap-2 pt-1">
              <Input
                placeholder="ชื่อที่ต้องการ เช่น ปฏิทินครู A (ไม่บังคับ)"
                value={gcalLabel}
                onChange={(e) => setGcalLabel(e.target.value)}
              />
              <Button variant="outline" onClick={() => void connectGcal()} disabled={connectingGcal || !clientId.trim()}>
                {connectingGcal ? "กำลังเชื่อมต่อ…" : "เชื่อมต่อบัญชีเพิ่ม"}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 rounded-xl border border-line/10 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-secondary">Facebook Page (โพสต์อัตโนมัติ)</p>
            {facebookAccount === undefined ? (
              <Badge variant="outline">กำลังตรวจสอบ…</Badge>
            ) : (
              <Badge variant={facebookAccount ? "success" : "danger"}>{facebookAccount ? `เชื่อมต่อ: ${facebookAccount.account_name}` : "ยังไม่เชื่อมต่อ"}</Badge>
            )}
          </div>
          <div className="space-y-1 pt-2 text-sm text-secondary/70">
            <p>
              1. เข้า{" "}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary-accent underline">
                Meta for Developers
              </a>{" "}
              → สร้างแอป (ประเภท Business) → คัดลอก <b>App ID</b> วางด้านล่าง
            </p>
            <p>
              2. นำ <b>App Secret</b> ไปวางใน Supabase Dashboard → Edge Functions → Secrets เป็น{" "}
              <code className="rounded bg-line/5 px-1">META_APP_SECRET</code>
            </p>
            <p>3. เพิ่ม Redirect URI นี้ใน Facebook Login → Valid OAuth Redirect URIs:</p>
          </div>
          <CopyField value={`${supabaseUrl}/functions/v1/meta-oauth-callback`} />
          <div className="flex items-end gap-2 pt-2">
            <Input placeholder="Meta App ID" value={metaAppId} onChange={(e) => setMetaAppId(e.target.value)} />
            <Button variant="outline" onClick={() => void saveMetaAppId()} disabled={savingMetaAppId || !metaAppId.trim()}>
              {savingMetaAppId ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
          <div className="space-y-1 pt-2 text-sm text-secondary/70">
            <p>
              4. สิทธิ์สำหรับ Page (pages_show_list, pages_manage_posts, pages_read_engagement) ต้องมาจากโปรดักต์{" "}
              <b>&quot;Facebook Login for Business&quot;</b> เท่านั้น — ถ้าแอปมีแค่ &quot;Facebook Login&quot; ธรรมดา จะเจอ
              Error &quot;Invalid Scopes&quot; ตอน Connect ให้เพิ่มโปรดักต์นี้ในแอป → เมนูซ้าย <b>Facebook Login for Business</b> →{" "}
              <b>Configurations</b> → Create Configuration → เลือก Use Case &quot;Manage everything on your Page&quot; หรือติ๊กสิทธิ์ทั้ง 3
              ตัวข้างต้นเอง → เลือก Page ที่จะเชื่อม → Create แล้วคัดลอก <b>Configuration ID</b> มาวางด้านล่างนี้
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Input placeholder="Meta Login Configuration ID" value={metaConfigId} onChange={(e) => setMetaConfigId(e.target.value)} />
            <Button variant="outline" onClick={() => void saveMetaConfigId()} disabled={savingMetaConfigId || !metaConfigId.trim()}>
              {savingMetaConfigId ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
          <p className="pt-2 text-xs text-secondary/50">
            5. ถ้าบัญชี Facebook ที่ใช้ login เป็นแอดมินหลาย Page (เช่นมี Page อื่นปนอยู่) ใส่ชื่อ Page ที่ต้องการเชื่อมให้ตรงเป๊ะด้านล่างนี้ —
            ไม่งั้นระบบจะเชื่อมกับ Page แรกที่ Facebook ส่งมาให้ ซึ่งอาจไม่ใช่อันที่ต้องการ
          </p>
          <div className="flex items-end gap-2">
            <Input
              placeholder="ชื่อ Facebook Page ที่ต้องการเชื่อม เช่น TIGA - สอนเปียโนออนไลน์"
              value={metaTargetPageName}
              onChange={(e) => setMetaTargetPageName(e.target.value)}
            />
            <Button variant="outline" onClick={() => void saveMetaTargetPageName()} disabled={savingMetaTargetPageName || !metaTargetPageName.trim()}>
              {savingMetaTargetPageName ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
          <Button className="w-full" onClick={() => void connectMeta()} disabled={connectingMeta || !metaAppId.trim()}>
            {connectingMeta ? "กำลังเชื่อมต่อ…" : "Connect Facebook Page"}
          </Button>
          <p className="pt-1 text-xs text-secondary/50">
            รองรับเฉพาะ Facebook Page และ LINE OA (broadcast) สำหรับโพสต์อัตโนมัติแบบข้อความล้วน — Instagram/TikTok/YouTube
            ต้องแนบรูปหรือวิดีโอเสมอ จึงยังต้องโพสต์ด้วยมือผ่านลิงก์โดยตรง
          </p>

          <div className="space-y-2 rounded-lg border border-line/10 bg-line/5 p-3 pt-3 mt-2">
            <p className="text-xs font-medium text-secondary">
              เชื่อมต่อด้วย Page Access Token โดยตรง (ทางเลือกสำรอง ถ้า Connect ปกติติด pages_manage_posts ไม่ขึ้นให้เลือก)
            </p>
            <p className="text-xs text-secondary/50">
              ไปสร้าง Token ที่{" "}
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary-accent underline">
                Graph API Explorer
              </a>{" "}
              (เลือกแอปนี้ → ติ๊กสิทธิ์ pages_show_list, pages_manage_posts, pages_read_engagement → Generate → ขยายอายุที่{" "}
              <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noopener noreferrer" className="text-primary-accent underline">
                Access Token Debugger
              </a>{" "}
              → กลับมาเรียก <code className="rounded bg-line/5 px-1">me/accounts?fields=id,name,access_token</code> เอา access_token ของ
              Page ที่ต้องการ) แล้ววางที่นี่ — Token จะถูกส่งตรงไปที่ระบบเราเท่านั้น ไม่ต้องส่งในแชท
            </p>
            <div className="flex items-end gap-2">
              <Input
                placeholder="Page Access Token"
                type="password"
                value={manualPageToken}
                onChange={(e) => setManualPageToken(e.target.value)}
              />
              <Button variant="outline" onClick={() => void connectMetaManual()} disabled={connectingManualToken || !manualPageToken.trim()}>
                {connectingManualToken ? "กำลังเชื่อมต่อ…" : "เชื่อมต่อด้วย Token"}
              </Button>
            </div>
            {manualTokenResult ? (
              <p
                className={cn(
                  "rounded-lg px-3 py-2 text-xs",
                  manualTokenResult.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                )}
              >
                {manualTokenResult.text}
              </p>
            ) : null}
          </div>
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

        <div className="space-y-2 rounded-xl border border-line/10 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-secondary">OpenRouter (Claude, GPT, Grok, DeepSeek, Kimi, GLM, Qwen)</p>
            <StatusBadge status={status?.openrouter ?? null} />
          </div>
          {status?.openrouter ? <p className="text-xs text-secondary/50">{status.openrouter.detail}</p> : null}
          <p className="text-sm text-secondary/70">
            โมเดล AI ทุกตัวนอกจาก Gemini (ทั้งของ TIGA AI Agent ด้านล่าง และห้องกลยุทธ์ Strategy Room) เชื่อมผ่าน{" "}
            <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary-accent underline">
              OpenRouter
            </a>{" "}
            จุดเดียว — เติมเงิน (Credits) ที่ OpenRouter ที่เดียว ใช้ได้กับทุกโมเดลด้านล่าง ไม่ต้องสมัครและเติมเงินแยกทีละเจ้า
          </p>
          <div className="space-y-1 pt-2 text-sm text-secondary/70">
            <p>
              1. สมัคร{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary-accent underline">
                openrouter.ai/keys
              </a>{" "}
              → สร้าง API key → เติมเงิน (Credits) ตามที่ต้องการใช้
            </p>
            <p>
              2. นำ API key ไปวางใน Supabase Dashboard → Edge Functions → Secrets เป็น{" "}
              <code className="rounded bg-line/5 px-1">OPENROUTER_API_KEY</code>
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-line/10 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-secondary">YouTube Data API (สำหรับหน้า Marketing Channels)</p>
            <StatusBadge status={status?.youtube ?? null} />
          </div>
          {status?.youtube ? <p className="text-xs text-secondary/50">{status.youtube.detail}</p> : null}
          <div className="space-y-1 pt-2 text-sm text-secondary/70">
            <p>
              1. เข้า{" "}
              <a
                href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-accent underline"
              >
                Google Cloud Console
              </a>{" "}
              → เปิดใช้งาน &quot;YouTube Data API v3&quot; → สร้าง API Key ฟรี (ไม่ต้องผูกบัตร)
            </p>
            <p>
              2. นำไปวางใน Supabase Dashboard → Edge Functions → Secrets เป็น{" "}
              <code className="rounded bg-line/5 px-1">YOUTUBE_API_KEY</code>
            </p>
            <p>3. ไปที่หน้า Marketing Channels แล้วกรอก handle หรือ Channel ID ของช่อง YouTube เพื่อดูสถิติแบบ real-time</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-line/10 p-4">
          <div>
            <p className="font-medium text-secondary">โมเดล AI แยกตามงาน (ลดค่าใช้จ่าย)</p>
            <p className="text-xs text-secondary/50">
              งานถี่ (แชทลูกค้า) ใช้โมเดลถูก งานสำคัญ (Agent/คอนเทนต์) ใช้โมเดลแรง — แต่ละส่วนตั้งแยกกันได้ ถ้าไม่ตั้งจะใช้โมเดลหลักด้านล่าง
              โมเดลนอกจาก Gemini ต้องเชื่อมต่อ OpenRouter ก่อน (ดูการ์ดด้านบน) ถึงจะใช้ได้จริง
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-secondary/50">โมเดลหลัก (ค่าเริ่มต้นทุกส่วน)</label>
            <select
              value={chatModel}
              onChange={(e) => void saveChatModel(e.target.value)}
              disabled={savingChatModel}
              className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {CHAT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} {status?.[m.statusKey]?.connected ? "— เชื่อมต่อแล้ว" : m.id === "gemini" ? "" : "— ยังไม่เชื่อมต่อ"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-secondary/50">แชทลูกค้า (LINE/เว็บ/Messenger) — งานถี่ที่สุด ควรใช้โมเดลถูก</label>
            <TierModelSelect value={tierChatModel} disabled={savingTierModel} onChange={(v) => void saveTierModel("ai_model_chat", v)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-secondary/50">TIGA AI Agent (CEO + Specialist)</label>
            <TierModelSelect value={tierAgentModel} disabled={savingTierModel} onChange={(v) => void saveTierModel("ai_model_agent", v)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-secondary/50">สร้างคอนเทนต์ (บทความ/สคริปต์/โฆษณา/เสียง)</label>
            <TierModelSelect value={tierContentModel} disabled={savingTierModel} onChange={(v) => void saveTierModel("ai_model_content", v)} />
          </div>

          <div className="flex items-end gap-2 border-t border-line/10 pt-3">
            <div className="flex-1">
              <label className="text-xs text-secondary/50">วงเงิน AI ต่อวัน (tokens, 0/ว่าง = ไม่จำกัด)</label>
              <Input
                type="number"
                min={0}
                placeholder="เช่น 500000"
                value={aiBudget}
                onChange={(e) => setAiBudget(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void saveAiBudget()} disabled={savingAiBudget}>
              {savingAiBudget ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
          <p className="text-xs text-secondary/40">เมื่อถึงวงเงิน AI จะหยุดตอบลูกค้าเองและแจ้งเตือนเจ้าของจนกว่าจะถึงวันถัดไป</p>

          <div className="flex items-end gap-2 border-t border-line/10 pt-3">
            <div className="flex-1">
              <label className="text-xs text-secondary/50">วงเงินสร้างวิดีโอ AI ต่อวัน (คลิป, 0/ว่าง = ไม่จำกัด)</label>
              <Input
                type="number"
                min={0}
                placeholder="เช่น 10"
                value={videoLimit}
                onChange={(e) => setVideoLimit(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void saveVideoLimit()} disabled={savingVideoLimit}>
              {savingVideoLimit ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
          <p className="text-xs text-secondary/40">วิดีโอ AI (Veo/Seedance) แพงที่สุด — ตั้งวงเงินกันค่าใช้จ่ายเกิน</p>
        </div>

        <div className="space-y-2 rounded-xl border border-line/10 p-4">
          <p className="font-medium text-secondary">AI สำหรับห้องกลยุทธ์ (Strategy Room)</p>
          <p className="text-xs text-secondary/50">
            Claude, GPT, Grok, DeepSeek, Kimi, GLM ในห้องกลยุทธ์ใช้การเชื่อมต่อ OpenRouter เดียวกับ TIGA AI Agent ด้านบน — เชื่อมครั้ง
            เดียวใช้ได้ทุกตัว ไม่ต้องตั้งค่าเพิ่มที่นี่
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-line/10 p-4">
          <p className="font-medium text-secondary">แจ้งเตือนฉุกเฉินผ่าน LINE</p>
          <p className="pt-1 text-sm text-secondary/70">
            เมื่อระบบ AI พบข้อผิดพลาดผิดปกติ (เช่น Gemini quota เต็มต่อเนื่อง) จะส่งข้อความแจ้งเตือนมาที่ LINE นี้อัตโนมัติ — หา User ID
            ได้จาก LINE Official Account Manager หรือให้ AI ตอบกลับ userId ในแชททดสอบ
          </p>
          <div className="flex items-end gap-2 pt-2">
            <Input placeholder="LINE User ID เจ้าของร้าน" value={ownerLineId} onChange={(e) => setOwnerLineId(e.target.value)} />
            <Button variant="outline" onClick={() => void saveOwnerLineId()} disabled={savingOwnerLineId || !ownerLineId.trim()}>
              {savingOwnerLineId ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
