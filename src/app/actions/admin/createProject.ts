
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Project } from '@/types/database';

const CreateProjectSchema = z.object({
  name: z.string().min(3, { message: 'Project name must be at least 3 characters.' }).max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  dataAiHint: z.string().max(50).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export interface CreateProjectResult {
  success: boolean;
  message: string;
  projectId?: string;
  errors?: z.ZodIssue[];
}

export async function createProject(adminUserId: string, input: CreateProjectInput): Promise<CreateProjectResult> {
  if (!adminUserId) {
    return { success: false, message: 'Admin user ID not provided. Authentication issue.' };
  }
  // In a real app, verify adminUserId corresponds to an actual admin user.

  const validationResult = CreateProjectSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }

  const { name, description, imageUrl, dataAiHint } = validationResult.data;

  try {
    const newProjectData: Omit<Project, 'id'> & { createdAt: any, createdBy: string } = {
      name,
      description: description || '',
      imageUrl: imageUrl || '',
      dataAiHint: dataAiHint || '',
      assignedEmployeeIds: [], // Initially no employees assigned
      createdAt: serverTimestamp(),
      createdBy: adminUserId, // Track who created the project
    };

    const docRef = await addDoc(collection(db, 'projects'), newProjectData);
    return { success: true, message: 'Project created successfully!', projectId: docRef.id };
  } catch (error) {
    console.error('Error creating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create project: ${errorMessage}` };
  }
}
