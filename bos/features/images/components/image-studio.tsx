"use client";

import { useState, useCallback } from "react";
import { Image as ImageIcon, Sparkles, Trash2, Download, HardDrive, ExternalLink, Loader2, FileText, Layers } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { describeFunctionError } from "@/lib/utils";
import { CHAT_MODELS } from "@/lib/chat-models";
import type { Tables } from "@/types/database";

interface ImageStudioProps {
  images: Tables<"generated_images">[];
  referencePhotos: Tables<"reference_photos">[];
  onChanged: () => void;
}

function dataUrl(row: Tables<"generated_images">): string {
  return `data:${row.mime_type};base64,${row.image_base64}`;
}

function referencePhotoDataUrl(row: Tables<"reference_photos">): string {
  return `data:${row.mime_type};base64,${row.image_base64}`;
}

interface SceneResult {
  sceneNumber: number;
  title: string;
  description: string;
  prompt: string;
  landscape: { mimeType: string; base64: string } | null;
  portrait: { mimeType: string; base64: string } | null;
}

export function ImageStudio({ images, referencePhotos, onChanged }: ImageStudioProps) {
  // ── Article → Scenes state ──
  const [article, setArticle] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [sceneCount, setSceneCount] = useState(4);
  const [analyzing, setAnalyzing] = useState(false);
  const [sceneResults, setSceneResults] = useState<SceneResult[]>([]);
  const [sceneError, setSceneError] = useState<string | null>(null);

  // ── Single image generation state (kept from original) ──
  const [prompt, setPrompt] = useState("");
  const [referencePhotoId, setReferencePhotoId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  // ── Article → Scene generation ──
  const handleAnalyzeArticle = useCallback(async () => {
    if (!article.trim()) return;
    setAnalyzing(true);
    setSceneError(null);
    setSceneResults([]);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ scenes: SceneResult[]; savedCount: number }>(
        "generate-article-images",
        { body: { article: article.trim(), model: selectedModel, sceneCount } }
      );
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response");

      setSceneResults(data.scenes ?? []);
      onChanged(); // refresh image gallery
    } catch (err) {
      setSceneError(await describeFunctionError(err));
    } finally {
      setAnalyzing(false);
    }
  }, [article, selectedModel, sceneCount, onChanged]);

  // ── Single image generation (original) ──
  async function handleGenerate(promptOverride?: string) {
    const finalPrompt = (promptOverride ?? prompt).trim();
    if (!finalPrompt) return;
    setGenerating(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ image: Tables<"generated_images"> }>(
        "generate-image",
        { body: { prompt: finalPrompt, referencePhotoId } }
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

  const articleCharCount = article.length;
  const QUICK_PROMPT = "Cute Chinese girl or guy playing piano, cyberpunk style, neon lighting, vertical portrait";

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: Article → Scene Images (NEW — at the top)
         ═══════════════════════════════════════════════════════════════ */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            วางบทความ → สร้างภาพทุกฉาก
          </CardTitle>
          <CardDescription>
            วางบทความยาวๆ → AI วิเคราะห์และแบ่งเป็นฉาก → สร้างภาพแนวนอน (16:9) และแนวตั้ง (9:16) ทุกฉาก
            สไตล์ Cyberpunk + Cyber Fantasy + Sci-Fi Concept Art
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Article Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-secondary/70">วางบทความ / Paste Article</label>
              <div className="flex items-center gap-2 text-[10px] text-secondary/40">
                <span>{articleCharCount} ตัวอักษร</span>
                <span>·</span>
                <span>สูงสุด 15,000</span>
              </div>
            </div>
            <textarea
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              placeholder={"วางบทความยาวๆ ที่นี่... AI จะวิเคราะห์และสร้างภาพให้ทุกฉาก\n\nตัวอย่าง:\n- บทความเกี่ยวกับการเรียนเปียโน\n- บทความการตลาด\n- บทความธุรกิจ\n- บทความท่องเที่ยว"}
              className="w-full rounded-xl border border-line/20 bg-background px-4 py-3 text-sm text-secondary placeholder:text-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none min-h-[200px]"
              rows={10}
            />
          </div>

          {/* Scene Count + AI Model Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-secondary/70 mb-1 block">จำนวนฉาก</label>
              <div className="flex gap-1.5">
                {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSceneCount(n)}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                      sceneCount === n
                        ? "bg-primary text-white"
                        : "bg-line/10 text-secondary/60 hover:bg-line/20"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-secondary/30 mt-1">×2 ภาพต่อฉาก = {sceneCount * 2} ภาพรวม</p>
            </div>
            <div>
              <label className="text-xs font-medium text-secondary/70 mb-1 block">AI Model วิเคราะห์</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-xl border border-line/20 bg-background px-3 py-2 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CHAT_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-secondary/30">🎨 สไตล์ภาพ: Cyberpunk + Cyber Fantasy + Sci-Fi Concept Art | สร้างภาพด้วย Gemini AI</p>

          {sceneError ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{sceneError}</p> : null}

          <Button
            onClick={handleAnalyzeArticle}
            disabled={analyzing || !article.trim()}
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          >
            {analyzing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังวิเคราะห์บทความและสร้างภาพ...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> วิเคราะห์บทความ → สร้างภาพทุกฉาก</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: Scene Results (shown after analysis)
         ═══════════════════════════════════════════════════════════════ */}
      {sceneResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              ผลลัพธ์จากบทความ ({sceneResults.length} ฉาก)
            </CardTitle>
            <CardDescription>
              แต่ละฉากมีภาพแนวนอน (landscape) และแนวตั้ง (portrait) — กดดาวน์โหลดเพื่อนำไปทำวิดีโอ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sceneResults.map((scene) => (
              <div key={scene.sceneNumber} className="rounded-xl border border-line/10 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="shrink-0 bg-primary/10 text-primary">ฉาก {scene.sceneNumber}</Badge>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-secondary">{scene.title}</h3>
                    <p className="text-xs text-secondary/60 mt-0.5">{scene.description}</p>
                    <p className="text-[10px] text-secondary/30 mt-1 line-clamp-2">Prompt: {scene.prompt}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Landscape */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-secondary/50 text-center">📐 แนวนอน 16:9</p>
                    {scene.landscape ? (
                      <div className="relative overflow-hidden rounded-lg border border-line/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:${scene.landscape.mimeType};base64,${scene.landscape.base64}`}
                          alt={`${scene.title} landscape`}
                          className="w-full aspect-video object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex justify-center bg-black/50 p-1.5 opacity-0 hover:opacity-100 transition-opacity">
                          <a href={`data:${scene.landscape.mimeType};base64,${scene.landscape.base64}`} download={`scene-${scene.sceneNumber}-landscape.png`}>
                            <Button variant="ghost" size="icon" className="text-white hover:text-white h-7 w-7">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-lg bg-line/5 flex items-center justify-center text-xs text-secondary/30">
                        ไม่สามารถสร้างภาพได้
                      </div>
                    )}
                  </div>

                  {/* Portrait */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-secondary/50 text-center">📱 แนวตั้ง 9:16</p>
                    {scene.portrait ? (
                      <div className="relative overflow-hidden rounded-lg border border-line/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:${scene.portrait.mimeType};base64,${scene.portrait.base64}`}
                          alt={`${scene.title} portrait`}
                          className="w-full aspect-[9/16] object-cover max-h-[300px]"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex justify-center bg-black/50 p-1.5 opacity-0 hover:opacity-100 transition-opacity">
                          <a href={`data:${scene.portrait.mimeType};base64,${scene.portrait.base64}`} download={`scene-${scene.sceneNumber}-portrait.png`}>
                            <Button variant="ghost" size="icon" className="text-white hover:text-white h-7 w-7">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-[9/16] rounded-lg bg-line/5 flex items-center justify-center text-xs text-secondary/30 max-h-[300px]">
                        ไม่สามารถสร้างภาพได้
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: Single Image Generation (original, kept)
         ═══════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-accent" />
            สร้างภาพนิ่งด้วย AI (ทีละภาพ)
          </CardTitle>
          <CardDescription>
            อธิบายภาพที่ต้องการเป็นคำพูดง่ายๆ ไว้ใช้เป็นภาพประกอบวิดีโอ
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

          {referencePhotos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-secondary/50">
                รูปภาพอ้างอิง (ไม่บังคับ) — เลือกเพื่อให้ AI สร้างภาพโดยใช้หน้าคนในรูปนี้
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReferencePhotoId(null)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-1.5 text-xs",
                    referencePhotoId === null ? "border-primary-accent text-secondary" : "border-line/10 text-secondary/50"
                  )}
                >
                  ไม่ใช้รูปอ้างอิง
                </button>
                {referencePhotos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setReferencePhotoId(photo.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border-2 py-1 pl-1 pr-3 text-xs",
                      referencePhotoId === photo.id ? "border-primary-accent text-secondary" : "border-line/10 text-secondary/50"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={referencePhotoDataUrl(photo)} alt={photo.label} className="h-6 w-6 rounded-full object-cover" />
                    {photo.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <Button onClick={() => void handleGenerate()} disabled={generating || !prompt.trim()}>
            {generating ? "กำลังสร้างภาพ…" : "สร้างภาพ"}
          </Button>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: Gallery (all images)
         ═══════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle>ภาพที่สร้างไว้ ({images.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {driveError ? <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{driveError}</p> : null}
          {images.length === 0 ? (
            <EmptyState icon={ImageIcon} title="ยังไม่มีภาพ" description="วางบทความด้านบนแล้วกดวิเคราะห์ หรือสร้างภาพทีละภาพ" />
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
