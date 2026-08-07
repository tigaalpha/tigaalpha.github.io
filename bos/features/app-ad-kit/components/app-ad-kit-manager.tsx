"use client";

import { useState } from "react";
import { Link2, Sparkles, ImagePlus, Clapperboard, ExternalLink } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { describeFunctionError, cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface AppAdKitManagerProps {
  kits: Tables<"app_ad_kits">[];
  onChanged: () => void;
}

const VIDEO_CONCEPT_LABEL = {
  feature_highlight: "วิดีโอแนะนำฟีเจอร์",
  testimonial_review: "วิดีโอรีวิวประสบการณ์ใช้จริง",
} as const;

export function AppAdKitManager({ kits, onChanged }: AppAdKitManagerProps) {
  const [appUrl, setAppUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(kits[0]?.id ?? null);
  const [generatingImageFor, setGeneratingImageFor] = useState<number | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const selected = kits.find((k) => k.id === selectedId) ?? null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!appUrl.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ appAdKit: Tables<"app_ad_kits"> }>("generate-app-ad-kit", {
        body: { appUrl: appUrl.trim() },
      });
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from generate-app-ad-kit");

      setAppUrl("");
      onChanged();
      setSelectedId(data.appAdKit.id);
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateFeatureImage(kit: Tables<"app_ad_kits">, featureIndex: number, imagePrompt: string) {
    setGeneratingImageFor(featureIndex);
    setImageError(null);
    try {
      const supabase = createClient();
      const repos = createRepositories(supabase);
      const { data, error: fnError } = await supabase.functions.invoke<{ image: Tables<"generated_images"> }>("generate-image", {
        body: { prompt: imagePrompt },
      });
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from generate-image");

      await repos.appAdKits.addImage(kit.id, kit.image_ids, data.image.id);
      onChanged();
    } catch (err) {
      setImageError(await describeFunctionError(err));
    } finally {
      setGeneratingImageFor(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary-accent" />
            สร้างชุดโฆษณาแอปจาก URL
          </CardTitle>
          <CardDescription>
            วางลิงก์แอป (Play Store / App Store / เว็บไซต์แอป) — AI จะค้นข้อมูลจริง เลือก 5 ฟีเจอร์เด่นที่สุด แล้วเขียนบทความ +
            เตรียม prompt สำหรับสร้างภาพนิ่งและวิดีโอ (แนะนำฟีเจอร์ และรีวิวประสบการณ์ใช้จริง) ให้ครบชุด
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="https://play.google.com/store/apps/details?id=..."
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={generating}>
              <Sparkles className="h-4 w-4" />
              {generating ? "กำลังค้นข้อมูลและสร้างชุดโฆษณา…" : "สร้างชุดโฆษณา"}
            </Button>
          </form>
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>ชุดโฆษณาที่สร้างไว้ ({kits.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {kits.length === 0 ? (
              <EmptyState icon={Link2} title="ยังไม่มีชุดโฆษณา" description="วางลิงก์แอปด้านบนเพื่อเริ่ม" />
            ) : (
              <ul className="space-y-2">
                {kits.map((kit) => (
                  <li key={kit.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(kit.id)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                        selectedId === kit.id ? "border-primary/40 bg-primary/5" : "border-line/5 hover:bg-line/5"
                      )}
                    >
                      <p className="truncate text-sm font-medium text-secondary">{kit.app_name}</p>
                      <p className="truncate text-xs text-secondary/40">{kit.app_url}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selected ? (
            <CardContent className="space-y-6 pt-6">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-secondary">{selected.app_name}</h2>
                  <a href={selected.app_url} target="_blank" rel="noreferrer" className="text-secondary/40 hover:text-primary-accent">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <p className="text-sm text-secondary/70">{selected.summary}</p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-secondary">5 ฟีเจอร์เด่น</h3>
                {imageError ? <p className="mb-2 text-xs text-danger">{imageError}</p> : null}
                <div className="space-y-3">
                  {selected.top_features.map((feature, i) => (
                    <div key={i} className="rounded-xl border border-line/10 p-3">
                      <p className="text-sm font-medium text-secondary">{feature.title}</p>
                      <p className="mt-1 text-xs text-secondary/60">{feature.description}</p>
                      <p className="mt-2 text-xs italic text-secondary/40">Image prompt: {feature.imagePrompt}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleGenerateFeatureImage(selected, i, feature.imagePrompt)}
                        disabled={generatingImageFor === i}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {generatingImageFor === i ? "กำลังสร้างภาพ…" : "สร้างภาพฟีเจอร์นี้"}
                      </Button>
                    </div>
                  ))}
                </div>
                {selected.image_ids.length > 0 ? (
                  <p className="mt-2 text-xs text-secondary/50">
                    สร้างภาพแล้ว {selected.image_ids.length} รูป — ดูและดาวน์โหลดได้ที่หน้า Image Studio
                  </p>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-secondary">บทความ</h3>
                <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/10 p-4 text-sm text-secondary/80">
                  {selected.article_markdown}
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-secondary">
                  <Clapperboard className="h-4 w-4" />
                  แนวคิดวิดีโอ (เลือกแนวตั้งหรือแนวนอนได้ตอนสร้างจริงที่หน้า Vertical Video)
                </h3>
                <div className="space-y-3">
                  {selected.video_concepts.map((concept, i) => (
                    <div key={i} className="rounded-xl border border-line/10 p-3">
                      <Badge variant="default">{VIDEO_CONCEPT_LABEL[concept.type] ?? concept.type}</Badge>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-secondary/80">{concept.script}</p>
                      <p className="mt-2 text-xs italic text-secondary/40">Video prompt: {concept.videoPrompt}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-secondary/50">
                  ขั้นตอนต่อไป: ไปที่หน้า Vertical Video → เลือกภาพฟีเจอร์ที่สร้างไว้ด้านบน → วาง Video prompt นี้ →
                  เลือกโมเดล (แนะนำ Seedance Fast หรือ MiniMax Hailuo ถ้าอยากประหยัด)
                </p>
              </div>

              {selected.sources.length > 0 ? (
                <details className="text-xs text-secondary/50">
                  <summary className="cursor-pointer">แหล่งข้อมูล ({selected.sources.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {selected.sources.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-primary-accent hover:underline">
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </CardContent>
          ) : (
            <CardContent>
              <EmptyState icon={Link2} title="เลือกชุดโฆษณา" description="เลือกจากรายการด้านซ้าย หรือสร้างใหม่ด้านบน" />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
