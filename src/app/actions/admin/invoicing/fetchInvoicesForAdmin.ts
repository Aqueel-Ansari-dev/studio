'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  limit as firestoreLimit,
  startAfter,
  doc,
  getDoc,
} from 'firebase/firestore';
import type { Invoice } from '@/types/database';

const PAGE_LIMIT = 15;

export interface InvoiceForAdminList extends Invoice {
  createdAt: string;
  invoiceDate: string;
  dueDate: string;
  projectName: string;
  sentAt?: string;
  updatedAt?: string;
}

export interface FetchInvoicesForAdminResult {
  success: boolean;
  invoices?: InvoiceForAdminList[];
  lastVisibleCreatedAtISO?: string | null;
  hasMore?: boolean;
  error?: string;
}

export async function fetchInvoicesForAdmin(
  limitNumber: number = PAGE_LIMIT,
  startAfterCreatedAtISO?: string | null
): Promise<FetchInvoicesForAdminResult> {
  try {
    const invoicesRef = collection(db, 'invoices');
    let q = query(invoicesRef, orderBy('createdAt', 'desc'));

    if (startAfterCreatedAtISO) {
      const ts = Timestamp.fromDate(new Date(startAfterCreatedAtISO));
      q = query(q, startAfter(ts));
    }

    q = query(q, firestoreLimit(limitNumber + 1));

    const snap = await getDocs(q);
    const fetched = await Promise.all(
      snap.docs.map(async docSnap => {
        const data = docSnap.data() as any;
        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());
        const invoiceDate = data.invoiceDate instanceof Timestamp
          ? data.invoiceDate.toDate().toISOString()
          : (typeof data.invoiceDate === 'string' ? data.invoiceDate : '');
        const dueDate = data.dueDate instanceof Timestamp
          ? data.dueDate.toDate().toISOString()
          : (typeof data.dueDate === 'string' ? data.dueDate : '');
        const sentAt = data.sentAt instanceof Timestamp
          ? data.sentAt.toDate().toISOString()
          : (typeof data.sentAt === 'string' ? data.sentAt : undefined);
        const updatedAt = data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate().toISOString()
          : (typeof data.updatedAt === 'string' ? data.updatedAt : undefined);

        const projSnap = await getDoc(doc(db, 'projects', data.projectId));
        const projectName = projSnap.exists() ? (projSnap.data() as any).name : data.projectId;

        return {
          id: docSnap.id,
          ...data,
          createdAt,
          invoiceDate,
          dueDate,
          projectName,
          sentAt,
          updatedAt,
        } as InvoiceForAdminList;
      })
    );

    const hasMore = fetched.length > limitNumber;
    const invoicesToReturn = hasMore ? fetched.slice(0, limitNumber) : fetched;

    let lastISO: string | null = null;
    if (invoicesToReturn.length > 0) {
      lastISO = invoicesToReturn[invoicesToReturn.length - 1].createdAt;
    }

    return { success: true, invoices: invoicesToReturn, lastVisibleCreatedAtISO: lastISO, hasMore };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('fetchInvoicesForAdmin error', err);
    return { success: false, error: msg };
  }
}
