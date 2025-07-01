
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { isValid } from 'date-fns';
import type { ProjectForAdminList } from './fetchProjectsForAdmin';

export interface FetchProjectsForBoardResult {
  success: boolean;
  projects?: ProjectForAdminList[];
  error?: string;
}

export async function fetchAllProjectsForBoard(): Promise<FetchProjectsForBoardResult> {
  // TODO: Add robust admin role verification here in a production app
  try {
    const projectsCollectionRef = collection(db, 'projects');
    const q = query(projectsCollectionRef, orderBy('statusOrder', 'asc'), orderBy('name', 'asc'));
    
    const querySnapshot = await getDocs(q);

    const fetchedProjects = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp
                          ? data.createdAt.toDate().toISOString()
                          : (typeof data.createdAt === 'string' ? data.createdAt : undefined);

      let finalDueDate: string | null = null;
      if (data.dueDate) {
          if (data.dueDate instanceof Timestamp) {
              finalDueDate = data.dueDate.toDate().toISOString();
          } else if (typeof data.dueDate === 'string') {
              const parsedDate = new Date(data.dueDate);
              if (isValid(parsedDate)) {
                  finalDueDate = parsedDate.toISOString();
              }
          }
      }
      
      let finalBudget: number | null = null;
      if (typeof data.budget === 'number' && !isNaN(data.budget)) {
          finalBudget = data.budget;
      }

      return {
        id: docSnap.id,
        name: data.name || 'Unnamed Project',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        dataAiHint: data.dataAiHint || '',
        assignedEmployeeIds: data.assignedEmployeeIds || [],
        assignedSupervisorIds: data.assignedSupervisorIds || [],
        status: data.status || 'active',
        statusOrder: typeof data.statusOrder === 'number' ? data.statusOrder : 0,
        createdAt: createdAt,
        createdBy: data.createdBy || '',
        dueDate: finalDueDate,
        budget: finalBudget,
        materialCost: typeof data.materialCost === 'number' ? data.materialCost : 0,
      } as ProjectForAdminList;
    });
    
    return { success: true, projects: fetchedProjects };
  } catch (error) {
    console.error('Error fetching all projects for board:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch projects for board: ${errorMessage}` };
  }
}
