"use client";

import { ApprovalsManager } from "@/features/approvals/components/approvals-manager";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">การอนุมัติ</h1>
        <p className="text-sm text-secondary/50">ตรวจสอบและอนุมัติ action ที่ AI ขอทำแทน ก่อนดำเนินการจริง</p>
      </div>
      <ApprovalsManager />
    </div>
  );
}
