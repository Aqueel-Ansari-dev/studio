
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import { fetchAllUsersBasic } from '@/app/actions/common/fetchAllUsersBasic';
import { fetchUserDetailsForAdminPage } from '@/app/actions/admin/fetchUserDetailsForAdminPage';
import { fetchMyAssignedProjects } from '@/app/actions/employee/fetchEmployeeData';
import { fetchTasksForUserAdminView } from '@/app/actions/admin/fetchTasksForUserAdminView';
import { getLeaveRequests } from '@/app/actions/leave/leaveActions';
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects';
import { UserDetailClientView } from '@/components/admin/user-detail-client-view';

const TASKS_PER_PAGE = 10;

export async function generateStaticParams() {
  const usersResult = await fetchAllUsersBasic();
  if (!usersResult.success || !usersResult.users) return [];
  return usersResult.users.map(user => ({
    userId: user.id,
  }));
}

async function getUserDataForPage(userId: string) {
    try {
        const [detailsResult, projectsResult, tasksResult, leaveRequestsResult, allProjectsResult] = await Promise.all([
            fetchUserDetailsForAdminPage(userId),
            fetchMyAssignedProjects(userId), 
            fetchTasksForUserAdminView(userId, TASKS_PER_PAGE), // Fetch first page
            getLeaveRequests(userId),
            fetchAllProjects()
        ]);
        
        const error = !detailsResult ? "User details not found" : (projectsResult.error || tasksResult.error || ('error' in leaveRequestsResult && leaveRequestsResult.error) || allProjectsResult.error);
        
        if (error) {
             console.error(`Error fetching data for user ${userId}:`, error);
        }

        return {
            userDetails: detailsResult,
            assignedProjects: projectsResult.success ? projectsResult.projects : [],
            initialTasks: tasksResult.success ? tasksResult.tasks : [],
            initialHasMoreTasks: tasksResult.success ? tasksResult.hasMore : false,
            initialLastTaskCursor: tasksResult.success ? tasksResult.lastVisibleTaskTimestamps : null,
            leaveRequests: !('error' in leaveRequestsResult) ? leaveRequestsResult : [],
            allProjects: allProjectsResult.success ? allProjectsResult.projects : [],
            error: error || null,
        };

    } catch(e) {
        console.error(`Critical error fetching data for user ${userId}:`, e);
        return { 
            error: e instanceof Error ? e.message : "Unknown critical error.", 
            userDetails: null, 
            assignedProjects: [], 
            initialTasks: [],
            initialHasMoreTasks: false,
            initialLastTaskCursor: null,
            leaveRequests: [],
            allProjects: [],
        };
    }
}


export default async function UserActivityDetailsPage({ params }: { params: { userId: string } }) {
  const { userId } = params;
  const { userDetails, assignedProjects, initialTasks, initialHasMoreTasks, initialLastTaskCursor, leaveRequests, allProjects, error } = await getUserDataForPage(userId);
  
  const pageActions = (
    <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
            <Link href="/dashboard/admin/user-management">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to User List
            </Link>
        </Button>
    </div>
  );

  if (error || !userDetails) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Error" description="Could not load user activity." actions={pageActions}/>
        <Card><CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-2 font-semibold text-destructive">Loading Failed</p>
            <p className="text-muted-foreground">{error || `User with ID ${userId} not found.`}</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
      <UserDetailClientView 
        userDetails={userDetails}
        assignedProjects={assignedProjects || []}
        initialTasks={initialTasks || []}
        initialHasMoreTasks={initialHasMoreTasks || false}
        initialLastTaskCursor={initialLastTaskCursor || null}
        leaveRequests={leaveRequests || []}
        allProjects={allProjects || []}
      />
  );
}
