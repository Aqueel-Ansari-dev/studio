
'use server';

import { z } from 'zod';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, getDoc, serverTimestamp, writeBatch, arrayUnion, arrayRemove, collection, query, where, getCountFromServer } from 'firebase/firestore';
import type { Project, ProjectStatus } from '@/types/database';
import { logAudit } from '../auditLog';
import { getOrganizationId } from '../common/getOrganizationId';

const UpdateProjectSchema = z.object({
  name: z.string().min(3, { message: 'Project name must be at least 3 characters.' }).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  imageDataUri: z.string().optional(), // Now expects an optional data URI
  dataAiHint: z.string().max(50).optional().nullable(),
  clientInfo: z.string().max(100).optional().nullable(), 
  dueDate: z.date().optional().nullable(),
  budget: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(val)),
    z.number().nonnegative({ message: 'Budget must be a non-negative number.' }).optional().nullable()
  ),
  assignedSupervisorIds: z.array(z.string().min(1, {message: "Supervisor ID cannot be empty"})).optional(),
  status: z.enum(['active', 'completed', 'paused', 'inactive'] as [ProjectStatus, ...ProjectStatus[]]).optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export interface UpdateProjectResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
}

export async function updateProjectByAdmin(
  adminUserId: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<UpdateProjectResult> {
  const organizationId = await getOrganizationId(adminUserId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for the current admin.' };
  }

  const adminUserDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', adminUserId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
    return { success: false, message: 'Action not authorized. Requester is not an admin.' };
  }

  if (!projectId) {
    return { success: false, message: 'Project ID not provided.' };
  }

  const validationResult = UpdateProjectSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }
  
  try {
    const projectDocRef = doc(db, 'organizations', organizationId, 'projects', projectId);
    const projectDocSnap = await getDoc(projectDocRef);

    if (!projectDocSnap.exists()) {
      return { success: false, message: 'Project to update not found.' };
    }
    
    if (input.status && (input.status === 'inactive' || input.status === 'completed')) {
        const tasksRef = collection(db, 'organizations', organizationId, 'tasks');
        const q = query(tasksRef, where('projectId', '==', projectId), where('status', 'in', ['pending', 'in-progress', 'paused', 'needs-review']));
        const openTasksSnap = await getCountFromServer(q);
        
        if (openTasksSnap.data().count > 0) {
            return { success: false, message: `Cannot ${input.status === 'inactive' ? 'archive' : 'complete'} project. There are still ${openTasksSnap.data().count} open task(s).` };
        }
    }

    const updates: Partial<Project> & { updatedAt?: any } = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description ?? '';
    if (input.dataAiHint !== undefined) updates.dataAiHint = input.dataAiHint ?? '';
    if (input.clientInfo !== undefined) updates.clientInfo = input.clientInfo ?? '';
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate ? input.dueDate.toISOString() : null;
    if (input.budget !== undefined) updates.budget = input.budget ?? null;
    if (input.status !== undefined) updates.status = input.status;
    if (input.imageDataUri) {
        updates.imageUrl = input.imageDataUri; // Store the data URI directly
    }

    const batch = writeBatch(db);

    if (input.assignedSupervisorIds !== undefined) {
      const oldSupervisorIds = projectDocSnap.data()?.assignedSupervisorIds || [];
      const newSupervisorIds = input.assignedSupervisorIds || [];
      
      const supervisorsToAdd = newSupervisorIds.filter(id => !oldSupervisorIds.includes(id));
      const supervisorsToRemove = oldSupervisorIds.filter((id: string) => !newSupervisorIds.includes(id));

      for (const supervisorId of supervisorsToAdd) {
          const userRef = doc(db, 'organizations', organizationId, 'users', supervisorId);
          batch.update(userRef, { assignedProjectIds: arrayUnion(projectId) });
      }
      
      for (const supervisorId of supervisorsToRemove) {
          const userRef = doc(db, 'organizations', organizationId, 'users', supervisorId);
          batch.update(userRef, { assignedProjectIds: arrayRemove(projectId) });
      }
      
      updates.assignedSupervisorIds = newSupervisorIds;
    }
    
    if (Object.keys(updates).length > 0) {
        updates.updatedAt = serverTimestamp(); 
        batch.update(projectDocRef, updates);
    } else {
        return { success: true, message: 'No changes detected to update.' };
    }


    await batch.commit();

    await logAudit(
      adminUserId,
      organizationId,
      'project_update',
      `Updated project: "${projectDocSnap.data()?.name}"`,
      projectId,
      'project',
      { ...input, imageDataUri: undefined } // Exclude image from log
    );

    return { success: true, message: 'Project updated successfully!' };
  } catch (error) {
    console.error('Error updating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update project: ${errorMessage}` };
  }
}
