
"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ListChecks, AlertTriangle, Users, FileWarning, RefreshCw, ArrowRight } from "lucide-react";
import Link from 'next/link';
import { fetchGlobalTaskCompletionSummary, fetchGlobalAttendanceSummary, type GlobalTaskCompletionSummary, type GlobalAttendanceSummary } from "@/app/actions/admin/fetchGlobalSummaries";
import { fetchStaleTasks } from "@/app/actions/admin/fetchStaleTasks";
import { TaskStatusChart } from "@/components/admin/task-status-chart";
import { AttendanceSummaryChart } from "@/components/admin/attendance-status-chart";
import { Skeleton } from "@/components/ui/skeleton";

const StatCard = ({ title, value, icon: Icon, description, link }: { title: string, value: string | number, icon: React.ElementType, description: string, link?: string }) => (
    <Card className="hover:shadow-lg transition-shadow">
        <Link href={link || "#"} className="block h-full">
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

export default function GlobalReportsPage() {
  const [taskSummary, setTaskSummary] = useState<GlobalTaskCompletionSummary | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<GlobalAttendanceSummary | null>(null);
  const [staleTasksCount, setStaleTasksCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [taskRes, attendanceRes, staleTasksRes] = await Promise.all([
        fetchGlobalTaskCompletionSummary(),
        fetchGlobalAttendanceSummary(),
        fetchStaleTasks(48) // We only need the count now
      ]);
      setTaskSummary(taskRes);
      setAttendanceSummary(attendanceRes);
      setStaleTasksCount(staleTasksRes.length);
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
            <StatCard link="/dashboard/admin/reports/task-completion" title="Total Tasks" value={taskSummary?.totalTasks ?? 0} icon={ListChecks} description={`${completionPercentage.toFixed(1)}% complete`} />
            <StatCard link="/dashboard/supervisor/compliance-reports" title="Tasks Needing Review" value={taskSummary?.needsReviewTasks ?? 0} icon={AlertTriangle} description="Awaiting supervisor approval" />
            <StatCard link="/dashboard/supervisor/attendance-map" title="Active Check-ins" value={attendanceSummary?.checkedIn ?? 0} icon={Users} description="Employees currently on the clock" />
            <StatCard link="/dashboard/admin/reports/stale-tasks" title="Stale Tasks" value={staleTasksCount} icon={FileWarning} description="Pending >48 hours" />
          </>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskStatusChart data={taskSummary} />
        <AttendanceSummaryChart data={attendanceSummary} />
      </div>
    </div>
  );
}
