"use client";

import { useEffect, useState } from "react";
import { Megaphone, Sparkles, Send, X, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Tables, AdCampaignStatus } from "@/types/database";

type Campaign = Tables<"ad_campaigns">;

const STATUS_LABEL: Record<AdCampaignStatus, string> = {
  draft: "ร่าง",
  pending_approval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
};

const STATUS_VARIANT: Record<AdCampaignStatus, "outline" | "warning" | "success" | "danger"> = {
  draft: "outline",
  pending_approval: "warning",
  approved: "success",
  rejected: "danger",
};

async function authedFetch(path: string, init?: RequestInit) {
  const { createClient } = await import("@/services/supabase/client");
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
  });
}

export function AdCampaignManager() {
  const [platform, setPlatform] = useState("facebook");
  const [objective, setObjective] = useState("");
  const [budgetHint, setBudgetHint] = useState("");
  const [generating, setGenerating] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCampaigns();
  }, []);

  async function loadCampaigns() {
    try {
      const response = await authedFetch("ad-campaigns");
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns ?? []);
      }
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    }
  }

  async function generate() {
    if (!objective.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await authedFetch("generate-ad-campaign", {
        method: "POST",
        body: JSON.stringify({ platform, objective: objective.trim(), budgetHint: budgetHint.trim() || undefined }),
      });
      const data = await response.json();
      if (response.ok) {
        setCampaigns((prev) => [data.campaign, ...(prev ?? [])]);
        setObjective("");
        setBudgetHint("");
      } else {
        setError(data.error ?? "สร้างแคมเปญไม่สำเร็จ");
      }
    } catch (err) {
      console.error("Failed to generate campaign:", err);
      setError("สร้างแคมเปญไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setGenerating(false);
    }
  }

  async function resolve(id: string, action: "submit" | "reject") {
    setBusyId(id);
    try {
      const response = await authedFetch("ad-campaigns", { method: "POST", body: JSON.stringify({ id, action }) });
      const data = await response.json();
      if (response.ok) {
        setCampaigns((prev) => (prev ?? []).map((c) => (c.id === id ? data.campaign : c)));
      } else {
        setError(data.error ?? "ดำเนินการไม่สำเร็จ");
      }
    } catch (err) {
      console.error("Failed to resolve campaign:", err);
    } finally {
      setBusyId(null);
    }
  }

  function copyBrief(campaign: Campaign) {
    const text = [
      `แพลตฟอร์ม: ${campaign.platform}`,
      `เป้าหมาย: ${campaign.objective}`,
      `กลุ่มเป้าหมาย: ${campaign.target_audience ?? "-"}`,
      `งบที่แนะนำ: ${campaign.budget_suggestion ?? "-"}`,
      `ข้อความโฆษณา:\n${campaign.ad_copy}`,
      `Creative brief: ${campaign.creative_brief ?? "-"}`,
    ].join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedField(campaign.id);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 text-sm text-info">
          AI ร่างกลยุทธ์และข้อความโฆษณาให้เท่านั้น — <b>ไม่ใช้เงินจริงเอง</b> ทุกแคมเปญต้องผ่านการอนุมัติที่หน้า
          &quot;การอนุมัติ&quot; ก่อน และแม้อนุมัติแล้วก็ยังต้องนำไปสร้างจริงใน Meta Ads Manager / Google Ads เอง
          (ยังไม่ได้เชื่อมต่อ API ยิงแอดโดยตรง)
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary-accent" />
            ร่างแคมเปญใหม่
          </CardTitle>
          <CardDescription>บอกเป้าหมายและงบคร่าวๆ ให้ AI ร่างกลุ่มเป้าหมาย ข้อความโฆษณา และ creative brief ให้</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="facebook">Facebook Ads</option>
              <option value="instagram">Instagram Ads</option>
              <option value="google">Google Ads</option>
              <option value="tiktok">TikTok Ads</option>
            </select>
            <Input placeholder="งบโดยประมาณ (ไม่บังคับ) เช่น 5,000 บาท/เดือน" value={budgetHint} onChange={(e) => setBudgetHint(e.target.value)} />
          </div>
          <Textarea
            placeholder="เป้าหมายแคมเปญ เช่น หาลูกค้าใหม่สำหรับคอร์สเปียโนเด็ก 6-12 ปี ในกรุงเทพ"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="min-h-24"
          />
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <Button className="w-full" onClick={() => void generate()} disabled={generating || !objective.trim()}>
            <Sparkles className="h-4 w-4" />
            {generating ? "กำลังร่าง..." : "ร่างแคมเปญ"}
          </Button>
        </CardContent>
      </Card>

      {campaigns === null ? null : campaigns.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-secondary/50">ยังไม่มีแคมเปญ</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{campaign.platform}</Badge>
                    <Badge variant={STATUS_VARIANT[campaign.status]}>{STATUS_LABEL[campaign.status]}</Badge>
                  </div>
                  <span className="text-xs text-secondary/50">{new Date(campaign.created_at).toLocaleString("th-TH")}</span>
                </div>
                <p className="text-sm font-medium text-secondary">{campaign.objective}</p>
                <div className="grid grid-cols-1 gap-2 text-sm text-secondary/80 md:grid-cols-2">
                  <p>
                    <span className="text-secondary/50">กลุ่มเป้าหมาย: </span>
                    {campaign.target_audience}
                  </p>
                  <p>
                    <span className="text-secondary/50">งบที่แนะนำ: </span>
                    {campaign.budget_suggestion}
                  </p>
                </div>
                <div className="rounded-lg bg-line/5 p-3 text-sm text-secondary">{campaign.ad_copy}</div>
                {campaign.creative_brief ? <p className="text-xs text-secondary/60">Creative brief: {campaign.creative_brief}</p> : null}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => copyBrief(campaign)}>
                    {copiedField === campaign.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    คัดลอก brief
                  </Button>
                  {campaign.status === "draft" ? (
                    <>
                      <Button size="sm" onClick={() => resolve(campaign.id, "submit")} disabled={busyId === campaign.id}>
                        <Send className="h-3 w-3" />
                        ส่งขออนุมัติ
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resolve(campaign.id, "reject")} disabled={busyId === campaign.id}>
                        <X className="h-3 w-3" />
                        ยกเลิก
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
