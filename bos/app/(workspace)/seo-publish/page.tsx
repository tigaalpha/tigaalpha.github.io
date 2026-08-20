"use client";

import { useEffect, useState } from "react";
import {
  Globe, Eye, Copy, Check, ExternalLink, Search, Clock, Sparkles,
  BarChart3, Link2, Tag, RefreshCw, Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface PublishedArticle {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "review" | "published" | "indexed";
  targetKeyword: string;
  publishedAt?: string;
  indexedAt?: string;
  views: number;
  clicks: number;
  impressions: number;
  avgPosition: number;
  internalLinks: string[];
}

const STATUS_MAP: Record<string, { label: string; variant: "outline" | "warning" | "success" | "info" }> = {
  draft: { label: "ร่าง", variant: "outline" },
  review: { label: "รอตรวจ", variant: "warning" },
  published: { label: "เผยแพร่แล้ว", variant: "info" },
  indexed: { label: "Google Index แล้ว", variant: "success" },
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function ArticleCard({ article }: { article: PublishedArticle }) {
  const st = STATUS_MAP[article.status] ?? STATUS_MAP.draft;
  const ctr = article.impressions > 0 ? ((article.clicks / article.impressions) * 100).toFixed(1) : "0";
  const publicUrl = `https://tigaalpha.github.io/studio/articles/${article.slug}`;
  const sitemapEntry = `<url><loc>${publicUrl}</loc><lastmod>${article.publishedAt ?? "2025-01-01"}</lastmod></url>`;

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-secondary line-clamp-2">{article.title}</h3>
            <p className="mt-1 text-xs text-secondary/40">/{article.slug}</p>
          </div>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-secondary/60">
          <span className="flex items-center gap-1"><Search className="h-3 w-3" />{article.targetKeyword}</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.views} views</span>
          <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />CTR {ctr}%</span>
          {article.avgPosition > 0 && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />Rank #{article.avgPosition}</span>}
        </div>

        {article.status === "indexed" || article.status === "published" ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-line/5 p-2 text-center">
              <p className="text-lg font-bold text-secondary">{article.clicks}</p>
              <p className="text-[10px] text-secondary/40">Clicks</p>
            </div>
            <div className="rounded-lg bg-line/5 p-2 text-center">
              <p className="text-lg font-bold text-secondary">{article.impressions.toLocaleString()}</p>
              <p className="text-[10px] text-secondary/40">Impressions</p>
            </div>
            <div className="rounded-lg bg-line/5 p-2 text-center">
              <p className="text-lg font-bold text-secondary">{article.avgPosition.toFixed(1)}</p>
              <p className="text-[10px] text-secondary/40">Avg Position</p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />ดูหน้าเว็บ
            </a>
          </Button>
          <CopyButton value={publicUrl} />
          <CopyButton value={sitemapEntry} />
          <CopyButton value={`<a href="${publicUrl}">${article.title}</a>`} />
        </div>

        {article.internalLinks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] text-secondary/40">Internal links:</span>
            {article.internalLinks.map((link) => (
              <Badge key={link} variant="outline" className="text-[9px]">
                <Link2 className="h-2 w-2 mr-0.5" />{link}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SEOPublishPage() {
  const [articles, setArticles] = useState<PublishedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [sitemapXml, setSitemapXml] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const dbArticles = await repos.articles.list();
      
      const publishedArticles: PublishedArticle[] = dbArticles.map(article => ({
        id: article.id,
        title: article.title || "ไม่มีชื่อ",
        slug: article.slug || article.id,
        status: (article.status as "draft" | "review" | "published" | "indexed") || "draft",
        targetKeyword: article.target_keyword || "",
        publishedAt: article.published_at || undefined,
        indexedAt: article.indexed_at || undefined,
        views: article.views || 0,
        clicks: article.clicks || 0,
        impressions: article.impressions || 0,
        avgPosition: article.avg_position || 0,
        internalLinks: (article.internal_links as string[]) || [],
      }));
      
      setArticles(publishedArticles);
      
      // Generate sitemap
      const urls = publishedArticles
        .filter(a => a.status === "published" || a.status === "indexed")
        .map(a => `  <url><loc>https://tigaalpha.github.io/studio/articles/${a.slug}</loc><lastmod>${a.publishedAt || "2025-01-01"}</lastmod><priority>0.8</priority></url>`)
        .join("\n");
      
      setSitemapXml(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://tigaalpha.github.io/studio/</loc><lastmod>${new Date().toISOString().split("T")[0]}</lastmod><priority>1.0</priority></url>
${urls}
</urlset>`);
    } catch (err) {
      console.error("Failed to load articles:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const publishedCount = articles.filter(a => a.status === "published" || a.status === "indexed").length;
  const draftCount = articles.filter(a => a.status === "draft").length;
  const totalViews = articles.reduce((s, a) => s + a.views, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">📝 SEO Publish Pipeline</h1>
          <p className="text-sm text-secondary/50">เปลี่ยน Draft → Public Page ที่ Google Index ได้ — ข้อมูลจริงจาก Supabase</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* Pipeline Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary-accent" />Publishing Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {["📝 เขียน SEO Content", "🔍 Keyword Check", "✅ Internal Links", "🌐 Publish HTML", "📡 Submit Sitemap", "📊 Track Ranking"].map((step, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-secondary">{step}</div>
                {i < 5 && <span className="text-secondary/20">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">บทความทั้งหมด</p><p className="text-2xl font-bold text-secondary">{articles.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Published</p><p className="text-2xl font-bold text-emerald-600">{publishedCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Draft</p><p className="text-2xl font-bold text-amber-600">{draftCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Total Views</p><p className="text-2xl font-bold text-primary">{totalViews.toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Published Articles */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-secondary">บทความ ({articles.length})</h2>
        {loading ? (
          <div className="text-center py-8 text-secondary/50">กำลังโหลด...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-8 text-secondary/50">ยังไม่มีบทความ</div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>

      {/* Sitemap Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary-accent" />Auto Sitemap Generator</CardTitle>
          <CardDescription>Sitemap.xml อัตโนมัติ — รวมทุกหน้าที่เผยแพร่แล้ว</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="max-h-48 overflow-auto rounded-xl bg-line/5 p-3 text-xs text-secondary/60">{sitemapXml}</pre>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(sitemapXml); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? "คัดลอกแล้ว" : "คัดลอก Sitemap"}
            </Button>
            <Button size="sm" variant="outline">
              <ExternalLink className="h-3 w-3 mr-1" />
              Submit to Google Search Console
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
