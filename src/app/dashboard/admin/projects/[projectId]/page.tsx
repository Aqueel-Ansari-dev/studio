
import { PageHeader } from '@/components/shared/page-header';
import { ProjectDetailsView } from '@/components/projects/project-details-view';
import { 
  getProjectSummary,
  getProjectTimesheet,
  getProjectCostBreakdown
} from '@/app/actions/projects/projectDetailsActions';
import { getInventoryByProject } from '@/app/actions/inventory-expense/getInventoryByProject';
import { getProjectExpenseReport } from '@/app/actions/inventory-expense/getProjectExpenseReport';
import { fetchAllUsersBasic } from '@/app/actions/common/fetchAllUsersBasic';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft, LibraryBig } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// Helper function to fetch all data for the page.
async function getProjectDataForPage(projectId: string) {
    const adminUserId = "STATIC_BUILD_ADMIN"; // Placeholder for static generation
    
    try {
        const [summaryResult, timesheetResult, costResult, inventoryResult, expenseReportResult, allUsersResult] = await Promise.all([
            getProjectSummary(projectId, adminUserId),
            getProjectTimesheet(projectId, adminUserId),
            getProjectCostBreakdown(projectId, adminUserId),
            getInventoryByProject(projectId, adminUserId),
            getProjectExpenseReport(projectId, adminUserId),
            fetchAllUsersBasic(),
        ]);
        
        const results = [summaryResult, timesheetResult, costResult, inventoryResult, expenseReportResult, allUsersResult];
        const firstError = results.find(r => 'error' in r || (('success' in r) && !r.success));

        if (firstError) {
            const errorMessage = (firstError as any).error || (firstError as any).message || "Failed to fetch some project data.";
            console.error("One or more data fetching actions failed for project:", projectId, { error: errorMessage });
            return { error: errorMessage };
        }

        return {
            summaryData: summaryResult as any,
            timesheetData: timesheetResult as any,
            costData: costResult as any,
            inventoryData: inventoryResult as any,
            expenseReportData: expenseReportResult as any,
            allUsers: (allUsersResult as any).users || [],
            error: null
        };
    } catch(e) {
        console.error("Critical error fetching project data:", e);
        return { error: e instanceof Error ? e.message : "Unknown critical error." };
    }
}


export default async function AdminProjectDetailsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const { summaryData, timesheetData, costData, inventoryData, expenseReportData, allUsers, error } = await getProjectDataForPage(projectId);

  const pageActions = (
    <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
            <Link href={'/dashboard/admin/project-management'}>
                 <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project List
            </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/admin/project-management">
            <LibraryBig className="mr-2 h-4 w-4" /> Manage All Projects
          </Link>
        </Button>
    </div>
  );

  if (error || !summaryData || !timesheetData || !costData || !inventoryData || !expenseReportData) {
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
        title={summaryData.project?.name || "Project Details"}
        description={`Detailed overview for project ID: ${projectId}`}
        actions={pageActions}
      />
      <ProjectDetailsView 
        summaryData={summaryData}
        timesheetData={timesheetData}
        costData={costData}
        inventoryData={inventoryData}
        expenseReportData={expenseReportData}
        allUsers={allUsers}
      />
    </div>
  );
}
