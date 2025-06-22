
import { fetchAllProjects } from "@/app/actions/common/fetchAllProjects";
import { fetchMyTasksForProject, fetchProjectDetails } from '@/app/actions/employee/fetchEmployeeData';
import { EmployeeTasksView } from "@/components/employee/employee-tasks-view";

export async function generateStaticParams() {
  const projectsResult = await fetchAllProjects();
  if (!projectsResult.success || !projectsResult.projects) return [];
  return projectsResult.projects.map((project) => ({
    projectId: project.id,
  }));
}

async function getTasksPageData(projectId: string, userId: string) {
    if (!projectId || !userId) {
        return { projectDetails: null, tasks: [], error: "Project or User ID missing."};
    }
    
    try {
        const [projectDetailsResult, tasksResult] = await Promise.all([
            fetchProjectDetails(projectId),
            fetchMyTasksForProject(userId, projectId)
        ]);

        const error = projectDetailsResult.error || tasksResult.error;
        if (error) {
            console.error(`Error fetching data for tasks page (project: ${projectId}, user: ${userId}):`, error);
        }
        
        return {
            projectDetails: projectDetailsResult.success ? projectDetailsResult.project : null,
            tasks: tasksResult.success ? tasksResult.tasks : [],
            error: error || null,
        }
    } catch(e) {
        console.error(`Critical error fetching tasks page data for project ${projectId}:`, e);
        return { error: e instanceof Error ? e.message : "Unknown critical error.", projectDetails: null, tasks: [] };
    }
}

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
