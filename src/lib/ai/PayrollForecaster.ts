import type { PayrollRecord } from '@/types/database';

/**
 * Forecast upcoming payroll cost based on historical approved records.
 * Uses a simple average of the last n periods.
 */
export class PayrollForecaster {
  static forecast(records: PayrollRecord[], periods = 3): number {
    const approved = records
      .filter(r => r.payrollStatus === 'approved')
      .sort((a, b) => {
        const da = new Date(a.payPeriod.end as any).getTime();
        const db = new Date(b.payPeriod.end as any).getTime();
        return db - da;
      })
      .slice(0, periods);
    if (approved.length === 0) return 0;
    const total = approved.reduce((s, r) => s + r.netPay, 0);
    return parseFloat((total / approved.length).toFixed(2));
  }
}
