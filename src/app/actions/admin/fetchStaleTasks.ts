
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { Task } from '@/types/database';
import { getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import { getOrganizationId } from '../common/getOrganizationId';

export interface StaleTaskInfo {
  id: string;
  taskName: string;
  projectId: string;
  projectName: string;
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  supervisorId: string;
  supervisorName: string;
  createdAt: string;
}

/**
 * Fetch tasks that are still pending with no start time and were created
 * before the given threshold (defaults to 48 hours ago).
 */
export async function fetchStaleTasks(adminId: string, thresholdHours: number = 48): Promise<StaleTaskInfo[]> {
  const organizationId = await getOrganizationId(adminId);
  if (!organizationId) {
    console.error('Could not determine organization for fetching stale tasks.');
    return [];
  }
  
  const cutoffDate = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

  try {
    const tasksRef = collection(db, 'organizations', organizationId, 'tasks');
    const q = query(
      tasksRef,
      where('status', '==', 'pending'),
      where('createdAt', '<', Timestamp.fromDate(cutoffDate))
    );

    const snapshot = await getDocs(q);
    const results: StaleTaskInfo[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Task;
      if (data.startTime != null) continue; // Task already started

      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : (typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString());

      const employeeName = await getUserDisplayName(data.assignedEmployeeId, organizationId);
      const supervisorName = await getUserDisplayName(data.createdBy, organizationId);
      const projectName = await getProjectName(data.projectId, organizationId);

      results.push({
        id: docSnap.id,
        taskName: data.taskName || 'Unnamed Task',
        projectId: data.projectId,
        projectName,
        assignedEmployeeId: data.assignedEmployeeId,
        assignedEmployeeName: employeeName,
        supervisorId: data.createdBy,
        supervisorName,
        createdAt,
      });
    }

    return results;
  } catch (error) {
    console.error('Error fetching stale tasks:', error);
    return [];
  }
}
