import { describe, it, expect } from 'vitest';
import { PayrollAnalytics } from './PayrollAnalytics';
import type { PayrollRecord } from '@/types/database';

describe('PayrollAnalytics.computeSummary', () => {
  it('totals approved records and averages salary', () => {
    const records: PayrollRecord[] = [
      { id: '1', employeeId: 'e1', projectId: 'p1', payPeriod: { start: '2025-07-01', end: '2025-07-31' }, hoursWorked: 0, hourlyRate: 0, taskPay: 0, approvedExpenses: 0, grossPay: 0, deductions: [], netPay: 1000, generatedBy: 'a', generatedAt: '2025-07-31', taskIdsProcessed: [], expenseIdsProcessed: [], payrollStatus: 'approved' },
      { id: '2', employeeId: 'e2', projectId: 'p1', payPeriod: { start: '2025-07-01', end: '2025-07-31' }, hoursWorked: 0, hourlyRate: 0, taskPay: 0, approvedExpenses: 0, grossPay: 0, deductions: [], netPay: 2000, generatedBy: 'a', generatedAt: '2025-07-31', taskIdsProcessed: [], expenseIdsProcessed: [], payrollStatus: 'approved' },
      { id: '3', employeeId: 'e1', projectId: 'p1', payPeriod: { start: '2025-07-01', end: '2025-07-31' }, hoursWorked: 0, hourlyRate: 0, taskPay: 0, approvedExpenses: 0, grossPay: 0, deductions: [], netPay: 500, generatedBy: 'a', generatedAt: '2025-07-31', taskIdsProcessed: [], expenseIdsProcessed: [], payrollStatus: 'pending' },
    ];
    const summary = PayrollAnalytics.computeSummary(records);
    expect(summary.totalAmount).toBe(3000);
    expect(summary.employeeCount).toBe(2);
    expect(summary.averageSalary).toBe(1500);
  });
});
