import { describe, it, expect } from 'vitest';
import { PayrollCalculationEngine } from './PayrollCalculationEngine';

describe('PayrollCalculationEngine.computeBreakdown', () => {
  it('handles overtime and taxes', () => {
    const result = PayrollCalculationEngine.computeBreakdown(45, 10, 0, 40, 1.5, 0.1);
    expect(result.taskPay).toBe(400);
    expect(result.overtimePay).toBe(75);
    expect(result.grossPay).toBe(475);
    const tax = result.deductions.find(d => d.type === 'tax');
    expect(tax?.amount).toBe(47.5);
    expect(result.netPay).toBe(427.5);
  });
});
