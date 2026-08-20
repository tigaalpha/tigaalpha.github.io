import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-semibold text-secondary">Page not found</h1>
      <p className="text-sm text-secondary/50">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/dashboard">
        <Button>Back to Dashboard</Button>
      </Link>
    </main>
  );
}
