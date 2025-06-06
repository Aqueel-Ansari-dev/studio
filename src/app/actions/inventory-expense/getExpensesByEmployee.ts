
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { EmployeeExpense } from '@/types/database';

export interface FetchEmployeeExpensesFilters {
  projectId?: string;
  // dateRange?: { start?: Date; end?: Date }; // Future enhancement
}

// Ensure the returned type has createdAt, approvedAt, and reviewedAt as string
export interface EmployeeExpenseResult extends Omit<EmployeeExpense, 'createdAt' | 'approvedAt' | 'reviewedAt'> {
  id: string; // Ensure id is part of the result type explicitly
  createdAt: string;
  approvedAt?: string;
  reviewedAt?: string;
}


export async function getExpensesByEmployee(
  employeeId: string,
  requestingUserId: string,
  filters?: FetchEmployeeExpensesFilters
): Promise<EmployeeExpenseResult[] | { error: string }> {
  // Security: Ensure requestingUserId is either the employeeId or a supervisor/admin
  if (!requestingUserId) {
    return { error: 'User not authenticated.' };
  }
  // Example check (in a real app, you'd check roles from DB):
  // if (requestingUserId !== employeeId && !isSupervisorOrAdmin(requestingUserId)) {
  //   return { error: 'User not authorized to view these expenses.' };
  // }

  if (!employeeId) {
    return { error: 'Employee ID is required.' };
  }

  try {
    const expensesCollectionRef = collection(db, 'employeeExpenses');
    let q = query(expensesCollectionRef, where('employeeId', '==', employeeId));

    if (filters?.projectId) {
      q = query(q, where('projectId', '==', filters.projectId));
    }
    
    q = query(q, orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);
    const expenses: EmployeeExpenseResult[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as Omit<EmployeeExpense, 'id' | 'createdAt' | 'approvedAt' | 'reviewedAt'> & { 
        createdAt: Timestamp, 
        approvedAt?: Timestamp | string | null, // Handle potential string from previous saves
        reviewedAt?: Timestamp | string | null  // Handle potential string from previous saves
      };
      
      const convertTimestampToString = (ts: Timestamp | string | undefined | null): string | undefined => {
        if (ts instanceof Timestamp) return ts.toDate().toISOString();
        if (typeof ts === 'string') return ts; // Already a string
        return undefined;
      };

      return {
        id: docSnap.id,
        employeeId: data.employeeId,
        projectId: data.projectId,
        type: data.type,
        amount: data.amount,
        notes: data.notes,
        receiptImageUri: data.receiptImageUri,
        approved: data.approved,
        approvedBy: data.approvedBy,
        rejectionReason: data.rejectionReason,
        // Explicitly list fields to ensure correct types and avoid spreading unconverted Timestamps
        createdAt: convertTimestampToString(data.createdAt) || new Date(0).toISOString(),
        approvedAt: convertTimestampToString(data.approvedAt),
        reviewedAt: convertTimestampToString(data.reviewedAt),
      } as EmployeeExpenseResult; 
    });

    return expenses;
  } catch (error) {
    console.error(`Error fetching expenses for employee ${employeeId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { error: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { error: `Failed to fetch expenses: ${errorMessage}` };
  }
}

