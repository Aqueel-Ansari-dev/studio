import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { notifyUserByWhatsApp } from '@/lib/notify';
import type { PayrollRecord } from '@/types/database';

export class PayrollApproval {
  static async approve(
    orgId: string,
    payrollId: string,
    adminId: string,
    employeeId: string,
    period: { start: string | Date; end: string | Date },
    notes?: string
  ) {
    const recRef = doc(db, 'organizations', orgId, 'payrollRecords', payrollId);
    await updateDoc(recRef, {
      payrollStatus: 'approved',
      approvedBy: adminId,
      approvedAt: serverTimestamp(),
      rejectionReason: null,
      approverNotes: notes ?? null
    });
    const start = typeof period.start === 'string' ? period.start : period.start.toISOString();
    const end = typeof period.end === 'string' ? period.end : period.end.toISOString();
    const msg = `✅ Payroll approved for ${start} - ${end}.`;
    await notifyUserByWhatsApp(employeeId, orgId, msg);
  }

  static async reject(orgId: string, payrollId: string, adminId: string, employeeId: string, reason: string) {
    const recRef = doc(db, 'organizations', orgId, 'payrollRecords', payrollId);
    await updateDoc(recRef, {
      payrollStatus: 'rejected',
      approvedBy: adminId,
      approvedAt: serverTimestamp(),
      rejectionReason: reason
    });
    await notifyUserByWhatsApp(employeeId, orgId, `❌ Payroll rejected: ${reason}`);
  }
}
