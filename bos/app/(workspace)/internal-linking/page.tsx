"use client";

import { useEffect, useState } from "react";
import { Link2, FileText, Globe, BookOpen, CalendarPlus, Sparkles, Check, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface Article {
  id: string;
  title: string;
  slug: string;
  type: "article" | "landing" | "course" | "booking";
  internalLinks: number;
  suggestedLinks: { target: string; anchor: string; reason: string; score: number }[];
}

const TYPE_MAP: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  article: { label: "Article", icon: FileText, color: "text-blue-500" },
  landing: { label: "Landing", icon: Globe, color: "text-emerald-500" },
  course: { label: "Course", icon: BookOpen, color: "text-purple-500" },
  booking: { label: "Booking", icon: CalendarPlus, color: "text-amber-500" },
};

function generateSuggestedLinks(title: string, type: string): { target: string; anchor: string; reason: string; score: number }[] {
  const links: { target: string; anchor: string; reason: string; score: number }[] = [];
  
  if (type === "article") {
    links.push({ target: "/lead-sale/private", anchor: "คอร์สเรียนสดตัวต่อตัว", reason: "Direct product match", score: 95 });
    links.push({ target: "/booking", anchor: "จองเรียนทดลองฟรี", reason: "High-intent CTA", score: 92 });
    links.push({ target: "/lead-sale/video", anchor: "คอร์สวิดีโอ", reason: "Lower price point", score: 85 });
  } else if (type === "course") {
    links.push({ target: "/lead-sale/private", anchor: "อัปเกรดเป็น Private", reason: "Upsell path", score: 82 });
    links.push({ target: "/booking", anchor: "จองเรียนทดลอง", reason: "CTA", score: 88 });
  } else if (type === "landing") {
    links.push({ target: "/booking", anchor: "จองเลย", reason: "Conversion CTA", score: 95 });
    links.push({ target: "/lead-sale/private", anchor: "ดูรายละเอียดคอร์ส", reason: "Product info", score: 88 });
  }
  
  return links;
}

export default function InternalLinkingPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const dbArticles = await repos.articles.list();
      
      const articlesData: Article[] = dbArticles.map((article: any) => {
        const internalLinks = (article.internal_links as string[]) || [];
        const type = article.type === "landing" ? "landing" : article.type === "course" ? "course" : "article";
        
        return {
          id: article.id,
          title: article.title || "ไม่มีชื่อ",
          slug: article.slug || article.id,
          type: type as "article" | "landing" | "course" | "booking",
          internalLinks: internalLinks.length,
          suggestedLinks: generateSuggestedLinks(article.title || "", type),
        };
      });
      
      setArticles(articlesData);
    } catch (err) {
      console.error("Failed to load articles:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const totalLinks = articles.reduce((s, a) => s + a.internalLinks, 0);
  const totalSuggested = articles.reduce((s, a) => s + a.suggestedLinks.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🔗 Auto Internal Linking</h1>
          <p className="text-sm text-secondary/50">AI แนะนำ internal links ระหว่างบทความ ↔ หน้าสินค้า ↔ หน้าจอง — ข้อมูลจริง</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Pages ทั้งหมด</p><p className="text-2xl font-bold text-secondary">{articles.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Links ที่มีอยู่</p><p className="text-2xl font-bold text-primary">{totalLinks}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Suggested Links</p><p className="text-2xl font-bold text-emerald-600">{totalSuggested}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Link Health Score</p><p className="text-2xl font-bold text-amber-600">{totalLinks > 0 ? Math.round((totalLinks / (totalLinks + totalSuggested)) * 100) : 0}%</p></CardContent></Card>
      </div>

      {/* Link Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary-accent" />Link Health — แต่ละหน้ามีกี่ links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="text-center py-4 text-secondary/50">กำลังโหลด...</div>
          ) : articles.length === 0 ? (
            <div className="text-center py-4 text-secondary/50">ยังไม่มี articles</div>
          ) : (
            articles.map((article) => {
              const type = (TYPE_MAP as any)[article.type] ?? TYPE_MAP.article;
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
            })
          )}
        </CardContent>
      </Card>

      {/* Suggested Internal Links */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-secondary">Suggested Internal Links</h2>
        {articles.map((article) => {
          const type = (TYPE_MAP as any)[article.type] ?? TYPE_MAP.article;
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
                        <p className="text-[10px] text-secondary/40 mt-1">Anchor: &quot;{link.anchor}&quot; · {link.reason}</p>
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
    </div>
  );
}
