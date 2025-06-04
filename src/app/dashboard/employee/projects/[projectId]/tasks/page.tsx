
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Play, Pause, CheckCircle, Clock, AlertTriangle, Upload, MessageSquare, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { analyzeComplianceRisk, ComplianceRiskAnalysisOutput } from "@/ai/flows/compliance-risk-analysis";
import { fetchMyTasksForProject, fetchProjectDetails, TaskWithId, ProjectWithId } from '@/app/actions/employee/fetchEmployeeData';
import { startEmployeeTask, completeEmployeeTask, CompleteTaskInput } from '@/app/actions/employee/updateTask';
import type { TaskStatus } from '@/types/database'; 

export default function EmployeeTasksPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { user, loading: authLoading } = useAuth();

  const [tasks, setTasks] = useState<TaskWithId[]>([]);
  const [projectDetails, setProjectDetails] = useState<ProjectWithId | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [activeTimers, setActiveTimers] = useState<Record<string, NodeJS.Timeout | null>>({});
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<TaskWithId | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionMedia, setSubmissionMedia] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [isUpdatingTask, setIsUpdatingTask] = useState<Record<string, boolean>>({});

  const { toast } = useToast();

  const loadData = useCallback(async () => {
    if (!projectId || !user || !user.id) {
      if (!authLoading && projectId) {
        console.warn(`[EmployeeTasksPage] loadData pre-condition failed. projectId: ${projectId}, user ID: ${user?.id}, authLoading: ${authLoading}`);
        toast({
            title: "Authentication Error",
            description: "Could not load tasks: User not found or project ID missing.",
            variant: "destructive",
        });
      } else if (!authLoading && !projectId) {
         console.warn(`[EmployeeTasksPage] loadData pre-condition failed. Project ID is missing from params.`);
         toast({ title: "Error", description: "Project ID not found.", variant: "destructive" });
      }
      setIsLoadingData(false);
      return;
    }
    console.log(`[EmployeeTasksPage] Calling loadData for projectId: '${projectId}', user.id: '${user.id}'`);

    setIsLoadingData(true);
    try {
      const [fetchedProjectDetailsResult, fetchedTasksResult] = await Promise.all([
        fetchProjectDetails(projectId),
        fetchMyTasksForProject(user.id, projectId)
      ]);
      
      console.log("[EmployeeTasksPage] Raw result from fetchProjectDetails:", fetchedProjectDetailsResult);
      console.log("[EmployeeTasksPage] Raw result from fetchMyTasksForProject:", fetchedTasksResult);
      
      setProjectDetails(fetchedProjectDetailsResult);
      setTasks(fetchedTasksResult.map(task => ({ ...task, elapsedTime: task.elapsedTime || 0 })));
      console.log("[EmployeeTasksPage] Processed fetched tasks for state (length):", fetchedTasksResult.length, "Full data:", JSON.parse(JSON.stringify(fetchedTasksResult)));


    } catch (error) {
      console.error("[EmployeeTasksPage] Failed to load project tasks:", error);
      toast({
        title: "Error Loading Data",
        description: "Could not load tasks for this project. Ensure Firestore indexes are correctly set up if errors persist.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [projectId, user, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && user?.id && projectId) { 
        loadData();
    }
  }, [loadData, authLoading, user?.id, projectId]);


  useEffect(() => {
    tasks.forEach(task => {
      if (task.status === 'in-progress' && task.startTime && !activeTimers[task.id]) {
        const timerId = setInterval(() => {
          setTasks(prevTasks => prevTasks.map(t =>
            t.id === task.id ? { ...t, elapsedTime: (t.elapsedTime || 0) + 1 } : t
          ));
        }, 1000);
        setActiveTimers(prev => ({ ...prev, [task.id]: timerId }));
      } else if (task.status !== 'in-progress' && activeTimers[task.id]) {
        clearInterval(activeTimers[task.id]!);
        setActiveTimers(prev => ({ ...prev, [task.id]: null }));
      }
    });

    return () => {
      Object.values(activeTimers).forEach(timerId => {
        if (timerId) clearInterval(timerId);
      });
    };
  }, [tasks, activeTimers]);

  const handleStartTask = async (taskId: string) => {
    if (!user || !user.id) {
      toast({ title: "Error", description: "User not found.", variant: "destructive" });
      return;
    }
    setIsUpdatingTask(prev => ({...prev, [taskId]: true}));
    const result = await startEmployeeTask({ taskId, employeeId: user.id });
    if (result.success) {
      toast({ title: "Task Started", description: result.message });
      await loadData(); 
    } else {
      toast({ title: "Failed to Start Task", description: result.message, variant: "destructive" });
    }
    setIsUpdatingTask(prev => ({...prev, [taskId]: false}));
  };

  const handlePauseTask = (taskId: string) => {
    // Note: This pause is local state only and NOT persisted to Firestore
    // A server action would be needed for persistent pause.
    setTasks(prevTasks => prevTasks.map(task =>
      task.id === taskId ? { ...task, status: 'paused' } : task
    ));
    toast({ title: "Task Paused (Local)", description: "Timer has been paused. This change is not saved to Firestore.", variant:"outline" });
  };

  const handleCompleteTask = (task: TaskWithId) => {
    setSelectedTaskForSubmission(task);
    setSubmissionNotes(task.employeeNotes || "");
    setSubmissionMedia([]); 
    setShowSubmissionModal(true);
  };

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSubmissionMedia(Array.from(event.target.files));
    }
  };
  
  const submitTaskForCompletion = async () => {
    if (!selectedTaskForSubmission || !user || !user.id) {
      toast({ title: "Error", description: "Selected task or user not found.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    let mediaDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; 
    if (submissionMedia.length > 0) {
      const file = submissionMedia[0];
      try {
        mediaDataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
        });
      } catch (error) {
        console.error("[EmployeeTasksPage] Error converting file to data URI:", error);
        toast({ title: "Error", description: "Could not process media file. Using placeholder.", variant: "destructive" });
      }
    }
    
    const mockLocationData = "34.0522° N, 118.2437° W (Mocked)"; 
    const mockSupervisorNotes = selectedTaskForSubmission.supervisorNotes || "No specific supervisor notes for this task.";

    let complianceResult: ComplianceRiskAnalysisOutput;
    try {
      console.log("[EmployeeTasksPage] Calling analyzeComplianceRisk with mediaDataUri (first 50 chars):", mediaDataUri.substring(0,50), "location:", mockLocationData, "supervisorNotes:", mockSupervisorNotes);
      complianceResult = await analyzeComplianceRisk({
        mediaDataUri: mediaDataUri,
        locationData: mockLocationData,
        supervisorNotes: mockSupervisorNotes,
      });
      console.log("[EmployeeTasksPage] AI Compliance Result:", complianceResult);
    } catch (aiError) {
      console.error("[EmployeeTasksPage] AI Compliance check error:", aiError);
      toast({ title: "AI Error", description: "Failed to run compliance check. Task will be submitted for manual review.", variant: "destructive" });
      complianceResult = { complianceRisks: ['AI_CHECK_FAILED'], additionalInformationNeeded: 'AI compliance check failed. Please review manually.' };
    }

    const completeInput: CompleteTaskInput = {
      taskId: selectedTaskForSubmission.id,
      employeeId: user.id,
      notes: submissionNotes,
      submittedMediaUri: mediaDataUri, 
      aiComplianceOutput: complianceResult,
    };
    console.log("[EmployeeTasksPage] Calling completeEmployeeTask with input:", JSON.stringify(completeInput, null, 2));
    const serverResult = await completeEmployeeTask(completeInput);
    console.log("[EmployeeTasksPage] Server result from completeEmployeeTask:", serverResult);

    if (serverResult.success) {
      toast({ title: "Task Submitted", description: serverResult.message || `Task status updated to ${serverResult.finalStatus}.` });
      await loadData(); 
      setShowSubmissionModal(false);
      setSelectedTaskForSubmission(null);
      setSubmissionNotes("");
      setSubmissionMedia([]);
    } else {
      toast({ title: "Submission Failed", description: serverResult.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const formatTime = (totalSeconds: number = 0) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const projectName = projectDetails?.name || "Project Tasks";

  if (isLoadingData || authLoading) {
    return (
        <div className="space-y-6">
            <PageHeader title="Loading..." description="Fetching project details and tasks." />
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-12 w-12 mb-4 animate-spin" />
                    <p className="font-semibold">Loading data...</p>
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
            <p>Please log in to view tasks for this project.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const isTaskActionable = (taskStatus: TaskStatus) => {
     return ['pending', 'in-progress', 'paused'].includes(taskStatus);
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={projectName}
        description={`Manage your tasks for ${projectName}.`}
        actions={<Button onClick={loadData} disabled={isLoadingData}><RefreshCw className={`mr-2 h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`}/> Refresh Tasks</Button>}
      />
      
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <ListChecks className="mx-auto h-12 w-12 mb-4" />
            <p className="font-semibold">No tasks found for this project.</p>
            <p>If you believe this is an error, please contact your supervisor or check if tasks have been assigned. Ensure Firestore indexes are set up for task queries.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/dashboard/employee/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            console.log(`[EmployeeTasksPage] Rendering task card for: ${task.taskName}, Status: ${task.status}, ID: ${task.id}`);
            return (
            <Card key={task.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="font-headline text-xl">{task.taskName}</CardTitle>
                  <Badge variant={
                    task.status === 'completed' || task.status === 'verified' ? 'default' :
                    task.status === 'in-progress' ? 'secondary' :
                    task.status === 'needs-review' ? 'outline' : 
                    'destructive' 
                  } className={
                    task.status === 'completed' || task.status === 'verified' ? 'bg-green-500 text-white' :
                    task.status === 'needs-review' ? 'border-yellow-500 text-yellow-600' : ''
                  }>
                    {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </div>
                <CardDescription>{task.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4" />
                  <span>Elapsed Time: {formatTime(task.elapsedTime)}</span>
                </div>
                 {(task.status === 'needs-review' || task.status === 'completed' || task.status === 'verified' || task.status === 'rejected') && (
                  <>
                    {task.employeeNotes && (
                      <div className="p-3 border rounded-md bg-muted/50">
                        <h4 className="font-semibold text-sm flex items-center"><MessageSquare className="w-4 h-4 mr-2"/>Your Notes</h4>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.employeeNotes}</p>
                      </div>
                    )}
                    {task.aiRisks && task.aiRisks.length > 0 && (
                      <div className="p-3 border rounded-md bg-destructive/10 border-destructive/50">
                        <h4 className="font-semibold text-sm flex items-center text-destructive"><AlertTriangle className="w-4 h-4 mr-2"/>AI Detected Risks</h4>
                        <ul className="list-disc list-inside text-xs text-destructive/90">
                          {task.aiRisks.map((risk, i) => <li key={i}>{risk}</li>)}
                        </ul>
                        {task.aiComplianceNotes && <p className="text-xs text-muted-foreground mt-1">AI Suggestion: {task.aiComplianceNotes}</p>}
                      </div>
                    )}
                     {task.aiRisks && task.aiRisks.length === 0 && task.status === 'completed' && (
                         <div className="p-3 border rounded-md bg-green-500/10 border-green-500/50">
                            <h4 className="font-semibold text-sm flex items-center text-green-700"><CheckCircle className="w-4 h-4 mr-2"/>AI Compliance</h4>
                            <p className="text-xs text-green-600">No compliance risks detected by AI.</p>
                         </div>
                     )}
                  </>
                 )}
              </CardContent>
              <CardFooter className="grid grid-cols-2 gap-2 pt-4">
                {task.status === 'pending' && (
                  <Button onClick={() => handleStartTask(task.id)} className="w-full col-span-2" disabled={isUpdatingTask[task.id] || !isTaskActionable(task.status)}>
                    {isUpdatingTask[task.id] ? "Starting..." : <><Play className="mr-2 h-4 w-4" /> Start Task</>}
                  </Button>
                )}
                {task.status === 'in-progress' && (
                  <>
                    <Button variant="outline" onClick={() => handlePauseTask(task.id)} className="w-full" disabled={isUpdatingTask[task.id] || !isTaskActionable(task.status)}>
                      <Pause className="mr-2 h-4 w-4" /> Pause
                    </Button>
                    <Button onClick={() => handleCompleteTask(task)} className="w-full" disabled={isUpdatingTask[task.id] || !isTaskActionable(task.status)}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Complete Task
                    </Button>
                  </>
                )}
                {task.status === 'paused' && (
                  <>
                    <Button onClick={() => handleStartTask(task.id)} className="w-full" disabled={isUpdatingTask[task.id] || !isTaskActionable(task.status)}>
                      {isUpdatingTask[task.id] ? "Resuming..." : <><Play className="mr-2 h-4 w-4" /> Resume Task</>}
                    </Button>
                     <Button onClick={() => handleCompleteTask(task)} className="w-full" disabled={isUpdatingTask[task.id] || !isTaskActionable(task.status)}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Complete Task
                    </Button>
                  </>
                )}
                {(task.status === 'completed' || task.status === 'verified') && (
                  <p className="col-span-2 text-sm text-green-600 text-center font-semibold py-2">Task Completed!</p>
                )}
                 {task.status === 'needs-review' && (
                    <p className="col-span-2 text-sm text-yellow-600 text-center font-semibold py-2">Task Needs Supervisor Review</p>
                 )}
                 {task.status === 'rejected' && (
                    <p className="col-span-2 text-sm text-destructive text-center font-semibold py-2">Task Rejected - Check Notes</p>
                 )}
              </CardFooter>
            </Card>
          )})}
        </div>
      )}

      {selectedTaskForSubmission && (
        <Dialog open={showSubmissionModal} onOpenChange={setShowSubmissionModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-headline">Submit Task: {selectedTaskForSubmission.taskName}</DialogTitle>
              <DialogDescription>
                Upload media and add notes for task completion.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="media-upload">Upload Media (Photo/Video - 1 file for now)</Label>
                <Input id="media-upload" type="file" accept="image/*,video/*" onChange={handleMediaChange} className="mt-1" />
                {submissionMedia.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Selected: {submissionMedia[0].name}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="task-notes">Notes</Label>
                <Textarea 
                  id="task-notes" 
                  placeholder="Add any relevant notes about the task completion..." 
                  value={submissionNotes} 
                  onChange={(e) => setSubmissionNotes(e.target.value)} 
                  className="mt-1 min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSubmissionModal(false)} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={submitTaskForCompletion} disabled={isSubmitting} className="bg-accent hover:bg-accent/90">
                {isSubmitting ? "Submitting..." : <><Upload className="mr-2 h-4 w-4" /> Submit & Run Compliance</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

