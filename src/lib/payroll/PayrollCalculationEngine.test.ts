import { describe, it, expect } from 'vitest';
import { PayrollCalculationEngine } from './PayrollCalculationEngine';

describe('PayrollCalculationEngine.computeBreakdown', () => {
  it('handles overtime, bonuses, allowances and taxes', () => {
    const bonuses = [{ type: 'performance', reason: 'Great work', amount: 50 }];
    const allowances = [{ name: 'travel', amount: 25 }];
    const result = PayrollCalculationEngine.computeBreakdown(45, 10, 0, 40, 1.5, 0.1, [], bonuses, allowances);
    expect(result.taskPay).toBe(400);
    expect(result.overtimePay).toBe(75);
    expect(result.grossPay).toBe(525); // 400 + 75 + 50 + 25
    const tax = result.deductions.find(d => d.type === 'tax');
    expect(tax?.amount).toBe(52.5);
    expect(result.netPay).toBe(472.5);
  });
});
