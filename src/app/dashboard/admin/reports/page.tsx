"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ListChecks, AlertTriangle, Users, FileWarning, RefreshCw, ArrowRight } from "lucide-react";
import Link from 'next/link';
import { fetchGlobalTaskCompletionSummary, fetchGlobalAttendanceSummary, type GlobalTaskCompletionSummary, type GlobalAttendanceSummary } from "@/app/actions/admin/fetchGlobalSummaries";
import { fetchStaleTasks, type StaleTaskInfo } from "@/app/actions/admin/fetchStaleTasks";
import { TaskStatusChart } from "@/components/admin/task-status-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from 'date-fns';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export default function GlobalReportsPage() {
  const [taskSummary, setTaskSummary] = useState<GlobalTaskCompletionSummary | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<GlobalAttendanceSummary | null>(null);
  const [staleTasks, setStaleTasks] = useState<StaleTaskInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [taskRes, attendanceRes, staleTasksRes] = await Promise.all([
        fetchGlobalTaskCompletionSummary(),
        fetchGlobalAttendanceSummary(),
        fetchStaleTasks(48) // Default 48 hours
      ]);
      setTaskSummary(taskRes);
      setAttendanceSummary(attendanceRes);
      setStaleTasks(staleTasksRes);
    } catch (e) {
      console.error('Failed to load global summaries', e);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completionPercentage = taskSummary && taskSummary.totalTasks > 0
    ? ( (taskSummary.completedTasks + taskSummary.verifiedTasks) / taskSummary.totalTasks) * 100
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Reports Dashboard"
        description="System-wide operational metrics and reports."
         actions={
          <Button onClick={loadData} variant="outline" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard title="Total Tasks" value={taskSummary?.totalTasks ?? 0} icon={ListChecks} description={`${completionPercentage.toFixed(1)}% complete`} />
            <StatCard title="Tasks Needing Review" value={taskSummary?.needsReviewTasks ?? 0} icon={AlertTriangle} description="Awaiting supervisor approval" />
            <StatCard title="Active Check-ins" value={attendanceSummary?.checkedIn ?? 0} icon={Users} description="Employees currently on the clock" />
            <StatCard title="Stale Tasks" value={staleTasks.length} icon={FileWarning} description="Pending for >48 hours" />
          </>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Stale Tasks Report</CardTitle>
              <CardDescription>Tasks assigned but not started for over 48 hours. Follow up with supervisors.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : staleTasks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staleTasks.slice(0, 5).map(task => ( // Show top 5
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.taskName}</TableCell>
                        <TableCell>{task.assignedEmployeeName}</TableCell>
                        <TableCell>{task.projectName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-6">No stale tasks found. Good job!</p>
              )}
               {staleTasks.length > 5 && (
                  <div className="text-center mt-4">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/admin/reports/stale-tasks">View all {staleTasks.length} stale tasks <ArrowRight className="ml-2 h-4 w-4"/></Link>
                    </Button>
                  </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <TaskStatusChart data={taskSummary} />
        </div>
      </div>
    </div>
  );
}