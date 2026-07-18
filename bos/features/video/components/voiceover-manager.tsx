"use client";

import { useState } from "react";
import { Mic, Copy, Check, Trash2, Sparkles } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface VoiceoverManagerProps {
  scripts: Tables<"voiceover_scripts">[];
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

export function VoiceoverManager({ scripts, onChanged }: VoiceoverManagerProps) {
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
      const { data, error: fnError } = await supabase.functions.invoke<{ script: Tables<"voiceover_scripts"> }>(
        "generate-voiceover",
        { body: { topic: topic.trim(), language } }
      );
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from generate-voiceover");

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
    await repos.voiceoverScripts.delete(id);
    onChanged();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-accent" />
            เขียนบท Voice Over
          </CardTitle>
          <CardDescription>
            สำหรับวิดีโอไลฟ์สไตล์และท่องเที่ยว เจาะกลุ่มคุณแม่ชนชั้นสูงและชนชั้นกลางตอนบน — โทนอบอุ่น หรูหราแบบไม่ยัดเยียด ไม่ขายของตรงๆ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="หัวข้อ เช่น เช้าวันพักผ่อนริมทะเลที่หัวหิน" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <div className="flex gap-2">
            {(["th", "en"] as const).map((lang) => (
              <Button key={lang} variant={language === lang ? "primary" : "outline"} size="sm" onClick={() => setLanguage(lang)}>
                {lang === "th" ? "ไทย" : "English"}
              </Button>
            ))}
          </div>
          {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <Button onClick={() => void handleGenerate()} disabled={generating || !topic.trim()}>
            {generating ? "กำลังเขียนบท…" : "สร้างบท Voice Over"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {scripts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState icon={Mic} title="ยังไม่มีบท Voice Over" description="สร้างบทแรกได้จากฟอร์มด้านบน" />
            </CardContent>
          </Card>
        ) : (
          scripts.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{s.topic}</CardTitle>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton value={s.script} />
                    <Button variant="ghost" size="icon" onClick={() => void handleDelete(s.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-xl bg-line/5 p-3 text-sm text-secondary">{s.script}</pre>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
