
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';

export interface FetchAllInvoiceIdsResult {
  success: boolean;
  ids?: { id: string }[];
  error?: string;
}

export async function fetchAllInvoiceIds(): Promise<FetchAllInvoiceIdsResult> {
  try {
    const invoicesRef = collection(db, 'invoices');
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
