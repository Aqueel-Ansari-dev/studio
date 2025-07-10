import { Timestamp, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PayCycleConfig } from '@/types/database';

export class PayCycleManager {
  /**
   * Computes the next cycle start and end based on frequency and last known end date.
   */
  static getNextCycleDates(frequency: 'weekly' | 'biweekly' | 'monthly', lastEnd: Date): { start: Date; end: Date } {
    const start = new Date(lastEnd.getTime());
    start.setDate(start.getDate() + 1);
    const end = new Date(start.getTime());
    if (frequency === 'weekly') {
      end.setDate(start.getDate() + 6);
    } else if (frequency === 'biweekly') {
      end.setDate(start.getDate() + 13);
    } else {
      end.setMonth(start.getMonth() + 1);
      end.setDate(end.getDate() - 1);
    }
    return { start, end };
  }

  /**
   * Creates or updates a pay cycle configuration for an organization.
   * Automatically schedules the next cycle dates.
   */
  static async configurePayCycle(orgId: string, frequency: 'weekly' | 'biweekly' | 'monthly'): Promise<PayCycleConfig> {
    const configRef = doc(db, 'organizations', orgId, 'payCycles', 'default');
    const existing = await getDoc(configRef);
    let nextStart: Date;
    let nextEnd: Date;
    if (existing.exists()) {
      const data = existing.data() as PayCycleConfig;
      const lastEnd = data.nextCycleEnd instanceof Timestamp ? data.nextCycleEnd.toDate() : new Date(data.nextCycleEnd);
      const next = this.getNextCycleDates(frequency, lastEnd);
      nextStart = next.start; nextEnd = next.end;
    } else {
      const today = new Date();
      const next = this.getNextCycleDates(frequency, new Date(today.getTime() - 24 * 60 * 60 * 1000));
      nextStart = next.start; nextEnd = next.end;
    }

    const record: Omit<PayCycleConfig, 'id'> = {
      organizationId: orgId,
      frequency,
      nextCycleStart: Timestamp.fromDate(nextStart),
      nextCycleEnd: Timestamp.fromDate(nextEnd),
      createdAt: existing.exists() ? (existing.data() as any).createdAt : serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    await setDoc(configRef, record);
    return { id: configRef.id, ...record } as PayCycleConfig;
  }
}
