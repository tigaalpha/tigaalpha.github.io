"use client";

import { useState } from "react";
import {
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
  Brain,
  Target,
  PenTool,
  BarChart3,
  Share2,
  Video,
  TrendingUp,
  Hash,
  Megaphone,
  Users,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarketingSkillTools } from "@/features/marketing-skills/components/marketing-skill-tools";

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

/* ── Social Media Skills (106 skills) ── */

const SOCIAL_MEDIA_SKILL_CATEGORIES = [
  {
    title: "Foundation",
    icon: BookOpen,
    color: "text-blue-500",
    skills: [
      { name: "brand-profile", desc: "Single source of truth for all skills" },
      { name: "voice-builder", desc: "Define a voice that survives any format" },
      { name: "writing-style-and-tone", desc: "Style rules at sentence level" },
      { name: "audience-research", desc: "Know who you are actually talking to" },
      { name: "social-strategy", desc: "Platform mix, positioning, cadence" },
      { name: "content-pillars", desc: "3-5 themes everything maps to" },
      { name: "goals-and-kpis", desc: "Targets that are not vanity metrics" },
      { name: "profile-optimization", desc: "Bios and profiles as landing pages" },
    ],
  },
  {
    title: "Research & Planning",
    icon: Brain,
    color: "text-purple-500",
    skills: [
      { name: "idea-generation-and-ideation", desc: "A repeatable idea system" },
      { name: "content-research-and-sourcing", desc: "Verified source material" },
      { name: "competitor-analysis", desc: "Learn from the field without copying" },
      { name: "viral-reverse-engineering", desc: "Why a post worked, structurally" },
      { name: "content-calendar", desc: "The living plan" },
      { name: "batch-content-plan", desc: "A month of content in one sitting" },
      { name: "campaign-and-launch-planning", desc: "Launches as multi-week arcs" },
      { name: "trend-jacking", desc: "Ride trends without embarrassment" },
    ],
  },
  {
    title: "Writing Formats",
    icon: PenTool,
    color: "text-green-500",
    skills: [
      { name: "hook-writer", desc: "The first line / first 3 seconds" },
      { name: "caption-writer", desc: "Captions for any platform" },
      { name: "linkedin-post-writer", desc: "LinkedIn posts without the cringe" },
      { name: "thread-writer", desc: "X/Twitter threads" },
      { name: "carousel-writer", desc: "Slide-by-slide carousels" },
      { name: "short-form-video-script", desc: "Master short-form scripting craft" },
      { name: "reels-script", desc: "Instagram Reels scripts" },
      { name: "tiktok-script", desc: "TikTok scripts" },
      { name: "reply-and-comment-writer", desc: "Replies and strategic comments" },
    ],
  },
  {
    title: "Platform Playbooks",
    icon: Share2,
    color: "text-orange-500",
    skills: [
      { name: "instagram-growth", desc: "Instagram growth system" },
      { name: "tiktok-growth", desc: "TikTok growth + scripts + trends" },
      { name: "linkedin-growth", desc: "LinkedIn growth system" },
      { name: "x-growth", desc: "X/Twitter growth + threads" },
      { name: "youtube-long-form", desc: "YouTube long-form strategy" },
      { name: "youtube-shorts", desc: "YouTube Shorts" },
      { name: "facebook-strategy", desc: "Facebook Page + Groups" },
      { name: "pinterest-growth", desc: "Pinterest keyword SEO + traffic" },
    ],
  },
  {
    title: "Visual & Design",
    icon: Target,
    color: "text-pink-500",
    skills: [
      { name: "design-and-templates", desc: "Reusable on-brand template system" },
      { name: "thumbnail-design", desc: "YouTube thumbnails" },
      { name: "pinterest-pin-design", desc: "Pinterest pin visuals" },
      { name: "image-prompt", desc: "Router: brief to the right image tool" },
    ],
  },
  {
    title: "Growth & Analytics",
    icon: BarChart3,
    color: "text-cyan-500",
    skills: [
      { name: "engagement-routine", desc: "Daily/weekly engagement block" },
      { name: "cross-platform-repurposing", desc: "One idea, every platform" },
      { name: "analytics-and-reporting", desc: "What is working and why" },
      { name: "content-audit", desc: "Audit library, rebalance" },
      { name: "social-seo", desc: "Search inside platforms" },
      { name: "scheduling-and-queue", desc: "Bridge: validate, confirm, publish" },
    ],
  },
];

