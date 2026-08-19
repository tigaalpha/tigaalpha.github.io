/**
 * Pure duplicate-customer detection (unit-testable, no DB access).
 * Two customers count as a likely duplicate when they share a phone number
 * or the same normalized name. Returns candidate pairs to merge, oldest row
 * first so the surviving row keeps the earliest history.
 */

export interface CustomerLike {
  id: string;
  name: string;
  phone?: string | null;
  created_at?: string | null;
}

export interface DuplicatePair {
  keepId: string;
  keepName: string;
  dupId: string;
  dupName: string;
  matchField: "phone" | "name";
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s._\-']+/g, "")
    .trim();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

const MAX_PAIRS = 10;

/** Group customers by a key, then pair each group's first entry with the rest. */
function pairsFromGroups(
  groups: Map<string, CustomerLike[]>,
  matchField: DuplicatePair["matchField"]
): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Sort oldest first so `keep` = the original record.
    group.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    const keep = group[0];
    if (!keep) continue;
    for (const dup of group.slice(1)) {
      pairs.push({ keepId: keep.id, keepName: keep.name, dupId: dup.id, dupName: dup.name, matchField });
      if (pairs.length >= MAX_PAIRS) return pairs;
    }
  }
  return pairs;
}

export function findDuplicateCandidates(customers: CustomerLike[]): DuplicatePair[] {
  const byPhone = new Map<string, CustomerLike[]>();
  const byName = new Map<string, CustomerLike[]>();

  for (const customer of customers) {
    if (!customer?.id) continue;
    const phone = customer.phone ? normalizePhone(customer.phone) : "";
    if (phone.length >= 9) {
      const list = byPhone.get(phone) ?? [];
      list.push(customer);
      byPhone.set(phone, list);
    }
    const name = normalizeName(customer.name);
    if (name.length >= 2) {
      const list = byName.get(name) ?? [];
      list.push(customer);
      byName.set(name, list);
    }
  }

  const pairs = pairsFromGroups(byPhone, "phone");
  const seen = new Set(pairs.map((p) => `${p.keepId}:${p.dupId}`));
  for (const pair of pairsFromGroups(byName, "name")) {
    if (pairs.length >= MAX_PAIRS) break;
    const key = `${pair.keepId}:${pair.dupId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(pair);
  }
  return pairs;
}

/** Tables that hold a customer_id FK (verified against the migrations). */
export const CUSTOMER_ID_TABLES = [
  "attendance_reminder_schedules",
  "bookings",
  "conversations",
  "courses",
  "drip_sends",
  "kb_learning_log",
  "legal_documents",
  "lesson_notes",
  "notifications",
  "payments",
  "reactivation_log",
  "receipts",
  "sales_status_history",
  "tasks",
  "transactions",
  "transfer_slips",
  "waitlist",
];
