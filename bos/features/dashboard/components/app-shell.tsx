"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Zap,
  ZapOff,
  Bell,
  LayoutDashboard,
  Users,
  CalendarDays,
  MessagesSquare,
  MoreHorizontal,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { cn } from "@/lib/utils";
import { getStoredSoloMode, setStoredSoloMode } from "@/lib/solo-mode";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import type { UserRole } from "@/types/database";

interface AppShellProps {
  userName: string;
  userEmail: string;
  role: UserRole | null;
  children: React.ReactNode;
}

// "Many" customers near end of hours contributes a single alert item, not
// a per-customer count -- matches how the spec phrases it as one alert
// condition, alongside the individually-countable problems/needs_review.
const MANY_NEAR_END_OF_HOURS_THRESHOLD = 5;

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  teacher: "Teacher",
  staff: "Staff",
};

function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-primary-gradient shadow-glow",
        size === "md" ? "h-9 w-9" : "h-7 w-7"
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className={cn("text-white", size === "md" ? "h-4 w-4" : "h-3.5 w-3.5")} fill="currentColor">
        <path d="M12 3 L21 20.5 H3 Z" />
      </svg>
    </div>
  );
}

function SoloModeToggle({ soloMode, onToggle }: { soloMode: boolean | null; onToggle: () => void }) {
  if (soloMode === null) {
    return <div className="h-9 w-9" aria-hidden />;
  }
  return (
    <button
      onClick={onToggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary/60 hover:bg-line/5 hover:text-secondary dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
      aria-label={soloMode ? "สลับไปโหมดเต็ม" : "สลับไปโหมด Solo"}
      title={soloMode ? "โหมด Solo — คลิกเพื่อดูเมนูทั้งหมด" : "คลิกเพื่อเข้าโหมด Solo (ย่อเมนูให้เหลือแต่ที่ใช้ทุกวัน)"}
    >
      {soloMode ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
    </button>
  );
}

function BellLink({ alertCount }: { alertCount: number }) {
  return (
    <Link
      href="/notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-secondary/60 transition-colors hover:bg-line/5 hover:text-secondary dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />
      {alertCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-bold text-white">
          {alertCount > 9 ? "9+" : alertCount}
        </span>
      ) : null}
    </Link>
  );
}

const MOBILE_TABS: { href: string; label: string; icon: LucideIcon; badge?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/chat", label: "Messages", icon: MessagesSquare, badge: true },
];

function MobileBottomNav({ alertCount, onMore }: { alertCount: number; onMore: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line/10 bg-white/95 px-2 py-1.5 backdrop-blur dark:border-white/5 dark:bg-[#0d1017]/95 md:hidden">
      {MOBILE_TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors",
              active ? "text-purple-600 dark:text-purple-400" : "text-secondary/45 hover:text-secondary/80 dark:text-white/45 dark:hover:text-white/80"
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {tab.badge && alertCount > 0 ? (
                <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-purple-500 px-0.5 text-[9px] font-bold text-white">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              ) : null}
            </span>
            {tab.label}
          </Link>
        );
      })}
      <button
        onClick={onMore}
        className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium text-secondary/45 transition-colors hover:text-secondary/80 dark:text-white/45 dark:hover:text-white/80"
      >
        <MoreHorizontal className="h-5 w-5" />
        More
      </button>
    </nav>
  );
}

export function AppShell({ userName, userEmail, role, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [soloMode, setSoloMode] = useState<boolean | null>(null);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    setSoloMode(getStoredSoloMode());
  }, []);

  useEffect(() => {
    const repos = createRepositories(createClient());
    Promise.all([repos.systemEvents.countRecent(24), repos.conversations.countNeedingReview(), repos.courses.renewalOpportunities(3)])
      .then(([problemsCount, needsReviewCount, renewals]) => {
        setAlertCount(problemsCount + needsReviewCount + (renewals.length >= MANY_NEAR_END_OF_HOURS_THRESHOLD ? 1 : 0));
      })
      .catch(() => {
        // best-effort -- a failed alert-count fetch shouldn't block the rest of the app shell from rendering
      });
  }, []);

  function toggleSoloMode() {
    const next = !soloMode;
    setStoredSoloMode(next);
    setSoloMode(next);
  }

  const roleLabel = role ? ROLE_LABEL[role] : "Admin";

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line/10 bg-white md:flex dark:border-white/5 dark:bg-[#0d1017]">
        <div className="flex items-center gap-3 px-5 pb-4 pt-6">
          <BrandMark />
          <div>
            <p className="text-sm font-bold leading-tight tracking-wide text-secondary dark:text-white">TIGA AUTOMATION</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-secondary/35 dark:text-white/35">AI OS</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          <SidebarNav role={role} soloMode={soloMode ?? false} alertCount={alertCount} />
        </div>
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-2xl border border-line/10 bg-line/[0.03] p-3 dark:border-white/5 dark:bg-white/[0.03]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-gradient text-xs font-bold text-white">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-secondary dark:text-white">{userName}</p>
              <p className="text-[11px] text-secondary/40 dark:text-white/40">{roleLabel}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-secondary/25 dark:text-white/25" />
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-card dark:bg-[#0d1017]">
            <div className="flex shrink-0 items-center justify-between px-5 py-5">
              <div className="flex items-center gap-2.5">
                <BrandMark size="sm" />
                <span className="text-sm font-bold tracking-wide text-secondary dark:text-white">TIGA AUTOMATION</span>
              </div>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-secondary/50 hover:bg-line/5 dark:text-white/50 dark:hover:bg-white/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2">
              <SidebarNav role={role} soloMode={soloMode ?? false} alertCount={alertCount} onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="p-3">
              <div className="flex items-center gap-3 rounded-2xl border border-line/10 bg-line/[0.03] p-3 dark:border-white/5 dark:bg-white/[0.03]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-gradient text-xs font-bold text-white">
                  {userName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-secondary dark:text-white">{userName}</p>
                  <p className="text-[11px] text-secondary/40 dark:text-white/40">{roleLabel}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-line/10 bg-white/85 px-4 backdrop-blur md:px-6 dark:border-white/5 dark:bg-[#0b0e14]/85">
          <div className="flex items-center gap-3">
            <button
              className={cn("rounded-lg p-2 hover:bg-line/5 dark:hover:bg-white/5 md:hidden")}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-secondary/70 dark:text-white/70" />
            </button>
            <div className="flex items-center gap-2.5 md:hidden">
              <BrandMark size="sm" />
              <span className="text-sm font-bold tracking-wide text-secondary dark:text-white">TIGA AUTOMATION</span>
            </div>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1.5">
            <SoloModeToggle soloMode={soloMode} onToggle={toggleSoloMode} />
            <ThemeToggle />
            <BellLink alertCount={alertCount} />
            <UserMenu userName={userName} userEmail={userEmail} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>

      <MobileBottomNav alertCount={alertCount} onMore={() => setMobileOpen(true)} />


    </div>
  );
}
