"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { AppShell } from "@/features/dashboard/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { BASE_PATH } from "@/lib/constants";
import type { User } from "@supabase/supabase-js";

/**
 * Static export has no server middleware, so route protection happens
 * client-side. `detectSessionInUrl` is off on the client (see
 * services/supabase/client.ts) — this is the single place that exchanges a
 * PKCE `?code=` for a session, so there's no race between automatic
 * detection and an eager redirect-to-login wiping out a pending sign-in.
 * The real security boundary is Postgres RLS (is_staff()), not this guard.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [profileName, setProfileName] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function init() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.toString());

        if (error) {
          if (!cancelled) {
            setAuthError(error.message);
            setUser(null);
          }
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        const { data } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
        if (!cancelled) setProfileName(data?.full_name ?? null);
      }
    }

    init();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user === null) {
      const target = new URL(`${window.location.origin}${BASE_PATH}/login/`);
      if (authError) target.searchParams.set("authError", authError);
      window.location.href = target.toString();
    }
  }, [user, authError]);

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
