"use client";

import { useState } from "react";
import {
  Link2,
  FileText,
  Globe,
  BookOpen,
  CalendarPlus,
  Users,
  Sparkles,
  Check,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  title: string;
  slug: string;
  type: "article" | "landing" | "course" | "booking";
  internalLinks: number;
  suggestedLinks: { target: string; anchor: string; reason: string; score: number }[];
}

const ARTICLES: Article[] = [
  {
    id: "1",
    title: "เรียนเปียโนกรุงเทพ — ที่ไหนดี 2025",
    slug: "/articles/learn-piano-bangkok-2025",
    type: "article",
    internalLinks: 1,
    suggestedLinks: [
      { target: "/lead-sale/private", anchor: "คอร์สเรียนสดตัวต่อตัว", reason: "匹配 target keyword 'เรียนเปียโน'", score: 95 },
      { target: "/booking", anchor: "จองเรียนทดลองฟรี", reason: "High-intent CTA สำหรับคนค้นหา", score: 92 },
      { target: "/articles/piano-lesson-kids-6-12", anchor: "เรียนเปียโนเด็ก", reason: "Related topic — internal cluster", score: 85 },
    ],
  },
  {
    id: "2",
    title: "เรียนเปียโนเด็ก 6-12 ปี",
    slug: "/articles/piano-lesson-kids-6-12",
    type: "article",
    internalLinks: 2,
    suggestedLinks: [
      { target: "/lead-sale/private", anchor: "คอร์ส Private สำหรับเด็ก", reason: "Direct product match", score: 93 },
      { target: "/lead-sale/video", anchor: "คอร์สวิดีโอสำหรับเด็ก", reason: "Lower price point for parents", score: 88 },
      { target: "/booking", anchor: "ทดลองเรียนฟรี 30 นาที", reason: "Parent CTA — low commitment", score: 90 },
    ],
  },
  {
    id: "3",
    title: "เปียโน vs กีตาร์ — เลือกอะไรดี",
    slug: "/articles/piano-vs-guitar",
    type: "article",
    internalLinks: 0,
    suggestedLinks: [
      { target: "/articles/learn-piano-bangkok-2025", anchor: "ทำไมควรเลือกเปียโน", reason: "Cross-reference to main article", score: 90 },
      { target: "/lead-sale/tiga-ai", anchor: "ลอง TIGA AI ก่อน", reason: "Free entry point สำหรับคนลังเล", score: 85 },
      { target: "/booking", anchor: "จองทดลองเปียโนฟรี", reason: "CTA สำหรับคนที่ตัดสินใจแล้ว", score: 88 },
    ],
  },
  {
    id: "4",
    title: "คอร์ส Piano Mindset",
    slug: "/lead-sale/video",
    type: "course",
    internalLinks: 1,
    suggestedLinks: [
      { target: "/lead-sale/private", anchor: "อัปเกรดเป็น Private", reason: "Upsell path — video → live", score: 82 },
      { target: "/articles/learn-piano-bangkok-2025", anchor: "เปรียบเทียบคอร์ส", reason: "ให้ข้อมูลก่อนตัดสินใจ", score: 78 },
    ],
  },
  {
    id: "5",
    title: "จองเรียนทดลองฟรี",
    slug: "/booking",
    type: "booking",
    internalLinks: 2,
    suggestedLinks: [
      { target: "/lead-sale/private", anchor: "ดูรายละเอียดคอร์ส", reason: "ให้ข้อมูลก่อน booking", score: 88 },
      { target: "/articles/learn-piano-bangkok-2025", anchor: "อ่านรีวิว", reason: "Social proof ก่อนตัดสินใจ", score: 85 },
    ],
  },
];

const TYPE_MAP: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  article: { label: "Article", icon: FileText, color: "text-blue-500" },
  landing: { label: "Landing", icon: Globe, color: "text-emerald-500" },
  course: { label: "Course", icon: BookOpen, color: "text-purple-500" },
  booking: { label: "Booking", icon: CalendarPlus, color: "text-amber-500" },
};

