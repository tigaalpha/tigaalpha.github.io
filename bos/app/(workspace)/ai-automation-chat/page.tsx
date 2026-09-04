import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";
import { AiAutomationChat } from "@/features/ai-automation-chat/components/ai-automation-chat";

export const metadata = {
  title: "AI Automation Chat — TIGA Automation",
};

export default function AiAutomationChatPage() {
  return (
    <OwnerOnlyGuard>
      <div className="p-4 lg:p-6">
        <AiAutomationChat />
      </div>
    </OwnerOnlyGuard>
  );
}
