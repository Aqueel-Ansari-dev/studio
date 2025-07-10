import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { notifyUserByWhatsApp, notifyRoleByWhatsApp } from '@/lib/notify';
import type { PayrollRecord, PayrollRun, PayoutRecord, User, SystemSettings, BankDetails } from '@/types/database';
import { PayoutProcessor } from './PayoutProcessor';

/**
 * Handles executing approved payroll records into payout batches.
 */
export class PayrollRunProcessor {
  /**
   * Runs payroll for the specified period and returns the generated CSV export.
   * In mock mode this simply creates payout records and marks payroll locked.
   */
  static async runPayroll(
    orgId: string,
    start: Date,
    end: Date,
    adminId: string,
    method: 'auto' | 'manual' = 'manual',
    settings?: SystemSettings | null
  ): Promise<{ run: PayrollRun; payouts: PayoutRecord[]; csv: string }> {
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);
    const recordsSnap = await getDocs(
      query(
        collection(db, 'organizations', orgId, 'payrollRecords'),
        where('payPeriod.start', '>=', startTs),
        where('payPeriod.end', '<=', endTs),
        where('payrollStatus', '==', 'approved')
      )
    );

    const batch = writeBatch(db);
    const entries: Array<{ record: PayrollRecord; bank: BankDetails }> = [];
    const payouts: PayoutRecord[] = [];
    let total = 0;

    for (const docSnap of recordsSnap.docs) {
      const data = docSnap.data() as PayrollRecord;
      const userSnap = await getDoc(doc(db, 'organizations', orgId, 'users', data.employeeId));
      const user = userSnap.exists() ? (userSnap.data() as User) : null;
      if (!user?.bankDetails) {
        await notifyUserByWhatsApp(data.employeeId, orgId, '⚠️ Salary payment issue detected. Please update bank details.');
        continue;
      }

      const record: PayrollRecord = { id: docSnap.id, ...data };
      const payout = await PayoutProcessor.createPayoutRecord(orgId, record, method);
      payouts.push(payout);
      entries.push({ record, bank: user.bankDetails });
      total += record.netPay;
      batch.update(docSnap.ref, { locked: true, payRunId: null });
    }

    const runRef = await addDoc(collection(db, 'organizations', orgId, 'payRuns'), {
      organizationId: orgId,
      periodStart: startTs,
      periodEnd: endTs,
      totalAmount: total,
      status: method === 'auto' ? 'pending' : 'paid',
      createdBy: adminId,
      createdAt: serverTimestamp(),
    });

    const csv = PayoutProcessor.generateBankExport(entries);
    await batch.commit();

    // Notifications
    await notifyRoleByWhatsApp(orgId, 'admin', `💰 Payroll run complete. ${payouts.length} employees paid total \u20B9${total.toFixed(2)}.`);
    for (const { record } of entries) {
      const msgTemplate = settings?.payoutNotificationTemplate ||
        '✅ Your salary for {month} \u20B9{amount} has been processed.';
      const month = start.toLocaleString('default', { month: 'long' });
      const msg = msgTemplate
        .replace('{month}', month)
        .replace('{amount}', record.netPay.toFixed(2));
      await notifyUserByWhatsApp(record.employeeId, orgId, msg);
    }

    const run: PayrollRun = {
      id: runRef.id,
      organizationId: orgId,
      periodStart: startTs,
      periodEnd: endTs,
      totalAmount: total,
      status: method === 'auto' ? 'pending' : 'paid',
      createdBy: adminId,
      createdAt: serverTimestamp() as any,
    };

    return { run, payouts, csv };
  }
}
