
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Briefcase, CalendarDays, ClipboardList, DollarSign, Mail, RefreshCw, ShieldAlert, UserCircle, Tag } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

import { fetchUserDetailsForAdminPage, type UserDetailsForAdminPage } from '@/app/actions/admin/fetchUserDetailsForAdminPage';
import { fetchMyAssignedProjects, type ProjectWithId } from '@/app/actions/employee/fetchEmployeeData'; // Reusing for now
import { fetchTasksForUserAdminView, type TaskForAdminUserView } from '@/app/actions/admin/fetchTasksForUserAdminView';
import { fetchAllProjects, type ProjectForSelection } from '@/app/actions/common/fetchAllProjects'; // For mapping project names
import type { UserRole, PayMode, TaskStatus } from '@/types/database';

export default function UserActivityDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const targetUserId = params.userId as string;
  const { user: adminUser, loading: authLoading } = useAuth();

  const [userDetails, setUserDetails] = useState<UserDetailsForAdminPage | null>(null);
  const [assignedProjects, setAssignedProjects] = useState<ProjectWithId[]>([]);
  const [userTasks, setUserTasks] = useState<TaskForAdminUserView[]>([]);
  const [allProjectsMap, setAllProjectsMap] = useState<Map<string, string>>(new Map());
  
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    if (!targetUserId || !adminUser?.id) {
      if (!authLoading && !adminUser?.id) setError("Admin user not authenticated.");
      if (!authLoading && !targetUserId) setError("Target User ID is missing.");
      setPageLoading(false);
      return;
    }
    if (adminUser.role !== 'admin') {
        setError("Access Denied. Only admins can view this page.");
        setPageLoading(false);
        return;
    }

    setPageLoading(true);
    setError(null);
    try {
      const [details, projectsResult, tasksResult, allProjectsList] = await Promise.all([
        fetchUserDetailsForAdminPage(targetUserId),
        fetchMyAssignedProjects(targetUserId), // Fetches projects listed in user.assignedProjectIds
        fetchTasksForUserAdminView(targetUserId, 20), // Fetch last 20 tasks
        fetchAllProjects() // Fetch all projects for name mapping
      ]);

      if (!details) throw new Error("User details could not be fetched.");
      setUserDetails(details);
      setAssignedProjects(projectsResult);
      setUserTasks(tasksResult);

      const projectsMap = new Map<string, string>();
      allProjectsList.forEach(p => projectsMap.set(p.id, p.name));
      setAllProjectsMap(projectsMap);

    } catch (err) {
      console.error("Error fetching user activity details:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setPageLoading(false);
    }
  }, [targetUserId, adminUser, authLoading]);

  useEffect(() => {
    if (!authLoading) {
        loadAllData();
    }
  }, [loadAllData, authLoading]);

  const formatPayMode = (payMode?: PayMode): string => {
    if (!payMode || payMode === 'not_set') return 'Not Set';
    return payMode.charAt(0).toUpperCase() + payMode.slice(1);
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'supervisor': return 'secondary';
      case 'employee': default: return 'outline';
    }
  };
  
  const getTaskStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'default';
      case 'in-progress': return 'secondary';
      case 'needs-review': return 'outline';
      case 'pending': case 'paused': case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };
   const getTaskStatusBadgeClassName = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'bg-green-500 text-white';
      case 'needs-review': return 'border-yellow-500 text-yellow-600';
      default: return '';
    }
  };


  const pageActions = (
    <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push('/dashboard/admin/user-management')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to User List
        </Button>
        <Button onClick={loadAllData} variant="outline" disabled={pageLoading || !adminUser}>
            <RefreshCw className={`mr-2 h-4 w-4 ${pageLoading ? 'animate-spin' : ''}`} />Refresh Data
        </Button>
    </div>
  );

  if (authLoading || (!adminUser && !error && pageLoading) ) { 
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Loading User Details..." description="Please wait..." actions={pageActions}/>
        <Card><CardContent className="p-6 text-center"><RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" /></CardContent></Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Error" description="Could not load user activity." actions={pageActions}/>
        <Card><CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-2 font-semibold text-destructive">Loading Failed</p>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={loadAllData} className="mt-4">Try Again</Button>
        </CardContent></Card>
      </div>
    );
  }
  
  if (pageLoading && !userDetails) {
     return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Loading User Details..." description={`Fetching data for user ID: ${targetUserId}`} actions={pageActions} />
        <Card><CardContent className="p-6 text-center"><RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" /></CardContent></Card>
      </div>
    );
  }
  
  if (!userDetails) {
      return (
         <div className="space-y-6 p-4 md:p-6 lg:p-8">
            <PageHeader title="User Not Found" description="Could not find details for the specified user." actions={pageActions} />
            <Card><CardContent className="p-6 text-center"><p>The user with ID '{targetUserId}' may not exist or there was an issue fetching their data.</p></CardContent></Card>
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

      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
          <Avatar className="h-20 w-20 border">
            <AvatarImage src={userDetails.avatarUrl} alt={userDetails.displayName} data-ai-hint="user avatar" />
            <AvatarFallback className="text-2xl">{userDetails.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-grow">
            <CardTitle className="text-2xl font-headline">{userDetails.displayName}</CardTitle>
            <div className="text-sm text-muted-foreground flex items-center mt-1">
                <Mail className="mr-2 h-4 w-4"/> {userDetails.email}
            </div>
            <div className="text-sm text-muted-foreground flex items-center mt-1">
                <UserCircle className="mr-2 h-4 w-4"/> Role: <Badge variant={getRoleBadgeVariant(userDetails.role)} className="ml-1">{userDetails.role}</Badge>
            </div>
            <div className="text-sm text-muted-foreground flex items-center mt-1">
                <CalendarDays className="mr-2 h-4 w-4"/> Joined: {format(new Date(userDetails.createdAt), "PPpp")}
            </div>
          </div>
        </CardHeader>
        {userDetails.role === 'employee' && (
          <CardContent className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                    <Tag className="mr-2 h-4 w-4 text-muted-foreground"/> 
                    Pay Mode: <span className="font-semibold ml-1">{formatPayMode(userDetails.payMode)}</span>
                </div>
                <div className="flex items-center">
                    <DollarSign className="mr-2 h-4 w-4 text-muted-foreground"/> 
                    Rate: <span className="font-semibold ml-1">{userDetails.payMode !== 'not_set' && typeof userDetails.rate === 'number' ? userDetails.rate : 'N/A'}</span>
                </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary"/>Assigned Projects</CardTitle>
           <CardDescription>{assignedProjects.length > 0 ? `This user is associated with ${assignedProjects.length} project(s).` : "This user is not currently assigned to any projects via their profile."}</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedProjects.length > 0 ? (
            <ul className="space-y-2">
              {assignedProjects.map(project => (
                <li key={project.id} className="p-3 border rounded-md hover:bg-muted/50 transition-colors">
                  <Link href={`/dashboard/admin/projects/${project.id}`} className="font-medium text-primary hover:underline">
                    {project.name}
                  </Link>
                  {project.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.description}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No projects directly assigned to this user's profile. They might still have tasks in other projects.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-primary"/>Recent Tasks</CardTitle>
          <CardDescription>{userTasks.length > 0 ? `Showing the latest ${userTasks.length} tasks assigned to this user.` : "No tasks found for this user."}</CardDescription>
        </CardHeader>
        <CardContent>
          {userTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Due Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userTasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.taskName}</TableCell>
                    <TableCell>{allProjectsMap.get(task.projectId) || task.projectId.substring(0,8)+"..."}</TableCell>
                    <TableCell>
                        <Badge variant={getTaskStatusBadgeVariant(task.status)} className={getTaskStatusBadgeClassName(task.status)}>
                            {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{task.dueDate ? format(new Date(task.dueDate), "PP") : 'N/A'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{format(new Date(task.updatedAt), "PPp")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No tasks found for this user.</p>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for other activity sections (Attendance, Expenses, Payroll, Leave) */}
      {/* These will be added in future iterations */}
    </div>
  );
}

