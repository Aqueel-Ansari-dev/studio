'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getNextInvoiceNumber } from '@/lib/invoice-utils';

const InvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().min(0).max(100),
});

const CreateInvoiceDraftSchema = z.object({
  projectId: z.string().min(1),
  clientName: z.string().min(1),
  items: z.array(InvoiceItemSchema).min(1),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateInvoiceDraftInput = z.infer<typeof CreateInvoiceDraftSchema>;

export interface CreateInvoiceDraftResult {
  success: boolean;
  message: string;
  invoiceId?: string;
  errors?: z.ZodIssue[];
}

export async function createInvoiceDraft(
  input: CreateInvoiceDraftInput
): Promise<CreateInvoiceDraftResult> {
  const validation = CreateInvoiceDraftSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.', errors: validation.error.issues };
  }

  const { projectId, clientName, items, invoiceDate, dueDate, notes } = validation.data;
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxTotal = items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice * (i.taxRate / 100),
    0
  );
  const total = subtotal + taxTotal;
  const invoiceNumber = await getNextInvoiceNumber();

  try {
    const docRef = await addDoc(collection(db, 'invoices'), {
      projectId,
      clientName,
      items,
      subtotal,
      taxTotal,
      total,
      invoiceNumber,
      invoiceDate: invoiceDate || new Date().toISOString(),
      dueDate: dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      notes: notes || '',
      status: 'draft',
      createdAt: serverTimestamp(),
    });
    return { success: true, message: 'Invoice draft created', invoiceId: docRef.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: msg };
  }
}
