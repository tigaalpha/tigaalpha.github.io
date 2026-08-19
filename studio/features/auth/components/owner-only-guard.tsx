"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/features/auth/role-context";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Frontend-side complement to nav-hiding (sidebar-nav.tsx's ownerOnly flag)
 * for the same owner/admin-only pages -- a staff/teacher account typing the
 * URL directly would otherwise land on a page whose data silently comes
 * back empty (RLS blocks the reads) instead of a clear "not allowed"
 * redirect. RLS remains the real security boundary; this is UX + defense
 * in depth, per the rule that frontend hiding must never be the *only*
 * check.
 */
export function OwnerOnlyGuard({ children }: { children: React.ReactNode }) {
  const role = useUserRole();
  const router = useRouter();
  const allowed = role === "owner" || role === "admin";

  useEffect(() => {
    if (role !== null && !allowed) {
      router.replace("/dashboard");
    }
  }, [role, allowed, router]);

  if (role === null) return <Skeleton className="h-96" />;
  if (!allowed) return null;
  return <>{children}</>;
}
