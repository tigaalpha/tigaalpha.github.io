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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden from anyone but owner/admin — mirrors is_owner_or_admin()-gated tables (transactions, integration_settings, business_snapshot, agent_schedules). RLS is still the real security boundary; this only keeps staff/teacher accounts from seeing pages they can't use. */
  ownerOnly?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  /** Shown as a badge next to the group label inside Solo Mode's Advanced section. Absent = "Stable" (the default — most groups here are shipped, working tools). */
  maturity?: "beta";
}

/** Solo Mode's flat core list, in display order — hrefs looked up from TOP_LEVEL_ITEMS/NAV_GROUPS below so labels/icons stay single-sourced. */
const CORE_HREFS = ["/dashboard", "/chat", "/students", "/sales", "/calendar", "/booking", "/knowledge", "/accounting", "/settings"];

const TOP_LEVEL_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/marketing-dashboard", label: "Marketing Dashboard", icon: LineChart },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const NAV_GROUPS: NavGroup[] = [
  {
    id: "ai-agent",
    label: "AI AGENT",
    maturity: "beta",
    items: [
      { href: "/tiga-agent", label: "TIGA AI Agent", icon: Bot, ownerOnly: true },
      { href: "/automation", label: "Automation", icon: Workflow, ownerOnly: true },
      { href: "/ai-company", label: "AI Company", icon: Building2, ownerOnly: true },
    ],
  },
  {
    id: "ai-control",
    label: "🤖 AI Control",
    items: [
      { href: "/ai-control-panel", label: "AI Control Panel", icon: Cpu },
      { href: "/ai-task-router", label: "AI Task Router", icon: GitBranch },
      { href: "/mimo-ai", label: "Mimo AI (OpenRouter)", icon: Bot, ownerOnly: true },
    ],
  },
  {
    id: "strategy",
    label: "Strategy",
    maturity: "beta",
    items: [
      { href: "/strategy", label: "AI Strategy Room", icon: Brain },
      { href: "/strategy-actions", label: "Strategy Actions", icon: ListChecks },
      { href: "/chatbot-brain", label: "Chatbot Brain", icon: Bot },
      { href: "/competitors", label: "วิเคราะห์คู่แข่ง", icon: Swords },
    ],
  },
  {
    id: "lead-sale",
    label: "🎯 Lead Sale",
    items: [
      { href: "/lead-sale", label: "แดชบอร์ด Lead", icon: TrendingUp },
      { href: "/funnel", label: "Sales Funnel", icon: Filter },
      { href: "/revenue-attribution", label: "Revenue Attribution", icon: DollarSign, ownerOnly: true },
      { href: "/lead-sale/private", label: "คอร์ส Private ตัวต่อตัว", icon: Users, ownerOnly: true },
      { href: "/lead-sale/video", label: "คอร์สวิดีโอ", icon: Clapperboard, ownerOnly: true },
      { href: "/lead-sale/tiga-ai", label: "TIGA AI (ฟรี)", icon: Smartphone },
      { href: "/referral-tracking", label: "Referral Tracking", icon: Gift },
      { href: "/lead-quiz", label: "Lead Quiz", icon: Target },
    ],
  },
  {
    id: "sales-crm",
    label: "Sales & CRM",
    items: [
      { href: "/chat", label: "Inbox", icon: MessagesSquare },
      { href: "/attendance", label: "ยืนยันการมาเรียน", icon: UserCheck },
      { href: "/students", label: "Students / CRM", icon: Users },
      { href: "/sales", label: "Sales Pipeline", icon: KanbanSquare },
      { href: "/booking", label: "Bookings", icon: CalendarPlus },
    ],
  },
  {
    id: "content-marketing",
    label: "Content & Marketing",
    items: [
      { href: "/marketing-roi", label: "Marketing ROI", icon: DollarSign, ownerOnly: true },
      { href: "/weekly-report", label: "AI Weekly Report", icon: FileBarChart },
      { href: "/auto-schedule", label: "AI Auto-Schedule", icon: CalendarClock },
      { href: "/internal-linking", label: "Internal Linking", icon: Link2 },
      { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
      { href: "/content", label: "SEO/AEO Content", icon: FileText },
      { href: "/seo-publish", label: "SEO Publish Pipeline", icon: Globe },
      { href: "/landing-pages", label: "Landing Pages", icon: Layout },
      { href: "/drip-campaign", label: "Drip Campaign", icon: Mail },
      { href: "/course-writer", label: "Online Course Writer", icon: GraduationCap },
      { href: "/app-ad-kit", label: "App Ad Kit", icon: Smartphone },
      { href: "/images", label: "Image Studio", icon: ImageIcon },
      { href: "/vertical-video", label: "Vertical Video", icon: Clapperboard },
      { href: "/video-articles", label: "Voice Over", icon: Mic },
      { href: "/voice-over", label: "Voice Over Scripts", icon: Mic },
      { href: "/post", label: "Post ทุกช่องทาง", icon: Share2 },
      { href: "/ads", label: "แคมเปญโฆษณา", icon: Megaphone },
      { href: "/marketing-channels", label: "Marketing Channels", icon: Radar },
      { href: "/social-trends", label: "Social Trends", icon: TrendingUp },
      { href: "/marketing-skills", label: "Marketing Skills", icon: Sparkles },
    ],
  },
  {
    id: "finance-legal",
    label: "Finance & Legal",
    items: [
      { href: "/accounting", label: "Accounting", icon: Wallet, ownerOnly: true },
      { href: "/receipts", label: "ใบเสร็จ", icon: ReceiptIcon, ownerOnly: true },
      { href: "/payments", label: "การชำระเงิน", icon: HandCoins, ownerOnly: true },
      { href: "/voice", label: "AI Receptionist", icon: Phone, ownerOnly: true },
      { href: "/tax", label: "ภาษีอัตโนมัติ", icon: Landmark, ownerOnly: true },
      { href: "/events", label: "งานแสดง/กิจกรรม", icon: CalendarHeart, ownerOnly: true },
      { href: "/legal", label: "เอกสาร/สัญญา", icon: Scale },
      { href: "/reports", label: "Reports", icon: BarChart3, ownerOnly: true },
    ],
  },
  {
    id: "system",
    label: "System",
    maturity: "beta",
    items: [
      { href: "/control-center", label: "Control Center", icon: Gauge, ownerOnly: true },
      { href: "/ai-cost", label: "ต้นทุน AI", icon: Coins, ownerOnly: true },
      { href: "/ai-quality", label: "คุณภาพ AI", icon: BadgeCheck, ownerOnly: true },
      { href: "/winback", label: "Win-back ลูกค้า", icon: Sparkles, ownerOnly: true },
      { href: "/approvals", label: "การอนุมัติ", icon: ShieldCheck },
      { href: "/data-health", label: "Data Health", icon: HeartPulse },
      { href: "/system-health", label: "System Health", icon: Activity },
      { href: "/settings", label: "Settings", icon: Settings, ownerOnly: true },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  badgeCount,
}: NavItem & { active: boolean; onNavigate?: () => void; badgeCount?: number }) {
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
      <span className="flex-1 truncate">{label}</span>
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
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-secondary/35 transition-colors hover:text-secondary/70 dark:text-white/35 dark:hover:text-white/70"
      >
        <span className="flex items-center gap-1.5">
          {group.label}
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
            Advanced
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
