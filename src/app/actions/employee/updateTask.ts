
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

    // rawTaskData contains Firestore Timestamps as they are stored.
    const rawTaskData = taskDocSnap.data(); 

    if (rawTaskData.assignedEmployeeId !== employeeId) {
      return { success: false, message: 'You are not authorized to start/resume this task.' };
    }

    if (rawTaskData.status !== 'pending' && rawTaskData.status !== 'paused') {
      return { success: false, message: `Task cannot be started/resumed. Current status: ${rawTaskData.status}` };
    }
    
    const currentServerTime = serverTimestamp();
    // Use 'any' for Firestore specific update values like serverTimestamp
    const updatesForDb: Partial<any> = { 
      status: 'in-progress',
      updatedAt: currentServerTime,
    };

    let resolvedStartTimeForOptimistic: number | undefined;

    if (rawTaskData.status === 'pending') {
      updatesForDb.startTime = currentServerTime; // For DB write
      resolvedStartTimeForOptimistic = Date.now(); // For client optimistic update (milliseconds)
    } else { // Resuming from 'paused'
      // Convert rawTaskData.startTime (which could be Firestore Timestamp) to milliseconds
      if (rawTaskData.startTime instanceof Timestamp) {
        resolvedStartTimeForOptimistic = rawTaskData.startTime.toMillis();
      } else if (typeof rawTaskData.startTime === 'number') {
        resolvedStartTimeForOptimistic = rawTaskData.startTime; // Already milliseconds
      } else if (rawTaskData.startTime && typeof (rawTaskData.startTime as any).seconds === 'number') {
        // Handle case where it might be a plain object resembling a Timestamp due to previous incorrect serialization
        resolvedStartTimeForOptimistic = new Timestamp((rawTaskData.startTime as any).seconds, (rawTaskData.startTime as any).nanoseconds).toMillis();
      }
      // If startTime is somehow missing for a paused task, optimistic update will leave it as is or undefined for the client state
    }

    await updateDoc(taskDocRef, updatesForDb);
    
    // Ensure the optimisticUpdateData object contains only primitive types for timestamps
    const optimisticUpdateData: Partial<Task> = {
        id: taskId,
        status: 'in-progress',
        startTime: resolvedStartTimeForOptimistic, // This is now guaranteed to be a number or undefined
        // Carry over elapsedTime from rawTaskData if it exists (especially from a paused state)
        elapsedTime: typeof rawTaskData.elapsedTime === 'number' ? rawTaskData.elapsedTime : 0, 
    };

    return { success: true, message: 'Task started/resumed successfully.', updatedTask: optimisticUpdateData };
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
  updatedTask?: Partial<Task>; // For potential optimistic client-side UI updates
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

    const rawTaskData = taskDocSnap.data();

    if (rawTaskData.assignedEmployeeId !== employeeId) {
      return { success: false, message: 'You are not authorized to pause this task.' };
    }

    if (rawTaskData.status !== 'in-progress') {
      return { success: false, message: `Task cannot be paused. Current status: ${rawTaskData.status}` };
    }
    
    const currentServerTime = serverTimestamp();
    const updatesForDb: Partial<any> = { // Use 'any' for Firestore specific update values
      status: 'paused',
      updatedAt: currentServerTime,
    };

    // Persist client's tracked elapsed time or the existing one from DB
    const finalElapsedTime = typeof elapsedTime === 'number' 
      ? elapsedTime 
      : (typeof rawTaskData.elapsedTime === 'number' ? rawTaskData.elapsedTime : 0);
    updatesForDb.elapsedTime = finalElapsedTime;


    await updateDoc(taskDocRef, updatesForDb);
    
    // Optimistic update data should be serializable (primitives)
    const optimisticUpdateData: Partial<Task> = {
        id: taskId,
        status: 'paused',
        elapsedTime: finalElapsedTime,
        // Note: startTime, endTime, etc., are not modified by pause, so client should rely on loadData() for full fresh data
        // or merge carefully if more fields are included here.
    };

    return { success: true, message: 'Task paused successfully.', updatedTask: optimisticUpdateData };
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

    const rawTaskData = taskDocSnap.data();

    if (rawTaskData.assignedEmployeeId !== employeeId) {
      return { success: false, message: 'You are not authorized to complete this task.' };
    }

    if (rawTaskData.status !== 'in-progress' && rawTaskData.status !== 'paused') {
      return { success: false, message: `Task cannot be completed. Current status: ${rawTaskData.status}` };
    }
    
    let finalStatus: TaskStatus = 'completed';
    if (aiComplianceOutput.complianceRisks && aiComplianceOutput.complianceRisks.length > 0 && !aiComplianceOutput.complianceRisks.includes('AI_ANALYSIS_UNAVAILABLE') && !aiComplianceOutput.complianceRisks.includes('AI_ANALYSIS_ERROR_EMPTY_OUTPUT')) {
      finalStatus = 'needs-review';
    }
    
    const currentServerTime = serverTimestamp(); 
    // rawTaskData.startTime could be a Firestore Timestamp or number from previous processing
    const startTimeMillis = rawTaskData.startTime instanceof Timestamp 
                              ? rawTaskData.startTime.toMillis() 
                              : (typeof rawTaskData.startTime === 'number' ? rawTaskData.startTime : undefined);
    
    
    const updatesForDb: Partial<any> = { // Using 'any' for serverTimestamp values
      status: finalStatus,
      employeeNotes: notes || rawTaskData.employeeNotes || '', 
      submittedMediaUri: submittedMediaUri || rawTaskData.submittedMediaUri || '', 
      aiRisks: aiComplianceOutput.complianceRisks || [],
      aiComplianceNotes: aiComplianceOutput.additionalInformationNeeded || (aiComplianceOutput.complianceRisks.length > 0 ? "Review AI detected risks." : "No specific information requested by AI."),
      endTime: currentServerTime, 
      updatedAt: currentServerTime,
    };
    
    // Calculate final elapsed time. Client should send accumulated time if available.
    // For now, calculate based on start time and current time if not provided by client.
    // The on-read calculation in fetchMyTasksForProject is a good fallback.
    // If task was paused, rawTaskData.elapsedTime should have the accumulated time up to pause.
    // For 'complete', we primarily care about setting the endTime.
    // The on-read calculation in fetch functions will handle elapsedTime if not explicitly set here.
    // A robust approach would have the client send its final calculated elapsedTime.

    await updateDoc(taskDocRef, updatesForDb);
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


    