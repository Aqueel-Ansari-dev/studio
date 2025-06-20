'use server';

import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export interface DeleteInvoiceResult {
  success: boolean;
  message: string;
}

export async function deleteInvoice(invoiceId: string): Promise<DeleteInvoiceResult> {
  if (!invoiceId) {
    return { success: false, message: 'Invoice ID is required.' };
  }
  try {
    await deleteDoc(doc(db, 'invoices', invoiceId));
    return { success: true, message: 'Invoice deleted.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('deleteInvoice error', err);
    return { success: false, message: msg };
  }
}
