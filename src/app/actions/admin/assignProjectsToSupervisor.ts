
'use server';
import { db } from '@/lib/firebase';
import { doc, getDoc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { UserRole } from '@/types/database';
import { getOrganizationId } from '../common/getOrganizationId';

export interface AssignProjectsResult {
  success: boolean;
  message: string;
}

async function verifyAdmin(adminId: string, organizationId: string): Promise<boolean> {
    if (!adminId || !organizationId) return false;
    const userDocRef = doc(db, 'organizations', organizationId, 'users', adminId);
    const userDocSnap = await getDoc(userDocRef);
    return userDocSnap.exists() && userDocSnap.data()?.role === 'admin';
}

export async function assignProjectsToSupervisor(
    adminId: string,
    targetUserId: string,
    newProjectIds: string[]
): Promise<AssignProjectsResult> {
    const organizationId = await getOrganizationId(adminId);
    if (!organizationId) {
        return { success: false, message: 'Could not determine organization for the current admin.' };
    }
    
    if (!await verifyAdmin(adminId, organizationId)) {
        return { success: false, message: 'Unauthorized action.' };
    }

    const targetUserRef = doc(db, 'organizations', organizationId, 'users', targetUserId);

    try {
        const targetUserSnap = await getDoc(targetUserRef);
        if (!targetUserSnap.exists()) {
            return { success: false, message: 'Target user not found.' };
        }
        
        const userRole = targetUserSnap.data()?.role as UserRole;
        if (userRole !== 'supervisor' && userRole !== 'admin') {
            return { success: false, message: 'Can only assign projects to supervisors or admins.' };
        }

        const currentProjectIds = targetUserSnap.data()?.assignedProjectIds || [];

        const projectsToAdd = newProjectIds.filter(id => !currentProjectIds.includes(id));
        const projectsToRemove = currentProjectIds.filter((id: string) => !newProjectIds.includes(id));

        const batch = writeBatch(db);

        // Update the user document with the new complete list
        batch.update(targetUserRef, { assignedProjectIds: newProjectIds });

        // Add user to new projects
        for (const projectId of projectsToAdd) {
            const projectRef = doc(db, 'organizations', organizationId, 'projects', projectId);
            // We still add them to the 'assignedSupervisorIds' field for consistency,
            // as this field is used to grant project oversight.
            batch.update(projectRef, { assignedSupervisorIds: arrayUnion(targetUserId) });
        }

        // Remove user from old projects
        for (const projectId of projectsToRemove) {
            const projectRef = doc(db, 'organizations', organizationId, 'projects', projectId);
            batch.update(projectRef, { assignedSupervisorIds: arrayRemove(targetUserId) });
        }

        await batch.commit();

        return { success: true, message: 'User project assignments updated successfully.' };

    } catch (error) {
        console.error('Error assigning projects to user:', error);
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, message: `Failed to update assignments: ${msg}` };
    }
}
