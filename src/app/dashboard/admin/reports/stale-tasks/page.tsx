
"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { fetchStaleTasks, type StaleTaskInfo } from "@/app/actions/admin/fetchStaleTasks";

export default function StaleTasksReportPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<StaleTaskInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!user?.id) {
      if (!loading) {
        toast({ title: "Authentication Error", description: "Admin user not found.", variant: "destructive" });
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await fetchStaleTasks();
      setTasks(results);
    } catch (err) {
      console.error("Error fetching stale tasks:", err);
      toast({ title: "Failed to fetch tasks", description: "An error occurred.", variant: "destructive" });
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, loading, toast]);

  useEffect(() => {
    if (!loading) {
      loadTasks();
    }
  }, [loading, loadTasks]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stale Tasks"
        description="Tasks assigned but not started in over 48 hours."
        actions={
          <Button onClick={loadTasks} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Stale Tasks</CardTitle>
          <CardDescription>
            {tasks.length > 0 ? `Found ${tasks.length} task(s) pending start.` : "No stale tasks found."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Assigned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(task => (
                <TableRow key={task.id}>
                  <TableCell>{task.taskName}</TableCell>
                  <TableCell>{task.assignedEmployeeName}</TableCell>
                  <TableCell>{task.projectName}</TableCell>
                  <TableCell>{task.supervisorName}</TableCell>
                  <TableCell>{format(new Date(task.createdAt), 'PP')}</TableCell>
                </TableRow>
              ))}
              {tasks.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No stale tasks found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
