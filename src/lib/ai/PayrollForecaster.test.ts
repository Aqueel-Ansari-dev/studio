import { describe, it, expect } from 'vitest';
import { PayrollForecaster } from './PayrollForecaster';
import type { PayrollRecord } from '@/types/database';

describe('PayrollForecaster.forecast', () => {
  it('averages recent approved payrolls', () => {
    const records: PayrollRecord[] = [
      { id: '1', employeeId: 'e1', projectId: 'p1', payPeriod: { start: '2025-06-01', end: '2025-06-30' }, hoursWorked: 0, hourlyRate: 0, taskPay: 0, approvedExpenses: 0, grossPay: 0, deductions: [], netPay: 1000, generatedBy: 'a', generatedAt: '2025-06-30', taskIdsProcessed: [], expenseIdsProcessed: [], payrollStatus: 'approved' },
      { id: '2', employeeId: 'e1', projectId: 'p1', payPeriod: { start: '2025-07-01', end: '2025-07-31' }, hoursWorked: 0, hourlyRate: 0, taskPay: 0, approvedExpenses: 0, grossPay: 0, deductions: [], netPay: 1200, generatedBy: 'a', generatedAt: '2025-07-31', taskIdsProcessed: [], expenseIdsProcessed: [], payrollStatus: 'approved' },
      { id: '3', employeeId: 'e1', projectId: 'p1', payPeriod: { start: '2025-05-01', end: '2025-05-31' }, hoursWorked: 0, hourlyRate: 0, taskPay: 0, approvedExpenses: 0, grossPay: 0, deductions: [], netPay: 800, generatedBy: 'a', generatedAt: '2025-05-31', taskIdsProcessed: [], expenseIdsProcessed: [], payrollStatus: 'approved' },
    ];
    const forecast = PayrollForecaster.forecast(records, 3);
    expect(forecast).toBeCloseTo(1000, 0);
  });
});
