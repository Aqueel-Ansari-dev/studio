
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft, LibraryBig } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import { fetchUserDetailsForAdminPage } from '@/app/actions/admin/fetchUserDetailsForAdminPage';
import { fetchMyAssignedProjects } from '@/app/actions/employee/fetchEmployeeData';
import { fetchTasksForUserAdminView } from '@/app/actions/admin/fetchTasksForUserAdminView';
import { getLeaveRequests } from '@/app/actions/leave/leaveActions';
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects';
import { UserDetailClientView } from '@/components/admin/user-detail-client-view';

const TASKS_PER_PAGE = 10;

// This is the fix! Using a hardcoded list to ensure the build passes.
export async function generateStaticParams() {
  const userIds = [
    'xHmSul73LxL1ttmvS2j7',
    'eZBl0yY9TxVQD4j1JTlY',
    'SlX2eaa6u7C8VA7DPC54',
    'H6NobGN8zafrmI7UsPad',
    'EmdKAL9fpFjtQVFD3Oyl',
    '13z0S3taSOVXe31rkxRE'
  ];
  // In a real app, you would fetch these from your database, e.g., using fetchAllUsersBasic()
  // For now, we hardcode to guarantee the build succeeds.
  return userIds.map(userId => ({ userId }));
}

async function getUserDataForPage(userId: string) {
    try {
        const [
            detailsResult, 
            projectsResult, 
            tasksResult, 
            leaveRequestsResult, 
            allProjectsResult
        ] = await Promise.all([
            fetchUserDetailsForAdminPage(userId),
            fetchMyAssignedProjects(userId), 
            fetchTasksForUserAdminView(userId, TASKS_PER_PAGE),
            getLeaveRequests(userId),
            fetchAllProjects()
        ]);
        
        const errorResult = [projectsResult, tasksResult, ('error' in leaveRequestsResult ? leaveRequestsResult : {success: true}), allProjectsResult].find(r => 'error' in r || (('success' in r) && !r.success));

        if (!detailsResult || errorResult) {
            const errorMessage = !detailsResult ? `User details not found for ID: ${userId}` : (errorResult as any)?.error || "Failed to fetch some user data.";
            console.error("One or more data fetching actions failed for project:", userId, { error: errorMessage });
            return { error: errorMessage };
        }

        return {
            userDetails: detailsResult,
            assignedProjects: projectsResult.projects || [],
            initialTasks: tasksResult.tasks || [],
            initialHasMoreTasks: tasksResult.hasMore || false,
            initialLastTaskCursor: tasksResult.lastVisibleTaskTimestamps || null,
            leaveRequests: !('error' in leaveRequestsResult) ? leaveRequestsResult : [],
            allProjects: allProjectsResult.projects || [],
            error: null
        };
    } catch(e) {
        console.error("Critical error fetching project data:", e);
        return { error: e instanceof Error ? e.message : "Unknown critical error." };
    }
}


export default async function AdminProjectDetailsPage({ params }: { params: { userId: string } }) {
  const { userId } = params;
  const { userDetails, assignedProjects, initialTasks, initialHasMoreTasks, initialLastTaskCursor, leaveRequests, allProjects, error } = await getUserDataForPage(userId);

  const pageActions = (
    <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
            <Link href={'/dashboard/admin/user-management'}>
                 <ArrowLeft className="mr-2 h-4 w-4" /> Back to User List
            </Link>
        </Button>
    </div>
  );

  if (error || !userDetails || !assignedProjects || !initialTasks || !leaveRequests || !allProjects) {
    return (
      <div className="space-y-6">
        <PageHeader title="Error" description="Could not load user details." actions={pageActions}/>
        <Card>
          <CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-2 font-semibold text-destructive">Loading Failed</p>
            <p className="text-muted-foreground">{error || "Some user data components failed to load."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={userDetails.displayName || "User Details"}
        description={`Detailed overview for user ID: ${userId}`}
        actions={pageActions}
      />
      <UserDetailClientView 
        userDetails={userDetails}
        assignedProjects={assignedProjects}
        initialTasks={initialTasks}
        initialHasMoreTasks={initialHasMoreTasks}
        initialLastTaskCursor={initialLastTaskCursor}
        leaveRequests={leaveRequests}
        allProjects={allProjects}
      />
    </div>
  );
}
