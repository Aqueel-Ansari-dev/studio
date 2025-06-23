
'use server';

import { db } from '@/lib/firebase';
import { collection, writeBatch, getDocs, query, doc, getDoc } from 'firebase/firestore';
import type { UserRole } from '@/types/database';

export interface ResetAllDataResult {
  success: boolean;
  message: string;
  deletedCounts: {
    projects: number;
    tasks: number;
    inventory: number;
    expenses: number;
    attendance: number;
    leaveRequests: number;
    notifications: number;
    invoices: number;
    payrollRecords: number;
    employeeRates: number;
    counters: number;
  };
  error?: string;
}

// Helper to verify user is an admin.
async function verifyAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return false;
  const userRole = userDocSnap.data()?.role as UserRole;
  return userRole === 'admin';
}

function getEmptyCounts() {
  return {
    projects: 0, tasks: 0, inventory: 0, expenses: 0, attendance: 0,
    leaveRequests: 0, notifications: 0, invoices: 0, payrollRecords: 0,
    employeeRates: 0, counters: 0
  };
}


/**
 * Deletes all transactional data from the database, preserving user accounts and system settings.
 * Intended for development and testing environments. Only callable by an admin.
 */
export async function resetAllTransactionalData(adminUserId: string): Promise<ResetAllDataResult> {
  if (!adminUserId) {
    return { success: false, message: 'Admin user ID not provided.', deletedCounts: getEmptyCounts() };
  }

  const isAuthorized = await verifyAdmin(adminUserId);
  if (!isAuthorized) {
    return { success: false, message: 'Unauthorized: Only admins can perform this action.', deletedCounts: getEmptyCounts() };
  }
  
  const deletedCounts = getEmptyCounts();

  const collectionNameMap: Record<keyof typeof deletedCounts, string> = {
      projects: 'projects',
      tasks: 'tasks',
      inventory: 'projectInventory',
      expenses: 'employeeExpenses',
      attendance: 'attendanceLogs',
      leaveRequests: 'leaveRequests',
      notifications: 'notifications',
      invoices: 'invoices',
      payrollRecords: 'payrollRecords',
      employeeRates: 'employeeRates',
      counters: 'counters',
  };
  
  const collectionsToDelete = Object.keys(collectionNameMap) as (keyof typeof deletedCounts)[];


  try {
    for (const key of collectionsToDelete) {
      const collectionName = collectionNameMap[key];
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(query(collectionRef));
      
      if (!snapshot.empty) {
          // Firestore batch writes are limited to 500 operations.
          for (let i = 0; i < snapshot.docs.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = snapshot.docs.slice(i, i + 500);
            chunk.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
          deletedCounts[key] = snapshot.size;
      }
    }

    const summary = Object.entries(deletedCounts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${count} ${key}`)
      .join(', ');

    return {
      success: true,
      message: summary.length > 0 ? `Successfully deleted: ${summary}.` : 'No transactional data found to delete.',
      deletedCounts,
    };
  } catch (error) {
    console.error("Error resetting all transactional data:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to reset all data: ${errorMessage}`, error: errorMessage, deletedCounts };
  }
}
