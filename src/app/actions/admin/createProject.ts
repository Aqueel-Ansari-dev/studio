
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, writeBatch, arrayUnion } from 'firebase/firestore';
import type { Project, Task, TaskStatus } from '@/types/database';
import { logAudit } from '../auditLog';
import { getOrganizationId } from '../common/getOrganizationId';
import { initializeAdminApp } from '@/lib/firebase-admin';
import admin from 'firebase-admin';

const NewSupervisorSchema = z.object({
    displayName: z.string().min(2, { message: "Supervisor name must be at least 2 characters."}),
    email: z.string().email({ message: "Invalid email for new supervisor." }),
});

const NewTaskSchema = z.object({
  name: z.string().min(3, { message: "Task name must be at least 3 characters." }),
  description: z.string().max(500).optional(),
  isImportant: z.boolean().optional().default(false),
});

const CreateProjectSchema = z.object({
  name: z.string().min(3, { message: "Project name must be at least 3 characters." }).max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  dataAiHint: z.string().max(50).optional(),
  clientInfo: z.string().max(100).optional(),
  dueDate: z.date().optional(),
  budget: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(val)),
    z.number().nonnegative().optional()
  ),
  assignedSupervisorIds: z.array(z.string()).optional(),
  newSupervisorsToCreate: z.array(NewSupervisorSchema).optional(),
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
  
  const { name, description, imageUrl, dataAiHint, clientInfo, dueDate, budget, assignedSupervisorIds, newSupervisorsToCreate, newTasksToCreate } = validationResult.data;

  try {
    const projectsCollectionRef = collection(db, 'organizations', organizationId, 'projects');
    const newProjectRef = doc(projectsCollectionRef);
    const batch = writeBatch(db);
    
    const allSupervisorIds = [...(assignedSupervisorIds || [])];
    const createdSupervisorNames: string[] = [];

    // Create new supervisors if any are provided
    if (newSupervisorsToCreate && newSupervisorsToCreate.length > 0) {
      const app = initializeAdminApp();
      const auth = admin.auth(app);
      
      for (const supervisor of newSupervisorsToCreate) {
        try {
            const userRecord = await auth.createUser({
                email: supervisor.email,
                displayName: supervisor.displayName,
                emailVerified: false,
                disabled: false,
            });
            const newUserId = userRecord.uid;
            allSupervisorIds.push(newUserId);
            createdSupervisorNames.push(supervisor.displayName);

            const orgUserDocRef = doc(db, 'organizations', organizationId, 'users', newUserId);
            const topLevelUserDocRef = doc(db, 'users', newUserId);
            
            const newUserProfile = {
                uid: newUserId,
                displayName: supervisor.displayName,
                email: supervisor.email,
                role: 'supervisor' as const,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                organizationId,
                assignedProjectIds: [],
            };

            batch.set(orgUserDocRef, newUserProfile);
            batch.set(topLevelUserDocRef, {
                organizationId,
                role: 'supervisor',
                displayName: supervisor.displayName,
                email: supervisor.email,
            });

        } catch (authError: any) {
            if (authError.code === 'auth/email-already-exists') {
                 return { success: false, message: `Cannot create supervisor: Email "${supervisor.email}" is already in use.` };
            }
            console.error('Error creating supervisor in Auth:', authError);
            throw new Error(`Failed to create supervisor account for ${supervisor.email}.`);
        }
      }
    }


    const newProjectData: Omit<Project, 'id' | 'organizationId'> & { createdAt: any, status: 'active', statusOrder: number } = {
      name,
      description: description || '',
      imageUrl: imageUrl || '',
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
            batch.update(userRef, { assignedProjectIds: arrayUnion(newProjectRef.id) });
        }
    }

    // Create initial tasks for the project
    if (newTasksToCreate && newTasksToCreate.length > 0) {
      const tasksCollectionRef = collection(db, 'organizations', organizationId, 'tasks');
      for (const task of newTasksToCreate) {
          const newTaskRef = doc(tasksCollectionRef);
          const newTaskData: Omit<Task, 'id' | 'dueDate' | 'supervisorNotes' | 'updatedAt' | 'startTime' | 'endTime' | 'elapsedTime' | 'employeeNotes' | 'submittedMediaUri' | 'aiComplianceNotes' | 'aiRisks' | 'supervisorReviewNotes' | 'reviewedBy' | 'reviewedAt'> & { createdAt: any, status: TaskStatus, createdBy: string, isImportant: boolean, assignedEmployeeId: string } = {
              projectId: newProjectRef.id,
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
      newProjectRef.id,
      'project',
      data
    );
    
    let message = `Project "${name}" created successfully!`;
    if (createdSupervisorNames.length > 0) {
        message += ` Also created and assigned new supervisor(s): ${createdSupervisorNames.join(', ')}.`;
    }
    if (newTasksToCreate && newTasksToCreate.length > 0) {
        message += ` ${newTasksToCreate.length} initial task(s) created.`
    }


    return { success: true, message, projectId: newProjectRef.id };
  } catch (error) {
    console.error('Error creating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create project: ${errorMessage}` };
  }
}
