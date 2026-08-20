"use client";

import { useState } from "react";
import { Layers, Video, FileText, Music2, Globe, Share2, Sparkles, ArrowRight, Copy, Check, ExternalLink, Clock, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OutputFormat {
  platform: string;
  icon: string;
  color: string;
  format: string;
  duration: string;
  status: "generated" | "pending";
  content: string;
}

const SOURCE_CONTENT = {
  title: "นักเรียนของเราเล่น Moonlight Sonata ได้แล้ว!",
  type: "วิดีโอ 60 วินาที",
  platform: "TikTok",
  description: "คลิปนักเรียนเล่น Moonlight Sonata หลังเรียน 3 เดือน — พร้อม voice-over",
};

const OUTPUTS: OutputFormat[] = [
  { platform: "TikTok", icon: "🎵", color: "bg-black", format: "วิดีโอ 15 วินาที (hook แรก)", duration: "15s", status: "generated", content: "🎹 แค่ 3 เดือนก็เล่น Moonlight Sonata ได้! น้องทiantian เก่งมากค่ะ 🎹 แค่ 3 เดือนก็เล่น Moonlight Sonata ได้แล้ว! สมัครเรียนวันนี้ ทดลองฟรี 30 นาที 📲 Line: @tigastudio #เปียโน #เรียนเปียโน #MoonlightSonata #TIGA" },
  { platform: "Instagram", icon: "📸", color: "bg-pink-500", format: "Reel 30 วินาที + Carousel", duration: "30s", status: "generated", content: "📸 สตอรี่ความสำเร็จ 🎹 น้องทiantian เล่น Moonlight Sonata ได้แล้วค่ะ! 🎵 หลังเรียนแค่ 3 เดือนกับ TIGA Studio ✨ สิ่งที่ทำให้น้องเก่งเร็ว: ✅ ครูสอนตัวต่อตัว ✅ แผนการเรียนเฉพาะบุคคล ✅ เทคนิคที่เหมาะกับเด็ก 📲 จองเรียนทดลองฟรี 30 นาที — Line: @tigastudio #เปียโน #MoonlightSonata #TIGAStudio" },
  { platform: "YouTube", icon: "📺", color: "bg-red-500", format: "Short 60 วินาที", duration: "60s", status: "generated", content: "📺 [Full Clip] น้องทiantian เล่น Moonlight Sonata — TIGA Studio 🎹 น้องทiantian อายุ 8 ขวบ เรียนเปียโนกับ TIGA Studio มา 3 เดือน วันนี้เล่น Moonlight Sonata ได้แล้วค่ะ! 🎵 ถ้าลูกคุณอยากเล่นเปียโนเป็น เริ่มจากการทดลองเรียนฟรี 30 นาที สมัคร: Line @tigastudio #เปียโน #MoonlightSonata #TIGAStudio #PianoLesson" },
  { platform: "Facebook", icon: "📘", color: "bg-blue-600", format: "Video Post + Caption", duration: "60s", status: "generated", content: "📘 🎹 ความสำเร็จของน้องทiantian! 🎵 หลังเรียนเปียโนกับ TIGA Studio ได้ 3 เดือน วันนี้น้องเล่น Moonlight Sonata ได้แล้วค่ะ! ✨ ทุกคนเล่นเปียโนเป็นได้ ถ้ามีครูที่ใช่และวิธีการที่ถูก 📲 จองเรียนทดลองฟรี 30 นาที Line: @tigastudio" },
  { platform: "LINE", icon: "💬", color: "bg-green-500", format: "Broadcast Message", duration: "ข้อความ", status: "generated", content: "💬 🎹 ข่าวดีค่ะ! น้องทiantian เล่น Moonlight Sonata ได้แล้วค่ะ หลังเรียนแค่ 3 เดือน 🎵 ถ้าอยากให้ลูกเล่นเปียโนเป็น เริ่มจากการทดลองเรียนฟรี 30 นาทีค่ะ 📲 Line: @tigastudio" },
  { platform: "X", icon: "🐦", color: "bg-gray-800", format: "Thread (3 tweets)", duration: "ข้อความ", status: "generated", content: "🐦 1/3 🎹 แค่ 3 เดือนก็เล่น Moonlight Sonata ได้! น้องทiantian อายุ 8 ขวบ เรียนกับ TIGA Studio 🎵 2/3 สิ่งที่ทำให้น้องเก่งเร็ว: ✅ ครูสอนตัวต่อตัว ✅ แผนการเรียนเฉพาะบุคคล ✅ เทคนิค適合เด็ก 3/3 ถ้าลูกคุณอยากเล่นเปียโน 📲 Line: @tigastudio ทดลองฟรี 30 นาที #เปียโน #TIGAStudio" },
  { platform: "Blog", icon: "📝", color: "bg-amber-500", format: "SEO Article 800 คำ", duration: "บทความ", status: "generated", content: "📝 H1: นักเรียน 8 ขวบเล่น Moonlight Sonata ได้ใน 3 เดือน — เรื่องจริงจาก TIGA Studio\n\nเนื้อหา: บทความ SEO เกี่ยวกับวิธีการสอนเปียโนของ TIGA Studio ที่ทำให้เด็กเล่นเปียโนระดับยากได้ในเวลาสั้น — พร้อม keyword 'เรียนเปียโนเด็ก', 'Moonlight Sonata', 'TIGA Studio'" },
];

export default function ContentRepurposePage() {
  const [selectedOutput, setSelectedOutput] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-secondary">🔄 Content Repurposing Engine</h1>
        <p className="text-sm text-secondary/50">AI แปลง content 1 ชิ้น → 7 platforms อัตโนมัติ</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Source Content</p><p className="text-2xl font-bold text-secondary">1</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Output Formats</p><p className="text-2xl font-bold text-primary">{OUTPUTS.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Generated</p><p className="text-2xl font-bold text-emerald-600">{OUTPUTS.filter((o) => o.status === "generated").length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Time Saved</p><p className="text-2xl font-bold text-amber-600">~4 ชม.</p></CardContent></Card>
      </div>

      {/* Source Content */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-primary-accent" />Source Content</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-xl">🎬</div>
              <div><p className="text-sm font-medium text-secondary">{SOURCE_CONTENT.title}</p>
                <p className="text-xs text-secondary/40">{SOURCE_CONTENT.type} · {SOURCE_CONTENT.platform}</p>
                <p className="text-xs text-secondary/50 mt-1">{SOURCE_CONTENT.description}</p></div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs text-primary">AI กำลังแปลงเป็น {OUTPUTS.length}  formats...</span>
          </div>
        </CardContent></Card>

      {/* Flow Diagram */}
      <Card><CardContent className="pt-4">
        <div className="flex items-center justify-center gap-2 overflow-x-auto">
          <div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary shrink-0">🎬 Source</div>
          <ArrowRight className="h-4 w-4 text-secondary/30 shrink-0" />
          <div className="rounded-xl bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-500 shrink-0">🧠 AI</div>
          <ArrowRight className="h-4 w-4 text-secondary/30 shrink-0" />
          <div className="flex gap-1 shrink-0">
            {OUTPUTS.map((o, i) => (<span key={i} className="text-lg">{o.icon}</span>))}
          </div>
        </div>
      </CardContent></Card>

      {/* Outputs */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-secondary">Generated Content ({OUTPUTS.length} formats)</h2>
        {OUTPUTS.map((output, i) => (
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
