

import { EmployeeTasksView } from "@/components/employee/employee-tasks-view";
import { fetchProjectDetails } from '@/app/actions/employee/fetchEmployeeData';
import { headers } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { initializeAdminApp } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

async function getUserId() {
    try {
        const idToken = headers().get('Authorization')?.split('Bearer ')[1];
        if (!idToken) return null;
        const decodedToken = await getAuth(initializeAdminApp()).verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        // This can happen if the token is invalid or expired, or if called during build
        console.warn("Could not verify auth token on server for tasks page:", error);
        return null;
    }
}

export default async function EmployeeTasksPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  
  const userId = await getUserId();
  let initialProjectDetails = null;
  if(userId) {
     const projectDetailsResult = await fetchProjectDetails(userId, projectId);
     if(projectDetailsResult.success) {
       initialProjectDetails = projectDetailsResult.project;
     }
  }
  
  return (
    <EmployeeTasksView 
      projectId={projectId} 
      initialProjectDetails={initialProjectDetails}
    />
  );
}
