
import { PageHeader } from '@/components/shared/page-header';
import { ProjectDetailsView } from '@/components/projects/project-details-view';
import { 
  getProjectSummary,
  getProjectTimesheet,
  getProjectCostBreakdown
} from '@/app/actions/projects/projectDetailsActions';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft, FilePlus } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getProjectDataForPage(projectId: string) {
    const supervisorUserId = "STATIC_BUILD_SUPERVISOR"; // Placeholder for static generation
    
    try {
        const [summaryResult, timesheetResult, costResult] = await Promise.all([
            getProjectSummary(projectId, supervisorUserId),
            getProjectTimesheet(projectId, supervisorUserId),
            getProjectCostBreakdown(projectId, supervisorUserId), 
        ]);

        const hasError = [summaryResult, timesheetResult, costResult].some(r => 'error' in r);
        if (hasError) {
            console.error("One or more data fetching actions failed for project:", projectId);
            return { error: "Failed to fetch some project data." };
        }

        return {
            summaryData: summaryResult as any,
            timesheetData: timesheetResult as any,
            costData: costResult as any,
            error: null
        };
    } catch(e) {
        console.error("Critical error fetching project data:", e);
        return { error: e instanceof Error ? e.message : "Unknown critical error." };
    }
}

export default async function SupervisorProjectDetailsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const { summaryData, timesheetData, costData, error } = await getProjectDataForPage(projectId);

  const pageActions = (
    <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
            <Link href={'/dashboard/supervisor/overview'}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview
            </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/supervisor/assign-task">
            <FilePlus className="mr-2 h-4 w-4" /> Assign Task
          </Link>
        </Button>
    </div>
  );

  if (error || !summaryData || !timesheetData || !costData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Error" description="Could not load project details." actions={pageActions}/>
        <Card>
          <CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-2 font-semibold text-destructive">Loading Failed</p>
            <p className="text-muted-foreground">{error || "Some project data components failed to load."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${summaryData.project?.name || "Project Details"}`}
        description={`Detailed overview for project ID: ${projectId}`}
        actions={pageActions}
      />
      <ProjectDetailsView
        summaryData={summaryData}
        timesheetData={timesheetData}
        costData={costData}
      />
    </div>
  );
}
