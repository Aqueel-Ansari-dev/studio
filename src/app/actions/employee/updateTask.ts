
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';
import type { ComplianceRiskAnalysisOutput } from '@/ai/flows/compliance-risk-analysis';
import { logAttendance, fetchTodaysAttendance } from '@/app/actions/attendance'; 
import { createSingleNotification, createNotificationsForRole, getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import { notifyUserByWhatsApp } from '@/lib/notify';
import { logAudit } from '../auditLog';

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
    const todayAttendance = await fetchTodaysAttendance(employeeId, projectId);
    if (!todayAttendance.attendanceLog || !todayAttendance.attendanceLog.checkInTime) {
      const mockGps = { lat: 0, lng: 0, accuracy: 100 }; // Placeholder GPS for auto check-in
      const attendanceResult = await logAttendance(employeeId, projectId, mockGps, true);
      if (attendanceResult.success) {
        attendanceMessage = `Auto-checked in: ${attendanceResult.message}`;
      } else {
        attendanceMessage = `Auto-check-in failed: ${attendanceResult.message}`;
      }
    }

    const taskDocRef = doc(db, 'tasks', taskId);
    const taskDocSnap = await getDoc(taskDocRef);

    if (!taskDocSnap.exists()) {
      return { success: false, message: 'Task not found.' };
    }
    const rawTaskData = taskDocSnap.data() as Task;

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
      updatesForDb.startTime = currentServerTime; // Set initial startTime
      resolvedStartTimeForOptimistic = Date.now();
      updatesForDb.elapsedTime = 0; // Ensure elapsedTime is 0 for new tasks
    } else { // Resuming a paused task
      // When resuming, we need to ensure startTime is set to now, so the *next* pause/complete calculates from this point.
      // The already accumulated elapsedTime is preserved.
      updatesForDb.startTime = currentServerTime; 
      resolvedStartTimeForOptimistic = Date.now(); 
      // Keep existing elapsedTime, it's added to in pause/complete
    }


    await updateDoc(taskDocRef, updatesForDb);
    
    // Audit Log
    await logAudit(employeeId, 'task_start', `Started/resumed task: "${rawTaskData.taskName}"`, taskId, 'task');


    const employeeName = await getUserDisplayName(employeeId);
    const projectName = await getProjectName(projectId);
    const supervisorId = rawTaskData.createdBy;

    if (supervisorId) {
      await createSingleNotification(
        supervisorId,
        'task-started',
        `Task Started: ${rawTaskData.taskName}`,
        `${employeeName} started task "${rawTaskData.taskName}" for project "${projectName}".`,
        taskId,
        'task',
        'task',
        'normal'
      );
      const waMsg = `\u2705 Task Updated\nTask: ${rawTaskData.taskName}\nStatus: in-progress\nBy: ${employeeName}`;
      await notifyUserByWhatsApp(supervisorId, waMsg);
    }
    await createNotificationsForRole(
      'admin',
      'task-started',
      `Admin: Task Started - ${rawTaskData.taskName}`,
      `${employeeName} started task "${rawTaskData.taskName}" for project "${projectName}". Assigned by ${supervisorId}.`,
      taskId,
      'task',
      undefined,
      'task',
      'normal'
    );

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

const PauseTaskSchema = z.object({
  taskId: z.string().min(1),
  employeeId: z.string().min(1),
  // elapsedTime is now calculated server-side, no need for client to send it.
});
export type PauseTaskInput = z.infer<typeof PauseTaskSchema>;

interface PauseTaskResult {
  success: boolean;
  message: string;
  updatedTask?: Partial<Task>;
}

