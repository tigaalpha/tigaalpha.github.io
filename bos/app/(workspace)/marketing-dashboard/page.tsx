import { MarketingDashboardView } from "@/features/marketing-dashboard/components/marketing-dashboard-view";

export default function MarketingDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Marketing Dashboard</h1>
        <p className="text-sm text-secondary/50">ผู้ติดตาม, ไลก์, วิว, แชร์, คอมเมนต์ และอื่นๆ รวมทุกช่องทางการตลาด ดูย้อนหลังได้หลายช่วงเวลา</p>
      </div>
      <MarketingDashboardView />
    </div>
  );
}
