"use client";

import { LegalDocumentManager } from "@/features/legal/components/legal-document-manager";

export default function LegalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">เอกสาร/สัญญา</h1>
        <p className="text-sm text-secondary/50">AI ร่างสัญญาลงทะเบียนเรียนและหนังสือยินยอมผู้ปกครอง — ต้องให้ทนายตรวจก่อนใช้จริง</p>
      </div>
      <LegalDocumentManager />
    </div>
  );
}
