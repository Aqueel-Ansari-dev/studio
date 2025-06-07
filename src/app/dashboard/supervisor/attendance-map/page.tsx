
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RefreshCw, Download, CalendarIcon, User, Briefcase, MapPin, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { fetchUsersByRole, UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchAttendanceLogsForMap, AttendanceLogForMap, FetchAttendanceLogsForMapFilters } from '@/app/actions/attendance';
import { format, parseISO, isValid } from 'date-fns';

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


  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [emps, projs] = await Promise.all([
        fetchUsersByRole('employee'),
        fetchAllProjects()
      ]);
      setEmployees(emps);
      setProjects(projs);
    } catch (error) {
      toast({ title: "Error loading filters", description: "Could not load employees or projects.", variant: "destructive" });
    } finally {
      setIsLoadingLookups(false);
    }
  }, [toast]);

  const loadAttendanceData = useCallback(async () => {
    if (!user?.id || !selectedDate) {
      setAttendanceLogs([]);
      return;
    }
    setIsLoadingLogs(true);
    const filters: FetchAttendanceLogsForMapFilters = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      employeeId: selectedEmployeeId === 'all' ? undefined : selectedEmployeeId,
      projectId: selectedProjectId === 'all' ? undefined : selectedProjectId,
    };

    try {
      const result = await fetchAttendanceLogsForMap(filters);
      if (result.success && result.logs) {
        setAttendanceLogs(result.logs);
        if (result.logs.length === 0) {
            toast({ title: "No Data", description: result.message || "No attendance logs found for the selected criteria."});
        }
      } else {
        toast({ title: "Error Loading Logs", description: result.error || "Could not fetch attendance data.", variant: "destructive" });
        setAttendanceLogs([]);
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred while fetching attendance data.", variant: "destructive" });
      setAttendanceLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [user?.id, selectedDate, selectedEmployeeId, selectedProjectId, toast]);
  
  useEffect(() => {
    if (!authLoading && user) {
      loadLookups();
    }
  }, [authLoading, user, loadLookups]);

  // Automatically fetch logs when date or filters change
  useEffect(() => {
    if (selectedDate && !isLoadingLookups) { // Ensure lookups are loaded before fetching logs
      loadAttendanceData();
    }
  }, [selectedDate, selectedEmployeeId, selectedProjectId, isLoadingLookups, loadAttendanceData]);


  const handleDownloadGeoJSON = () => {
    // Placeholder for actual GeoJSON generation and download
    console.log("Attempting to download GeoJSON for:", attendanceLogs);
    if(attendanceLogs.length === 0){
        toast({title: "No Data", description: "No data to export as GeoJSON.", variant: "default"});
        return;
    }
    const geoJsonData = {
      type: "FeatureCollection",
      features: attendanceLogs.flatMap(log => {
        const features = [];
        if(log.gpsLocationCheckIn) {
            features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [log.gpsLocationCheckIn.lng, log.gpsLocationCheckIn.lat] },
                properties: { type: "check-in", employeeId: log.employeeId, projectId: log.projectId, time: log.checkInTime, accuracy: log.gpsLocationCheckIn.accuracy }
            });
        }
        if(log.gpsLocationCheckOut) {
            features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [log.gpsLocationCheckOut.lng, log.gpsLocationCheckOut.lat] },
                properties: { type: "check-out", employeeId: log.employeeId, projectId: log.projectId, time: log.checkOutTime, accuracy: log.gpsLocationCheckOut.accuracy }
            });
        }
        if(log.locationTrack && log.locationTrack.length > 1) {
            features.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: log.locationTrack.map(p => [p.lng, p.lat]) },
                properties: { type: "path", employeeId: log.employeeId, projectId: log.projectId }
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

  const isLoading = authLoading || isLoadingLookups;

  if (isLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || (user.role !== 'supervisor' && user.role !== 'admin')) {
    return <div className="p-4"><PageHeader title="Access Denied" description="You do not have permission to view this page."/></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Employee Attendance Map" 
        description="Visualize employee attendance locations for a selected day."
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
             <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={isLoadingLookups || employees.length === 0}>
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
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={isLoadingLookups || projects.length === 0}>
              <SelectTrigger id="project-select">
                <SelectValue placeholder={isLoadingLookups ? "Loading..." : "All Projects"} />
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
          <div className="h-96 bg-muted rounded-md flex items-center justify-center text-muted-foreground mb-6">
            <MapPin className="h-16 w-16 mr-4" />
            <div>
              <p className="text-lg font-semibold">Map Visualization Placeholder</p>
              <p className="text-sm">Live map integration (e.g., Google Maps, Mapbox) will be added here.</p>
              <p className="text-xs mt-1">For now, review the textual data below.</p>
            </div>
          </div>

          {isLoadingLogs ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
          ) : attendanceLogs.length === 0 ? (
            <p className="text-muted-foreground text-center">No attendance data to display for the selected criteria.</p>
          ) : (
            <div className="space-y-4">
              {attendanceLogs.map(log => {
                const employeeName = employees.find(e => e.id === log.employeeId)?.name || log.employeeId;
                const projectName = projects.find(p => p.id === log.projectId)?.name || log.projectId;
                return (
                  <Card key={log.id} className="bg-background shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-md font-semibold">{employeeName} - {projectName}</CardTitle>
                      <CardDescription>Date: {log.date}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      {log.gpsLocationCheckIn && (
                        <div className="flex items-start p-2 border rounded-md bg-green-50">
                          <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <strong>Check-in:</strong> {log.checkInTime ? format(parseISO(log.checkInTime), 'p') : 'N/A'}
                            <br />Lat: {log.gpsLocationCheckIn.lat.toFixed(4)}, Lng: {log.gpsLocationCheckIn.lng.toFixed(4)}
                            {typeof log.gpsLocationCheckIn.accuracy === 'number' && `, Acc: ${log.gpsLocationCheckIn.accuracy.toFixed(0)}m`}
                          </div>
                        </div>
                      )}
                      {log.gpsLocationCheckOut && log.checkOutTime && (
                        <div className="flex items-start p-2 border rounded-md bg-red-50">
                          <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                           <div>
                            <strong>Check-out:</strong> {format(parseISO(log.checkOutTime), 'p')}
                            <br />Lat: {log.gpsLocationCheckOut.lat.toFixed(4)}, Lng: {log.gpsLocationCheckOut.lng.toFixed(4)}
                            {typeof log.gpsLocationCheckOut.accuracy === 'number' && `, Acc: ${log.gpsLocationCheckOut.accuracy.toFixed(0)}m`}
                          </div>
                        </div>
                      )}
                      {log.locationTrack && log.locationTrack.length > 0 && (
                        <div className="mt-2 p-2 border rounded-md bg-blue-50">
                          <strong className="text-blue-700">Location Track ({log.locationTrack.length} points):</strong>
                          <ul className="list-disc list-inside pl-4 text-xs max-h-32 overflow-y-auto">
                            {log.locationTrack.map((point, index) => (
                              <li key={index}>
                                {typeof point.timestamp === 'number' ? format(new Date(point.timestamp), 'p') : point.timestamp}: Lat {point.lat.toFixed(4)}, Lng {point.lng.toFixed(4)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!log.gpsLocationCheckIn && !log.gpsLocationCheckOut && (!log.locationTrack || log.locationTrack.length === 0) && (
                         <p className="text-xs text-muted-foreground">No detailed location data available for this log entry.</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
