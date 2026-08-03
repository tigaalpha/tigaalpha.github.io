"use client";

import { useState } from "react";
import { Image as ImageIcon, Sparkles, Trash2, Download, HardDrive, ExternalLink } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface ImageStudioProps {
  images: Tables<"generated_images">[];
  onChanged: () => void;
}

function dataUrl(row: Tables<"generated_images">): string {
  return `data:${row.mime_type};base64,${row.image_base64}`;
}

const QUICK_PROMPT = "Cute Chinese girl or guy playing piano, cyberpunk style, neon lighting, vertical portrait";

export function ImageStudio({ images, onChanged }: ImageStudioProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  async function handleGenerate(promptOverride?: string) {
    const finalPrompt = (promptOverride ?? prompt).trim();
    if (!finalPrompt) return;
    setGenerating(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ image: Tables<"generated_images"> }>(
        "generate-image",
        { body: { prompt: finalPrompt } }
      );
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from generate-image");

      setPrompt("");
      onChanged();
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.generatedImages.delete(id);
    onChanged();
  }

  async function handleSaveToDrive(id: string) {
    setUploadingId(id);
    setDriveError(null);
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ driveViewUrl: string }>("drive-upload-image", {
        body: { imageId: id },
      });
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from drive-upload-image");
      onChanged();
    } catch (err) {
      setDriveError(await describeFunctionError(err));
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-accent" />
            สร้างภาพนิ่งด้วย AI
          </CardTitle>
          <CardDescription>
            อธิบายภาพที่ต้องการเป็นคำพูดง่ายๆ (เช่น &quot;เด็กหญิงกำลังเล่นเปียโนอย่างมีความสุข แสงอบอุ่นยามเย็น
            สไตล์ภาพถ่ายจริง แนวตั้ง&quot;) ไว้ใช้เป็นภาพประกอบวิดีโอแนวตั้งในอนาคต
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => void handleGenerate(QUICK_PROMPT)}
            disabled={generating}
          >
            <Sparkles className="h-4 w-4 text-primary-accent" />
            {generating ? "กำลังสร้างภาพ…" : "สร้างด่วน: เด็กเล่นเปียโนสไตล์ Cyberpunk"}
          </Button>
          <Textarea
            placeholder="อธิบายภาพที่ต้องการ…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-24"
          />
          {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <Button onClick={() => void handleGenerate()} disabled={generating || !prompt.trim()}>
            {generating ? "กำลังสร้างภาพ…" : "สร้างภาพ"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ภาพที่สร้างไว้ ({images.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {driveError ? <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{driveError}</p> : null}
          {images.length === 0 ? (
            <EmptyState icon={ImageIcon} title="ยังไม่มีภาพ" description="สร้างภาพแรกได้จากฟอร์มด้านบน" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((img) => (
                <div key={img.id} className="group relative overflow-hidden rounded-xl border border-line/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dataUrl(img)} alt={img.prompt} className="aspect-[9/16] w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <a href={dataUrl(img)} download={`tiga-${img.id}.png`}>
                      <Button variant="ghost" size="icon" className="text-white hover:text-white">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    {img.drive_view_url ? (
                      <a href={img.drive_view_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="text-success hover:text-success" title="เปิดใน Google Drive">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:text-white"
                        title="บันทึกไปยัง Google Drive"
                        onClick={() => void handleSaveToDrive(img.id)}
                        disabled={uploadingId === img.id}
                      >
                        <HardDrive className={uploadingId === img.id ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-white hover:text-white" onClick={() => void handleDelete(img.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
