
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import type { Project } from '@/types/database';

export interface ProjectForAdminList extends Project {
  id: string;
  // createdAt will now be string from Project type
}

export interface FetchProjectsForAdminResult {
  success: boolean;
  projects?: ProjectForAdminList[];
  error?: string;
}

export async function fetchProjectsForAdmin(): Promise<FetchProjectsForAdminResult> {
  // TODO: Add robust admin role verification here in a production app

  try {
    const projectsCollectionRef = collection(db, 'projects');
    const q = query(projectsCollectionRef, orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);

    const projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp
                          ? data.createdAt.toDate().toISOString()
                          : (typeof data.createdAt === 'string' ? data.createdAt : undefined);

      return {
        id: doc.id,
        name: data.name || 'Unnamed Project',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        dataAiHint: data.dataAiHint || '',
        assignedEmployeeIds: data.assignedEmployeeIds || [],
        createdAt: createdAt,
        createdBy: data.createdBy || '',
      } as ProjectForAdminList;
    });
    return { success: true, projects };
  } catch (error) {
    console.error('Error fetching projects for admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch projects: ${errorMessage}` };
  }
}
