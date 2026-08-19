export type Granularity = "month" | "quarter" | "half" | "year";

export function getPeriodKey(date: Date, granularity: Granularity): { key: string; sortKey: number } {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (granularity === "month") {
    return { key: `${year}-${String(month + 1).padStart(2, "0")}`, sortKey: year * 12 + month };
  }
  if (granularity === "quarter") {
    const q = Math.floor(month / 3) + 1;
    return { key: `${year}-Q${q}`, sortKey: year * 4 + (q - 1) };
  }
  if (granularity === "half") {
    const h = month < 6 ? 1 : 2;
    return { key: `${year}-H${h}`, sortKey: year * 2 + (h - 1) };
  }
  return { key: `${year}`, sortKey: year };
}

export function periodLabel(key: string, granularity: Granularity): string {
  if (granularity === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y!, m! - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  }
  if (granularity === "quarter") {
    const [y, q] = key.split("-Q");
    return `ไตรมาส ${q} ปี ${new Date(Number(y), 0, 1).toLocaleDateString("th-TH", { year: "numeric" })}`;
  }
  if (granularity === "half") {
    const [y, h] = key.split("-H");
    return `ครึ่งปี ${h} ปี ${new Date(Number(y), 0, 1).toLocaleDateString("th-TH", { year: "numeric" })}`;
  }
  return `ปี ${new Date(Number(key), 0, 1).toLocaleDateString("th-TH", { year: "numeric" })}`;
}
