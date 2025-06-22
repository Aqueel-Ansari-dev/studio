
import { fetchProjectDetails } from '@/app/actions/employee/fetchEmployeeData';
import { EmployeeTasksView } from "@/components/employee/employee-tasks-view";

// NOTE: This page currently cannot get the user ID on the server during static generation.
// The client-side component will use the useAuth() hook to get the user ID and then fetch its own data.
// The server-side fetching here is primarily for providing initial data if a user session could be determined.
// For static export, the client-side fetching will be the primary mechanism.
export default async function EmployeeTasksPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  
  // We can fetch project details on the server, as it's not user-specific.
  const projectDetailsResult = await fetchProjectDetails(projectId);
  
  return (
    <EmployeeTasksView 
      projectId={projectId} 
      initialProjectDetails={projectDetailsResult.success ? projectDetailsResult.project : null}
    />
  );
}
