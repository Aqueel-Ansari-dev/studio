

'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import type { Project, ProjectStatus } from '@/types/database';

// Schema for updating a project
// All fields are optional for updates.
const UpdateProjectSchema = z.object({
  name: z.string().min(3, { message: 'Project name must be at least 3 characters.' }).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  imageUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')).nullable(),
  dataAiHint: z.string().max(50).optional().nullable(),
  dueDate: z.date().optional().nullable(),
  budget: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)),
    z.number().nonnegative({ message: 'Budget must be a non-negative number.' }).optional().nullable()
  ),
  assignedSupervisorIds: z.array(z.string().min(1, {message: "Supervisor ID cannot be empty"})).optional().nullable(),
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
  if (!adminUserId) {
    return { success: false, message: 'Admin user ID not provided. Authentication issue.' };
  }
  const adminUserDoc = await getDoc(doc(db, 'users', adminUserId));
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

  const { name, description, imageUrl, dataAiHint, dueDate, budget, assignedSupervisorIds, status } = validationResult.data;

  try {
    const projectDocRef = doc(db, 'projects', projectId);
    const projectDocSnap = await getDoc(projectDocRef);

    if (!projectDocSnap.exists()) {
      return { success: false, message: 'Project to update not found.' };
    }

    const updates: Partial<Project> & { updatedAt?: any } = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description ?? '';
    if (imageUrl !== undefined) updates.imageUrl = imageUrl ?? '';
    if (dataAiHint !== undefined) updates.dataAiHint = dataAiHint ?? '';
    if (dueDate !== undefined) updates.dueDate = dueDate ? dueDate.toISOString() : null;
    if (budget !== undefined) updates.budget = budget ?? null;
    if (assignedSupervisorIds !== undefined) updates.assignedSupervisorIds = assignedSupervisorIds ?? [];
    if (status !== undefined) updates.status = status;
    
    // Only add updatedAt if there are actual changes
    if (Object.keys(updates).length > 0) {
        updates.updatedAt = serverTimestamp(); 
    } else {
        return { success: true, message: 'No changes detected to update.' };
    }


    await updateDoc(projectDocRef, updates);
    return { success: true, message: 'Project updated successfully!' };
  } catch (error) {
    console.error('Error updating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update project: ${errorMessage}` };
  }
}
