"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Root-level error boundary. app/(workspace)/error.tsx only wraps routed
 * page content — an unhandled error thrown inside AuthGuard/AppShell/
 * SidebarNav/FloatingAssistant (the chrome every page renders, from
 * (workspace)/layout.tsx) had nothing above it to catch it. In a static
 * export there's no server to fall back to, so that was a blank white page
 * with no recovery. This boundary sits at the root, above every layout
 * except the root layout itself, so it catches those too.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page p-6 text-center">
      <AlertTriangle className="h-10 w-10 text-danger" />
      <div>
        <p className="text-lg font-semibold text-secondary">เกิดข้อผิดพลาดบางอย่าง</p>
        <p className="mt-1 text-sm text-secondary/60">{error.message || "Something went wrong."}</p>
      </div>
      <button
        onClick={reset}
        className="rounded-xl bg-primary-gradient px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-105"
      >
        ลองใหม่
      </button>
    </div>
  );
}
