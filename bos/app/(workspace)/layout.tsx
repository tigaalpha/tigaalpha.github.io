import { AuthGuard } from "@/features/auth/components/auth-guard";
import { AgentFAB } from "@/features/dashboard/components/agent-fab";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
      <AgentFAB />
    </AuthGuard>
  );
}
