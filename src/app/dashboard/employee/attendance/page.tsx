
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut, MapPin, RefreshCw, Briefcase, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { 
  fetchTodaysAttendance, 
  logAttendance, 
  checkoutAttendance, 
  getGlobalActiveCheckIn,
  LogAttendanceResult, 
  CheckoutAttendanceResult, 
  FetchTodayAttendanceResult,
  GlobalActiveCheckInResult,
  AttendanceLog // Ensure AttendanceLog is imported if needed for currentAttendanceLogForSelected type
} from '@/app/actions/attendance';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, parseISO } from 'date-fns';

type AttendanceStatus = 'checked-in' | 'checked-out' | 'not-checked-in';

interface GlobalActiveSessionInfo {
  projectId: string;
  projectName: string;
  checkInTime: string; // ISO string
  attendanceId: string;
}

export default function EmployeeAttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Status for the selected project
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('not-checked-in');
  const [checkInTimeForSelected, setCheckInTimeForSelected] = useState<string | null>(null);
  const [checkOutTimeForSelected, setCheckOutTimeForSelected] = useState<string | null>(null);
  const [currentAttendanceLogForSelected, setCurrentAttendanceLogForSelected] = useState<(AttendanceLog & { id: string; checkInTime?: string; checkOutTime?: string }) | null>(null);
  
  // Global active session info
  const [globalActiveSession, setGlobalActiveSession] = useState<GlobalActiveSessionInfo | null>(null);
  const [isLoadingGlobalStatus, setIsLoadingGlobalStatus] = useState(false);

  const [isLoadingAction, setIsLoadingAction] = useState(false); // For check-in/out actions
  const [isFetchingSelectedStatus, setIsFetchingSelectedStatus] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);


  const loadProjectsList = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const fetchedProjects = await fetchAllProjects();
      setProjects(fetchedProjects);
      if (fetchedProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(fetchedProjects[0].id);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      toast({ title: "Error", description: "Could not load projects.", variant: "destructive" });
    } finally {
      setLoadingProjects(false);
    }
  }, [toast, selectedProjectId]);

  useEffect(() => {
    if (!authLoading && user) {
        loadProjectsList();
    }
  }, [authLoading, user, loadProjectsList]);

  const fetchAllStatuses = useCallback(async () => {
    if (!user?.id || !selectedProjectId) return;

    setIsFetchingSelectedStatus(true);
    setIsLoadingGlobalStatus(true);
    setGpsError(null);
    setCurrentAttendanceLogForSelected(null); // Reset log details

    try {
      const [selectedProjectResult, globalCheckInResult] = await Promise.all([
        fetchTodaysAttendance(user.id, selectedProjectId),
        getGlobalActiveCheckIn(user.id)
      ]);

      // Process selected project status
      if (selectedProjectResult.success && selectedProjectResult.attendanceLog) {
        setCurrentAttendanceLogForSelected(selectedProjectResult.attendanceLog);
        if (selectedProjectResult.attendanceLog.checkInTime) {
          setCheckInTimeForSelected(format(parseISO(selectedProjectResult.attendanceLog.checkInTime), 'p'));
          if (selectedProjectResult.attendanceLog.checkOutTime) {
            setAttendanceStatus('checked-out');
            setCheckOutTimeForSelected(format(parseISO(selectedProjectResult.attendanceLog.checkOutTime), 'p'));
          } else {
            setAttendanceStatus('checked-in');
            setCheckOutTimeForSelected(null);
          }
        } else { 
          setAttendanceStatus('not-checked-in');
          setCheckInTimeForSelected(null);
          setCheckOutTimeForSelected(null);
        }
      } else {
        setAttendanceStatus('not-checked-in');
        setCheckInTimeForSelected(null);
        setCheckOutTimeForSelected(null);
        if (!selectedProjectResult.success && selectedProjectResult.message !== 'No attendance log found for today and this project.') {
           toast({ title: "Status Error (Selected Project)", description: selectedProjectResult.message, variant: "destructive" });
        }
      }

      // Process global active check-in status
      if (globalCheckInResult.activeLog) {
        setGlobalActiveSession(globalCheckInResult.activeLog);
      } else {
        setGlobalActiveSession(null);
        if (globalCheckInResult.error) {
             toast({ title: "Status Error (Global Check-in)", description: globalCheckInResult.error, variant: "destructive" });
        }
      }

    } catch (error) {
        console.error("Error fetching statuses:", error);
        toast({ title: "Error", description: "Could not fetch attendance statuses.", variant: "destructive" });
    } finally {
        setIsFetchingSelectedStatus(false);
        setIsLoadingGlobalStatus(false);
    }
  }, [user?.id, selectedProjectId, toast]);

  useEffect(() => {
    if (user?.id && selectedProjectId) {
      fetchAllStatuses();
    }
  }, [user?.id, selectedProjectId, fetchAllStatuses]);


  const handleGpsAction = async (actionType: 'check-in' | 'check-out') => {
    if (!user?.id || !selectedProjectId) {
      toast({ title: "Error", description: "User or project not selected.", variant: "destructive" });
      return;
    }
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      toast({ title: "GPS Error", description: "Geolocation not supported.", variant: "destructive" });
      return;
    }

    setIsLoadingAction(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const gpsLocation = { lat: latitude, lng: longitude, accuracy, timestamp: Date.now() };
        
        let result: LogAttendanceResult | CheckoutAttendanceResult;
        if (actionType === 'check-in') {
          result = await logAttendance(user.id, selectedProjectId, gpsLocation);
        } else {
          result = await checkoutAttendance(user.id, selectedProjectId, gpsLocation);
        }

        if (result.success) {
          toast({ title: "Success", description: result.message });
          await fetchAllStatuses(); 
        } else {
          toast({ title: "Action Failed", description: result.message, variant: "destructive" });
        }
        setIsLoadingAction(false);
      },
      (error) => {
        console.error("GPS Error:", error);
        let message = "Could not get your location. Please ensure location services are enabled and permissions are granted.";
        if (error.code === error.PERMISSION_DENIED) message = "Location permission denied. Please enable it in your browser settings.";
        else if (error.code === error.POSITION_UNAVAILABLE) message = "Location information is unavailable.";
        else if (error.code === error.TIMEOUT) message = "The request to get user location timed out.";
        
        setGpsError(message);
        toast({ title: "GPS Error", description: message, variant: "destructive" });
        setIsLoadingAction(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const selectedProjectName = projects.find(p => p.id === selectedProjectId)?.name || "Selected Project";

  const isOverallLoading = authLoading || loadingProjects || isFetchingSelectedStatus || isLoadingGlobalStatus;
  
  const canCheckIn = !isLoadingAction && selectedProjectId && attendanceStatus === 'not-checked-in' && !globalActiveSession;
  const canCheckOut = !isLoadingAction && selectedProjectId && attendanceStatus === 'checked-in' && 
                      globalActiveSession && globalActiveSession.projectId === selectedProjectId;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Employee Attendance" 
        description="Log your daily attendance with GPS verification."
        actions={
          <Button onClick={fetchAllStatuses} variant="outline" disabled={isOverallLoading || isLoadingAction || !selectedProjectId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingSelectedStatus || isLoadingGlobalStatus ? 'animate-spin' : ''}`} /> Refresh Status
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center">
            <MapPin className="mr-2 h-6 w-6 text-primary" /> Today's Attendance Log
          </CardTitle>
          <CardDescription>
            Select your project and log your check-in/check-out. Your GPS location will be recorded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="project-select">Current Project</Label>
            <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select 
                    value={selectedProjectId} 
                    onValueChange={setSelectedProjectId} 
                    disabled={loadingProjects || projects.length === 0 || isLoadingAction || isFetchingSelectedStatus || isLoadingGlobalStatus}
                >
                    <SelectTrigger id="project-select" className="pl-10">
                    <SelectValue placeholder={loadingProjects ? "Loading projects..." : (projects.length === 0 ? "No projects assigned" : "Select a project")} />
                    </SelectTrigger>
                    <SelectContent>
                    {loadingProjects ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : projects.length > 0 ? (
                        projects.map(proj => (
                        <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                        ))
                    ) : (
                        <SelectItem value="no-projects" disabled>No projects found.</SelectItem>
                    )}
                    </SelectContent>
                </Select>
            </div>
          </div>

          {selectedProjectId && (
            <Card className="bg-muted/30">
                <CardHeader>
                    <CardTitle className="text-lg">Status for: {selectedProjectName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4"> {/* Increased space-y for better layout */}
                    {isFetchingSelectedStatus || isLoadingGlobalStatus ? (
                        <p className="text-sm text-muted-foreground">Fetching status...</p>
                    ) : globalActiveSession && globalActiveSession.projectId !== selectedProjectId ? (
                        <div className="p-3 my-2 text-sm text-orange-700 bg-orange-100 border border-orange-300 rounded-md flex items-start">
                            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 text-orange-500" />
                            <div>
                                <p className="font-semibold">Currently active elsewhere:</p>
                                <p>You are checked in to project "<strong>{globalActiveSession.projectName}</strong>" since {format(parseISO(globalActiveSession.checkInTime), 'p')}.</p>
                                <p>Please check out there before managing attendance for "{selectedProjectName}".</p>
                            </div>
                        </div>
                    ) : attendanceStatus === 'checked-in' ? (
                        <>
                            <p className="text-lg font-semibold text-green-600">Checked In at: {checkInTimeForSelected}</p>
                            {currentAttendanceLogForSelected?.gpsLocationCheckIn && (
                                <div className="text-xs text-muted-foreground mt-1 p-2 border rounded-md bg-background/70">
                                    <p className="font-medium text-foreground">Check-in GPS Data:</p>
                                    <p>Lat: {currentAttendanceLogForSelected.gpsLocationCheckIn.lat.toFixed(4)}, Lng: {currentAttendanceLogForSelected.gpsLocationCheckIn.lng.toFixed(4)}</p>
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy === 'number' && (
                                        <p>Accuracy: {currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy.toFixed(0)}m
                                            {currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy > 100 && <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">Poor</Badge>}
                                        </p>
                                    )}
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckIn.timestamp === 'number' && (
                                        <p>Timestamp: {format(new Date(currentAttendanceLogForSelected.gpsLocationCheckIn.timestamp), 'PPpp')}</p>
                                    )}
                                </div>
                            )}
                        </>
                    ) : attendanceStatus === 'checked-out' ? (
                        <>
                            <p className="text-lg font-semibold text-blue-600">Checked Out at: {checkOutTimeForSelected}</p>
                            <p className="text-sm text-muted-foreground">Previously checked in at: {checkInTimeForSelected}</p>
                            {currentAttendanceLogForSelected?.gpsLocationCheckIn && (
                                <div className="text-xs text-muted-foreground mt-1 p-2 border rounded-md bg-background/70">
                                    <p className="font-medium text-foreground">Check-in GPS Data:</p>
                                    <p>Lat: {currentAttendanceLogForSelected.gpsLocationCheckIn.lat.toFixed(4)}, Lng: {currentAttendanceLogForSelected.gpsLocationCheckIn.lng.toFixed(4)}</p>
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy === 'number' && (
                                        <p>Accuracy: {currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy.toFixed(0)}m
                                            {currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy > 100 && <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">Poor</Badge>}
                                        </p>
                                    )}
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckIn.timestamp === 'number' && (
                                        <p>Timestamp: {format(new Date(currentAttendanceLogForSelected.gpsLocationCheckIn.timestamp), 'PPpp')}</p>
                                    )}
                                </div>
                            )}
                            {currentAttendanceLogForSelected?.gpsLocationCheckOut && (
                                <div className="text-xs text-muted-foreground mt-1 p-2 border rounded-md bg-background/70">
                                    <p className="font-medium text-foreground">Check-out GPS Data:</p>
                                    <p>Lat: {currentAttendanceLogForSelected.gpsLocationCheckOut.lat.toFixed(4)}, Lng: {currentAttendanceLogForSelected.gpsLocationCheckOut.lng.toFixed(4)}</p>
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckOut.accuracy === 'number' && (
                                        <p>Accuracy: {currentAttendanceLogForSelected.gpsLocationCheckOut.accuracy.toFixed(0)}m
                                            {currentAttendanceLogForSelected.gpsLocationCheckOut.accuracy > 100 && <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">Poor</Badge>}
                                        </p>
                                    )}
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckOut.timestamp === 'number' && (
                                        <p>Timestamp: {format(new Date(currentAttendanceLogForSelected.gpsLocationCheckOut.timestamp), 'PPpp')}</p>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                         <p className="text-lg font-semibold text-orange-600">Not Checked In for this project today.</p>
                    )}
                     {gpsError && (
                        <div className="p-3 my-2 text-sm text-destructive bg-destructive/10 border border-destructive/50 rounded-md flex items-start">
                            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                            <div>
                                <p className="font-semibold">GPS Error:</p>
                                <p>{gpsError}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <Button
              onClick={() => handleGpsAction('check-in')}
              disabled={isLoadingAction || isFetchingSelectedStatus || isLoadingGlobalStatus || !selectedProjectId || !canCheckIn}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
            >
              <LogIn className="mr-2 h-5 w-5" /> Check In
            </Button>
            <Button
              onClick={() => handleGpsAction('check-out')}
              disabled={isLoadingAction || isFetchingSelectedStatus || isLoadingGlobalStatus || !selectedProjectId || !canCheckOut}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg"
            >
              <LogOut className="mr-2 h-5 w-5" /> Check Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

