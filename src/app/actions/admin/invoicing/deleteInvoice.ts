
'use server';

import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { getOrganizationId } from '../../common/getOrganizationId';

export interface DeleteInvoiceResult {
  success: boolean;
  message: string;
}

export async function deleteInvoice(actorId: string, invoiceId: string): Promise<DeleteInvoiceResult> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization.' };
  }
  if (!invoiceId) {
    return { success: false, message: 'Invoice ID is required.' };
  }
  try {
    await deleteDoc(doc(db, 'organizations', organizationId, 'invoices', invoiceId));
    return { success: true, message: 'Invoice deleted.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('deleteInvoice error', err);
    return { success: false, message: msg };
  }
}
