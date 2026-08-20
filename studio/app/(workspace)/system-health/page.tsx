"use client";

import { SystemHealthView } from "@/features/system-health/components/system-health-view";

export default function SystemHealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">System Health</h1>
        <p className="text-sm text-secondary/50">สถานะระบบ AI และ error ที่เกิดขึ้นล่าสุด</p>
      </div>
      <SystemHealthView />
    </div>
  );
}
