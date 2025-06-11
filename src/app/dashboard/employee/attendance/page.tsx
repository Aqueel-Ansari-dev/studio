
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CalendarDays, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchTodaysAttendance, AttendanceLog } from '@/app/actions/attendance';
import { fetchAllProjects, ProjectForSelection, FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { format, parseISO } from 'date-fns';

// Simplified component, as core functionality moved to global AttendanceButton

export default function EmployeeAttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(''); // Still needed to display relevant history
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceLog[]>([]); // Placeholder for future history display
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); // Placeholder

  const loadProjectsList = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const result: FetchAllProjectsResult = await fetchAllProjects();
      if (result.success && result.projects) {
        setProjects(result.projects);
        if (result.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(result.projects[0].id);
        }
      } else {
        setProjects([]);
        toast({ title: "Error", description: result.error || "Could not load projects.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      toast({ title: "Error", description: "Could not load projects.", variant: "destructive" });
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [toast, selectedProjectId]);

  useEffect(() => {
    if (!authLoading && user) {
        loadProjectsList();
        // TODO: Implement fetching attendance history for the selected project/all projects
        // For now, attendanceHistory will remain empty.
    }
  }, [authLoading, user, loadProjectsList]);

  const handleRefreshHistory = useCallback(async () => {
    if (!user?.id || !selectedProjectId) return;
    setIsLoadingHistory(true);
    // Placeholder: In a real app, you would fetch a list of attendance logs here.
    // For example: const historyResult = await fetchAttendanceHistory(user.id, selectedProjectId);
    // setAttendanceHistory(historyResult.logs || []);
    toast({title: "History Refresh", description: "History fetching is a placeholder for now."});
    setIsLoadingHistory(false);
  }, [user?.id, selectedProjectId, toast]);
  
  const isOverallLoading = authLoading || loadingProjects || isLoadingHistory;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Attendance Log" 
        description="View your past attendance records. Punch-in/out globally using the button at the bottom-right."
        actions={
          <Button onClick={handleRefreshHistory} variant="outline" disabled={isOverallLoading || !selectedProjectId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} /> Refresh History
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center">
            <CalendarDays className="mr-2 h-6 w-6 text-primary" /> Attendance History
          </CardTitle>
          <CardDescription>
            Your past attendance records will be displayed here. (History display coming soon)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            {isOverallLoading ? (
                <div className="text-center py-10">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="mt-2 text-muted-foreground">Loading data...</p>
                </div>
            ) : attendanceHistory.length === 0 ? (
                 <div className="text-center py-10 text-muted-foreground">
                    <MapPin className="mx-auto h-12 w-12 mb-4"/>
                    <p className="font-semibold">No attendance history to display yet.</p>
                    <p>Your punch-in and punch-out records will appear here.</p>
                </div>
            ) : (
                <div className="text-center py-10 text-muted-foreground">
                     {/* Placeholder for history table/list */}
                    <p>Attendance history display will be implemented here.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
