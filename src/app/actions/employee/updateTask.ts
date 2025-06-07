
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp, collection, addDoc } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';
import type { ComplianceRiskAnalysisOutput } from '@/ai/flows/compliance-risk-analysis';
import { logAttendance, fetchTodaysAttendance } from '@/app/actions/attendance'; // Import new attendance actions

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
  // projectId is needed for auto-check-in
  projectId: z.string().min(1, "Project ID is required for task start."),
});
export type StartTaskInput = z.infer<typeof StartTaskSchema>;

interface StartTaskResult {
  success: boolean;
  message: string;
  updatedTask?: Partial<Task>;
  attendanceMessage?: string;
}

export async function startEmployeeTask(input: StartTaskInput): Promise<StartTaskResult> {
  const validation = StartTaskSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input for starting task.', updatedTask: undefined };
  }
  const { taskId, employeeId, projectId } = validation.data;
  let attendanceMessage: string | undefined = undefined;

  try {
    // Attempt auto-check-in if not already checked in for this project today
    // For auto-check-in, we'll use a mock GPS location or ideally get it from client
    // For now, let's simulate it if not already checked in.
    const todayAttendance = await fetchTodaysAttendance(employeeId, projectId);
    if (!todayAttendance.attendanceLog || !todayAttendance.attendanceLog.checkInTime) {
      console.log(`[startEmployeeTask] No active check-in for employee ${employeeId} on project ${projectId}. Attempting auto-check-in.`);
      // Mock GPS for now, ideally this comes from client
      const mockGps = { lat: 0, lng: 0, accuracy: 100 };
      const attendanceResult = await logAttendance(employeeId, projectId, mockGps, true);
      if (attendanceResult.success) {
        attendanceMessage = `Auto-checked in: ${attendanceResult.message}`;
        console.log(`[startEmployeeTask] Auto-check-in successful for employee ${employeeId}.`);
      } else {
        attendanceMessage = `Auto-check-in failed: ${attendanceResult.message}`;
        console.warn(`[startEmployeeTask] Auto-check-in failed for employee ${employeeId}: ${attendanceResult.message}`);
        // Decide if task start should be blocked if auto-check-in fails. For now, let's allow it but note the failure.
      }
    } else {
        console.log(`[startEmployeeTask] Employee ${employeeId} already checked-in for project ${projectId} today.`);
    }


    const taskDocRef = doc(db, 'tasks', taskId);
    const taskDocSnap = await getDoc(taskDocRef);

    if (!taskDocSnap.exists()) {
      return { success: false, message: 'Task not found.' };
    }

    const rawTaskData = taskDocSnap.data();

    if (rawTaskData.assignedEmployeeId !== employeeId) {
      return { success: false, message: 'You are not authorized to start/resume this task.' };
    }

    if (rawTaskData.status !== 'pending' && rawTaskData.status !== 'paused') {
      return { success: false, message: `Task cannot be started/resumed. Current status: ${rawTaskData.status}` };
    }

    const currentServerTime = serverTimestamp();
    const updatesForDb: Partial<any> = {
      status: 'in-progress',
      updatedAt: currentServerTime,
    };

    let resolvedStartTimeForOptimistic: number | undefined;

    if (rawTaskData.status === 'pending') {
      updatesForDb.startTime = currentServerTime;
      resolvedStartTimeForOptimistic = Date.now();
    } else { 
      if (rawTaskData.startTime instanceof Timestamp) {
        resolvedStartTimeForOptimistic = rawTaskData.startTime.toMillis();
      } else if (typeof rawTaskData.startTime === 'number') {
        resolvedStartTimeForOptimistic = rawTaskData.startTime;
      } else if (rawTaskData.startTime && typeof (rawTaskData.startTime as any).seconds === 'number') {
        resolvedStartTimeForOptimistic = new Timestamp((rawTaskData.startTime as any).seconds, (rawTaskData.startTime as any).nanoseconds).toMillis();
      }
    }

    await updateDoc(taskDocRef, updatesForDb);

    const optimisticUpdateData: Partial<Task> = {
        id: taskId,
        status: 'in-progress',
        startTime: resolvedStartTimeForOptimistic,
        elapsedTime: typeof rawTaskData.elapsedTime === 'number' ? rawTaskData.elapsedTime : 0,
    };

    return { success: true, message: 'Task started/resumed successfully.', updatedTask: optimisticUpdateData, attendanceMessage };
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
  elapsedTime: z.number().min(0).optional(),
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

    const rawTaskData = taskDocSnap.data();

    if (rawTaskData.assignedEmployeeId !== employeeId) {
      return { success: false, message: 'You are not authorized to pause this task.' };
    }

    if (rawTaskData.status !== 'in-progress') {
      return { success: false, message: `Task cannot be paused. Current status: ${rawTaskData.status}` };
    }

    const currentServerTime = serverTimestamp();
    const updatesForDb: Partial<any> = {
      status: 'paused',
      updatedAt: currentServerTime,
    };

    const finalElapsedTime = typeof elapsedTime === 'number'
      ? elapsedTime
      : (typeof rawTaskData.elapsedTime === 'number' ? rawTaskData.elapsedTime : 0);
    updatesForDb.elapsedTime = finalElapsedTime;


    await updateDoc(taskDocRef, updatesForDb);

    const optimisticUpdateData: Partial<Task> = {
        id: taskId,
        status: 'paused',
        elapsedTime: finalElapsedTime,
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
    const startTimeMillis = rawTaskData.startTime instanceof Timestamp
                              ? rawTaskData.startTime.toMillis()
                              : (typeof rawTaskData.startTime === 'number' ? rawTaskData.startTime : undefined);
    
    // Calculate final elapsedTime. If status was 'paused', rawTaskData.elapsedTime has accumulated time.
    // If 'in-progress', calculate now.
    let finalElapsedTime = typeof rawTaskData.elapsedTime === 'number' ? rawTaskData.elapsedTime : 0;
    if (rawTaskData.status === 'in-progress' && startTimeMillis) {
        finalElapsedTime += calculateElapsedTimeSeconds(startTimeMillis, Date.now()); // Date.now() for current client-ish time
    } else if (rawTaskData.status === 'paused' && typeof rawTaskData.elapsedTime === 'number') {
        // elapsedTime is already accumulated up to the pause. No further addition needed here from server.
        finalElapsedTime = rawTaskData.elapsedTime;
    }


    const updatesForDb: Partial<any> = {
      status: finalStatus,
      employeeNotes: notes || rawTaskData.employeeNotes || '',
      submittedMediaUri: submittedMediaUri || rawTaskData.submittedMediaUri || '',
      aiRisks: aiComplianceOutput.complianceRisks || [],
      aiComplianceNotes: aiComplianceOutput.additionalInformationNeeded || (aiComplianceOutput.complianceRisks.length > 0 ? "Review AI detected risks." : "No specific information requested by AI."),
      endTime: currentServerTime,
      updatedAt: currentServerTime,
      elapsedTime: finalElapsedTime, // Store the final calculated/accumulated elapsed time
    };


    await updateDoc(taskDocRef, updatesForDb);

    // Notify the supervising user that the task was completed
    try {
      const supervisorId = rawTaskData.createdBy;
      if (supervisorId && (finalStatus === 'completed' || finalStatus === 'verified')) {
        const notificationData = {
          userId: supervisorId,
          type: 'task-completed',
          title: 'Task Completed',
          body: `${rawTaskData.taskName} completed by ${employeeId} for project ${rawTaskData.projectId}`,
          relatedTaskId: taskId,
          read: false,
          createdAt: currentServerTime,
        };
        await addDoc(collection(db, 'notifications'), notificationData);
      }
    } catch (notifError) {
      console.error('Error creating completion notification:', notifError);
    }

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
