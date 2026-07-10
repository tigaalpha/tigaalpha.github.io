"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  userName: string;
  userEmail: string;
}

export function UserMenu({ userName, userEmail }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-line/5"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-gradient text-xs font-semibold text-white">
          {userName.slice(0, 1).toUpperCase()}
        </div>
        <span className="hidden text-sm font-medium text-secondary sm:block">{userName}</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line/5 bg-card p-2 shadow-card">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-secondary">{userName}</p>
            <p className="truncate text-xs text-secondary/50">{userEmail}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      ) : null}
    </div>
  );
}
