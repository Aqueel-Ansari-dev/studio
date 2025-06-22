

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RefreshCw, Download, CalendarIcon, User, Briefcase, MapPin, CheckCircle, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchSupervisorAssignedProjects, FetchSupervisorProjectsResult } from '@/app/actions/supervisor/fetchSupervisorData'; 
import { fetchAllProjects, type ProjectForSelection, type FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { fetchUsersByRole, UserForSelection, FetchUsersByRoleResult } from '@/app/actions/common/fetchUsersByRole';
import { fetchAttendanceLogsForMap, AttendanceLogForMap, FetchAttendanceLogsForMapFilters } from '@/app/actions/attendance';
import { format, parseISO, isValid } from 'date-fns';
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, InfoWindowF } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '0.5rem',
};

const defaultMapCenter = {
  lat: 37.0902, // US Center
  lng: -95.7129
};

interface SelectedMarkerInfo {
  log: AttendanceLogForMap;
  type: 'check-in' | 'check-out';
  position: { lat: number; lng: number };
}

export default function AttendanceMapPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);

  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]); 
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogForMap[]>([]);

  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  const [mapCenter, setMapCenter] = useState(defaultMapCenter);
  const [mapZoom, setMapZoom] = useState(4);
  const [selectedMarker, setSelectedMarker] = useState<SelectedMarkerInfo | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: ['geometry'],
  });

  const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.id, emp.name])), [employees]);
  const projectMap = useMemo(() => new Map(projects.map(proj => [proj.id, proj.name])), [projects]);


  const loadLookups = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingLookups(true);
    try {
      const projectsFetchAction = user.role === 'admin' 
                                  ? fetchAllProjects() 
                                  : fetchSupervisorAssignedProjects(user.id);

      const [employeesResult, supervisorsResult, projectsResult]: [FetchUsersByRoleResult, FetchUsersByRoleResult, FetchAllProjectsResult | FetchSupervisorProjectsResult] = await Promise.all([ 
        fetchUsersByRole('employee'),
        fetchUsersByRole('supervisor'),
        projectsFetchAction
      ]);

      let combinedUsers: UserForSelection[] = [];
      if (employeesResult.success && employeesResult.users) {
        combinedUsers = combinedUsers.concat(employeesResult.users);
      } else {
        console.error("Failed to fetch employees:", employeesResult.error);
      }
      
      if (supervisorsResult.success && supervisorsResult.users) {
        // Distinguish supervisors in the list
        const labeledSupervisors = supervisorsResult.users.map(s => ({ ...s, name: `${s.name} (Supervisor)`}));
        combinedUsers = combinedUsers.concat(labeledSupervisors);
      } else {
        console.error("Failed to fetch supervisors:", supervisorsResult.error);
      }
      
      combinedUsers.sort((a,b) => a.name.localeCompare(b.name));
      setEmployees(combinedUsers);

      if (projectsResult.success && projectsResult.projects) {
        setProjects(projectsResult.projects);
      } else {
        setProjects([]);
        console.error("Failed to fetch projects:", projectsResult.error);
      }
    } catch (error) {
      toast({ title: "Error loading filters", description: "Could not load users or projects.", variant: "destructive" });
      setEmployees([]);
      setProjects([]);
    } finally {
      setIsLoadingLookups(false);
    }
  }, [toast, user?.id, user?.role]);

  const loadAttendanceData = useCallback(async () => {
    if (!user?.id || !selectedDate) {
      setAttendanceLogs([]);
      setMapCenter(defaultMapCenter);
      setMapZoom(4);
      return;
    }
    setIsLoadingLogs(true);
    const filters: FetchAttendanceLogsForMapFilters = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      employeeId: selectedEmployeeId === 'all' || !selectedEmployeeId ? undefined : selectedEmployeeId,
      projectId: selectedProjectId === 'all' || !selectedProjectId ? undefined : selectedProjectId,
    };

    try {
      const result = await fetchAttendanceLogsForMap(filters);
      if (result.success && result.logs) {
        // Sort logs by check-in time on the client to ensure consistent order
        const sortedLogs = result.logs.sort((a, b) => {
            const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
            const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
            return timeA - timeB;
        });
        setAttendanceLogs(sortedLogs);
        if (sortedLogs.length === 0) {
            toast({ title: "No Data", description: result.message || "No attendance logs found for the selected criteria."});
            setMapCenter(defaultMapCenter);
            setMapZoom(4);
        } else {
            const bounds = new google.maps.LatLngBounds();
            sortedLogs.forEach(log => {
                if (log.gpsLocationCheckIn) bounds.extend({ lat: log.gpsLocationCheckIn.lat, lng: log.gpsLocationCheckIn.lng });
                if (log.gpsLocationCheckOut) bounds.extend({ lat: log.gpsLocationCheckOut.lat, lng: log.gpsLocationCheckOut.lng });
                log.locationTrack?.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
            });
            if (!bounds.isEmpty()) {
                const center = bounds.getCenter();
                setMapCenter({ lat: center.lat(), lng: center.lng() });
                // Adjust zoom based on whether there's a path to show or just points
                const hasPaths = sortedLogs.some(log => log.locationTrack && log.locationTrack.length > 0);
                const hasMultiplePoints = sortedLogs.some(log => log.gpsLocationCheckIn && log.gpsLocationCheckOut) || sortedLogs.length > 1;
                
                if (bounds.getNorthEast().equals(bounds.getSouthWest()) && !hasPaths) { // Single point, zoom in close
                  setMapZoom(15);
                } else if (!hasPaths && !hasMultiplePoints && sortedLogs[0]?.gpsLocationCheckIn) { // Single check-in
                  setMapZoom(15);
                } else {
                  setMapZoom(10); // Default zoom for multiple points or paths
                  // A more robust solution would use map.fitBounds(bounds) if the map instance was available here
                }
            } else {
                setMapCenter(defaultMapCenter);
                setMapZoom(4);
            }
        }
      } else {
        toast({ title: "Error Loading Logs", description: result.error || "Could not fetch attendance data.", variant: "destructive" });
        setAttendanceLogs([]);
        setMapCenter(defaultMapCenter);
        setMapZoom(4);
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred while fetching attendance data.", variant: "destructive" });
      setAttendanceLogs([]);
      setMapCenter(defaultMapCenter);
      setMapZoom(4);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [user?.id, selectedDate, selectedEmployeeId, selectedProjectId, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      loadLookups();
    }
  }, [authLoading, user, loadLookups]);

  useEffect(() => {
    if (selectedDate && !isLoadingLookups) {
      loadAttendanceData();
    }
  }, [selectedDate, selectedEmployeeId, selectedProjectId, isLoadingLookups, loadAttendanceData]);


  const handleDownloadGeoJSON = () => {
    if(attendanceLogs.length === 0){
        toast({title: "No Data", description: "No data to export as GeoJSON.", variant: "default"});
        return;
    }
    const geoJsonData = {
      type: "FeatureCollection",
      features: attendanceLogs.flatMap(log => {
        const features = [];
        const employeeName = employeeMap.get(log.employeeId) || log.employeeId;
        const projectName = projectMap.get(log.projectId) || log.projectId;
        if(log.gpsLocationCheckIn) {
            features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [log.gpsLocationCheckIn.lng, log.gpsLocationCheckIn.lat] },
                properties: { type: "check-in", employeeId: log.employeeId, employeeName, projectId: log.projectId, projectName, time: log.checkInTime, accuracy: log.gpsLocationCheckIn.accuracy }
            });
        }
        if(log.gpsLocationCheckOut) {
            features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [log.gpsLocationCheckOut.lng, log.gpsLocationCheckOut.lat] },
                properties: { type: "check-out", employeeId: log.employeeId, employeeName, projectId: log.projectId, projectName, time: log.checkOutTime, accuracy: log.gpsLocationCheckOut.accuracy }
            });
        }
        if(log.locationTrack && log.locationTrack.length > 1) {
            features.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: log.locationTrack.map(p => [p.lng, p.lat]) },
                properties: { type: "path", employeeId: log.employeeId, employeeName, projectId: log.projectId, projectName }
            });
        }
        return features;
      })
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geoJsonData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `attendance_map_${format(selectedDate || new Date(), 'yyyy-MM-dd')}.geojson`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast({ title: "GeoJSON Generated", description: "GeoJSON data prepared for download." });
  };
  
  const MapLegend = () => (
    <div className="mt-4 flex items-center space-x-4 text-sm bg-muted p-3 rounded-md">
      <div className="flex items-center">
        <Image src="https://maps.google.com/mapfiles/ms/icons/green-dot.png" alt="Check-in" width={20} height={34} data-ai-hint="green pin" />
        <span className="ml-1">Check-in</span>
      </div>
      <div className="flex items-center">
        <Image src="https://maps.google.com/mapfiles/ms/icons/red-dot.png" alt="Check-out" width={20} height={34} data-ai-hint="red pin" />
        <span className="ml-1">Check-out</span>
      </div>
      <div className="flex items-center">
        <svg width="20" height="10" viewBox="0 0 20 10" className="mr-1">
            <line x1="0" y1="5" x2="20" y2="5" stroke="#FF0000" strokeWidth="2" strokeOpacity="0.7"/>
        </svg>
        <span>Location Track</span>
      </div>
    </div>
  );


  const isLoadingPage = authLoading || isLoadingLookups;

  if (isLoadingPage) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user || user.role !== 'admin') {
    return (
        <div className="p-4">
            <PageHeader title="Access Denied" description="Only administrators can access the Team Attendance Map."/>
            <Card className="mt-4">
                <CardContent className="p-6 text-center">
                    <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
                    <p className="mt-2 font-semibold">Access Restricted</p>
                     <Button asChild variant="outline" className="mt-4">
                        <Link href="/dashboard">Go to Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Attendance Map (Admin)"
        description="Visualize employee attendance locations for a selected day across all projects."
        actions={
          <div className="flex gap-2">
            <Button onClick={handleDownloadGeoJSON} variant="outline" disabled={isLoadingLogs || attendanceLogs.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Download GeoJSON
            </Button>
            <Button onClick={loadAttendanceData} variant="outline" disabled={isLoadingLogs || !selectedDate}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} /> Refresh Map Data
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select date, employee, and project to view attendance data.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="date-picker">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date-picker" variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus /></PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label htmlFor="employee-select">Employee (Optional)</Label>
             <Select value={selectedEmployeeId || "all"} onValueChange={setSelectedEmployeeId} disabled={isLoadingLookups || employees.length === 0}>
              <SelectTrigger id="employee-select">
                <SelectValue placeholder={isLoadingLookups ? "Loading..." : "All Employees"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="project-select">Project (Optional)</Label>
            <Select value={selectedProjectId || "all"} onValueChange={setSelectedProjectId} disabled={isLoadingLookups || projects.length === 0}>
              <SelectTrigger id="project-select">
                <SelectValue placeholder={isLoadingLookups ? "Loading..." : (projects.length === 0 ? "No projects available" : "All Projects")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(proj => <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Map Visualization & Data</CardTitle>
          <CardDescription>
            {isLoadingLogs ? "Loading map data..." :
            `Displaying ${attendanceLogs.length} attendance record(s) for ${format(selectedDate || new Date(), "PPP")}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Configuration Error</AlertTitle>
              <AlertDescription>
                Google Maps API Key is not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.
              </AlertDescription>
            </Alert>
          )}
          {loadError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Map Load Error</AlertTitle>
              <AlertDescription>
                Could not load Google Maps. Error: {loadError.message}
              </AlertDescription>
            </Alert>
          )}
          {isLoaded && !loadError && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
            <>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={mapZoom}
              options={{
                 mapTypeControl: false,
                 streetViewControl: false,
                 fullscreenControl: true,
              }}
            >
              {attendanceLogs.map(log => (
                <React.Fragment key={log.id}>
                  {log.gpsLocationCheckIn && (
                    <MarkerF
                      position={{ lat: log.gpsLocationCheckIn.lat, lng: log.gpsLocationCheckIn.lng }}
                      icon={{
                        url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                        scaledSize: new google.maps.Size(36,36) // Adjusted size for better visibility
                      }}
                      onClick={() => setSelectedMarker({ log, type: 'check-in', position: log.gpsLocationCheckIn! })}
                    />
                  )}
                  {log.gpsLocationCheckOut && (
                    <MarkerF
                      position={{ lat: log.gpsLocationCheckOut.lat, lng: log.gpsLocationCheckOut.lng }}
                      icon={{
                        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                        scaledSize: new google.maps.Size(36,36) // Adjusted size
                      }}
                      onClick={() => setSelectedMarker({ log, type: 'check-out', position: log.gpsLocationCheckOut! })}
                    />
                  )}
                  {log.locationTrack && log.locationTrack.length > 0 && (
                    <PolylineF
                      path={log.locationTrack.map(p => ({ lat: p.lat, lng: p.lng }))}
                      options={{
                        strokeColor: "#FF0000",
                        strokeOpacity: 0.7,
                        strokeWeight: 3,
                        geodesic: true,
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
              {selectedMarker && (
                <InfoWindowF
                  position={selectedMarker.position}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="p-2 text-sm space-y-1">
                    <p className="font-bold text-primary">{employeeMap.get(selectedMarker.log.employeeId) || selectedMarker.log.employeeId}</p>
                    <p className="text-xs text-muted-foreground">Project: {projectMap.get(selectedMarker.log.projectId) || selectedMarker.log.projectId}</p>
                    <p><Badge variant={selectedMarker.type === 'check-in' ? 'default' : 'destructive'} className={selectedMarker.type === 'check-in' ? 'bg-green-500' : ''}>{selectedMarker.type === 'check-in' ? 'Checked In' : 'Checked Out'}</Badge></p>
                    <p>Time: {selectedMarker.type === 'check-in' ? 
                        (selectedMarker.log.checkInTime && isValid(parseISO(selectedMarker.log.checkInTime)) ? format(parseISO(selectedMarker.log.checkInTime), 'p') : 'N/A') : 
                        (selectedMarker.log.checkOutTime && isValid(parseISO(selectedMarker.log.checkOutTime)) ? format(parseISO(selectedMarker.log.checkOutTime), 'p') : 'N/A')}
                    </p>
                    {selectedMarker.log.gpsLocationCheckIn?.accuracy && selectedMarker.type === 'check-in' && <p className="text-xs">Accuracy: {selectedMarker.log.gpsLocationCheckIn.accuracy.toFixed(0)}m</p>}
                    {selectedMarker.log.gpsLocationCheckOut?.accuracy && selectedMarker.type === 'check-out' && <p className="text-xs">Accuracy: {selectedMarker.log.gpsLocationCheckOut.accuracy.toFixed(0)}m</p>}
                    
                    {(selectedMarker.log.selfieCheckInUrl && selectedMarker.type === 'check-in') || (selectedMarker.log.selfieCheckOutUrl && selectedMarker.type === 'check-out') ? (
                        <Image 
                            src={(selectedMarker.type === 'check-in' ? selectedMarker.log.selfieCheckInUrl : selectedMarker.log.selfieCheckOutUrl)!} 
                            alt={`${selectedMarker.type} Selfie`} 
                            width={100} height={100} 
                            className="object-cover mt-1 rounded-md border" 
                            data-ai-hint={`${selectedMarker.type} selfie`}
                        />
                    ) : <p className="text-xs text-muted-foreground">(No selfie)</p>}
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
            <MapLegend />
            </>
          ) : !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? null : (
            <div className="h-96 bg-muted rounded-md flex items-center justify-center text-muted-foreground mb-6">
                <RefreshCw className="h-8 w-8 animate-spin mr-2"/> Loading Map API...
            </div>
          )}

          {isLoadingLogs ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
          ) : attendanceLogs.length === 0 && isLoaded ? (
            <p className="text-muted-foreground text-center mt-6">No attendance data to display for the selected criteria.</p>
          ) : !isLoaded && !loadError && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
            <div className="text-center py-10 text-muted-foreground">Map cannot be displayed due to missing API key.</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


