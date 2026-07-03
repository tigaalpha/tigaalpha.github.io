"use client";

import { useState } from "react";
import { createClient } from "@/services/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function LoginCard() {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
        <Button className="w-full" onClick={signInWithGoogle} disabled={loading}>
          {loading ? "Redirecting…" : "Continue with Google"}
        </Button>
      </CardContent>
    </Card>
  );
}
