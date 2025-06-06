
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
  serverTimestamp
} from 'firebase/firestore';
import type { Task, EmployeeExpense, PayrollRecord, Employee } from '@/types/database';
import { getEmployeeRate } from './manageEmployeeRates';
import { parse, isValid, startOfDay, endOfDay } from 'date-fns';

export interface PayrollCalculationSummary {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  hourlyRate: number;
  taskPay: number;
  approvedExpenseAmount: number;
  totalPay: number;
  payrollRecordId: string;
}

export interface CalculatePayrollForProjectResult {
  success: boolean;
  summary?: PayrollCalculationSummary[];
  error?: string;
  payrollRecordIds?: string[]; // IDs of the created payroll records
  message?: string;
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

  const startDate = parse(startDateString, 'yyyy-MM-dd', new Date());
  const endDate = parse(endDateString, 'yyyy-MM-dd', new Date());

  if (!isValid(startDate) || !isValid(endDate) || startDate > endDate) {
    return { success: false, error: 'Invalid date range.' };
  }

  const payPeriodStart = Timestamp.fromDate(startOfDay(startDate));
  const payPeriodEnd = Timestamp.fromDate(endOfDay(endDate));

  try {
    // 1. Fetch tasks completed within the project and period
    const tasksCollectionRef = collection(db, 'tasks');
    const tasksQuery = query(
      tasksCollectionRef,
      where('projectId', '==', projectId),
      where('status', 'in', ['completed', 'verified']),
      // Assuming task.updatedAt reflects completion/verification time if endTime is not set
      // This might need adjustment based on precise task lifecycle.
      // For simplicity, using updatedAt for tasks completed/verified within the period.
      // A more robust way would be to ensure task.endTime is reliably set.
      where('updatedAt', '>=', payPeriodStart), 
      where('updatedAt', '<=', payPeriodEnd)
    );
    const tasksSnapshot = await getDocs(tasksQuery);
    const projectTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));

    if (projectTasks.length === 0) {
      return { success: true, summary: [], message: 'No completed tasks found for this project in the given period.' };
    }

    // 2. Group tasks by employee
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

    // 3. Process each employee
    for (const [employeeId, empData] of employeeTaskMap.entries()) {
      const employeeDocRef = doc(db, 'users', employeeId);
      const employeeSnap = await getDoc(employeeDocRef);
      if (!employeeSnap.exists()) {
        console.warn(`Employee ${employeeId} not found, skipping payroll.`);
        continue;
      }
      const employeeDetails = employeeSnap.data() as Employee;
      const employeeName = employeeDetails.displayName || employeeDetails.email || employeeId;

      // a. Calculate total hours from tasks
      const totalSeconds = empData.tasks.reduce((sum, task) => sum + (task.elapsedTime || 0), 0);
      const totalHours = parseFloat((totalSeconds / 3600).toFixed(2)); // Convert seconds to hours, 2 decimal places

      // b. Get employee's hourly rate
      const rateInfo = await getEmployeeRate(employeeId);
      if (!rateInfo) {
        console.warn(`No hourly rate found for employee ${employeeName} (${employeeId}), skipping payroll.`);
        payrollSummaries.push({ 
            employeeId, employeeName, totalHours: 0, hourlyRate: 0, taskPay: 0, 
            approvedExpenseAmount: 0, totalPay: 0, payrollRecordId: 'N/A - No Rate'
        });
        continue;
      }
      const hourlyRate = rateInfo.hourlyRate;

      // c. Fetch approved expenses for this employee, project, and period
      const expensesCollectionRef = collection(db, 'employeeExpenses');
      const expensesQuery = query(
        expensesCollectionRef,
        where('employeeId', '==', employeeId),
        where('projectId', '==', projectId),
        where('approved', '==', true),
        // Assuming approvedAt is the relevant date for payroll period
        // If approvedAt is not always set, fall back to createdAt of the expense document.
        // This logic might need refinement based on data consistency.
        // For robust payroll, 'approvedAt' should be reliably populated.
        where('approvedAt', '>=', payPeriodStart.toDate().toISOString()), 
        where('approvedAt', '<=', payPeriodEnd.toDate().toISOString())
      );
      // Note: Firestore string comparison for ISO dates works if format is consistent.
      // It's often safer to query Timestamps directly if 'approvedAt' is stored as such.
      // Assuming 'approvedAt' is an ISO string for this query. If it's a Timestamp, query directly.
      
      const expensesSnapshot = await getDocs(expensesQuery);
      const employeeExpenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeExpense));
      const approvedExpenseAmount = parseFloat(employeeExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2));
      const expenseIdsProcessed = employeeExpenses.map(exp => exp.id);

      // d. Calculate pay
      const taskPay = parseFloat((totalHours * hourlyRate).toFixed(2));
      const deductions = 0; // Future implementation
      const totalPay = parseFloat((taskPay + approvedExpenseAmount - deductions).toFixed(2));

      // e. Create PayrollRecord
      const payrollRecordRef = doc(collection(db, 'payrollRecords')); // Auto-generate ID
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
        generatedAt: serverTimestamp() as Timestamp,
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
      });
    }

    await batch.commit();

    return { 
        success: true, 
        summary: payrollSummaries, 
        payrollRecordIds: newPayrollRecordIds,
        message: `Payroll calculated for ${payrollSummaries.length} employee(s).`
    };

  } catch (error) {
    console.error('Error calculating payroll:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to calculate payroll: ${errorMessage}` };
  }
}

    