// GSTR-3B for month M is due on the 20th of month M+1, and a period only counts once it is due
const DUE_DAY = 20;

export function dueGstr3bPeriods(now: Date, count: number): string[] {
  const periods: string[] = [];
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1; // 1-12, the month we are in
  // The period for last month falls due this month on the 20th
  month -= now.getUTCDate() >= DUE_DAY ? 1 : 2;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  for (let i = 0; i < count; i++) {
    periods.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return periods;
}

// Indian financial year of a YYYY-MM period, formatted like "2025-26"
export function financialYearOf(period: string): string {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
