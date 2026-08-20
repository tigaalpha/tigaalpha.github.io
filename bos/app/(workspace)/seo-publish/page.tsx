"use client";

import { useState } from "react";
import {
  FileText,
  Globe,
  Eye,
  Copy,
  Check,
  ExternalLink,
  Search,
  Clock,
  Sparkles,
  BarChart3,
  Link2,
  Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const SAMPLE_ARTICLES: PublishedArticle[] = [
  {
    id: "1",
    title: "เรียนเปียโนกรุงเทพ — ที่ไหนดี 2025 พร้อมราคาเปรียบเทียบ",
    slug: "learn-piano-bangkok-2025",
    status: "indexed",
    targetKeyword: "เรียนเปียโนกรุงเทพ",
    publishedAt: "2025-07-15",
    indexedAt: "2025-07-18",
    views: 1240,
    clicks: 89,
    impressions: 3200,
    avgPosition: 8.3,
    internalLinks: ["/booking", "/lead-sale/private"],
  },
  {
    id: "2",
    title: "เรียนเปียโนเด็ก 6-12 ปี — ข้อดี วิธีเลือกโรงเรียน",
    slug: "piano-lesson-kids-6-12",
    status: "published",
    targetKeyword: "เรียนเปียโนเด็ก",
    publishedAt: "2025-07-20",
    views: 456,
    clicks: 32,
    impressions: 1800,
    avgPosition: 14.2,
    internalLinks: ["/booking", "/students"],
  },
  {
    id: "3",
    title: "เปียโน vs กีตาร์ — เลือกอะไรดีสำหรับมือใหม่",
    slug: "piano-vs-guitar-beginners",
    status: "draft",
    targetKeyword: "เล่นเปียโนหรือกีตาร์",
    views: 0,
    clicks: 0,
    impressions: 0,
    avgPosition: 0,
    internalLinks: [],
  },
];

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
  const [sitemapXml, setSitemapXml] = useState(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://tigaalpha.github.io/studio/</loc><lastmod>2025-08-20</lastmod><priority>1.0</priority></url>
  <url><loc>https://tigaalpha.github.io/studio/articles/learn-piano-bangkok-2025</loc><lastmod>2025-07-15</lastmod><priority>0.8</priority></url>
  <url><loc>https://tigaalpha.github.io/studio/articles/piano-lesson-kids-6-12</loc><lastmod>2025-07-20</lastmod><priority>0.8</priority></url>
</urlset>`);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">📝 SEO Publish Pipeline</h1>
        <p className="text-sm text-secondary/50">เปลี่ยน Draft → Public Page ที่ Google Index ได้ พร้อม Sitemap อัตโนมัติ</p>
      </div>

      {/* Pipeline Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-accent" />
            Publishing Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {["📝 เขียน SEO Content", "🔍 Keyword Check", "✅ Internal Links", "🌐 Publish HTML", "📡 Submit Sitemap", "📊 Track Ranking"].map((step, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-secondary">
                  {step}
                </div>
                {i < 5 && <span className="text-secondary/20">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Published Articles */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-secondary">บทความที่เผยแพร่แล้ว ({SAMPLE_ARTICLES.length})</h2>
        <div className="space-y-3">
          {SAMPLE_ARTICLES.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>

      {/* Sitemap Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary-accent" />
            Auto Sitemap Generator
          </CardTitle>
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

      {/* SEO Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            SEO Checklist สำหรับทุกบทความ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {[
              "✅ Title tag < 60 ตัวอักษร",
              "✅ Meta description 120-160 ตัวอักษร",
              "✅ H1 มี target keyword",
              "✅ Internal link ไปหน้า Booking",
              "✅ Internal link ไปหน้า Course",
              "✅ FAQ section 3-5 ข้อ",
              "✅ Image alt text ทุกรูป",
              "✅ Slug เป็นภาษาอังกฤษ",
              "✅ ไม่ซ้ำกับบทความอื่น",
              "✅ Entity (ชื่อธุรกิจ + ที่อยู่) ชัดเจน",
            ].map((item, i) => (
              <div key={i} className="rounded-lg bg-emerald-50/5 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/5 dark:text-emerald-400">
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