export default function InternalLinkingPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const activeArticle = ARTICLES.find((a) => a.id === selected);

  const totalLinks = ARTICLES.reduce((s, a) => s + a.internalLinks, 0);
  const totalSuggested = ARTICLES.reduce((s, a) => s + a.suggestedLinks.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🔗 Auto Internal Linking</h1>
        <p className="text-sm text-secondary/50">AI แนะนำ internal links ระหว่างบทความ ↔ หน้าสินค้า ↔ หน้าจอง</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Pages ทั้งหมด</p>
            <p className="text-2xl font-bold text-secondary">{ARTICLES.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Links ที่มีอยู่</p>
            <p className="text-2xl font-bold text-primary">{totalLinks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Suggested Links</p>
            <p className="text-2xl font-bold text-emerald-600">{totalSuggested}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Link Health Score</p>
            <p className="text-2xl font-bold text-amber-600">{totalLinks > 0 ? Math.round((totalLinks / (totalLinks + totalSuggested)) * 100) : 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Link Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary-accent" />
            Link Health — แต่ละหน้ามีกี่ links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ARTICLES.map((article) => {
            const type = TYPE_MAP[article.type] ?? TYPE_MAP.article;
            const health = article.internalLinks >= 2 ? "good" : article.internalLinks >= 1 ? "ok" : "poor";
            return (
              <div key={article.id} className="flex items-center gap-3 rounded-xl border border-line/10 px-3 py-2">
                <type.icon className={cn("h-4 w-4", type.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-secondary line-clamp-1">{article.title}</p>
                  <p className="text-[10px] text-secondary/40">/{article.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={health === "good" ? "success" : health === "ok" ? "warning" : "danger"} className="text-[9px]">
                    {article.internalLinks} links
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">{article.suggestedLinks.length} suggested</Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Article Detail + Suggestions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-secondary">Suggested Internal Links</h2>
        {ARTICLES.map((article) => {
          const type = TYPE_MAP[article.type] ?? TYPE_MAP.article;
          return (
            <Card key={article.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <type.icon className={cn("h-4 w-4", type.color)} />
                  <span className="text-sm font-medium text-secondary">{article.title}</span>
                </div>
                <div className="space-y-2">
                  {article.suggestedLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-line/5 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-secondary/40">→</span>
                          <span className="text-xs font-medium text-primary">{link.target}</span>
                          <Badge variant="outline" className="text-[9px]">Score: {link.score}</Badge>
                        </div>
                        <p className="text-[10px] text-secondary/40 mt-1">Anchor: "{link.anchor}" · {link.reason}</p>
                      </div>
                      <Button size="sm" variant="ghost"><Check className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Link Structure Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary-accent" />
            Link Structure
          </CardTitle>
          <CardDescription>แผนภาพ internal link ที่ AI แนะนำ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-line/5 p-4 font-mono text-xs text-secondary/60 space-y-1">
            <p>📝 Articles (SEO traffic source)</p>
            <p className="pl-4">├── /articles/learn-piano-bangkok → 🎹 /lead-sale/private (95%)</p>
            <p className="pl-4">├── /articles/learn-piano-bangkok → 📅 /booking (92%)</p>
            <p className="pl-4">├── /articles/piano-lesson-kids → 🎹 /lead-sale/private (93%)</p>
            <p className="pl-4">├── /articles/piano-lesson-kids → 🎬 /lead-sale/video (88%)</p>
            <p className="pl-4">├── /articles/piano-vs-guitar → 📝 /articles/learn-piano (90%)</p>
            <p className="pl-4">└── /articles/piano-vs-guitar → 📱 /lead-sale/tiga-ai (85%)</p>
            <p>📅 Booking Page (conversion destination)</p>
            <p className="pl-4">├── /booking → 🎹 /lead-sale/private (88%)</p>
            <p className="pl-4">└── /booking → 📝 /articles/learn-piano (85%)</p>
            <p>🎓 Course Pages (product)</p>
            <p className="pl-4">└── /lead-sale/video → 🎹 /lead-sale/private (82% upsell)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
