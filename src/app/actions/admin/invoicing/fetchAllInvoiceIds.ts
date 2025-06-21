'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';

export async function fetchAllInvoiceIds(): Promise<{ id: string }[]> {
  try {
    const invoicesRef = collection(db, 'invoices');
    const q = query(invoicesRef);
    const querySnapshot = await getDocs(q);
    const ids = querySnapshot.docs.map(doc => ({
      id: doc.id,
    }));
    console.log("Fetched Invoice IDs for generateStaticParams:", ids.map(i => i.id));
    return ids;
  } catch (error) {
    console.error('Error fetching all invoice IDs:', error);
    return [];
  }
}
