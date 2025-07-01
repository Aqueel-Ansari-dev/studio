
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, ListChecks, CheckCircle, Clock, AlertTriangle, PlusCircle, Eye, RefreshCw, Hourglass } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { fetchTasksForSupervisor, type FetchTasksResult } from '@/app/actions/supervisor/fetchTasks';
import { fetchUsersByRole, type UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchSupervisorAssignedProjects, type FetchSupervisorProjectsResult } from '@/app/actions/supervisor/fetchSupervisorData';
import type { Task, TaskStatus } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface EnrichedTask {
  id: string;
  employeeName: string;
  employeeAvatar: string;
  taskName: string;
  projectId: string;
  projectName: string;
  status: TaskStatus;
  lastUpdate: string; 
  updatedAt: string; 
}

interface TaskStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  needsReviewTasks: number;
}

const getStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'default';
      case 'in-progress': return 'secondary';
      case 'needs-review': return 'outline';
      case 'pending': case 'paused': case 'rejected': return 'destructive';
      default: return 'outline';
    }
};

const getStatusBadgeClassName = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'bg-green-500 text-white hover:bg-green-600';
      case 'needs-review': return 'border-yellow-500 text-yellow-600 hover:bg-yellow-500/10';
      case 'in-progress': return 'bg-blue-500 text-white hover:bg-blue-600';
      case 'paused': return 'border-orange-500 text-orange-600 hover:bg-orange-500/10';
      case 'pending': return 'border-gray-500 text-gray-600 hover:bg-gray-500/10';
      default: return '';
    }
};

export default function SupervisorOverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employeesAndSupervisors, setEmployeesAndSupervisors] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats>({ totalTasks: 0, completedTasks: 0, inProgressTasks: 0, pendingTasks: 0, needsReviewTasks: 0 });
  
  const [isLoading, setIsLoading] = useState(true);

  const combinedUserMap = useMemo(() => new Map(employeesAndSupervisors.map(u => [u.id, u])), [employeesAndSupervisors]);
  const projectMap = useMemo(() => new Map(projects.map(proj => [proj.id, proj.name])), [projects]);

  const loadDashboardData = useCallback(async (supervisorId: string) => {
    setIsLoading(true);
    try {
        const [tasksResult, employeesResult, supervisorsResult, projectsResult] = await Promise.all([
            fetchTasksForSupervisor(supervisorId, { status: 'all' }),
            fetchUsersByRole('employee'),
            fetchUsersByRole('supervisor'), // Fetch supervisors as well
            fetchSupervisorAssignedProjects(supervisorId)
        ]);

        if (tasksResult.success && tasksResult.tasks) {
            setTasks(tasksResult.tasks);
            setTaskStats({
                totalTasks: tasksResult.tasks.length,
                completedTasks: tasksResult.tasks.filter(t => t.status === 'completed' || t.status === 'verified').length,
                inProgressTasks: tasksResult.tasks.filter(t => t.status === 'in-progress').length,
                pendingTasks: tasksResult.tasks.filter(t => t.status === 'pending').length,
                needsReviewTasks: tasksResult.tasks.filter(t => t.status === 'needs-review').length,
            });
        } else {
            toast({ title: "Error Fetching Tasks", description: tasksResult.message || "Could not load tasks.", variant: "destructive" });
        }
        
        let combinedUsers: UserForSelection[] = [];
        if (employeesResult.success && employeesResult.users) {
            combinedUsers = combinedUsers.concat(employeesResult.users);
        }
        if(supervisorsResult.success && supervisorsResult.users) {
            combinedUsers = combinedUsers.concat(supervisorsResult.users);
        }
        setEmployeesAndSupervisors(combinedUsers);

        if (projectsResult.success && projectsResult.projects) setProjects(projectsResult.projects);

    } catch (error) {
      console.error("Failed to load supervisor dashboard:", error);
      toast({ title: "Error", description: "An unexpected error occurred while loading dashboard data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.id && !authLoading) {
      loadDashboardData(user.id);
    } else if (!authLoading && !user?.id) {
        setIsLoading(false);
    }
  }, [user, authLoading, loadDashboardData]);

  const enrichedTasks: EnrichedTask[] = useMemo(() => {
    return tasks
      .map(task => {
        const assignee = combinedUserMap.get(task.assignedEmployeeId);
        const projectName = projectMap.get(task.projectId);
        return {
          id: task.id,
          employeeName: assignee?.name || 'Unassigned',
          employeeAvatar: assignee?.avatar || `https://placehold.co/40x40.png?text=U`,
          taskName: task.taskName,
          projectId: task.projectId,
          projectName: projectName || 'N/A',
          status: task.status,
          lastUpdate: task.updatedAt ? formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true }) : 'N/A',
          updatedAt: task.updatedAt || new Date(0).toISOString(),
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) 
      .slice(0, 10); 
  }, [tasks, combinedUserMap, projectMap]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Supervisor Dashboard" 
        description="Monitor team progress and manage tasks."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => user && loadDashboardData(user.id)} variant="outline" disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
                Refresh All
            </Button>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/dashboard/supervisor/assign-task">
                <PlusCircle className="mr-2 h-4 w-4" /> Assign New Task
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-12"/> : <div className="text-2xl font-bold">{taskStats.totalTasks}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-12"/> : <div className="text-2xl font-bold">{taskStats.completedTasks}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-12"/> : <div className="text-2xl font-bold">{taskStats.inProgressTasks}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Hourglass className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-12"/> : <div className="text-2xl font-bold">{taskStats.pendingTasks}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-12"/> : <div className="text-2xl font-bold">{taskStats.needsReviewTasks}</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Live Team Progress</CardTitle>
          <CardDescription>
            {isLoading ? "Loading tasks..." : `Showing ${enrichedTasks.length} most recently updated tasks.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : enrichedTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No tasks found. Assign one to get started!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={task.employeeAvatar} alt={task.employeeName} data-ai-hint="employee avatar" />
                            <AvatarFallback>{task.employeeName.substring(0,1)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{task.employeeName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{task.taskName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{task.projectName}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={getStatusBadgeVariant(task.status)}
                        className={getStatusBadgeClassName(task.status)}
                      >
                        {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{task.lastUpdate}</TableCell>
                    <TableCell className="text-right">
                       <Button asChild variant="ghost" size="sm">
                         <Link href={`/dashboard/supervisor/task-monitor?projectId=${task.projectId}`}>
                           <Eye className="mr-2 h-4 w-4" /> View Project Tasks
                         </Link>
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
