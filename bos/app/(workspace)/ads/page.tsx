"use client";

import { AdCampaignManager } from "@/features/ads/components/ad-campaign-manager";
import { AdAttribution } from "@/features/ads/components/ad-attribution";

export default function AdsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">แคมเปญโฆษณา</h1>
        <p className="text-sm text-secondary/50">AI ร่างกลยุทธ์และข้อความโฆษณา — staff อนุมัติก่อนใช้เงินทุกครั้ง</p>
      </div>
      <AdAttribution />
      <AdCampaignManager />
    </div>
  );
}
