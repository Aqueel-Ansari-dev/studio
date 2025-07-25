
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, LibraryBig, Users, ClipboardList, ShieldCheck, Activity, Eye } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

import { getAdminDashboardStats, type AdminDashboardStats } from "@/app/actions/admin/getDashboardStats";
import { fetchGlobalTaskCompletionSummary, type GlobalTaskCompletionSummary } from "@/app/actions/admin/fetchGlobalSummaries";
import { fetchTasksForSupervisor, type FetchTasksResult } from '@/app/actions/supervisor/fetchTasks';
import { fetchUsersByRole, type UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, type ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { TaskStatusChart } from "@/components/admin/task-status-chart";
import type { Task, TaskStatus } from '@/types/database';

function StatCard({ title, value, icon: Icon, description, link }: { title: string, value: string | number, icon: React.ElementType, description: string, link: string }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
        <Link href={link} className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
        </Link>
    </Card>
  );
}

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

export default function AdminOverviewPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    
    const [stats, setStats] = useState<AdminDashboardStats | null>(null);
    const [taskSummary, setTaskSummary] = useState<GlobalTaskCompletionSummary | null>(null);
    const [tasksForReview, setTasksForReview] = useState<Task[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Map<string, UserForSelection>>(new Map());
    const [projectsMap, setProjectsMap] = useState<Map<string, ProjectForSelection>>(new Map());

    const [isLoading, setIsLoading] = useState(true);

    const loadDashboardData = useCallback(async (adminId: string) => {
        setIsLoading(true);
        try {
            const [statsRes, taskSummaryRes, tasksReviewRes, employeesRes, projectsRes] = await Promise.all([
                getAdminDashboardStats(),
                fetchGlobalTaskCompletionSummary(),
                fetchTasksForSupervisor(adminId, { status: 'needs-review' }, 5), // Fetch top 5 for dashboard
                fetchUsersByRole('employee'),
                fetchAllProjects()
            ]);

            setStats(statsRes);
            setTaskSummary(taskSummaryRes);

            if (tasksReviewRes.success && tasksReviewRes.tasks) {
                setTasksForReview(tasksReviewRes.tasks);
            } else {
                toast({ title: "Could not load tasks for review", description: tasksReviewRes.message, variant: "destructive"});
            }

            if(employeesRes.success && employeesRes.users) {
                setEmployeesMap(new Map(employeesRes.users.map(u => [u.id, u])));
            }
             if(projectsRes.success && projectsRes.projects) {
                setProjectsMap(new Map(projectsRes.projects.map(p => [p.id, p])));
            }

        } catch (error) {
            console.error("Failed to load admin dashboard data:", error);
            toast({ title: "Error", description: "Could not load all dashboard data.", variant: "destructive"});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if(user?.id && user.role === 'admin') {
            loadDashboardData(user.id);
        } else if (!authLoading && user?.role !== 'admin') {
            setIsLoading(false);
        }
    }, [user, authLoading, loadDashboardData]);

  if (authLoading || isLoading) {
    return (
        <div className="space-y-6">
            <PageHeader title="Admin Dashboard" description="Loading key metrics and insights..."/>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
            </div>
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                <div className="lg:col-span-3"><Skeleton className="h-96" /></div>
                <div className="lg:col-span-2"><Skeleton className="h-96" /></div>
            </div>
        </div>
    );
  }

  const totalPendingReviews = (stats?.tasksNeedingReview ?? 0) + (stats?.expensesNeedingReview ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Admin Dashboard" 
        description="Oversee system operations, manage users, and view key metrics."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Projects" value={stats?.totalProjects ?? 0} icon={LibraryBig} description="All projects in the system" link="/dashboard/admin/project-management" />
        <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} description="All roles" link="/dashboard/admin/user-management" />
        <StatCard title="Tasks In Progress" value={stats?.tasksInProgress ?? 0} icon={ClipboardList} description="Actively worked on" link="/dashboard/supervisor/task-monitor" />
        <StatCard title="Pending Reviews" value={totalPendingReviews} icon={ShieldCheck} description="Tasks, expenses, & leave" link="/dashboard/admin/reports" />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Tasks for Review</CardTitle>
              <CardDescription>Top 5 tasks needing compliance checks or verification.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/supervisor/compliance-reports">View All <ArrowRight className="ml-2 h-4 w-4"/></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasksForReview.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No tasks currently need review.</TableCell></TableRow>}
                    {tasksForReview.map(task => {
                        const employee = employeesMap.get(task.assignedEmployeeId);
                        return (
                            <TableRow key={task.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={employee?.avatar} alt={employee?.name} data-ai-hint="employee avatar" />
                                            <AvatarFallback>{employee?.name?.substring(0,1) || '?'}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm">{employee?.name || 'N/A'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium text-sm">{task.taskName}</div>
                                    <div className="text-xs text-muted-foreground">{projectsMap.get(task.projectId)?.name || 'Unknown Project'}</div>
                                </TableCell>
                                <TableCell className="text-xs">{task.endTime ? formatDistanceToNow(new Date(task.endTime), {addSuffix: true}) : 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                     <Button asChild variant="ghost" size="sm">
                                         <Link href={`/dashboard/supervisor/compliance-reports?taskId=${task.id}`}><Eye className="mr-2 h-4 w-4"/> Review</Link>
                                     </Button>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <TaskStatusChart data={taskSummary} />
        </div>
      </div>
    </div>
  );
}
