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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
}

const TOP_LEVEL_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const NAV_GROUPS: NavGroup[] = [
  {
    id: "strategy",
    label: "Strategy",
    items: [
      { href: "/strategy", label: "AI Strategy Room", icon: Brain },
      { href: "/competitors", label: "วิเคราะห์คู่แข่ง", icon: Swords },
    ],
  },
  {
    id: "sales-crm",
    label: "Sales & CRM",
    items: [
      { href: "/chat", label: "Inbox", icon: MessagesSquare },
      { href: "/students", label: "Students / CRM", icon: Users },
      { href: "/sales", label: "Sales Pipeline", icon: KanbanSquare },
      { href: "/booking", label: "Bookings", icon: CalendarPlus },
    ],
  },
  {
    id: "content-marketing",
    label: "Content & Marketing",
    items: [
      { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
      { href: "/content", label: "SEO/AEO Content", icon: FileText },
      { href: "/course-writer", label: "Online Course Writer", icon: GraduationCap },
      { href: "/app-ad-kit", label: "App Ad Kit", icon: Smartphone },
      { href: "/images", label: "Image Studio", icon: ImageIcon },
      { href: "/vertical-video", label: "Vertical Video", icon: Clapperboard },
      { href: "/video-articles", label: "Video Articles", icon: Captions },
      { href: "/voice-over", label: "Voice Over Scripts", icon: Mic },
      { href: "/post", label: "Post ทุกช่องทาง", icon: Share2 },
      { href: "/ads", label: "แคมเปญโฆษณา", icon: Megaphone },
      { href: "/marketing-channels", label: "Marketing Channels", icon: Radar },
      { href: "/social-trends", label: "Social Trends", icon: TrendingUp },
    ],
  },
  {
    id: "finance-legal",
    label: "Finance & Legal",
    items: [
      { href: "/accounting", label: "Accounting", icon: Wallet, ownerOnly: true },
      { href: "/receipts", label: "ใบเสร็จ", icon: ReceiptIcon, ownerOnly: true },
      { href: "/legal", label: "เอกสาร/สัญญา", icon: Scale },
      { href: "/reports", label: "Reports", icon: BarChart3, ownerOnly: true },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/tiga-agent", label: "TIGA AI Agent", icon: Bot, ownerOnly: true },
      { href: "/automation", label: "Automation", icon: Workflow, ownerOnly: true },
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

function NavLink({ href, label, icon: Icon, active, onNavigate }: NavItem & { active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary-gradient text-white shadow-soft" : "text-secondary/70 hover:bg-line/5 hover:text-secondary"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

interface SidebarNavProps {
  role?: UserRole | null;
  onNavigate?: () => void;
}

export function SidebarNav({ role = null, onNavigate }: SidebarNavProps = {}) {
  const pathname = usePathname();
  const canSeeOwnerOnly = role === "owner" || role === "admin";
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.ownerOnly || canSeeOwnerOnly),
  })).filter((group) => group.items.length > 0);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(NAV_GROUPS.filter((g) => g.items.some((item) => isActive(pathname, item.href))).map((g) => g.id))
  );

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-1 p-3">
      {TOP_LEVEL_ITEMS.map((item) => (
        <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
      ))}

      <div className="mt-2 flex flex-col gap-1">
        {visibleGroups.map((group) => {
          const open = openGroups.has(group.id);
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide text-secondary/50 hover:text-secondary"
              >
                {group.label}
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
        })}
      </div>
    </nav>
  );
}
