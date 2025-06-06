
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, MapPin, RefreshCw, Briefcase, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchTodaysAttendance, logAttendance, checkoutAttendance, LogAttendanceResult, CheckoutAttendanceResult, FetchTodayAttendanceResult } from '@/app/actions/attendance';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';

type AttendanceStatus = 'checked-in' | 'checked-out' | 'not-checked-in';

export default function EmployeeAttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('not-checked-in');
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [currentAttendanceId, setCurrentAttendanceId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false); // For check-in/out actions
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);


  const loadProjectsList = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const fetchedProjects = await fetchAllProjects();
      setProjects(fetchedProjects);
      if (fetchedProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(fetchedProjects[0].id); // Auto-select first project
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


  const getCurrentAttendanceStatus = useCallback(async (projectIdToFetch: string) => {
    if (!user?.id || !projectIdToFetch) return;
    setIsFetchingStatus(true);
    setGpsError(null);
    const result: FetchTodayAttendanceResult = await fetchTodaysAttendance(user.id, projectIdToFetch);
    if (result.success && result.attendanceLog) {
      setCurrentAttendanceId(result.attendanceLog.id);
      if (result.checkInTime) {
        setCheckInTime(format(new Date(result.checkInTime), 'p'));
        if (result.checkOutTime) {
          setAttendanceStatus('checked-out');
          setCheckOutTime(format(new Date(result.checkOutTime), 'p'));
        } else {
          setAttendanceStatus('checked-in');
          setCheckOutTime(null);
        }
      } else {
        setAttendanceStatus('not-checked-in');
        setCheckInTime(null);
        setCheckOutTime(null);
        setCurrentAttendanceId(null);
      }
    } else {
      setAttendanceStatus('not-checked-in');
      setCheckInTime(null);
      setCheckOutTime(null);
      setCurrentAttendanceId(null);
      if (!result.success && result.message !== 'No attendance log found for today and this project.') {
         toast({ title: "Status Error", description: result.message, variant: "destructive" });
      }
    }
    setIsFetchingStatus(false);
  }, [user?.id, toast]);

  useEffect(() => {
    if (user?.id && selectedProjectId) {
      getCurrentAttendanceStatus(selectedProjectId);
    }
  }, [user?.id, selectedProjectId, getCurrentAttendanceStatus]);


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

    setIsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const gpsLocation = { lat: latitude, lng: longitude, accuracy };
        
        let result: LogAttendanceResult | CheckoutAttendanceResult;
        if (actionType === 'check-in') {
          result = await logAttendance(user.id, selectedProjectId, gpsLocation);
        } else {
          result = await checkoutAttendance(user.id, selectedProjectId, gpsLocation);
        }

        if (result.success) {
          toast({ title: "Success", description: result.message });
          await getCurrentAttendanceStatus(selectedProjectId); // Refresh status
        } else {
          toast({ title: "Action Failed", description: result.message, variant: "destructive" });
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("GPS Error:", error);
        let message = "Could not get your location. Please ensure location services are enabled and permissions are granted.";
        if (error.code === error.PERMISSION_DENIED) message = "Location permission denied. Please enable it in your browser settings.";
        else if (error.code === error.POSITION_UNAVAILABLE) message = "Location information is unavailable.";
        else if (error.code === error.TIMEOUT) message = "The request to get user location timed out.";
        
        setGpsError(message);
        toast({ title: "GPS Error", description: message, variant: "destructive" });
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const selectedProjectName = projects.find(p => p.id === selectedProjectId)?.name || "Selected Project";

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Employee Attendance" 
        description="Log your daily attendance with GPS verification."
        actions={
          <Button onClick={() => getCurrentAttendanceStatus(selectedProjectId)} variant="outline" disabled={isFetchingStatus || isLoading || !selectedProjectId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingStatus ? 'animate-spin' : ''}`} /> Refresh Status
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
                    disabled={loadingProjects || projects.length === 0 || isLoading || isFetchingStatus}
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
                <CardContent className="space-y-2">
                    {isFetchingStatus && <p className="text-sm text-muted-foreground">Fetching status...</p>}
                    {!isFetchingStatus && attendanceStatus === 'checked-in' && (
                    <p className="text-lg font-semibold text-green-600">Checked In at: {checkInTime}</p>
                    )}
                    {!isFetchingStatus && attendanceStatus === 'checked-out' && (
                    <>
                        <p className="text-lg font-semibold text-blue-600">Checked Out at: {checkOutTime}</p>
                        <p className="text-sm text-muted-foreground">Checked In at: {checkInTime}</p>
                    </>
                    )}
                    {!isFetchingStatus && attendanceStatus === 'not-checked-in' && (
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
              disabled={isLoading || isFetchingStatus || !selectedProjectId || attendanceStatus === 'checked-in' || attendanceStatus === 'checked-out'}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
            >
              <LogIn className="mr-2 h-5 w-5" /> Check In
            </Button>
            <Button
              onClick={() => handleGpsAction('check-out')}
              disabled={isLoading || isFetchingStatus || !selectedProjectId || attendanceStatus !== 'checked-in'}
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
