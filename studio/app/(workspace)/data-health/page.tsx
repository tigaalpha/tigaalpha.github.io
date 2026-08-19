"use client";

import { DataHealthView } from "@/features/data-health/components/data-health-view";

export default function DataHealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Data Health</h1>
        <p className="text-sm text-secondary/50">ตรวจสอบข้อมูลซ้ำ ข้อมูลที่หายไป และสถานะที่ขัดแย้งกันในระบบ CRM</p>
      </div>
      <DataHealthView />
    </div>
  );
}
