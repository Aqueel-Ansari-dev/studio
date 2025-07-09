
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import type { Invoice } from '@/types/database';
import { getOrganizationId } from '../../common/getOrganizationId';

const InvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().min(0).max(100),
});

const UpdateInvoiceSchema = z.object({
  items: z.array(InvoiceItemSchema).min(1).optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  invoiceDate: z.string().optional(),
  clientName: z.string().optional(),
});

export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;

export interface UpdateInvoiceResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
}

export async function updateInvoice(
  actorId: string,
  invoiceId: string,
  input: UpdateInvoiceInput
): Promise<UpdateInvoiceResult> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization.' };
  }
  if (!invoiceId) {
    return { success: false, message: 'Invoice ID not provided.' };
  }
  const validation = UpdateInvoiceSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.', errors: validation.error.issues };
  }

  const invoiceRef = doc(db, 'organizations', organizationId, 'invoices', invoiceId);
  const snap = await getDoc(invoiceRef);
  if (!snap.exists()) {
    return { success: false, message: 'Invoice not found.' };
  }

  const data = validation.data;
  const updates: Partial<Invoice> & { updatedAt: any } = { updatedAt: serverTimestamp() };

  if (data.items) {
    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxTotal = data.items.reduce(
      (s, i) => s + i.quantity * i.unitPrice * (i.taxRate / 100),
      0
    );
    updates.items = data.items;
    updates.subtotal = subtotal;
    updates.taxTotal = taxTotal;
    updates.total = subtotal + taxTotal;
  }
  if (data.dueDate !== undefined) updates.dueDate = data.dueDate;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.invoiceDate !== undefined) updates.invoiceDate = data.invoiceDate;
  if (data.clientName !== undefined) updates.clientName = data.clientName;

  try {
    await updateDoc(invoiceRef, updates);
    return { success: true, message: 'Invoice updated.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: msg };
  }
}
