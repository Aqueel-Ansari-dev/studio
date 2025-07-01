
'use server';

import { db } from '@/lib/firebase';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { logAudit } from '../auditLog';

export interface DeleteProjectResult {
  success: boolean;
  message: string;
}

export async function deleteProjectByAdmin(adminUserId: string, projectId: string): Promise<DeleteProjectResult> {
  if (!adminUserId) {
    return { success: false, message: 'Admin user ID not provided. Authentication issue.' };
  }
  // In a real app, verify adminUserId corresponds to an actual admin user from 'users' collection.
  const adminUserDoc = await getDoc(doc(db, 'users', adminUserId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
      return { success: false, message: 'Action not authorized. Requester is not an admin.' };
  }

  if (!projectId) {
    return { success: false, message: 'Project ID not provided.' };
  }

  try {
    const projectDocRef = doc(db, 'projects', projectId);
    const projectDocSnap = await getDoc(projectDocRef);

    if (!projectDocSnap.exists()) {
      return { success: false, message: 'Project to delete not found.' };
    }
    const projectName = projectDocSnap.data()?.name || 'Unnamed Project';
    
    // IMPORTANT: This deletes the project document. 
    // It does NOT automatically delete related tasks, inventory, or expenses.
    // A more robust solution would use Cloud Functions to handle cascading deletes.
    await deleteDoc(projectDocRef);
    
    // Audit Log
    await logAudit(
      adminUserId,
      'project_delete',
      `Deleted project: "${projectName}"`,
      projectId,
      'project'
    );

    return { success: true, message: 'Project deleted successfully. Associated data (tasks, inventory, expenses) are not automatically removed.' };
  } catch (error) {
    console.error('Error deleting project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to delete project: ${errorMessage}` };
  }
}
