import { redirect } from "next/navigation";

export default function RootPage() {
  // In dev mode (no basePath), redirect to /dashboard directly.
  // In production (basePath = /studio), Next.js auto-prepends basePath.
  redirect("/dashboard");
}
