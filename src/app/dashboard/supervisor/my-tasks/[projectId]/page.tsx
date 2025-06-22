
import { fetchAllProjects } from "@/app/actions/common/fetchAllProjects";
import { fetchMyTasksForProject, fetchProjectDetails } from '@/app/actions/employee/fetchEmployeeData';
import { SupervisorTasksView } from "@/components/supervisor/supervisor-tasks-view";

export async function generateStaticParams() {
  const projectsResult = await fetchAllProjects();
  if (!projectsResult.success || !projectsResult.projects) return [];
  return projectsResult.projects.map((project) => ({
    projectId: project.id,
  }));
}

export default async function SupervisorTasksPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  
  const projectDetailsResult = await fetchProjectDetails(projectId);
  
  return (
    <SupervisorTasksView 
      projectId={projectId} 
      initialProjectDetails={projectDetailsResult.success ? projectDetailsResult.project : null}
    />
  );
}
