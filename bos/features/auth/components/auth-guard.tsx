"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { AppShell } from "@/features/dashboard/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { BASE_PATH } from "@/lib/constants";
import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
        let error = (await supabase.auth.exchangeCodeForSession(code)).error;

        // Mobile networks occasionally drop this one request right after the
        // OAuth redirect; Supabase itself marks these as safe to retry.
        for (let attempt = 0; error && isAuthRetryableFetchError(error) && attempt < 2; attempt++) {
          await delay(750 * (attempt + 1));
          error = (await supabase.auth.exchangeCodeForSession(code)).error;
        }

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

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      // INITIAL_SESSION re-reads storage independently of init() above and
      // can resolve after it with a stale "no session yet" snapshot taken
      // before the code exchange saved the new session — applying it here
      // would bounce a freshly-signed-in user straight back to /login.
      if (event === "INITIAL_SESSION") return;
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
