
'use server';

import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, limit as firestoreLimit, startAfter, Timestamp } from 'firebase/firestore';
import type { AuditLog } from '@/types/database';

export interface FetchAuditLogsResult {
  success: boolean;
  logs?: AuditLog[];
  lastVisibleTimestampISO?: string | null;
  hasMore?: boolean;
  error?: string;
}

const PAGE_LIMIT = 25;

export async function fetchAuditLogs(
  limitNum: number = PAGE_LIMIT,
  startAfterTimestampISO?: string | null
): Promise<FetchAuditLogsResult> {
  try {
    const logsCollectionRef = collection(db, 'auditLogs');
    let q = query(logsCollectionRef, orderBy('timestamp', 'desc'));

    if (startAfterTimestampISO) {
      const startAfterTimestamp = Timestamp.fromDate(new Date(startAfterTimestampISO));
      q = query(q, startAfter(startAfterTimestamp));
    }
    
    q = query(q, firestoreLimit(limitNum + 1));

    const querySnapshot = await getDocs(q);
    const hasMore = querySnapshot.docs.length > limitNum;
    const logsToReturnDocs = hasMore ? querySnapshot.docs.slice(0, limitNum) : querySnapshot.docs;

    const logs = logsToReturnDocs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
      } as AuditLog;
    });

    let lastVisibleISO: string | null = null;
    if (logsToReturnDocs.length > 0) {
      const lastDocData = logsToReturnDocs[logsToReturnDocs.length - 1].data();
      if (lastDocData.timestamp instanceof Timestamp) {
        lastVisibleISO = lastDocData.timestamp.toDate().toISOString();
      }
    }

    return { success: true, logs, lastVisibleTimestampISO: lastVisibleISO, hasMore };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch audit logs: ${errorMessage}` };
  }
}
