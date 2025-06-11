
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';

const CreateQuickTaskSchema = z.object({
  projectId: z.string().min(1, { message: "Project ID is required."}),
  taskName: z.string().min(3, { message: "Task name must be at least 3 characters."}).max(100),
  description: z.string().max(500).optional(),
  isImportant: z.boolean().optional().default(false),
});

export type CreateQuickTaskInput = z.infer<typeof CreateQuickTaskSchema>;

export interface CreateQuickTaskResult {
  success: boolean;
  message: string;
  taskId?: string;
  errors?: z.ZodIssue[];
}

export async function createQuickTaskForAssignment(
  supervisorId: string,
  input: CreateQuickTaskInput
): Promise<CreateQuickTaskResult> {
  if (!supervisorId) {
    return { success: false, message: 'Supervisor ID not provided. Authentication issue.' };
  }

  const supervisorDoc = await getDoc(doc(db, 'users', supervisorId));
  if (!supervisorDoc.exists() || !['supervisor', 'admin'].includes(supervisorDoc.data()?.role)) {
    return { success: false, message: 'User not authorized to create tasks.' };
  }

  const validationResult = CreateQuickTaskSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input data.', errors: validationResult.error.issues };
  }

  const { projectId, taskName, description, isImportant } = validationResult.data;

  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    return { success: false, message: `Project with ID ${projectId} not found.` };
  }

  try {
    const newTaskData: Omit<Task, 'id' | 'assignedEmployeeId' | 'dueDate' | 'supervisorNotes' | 'updatedAt' | 'startTime' | 'endTime' | 'elapsedTime' | 'employeeNotes' | 'submittedMediaUri' | 'aiComplianceNotes' | 'aiRisks' | 'supervisorReviewNotes' | 'reviewedBy' | 'reviewedAt'> & { createdAt: any, status: TaskStatus, createdBy: string, isImportant: boolean } = {
      projectId,
      taskName,
      description: description || '',
      status: 'pending', 
      createdBy: supervisorId,
      createdAt: serverTimestamp(),
      isImportant: isImportant,
    };

    const docRef = await addDoc(collection(db, 'tasks'), newTaskData);
    return { success: true, message: 'Quick task created successfully.', taskId: docRef.id };
  } catch (error) {
    console.error('Error creating quick task for assignment:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create task: ${errorMessage}` };
  }
}
