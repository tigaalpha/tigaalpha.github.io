"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  MessagesSquare,
  Users,
  KanbanSquare,
  CalendarPlus,
  BookOpen,
  FileText,
  BarChart3,
  Bell,
  Settings,
  Wallet,
  Image as ImageIcon,
  Clapperboard,
  Captions,
  Mic,
  Share2,
  ShieldCheck,
  Activity,
  Megaphone,
  Scale,
  Brain,
  Radar,
  Bot,
  TrendingUp,
  GraduationCap,
  Swords,
  ChevronDown,
  HeartPulse,
  Smartphone,
  Workflow,
  Receipt as ReceiptIcon,
  HandCoins,
  Building2,
  Gauge,
  LineChart,
  UserCheck,
  Coins,
  Phone,
  Landmark,
  CalendarHeart,
  Sparkles,
  BadgeCheck,
  Filter,
  Globe,
  Mail,
  Gift,
  Layout,
  DollarSign,
  CalendarClock,
  PieChart,
  FileBarChart,
  Link2,
  ListChecks,
  Cpu,
  GitBranch,
  Rocket,
  Target,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types/database";
import { useLang } from "@/lib/language-context";
import { translate, type DictKey } from "@/lib/i18n";

interface NavItem {
  href: string;
  label: string;
  labelKey?: DictKey;
  icon: LucideIcon;
  /** Hidden from anyone but owner/admin — mirrors is_owner_or_admin()-gated tables (transactions, integration_settings, business_snapshot, agent_schedules). RLS is still the real security boundary; this only keeps staff/teacher accounts from seeing pages they can't use. */
  ownerOnly?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  labelKey?: DictKey;
  items: NavItem[];
  /** Shown as a badge next to the group label inside Solo Mode's Advanced section. Absent = "Stable" (the default — most groups here are shipped, working tools). */
  maturity?: "beta";
}

/** Solo Mode's flat core list, in display order — hrefs looked up from TOP_LEVEL_ITEMS/NAV_GROUPS below so labels/icons stay single-sourced. */
const CORE_HREFS = ["/ai-automation-chat", "/dashboard", "/chat", "/students", "/sales", "/calendar", "/booking", "/knowledge", "/accounting", "/settings"];

