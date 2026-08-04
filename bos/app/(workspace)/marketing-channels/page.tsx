import { MarketingChannelsView } from "@/features/marketing-channels/components/marketing-channels-view";

export default function MarketingChannelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Marketing Channels</h1>
        <p className="text-sm text-secondary/50">สถานะและสถิติของทุกช่องทางการตลาดในที่เดียว</p>
      </div>
      <MarketingChannelsView />
    </div>
  );
}
