

'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import type { EmployeeExpense } from '@/types/database';
import { createNotificationsForRole, getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import { notifyRoleByWhatsApp } from '@/lib/notify';
import { format } from 'date-fns';
import { getOrganizationId } from '../common/getOrganizationId';

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
  const organizationId = await getOrganizationId(employeeId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for user.' };
  }

  const validationResult = LogExpenseSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input data.', errors: validationResult.error.issues };
  }

  const { projectId, type, amount, notes, receiptImageUri } = validationResult.data;

  const projectRef = doc(db, 'organizations', organizationId, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    return { success: false, message: `Project with ID ${projectId} not found.` };
  }
  
  const employeeRef = doc(db, 'organizations', organizationId, 'users', employeeId);
  const employeeSnap = await getDoc(employeeRef);
  if (!employeeSnap.exists()) {
    console.warn(`Employee with ID ${employeeId} not found in 'users' collection during expense logging. Proceeding.`);
  }

  try {
    const expensesCollectionRef = collection(db, 'organizations', organizationId, 'employeeExpenses');
    const newExpenseData: Omit<EmployeeExpense, 'id' | 'createdAt' | 'approved'> & { createdAt: any; approved: boolean; rejectionReason: null } = {
      employeeId,
      projectId,
      type,
      amount,
      notes: notes || '',
      receiptImageUri: receiptImageUri || '',
      approved: false,
      rejectionReason: null, // Explicitly set to null for querying
      createdAt: serverTimestamp(), 
    };

    const docRef = await addDoc(expensesCollectionRef, newExpenseData);

    // Notifications
    const employeeName = await getUserDisplayName(employeeId, organizationId);
    const projectName = await getProjectName(projectId, organizationId);
    const expenseDate = format(new Date(), 'PP');
    const title = `New Expense: ${employeeName}`;
    const body = `${employeeName} logged a new expense of $${amount.toFixed(2)} for project "${projectName}" (${type}) on ${expenseDate}. It requires review.`;

    await createNotificationsForRole(
      'supervisor',
      organizationId,
      'expense-logged',
      title,
      body,
      docRef.id,
      'expense',
      undefined,
      'expense',
      'normal'
    );
    await createNotificationsForRole(
      'admin',
      organizationId,
      'expense-logged',
      `Admin: ${title}`,
      body,
      docRef.id,
      'expense',
      undefined,
      'expense',
      'normal'
    );

    const waMsg = `\ud83d\udcb0 Expense Logged\nEmployee: ${employeeName}\nProject: ${projectName}\nAmount: $${amount.toFixed(2)} (${type})`;
    await notifyRoleByWhatsApp(organizationId, 'supervisor', waMsg, employeeId);
    await notifyRoleByWhatsApp(organizationId, 'admin', waMsg, employeeId);

    return { success: true, message: 'Expense logged successfully and is pending approval.', expenseId: docRef.id };
  } catch (error) {
    console.error('Error logging employee expense:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to log expense: ${errorMessage}` };
  }
}
