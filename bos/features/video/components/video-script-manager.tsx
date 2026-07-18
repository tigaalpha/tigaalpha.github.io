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
import type { Tables } from "@/types/database";

interface VideoScriptManagerProps {
  scripts: Tables<"video_scripts">[];
  onChanged: () => void;
}

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

export function VideoScriptManager({ scripts, onChanged }: VideoScriptManagerProps) {
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<"th" | "en">("th");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ script: Tables<"video_scripts"> }>(
        "generate-video-script",
        { body: { topic: topic.trim(), language } }
      );
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from generate-video-script");

      setTopic("");
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
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-accent" />
            เขียนสคริปต์วิดีโอแนวตั้ง
          </CardTitle>
          <CardDescription>ใส่หัวข้อ ระบบจะเขียน Hook + สคริปต์แบ่งฉาก + แคปชั่น + แฮชแท็ก ให้อัตโนมัติ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="หัวข้อวิดีโอ เช่น 3 เทคนิคฝึกเปียโนให้ลูกไม่เบื่อ" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <div className="flex gap-2">
            {(["th", "en"] as const).map((lang) => (
              <Button key={lang} variant={language === lang ? "primary" : "outline"} size="sm" onClick={() => setLanguage(lang)}>
                {lang === "th" ? "ไทย" : "English"}
              </Button>
            ))}
          </div>
          {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <Button onClick={() => void handleGenerate()} disabled={generating || !topic.trim()}>
            {generating ? "กำลังเขียนสคริปต์…" : "สร้างสคริปต์"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {scripts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState icon={Captions} title="ยังไม่มีสคริปต์" description="สร้างสคริปต์แรกได้จากฟอร์มด้านบน" />
            </CardContent>
          </Card>
        ) : (
          scripts.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{s.topic}</CardTitle>
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
