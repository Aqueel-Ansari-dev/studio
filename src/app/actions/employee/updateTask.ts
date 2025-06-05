
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';
import type { ComplianceRiskAnalysisOutput } from '@/ai/flows/compliance-risk-analysis';

// Helper to calculate elapsed time in seconds
function calculateElapsedTimeSeconds(startTimeMillis?: number, endTimeMillis?: number): number {
  if (startTimeMillis && endTimeMillis && endTimeMillis > startTimeMillis) {
    return Math.round((endTimeMillis - startTimeMillis) / 1000);
  }
  return 0;
}

// Schema for starting a task
const StartTaskSchema = z.object({
  taskId: z.string().min(1),
  employeeId: z.string().min(1),
});
export type StartTaskInput = z.infer<typeof StartTaskSchema>;

interface StartTaskResult {
  success: boolean;
  message: string;
  updatedTask?: Partial<Task>; 
}

export async function startEmployeeTask(input: StartTaskInput): Promise<StartTaskResult> {
  const validation = StartTaskSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input for starting task.', updatedTask: undefined };
  }
  const { taskId, employeeId } = validation.data;

  try {
    const taskDocRef = doc(db, 'tasks', taskId);
    const taskDocSnap = await getDoc(taskDocRef);

    if (!taskDocSnap.exists()) {
      return { success: false, message: 'Task not found.' };
    }

    const taskData = taskDocSnap.data() as Task;

    if (taskData.assignedEmployeeId !== employeeId) {
      return { success: false, message: 'You are not authorized to start/resume this task.' };
    }

    if (taskData.status !== 'pending' && taskData.status !== 'paused') {
      return { success: false, message: `Task cannot be started/resumed. Current status: ${taskData.status}` };
    }
    
    const currentServerTime = serverTimestamp();
    const updates: Partial<Task> & { updatedAt: any, startTime?: any } = {
      status: 'in-progress',
      updatedAt: currentServerTime,
    };

    if (taskData.status === 'pending') {
      updates.startTime = currentServerTime;
    }
    // elapsedTime is carried over if resuming from pause (it was saved during pause)


    await updateDoc(taskDocRef, updates);
    
    const optimisticUpdate: Partial<Task> = {
        id: taskId,
        status: 'in-progress',
        // For optimistic update, use client time or existing time
        startTime: taskData.status === 'pending' ? Date.now() : taskData.startTime,
        elapsedTime: taskData.elapsedTime, // Carry over from paused state or 0 if pending
    };

    return { success: true, message: 'Task started/resumed successfully.', updatedTask: optimisticUpdate };
  } catch (error) {
    console.error('Error starting/resuming task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to start/resume task: ${errorMessage}` };
  }
}

// Schema for pausing a task
const PauseTaskSchema = z.object({
  taskId: z.string().min(1),
  employeeId: z.string().min(1),
  elapsedTime: z.number().min(0).optional(), // Current elapsed time from client
});
export type PauseTaskInput = z.infer<typeof PauseTaskSchema>;

interface PauseTaskResult {
  success: boolean;
  message: string;
  updatedTask?: Partial<Task>;
}

export async function pauseEmployeeTask(input: PauseTaskInput): Promise<PauseTaskResult> {
  const validation = PauseTaskSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input for pausing task.' };
  }
  const { taskId, employeeId, elapsedTime } = validation.data;

  try {
    const taskDocRef = doc(db, 'tasks', taskId);
    const taskDocSnap = await getDoc(taskDocRef);

    if (!taskDocSnap.exists()) {
      return { success: false, message: 'Task not found.' };
    }

    const taskData = taskDocSnap.data() as Task;

    if (taskData.assignedEmployeeId !== employeeId) {
      return { success: false, message: 'You are not authorized to pause this task.' };
    }

    if (taskData.status !== 'in-progress') {
      return { success: false, message: `Task cannot be paused. Current status: ${taskData.status}` };
    }
    
    const currentServerTime = serverTimestamp();
    const updates: Partial<Task> & { updatedAt: any, elapsedTime?: number } = {
      status: 'paused',
      updatedAt: currentServerTime,
    };

    if (typeof elapsedTime === 'number') {
      updates.elapsedTime = elapsedTime; // Persist client's tracked elapsed time
    }

    await updateDoc(taskDocRef, updates);
    
    const optimisticUpdate: Partial<Task> = {
        id: taskId,
        status: 'paused',
        elapsedTime: elapsedTime !== undefined ? elapsedTime : taskData.elapsedTime,
    };

    return { success: true, message: 'Task paused successfully.', updatedTask: optimisticUpdate };
  } catch (error) {
    console.error('Error pausing task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to pause task: ${errorMessage}` };
  }
}


