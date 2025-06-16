
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { useAuth } from '@/context/auth-context';
import { RefreshCw, ShieldAlert, ArrowLeft, FilePlus, PackagePlus } from 'lucide-react';
import Link from 'next/link';
import {
  getProjectSummary,
  getProjectTimesheet,
  getProjectCostBreakdown,
  type ProjectSummaryData,
  type ProjectTimesheetEntry,
  type ProjectCostBreakdownData
} from '@/app/actions/projects/projectDetailsActions';
import { getInventoryByProject, type ProjectInventoryDetails } from '@/app/actions/inventory-expense/getInventoryByProject';
import { getProjectExpenseReport, type ProjectExpenseReportData } from '@/app/actions/inventory-expense/getProjectExpenseReport';
import { ProjectDetailsView } from '@/components/projects/project-details-view';
import { Card, CardContent } from '@/components/ui/card';
import type { Project } from '@/types/database'; // Import Project type

export default function SupervisorProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { user, loading: authLoading } = useAuth();

  const [summaryData, setSummaryData] = useState<ProjectSummaryData | null>(null);
  const [timesheetData, setTimesheetData] = useState<ProjectTimesheetEntry[] | null>(null);
  const [costData, setCostData] = useState<ProjectCostBreakdownData | null>(null);
  const [inventoryData, setInventoryData] = useState<ProjectInventoryDetails | null>(null);
  const [expenseReportData, setExpenseReportData] = useState<ProjectExpenseReportData | null>(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId || !user?.id) {
      if (!authLoading && !user?.id) setError("User not authenticated or not authorized for supervisor view.");
      if (!authLoading && !projectId) setError("Project ID is missing.");
      setPageLoading(false);
      return;
    }
    if (user.role !== 'supervisor' && user.role !== 'admin') {
        setError("Access denied. User is not a supervisor or admin.");
        setPageLoading(false);
        return;
    }

    setPageLoading(true);
    setError(null);
    try {
      console.log(`[SupervisorProjectDetailsPage] Fetching data for project: ${projectId}, supervisor: ${user.id}`);
      const [summaryResult, timesheetResult, costResult, inventoryResult, expenseReportResult] = await Promise.all([
        getProjectSummary(projectId, user.id),
        getProjectTimesheet(projectId, user.id),
        getProjectCostBreakdown(projectId, user.id),
        getInventoryByProject(projectId, user.id),
        getProjectExpenseReport(projectId, user.id)
      ]);

      if ('error' in summaryResult) throw new Error(`Summary: ${summaryResult.error}`);
      setSummaryData(summaryResult);

      // Access check after fetching summary data which contains the project details
      if (summaryResult.project && !(summaryResult.project as Project).assignedSupervisorIds?.includes(user.id)) {
        setError("Access Denied: You are not assigned to manage this project.");
        setSummaryData(null); // Clear data if access is denied
        setTimesheetData(null);
        setCostData(null);
        setInventoryData(null);
        setExpenseReportData(null);
        setPageLoading(false);
        return;
      }


      if ('error' in timesheetResult) throw new Error(`Timesheet: ${timesheetResult.error}`);
      setTimesheetData(timesheetResult);

      if ('error' in costResult) throw new Error(`Cost Breakdown: ${costResult.error}`);
      setCostData(costResult);

      if ('error' in inventoryResult) throw new Error(`Inventory: ${inventoryResult.error}`);
      setInventoryData(inventoryResult);

      if ('error' in expenseReportResult) throw new Error(`Expense Report: ${expenseReportResult.error}`);
      setExpenseReportData(expenseReportResult);

    } catch (err) {
      console.error("[SupervisorProjectDetailsPage] Error fetching project details:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred while fetching project data.");
    } finally {
      setPageLoading(false);
    }
  }, [projectId, user, authLoading]); // Added user to dependency array

  useEffect(() => {
    if (!authLoading) {
        fetchData();
    }
  }, [fetchData, authLoading]);

  const pageActions = (
    <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push('/dashboard/supervisor/overview')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview
        </Button>
        <Button onClick={fetchData} variant="outline" disabled={pageLoading || !user}>
            <RefreshCw className={`mr-2 h-4 w-4 ${pageLoading ? 'animate-spin' : ''}`} />
            Refresh Data
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/supervisor/assign-task">
            <FilePlus className="mr-2 h-4 w-4" /> Assign Task
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/supervisor/inventory/add-material">
            <PackagePlus className="mr-2 h-4 w-4" /> Add Material
          </Link>
        </Button>
    </div>
  );

  if (authLoading || (!user && !error)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Loading Project Details..." description="Please wait while we fetch the data." actions={pageActions} />
        <Card>
          <CardContent className="p-6 text-center">
            <RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Initializing...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Error" description="Could not load project details for supervisor." actions={pageActions} />
        <Card>
          <CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-2 font-semibold text-destructive">Loading Failed</p>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={fetchData} className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageLoading) {
     return (
      <div className="space-y-6">
        <PageHeader
            title="Loading Supervisor Project View..."
            description={`Fetching data for project ID: ${projectId}`}
            actions={pageActions}
        />
        <Card>
          <CardContent className="p-6 text-center">
            <RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Fetching project data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summaryData || !timesheetData || !costData || !inventoryData || !expenseReportData ) {
    return (
      <div className="space-y-6">
        <PageHeader
            title="Project Data Incomplete"
            description="Essential project data could not be loaded for supervisor view. Some data might be missing."
            actions={pageActions}
        />
         <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Please try refreshing the page or contact support if the issue persists.</p>
            <Button onClick={fetchData} className="mt-4">Refresh Data</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Supervisor View: ${summaryData.project?.name || "Project Details"}`}
        description={`Detailed overview for project ID: ${projectId}`}
        actions={pageActions}
      />
      <ProjectDetailsView
        summaryData={summaryData}
        timesheetData={timesheetData}
        costData={costData}
        inventoryData={inventoryData}
        expenseReportData={expenseReportData}
      />
    </div>
  );
}
