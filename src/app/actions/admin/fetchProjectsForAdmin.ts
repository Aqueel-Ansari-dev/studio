
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import type { Project } from '@/types/database'; // Assuming Project type might not have 'id' yet.

export interface ProjectForAdminList extends Project {
  id: string;
  // Add any other admin-specific computed fields if needed later
}

export async function fetchProjectsForAdmin(): Promise<ProjectForAdminList[]> {
  // TODO: Add robust admin role verification here in a production app
  // For now, we assume this action is only callable by an admin due to page routing.

  try {
    const projectsCollectionRef = collection(db, 'projects');
    const q = query(projectsCollectionRef, orderBy('name', 'asc')); // Order by name
    const querySnapshot = await getDocs(q);

    const projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Project',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        dataAiHint: data.dataAiHint || '',
        // Ensure all fields from Project type are mapped
        assignedEmployeeIds: data.assignedEmployeeIds || [],
      } as ProjectForAdminList;
    });
    return projects;
  } catch (error) {
    console.error('Error fetching projects for admin:', error);
    return [];
  }
}
