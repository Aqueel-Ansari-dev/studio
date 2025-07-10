import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';
import type { EmployeeExpense, PayrollRecord, Task, PayrollDeduction } from '@/types/database';
import { getEmployeeRate } from '@/app/actions/payroll/manageEmployeeRates';

export interface PayrollBreakdown {
  baseHours: number;
  overtimeHours: number;
  taskPay: number;
  overtimePay: number;
  approvedExpenses: number;
  grossPay: number;
  deductions: PayrollDeduction[];
  netPay: number;
}

export class PayrollCalculationEngine {
  static computeBreakdown(
    hours: number,
    rate: number,
    expenses: number,
    standardHours = 40,
    overtimeMultiplier = 1.5,
    taxRate = 0,
    customDeductions: PayrollDeduction[] = []
  ): PayrollBreakdown {
    const baseHours = Math.min(hours, standardHours);
    const overtimeHours = Math.max(0, hours - standardHours);
    const taskPay = parseFloat((baseHours * rate).toFixed(2));
    const overtimePay = parseFloat((overtimeHours * rate * overtimeMultiplier).toFixed(2));
    const grossPay = parseFloat((taskPay + overtimePay + expenses).toFixed(2));
    const deductions: PayrollDeduction[] = [...customDeductions];
    if (taxRate > 0) {
      const taxAmount = parseFloat((grossPay * taxRate).toFixed(2));
      deductions.push({ type: 'tax', reason: 'Income Tax', amount: taxAmount });
    }
    const totalDed = deductions.reduce((s, d) => s + d.amount, 0);
    const netPay = parseFloat((grossPay - totalDed).toFixed(2));
    return {
      baseHours,
      overtimeHours,
      taskPay,
      overtimePay,
      approvedExpenses: expenses,
      grossPay,
      deductions,
      netPay,
    };
  }

  async calculateForProject(
    orgId: string,
    projectId: string,
    start: Date,
    end: Date,
    adminId: string,
    options?: {
      standardHours?: number;
      overtimeMultiplier?: number;
      taxRate?: number;
      customDeductions?: Record<string, PayrollDeduction[]>;
    }
  ): Promise<PayrollRecord[]> {
    const payPeriodStart = Timestamp.fromDate(startOfDay(start));
    const payPeriodEnd = Timestamp.fromDate(endOfDay(end));

    const employeesSnap = await getDocs(query(collection(db, 'users'), where('organizationId', '==', orgId), where('role', '==', 'employee')));
    const tasksCollection = collection(db, 'organizations', orgId, 'tasks');
    const expensesCollection = collection(db, 'organizations', orgId, 'employeeExpenses');

    const batch = writeBatch(db);
    const results: PayrollRecord[] = [];

    for (const empDoc of employeesSnap.docs) {
      const employeeId = empDoc.id;
      const tasksSnap = await getDocs(query(
        tasksCollection,
        where('projectId', '==', projectId),
        where('assignedEmployeeId', '==', employeeId),
        where('status', 'in', ['completed', 'verified']),
        where('updatedAt', '>=', payPeriodStart),
        where('updatedAt', '<=', payPeriodEnd)
      ));
      let totalSeconds = 0;
      const taskIds: string[] = [];
      tasksSnap.docs.forEach(t => {
        const data = t.data() as Task;
        if (data.elapsedTime) totalSeconds += data.elapsedTime;
        taskIds.push(t.id);
      });
      const hoursWorked = parseFloat((totalSeconds / 3600).toFixed(2));

      const expSnap = await getDocs(query(
        expensesCollection,
        where('employeeId', '==', employeeId),
        where('projectId', '==', projectId),
        where('approved', '==', true),
        where('processed', '!=', true),
        where('approvedAt', '>=', payPeriodStart.toDate().toISOString()),
        where('approvedAt', '<=', payPeriodEnd.toDate().toISOString())
      ));
      let expensesTotal = 0;
      const expenseIds: string[] = [];
      expSnap.docs.forEach(e => {
        const data = e.data() as EmployeeExpense;
        expensesTotal += data.amount;
        expenseIds.push(e.id);
        batch.update(e.ref, { processed: true });
      });
      expensesTotal = parseFloat(expensesTotal.toFixed(2));

      const rateInfo = await getEmployeeRate(employeeId);
      const rate = rateInfo?.paymentMode === 'hourly' && rateInfo.hourlyRate ? rateInfo.hourlyRate : 0;
      const breakdown = PayrollCalculationEngine.computeBreakdown(
        hoursWorked,
        rate,
        expensesTotal,
        options?.standardHours ?? 40,
        options?.overtimeMultiplier ?? 1.5,
        options?.taxRate ?? 0,
        options?.customDeductions?.[employeeId] ?? []
      );

      const recRef = doc(collection(db, 'organizations', orgId, 'payrollRecords'));
      const record: Omit<PayrollRecord, 'id'> = {
        employeeId,
        projectId,
        payPeriod: { start: payPeriodStart, end: payPeriodEnd },
        hoursWorked,
        hourlyRate: rate,
        taskPay: breakdown.taskPay,
        approvedExpenses: expensesTotal,
        overtimeHours: breakdown.overtimeHours,
        overtimePay: breakdown.overtimePay,
        grossPay: breakdown.grossPay,
        deductions: breakdown.deductions,
        netPay: breakdown.netPay,
        generatedBy: adminId,
        generatedAt: serverTimestamp() as Timestamp,
        taskIdsProcessed: taskIds,
        expenseIdsProcessed: expenseIds,
        payrollStatus: 'pending',
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null
      };
      batch.set(recRef, record);
      results.push({ id: recRef.id, ...record });
    }

    await batch.commit();
    return results;
  }
}
