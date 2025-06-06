
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  writeBatch,
  doc,
  getDoc,
  query,
} from 'firebase/firestore';
import type { UserRole } from '@/types/database';

export interface ResetTestDataResult {
  success: boolean;
  message: string;
  payrollRecordsDeleted?: number;
  employeeRatesDeleted?: number;
  error?: string;
}

/**
 * Helper to verify user role.
 */
async function verifyAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return false;
  const userRole = userDocSnap.data()?.role as UserRole;
  return userRole === 'admin';
}

/**
 * Deletes all payroll records and employee rates.
 * Intended for testing and development environments.
 * Only callable by an admin.
 */
export async function resetPayrollTestData(adminUserId: string): Promise<ResetTestDataResult> {
  if (!adminUserId) {
    return { success: false, message: 'Admin user ID not provided.' };
  }

  const isAuthorized = await verifyAdmin(adminUserId);
  if (!isAuthorized) {
    return { success: false, message: 'Unauthorized: Only admins can reset payroll test data.' };
  }

  const batch = writeBatch(db);
  let payrollRecordsDeleted = 0;
  let employeeRatesDeleted = 0;

  try {
    // Delete all payrollRecords
    const payrollRecordsRef = collection(db, 'payrollRecords');
    const payrollSnapshot = await getDocs(query(payrollRecordsRef)); // No filters, get all
    payrollSnapshot.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
      payrollRecordsDeleted++;
    });

    // Delete all employeeRates
    const employeeRatesRef = collection(db, 'employeeRates');
    const ratesSnapshot = await getDocs(query(employeeRatesRef)); // No filters, get all
    ratesSnapshot.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
      employeeRatesDeleted++;
    });

    await batch.commit();

    return {
      success: true,
      message: `Payroll test data reset successfully. Deleted ${payrollRecordsDeleted} payroll record(s) and ${employeeRatesDeleted} employee rate(s).`,
      payrollRecordsDeleted,
      employeeRatesDeleted,
    };
  } catch (error) {
    console.error('Error resetting payroll test data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to reset data: ${errorMessage}`, error: errorMessage };
  }
}

    