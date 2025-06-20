
"use client";

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, updateDoc, getDoc, serverTimestamp, Timestamp, query, where, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';
import type { EmployeeExpense } from '@/types/database';
import { createNotificationsForRole, getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects'; 
import { fetchUsersByRole } from '@/app/actions/common/fetchUsersByRole'; 

const EXPENSE_REVIEW_PAGE_LIMIT = 10;

// --- Approve Expense ---
const ApproveExpenseInputSchema = z.object({
  expenseId: z.string().min(1, "Expense ID is required."),
  supervisorId: z.string().min(1, "Supervisor ID is required."),
});
export type ApproveExpenseInput = z.infer<typeof ApproveExpenseInputSchema>;

export interface ApproveExpenseResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
}

export async function approveEmployeeExpense(input: ApproveExpenseInput): Promise<ApproveExpenseResult> {
  const validation = ApproveExpenseInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: "Invalid input.", errors: validation.error.issues };
  }
  const { expenseId, supervisorId } = validation.data;

  const supervisorUserDoc = await getDoc(doc(db, 'users', supervisorId));
  if (!supervisorUserDoc.exists() || !['supervisor', 'admin'].includes(supervisorUserDoc.data()?.role)) {
    return { success: false, message: "User not authorized to approve expenses." };
  }

  try {
    const expenseDocRef = doc(db, 'employeeExpenses', expenseId);
    const expenseDocSnap = await getDoc(expenseDocRef);
    if (!expenseDocSnap.exists()) {
      return { success: false, message: "Expense record not found." };
    }
    const expenseData = expenseDocSnap.data() as EmployeeExpense;
    if (expenseData.approved === true) {
      return { success: false, message: "Expense is already approved." };
    }

    const updates: Partial<EmployeeExpense> & { approvedAt: any, reviewedAt: any } = {
      approved: true,
      approvedBy: supervisorId,
      approvedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(),
      rejectionReason: null, 
    };
    await updateDoc(expenseDocRef, updates);

    // Admin Notification
    const employeeName = await getUserDisplayName(expenseData.employeeId);
    const projectName = await getProjectName(expenseData.projectId);
    const supervisorName = await getUserDisplayName(supervisorId);
    const title = `Admin: Expense Approved - ${employeeName}`;
    const body = `Expense of $${expenseData.amount.toFixed(2)} for ${employeeName} (Project: ${projectName}) was approved by Supervisor ${supervisorName}.`;
    await createNotificationsForRole('admin', 'expense-approved-by-supervisor', title, body, expenseId, 'expense', supervisorId);

    return { success: true, message: "Expense approved successfully." };
  } catch (error) {
    console.error("Error approving expense:", error);
    return { success: false, message: `Failed to approve expense: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// --- Reject Expense ---
const RejectExpenseInputSchema = z.object({
  expenseId: z.string().min(1, "Expense ID is required."),
  supervisorId: z.string().min(1, "Supervisor ID is required."),
  rejectionReason: z.string().min(5, "Rejection reason must be at least 5 characters.").max(500),
});
export type RejectExpenseInput = z.infer<typeof RejectExpenseInputSchema>;

export interface RejectExpenseResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
}

export async function rejectEmployeeExpense(input: RejectExpenseInput): Promise<RejectExpenseResult> {
  const validation = RejectExpenseInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: "Invalid input.", errors: validation.error.issues };
  }
  const { expenseId, supervisorId, rejectionReason } = validation.data;

  const supervisorUserDoc = await getDoc(doc(db, 'users', supervisorId));
  if (!supervisorUserDoc.exists() || !['supervisor', 'admin'].includes(supervisorUserDoc.data()?.role)) {
    return { success: false, message: "User not authorized to reject expenses." };
  }

  try {
    const expenseDocRef = doc(db, 'employeeExpenses', expenseId);
    const expenseDocSnap = await getDoc(expenseDocRef);
    if (!expenseDocSnap.exists()) {
      return { success: false, message: "Expense record not found." };
    }
    const expenseData = expenseDocSnap.data() as EmployeeExpense;
    if (expenseData.approved === true) {
      return { success: false, message: "Cannot reject an already approved expense. Please contact an admin if reversal is needed." };
    }

    const updates: Partial<EmployeeExpense> & { reviewedAt?: any } = {
      approved: false,
      rejectionReason: rejectionReason,
      approvedBy: null,
      approvedAt: null,
      reviewedAt: serverTimestamp(),
    };
    await updateDoc(expenseDocRef, updates);

    // Admin Notification
    const employeeName = await getUserDisplayName(expenseData.employeeId);
    const projectName = await getProjectName(expenseData.projectId);
    const supervisorName = await getUserDisplayName(supervisorId);
    const title = `Admin: Expense Rejected - ${employeeName}`;
    const body = `Expense of $${expenseData.amount.toFixed(2)} for ${employeeName} (Project: ${projectName}) was rejected by Supervisor ${supervisorName}. Reason: ${rejectionReason}`;
    await createNotificationsForRole('admin', 'expense-rejected-by-supervisor', title, body, expenseId, 'expense', supervisorId);

    return { success: true, message: "Expense rejected successfully." };
  } catch (error) {
    console.error("Error rejecting expense:", error);
    return { success: false, message: `Failed to reject expense: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// --- Fetch Pending Expenses for Supervisor (or all if admin) ---
export interface ExpenseForReview extends Omit<EmployeeExpense, 'createdAt' | 'approvedAt' | 'reviewedAt'> {
  id: string;
  createdAt: string; // ISO String
  approvedAt?: string; // ISO String
  reviewedAt?: string; // ISO String
  employeeName?: string; 
  projectName?: string;  
}
export interface FetchExpensesForReviewResult {
    success: boolean;
    expenses?: ExpenseForReview[];
    error?: string;
    lastVisibleCreatedAtISO?: string | null;
    hasMore?: boolean;
}


export async function fetchExpensesForReview(
  requestingUserId: string,
  pageLimit: number = EXPENSE_REVIEW_PAGE_LIMIT,
  startAfterCreatedAtISO?: string | null
): Promise<FetchExpensesForReviewResult> {
  if (!requestingUserId) return { success: false, error: "Requesting user ID not provided." };

  const userDoc = await getDoc(doc(db, 'users', requestingUserId));
  if (!userDoc.exists() || !['supervisor', 'admin'].includes(userDoc.data()?.role)) {
    return { success: false, error: 'User not authorized to review expenses.' };
  }

  try {
    const expensesCollectionRef = collection(db, 'employeeExpenses');
    let q = query(
        expensesCollectionRef,
        where('approved', '==', false), // Only fetch pending (not approved)
        where('rejectionReason', '==', null), // And not rejected
        orderBy('createdAt', 'desc')
    );
    
    if (startAfterCreatedAtISO) {
        const startAfterTimestamp = Timestamp.fromDate(new Date(startAfterCreatedAtISO));
        q = query(q, startAfter(startAfterTimestamp));
    }

    q = query(q, limit(pageLimit + 1));

    const querySnapshot = await getDocs(q);
    
    // Fetch all projects and employees once for mapping names
    const [projectsResult, employeesResult] = await Promise.all([
      fetchAllProjects(),
      fetchUsersByRole('employee') // Assuming expenses are by employees
    ]);

    const projectMap = new Map<string, string>();
    if (projectsResult.success && projectsResult.projects) {
      projectsResult.projects.forEach(p => projectMap.set(p.id, p.name));
    }

    const employeeMap = new Map<string, string>();
    if (employeesResult.success && employeesResult.users) {
      employeesResult.users.forEach(e => employeeMap.set(e.id, e.name));
    }

    const fetchedExpenses: ExpenseForReview[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          employeeId: data.employeeId,
          employeeName: employeeMap.get(data.employeeId) || data.employeeId,
          projectId: data.projectId,
          projectName: projectMap.get(data.projectId) || data.projectId,
          type: data.type,
          amount: data.amount,
          notes: data.notes,
          receiptImageUri: data.receiptImageUri,
          approved: data.approved, 
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
        } as ExpenseForReview;
    });
    
    const hasMore = fetchedExpenses.length > pageLimit;
    const expensesToReturn = hasMore ? fetchedExpenses.slice(0, pageLimit) : fetchedExpenses;
    let lastVisibleCreatedAtISOToReturn: string | null = null;

    if (expensesToReturn.length > 0) {
        const lastDocData = expensesToReturn[expensesToReturn.length - 1];
        if (lastDocData) {
            lastVisibleCreatedAtISOToReturn = lastDocData.createdAt;
        }
    }

    return { success: true, expenses: expensesToReturn, lastVisibleCreatedAtISO: lastVisibleCreatedAtISOToReturn, hasMore };

  } catch (error) {
    console.error(`Error fetching expenses for review:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, error: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch expenses: ${errorMessage}` };
  }
}

