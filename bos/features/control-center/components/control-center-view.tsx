"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, TrendingUp, TrendingDown, Minus, Users, Target, ShieldCheck, Bot, AlertTriangle, Cpu } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { sumTransactions } from "@/lib/business-metrics";

interface ControlCenterData {
  revenue30d: number;
  profit30d: number;
  cashFlowForecast: { projectedNet30Days: number; trend: "up" | "down" | "stable"; confidence: "high" | "low" };
  leadsInPipeline: number;
  wonThisPeriod: number;
  cac: { value: number | null; confidence: "high" | "low" };
  ltv: { value: number | null; confidence: "high" | "low" };
  aiUsage: { source: string; totalTokens: number }[];
  pendingApprovals: number;
  agentPerformance: Record<string, { success: number; failed: number }>;
  riskFlags: { workflowId: string; goal: string; title: string; description: string }[];
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus } as const;
const TREND_LABEL = { up: "แนวโน้มดีขึ้น", down: "แนวโน้มแย่ลง", stable: "ทรงตัว" } as const;

export function ControlCenterView() {
  const [data, setData] = useState<ControlCenterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const repos = createRepositories(supabase);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    Promise.all([
      repos.transactions.listBetween(thirtyDaysAgo, today),
      repos.growthMetrics.cashFlowForecast(),
      repos.sales.funnelCounts(),
      repos.growthMetrics.cac90Days(),
      repos.growthMetrics.ltv(),
      repos.aiUsage.bySourceLast30Days(),
      repos.approvals.pendingCount(),
      repos.agentWorkflows.agentPerformanceCounts(30),
      repos.agentWorkflows.recentHighPriorityActions(5),
    ])
      .then(([transactions, cashFlowForecast, funnelCounts, cac, ltv, aiUsage, pendingApprovals, agentPerformance, riskFlags]) => {
        const { revenue: revenue30d, profit: profit30d } = sumTransactions(transactions);

        setData({
          revenue30d,
          profit30d,
          cashFlowForecast,
          leadsInPipeline: Object.entries(funnelCounts)
            .filter(([status]) => status !== "won" && status !== "lost" && status !== "renewed")
            .reduce((sum, [, count]) => sum + count, 0),
          wonThisPeriod: funnelCounts.won + funnelCounts.renewed,
          cac,
          ltv,
          aiUsage,
          pendingApprovals,
          agentPerformance,
          riskFlags,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  if (error) return <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>;
  if (!data) return <EmptyState icon={Cpu} title="กำลังโหลดข้อมูล…" />;

  const TrendIcon = TREND_ICON[data.cashFlowForecast.trend];
  const ltvCacRatio = data.cac.value && data.ltv.value ? (data.ltv.value / data.cac.value).toFixed(1) : null;
  const lowConfidenceHint = (confidence: "high" | "low") => (confidence === "low" ? "ข้อมูลจำกัด — ยังตัดสินใจตามตัวเลขนี้ไม่ได้เต็มที่" : undefined);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="รายได้ 30 วันล่าสุด" value={formatCurrency(data.revenue30d)} icon={Wallet} />
        <StatCard label="กำไรสุทธิ 30 วันล่าสุด" value={formatCurrency(data.profit30d)} icon={Wallet} tone={data.profit30d >= 0 ? "success" : "danger"} />
        <StatCard
          label="คาดการณ์กระแสเงินสด 30 วันข้างหน้า"
          value={formatCurrency(data.cashFlowForecast.projectedNet30Days)}
          icon={TrendIcon}
          hint={lowConfidenceHint(data.cashFlowForecast.confidence) ?? TREND_LABEL[data.cashFlowForecast.trend]}
          tone={data.cashFlowForecast.trend === "down" ? "danger" : data.cashFlowForecast.trend === "up" ? "success" : "default"}
        />
        <StatCard label="ลูกค้าในไปป์ไลน์" value={data.leadsInPipeline} icon={Users} hint={`ปิดการขายแล้ว ${data.wonThisPeriod} ราย`} />
        <StatCard label="CAC (90 วัน)" value={data.cac.value != null ? formatCurrency(data.cac.value) : "ยังไม่มีข้อมูลพอ"} icon={Target} hint={lowConfidenceHint(data.cac.confidence)} />
        <StatCard label="LTV โดยประมาณ" value={data.ltv.value != null ? formatCurrency(data.ltv.value) : "ยังไม่มีข้อมูลพอ"} icon={Target} hint={lowConfidenceHint(data.ltv.confidence)} />
        <StatCard label="LTV : CAC" value={ltvCacRatio ? `${ltvCacRatio} เท่า` : "—"} icon={Target} />
        <StatCard label="รออนุมัติ" value={data.pendingApprovals} icon={ShieldCheck} href="/approvals" tone={data.pendingApprovals > 0 ? "warning" : "default"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary-accent" />
              ผลงาน AI Agent (30 วันล่าสุด)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(data.agentPerformance).length === 0 ? (
              <EmptyState icon={Bot} title="ยังไม่มีการเรียกใช้ Agent" />
            ) : (
              <div className="space-y-2">
                {Object.entries(data.agentPerformance).map(([agentId, counts]) => (
                  <div key={agentId} className="flex items-center justify-between text-sm">
                    <span className="text-secondary">{agentId}</span>
                    <span className="text-secondary/50">
                      สำเร็จ {counts.success} / ล้มเหลว {counts.failed}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary-accent" />
              การใช้งาน AI (token, 30 วันล่าสุด)
            </CardTitle>
            <CardDescription>นับเฉพาะฟีเจอร์ที่มีการบันทึกต้นทุนแล้ว (CEO Agent, รายงานสรุป) — ยังไม่ครอบคลุมทุกฟีเจอร์ AI ในระบบ</CardDescription>
          </CardHeader>
          <CardContent>
            {data.aiUsage.length === 0 ? (
              <EmptyState icon={Cpu} title="ยังไม่มีข้อมูลการใช้งาน" />
            ) : (
              <div className="space-y-2">
                {data.aiUsage.map((row) => (
                  <div key={row.source} className="flex items-center justify-between text-sm">
                    <span className="text-secondary">{row.source}</span>
                    <span className="text-secondary/50">{row.totalTokens.toLocaleString("th-TH")} tokens</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            สิ่งที่ AI ตั้งข้อสังเกตล่าสุด
          </CardTitle>
          <CardDescription>
            รวบรวมจากรายงาน CEO Agent ล่าสุดที่ระบุความสำคัญสูง — ดูรายงานเต็มได้ที่{" "}
            <Link href="/ai-company" className="text-primary-accent underline">
              AI Company
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.riskFlags.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="ยังไม่มีข้อสังเกตสำคัญ" description="ลองสั่งให้ CEO Agent วิเคราะห์เป้าหมายทางธุรกิจที่ /ai-company" />
          ) : (
            <div className="space-y-3">
              {data.riskFlags.map((flag, index) => (
                <div key={index} className="rounded-lg bg-line/5 p-3">
                  <p className="text-sm font-medium text-secondary">{flag.title}</p>
                  <p className="text-xs text-secondary/60">{flag.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
