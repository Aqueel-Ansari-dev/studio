
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, ExternalLink, UserCheck, RefreshCw, MapPin, Briefcase } from "lucide-react"; // Added RefreshCw
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { attendanceAnomalyDetection, AttendanceAnomalyDetectionOutput } from "@/ai/flows/attendance-anomaly-detection";
import { fetchAttendanceLogsForSupervisorReview, AttendanceLogForSupervisorView } from '@/app/actions/attendance';
import Image from "next/image";
import { format, parseISO } from 'date-fns';

// Extended local type for UI state management
interface UIAttendanceLog extends AttendanceLogForSupervisorView {
  uiStatus: 'pending-review' | 'approved' | 'rejected'; // Local UI status
  aiAnalysis?: AttendanceAnomalyDetectionOutput;
  isLoadingAi?: boolean;
}

export default function AttendanceReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [allLogs, setAllLogs] = useState<UIAttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadAttendanceLogs = useCallback(async () => {
    if (!user?.id) {
      if (!authLoading) toast({ title: "Authentication Error", description: "Please log in.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const result = await fetchAttendanceLogsForSupervisorReview(user.id);
      if (result.success && result.logs) {
        setAllLogs(result.logs.map(log => ({ ...log, uiStatus: 'pending-review' })));
      } else {
        toast({ title: "Error Loading Logs", description: result.error || "Could not fetch attendance logs.", variant: "destructive" });
        setAllLogs([]);
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred while fetching logs.", variant: "destructive" });
      setAllLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      loadAttendanceLogs();
    }
  }, [loadAttendanceLogs, authLoading, user]);


  const runAiAnalysis = async (logId: string) => {
    setAllLogs(prevLogs => prevLogs.map(log => log.id === logId ? { ...log, isLoadingAi: true } : log));
    
    const logToAnalyze = allLogs.find(log => log.id === logId);
    if (!logToAnalyze) return;

    try {
      const aiResult = await attendanceAnomalyDetection({
        attendanceLog: `Employee: ${logToAnalyze.employeeName}, Date: ${logToAnalyze.date}, Check-in: ${format(parseISO(logToAnalyze.checkInTime), 'p')}, Check-out: ${logToAnalyze.checkOutTime ? format(parseISO(logToAnalyze.checkOutTime), 'p') : 'N/A'}`,
        taskDetails: `Project: ${logToAnalyze.projectName}`, // Using project name as task detail for now
        gpsData: `Location: Lat ${logToAnalyze.gpsLocationCheckIn.lat.toFixed(4)}, Lng ${logToAnalyze.gpsLocationCheckIn.lng.toFixed(4)}`,
        // These could be enriched if supervisor notes are stored per log or project
        supervisorNotes: "Regular shift.", 
        pastAssignmentData: "Employee has consistent past performance."
      });

      setAllLogs(prevLogs => prevLogs.map(log => 
        log.id === logId ? { ...log, aiAnalysis: aiResult, isLoadingAi: false } : log
      ));
      toast({ title: "AI Analysis Complete", description: `Analysis for ${logToAnalyze.employeeName}'s log finished.` });
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAllLogs(prevLogs => prevLogs.map(log => log.id === logId ? { ...log, isLoadingAi: false } : log));
      toast({ title: "AI Error", description: "Could not complete AI analysis.", variant: "destructive" });
    }
  };

  const handleReviewAction = (logId: string, newUiStatus: 'approved' | 'rejected') => {
    setAllLogs(prevLogs => prevLogs.map(log => 
      log.id === logId ? { ...log, uiStatus: newUiStatus, aiAnalysis: undefined } : log // Clear AI analysis after action
    ));
    const targetLog = allLogs.find(l => l.id === logId);
    toast({ title: `Log ${newUiStatus.charAt(0).toUpperCase() + newUiStatus.slice(1)}`, description: `Attendance for ${targetLog?.employeeName} has been marked as ${newUiStatus}.`});
  };

  const logsForReview = allLogs.filter(log => log.uiStatus === 'pending-review');
  const processedLogs = allLogs.filter(log => log.uiStatus !== 'pending-review');

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Attendance Review" 
        description="Review employee attendance logs. Use AI analysis for insights."
        actions={
          <Button onClick={loadAttendanceLogs} variant="outline" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Logs
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Logs Requiring Attention ({logsForReview.length})</CardTitle>
          <CardDescription>Review logs and take appropriate action. Trigger AI analysis for insights.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><RefreshCw className="mr-2 h-6 w-6 animate-spin" /> Loading logs...</div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Times</TableHead>
                <TableHead>Project & Location</TableHead>
                <TableHead>AI Insights</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsForReview.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <Image src={log.employeeAvatar} alt={log.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                      <span className="font-medium">{log.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{log.date}</TableCell>
                  <TableCell>
                    {format(parseISO(log.checkInTime), 'p')} - {log.checkOutTime ? format(parseISO(log.checkOutTime), 'p') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Briefcase className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                      {log.projectName}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center mt-0.5">
                      <MapPin className="w-3.5 h-3.5 mr-1.5" />
                      Lat: {log.gpsLocationCheckIn.lat.toFixed(2)}, Lng: {log.gpsLocationCheckIn.lng.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.isLoadingAi ? (
                      <span className="text-xs text-muted-foreground">Analyzing...</span>
                    ) : log.aiAnalysis ? (
                      log.aiAnalysis.anomalyDetected ? (
                        <div className="text-xs text-destructive">
                          <p className="flex items-center"><AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0" />{log.aiAnalysis.anomalyDetails}</p>
                          {log.aiAnalysis.recommendedAction && <p className="mt-0.5 text-muted-foreground">Action: {log.aiAnalysis.recommendedAction}</p>}
                        </div>
                      ) : (
                        <div className="text-xs text-green-600 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                          No anomalies detected.
                        </div>
                      )
                    ) : (
                      <Button variant="link" size="sm" onClick={() => runAiAnalysis(log.id)} className="p-0 h-auto text-xs">Run AI Check</Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleReviewAction(log.id, 'rejected')} className="border-destructive text-destructive hover:bg-destructive/10">Reject</Button>
                    <Button size="sm" onClick={() => handleReviewAction(log.id, 'approved')} className="bg-green-500 hover:bg-green-600">Approve</Button>
                  </TableCell>
                </TableRow>
              ))}
              {logsForReview.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No attendance logs currently require review.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="font-headline">Reviewed Logs ({processedLogs.length})</CardTitle>
          <CardDescription>Attendance logs that have been marked as Approved or Rejected by a supervisor.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
            <div className="text-center py-4"><RefreshCw className="mr-2 h-6 w-6 animate-spin" /> Loading logs...</div>
          ) : (
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
             {processedLogs.map((log) => (
                <TableRow key={log.id}>
                    <TableCell>
                        <div className="flex items-center gap-2">
                        <Image src={log.employeeAvatar} alt={log.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                        <span className="font-medium">{log.employeeName}</span>
                        </div>
                    </TableCell>
                    <TableCell>{log.date}</TableCell>
                    <TableCell>{log.projectName}</TableCell>
                    <TableCell>
                        <Badge variant={log.uiStatus === 'approved' ? 'default' : 'destructive'}
                        className={log.uiStatus === 'approved' ? 'bg-green-500 text-white' : ''}>
                        {log.uiStatus.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                    </TableCell>
                </TableRow>
             ))}
             {processedLogs.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                    No logs have been reviewed yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
           </Table>
           )}
        </CardContent>
       </Card>
    </div>
  );
}
