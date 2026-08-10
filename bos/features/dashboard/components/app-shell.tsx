"use client";

import { useEffect, useState } from "react";
import { Menu, X, Zap, ZapOff } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FloatingAssistant } from "@/features/assistant/components/floating-assistant";
import { cn } from "@/lib/utils";
import { getStoredSoloMode, setStoredSoloMode } from "@/lib/solo-mode";
import type { UserRole } from "@/types/database";

interface AppShellProps {
  userName: string;
  userEmail: string;
  role: UserRole | null;
  children: React.ReactNode;
}

function SoloModeToggle({ soloMode, onToggle }: { soloMode: boolean | null; onToggle: () => void }) {
  if (soloMode === null) {
    return <div className="h-9 w-9" aria-hidden />;
  }
  return (
    <button
      onClick={onToggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-line/5"
      aria-label={soloMode ? "สลับไปโหมดเต็ม" : "สลับไปโหมด Solo"}
      title={soloMode ? "โหมด Solo — คลิกเพื่อดูเมนูทั้งหมด" : "คลิกเพื่อเข้าโหมด Solo (ย่อเมนูให้เหลือแต่ที่ใช้ทุกวัน)"}
    >
      {soloMode ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
    </button>
  );
}

export function AppShell({ userName, userEmail, role, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [soloMode, setSoloMode] = useState<boolean | null>(null);

  useEffect(() => {
    setSoloMode(getStoredSoloMode());
  }, []);

  function toggleSoloMode() {
    const next = !soloMode;
    setStoredSoloMode(next);
    setSoloMode(next);
  }

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="hidden w-64 shrink-0 border-r border-line/5 bg-card md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="h-8 w-8 rounded-xl bg-primary-gradient" aria-hidden />
          <span className="text-sm font-semibold text-secondary">Tiga AI BOS</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={role} soloMode={soloMode ?? false} />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-card shadow-card">
            <div className="flex shrink-0 items-center justify-between px-5 py-5">
              <span className="text-sm font-semibold text-secondary">Tiga AI BOS</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5 text-secondary/60" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav role={role} soloMode={soloMode ?? false} onNavigate={() => setMobileOpen(false)} />
            </div>
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
            <SoloModeToggle soloMode={soloMode} onToggle={toggleSoloMode} />
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
