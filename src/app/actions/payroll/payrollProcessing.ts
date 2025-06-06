
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  writeBatch,
  doc,
  serverTimestamp,
  getDoc,
  limit
} from 'firebase/firestore';
import type { Task, EmployeeExpense, PayrollRecord, Employee, UserRole } from '@/types/database';
import { getEmployeeRate } from './manageEmployeeRates';
import { parse, isValid, startOfDay, endOfDay, formatISO } from 'date-fns';

export interface PayrollCalculationSummary {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  hourlyRate: number;
  taskPay: number;
  approvedExpenseAmount: number;
  totalPay: number;
  payrollRecordId: string;
  message?: string; // For messages like "skipped, record exists"
}

export interface CalculatePayrollForProjectResult {
  success: boolean;
  summary?: PayrollCalculationSummary[];
  error?: string;
  payrollRecordIds?: string[];
  message?: string;
}

/**
 * Helper to verify user role.
 */
async function verifyAdminOrSupervisor(userId: string): Promise<boolean> {
  if (!userId) return false;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return false;
  const userRole = userDocSnap.data()?.role as UserRole;
  return userRole === 'admin' || userRole === 'supervisor';
}


/**
 * Calculates payroll for all employees who completed tasks for a specific project
 * within a given date range.
 */
export async function calculatePayrollForProject(
  adminOrSupervisorId: string,
  projectId: string,
  startDateString: string, // "yyyy-MM-dd"
  endDateString: string   // "yyyy-MM-dd"
): Promise<CalculatePayrollForProjectResult> {
  if (!adminOrSupervisorId || !projectId || !startDateString || !endDateString) {
    return { success: false, error: 'Missing required parameters.' };
  }

  const isAuthorized = await verifyAdminOrSupervisor(adminOrSupervisorId);
  if (!isAuthorized) {
    return { success: false, error: 'Unauthorized: Only admins or supervisors can calculate payroll.' };
  }

  const startDate = parse(startDateString, 'yyyy-MM-dd', new Date());
  const endDate = parse(endDateString, 'yyyy-MM-dd', new Date());

  if (!isValid(startDate) || !isValid(endDate) || startDate > endDate) {
    return { success: false, error: 'Invalid date range.' };
  }

  const payPeriodStart = Timestamp.fromDate(startOfDay(startDate));
  const payPeriodEnd = Timestamp.fromDate(endOfDay(endDate));

  try {
    // 1. Fetch tasks completed/verified where 'updatedAt' falls within the period.
    // 'updatedAt' is used as a proxy for when a task becomes relevant for this pay period.
    const tasksCollectionRef = collection(db, 'tasks');
    const tasksQuery = query(
      tasksCollectionRef,
      where('projectId', '==', projectId),
      where('status', 'in', ['completed', 'verified']),
      where('updatedAt', '>=', payPeriodStart),
      where('updatedAt', '<=', payPeriodEnd)
    );
    const tasksSnapshot = await getDocs(tasksQuery);
    const projectTasks = tasksSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // Ensure task.endTime is a number (milliseconds) if it exists for precise checks
      let endTimeMillis: number | undefined = undefined;
      if (data.endTime instanceof Timestamp) {
        endTimeMillis = data.endTime.toMillis();
      } else if (typeof data.endTime === 'number') {
        endTimeMillis = data.endTime; // Assuming already in millis if number
      }

      // If task.endTime is not set (should be rare for completed/verified), log warning.
      // For payroll inclusion, the task's finalization (updatedAt) within period is primary.
      if (data.status === 'completed' || data.status === 'verified') {
        if (data.endTime === undefined || data.endTime === null) {
             console.warn(`[PayrollProcessing] Task ${docSnap.id} (${data.taskName}) is ${data.status} but lacks an endTime. Using updatedAt for period check.`);
        }
      }

      return {
        id: docSnap.id,
        ...data,
        endTime: endTimeMillis, // Standardize endTime to milliseconds for easier comparison later if needed
        // Ensure updatedAt is also consistently handled if it's a string or Firestore-like object
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : (typeof data.updatedAt === 'string' ? new Date(data.updatedAt).getTime() : data.updatedAt?.seconds ? data.updatedAt.seconds * 1000 : Date.now()),
      } as Task;
    });


    if (projectTasks.length === 0) {
      return { success: true, summary: [], message: 'No completed/verified tasks found for this project in the given period.' };
    }

    const employeeTaskMap = new Map<string, { tasks: Task[], taskIds: string[] }>();
    projectTasks.forEach(task => {
      if (task.assignedEmployeeId) {
        const existing = employeeTaskMap.get(task.assignedEmployeeId) || { tasks: [], taskIds: [] };
        existing.tasks.push(task);
        existing.taskIds.push(task.id);
        employeeTaskMap.set(task.assignedEmployeeId, existing);
      }
    });

    const payrollSummaries: PayrollCalculationSummary[] = [];
    const newPayrollRecordIds: string[] = [];
    const batch = writeBatch(db);
    const payrollCollectionRef = collection(db, 'payrollRecords');

    for (const [employeeId, empData] of employeeTaskMap.entries()) {
      // Check for existing payroll record
      const existingRecordQuery = query(
        payrollCollectionRef,
        where('employeeId', '==', employeeId),
        where('projectId', '==', projectId),
        where('payPeriod.start', '==', payPeriodStart),
        where('payPeriod.end', '==', payPeriodEnd),
        limit(1)
      );
      const existingRecordSnapshot = await getDocs(existingRecordQuery);

      const employeeDocRef = doc(db, 'users', employeeId);
      const employeeSnap = await getDoc(employeeDocRef);
      const employeeDetails = employeeSnap.exists() ? employeeSnap.data() as Employee : null;
      const employeeName = employeeDetails?.displayName || employeeDetails?.email || employeeId;

      if (!existingRecordSnapshot.empty) {
        console.log(`[PayrollProcessing] Payroll record already exists for employee ${employeeName} (${employeeId}), project ${projectId}, period ${startDateString}-${endDateString}. Skipping.`);
        payrollSummaries.push({
          employeeId, employeeName, totalHours: 0, hourlyRate: 0, taskPay: 0,
          approvedExpenseAmount: 0, totalPay: 0, payrollRecordId: existingRecordSnapshot.docs[0].id,
          message: `Skipped: Record already exists (ID: ${existingRecordSnapshot.docs[0].id}).`
        });
        continue;
      }

      if (!employeeDetails) {
        console.warn(`[PayrollProcessing] Employee ${employeeId} not found, skipping payroll calculation.`);
        payrollSummaries.push({
            employeeId, employeeName: `Unknown (${employeeId})`, totalHours: 0, hourlyRate: 0, taskPay: 0,
            approvedExpenseAmount: 0, totalPay: 0, payrollRecordId: 'N/A - Employee Not Found',
            message: 'Error: Employee details not found.'
        });
        continue;
      }

      const totalSeconds = empData.tasks.reduce((sum, task) => sum + (task.elapsedTime || 0), 0);
      const totalHours = parseFloat((totalSeconds / 3600).toFixed(2));

      const rateInfo = await getEmployeeRate(employeeId); // TODO: Handle rate changes within pay period (future enhancement)
      if (!rateInfo) {
        console.warn(`[PayrollProcessing] No hourly rate found for employee ${employeeName} (${employeeId}), skipping payroll for this employee.`);
        payrollSummaries.push({
            employeeId, employeeName, totalHours, hourlyRate: 0, taskPay: 0,
            approvedExpenseAmount: 0, totalPay: 0, payrollRecordId: 'N/A - No Rate Found',
            message: 'Skipped: No effective hourly rate found for this period.'
        });
        continue;
      }
      const hourlyRate = rateInfo.hourlyRate;

      const expensesCollectionRef = collection(db, 'employeeExpenses');
      // Note on querying 'approvedAt' (string ISO): Firestore compares strings lexicographically.
      // For ISO strings like 'YYYY-MM-DDTHH:mm:ss.sssZ', this works for date range queries.
      // If 'approvedAt' was a Firestore Timestamp, direct Timestamp comparison would be used.
      const expensesQuery = query(
        expensesCollectionRef,
        where('employeeId', '==', employeeId),
        where('projectId', '==', projectId),
        where('approved', '==', true),
        // Ensure approvedAt is handled whether it's Timestamp or ISO string from previous saves
        // Query against string ISO dates; ensure conversion if stored as Timestamp.
        // The example assumes approvedAt is stored as ISO string. If it's a Timestamp, this needs adjustment or direct Timestamp query
        where('approvedAt', '>=', formatISO(payPeriodStart.toDate())),
        where('approvedAt', '<=', formatISO(payPeriodEnd.toDate()))
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      const employeeExpenses = expensesSnapshot.docs.map(expenseDoc => ({ id: expenseDoc.id, ...expenseDoc.data() } as EmployeeExpense));
      const approvedExpenseAmount = parseFloat(employeeExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2));
      const expenseIdsProcessed = employeeExpenses.map(exp => exp.id);

      const taskPay = parseFloat((totalHours * hourlyRate).toFixed(2));
      const deductions = 0; // Placeholder for future implementation
      const totalPay = parseFloat((taskPay + approvedExpenseAmount - deductions).toFixed(2));

      const payrollRecordRef = doc(collection(db, 'payrollRecords'));
      const newPayrollRecord: Omit<PayrollRecord, 'id'> = {
        employeeId,
        projectId,
        payPeriod: { start: payPeriodStart, end: payPeriodEnd },
        totalHours,
        hourlyRate,
        taskPay,
        approvedExpenseAmount,
        deductions,
        totalPay,
        generatedBy: adminOrSupervisorId,
        generatedAt: serverTimestamp() as Timestamp, // Firestore server-side timestamp
        taskIdsProcessed: empData.taskIds,
        expenseIdsProcessed,
      };
      batch.set(payrollRecordRef, newPayrollRecord);
      newPayrollRecordIds.push(payrollRecordRef.id);

      payrollSummaries.push({
        employeeId,
        employeeName,
        totalHours,
        hourlyRate,
        taskPay,
        approvedExpenseAmount,
        totalPay,
        payrollRecordId: payrollRecordRef.id,
        message: 'Payroll record created.'
      });
    }

    await batch.commit();

    return {
        success: true,
        summary: payrollSummaries,
        payrollRecordIds: newPayrollRecordIds,
        message: `Payroll calculated. ${newPayrollRecordIds.length} new record(s) created. ${payrollSummaries.filter(s => s.message?.startsWith('Skipped')).length} record(s) skipped.`
    };

  } catch (error) {
    console.error('[PayrollProcessing] Error calculating payroll:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    // Check for index-related errors specifically
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
        return { success: false, error: `Firestore query failed. This likely requires a composite index. Please check your Firebase console logs for a link to create the index. Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to calculate payroll: ${errorMessage}` };
  }
}

    