export async function pauseEmployeeTask(input: PauseTaskInput): Promise<PauseTaskResult> {
  const validation = PauseTaskSchema.safeParse(input);
  if (!validation.success) return { success: false, message: 'Invalid input for pausing task.' };
  const { taskId, employeeId } = validation.data;

  try {
    const taskDocRef = doc(db, 'tasks', taskId);
    const taskDocSnap = await getDoc(taskDocRef);
    if (!taskDocSnap.exists()) return { success: false, message: 'Task not found.' };
    
    const rawTaskData = taskDocSnap.data() as Task;
    if (rawTaskData.assignedEmployeeId !== employeeId) return { success: false, message: 'You are not authorized to pause this task.' };
    if (rawTaskData.status !== 'in-progress') return { success: false, message: `Task cannot be paused. Current status: ${rawTaskData.status}` };

    const currentServerTime = serverTimestamp();
    let accumulatedElapsedTime = rawTaskData.elapsedTime || 0;
    
    let startTimeMillis: number | undefined;
    if (rawTaskData.startTime instanceof Timestamp) {
        startTimeMillis = rawTaskData.startTime.toMillis();
    } else if (typeof rawTaskData.startTime === 'number') { // Assuming it's already millis
        startTimeMillis = rawTaskData.startTime;
    } else if ((rawTaskData.startTime as any)?.seconds) { // Firestore-like object from client
        startTimeMillis = new Timestamp((rawTaskData.startTime as any).seconds, (rawTaskData.startTime as any).nanoseconds).toMillis();
    }


    if (startTimeMillis) {
        const sessionElapsedTimeSeconds = calculateElapsedTimeSeconds(startTimeMillis, Date.now());
        accumulatedElapsedTime += sessionElapsedTimeSeconds;
    }

    const updatesForDb: Partial<any> = {
      status: 'paused',
      updatedAt: currentServerTime,
      elapsedTime: accumulatedElapsedTime,
      startTime: null, // Clear startTime as it's now paused
    };

    await updateDoc(taskDocRef, updatesForDb);
    
    // Audit Log
    await logAudit(employeeId, 'task_pause', `Paused task: "${rawTaskData.taskName}"`, taskId, 'task');

    const optimisticUpdateData: Partial<Task> = { 
        id: taskId, 
        status: 'paused', 
        elapsedTime: accumulatedElapsedTime,
        startTime: null 
    };

    const supervisorId = rawTaskData.createdBy;
    if (supervisorId) {
      const employeeName = await getUserDisplayName(employeeId);
      const waMsg = `\u2705 Task Updated\nTask: ${rawTaskData.taskName}\nStatus: paused\nBy: ${employeeName}`;
      await notifyUserByWhatsApp(supervisorId, waMsg);
    }

    return { success: true, message: 'Task paused successfully.', updatedTask: optimisticUpdateData };
  } catch (error) {
    console.error('Error pausing task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to pause task: ${errorMessage}` };
  }
}

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
    if (!taskDocSnap.exists()) return { success: false, message: 'Task not found.' };
    
    const rawTaskData = taskDocSnap.data() as Task;
    if (rawTaskData.assignedEmployeeId !== employeeId) return { success: false, message: 'You are not authorized to complete this task.' };
    if (rawTaskData.status !== 'in-progress' && rawTaskData.status !== 'paused') return { success: false, message: `Task cannot be completed. Current status: ${rawTaskData.status}` };

    let finalStatus: TaskStatus = 'completed';
    if (aiComplianceOutput.complianceRisks && aiComplianceOutput.complianceRisks.length > 0 && !aiComplianceOutput.complianceRisks.includes('AI_ANALYSIS_UNAVAILABLE') && !aiComplianceOutput.complianceRisks.includes('AI_ANALYSIS_ERROR_EMPTY_OUTPUT')) {
      finalStatus = 'needs-review';
    }

    const currentServerTime = serverTimestamp();
    let finalElapsedTime = rawTaskData.elapsedTime || 0;

    if (rawTaskData.status === 'in-progress') {
        let startTimeMillis: number | undefined;
        if (rawTaskData.startTime instanceof Timestamp) {
            startTimeMillis = rawTaskData.startTime.toMillis();
        } else if (typeof rawTaskData.startTime === 'number') {
            startTimeMillis = rawTaskData.startTime;
        } else if ((rawTaskData.startTime as any)?.seconds) {
            startTimeMillis = new Timestamp((rawTaskData.startTime as any).seconds, (rawTaskData.startTime as any).nanoseconds).toMillis();
        }
        
        if (startTimeMillis) {
            const sessionElapsedTimeSeconds = calculateElapsedTimeSeconds(startTimeMillis, Date.now());
            finalElapsedTime += sessionElapsedTimeSeconds;
        }
    }
    // If status was 'paused', finalElapsedTime already holds the correct accumulated time.

    const updatesForDb: Partial<any> = {
      status: finalStatus,
      employeeNotes: notes || rawTaskData.employeeNotes || '',
      submittedMediaUri: submittedMediaUri || rawTaskData.submittedMediaUri || '',
      aiRisks: aiComplianceOutput.complianceRisks || [],
      aiComplianceNotes: aiComplianceOutput.additionalInformationNeeded || (aiComplianceOutput.complianceRisks.length > 0 ? "Review AI detected risks." : "No specific information requested by AI."),
      endTime: currentServerTime,
      updatedAt: currentServerTime,
      elapsedTime: finalElapsedTime,
      startTime: null, // Clear startTime as task is finished
    };
    await updateDoc(taskDocRef, updatesForDb);

    // Audit Log
    await logAudit(
      employeeId, 
      'task_complete', 
      `Completed task: "${rawTaskData.taskName}". Final status: ${finalStatus}.`,
      taskId,
      'task',
      { notes, finalStatus }
    );

    // Notifications
    const employeeName = await getUserDisplayName(employeeId);
    const projectName = await getProjectName(rawTaskData.projectId);
    const supervisorId = rawTaskData.createdBy;

    let supervisorNotificationType: 'task-completed' | 'task-needs-review' = 'task-completed';
    let supervisorNotificationTitle = `Task Submitted: ${rawTaskData.taskName}`;
    let supervisorNotificationBody = `${employeeName} submitted task "${rawTaskData.taskName}" for project "${projectName}". Status: ${finalStatus}.`;

    if (finalStatus === 'needs-review') {
      supervisorNotificationType = 'task-needs-review';
      supervisorNotificationTitle = `Review Task: ${rawTaskData.taskName}`;
      supervisorNotificationBody = `Task "${rawTaskData.taskName}" by ${employeeName} (Project: ${projectName}) needs your review.`;
    } else if (finalStatus === 'completed' || finalStatus === 'verified') {
       supervisorNotificationTitle = `Task Completed: ${rawTaskData.taskName}`;
       supervisorNotificationBody = `Task "${rawTaskData.taskName}" by ${employeeName} (Project: ${projectName}) is now ${finalStatus}.`;
    }
    
    if (supervisorId) {
      await createSingleNotification(
        supervisorId,
        supervisorNotificationType,
        supervisorNotificationTitle,
        supervisorNotificationBody,
        taskId,
        'task',
        'task',
        'normal'
      );
      const waMsg = `\u2705 Task Updated\nTask: ${rawTaskData.taskName}\nStatus: ${finalStatus}\nBy: ${employeeName}`;
      await notifyUserByWhatsApp(supervisorId, waMsg);
    }
    await createNotificationsForRole(
      'admin',
      supervisorNotificationType,
      `Admin: ${supervisorNotificationTitle}`,
      supervisorNotificationBody + ` Assigned by ${supervisorId}.`,
      taskId,
      'task',
      undefined,
      'task',
      'normal'
    );

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
    
