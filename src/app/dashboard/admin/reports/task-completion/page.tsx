
"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchTaskCompletionReport, type TaskCompletionStats } from "@/app/actions/admin/fetchTaskCompletionReport";
import { useAuth } from "@/context/auth-context";

export default function TaskCompletionReportPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<TaskCompletionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user?.id) {
        if(!authLoading) toast({ title: "Error", description: "Admin user not found.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
      const result = await fetchTaskCompletionReport(user.id);
      if (result.success && result.stats) {
        setStats(result.stats);
      } else {
        setStats(null);
        toast({ title: "Error", description: result.error || "Failed to load report.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error loading task completion report:", error);
      setStats(null);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user, authLoading]);

  useEffect(() => {
    if(user?.id && !authLoading) {
        loadStats();
    }
  }, [user, authLoading, loadStats]);

  const completionPercentage = stats && stats.totalTasks > 0
    ? (stats.completedTasks / stats.totalTasks) * 100
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Completion Report"
        description="Overview of task status distribution across all projects."
        actions={
          <Button onClick={loadStats} variant="outline" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Overall Status Summary</CardTitle>
          {stats && <CardDescription>Total Tasks: {stats.totalTasks}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || !stats ? (
            <p className="text-center text-muted-foreground py-6">{isLoading ? 'Loading...' : 'No data available.'}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed / Verified</span>
                <Badge className="bg-green-500 text-white hover:bg-green-600">{stats.completedTasks}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">In Progress</span>
                <Badge className="bg-blue-500 text-white hover:bg-blue-600">{stats.inProgressTasks}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending</span>
                <Badge variant="outline">{stats.pendingTasks}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Needs Review</span>
                <Badge className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10">{stats.needsReviewTasks}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rejected</span>
                <Badge variant="destructive">{stats.rejectedTasks}</Badge>
              </div>
              <div className="pt-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>Completion:</span>
                  <span className="font-semibold">{completionPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={completionPercentage} aria-label={`${completionPercentage.toFixed(1)}% completed`} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
