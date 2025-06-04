
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Play, Pause, CheckCircle, Clock, AlertTriangle, Upload, MessageSquare, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { analyzeComplianceRisk, ComplianceRiskAnalysisOutput } from "@/ai/flows/compliance-risk-analysis";
import { attendanceAnomalyDetection } from '@/ai/flows/attendance-anomaly-detection'; // Import for potential supervisor use

interface Task {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'paused' | 'completed' | 'compliance-check';
  startTime?: number;
  elapsedTime: number; // in seconds
  media?: File[];
  notes?: string;
  complianceResult?: ComplianceRiskAnalysisOutput;
}

// Mock data for tasks, keyed by projectId
const mockTasksByProject: Record<string, Task[]> = {
  "proj1": [
    { id: "task1a", projectId: "proj1", name: "Install Workstations", description: "Set up 10 workstations in the main hall.", status: "pending", elapsedTime: 0 },
    { id: "task1b", projectId: "proj1", name: "Network Cabling", description: "Run network cables to all designated points.", status: "pending", elapsedTime: 0 },
  ],
  "proj2": [
    { id: "task2a", projectId: "proj2", name: "HVAC Unit Inspection", description: "Inspect and clean HVAC units in building A.", status: "in-progress", startTime: Date.now() - 3600000, elapsedTime: 3600 }, // 1 hour ago
    { id: "task2b", projectId: "proj2", name: "Plumbing Check - Apt 101", description: "Check for leaks and fixture operations.", status: "completed", elapsedTime: 1800, notes: "Minor faucet leak fixed." },
  ],
  "proj3": [
    { id: "task3a", projectId: "proj3", name: "Plant Trees - Zone 1", description: "Plant 50 saplings in the designated Zone 1.", status: "paused", elapsedTime: 7200 },
  ],
};

// Mock project names
const mockProjectDetails: Record<string, { name: string }> = {
  "proj1": { name: "Downtown Office Build" },
  "proj2": { name: "Residential Complex Maintenance" },
  "proj3": { name: "City Park Landscaping" },
};


export default function EmployeeTasksPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTimers, setActiveTimers] = useState<Record<string, NodeJS.Timeout | null>>({});
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<Task | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionMedia, setSubmissionMedia] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTasks(mockTasksByProject[projectId] || []);
  }, [projectId]);

  useEffect(() => {
    tasks.forEach(task => {
      if (task.status === 'in-progress' && task.startTime && !activeTimers[task.id]) {
        const timerId = setInterval(() => {
          setTasks(prevTasks => prevTasks.map(t =>
            t.id === task.id ? { ...t, elapsedTime: t.elapsedTime + 1 } : t
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
    setTasks(prevTasks => prevTasks.map(task =>
      task.id === taskId ? { ...task, status: 'in-progress', startTime: Date.now() } : task
    ));
    // Placeholder for automated attendance logging
    console.log(`Attendance logged for task ${taskId} start.`);
    toast({ title: "Task Started", description: "Timer is running and attendance logged." });
  };

  const handlePauseTask = (taskId: string) => {
    setTasks(prevTasks => prevTasks.map(task =>
      task.id === taskId ? { ...task, status: 'paused' } : task
    ));
    toast({ title: "Task Paused", description: "Timer has been paused." });
  };

  const handleCompleteTask = (task: Task) => {
    setSelectedTaskForSubmission(task);
    setSubmissionNotes(task.notes || "");
    // Reset media; actual files don't persist well in this mock state
    setSubmissionMedia([]); 
    setShowSubmissionModal(true);
  };

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSubmissionMedia(Array.from(event.target.files));
    }
  };
  
  const submitTask = async () => {
    if (!selectedTaskForSubmission) return;
    setIsSubmitting(true);

    // Simulate media upload to data URI for AI flow
    let mediaDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // Placeholder 1x1 transparent png
    if (submissionMedia.length > 0) {
      const file = submissionMedia[0]; // Use first file for demo
      try {
        mediaDataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
        });
      } catch (error) {
        console.error("Error converting file to data URI:", error);
        toast({ title: "Error", description: "Could not process media file for compliance check.", variant: "destructive" });
        mediaDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // Fallback
      }
    }
    
    // Mock GPS data and supervisor notes for AI
    const mockLocationData = "34.0522° N, 118.2437° W"; // LA coordinates
    const mockSupervisorNotes = "Employee has a good track record on similar tasks.";

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
          media: submissionMedia, // Note: File objects might not be ideal for long-term state here
          complianceResult 
        } : t
      ));
      toast({ title: "Task Submitted", description: "Compliance check in progress." });

    } catch (error) {
      console.error("Compliance check error:", error);
      toast({ title: "Submission Error", description: "Failed to run compliance check.", variant: "destructive" });
      // Still mark task as completed but without compliance result if AI fails
      setTasks(prevTasks => prevTasks.map(t =>
        t.id === selectedTaskForSubmission.id ? { 
          ...t, 
          status: 'completed', 
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
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        if (approved) {
          toast({ title: "Compliance Approved", description: `Task "${task.name}" marked as complete.` });
          return { ...task, status: 'completed' };
        } else {
          toast({ title: "Compliance Rejected", description: `Task "${task.name}" needs further review. Reverted to in-progress.`, variant: "destructive" });
          return { ...task, status: 'in-progress', complianceResult: undefined }; // Revert to in-progress or another state
        }
      }
      return task;
    }));
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const projectName = mockProjectDetails[projectId]?.name || "Project Tasks";

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
                  <CardTitle className="font-headline text-xl">{task.name}</CardTitle>
                  <Badge variant={
                    task.status === 'completed' ? 'default' :
                    task.status === 'in-progress' ? 'secondary' :
                    task.status === 'compliance-check' ? 'outline' : // Use outline for AI check
                    'destructive' // pending, paused
                  } className={
                    task.status === 'completed' ? 'bg-green-500 text-white' :
                    task.status === 'compliance-check' ? 'border-yellow-500 text-yellow-600' : ''
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
                    {task.complianceResult.complianceRisks.length > 0 ? (
                      <>
                        <p className="text-xs text-destructive">Risks: {task.complianceResult.complianceRisks.join(', ')}</p>
                        <p className="text-xs">Employee needs to provide: {task.complianceResult.additionalInformationNeeded}</p>
                        <div className="flex gap-2 mt-2">
                           <Button size="sm" variant="outline" onClick={() => finalizeCompliance(task.id, false)}>Reject & Reopen</Button>
                           <Button size="sm" onClick={() => finalizeCompliance(task.id, true)}>Approve Manually</Button>
                        </div>
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
                    <Button onClick={() => handleStartTask(task.id)} className="w-full"> {/* Resumes by setting to in-progress */}
                      <Play className="mr-2 h-4 w-4" /> Resume
                    </Button>
                     <Button onClick={() => handleCompleteTask(task)} className="w-full">
                      <CheckCircle className="mr-2 h-4 w-4" /> Complete
                    </Button>
                  </>
                )}
                {task.status === 'completed' && (
                  <p className="col-span-2 text-sm text-green-600 text-center font-semibold">Task Completed!</p>
                )}
                 {task.status === 'compliance-check' && !task.complianceResult?.complianceRisks.length && (
                  <Button onClick={() => finalizeCompliance(task.id, true)} className="w-full col-span-2 bg-green-500 hover:bg-green-600">
                    <CheckCircle className="mr-2 h-4 w-4" /> Finalize Completion
                  </Button>
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
              <DialogTitle className="font-headline">Submit Task: {selectedTaskForSubmission.name}</DialogTitle>
              <DialogDescription>
                Upload media and add notes for task completion.
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
