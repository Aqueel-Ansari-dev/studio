"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListChecks, CheckSquare, Square, RefreshCw, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchMyTasksForProject, type TaskWithId, type ProjectWithId } from '@/app/actions/employee/fetchEmployeeData';
import type { TaskStatus } from '@/types/database'; 

interface EmployeeTasksViewProps {
  projectId: string;
  initialProjectDetails: ProjectWithId | null;
}

export function EmployeeTasksView({ projectId, initialProjectDetails }: EmployeeTasksViewProps) {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<TaskWithId[]>([]);
  const [projectDetails, setProjectDetails] = useState<ProjectWithId | null>(initialProjectDetails);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const { toast } = useToast();

  const loadTasks = useCallback(async () => {
    if (!projectId || !user || !user.id) {
      if (!authLoading) {
         toast({ title: "Error", description: "Cannot load tasks without user authentication.", variant: "destructive" });
      }
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    try {
      const tasksResult = await fetchMyTasksForProject(user.id, projectId);
      
      if (tasksResult.success && tasksResult.tasks) {
        const processed = tasksResult.tasks.map(task => ({ ...task, elapsedTime: task.elapsedTime || 0 }));
        processed.sort((a, b) => {
            if (a.isImportant && !b.isImportant) return -1;
            if (!a.isImportant && b.isImportant) return 1;
            return 0;
        });
        setTasks(processed);
      } else {
        setTasks([]);
        toast({
          title: "Error Loading Tasks",
          description: tasksResult.error || "Could not load tasks for this project.",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error("[EmployeeTasksPage] Failed to load project tasks:", error);
      toast({
        title: "Error Loading Data",
        description: "Could not load tasks for this project.",
        variant: "destructive",
      });
      setTasks([]); 
    } finally {
      setIsLoadingData(false);
    }
  }, [projectId, user, authLoading, toast]); 

  useEffect(() => {
    if (!authLoading && user?.id && projectId) { 
        loadTasks();
    }
  }, [loadTasks, authLoading, user?.id, projectId]);


  const projectName = projectDetails?.name || "Project Tasks";

  if (isLoadingData || authLoading) {
    return (
        <div className="space-y-6">
            <PageHeader title="Loading Tasks..." description="Fetching your assigned tasks." />
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-12 w-12 mb-4 animate-spin" />
                </CardContent>
            </Card>
        </div>
    );
  }
  
  if (!user) {
     return (
      <div className="space-y-6">
        <PageHeader title="Project Tasks" description="Please log in to see tasks." />
         <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <ListChecks className="mx-auto h-12 w-12 mb-4" />
            <p className="font-semibold">Not Authenticated</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <PageHeader 
        title={projectName}
        description={`Tasks for project: ${projectName}. Report completed tasks during punch-out.`}
        actions={<Button onClick={loadTasks} disabled={isLoadingData}><RefreshCw className={`mr-2 h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`}/> Refresh Tasks</Button>}
      />
      
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <ListChecks className="mx-auto h-12 w-12 mb-4" />
            <p className="font-semibold">No tasks found for this project.</p>
            <p>If you believe this is an error, please contact your supervisor.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/dashboard/employee/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Card key={task.id} className={`shadow-md ${task.isImportant ? 'border-2 border-destructive' : ''}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="font-headline text-lg flex items-center gap-2">
                    {task.status === 'completed' || task.status === 'verified' || task.status === 'needs-review' ? (
                        <CheckSquare className="h-5 w-5 text-green-600" />
                    ) : (
                        <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                    {task.taskName}
                    {task.isImportant && <Badge variant="destructive" className="ml-2">Important</Badge>}
                  </CardTitle>
                  <Badge variant={
                    task.status === 'completed' || task.status === 'verified' ? 'default' :
                    task.status === 'in-progress' ? 'secondary' :
                    task.status === 'paused' ? 'outline' : 
                    task.status === 'needs-review' ? 'outline' : 
                    'destructive' 
                  } className={
                    task.status === 'completed' || task.status === 'verified' ? 'bg-green-500 text-white' :
                    task.status === 'paused' ? 'border-orange-500 text-orange-600' : 
                    task.status === 'needs-review' ? 'border-yellow-500 text-yellow-600' : ''
                  }>
                    {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </div>
                <CardDescription className="mt-1 text-sm">{task.description}</CardDescription>
              </CardHeader>
              { (task.supervisorNotes || task.aiRisks?.length || task.supervisorReviewNotes) &&
                <CardContent className="pt-0">
                    {task.supervisorNotes && (
                        <div className="text-xs text-muted-foreground p-2 border-l-4 border-blue-400 bg-blue-50 rounded-md mb-2">
                            <strong>Supervisor Note:</strong> {task.supervisorNotes}
                        </div>
                    )}
                     {task.aiRisks && task.aiRisks.length > 0 && (
                      <div className="text-xs p-2 border-l-4 border-destructive bg-destructive/10 rounded-md mb-2">
                        <strong className="text-destructive flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/>AI Risks:</strong> {task.aiRisks.join(', ')}
                        {task.aiComplianceNotes && <span className="block mt-0.5">Suggestion: {task.aiComplianceNotes}</span>}
                      </div>
                    )}
                    {task.supervisorReviewNotes && (
                        <div className={`text-xs p-2 border-l-4 ${task.status === 'rejected' ? 'border-destructive bg-destructive/10' : 'border-primary bg-primary/10'} rounded-md`}>
                            <strong>Review Note:</strong> {task.supervisorReviewNotes}
                        </div>
                    )}
                </CardContent>
              }
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
