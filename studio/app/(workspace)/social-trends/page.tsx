import { SocialTrendsView } from "@/features/social-trends/components/social-trends-view";

export default function SocialTrendsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Social Trends</h1>
        <p className="text-sm text-secondary/50">ประเด็นที่คนกำลังสนใจในแต่ละแพลตฟอร์ม จัดอันดับให้ในที่เดียว</p>
      </div>
      <SocialTrendsView />
    </div>
  );
}
