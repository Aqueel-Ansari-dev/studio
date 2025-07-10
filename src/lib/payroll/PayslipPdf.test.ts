import { describe, it, expect } from 'vitest';
import { generatePayslipPdf } from './PayslipPdf';
import type { PayrollRecord } from '@/types/database';

const record: PayrollRecord = {
  id: 'pr1',
  employeeId: 'e1',
  projectId: 'p1',
  payPeriod: { start: '2025-07-01', end: '2025-07-31' },
  hoursWorked: 40,
  hourlyRate: 10,
  taskPay: 400,
  approvedExpenses: 0,
  bonuses: [],
  allowances: [],
  overtimeHours: 0,
  overtimePay: 0,
  grossPay: 400,
  deductions: [],
  netPay: 400,
  generatedBy: 'a',
  generatedAt: '2025-07-31',
  taskIdsProcessed: [],
  expenseIdsProcessed: [],
  payrollStatus: 'approved',
};

describe('generatePayslipPdf', () => {
  it('returns a PDF buffer', async () => {
    const buf = await generatePayslipPdf(record, null, 'Alice');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});
