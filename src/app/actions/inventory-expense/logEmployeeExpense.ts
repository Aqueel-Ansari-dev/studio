
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import type { EmployeeExpense } from '@/types/database';

// Made LogExpenseSchema a local constant instead of exporting it.
const LogExpenseSchema = z.object({
  // employeeId: z.string().min(1, { message: "Employee ID is required."}), // Passed as separate arg
  projectId: z.string().min(1, { message: "Project ID is required."}),
  type: z.enum(['travel', 'food', 'tools', 'other'], { message: "Invalid expense type."}),
  amount: z.number().positive({ message: "Amount must be a positive number."}),
  notes: z.string().max(500, { message: "Notes cannot exceed 500 characters."}).optional(),
  receiptImageUri: z.string().url({ message: "Invalid URL for receipt image." }).optional().or(z.literal('')),
});

export type LogExpenseInput = z.infer<typeof LogExpenseSchema>;

export interface LogExpenseResult {
  success: boolean;
  message: string;
  expenseId?: string;
  errors?: z.ZodIssue[];
}

export async function logEmployeeExpense(employeeId: string, data: LogExpenseInput): Promise<LogExpenseResult> {
  // In a real app, verify employeeId matches the logged-in user or that the actor has permission
  if (!employeeId) {
    return { success: false, message: 'Employee ID not provided. User might not be authenticated properly.' };
  }

  const validationResult = LogExpenseSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input data.', errors: validationResult.error.issues };
  }

  const { projectId, type, amount, notes, receiptImageUri } = validationResult.data;

  // Validate project existence (optional, but good practice)
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    return { success: false, message: `Project with ID ${projectId} not found.` };
  }
  
  // Validate employee existence (optional)
  const employeeRef = doc(db, 'users', employeeId);
  const employeeSnap = await getDoc(employeeRef);
  if (!employeeSnap.exists()) {
    // This might be too strict if user creation is separate and eventual consistency is acceptable
    // For now, we proceed, assuming the employeeId is valid.
    console.warn(`Employee with ID ${employeeId} not found in 'users' collection during expense logging. Proceeding.`);
  }


  try {
    const newExpenseData: Omit<EmployeeExpense, 'id' | 'createdAt' | 'approved'> & { createdAt: any; approved: boolean } = {
      employeeId,
      projectId,
      type,
      amount,
      notes: notes || '',
      receiptImageUri: receiptImageUri || '',
      approved: false, // Expenses are not approved by default
      createdAt: serverTimestamp(), // Firestore server-side timestamp
    };

    const docRef = await addDoc(collection(db, 'employeeExpenses'), newExpenseData);
    return { success: true, message: 'Expense logged successfully! Awaiting approval.', expenseId: docRef.id };
  } catch (error) {
    console.error('Error logging employee expense:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to log expense: ${errorMessage}` };
  }
}