export interface FetchAllSupervisorViewExpensesResult {
    success: boolean;
    expenses?: ExpenseForReview[];
    error?: string;
    lastVisibleCreatedAtISO?: string | null;
    hasMore?: boolean;
}
export async function fetchAllSupervisorViewExpenses(
  requestingUserId: string,
  filters?: { status?: 'all' | 'pending' | 'approved' | 'rejected' },
  pageLimit: number = EXPENSE_REVIEW_PAGE_LIMIT,
  startAfterCreatedAtISO?: string | null
): Promise<FetchAllSupervisorViewExpensesResult> {
  if (!requestingUserId) return { success: false, error: "Requesting user ID not provided." };

  const userDoc = await getDoc(doc(db, 'users', requestingUserId));
  if (!userDoc.exists() || !['supervisor', 'admin'].includes(userDoc.data()?.role)) {
    return { success: false, error: 'User not authorized to view all expenses.' };
  }

  try {
    // Fetch all projects and employees once for mapping names
    const [projectsResult, employeesResult] = await Promise.all([
      fetchAllProjects(),
      fetchUsersByRole('employee') // Assuming expenses are by employees; adjust if other roles submit
    ]);

    const projectMap = new Map<string, string>();
    if (projectsResult.success && projectsResult.projects) {
      projectsResult.projects.forEach(p => projectMap.set(p.id, p.name));
    }

    const employeeMap = new Map<string, string>();
    if (employeesResult.success && employeesResult.users) {
      employeesResult.users.forEach(e => employeeMap.set(e.id, e.name));
    }

    const expensesCollectionRef = collection(db, 'employeeExpenses');
    let q = query(expensesCollectionRef, orderBy('createdAt', 'desc')); 

    const statusFilter = filters?.status || 'all';

    if (statusFilter === 'approved') {
      q = query(q, where('approved', '==', true));
    } else if (statusFilter === 'pending') {
      q = query(q, where('approved', '==', false), where('rejectionReason', '==', null));
    } else if (statusFilter === 'rejected') {
       q = query(q, where('approved', '==', false), where('rejectionReason', '!=', null));
    }
    
    if (startAfterCreatedAtISO) {
        const startAfterTimestamp = Timestamp.fromDate(new Date(startAfterCreatedAtISO));
        q = query(q, startAfter(startAfterTimestamp));
    }
    
    q = query(q, limit(pageLimit + 1));

    const querySnapshot = await getDocs(q);
    let fetchedExpenses: ExpenseForReview[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        employeeId: data.employeeId,
        employeeName: employeeMap.get(data.employeeId) || data.employeeId, // Populate employeeName
        projectId: data.projectId,
        projectName: projectMap.get(data.projectId) || data.projectId,   // Populate projectName
        type: data.type,
        amount: data.amount,
        notes: data.notes || '',
        receiptImageUri: data.receiptImageUri || '',
        approved: data.approved,
        approvedBy: data.approvedBy,
        approvedAt: data.approvedAt instanceof Timestamp ? data.approvedAt.toDate().toISOString() : undefined,
        rejectionReason: data.rejectionReason,
        reviewedAt: data.reviewedAt instanceof Timestamp ? data.reviewedAt.toDate().toISOString() : undefined,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
      } as ExpenseForReview;
    });
    
    const hasMore = fetchedExpenses.length > pageLimit;
    const expensesToReturn = hasMore ? fetchedExpenses.slice(0, pageLimit) : fetchedExpenses;
    let lastVisibleCreatedAtISOToReturn: string | null = null;

    if (expensesToReturn.length > 0) {
        const lastDocData = expensesToReturn[expensesToReturn.length - 1];
        if (lastDocData) {
            lastVisibleCreatedAtISOToReturn = lastDocData.createdAt;
        }
    }
    
    return { success: true, expenses: expensesToReturn, lastVisibleCreatedAtISO: lastVisibleCreatedAtISOToReturn, hasMore };

  } catch (error) {
    console.error(`Error fetching all supervisor expenses:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, error: `Query requires a Firestore index. Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch expenses: ${errorMessage}` };
  }
}
