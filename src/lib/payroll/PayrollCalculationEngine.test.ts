import test from 'node:test';
import assert from 'node:assert/strict';
import { PayrollCalculationEngine } from './PayrollCalculationEngine';

test('PayrollCalculationEngine.computeBreakdown handles overtime, bonuses, allowances and taxes', () => {
    const bonuses = [{ type: 'performance', reason: 'Great work', amount: 50 }];
    const allowances = [{ name: 'travel', amount: 25 }];
    const result = PayrollCalculationEngine.computeBreakdown(45, 10, 0, 40, 1.5, 0.1, [], bonuses, allowances);
    assert.equal(result.taskPay, 400);
    assert.equal(result.overtimePay, 75);
    assert.equal(result.grossPay, 525); // 400 + 75 + 50 + 25
    const tax = result.deductions.find(d => d.type === 'tax');
    assert.equal(tax?.amount, 52.5);
    assert.equal(result.netPay, 472.5);
});
