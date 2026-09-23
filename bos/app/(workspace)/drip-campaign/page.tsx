"use client";

import { useEffect, useState } from "react";
import {
  Zap, MessageSquare, Mail, Clock, Users, Play, Pause, Settings,
  BarChart3, Send, Target, CheckCircle2, AlertCircle, Plus, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface DripCampaign {
  id: string;
  name: string;
  segment: string | null;
  messageTemplate: string;
  intervalDays: number;
  active: boolean;
  totalLeads: number;
  sentCount: number;
}

export default function DripCampaignPage() {
  const [campaigns, setCampaigns] = useState<DripCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      
      // Get drip campaigns from Supabase
      const { data: dripCampaigns, error } = await createClient()
        .from("drip_campaigns")
        .select("id, name, segment, message_template, interval_days, active");
      
      if (error) throw error;
      
      // Get customers count by segment
      const customers = await repos.customers.listPipeline();
      
      const campaignsData: DripCampaign[] = [];
      
      for (const campaign of dripCampaigns ?? []) {
        // Count customers in segment
        let segmentCustomers = customers;
        const seg = String(campaign.segment || "");
        if (seg === "hot") {
          segmentCustomers = customers.filter(c => c.sales_status === "contacted");
        } else if (seg === "cold") {
          segmentCustomers = customers.filter(c => c.sales_status === "new_lead");
        } else if (seg === "new") {
          segmentCustomers = customers.filter(c => c.sales_status === "new_lead");
        }
        
        // Count drip sends for this campaign
        const { count: sentCount } = await createClient()
          .from("drip_sends")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id);
        
        campaignsData.push({
          id: campaign.id,
          name: campaign.name,
          segment: String(campaign.segment || null),
          messageTemplate: campaign.message_template || "",
          intervalDays: campaign.interval_days || 7,
          active: campaign.active ?? true,
          totalLeads: segmentCustomers.length,
          sentCount: sentCount ?? 0,
        });
      }
      
      setCampaigns(campaignsData);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      // Fallback to empty state
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCampaigns(); }, []);

  const totalLeads = campaigns.reduce((s, c) => s + c.totalLeads, 0);
  const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
  const activeCampaigns = campaigns.filter(c => c.active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🤖 Drip Campaign Automation</h1>
          <p className="text-sm text-secondary/50">Sequence อัตโนมัติผ่าน LINE Messaging API — ข้อมูลจริงจาก Supabase</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadCampaigns} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">แคมเปญทั้งหมด</p>
          <p className="text-2xl font-bold text-secondary">{campaigns.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Active</p>
          <p className="text-2xl font-bold text-emerald-600">{activeCampaigns}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Lead ในระบบ</p>
          <p className="text-2xl font-bold text-secondary">{totalLeads}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">ส่งแล้ว</p>
          <p className="text-2xl font-bold text-primary">{totalSent}</p>
        </CardContent></Card>
      </div>

      {/* LINE API Status */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
              <MessageSquare className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-secondary">LINE Messaging API</p>
              <p className="text-xs text-secondary/40">เชื่อมต่อแล้ว — drip-runner ส่งอัตโนมัติทุก 6 ชม.</p>
            </div>
            <Badge variant="success">Connected</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Campaign List */}
      {loading ? (
        <div className="text-center py-8 text-secondary/50">กำลังโหลด...</div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <Zap className="h-12 w-12 text-secondary/20 mx-auto mb-4" />
            <p className="text-secondary/50">ยังไม่มี Drip Campaign</p>
            <p className="text-xs text-secondary/30 mt-2">สร้างแคมเปญแรกเพื่อเริ่มส่งข้อความอัตโนมัติ</p>
            <Button className="mt-4" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              สร้างแคมเปญ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const isSelected = selected === campaign.id;
            const completionPct = campaign.totalLeads > 0 ? Math.round((campaign.sentCount / campaign.totalLeads) * 100) : 0;
            
            return (
              <Card key={campaign.id} className={cn(isSelected && "ring-2 ring-primary/30")}>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-secondary">{campaign.name}</h3>
                        <p className="text-xs text-secondary/40">ทุก {campaign.intervalDays} วัน · Segment: {campaign.segment || "All"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={campaign.active ? "success" : "warning"}>
                        {campaign.active ? "Active" : "Paused"}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(isSelected ? null : campaign.id)}>
                        {isSelected ? "ปิด" : "ดูรายละเอียด"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-line/5 p-2">
                      <p className="text-lg font-bold text-secondary">{campaign.totalLeads}</p>
                      <p className="text-[10px] text-secondary/40">Lead</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50/5 p-2">
                      <p className="text-lg font-bold text-emerald-600">{campaign.sentCount}</p>
                      <p className="text-[10px] text-secondary/40">ส่งแล้ว</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 rounded-full bg-line/5 overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${completionPct}%` }} />
                  </div>

                  {/* Expanded Details */}
                  {isSelected && (
                    <div className="space-y-3 pt-3 border-t border-line/10">
                      <div className="rounded-lg bg-line/5 p-3">
                        <p className="text-xs font-medium text-secondary/60 mb-2">Message Template:</p>
                        <p className="text-sm text-secondary whitespace-pre-wrap">{campaign.messageTemplate || "ไม่มี template"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Play className="h-3 w-3 mr-1" />
                          {campaign.active ? "Pause" : "Resume"}
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="h-3 w-3 mr-1" />
                          แก้ไข
                        </Button>
                        <Button size="sm" variant="outline">
                          <Send className="h-3 w-3 mr-1" />
                          ส่งทันที
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Automation Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-accent" />
            Automation Rules
          </CardTitle>
          <CardDescription>กฎที่ใช้ trigger แคมเปญอัตโนมัติ — ทำงานผ่าน drip-runner edge function ทุก 6 ชั่วโมง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { trigger: "Lead ใหม่ทุกคน → Welcome Sequence", status: "active" },
            { trigger: "Lead ไม่ตอบกลับ 7 วัน → Nurture Sequence", status: "active" },
            { trigger: "Trial เสร็จสิ้น → Post-Trial Follow-up", status: "active" },
            { trigger: "Lead เงียบไป 14 วัน → Re-engagement", status: "active" },
            { trigger: "นักเรียนหยุดเรียน > 30 วัน → Win-back", status: "active" },
          ].map((rule, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
              <span className="text-xs text-secondary">{rule.trigger}</span>
              <Badge variant={rule.status === "active" ? "success" : "warning"}>
                {rule.status === "active" ? "Active" : "Paused"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
