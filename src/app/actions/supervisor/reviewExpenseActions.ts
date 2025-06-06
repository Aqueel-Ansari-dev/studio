
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
      rejectionReason: null, // Clear rejection reason if any
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
      approvedBy: null,
      approvedAt: null,
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
  employeeName?: string; // Populated client-side or in a more complex query
  projectName?: string;  // Populated client-side or in a more complex query
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
    const q = query(
        expensesCollectionRef,
        where('approved', '==', false),
        // where('rejectionReason', '==', null), // More robust to filter client-side if rejectionReason might be absent
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
         return { error: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { error: `Failed to fetch expenses: ${errorMessage}` };
  }
}

export async function fetchAllSupervisorViewExpenses(
  requestingUserId: string,
  filters?: { status?: 'all' | 'pending' | 'approved' | 'rejected' }
): Promise<ExpenseForReview[] | { error: string }> {
  if (!requestingUserId) return { error: "Requesting user ID not provided." };

  const userDoc = await getDoc(doc(db, 'users', requestingUserId));
  if (!userDoc.exists() || !['supervisor', 'admin'].includes(userDoc.data()?.role)) {
    return { error: 'User not authorized to view all expenses.' };
  }

  try {
    const expensesCollectionRef = collection(db, 'employeeExpenses');
    let q = query(expensesCollectionRef);

    const statusFilter = filters?.status || 'all';

    if (statusFilter === 'approved') {
      q = query(q, where('approved', '==', true));
    } else if (statusFilter === 'pending') {
      q = query(q, where('approved', '==', false), where('rejectionReason', '==', null));
    } else if (statusFilter === 'rejected') {
      // For 'rejected', we query for 'approved == false' on the server,
      // and then the client-side will need to ensure 'rejectionReason' exists.
      // Or, we ensure rejectionReason is always set (e.g. to an empty string if not rejected),
      // then we could query `where('rejectionReason', '!=', '')` if Firestore supported it broadly, or `where('rejectionReason', '>', '')`.
      // For simplicity and robustness, let's fetch `approved == false` and filter for `rejectionReason` client-side.
      // No, this is slightly incorrect. If it's `approved == false` AND has a `rejectionReason`, it's rejected.
      // Let's stick to `where('approved', '==', false)` and then client filters if `rejectionReason` is present.
      // This is the most straightforward for server-side if we want to avoid index proliferation for every combination.
      // However, to be more precise for 'rejected', we'd need `approved == false` and `rejectionReason` to be a non-null value.
      // For now, let's assume if it's not approved and not explicitly pending (rejectionReason is null), then it's rejected IF rejectionReason has a value.
      // The best approach for a dedicated 'rejected' server query is to have a specific 'status' field or ensure rejectionReason is always a string.
      // For this iteration: if 'rejected' is chosen, we query for `approved: false`, and the client component will filter those that HAVE a `rejectionReason`.
       q = query(q, where('approved', '==', false));
    }
    // For 'all', no status-based 'where' clause is added.

    q = query(q, orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);
    let expenses: ExpenseForReview[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        employeeId: data.employeeId,
        projectId: data.projectId,
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

    // Client-side style filtering if 'rejected' status was specifically requested
    if (statusFilter === 'rejected') {
      expenses = expenses.filter(e => e.rejectionReason && e.rejectionReason.trim() !== '');
    }
    // If 'pending' was requested, it should already be filtered by server (approved == false AND rejectionReason == null).
    // However, if rejectionReason is merely absent (not explicitly null), the server query for 'pending' might need adjustment
    // or a more robust client-side filter. Given `where('rejectionReason', '==', null)`, it's mostly server-side.

    return expenses;

  } catch (error) {
    console.error(`Error fetching all supervisor expenses:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { error: `Query requires a Firestore index. Details: ${errorMessage}` };
    }
    return { error: `Failed to fetch expenses: ${errorMessage}` };
  }
}
