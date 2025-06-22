
"use client";

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Briefcase, CalendarDays, ClipboardList, DollarSign, Mail, UserCircle, Tag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAttendanceCalendar } from './UserAttendanceCalendar';

import type { UserDetailsForAdminPage } from '@/app/actions/admin/fetchUserDetailsForAdminPage';
import type { ProjectWithId } from '@/app/actions/employee/fetchEmployeeData';
import type { TaskForAdminUserView } from '@/app/actions/admin/fetchTasksForUserAdminView';
import type { ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import type { UserRole, PayMode, TaskStatus, LeaveRequest } from '@/types/database';

interface UserDetailClientViewProps {
  userDetails: UserDetailsForAdminPage;
  assignedProjects: ProjectWithId[];
  userTasks: TaskForAdminUserView[];
  allProjects: ProjectForSelection[];
  leaveRequests: LeaveRequest[];
}

export function UserDetailClientView({ userDetails, assignedProjects, userTasks, allProjects, leaveRequests }: UserDetailClientViewProps) {
    const router = useRouter();

    const allProjectsMap = new Map(allProjects.map(p => [p.id, p.name]));

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

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`User Activity: ${userDetails.displayName}`}
        description={`Detailed activity log for ${userDetails.email}`}
        actions={
            <Button onClick={() => router.push('/dashboard/admin/user-management')} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to User List
            </Button>
        }
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

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activity">Activity Feed</TabsTrigger>
            <TabsTrigger value="attendance">Attendance Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-6 space-y-6">
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
        </TabsContent>
        <TabsContent value="attendance" className="mt-6">
            <UserAttendanceCalendar
                userId={userDetails.id}
                allLeaveRequests={leaveRequests}
            />
        </TabsContent>
      </Tabs>
    </div>
  );
}
