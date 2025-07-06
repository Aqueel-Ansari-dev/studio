
'use server';
import { db } from '@/lib/firebase';
import { doc, getDoc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { UserRole } from '@/types/database';

export interface AssignProjectsResult {
  success: boolean;
  message: string;
}

async function verifyAdmin(userId: string): Promise<boolean> {
    if (!userId) return false;
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    return userDocSnap.exists() && userDocSnap.data()?.role === 'admin';
}

export async function assignProjectsToSupervisor(
    adminId: string,
    supervisorId: string,
    newProjectIds: string[]
): Promise<AssignProjectsResult> {
    if (!await verifyAdmin(adminId)) {
        return { success: false, message: 'Unauthorized action.' };
    }

    const supervisorRef = doc(db, 'users', supervisorId);

    try {
        const supervisorSnap = await getDoc(supervisorRef);
        if (!supervisorSnap.exists() || supervisorSnap.data()?.role !== 'supervisor') {
            return { success: false, message: 'Target user is not a supervisor.' };
        }

        const currentProjectIds = supervisorSnap.data()?.assignedProjectIds || [];

        const projectsToAdd = newProjectIds.filter(id => !currentProjectIds.includes(id));
        const projectsToRemove = currentProjectIds.filter((id: string) => !newProjectIds.includes(id));

        const batch = writeBatch(db);

        // Update the user document with the new complete list
        batch.update(supervisorRef, { assignedProjectIds: newProjectIds });

        // Add supervisor to new projects
        for (const projectId of projectsToAdd) {
            const projectRef = doc(db, 'projects', projectId);
            batch.update(projectRef, { assignedSupervisorIds: arrayUnion(supervisorId) });
        }

        // Remove supervisor from old projects
        for (const projectId of projectsToRemove) {
            const projectRef = doc(db, 'projects', projectId);
            batch.update(projectRef, { assignedSupervisorIds: arrayRemove(supervisorId) });
        }

        await batch.commit();

        return { success: true, message: 'Supervisor project assignments updated successfully.' };

    } catch (error) {
        console.error('Error assigning projects to supervisor:', error);
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, message: `Failed to update assignments: ${msg}` };
    }
}
