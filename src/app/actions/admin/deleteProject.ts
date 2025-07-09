
'use server';

import { db } from '@/lib/firebase';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { logAudit } from '../auditLog';
import { getOrganizationId } from '../common/getOrganizationId';

export interface DeleteProjectResult {
  success: boolean;
  message: string;
}

export async function deleteProjectByAdmin(adminUserId: string, projectId: string): Promise<DeleteProjectResult> {
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

  try {
    const projectDocRef = doc(db, 'organizations', organizationId, 'projects', projectId);
    const projectDocSnap = await getDoc(projectDocRef);

    if (!projectDocSnap.exists()) {
      return { success: false, message: 'Project to delete not found.' };
    }
    const projectName = projectDocSnap.data()?.name || 'Unnamed Project';
    
    await deleteDoc(projectDocRef);
    
    await logAudit(
      adminUserId,
      organizationId,
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
