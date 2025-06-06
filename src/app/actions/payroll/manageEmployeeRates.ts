
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import type { EmployeeRate, UserRole } from '@/types/database';


/**
 * Helper to verify user role.
 */
async function verifyAdminOrSupervisor(userId: string): Promise<boolean> {
  if (!userId) return false;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return false;
  const userRole = userDocSnap.data()?.role as UserRole;
  return userRole === 'admin' || userRole === 'supervisor';
}

// Schema for adding a new employee rate
const AddEmployeeRateSchema = z.object({
  employeeId: z.string().min(1, { message: "Employee ID is required." }),
  hourlyRate: z.number().positive({ message: "Hourly rate must be a positive number." }),
  effectiveFrom: z.date({ required_error: "Effective date is required." }),
});

export type AddEmployeeRateInput = z.infer<typeof AddEmployeeRateSchema>;

export interface AddEmployeeRateResult {
  success: boolean;
  rateId?: string;
  message: string;
  errors?: z.ZodIssue[];
}

/**
 * Adds a new hourly rate for an employee.
 * Only callable by an admin or supervisor.
 */
export async function addEmployeeRate(actorUserId: string, data: AddEmployeeRateInput): Promise<AddEmployeeRateResult> {
  if (!actorUserId) {
    return { success: false, message: 'Actor user ID not provided. Authentication issue.' };
  }

  const isAuthorized = await verifyAdminOrSupervisor(actorUserId);
  if (!isAuthorized) {
    return { success: false, message: 'Action not authorized. Requester is not an admin or supervisor.' };
  }

  const validationResult = AddEmployeeRateSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }

  const { employeeId, hourlyRate, effectiveFrom } = validationResult.data;

  const employeeDoc = await getDoc(doc(db, 'users', employeeId));
  if (!employeeDoc.exists()) {
    return { success: false, message: `Employee with ID ${employeeId} not found.` };
  }

  try {
    const newRateData: Omit<EmployeeRate, 'id'> = {
      employeeId,
      hourlyRate,
      effectiveFrom: Timestamp.fromDate(effectiveFrom),
      updatedBy: actorUserId,
      createdAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(collection(db, 'employeeRates'), newRateData);
    return { success: true, message: 'Employee rate added successfully!', rateId: docRef.id };
  } catch (error) {
    console.error('Error adding employee rate:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to add employee rate: ${errorMessage}` };
  }
}


/**
 * Fetches the latest effective hourly rate for a given employee.
 * It considers rates that are effective as of the current date or earlier.
 */
export async function getEmployeeRate(employeeId: string): Promise<EmployeeRate | null> {
  if (!employeeId) {
    console.error("[getEmployeeRate] Employee ID is required.");
    return null;
  }

  try {
    const ratesCollectionRef = collection(db, 'employeeRates');
    const now = Timestamp.now();

    const q = query(
      ratesCollectionRef,
      where('employeeId', '==', employeeId),
      where('effectiveFrom', '<=', now),
      orderBy('effectiveFrom', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log(`[getEmployeeRate] No effective rate found for employee ${employeeId}.`);
      return null;
    }

    const rateDoc = querySnapshot.docs[0];
    const rateData = rateDoc.data();

    return {
      id: rateDoc.id,
      ...rateData
    } as EmployeeRate;

  } catch (error) {
    console.error(`[getEmployeeRate] Error fetching rate for employee ${employeeId}:`, error);
    return null;
  }
}

    