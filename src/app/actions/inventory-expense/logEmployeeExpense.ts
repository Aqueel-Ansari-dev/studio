

'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import type { EmployeeExpense, UserRole } from '@/types/database';
import { createNotificationsForRole, getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import { notifyRoleByWhatsApp } from '@/lib/notify';
import { format } from 'date-fns';
import { getOrganizationId } from '../common/getOrganizationId';

const LogExpenseSchema = z.object({
  projectId: z.string().min(1, { message: "Project ID is required."}),
  type: z.enum(['travel', 'food', 'tools', 'other'], { message: "Invalid expense type."}),
  amount: z.number().positive({ message: "Amount must be a positive number."}),
  notes: z.string().max(500, { message: "Notes cannot exceed 500 characters."}).optional(),
  receiptImageUri: z.string().optional().or(z.literal('')), // Accept data URI or empty string
});

export type LogExpenseInput = z.infer<typeof LogExpenseSchema>;

export interface LogExpenseResult {
  success: boolean;
  message: string;
  expenseId?: string;
  errors?: z.ZodIssue[];
}

export async function logEmployeeExpense(actorId: string, data: LogExpenseInput): Promise<LogExpenseResult> {
  const organizationId = await getOrganizationId(actorId);
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
  
  const actorRef = doc(db, 'organizations', organizationId, 'users', actorId);
  const actorSnap = await getDoc(actorRef);
  if (!actorSnap.exists()) {
    console.warn(`Actor with ID ${actorId} not found during expense logging. Proceeding.`);
    return { success: false, message: "Logging user not found." };
  }
  const actorRole = actorSnap.data()?.role as UserRole;
  const isAutoApproved = actorRole === 'admin';

  try {
    const expensesCollectionRef = collection(db, 'organizations', organizationId, 'employeeExpenses');
    const newExpenseData: Omit<EmployeeExpense, 'id' | 'createdAt'> & { createdAt: any, approved: boolean, rejectionReason: null, reviewedAt?: any, approvedBy?: string, approvedAt?: any } = {
      employeeId: actorId,
      projectId,
      type,
      amount,
      notes: notes || '',
      receiptImageUri: receiptImageUri || '',
      approved: isAutoApproved,
      rejectionReason: null, 
      createdAt: serverTimestamp(), 
    };

    if (isAutoApproved) {
      newExpenseData.approvedBy = actorId;
      newExpenseData.approvedAt = serverTimestamp();
      newExpenseData.reviewedAt = serverTimestamp();
    }

    const docRef = await addDoc(expensesCollectionRef, newExpenseData);

    // Notifications
    const employeeName = await getUserDisplayName(actorId, organizationId);
    const projectName = await getProjectName(projectId, organizationId);
    const expenseDate = format(new Date(), 'PP');
    
    if (isAutoApproved) {
      const title = `Admin Expense Logged: ${employeeName}`;
      const body = `${employeeName} logged a new, auto-approved expense of $${amount.toFixed(2)} for project "${projectName}" (${type}) on ${expenseDate}.`;
      await createNotificationsForRole(
        'admin',
        organizationId,
        'expense-logged',
        `Admin: ${title}`,
        body,
        docRef.id,
        'expense',
        actorId, // Exclude self
        'expense',
        'normal'
      );
    } else {
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
        actorId, // Exclude self if supervisor is logging
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
      await notifyRoleByWhatsApp(organizationId, 'supervisor', waMsg, actorId);
      await notifyRoleByWhatsApp(organizationId, 'admin', waMsg, actorId);
    }
    
    const message = isAutoApproved ? 'Expense logged and auto-approved successfully.' : 'Expense logged successfully and is pending approval.';
    return { success: true, message, expenseId: docRef.id };
  } catch (error) {
    console.error('Error logging employee expense:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to log expense: ${errorMessage}` };
  }
}
