
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, writeBatch, arrayUnion } from 'firebase/firestore';
import type { Project } from '@/types/database';
import { logAudit } from '../auditLog';
import { getOrganizationId } from '../common/getOrganizationId';

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
  
  const { name, description, imageUrl, dataAiHint, clientInfo, dueDate, budget, assignedSupervisorIds } = validationResult.data;

  try {
    const projectsCollectionRef = collection(db, 'organizations', organizationId, 'projects');
    const newProjectRef = doc(projectsCollectionRef); // Create ref to get ID before commit
    const batch = writeBatch(db);

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
      assignedSupervisorIds: assignedSupervisorIds || [],
    };

    batch.set(newProjectRef, newProjectData);

    // If supervisors are assigned, update their user documents
    if (assignedSupervisorIds && assignedSupervisorIds.length > 0) {
        for (const supervisorId of assignedSupervisorIds) {
            const userRef = doc(db, 'organizations', organizationId, 'users', supervisorId);
            batch.update(userRef, { assignedProjectIds: arrayUnion(newProjectRef.id) });
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

    return { success: true, message: 'Project created successfully!', projectId: newProjectRef.id };
  } catch (error) {
    console.error('Error creating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create project: ${errorMessage}` };
  }
}
