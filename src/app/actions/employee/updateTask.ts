
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
      return { success: false, message: 'You are not authorized to start this task.' };
    }

    if (taskData.status !== 'pending' && taskData.status !== 'paused') {
      return { success: false, message: `Task cannot be started. Current status: ${taskData.status}` };
    }
    
    const currentServerTime = serverTimestamp();

    const updates: Partial<Task> & { startTime: any, updatedAt: any } = {
      status: 'in-progress',
      startTime: currentServerTime, // This will be a server timestamp
      updatedAt: currentServerTime,
    };

    await updateDoc(taskDocRef, updates);
    
    // For returning updated task info, we can't easily get serverTimestamp back immediately as a usable number
    // The client will re-fetch, or we can return an optimistic update.
    const optimisticUpdate: Partial<Task> = {
        id: taskId,
        status: 'in-progress',
        // startTime would ideally be the actual server time, but client re-fetch is safer
    };

    return { success: true, message: 'Task started successfully.', updatedTask: optimisticUpdate };
  } catch (error) {
    console.error('Error starting task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to start task: ${errorMessage}` };
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
    if (aiComplianceOutput.complianceRisks && aiComplianceOutput.complianceRisks.length > 0) {
      finalStatus = 'needs-review';
    }
    
    const currentServerTime = serverTimestamp(); // Firestore server timestamp
    const startTimeMillis = taskData.startTime instanceof Timestamp 
                              ? taskData.startTime.toMillis() 
                              : (typeof taskData.startTime === 'number' ? taskData.startTime : undefined);
    
    // We need to get the actual server time for endTime to calculate elapsedTime accurately.
    // This is tricky as serverTimestamp() is a token. For a precise elapsedTime upon completion,
    // it's best to calculate it after fetching the document post-update, or use a Cloud Function.
    // For now, we'll store endTime as a server timestamp, and elapsedTime can be calculated client-side or on subsequent reads.
    // Or, if we *must* store it now, we'd fetch the task again after this update or use a transaction.
    // Let's set endTime and then if startTime exists, we can calculate elapsedTime.
    // However, startTime could be a serverTimestamp itself if just set.
    // For a robust elapsedTime stored with the task, this would ideally be part of a transaction
    // or a two-step process (update, then fetch and update elapsedTime).
    // For simplicity here, we will store endTime. elapsedTime can be derived.
    // Or, if elapsedTime is critical to store at this moment, we make an assumption or use a client-provided end time.
    // Let's update to store elapsedTime if startTime is a number (already resolved from previous fetch/start).
    
    const updates: Partial<Task> & { endTime: any, updatedAt: any, elapsedTime?: number } = {
      status: finalStatus,
      employeeNotes: notes || taskData.employeeNotes || '', // Keep existing if new is empty
      submittedMediaUri: submittedMediaUri || taskData.submittedMediaUri || '', // Keep existing if new is empty
      aiRisks: aiComplianceOutput.complianceRisks || [],
      aiComplianceNotes: aiComplianceOutput.additionalInformationNeeded || (aiComplianceOutput.complianceRisks.length > 0 ? "Review AI detected risks." : "No specific information requested by AI."),
      endTime: currentServerTime, 
      updatedAt: currentServerTime,
    };

    if (startTimeMillis) {
      // This is tricky because currentServerTime is a placeholder for the actual server time.
      // To accurately calculate elapsedTime using the *server's* endTime, this write
      // would need to be followed by a read and another write, or handled by a Cloud Function trigger.
      // For now, we will calculate elapsedTime based on the *client's current time* if we were to pass it,
      // or acknowledge that elapsedTime will be calculated on read.
      // The current structure of fetchMyTasksForProject already calculates elapsedTime on read if missing.
      // So, we primarily need to ensure startTime and endTime are stored.
      // Let's assume that the `elapsedTime` field in the Task interface is for display and can be calculated on read.
      // If explicit storage of `elapsedTime` calculated *at this moment* is needed using server timestamps, it's more complex.
      // For now, we rely on the on-read calculation.
    }


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
