
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { notifyUserByWhatsApp } from '@/lib/notify';
import type { PayrollRecord, PayoutRecord, BankDetails } from '@/types/database';

export class PayoutProcessor {
  /**
   * Generates a simple CSV string for bank transfers in manual payout mode.
   */
  static generateBankExport(entries: Array<{ record: PayrollRecord; bank: BankDetails }>): string {
    const header = 'AccountNumber,IFSC,Amount,Remarks';
    const rows = entries.map(({ record, bank }) => {
      const remarks = `Payroll ${typeof record.payPeriod.start === 'string' ? record.payPeriod.start : record.payPeriod.start.toDate().toISOString()}`;
      return `${bank.accountNumber},${bank.ifscOrSwift},${record.netPay.toFixed(2)},${remarks}`;
    });
    return [header, ...rows].join('\n');
  }

  /**
   * Creates a payout record. Actual gateway integration is a TODO.
   */
  static async createPayoutRecord(orgId: string, payroll: PayrollRecord, method: 'auto' | 'manual'): Promise<PayoutRecord> {
    const ref = await addDoc(collection(db, 'organizations', orgId, 'payouts'), {
      organizationId: orgId,
      payrollRecordId: payroll.id,
      employeeId: payroll.employeeId,
      amount: payroll.netPay,
      method,
      status: method === 'auto' ? 'pending' : 'success',
      createdAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      organizationId: orgId,
      payrollRecordId: payroll.id,
      employeeId: payroll.employeeId,
      amount: payroll.netPay,
      method,
      status: method === 'auto' ? 'pending' : 'success',
      createdAt: serverTimestamp() as any,
    };
  }

  /** Marks a payout as successful and notifies the employee */
  static async markPayoutSuccess(orgId: string, payoutId: string, employeeId: string, amount: number, accountSuffix?: string) {
    const ref = doc(db, 'organizations', orgId, 'payouts', payoutId);
    await updateDoc(ref, { status: 'success', processedAt: serverTimestamp() });
    const suffix = accountSuffix ? `ending ${accountSuffix}` : '';
    await notifyUserByWhatsApp(employeeId, orgId, `Your salary of ₹${amount.toFixed(2)} has been disbursed to account ${suffix}.`);
  }

  /** Marks a payout as failed and records reason */
  static async markPayoutFailed(orgId: string, payoutId: string, reason: string) {
    const ref = doc(db, 'organizations', orgId, 'payouts', payoutId);
    await updateDoc(ref, { status: 'failed', failureReason: reason, processedAt: serverTimestamp() });
  }
}
