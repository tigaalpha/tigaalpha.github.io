// Drip campaign scheduling (feature #7) — pure helpers for the drip-runner
// edge function, unit-tested from bos/lib/drip.test.ts.

/** True when a customer is due for this campaign's next message. */
export function isDripDue(lastSentAt: string | null, intervalDays: number, nowMs: number): boolean {
  if (!lastSentAt) return true;
  const last = new Date(lastSentAt).getTime();
  if (!Number.isFinite(last)) return true;
  return nowMs - last >= intervalDays * 24 * 60 * 60 * 1000;
}

/** Replaces {name} and {code} placeholders in a campaign template. */
export function renderDripTemplate(template: string, vars: { name?: string; code?: string }): string {
  return template.replace(/\{name\}/g, vars.name ?? "").replace(/\{code\}/g, vars.code ?? "");
}

export interface CampaignSegment {
  sales_statuses?: string[];
}

/** True when a customer belongs to the campaign's segment. Empty segment = everyone. */
export function customerInSegment(customerSalesStatus: string, segment: CampaignSegment | null | undefined): boolean {
  if (!segment || !Array.isArray(segment.sales_statuses) || segment.sales_statuses.length === 0) return true;
  return segment.sales_statuses.includes(customerSalesStatus);
}
