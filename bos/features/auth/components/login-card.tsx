"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/services/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BASE_PATH } from "@/lib/constants";

function AuthErrorBanner() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("authError");

  if (!authError) return null;

  return (
    <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
      Sign-in failed: {authError}
    </p>
  );
}

export function LoginCard() {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    // AuthGuard (on the destination page) explicitly exchanges the PKCE
    // ?code= param — see features/auth/components/auth-guard.tsx.
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${BASE_PATH}/dashboard/`,
      },
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 h-12 w-12 rounded-2xl bg-primary-gradient" aria-hidden />
        <CardTitle className="text-xl">Tiga AI BOS</CardTitle>
        <CardDescription>Sign in to manage your studio</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <AuthErrorBanner />
        </Suspense>
        <Button className="w-full" onClick={signInWithGoogle} disabled={loading}>
          {loading ? "Redirecting…" : "Continue with Google"}
        </Button>
      </CardContent>
    </Card>
  );
}
