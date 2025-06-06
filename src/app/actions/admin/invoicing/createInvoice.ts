'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const CreateInvoiceSchema = z.object({
  clientName: z.string().min(1, { message: 'Client name is required.' }),
  projectId: z.string().min(1, { message: 'Project ID is required.' }),
  amount: z.number().positive({ message: 'Amount must be greater than 0.' }),
  dueDate: z.string(), // yyyy-MM-dd
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export interface CreateInvoiceResult {
  success: boolean;
  message: string;
  invoiceId?: string;
  errors?: z.ZodIssue[];
}

export async function createInvoice(adminId: string, input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  if (!adminId) {
    return { success: false, message: 'Admin ID not provided.' };
  }

  const validation = CreateInvoiceSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.', errors: validation.error.issues };
  }

  try {
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...validation.data,
      createdBy: adminId,
      createdAt: serverTimestamp(),
    });
    return { success: true, message: 'Invoice created.', invoiceId: docRef.id };
  } catch (error) {
    console.error('Error creating invoice:', error);
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create invoice: ${msg}` };
  }
}
