
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, updateDoc, getDoc, serverTimestamp, Timestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import type { EmployeeExpense } from '@/types/database';

// --- Approve Expense ---
const ApproveExpenseInputSchema = z.object({
  expenseId: z.string().min(1, "Expense ID is required."),
  supervisorId: z.string().min(1, "Supervisor ID is required."),
  // approvalNotes: z.string().max(500).optional(), // Notes are part of main 'notes' field for simplicity
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

  // TODO: In a real app, verify supervisorId has 'supervisor' or 'admin' role from users collection
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
    if (expenseDocSnap.data()?.approved === true) {
      return { success: false, message: "Expense is already approved." };
    }

    const updates: Partial<EmployeeExpense> & { approvedAt: any, reviewedAt: any } = {
      approved: true,
      approvedBy: supervisorId,
      approvedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(),
      rejectionReason: undefined, // Clear rejection reason if any
    };
    await updateDoc(expenseDocRef, updates);
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
    if (expenseDocSnap.data()?.approved === true) {
      return { success: false, message: "Cannot reject an already approved expense. Please contact an admin if reversal is needed." };
    }

    const updates: Partial<EmployeeExpense> & { reviewedAt?: any } = {
      approved: false,
      rejectionReason: rejectionReason,
      approvedBy: undefined, 
      approvedAt: undefined, 
      reviewedAt: serverTimestamp(),
    };
    await updateDoc(expenseDocRef, updates);
    return { success: true, message: "Expense rejected successfully." };
  } catch (error) {
    console.error("Error rejecting expense:", error);
    return { success: false, message: `Failed to reject expense: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// --- Fetch Pending Expenses for Supervisor (or all if admin) ---
export interface ExpenseForReview extends Omit<EmployeeExpense, 'createdAt' | 'approvedAt' | 'reviewedAt'> {
  id: string;
  createdAt: string; 
  approvedAt?: string;
  reviewedAt?: string;
  employeeName?: string; 
  projectName?: string; 
}

export async function fetchExpensesForReview(
  requestingUserId: string,
): Promise<ExpenseForReview[] | { error: string }> {
  if (!requestingUserId) return { error: "Requesting user ID not provided." };

  const userDoc = await getDoc(doc(db, 'users', requestingUserId));
  if (!userDoc.exists() || !['supervisor', 'admin'].includes(userDoc.data()?.role)) {
    return { error: 'User not authorized to review expenses.' };
  }

  try {
    const expensesCollectionRef = collection(db, 'employeeExpenses');
    // Fetch expenses that are not approved AND do not have a rejection reason yet.
    // This means they are truly pending review.
    const q = query(
        expensesCollectionRef, 
        where('approved', '==', false), 
        // where('rejectionReason', '==', null), // Firestore doesn't support '==' null for non-existent fields well directly.
                                                // We'll filter client-side if needed or ensure rejected expenses
                                                // are not re-fetched by only fetching `approved == false`.
                                                // A better approach: if an expense is rejected and needs resubmission, it should get a new status.
                                                // For now, pending means approved:false and rejectionReason is undefined or null.
        orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const expenses: ExpenseForReview[] = querySnapshot.docs
      .filter(docSnap => !docSnap.data().rejectionReason) // Filter out already rejected items
      .map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          employeeId: data.employeeId,
          projectId: data.projectId,
          type: data.type,
          amount: data.amount,
          notes: data.notes,
          receiptImageUri: data.receiptImageUri,
          approved: data.approved, // will be false
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
          // approvedBy, approvedAt, rejectionReason, reviewedAt will be undefined for pending
        } as ExpenseForReview; 
    });
    
    return expenses;

  } catch (error) {
    console.error(`Error fetching expenses for review:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { error: `Query requires a Firestore index. Please check server logs for a link to create it (e.g., for 'approved' and 'createdAt' on 'employeeExpenses'). Details: ${errorMessage}` };
    }
    return { error: `Failed to fetch expenses: ${errorMessage}` };
  }
}

