import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { PayrollRecord } from '@/types/database';

export interface MonthlyPayrollSummary {
  totalAmount: number;
  employeeCount: number;
  averageSalary: number;
}

export class PayrollAnalytics {
  /**
   * Compute a summary from a list of payroll records.
   * Only approved records are included.
   */
  static computeSummary(records: PayrollRecord[]): MonthlyPayrollSummary {
    const approved = records.filter(r => r.payrollStatus === 'approved');
    let total = 0;
    const employees = new Set<string>();
    approved.forEach(r => {
      total += r.netPay;
      employees.add(r.employeeId);
    });
    const count = employees.size;
    return {
      totalAmount: parseFloat(total.toFixed(2)),
      employeeCount: count,
      averageSalary: count > 0 ? parseFloat((total / count).toFixed(2)) : 0,
    };
  }

  /**
   * Fetch approved payroll records for a given month and compute summary.
   */
  static async getMonthlySummary(orgId: string, month: number, year: number): Promise<MonthlyPayrollSummary> {
    const start = Timestamp.fromDate(new Date(year, month - 1, 1));
    const end = Timestamp.fromDate(new Date(year, month, 0));
    const q = query(
      collection(db, 'organizations', orgId, 'payrollRecords'),
      where('payPeriod.start', '>=', start),
      where('payPeriod.end', '<=', end),
      where('payrollStatus', '==', 'approved')
    );
    const snap = await getDocs(q);
    const records: PayrollRecord[] = [];
    snap.forEach(d => records.push(d.data() as PayrollRecord));
    return this.computeSummary(records);
  }
}
