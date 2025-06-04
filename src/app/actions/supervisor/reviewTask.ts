
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';

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

    // Verify the task is in 'needs-review' status
    if (taskData.status !== 'needs-review') {
      return { success: false, message: `Task cannot be approved. Current status: ${taskData.status}. Expected 'needs-review'.` };
    }
    
    // Verify the supervisor taking action is the one who created it or is an authorized supervisor
    // For simplicity now, we allow any supervisor. In a multi-supervisor system, you might check taskData.createdBy or a team assignment.
    // For now, just check supervisorId is provided.
    if (!supervisorId) {
        return { success: false, message: 'Supervisor ID missing.' };
    }


    const updates: Partial<Task> & { updatedAt: any, reviewedAt: any, reviewedBy: string } = {
      status: 'verified',
      supervisorReviewNotes: reviewNotes || taskData.supervisorReviewNotes || 'Approved by supervisor.', // Keep existing or add new
      reviewedBy: supervisorId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await updateDoc(taskDocRef, updates);
    return { success: true, message: 'Task approved successfully and status set to verified.', updatedStatus: 'verified' };
  } catch (error) {
    console.error('Error approving task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to approve task: ${errorMessage}` };
  }
}

// Schema for rejecting a task
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
      supervisorReviewNotes: rejectionReason, // Overwrite or set rejection reason
      reviewedBy: supervisorId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await updateDoc(taskDocRef, updates);
    return { success: true, message: 'Task rejected successfully.', updatedStatus: 'rejected' };
  } catch (error) {
    console.error('Error rejecting task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to reject task: ${errorMessage}` };
  }
}