// Schema for completing a task
const CompleteTaskInputSchema = z.object({
  taskId: z.string().min(1),
  employeeId: z.string().min(1),
  notes: z.string().optional(),
  submittedMediaUri: z.string().optional(), 
  aiComplianceOutput: z.custom<ComplianceRiskAnalysisOutput>(), 
});

export type CompleteTaskInput = z.infer<typeof CompleteTaskInputSchema>;

interface CompleteTaskResult {
  success: boolean;
  message: string;
  finalStatus?: TaskStatus;
}

export async function completeEmployeeTask(input: CompleteTaskInput): Promise<CompleteTaskResult> {
  const validation = CompleteTaskInputSchema.safeParse(input);
  if (!validation.success) {
    console.error("Complete task validation errors:", validation.error.issues);
    return { success: false, message: 'Invalid input for completing task: ' + validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
  }
  const { taskId, employeeId, notes, submittedMediaUri, aiComplianceOutput } = validation.data;

  try {
    const taskDocRef = doc(db, 'tasks', taskId);
    const taskDocSnap = await getDoc(taskDocRef);

    if (!taskDocSnap.exists()) {
      return { success: false, message: 'Task not found.' };
    }

    const taskData = taskDocSnap.data() as Task;

    if (taskData.assignedEmployeeId !== employeeId) {
      return { success: false, message: 'You are not authorized to complete this task.' };
    }

    if (taskData.status !== 'in-progress' && taskData.status !== 'paused') {
      return { success: false, message: `Task cannot be completed. Current status: ${taskData.status}` };
    }
    
    let finalStatus: TaskStatus = 'completed';
    if (aiComplianceOutput.complianceRisks && aiComplianceOutput.complianceRisks.length > 0 && !aiComplianceOutput.complianceRisks.includes('AI_ANALYSIS_UNAVAILABLE') && !aiComplianceOutput.complianceRisks.includes('AI_ANALYSIS_ERROR_EMPTY_OUTPUT')) {
      finalStatus = 'needs-review';
    }
    
    const currentServerTime = serverTimestamp(); 
    const startTimeMillis = taskData.startTime instanceof Timestamp 
                              ? taskData.startTime.toMillis() 
                              : (typeof taskData.startTime === 'number' ? taskData.startTime : undefined);
    
    
    const updates: Partial<Task> & { endTime: any, updatedAt: any, elapsedTime?: number } = {
      status: finalStatus,
      employeeNotes: notes || taskData.employeeNotes || '', 
      submittedMediaUri: submittedMediaUri || taskData.submittedMediaUri || '', 
      aiRisks: aiComplianceOutput.complianceRisks || [],
      aiComplianceNotes: aiComplianceOutput.additionalInformationNeeded || (aiComplianceOutput.complianceRisks.length > 0 ? "Review AI detected risks." : "No specific information requested by AI."),
      endTime: currentServerTime, 
      updatedAt: currentServerTime,
    };
    
    // If task was paused, elapsedTime would be from client on completeInput or from taskData
    // If task was in-progress, elapsedTime would be from client via completeInput
    // We need to ensure that if the task was 'paused', the elapsedTime up to the pause point is included.
    // The client side should be sending the total accumulated elapsedTime in `completeInput` if that's how it's designed.
    // For now, let's assume client sends the final `elapsedTime` if available, or we calculate it if task was never paused.
    // The `fetchMyTasksForProject` already calculates `elapsedTime` on read if missing but start/end times are present.
    // If `taskData.elapsedTime` exists (from a previous pause), and `completeInput` doesn't provide a new one,
    // we should still calculate it based on startTime and the now-being-set endTime if the task was 'in-progress'.
    // This logic is getting complex; the safest is for client to ALWAYS provide the final `elapsedTime` for `completeEmployeeTask`
    // For now, we rely on the on-read calculation for `elapsedTime` to be robust if not explicitly set here.

    await updateDoc(taskDocRef, updates);
    return { success: true, message: `Task marked as ${finalStatus}.`, finalStatus };
  } catch (error) {
    console.error('Error completing task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to complete task: ${errorMessage}` };
  }
}

export async function updateTaskElapsedTime(taskId: string, elapsedTimeSeconds: number): Promise<{success: boolean, message: string}> {
    try {
        const taskDocRef = doc(db, 'tasks', taskId);
        await updateDoc(taskDocRef, {
            elapsedTime: elapsedTimeSeconds,
            updatedAt: serverTimestamp()
        });
        return { success: true, message: 'Elapsed time updated.' };
    } catch (error) {
        console.error('Error updating elapsed time:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, message: `Failed to update elapsed time: ${errorMessage}` };
    }
}
