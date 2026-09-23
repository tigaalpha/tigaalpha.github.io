"use client";

import { useEffect, useState } from "react";
import { Smartphone, Eye, Clock, TrendingUp, RefreshCw, Check, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface MobileMetric {
  label: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "stable";
  description: string;
}

interface MobileOptimization {
  id: string;
  title: string;
  status: "completed" | "in_progress" | "pending";
  impact: "high" | "medium" | "low";
  description: string;
}

export default function MobileContentPage() {
  const [metrics, setMetrics] = useState<MobileMetric[]>([]);
  const [optimizations, setOptimizations] = useState<MobileOptimization[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      // Sample mobile metrics
      setMetrics([
        { label: "Mobile Traffic", value: 72, unit: "%", trend: "up", description: "72% ของ traffic ทั้งหมดมาจาก mobile" },
        { label: "Mobile Bounce Rate", value: 35, unit: "%", trend: "down", description: "อัตราการออกจากหน้าเว็บ" },
        { label: "Mobile Avg Session", value: 2.5, unit: "นาที", trend: "up", description: "เวลาเฉลี่ยต่อ session" },
        { label: "Mobile Conversion", value: 3.2, unit: "%", trend: "up", description: "อัตราการ转换บน mobile" },
      ]);
      
      setOptimizations([
        { id: "1", title: "ปรับ Font Size สำหรับ Mobile", status: "completed", impact: "high", description: "เพิ่ม font size เป็น 16px สำหรับ mobile" },
        { id: "2", title: "优化 Touch Targets", status: "completed", impact: "high", description: "ปุ่มต่างๆ มีขนาด 44x44px ขึ้นไป" },
        { id: "3", title: "เพิ่ม AMP Pages", status: "in_progress", impact: "medium", description: "สร้าง AMP version สำหรับบทความ SEO" },
        { id: "4", title: "优化 Image Loading", status: "completed", impact: "high", description: "ใช้ lazy loading สำหรับรูปภาพ" },
        { id: "5", title: "เพิ่ม Push Notifications", status: "in_progress", impact: "medium", description: "แจ้งเตือนเมื่อมี content ใหม่" },
        { id: "6", title: "ปรับ CTA สำหรับ Mobile", status: "pending", impact: "high", description: "ปุ่ม CTA ขนาดใหญ่และชัดเจน" },
      ]);
    } catch (err) {
      console.error("Failed to load mobile data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const completedOptimizations = optimizations.filter(o => o.status === "completed");
  const inProgressOptimizations = optimizations.filter(o => o.status === "in_progress");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">📱 Mobile-First Content</h1>
          <p className="text-sm text-secondary/50">ปรับ Content ให้เหมาะกับ Mobile — 72% ของ traffic มาจาก Mobile</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Mobile Traffic</p><p className="text-2xl font-bold text-primary">72%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Completed</p><p className="text-2xl font-bold text-emerald-600">{completedOptimizations.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">In Progress</p><p className="text-2xl font-bold text-amber-600">{inProgressOptimizations.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Pending</p><p className="text-2xl font-bold text-secondary">{optimizations.filter(o => o.status === "pending").length}</p></CardContent></Card>
      </div>

      {/* Mobile Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary-accent" />Mobile Metrics</CardTitle>
          <CardDescription>สถิติการใช้งานบน Mobile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.map((metric, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-line/10 p-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">{metric.trend === "up" ? "📈" : metric.trend === "down" ? "📉" : "➡️"}</span>
                <div>
                  <p className="text-sm font-medium text-secondary">{metric.label}</p>
                  <p className="text-[10px] text-secondary/40">{metric.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-secondary">{metric.value}{metric.unit}</p>
                <Badge variant={metric.trend === "up" ? "success" : metric.trend === "down" ? "danger" : "outline"} className="text-[9px]">
                  {metric.trend === "up" ? "↑" : metric.trend === "down" ? "↓" : "→"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Mobile Optimizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary-accent" />Mobile Optimizations</CardTitle>
          <CardDescription>รายการปรับปรุงสำหรับ Mobile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {optimizations.map(opt => (
            <div key={opt.id} className="rounded-xl border border-line/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{opt.status === "completed" ? "✅" : opt.status === "in_progress" ? "🔄" : "⏳"}</span>
                  <div>
                    <p className="text-sm font-medium text-secondary">{opt.title}</p>
                    <p className="text-[10px] text-secondary/40">{opt.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={opt.impact === "high" ? "danger" : opt.impact === "medium" ? "warning" : "outline"} className="text-[9px]">
                    {opt.impact === "high" ? "🔴 High" : opt.impact === "medium" ? "🟡 Medium" : "🟢 Low"}
                  </Badge>
                  <Badge variant={opt.status === "completed" ? "success" : opt.status === "in_progress" ? "info" : "outline"} className="text-[9px]">
                    {opt.status === "completed" ? "Done" : opt.status === "in_progress" ? "In Progress" : "Pending"}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Mobile Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Check className="h-5 w-5 text-emerald-500" />Mobile Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            "✅ Font size 16px ขึ้นไปสำหรับ readability",
            "✅ Touch targets 44x44px ขึ้นไป",
            "✅ Lazy loading สำหรับรูปภาพ",
            "✅ Responsive design ทุกหน้า",
            "✅ Fast loading (< 3 วินาที)",
            "✅ CTA ชัดเจนและ lớn สำหรับ mobile",
            "✅ Form fields น้อยที่สุด",
            "✅ Click-to-call button สำหรับ phone",
          ].map((item, i) => (
            <div key={i} className="rounded-lg bg-emerald-50/5 px-3 py-2 text-xs text-emerald-700">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
