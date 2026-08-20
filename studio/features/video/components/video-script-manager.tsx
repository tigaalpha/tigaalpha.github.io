"use client";

import { useState } from "react";
import { Captions, Copy, Check, Trash2, Sparkles } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { describeFunctionError } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CHAT_MODELS } from "@/lib/chat-models";
import type { Tables } from "@/types/database";

interface VideoScriptManagerProps {
  scripts: Tables<"video_scripts">[];
  onChanged: () => void;
}

const TOPICS = [
  { value: "เปียโนดนตรี", label: "เปียโนดนตรี", labelEn: "Piano Music", labelZh: "钢琴音乐" },
  { value: "นวัตกรรมการเรียนเปียโน", label: "นวัตกรรมการเรียนเปียโน", labelEn: "Piano Learning Innovation", labelZh: "钢琴学习创新" },
  { value: "การประยุกต์ใช้เทคโนโลยีกับดนตรีและเปียโน", label: "การประยุกต์ใช้เทคโนโลยีกับดนตรีและเปียโน", labelEn: "Technology in Music & Piano", labelZh: "科技与音乐钢琴" },
  { value: "ดนตรีบำบัด", label: "ดนตรีบำบัด", labelEn: "Music Therapy", labelZh: "音乐治疗" },
  { value: "เทคโนโลยีปัญญาประดิษฐ์และการเรียนเปียโน", label: "เทคโนโลยีปัญญาประดิษฐ์และการเรียนเปียโน", labelEn: "AI & Piano Learning", labelZh: "人工智能与钢琴学习" },
  { value: "การตลาดสำหรับศิลปินสายดนตรี", label: "การตลาดสำหรับศิลปินสายดนตรี", labelEn: "Music Artist Marketing", labelZh: "音乐艺术家营销" },
];

const LANGUAGES = [
  { value: "th" as const, label: "ไทย", flag: "🇹🇭" },
  { value: "en" as const, label: "English", flag: "🇬🇧" },
  { value: "zh" as const, label: "中文", flag: "🇨🇳" },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function LanguageBadge({ lang }: { lang: string }) {
  const found = LANGUAGES.find((l) => l.value === lang);
  return (
    <Badge variant="outline" className="text-[10px]">
      {found?.flag} {found?.label ?? lang}
    </Badge>
  );
}

export function VideoScriptManager({ scripts, onChanged }: VideoScriptManagerProps) {
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [language, setLanguage] = useState<"th" | "en" | "zh">("th");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini");

  const effectiveTopic = topic === "__custom__" ? customTopic : topic;

  async function handleQuickContent() {
    setGenerating(true);
    setError(null);
    try {
      const supabase = createClient();
      // Random topic from predefined list
      const randomIdx = Math.floor(Math.random() * TOPICS.length);
      const randomTopic = TOPICS[randomIdx]!.value;
      const { data, error: fnError } = await supabase.functions.invoke<{ scripts: Array<Record<string, unknown>>; count: number }>(
        "generate-video-script",
        { body: { topic: randomTopic, language: "all", model: selectedModel } }
      );
      if (fnError) throw fnError;
      if (!data || data.count === 0) throw new Error("AI ไม่สามารถสร้างสคริปต์ได้ กรุณาลองใหม่");
      onChanged();
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate() {
    if (!effectiveTopic.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ script: Tables<"video_scripts">; scripts: Array<Record<string, unknown>> }>(
        "generate-video-script",
        { body: { topic: effectiveTopic.trim(), language, model: selectedModel } }
      );
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from generate-video-script");

      setTopic("");
      setCustomTopic("");
      onChanged();
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.videoScripts.delete(id);
    onChanged();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-accent" />
                เขียนสคริปต์ TikTok 25 บรรทัด
              </CardTitle>
              <CardDescription className="mt-1">
                เลือกหัวข้อ + เลือกภาษา กดปุ่มเดียวได้สคริปต์เลย
              </CardDescription>
            </div>
            <Button
              onClick={() => void handleQuickContent()}
              disabled={generating}
              className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
            >
              {generating ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  กำลังสร้าง…
                </>
              ) : (
                <>
                  ⚡ Quick Content
                </>
              )}
            </Button>
          </div>
          {generating && (
            <p className="text-xs text-primary-accent animate-pulse">
              ⚡ กำลังสร้างสคริปต์ 3 ภาษา (ไทย + English + 中文) พร้อมกัน…
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Topic selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary/60">เลือกหัวข้อ</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">— เลือกหัวข้อ —</option>
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
              <option value="__custom__">พิมพ์หัวข้อเอง…</option>
            </select>
          </div>

          {/* Custom topic input */}
          {topic === "__custom__" && (
            <Input
              placeholder="พิมพ์หัวข้อที่ต้องการ"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
            />
          )}

          {/* Language selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary/60">เลือกภาษา</label>
            <div className="flex gap-2">
              {LANGUAGES.map((lang) => (
                <Button
                  key={lang.value}
                  variant={language === lang.value ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setLanguage(lang.value)}
                  className={cn(
                    "gap-1.5",
                    language === lang.value && "ring-2 ring-primary/40"
                  )}
                >
                  <span>{lang.flag}</span>
                  {lang.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Model selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary/60">Model AI</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {CHAT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

          <Button
            onClick={() => void handleGenerate()}
            disabled={generating || !effectiveTopic.trim()}
            className="w-full"
          >
            {generating ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                กำลังเขียนสคริปต์…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                สร้างสคริปต์
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {scripts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState icon={Captions} title="ยังไม่มีสคริปต์" description="เลือกหัวข้อและภาษากดสร้างสคริปต์แรกได้เลย" />
            </CardContent>
          </Card>
        ) : (
          scripts.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{s.topic}</CardTitle>
                      <LanguageBadge lang={s.language} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-primary-accent">{s.hook}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton value={`${s.hook}\n\n${s.script}\n\n${s.caption}\n\n${s.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`} />
                    <Button variant="ghost" size="icon" onClick={() => void handleDelete(s.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="whitespace-pre-wrap rounded-xl bg-line/5 p-3 text-sm text-secondary">{s.script}</pre>
                <p className="text-sm text-secondary/70">{s.caption}</p>
                <div className="flex flex-wrap gap-1">
                  {s.hashtags.map((h) => (
                    <Badge key={h} variant="outline">
                      #{h.replace(/^#/, "")}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
