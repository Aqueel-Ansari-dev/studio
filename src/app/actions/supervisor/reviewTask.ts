
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';
import { createNotificationsForRole, getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';

// Schema for approving a task
const ApproveTaskSchema = z.object({
  taskId: z.string().min(1),
  supervisorId: z.string().min(1),
  reviewNotes: z.string().max(500).optional(),
});
export type ApproveTaskInput = z.infer<typeof ApproveTaskSchema>;

interface ReviewTaskResult {
  success: boolean;
  message: string;
  updatedStatus?: TaskStatus;
}

export async function approveTaskBySupervisor(input: ApproveTaskInput): Promise<ReviewTaskResult> {
  const validation = ApproveTaskSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input for approving task.' };
  }
  const { taskId, supervisorId, reviewNotes } = validation.data;

  try {
    const taskDocRef = doc(db, 'tasks', taskId);
    const taskDocSnap = await getDoc(taskDocRef);

    if (!taskDocSnap.exists()) {
      return { success: false, message: 'Task not found.' };
    }
    const taskData = taskDocSnap.data() as Task;
    if (taskData.status !== 'needs-review') {
      return { success: false, message: `Task cannot be approved. Current status: ${taskData.status}. Expected 'needs-review'.` };
    }
    if (!supervisorId) {
        return { success: false, message: 'Supervisor ID missing.' };
    }

    const updates: Partial<Task> & { updatedAt: any, reviewedAt: any, reviewedBy: string } = {
      status: 'verified',
      supervisorReviewNotes: reviewNotes || taskData.supervisorReviewNotes || 'Approved by supervisor.',
      reviewedBy: supervisorId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await updateDoc(taskDocRef, updates);

    // Admin Notification
    const taskName = taskData.taskName;
    const supervisorName = await getUserDisplayName(supervisorId);
    const employeeName = await getUserDisplayName(taskData.assignedEmployeeId);
    const projectName = await getProjectName(taskData.projectId);
    
    await createNotificationsForRole(
      'admin',
      'task-approved-by-supervisor',
      `Admin: Task Approved - ${taskName}`,
      `Task "${taskName}" for employee ${employeeName} (Project: ${projectName}) was approved by Supervisor ${supervisorName}.`,
      taskId,
      'task',
      supervisorId // Exclude the supervisor themselves if they are also an admin
    );

    return { success: true, message: 'Task approved successfully and status set to verified.', updatedStatus: 'verified' };
  } catch (error) {
    console.error('Error approving task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to approve task: ${errorMessage}` };
  }
}

const RejectTaskSchema = z.object({
  taskId: z.string().min(1),
  supervisorId: z.string().min(1),
  rejectionReason: z.string().min(5, { message: "Rejection reason must be at least 5 characters."}).max(500),
});
export type RejectTaskInput = z.infer<typeof RejectTaskSchema>;

export async function rejectTaskBySupervisor(input: RejectTaskInput): Promise<ReviewTaskResult> {
  const validation = RejectTaskSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input for rejecting task: ' + validation.error.issues.map(e => e.message).join(', ') };
  }
  const { taskId, supervisorId, rejectionReason } = validation.data;

  try {
    const taskDocRef = doc(db, 'tasks', taskId);
    const taskDocSnap = await getDoc(taskDocRef);
    if (!taskDocSnap.exists()) {
      return { success: false, message: 'Task not found.' };
    }
    const taskData = taskDocSnap.data() as Task;
    if (taskData.status !== 'needs-review') {
      return { success: false, message: `Task cannot be rejected. Current status: ${taskData.status}. Expected 'needs-review'.` };
    }
    if (!supervisorId) {
        return { success: false, message: 'Supervisor ID missing.' };
    }

    const updates: Partial<Task> & { updatedAt: any, reviewedAt: any, reviewedBy: string } = {
      status: 'rejected',
      supervisorReviewNotes: rejectionReason, 
      reviewedBy: supervisorId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await updateDoc(taskDocRef, updates);

    // Admin Notification
    const taskName = taskData.taskName;
    const supervisorName = await getUserDisplayName(supervisorId);
    const employeeName = await getUserDisplayName(taskData.assignedEmployeeId);
    const projectName = await getProjectName(taskData.projectId);

    await createNotificationsForRole(
      'admin',
      'task-rejected-by-supervisor',
      `Admin: Task Rejected - ${taskName}`,
      `Task "${taskName}" for employee ${employeeName} (Project: ${projectName}) was rejected by Supervisor ${supervisorName}. Reason: ${rejectionReason}`,
      taskId,
      'task',
      supervisorId // Exclude the supervisor themselves if they are also an admin
    );

    return { success: true, message: 'Task rejected successfully.', updatedStatus: 'rejected' };
  } catch (error) {
    console.error('Error rejecting task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to reject task: ${errorMessage}` };
  }
}

    