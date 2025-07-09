
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
import type { Task, EmployeeExpense, PayrollRecord, Employee, UserRole, EmployeeRate } from '@/types/database';
import { getEmployeeRate } from './manageEmployeeRates';
import { parse, isValid, startOfDay, endOfDay, formatISO } from 'date-fns';
import { getOrganizationId } from '../common/getOrganizationId';
import { isFeatureAllowed } from '@/lib/plans';

export interface PayrollCalculationSummary {
  employeeId: string;
  employeeName: string;
  hoursWorked: number;
  hourlyRate: number; // The rate used for calculation if applicable
  taskPay: number;
  approvedExpenses: number;
  totalPay: number;
  payrollRecordId: string;
  message?: string; // For messages like "skipped, record exists" or "rate mode not hourly"
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
  const organizationId = await getOrganizationId(adminOrSupervisorId);
  if (!organizationId) {
      return { success: false, error: "Could not determine organization." };
  }
  
  const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
  const planId = orgDoc.exists() ? orgDoc.data()?.planId : 'free';

  if (!isFeatureAllowed(planId, 'Payroll')) {
    return { success: false, error: 'Payroll feature is not available on your current plan. Please upgrade.' };
  }


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
    const tasksCollectionRef = collection(db, 'organizations', organizationId, 'tasks');
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
      let endTimeMillis: number | undefined = undefined;
      if (data.endTime instanceof Timestamp) {
        endTimeMillis = data.endTime.toMillis();
      } else if (typeof data.endTime === 'number') {
        endTimeMillis = data.endTime;
      }
      if ((data.status === 'completed' || data.status === 'verified') && (data.endTime === undefined || data.endTime === null)) {
           console.warn(`[PayrollProcessing] Task ${docSnap.id} (${data.taskName}) is ${data.status} but lacks an endTime. Using updatedAt for period check.`);
      }
      return {
        id: docSnap.id,
        ...data,
        endTime: endTimeMillis,
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
    const payrollCollectionRef = collection(db, 'organizations', organizationId, 'payrollRecords');

    for (const [employeeId, empData] of employeeTaskMap.entries()) {
      const existingRecordQuery = query(
        payrollCollectionRef,
        where('employeeId', '==', employeeId),
        where('projectId', '==', projectId),
        where('payPeriod.start', '==', payPeriodStart),
        where('payPeriod.end', '==', payPeriodEnd),
        limit(1)
      );
      const existingRecordSnapshot = await getDocs(existingRecordQuery);

      const employeeDocRef = doc(db, 'organizations', organizationId, 'users', employeeId);
      const employeeSnap = await getDoc(employeeDocRef);
      const employeeDetails = employeeSnap.exists() ? employeeSnap.data() as Employee : null;
      const employeeName = employeeDetails?.displayName || employeeDetails?.email || employeeId;

      if (!existingRecordSnapshot.empty) {
        console.log(`[PayrollProcessing] Payroll record already exists for employee ${employeeName} (${employeeId}), project ${projectId}, period ${startDateString}-${endDateString}. Skipping.`);
        payrollSummaries.push({
          employeeId, employeeName, hoursWorked: 0, hourlyRate: 0, taskPay: 0,
          approvedExpenses: 0, totalPay: 0, payrollRecordId: existingRecordSnapshot.docs[0].id,
          message: `Skipped: Record already exists (ID: ${existingRecordSnapshot.docs[0].id}).`
        });
        continue;
      }

      if (!employeeDetails) {
        console.warn(`[PayrollProcessing] Employee ${employeeId} not found, skipping payroll calculation.`);
        payrollSummaries.push({
            employeeId, employeeName: `Unknown (${employeeId})`, hoursWorked: 0, hourlyRate: 0, taskPay: 0,
            approvedExpenses: 0, totalPay: 0, payrollRecordId: 'N/A - Employee Not Found',
            message: 'Error: Employee details not found.'
        });
        continue;
      }

      const totalSeconds = empData.tasks.reduce((sum, task) => sum + (task.elapsedTime || 0), 0);
      const hoursWorked = parseFloat((totalSeconds / 3600).toFixed(2));

      const rateInfo: EmployeeRate | null = await getEmployeeRate(employeeId);
      let taskPay = 0;
      let rateUsedForRecord = 0;
      let rateMessage: string | undefined = undefined;

      if (!rateInfo) {
        console.warn(`[PayrollProcessing] No effective rate found for employee ${employeeName} (${employeeId}). Task pay will be 0.`);
        rateMessage = 'Skipped task pay: No effective rate found.';
      } else {
        rateUsedForRecord = rateInfo.hourlyRate || 0; // Default to hourly rate for record, adjust based on mode
        if (rateInfo.paymentMode === 'hourly' && rateInfo.hourlyRate) {
          taskPay = parseFloat((hoursWorked * rateInfo.hourlyRate).toFixed(2));
        } else if (rateInfo.paymentMode === 'daily' && rateInfo.dailyRate) {
          // More complex logic needed for daily rate based on distinct days worked from tasks
          // For now, setting taskPay to 0 for daily/monthly if based on task hours.
          console.warn(`[PayrollProcessing] Employee ${employeeName} is on a daily rate. Task-based pay calculation from hours is not fully implemented for this mode. Task pay set to 0.`);
          taskPay = 0; // Placeholder
          rateUsedForRecord = rateInfo.dailyRate;
          rateMessage = `Employee on daily rate (${rateInfo.dailyRate}). Task-based pay from hours not applied.`;
        } else if (rateInfo.paymentMode === 'monthly' && rateInfo.monthlyRate) {
          console.warn(`[PayrollProcessing] Employee ${employeeName} is on a monthly rate. Task-based pay calculation from hours is not fully implemented for this mode. Task pay set to 0.`);
          taskPay = 0; // Placeholder
          rateUsedForRecord = rateInfo.monthlyRate;
          rateMessage = `Employee on monthly rate (${rateInfo.monthlyRate}). Task-based pay from hours not applied.`;
        } else {
            console.warn(`[PayrollProcessing] Rate mode for ${employeeName} is '${rateInfo.paymentMode}' but corresponding rate is missing. Task pay set to 0.`);
            rateMessage = `Rate mode is ${rateInfo.paymentMode}, but rate value is missing. Task pay set to 0.`;
        }
      }


      const expensesCollectionRef = collection(db, 'organizations', organizationId, 'employeeExpenses');
      const expensesQuery = query(
        expensesCollectionRef,
        where('employeeId', '==', employeeId),
        where('projectId', '==', projectId),
        where('approved', '==', true),
        where('approvedAt', '>=', formatISO(payPeriodStart.toDate())),
        where('approvedAt', '<=', formatISO(payPeriodEnd.toDate()))
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      const employeeExpenses = expensesSnapshot.docs.map(expenseDoc => ({ id: expenseDoc.id, ...expenseDoc.data() } as EmployeeExpense));
      const approvedExpenses = parseFloat(employeeExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2));
      const expenseIdsProcessed = employeeExpenses.map(exp => exp.id);

      // Placeholder for deductions - to be implemented based on unpaid leave
      const deductions = 0; 
      // if (rateInfo && rateInfo.dailyRate && rateInfo.paymentMode !== 'hourly') {
      //   // Fetch unpaid leave days for employeeId within payPeriodStart, payPeriodEnd
      //   // const unpaidLeaveDays = ...;
      //   // deductions = unpaidLeaveDays * rateInfo.dailyRate;
      // }

      const totalPay = parseFloat((taskPay + approvedExpenses - deductions).toFixed(2));

      const payrollRecordRef = doc(collection(db, 'organizations', organizationId, 'payrollRecords'));
      const newPayrollRecord: Omit<PayrollRecord, 'id'> = {
        employeeId,
        projectId,
        payPeriod: { start: payPeriodStart, end: payPeriodEnd },
        hoursWorked,
        hourlyRate: rateUsedForRecord, // Store the rate used, which could be hourly, or the daily/monthly if that was the mode.
                                       // Client needs to understand contextually if this rate is per hour.
        taskPay,
        approvedExpenses,
        deductions, // Store calculated deductions
        totalPay,
        generatedBy: adminOrSupervisorId,
        generatedAt: serverTimestamp() as Timestamp,
        taskIdsProcessed: empData.taskIds,
        expenseIdsProcessed,
      };
      batch.set(payrollRecordRef, newPayrollRecord);
      newPayrollRecordIds.push(payrollRecordRef.id);

      payrollSummaries.push({
        employeeId,
        employeeName,
        hoursWorked,
        hourlyRate: rateUsedForRecord,
        taskPay,
        approvedExpenses,
        totalPay,
        payrollRecordId: payrollRecordRef.id,
        message: rateMessage || 'Payroll record created.'
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
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
        return { success: false, error: `Firestore query failed. This likely requires a composite index. Please check your Firebase console logs for a link to create the index. Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to calculate payroll: ${errorMessage}` };
  }
}
