"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FloatingAssistant } from "@/features/assistant/components/floating-assistant";
import { cn } from "@/lib/utils";

interface AppShellProps {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

export function AppShell({ userName, userEmail, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="hidden w-64 shrink-0 border-r border-line/5 bg-card md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="h-8 w-8 rounded-xl bg-primary-gradient" aria-hidden />
          <span className="text-sm font-semibold text-secondary">Tiga AI BOS</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-card shadow-card">
            <div className="flex items-center justify-between px-5 py-5">
              <span className="text-sm font-semibold text-secondary">Tiga AI BOS</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5 text-secondary/60" />
              </button>
            </div>
            <SidebarNav />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line/5 bg-card/80 px-4 backdrop-blur md:px-6">
          <button
            className={cn("rounded-lg p-2 hover:bg-line/5 md:hidden")}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-secondary" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu userName={userName} userEmail={userEmail} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>

      <FloatingAssistant />
    </div>
  );
}
