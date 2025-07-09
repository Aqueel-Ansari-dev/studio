
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { getOrganizationId } from '../../common/getOrganizationId';
import { isFeatureAllowed } from '@/app/actions/owner/managePlans';

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
  const organizationId = await getOrganizationId(adminId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for admin.' };
  }

  const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
  const planId = orgDoc.exists() ? orgDoc.data()?.planId : 'free';
  const featureAllowed = await isFeatureAllowed(planId, 'Invoicing');
  if (!featureAllowed) {
      return { success: false, message: 'Invoicing feature is not available on your current plan. Please upgrade.' };
  }


  const validation = CreateInvoiceSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.', errors: validation.error.issues };
  }

  try {
    const invoicesCollectionRef = collection(db, 'organizations', organizationId, 'invoices');
    const docRef = await addDoc(invoicesCollectionRef, {
      ...validation.data,
      createdBy: adminId,
      createdAt: serverTimestamp(),
      status: 'draft',
    });
    return { success: true, message: 'Invoice created.', invoiceId: docRef.id };
  } catch (error) {
    console.error('Error creating invoice:', error);
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create invoice: ${msg}` };
  }
}
