import { describe, it, expect } from 'vitest';
import { PayrollCalculationEngine } from './PayrollCalculationEngine';

describe('PayrollCalculationEngine.calculateGrossPay', () => {
  it('calculates task pay and gross pay correctly', () => {
    const result = PayrollCalculationEngine.calculateGrossPay(10, 15, 40);
    expect(result.taskPay).toBe(150);
    expect(result.grossPay).toBe(190);
  });
});
