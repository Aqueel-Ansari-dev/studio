'use server';

import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import type { Invoice } from '@/types/database';

export interface SendInvoiceResult {
  success: boolean;
  message: string;
}

export async function sendInvoiceToClient(invoiceId: string): Promise<SendInvoiceResult> {
  const ref = doc(db, 'invoices', invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { success: false, message: 'Invoice not found.' };
  }
  const invoice = snap.data() as Invoice;
  if (invoice.status !== 'draft') {
    return { success: false, message: 'Invoice already sent.' };
  }

  await generateInvoicePdf(invoiceId);

  await updateDoc(ref, { status: 'final', sentAt: serverTimestamp() });
  return { success: true, message: 'Invoice sent.' };
}
