
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';
import type { ComplianceRiskAnalysisOutput } from '@/ai/flows/compliance-risk-analysis';

// Schema for starting a task
const StartTaskSchema = z.object({
  taskId: z.string().min(1),
  employeeId: z.string().min(1),
});
export type StartTaskInput = z.infer<typeof StartTaskSchema>;

interface StartTaskResult {
  success: boolean;
  message: string;
  updatedTask?: Partial<Task>; // Return relevant parts of the updated task
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

    const updates: Partial<Task> & { startTime: any, updatedAt: any } = {
      status: 'in-progress',
      startTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await updateDoc(taskDocRef, updates);
    
    // For returning updated task info, we can't easily get serverTimestamp back immediately
    // So we return what we know client-side can optimistically update with
    const optimisticUpdate: Partial<Task> = {
        id: taskId,
        status: 'in-progress',
        // startTime will be set by server, client might need to re-fetch or handle this
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
  submittedMediaUri: z.string().optional(), // Expecting a data URI for now
  aiComplianceOutput: z.custom<ComplianceRiskAnalysisOutput>(), // Pass the whole AI output
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

    // Allow completion from 'in-progress' or 'paused' status
    if (taskData.status !== 'in-progress' && taskData.status !== 'paused') {
      return { success: false, message: `Task cannot be completed. Current status: ${taskData.status}` };
    }
    
    let finalStatus: TaskStatus = 'completed';
    if (aiComplianceOutput.complianceRisks && aiComplianceOutput.complianceRisks.length > 0) {
      finalStatus = 'needs-review';
    }

    const updates: Partial<Task> & { endTime: any, updatedAt: any } = {
      status: finalStatus,
      employeeNotes: notes || '',
      submittedMediaUri: submittedMediaUri || '',
      aiRisks: aiComplianceOutput.complianceRisks || [],
      aiComplianceNotes: aiComplianceOutput.additionalInformationNeeded || (aiComplianceOutput.complianceRisks.length > 0 ? "Review AI detected risks." : "No specific information requested by AI."),
      endTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await updateDoc(taskDocRef, updates);
    return { success: true, message: `Task marked as ${finalStatus}.`, finalStatus };
  } catch (error) {
    console.error('Error completing task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to complete task: ${errorMessage}` };
  }
}
