"use client";

import { useState } from "react";
import { Swords, Sparkles, Trash2, ExternalLink, ShieldCheck, ShieldAlert, Radar } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

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
        <Card className="lg:col-span-1">
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

        <Card className="lg:col-span-2">
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
  const direct = analysis.competitors.filter((c) => c.type === "direct");
  const indirect = analysis.competitors.filter((c) => c.type === "indirect");
  const compete = analysis.strategies.filter((s) => s.approach === "compete");
  const avoid = analysis.strategies.filter((s) => s.approach === "avoid");

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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <CompetitorGroup title={`คู่แข่งทางตรง — โรงเรียนสอนเปียโนในไทย (${direct.length})`} competitors={direct} tone="danger" />
          <CompetitorGroup title={`คู่แข่งทางอ้อม — แอปสอนเปียโนระดับโลก (${indirect.length})`} competitors={indirect} tone="warning" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <StrategyGroup title="ควรเอาชนะด้วยวิธีนี้" icon={ShieldCheck} entries={compete} tone="success" />
          <StrategyGroup title="ควรหลบเลี่ยง" icon={ShieldAlert} entries={avoid} tone="danger" />
        </div>

        {analysis.sources.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-secondary/60">แหล่งอ้างอิงจากเว็บ ({analysis.sources.length})</p>
            <ul className="space-y-1">
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
          </div>
        ) : null}
      </CardContent>
    </>
  );
}

function CompetitorGroup({
  title,
  competitors,
  tone,
}: {
  title: string;
  competitors: Tables<"competitor_analyses">["competitors"];
  tone: "danger" | "warning";
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-secondary/60">{title}</p>
      {competitors.length === 0 ? (
        <p className="rounded-xl border border-line/5 px-3 py-3 text-xs text-secondary/40">ไม่พบข้อมูล</p>
      ) : (
        <ul className="space-y-2">
          {competitors.map((c, i) => (
            <li key={i} className="rounded-xl border border-line/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-secondary">{c.name}</p>
                <Badge variant={tone === "danger" ? "danger" : "warning"}>{c.category}</Badge>
              </div>
              {c.marketingChannels.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.marketingChannels.map((ch, j) => (
                    <span key={j} className="rounded-full bg-line/10 px-2 py-0.5 text-[11px] text-secondary/60">
                      {ch}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-1.5 text-xs text-secondary/60">{c.notes}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
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