/* ── Vyral Content Skills (7 skills) ── */

const VYRAL_SKILLS = [
  {
    name: "viral-short-form",
    title: "Viral Short Form",
    desc: "Brainstorm and write high-retention short-form video and carousels: hooks, retention scripts, platform adaptation",
    icon: Video,
    tags: ["hooks", "scripts", "carousel"],
  },
  {
    name: "viral-tiktok-content",
    title: "Viral TikTok Content",
    desc: "TikTok-specific scripts, hooks, trend reads — built around FYP ranking, completion-rate math, trending-sound timing",
    icon: Zap,
    tags: ["tiktok", "hooks", "trends"],
  },
  {
    name: "viral-youtube-shorts",
    title: "Viral YouTube Shorts",
    desc: "YouTube Shorts strategy with long-form funnel — algorithm rewards, VVSA metrics, Creator Pool monetization",
    icon: Video,
    tags: ["youtube", "shorts", "monetization"],
  },
  {
    name: "viral-instagram-reels",
    title: "Viral Instagram Reels",
    desc: "Reels-specific writing — Sends Per Reach, Trial Reels, Original Content Guidelines, Reels Insights",
    icon: TrendingUp,
    tags: ["instagram", "reels", "reach"],
  },
  {
    name: "viral-hooks",
    title: "Viral Hooks",
    desc: "Write and critique the opening 1-3 seconds — named-creator archetypes, three-layer hook, anti-patterns",
    icon: Zap,
    tags: ["hooks", "openers", "retention"],
  },
  {
    name: "viral-short-form-ideas",
    title: "Viral Short Form Ideas",
    desc: "The ideation engine — pillars, mining (comments, Reddit, search autocomplete), repurposing, evergreen-vs-trend",
    icon: Brain,
    tags: ["ideation", "pillars", "repurposing"],
  },
  {
    name: "viral-captions-and-ctas",
    title: "Viral Captions & CTAs",
    desc: "Captions, on-screen text, hashtags, CTAs, pinned comment — the layer that decides distribution and saves",
    icon: Hash,
    tags: ["captions", "hashtags", "CTA"],
  },
];

/* ── Main Component ── */

function MarketingSkillsView() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Foundation");
  const [viewMode, setViewMode] = useState<"tools" | "library">("tools");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Marketing Skills</h1>
        <p className="text-sm text-secondary/50">
          AI skill sets for Social Media Marketing — สร้าง content และใช้ skill ได้ทันที
        </p>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("tools")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
            viewMode === "tools"
              ? "bg-primary text-white shadow-md"
              : "bg-line/10 text-secondary/70 hover:bg-line/20"
          )}
        >
          <Sparkles className="h-4 w-4" />
          ใช้ Tools สร้าง Content
        </button>
        <button
          onClick={() => setViewMode("library")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
            viewMode === "library"
              ? "bg-primary text-white shadow-md"
              : "bg-line/10 text-secondary/70 hover:bg-line/20"
          )}
        >
          <BookOpen className="h-4 w-4" />
          Skill Library
        </button>
      </div>

      {/* Tools View */}
      {viewMode === "tools" && <MarketingSkillTools />}

      {/* Library View */}
      {viewMode === "library" && (
        <LibraryView
          expandedCategory={expandedCategory}
          setExpandedCategory={setExpandedCategory}
        />
      )}
    </div>
  );
}

/* ── Library View (extracted to avoid nesting issues) ── */

