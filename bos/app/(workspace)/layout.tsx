import { AuthGuard } from "@/features/auth/components/auth-guard";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