const TOP_LEVEL_ITEMS: NavItem[] = [
  { href: "/ai-automation-chat", label: "AI Automation Chat", labelKey: "nav.aiAutomationChat", icon: MessageSquare, ownerOnly: true },
  { href: "/dashboard", label: "Dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/marketing-dashboard", label: "Marketing Dashboard", labelKey: "nav.marketingDashboard", icon: LineChart },
  { href: "/calendar", label: "Calendar", labelKey: "nav.calendar", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", labelKey: "nav.notifications", icon: Bell },
];

const NAV_GROUPS: NavGroup[] = [
  {
    id: "ai-agent",
    label: "AI AGENT",
    labelKey: "group.aiAgent",
    maturity: "beta",
    items: [
      { href: "/tiga-agent", label: "TIGA AI Agent", labelKey: "nav.tigaAgent", icon: Bot, ownerOnly: true },
      { href: "/automation", label: "Automation", labelKey: "nav.automation", icon: Workflow, ownerOnly: true },
      { href: "/ai-company", label: "AI Company", labelKey: "nav.aiCompany", icon: Building2, ownerOnly: true },
    ],
  },
  {
    id: "ai-control",
    label: "🤖 AI Control",
    labelKey: "group.aiControl",
    items: [
      { href: "/ai-control-panel", label: "AI Control Panel", labelKey: "nav.aiControlPanel", icon: Cpu },
      { href: "/ai-task-router", label: "AI Task Router", labelKey: "nav.aiTaskRouter", icon: GitBranch },
      { href: "/predictive-scoring", label: "Predictive Scoring", labelKey: "nav.predictiveScoring", icon: Target },
      { href: "/sentiment-dashboard", label: "Sentiment Dashboard", labelKey: "nav.sentimentDashboard", icon: HeartPulse },
      { href: "/sales-coach", label: "AI Sales Coach", labelKey: "nav.aiSalesCoach", icon: GraduationCap },
      { href: "/smart-scheduler", label: "Smart Scheduler", labelKey: "nav.smartScheduler", icon: CalendarClock },
      { href: "/ai-phone-call", label: "AI Phone Call", labelKey: "nav.aiPhoneCall", icon: Phone },
      { href: "/mimo-ai", label: "Mimo AI (OpenRouter)", labelKey: "nav.mimoAi", icon: Bot, ownerOnly: true },
    ],
  },
  {
    id: "strategy",
    label: "Strategy",
    labelKey: "group.strategy",
    maturity: "beta",
    items: [
      { href: "/strategy", label: "AI Strategy Room", labelKey: "nav.aiStrategyRoom", icon: Brain },
      { href: "/strategy-actions", label: "Strategy Actions", labelKey: "nav.strategyActions", icon: ListChecks },
      { href: "/chatbot-brain", label: "Chatbot Brain", labelKey: "nav.chatbotBrain", icon: Bot },
      { href: "/competitors", label: "วิเคราะห์คู่แข่ง", labelKey: "nav.competitorAnalysis", icon: Swords },
    ],
  },
  {
    id: "lead-sale",
    label: "🎯 Lead Sale",
    labelKey: "group.leadSale",
    items: [
      { href: "/lead-sale", label: "แดชบอร์ด Lead", labelKey: "nav.leadDashboard", icon: TrendingUp },
      { href: "/funnel", label: "Sales Funnel", labelKey: "nav.salesFunnel", icon: Filter },
      { href: "/revenue-attribution", label: "Revenue Attribution", labelKey: "nav.revenueAttribution", icon: DollarSign, ownerOnly: true },
      { href: "/lead-sale/private", label: "คอร์ส Private ตัวต่อตัว", labelKey: "nav.privateCourse", icon: Users, ownerOnly: true },
      { href: "/lead-sale/video", label: "คอร์สวิดีโอ", labelKey: "nav.videoCourse", icon: Clapperboard, ownerOnly: true },
      { href: "/lead-sale/tiga-ai", label: "TIGA AI (ฟรี)", labelKey: "nav.tigaAiFree", icon: Smartphone },
      { href: "/referral-tracking", label: "Referral Tracking", labelKey: "nav.referralTracking", icon: Gift },
      { href: "/lead-quiz", label: "Lead Quiz", labelKey: "nav.leadQuiz", icon: Target },
    ],
  },
  {
    id: "sales-crm",
    label: "Sales & CRM",
    labelKey: "group.salesCrm",
    items: [
      { href: "/chat", label: "Inbox", labelKey: "nav.inbox", icon: MessagesSquare },
      { href: "/attendance", label: "ยืนยันการมาเรียน", labelKey: "nav.attendance", icon: UserCheck },
      { href: "/students", label: "Students / CRM", labelKey: "nav.students", icon: Users },
      { href: "/sales", label: "Sales Pipeline", labelKey: "nav.salesPipeline", icon: KanbanSquare },
      { href: "/booking", label: "Bookings", labelKey: "nav.bookings", icon: CalendarPlus },
    ],
  },
  {
    id: "marketing",
    label: "📣 Marketing",
    labelKey: "group.marketing",
    items: [
      { href: "/marketing-roi", label: "Marketing ROI", labelKey: "nav.marketingRoi", icon: DollarSign, ownerOnly: true },
      { href: "/weekly-report", label: "AI Weekly Report", labelKey: "nav.aiWeeklyReport", icon: FileBarChart },
      { href: "/ab-test-ai", label: "A/B Test AI", labelKey: "nav.abTestAi", icon: Target },
      { href: "/competitive-intel", label: "Competitive Intel", labelKey: "nav.competitiveIntel", icon: Radar },
      { href: "/competitive-analysis", label: "Competitive Analysis", labelKey: "nav.competitiveAnalysis", icon: Swords },
      { href: "/conversion-tracking", label: "Conversion Tracking", labelKey: "nav.conversionTracking", icon: Target },
      { href: "/performance-dashboard", label: "Performance Dashboard", labelKey: "nav.performanceDashboard", icon: BarChart3 },
      { href: "/ads", label: "แคมเปญโฆษณา", labelKey: "nav.adCampaigns", icon: Megaphone },
      { href: "/marketing-channels", label: "Marketing Channels", labelKey: "nav.marketingChannels", icon: Radar },
      { href: "/social-trends", label: "Social Trends", labelKey: "nav.socialTrends", icon: TrendingUp },
      { href: "/marketing-skills", label: "Marketing Skills", labelKey: "nav.marketingSkills", icon: Sparkles },
      { href: "/landing-pages", label: "Landing Pages", labelKey: "nav.landingPages", icon: Layout },
      { href: "/drip-campaign", label: "Drip Campaign", labelKey: "nav.dripCampaign", icon: Mail },
    ],
  },
  {
    id: "content",
    label: "✏️ Content",
    labelKey: "group.content",
    items: [
      { href: "/auto-schedule", label: "AI Auto-Schedule", labelKey: "nav.aiAutoSchedule", icon: CalendarClock },
      { href: "/auto-publish", label: "Auto-Publish Pipeline", labelKey: "nav.autoPublish", icon: Rocket },
      { href: "/content-repurpose", label: "Content Repurpose", labelKey: "nav.contentRepurpose", icon: Sparkles },
      { href: "/personalization-engine", label: "Personalization", labelKey: "nav.personalization", icon: UserCheck },
      { href: "/content-optimization", label: "Content Optimization", labelKey: "nav.contentOptimization", icon: Sparkles },
      { href: "/mobile-content", label: "Mobile-First Content", labelKey: "nav.mobileContent", icon: Smartphone },
      { href: "/internal-linking", label: "Internal Linking", labelKey: "nav.internalLinking", icon: Link2 },
      { href: "/knowledge", label: "Knowledge Base", labelKey: "nav.knowledgeBase", icon: BookOpen },
      { href: "/content", label: "SEO/AEO Content", labelKey: "nav.seoContent", icon: FileText },
      { href: "/seo-publish", label: "SEO Publish Pipeline", labelKey: "nav.seoPublish", icon: Globe },
      { href: "/course-writer", label: "Online Course Writer", labelKey: "nav.courseWriter", icon: GraduationCap },
      { href: "/app-ad-kit", label: "App Ad Kit", labelKey: "nav.appAdKit", icon: Smartphone },
      { href: "/images", label: "Image Studio", labelKey: "nav.imageStudio", icon: ImageIcon },
      { href: "/vertical-video", label: "Vertical Video", labelKey: "nav.verticalVideo", icon: Clapperboard },
      { href: "/video-articles", label: "Voice Over", labelKey: "nav.voiceOver", icon: Mic },
      { href: "/video-script-writer", label: "Video Script Writer", labelKey: "nav.videoScriptWriter", icon: Captions },
      { href: "/post", label: "Post ทุกช่องทาง", labelKey: "nav.postAllChannels", icon: Share2 },
    ],
  },
  {
    id: "finance-legal",
    label: "Finance & Legal",
    labelKey: "group.financeLegal",
    items: [
      { href: "/accounting", label: "Accounting", labelKey: "nav.accounting", icon: Wallet, ownerOnly: true },
      { href: "/receipts", label: "ใบเสร็จ", labelKey: "nav.receipts", icon: ReceiptIcon, ownerOnly: true },
      { href: "/payments", label: "การชำระเงิน", labelKey: "nav.payments", icon: HandCoins, ownerOnly: true },
      { href: "/voice", label: "AI Receptionist", labelKey: "nav.aiReceptionist", icon: Phone, ownerOnly: true },
      { href: "/tax", label: "ภาษีอัตโนมัติ", labelKey: "nav.autoTax", icon: Landmark, ownerOnly: true },
      { href: "/events", label: "งานแสดง/กิจกรรม", labelKey: "nav.events", icon: CalendarHeart, ownerOnly: true },
      { href: "/legal", label: "เอกสาร/สัญญา", labelKey: "nav.documentsContracts", icon: Scale },
      { href: "/reports", label: "Reports", labelKey: "nav.reports", icon: BarChart3, ownerOnly: true },
    ],
  },
  {
    id: "system",
    label: "System",
    labelKey: "group.system",
    maturity: "beta",
    items: [
      { href: "/control-center", label: "Control Center", labelKey: "nav.controlCenter", icon: Gauge, ownerOnly: true },
      { href: "/ai-cost", label: "ต้นทุน AI", labelKey: "nav.aiCost", icon: Coins, ownerOnly: true },
      { href: "/ai-quality", label: "คุณภาพ AI", labelKey: "nav.aiQuality", icon: BadgeCheck, ownerOnly: true },
      { href: "/winback", label: "Win-back ลูกค้า", labelKey: "nav.winback", icon: Sparkles, ownerOnly: true },
      { href: "/approvals", label: "การอนุมัติ", labelKey: "nav.approvals", icon: ShieldCheck },
      { href: "/data-health", label: "Data Health", labelKey: "nav.dataHealth", icon: HeartPulse },
      { href: "/system-health", label: "System Health", labelKey: "nav.systemHealth", icon: Activity },
      { href: "/settings", label: "Settings", labelKey: "nav.settings", icon: Settings, ownerOnly: true },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

function NavLink({
  href,
  label,
  labelKey,
  icon: Icon,
  active,
  onNavigate,
  badgeCount,
}: NavItem & { active: boolean; onNavigate?: () => void; badgeCount?: number }) {
  const { lang } = useLang();
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "border border-blue-400/15 bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-purple-500/15 text-secondary shadow-[0_0_18px_-4px_rgba(99,102,241,0.45)] dark:text-white"
          : "text-secondary/55 hover:bg-line/5 hover:text-secondary dark:text-white/55 dark:hover:bg-white/5 dark:hover:text-white"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-blue-600 dark:text-blue-300" : "text-secondary/40 group-hover:text-secondary/70 dark:text-white/40 dark:group-hover:text-white/70")} />
      <span className="flex-1 truncate">{labelKey ? translate(lang, labelKey) : label}</span>
      {badgeCount ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
            active ? "bg-purple-500 text-white" : "bg-purple-500/15 text-purple-600 dark:text-purple-300"
          )}
        >
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function GroupSection({
  group,
  open,
  onToggle,
  pathname,
  onNavigate,
  showMaturity,
}: {
  group: NavGroup;
  open: boolean;
  onToggle: () => void;
  pathname: string | null;
  onNavigate?: () => void;
  showMaturity?: boolean;
}) {
  const { lang } = useLang();
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-secondary/35 transition-colors hover:text-secondary/70 dark:text-white/35 dark:hover:text-white/70"
      >
        <span className="flex items-center gap-1.5">
          {group.labelKey ? translate(lang, group.labelKey) : group.label}
          {showMaturity ? (
            <Badge variant={group.maturity === "beta" ? "warning" : "outline"} className="normal-case tracking-normal">
              {group.maturity === "beta" ? "Beta" : "Stable"}
            </Badge>
          ) : null}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-180" : "")} />
      </button>
      {open ? (
        <div className="flex flex-col gap-1 pl-1">
          {group.items.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface SidebarNavProps {
  role?: UserRole | null;
  onNavigate?: () => void;
  soloMode?: boolean;
  /** Alert Center count (system errors + needs_review conversations + a "many near end of hours" flag) — badged onto the Notifications item. */
  alertCount?: number;
}

function badgeFor(item: NavItem, alertCount: number | undefined): number | undefined {
  return item.href === "/notifications" ? alertCount : undefined;
}

export function SidebarNav({ role = null, onNavigate, soloMode = false, alertCount }: SidebarNavProps = {}) {
  const pathname = usePathname();
  const canSeeOwnerOnly = role === "owner" || role === "admin";
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.ownerOnly || canSeeOwnerOnly),
  })).filter((group) => group.items.length > 0);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(NAV_GROUPS.filter((g) => g.items.some((item) => isActive(pathname, item.href))).map((g) => g.id))
  );

  const allItems = [...TOP_LEVEL_ITEMS, ...NAV_GROUPS.flatMap((g) => g.items)];
  const coreItems = CORE_HREFS.map((href) => allItems.find((item) => item.href === href)).filter(
    (item): item is NavItem => item !== undefined && (!item.ownerOnly || canSeeOwnerOnly)
  );
  const leftoverTopLevel = TOP_LEVEL_ITEMS.filter((item) => !CORE_HREFS.includes(item.href) && (!item.ownerOnly || canSeeOwnerOnly));
  const advancedGroups = visibleGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !CORE_HREFS.includes(item.href)) }))
    .filter((group) => group.items.length > 0);
  const isOnCoreRoute = CORE_HREFS.some((href) => isActive(pathname, href));
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(() => !isOnCoreRoute);
  const { lang } = useLang();

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (soloMode) {
    return (
      <nav className="flex flex-col gap-1 p-3">
        {coreItems.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} onNavigate={onNavigate} badgeCount={badgeFor(item, alertCount)} />
        ))}

        <div className="mt-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-secondary/35 hover:text-secondary/70 dark:text-white/35 dark:hover:text-white/70"
          >
            {translate(lang, "shell.advanced")}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedOpen ? "rotate-180" : "")} />
          </button>
          {advancedOpen ? (
            <div className="flex flex-col gap-2 pl-1">
              {leftoverTopLevel.map((item) => (
                <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} onNavigate={onNavigate} badgeCount={badgeFor(item, alertCount)} />
              ))}
              {advancedGroups.map((group) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  open={openGroups.has(group.id)}
                  onToggle={() => toggleGroup(group.id)}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  showMaturity
                />
              ))}
            </div>
          ) : null}
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1 p-3">
      {TOP_LEVEL_ITEMS.map((item) => (
        <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} onNavigate={onNavigate} badgeCount={badgeFor(item, alertCount)} />
      ))}

      <div className="mt-2 flex flex-col gap-1">
        {visibleGroups.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            open={openGroups.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}
