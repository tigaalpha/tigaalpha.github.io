// Teacher payroll computation (feature #10) — pure and unit-tested. The
// monthly payroll-report edge function feeds completed bookings + rates in
// and formats the output; this file owns the math.

export interface PayrollEntry {
  teacherId: string;
  teacherName: string;
  ratePerHour: number;
  /** Total minutes taught in the period (summed from completed bookings). */
  minutes: number;
}

export interface PayrollResult {
  teacherId: string;
  teacherName: string;
  hours: number;
  amount: number;
}

export function computePayroll(entries: PayrollEntry[]): PayrollResult[] {
  return entries
    .filter((e) => e.ratePerHour > 0 && e.minutes > 0)
    .map((e) => {
      const hours = Math.round((e.minutes / 60) * 100) / 100;
      return {
        teacherId: e.teacherId,
        teacherName: e.teacherName,
        hours,
        amount: Math.round(hours * e.ratePerHour * 100) / 100,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}
