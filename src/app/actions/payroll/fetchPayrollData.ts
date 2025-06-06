
'use server';

import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import type { PayrollRecord, Employee } from '@/types/database';

export interface FetchPayrollRecordsResult {
  success: boolean;
  records?: PayrollRecord[];
  error?: string;
  message?: string;
}

/**
 * Fetches all payroll records for a specific employee, ordered by pay period start date.
 */
export async function getPayrollRecordsForEmployee(employeeId: string): Promise<FetchPayrollRecordsResult> {
  if (!employeeId) {
    return { success: false, error: 'Employee ID is required.' };
  }

  try {
    const payrollCollectionRef = collection(db, 'payrollRecords');
    const q = query(
      payrollCollectionRef,
      where('employeeId', '==', employeeId),
      orderBy('payPeriod.start', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // Ensure Timestamps are correctly handled if they are plain objects after retrieval
      const payPeriodStart = data.payPeriod.start instanceof Timestamp ? data.payPeriod.start : Timestamp.fromMillis(data.payPeriod.start.seconds * 1000 + data.payPeriod.start.nanoseconds / 1_000_000);
      const payPeriodEnd = data.payPeriod.end instanceof Timestamp ? data.payPeriod.end : Timestamp.fromMillis(data.payPeriod.end.seconds * 1000 + data.payPeriod.end.nanoseconds / 1_000_000);
      const generatedAt = data.generatedAt instanceof Timestamp ? data.generatedAt : Timestamp.fromMillis(data.generatedAt.seconds * 1000 + data.generatedAt.nanoseconds / 1_000_000);
      
      return {
        id: docSnap.id,
        ...data,
        payPeriod: {
            start: payPeriodStart,
            end: payPeriodEnd,
        },
        generatedAt: generatedAt,
      } as PayrollRecord;
    });

    return { success: true, records };
  } catch (error) {
    console.error(`Error fetching payroll records for employee ${employeeId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
     if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, error: `Query requires a Firestore index. Please check server logs for a link to create it (e.g., for 'employeeId' and 'payPeriod.start' on 'payrollRecords'). Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch payroll records: ${errorMessage}` };
  }
}

export interface EmployeePayrollInProject {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  totalTaskPay: number;
  totalApprovedExpenses: number;
  grandTotalPay: number;
  recordCount: number;
}
export interface ProjectPayrollAggregatedSummary {
  projectId: string;
  totalProjectPayrollCost: number;
  totalHoursWorked: number;
  totalTaskCompensation: number;
  totalExpensesReimbursed: number;
  employeeBreakdown: EmployeePayrollInProject[];
}

export interface FetchProjectPayrollSummaryResult {
    success: boolean;
    summary?: ProjectPayrollAggregatedSummary;
    error?: string;
    message?: string;
}


/**
 * Generates an aggregated payroll summary for a specific project.
 */
export async function getPayrollSummaryForProject(projectId: string, requestingUserId: string): Promise<FetchProjectPayrollSummaryResult> {
  if (!projectId) {
    return { success: false, error: 'Project ID is required.' };
  }
  // Optional: Add role check for requestingUserId

  try {
    const payrollCollectionRef = collection(db, 'payrollRecords');
    const q = query(payrollCollectionRef, where('projectId', '==', projectId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { 
        success: true, 
        summary: {
          projectId,
          totalProjectPayrollCost: 0,
          totalHoursWorked: 0,
          totalTaskCompensation: 0,
          totalExpensesReimbursed: 0,
          employeeBreakdown: [],
        },
        message: "No payroll records found for this project."
      };
    }

    const employeeDataMap = new Map<string, EmployeePayrollInProject>();
    let overallTotalCost = 0;
    let overallTotalHours = 0;
    let overallTaskPay = 0;
    let overallExpenses = 0;

    for (const docSnap of querySnapshot.docs) {
      const record = docSnap.data() as PayrollRecord;
      overallTotalCost += record.totalPay;
      overallTotalHours += record.totalHours;
      overallTaskPay += record.taskPay;
      overallExpenses += record.approvedExpenseAmount;

      let empSummary = employeeDataMap.get(record.employeeId);
      if (!empSummary) {
        const employeeDoc = await getDoc(doc(db, 'users', record.employeeId));
        const employeeName = employeeDoc.exists() ? (employeeDoc.data() as Employee).displayName || record.employeeId : record.employeeId;
        empSummary = {
          employeeId: record.employeeId,
          employeeName,
          totalHours: 0,
          totalTaskPay: 0,
          totalApprovedExpenses: 0,
          grandTotalPay: 0,
          recordCount: 0,
        };
      }
      empSummary.totalHours += record.totalHours;
      empSummary.totalTaskPay += record.taskPay;
      empSummary.totalApprovedExpenses += record.approvedExpenseAmount;
      empSummary.grandTotalPay += record.totalPay;
      empSummary.recordCount += 1;
      employeeDataMap.set(record.employeeId, empSummary);
    }

    return {
      success: true,
      summary: {
        projectId,
        totalProjectPayrollCost: parseFloat(overallTotalCost.toFixed(2)),
        totalHoursWorked: parseFloat(overallTotalHours.toFixed(2)),
        totalTaskCompensation: parseFloat(overallTaskPay.toFixed(2)),
        totalExpensesReimbursed: parseFloat(overallExpenses.toFixed(2)),
        employeeBreakdown: Array.from(employeeDataMap.values()).map(emp => ({
            ...emp,
            totalHours: parseFloat(emp.totalHours.toFixed(2)),
            totalTaskPay: parseFloat(emp.totalTaskPay.toFixed(2)),
            totalApprovedExpenses: parseFloat(emp.totalApprovedExpenses.toFixed(2)),
            grandTotalPay: parseFloat(emp.grandTotalPay.toFixed(2)),
        })),
      },
    };

  } catch (error) {
    console.error(`Error fetching payroll summary for project ${projectId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, error: `Query requires a Firestore index. Please check server logs for a link to create it (e.g., for 'projectId' on 'payrollRecords'). Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch payroll summary: ${errorMessage}` };
  }
}

    