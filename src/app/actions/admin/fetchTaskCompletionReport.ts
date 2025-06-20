'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import type { TaskStatus } from '@/types/database';

export interface TaskCompletionStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  needsReviewTasks: number;
  rejectedTasks: number;
}

export interface FetchTaskCompletionReportResult {
  success: boolean;
  stats?: TaskCompletionStats;
  error?: string;
}

/**
 * Fetch aggregated task completion statistics across all projects.
 */
export async function fetchTaskCompletionReport(): Promise<FetchTaskCompletionReportResult> {
  try {
    const tasksRef = collection(db, 'tasks');

    const statusList: TaskStatus[] = [
      'completed',
      'verified',
      'in-progress',
      'pending',
      'needs-review',
      'rejected',
    ];

    const counts: Record<TaskStatus, number> = {
      'completed': 0,
      'verified': 0,
      'in-progress': 0,
      'pending': 0,
      'needs-review': 0,
      'rejected': 0,
    };

    for (const status of statusList) {
      const q = query(tasksRef, where('status', '==', status));
      const snap = await getCountFromServer(q);
      counts[status] = snap.data().count;
    }

    const totalSnap = await getCountFromServer(tasksRef);

    const stats: TaskCompletionStats = {
      totalTasks: totalSnap.data().count,
      completedTasks: counts['completed'] + counts['verified'],
      inProgressTasks: counts['in-progress'],
      pendingTasks: counts['pending'],
      needsReviewTasks: counts['needs-review'],
      rejectedTasks: counts['rejected'],
    };

    return { success: true, stats };
  } catch (error) {
    console.error('Error generating task completion report:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
