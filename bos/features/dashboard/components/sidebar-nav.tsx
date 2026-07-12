"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/chat", label: "Inbox", icon: MessagesSquare },
  { href: "/students", label: "Students / CRM", icon: Users },
  { href: "/sales", label: "Sales Pipeline", icon: KanbanSquare },
  { href: "/booking", label: "Bookings", icon: CalendarPlus },
  { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
  { href: "/content", label: "SEO/AEO Content", icon: FileText },
  { href: "/accounting", label: "Accounting", icon: Wallet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary-gradient text-white shadow-soft"
                : "text-secondary/70 hover:bg-line/5 hover:text-secondary"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
