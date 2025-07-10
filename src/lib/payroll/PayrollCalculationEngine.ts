import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, writeBatch, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';
import type { EmployeeExpense, PayrollRecord, Task } from '@/types/database';
import { getEmployeeRate } from '@/app/actions/payroll/manageEmployeeRates';

export interface GrossPayBreakdown {
  hoursWorked: number;
  taskPay: number;
  approvedExpenses: number;
  grossPay: number;
}

export class PayrollCalculationEngine {
  static calculateGrossPay(hours: number, rate: number, expenses: number): GrossPayBreakdown {
    const taskPay = parseFloat((hours * rate).toFixed(2));
    const grossPay = parseFloat((taskPay + expenses).toFixed(2));
    return { hoursWorked: hours, taskPay, approvedExpenses: expenses, grossPay };
  }

  async calculateForProject(orgId: string, projectId: string, start: Date, end: Date, adminId: string): Promise<PayrollRecord[]> {
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
      const { taskPay, grossPay } = PayrollCalculationEngine.calculateGrossPay(hoursWorked, rate, expensesTotal);

      const recRef = doc(collection(db, 'organizations', orgId, 'payrollRecords'));
      const record: Omit<PayrollRecord, 'id'> = {
        employeeId,
        projectId,
        payPeriod: { start: payPeriodStart, end: payPeriodEnd },
        hoursWorked,
        hourlyRate: rate,
        taskPay,
        approvedExpenses: expensesTotal,
        totalPay: grossPay,
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
