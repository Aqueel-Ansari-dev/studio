
import { fetchProjectDetails } from '@/app/actions/employee/fetchEmployeeData';
import { SupervisorTasksView } from "@/components/supervisor/supervisor-tasks-view";
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects';

export async function generateStaticParams() {
  const result = await fetchAllProjects();
  if (!result.success || !result.projects) {
    return [];
  }
  return result.projects.map(project => ({
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
