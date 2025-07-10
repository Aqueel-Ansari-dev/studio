import { describe, it, expect } from 'vitest';
import { PayoutProcessor } from './PayoutProcessor';

const dummyRecord: any = {
  id: 'rec1',
  netPay: 1000,
  payPeriod: { start: '2025-07-01', end: '2025-07-31' },
  employeeId: 'emp1',
};

const bank = {
  accountNumber: '1234567890',
  ifscOrSwift: 'IFSC001',
  accountHolderName: 'John Doe',
  upiId: 'john@upi',
};

describe('PayoutProcessor.generateBankExport', () => {
  it('creates CSV with header and one row', () => {
    const csv = PayoutProcessor.generateBankExport([{ record: dummyRecord, bank }]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('AccountNumber,IFSC,Amount,Remarks');
    expect(lines.length).toBe(2);
  });
});
