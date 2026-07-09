"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { AppShell } from "@/features/dashboard/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { BASE_PATH } from "@/lib/constants";
import type { User } from "@supabase/supabase-js";

/**
 * Static export has no server middleware, so route protection happens
 * client-side: check the session on mount, redirect to /login if absent.
 * The real security boundary is Postgres RLS (is_staff()), not this guard —
 * this only spares an authenticated-looking flash of UI before redirecting.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => setProfileName(data?.full_name ?? null));
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user === null) {
      window.location.href = `${BASE_PATH}/login/`;
    }
  }, [user]);

  if (user === "loading" || user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <AppShell userName={profileName ?? user.email ?? "User"} userEmail={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
