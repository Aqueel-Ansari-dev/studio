
import { db } from './firebase';
import { doc, runTransaction } from 'firebase/firestore';

export async function getNextInvoiceNumber(organizationId: string): Promise<string> {
  const counterRef = doc(db, 'organizations', organizationId, 'counters', 'invoices');
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().current as number || 0) : 0;
    const updated = current + 1;
    tx.set(counterRef, { current: updated }, { merge: true });
    return updated;
  });
  return `INV-${String(next).padStart(5, '0')}`;
}
