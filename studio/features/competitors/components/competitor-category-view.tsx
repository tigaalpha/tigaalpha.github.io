"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ArrowLeft, Swords, Globe, ShieldCheck, ShieldAlert, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

export type CompetitorCategoryKind = "direct" | "indirect" | "compete" | "avoid";

const COLORS = {
  light: { bar: "#2a78d6", grid: "rgb(28 22 14 / 0.08)", text: "rgb(28 22 14 / 0.5)" },
  dark: { bar: "#3987e5", grid: "rgb(237 232 224 / 0.1)", text: "rgb(237 232 224 / 0.5)" },
};

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

const KIND_CONFIG: Record<
  CompetitorCategoryKind,
  { title: string; description: string; icon: LucideIcon; tone: "success" | "danger" | "warning" }
> = {
  direct: { title: "คู่แข่งทางตรง", description: "โรงเรียน/สตูดิโอสอนเปียโนในไทย", icon: Swords, tone: "danger" },
  indirect: { title: "คู่แข่งทางอ้อม", description: "แอปสอนเปียโนระดับโลก", icon: Globe, tone: "warning" },
  compete: { title: "กลยุทธ์ที่ควรเอาชนะ", description: "ช่องทาง/วิธีที่ Tiga Studio ควรลงแข่งโดยตรง", icon: ShieldCheck, tone: "success" },
  avoid: { title: "กลยุทธ์ที่ควรหลบเลี่ยง", description: "ช่องทาง/วิธีที่ไม่คุ้มจะแข่งตรงๆ", icon: ShieldAlert, tone: "danger" },
};

interface CompetitorCategoryViewProps {
  analysis: Tables<"competitor_analyses"> | null;
  kind: CompetitorCategoryKind;
}

export function CompetitorCategoryView({ analysis, kind }: CompetitorCategoryViewProps) {
  const isDark = useIsDarkMode();
  const palette = isDark ? COLORS.dark : COLORS.light;
  const config = KIND_CONFIG[kind];

  const competitors = useMemo(
    () => (kind === "direct" || kind === "indirect" ? analysis?.competitors.filter((c) => c.type === kind) ?? [] : []),
    [analysis, kind]
  );
  const strategies = useMemo(
    () => (kind === "compete" || kind === "avoid" ? analysis?.strategies.filter((s) => s.approach === kind) ?? [] : []),
    [analysis, kind]
  );

  const channelData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of competitors) {
      for (const ch of c.marketingChannels) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [competitors]);

  return (
    <div className="space-y-6">
      <Link href="/competitors" className="inline-flex items-center gap-1.5 text-sm text-secondary/60 hover:text-secondary">
        <ArrowLeft className="h-4 w-4" />
        กลับหน้าวิเคราะห์คู่แข่ง
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", config.tone === "success" ? "text-success" : config.tone === "warning" ? "text-warning" : "text-danger")}>
            <config.icon className="h-4 w-4" />
            {config.title}
          </CardTitle>
          <CardDescription>
            {config.description}
            {analysis ? ` — จากรายงานล่าสุด ${new Date(analysis.created_at).toLocaleString("th-TH")}` : null}
          </CardDescription>
        </CardHeader>
      </Card>

      {!analysis ? (
        <EmptyState icon={config.icon} title="ยังไม่มีการวิเคราะห์" description="กลับไปกดวิเคราะห์คู่แข่งใหม่ที่หน้าหลักก่อน" />
      ) : kind === "direct" || kind === "indirect" ? (
        <>
          {channelData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">ช่องทางการตลาดที่ใช้บ่อยที่สุด</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(160, channelData.length * 36)}>
                  <BarChart data={channelData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={palette.grid} />
                    <XAxis type="number" allowDecimals={false} stroke={palette.text} fontSize={12} tickLine={false} />
                    <YAxis type="category" dataKey="channel" width={130} stroke={palette.text} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => [`${value} เจ้า`, "ใช้ช่องทางนี้"]} />
                    <Bar dataKey="count" name="จำนวนคู่แข่งที่ใช้" fill={palette.bar} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}

          {competitors.length === 0 ? (
            <EmptyState icon={config.icon} title="ไม่พบคู่แข่งกลุ่มนี้" description="รายงานล่าสุดไม่พบข้อมูลในหมวดนี้" />
          ) : (
            <div className="space-y-3">
              {competitors.map((c, i) => (
                <Card key={i}>
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-base font-semibold text-secondary">{c.name}</p>
                      <Badge variant={config.tone === "warning" ? "warning" : "danger"}>{c.category}</Badge>
                    </div>
                    {c.marketingChannels.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {c.marketingChannels.map((ch, j) => (
                          <span key={j} className="rounded-full bg-line/10 px-2.5 py-1 text-xs text-secondary/60">
                            {ch}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-sm text-secondary/70">{c.notes}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : strategies.length === 0 ? (
        <EmptyState icon={config.icon} title="ไม่มีข้อเสนอแนะกลุ่มนี้" description="รายงานล่าสุดไม่พบข้อมูลในหมวดนี้" />
      ) : (
        <div className="space-y-3">
          {strategies.map((s, i) => (
            <Card key={i} className={cn(config.tone === "success" ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5")}>
              <CardContent className="p-5">
                <p className="text-base font-semibold text-secondary">{s.title}</p>
                <p className="mt-1.5 text-sm text-secondary/70">{s.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
