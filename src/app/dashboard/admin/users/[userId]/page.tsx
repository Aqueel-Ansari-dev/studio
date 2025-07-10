
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';

import { fetchUserDetailsForAdminPage } from '@/app/actions/admin/fetchUserDetailsForAdminPage';
import { fetchMyAssignedProjects } from '@/app/actions/employee/fetchEmployeeData';
import { fetchTasksForUserAdminView } from '@/app/actions/admin/fetchTasksForUserAdminView';
import { getLeaveRequests } from '@/app/actions/leave/leaveActions';
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects';
import { UserDetailClientView } from '@/components/admin/user-detail-client-view';
import { initializeAdminApp } from '@/lib/firebase-admin';

const TASKS_PER_PAGE = 10;

export const dynamic = 'force-dynamic';

async function getUserId() {
    try {
        const idToken = headers().get('Authorization')?.split('Bearer ')[1];
        if (!idToken) return null;
        const decodedToken = await getAuth(initializeAdminApp()).verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error("Error verifying auth token:", error);
        return null;
    }
}

async function getUserDataForPage(adminId: string, targetUserId: string) {
    try {
        const [
            detailsResult, 
            projectsResult, 
            tasksResult, 
            leaveRequestsResult, 
            allProjectsResult
        ] = await Promise.all([
            fetchUserDetailsForAdminPage(adminId, targetUserId),
            fetchMyAssignedProjects(targetUserId, adminId), // Pass orgId
            fetchTasksForUserAdminView(adminId, targetUserId, TASKS_PER_PAGE),
            getLeaveRequests(targetUserId),
            fetchAllProjects(adminId)
        ]);
        
        const errorResult = [projectsResult, tasksResult, ('error' in leaveRequestsResult ? leaveRequestsResult : {success: true}), allProjectsResult].find(r => 'error' in r || (('success' in r) && !r.success));

        if (!detailsResult || errorResult) {
            const errorMessage = !detailsResult ? `User details not found for ID: ${targetUserId}` : (errorResult as any)?.error || "Failed to fetch some user data.";
            console.error("One or more data fetching actions failed for user page:", targetUserId, { error: errorMessage });
            return { error: errorMessage, userDetails: null, assignedProjects: [], initialTasks: [], initialHasMoreTasks: false, initialLastTaskCursor: null, leaveRequests: [], allProjects: [] };
        }

        return {
            userDetails: detailsResult,
            assignedProjects: projectsResult.projects || [],
            initialTasks: tasksResult.tasks || [],
            initialHasMoreTasks: tasksResult.hasMore || false,
            initialLastTaskCursor: tasksResult.lastVisibleTaskTimestamps || null,
            leaveRequests: !('error' in leaveRequestsResult) ? leaveRequestsResult : [],
            allProjects: allProjectsResult.projects || [],
            error: null,
        };

    } catch(e) {
        console.error(`Critical error fetching data for user page ${targetUserId}:`, e);
        return { error: e instanceof Error ? e.message : "Unknown critical error.", userDetails: null, assignedProjects: [], initialTasks: [], initialHasMoreTasks: false, initialLastTaskCursor: null, leaveRequests: [], allProjects: [] };
    }
}


export default async function UserActivityDetailsPage({ params }: { params: { userId: string } }) {
  const { userId: targetUserId } = params;
  const adminId = await getUserId();
  
  const pageActions = (
    <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
            <Link href="/dashboard/admin/user-management">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to User List
            </Link>
        </Button>
    </div>
  );

   if (!adminId) {
     return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Authentication Error" description="Could not verify administrator." actions={pageActions}/>
        <Card>
          <CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-2 font-semibold text-destructive">Not Authenticated</p>
            <p className="text-muted-foreground">Please log in as an admin to view user details.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { userDetails, assignedProjects, initialTasks, initialHasMoreTasks, initialLastTaskCursor, leaveRequests, allProjects, error } = await getUserDataForPage(adminId, targetUserId);

  if (error || !userDetails) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Error" description="Could not load user activity." actions={pageActions}/>
        <Card>
          <CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-2 font-semibold text-destructive">Loading Failed</p>
            <p className="text-muted-foreground">{error || `User with ID ${targetUserId} not found.`}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`User Activity: ${userDetails.displayName}`}
        description={`Detailed activity log for ${userDetails.email}`}
        actions={pageActions}
      />
      <UserDetailClientView 
        userDetails={userDetails}
        assignedProjects={assignedProjects || []}
        initialTasks={initialTasks || []}
        initialHasMoreTasks={initialHasMoreTasks || false}
        initialLastTaskCursor={initialLastTaskCursor || null}
        leaveRequests={leaveRequests || []}
        allProjects={allProjects || []}
      />
    </div>
  );
}
