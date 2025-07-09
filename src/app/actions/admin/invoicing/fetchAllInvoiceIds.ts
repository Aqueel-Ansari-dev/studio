
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { getOrganizationId } from '../../common/getOrganizationId';

export interface FetchAllInvoiceIdsResult {
  success: boolean;
  ids?: { id: string }[];
  error?: string;
}

export async function fetchAllInvoiceIds(actorId: string): Promise<FetchAllInvoiceIdsResult> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization.' };
  }

  try {
    const invoicesRef = collection(db, 'organizations', organizationId, 'invoices');
    const q = query(invoicesRef);
    const querySnapshot = await getDocs(q);
    const ids = querySnapshot.docs.map(doc => ({
      id: doc.id,
    }));
    return { success: true, ids };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching all invoice IDs:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
