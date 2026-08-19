"use client";

import { ChatbotBrainView } from "@/features/chatbot-brain/components/chatbot-brain-view";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";

export default function ChatbotBrainPage() {
  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🧠 Chatbot Brain</h1>
          <p className="text-sm text-secondary/50">พูดคุย ฝึกสอน และอัปโหลดรูปให้ AI เรียนรู้</p>
        </div>
        <ChatbotBrainView />
      </div>
    </OwnerOnlyGuard>
  );
}
