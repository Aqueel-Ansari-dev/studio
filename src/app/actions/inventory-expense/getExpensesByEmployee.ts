
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { EmployeeExpense } from '@/types/database';

export interface FetchEmployeeExpensesFilters {
  projectId?: string;
  // dateRange?: { start?: Date; end?: Date }; // Future enhancement
}

// Ensure the returned type has createdAt as string
export interface EmployeeExpenseResult extends Omit<EmployeeExpense, 'createdAt' | 'approvedAt'> {
  createdAt: string;
  approvedAt?: string;
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
      const data = docSnap.data() as Omit<EmployeeExpense, 'id' | 'createdAt' | 'approvedAt'> & { createdAt: Timestamp, approvedAt?: Timestamp };
      
      const convertTimestampToString = (ts: Timestamp | undefined): string | undefined => {
        return ts instanceof Timestamp ? ts.toDate().toISOString() : undefined;
      };

      return {
        id: docSnap.id,
        ...data,
        createdAt: convertTimestampToString(data.createdAt) || new Date(0).toISOString(),
        approvedAt: convertTimestampToString(data.approvedAt),
      } as EmployeeExpenseResult; // Cast to ensure type match
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
