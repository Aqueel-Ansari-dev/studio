
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut, MapPin, RefreshCw, Briefcase, AlertTriangle, Dot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { 
  fetchTodaysAttendance, 
  logAttendance, 
  checkoutAttendance, 
  getGlobalActiveCheckIn,
  updateLocationTrack, // New import
  LogAttendanceResult, 
  CheckoutAttendanceResult, 
  AttendanceLog 
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

interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: number; // Milliseconds since epoch
  accuracy?: number;
}

const LOCATION_TRACK_INTERVAL_MS = 60000; // 1 minute

export default function EmployeeAttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('not-checked-in');
  const [checkInTimeForSelected, setCheckInTimeForSelected] = useState<string | null>(null);
  const [checkOutTimeForSelected, setCheckOutTimeForSelected] = useState<string | null>(null);
  const [currentAttendanceLogForSelected, setCurrentAttendanceLogForSelected] = useState<(AttendanceLog & { id: string; checkInTime?: string; checkOutTime?: string }) | null>(null);
  
  const [globalActiveSession, setGlobalActiveSession] = useState<GlobalActiveSessionInfo | null>(null);
  const [isLoadingGlobalStatus, setIsLoadingGlobalStatus] = useState(false);

  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [isFetchingSelectedStatus, setIsFetchingSelectedStatus] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // For location tracking
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [currentLocationTrack, setCurrentLocationTrack] = useState<LocationPoint[]>([]);
  const locationIntervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const currentAttendanceLogIdRef = useRef<string | null>(null);


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
    setCurrentAttendanceLogForSelected(null); 

    try {
      const [selectedProjectResult, globalCheckInResult] = await Promise.all([
        fetchTodaysAttendance(user.id, selectedProjectId),
        getGlobalActiveCheckIn(user.id)
      ]);

      if (selectedProjectResult.success && selectedProjectResult.attendanceLog) {
        setCurrentAttendanceLogForSelected(selectedProjectResult.attendanceLog);
        currentAttendanceLogIdRef.current = selectedProjectResult.attendanceLog.id; // Store current log ID
        if (selectedProjectResult.attendanceLog.checkInTime) {
          setCheckInTimeForSelected(format(parseISO(selectedProjectResult.attendanceLog.checkInTime), 'p'));
          if (selectedProjectResult.attendanceLog.checkOutTime) {
            setAttendanceStatus('checked-out');
            setCheckOutTimeForSelected(format(parseISO(selectedProjectResult.attendanceLog.checkOutTime), 'p'));
            setIsTrackingLocation(false); // Stop tracking if checked out
          } else {
            setAttendanceStatus('checked-in');
            setCheckOutTimeForSelected(null);
            setIsTrackingLocation(true); // Start tracking if checked in
          }
        } else { 
          setAttendanceStatus('not-checked-in');
          setCheckInTimeForSelected(null);
          setCheckOutTimeForSelected(null);
          setIsTrackingLocation(false);
        }
      } else {
        setAttendanceStatus('not-checked-in');
        setCheckInTimeForSelected(null);
        setCheckOutTimeForSelected(null);
        setIsTrackingLocation(false);
        currentAttendanceLogIdRef.current = null;
        if (!selectedProjectResult.success && selectedProjectResult.message !== 'No attendance log found for today and this project.') {
           toast({ title: "Status Error (Selected Project)", description: selectedProjectResult.message, variant: "destructive" });
        }
      }

      if (globalCheckInResult.activeLog) {
        setGlobalActiveSession(globalCheckInResult.activeLog);
         // If globally active on THIS project, ensure tracking state is correct
        if (globalCheckInResult.activeLog.projectId === selectedProjectId) {
            setIsTrackingLocation(true);
            currentAttendanceLogIdRef.current = globalCheckInResult.activeLog.attendanceId;
        } else {
            // If globally active on a DIFFERENT project, no tracking for selected project
            setIsTrackingLocation(false);
        }
      } else {
        setGlobalActiveSession(null);
        setIsTrackingLocation(false); // No global session means no tracking
        if (globalCheckInResult.error) {
             toast({ title: "Status Error (Global Check-in)", description: globalCheckInResult.error, variant: "destructive" });
        }
      }

    } catch (error) {
        console.error("Error fetching statuses:", error);
        toast({ title: "Error", description: "Could not fetch attendance statuses.", variant: "destructive" });
        setIsTrackingLocation(false);
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

  // Effect for periodic location tracking
  useEffect(() => {
    if (isTrackingLocation && currentAttendanceLogIdRef.current) {
      console.log("Starting location tracking interval for log:", currentAttendanceLogIdRef.current);
      if (locationIntervalIdRef.current) clearInterval(locationIntervalIdRef.current); // Clear previous interval

      locationIntervalIdRef.current = setInterval(() => {
        if (!navigator.geolocation) {
          console.warn("Location tracking: Geolocation not supported.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newPoint: LocationPoint = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: Date.now(),
            };
            console.log("Location tracked:", newPoint);
            setCurrentLocationTrack((prevTrack) => [...prevTrack, newPoint]);
          },
          (error) => {
            console.warn("Location tracking error:", error.message);
            // Optionally show a non-intrusive toast or log
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }, LOCATION_TRACK_INTERVAL_MS);
    } else {
      if (locationIntervalIdRef.current) {
        console.log("Clearing location tracking interval.");
        clearInterval(locationIntervalIdRef.current);
        locationIntervalIdRef.current = null;
      }
    }
    // Cleanup on unmount or when isTrackingLocation changes
    return () => {
      if (locationIntervalIdRef.current) {
        console.log("Cleaning up location tracking interval on effect change/unmount.");
        clearInterval(locationIntervalIdRef.current);
        locationIntervalIdRef.current = null;
      }
    };
  }, [isTrackingLocation]);


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
        const gpsData = { lat: latitude, lng: longitude, accuracy, timestamp: Date.now() };
        
        let result: LogAttendanceResult | CheckoutAttendanceResult;
        if (actionType === 'check-in') {
          setCurrentLocationTrack([]); // Reset track on new check-in
          result = await logAttendance(user.id, selectedProjectId, gpsData, false);
          if (result.success && result.attendanceId) {
             currentAttendanceLogIdRef.current = result.attendanceId;
             setIsTrackingLocation(true); // Start tracking
          }
        } else { // check-out
          setIsTrackingLocation(false); // Stop tracking first
          if (locationIntervalIdRef.current) {
            clearInterval(locationIntervalIdRef.current);
            locationIntervalIdRef.current = null;
          }
          
          if (currentAttendanceLogIdRef.current && currentLocationTrack.length > 0) {
            console.log(`Uploading ${currentLocationTrack.length} track points for log ${currentAttendanceLogIdRef.current}`);
            const trackUpdateResult = await updateLocationTrack(currentAttendanceLogIdRef.current, currentLocationTrack);
            if (trackUpdateResult.success) {
              toast({ title: "Location Track Saved", description: `${currentLocationTrack.length} points saved.`});
            } else {
              toast({ title: "Track Save Failed", description: trackUpdateResult.message, variant: "destructive"});
            }
            setCurrentLocationTrack([]); // Clear track after attempting to save
          }
          result = await checkoutAttendance(user.id, selectedProjectId, gpsData);
          currentAttendanceLogIdRef.current = null; // Clear log ID on checkout
        }

        if (result.success) {
          toast({ title: "Success", description: result.message });
          await fetchAllStatuses(); 
        } else {
          toast({ title: "Action Failed", description: result.message, variant: "destructive" });
          if (actionType === 'check-in') setIsTrackingLocation(false); // Revert if check-in failed
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

          {isTrackingLocation && (
            <div className="flex items-center text-xs text-blue-600 bg-blue-50 p-2 rounded-md">
                <Dot className="animate-ping h-5 w-5 mr-1" /> Live location tracking active. {currentLocationTrack.length} points collected.
            </div>
          )}

          {selectedProjectId && (
            <Card className="bg-muted/30">
                <CardHeader>
                    <CardTitle className="text-lg">Status for: {selectedProjectName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                                <div className="text-xs text-muted-foreground mt-1 p-2 border rounded-md bg-background/70 space-y-1">
                                    <p className="font-medium text-foreground">Check-in GPS Data:</p>
                                    <div>Lat: {currentAttendanceLogForSelected.gpsLocationCheckIn.lat.toFixed(4)}, Lng: {currentAttendanceLogForSelected.gpsLocationCheckIn.lng.toFixed(4)}</div>
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy === 'number' && (
                                        <div>Accuracy: {currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy.toFixed(0)}m
                                            {currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy > 100 && <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">Poor</Badge>}
                                        </div>
                                    )}
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckIn.timestamp === 'number' && (
                                        <div>Timestamp: {format(new Date(currentAttendanceLogForSelected.gpsLocationCheckIn.timestamp), 'PPpp')}</div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : attendanceStatus === 'checked-out' ? (
                        <>
                            <p className="text-lg font-semibold text-blue-600">Checked Out at: {checkOutTimeForSelected}</p>
                            <p className="text-sm text-muted-foreground">Previously checked in at: {checkInTimeForSelected}</p>
                            {currentAttendanceLogForSelected?.gpsLocationCheckIn && (
                                <div className="text-xs text-muted-foreground mt-1 p-2 border rounded-md bg-background/70 space-y-1">
                                    <p className="font-medium text-foreground">Check-in GPS Data:</p>
                                    <div>Lat: {currentAttendanceLogForSelected.gpsLocationCheckIn.lat.toFixed(4)}, Lng: {currentAttendanceLogForSelected.gpsLocationCheckIn.lng.toFixed(4)}</div>
                                     {typeof currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy === 'number' && (
                                        <div>Accuracy: {currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy.toFixed(0)}m
                                            {currentAttendanceLogForSelected.gpsLocationCheckIn.accuracy > 100 && <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">Poor</Badge>}
                                        </div>
                                    )}
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckIn.timestamp === 'number' && (
                                        <div>Timestamp: {format(new Date(currentAttendanceLogForSelected.gpsLocationCheckIn.timestamp), 'PPpp')}</div>
                                    )}
                                </div>
                            )}
                            {currentAttendanceLogForSelected?.gpsLocationCheckOut && (
                                <div className="text-xs text-muted-foreground mt-1 p-2 border rounded-md bg-background/70 space-y-1">
                                    <p className="font-medium text-foreground">Check-out GPS Data:</p>
                                    <div>Lat: {currentAttendanceLogForSelected.gpsLocationCheckOut.lat.toFixed(4)}, Lng: {currentAttendanceLogForSelected.gpsLocationCheckOut.lng.toFixed(4)}</div>
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckOut.accuracy === 'number' && (
                                        <div>Accuracy: {currentAttendanceLogForSelected.gpsLocationCheckOut.accuracy.toFixed(0)}m
                                            {currentAttendanceLogForSelected.gpsLocationCheckOut.accuracy > 100 && <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">Poor</Badge>}
                                        </div>
                                    )}
                                    {typeof currentAttendanceLogForSelected.gpsLocationCheckOut.timestamp === 'number' && (
                                        <div>Timestamp: {format(new Date(currentAttendanceLogForSelected.gpsLocationCheckOut.timestamp), 'PPpp')}</div>
                                    )}
                                </div>
                            )}
                             {currentAttendanceLogForSelected?.locationTrack && currentAttendanceLogForSelected.locationTrack.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1 p-2 border rounded-md bg-background/70 space-y-1">
                                    <p className="font-medium text-foreground">Location Track ({currentAttendanceLogForSelected.locationTrack.length} points)</p>
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

