
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, ListChecks, CheckCircle, Clock, AlertTriangle, PlusCircle, Eye, RefreshCw, Hourglass } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { fetchTasksForSupervisor, type FetchTasksResult } from '@/app/actions/supervisor/fetchTasks';
import { fetchUsersByRole, type UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, type ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import type { Task, TaskStatus } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';

interface EnrichedTask {
  id: string;
  employeeName: string;
  employeeAvatar: string;
  taskName: string;
  projectId: string;
  projectName: string;
  status: TaskStatus;
  lastUpdate: string; // Formatted string e.g., "30 mins ago"
  updatedAt: string; // ISO string for sorting
}

interface TaskStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  needsReviewTasks: number;
}

export default function SupervisorOverviewPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats>({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    needsReviewTasks: 0,
  });
  
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);

  const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.id, emp])), [employees]);
  const projectMap = useMemo(() => new Map(projects.map(proj => [proj.id, proj])), [projects]);

  const calculateStats = (currentTasks: Task[]): TaskStats => {
    return {
      totalTasks: currentTasks.length,
      completedTasks: currentTasks.filter(t => t.status === 'completed' || t.status === 'verified').length,
      inProgressTasks: currentTasks.filter(t => t.status === 'in-progress').length,
      pendingTasks: currentTasks.filter(t => t.status === 'pending').length,
      needsReviewTasks: currentTasks.filter(t => t.status === 'needs-review').length,
    };
  };

  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [fetchedEmployees, fetchedProjects] = await Promise.all([
        fetchUsersByRole('employee'),
        fetchAllProjects()
      ]);
      setEmployees(fetchedEmployees);
      setProjects(fetchedProjects);
    } catch (error) {
      console.error("Error fetching lookups:", error);
      toast({ title: "Error", description: "Could not load employee or project data.", variant: "destructive" });
    } finally {
      setIsLoadingLookups(false);
    }
  }, [toast]);

  const loadTasks = useCallback(async () => {
    if (!user || !user.id) {
      if (user === null) toast({ title: "Authentication Error", description: "Please log in.", variant: "destructive" });
      setIsLoadingTasks(false);
      return;
    }
    setIsLoadingTasks(true);
    try {
      const result: FetchTasksResult = await fetchTasksForSupervisor(user.id, { status: 'all' }); 
      if (result.success && result.tasks) {
        setTasks(result.tasks);
        setTaskStats(calculateStats(result.tasks));
      } else {
        setTasks([]);
        setTaskStats(calculateStats([])); // Reset stats on error
        toast({ title: "Error Fetching Tasks", description: result.message || "Could not load tasks.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({ title: "Error", description: "An unexpected error occurred while fetching tasks.", variant: "destructive" });
      setTasks([]);
      setTaskStats(calculateStats([])); // Reset stats on error
    } finally {
      setIsLoadingTasks(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (!isLoadingLookups && user) {
      loadTasks();
    }
  }, [loadTasks, isLoadingLookups, user]);
  
  const handleRefreshAll = () => {
    loadLookups(); // Re-fetch employees and projects if needed
    if (user) { // Only load tasks if user is available
        loadTasks();
    }
  }

  const enrichedTasks: EnrichedTask[] = useMemo(() => {
    return tasks
      .map(task => {
        const employee = employeeMap.get(task.assignedEmployeeId);
        const project = projectMap.get(task.projectId);
        return {
          id: task.id,
          employeeName: employee?.name || 'N/A',
          employeeAvatar: employee?.avatar || `https://placehold.co/40x40.png?text=${(employee?.name || 'E').substring(0,1)}`,
          taskName: task.taskName,
          projectId: task.projectId,
          projectName: project?.name || 'N/A',
          status: task.status,
          lastUpdate: task.updatedAt ? formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true }) : 'N/A',
          updatedAt: task.updatedAt || new Date(0).toISOString(),
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) 
      .slice(0, 10); 
  }, [tasks, employeeMap, projectMap]);

  const isLoading = isLoadingLookups || isLoadingTasks;

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
      case 'completed': case 'verified': return 'bg-green-500 text-white';
      case 'needs-review': return 'border-yellow-500 text-yellow-600';
      case 'in-progress': return 'bg-blue-500 text-white';
      case 'paused': return 'border-orange-500 text-orange-600';
      default: return '';
    }
  };


  return (
    <div className="space-y-6">
      <PageHeader 
        title="Supervisor Dashboard" 
        description="Monitor team progress and manage tasks."
        actions={
          <div className="flex gap-2">
            <Button onClick={handleRefreshAll} variant="outline" disabled={isLoading}>
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
            <div className="text-2xl font-bold">{isLoading ? <RefreshCw className="h-5 w-5 animate-spin"/> : taskStats.totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed/Verified</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <RefreshCw className="h-5 w-5 animate-spin"/> : taskStats.completedTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <RefreshCw className="h-5 w-5 animate-spin"/> : taskStats.inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Hourglass className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <RefreshCw className="h-5 w-5 animate-spin"/> : taskStats.pendingTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <RefreshCw className="h-5 w-5 animate-spin"/> : taskStats.needsReviewTasks}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Live Team Progress</CardTitle>
          <CardDescription>
            {isLoading ? "Loading tasks..." : `Showing ${enrichedTasks.length} most recently updated tasks assigned by you.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center py-10">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading task data...</p>
            </div>
          ) : enrichedTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No tasks found or assigned by you.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
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
                        <Image src={task.employeeAvatar} alt={task.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                        <span className="font-medium">{task.employeeName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{task.taskName}</TableCell>
                    <TableCell>{task.projectName}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={getStatusBadgeVariant(task.status)}
                        className={getStatusBadgeClassName(task.status)}
                      >
                        {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell>{task.lastUpdate}</TableCell>
                    <TableCell className="text-right">
                       <Button asChild variant="ghost" size="icon" title="View Project Details">
                         <Link href={`/dashboard/supervisor/projects/${task.projectId}`}>
                           <Eye className="h-4 w-4" />
                           <span className="sr-only">View Project Details</span>
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

    