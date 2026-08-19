"use client";

import { useState, useCallback } from "react";
import {
  Zap,
  PenTool,
  BarChart3,
  Target,
  Megaphone,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  Brain,
  Hash,
  MessageSquare,
  Users,
  TrendingUp,
  Calendar,
  Share2,
  Video,
  BookOpen,
  FileText,
  TestTube,
  DollarSign,
  Compass,
  Flame,
  Send,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";

/* ── Types ── */

interface SkillResult {
  toolType: string;
  topic: string;
  language: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  model: string;
  createdAt: string;
}

type TierId = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

/* ── Tool definitions organized by tier ── */

const TIERS: {
  id: TierId;
  name: string;
  icon: typeof Zap;
  color: string;
  description: string;
  tools: {
    id: string;
    name: string;
    icon: typeof Zap;
    description: string;
    placeholder: string;
  }[];
}[] = [
  {
    id: "tier1",
    name: "Writing Formats",
    icon: PenTool,
    color: "text-blue-500",
    description: "สร้างเนื้อหาทุก formats สำหรับทุก platform",
    tools: [
      { id: "hook-writer", name: "Hook Writer", icon: Zap, description: "เขียน Hook 10 แบบ หยุด scroll ทันที", placeholder: "เช่น ทำไมเด็กไทยเก่งกว่าเด็กนอก 3 เท่า..." },
      { id: "caption-writer", name: "Caption Writer", icon: FileText, description: "เขียน Caption 5 แบบ สำหรับทุก platform", placeholder: "เช่น โปรโมชั่นคอร์สเรียนเปียโนใหม่..." },
      { id: "tiktok-script", name: "TikTok Script", icon: Video, description: "สคริปต์ TikTok 25 บรรทัด เต็มรูปแบบ", placeholder: "เช่น เปรียบเทียบการเรียนเปียโน 2 วิธี..." },
      { id: "reels-script", name: "Reels Script", icon: Video, description: "สคริปต์ Instagram Reels 20 บรรทัด", placeholder: "เช่น Behind the scenes ห้องเรียนเปียโน..." },
      { id: "linkedin-post", name: "LinkedIn Post", icon: Users, description: "เขียน LinkedIn Post 3 แบบ ไม่ cringe", placeholder: "เช่น วิสัยทัศน์การศึกษาดนตรีไทย..." },
      { id: "thread-writer", name: "X Thread", icon: MessageSquare, description: "เขียน Thread 8 tweets น่าติดตาม", placeholder: "เช่น 7 เหตุผลที่เด็กควรเรียนเปียโน..." },
      { id: "carousel-writer", name: "Carousel", icon: Share2, description: "สร้าง Carousel 10 slides พร้อม design notes", placeholder: "เช่น 5 ข้อผิดพลาดเมื่อเลือกโรงเรียนเปียโน..." },
    ],
  },
  {
    id: "tier2",
    name: "Strategy & Planning",
    icon: Brain,
    color: "text-purple-500",
    description: "วางแผนกลยุทธ์และจัดการ content อย่างมีระบบ",
    tools: [
      { id: "content-calendar", name: "Content Calendar", icon: Calendar, description: "สร้างปฏิทิน content 14 วัน พร้อม posting schedule", placeholder: "เช่น วางแผน content เดือนหน้าสำหรับ Tiga Studio..." },
      { id: "hashtag-strategy", name: "Hashtag Strategy", icon: Hash, description: "วิเคราะห์ hashtag 3 ระดับ พร้อม strategy", placeholder: "เช่น สร้าง hashtag strategy สำหรับ piano studio..." },
      { id: "repurpose", name: "Cross-Platform Repurpose", icon: Share2, description: "เปลี่ยน 1 content เป็น 7 platform formats", placeholder: "เช่น เปลี่ยนบทความเรื่อง benefit ของการเล่นเปียโน เป็น content ทุก platform..." },
    ],
  },
  {
    id: "tier3",
    name: "Brand & Research",
    icon: Target,
    color: "text-green-500",
    description: "สร้างแบรนด์และวิเคราะห์ตลาดเชิงลึก",
    tools: [
      { id: "brand-profile", name: "Brand Profile Builder", icon: Target, description: "สร้าง Brand Profile ครบ 10 หัวข้อ", placeholder: "เช่น สร้าง brand profile สำหรับ Tiga Studio..." },
      { id: "voice-guide", name: "Voice Guide", icon: PenTool, description: "สร้างคู่มือเสียงของแบรนด์ พร้อมตัวอย่าง", placeholder: "เช่น สร้าง voice guide ให้ brand ดูเป็นกันเองแต่เชี่ยวชาญ..." },
      { id: "audience-research", name: "Audience Research", icon: Users, description: "วิเคราะห์กลุ่มเป้าหมายเชิงลึก", placeholder: "เช่น วิเคราะห์พ่อแม่ที่กำลังมองหาโรงเรียนเปียโนให้ลูก..." },
      { id: "dm-script", name: "DM Scripts", icon: MessageSquare, description: "สร้างสคริปต์ DM ขาย 5 สถานการณ์", placeholder: "เช่น สคริปต์ DM สำหรับ follow up ลูกค้าที่มา trial แล้ว..." },
      { id: "funnel-builder", name: "Funnel Builder", icon: TrendingUp, description: "สร้าง lead generation funnel ครบวงจร", placeholder: "เช่น สร้าง funnel สำหรับทดลองเรียนฟรี..." },
    ],
  },
  {
    id: "tier4",
    name: "Advanced Growth",
    icon: TrendingUp,
    color: "text-orange-500",
    description: "เครื่องมือขั้นสูงสำหรับการเติบโต",
    tools: [
      { id: "story-structure", name: "Story Structure", icon: BookOpen, description: "สร้างโครงเรื่อง 5 แบบ สำหรับ content", placeholder: "เช่น สร้าง story structure สำหรับ success story นักเรียน..." },
      { id: "community-building", name: "Community Building", icon: Users, description: "สร้างแผนสร้าง community ครบชุด", placeholder: "เช่น สร้าง community plan สำหรับ parent group..." },
      { id: "ab-testing", name: "A/B Testing Plan", icon: TestTube, description: "สร้างแผนทดสอบ A/B ทุกด้าน", placeholder: "เช่น สร้าง A/B test plan สำหรับ Facebook ads..." },
      { id: "paid-ads", name: "Paid Ads Copy", icon: DollarSign, description: "สร้างชุด ad copy ทุก platform", placeholder: "เช่น สร้าง Facebook ad copy โปรโมชั่น trial lesson..." },
      { id: "analytics-report", name: "Analytics Report", icon: BarChart3, description: "สร้าง template รายงาน analytics รายสัปดาห์", placeholder: "เช่น สร้าง report template สำหรับ tracking ROI..." },
    ],
  },
  {
    id: "tier5",
    name: "Content Mastery",
    icon: Flame,
    color: "text-red-500",
    description: "เชี่ยวชาญ content ขั้นสุด",
    tools: [
      { id: "content-pillars", name: "Content Pillars", icon: Compass, description: "สร้าง content pillars 5 หมวด พร้อม 50 content ideas", placeholder: "เช่น สร้าง content pillar สำหรับ music education brand..." },
      { id: "trend-jacking", name: "Trend Jacking", icon: TrendingUp, description: "คัมภีร์จับกระแส + 10 ตัวอย่างพร้อมใช้", placeholder: "เช่น วิธี adapt เทรนด์ TikTok ล่าสุดมาใช้กับ piano content..." },
      { id: "engagement-routine", name: "Engagement Routine", icon: Send, description: "สร้างกิจวัตร engagement รายวัน/รายสัปดาห์", placeholder: "เช่น สร้าง daily engagement routine 15 นาที..." },
      { id: "social-seo", name: "Social SEO", icon: Search, description: "คัมภีร์ SEO สำหรับทุก platform + 20 keywords", placeholder: "เช่น สร้าง SEO strategy สำหรับ TikTok piano content..." },
    ],
  },
];

const LANGUAGES = [
  { id: "th", label: "🇹🇭 ไทย", flag: "🇹🇭" },
  { id: "en", label: "🇬🇧 English", flag: "🇬🇧" },
  { id: "zh", label: "🇨🇳 中文", flag: "🇨🇳" },
];

const AI_MODELS = [
  { id: "gemini", label: "Gemini 2.0 Flash" },
  { id: "claude", label: "Claude Sonnet 5" },
  { id: "gpt", label: "ChatGPT 5.1" },
  { id: "qwen", label: "Qwen3 Max" },
  { id: "deepseek", label: "DeepSeek V4 Flash" },
  { id: "grok", label: "Grok" },
];

/* ── Copy Button ── */

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

/* ── Main Component ── */

export function MarketingSkillTools() {
  const [activeTier, setActiveTier] = useState<TierId>("tier1");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("th");
  const [model, setModel] = useState("gemini");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SkillResult | null>(null);
  const [history, setHistory] = useState<SkillResult[]>([]);

  const currentTier = TIERS.find((t) => t.id === activeTier)!;
  const currentTool = currentTier.tools.find((t) => t.id === activeTool);

  const generateContent = useCallback(async () => {
    if (!activeTool || !topic.trim()) return;
    setGenerating(true);
    setResult(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<
        { result: SkillResult; error?: string }
      >("generate-marketing-skill", {
        body: {
          toolType: activeTool,
          topic: topic.trim(),
          language,
          model,
        },
      });

      if (fnError) throw new Error(fnError.message || "Generation failed");
      if (!data?.result) throw new Error(data?.error || "No result returned");

      setResult(data.result);
      setHistory((prev) => [data.result, ...prev].slice(0, 20));
    } catch (err) {
      console.error("Generation error:", err);
      setResult(null);
    } finally {
      setGenerating(false);
    }
  }, [activeTool, topic, language, model]);

  return (
    <div className="space-y-4">
      {/* Tier Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            onClick={() => { setActiveTier(tier.id); setActiveTool(null); setResult(null); }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all",
              activeTier === tier.id
                ? "bg-primary text-white shadow-md"
                : "bg-line/10 text-secondary/70 hover:bg-line/20"
            )}
          >
            <tier.icon className="h-4 w-4" />
            {tier.name}
          </button>
        ))}
      </div>

      {/* Tier Description */}
      <div className="text-xs text-secondary/50">{currentTier.description}</div>

      {/* Tool Selection Grid */}
      {!activeTool ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {currentTier.tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className="rounded-xl border border-line/10 bg-card p-4 text-left hover:bg-line/5 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <tool.icon className={cn("h-5 w-5", currentTier.color)} />
                <span className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">{tool.name}</span>
              </div>
              <p className="text-xs text-secondary/50">{tool.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Back + Tool Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setActiveTool(null); setResult(null); }}>
              ← กลับ
            </Button>
            {currentTool && (
              <div className="flex items-center gap-2">
                <currentTool.icon className={cn("h-5 w-5", currentTier.color)} />
                <span className="font-medium text-secondary">{currentTool.name}</span>
              </div>
            )}
          </div>

          {/* Input Form */}
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Topic Input */}
              <div>
                <label className="text-xs font-medium text-secondary/70 mb-1 block">หัวข้อ / Topic</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={currentTool?.placeholder || "พิมพ์หัวข้อที่ต้องการ..."}
                  className="w-full rounded-xl border border-line/20 bg-background px-3 py-2.5 text-sm text-secondary placeholder:text-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  rows={2}
                />
              </div>

              {/* Language + Model Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-secondary/70 mb-1 block">ภาษา</label>
                  <div className="flex gap-1">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setLanguage(lang.id)}
                        className={cn(
                          "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all",
                          language === lang.id
                            ? "bg-primary text-white"
                            : "bg-line/10 text-secondary/60 hover:bg-line/20"
                        )}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-secondary/70 mb-1 block">AI Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-line/20 bg-background px-2 py-1.5 text-xs text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {AI_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={generateContent}
                disabled={generating || !topic.trim()}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    สร้าง Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result Display */}
          {result && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {result.title}
                    </CardTitle>
                    <CardDescription className="mt-1">{result.summary}</CardDescription>
                  </div>
                  <CopyButton value={result.content} />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">#{tag}</Badge>
                  ))}
                  <Badge variant="outline" className="text-[10px] bg-primary/10">{result.model}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl bg-line/5 p-4 max-h-[60vh] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-secondary/80 font-sans leading-relaxed">
                    {result.content}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* History */}
          {history.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-secondary/50">ประวัติล่าสุด ({history.length - 1})</p>
              {history.slice(1).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setResult(item)}
                  className="w-full rounded-xl border border-line/10 bg-card p-3 text-left hover:bg-line/5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-secondary truncate">{item.title}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{item.language}</Badge>
                  </div>
                  <p className="text-[10px] text-secondary/40 mt-0.5 truncate">{item.summary}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
