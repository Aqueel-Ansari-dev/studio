
'use server';

import { db } from '@/lib/firebase';
import { collection, writeBatch, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import type { UserRole } from '@/types/database';

export interface ResetProjectDataResult {
  success: boolean;
  message: string;
  deletedProjects?: number;
  deletedTasks?: number;
  deletedInventory?: number;
  deletedExpenses?: number;
  error?: string;
}

// Helper to verify user is an admin.
async function verifyAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return false;
  const userRole = userDocSnap.data()?.role as UserRole;
  return userRole === 'admin';
}


export async function deleteAllProjectsAndData(adminUserId: string): Promise<ResetProjectDataResult> {
  if (!adminUserId) {
    return { success: false, message: 'Admin user ID not provided.' };
  }

  const isAuthorized = await verifyAdmin(adminUserId);
  if (!isAuthorized) {
    return { success: false, message: 'Unauthorized: Only admins can perform this action.' };
  }

  let deletedProjects = 0;
  let deletedTasks = 0;
  let deletedInventory = 0;
  let deletedExpenses = 0;

  try {
    const projectsRef = collection(db, 'projects');
    const projectsSnapshot = await getDocs(query(projectsRef));
    
    if (projectsSnapshot.empty) {
      return { success: true, message: 'No projects found to delete.', deletedProjects: 0, deletedTasks: 0, deletedInventory: 0, deletedExpenses: 0 };
    }

    const projectIds = projectsSnapshot.docs.map(doc => doc.id);
    

    // Firestore 'in' query has a limit of 30 items. If more projects, we need to batch the queries.
    for (let i = 0; i < projectIds.length; i += 30) {
        const batch = writeBatch(db);
        const chunkProjectIds = projectIds.slice(i, i + 30);
        
        // Delete tasks associated with the projects in this chunk
        const tasksQuery = query(collection(db, 'tasks'), where('projectId', 'in', chunkProjectIds));
        const tasksSnapshot = await getDocs(tasksQuery);
        tasksSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            deletedTasks++;
        });

        // Delete inventory associated with the projects in this chunk
        const inventoryQuery = query(collection(db, 'projectInventory'), where('projectId', 'in', chunkProjectIds));
        const inventorySnapshot = await getDocs(inventoryQuery);
        inventorySnapshot.forEach(doc => {
            batch.delete(doc.ref);
            deletedInventory++;
        });

        // Delete expenses associated with the projects in this chunk
        const expensesQuery = query(collection(db, 'employeeExpenses'), where('projectId', 'in', chunkProjectIds));
        const expensesSnapshot = await getDocs(expensesQuery);
        expensesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            deletedExpenses++;
        });

        await batch.commit();
    }
    
    // Delete the project documents themselves in batches
     for (let i = 0; i < projectsSnapshot.docs.length; i += 500) { // Firestore batch limit is 500 writes
        const projectBatch = writeBatch(db);
        const chunkDocs = projectsSnapshot.docs.slice(i, i + 500);
        chunkDocs.forEach(doc => {
            projectBatch.delete(doc.ref);
            deletedProjects++;
        });
        await projectBatch.commit();
    }


    return {
      success: true,
      message: `Successfully deleted all projects and associated data.`,
      deletedProjects,
      deletedTasks,
      deletedInventory,
      deletedExpenses,
    };
  } catch (error) {
    console.error("Error deleting all project data:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to delete all project data: ${errorMessage}`, error: errorMessage };
  }
}
