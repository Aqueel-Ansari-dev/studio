
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp, limit, startAfter, doc, getDoc } from 'firebase/firestore';
import type { Project } from '@/types/database';
import { isValid } from 'date-fns';

const PAGE_LIMIT = 10;

export interface ProjectForAdminList extends Project {
  id: string;
  dueDate?: string | null; // ISO String
  budget?: number | null;
  // createdAt will now be string from Project type
}

export interface FetchProjectsForAdminResult {
  success: boolean;
  projects?: ProjectForAdminList[];
  lastVisibleName?: string | null;
  hasMore?: boolean;
  error?: string;
}

export async function fetchProjectsForAdmin(
  limitNumber: number = PAGE_LIMIT,
  startAfterName?: string | null
): Promise<FetchProjectsForAdminResult> {
  // TODO: Add robust admin role verification here in a production app

  try {
    const projectsCollectionRef = collection(db, 'projects');
    let q = query(projectsCollectionRef, orderBy('name', 'asc'));

    if (startAfterName) {
      // For name ordering, we can directly use the string value
      q = query(q, startAfter(startAfterName));
    }
    
    q = query(q, limit(limitNumber + 1)); // Fetch one extra to check if there's more
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
              } else {
                  console.warn(`[fetchProjectsForAdmin] Project ${docSnap.id} has invalid dueDate string: ${data.dueDate}`);
              }
          } else {
              console.warn(`[fetchProjectsForAdmin] Project ${docSnap.id} has unexpected dueDate type: ${typeof data.dueDate}, value: ${data.dueDate}`);
          }
      }
      
      let finalBudget: number | null = null;
      if (typeof data.budget === 'number' && !isNaN(data.budget)) {
          finalBudget = data.budget;
      } else if (data.budget !== null && data.budget !== undefined) {
          console.warn(`[fetchProjectsForAdmin] Project ${docSnap.id} has non-numeric budget: ${data.budget}`);
      }

      return {
        id: docSnap.id,
        name: data.name || 'Unnamed Project',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        dataAiHint: data.dataAiHint || '',
        assignedEmployeeIds: data.assignedEmployeeIds || [],
        createdAt: createdAt,
        createdBy: data.createdBy || '',
        dueDate: finalDueDate,
        budget: finalBudget,
        materialCost: typeof data.materialCost === 'number' ? data.materialCost : 0,
      } as ProjectForAdminList;
    });

    const hasMore = fetchedProjects.length > limitNumber;
    const projectsToReturn = hasMore ? fetchedProjects.slice(0, limitNumber) : fetchedProjects;
    
    let lastVisibleNameToReturn: string | null = null;
    if (projectsToReturn.length > 0) {
        const lastDocData = projectsToReturn[projectsToReturn.length - 1];
        if (lastDocData) {
            lastVisibleNameToReturn = lastDocData.name;
        }
    }


    return { success: true, projects: projectsToReturn, lastVisibleName: lastVisibleNameToReturn, hasMore };
  } catch (error) {
    console.error('Error fetching projects for admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch projects: ${errorMessage}` };
  }
}
