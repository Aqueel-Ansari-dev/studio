

'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp, limit as firestoreLimit, startAfter } from 'firebase/firestore';
import type { EmployeeExpense } from '@/types/database';
import { getOrganizationId } from '../common/getOrganizationId';

const EXPENSES_PAGE_LIMIT = 10;

export interface FetchEmployeeExpensesFilters {
  projectId?: string;
}

// Ensure the returned type has createdAt, approvedAt, and reviewedAt as string
export interface EmployeeExpenseResult extends Omit<EmployeeExpense, 'createdAt' | 'approvedAt' | 'reviewedAt'> {
  id: string; 
  createdAt: string; // ISO String
  approvedAt?: string; // ISO String
  reviewedAt?: string; // ISO String
}

export interface GetExpensesByEmployeeResult {
    success: boolean;
    expenses?: EmployeeExpenseResult[];
    error?: string;
    lastVisibleCreatedAtISO?: string | null;
    hasMore?: boolean;
}


export async function getExpensesByEmployee(
  employeeId: string,
  organizationId: string,
  pageLimit: number = EXPENSES_PAGE_LIMIT,
  startAfterCreatedAtISO?: string | null,
  filters?: FetchEmployeeExpensesFilters,
): Promise<GetExpensesByEmployeeResult> {
  if (!employeeId || !organizationId) {
    return { success: false, error: 'User and organization must be specified.' };
  }
  
  try {
    const expensesCollectionRef = collection(db, 'organizations', organizationId, 'employeeExpenses');
    let q = query(expensesCollectionRef, where('employeeId', '==', employeeId));

    if (filters?.projectId) {
      q = query(q, where('projectId', '==', filters.projectId));
    }
    
    q = query(q, orderBy('createdAt', 'desc'));

    if (startAfterCreatedAtISO) {
        const startAfterTimestamp = Timestamp.fromDate(new Date(startAfterCreatedAtISO));
        q = query(q, startAfter(startAfterTimestamp));
    }

    q = query(q, firestoreLimit(pageLimit + 1));


    const querySnapshot = await getDocs(q);
    const fetchedExpenses: EmployeeExpenseResult[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as Omit<EmployeeExpense, 'id' | 'createdAt' | 'approvedAt' | 'reviewedAt'> & { 
        createdAt: Timestamp, 
        approvedAt?: Timestamp | string | null, 
        reviewedAt?: Timestamp | string | null  
      };
      
      const convertTimestampToString = (ts: Timestamp | string | undefined | null): string | undefined => {
        if (ts instanceof Timestamp) return ts.toDate().toISOString();
        if (typeof ts === 'string') return ts;
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
        createdAt: convertTimestampToString(data.createdAt) || new Date(0).toISOString(),
        approvedAt: convertTimestampToString(data.approvedAt),
        reviewedAt: convertTimestampToString(data.reviewedAt),
      } as EmployeeExpenseResult; 
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
    console.error(`Error fetching expenses for employee ${employeeId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, error: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch expenses: ${errorMessage}` };
  }
}
