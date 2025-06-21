'use server';

import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import type { Invoice } from '@/types/database';
import { getSystemSettings } from '@/app/actions/admin/systemSettings';

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

  const { settings } = await getSystemSettings();
  await generateInvoicePdf(invoiceId, settings);

  await updateDoc(ref, { status: 'final', sentAt: serverTimestamp() });
  return { success: true, message: 'Invoice sent.' };
}
