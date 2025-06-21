
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { fetchAllUsersBasic } from '@/app/actions/common/fetchAllUsersBasic';
import { fetchUserDetailsForAdminPage } from '@/app/actions/admin/fetchUserDetailsForAdminPage';
import { fetchMyAssignedProjects } from '@/app/actions/employee/fetchEmployeeData';
import { fetchTasksForUserAdminView } from '@/app/actions/admin/fetchTasksForUserAdminView';
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects';
import { UserDetailClientView } from '@/components/admin/user-detail-client-view';


export async function generateStaticParams() {
  const usersResult = await fetchAllUsersBasic();
  if (!usersResult.success || !usersResult.users) return [];
  return usersResult.users.map(user => ({
    userId: user.id,
  }));
}

async function getUserDataForPage(userId: string) {
    try {
        const [detailsResult, projectsResult, tasksResult, allProjectsListResult] = await Promise.all([
            fetchUserDetailsForAdminPage(userId),
            fetchMyAssignedProjects(userId), 
            fetchTasksForUserAdminView(userId, 20), 
            fetchAllProjects() 
        ]);
        
        const error = !detailsResult ? "User details not found" : (projectsResult.error || tasksResult.error || allProjectsListResult.error);
        
        if (error) {
             console.error(`Error fetching data for user ${userId}:`, error);
        }

        return {
            userDetails: detailsResult,
            assignedProjects: projectsResult.success ? projectsResult.projects : [],
            userTasks: tasksResult.success ? tasksResult.tasks : [],
            allProjects: allProjectsListResult.success ? allProjectsListResult.projects : [],
            error: error || null,
        };

    } catch(e) {
        console.error(`Critical error fetching data for user ${userId}:`, e);
        return { error: e instanceof Error ? e.message : "Unknown critical error", userDetails: null, assignedProjects: [], userTasks: [], allProjects: [] };
    }
}

export default async function UserActivityDetailsPage({ params }: { params: { userId: string } }) {
  const { userId } = params;
  const { userDetails, assignedProjects, userTasks, allProjects, error } = await getUserDataForPage(userId);
  
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
        userTasks={userTasks || []}
        allProjects={allProjects || []}
      />
  );
}
