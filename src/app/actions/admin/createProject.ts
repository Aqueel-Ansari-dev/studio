
'use server';

import { z } from 'zod';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { Project, Task, TaskStatus } from '@/types/database';
import { logAudit } from '../auditLog';
import { getOrganizationId } from '../common/getOrganizationId';

const NewTaskSchema = z.object({
  name: z.string().min(3, { message: "Task name must be at least 3 characters." }),
  description: z.string().max(500).optional(),
  isImportant: z.boolean().optional().default(false),
});

const CreateProjectSchema = z.object({
  name: z.string().min(3, { message: "Project name must be at least 3 characters." }).max(100),
  description: z.string().max(500).optional(),
  imageDataUri: z.string().optional(), // Now expects a data URI instead of a URL
  dataAiHint: z.string().max(50).optional(),
  clientInfo: z.string().max(100).optional(),
  dueDate: z.date().optional(),
  budget: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(val)),
    z.number().nonnegative().optional()
  ),
  assignedSupervisorIds: z.array(z.string()).optional(),
  newTasksToCreate: z.array(NewTaskSchema).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export interface CreateProjectResult {
  success: boolean;
  message: string;
  projectId?: string;
  errors?: z.ZodIssue[];
}

export async function createProjectByAdmin(adminUserId: string, data: CreateProjectInput): Promise<CreateProjectResult> {
  const organizationId = await getOrganizationId(adminUserId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for the current admin.' };
  }
  
  const adminUserDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', adminUserId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
    return { success: false, message: 'Action not authorized. Requester is not an admin.' };
  }

  const validationResult = CreateProjectSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }
  
  const { name, description, imageDataUri, dataAiHint, clientInfo, dueDate, budget, assignedSupervisorIds, newTasksToCreate } = validationResult.data;

  try {
    const projectsCollectionRef = collection(db, 'organizations', organizationId, 'projects');
    const newProjectRef = doc(projectsCollectionRef); // Generate ID upfront
    const projectId = newProjectRef.id;
    const batch = writeBatch(db);
    
    let finalImageUrl = '';
    if (imageDataUri) {
        try {
            const storageRef = ref(storage, `projects/${organizationId}/${projectId}/cover-image`);
            const uploadResult = await uploadString(storageRef, imageDataUri, 'data_url');
            finalImageUrl = await getDownloadURL(uploadResult.ref);
        } catch(storageError) {
            console.error("Error uploading project image:", storageError);
            return { success: false, message: 'Failed to upload project image.' };
        }
    }

    const allSupervisorIds = [...(assignedSupervisorIds || [])];

    const newProjectData: Omit<Project, 'id' | 'organizationId'> & { createdAt: any, status: 'active', statusOrder: number } = {
      name,
      description: description || '',
      imageUrl: finalImageUrl,
      dataAiHint: dataAiHint || '',
      clientInfo: clientInfo || '',
      dueDate: dueDate ? dueDate.toISOString() : null,
      budget: budget ?? null,
      createdBy: adminUserId,
      createdAt: serverTimestamp(),
      status: 'active',
      statusOrder: 0,
      assignedEmployeeIds: [],
      assignedSupervisorIds: allSupervisorIds,
    };

    batch.set(newProjectRef, newProjectData);

    if (allSupervisorIds.length > 0) {
        for (const supervisorId of allSupervisorIds) {
            const userRef = doc(db, 'organizations', organizationId, 'users', supervisorId);
            batch.update(userRef, { assignedProjectIds: arrayUnion(projectId) });
        }
    }

    // Create initial tasks for the project
    if (newTasksToCreate && newTasksToCreate.length > 0) {
      const tasksCollectionRef = collection(db, 'organizations', organizationId, 'tasks');
      for (const task of newTasksToCreate) {
          const newTaskRef = doc(tasksCollectionRef);
          const newTaskData: Omit<Task, 'id' | 'dueDate' | 'supervisorNotes' | 'updatedAt' | 'startTime' | 'endTime' | 'elapsedTime' | 'employeeNotes' | 'submittedMediaUri' | 'aiComplianceNotes' | 'aiRisks' | 'supervisorReviewNotes' | 'reviewedBy' | 'reviewedAt'> & { createdAt: any, status: TaskStatus, createdBy: string, isImportant: boolean, assignedEmployeeId: string } = {
              projectId: projectId,
              taskName: task.name,
              description: task.description || '',
              status: 'pending',
              createdBy: adminUserId,
              createdAt: serverTimestamp(),
              isImportant: task.isImportant || false,
              assignedEmployeeId: '', // Unassigned by default
          };
          batch.set(newTaskRef, newTaskData);
      }
    }

    await batch.commit();

    await logAudit(
      adminUserId,
      organizationId,
      'project_create',
      `Created project: "${name}"`,
      projectId,
      'project',
      { ...data, imageDataUri: undefined } // Exclude image data from log payload
    );
    
    let message = `Project "${name}" created successfully!`;
    if (newTasksToCreate && newTasksToCreate.length > 0) {
        message += ` ${newTasksToCreate.length} initial task(s) created.`
    }

    return { success: true, message, projectId: projectId };
  } catch (error) {
    console.error('Error creating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create project: ${errorMessage}` };
  }
}
