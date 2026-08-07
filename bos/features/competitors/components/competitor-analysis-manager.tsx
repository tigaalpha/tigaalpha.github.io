"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Swords, Sparkles, Trash2, ExternalLink, ShieldCheck, ShieldAlert, Radar, Globe } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { cn, describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

// Same categorical slot order as the dataviz skill / finance-charts.tsx:
// slot 1 (blue) / slot 2 (orange) / slot 3 (aqua) — kept fixed so colors
// don't shuffle between renders or chart types.
const COLORS = {
  light: { direct: "#2a78d6", indirect: "#eb6834", bar: "#2a78d6", grid: "rgb(28 22 14 / 0.08)", text: "rgb(28 22 14 / 0.5)" },
  dark: { direct: "#3987e5", indirect: "#d95926", bar: "#3987e5", grid: "rgb(237 232 224 / 0.1)", text: "rgb(237 232 224 / 0.5)" },
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

interface CompetitorAnalysisManagerProps {
  analyses: Tables<"competitor_analyses">[];
  onChanged: () => void;
}

export function CompetitorAnalysisManager({ analyses, onChanged }: CompetitorAnalysisManagerProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(analyses[0]?.id ?? null);

  const selected = analyses.find((a) => a.id === selectedId) ?? analyses[0] ?? null;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ analysis: Tables<"competitor_analyses"> }>(
        "generate-competitor-analysis"
      );
      if (fnError) throw fnError;
      onChanged();
      if (data?.analysis) setSelectedId(data.analysis.id);
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.competitorAnalyses.delete(id);
    if (selectedId === id) setSelectedId(null);
    onChanged();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary-accent" />
            วิเคราะห์คู่แข่งใหม่
          </CardTitle>
          <CardDescription>
            AI ค้นข้อมูลจริงจากเว็บ หาคู่แข่งทางตรง (โรงเรียนสอนเปียโนในไทย) และคู่แข่งทางอ้อม (แอปสอนเปียโนระดับโลก) พร้อมสรุปว่าแต่ละเจ้าทำการตลาดแบบไหน
            แล้วแนะนำว่าควรเอาชนะด้วยวิธีไหน หรือหลบเลี่ยงด้วยวิธีไหน — ทุกข้อมูลมีแหล่งอ้างอิงแนบมาด้วย
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button onClick={() => void handleGenerate()} disabled={generating}>
            <Sparkles className="h-4 w-4" />
            {generating ? "กำลังค้นข้อมูลคู่แข่งและวิเคราะห์… (อาจใช้เวลาสักครู่)" : "วิเคราะห์คู่แข่งใหม่"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="order-2 lg:order-1 lg:col-span-1">
          <CardHeader>
            <CardTitle>ประวัติการวิเคราะห์ ({analyses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {analyses.length === 0 ? (
              <EmptyState icon={Swords} title="ยังไม่มีการวิเคราะห์" description="กดวิเคราะห์คู่แข่งใหม่ด้านบน" />
            ) : (
              <ul className="space-y-2">
                {analyses.map((a) => {
                  const directCount = a.competitors.filter((c) => c.type === "direct").length;
                  const indirectCount = a.competitors.filter((c) => c.type === "indirect").length;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                          selected?.id === a.id ? "border-primary/40 bg-primary/5" : "border-line/5 hover:bg-line/5"
                        )}
                      >
                        <p className="text-xs text-secondary/40">{new Date(a.created_at).toLocaleString("th-TH")}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-secondary">{a.summary}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-secondary/40">
                          <span>คู่แข่งทางตรง {directCount}</span>
                          <span>·</span>
                          <span>คู่แข่งทางอ้อม {indirectCount}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2 lg:col-span-2">
          {selected ? (
            <CompetitorAnalysisDetail analysis={selected} onDelete={() => handleDelete(selected.id)} />
          ) : (
            <CardContent>
              <EmptyState icon={Swords} title="เลือกรายงาน" description="เลือกรายงานจากประวัติด้านซ้ายเพื่อดูรายละเอียด" />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function CompetitorAnalysisDetail({ analysis, onDelete }: { analysis: Tables<"competitor_analyses">; onDelete: () => void }) {
  const isDark = useIsDarkMode();
  const palette = isDark ? COLORS.dark : COLORS.light;

  const direct = analysis.competitors.filter((c) => c.type === "direct");
  const indirect = analysis.competitors.filter((c) => c.type === "indirect");
  const compete = analysis.strategies.filter((s) => s.approach === "compete");
  const avoid = analysis.strategies.filter((s) => s.approach === "avoid");

  const landscapeData = useMemo(
    () => [
      { name: "คู่แข่งทางตรง", value: direct.length, color: palette.direct },
      { name: "คู่แข่งทางอ้อม", value: indirect.length, color: palette.indirect },
    ],
    [direct.length, indirect.length, palette]
  );

  const channelData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of analysis.competitors) {
      for (const ch of c.marketingChannels) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [analysis.competitors]);

  return (
    <>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>รายงานวิเคราะห์คู่แข่ง</CardTitle>
          <CardDescription>{new Date(analysis.created_at).toLocaleString("th-TH")}</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        <p className="rounded-xl bg-line/5 p-4 text-sm text-secondary">{analysis.summary}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="คู่แข่งทางตรง" value={direct.length} icon={Swords} tone="danger" />
          <StatCard label="คู่แข่งทางอ้อม" value={indirect.length} icon={Globe} tone="warning" />
          <StatCard label="ควรเอาชนะ" value={compete.length} icon={ShieldCheck} tone="success" />
          <StatCard label="ควรหลบเลี่ยง" value={avoid.length} icon={ShieldAlert} tone="danger" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-secondary/50">สัดส่วนคู่แข่งทางตรง vs ทางอ้อม</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={landscapeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {landscapeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-secondary/50">ช่องทางการตลาดที่คู่แข่งใช้บ่อยที่สุด</p>
            {channelData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-xs text-secondary/40">ไม่พบข้อมูลช่องทาง</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={channelData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={palette.grid} />
                  <XAxis type="number" allowDecimals={false} stroke={palette.text} fontSize={12} tickLine={false} />
                  <YAxis type="category" dataKey="channel" width={110} stroke={palette.text} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => [`${value} เจ้า`, "ใช้ช่องทางนี้"]} />
                  <Bar dataKey="count" name="จำนวนคู่แข่งที่ใช้" fill={palette.bar} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-secondary/50">รายชื่อคู่แข่งทั้งหมด ({analysis.competitors.length})</p>
          {analysis.competitors.length === 0 ? (
            <p className="rounded-xl border border-line/5 px-3 py-3 text-xs text-secondary/40">ไม่พบข้อมูล</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line/10">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line/10 bg-line/5 text-left text-xs text-secondary/50">
                    <th className="px-3 py-2">ชื่อ</th>
                    <th className="px-3 py-2">ประเภท</th>
                    <th className="px-3 py-2">ช่องทางการตลาด</th>
                    <th className="px-3 py-2">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.competitors.map((c, i) => (
                    <tr key={i} className="border-b border-line/5 align-top last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium text-secondary">{c.name}</p>
                        <p className="text-xs text-secondary/40">{c.category}</p>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={c.type === "direct" ? "danger" : "warning"}>
                          {c.type === "direct" ? "ทางตรง" : "ทางอ้อม"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {c.marketingChannels.map((ch, j) => (
                            <span key={j} className="rounded-full bg-line/10 px-2 py-0.5 text-[11px] text-secondary/60">
                              {ch}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-secondary/60">{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <StrategyGroup title="ควรเอาชนะด้วยวิธีนี้" icon={ShieldCheck} entries={compete} tone="success" />
          <StrategyGroup title="ควรหลบเลี่ยง" icon={ShieldAlert} entries={avoid} tone="danger" />
        </div>

        {analysis.sources.length > 0 ? (
          <details className="space-y-1.5">
            <summary className="cursor-pointer text-xs font-medium text-secondary/60">แหล่งอ้างอิงจากเว็บ ({analysis.sources.length})</summary>
            <ul className="mt-2 space-y-1">
              {analysis.sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate text-xs text-primary-accent underline"
                  >
                    {s.title || s.url} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </>
  );
}

function StrategyGroup({
  title,
  icon: Icon,
  entries,
  tone,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  entries: Tables<"competitor_analyses">["strategies"];
  tone: "success" | "danger";
}) {
  return (
    <div className="space-y-2">
      <p className={cn("flex items-center gap-1.5 text-xs font-medium", tone === "success" ? "text-success" : "text-danger")}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-line/5 px-3 py-3 text-xs text-secondary/40">ไม่มีข้อเสนอแนะ</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((s, i) => (
            <li key={i} className={cn("rounded-xl border p-3", tone === "success" ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5")}>
              <p className="text-sm font-semibold text-secondary">{s.title}</p>
              <p className="mt-1 text-xs text-secondary/70">{s.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
