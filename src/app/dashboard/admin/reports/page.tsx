
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Download, CheckCircle, ListChecks, Clock, Hourglass, AlertTriangle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { fetchGlobalTaskCompletionSummary, fetchGlobalAttendanceSummary, type GlobalTaskCompletionSummary, type GlobalAttendanceSummary } from "@/app/actions/admin/fetchGlobalSummaries";

export default function GlobalReportsPage() {
  const [taskSummary, setTaskSummary] = useState<GlobalTaskCompletionSummary | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<GlobalAttendanceSummary | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [taskRes, attendanceRes] = await Promise.all([
          fetchGlobalTaskCompletionSummary(),
          fetchGlobalAttendanceSummary(),
        ]);
        setTaskSummary(taskRes);
        setAttendanceSummary(attendanceRes);
      } catch (e) {
        console.error('Failed to load global summaries', e);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Reports"
        description="View and generate system-wide operational reports."
         actions={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export All Data
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Overall Task Completion Report</CardTitle>
          {taskSummary ? (
            <CardDescription>{taskSummary.totalTasks} total tasks</CardDescription>
          ) : (
            <CardDescription>Loading...</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {taskSummary ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between"><span>Total</span><Badge variant="secondary">{taskSummary.totalTasks}</Badge></div>
                <div className="flex items-center justify-between"><span className="flex items-center"><CheckCircle className="h-3 w-3 mr-1 text-green-600"/>Completed</span><Badge>{taskSummary.completedTasks}</Badge></div>
                <div className="flex items-center justify-between"><span className="flex items-center"><ListChecks className="h-3 w-3 mr-1 text-green-600"/>Verified</span><Badge>{taskSummary.verifiedTasks}</Badge></div>
                <div className="flex items-center justify-between"><span className="flex items-center"><Clock className="h-3 w-3 mr-1 text-blue-600"/>In Progress</span><Badge>{taskSummary.inProgressTasks}</Badge></div>
                <div className="flex items-center justify-between"><span className="flex items-center"><Hourglass className="h-3 w-3 mr-1 text-orange-600"/>Pending</span><Badge>{taskSummary.pendingTasks}</Badge></div>
                <div className="flex items-center justify-between"><span className="flex items-center"><AlertTriangle className="h-3 w-3 mr-1 text-yellow-600"/>Needs Review</span><Badge>{taskSummary.needsReviewTasks}</Badge></div>
                <div className="flex items-center justify-between"><span className="flex items-center"><AlertTriangle className="h-3 w-3 mr-1 text-red-600"/>Rejected</span><Badge variant="destructive">{taskSummary.rejectedTasks}</Badge></div>
              </div>
              <div className="pt-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>Completion</span>
                  <span className="font-semibold">{taskSummary.completionPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={taskSummary.completionPercentage} aria-label={`${taskSummary.completionPercentage.toFixed(1)}% completed`} />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Loading task data...</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Attendance & Compliance Summary</CardTitle>
          {attendanceSummary ? (
            <CardDescription>{attendanceSummary.totalLogs} logs</CardDescription>
          ) : (
            <CardDescription>Loading...</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {attendanceSummary ? (
            <>
              <div className="flex justify-between"><span className="flex items-center"><UserCheck className="h-3 w-3 mr-1 text-blue-600"/>Checked In</span><Badge>{attendanceSummary.checkedIn}</Badge></div>
              <div className="flex justify-between"><span className="flex items-center"><CheckCircle className="h-3 w-3 mr-1 text-green-600"/>Checked Out</span><Badge>{attendanceSummary.checkedOut}</Badge></div>
              <div className="flex justify-between"><span className="flex items-center"><Hourglass className="h-3 w-3 mr-1 text-orange-600"/>Pending Review</span><Badge>{attendanceSummary.pendingReview}</Badge></div>
              <div className="flex justify-between"><span className="flex items-center"><CheckCircle className="h-3 w-3 mr-1 text-green-600"/>Approved</span><Badge>{attendanceSummary.approved}</Badge></div>
              <div className="flex justify-between"><span className="flex items-center"><AlertTriangle className="h-3 w-3 mr-1 text-red-600"/>Rejected</span><Badge variant="destructive">{attendanceSummary.rejected}</Badge></div>
            </>
          ) : (
            <p className="text-muted-foreground">Loading attendance data...</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Stale Tasks Report</CardTitle>
          <CardDescription>Identify tasks assigned but never started.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            Review tasks that remain in the pending state for more than two days.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/admin/reports/stale-tasks">View Report</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
