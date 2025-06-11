
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { LogIn, LogOut, Camera, RefreshCw, AlertTriangle } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation'; // Import useRouter
import { fetchAllProjects, type ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { logAttendance, checkoutAttendance, getGlobalActiveCheckIn } from '@/app/actions/attendance';
import type { GlobalActiveCheckInResult } from '@/app/actions/attendance';

interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export default function AttendanceButton() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter(); // Initialize useRouter

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<'punch-in' | 'punch-out' | null>(null);
  
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [activeSessionInfo, setActiveSessionInfo] = useState<GlobalActiveCheckInResult['activeLog'] | null>(null);
  
  const [projectsList, setProjectsList] = useState<ProjectForSelection[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  const [selfieDataUri, setSelfieDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitialStatus, setIsFetchingInitialStatus] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const fetchInitialStatusAndProjects = useCallback(async () => {
    if (!user || user.role !== 'employee') {
        setIsPunchedIn(false);
        setActiveSessionInfo(null);
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
  }, [user, toast]);

  useEffect(() => {
    if (user && user.role === 'employee' && !authLoading) {
      fetchInitialStatusAndProjects();
    } else if (!user && !authLoading) {
        setIsPunchedIn(false);
        setActiveSessionInfo(null);
        setIsFetchingInitialStatus(false);
    }
  }, [user, authLoading, fetchInitialStatusAndProjects]);

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

  useEffect(() => {
    if (isDialogOpen) {
      startCamera();
    } else {
      stopCamera();
      setSelfieDataUri(null); 
    }
    return () => { 
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen]); 

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current && cameraStream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const dataURL = canvas.toDataURL('image/png');
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
    if (action === 'punch-in' && projectsList.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projectsList[0].id);
    } else if (action === 'punch-in' && selectedProjectId && !projectsList.find(p => p.id === selectedProjectId)) {
      // If current selectedProjectId is not in the list (e.g. if list was empty before), reset to first available.
       setSelectedProjectId(projectsList.length > 0 ? projectsList[0].id : '');
    }
    setSelfieDataUri(null); 
    setHasCameraPermission(null); 
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !currentAction) return;
    
    if (!selfieDataUri) {
      toast({ title: "Selfie Required", description: "Please capture a selfie.", variant: "destructive" });
      return;
    }
    if (currentAction === 'punch-in' && !selectedProjectId) {
      toast({ title: "Project Required", description: "Please select a project.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const locationCoords = await getCurrentLocation();
      const gpsData = { lat: locationCoords.latitude, lng: locationCoords.longitude, accuracy: locationCoords.accuracy };

      if (currentAction === 'punch-in') {
        const result = await logAttendance(user.id, selectedProjectId, gpsData, false, selfieDataUri);
        if (result.success) {
          toast({ title: "Punch In Successful", description: result.message });
          await fetchInitialStatusAndProjects(); 
          setIsDialogOpen(false); // Close dialog on success
          router.push(`/dashboard/employee/projects/${selectedProjectId}/tasks`); // Redirect
        } else {
          toast({ title: "Punch In Failed", description: result.message, variant: "destructive" });
        }
      } else if (currentAction === 'punch-out' && activeSessionInfo) {
        const result = await checkoutAttendance(user.id, activeSessionInfo.projectId, gpsData, selfieDataUri);
        if (result.success) {
          toast({ title: "Punch Out Successful", description: result.message });
          await fetchInitialStatusAndProjects(); 
          setIsDialogOpen(false); // Close dialog on success
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
  
  if (authLoading || isFetchingInitialStatus) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button variant="outline" size="lg" className="shadow-lg rounded-full p-4 h-16 w-16" disabled>
          <RefreshCw className="h-7 w-7 animate-spin" />
        </Button>
      </div>
    );
  }

  if (!user || user.role !== 'employee') {
    return null; 
  }

  return (
    <>
      <Button
        onClick={() => handleOpenDialog(isPunchedIn ? 'punch-out' : 'punch-in')}
        size="lg"
        className={`fixed bottom-4 right-4 z-50 shadow-lg rounded-full p-4 h-16 w-16 flex items-center justify-center
                    ${isPunchedIn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
        aria-label={isPunchedIn ? 'Punch Out' : 'Punch In'}
      >
        {isPunchedIn ? <LogOut className="h-7 w-7" /> : <LogIn className="h-7 w-7" />}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) stopCamera(); 
          setIsDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline">
              {currentAction === 'punch-in' ? 'Punch In' : 'Punch Out'}
              {activeSessionInfo && currentAction === 'punch-out' && ` from ${activeSessionInfo.projectName}`}
            </DialogTitle>
            <DialogDescription>
              {currentAction === 'punch-in' 
                ? "Capture a selfie and select your project to punch in." 
                : "Capture a selfie to punch out."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center space-y-3">
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
              <div className="space-y-1">
                <Label htmlFor="project-select-dialog">Project</Label>
                <Select 
                    value={selectedProjectId} 
                    onValueChange={setSelectedProjectId} 
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
             {hasCameraPermission === null && !cameraStream && (
                 <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700">
                    <AlertTriangle className="h-4 w-4 !text-blue-700" />
                    <AlertTitle>Camera Access</AlertTitle>
                    <AlertDescription>
                       Waiting for camera permission... If prompted, please allow access.
                    </AlertDescription>
                </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
            </DialogClose>
            <Button 
                type="button" 
                onClick={handleSubmit} 
                disabled={isLoading || !selfieDataUri || (currentAction === 'punch-in' && !selectedProjectId) || hasCameraPermission === false}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : (currentAction === 'punch-in' ? <LogIn className="mr-2 h-4 w-4" /> : <LogOut className="mr-2 h-4 w-4" />)}
              {isLoading ? 'Processing...' : (currentAction === 'punch-in' ? 'Punch In' : 'Punch Out')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
