
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, ExternalLink, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { attendanceAnomalyDetection, AttendanceAnomalyDetectionOutput } from "@/ai/flows/attendance-anomaly-detection";
import Image from "next/image";

interface AttendanceLog {
  id: string;
  employeeName: string;
  employeeAvatar: string;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  taskActivity: string; // e.g., "Task: Install Workstations"
  location: string; // e.g., "Downtown Office Site"
  status: 'approved' | 'pending-review' | 'rejected';
  aiAnalysis?: AttendanceAnomalyDetectionOutput;
  isLoadingAi?: boolean;
}

// Mock data for attendance logs
const mockAttendanceLogs: AttendanceLog[] = [
  { id: "att1", employeeName: "Alice Smith", employeeAvatar: "https://placehold.co/40x40.png?text=AS", date: "2024-07-28", checkInTime: "08:55", checkOutTime: "17:05", taskActivity: "Network Cabling", location: "Downtown Office", status: "pending-review" },
  { id: "att2", employeeName: "Bob Johnson", employeeAvatar: "https://placehold.co/40x40.png?text=BJ", date: "2024-07-28", checkInTime: "09:10", checkOutTime: "17:30", taskActivity: "HVAC Inspection", location: "Residential Complex A", status: "approved" },
  { id: "att3", employeeName: "Carol White", employeeAvatar: "https://placehold.co/40x40.png?text=CW", date: "2024-07-27", checkInTime: "08:30", checkOutTime: "16:45", taskActivity: "Tree Planting", location: "City Park Zone 1", status: "pending-review" },
];

export default function AttendanceReviewPage() {
  const [logs, setLogs] = useState<AttendanceLog[]>(mockAttendanceLogs);
  const { toast } = useToast();

  const runAiAnalysis = async (logId: string) => {
    setLogs(prevLogs => prevLogs.map(log => log.id === logId ? { ...log, isLoadingAi: true } : log));
    
    const logToAnalyze = logs.find(log => log.id === logId);
    if (!logToAnalyze) return;

    try {
      // Mocking inputs for AI flow based on the log
      const aiResult = await attendanceAnomalyDetection({
        attendanceLog: `Employee: ${logToAnalyze.employeeName}, Date: ${logToAnalyze.date}, Check-in: ${logToAnalyze.checkInTime}, Check-out: ${logToAnalyze.checkOutTime}`,
        taskDetails: `Task: ${logToAnalyze.taskActivity}`,
        gpsData: `Location: ${logToAnalyze.location} (Coordinates: Mocked 34.05N, 118.24W)`, // Mock GPS
        supervisorNotes: "Regular check for this employee.", // Mock supervisor notes
        pastAssignmentData: "Employee has consistent past performance." // Mock past data
      });

      setLogs(prevLogs => prevLogs.map(log => 
        log.id === logId ? { ...log, aiAnalysis: aiResult, isLoadingAi: false } : log
      ));
      toast({ title: "AI Analysis Complete", description: `Analysis for ${logToAnalyze.employeeName}'s log finished.` });
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setLogs(prevLogs => prevLogs.map(log => log.id === logId ? { ...log, isLoadingAi: false } : log));
      toast({ title: "AI Error", description: "Could not complete AI analysis.", variant: "destructive" });
    }
  };

  const handleReviewAction = (logId: string, newStatus: 'approved' | 'rejected') => {
    setLogs(prevLogs => prevLogs.map(log => 
      log.id === logId ? { ...log, status: newStatus, aiAnalysis: undefined } : log // Clear AI analysis after action
    ));
    toast({ title: `Log ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`, description: `Attendance for ${logs.find(l=>l.id===logId)?.employeeName} has been ${newStatus}.`});
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Attendance Review" 
        description="Review employee attendance logs, especially those flagged for anomalies."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Attendance Logs Requiring Attention</CardTitle>
          <CardDescription>Review logs and take appropriate action. Use AI analysis for insights.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Times</TableHead>
                <TableHead>Task/Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI Insights</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.filter(log => log.status === 'pending-review').map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <Image src={log.employeeAvatar} alt={log.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                      <span className="font-medium">{log.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{log.date}</TableCell>
                  <TableCell>{log.checkInTime} - {log.checkOutTime}</TableCell>
                  <TableCell>
                    <div>{log.taskActivity}</div>
                    <div className="text-xs text-muted-foreground">{log.location}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === 'approved' ? 'default' : log.status === 'rejected' ? 'destructive' : 'outline'}
                     className={log.status === 'approved' ? 'bg-green-500 text-white' : log.status === 'pending-review' ? 'border-yellow-500 text-yellow-600' : ''}>
                      {log.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.isLoadingAi ? (
                      <span className="text-xs text-muted-foreground">Analyzing...</span>
                    ) : log.aiAnalysis ? (
                      log.aiAnalysis.anomalyDetected ? (
                        <div className="text-xs text-destructive flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          {log.aiAnalysis.anomalyDetails} ({log.aiAnalysis.recommendedAction})
                        </div>
                      ) : (
                        <div className="text-xs text-green-600 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1" />
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
              {logs.filter(log => log.status === 'pending-review').length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No attendance logs currently require review.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
          <CardTitle className="font-headline">Approved/Rejected Logs</CardTitle>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
             {logs.filter(log => log.status !== 'pending-review').map((log) => (
                <TableRow key={log.id}>
                    <TableCell>
                        <div className="flex items-center gap-2">
                        <Image src={log.employeeAvatar} alt={log.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                        <span className="font-medium">{log.employeeName}</span>
                        </div>
                    </TableCell>
                    <TableCell>{log.date}</TableCell>
                    <TableCell>
                        <Badge variant={log.status === 'approved' ? 'default' : 'destructive'}
                        className={log.status === 'approved' ? 'bg-green-500 text-white' : ''}>
                        {log.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                    </TableCell>
                </TableRow>
             ))}
             {logs.filter(log => log.status !== 'pending-review').length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No processed logs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
           </Table>
        </CardContent>
       </Card>
    </div>
  );
}
