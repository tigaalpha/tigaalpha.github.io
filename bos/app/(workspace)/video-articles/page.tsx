"use client";

import { VoiceOverManager } from "@/features/voiceover/components/voiceover-manager";

export default function VideoArticlesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🎙️ Voice Over</h1>
        <p className="text-sm text-secondary/50">
          วางบทความ → เลือกเสียงชาย/หญิง → แปลงเป็นเสียงทันที เลือก Model AI ได้อิสระ
        </p>
      </div>
      <VoiceOverManager />
    </div>
  );
}
