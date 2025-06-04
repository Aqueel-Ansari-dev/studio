
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
import { analyzeComplianceRisk, ComplianceRiskAnalysisOutput } from "@/ai/flows/compliance-risk-analysis";
// NOTE: attendanceAnomalyDetection is likely for supervisor use, not direct employee task interaction.
// import { attendanceAnomalyDetection } from '@/ai/flows/attendance-anomaly-detection'; 
import { fetchMyTasksForProject, fetchProjectDetails, TaskWithId, ProjectWithId } from '@/app/actions/employee/fetchEmployeeData';
import type { TaskStatus } from '@/types/database';


// Extended Task interface for local state management, including UI-specific fields.
interface LocalTask extends TaskWithId {
  startTime?: number; // Timestamp (milliseconds since epoch) when task moved to 'in-progress' locally
  // elapsedTime is part of TaskWithId, so it will be fetched or managed locally.
  media?: File[]; // For submission modal
  notes?: string; // For submission modal & display
  complianceResult?: ComplianceRiskAnalysisOutput; // For AI check display
}

export default function EmployeeTasksPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [projectDetails, setProjectDetails] = useState<ProjectWithId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTimers, setActiveTimers] = useState<Record<string, NodeJS.Timeout | null>>({});
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<LocalTask | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionMedia, setSubmissionMedia] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const [fetchedProjectDetails, fetchedTasks] = await Promise.all([
        fetchProjectDetails(projectId),
        fetchMyTasksForProject(projectId)
      ]);
      
      setProjectDetails(fetchedProjectDetails);
      // Initialize elapsedTime if not present or ensure it's a number
      setTasks(fetchedTasks.map(task => ({ ...task, elapsedTime: task.elapsedTime || 0 })));

    } catch (error) {
      console.error("Failed to load project tasks:", error);
      toast({
        title: "Error",
        description: "Could not load tasks for this project.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // IMPORTANT NOTE: The following task modification functions (handleStartTask, handlePauseTask, etc.)
  // currently ONLY update the local component state. They DO NOT persist these changes to Firestore.
  // A full implementation would require converting these to Server Actions that update the database.

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

  const handleStartTask = (taskId: string) => {
    // TODO: Convert to Server Action to update Firestore
    setTasks(prevTasks => prevTasks.map(task =>
      task.id === taskId ? { ...task, status: 'in-progress', startTime: Date.now(), elapsedTime: task.elapsedTime || 0 } : task
    ));
    console.log(`(Local) Attendance logged for task ${taskId} start.`);
    toast({ title: "Task Started (Local)", description: "Timer is running. This change is not saved." });
  };

  const handlePauseTask = (taskId: string) => {
    // TODO: Convert to Server Action to update Firestore
    setTasks(prevTasks => prevTasks.map(task =>
      task.id === taskId ? { ...task, status: 'paused' } : task
    ));
    toast({ title: "Task Paused (Local)", description: "Timer has been paused. This change is not saved." });
  };

  const handleCompleteTask = (task: LocalTask) => {
    // TODO: Convert to Server Action to update Firestore
    setSelectedTaskForSubmission(task);
    setSubmissionNotes(task.notes || "");
    setSubmissionMedia([]); 
    setShowSubmissionModal(true);
  };

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSubmissionMedia(Array.from(event.target.files));
    }
  };
  
  const submitTask = async () => {
    // TODO: Convert to Server Action to update Firestore
    if (!selectedTaskForSubmission) return;
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
        console.error("Error converting file to data URI:", error);
        toast({ title: "Error", description: "Could not process media file.", variant: "destructive" });
        mediaDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      }
    }
    
    const mockLocationData = "34.0522° N, 118.2437° W"; 
    const mockSupervisorNotes = "Employee has a good track record.";

    try {
      const complianceResult = await analyzeComplianceRisk({
        mediaDataUri: mediaDataUri,
        locationData: mockLocationData,
        supervisorNotes: mockSupervisorNotes,
      });

      setTasks(prevTasks => prevTasks.map(t =>
        t.id === selectedTaskForSubmission.id ? { 
          ...t, 
          status: 'compliance-check', 
          notes: submissionNotes, 
          media: submissionMedia, 
          complianceResult 
        } : t
      ));
      toast({ title: "Task Submitted (Local)", description: "Compliance check in progress. This change is not saved." });

    } catch (error) {
      console.error("Compliance check error:", error);
      toast({ title: "Submission Error", description: "Failed to run compliance check.", variant: "destructive" });
      setTasks(prevTasks => prevTasks.map(t =>
        t.id === selectedTaskForSubmission.id ? { 
          ...t, 
          status: 'completed', // Fallback if AI fails
          notes: submissionNotes, 
          media: submissionMedia
        } : t
      ));
    } finally {
      setShowSubmissionModal(false);
      setSelectedTaskForSubmission(null);
      setSubmissionNotes("");
      setSubmissionMedia([]);
      setIsSubmitting(false);
    }
  };

  const finalizeCompliance = (taskId: string, approved: boolean) => {
    // TODO: Convert to Server Action to update Firestore
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        if (approved) {
          toast({ title: "Compliance Approved (Local)", description: `Task "${task.name}" marked as complete. This change is not saved.` });
          return { ...task, status: 'completed' as TaskStatus }; // Cast to TaskStatus
        } else {
          // This case (rejecting) needs supervisor intervention or a different flow.
          // For now, just showing a toast and reverting locally.
          toast({ title: "Action Noted (Local)", description: `Task "${task.name}" would need further review. This change is not saved.`, variant: "default" });
          return { ...task, status: 'needs-review' as TaskStatus, complianceResult: undefined };
        }
      }
      return task;
    }));
  };

  const formatTime = (totalSeconds: number = 0) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const projectName = projectDetails?.name || "Project Tasks";

  if (isLoading) {
    return (
        <div className="space-y-6">
            <PageHeader title="Loading..." description="Fetching project details and tasks." />
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-12 w-12 mb-4 animate-spin" />
                    <p className="font-semibold">Loading tasks...</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={projectName}
        description={`Manage your tasks for ${projectName}.`} 
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
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="font-headline text-xl">{task.name || task.taskName}</CardTitle>
                  <Badge variant={
                    task.status === 'completed' ? 'default' :
                    task.status === 'in-progress' ? 'secondary' :
                    task.status === 'compliance-check' ? 'outline' : 
                    'destructive' // pending, paused, needs-review, rejected, verified
                  } className={
                    task.status === 'completed' || task.status === 'verified' ? 'bg-green-500 text-white' :
                    task.status === 'compliance-check' || task.status === 'needs-review' ? 'border-yellow-500 text-yellow-600' : ''
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
                {task.status === 'compliance-check' && task.complianceResult && (
                  <div className="p-3 border rounded-md bg-muted/50 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center"><AlertTriangle className="w-4 h-4 mr-2 text-yellow-500"/>AI Compliance Review</h4>
                    {task.complianceResult.complianceRisks && task.complianceResult.complianceRisks.length > 0 ? (
                      <>
                        <p className="text-xs text-destructive">Risks: {task.complianceResult.complianceRisks.join(', ')}</p>
                        <p className="text-xs">Employee needs to provide: {task.complianceResult.additionalInformationNeeded}</p>
                        {/* Supervisor actions removed from employee view if AI detects risk */}
                         <p className="text-xs text-muted-foreground mt-1">This task requires supervisor review.</p>
                      </>
                    ) : (
                      <p className="text-xs text-green-600">No immediate compliance risks detected by AI.</p>
                    )}
                  </div>
                )}
                {task.status === 'completed' && task.notes && (
                  <div className="p-3 border rounded-md bg-muted/50">
                     <h4 className="font-semibold text-sm flex items-center"><MessageSquare className="w-4 h-4 mr-2"/>Notes</h4>
                     <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="grid grid-cols-2 gap-2">
                {task.status === 'pending' && (
                  <Button onClick={() => handleStartTask(task.id)} className="w-full">
                    <Play className="mr-2 h-4 w-4" /> Start
                  </Button>
                )}
                {task.status === 'in-progress' && (
                  <>
                    <Button variant="outline" onClick={() => handlePauseTask(task.id)} className="w-full">
                      <Pause className="mr-2 h-4 w-4" /> Pause
                    </Button>
                    <Button onClick={() => handleCompleteTask(task)} className="w-full">
                      <CheckCircle className="mr-2 h-4 w-4" /> Complete
                    </Button>
                  </>
                )}
                {task.status === 'paused' && (
                  <>
                    <Button onClick={() => handleStartTask(task.id)} className="w-full">
                      <Play className="mr-2 h-4 w-4" /> Resume
                    </Button>
                     <Button onClick={() => handleCompleteTask(task)} className="w-full">
                      <CheckCircle className="mr-2 h-4 w-4" /> Complete
                    </Button>
                  </>
                )}
                {(task.status === 'completed' || task.status === 'verified') && (
                  <p className="col-span-2 text-sm text-green-600 text-center font-semibold">Task Completed!</p>
                )}
                 {task.status === 'compliance-check' && task.complianceResult && (!task.complianceResult.complianceRisks || task.complianceResult.complianceRisks.length === 0) && (
                  <Button onClick={() => finalizeCompliance(task.id, true)} className="w-full col-span-2 bg-green-500 hover:bg-green-600">
                    <CheckCircle className="mr-2 h-4 w-4" /> Finalize Completion
                  </Button>
                )}
                 {task.status === 'needs-review' && (
                    <p className="col-span-2 text-sm text-yellow-600 text-center font-semibold">Task Needs Supervisor Review</p>
                 )}
                 {task.status === 'rejected' && (
                    <p className="col-span-2 text-sm text-destructive text-center font-semibold">Task Rejected - Check Notes</p>
                 )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {selectedTaskForSubmission && (
        <Dialog open={showSubmissionModal} onOpenChange={setShowSubmissionModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-headline">Submit Task: {selectedTaskForSubmission.name || selectedTaskForSubmission.taskName}</DialogTitle>
              <DialogDescription>
                Upload media and add notes for task completion. (These changes will not be saved yet.)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="media-upload">Upload Media (Photo/Video)</Label>
                <Input id="media-upload" type="file" accept="image/*,video/*" multiple onChange={handleMediaChange} className="mt-1" />
                {submissionMedia.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {submissionMedia.length} file(s) selected: {submissionMedia.map(f => f.name).join(', ')}
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
              <Button onClick={submitTask} disabled={isSubmitting} className="bg-accent hover:bg-accent/90">
                {isSubmitting ? "Submitting..." : <><Upload className="mr-2 h-4 w-4" /> Submit & Run Compliance</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
