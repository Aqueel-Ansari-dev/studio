
'use server';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

export interface ProjectForSelection {
  id: string;
  name: string;
}

export async function fetchAllProjects(): Promise<ProjectForSelection[]> {
  try {
    const projectsCollectionRef = collection(db, 'projects');
    const q = query(projectsCollectionRef, orderBy('name', 'asc')); // Optional: order by name
    const querySnapshot = await getDocs(q);
    const projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Project',
      };
    });
    return projects;
  } catch (error) {
    console.error('Error fetching all projects:', error);
    return [];
  }
}
