
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { LogIn, LogOut, Camera, RefreshCw, AlertTriangle, ListChecks, ImagePlus, Mic, Play, Square as StopIcon, Trash2 } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { fetchAllProjects, type ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { fetchMyTasksForProject, TaskWithId } from '@/app/actions/employee/fetchEmployeeData';
import { logAttendance, checkoutAttendance, getGlobalActiveCheckIn, CheckoutAttendanceInput } from '@/app/actions/attendance';
import type { GlobalActiveCheckInResult } from '@/app/actions/attendance';

interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export default function AttendanceButton() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [isClientMounted, setIsClientMounted] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<'punch-in' | 'punch-out' | null>(null);
  
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [activeSessionInfo, setActiveSessionInfo] = useState<GlobalActiveCheckInResult['activeLog'] | null>(null);
  
  const [projectsList, setProjectsList] = useState<ProjectForSelection[]>([]);
  const [selectedProjectIdDialog, setSelectedProjectIdDialog] = useState<string>(''); 
  
  const [selfieDataUri, setSelfieDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); 
  const [isFetchingInitialStatus, setIsFetchingInitialStatus] = useState(true); 
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const [tasksForPunchOut, setTasksForPunchOut] = useState<TaskWithId[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Record<string, boolean>>({});
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionPhotoFile, setSessionPhotoFile] = useState<File | null>(null);
  const [sessionPhotoPreview, setSessionPhotoPreview] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [sessionAudioDataUri, setSessionAudioDataUri] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);


  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  const fetchInitialStatusAndProjects = useCallback(async () => {
    if (!user || !['employee', 'supervisor'].includes(user.role)) {
        setIsPunchedIn(false);
        setActiveSessionInfo(null);
        setProjectsList([]);
        setIsFetchingInitialStatus(false);
        return;
    }
    setIsFetchingInitialStatus(true);
    try {
      const [globalStatusResult, projectsResult] = await Promise.all([
        getGlobalActiveCheckIn(user.id),
        fetchAllProjects()
      ]);

      if (globalStatusResult.activeLog) {
        setIsPunchedIn(true);
        setActiveSessionInfo(globalStatusResult.activeLog);
      } else {
        setIsPunchedIn(false);
        setActiveSessionInfo(null);
        if(globalStatusResult.error) {
            console.warn("Error fetching global active status:", globalStatusResult.error);
        }
      }

      if (projectsResult.success && projectsResult.projects) {
        setProjectsList(projectsResult.projects);
         if (projectsResult.projects.length > 0 && !selectedProjectIdDialog) {
          setSelectedProjectIdDialog(projectsResult.projects[0].id); 
        }
      } else {
        setProjectsList([]);
        toast({ title: "Error", description: projectsResult.error || "Could not load projects.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Initializing", description: "Could not fetch initial attendance status or projects.", variant: "destructive" });
      setIsPunchedIn(false);
      setActiveSessionInfo(null);
      setProjectsList([]);
    } finally {
      setIsFetchingInitialStatus(false);
    }
  }, [user, toast, selectedProjectIdDialog]);

  useEffect(() => {
    if (isClientMounted && user && ['employee', 'supervisor'].includes(user.role) && !authLoading) {
      fetchInitialStatusAndProjects();
    } else if (isClientMounted && !user && !authLoading) {
        setIsPunchedIn(false);
        setActiveSessionInfo(null);
        setProjectsList([]);
        setIsFetchingInitialStatus(false);
    }
  }, [isClientMounted, user, authLoading, fetchInitialStatusAndProjects]);

  const startCamera = async () => {
    if (cameraStream) return; 
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings.',
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };
  
  const fetchTasksForActiveProject = useCallback(async () => {
    if (user?.id && activeSessionInfo?.projectId) {
        setIsLoading(true);
        const tasksResult = await fetchMyTasksForProject(user.id, activeSessionInfo.projectId);
        if (tasksResult.success && tasksResult.tasks) {
            setTasksForPunchOut(tasksResult.tasks.filter(t => t.status === 'pending' || t.status === 'in-progress' || t.status === 'paused'));
        } else {
            setTasksForPunchOut([]);
            toast({ title: "Error fetching tasks", description: tasksResult.error || "Could not load tasks for punch-out.", variant: "destructive" });
        }
        setIsLoading(false);
    } else {
        setTasksForPunchOut([]);
    }
  }, [user?.id, activeSessionInfo?.projectId, toast]);


  useEffect(() => {
    if (isClientMounted && isDialogOpen) {
      startCamera();
      if (currentAction === 'punch-out') {
        fetchTasksForActiveProject();
      }
    } else {
      stopCamera();
      setSelfieDataUri(null); 
      setTasksForPunchOut([]);
      setSelectedTaskIds({});
      setSessionNotes('');
      setSessionPhotoFile(null);
      setSessionPhotoPreview(null);
      setSessionAudioDataUri(null);
      setIsRecordingAudio(false);
      audioChunksRef.current = [];
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    }
  }, [isClientMounted, isDialogOpen, currentAction, fetchTasksForActiveProject]); 

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current && cameraStream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const dataURL = canvas.toDataURL('image/jpeg', 0.7); // Use JPEG and set quality to 0.7
      setSelfieDataUri(dataURL);
    } else {
      toast({ title: "Selfie Error", description: "Camera not ready or stream unavailable.", variant: "destructive" });
    }
  };

  const getCurrentLocation = (): Promise<GeolocationCoordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleOpenDialog = (action: 'punch-in' | 'punch-out') => {
    setCurrentAction(action);
    if (action === 'punch-in' && projectsList.length > 0 && !selectedProjectIdDialog) {
      setSelectedProjectIdDialog(projectsList[0].id);
    } else if (action === 'punch-in' && selectedProjectIdDialog && !projectsList.find(p => p.id === selectedProjectIdDialog)) {
       setSelectedProjectIdDialog(projectsList.length > 0 ? projectsList[0].id : '');
    }
    setSelfieDataUri(null); 
    setHasCameraPermission(null); 
    setIsDialogOpen(true);
  };

  const handleSessionPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        setSessionPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setSessionPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    } else {
        setSessionPhotoFile(null);
        setSessionPhotoPreview(null);
    }
  };

  const handleStartRecording = async () => {
    try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(audioStream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const reader = new FileReader();
            reader.onloadend = () => {
                setSessionAudioDataUri(reader.result as string);
                 if (audioRef.current) {
                    audioRef.current.src = reader.result as string;
                }
            };
            reader.readAsDataURL(audioBlob);

            audioStream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsRecordingAudio(true);
        setSessionAudioDataUri(null); 
    } catch (err) {
        toast({ title: "Audio Recording Error", description: "Could not start audio recording. Check microphone permissions.", variant: "destructive" });
        console.error("Error starting audio recording:", err);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        setIsRecordingAudio(false);
    }
  };
  
  const handleClearAudio = () => {
    setSessionAudioDataUri(null);
    if (audioRef.current) {
        audioRef.current.src = "";
    }
    audioChunksRef.current = [];
  }

  const handleSubmit = async () => {
    if (!user || !currentAction) return;
    
    if (!selfieDataUri) {
      toast({ title: "Selfie Required", description: "Please capture a selfie.", variant: "destructive" });
      return;
    }
    if (currentAction === 'punch-in' && !selectedProjectIdDialog) {
      toast({ title: "Project Required", description: "Please select a project.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const locationCoords = await getCurrentLocation();
      const gpsData = { lat: locationCoords.latitude, lng: locationCoords.longitude, accuracy: locationCoords.accuracy };
      let sessionPhotoDataUriForAction: string | undefined = undefined;
      if (sessionPhotoFile) {
          sessionPhotoDataUriForAction = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(sessionPhotoFile);
          });
      }


      if (currentAction === 'punch-in') {
        const result = await logAttendance(user.id, selectedProjectIdDialog, gpsData, false, selfieDataUri);
        if (result.success) {
          toast({ title: "Punch In Successful", description: result.message });
          await fetchInitialStatusAndProjects(); 
          setIsDialogOpen(false);
          router.push(`/dashboard/employee/projects/${selectedProjectIdDialog}/tasks`);
        } else {
          toast({ title: "Punch In Failed", description: result.message, variant: "destructive" });
        }
      } else if (currentAction === 'punch-out' && activeSessionInfo) {
        const taskIdsToSubmit = Object.entries(selectedTaskIds).filter(([, isSelected]) => isSelected).map(([taskId]) => taskId);
        const checkoutInput: CheckoutAttendanceInput = {
            employeeId: user.id,
            projectId: activeSessionInfo.projectId,
            gpsLocation: gpsData,
            selfieCheckOutUrl: selfieDataUri,
            completedTaskIds: taskIdsToSubmit,
            sessionNotes: sessionNotes,
            sessionPhotoDataUri: sessionPhotoDataUriForAction,
            sessionAudioDataUri: sessionAudioDataUri || undefined,
        };
        const result = await checkoutAttendance(checkoutInput);
        if (result.success) {
          toast({ title: "Punch Out Successful", description: result.message });
          await fetchInitialStatusAndProjects(); 
          setIsDialogOpen(false);
        } else {
          toast({ title: "Punch Out Failed", description: result.message, variant: "destructive" });
        }
      }
    } catch (error: any) {
      toast({ title: "Operation Failed", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isClientMounted || authLoading) {
    return null;
  }

  if (!user || user.role === 'admin') {
    return null;
  }

  if (isFetchingInitialStatus) {
    return (
      <div className="fixed md:bottom-4 md:right-4 bottom-8 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 z-50">
        <Button variant="outline" size="lg" className="shadow-lg rounded-full p-4 h-16 w-16" disabled>
          <RefreshCw className="h-7 w-7 animate-spin" />
        </Button>
      </div>
    );
  }

  if (!['employee', 'supervisor'].includes(user.role)) {
    return null; 
  }

  return (
    <>
      <Button
        onClick={() => handleOpenDialog(isPunchedIn ? 'punch-out' : 'punch-in')}
        size="lg"
        className={`fixed z-50 shadow-lg rounded-full p-4 h-16 w-16 flex items-center justify-center
                    md:bottom-4 md:right-4 md:left-auto md:translate-x-0
                    bottom-8 left-1/2 -translate-x-1/2
                    ${isPunchedIn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
        aria-label={isPunchedIn ? 'Punch Out' : 'Punch In'}
      >
        {isPunchedIn ? <LogOut className="h-7 w-7" /> : <LogIn className="h-7 w-7" />}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open); 
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline">
              {currentAction === 'punch-in' ? 'Punch In' : 'Punch Out'}
              {activeSessionInfo && currentAction === 'punch-out' && ` from ${activeSessionInfo.projectName}`}
            </DialogTitle>
            <DialogDescription>
              {currentAction === 'punch-in' 
                ? "Capture a selfie and select your project." 
                : "Review tasks, add notes/media, and capture a selfie to punch out."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-y-auto px-1 flex-grow">
            <div className="flex flex-col items-center space-y-3">
              <Label className="font-semibold">1. Selfie Verification</Label>
              <div className="relative w-40 h-40 rounded-full overflow-hidden border-2 border-primary bg-muted">
                {selfieDataUri ? (
                  <img src={selfieDataUri} alt="Selfie Preview" className="w-full h-full object-cover" />
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scaleX-[-1]" />
                )}
                 {hasCameraPermission === false && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white p-2 text-center">
                        <AlertTriangle className="h-8 w-8 mb-2" />
                        <p className="text-xs">Camera permission denied or camera not found.</p>
                    </div>
                )}
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <Button onClick={captureSelfie} variant="outline" size="sm" disabled={isLoading || hasCameraPermission === false || !cameraStream}>
                <Camera className="mr-2 h-4 w-4" /> {selfieDataUri ? "Retake Selfie" : "Capture Selfie"}
              </Button>
            </div>

            {currentAction === 'punch-in' && (
              <div className="space-y-2">
                <Label htmlFor="project-select-dialog" className="font-semibold">2. Select Project</Label>
                <Select 
                    value={selectedProjectIdDialog} 
                    onValueChange={setSelectedProjectIdDialog} 
                    disabled={isLoading || projectsList.length === 0}
                >
                  <SelectTrigger id="project-select-dialog">
                    <SelectValue placeholder={projectsList.length === 0 ? "No projects available" : "Select a project"} />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsList.length > 0 ? (
                      projectsList.map(proj => (
                        <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="loading" disabled>No projects found.</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentAction === 'punch-out' && (
              <>
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center"><ListChecks className="mr-2 h-4 w-4"/> 2. Completed Tasks</Label>
                  {isLoading && <p className="text-xs text-muted-foreground">Loading tasks...</p>}
                  {!isLoading && tasksForPunchOut.length === 0 && <p className="text-xs text-muted-foreground">No pending/active tasks found for this project.</p>}
                  <div className="max-h-40 overflow-y-auto space-y-1 border p-2 rounded-md">
                    {tasksForPunchOut.map(task => (
                      <div key={task.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`task-${task.id}`} 
                          checked={!!selectedTaskIds[task.id]}
                          onCheckedChange={(checked) => setSelectedTaskIds(prev => ({...prev, [task.id]: !!checked}))}
                        />
                        <Label htmlFor={`task-${task.id}`} className="text-sm font-normal cursor-pointer">{task.taskName}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session-notes" className="font-semibold">3. Session Notes (Optional)</Label>
                  <Textarea 
                    id="session-notes" 
                    placeholder="Any notes for this work session..." 
                    value={sessionNotes} 
                    onChange={(e) => setSessionNotes(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="session-photo" className="font-semibold flex items-center"><ImagePlus className="mr-2 h-4 w-4"/> 4. Add Photo (Optional)</Label>
                    <Input id="session-photo" type="file" accept="image/*" onChange={handleSessionPhotoChange} />
                    {sessionPhotoPreview && <img src={sessionPhotoPreview} alt="Session photo preview" className="mt-2 max-h-32 rounded" />}
                </div>
                
                <div className="space-y-2">
                    <Label className="font-semibold flex items-center"><Mic className="mr-2 h-4 w-4"/> 5. Voice Note (Optional)</Label>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleStartRecording} disabled={isRecordingAudio || isLoading}>
                            <Mic className="mr-1 h-4 w-4"/> Record
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleStopRecording} disabled={!isRecordingAudio || isLoading}>
                            <StopIcon className="mr-1 h-4 w-4"/> Stop
                        </Button>
                         {sessionAudioDataUri && (
                            <Button type="button" variant="outline" size="sm" onClick={handleClearAudio} disabled={isRecordingAudio || isLoading}>
                                <Trash2 className="mr-1 h-4 w-4"/> Clear
                            </Button>
                         )}
                    </div>
                    {isRecordingAudio && <p className="text-xs text-red-500 animate-pulse">Recording audio...</p>}
                    {sessionAudioDataUri && (
                        <div className="mt-2">
                            <audio ref={audioRef} src={sessionAudioDataUri} controls className="w-full h-10" />
                        </div>
                    )}
                </div>
              </>
            )}
            
            {hasCameraPermission === null && !cameraStream && currentAction && (
                 <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700 mt-auto">
                    <AlertTriangle className="h-4 w-4 !text-blue-700" />
                    <AlertTitle>Camera Access</AlertTitle>
                    <AlertDescription>
                       Waiting for camera permission... If prompted, please allow access.
                    </AlertDescription>
                </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
            <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
            </DialogClose>
            <Button 
                type="button" 
                onClick={handleSubmit} 
                disabled={isLoading || !selfieDataUri || (currentAction === 'punch-in' && !selectedProjectIdDialog) || hasCameraPermission === false}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : (currentAction === 'punch-in' ? <LogIn className="mr-2 h-4 w-4" /> : <LogOut className="mr-2 h-4 w-4" />)}
              {isLoading ? 'Processing...' : (currentAction === 'punch-in' ? 'Punch In' : 'Punch Out & Submit Report')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
