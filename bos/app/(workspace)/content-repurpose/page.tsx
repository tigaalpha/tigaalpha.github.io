"use client";

import { useEffect, useState } from "react";
import { Layers, Video, FileText, Music2, Globe, Share2, Sparkles, ArrowRight, Copy, Check, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface OutputFormat {
  platform: string;
  icon: string;
  color: string;
  format: string;
  duration: string;
  status: "generated" | "pending";
  content: string;
}

function generateRepurposedContent(title: string, description: string): OutputFormat[] {
  return [
    { platform: "TikTok", icon: "🎵", color: "bg-black", format: "วิดีโอ 15 วินาที", duration: "15s", status: "generated", content: `🎵 ${title}\n\n${description}\n\n📲 Line: @tigastudio\n#เปียโน #เรียนเปียโน #TIGA` },
    { platform: "Instagram", icon: "📸", color: "bg-pink-500", format: "Reel 30 วินาที", duration: "30s", status: "generated", content: `📸 ${title}\n\n${description}\n\n📲 จองเรียนทดลองฟรี 30 นาที\nLine: @tigastudio\n#เปียโน #TIGAStudio` },
    { platform: "YouTube", icon: "📺", color: "bg-red-500", format: "Short 60 วินาที", duration: "60s", status: "generated", content: `📺 ${title}\n\n${description}\n\nถ้าอยากเล่นเปียโนเป็น เริ่มจากการทดลองเรียนฟรี 30 นาที\nสมัคร: Line @tigastudio\n#เปียโน #TIGAStudio` },
    { platform: "Facebook", icon: "📘", color: "bg-blue-600", format: "Video Post", duration: "60s", status: "generated", content: `📘 🎹 ${title}\n\n${description}\n\n📲 จองเรียนทดลองฟรี 30 นาที\nLine: @tigastudio` },
    { platform: "LINE", icon: "💬", color: "bg-green-500", format: "Broadcast", duration: "ข้อความ", status: "generated", content: `💬 🎹 ${title}\n\n${description}\n\nถ้าอยากเล่นเปียโนเป็น เริ่มจากการทดลองเรียนฟรี 30 นาทีค่ะ` },
    { platform: "X", icon: "🐦", color: "bg-gray-800", format: "Thread", duration: "ข้อความ", status: "generated", content: `🐦 ${title}\n\n${description}\n\nLine: @tigastudio\n#เปียโน #TIGAStudio` },
    { platform: "Blog", icon: "📝", color: "bg-amber-500", format: "SEO Article", duration: "บทความ", status: "generated", content: `📝 H1: ${title}\n\n${description}\n\nKeyword: เรียนเปียโน, TIGA Studio` },
  ];
}

export default function ContentRepurposePage() {
  const [sources, setSources] = useState<{ id: string; title: string; type: string; description: string }[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<OutputFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      
      // Get articles as source content
      const articles = await repos.articles.list();
      const videoScripts = await repos.videoScripts.list();
      
      const sourcesList = [
        ...articles.slice(0, 5).map(a => ({
          id: a.id,
          title: a.title || "ไม่มีชื่อ",
          type: "article",
          description: (a.content as string || "").slice(0, 100) || "บทความ SEO",
        })),
        ...videoScripts.slice(0, 3).map((v: Record<string, unknown>) => ({
          id: String(v.id || ""),
          title: String(v.topic || v.hook || "ไม่มีชื่อ"),
          type: "video",
          description: String(v.script || "").slice(0, 100) || "วิดีโอสคริปต์",
        })),
      ];
      
      setSources(sourcesList);
      if (sourcesList.length > 0) {
        const first = sourcesList[0];
        if (first) {
          setSelectedSource(first.id);
          setOutputs(generateRepurposedContent(first.title, first.description));
        }
      }
    } catch (err) {
      console.error("Failed to load content:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function handleSelectSource(id: string) {
    setSelectedSource(id);
    const source = sources.find(s => s.id === id);
    if (source) {
      setOutputs(generateRepurposedContent(source.title, source.description));
    }
  }

  const totalGenerated = outputs.filter(o => o.status === "generated").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🔄 Content Repurposing Engine</h1>
          <p className="text-sm text-secondary/50">AI แปลง content 1 ชิ้น → 7 platforms — ข้อมูลจริงจาก Supabase</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Source Content</p><p className="text-2xl font-bold text-secondary">{sources.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Output Formats</p><p className="text-2xl font-bold text-primary">{outputs.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Generated</p><p className="text-2xl font-bold text-emerald-600">{totalGenerated}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Time Saved</p><p className="text-2xl font-bold text-amber-600">~{totalGenerated * 30} นาที</p></CardContent></Card>
      </div>

      {/* Source Content Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-primary-accent" />Source Content</CardTitle>
          <CardDescription>เลือก content ที่ต้องการแปลง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="text-center py-4 text-secondary/50">กำลังโหลด...</div>
          ) : sources.length === 0 ? (
            <div className="text-center py-4 text-secondary/50">ยังไม่มี content</div>
          ) : (
            sources.map(source => (
              <div
                key={source.id}
                className={cn("flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors", selectedSource === source.id ? "border-primary bg-primary/5" : "border-line/10 hover:bg-line/5")}
                onClick={() => handleSelectSource(source.id)}
              >
                <span className="text-xl">{source.type === "article" ? "📝" : "🎬"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary">{source.title}</p>
                  <p className="text-xs text-secondary/40">{source.type} · {source.description.slice(0, 50)}...</p>
                </div>
                {selectedSource === source.id && <Badge variant="success">เลือกแล้ว</Badge>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Flow Diagram */}
      <Card><CardContent className="pt-4">
        <div className="flex items-center justify-center gap-2 overflow-x-auto">
          <div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary shrink-0">🎬 Source</div>
          <ArrowRight className="h-4 w-4 text-secondary/30 shrink-0" />
          <div className="rounded-xl bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-500 shrink-0">🧠 AI</div>
          <ArrowRight className="h-4 w-4 text-secondary/30 shrink-0" />
          <div className="flex gap-1 shrink-0">
            {outputs.map((o, i) => (<span key={i} className="text-lg">{o.icon}</span>))}
          </div>
        </div>
      </CardContent></Card>

      {/* Outputs */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-secondary">Generated Content ({outputs.length} formats)</h2>
        {outputs.map((output, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{output.icon}</span>
                  <div><p className="text-sm font-medium text-secondary">{output.platform}</p>
                    <p className="text-[10px] text-secondary/40">{output.format} · {output.duration}</p></div>
                </div>
                <Badge variant="success" className="text-[9px]">✅ Generated</Badge>
              </div>
              <div className="rounded-lg bg-line/5 p-3 text-xs text-secondary whitespace-pre-wrap max-h-32 overflow-auto">{output.content}</div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(output.content); setCopied(i); setTimeout(() => setCopied(null), 1500); }}>
                  {copied === i ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied === i ? "คัดลอกแล้ว" : "คัดลอก"}
                </Button>
                <Button size="sm" variant="ghost"><Share2 className="h-3 w-3 mr-1" />โพสต์</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