function LibraryView({
  expandedCategory,
  setExpandedCategory,
}: {
  expandedCategory: string | null;
  setExpandedCategory: (v: string | null) => void;
}) {
  return (
    <>
      {/* ── Social Media Skills (106) ── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                Social Media Skills
              </CardTitle>
              <CardDescription className="mt-1">
                106 AI skills for Social Media — strategy, writing, video, design, growth, analytics
              </CardDescription>
            </div>
            <a
              href="https://github.com/social-media-skills/skills"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5" />
                GitHub
              </Button>
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl bg-line/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-medium text-secondary/60">Install all 106 skills</p>
              <CopyButton value={"npx skills add social-media-skills/skills -g -a claude-code -s '*' -y"} />
            </div>
            <code className="text-xs text-primary-accent break-all">
              {"npx skills add social-media-skills/skills -g -a claude-code -s '*' -y"}
            </code>
          </div>

          <div className="space-y-2">
            {SOCIAL_MEDIA_SKILL_CATEGORIES.map((cat) => (
              <div key={cat.title} className="rounded-xl border border-line/10">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(expandedCategory === cat.title ? null : cat.title)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-line/5 transition-colors"
                >
                  {expandedCategory === cat.title ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-secondary/40" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-secondary/40" />
                  )}
                  <cat.icon className={cn("h-4 w-4 shrink-0", cat.color)} />
                  <span className="text-sm font-medium text-secondary">{cat.title}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {cat.skills.length} skills
                  </Badge>
                </button>
                {expandedCategory === cat.title && (
                  <div className="border-t border-line/5 px-4 py-2 space-y-1.5">
                    {cat.skills.map((skill) => (
                      <div key={skill.name} className="flex items-center gap-2 rounded-lg bg-line/5 px-3 py-1.5">
                        <code className="text-xs text-primary-accent font-mono">{skill.name}</code>
                        <span className="text-xs text-secondary/50">{"— "}{skill.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Vyral Content Skills (7) ── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Vyral Content Skills
              </CardTitle>
              <CardDescription className="mt-1">
                7 AI skills for short-form video — built from 200,000+ viral video data
              </CardDescription>
            </div>
            <a
              href="https://github.com/vyralcontent/content-skills"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5" />
                GitHub
              </Button>
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl bg-line/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-secondary/60">Install all</p>
              <CopyButton value={"npx skills add vyralcontent/content-skills -g -a claude-code -s '*' -y"} />
            </div>
            <code className="text-xs text-primary-accent break-all block">
              {"npx skills add vyralcontent/content-skills -g -a claude-code -s '*' -y"}
            </code>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {VYRAL_SKILLS.map((skill) => (
              <div
                key={skill.name}
                className="rounded-xl border border-line/10 bg-card p-4 hover:bg-line/5 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <skill.icon className="h-4 w-4 text-orange-500" />
                  <p className="text-sm font-medium text-secondary">{skill.title}</p>
                </div>
                <p className="text-xs text-secondary/50 mb-2">{skill.desc}</p>
                <div className="flex flex-wrap gap-1">
                  {skill.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <code className="text-[10px] text-secondary/40 font-mono">{skill.name}</code>
                  <CopyButton value={`npx skills add vyralcontent/content-skills --skill ${skill.name}`} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Quick Start Guide ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-accent" />
            Quick Start Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-secondary/70">
          <div className="space-y-2">
            <p className="font-medium text-secondary">First 15 minutes:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Create brand folder: <code className="text-primary-accent">{"mkdir my-brand && cd my-brand"}</code></li>
              <li>Tell AI: <strong>&ldquo;Set up my brand profile&rdquo;</strong> {"— AI will interview you or pull from your site"}</li>
              <li>Add: <strong>&ldquo;Build my voice guide&rdquo;</strong> {"— AI derives voice.md from your actual writing"}</li>
              <li>Build pillars: <strong>&ldquo;Build my content pillars and a two-week content calendar&rdquo;</strong></li>
              <li>Start writing: <strong>&ldquo;Write this week&apos;s posts&rdquo;</strong> {"— get platform-native drafts immediately"}</li>
            </ol>
          </div>
          <div className="rounded-xl bg-line/5 p-3">
            <p className="text-xs text-secondary/50">
              Every skill reads brand profile + voice guide before writing — no generic AI-slop, no engagement bait, no fabrication
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function MarketingSkillsPage() {
  return <MarketingSkillsView />;
}
